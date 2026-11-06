// The single-table storage the ledger is built on. Two backends with the same behaviour:
// MemoryTable for tests and local runs, DynamoTable for AWS. The ledger's logic is written once,
// against this interface, so the tests exercise the same code that runs in prod.
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

export interface Item {
  pk: string;
  sk: string;
  gsi1pk?: string;
  gsi1sk?: string;
  gsi2pk?: string;
  gsi2sk?: string;
  ttl?: number;
  [k: string]: unknown;
}
export type Index = "gsi1" | "gsi2";

export interface UpdateOptions {
  /** Attributes set to these values. */
  set?: Record<string, unknown>;
  /** Numbers added atomically (DynamoDB ADD). */
  add?: Record<string, number>;
  /** Fail (return undefined) unless the item exists. */
  mustExist?: boolean;
  /** Fail unless each attribute currently equals the value (undefined = attribute absent). */
  expect?: Record<string, unknown>;
  /** Fail unless the attribute, plus the amount added, stays at or below the limit. */
  addLimit?: { attr: string; max: number };
}

export interface Table {
  get(pk: string, sk: string): Promise<Item | undefined>;
  /** Returns false when ifNotExists is set and the item already exists. */
  put(item: Item, opts?: { ifNotExists?: boolean }): Promise<boolean>;
  /** Returns the item after the update, or undefined when a condition failed. */
  update(pk: string, sk: string, opts: UpdateOptions): Promise<Item | undefined>;
  query(pk: string, skPrefix?: string): Promise<Item[]>;
  queryIndex(index: Index, pk: string, skPrefix?: string): Promise<Item[]>;
  delete(pk: string, sk: string): Promise<void>;
}

const key = (pk: string, sk: string) => `${pk}\u0000${sk}`;
const clone = <T>(v: T): T => structuredClone(v);

export class MemoryTable implements Table {
  readonly items = new Map<string, Item>();
  /** Test hook: throw on the next N writes, to simulate a crash mid-turn. */
  failWrites = 0;

  private guard() {
    if (this.failWrites > 0) {
      this.failWrites--;
      throw new Error("simulated storage failure");
    }
  }
  async get(pk: string, sk: string) {
    const it = this.items.get(key(pk, sk));
    return it ? clone(it) : undefined;
  }
  async put(item: Item, opts: { ifNotExists?: boolean } = {}) {
    this.guard();
    const k = key(item.pk, item.sk);
    if (opts.ifNotExists && this.items.has(k)) return false;
    this.items.set(k, clone(item));
    return true;
  }
  async update(pk: string, sk: string, opts: UpdateOptions) {
    this.guard();
    const k = key(pk, sk);
    const cur = this.items.get(k);
    if (opts.mustExist && !cur) return undefined;
    for (const [a, v] of Object.entries(opts.expect ?? {})) if ((cur?.[a] ?? undefined) !== v) return undefined;
    if (opts.addLimit) {
      const now = Number(cur?.[opts.addLimit.attr] ?? 0);
      const delta = opts.add?.[opts.addLimit.attr] ?? 0;
      if (now + delta > opts.addLimit.max) return undefined;
    }
    const next: Item = cur ? { ...cur } : { pk, sk };
    for (const [a, v] of Object.entries(opts.set ?? {})) next[a] = clone(v);
    for (const [a, n] of Object.entries(opts.add ?? {})) next[a] = Number(next[a] ?? 0) + n;
    this.items.set(k, next);
    return clone(next);
  }
  async query(pk: string, skPrefix = "") {
    return [...this.items.values()]
      .filter((i) => i.pk === pk && i.sk.startsWith(skPrefix))
      .sort((a, b) => a.sk.localeCompare(b.sk))
      .map(clone);
  }
  async queryIndex(index: Index, pk: string, skPrefix = "") {
    const pkA = `${index}pk`,
      skA = `${index}sk`;
    return [...this.items.values()]
      .filter((i) => i[pkA] === pk && String(i[skA] ?? "").startsWith(skPrefix))
      .sort((a, b) => String(a[skA]).localeCompare(String(b[skA])))
      .map(clone);
  }
  async delete(pk: string, sk: string) {
    this.guard();
    this.items.delete(key(pk, sk));
  }
}

const isConditionFailure = (e: unknown) => (e as { name?: string })?.name === "ConditionalCheckFailedException";

export class DynamoTable implements Table {
  constructor(
    private doc: Pick<DynamoDBDocumentClient, "send">,
    private tableName: string,
  ) {}

  async get(pk: string, sk: string) {
    const r = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { pk, sk }, ConsistentRead: true }));
    return r.Item as Item | undefined;
  }
  async put(item: Item, opts: { ifNotExists?: boolean } = {}) {
    try {
      await this.doc.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
          ...(opts.ifNotExists ? { ConditionExpression: "attribute_not_exists(pk)" } : {}),
        }),
      );
      return true;
    } catch (e) {
      if (isConditionFailure(e)) return false;
      throw e;
    }
  }
  async update(pk: string, sk: string, opts: UpdateOptions) {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const sets: string[] = [];
    const adds: string[] = [];
    const conds: string[] = [];
    let n = 0;
    const nm = (a: string) => {
      const k = `#a${n++}`;
      names[k] = a;
      return k;
    };
    const vl = (v: unknown) => {
      const k = `:v${n++}`;
      values[k] = v;
      return k;
    };
    for (const [a, v] of Object.entries(opts.set ?? {})) sets.push(`${nm(a)} = ${vl(v)}`);
    for (const [a, v] of Object.entries(opts.add ?? {})) adds.push(`${nm(a)} ${vl(v)}`);
    if (opts.mustExist) conds.push(`attribute_exists(${nm("pk")})`);
    for (const [a, v] of Object.entries(opts.expect ?? {}))
      conds.push(v === undefined ? `attribute_not_exists(${nm(a)})` : `${nm(a)} = ${vl(v)}`);
    if (opts.addLimit) {
      const a = nm(opts.addLimit.attr);
      const room = vl(opts.addLimit.max - (opts.add?.[opts.addLimit.attr] ?? 0));
      conds.push(`(attribute_not_exists(${a}) OR ${a} <= ${room})`);
    }
    const expr = [sets.length ? `SET ${sets.join(", ")}` : "", adds.length ? `ADD ${adds.join(", ")}` : ""]
      .filter(Boolean)
      .join(" ");
    try {
      const r = await this.doc.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk, sk },
          UpdateExpression: expr,
          ExpressionAttributeNames: names,
          ...(Object.keys(values).length ? { ExpressionAttributeValues: values } : {}),
          ...(conds.length ? { ConditionExpression: conds.join(" AND ") } : {}),
          ReturnValues: "ALL_NEW",
        }),
      );
      return r.Attributes as Item;
    } catch (e) {
      if (isConditionFailure(e)) return undefined;
      throw e;
    }
  }
  private async queryAll(input: ConstructorParameters<typeof QueryCommand>[0]) {
    const out: Item[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const r = await this.doc.send(new QueryCommand({ ...input, ExclusiveStartKey: start }));
      out.push(...((r.Items ?? []) as Item[]));
      start = r.LastEvaluatedKey;
    } while (start);
    return out;
  }
  query(pk: string, skPrefix = "") {
    return this.queryAll({
      TableName: this.tableName,
      KeyConditionExpression: skPrefix ? "pk = :pk AND begins_with(sk, :sk)" : "pk = :pk",
      ExpressionAttributeValues: skPrefix ? { ":pk": pk, ":sk": skPrefix } : { ":pk": pk },
      ConsistentRead: true,
    });
  }
  queryIndex(index: Index, pk: string, skPrefix = "") {
    return this.queryAll({
      TableName: this.tableName,
      IndexName: index,
      KeyConditionExpression: skPrefix ? `${index}pk = :pk AND begins_with(${index}sk, :sk)` : `${index}pk = :pk`,
      ExpressionAttributeValues: skPrefix ? { ":pk": pk, ":sk": skPrefix } : { ":pk": pk },
    });
  }
  async delete(pk: string, sk: string) {
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { pk, sk } }));
  }
}

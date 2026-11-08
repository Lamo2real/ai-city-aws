"""The single-table storage the ledger is built on.

Two backends with the same behaviour: ``MemoryTable`` for tests and local runs, ``DynamoTable`` for AWS.
The ledger's logic is written once, against this interface, so the tests exercise the same code that runs
in prod.
"""

from __future__ import annotations

import asyncio
import copy
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Literal, Protocol

Item = dict[str, Any]
Index = Literal["gsi1", "gsi2"]

_ABSENT = object()


@dataclass
class AddLimit:
    attr: str
    max: float


@dataclass
class UpdateOptions:
    set: dict[str, Any] = field(default_factory=dict)
    """Attributes set to these values."""
    add: dict[str, float] = field(default_factory=dict)
    """Numbers added atomically (DynamoDB ADD)."""
    must_exist: bool = False
    """Fail (return None) unless the item exists."""
    expect: dict[str, Any] = field(default_factory=dict)
    """Fail unless each attribute currently equals the value (``ABSENT`` = attribute absent)."""
    add_limit: AddLimit | None = None
    """Fail unless the attribute, plus the amount added, stays at or below the limit."""


ABSENT: Any = _ABSENT
"""Use in ``UpdateOptions.expect`` for "the attribute must not exist"."""


class Table(Protocol):
    async def get(self, pk: str, sk: str) -> Item | None: ...
    async def put(self, item: Item, if_not_exists: bool = False) -> bool:
        """Returns False when if_not_exists is set and the item already exists."""
        ...

    async def update(self, pk: str, sk: str, opts: UpdateOptions) -> Item | None:
        """Returns the item after the update, or None when a condition failed."""
        ...

    async def query(self, pk: str, sk_prefix: str = "") -> list[Item]: ...
    async def batch_get(self, keys: list[tuple[str, str]]) -> list[Item]:
        """The items that exist among ``keys`` (any order)."""
        ...

    async def query_index(self, index: Index, pk: str, sk_prefix: str = "") -> list[Item]: ...
    async def delete(self, pk: str, sk: str) -> None: ...
    async def delete_if_exists(self, pk: str, sk: str) -> bool:
        """Deletes the item if it exists; True when this call deleted it (so two callers can't both win)."""
        ...

    async def scan_keys(self, start: Any = None) -> tuple[list[tuple[str, str]], Any]:
        """One page of ``(pk, sk)`` from ``start`` (``None``: the beginning) and where the next page starts
        (``None``: that was the last one). Only the owner's "start over" reads the whole table; everything
        else queries one key."""
        ...

    async def delete_many(self, keys: list[tuple[str, str]]) -> None: ...


class MemoryTable:
    def __init__(self) -> None:
        self.items: dict[tuple[str, str], Item] = {}
        self.fail_writes = 0
        """Test hook: raise on the next N writes, to simulate a crash mid-turn."""

    def _guard(self) -> None:
        if self.fail_writes > 0:
            self.fail_writes -= 1
            raise RuntimeError("simulated storage failure")

    async def get(self, pk: str, sk: str) -> Item | None:
        it = self.items.get((pk, sk))
        return copy.deepcopy(it) if it is not None else None

    async def put(self, item: Item, if_not_exists: bool = False) -> bool:
        self._guard()
        k = (item["pk"], item["sk"])
        if if_not_exists and k in self.items:
            return False
        self.items[k] = copy.deepcopy(item)
        return True

    async def update(self, pk: str, sk: str, opts: UpdateOptions) -> Item | None:
        self._guard()
        k = (pk, sk)
        cur = self.items.get(k)
        if opts.must_exist and cur is None:
            return None
        for a, v in opts.expect.items():
            now = (cur or {}).get(a, _ABSENT)
            if v is _ABSENT:
                if now is not _ABSENT:
                    return None
            elif now is _ABSENT or now != v:
                return None
        if opts.add_limit:
            now_n = float((cur or {}).get(opts.add_limit.attr, 0))
            delta = opts.add.get(opts.add_limit.attr, 0)
            if now_n + delta > opts.add_limit.max:
                return None
        nxt: Item = dict(cur) if cur is not None else {"pk": pk, "sk": sk}
        for a, v in opts.set.items():
            nxt[a] = copy.deepcopy(v)
        for a, n in opts.add.items():
            total = (nxt.get(a) or 0) + n
            nxt[a] = int(total) if float(total).is_integer() else total
        self.items[k] = nxt
        return copy.deepcopy(nxt)

    async def query(self, pk: str, sk_prefix: str = "") -> list[Item]:
        out = [i for i in self.items.values() if i["pk"] == pk and i["sk"].startswith(sk_prefix)]
        return [copy.deepcopy(i) for i in sorted(out, key=lambda i: i["sk"])]

    async def batch_get(self, keys: list[tuple[str, str]]) -> list[Item]:
        return [copy.deepcopy(self.items[k]) for k in dict.fromkeys(keys) if k in self.items]

    async def query_index(self, index: Index, pk: str, sk_prefix: str = "") -> list[Item]:
        pk_a, sk_a = f"{index}pk", f"{index}sk"
        out = [i for i in self.items.values() if i.get(pk_a) == pk and str(i.get(sk_a, "")).startswith(sk_prefix)]
        return [copy.deepcopy(i) for i in sorted(out, key=lambda i: str(i.get(sk_a, "")))]

    async def delete(self, pk: str, sk: str) -> None:
        self._guard()
        self.items.pop((pk, sk), None)

    async def delete_if_exists(self, pk: str, sk: str) -> bool:
        self._guard()
        return self.items.pop((pk, sk), None) is not None

    async def scan_keys(self, start: Any = None) -> tuple[list[tuple[str, str]], Any]:
        return sorted(self.items), None  # one page holds everything

    async def delete_many(self, keys: list[tuple[str, str]]) -> None:
        self._guard()
        for k in keys:
            self.items.pop(k, None)


# ---------- DynamoDB ----------


def _to_dynamo(v: Any) -> Any:
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, float):
        return Decimal(str(v))
    if isinstance(v, dict):
        return {k: _to_dynamo(x) for k, x in v.items()}
    if isinstance(v, list | tuple):
        return [_to_dynamo(x) for x in v]
    return v


def _from_dynamo(v: Any) -> Any:
    if isinstance(v, Decimal):
        return int(v) if v == v.to_integral_value() else float(v)
    if isinstance(v, dict):
        return {k: _from_dynamo(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_from_dynamo(x) for x in v]
    return v


def _deserialize(item: dict[str, Any]) -> dict[str, Any]:
    """The low-level client answers in typed form ({"S": "x"})."""
    from boto3.dynamodb.types import TypeDeserializer

    d = TypeDeserializer()
    return {k: d.deserialize(v) for k, v in item.items()}


class DynamoTable:
    """``table`` is a boto3 ``dynamodb.Table`` resource (or anything with the same methods, for tests)."""

    def __init__(self, table: Any) -> None:
        self._t = table

    @staticmethod
    def _is_condition_failure(e: Exception) -> bool:
        resp = getattr(e, "response", None) or {}
        return bool(resp.get("Error", {}).get("Code") == "ConditionalCheckFailedException")

    async def get(self, pk: str, sk: str) -> Item | None:
        r = await asyncio.to_thread(self._t.get_item, Key={"pk": pk, "sk": sk}, ConsistentRead=True)
        it = r.get("Item")
        return _from_dynamo(it) if it is not None else None

    async def put(self, item: Item, if_not_exists: bool = False) -> bool:
        kw: dict[str, Any] = {"Item": _to_dynamo(item)}
        if if_not_exists:
            kw["ConditionExpression"] = "attribute_not_exists(pk)"
        try:
            await asyncio.to_thread(self._t.put_item, **kw)
            return True
        except Exception as e:
            if self._is_condition_failure(e):
                return False
            raise

    async def update(self, pk: str, sk: str, opts: UpdateOptions) -> Item | None:
        names: dict[str, str] = {}
        values: dict[str, Any] = {}
        sets: list[str] = []
        adds: list[str] = []
        conds: list[str] = []
        n = 0

        def nm(a: str) -> str:
            nonlocal n
            k = f"#a{n}"
            n += 1
            names[k] = a
            return k

        def vl(v: Any) -> str:
            nonlocal n
            k = f":v{n}"
            n += 1
            values[k] = _to_dynamo(v)
            return k

        for a, v in opts.set.items():
            sets.append(f"{nm(a)} = {vl(v)}")
        for a, v in opts.add.items():
            adds.append(f"{nm(a)} {vl(v)}")
        if opts.must_exist:
            conds.append(f"attribute_exists({nm('pk')})")
        for a, v in opts.expect.items():
            conds.append(f"attribute_not_exists({nm(a)})" if v is _ABSENT else f"{nm(a)} = {vl(v)}")
        if opts.add_limit:
            attr = nm(opts.add_limit.attr)
            room = vl(opts.add_limit.max - opts.add.get(opts.add_limit.attr, 0))
            conds.append(f"(attribute_not_exists({attr}) OR {attr} <= {room})")
        expr = " ".join(
            x for x in (f"SET {', '.join(sets)}" if sets else "", f"ADD {', '.join(adds)}" if adds else "") if x
        )
        kw: dict[str, Any] = {
            "Key": {"pk": pk, "sk": sk},
            "UpdateExpression": expr,
            "ExpressionAttributeNames": names,
            "ReturnValues": "ALL_NEW",
        }
        if values:
            kw["ExpressionAttributeValues"] = values
        if conds:
            kw["ConditionExpression"] = " AND ".join(conds)
        try:
            r = await asyncio.to_thread(self._t.update_item, **kw)
            return _from_dynamo(r.get("Attributes"))
        except Exception as e:
            if self._is_condition_failure(e):
                return None
            raise

    async def _query_all(self, **kw: Any) -> list[Item]:
        out: list[Item] = []
        start: dict[str, Any] | None = None
        while True:
            args = {**kw, **({"ExclusiveStartKey": start} if start else {})}
            r = await asyncio.to_thread(self._t.query, **args)
            out.extend(_from_dynamo(i) for i in r.get("Items", []))
            start = r.get("LastEvaluatedKey")
            if not start:
                return out

    async def query(self, pk: str, sk_prefix: str = "") -> list[Item]:
        return await self._query_all(
            KeyConditionExpression="pk = :pk AND begins_with(sk, :sk)" if sk_prefix else "pk = :pk",
            ExpressionAttributeValues={":pk": pk, ":sk": sk_prefix} if sk_prefix else {":pk": pk},
            ConsistentRead=True,
        )

    async def batch_get(self, keys: list[tuple[str, str]]) -> list[Item]:
        """BatchGetItem in chunks of 100, consistent reads, retrying unprocessed keys."""
        out: list[Item] = []
        unique = list(dict.fromkeys(keys))
        name = self._t.name
        client = self._t.meta.client
        for i in range(0, len(unique), 100):
            request: dict[str, Any] = {
                name: {
                    "Keys": [{"pk": {"S": pk}, "sk": {"S": sk}} for pk, sk in unique[i : i + 100]],
                    "ConsistentRead": True,
                }
            }
            for _ in range(5):
                r = await asyncio.to_thread(client.batch_get_item, RequestItems=request)
                out.extend(_from_dynamo(_deserialize(x)) for x in r.get("Responses", {}).get(name, []))
                request = r.get("UnprocessedKeys") or {}
                if not request:
                    break
        return out

    async def query_index(self, index: Index, pk: str, sk_prefix: str = "") -> list[Item]:
        return await self._query_all(
            IndexName=index,
            KeyConditionExpression=(
                f"{index}pk = :pk AND begins_with({index}sk, :sk)" if sk_prefix else f"{index}pk = :pk"
            ),
            ExpressionAttributeValues={":pk": pk, ":sk": sk_prefix} if sk_prefix else {":pk": pk},
        )

    async def delete(self, pk: str, sk: str) -> None:
        await asyncio.to_thread(self._t.delete_item, Key={"pk": pk, "sk": sk})

    async def delete_if_exists(self, pk: str, sk: str) -> bool:
        try:
            await asyncio.to_thread(
                self._t.delete_item, Key={"pk": pk, "sk": sk}, ConditionExpression="attribute_exists(pk)"
            )
            return True
        except Exception as e:
            if self._is_condition_failure(e):
                return False
            raise

    async def scan_keys(self, start: Any = None) -> tuple[list[tuple[str, str]], Any]:
        """One scan page (DynamoDB caps a page at 1 MB of *stored* items, projection or not, so a city full of
        long turns takes many pages)."""
        args: dict[str, Any] = {"ProjectionExpression": "pk, sk", **({"ExclusiveStartKey": start} if start else {})}
        r = await asyncio.to_thread(self._t.scan, **args)
        return [(str(i["pk"]), str(i["sk"])) for i in r.get("Items", [])], r.get("LastEvaluatedKey") or None

    DELETE_LANES = 8
    """Batch writers running side by side in ``delete_many``: a big city goes in seconds, not minutes."""

    async def delete_many(self, keys: list[tuple[str, str]]) -> None:
        """BatchWriteItem in the resource's batch writer (25 a request, unprocessed ones retried), several
        writers at once."""

        def run(part: list[tuple[str, str]]) -> None:
            with self._t.batch_writer() as batch:
                for pk, sk in part:
                    batch.delete_item(Key={"pk": pk, "sk": sk})

        lanes = max(1, min(self.DELETE_LANES, len(keys) // 25))
        parts = [keys[i::lanes] for i in range(lanes)]
        await asyncio.gather(*(asyncio.to_thread(run, p) for p in parts if p))

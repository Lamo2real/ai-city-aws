// AWS implementations of the queue and the factory client, plus the production wiring from env.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EventBridgeBus } from "./bus.ts";
import { DEFAULT_SETTINGS } from "./caps.ts";
import type { AgentRecord } from "./events.ts";
import type { FactoryClient, HireSpec } from "./hierarchy/factory.ts";
import type { Queue, WorkMessage } from "./hierarchy/queue.ts";
import { Ledger } from "./ledger.ts";
import { DynamoTable } from "./table.ts";

/** One SQS queue per role level; the URL for each comes from the environment. */
export class SqsQueue implements Queue {
  constructor(
    private sqs: Pick<SQSClient, "send">,
    private urls: Record<WorkMessage["role"], string>,
  ) {}
  async send(message: WorkMessage, delaySeconds = 0): Promise<void> {
    const url = this.urls[message.role];
    if (!url) throw new Error(`no queue for ${message.role}`);
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: url,
        MessageBody: JSON.stringify(message),
        DelaySeconds: Math.min(900, Math.max(0, Math.round(delaySeconds))),
        MessageAttributes: {
          department: { DataType: "String", StringValue: message.department ?? "-" },
          ticket: { DataType: "String", StringValue: message.ticketId },
        },
      }),
    );
  }
}

/** The runtime calls the Agent Factory Lambda; the Lambda holds the logic and the ledger rights. */
export class LambdaFactoryClient implements FactoryClient {
  constructor(
    private lambda: Pick<LambdaClient, "send">,
    private functionName: string,
  ) {}
  private async call(body: unknown): Promise<AgentRecord> {
    const r = await this.lambda.send(
      new InvokeCommand({ FunctionName: this.functionName, Payload: new TextEncoder().encode(JSON.stringify(body)) }),
    );
    const out = JSON.parse(new TextDecoder().decode(r.Payload)) as { ok: boolean; agent?: AgentRecord; error?: string };
    if (r.FunctionError || !out.ok) throw new Error(out.error ?? "the Agent Factory failed");
    return out.agent!;
  }
  hire(spec: HireSpec, managerId: string, department: string) {
    return this.call({ action: "hire", spec, managerId, department });
  }
  release(workerId: string, managerId: string) {
    return this.call({ action: "release", workerId, managerId });
  }
}

export function requireEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const v = env[name];
  if (!v) throw new Error(`missing environment variable ${name}`);
  return v;
}

/** Production wiring shared by Lambdas and the runtime. */
export function awsCity(env: NodeJS.ProcessEnv = process.env) {
  const region = requireEnv("AWS_REGION", env);
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const ledger = new Ledger(new DynamoTable(doc, requireEnv("AIC_LEDGER_TABLE", env)));
  const bus = new EventBridgeBus(new EventBridgeClient({ region }), requireEnv("AIC_EVENT_BUS", env));
  const queue = new SqsQueue(new SQSClient({ region }), {
    ace: env.AIC_QUEUE_ACE ?? "",
    orchestrator: env.AIC_QUEUE_ORCHESTRATOR ?? "",
    manager: env.AIC_QUEUE_MANAGER ?? "",
    worker: env.AIC_QUEUE_WORKER ?? "",
  });
  const settings = () => ledger.settings(DEFAULT_SETTINGS);
  return { region, doc, ledger, bus, queue, settings };
}

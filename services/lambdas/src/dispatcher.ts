// SQS → Dispatcher → AgentCore. One function serves the four role queues. Partial batch failure:
// a message whose turn could not start is retried by SQS; deferred messages are re-sent with a delay.
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import {
  Dispatcher,
  awsCity,
  log,
  sessionIds,
  type AgentInvoker,
  type Invocation,
  type WorkMessage,
} from "@aic/shared";

export interface SqsRecord {
  messageId: string;
  body: string;
}
export interface SqsEvent {
  Records: SqsRecord[];
}
export interface BatchResult {
  batchItemFailures: Array<{ itemIdentifier: string }>;
}

export function sessionIdFor(m: WorkMessage, owner = "owner"): string {
  switch (m.role) {
    case "ace":
      return sessionIds.ace(owner, m.conversation ?? "default");
    case "orchestrator":
      return sessionIds.orchestrator(m.taskId);
    case "manager":
      return sessionIds.manager(m.department ?? "none", m.taskId);
    case "worker":
      return sessionIds.worker(m.department ?? "none", m.agentId);
  }
}

export function agentCoreInvoker(
  client: Pick<BedrockAgentCoreClient, "send">,
  arns: Record<Invocation["role"], string>,
): AgentInvoker {
  return {
    async invoke(inv) {
      const arn = arns[inv.role];
      if (!arn) throw new Error(`no runtime for ${inv.role}`);
      const r = await client.send(
        new InvokeAgentRuntimeCommand({
          agentRuntimeArn: arn,
          runtimeSessionId: inv.sessionId,
          contentType: "application/json",
          accept: "application/json",
          payload: new TextEncoder().encode(JSON.stringify(inv)),
        }),
      );
      if (r.statusCode && r.statusCode >= 400) throw new Error(`runtime answered ${r.statusCode}`);
    },
  };
}

export async function processBatch(event: SqsEvent, dispatcher: Pick<Dispatcher, "handle">): Promise<BatchResult> {
  const failures: BatchResult["batchItemFailures"] = [];
  for (const r of event.Records) {
    let m: WorkMessage;
    try {
      m = JSON.parse(r.body) as WorkMessage;
    } catch {
      log("error", "dispatch.bad_message", { messageId: r.messageId });
      continue; // unparseable: nothing to retry; it is visible in the logs
    }
    try {
      const outcome = await dispatcher.handle(m);
      log("info", "dispatch", { messageId: r.messageId, role: m.role, ticket: m.ticketId, outcome });
    } catch (e) {
      log("error", "dispatch.failed", {
        messageId: r.messageId,
        role: m.role,
        ticket: m.ticketId,
        error: (e as Error).name,
      });
      failures.push({ itemIdentifier: r.messageId });
    }
  }
  return { batchItemFailures: failures };
}

let cached: Dispatcher | undefined;
function dispatcher(): Dispatcher {
  if (cached) return cached;
  const city = awsCity();
  const env = process.env;
  const invoker = agentCoreInvoker(new BedrockAgentCoreClient({ region: city.region }), {
    ace: env.AIC_RUNTIME_ARN_ACE ?? "",
    orchestrator: env.AIC_RUNTIME_ARN_ORCHESTRATOR ?? "",
    manager: env.AIC_RUNTIME_ARN_MANAGER ?? "",
    worker: env.AIC_RUNTIME_ARN_WORKER ?? "",
  });
  cached = new Dispatcher({
    ledger: city.ledger,
    bus: city.bus,
    queue: city.queue,
    invoker,
    settings: city.settings,
    sessionIdFor: (m) => sessionIdFor(m, env.AIC_OWNER_ID ?? "owner"),
  });
  return cached;
}

export const handler = (event: SqsEvent): Promise<BatchResult> => processBatch(event, dispatcher());

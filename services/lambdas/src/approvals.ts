// Step Functions approval workflow (Standard): approval.requested → state machine → this Lambda with
// waitForTaskToken stores the token on the approval → the owner decides in the HUD → the API sends
// the task result → the "resume" step wakes the agent to try the exact action again (or not).
import { awsCity, newId, type Ledger, type Queue } from "@aic/shared";

export interface StoreTokenEvent {
  step: "store_token";
  approvalId: string;
  taskToken: string;
}
export interface ResumeEvent {
  step: "resume";
  approvalId: string;
  approved: boolean;
}

export async function onApprovalStep(event: StoreTokenEvent | ResumeEvent, d: { ledger: Ledger; queue: Queue }) {
  const a = await d.ledger.getApproval(event.approvalId);
  if (!a) return { ok: false };
  if (event.step === "store_token") {
    await d.ledger.table.update(`APPROVAL#${a.id}`, "META", { set: { task_token: event.taskToken } });
    return { ok: true };
  }
  const agent = await d.ledger.getAgent(a.agent);
  if (!agent || agent.state === "retired" || !a.ticket_id) return { ok: true };
  const role =
    agent.kind === "worker"
      ? "worker"
      : agent.kind === "manager"
        ? "manager"
        : agent.id === "ace"
          ? "ace"
          : "orchestrator";
  await d.queue.send({
    id: newId("m"),
    role,
    agentId: agent.id,
    department: agent.department,
    ticketId: a.ticket_id,
    taskId: a.ticket_id,
    kind: "answer",
    from: "owner",
    body: event.approved
      ? `The owner approved exactly this action once: ${a.action}. You may run it now, unchanged.`
      : `The owner refused this action: ${a.action}. Do not try it another way; continue without it or report.`,
  });
  return { ok: true };
}

export const handler = (event: StoreTokenEvent | ResumeEvent) => {
  const { ledger, queue } = awsCity();
  return onApprovalStep(event, { ledger, queue });
};

// AWS Budgets alerts (the backstop) arrive here through SNS. At 100% the city pauses itself; the
// budget action separately attaches a deny-Bedrock policy to the agent roles. Budgets lag by hours.
import { awsCity, type EventBus, type Ledger } from "@aic/shared";

export interface SnsEvent {
  Records: Array<{ Sns: { Subject?: string; Message: string } }>;
}

/** Budgets messages name the threshold, e.g. "ACTUAL Amount ... exceeded 100% ..." or "Threshold: 80.0%". */
export function thresholdOf(text: string): number | null {
  const m = /(\d{2,3}(?:\.\d+)?)\s*%/.exec(text);
  return m ? Number(m[1]) : null;
}

export async function onBudgetAlert(
  event: SnsEvent,
  d: { ledger: Ledger; bus: EventBus },
): Promise<{ paused: boolean; threshold: number | null }> {
  let top: number | null = null;
  for (const r of event.Records) {
    const t = thresholdOf(`${r.Sns.Subject ?? ""} ${r.Sns.Message}`);
    if (t !== null) top = Math.max(top ?? 0, t);
  }
  if (top !== null && top >= 100 && !(await d.ledger.isPaused())) {
    const reason = "The AWS monthly budget is used up (AWS Budgets, 100%)";
    await d.ledger.updateSettings({ paused: true, pause_reason: reason });
    await d.bus.put({ type: "city.state", paused: true, reason });
    return { paused: true, threshold: top };
  }
  return { paused: false, threshold: top };
}

export const handler = (event: SnsEvent) => {
  const { ledger, bus } = awsCity();
  return onBudgetAlert(event, { ledger, bus });
};

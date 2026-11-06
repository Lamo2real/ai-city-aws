// EventBridge Scheduler jobs. All are created DISABLED by Terraform; the owner enables them.
// - sweep: re-send work whose lease ran out (a crashed turn), and expire nothing silently.
// - retire_idle: managers with no open work go dormant (they cost nothing either way; this keeps the City tidy).
// - reminders: due reminders become notifications.
// - improve: the weekly self-improvement loop. Built, and refused here unless explicitly enabled.
import { awsCity, log, resumeStale, type EventBus, type Ledger, type Queue } from "@aic/shared";
import { improvementAllowed } from "./improve.ts";

export type Job = "sweep" | "retire_idle" | "reminders" | "improve";

export async function runJob(
  job: Job,
  d: { ledger: Ledger; queue: Queue; bus: EventBus; env?: NodeJS.ProcessEnv },
): Promise<Record<string, number | string>> {
  switch (job) {
    case "sweep":
      return { resent: await resumeStale(d.ledger, d.queue) };
    case "retire_idle": {
      let n = 0;
      const open = await d.ledger.listTickets(["open", "in_progress", "in_review", "waiting_on_owner"]);
      for (const a of await d.ledger.listAgents("active")) {
        if (a.kind !== "manager") continue;
        if (open.some((t) => t.to === a.id || t.from === a.id)) continue;
        await d.ledger.updateAgent(a.id, { state: "dormant" });
        n++;
      }
      return { dormant: n };
    }
    case "reminders": {
      const now = d.ledger.now().toISOString();
      const due = (await d.ledger.listNotes("reminder")).filter((r) => r.due_at && r.due_at <= now);
      for (const r of due)
        await d.ledger.table.update(`REMINDER#${r.id}`, "META", { set: { gsi1pk: "REMINDER#sent" } });
      return { due: due.length };
    }
    case "improve": {
      const gate = improvementAllowed(d.env ?? process.env);
      if (!gate.ok) return { skipped: gate.why };
      return { skipped: "the self-improvement loop has no runner in this build" };
    }
  }
}

export const handler = async (event: { job: Job }) => {
  const city = awsCity();
  const out = await runJob(event.job, { ledger: city.ledger, queue: city.queue, bus: city.bus });
  log("info", `job.${event.job}`, out);
  return out;
};

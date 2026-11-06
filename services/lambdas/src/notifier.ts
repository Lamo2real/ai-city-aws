// Notifications to the owner's email (SNS): completed tasks, spend alerts, and questions that waited
// more than 15 minutes. Plain words, no IDs beyond a short reference, no content from outside.
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { CityEvent, DEFAULT_SETTINGS, awsCity, requireEnv, type Ledger } from "@aic/shared";

export interface Notice {
  subject: string;
  message: string;
}
export const QUESTION_NUDGE_MS = 15 * 60_000;

export function noticeFor(detail: unknown): Notice | null {
  const p = CityEvent.safeParse(detail);
  if (!p.success) return null;
  const e = p.data;
  switch (e.type) {
    case "result":
      return {
        subject: "AI City: a task is done",
        message: `Ace has a result for you. Open AI City to hear it.\n\nSummary: ${e.summary.slice(0, 300)}`,
      };
    case "spend.cap_reached":
      return {
        subject: "AI City: spend cap reached",
        message: `The ${e.cap.replace(/_/g, " ")} cap of $${e.limit} is reached (estimate $${e.spent.toFixed(2)}). No new work starts until you raise the cap or the period resets.`,
      };
    case "city.state":
      return e.paused
        ? {
            subject: "AI City is paused",
            message: `${e.reason ?? "Paused"}. Work already running finishes; nothing new starts.`,
          }
        : null;
    default:
      return null;
  }
}

/** Questions open for more than 15 minutes, each nudged once. */
export async function staleQuestions(ledger: Ledger): Promise<Notice[]> {
  const now = ledger.now().getTime();
  const out: Notice[] = [];
  for (const q of await ledger.openQuestions()) {
    if (now - Date.parse(q.created_at) < QUESTION_NUDGE_MS) continue;
    if (!(await ledger.claim(`nudge:${q.id}`, 30 * 86_400))) continue;
    out.push({
      subject: "AI City: a question is waiting for you",
      message: `${q.path} asks: ${q.text.slice(0, 300)}\nDefault if you don't answer: ${q.default_answer}`,
    });
  }
  return out;
}

export async function deliver(
  notices: Notice[],
  sns: Pick<SNSClient, "send">,
  topicArn: string,
  enabled: boolean,
): Promise<number> {
  if (!enabled) return 0;
  for (const n of notices)
    await sns.send(new PublishCommand({ TopicArn: topicArn, Subject: n.subject.slice(0, 99), Message: n.message }));
  return notices.length;
}

let sns: SNSClient | undefined;
export const handler = async (event: { detail?: unknown; job?: "nudge" }) => {
  const city = awsCity();
  sns ??= new SNSClient({ region: city.region });
  const settings = await city.ledger.settings(DEFAULT_SETTINGS);
  const notices =
    event.job === "nudge"
      ? await staleQuestions(city.ledger)
      : [noticeFor(event.detail)].filter((n): n is Notice => n !== null);
  return { sent: await deliver(notices, sns, requireEnv("AIC_NOTIFY_TOPIC_ARN"), settings.notify_email) };
};

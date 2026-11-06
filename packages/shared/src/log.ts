// Structured JSON logs. Never log prompts, model output, tool input or secrets: only ids, counts and
// outcomes. Fields whose names suggest content or credentials are dropped before writing.
const BANNED = /prompt|content|text|message_body|secret|token|password|authorization|cookie|key$/i;

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function safeFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields))
    if (!BANNED.test(k)) out[k] = typeof v === "string" ? v.slice(0, 200) : v;
  return out;
}

export function log(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...safeFields(fields) });
  if (level === "error") console.error(line);
  else console.warn(line);
}

/**
 * CloudWatch embedded metric format: one line becomes metrics in namespace "AIC" for the dashboard
 * (turns, tokens by model, cache reads, refusals, fallbacks, spend). Dimensions are plain names.
 */
export function metric(dimensions: Record<string, string>, values: Record<string, number>): void {
  const line = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: "AIC",
          Dimensions: [Object.keys(dimensions)],
          Metrics: Object.keys(values).map((Name) => ({ Name, Unit: Name.endsWith("Usd") ? "None" : "Count" })),
        },
      ],
    },
    ...dimensions,
    ...values,
  };
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

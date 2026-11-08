---
name: data-analysis
description: "Answer business questions with data: a clear question, the right source, SQL or analytics queries, sanity checks, and a plain-language answer."
---
# Data analysis

1. Restate the question as something measurable (metric, period, segment).
2. Pick the source: **BigQuery** (warehouse SQL), **Google Analytics** (web traffic and conversions), **PostHog / Amplitude / Mixpanel** (product events), **Stripe** (revenue), the CRM (pipeline), **Airtable** or a spreadsheet the owner shared.
3. Query read-only. Show the SQL or the query settings.
4. Sanity-check: totals against a known number, no double counting from joins, time zones, missing days, bots.
5. Answer in one sentence first, then the table or chart, then caveats and what would make it more certain.

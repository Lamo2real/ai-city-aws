## Data & Analytics playbook (a pre-configured department)
Teams you staff from: **Analytics** (Questions answered with numbers, KPIs, weekly reports), **Product analytics** (Funnels, retention, experiments in PostHog, Amplitude or Mixpanel), **Data engineering** (Warehouse tables, pipelines, data quality (with IT for infrastructure)). Hire by team: the specialty names the team ("Analytics: …"), and the instructions name the skill(s) to follow.

**Skills** (the `Skill` tool, plugin `aic-skills`): `data-analysis`, `metrics-and-dashboards`, `experiments-ab`, `current-docs`, plus the shared `knowledge-first`, `sell-with-stripe` and `cross-team-work`. Tell each worker which ones apply.

**Connectors to give workers** (only those that are on; your state lists them). Essential for this department: Google Analytics, BigQuery, PostHog. Also: Amplitude, Mixpanel, Hex, Airtable, Supabase. Shared by every department: Stripe, Jira & Confluence, Slack, Notion, Zapier, Box, Dropbox, Calendly, Miro, Granola. If a connector the work needs is off, say so in your report: the owner switches it on in Settings → Departments.

**The owner's knowledge base** holds their brand, policies, prices and documents: workers search it (`search_knowledge`) before they write, decide or design.

**Rules of the trade**
- Every number has a source: the query, the table or report it came from, the date range and the filters. Put the SQL or the analytics query in the report.
- Define a metric once (name, formula, filters) and reuse it; note any change to a definition.
- Read before you write: workers query; they never delete or overwrite data, tables or tracking without the owner's yes in the goal.
- Charts tell one thing each, with a title that says the finding ("Sign-ups doubled after the price change"), not the axis names.
- Personal data stays aggregated; never paste customer emails or names into reports.

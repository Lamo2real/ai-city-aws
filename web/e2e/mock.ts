// A mocked AI City backend for Playwright: config.json, the HTTP API, the WebSocket and Cognito.
import type { Page, WebSocketRoute } from "@playwright/test";

export const CONFIG = {
  region: "eu-north-1",
  apiUrl: "https://api.aic.test",
  wsUrl: "wss://ws.aic.test/prod",
  cognitoDomain: "login.aic.test",
  clientId: "client123",
  userPoolId: "eu-north-1_TEST",
  identityPoolId: "eu-north-1:00000000-0000-0000-0000-000000000000",
  redirectUri: "",
  pollyVoice: "Matthew",
  transcribeVocabulary: "aic-names",
};
export const at = () => new Date().toISOString();

export interface Mock {
  calls: Array<{ method: string; path: string; body: unknown }>;
  ws: () => WebSocketRoute;
  send: (event: Record<string, unknown>) => void;
  snapshot: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export const baseSnapshot = () => ({
  agents: [
    {
      id: "ace",
      kind: "core",
      role: "Ace",
      department: null,
      model: "sonnet-5-5",
      parent: null,
      state: "active",
      total_cost_usd: 0.02,
    },
    {
      id: "orchestrator",
      kind: "core",
      role: "Orchestrator",
      department: null,
      model: "fable-5-1",
      parent: "ace",
      state: "active",
      total_cost_usd: 0.05,
    },
  ],
  departments: [],
  tickets: [],
  parked: [],
  questions: [],
  approvals: [],
  specialists: [],
  usage: { usd: 0.42, turns: 20, tokens: 566000 },
  month: { usd: 4.2 },
  spend: {},
  caps: { daily_global_usd: 10, monthly_budget_usd: 150, daily_department_usd: 5 },
  city: { paused: false, reason: null, running: 0, waiting: 0 },
  region: "eu-north-1",
});

export async function mockBackend(
  page: Page,
  opts: { signedIn?: boolean; snapshot?: Record<string, unknown>; firstRunDone?: boolean } = {},
): Promise<Mock> {
  // Events sent before the page's WebSocket connects are held and delivered on connect.
  const pending: Array<Record<string, unknown>> = [];
  const m: Mock = {
    calls: [],
    ws: () => {
      throw new Error("no WebSocket yet");
    },
    send: (e) => pending.push(e),
    snapshot: { ...baseSnapshot(), ...(opts.snapshot ?? {}) },
    settings: {
      paused: false,
      pause_reason: null,
      monthly_budget_usd: 150,
      daily_global_usd: 10,
      daily_department_usd: 5,
      department_caps: {},
      max_concurrent_workers_per_department: 100,
      max_concurrent_workers_global: 2450,
      max_new_sessions_per_second: 20,
      profile_prefix: "global",
      notify_email: true,
      integrations: { github: false, google_calendar: false, gmail: false, spotify: false },
      first_run_done: opts.firstRunDone ?? true,
    },
  };
  await page.addInitScript(
    ({ signedIn }) => {
      if (signedIn)
        sessionStorage.setItem(
          "aic.tokens",
          JSON.stringify({
            idToken: "header.payload.sig",
            accessToken: "a",
            refreshToken: "r",
            expiresAt: Date.now() + 3600_000,
          }),
        );
      // A fake voice: the mic "hears" whatever the test puts in window.__heard.
      (window as unknown as { __aicVoice: unknown }).__aicVoice = {
        async listen(onText: (t: string) => void) {
          const t = setTimeout(
            () => onText((window as unknown as { __heard?: string }).__heard ?? "yo Ace, status?"),
            300,
          );
          return () => clearTimeout(t);
        },
        async speak() {},
        stopSpeaking() {},
      };
    },
    { signedIn: opts.signedIn ?? true },
  );
  await page.route("**/config.json", (r) => r.fulfill({ json: CONFIG }));
  await page.route(`https://${CONFIG.cognitoDomain}/**`, (r) =>
    r.fulfill({ contentType: "text/html", body: "<html><body><h1>Cognito sign-in (mock)</h1></body></html>" }),
  );
  await page.route(`${CONFIG.apiUrl}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname + url.search;
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
    m.calls.push({ method: req.method(), path, body });
    const ok = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/city") return ok(m.snapshot);
    if (path === "/settings" && req.method() === "GET")
      return ok({ settings: m.settings, limits: { sanity_daily_cap_usd: 200, sanity_monthly_cap_usd: 2000 } });
    if (path === "/settings" && req.method() === "PUT") {
      Object.assign(m.settings, body);
      return ok({ settings: m.settings });
    }
    if (path === "/messages") return ok({ accepted: true, conversation: "main" }, 202);
    if (path === "/city/pause") return ok({ paused: true });
    if (path === "/city/resume") return ok({ paused: false });
    if (path.startsWith("/questions/"))
      return ok({ answered: true, answer: path.endsWith("/default") ? "SQLite" : body?.answer });
    if (path.startsWith("/approvals/"))
      return ok({ approval: { id: path.split("/")[2], status: body?.approved ? "approved" : "denied" } });
    if (path.startsWith("/city/agent"))
      return ok({
        agent: {},
        ticket: null,
        recent: [{ tool: "Edit", decision: "allow", at: at() }],
        turns: 3,
        cost_usd: 0.31,
      });
    if (path.startsWith("/tickets"))
      return ok({
        tickets: [
          {
            id: "t-1",
            goal: "Add a power(a, b) function to add.js",
            from: "ace",
            to: "orchestrator",
            status: "in_progress",
            department: null,
            updated_at: at(),
          },
        ],
      });
    if (path === "/costs")
      return ok({
        estimate: true,
        today: { ...(m.snapshot.usage as object), cache_savings_usd: 0.3 },
        month: { usd: 4.2, turns: 200, tokens: 5e6, cache_savings_usd: 2.1 },
        by_department: { engineering: { usd: 3, turns: 100, tokens: 1, cache_savings_usd: 0 } },
        by_role: { worker: { usd: 3, turns: 100, tokens: 1, cache_savings_usd: 0 } },
        by_model: { "Claude Opus 5.5": { usd: 3, turns: 100, tokens: 1, cache_savings_usd: 0 } },
        caps: { daily_global_usd: 10, monthly_budget_usd: 150, daily_department_usd: 5 },
        cost_explorer_url: "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
      });
    if (path === "/workforce") return ok({ workers: [], specialists: [] });
    if (path === "/health") return ok({ paused: false, workers_busy: 0, worker_ceiling: 2450, stale_turns: 0 });
    return ok({ error: "There is nothing here." }, 404);
  });
  await page.routeWebSocket(`${CONFIG.wsUrl}**`, (ws) => {
    m.ws = () => ws;
    m.send = (e) => ws.send(JSON.stringify({ at: at(), ...e }));
    setTimeout(() => {
      for (const e of pending.splice(0)) m.send(e);
    }, 200);
    ws.onMessage((msg) => {
      if (String(msg).includes("ping")) ws.send(JSON.stringify({ type: "pong" }));
    });
  });
  return m;
}

export const hired = (id: string, dept: string, kind: "manager" | "worker" = "worker") => ({
  type: "agent.hired",
  agent: {
    id,
    kind,
    role: kind === "manager" ? `${dept} Manager` : "JavaScript developer",
    department: dept,
    model: kind === "manager" ? "fable-5-1" : "opus-5-5",
    parent: kind === "manager" ? "orchestrator" : `mgr-${dept.toLowerCase()}`,
    state: kind === "manager" ? "dormant" : "active",
    worker_state: kind === "worker" ? "hired" : null,
    total_cost_usd: 0,
  },
});

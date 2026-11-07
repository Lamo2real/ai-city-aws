// A mocked AI City backend for Playwright: config.json, the HTTP API, the WebSocket, and a fake sign-in
// (window.__aicAuth, the same AuthClient interface the app uses for Cognito).
//   password "Temp-Password-1!"   → first login: choose own password → authenticator setup → code 123456
//   password "Own-Password-12!"   → the 6-digit code (123456)
//   anything else                   → "That email or password is not right"
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
  /** The knowledge base: stored items (newest first) and the S3 PUTs the HUD made. */
  knowledge: { items: Array<Record<string, unknown>>; puts: string[] };
}

export const S3_URL = "https://s3.aic.test";
const KIND_BY_EXT: Record<string, string> = {
  pdf: "document",
  docx: "document",
  doc: "document",
  xlsx: "document",
  csv: "document",
  html: "document",
  txt: "text",
  md: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  flac: "audio",
  ogg: "audio",
  mp4: "video",
  mov: "video",
  m4v: "video",
  mkv: "video",
  avi: "video",
};

export const baseSnapshot = () => ({
  agents: [
    {
      id: "ace",
      kind: "core",
      role: "AIC",
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
    knowledge: { items: [], puts: [] },
  };
  let kn = 0;
  const kItem = (id: string) => m.knowledge.items.find((x) => x.id === id);
  const kEvent = (i: Record<string, unknown>) =>
    m.send({ type: "knowledge.updated", id: i.id, status: i.status, title: i.title, scope: i.scope, kind: i.kind });
  const alwaysTokens = () => m.knowledge.items.filter((x) => x.scope === "always").length * 1600;
  /** The pipeline, faked: processing at once, ready a moment later (unsupported for odd files). */
  const pipeline = (i: Record<string, unknown>) => {
    i.status = "processing";
    kEvent(i);
    setTimeout(() => {
      if (!kItem(i.id as string)) return;
      i.status = i.kind === "other" ? "unsupported" : "ready";
      kEvent(i);
    }, 1200);
  };
  const newItem = (
    kind: string,
    title: string,
    scope: unknown,
    status: string,
    extra: Record<string, unknown> = {},
  ) => {
    const i = {
      id: `k-test${String(++kn).padStart(8, "0")}`,
      kind,
      title,
      scope: (scope as string) ?? "relevant",
      status,
      created_at: at(),
      updated_at: at(),
      ...extra,
    };
    m.knowledge.items.unshift(i);
    return i;
  };
  await page.addInitScript(
    ({ signedIn }) => {
      if (signedIn) sessionStorage.setItem("aic.fake.signedIn", "1");
      const fail = (name: string) => Object.assign(new Error(name), { name });
      (window as unknown as { __aicAuth: unknown }).__aicAuth = {
        async signIn(_email: string, password: string) {
          if (password === "Temp-Password-1!") return { kind: "new_password" };
          if (password === "Own-Password-12!") return { kind: "totp_code" };
          throw fail("NotAuthorizedException");
        },
        async setNewPassword() {
          return {
            kind: "totp_setup",
            secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
            uri: "otpauth://totp/AI%20City:owner%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=AI%20City",
          };
        },
        async confirmCode(code: string) {
          if (code !== "123456") throw fail("CodeMismatchException");
          sessionStorage.setItem("aic.fake.signedIn", "1");
          return { kind: "done" };
        },
        async forgotPassword() {},
        async confirmForgotPassword(_e: string, code: string) {
          if (code !== "654321") throw fail("CodeMismatchException");
        },
        async idToken() {
          return sessionStorage.getItem("aic.fake.signedIn") === "1" ? "header.payload.sig" : null;
        },
        async signOut() {
          sessionStorage.removeItem("aic.fake.signedIn");
        },
      };
      // A fake voice: the mic "hears" whatever the test puts in window.__heard (or nothing when __micHold is set,
      // so the screen stays in "listening"); window.__micError makes the mic fail with that DOMException name;
      // window.__speakMs keeps AIC "talking" that long. levels() wobbles so the voice strip moves.
      const w = window as unknown as { __heard?: string; __micHold?: boolean; __micError?: string; __speakMs?: number };
      let hearing = false;
      let talking = false;
      (window as unknown as { __aicVoice: unknown }).__aicVoice = {
        async listen(onText: (t: string) => void) {
          if (w.__micError) throw new DOMException("fake failure", w.__micError);
          hearing = true;
          const t = w.__micHold ? undefined : setTimeout(() => onText(w.__heard ?? "yo AIC, status?"), 300);
          return () => {
            hearing = false;
            clearTimeout(t);
          };
        },
        async speak() {
          talking = true;
          await new Promise((r) => setTimeout(r, w.__speakMs ?? 0));
          talking = false;
        },
        stopSpeaking() {
          talking = false;
        },
        levels() {
          const wobble = 0.45 + 0.4 * Math.abs(Math.sin(performance.now() / 140));
          return { input: hearing ? wobble : 0, output: talking ? wobble : 0 };
        },
      };
    },
    { signedIn: opts.signedIn ?? true },
  );
  await page.route("**/config.json", (r) => r.fulfill({ json: CONFIG }));
  await page.route(`${CONFIG.apiUrl}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname + url.search;
    const body = req.postData() ? (JSON.parse(req.postData()!) as Record<string, unknown>) : null;
    m.calls.push({ method: req.method(), path, body });
    const ok = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path === "/auth/first-login-email")
      return ok(
        { accepted: true, message: "If this is the owner's email, a new first-login email is on its way." },
        202,
      );
    if (path === "/city") return ok(m.snapshot);
    if (path === "/settings" && req.method() === "GET") return ok({ settings: m.settings });
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
    if (path === "/knowledge" && req.method() === "GET")
      return ok({ items: m.knowledge.items, always_tokens: alwaysTokens(), always_budget: 8000 });
    if (path === "/knowledge/uploads" && req.method() === "POST") {
      const name = String(body?.file_name);
      const size = Number(body?.size_bytes);
      const kind = KIND_BY_EXT[name.split(".").pop()!.toLowerCase()] ?? "other";
      const i = newItem(kind, (body?.title as string) ?? name, body?.scope, "uploading", {
        source: name,
        content_type: body?.content_type,
        size_bytes: size,
      });
      const partSize = 16 * 1024 * 1024;
      const upload =
        size <= 100 * 1024 * 1024
          ? {
              method: "PUT",
              url: `${S3_URL}/raw/${i.id}/${encodeURIComponent(name)}`,
              headers: { "content-type": body?.content_type },
            }
          : {
              multipart: true,
              upload_id: `up-${i.id}`,
              part_size: partSize,
              part_urls: Array.from(
                { length: Math.ceil(size / partSize) },
                (_, n) => `${S3_URL}/raw/${i.id}/${encodeURIComponent(name)}?partNumber=${n + 1}&uploadId=up-${i.id}`,
              ),
            };
      return ok({ item: i, upload });
    }
    const complete = /^\/knowledge\/uploads\/([\w-]+)\/complete$/.exec(path);
    if (complete && req.method() === "POST") {
      const i = kItem(complete[1]!);
      if (!i) return ok({ error: "That item is gone." }, 404);
      pipeline(i);
      return ok({ item: i });
    }
    if (path === "/knowledge/links" && req.method() === "POST") {
      const i = newItem("link", (body?.title as string) ?? String(body?.url), body?.scope, "processing", {
        source: body?.url,
      });
      pipeline(i);
      return ok({ item: i });
    }
    if (path === "/knowledge/text" && req.method() === "POST") {
      const i = newItem("text", String(body?.title), body?.scope, "processing");
      pipeline(i);
      return ok({ item: i });
    }
    const one = /^\/knowledge\/(k-[\w-]+)$/.exec(path);
    if (one) {
      const i = kItem(one[1]!);
      if (!i) return ok({ error: "That item is gone." }, 404);
      if (req.method() === "GET") return ok({ ...i, entities: [] });
      if (req.method() === "PUT") {
        Object.assign(i, body, { updated_at: at() });
        kEvent(i);
        return ok({ item: i });
      }
      if (req.method() === "DELETE") {
        m.knowledge.items = m.knowledge.items.filter((x) => x !== i);
        return ok({ ok: true });
      }
    }
    if (path === "/workforce") return ok({ workers: [], specialists: [] });
    if (path === "/health") return ok({ paused: false, workers_busy: 0, worker_ceiling: 2450, stale_turns: 0 });
    return ok({ error: "There is nothing here." }, 404);
  });
  // The knowledge bucket's presigned PUTs: answer with an ETag (exposed, as the bucket's CORS does).
  await page.route(`${S3_URL}/**`, async (route) => {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "PUT",
      "access-control-allow-headers": "*",
      "access-control-expose-headers": "ETag",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const url = new URL(req.url());
    m.knowledge.puts.push(url.pathname + url.search);
    const part = url.searchParams.get("partNumber");
    if (!part) {
      const i = kItem(url.pathname.split("/")[2]!);
      if (i) pipeline(i);
    }
    return route.fulfill({ status: 200, headers: { ...headers, etag: `"etag-${part ?? "single"}"` }, body: "" });
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

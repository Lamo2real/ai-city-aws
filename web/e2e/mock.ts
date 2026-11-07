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
  appsUrl: "https://apps.aic.test",
};
// A tiny original game served by the fake apps origin: it proves scripts run in the sandbox and that the
// frame has an opaque origin (no storage, no access to the HUD).
// A tiny original calendar app that talks to the HUD the v2 way (docs/APPS.md "v2: data bridge"): it posts
// {aic: 1, id, cap, params} to its parent and shows the reply. The fake apps origin serves it for app-cal….
export const CALENDAR_HTML = `<!doctype html><meta charset="utf-8"><title>Star Calendar</title>
<body style="font-family:sans-serif;background:#fff;color:#111">
<h1>Star Calendar</h1>
<button id="load">Load my week</button> <button id="rsvp">Accept the team sync</button>
<p id="out">Nothing loaded.</p>
<script>
const waiting = new Map(); let n = 0;
addEventListener("message", (e) => { const m = e.data; if (e.source === parent && m && m.aic === 1 && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const ask = (cap, params) => new Promise((r) => { const id = "q" + (++n); waiting.set(id, r); parent.postMessage({ aic: 1, id, cap, params }, "*"); });
const out = (t) => { document.getElementById("out").textContent = t; };
document.getElementById("load").onclick = async () => {
  const r = await ask("calendar.read", { from: "2026-11-02T00:00:00Z", to: "2026-11-09T00:00:00Z" });
  out(r.ok ? "Events: " + r.data.events.map((e) => e.title).join(", ") : "Error: " + r.error);
};
document.getElementById("rsvp").onclick = async () => {
  const r = await ask("propose", { kind: "calendar.respond", params: { event_id: "evt-1", response: "accepted" } });
  out(r.ok ? "Proposal: " + r.status : "Error: " + r.error);
};
</script></body>`;
// A tiny original game that keeps its best score with the v3 `state` grant (docs/APPS.md "v3").
export const SCORE_HTML = `<!doctype html><meta charset="utf-8"><title>Pebble Hop</title>
<body style="font-family:sans-serif;background:#fff;color:#111">
<h1>Pebble Hop</h1><button id="hop">Hop</button> <output id="n">0 hops</output> <p id="best">Best: …</p>
<script>
const waiting = new Map(); let k = 0, n = 0, best = 0;
addEventListener("message", (e) => { const m = e.data; if (e.source === parent && m && m.aic === 1 && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const ask = (cap, params) => new Promise((r) => { const id = "s" + (++k); waiting.set(id, r); parent.postMessage({ aic: 1, id, cap, params }, "*"); });
const show = () => { document.getElementById("best").textContent = "Best: " + best; };
ask("state.get", { key: "best" }).then((r) => { best = r.ok && typeof r.data.value === "number" ? r.data.value : 0; show(); });
document.getElementById("hop").onclick = async () => {
  n++; document.getElementById("n").textContent = n + " hops";
  if (n > best) { best = n; show(); await ask("state.set", { key: "best", value: best }); }
};
</script></body>`;
export const GAME_HTML = `<!doctype html><meta charset="utf-8"><title>Star Sweeper</title>
<body style="font-family:sans-serif;background:#123;color:#fff">
<h1>Star Sweeper</h1><p>Click the button to sweep a star.</p>
<button id="b">Sweep</button> <output id="n">0 stars</output>
<p id="iso"></p>
<script>
let n = 0;
document.getElementById("b").onclick = () => { n++; document.getElementById("n").textContent = n + " stars"; };
let storage = "no storage";
try { localStorage.length; storage = "storage open"; } catch { /* opaque origin */ }
let parentDoc = "no HUD access";
try { parent.document.title; parentDoc = "HUD reachable"; } catch { /* sandboxed */ }
document.getElementById("iso").textContent = storage + ", " + parentDoc;
</script></body>`;
export const at = () => new Date().toISOString();

export interface Mock {
  calls: Array<{ method: string; path: string; body: unknown }>;
  ws: () => WebSocketRoute;
  send: (event: Record<string, unknown>) => void;
  snapshot: Record<string, unknown>;
  settings: Record<string, unknown>;
  connectors: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  mail: Array<Record<string, unknown>>;
  apps: Array<Record<string, unknown>>;
  /** The knowledge base: stored items (newest first) and the S3 PUTs the HUD made. */
  knowledge: { items: Array<Record<string, unknown>>; puts: string[] };
  /** v3 per-app state, `<app_id>/<key>` → value. */
  state: Record<string, unknown>;
}
export const appRecord = (id: string, slug: string, title: string, extra: Record<string, unknown> = {}) => ({
  app_id: id,
  slug,
  title,
  description: `${title}: a small original game the city built.`,
  icon_url: null,
  url: `${CONFIG.appsUrl}/live/${id}/index.html`,
  draft_id: `drf-${id.slice(4)}`,
  task_id: "t-apps",
  published_at: at(),
  ...extra,
});

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
  opts: {
    signedIn?: boolean;
    snapshot?: Record<string, unknown>;
    firstRunDone?: boolean;
    apps?: Array<Record<string, unknown>>;
  } = {},
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
    connectors: [],
    skills: [],
    mail: [],
    apps: [...(opts.apps ?? [])],
    state: {},
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
      const w = window as unknown as {
        __heard?: string;
        __micHold?: boolean;
        __micError?: string;
        __speakMs?: number;
        __partials?: string[];
        __spoken?: string[];
      };
      let hearing = false;
      let talking = false;
      (window as unknown as { __aicVoice: unknown }).__aicVoice = {
        async listen(onText: (t: string) => void, onPartial?: (t: string) => void) {
          if (w.__micError) throw new DOMException("fake failure", w.__micError);
          hearing = true;
          // Live partials first (window.__partials, 100 ms apart), then the final transcript.
          const timers = (w.__partials ?? []).map((p, i) => setTimeout(() => onPartial?.(p), 100 * (i + 1)));
          const delay = 100 * ((w.__partials ?? []).length + 1) + 200;
          if (!w.__micHold) timers.push(setTimeout(() => onText(w.__heard ?? "yo AIC, status?"), delay));
          return () => {
            hearing = false;
            timers.forEach(clearTimeout);
          };
        },
        async speak(text: string) {
          (w.__spoken ??= []).push(text);
          talking = true;
          await new Promise((r) => setTimeout(r, w.__speakMs ?? 0));
          talking = false;
        },
        // Sentence by sentence, like Polly: a "clip" is the sentence's text; playing it records it in __spoken.
        async synth(text: string) {
          return new Blob([text], { type: "text/plain" });
        },
        async play(clip: Blob) {
          (w.__spoken ??= []).push(await clip.text());
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
    if (path === "/city") return ok({ ...m.snapshot, apps: m.apps });
    if (path === "/apps" && req.method() === "GET") return ok({ apps: m.apps });
    const appAt = () => m.apps.find((a) => a.app_id === decodeURIComponent(path.split("/")[2] ?? ""));
    if (/^\/apps\/[^/]+\/bridge$/.test(path)) {
      const a = appAt();
      const cap = String(body?.cap);
      const grant = cap.startsWith("state.") ? "state" : cap;
      if (!a || !((a.grants as Array<{ id: string }>) ?? []).some((g) => g.id === grant))
        return ok({ error: "not_granted" }, 403);
      const sp = (body?.params ?? {}) as { key?: string; value?: unknown };
      if (cap === "state.get")
        return ok({ ok: true, data: { value: m.state[`${String(a.app_id)}/${sp.key}`] ?? null } });
      if (cap === "state.set") {
        m.state[`${String(a.app_id)}/${sp.key}`] = sp.value;
        return ok({ ok: true, data: {} });
      }
      return ok({ data: { events: [{ title: "Dentist" }, { title: "Team sync" }], calendars: [], errors: [] } });
    }
    if (/^\/apps\/[^/]+\/rollback$/.test(path)) {
      const a = appAt();
      const prev = (a?.history as Array<Record<string, unknown>> | undefined)?.[0];
      if (!a || !prev) return ok({ error: "There is no earlier version of this app." }, 409);
      Object.assign(a, prev, { history: (a.history as unknown[]).slice(1) });
      return ok({ app: a });
    }
    if (/^\/apps\/[^/]+\/proposals$/.test(path)) {
      const a = appAt()!;
      const approval = {
        id: `apr-prop-${m.calls.length}`,
        kind: "tool",
        agent: "calendar",
        action: "Accept the invitation: Team sync (Mon 10:00)",
        reason: "An app asked; answering an invitation acts for you.",
        requested_by: `app:${String(a.app_id)}`,
      };
      (m.snapshot.approvals as unknown[]).push(approval);
      m.send({ type: "approval.requested", ...approval });
      return ok({ approval: { id: approval.id, status: "pending" } }, 202);
    }
    if (/^\/apps\/[^/]+$/.test(path) && req.method() === "PUT") {
      const a = appAt();
      if (!a) return ok({ error: "There is no such app." }, 404);
      Object.assign(a, body);
      return ok({ app: a });
    }
    if (path.startsWith("/apps/") && req.method() === "DELETE") {
      const id = decodeURIComponent(path.split("/")[2] ?? "");
      const i = m.apps.findIndex((a) => a.app_id === id);
      if (i < 0) return ok({ error: "There is no such app." }, 404);
      m.apps.splice(i, 1);
      return ok({ removed: id });
    }
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
    const publish = (m.snapshot.approvals as Array<Record<string, unknown>>).find(
      (a) => a.id === path.split("/")[2] && a.kind === "app.publish",
    );
    if (path.startsWith("/approvals/") && publish) {
      const cal = String(publish.draft_id).startsWith("drf-cal");
      const app = body?.approved
        ? appRecord(
            cal ? "app-cal000000001" : "app-0000000000aa",
            cal ? "star-calendar" : "star-sweeper",
            String(publish.title),
            {
              grants: body.grants ?? publish.capabilities ?? [],
            },
          )
        : null;
      if (app) m.apps.unshift(app);
      return ok({
        approval: { id: publish.id, status: body?.approved ? "approved" : "denied" },
        ...(app ? { app } : {}),
      });
    }
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
    // ---------- connectors, skills, mail (CONNECTORS_SKILLS.md §1.7, §2.4; MAIL_CALENDAR.md §4) ----------
    const method = req.method();
    if (path === "/connectors" && method === "GET") return ok({ connectors: m.connectors });
    if (/^\/connectors\/[\w-]+\/login$/.test(path))
      return ok({ url: "https://auth.provider.test/authorize?x=1", state: "st-1" });
    if (/^\/connectors\/[\w-]+\/login\/complete$/.test(path))
      return ok({ connector: { id: path.split("/")[2], status: "syncing" } });
    if (/^\/connectors\/[\w-]+\/key$/.test(path)) return ok({ ok: true });
    if (/^\/connectors\/[\w-]+$/.test(path) && method === "PUT") {
      const c = m.connectors.find((x) => x.id === path.split("/")[2])!;
      Object.assign(c, body);
      return ok({ connector: c });
    }
    if (path === "/skills" && method === "GET") return ok({ skills: m.skills });
    if (path === "/skills" && method === "POST") {
      const b = body as { roles: string[]; files: Array<{ path: string }> };
      const skill = {
        name: "pdf-report",
        description: "Makes a PDF report",
        roles: b.roles,
        enabled: true,
        version: "v1",
        files: b.files.map((f) => ({ path: f.path, size: 10 })),
        size_bytes: 10,
        updated_at: at(),
      };
      m.skills = [skill];
      return ok({ skill, removed_frontmatter: ["allowed-tools"] }, 201);
    }
    if (/^\/skills\/[\w-]+$/.test(path) && method === "PUT") {
      Object.assign(m.skills[0]!, body);
      return ok({ skill: m.skills[0] });
    }
    if (/^\/skills\/[\w-]+$/.test(path) && method === "DELETE") {
      m.skills = [];
      return ok({ ok: true });
    }
    if (path === "/mail/accounts" && method === "GET") return ok({ accounts: m.mail });
    if (path === "/mail/rules") return ok({ rules: [] });
    if (/^\/mail\/accounts\/[\w-]+\/signin$/.test(path))
      return ok({ url: "https://accounts.provider.test/o/auth", state: "ms-1" });
    if (/^\/mail\/accounts\/[\w-]+\/complete$/.test(path))
      return ok({ account: { id: path.split("/")[3], status: "connected" } });
    if (/^\/mail\/accounts\/[\w-]+\/imap$/.test(path)) {
      const b = body as { password: string };
      if (b.password !== "good-app-password")
        return ok({ error: "The mail server refused the app password.", fix: "Check it." }, 400);
      return ok({ account: { id: path.split("/")[3], status: "connected" } });
    }
    return ok({ error: "There is nothing here." }, 404);
  });
  // The isolated apps origin: live apps and drafts are the same little game.
  await page.route(`${CONFIG.appsUrl}/**`, (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: /\/(live\/app-cal|drafts\/drf-cal)/.test(r.request().url())
        ? CALENDAR_HTML
        : /\/live\/app-score/.test(r.request().url())
          ? SCORE_HTML
          : GAME_HTML,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
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

// A mocked AI City backend for Playwright: config.json, the HTTP API, the WebSocket, and a fake sign-in
// (window.__vaicAuth, the same AuthClient interface the app uses for Cognito).
//   password "Temp-Password-1!"   → first login: choose own password → authenticator setup → code 123456
//   password "Own-Password-12!"   → the 6-digit code (123456)
//   anything else                   → "That email or password is not right"
import { readFileSync, readdirSync } from "node:fs";
import type { Page, WebSocketRoute } from "@playwright/test";

// Settings → Departments: the real presets file, shaped as GET /departments/presets answers it.
type Group = {
  key?: string;
  name: string;
  mission: string;
  teams?: unknown[];
  skills: string[];
  essential: string[];
  connectors: string[];
};
const PRESETS_FILE = JSON.parse(readFileSync(`${import.meta.dirname}/../../config/departments.json`, "utf8")) as {
  shared: Group;
  departments: Group[];
  connectors: Record<string, Record<string, unknown>>;
};
const SKILLS_DIR = `${import.meta.dirname}/../../agents/skills`;
const skillDescription = (name: string) =>
  /description: "(.*)"/.exec(readFileSync(`${SKILLS_DIR}/${name}/SKILL.md`, "utf8"))?.[1] ?? "";
const group = (g: Group) => ({
  ...(g.key ? { key: g.key, teams: g.teams } : {}),
  name: g.name,
  mission: g.mission,
  skills: g.skills
    .filter((s) => readdirSync(SKILLS_DIR).includes(s))
    .map((s) => ({ name: s, description: skillDescription(s) })),
  connectors: g.connectors.map((c) => ({ id: c, ...PRESETS_FILE.connectors[c]!, essential: g.essential.includes(c) })),
});
const PRESETS = { shared: group(PRESETS_FILE.shared), departments: PRESETS_FILE.departments.map(group) };

// Skills → Discover (decision 188): the real catalog files, shaped as GET /skills/catalog answers them.
const CATALOG_DIR = `${import.meta.dirname}/../../agents/skill-catalog`;
const CATALOG_INDEX = JSON.parse(readFileSync(`${CATALOG_DIR}/catalog.json`, "utf8")) as {
  featured: string;
  skills: Array<{ name: string; title: string; departments: string[] }>;
};
const descriptionIn = (dir: string, name: string) =>
  /description: "(.*)"/.exec(readFileSync(`${dir}/${name}/SKILL.md`, "utf8"))?.[1] ?? "";
const usedBy = new Map<string, string[]>();
for (const s of PRESETS_FILE.shared.skills) usedBy.set(s, ["Every department"]);
for (const d of PRESETS_FILE.departments) for (const s of d.skills) usedBy.set(s, [...(usedBy.get(s) ?? []), d.name]);
export const SKILL_CATALOG = [
  ...CATALOG_INDEX.skills.map((e) => ({
    ...e,
    description: descriptionIn(CATALOG_DIR, e.name),
    source: "AI City catalog",
    builtin: false,
    featured: e.name === CATALOG_INDEX.featured,
    files: 1,
  })),
  ...[...usedBy]
    .filter(([n]) => readdirSync(SKILLS_DIR).includes(n))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, departments]) => ({
      name,
      title: name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
      description: descriptionIn(SKILLS_DIR, name),
      departments,
      source: departments.includes("Every department")
        ? "Built into every department"
        : `Built into ${departments.join(", ")}`,
      builtin: true,
      featured: false,
      files: 1,
    })),
];
const catalogDir = (builtin: boolean) => (builtin ? SKILLS_DIR : CATALOG_DIR);

export const CONFIG = {
  region: "eu-north-1",
  apiUrl: "https://api.vaic.test",
  wsUrl: "wss://ws.vaic.test/prod",
  cognitoDomain: "login.vaic.test",
  clientId: "client123",
  userPoolId: "eu-north-1_TEST",
  identityPoolId: "eu-north-1:00000000-0000-0000-0000-000000000000",
  redirectUri: "",
  pollyVoice: "Ruth",
  budgetAlertUsd: 10000,
  transcribeRegion: "eu-central-1",
  transcribeVocabulary: "vaic-names",
  appsUrl: "https://apps.vaic.test",
};
// A tiny original game served by the fake apps origin: it proves scripts run in the sandbox and that the
// frame has an opaque origin (no storage, no access to the HUD).
// A tiny original calendar app that talks to the HUD the v2 way (docs/APPS.md "v2: data bridge"): it posts
// {vaic: 1, id, cap, params} to its parent and shows the reply. The fake apps origin serves it for app-cal….
export const CALENDAR_HTML = `<!doctype html><meta charset="utf-8"><title>Star Calendar</title>
<body style="font-family:sans-serif;background:#fff;color:#111">
<h1>Star Calendar</h1>
<button id="load">Load my week</button> <button id="rsvp">Accept the team sync</button>
<p id="out">Nothing loaded.</p>
<script>
const waiting = new Map(); let n = 0;
addEventListener("message", (e) => { const m = e.data; if (e.source === parent && m && m.vaic === 1 && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const ask = (cap, params) => new Promise((r) => { const id = "q" + (++n); waiting.set(id, r); parent.postMessage({ vaic: 1, id, cap, params }, "*"); });
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
addEventListener("message", (e) => { const m = e.data; if (e.source === parent && m && m.vaic === 1 && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
const ask = (cap, params) => new Promise((r) => { const id = "s" + (++k); waiting.set(id, r); parent.postMessage({ vaic: 1, id, cap, params }, "*"); });
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
  /** The built-in department knowledge entries (docs/KNOWLEDGE.md §17), by entry id. */
  entries: Array<Record<string, unknown>>;
  /** Files (docs/FILES.md): stored files (newest first) and the S3 PUTs the HUD made. */
  files: { items: Array<Record<string, unknown>>; puts: string[] };
  /** v3 per-app state, `<app_id>/<key>` → value. */
  state: Record<string, unknown>;
  /** OpenAI's voice (docs/VOICE.md): the stored key, when it was saved, and an error /speech should answer. */
  openai: { key: string | null; savedAt: string | null; error: { code: string; message: string } | null };
  /** The city's GitHub token (docs/GITHUB_ACCESS.md): stored or not, whose it is, when it was saved. */
  github: { token: string | null; login: string | null; savedAt: string | null };
  /** The Chief of Staff (`GET /chief-of-staff`); null answers 404, as before the backend has one. */
  chief: {
    enabled: boolean;
    decided: Array<Record<string, unknown>>;
    needs_owner: Array<{ id: string; title: string; why: string }>;
  } | null;
  /** Autopilot: `GET /away-summary` (null answers 404) and the standing orders (null answers 404). */
  away: Record<string, unknown> | null;
  orders: Array<{
    id: string;
    source: string;
    what?: string;
    instructions?: string;
    department: string;
    every_minutes: number;
    enabled: boolean;
  }> | null;
  /** City → Features and the owner's calendar (docs/MAIL_CALENDAR.md §12). */
  features: Array<{ id: string; name: string; blurb: string; enabled: boolean }>;
  calendar: {
    events: Array<Record<string, unknown>>;
    accounts: Array<Record<string, unknown>>;
    state: Record<string, unknown>;
  };
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

export const S3_URL = "https://s3.vaic.test";
export const FILES_URL = "https://files.vaic.test";
/** A drawn sunrise with a black car: what the mock files bucket serves for any picture or thumbnail. */
const SUNRISE_JPG = readFileSync(`${import.meta.dirname}/fixtures/sunrise.jpg`);
/** A tiny amber PNG: what the mock files bucket serves for images and thumbnails. */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);
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
      id: "vaic",
      kind: "core",
      role: "VAIC",
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
      parent: "vaic",
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
  city: { running: 0, waiting: 0 },
  region: "eu-north-1",
});

export async function mockBackend(
  page: Page,
  opts: {
    signedIn?: boolean;
    snapshot?: Record<string, unknown>;
    firstRunDone?: boolean;
    apps?: Array<Record<string, unknown>>;
    /** Use the real browser voice (getUserMedia, AudioContext, the AWS SDKs) instead of the fake one. */
    realVoice?: boolean;
  } = {},
): Promise<Mock> {
  // Events sent before the page's WebSocket connects are held and delivered on connect.
  const pending: Array<Record<string, unknown>> = [];
  const built: string[] = []; // departments built through POST /departments, so DELETE can find them
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
    openai: { key: null, savedAt: null, error: null },
    github: { token: null, login: null, savedAt: null },
    chief: null,
    away: null,
    orders: null,
    features: [
      {
        id: "calendar",
        name: "Calendar",
        blurb: "Every meeting from every email account you connect, in one calendar, with a big Join button.",
        enabled: true,
      },
    ],
    calendar: { events: [], accounts: [], state: {} },
    settings: {
      monthly_budget_usd: 150,
      daily_global_usd: 10,
      daily_department_usd: 5,
      department_caps: {},
      max_workers_per_goal: 3,
      max_live_workers_city: 10,
      max_open_jobs: 3,
      max_departments: 6,
      max_concurrent_workers_per_department: 100,
      max_concurrent_workers_global: 2450,
      max_new_sessions_per_second: 20,
      profile_prefix: "global",
      notify_push: true,
      first_run_done: opts.firstRunDone ?? true,
    },
    knowledge: { items: [], puts: [] },
    entries: MOCK_ENTRIES.map((e) => ({ ...e })),
    files: { items: [], puts: [] },
  };
  let fn = 0;
  const fItem = (id: string) => m.files.items.find((x) => x.id === id);
  const fKind = (name: string, ct: string) =>
    /^image\//.test(ct) || /\.(png|jpe?g|gif|webp|heic)$/i.test(name)
      ? "image"
      : /^video\//.test(ct) || /\.(mov|mp4|m4v|webm)$/i.test(name)
        ? "video"
        : /^audio\//.test(ct)
          ? "audio"
          : /\.(pdf|docx?|xlsx?|csv|html?)$/i.test(name)
            ? "document"
            : /\.(txt|md)$/i.test(name)
              ? "text"
              : "other";
  const withLinks = (f: Record<string, unknown>) => ({
    ...f,
    url: `${FILES_URL}/files/${String(f.id)}/${encodeURIComponent(String(f.name))}?inline`,
    download_url: `${FILES_URL}/files/${String(f.id)}/${encodeURIComponent(String(f.name))}?attachment`,
    ...(f.kind === "image" || f.kind === "video" ? { thumb_url: `${FILES_URL}/thumbs/${String(f.id)}.jpg` } : {}),
  });
  /** What the files Lambda would write: a caption for the sunrise photo, plain words for the rest. */
  const describeFile = (f: Record<string, unknown>) => {
    f.status = "processing";
    m.send({ type: "files.updated", id: f.id, status: "processing", name: f.name, kind: f.kind, folder: f.folder });
    setTimeout(() => {
      f.status = "ready";
      f.description = /sunrise/i.test(String(f.name))
        ? "A sunrise over the sea with a black Porsche 911 in front. Keywords: sunrise, Porsche, thumbnail"
        : `A ${String(f.kind)} called ${String(f.name)}.`;
      m.send({ type: "files.updated", id: f.id, status: "ready", name: f.name, kind: f.kind, folder: f.folder });
    }, 300);
  };
  let kn = 0;
  const kItem = (id: string) => m.knowledge.items.find((x) => x.id === id);
  const kEvent = (i: Record<string, unknown>) =>
    m.send({ type: "knowledge.updated", id: i.id, status: i.status, title: i.title, scope: i.scope, kind: i.kind });
  const alwaysTokens = () => m.knowledge.items.filter((x) => x.scope === "always").length * 1600;
  /** Where and when it holds, "found" from the name the way the real pipeline's model would (KNOWLEDGE.md §15). */
  const detect = (i: Record<string, unknown>) => {
    const name = `${String(i.folder ?? "")} ${String(i.title)}`;
    const places: Record<string, string> = {
      sweden: "SE",
      switzerland: "CH",
      gdpr: "EU",
      usa: "US",
      california: "US-CA",
    };
    const js = Object.entries(places)
      .filter(([w]) => name.toLowerCase().includes(w))
      .map(([, c]) => c);
    const year = /(20\d\d)/.exec(name)?.[1];
    const topic = /tax|vat|skatt/i.test(name) ? "tax" : /gdpr|privacy|ccpa/i.test(name) ? "privacy" : undefined;
    if (js.length || year || topic)
      Object.assign(i, {
        jurisdictions: js,
        year: year ? Number(year) : null,
        topic: topic ?? null,
        doc_type: "law",
        meta_source: "detected",
      });
  };
  /** Newer years replace older ones for the same place and topic (the server works this out on GET). */
  const withSuperseded = () =>
    m.knowledge.items.map((a) => {
      const newer = m.knowledge.items
        .filter(
          (b) =>
            b !== a &&
            b.topic &&
            b.topic === a.topic &&
            Number(b.year) > Number(a.year) &&
            (b.jurisdictions as string[] | undefined)?.some((j) =>
              (a.jurisdictions as string[] | undefined)?.includes(j),
            ),
        )
        .sort((x, y) => Number(y.year) - Number(x.year))[0];
      return newer ? { ...a, superseded_by: newer.id } : a;
    });
  /** A link's brand and site profile, as the real pipeline reads it from the site's HTML and CSS (§16). */
  const siteProfile = (i: Record<string, unknown>) => {
    const host = new URL(String(i.source)).hostname.replace(/^www\./, "");
    Object.assign(i, {
      brand: host,
      title: "Acme Rockets | Launch anything",
      site_profile: {
        url: i.source,
        brand: host,
        captured_at: at(),
        profile: {
          name: "Acme Rockets",
          kind: "company",
          what_it_is: "Acme builds small reusable rockets for research teams.",
          audience: "University and lab research teams",
          offerings: ["Rocket S", "Rocket M", "Launch service"],
          key_facts: ["Founded 2019 in Gothenburg"],
          palette: [
            { role: "primary", hex: "#ff5a1f", note: "buttons and links" },
            { role: "accent", hex: "#1428a0" },
            { role: "background", hex: "#ffffff" },
            { role: "text", hex: "#1a1a2e" },
          ],
          typography: { heading: "Space Grotesk", body: "Inter", notes: "bold geometric headings, 16px body" },
          tone_of_voice: "Confident, short sentences, second person.",
          layout_patterns: ["Large hero with one button", "Rounded corners 12px", "Soft shadows"],
        },
        design: { colors: { primary: "#ff5a1f" }, fonts: { heading: "Space Grotesk", body: "Inter" }, scheme: "light" },
        pages: [{ url: `https://${host}/about`, title: "About Acme" }],
        content: {
          outline: [
            { level: 1, text: "Launch anything" },
            { level: 2, text: "Why Acme" },
            { level: 2, text: "Pricing" },
          ],
          ctas: ["Book a launch", "See plans"],
        },
        logo_data:
          "data:image/svg+xml;base64," +
          btoa(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#ff5a1f"/></svg>',
          ),
      },
    });
  };
  /** The pipeline, faked: processing at once, ready a moment later (unsupported for odd files). */
  const pipeline = (i: Record<string, unknown>) => {
    i.status = "processing";
    kEvent(i);
    setTimeout(() => {
      if (!kItem(i.id as string)) return;
      i.status = i.kind === "other" ? "unsupported" : "ready";
      if (i.status === "ready") detect(i);
      // The sample brand site only: other links keep their title, as the journeys expect.
      if (i.status === "ready" && i.kind === "link" && String(i.source).startsWith("https://acme.example"))
        siteProfile(i);
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
    ({ signedIn, realVoice }) => {
      // Like Amplify now: the sign-in lives in localStorage, so it survives closing the tab. "revoked" keeps the
      // stored sign-in but refuses it, as Cognito does with an expired or revoked refresh token.
      if (signedIn) localStorage.setItem("vaic.fake.signedIn", "1");
      const fail = (name: string) => Object.assign(new Error(name), { name });
      (window as unknown as { __vaicAuth: unknown }).__vaicAuth = {
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
          localStorage.setItem("vaic.fake.signedIn", "1");
          return { kind: "done" };
        },
        async forgotPassword() {},
        async confirmForgotPassword(_e: string, code: string) {
          if (code !== "654321") throw fail("CodeMismatchException");
        },
        hadSession() {
          return localStorage.getItem("vaic.fake.signedIn") !== null;
        },
        async idToken() {
          const v = localStorage.getItem("vaic.fake.signedIn");
          if (v === "revoked") localStorage.removeItem("vaic.fake.signedIn"); // Amplify drops a rejected sign-in
          return v === "1" ? "header.payload.sig" : null;
        },
        async signOut() {
          localStorage.removeItem("vaic.fake.signedIn");
        },
      };
      // A fake voice: the mic "hears" whatever the test puts in window.__heard (or nothing when __micHold is set,
      // so the screen stays in "listening"); window.__micError makes the mic fail with that DOMException name;
      // window.__speakMs keeps VAIC "talking" that long. levels() wobbles so the voice strip moves.
      const w = window as unknown as {
        __heard?: string;
        __micHold?: boolean;
        __micLoud?: boolean;
        __micError?: string;
        __speakMs?: number;
        __partials?: string[];
        __spoken?: string[];
        __synthMs?: number;
        __synthError?: string;
      };
      let hearing = false;
      let voiceUntil = 0;
      let talking = false;
      if (realVoice) return;
      (window as unknown as { __vaicVoice: unknown }).__vaicVoice = {
        async listen(heardText: (t: string) => void, onPartial?: (t: string) => void) {
          if (w.__micError) throw new DOMException("fake failure", w.__micError);
          hearing = true;
          const onText = (t: string) => {
            voiceUntil = performance.now() + 300;
            heardText(t);
          };
          // Live partials first (window.__partials, 100 ms apart), then the final transcript.
          const timers = (w.__partials ?? []).map((p, i) => setTimeout(() => onPartial?.(p), 100 * (i + 1)));
          const delay = 100 * ((w.__partials ?? []).length + 1) + 200;
          if (!w.__micHold) timers.push(setTimeout(() => onText(w.__heard ?? "yo VAIC, status?"), delay));
          // The mic stays open in a voice conversation: whatever the test sets __heard to next is heard then.
          let last = w.__heard;
          const watch = setInterval(() => {
            if (w.__micHold || w.__heard === last) return;
            last = w.__heard;
            if (last) onText(last);
          }, 50);
          return () => {
            hearing = false;
            timers.forEach(clearTimeout);
            clearInterval(watch);
          };
        },
        async speak(text: string) {
          (w.__spoken ??= []).push(text);
          talking = true;
          await new Promise((r) => setTimeout(r, w.__speakMs ?? 0));
          talking = false;
        },
        // Sentence by sentence, like Polly: a "clip" is the sentence's text; playing it records it in __spoken.
        // __synthMs makes synthesis take that long; __synthError makes it refuse with that AWS error name.
        async synth(text: string) {
          if (w.__synthError) throw Object.assign(new Error("the speech service refused"), { name: w.__synthError });
          if (w.__synthMs) await new Promise((r) => setTimeout(r, w.__synthMs));
          return new Blob([text], { type: "text/plain" });
        },
        async play(clip: Blob, onBegin?: () => void) {
          if (talking) (w as unknown as { __overlaps?: number }).__overlaps = 1; // two clips at once: a bug
          onBegin?.();
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
          // The owner's voice is loud only around the moments words are heard; otherwise a quiet room.
          const voice = hearing && (w.__micLoud === true || performance.now() < voiceUntil);
          return { input: voice ? wobble : hearing ? 0.02 : 0, output: talking ? wobble : 0 };
        },
      };
    },
    { signedIn: opts.signedIn ?? true, realVoice: opts.realVoice ?? false },
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
    if (path === "/notifications/apns" && req.method() === "GET")
      return ok({ key_saved_at: null, enabled: false, devices: [], secret_name: "vaic/prod/apns" });
    if (path === "/notifications/apns" && req.method() === "PUT")
      return ok({
        ok: true,
        saved_at: "2026-11-07T12:00:00.000Z",
        next: "Turn on VAIC_APNS_ENABLED in GitHub and deploy once.",
      });
    if (path === "/github" && req.method() === "GET")
      return ok({
        configured: !!m.github.token,
        login: m.github.token ? m.github.login : null,
        saved_at: m.github.savedAt,
        error:
          m.github.token && !m.github.login ? "GitHub rejected the token. Make a new one and paste it again." : null,
      });
    if (path === "/github/token" && req.method() === "PUT") {
      const t = String(body?.token ?? "");
      if (!/^(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})$/.test(t))
        return ok(
          { error: "bad_request", message: "Paste the whole GitHub token (it starts with ghp_ or github_pat_)." },
          400,
        );
      if (t.includes("rejected"))
        return ok(
          { error: "bad_token", message: "GitHub rejected the token. Make a new one and paste it again." },
          400,
        );
      m.github = { token: t, login: "lamo2real", savedAt: "2026-11-08T12:00:00.000Z" };
      return ok({ ok: true, saved_at: m.github.savedAt, login: m.github.login });
    }
    if (path === "/github/token" && req.method() === "DELETE") {
      m.github = { token: null, login: null, savedAt: null };
      return ok({ ok: true });
    }
    if (path === "/voice/openai" && req.method() === "GET")
      return ok({
        configured: !!m.openai.key,
        voices: ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"],
        default: "alloy",
        key_saved_at: m.openai.savedAt,
      });
    if (path === "/voice/openai-key" && req.method() === "PUT") {
      const key = String(body?.key ?? "");
      if (!key.startsWith("sk-"))
        return ok({ error: "bad_request", message: "That doesn't look like an OpenAI key (it starts with sk-)." }, 400);
      m.openai.key = key;
      m.openai.savedAt = "2026-11-07T12:00:00.000Z";
      return ok({ ok: true, saved_at: m.openai.savedAt });
    }
    if (path === "/speech" && req.method() === "POST") {
      if (!m.openai.key) return ok({ error: "not_configured", message: "OpenAI's voice isn't set up yet." }, 503);
      if (m.openai.error) return ok({ error: m.openai.error.code, message: m.openai.error.message }, 503);
      // A "clip" is the voice and the sentence, so the fake player records which engine spoke it.
      return route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: `openai:${String(body?.voice)}:${String(body?.text)}`,
      });
    }
    if (path === "/devices" && req.method() === "GET") return ok({ devices: [] });
    if (path === "/settings" && req.method() === "GET") return ok({ settings: m.settings });
    if (path.startsWith("/away-summary")) return m.away ? ok(m.away) : ok({ error: "There is nothing here." }, 404);
    if (path === "/standing-orders" && req.method() === "GET")
      return m.orders ? ok({ standing_orders: m.orders }) : ok({ error: "There is nothing here." }, 404);
    if (/^\/standing-orders\/[\w-]+$/.test(path) && m.orders) {
      const id = path.split("/")[2];
      if (req.method() === "DELETE") {
        m.orders = m.orders.filter((o) => o.id !== id);
        return ok({ ok: true });
      }
      const o = m.orders.find((x) => x.id === id);
      if (!o) return ok({ error: "That standing order doesn't exist." }, 404);
      Object.assign(o, body);
      return ok({ standing_order: o });
    }
    if (path === "/chief-of-staff") return m.chief ? ok(m.chief) : ok({ error: "There is nothing here." }, 404);
    if (path === "/settings" && req.method() === "PUT") {
      Object.assign(m.settings, body);
      if (m.chief && typeof body?.chief_of_staff_enabled === "boolean") m.chief.enabled = body.chief_of_staff_enabled;
      return ok({ settings: m.settings });
    }
    if (path === "/messages") return ok({ accepted: true, conversation: body?.conversation ?? "main" }, 202);
    if (/^\/messages\/[\w-]+\/stop$/.test(path)) return ok({ stopped: true }, 202);
    if (/^\/tasks\/[\w-]+\/cancel$/.test(path)) return ok({ jobs: 2, workers: 1 });
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
    if (path.startsWith("/jobs"))
      return ok({
        jobs: path.includes("status=done")
          ? []
          : [
              {
                id: "t-1",
                name: "Add a power(a, b) function to add.js",
                status: "in_review",
                words: "Being checked",
                parts_done: 2,
                parts_total: 3,
                started_at: at(),
                updated_at: at(),
              },
            ],
      });
    if (path === "/tickets/t-1")
      return ok({
        ticket: {
          id: "t-1",
          goal: "Add a power(a, b) function to add.js",
          from: "vaic",
          to: "orchestrator",
          status: "in_review",
          department: null,
          updated_at: at(),
        },
        history: [
          { from: null, to: "open", note: "", at: at() },
          {
            from: "open",
            to: "in_review",
            note: "The reviewer is reading the new power function, its tests and the README change line by line before it goes back to the owner.",
            at: at(),
          },
        ],
        children: [
          {
            id: "t-2",
            goal: "Write power(a, b)",
            from: "mgr",
            to: "wkr",
            status: "done",
            department: "Engineering",
            updated_at: at(),
          },
          {
            id: "t-3",
            goal: "Test it",
            from: "mgr",
            to: "wkr",
            status: "in_review",
            department: "Engineering",
            updated_at: at(),
          },
        ],
      });
    if (path.startsWith("/tickets"))
      return ok({
        tickets: [
          {
            id: "t-1",
            goal: "Add a power(a, b) function to add.js",
            from: "vaic",
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
      return ok({ items: withSuperseded(), always_tokens: alwaysTokens(), always_budget: 8000 });
    if (path === "/knowledge/uploads" && req.method() === "POST") {
      const name = String(body?.file_name);
      const size = Number(body?.size_bytes);
      const kind = KIND_BY_EXT[name.split(".").pop()!.toLowerCase()] ?? "other";
      const i = newItem(kind, (body?.title as string) ?? name, body?.scope, "uploading", {
        source: name,
        content_type: body?.content_type,
        size_bytes: size,
        ...(body?.folder ? { folder: body.folder } : {}),
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
    // ---------- Department knowledge entries (docs/KNOWLEDGE.md §17) ----------
    if (path === "/knowledge/entries" && req.method() === "GET")
      return ok({
        entries: m.entries.map(({ content: _c, sources: _s, newer_default, ...e }) => ({
          ...e,
          has_newer_default: Boolean(newer_default),
        })),
        taxonomies: { marketing: MOCK_TAXONOMY },
        choices: {
          type: ["principle", "playbook", "checklist", "benchmark", "policy", "glossary"],
          audience: ["manager", "worker", "both"],
          confidence: ["established", "vendor", "platform-claim", "contested", "inference"],
          volatility: ["evergreen", "annual", "fast-moving"],
        },
      });
    if (path === "/knowledge/entries" && req.method() === "POST") {
      const id = `marketing.${body?.domain}.${String(body?.title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const e = {
        ...body,
        id: `kn-${id}`,
        entry_id: id,
        department: "marketing",
        origin: "user",
        status: "ready",
        sync: "done",
        as_of: "2026-11-11",
        review_by: body?.review_by ?? "2027-11-11",
        updated_at: at(),
      };
      m.entries.push(e);
      return ok({ entry: e }, 201);
    }
    const entry = /^\/knowledge\/entries\/([a-z0-9.-]+)(?:\/(reset|reindex))?$/.exec(path);
    if (entry) {
      const e = m.entries.find((x) => x.entry_id === entry[1]);
      if (!e) return ok({ error: "That knowledge entry does not exist." }, 404);
      const verb = entry[2];
      if (req.method() === "GET" && !verb) return ok({ entry: e, history: [] });
      if (req.method() === "PUT") Object.assign(e, body, { user_modified: e.origin === "system", updated_at: at() });
      if (req.method() === "DELETE") Object.assign(e, { deleted: true, status: "deleted", updated_at: at() });
      if (verb === "reset")
        Object.assign(e, MOCK_ENTRIES.find((x) => x.entry_id === e.entry_id), {
          user_modified: false,
          deleted: false,
          status: "ready",
          newer_default: null,
          updated_at: at(),
        });
      if (verb === "reindex") Object.assign(e, { sync: "done", status: "ready", error: null, updated_at: at() });
      return ok({ entry: e });
    }
    const one = /^\/knowledge\/(k-[\w-]+)$/.exec(path);
    if (one) {
      const i = kItem(one[1]!);
      if (!i) return ok({ error: "That item is gone." }, 404);
      if (req.method() === "GET") return ok({ ...i, entities: [] });
      if (req.method() === "PUT") {
        const placeKeys = ["jurisdictions", "year", "topic", "doc_type"];
        const owner = Object.keys(body ?? {}).some((k) => placeKeys.includes(k)) ? { meta_source: "owner" } : {};
        Object.assign(i, body, owner, { updated_at: at() });
        kEvent(i);
        return ok({ item: i });
      }
      if (req.method() === "DELETE") {
        m.knowledge.items = m.knowledge.items.filter((x) => x !== i);
        return ok({ ok: true });
      }
    }
    // ---------- Files (docs/FILES.md §7) ----------
    if (url.pathname === "/files" && req.method() === "GET") {
      // The real route's shape (docs/FILES.md §7): browse a folder, or search everywhere or inside it; sort; pages.
      const sp = url.searchParams;
      const q = (sp.get("q") ?? "").toLowerCase();
      const kind = sp.get("kind") ?? "";
      const folder = sp.get("folder") ?? "";
      const scope = sp.get("scope") ?? (q ? "all" : "here");
      const sort = sp.get("sort") ?? (q ? "relevance" : "date");
      const order = sp.get("order") ?? (sort === "name" || sort === "type" ? "asc" : "desc");
      const offset = Number(sp.get("offset") ?? 0);
      const limit = Number(sp.get("limit") ?? 60);
      const words = q.split(/\s+/).filter((w) => w.length > 2);
      const fol = (f: Record<string, unknown>) => String(f.folder ?? "");
      const inside = (f: Record<string, unknown>) => fol(f) === folder || fol(f).startsWith(`${folder}/`);
      let list = m.files.items.filter(
        (f) =>
          (!kind || f.kind === kind) &&
          (q ? scope === "all" || !folder || inside(f) : scope === "all" || fol(f) === folder) &&
          (!words.length ||
            words.some((w) => `${String(f.name)} ${String(f.description ?? "")}`.toLowerCase().includes(w))),
      );
      const keyOf = (f: Record<string, unknown>): string | number =>
        sort === "name"
          ? String(f.name).toLowerCase()
          : sort === "size"
            ? Number(f.size_bytes ?? 0)
            : sort === "type"
              ? String(f.kind)
              : String(f.taken_at ?? f.created_at ?? "");
      if (sort !== "relevance")
        list = [...list].sort((x, y) => {
          const a = keyOf(x),
            b = keyOf(y);
          return (a < b ? -1 : a > b ? 1 : 0) * (order === "desc" ? -1 : 1);
        });
      const all = [
        ...new Set(
          m.files.items.flatMap((f) =>
            fol(f)
              .split("/")
              .map((_, i, p) => p.slice(0, i + 1).join("/")),
          ),
        ),
      ]
        .filter(Boolean)
        .sort();
      const base = folder ? `${folder}/` : "";
      const kids = new Map<string, number>();
      for (const f of m.files.items)
        if (fol(f).startsWith(base) && fol(f) !== folder) {
          const name = fol(f).slice(base.length).split("/")[0]!;
          kids.set(name, (kids.get(name) ?? 0) + 1);
        }
      return ok({
        files: list.slice(offset, offset + limit).map(withLinks),
        count: list.length,
        next: offset + limit < list.length ? offset + limit : null,
        folder,
        subfolders: q
          ? []
          : [...kids].sort().map(([name, files]) => ({ name, path: base + name, files, updated_at: at() })),
        found_folders: q ? all.filter((p) => words.some((w) => p.toLowerCase().includes(w))) : [],
        folders: all,
        departments: [...new Set(m.files.items.map((f) => String(f.department ?? "")).filter(Boolean))].sort(),
        total: m.files.items.length,
      });
    }
    if (url.pathname === "/files/uploads" && req.method() === "POST") {
      const name = String(body?.file_name);
      const size = Number(body?.size_bytes);
      const id = `f-file${String(++fn).padStart(8, "0")}`;
      const f: Record<string, unknown> = {
        id,
        name,
        kind: fKind(name, String(body?.content_type ?? "")),
        content_type: body?.content_type,
        size_bytes: size,
        folder: body?.folder ?? "",
        tags: [],
        status: "uploading",
        added_by: "owner",
        description: "",
        created_at: at(),
        object_key: `files/${id}/${name}`,
      };
      m.files.items.unshift(f);
      const partSize = 16 * 1024 * 1024;
      const upload =
        size <= 100 * 1024 * 1024
          ? {
              method: "PUT",
              url: `${FILES_URL}/files/${id}/${encodeURIComponent(name)}?put`,
              headers: { "content-type": body?.content_type },
            }
          : {
              multipart: true,
              upload_id: `up-${id}`,
              part_size: partSize,
              part_urls: Array.from(
                { length: Math.ceil(size / partSize) },
                (_, n) => `${FILES_URL}/files/${id}/${encodeURIComponent(name)}?partNumber=${n + 1}&uploadId=up-${id}`,
              ),
            };
      return ok({ file: f, upload }, 201);
    }
    const fComplete = /^\/files\/uploads\/(f-[\w-]+)\/complete$/.exec(url.pathname);
    if (fComplete && req.method() === "POST") {
      const f = fItem(fComplete[1]!);
      if (!f) return ok({ error: "That file doesn't exist (any more)." }, 404);
      describeFile(f);
      return ok({ file: f });
    }
    const fOne = /^\/files\/(f-[\w-]+)(\/retry)?$/.exec(url.pathname);
    if (fOne) {
      const f = fItem(fOne[1]!);
      if (!f) return ok({ error: "That file doesn't exist (any more)." }, 404);
      if (fOne[2] && req.method() === "POST") {
        describeFile(f);
        return ok({ file: f });
      }
      if (req.method() === "GET") return ok(withLinks(f));
      if (req.method() === "PUT") {
        Object.assign(f, body, { updated_at: at() });
        m.send({ type: "files.updated", id: f.id, status: f.status, name: f.name, kind: f.kind, folder: f.folder });
        return ok({ file: withLinks(f) });
      }
      if (req.method() === "DELETE") {
        m.files.items = m.files.items.filter((x) => x !== f);
        return ok({ ok: true });
      }
    }
    if (path === "/workflows" && req.method() === "GET") return ok({ workflows: [], runs: [] });
    if (path === "/workforce") return ok({ workers: [], specialists: [] });
    if (path === "/health") return ok({ workers_busy: 0, worker_ceiling: 2450, stale_turns: 0 });
    // ---------- connectors, skills, mail (CONNECTORS_SKILLS.md §1.7, §2.4; MAIL_CALENDAR.md §4) ----------
    const method = req.method();
    if (path === "/connectors" && method === "GET") return ok({ connectors: m.connectors });
    if (path === "/departments/presets") return ok(PRESETS);
    // Departments on demand (decision 134): the server answers and tells the city, as the real one does.
    if (path === "/departments" && method === "POST") {
      const b = (body ?? {}) as { name?: string; mission?: string; worker_model?: string };
      const name = String(b.name ?? "").trim();
      if (name.length < 2) return ok({ error: "A department needs a name." }, 400);
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const department = {
        key,
        name,
        mission: b.mission || `Everything the business needs from ${name}.`,
        manager_id: `mgr-${key}`,
        state: "active",
        ...(b.worker_model ? { worker_model: b.worker_model } : {}),
      };
      built.push(name);
      m.send({
        type: "department.created",
        name,
        mission: department.mission,
        manager_id: department.manager_id,
        ...(b.worker_model ? { worker_model: b.worker_model } : {}),
      });
      return ok({ department, outcome: "created" }, 201);
    }
    if (/^\/departments\/[\w-]+$/.test(path) && method === "DELETE") {
      const key = path.split("/")[2];
      const city = m.snapshot as { departments?: Array<{ name: string }> };
      const name =
        (city.departments ?? []).find((d) => d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") === key)?.name ??
        built.find((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-") === key);
      if (!name) return ok({ error: "There is no standing department called that." }, 404);
      m.send({ type: "department.demolished", name, workers: 0, parts: 0 });
      return ok({ name, workers: 0, parts: 0, jobs: 0 });
    }
    if (path === "/connectors" && method === "POST") {
      // Added by link or by a department's switch: a service that needs the owner's account asks to sign in.
      const b = body as { url: string; label?: string };
      const id = (b.label ?? new URL(b.url).hostname.split(".")[1] ?? "mcp").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const c = {
        id,
        label: b.label ?? id,
        url: b.url,
        status: "needs_login",
        roles: { vaic: "all", manager: "all", worker: "all" },
      };
      m.connectors.push(c);
      return ok({ connector: c }, 201);
    }
    if (/^\/connectors\/[\w-]+$/.test(path) && method === "DELETE") {
      m.connectors = m.connectors.filter((x) => x.id !== path.split("/")[2]);
      return ok({ ok: true });
    }
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
    if (path.split("?")[0] === "/skills/catalog" && method === "GET")
      return ok({
        skills: SKILL_CATALOG.map((c) => ({ ...c, added: m.skills.some((x) => x.name === c.name) })),
        departments: PRESETS_FILE.departments
          .map((d) => d.name)
          .filter((d) => SKILL_CATALOG.some((c) => c.departments.includes(d))),
      });
    if (/^\/skills\/catalog\/[\w-]+$/.test(path)) {
      const c = SKILL_CATALOG.find((x) => x.name === path.split("/")[3]);
      if (!c) return ok({ error: "That skill is not in the catalog." }, 404);
      if (method === "GET")
        return ok({
          ...c,
          added: m.skills.some((x) => x.name === c.name),
          skill_md: readFileSync(`${catalogDir(c.builtin)}/${c.name}/SKILL.md`, "utf8"),
        });
      if (m.skills.some((x) => x.name === c.name))
        return ok({ error: `You already have the skill ${c.name}.`, fix: "Remove it under Yours first." }, 409);
      const b = (body ?? {}) as { roles?: string[] };
      const skill = {
        name: c.name,
        description: c.description,
        roles: b.roles ?? ["vaic", "orchestrator", "manager", "worker"],
        enabled: true,
        version: "v1",
        files: [{ path: "SKILL.md", size: 10 }],
        size_bytes: 10,
        source: "catalog",
        updated_at: at(),
      };
      m.skills = [...m.skills, skill];
      return ok({ skill, removed_frontmatter: [] }, 201);
    }
    if (/^\/skills\/[\w-]+$/.test(path) && method === "PUT") {
      const sk = m.skills.find((x) => x.name === path.split("/")[2])!;
      Object.assign(sk, body);
      return ok({ skill: sk });
    }
    if (/^\/skills\/[\w-]+$/.test(path) && method === "DELETE") {
      m.skills = m.skills.filter((x) => x.name !== path.split("/")[2]);
      return ok({ ok: true });
    }
    if (path === "/features") return ok({ features: m.features });
    if (/^\/features\/[\w-]+$/.test(path) && method === "PUT") {
      const f = m.features.find((x) => x.id === path.split("/")[2]);
      if (!f) return ok({ error: "That feature doesn't exist." }, 404);
      f.enabled = (body as { enabled: boolean }).enabled;
      return ok({ feature: f });
    }
    if (path.startsWith("/calendar/events")) return ok({ enabled: m.features[0]!.enabled, ...m.calendar });
    if (path === "/calendar/refresh" && method === "POST") return ok({ started: true }, 202);
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
  // The files bucket: presigned PUTs (an ETag back) and presigned GETs (a small image for any picture).
  await page.route(`${FILES_URL}/**`, async (route) => {
    const req = route.request();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "PUT, GET",
      "access-control-allow-headers": "*",
      "access-control-expose-headers": "ETag",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const pdf = /\.pdf$/i.test(decodeURIComponent(url.pathname));
      return route.fulfill({
        status: 200,
        headers,
        contentType: pdf ? "application/pdf" : "image/jpeg",
        body: pdf ? Buffer.from("%PDF-1.4\n%%EOF") : SUNRISE_JPG,
      });
    }
    m.files.puts.push(url.pathname + url.search);
    const part = url.searchParams.get("partNumber");
    if (!part) {
      const f = fItem(url.pathname.split("/")[2]!);
      if (f) describeFile(f);
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

/** A few built-in marketing entries, shaped like the registry records the API returns (docs/KNOWLEDGE.md §17). */
const MOCK_TAXONOMY = {
  label: "Marketing",
  domains: { strategy: "Strategy", "meta-ads": "Meta ads", "google-ads": "Google Ads", compliance: "Compliance" },
  platforms: { meta: "Meta", "google-ads": "Google Ads", instagram: "Instagram" },
  objectives: { awareness: "Awareness", sales: "Sales", leads: "Leads" },
};
const mockEntry = (domain: string, slug: string, title: string, extra: Record<string, unknown> = {}) => ({
  id: `kn-marketing.${domain}.${slug}`,
  entry_id: `marketing.${domain}.${slug}`,
  department: "marketing",
  domain,
  title,
  summary: `${title}: what to do and why.`,
  content: `**When to use this:** when planning.\n\n## ${title}\n\n**[DURABLE]** The guidance itself.`,
  type: "playbook",
  audience: "both",
  platforms: [],
  objectives: ["sales"],
  confidence: "established",
  volatility: "evergreen",
  as_of: "2026-11-11",
  review_by: "2028-11-11",
  sources: ["https://example.com/source"],
  origin: "system",
  builtin: true,
  status: "ready",
  sync: "done",
  user_modified: false,
  deleted: false,
  updated_at: "2026-11-11T10:00:00Z",
  ...extra,
});
const MOCK_ENTRIES: Array<Record<string, unknown>> = [
  mockEntry("strategy", "positioning", "Build positioning bottom-up, then compress it into one sentence"),
  mockEntry("meta-ads", "learning-phase-and-budgets", "Size Meta budgets to about 50 results per ad set per week", {
    type: "playbook",
    audience: "worker",
    platforms: ["meta"],
    volatility: "fast-moving",
    review_by: "2027-02-11",
    newer_default: { title: "Size Meta budgets (newer default)", content: "The newer default text." },
  }),
  mockEntry("google-ads", "performance-max-and-feeds", "Performance Max: inputs matter more than controls", {
    platforms: ["google-ads"],
  }),
  mockEntry("compliance", "sweden-ad-disclosure", "Sweden: advertising must be recognisable", { type: "policy" }),
];

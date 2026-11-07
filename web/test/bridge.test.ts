// The data bridge (docs/APPS.md "v2: data bridge"): every rule that drops or refuses a message.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.fn();
vi.mock("../src/lib/api.ts", () => {
  class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly fix: string | null = null,
    ) {
      super(message);
    }
  }
  return { api: (...a: unknown[]) => apiMock(...a), ApiError };
});
const { ApiError } = await import("../src/lib/api.ts");
const { LIMITS, onMessage, registerFrame, resetBridge } = await import("../src/lib/bridge.ts");
const { store } = await import("../src/lib/store.ts");

const APP = "app-0000000000aa";
const grants = [
  { id: "calendar.read" },
  { id: "connector.read", connector: "notion", tool: "search" },
  { id: "propose" },
];
let frame: HTMLIFrameElement;
let post: ReturnType<typeof vi.fn>;
let unregister: () => void;

const mount = (appId: string | null = APP) => {
  frame = document.createElement("iframe");
  document.body.append(frame);
  post = vi.fn();
  frame.contentWindow!.postMessage = post as unknown as Window["postMessage"];
  unregister = registerFrame(frame, appId);
};
const send = (data: unknown, over: { origin?: string; source?: unknown } = {}) =>
  onMessage({ origin: "null", source: frame.contentWindow, data, ...over } as unknown as MessageEvent);
const req = (cap: string, params: unknown = {}, id = "r1") => ({ aic: 1, id, cap, params });
const lastReply = () => post.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue({ data: { events: [{ title: "Dentist" }] } });
  store.setApps([
    {
      app_id: APP,
      slug: "star-calendar",
      title: "Star Calendar",
      url: "https://apps.aic.test/live/x/index.html",
      grants,
    },
  ]);
  mount();
});
afterEach(() => {
  resetBridge();
  frame.remove();
  vi.useRealTimers();
});

describe("who may talk to the bridge", () => {
  it("answers the mounted frame with granted data, through the API, and nothing else", async () => {
    await send(req("calendar.read", { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" }));
    expect(apiMock).toHaveBeenCalledWith(`/apps/${APP}/bridge`, {
      method: "POST",
      body: { cap: "calendar.read", params: { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" } },
    });
    expect(post).toHaveBeenCalledWith({ aic: 1, id: "r1", ok: true, data: { events: [{ title: "Dentist" }] } }, "*");
    expect(Object.keys(lastReply()).sort()).toEqual(["aic", "data", "id", "ok"]); // no token, URL or config
  });
  it("drops a message whose origin is not the sandbox's opaque 'null'", async () => {
    await send(req("calendar.read"), { origin: "https://apps.aic.test" });
    await send(req("calendar.read"), { origin: "http://localhost:4173" });
    expect(apiMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
  it("drops a message from any window that isn't a mounted AppFrame", async () => {
    const other = document.createElement("iframe");
    document.body.append(other);
    await send(req("calendar.read"), { source: other.contentWindow });
    await send(req("calendar.read"), { source: window });
    await send(req("calendar.read"), { source: null });
    expect(apiMock).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    other.remove();
  });
  it("forgets a frame once it unmounts", async () => {
    unregister();
    await send(req("calendar.read"));
    expect(post).not.toHaveBeenCalled();
  });
  it("takes the app from the frame, never from the message", async () => {
    await send({ ...req("calendar.read"), app_id: "app-other", appId: "app-other" });
    expect(apiMock.mock.calls[0]?.[0]).toBe(`/apps/${APP}/bridge`);
    expect((apiMock.mock.calls[0]?.[1] as { body: object }).body).toEqual({ cap: "calendar.read", params: {} });
  });
});

describe("shape", () => {
  it.each([
    ["not an object", "calendar.read"],
    ["an array", [1]],
    ["aic missing", { id: "r1", cap: "calendar.read" }],
    ["aic 2", { aic: 2, id: "r1", cap: "calendar.read" }],
    ["no id", { aic: 1, cap: "calendar.read" }],
    ["empty id", { aic: 1, id: "", cap: "calendar.read" }],
    ["numeric id", { aic: 1, id: 7, cap: "calendar.read" }],
    ["id too long", { aic: 1, id: "x".repeat(LIMITS.idLen + 1), cap: "calendar.read" }],
  ])("drops %s without an answer", async (_n, data) => {
    await send(data);
    expect(post).not.toHaveBeenCalled();
    expect(apiMock).not.toHaveBeenCalled();
  });
  it.each([
    ["no cap", { aic: 1, id: "r1" }],
    ["cap too long", req("c".repeat(LIMITS.capLen + 1))],
    ["params an array", req("calendar.read", [1, 2])],
    ["params a string", req("calendar.read", "x")],
    ["params a Date", req("calendar.read", new Date())],
    ["params over 8 KB", req("calendar.read", { q: "x".repeat(LIMITS.paramsBytes) })],
  ])("answers invalid for %s", async (_n, data) => {
    await send(data);
    expect(lastReply()).toMatchObject({ aic: 1, id: "r1", ok: false, error: "invalid" });
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe("grants", () => {
  it.each([
    ["a cap it wasn't granted", req("mail.search", { query: "x" })],
    ["a cap nobody can be granted", req("mail.send", { to: "x" })],
    [
      "a connector tool other than the granted one",
      req("connector.read", { connector: "notion", tool: "delete_page" }),
    ],
    ["another connector", req("connector.read", { connector: "github", tool: "search" })],
    ["a proposal kind outside the list", req("propose", { kind: "mail.send", params: {} })],
  ])("answers not_granted for %s, without the API", async (_n, data) => {
    await send(data);
    expect(lastReply()).toMatchObject({ ok: false, error: "not_granted" });
    expect(apiMock).not.toHaveBeenCalled();
  });
  it("a revoke counts from the next request", async () => {
    await send(req("calendar.read"));
    expect(lastReply()).toMatchObject({ ok: true });
    store.event({ type: "app.updated", app: { app_id: APP, grants: [{ id: "propose" }] } });
    await send(req("calendar.read", {}, "r2"));
    expect(lastReply()).toMatchObject({ id: "r2", ok: false, error: "not_granted" });
    expect(apiMock).toHaveBeenCalledTimes(1);
  });
  it("an app the HUD doesn't know gets nothing", async () => {
    resetBridge();
    mount("app-unknown");
    await send(req("calendar.read"));
    expect(lastReply()).toMatchObject({ error: "not_granted" });
  });
  it("a granted connector tool goes through with its connector and tool", async () => {
    await send(req("connector.read", { connector: "notion", tool: "search", args: { q: "plan" } }));
    expect(apiMock).toHaveBeenCalledTimes(1);
  });
  it("a proposal goes to /proposals and the app only learns it is waiting", async () => {
    apiMock.mockResolvedValue({ approval: { id: "apr-9", secret: "x" } });
    await send(req("propose", { kind: "calendar.respond", params: { event_id: "e1", response: "accepted" } }));
    expect(apiMock).toHaveBeenCalledWith(`/apps/${APP}/proposals`, {
      method: "POST",
      body: { kind: "calendar.respond", params: { event_id: "e1", response: "accepted" } },
    });
    expect(lastReply()).toEqual({ aic: 1, id: "r1", ok: true, status: "waiting_for_you" });
  });
});

describe("preview", () => {
  it("a preview frame gets `preview` for everything, without the API", async () => {
    resetBridge();
    mount(null);
    for (const cap of ["calendar.read", "mail.search", "propose"]) await send(req(cap));
    expect(post).toHaveBeenCalledTimes(3);
    for (const [m] of post.mock.calls) expect(m).toMatchObject({ ok: false, error: "preview" });
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe("throttle", () => {
  it("4 in flight per frame; the 5th is rate_limited", async () => {
    const waits: Array<(v: unknown) => void> = [];
    apiMock.mockImplementation(() => new Promise((r) => waits.push(r)));
    const pending = [1, 2, 3, 4].map((i) => send(req("calendar.read", {}, `r${i}`)));
    await send(req("calendar.read", {}, "r5"));
    expect(lastReply()).toMatchObject({ id: "r5", error: "rate_limited" });
    expect(apiMock).toHaveBeenCalledTimes(4);
    waits.forEach((w) => w({ data: 1 }));
    await Promise.all(pending);
    apiMock.mockResolvedValue({ data: 2 });
    await send(req("calendar.read", {}, "r6"));
    expect(lastReply()).toMatchObject({ id: "r6", ok: true });
  });
  it("30 a minute per frame; the minute after, it works again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-07T10:00:00Z"));
    for (let i = 0; i < 30; i++) await send(req("calendar.read", {}, `r${i}`));
    await send(req("calendar.read", {}, "r30"));
    expect(lastReply()).toMatchObject({ id: "r30", error: "rate_limited" });
    expect(apiMock).toHaveBeenCalledTimes(30);
    vi.setSystemTime(new Date("2026-11-07T10:01:01Z"));
    await send(req("calendar.read", {}, "r31"));
    expect(lastReply()).toMatchObject({ id: "r31", ok: true });
  });
});

describe("errors from the API", () => {
  it.each([
    [new ApiError("Not allowed.", 403), "not_granted"],
    [new ApiError("Bad params.", 400), "invalid"],
    [new ApiError("Slow down.", 429), "rate_limited"],
    [new ApiError("login_expired", 409), "login_expired"],
    [new ApiError("Boom at https://api.aic.test/secret", 500), "unavailable"],
    [new Error("network"), "unavailable"],
  ])("%s → %s, with AI City's own words (never the server's)", async (err, code) => {
    apiMock.mockRejectedValue(err);
    await send(req("calendar.read"));
    const r = lastReply();
    expect(r).toMatchObject({ ok: false, error: code });
    expect(String(r.message)).not.toContain("api.aic.test");
  });
});

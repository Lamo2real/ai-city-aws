// The "new version" notice (lib/version.ts, components/UpdateNotice.tsx).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { CHECK_EVERY_MS, isNewer, liveVersion, loadedVersion, watchVersion } from "../src/lib/version.ts";
import { UpdateNotice } from "../src/components/UpdateNotice.tsx";

const answer = (version: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => ({ version }) }) as unknown as Response);

function stamp(v: string | null) {
  document.head.querySelector('meta[name="hud-version"]')?.remove();
  if (v === null) return;
  const m = document.createElement("meta");
  m.name = "hud-version";
  m.content = v;
  document.head.appendChild(m);
}

afterEach(() => {
  cleanup();
  stamp(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("version ids", () => {
  it("reads the loaded id from the page, none in development", () => {
    expect(loadedVersion()).toBeNull();
    stamp("abc");
    expect(loadedVersion()).toBe("abc");
  });
  it("a different live id is newer; the same id, or a missing one, is not", () => {
    expect(isNewer("a", "b")).toBe(true);
    expect(isNewer("a", "a")).toBe(false);
    expect(isNewer("a", null)).toBe(false);
    expect(isNewer(null, "b")).toBe(false);
  });
  it("reads /version.json past every cache, and gives null on errors or odd answers", async () => {
    const f = answer("v2");
    expect(await liveVersion(f)).toBe("v2");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^\/version\.json\?t=\d+$/);
    expect(init.cache).toBe("no-store");
    expect(await liveVersion(answer("v2", false))).toBeNull();
    expect(await liveVersion(answer(42))).toBeNull();
    expect(await liveVersion(vi.fn(async () => Promise.reject(new Error("offline"))))).toBeNull();
  });
});

describe("watchVersion", () => {
  it("same id: never calls; checks again every few minutes", async () => {
    vi.useFakeTimers();
    const f = answer("v1");
    const onNew = vi.fn();
    const stop = watchVersion(onNew, { loaded: "v1", fetchFn: f });
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 2);
    expect(f).toHaveBeenCalledTimes(3);
    expect(onNew).not.toHaveBeenCalled();
    stop();
  });
  it("new id: calls once and stops checking", async () => {
    vi.useFakeTimers();
    const f = answer("v2");
    const onNew = vi.fn();
    const stop = watchVersion(onNew, { loaded: "v1", fetchFn: f });
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS * 2);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledTimes(1);
    stop();
  });
  it("focus checks at most once a minute", async () => {
    let t = 0;
    const f = answer("v1");
    const stop = watchVersion(() => undefined, { loaded: "v1", fetchFn: f, now: () => t });
    await new Promise((r) => setTimeout(r, 0));
    t = 10_000;
    window.dispatchEvent(new Event("focus"));
    await Promise.resolve();
    expect(f).toHaveBeenCalledTimes(1);
    t = 70_000;
    window.dispatchEvent(new Event("focus"));
    expect(f).toHaveBeenCalledTimes(2);
    stop();
  });
  it("no stamp (development): no checks at all", () => {
    const f = answer("v2");
    watchVersion(() => undefined, { loaded: null, fetchFn: f })();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("UpdateNotice", () => {
  it("same id: nothing shows", async () => {
    stamp("v1");
    vi.stubGlobal("fetch", answer("v1"));
    render(createElement(UpdateNotice));
    await act(async () => undefined);
    expect(screen.queryByText(/new version/i)).toBeNull();
  });
  it("new id: the notice shows, and only Reload reloads", async () => {
    stamp("v1");
    vi.stubGlobal("fetch", answer("v2"));
    const reload = vi.fn();
    render(createElement(UpdateNotice, { reload }));
    expect(await screen.findByText("A new version of VAIC is ready.")).toBeTruthy();
    expect(reload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

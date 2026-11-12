// The live working copy (decision 278): filed under the builder's project, only from the apps origin's private
// drafts address, reloaded by number, and put away when the version is published.
import { beforeEach, describe, expect, it } from "vitest";
import type { CityState } from "../src/city/city-state.js";
import { frameSrc, labelOf, livePreview } from "../src/lib/livePreview.ts";

const APPS = "https://apps.vaic.test";
const URL_OK = `${APPS}/drafts/prv-0123456789abcdef0123456789abcdef/index.html`;
const city = {
  agents: { "wkr-front": { id: "wkr-front", kind: "worker", role: "frontend-dev", ticket_id: "t-1" } },
  tickets: {
    "t-0": { id: "t-0", to: "orchestrator", conversation: "app-new-abc", status: "open" },
    "t-1": { id: "t-1", parent_id: "t-0", to: "wkr-front", status: "in_progress" },
  },
} as unknown as CityState;
const ev = (over: Record<string, unknown> = {}) => ({
  type: "app.preview",
  hire_id: "wkr-front",
  preview_url: URL_OK,
  seq: 1,
  paths: ["index.html", "game.js"],
  hints: [{ path: "index.html", selector: "#board" }],
  ...over,
});

describe("live preview", () => {
  beforeEach(() => {
    localStorage.clear();
    livePreview.state = {};
  });

  it("files the copy under the builder's project, with who changed what", () => {
    livePreview.event(ev(), city, APPS);
    const c = livePreview.get()["app-new-abc"]!;
    expect(c.url).toBe(URL_OK);
    expect(c.editors["wkr-front"]).toMatchObject({ label: "Frontend dev", path: "index.html", selector: "#board" });
    const src = new URL(frameSrc(c));
    expect(src.searchParams.get("live")).toBe("1");
    expect(JSON.parse(src.searchParams.get("marks")!)).toEqual([
      { label: "Frontend dev", selector: "#board", color: c.editors["wkr-front"]!.color },
    ]);
    livePreview.event(ev({ seq: 1, paths: ["x.js"] }), city, APPS); // a repeat changes nothing
    expect(livePreview.get()["app-new-abc"]!.changed).toEqual(["index.html", "game.js"]);
  });

  it("ignores copies from anywhere but the apps origin's private address, and odd selectors", () => {
    livePreview.event(
      ev({ preview_url: "https://evil.test/drafts/prv-0123456789abcdef0123456789abcdef/index.html" }),
      city,
      APPS,
    );
    livePreview.event(ev({ preview_url: `${APPS}/live/app-1/index.html` }), city, APPS);
    livePreview.event(ev({ hire_id: "wkr-other" }), city, APPS);
    expect(livePreview.get()).toEqual({});
    livePreview.event(ev({ hints: [{ path: "index.html", selector: "a);alert(1)" }] }), city, APPS);
    expect(livePreview.get()["app-new-abc"]!.editors["wkr-front"]!.selector).toBeNull();
  });

  it("is put away when the version is published", () => {
    livePreview.event(ev(), city, APPS);
    livePreview.event({ type: "app.published", app_id: "app-1", conversation: "app-new-abc" }, city, APPS);
    expect(livePreview.get()).toEqual({});
  });

  it("names a builder by its role", () => {
    expect(labelOf("ux_designer", "wkr-1")).toBe("Ux designer");
    expect(labelOf(undefined, "wkr-1")).toBe("Builder");
  });
});

// City → Features → Calendar (docs/MAIL_CALENDAR.md §12): the date logic in the owner's time zone, the Join
// button's rules, and the Features gallery (on/off, "Add a feature" through VAIC).
process.env.TZ = "Europe/Stockholm";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FeaturesScreen } from "../src/components/Features.tsx";
import {
  byDay,
  colorOf,
  daysOf,
  joinSoon,
  range,
  safeJoinUrl,
  step,
  updatedText,
  whenText,
  type Meeting,
} from "../src/lib/calendar.ts";
import { loadConfig } from "../src/lib/config.ts";

vi.mock("../src/lib/auth.ts", () => ({ idToken: async () => "token" }));

const m = (start: string, end: string, extra: Partial<Meeting> = {}): Meeting => ({
  id: `ev-${start}`,
  title: "Sync",
  start,
  end,
  all_day: false,
  time_zone: "",
  organizer: { name: "", email: "" },
  attendees: [],
  location: "",
  description: "",
  my_response: "",
  recurring: false,
  join: null,
  sources: [],
  color: "moss",
  ...extra,
});

describe("calendar dates", () => {
  it("each view covers the right local days", () => {
    const at = new Date(2026, 10, 11); // Wed 11 Nov 2026
    expect(range("today", at)).toMatchObject({ from: "2026-11-11", to: "2026-11-12" });
    expect(range("week", at)).toMatchObject({ from: "2026-11-09", to: "2026-11-16" }); // Monday to Monday
    const month = range("month", at);
    expect(month.from).toBe("2026-10-26"); // the Monday before 1 Nov
    expect(month.days.length % 7).toBe(0);
    expect(month.days).toContain("2026-11-30");
    expect(range("agenda", at).days).toHaveLength(30);
    expect(step("month", at, 1).getMonth()).toBe(11);
    expect(step("week", at, -1).getDate()).toBe(4);
  });

  it("UTC times land on the owner's local day, across midnight and for whole days", () => {
    // 23:30 UTC on the 10th is 00:30 on the 11th in Stockholm.
    expect(daysOf(m("2026-11-10T23:30Z", "2026-11-11T00:30Z"))).toEqual(["2026-11-11"]);
    // A whole day from the 12th to the 14th (end exclusive) touches the 12th and 13th.
    expect(daysOf(m("2026-11-12", "2026-11-14", { all_day: true }))).toEqual(["2026-11-12", "2026-11-13"]);
    // An invitation's whole day without an end day is that one day.
    expect(daysOf(m("2026-11-12", "2026-11-12", { all_day: true }))).toEqual(["2026-11-12"]);
    const days = byDay([
      m("2026-11-11T09:00Z", "2026-11-11T10:00Z", { id: "b" }),
      m("2026-11-11", "2026-11-12", { id: "a", all_day: true }),
      m("2026-11-11T07:00Z", "2026-11-11T08:00Z", { id: "c" }),
    ]);
    expect(days.get("2026-11-11")!.map((x) => x.id)).toEqual(["a", "c", "b"]); // whole day first, then by time
    expect(whenText(m("2026-11-11T07:00Z", "2026-11-11T08:30Z"))).toMatch(/08.00.+09.30/);
    expect(whenText(m("2026-11-11", "2026-11-12", { all_day: true }))).toBe("All day");
  });

  it("Join is lit 10 minutes before and during a meeting, and only https links open", () => {
    const meet = { url: "https://meet.google.com/abc-defg-hij", kind: "meet" as const };
    const mt = m("2026-11-11T09:00Z", "2026-11-11T10:00Z", { join: meet });
    expect(joinSoon(mt, new Date("2026-11-11T08:45Z"))).toBe(false);
    expect(joinSoon(mt, new Date("2026-11-11T08:51Z"))).toBe(true);
    expect(joinSoon(mt, new Date("2026-11-11T09:59Z"))).toBe(true);
    expect(joinSoon(mt, new Date("2026-11-11T10:00Z"))).toBe(false);
    expect(safeJoinUrl(mt)).toBe(meet.url);
    expect(safeJoinUrl(m("x", "y", { join: { url: "javascript:alert(1)", kind: "zoom" } }))).toBeNull();
    expect(safeJoinUrl(m("x", "y", { join: { url: "http://zoom.us/j/1", kind: "zoom" } }))).toBeNull();
  });

  it("says how fresh the calendar is, and colours unknown accounts slate", () => {
    const now = Date.parse("2026-11-11T12:00:00Z");
    expect(updatedText(undefined, now)).toBe("Not checked yet");
    expect(updatedText("2026-11-11T11:59:30Z", now)).toBe("Updated just now");
    expect(updatedText("2026-11-11T11:56:00Z", now)).toBe("Updated 4 minutes ago");
    expect(updatedText("2026-11-11T10:00:00Z", now)).toBe("Updated 2 hours ago");
    expect(colorOf("rose")).toBe("#d0688c");
    expect(colorOf("nonsense")).toBe(colorOf("slate"));
  });
});

describe("the Features gallery", () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  beforeAll(async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/config.json") return new Response(JSON.stringify({ apiUrl: "https://api.vaic.test" }));
        calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
        if (url.endsWith("/features"))
          return new Response(
            JSON.stringify({
              features: [{ id: "calendar", name: "Calendar", blurb: "Every meeting.", enabled: true }],
            }),
          );
        return new Response(JSON.stringify({ feature: { id: "calendar", enabled: false } }));
      }),
    );
    await loadConfig();
  });
  afterEach(cleanup);

  it("lists Calendar with its switch, and Add a feature opens VAIC with a started sentence", async () => {
    const go = vi.fn();
    render(<FeaturesScreen page="features" go={go} />);
    const sw = await screen.findByRole("switch", { name: "Calendar on or off" });
    expect((sw as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("link", { name: /^Calendar/ }).getAttribute("href")).toBe("#/city/features/calendar");
    fireEvent.click(sw);
    await waitFor(() =>
      expect(calls.some((c) => c.method === "PUT" && c.url.endsWith("/features/calendar"))).toBe(true),
    );
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ enabled: false });
    fireEvent.click(screen.getByRole("button", { name: /Add a feature/ }));
    expect(localStorage.getItem("vaic.draft")).toBe("I'd like a feature that ");
    expect(go).toHaveBeenCalledWith("vaic");
  });
});

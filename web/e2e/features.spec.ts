// City → Features and the Calendar (docs/MAIL_CALENDAR.md §12), against the mocked backend: the City | Features
// tabs, the gallery with its on/off switch and "Add a feature" through VAIC, the four calendar views, a meeting's
// details with its Join button, Refresh now, and the empty and problem states. Nothing leaves the machine.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend, type Mock } from "./mock.ts";

test.use({ timezoneId: "Europe/Stockholm", locale: "en-GB" });

const ZOOM = "https://acme.zoom.us/j/81234567890?pwd=AbCdEf123";
const TEAMS = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_x%40thread.v2/0";

/** Today in Stockholm at hh:mm, as the calendar's UTC form (`…T08:00Z`). */
function at(dayOffset: number, hh: number, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString().slice(0, 16) + "Z";
}
const src = (label: string, color: string, provider: string) => ({
  account_id: `ma-${label.toLowerCase()}`,
  label,
  address: `${label.toLowerCase()}@x.com`,
  provider,
  event_id: `${label}-1`,
  url: `https://calendar.${provider}.test/event`,
  color,
});
const meeting = (id: string, title: string, start: string, end: string, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  start,
  end,
  all_day: false,
  time_zone: "Europe/Stockholm",
  organizer: { name: "Ana Lund", email: "ana@corp.com" },
  attendees: [
    { name: "Ana Lund", email: "ana@corp.com", response: "accepted" },
    { name: "Bo Ek", email: "bo@corp.com", response: "accepted" },
  ],
  location: "",
  description: "",
  my_response: "accepted",
  recurring: false,
  join: null,
  sources: [src("Work", "ink-blue", "microsoft")],
  color: "ink-blue",
  ...extra,
});

async function withCalendar(page: Page): Promise<Mock> {
  const m = await mockBackend(page);
  m.calendar = {
    accounts: [
      {
        id: "ma-work",
        label: "Work",
        provider: "microsoft",
        address: "me@corp.com",
        status: "connected",
        color: "ink-blue",
      },
      {
        id: "ma-personal",
        label: "Personal",
        provider: "google",
        address: "me@gmail.com",
        status: "connected",
        color: "rose",
      },
    ],
    state: { last_import_at: new Date(Date.now() - 4 * 60_000).toISOString(), accounts: 2, events: 4, errors: [] },
    events: [
      meeting("ev-1", "Design review", at(0, 9), at(0, 10), {
        join: { url: TEAMS, kind: "teams" },
        sources: [src("Work", "ink-blue", "microsoft"), src("Personal", "rose", "google")],
        description: "Agenda:\n1. Header\n2. Calendar <b>not bold</b>",
      }),
      meeting("ev-2", "Dentist", at(0, 14), at(0, 15), {
        location: "Sveavägen 12",
        sources: [src("Personal", "rose", "google")],
        color: "rose",
      }),
      meeting("ev-3", "Zoom with the bank", at(1, 11), at(1, 11, 30), { join: { url: ZOOM, kind: "zoom" } }),
      meeting("ev-4", "Offsite", at(3, 0).slice(0, 10), at(5, 0).slice(0, 10), { all_day: true, sources: [] }),
    ],
  };
  return m;
}

test("the City tab has City | Features; Features lists Calendar and adds a feature through VAIC", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/city");
  const tabs = page.getByRole("navigation", { name: "City pages" });
  await expect(tabs.getByRole("link", { name: "City" })).toHaveAttribute("aria-current", "page");
  // The top bar keeps its tabs; Features lives under City, not beside it.
  const top = page.getByRole("navigation", { name: "Screens" });
  await expect(top.getByRole("link", { name: "City" })).toBeVisible();
  await expect(top.getByRole("link", { name: "Features" })).toHaveCount(0);
  await tabs.getByRole("link", { name: "Features" }).click();
  await expect(page).toHaveURL(/#\/city\/features$/);
  await expect(page.getByRole("heading", { name: "Features", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Screens" }).getByRole("link", { name: "City" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const sw = page.getByRole("switch", { name: "Calendar on or off" });
  await expect(sw).toBeChecked();
  await sw.click({ force: true });
  await expect(sw).not.toBeChecked();
  expect(m.calls.find((c) => c.method === "PUT" && c.path === "/features/calendar")?.body).toEqual({ enabled: false });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole("button", { name: /Add a feature/ }).click();
  await expect(page).toHaveURL(/#\/ace$/);
  await expect(page.getByRole("textbox").first()).toHaveValue("I'd like a feature that ");
});

test("the Calendar shows today with a Join button, the week, the month and the agenda", async ({ page }) => {
  const m = await withCalendar(page);
  await page.goto("/#/city/features");
  await page.getByRole("link", { name: /^Calendar/ }).click();
  await expect(page.getByRole("heading", { name: "Calendar", level: 1 })).toBeVisible();
  await expect(page.getByText("Updated 4 minutes ago")).toBeVisible();
  const call = m.calls.find((c) => c.path.startsWith("/calendar/events"))!;
  expect(call.path).toContain("tz=Europe%2FStockholm");

  // Today: both of today's meetings, each with its accounts' colours.
  const today = page.locator(".daylist");
  await expect(today.getByRole("button", { name: /Design review/ })).toBeVisible();
  await expect(today.getByRole("button", { name: /Dentist/ })).toContainText("Sveavägen 12");
  await expect(today.getByRole("button", { name: /Design review/ })).toContainText("Microsoft Teams");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // The details: when, who, which accounts, the notes as plain text, and one big Join.
  await today.getByRole("button", { name: /Design review/ }).click();
  const sheet = page.getByRole("dialog", { name: "Design review" });
  const join = sheet.getByRole("link", { name: "Join on Microsoft Teams" });
  await expect(join).toHaveAttribute("href", TEAMS);
  await expect(join).toHaveAttribute("target", "_blank");
  await expect(join).toHaveAttribute("rel", "noopener noreferrer");
  await expect(sheet).toContainText("Ana Lund, Bo Ek");
  await expect(sheet.locator(".mt-sources")).toContainText("Work");
  await expect(sheet.locator(".mt-sources")).toContainText("Personal");
  await expect(sheet.locator(".mt-notes")).toContainText("<b>not bold</b>"); // shown as text, never as HTML
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  // Week, month, agenda.
  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.locator(".week-day")).toHaveCount(7);
  await page.getByRole("tab", { name: "Month" }).click();
  await expect(page.getByRole("grid", { name: "Month" })).toBeVisible();
  await expect(page.locator(".month-day.is-today")).toContainText("Design review");
  await page.getByRole("tab", { name: "Agenda" }).click();
  await expect(page.locator(".daylist h3").first()).toContainText("Today");
  await expect(page.locator(".daylist")).toContainText("Zoom with the bank");
  await expect(page.locator(".daylist")).toContainText("Offsite");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Refresh now asks the backend once and says so.
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.getByText("Checking your accounts for new meetings…")).toBeVisible();
  expect(m.calls.filter((c) => c.path === "/calendar/refresh")).toHaveLength(1);
  // A finished import reloads the screen.
  const before = m.calls.filter((c) => c.path.startsWith("/calendar/events")).length;
  m.send({ type: "calendar.changed", calendar_ids: [] });
  await expect.poll(() => m.calls.filter((c) => c.path.startsWith("/calendar/events")).length).toBeGreaterThan(before);
});

test("no account yet: the Calendar says to connect one, and the button goes there", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/#/city/features/calendar");
  await expect(page.getByText(/Connect an email account/)).toBeVisible();
  await page.getByRole("button", { name: "Connect an account" }).click();
  await expect(page).toHaveURL(/#\/settings\/connectors$/);
});

test("an account that failed is named, and its meetings from before stay", async ({ page }) => {
  const m = await withCalendar(page);
  m.calendar.state = {
    ...m.calendar.state,
    errors: [{ account_id: "ma-work", label: "Work", message: "Work needs the owner to sign in again." }],
  };
  await page.goto("/#/city/features/calendar");
  await expect(page.getByRole("status").filter({ hasText: "Work couldn't be read just now" })).toBeVisible();
  await expect(page.locator(".daylist")).toContainText("Design review");
});

test("the Calendar switched off says so and turns back on in one tap", async ({ page }) => {
  const m = await withCalendar(page);
  m.features[0]!.enabled = false;
  await page.goto("/#/city/features/calendar");
  await expect(page.getByText("The Calendar is off")).toBeVisible();
  await page.getByRole("button", { name: "Turn the Calendar on" }).click();
  await expect(page.locator(".daylist")).toContainText("Design review");
  expect(m.calls.find((c) => c.method === "PUT")?.body).toEqual({ enabled: true });
});

test("light theme: the gallery and a meeting stay readable (axe)", async ({ page }) => {
  await withCalendar(page);
  await page.addInitScript(() => localStorage.setItem("aic.theme", "light"));
  await page.goto("/#/city/features/calendar");
  await expect(page.locator(".daylist")).toContainText("Design review");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/#/city/features");
  await expect(page.getByRole("switch", { name: "Calendar on or off" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

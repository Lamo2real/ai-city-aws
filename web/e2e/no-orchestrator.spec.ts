// Decision 298: the Orchestrator is gone. Nothing the owner sees says "Orchestrator": the City (HQ shows VAIC and the
// planner), Work, Projects, Settings and Costs. An old job's events that still name the Orchestrator read as before.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { appRecord, mockBackend } from "./mock.ts";

const SHOTS = process.env.BOARD_SHOTS ?? `${import.meta.dirname}/../test-results/board-shots`;
const PAGES = [
  ["city", "/#/city"],
  ["work", "/#/tickets"],
  ["projects", "/#/apps"],
  ["settings", "/#/settings"],
  ["settings-mail", "/#/settings/mail"],
  ["settings-connectors", "/#/settings/connectors"],
  ["costs", "/#/costs"],
] as const;

for (const [name, path] of PAGES)
  test(`${name}: no "Orchestrator" anywhere the owner looks`, async ({ page }) => {
    const m = await mockBackend(page, { apps: [appRecord("app-0000000000aa", "star-sweeper", "Star Sweeper")] });
    // An old job from the chain: its events still name the Orchestrator inside.
    const old = JSON.parse(readFileSync(`${import.meta.dirname}/fixtures/chain-small.json`, "utf8")) as Record<
      string,
      unknown
    >[];
    for (const e of old.slice(0, 20)) m.send(e);
    await page.goto(path);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    expect(await page.locator("body").innerText()).not.toMatch(/orchestrator/i);
  });

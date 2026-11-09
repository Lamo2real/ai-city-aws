// The voice conversation answers what the owner says (the owner, 2026-11-09: "I can't even speak to it… it should
// only answer what I'm saying"). The fake voice from mock.ts stands in for the microphone and the speaker.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test("an answer that repeats VAIC's words is sent, and VAIC answers it aloud", async ({ page }) => {
  const m = await mockBackend(page);
  await page.addInitScript(() => {
    (window as unknown as { __heard: string }).__heard = "check my mail";
    (window as unknown as { __speakMs: number }).__speakMs = 300;
  });
  await page.goto("/");
  const strip = page.locator(".voice");
  const messages = () => m.calls.filter((c) => c.path === "/messages");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => messages().length).toBe(1);
  m.send({ type: "ace.reply", conversation: "main", text: "Shall I send the email to John?", done: true });
  await expect(strip).toHaveAttribute("data-speaker", "aic");
  await expect(strip).toHaveAttribute("data-speaker", "you"); // VAIC finished: listening again
  await page.waitForTimeout(800); // the echo of VAIC's voice has died away
  // Almost every word is one VAIC just said: it used to be dropped as VAIC's echo, so nothing was answered.
  await page.evaluate(() => ((window as unknown as { __heard: string }).__heard = "yes, send the email to John"));
  await expect.poll(() => messages().length).toBe(2);
  expect(messages()[1]?.body).toMatchObject({ text: "yes, send the email to John", voice: true });
  m.send({ type: "ace.reply", conversation: "main", text: "Sent.", done: true });
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? []))
    .toContain("Sent.");
});

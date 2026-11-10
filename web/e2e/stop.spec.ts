// Stop (decision 183): while VAIC thinks or writes, Send turns into Stop; Stop or Esc drops the answer at once.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test("Stop drops VAIC's answer, keeps the message marked stopped, and Edit puts it back in the box", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  const box = page.getByRole("textbox", { name: "Message to VAIC" });
  await box.fill("write me fifty sentences about the sea");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  const stop = page.getByRole("button", { name: "Stop VAIC's answer" });
  await expect(stop).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to VAIC" })).toHaveCount(0);
  const sent = m.calls.find((c) => c.path === "/messages")!;
  const id = (sent.body as { client_id: string }).client_id;
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "The sea is wide. ",
    done: false,
    message_id: `owner-${id}`,
  });
  await expect(page.getByText("The sea is wide.")).toBeVisible();

  await stop.click();
  await expect.poll(() => m.calls.some((c) => c.path === `/messages/${id}/stop`)).toBe(true);
  await expect(page.getByText("The sea is wide.")).toHaveCount(0);
  await expect(page.getByText("Stopped.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send to VAIC" })).toBeVisible(); // ready straight away
  // Late pieces of the stopped answer never show.
  m.send({ type: "vaic.reply", conversation: "main", text: "It is deep.", done: true, message_id: `owner-${id}` });
  await page.waitForTimeout(300);
  await expect(page.getByText("It is deep.")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit and send again" }).click();
  await expect(box).toHaveValue("write me fifty sentences about the sea");
  await expect(page.getByText("Stopped.")).toHaveCount(0);
  await expect(box).toBeFocused();
});

test("Esc stops VAIC while it is thinking, and says what it had already handed on", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/vaic");
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("build me a landing page");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop VAIC's answer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => m.calls.some((c) => /^\/messages\/[\w-]+\/stop$/.test(c.path))).toBe(true);
  await expect(page.getByRole("button", { name: "Stop VAIC's answer" })).toHaveCount(0);
  const id = (m.calls.find((c) => c.path === "/messages")!.body as { client_id: string }).client_id;
  m.send({
    type: "vaic.stopped",
    conversation: "main",
    message_id: `owner-${id}`,
    tools: [{ activity: "delegating", detail: "delegate_to_orchestrator" }],
    done: true,
  });
  await expect(page.getByText(/VAIC had already done: Passing this to my team/)).toBeVisible();
  await expect(page.getByText(/keeps going; stop that job in Jobs/)).toBeVisible();
});

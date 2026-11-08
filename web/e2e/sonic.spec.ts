// AIC's real-time voice on Nova Sonic (decision 120): the signed address, the call, barge-in, the chat, and the
// step-by-step voice taking over when Sonic is not there. The runtime's WebSocket is mocked; nothing leaves.
import { expect, test } from "@playwright/test";
import { CONFIG, mockBackend } from "./mock.ts";

const SIGNED = "wss://bedrock-agentcore.eu-north-1.amazonaws.com/runtimes/arn/ws?X-Amz-Signature=abc";

// Two seconds of a quiet tone, as Sonic's 24 kHz 16-bit samples.
const tone = () => {
  const n = 48000;
  const bytes = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.round(Math.sin(i / 10) * 3000) & 0xffff;
    bytes[2 * i] = v & 0xff;
    bytes[2 * i + 1] = v >> 8;
  }
  return Buffer.from(bytes).toString("base64");
};

async function realtime(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    (window as unknown as { __aicSonic: boolean }).__aicSonic = true;
    // A silent microphone (headless Chromium has none).
    navigator.mediaDevices.getUserMedia = async () => new AudioContext().createMediaStreamDestination().stream;
  });
}

test("the voice button opens a real-time call: the owner's words reach the chat, AIC's answer is not read twice, talking over it stops it at once", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await realtime(page);
  let sessions = 0;
  await page.route(`${CONFIG.apiUrl}/voice/session`, (r) => {
    sessions++;
    return r.fulfill({ json: { url: SIGNED, expires_in: 300 } });
  });
  const fromBrowser: Array<{ type: string; data?: string }> = [];
  let say: (msg: Record<string, unknown>) => void = () => undefined;
  await page.routeWebSocket("wss://bedrock-agentcore.eu-north-1.amazonaws.com/**", (ws) => {
    say = (msg) => ws.send(JSON.stringify(msg));
    ws.onMessage((raw) => fromBrowser.push(JSON.parse(String(raw))));
    say({ type: "ready", model: "amazon.nova-2-sonic-v1:0", region: "eu-north-1" });
  });
  await page.goto("/");
  const strip = page.locator(".voice");
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  expect(sessions).toBe(1);
  // The microphone streams up as 16 kHz PCM frames.
  await expect.poll(() => fromBrowser.filter((f) => f.type === "audio").length).toBeGreaterThan(1);
  await expect(strip).toHaveAttribute("data-speaker", "you");

  say({ type: "transcript", role: "user", text: "what's the status?" });
  const chat = page.getByLabel("Conversation with AIC");
  await expect(chat.getByText("what's the status?")).toBeVisible();
  say({ type: "thinking", on: true, request: "what's the status of the city?" });
  await expect(strip).toHaveAttribute("data-speaker", "thinking");
  // Nothing went through /messages: Sonic hands the request to AIC on the runtime itself.
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(0);

  // AIC answers through the city's own channel, and Sonic says it.
  say({ type: "thinking", on: false });
  m.send({ type: "ace.reply", conversation: "main", text: "All quiet. Nothing needs you.", done: true });
  say({ type: "audio", data: tone() });
  await expect(strip).toHaveAttribute("data-speaker", "aic");
  await expect(chat.getByText("All quiet. Nothing needs you.")).toBeVisible();
  say({ type: "transcript", role: "assistant", text: "All quiet, nothing needs you.", aic: true });
  // The owner talks over it: the two seconds of speech stop at once.
  say({ type: "interrupted" });
  await expect(strip).toHaveAttribute("data-speaker", "you", { timeout: 300 });
  await page.waitForTimeout(400);
  await expect(strip).toHaveAttribute("data-speaker", "you");
  // Polly / OpenAI never read AIC's answer a second time; Sonic's own words for it are not added to the chat.
  expect(await page.evaluate(() => (window as unknown as { __spoken?: string[] }).__spoken ?? [])).toEqual([]);
  await expect(chat.getByText("All quiet, nothing needs you.")).toHaveCount(0);

  // Small talk Sonic answers itself shows in the chat.
  say({ type: "transcript", role: "assistant", text: "Sure, I'm here.", aic: false });
  await expect(chat.getByText("Sure, I'm here.")).toBeVisible();

  // A tap ends the call: the runtime is told to stop.
  await page.getByRole("button", { name: "End the voice conversation" }).click();
  await expect.poll(() => fromBrowser.at(-1)?.type).toBe("stop");
  await expect(strip).toHaveCount(0);
});

test("when the real-time voice is not set up, the step-by-step voice takes over", async ({ page }) => {
  const m = await mockBackend(page);
  await realtime(page);
  await page.addInitScript(() => ((window as unknown as { __heard: string }).__heard = "what's the status?"));
  await page.route(`${CONFIG.apiUrl}/voice/session`, (r) =>
    r.fulfill({ status: 503, json: { error: "not_configured", message: "Real-time voice is not set up." } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length).toBe(1);
  expect(m.calls.find((c) => c.path === "/messages")?.body).toMatchObject({ text: "what's the status?", voice: true });
});

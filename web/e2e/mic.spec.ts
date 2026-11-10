// The real browser voice path (not the fake voice): Chromium's fake microphone through getUserMedia, the
// AudioContext, the Transcribe SDK loaded on demand, then the identity pool, which this test answers itself.
// Nothing reaches AWS. What only a real browser and AWS can show is listed in docs/PRODUCT.md.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

// The identity pool refuses: the speech service is unusable, as when Transcribe refused the account.
const refuse = (page: import("@playwright/test").Page, count: () => void) =>
  page.route("https://cognito-identity.eu-north-1.amazonaws.com/**", (r) => {
    count();
    return r.fulfill({
      status: 400,
      contentType: "application/x-amz-json-1.1",
      headers: { "x-amzn-errortype": "NotAuthorizedException" },
      body: JSON.stringify({ __type: "NotAuthorizedException", message: "Your account isn't authorized." }),
    });
  });

// A fake browser recognizer: hears a partial, then the final words, then waits.
const fakeBrowserSpeech = () => {
  class FakeRec {
    lang = "";
    continuous = false;
    interimResults = false;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: (() => void) | null = null;
    start() {
      (window as unknown as { __recStarts: number }).__recStarts =
        ((window as unknown as { __recStarts?: number }).__recStarts ?? 0) + 1;
      const said = (t: string, isFinal: boolean) =>
        this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal })] });
      setTimeout(() => said("what's the", false), 100);
      setTimeout(() => said("what's the status", true), 250);
    }
    stop() {}
    abort() {}
  }
  const w = window as unknown as { webkitSpeechRecognition: unknown; SpeechRecognition: unknown };
  w.webkitSpeechRecognition = FakeRec; // Safari, older Chrome
  w.SpeechRecognition = FakeRec; // newer Chrome has the standard name too
};

test("the real mic path gets the microphone and audio running, and names the speech service's refusal", async ({
  page,
}) => {
  await mockBackend(page, { realVoice: true });
  // No browser recognition to fall back to: the plain message with the real cause.
  await page.addInitScript(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  });
  let identityCalls = 0;
  await refuse(page, () => identityCalls++);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/#/ace");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("NotAuthorizedException");
  expect(identityCalls).toBeGreaterThan(0); // mic, AudioContext and the SDK all worked up to the AWS call
  expect(errors.some((t) => t.includes("[VAIC voice]"))).toBe(true);
});

test("when the speech service refuses, the browser's own recognition takes over for the session", async ({ page }) => {
  const m = await mockBackend(page, { realVoice: true });
  await page.addInitScript(fakeBrowserSpeech);
  let identityCalls = 0;
  await refuse(page, () => identityCalls++);
  await page.goto("/#/ace");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click(); // Talk and send
  await expect(page.getByText("Using your browser's speech recognition.")).toBeVisible();
  await expect
    .poll(() => m.calls.find((c) => c.path === "/messages")?.body)
    .toMatchObject({ text: "what's the status" });
  expect(identityCalls).toBeGreaterThan(0); // Transcribe was tried first
  await expect(page.getByRole("alert")).toHaveCount(0); // no error shown

  // The rest of this session goes straight to the browser's recognition, without asking AWS again.
  const before = identityCalls;
  await page.getByRole("button", { name: "Dictate into the box" }).click();
  await expect(page.getByRole("textbox", { name: "Message to VAIC" })).toHaveValue("what's the status");
  expect(identityCalls).toBe(before);
  await page.getByRole("button", { name: "Stop dictating" }).click();

  // A new page load tries Transcribe again.
  await page.evaluate(() => sessionStorage.removeItem("aic.speech.engine")); // what closing the tab does
  await page.reload();
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => identityCalls).toBeGreaterThan(before);
});

test("a page opened before a deploy says to reload, instead of a generic mic failure", async ({ page }) => {
  await mockBackend(page, { realVoice: true });
  await page.goto("/#/ace");
  await expect(page.getByRole("button", { name: "Talk to VAIC", exact: true })).toBeVisible();
  await page.route("**/assets/**", (r) => r.fulfill({ status: 404, body: "gone" })); // the new deploy removed them
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("AI City was updated since this page opened. Reload the page");
});

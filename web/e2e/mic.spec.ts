// The real browser voice path (not the fake voice): Chromium's fake microphone through getUserMedia, the
// AudioContext, the Transcribe SDK loaded on demand, then the identity pool, which this test answers itself.
// Nothing reaches AWS. What only a real browser and AWS can show is listed in docs/PRODUCT.md.
import { expect, test } from "@playwright/test";
import { mockBackend } from "./mock.ts";

test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
});

test("the real mic path gets the microphone and audio running, and names the speech service's refusal", async ({
  page,
}) => {
  await mockBackend(page, { realVoice: true });
  let identityCalls = 0;
  await page.route("https://cognito-identity.eu-north-1.amazonaws.com/**", (r) => {
    identityCalls++;
    return r.fulfill({
      status: 400,
      contentType: "application/x-amz-json-1.1",
      headers: { "x-amzn-errortype": "NotAuthorizedException" },
      body: JSON.stringify({ __type: "NotAuthorizedException", message: "Invalid login token." }),
    });
  });
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("NotAuthorizedException");
  expect(identityCalls).toBeGreaterThan(0); // mic, AudioContext and the SDK all worked up to the AWS call
  expect(errors.some((t) => t.includes("[AIC voice]"))).toBe(true);
});

test("a page opened before a deploy says to reload, instead of a generic mic failure", async ({ page }) => {
  await mockBackend(page, { realVoice: true });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Talk to AIC", exact: true })).toBeVisible();
  await page.route("**/assets/**", (r) => r.fulfill({ status: 404, body: "gone" })); // the new deploy removed them
  await page.getByRole("button", { name: "Talk to AIC", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("AI City was updated since this page opened. Reload the page");
});

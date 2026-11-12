// Images in the chat, like Claude Code (decision 256): dropped images show as thumbnails in the box at once
// (no filename on them), other files as a chip; the sent bubble shows the thumbnails, a reload keeps them,
// and a thumbnail opens larger.
import { deflateSync, crc32 } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend, S3_URL } from "./mock.ts";

const SHOTS = process.env.SHOTS_DIR ?? `${import.meta.dirname}/../test-results/chat-images`;

/** A small PNG: a two-colour diagonal, so a thumbnail is plainly a picture. */
function png(w: number, h: number, a: [number, number, number], b: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows: number[] = [];
  for (let y = 0; y < h; y++) {
    rows.push(0);
    for (let x = 0; x < w; x++) rows.push(...(x + y < (w + h) / 2 ? a : b));
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.from(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
const RED_CAR = png(120, 80, [220, 60, 50], [40, 40, 60]);
const BLUE_SKY = png(80, 120, [70, 140, 230], [240, 200, 120]);

/** The bucket's signed downloads answer with the image itself (the shared mock answers with bytes as text). */
async function serveImages(page: Page) {
  await page.route(`${S3_URL}/raw/**`, (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.fallback();
    const name = decodeURIComponent(new URL(req.url()).pathname.split("/").pop()!);
    if (!name.endsWith(".png")) return route.fallback();
    return route.fulfill({
      status: 200,
      headers: { "content-type": "image/png", "access-control-allow-origin": "*" },
      body: name.startsWith("red") ? RED_CAR : BLUE_SKY,
    });
  });
}

async function dropFiles(page: Page) {
  const talk = page.getByRole("region", { name: "Chat with VAIC" });
  await talk.evaluate(
    (el, { car, sky }) => {
      const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes(car)], "red-car-A9A8BF3C-3DE2-49B0.png", { type: "image/png" }));
      dt.items.add(new File([bytes(sky)], "blue-sky.png", { type: "image/png" }));
      dt.items.add(new File(["%PDF-1.7"], "Quarterly brief for the board.pdf", { type: "application/pdf" }));
      el.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }));
      el.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    { car: RED_CAR.toString("base64"), sky: BLUE_SKY.toString("base64") },
  );
}

test("dropped images show as thumbnails, are sent as thumbnails, survive a reload and open larger", async ({
  page,
}) => {
  const m = await mockBackend(page);
  await serveImages(page);
  await page.goto("/#/vaic");
  await dropFiles(page);

  // In the box: two thumbnails drawn from the files themselves, and one chip for the PDF.
  const box = page.getByRole("list", { name: "Attached to your message" });
  const thumbs = box.locator(".att-thumb");
  await expect(thumbs).toHaveCount(2);
  await expect(box.locator(".chip")).toHaveCount(1);
  await expect(box.locator(".chip")).toContainText("Quarterly brief");
  for (const t of await thumbs.all()) {
    const img = t.locator("img");
    await expect(img).toHaveAttribute("src", /^blob:/); // the local file, before the upload is done
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    // No filename (and no "Reading the image") on a thumbnail; only the hidden status line for screen readers.
    const shown = await t.evaluate((el) => {
      const c = el.cloneNode(true) as HTMLElement;
      c.querySelectorAll(".sr").forEach((x) => x.remove());
      return (c.textContent ?? "").replace(/[×!\s]/g, "");
    });
    expect(shown).toBe("");
  }
  await expect(thumbs.first().locator("img")).toHaveAttribute("alt", "red-car-A9A8BF3C-3DE2-49B0.png");
  // The × shows on focus and removes the image.
  await expect.poll(() => m.knowledge.puts.length).toBe(3);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/box.png` });

  const box2 = page.getByRole("textbox", { name: "Message to VAIC" });
  await box2.fill("Is this a good car?");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  const sent = m.calls.find((c) => c.path === "/messages")!;
  expect((sent.body as { text: string }).text).toContain("Attached (now in my knowledge base)"); // VAIC still knows

  // The bubble: two thumbnails above the words, the PDF as a chip, and no "Attached …" line.
  const bubble = page.locator(".msg-owner").last();
  await expect(bubble.getByRole("button", { name: /red-car|blue-sky/ })).toHaveCount(2);
  await expect(bubble).toContainText("Is this a good car?");
  await expect(bubble).toContainText("Quarterly brief");
  await expect(bubble).not.toContainText("Attached (now in my knowledge base)");
  await expect(bubble).not.toContainText("red-car");
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/sent.png` });

  // A reload: the same message keeps its thumbnails, now from the knowledge items' signed addresses.
  await page.reload();
  const again = page.locator(".msg-owner").filter({ hasText: "Is this a good car?" });
  const imgs = again.locator(".sent-thumb img");
  await expect(imgs).toHaveCount(2);
  await expect(imgs.first()).toHaveAttribute("src", new RegExp(`^${S3_URL}/raw/`));
  for (const i of await imgs.all())
    await expect.poll(() => i.evaluate((x: HTMLImageElement) => x.naturalWidth)).toBeGreaterThan(0);

  // The lightbox: opens on a click, Esc closes it and focus returns to the thumbnail.
  const first = again.getByRole("button", { name: "red-car-A9A8BF3C-3DE2-49B0.png" });
  await first.click();
  const dialog = page.getByRole("dialog", { name: "red-car-A9A8BF3C-3DE2-49B0.png" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/lightbox.png` });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(first).toBeFocused();
  // The keyboard opens it too, and the × closes it.
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
});

test("removing a thumbnail from the box takes the image off the message", async ({ page }) => {
  const m = await mockBackend(page);
  await serveImages(page);
  await page.goto("/#/vaic");
  await dropFiles(page);
  const box = page.getByRole("list", { name: "Attached to your message" });
  await expect(box.locator(".att-thumb")).toHaveCount(2);
  const remove = page.getByRole("button", { name: "Remove blue-sky.png" });
  await remove.focus();
  await expect(remove).toHaveCSS("opacity", "1"); // shown on keyboard focus
  await remove.click();
  await expect(box.locator(".att-thumb")).toHaveCount(1);
  await expect.poll(() => m.calls.some((c) => c.method === "DELETE" && c.path.startsWith("/knowledge/"))).toBe(true);
});

test("on a phone the thumbnails fit the box and the bubble", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const m = await mockBackend(page);
  await serveImages(page);
  await page.goto("/#/vaic");
  await dropFiles(page);
  const box = page.getByRole("list", { name: "Attached to your message" });
  await expect(box.locator(".att-thumb")).toHaveCount(2);
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(390);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/phone-box.png` });
  await expect.poll(() => m.knowledge.puts.length).toBe(3);
  await page.getByRole("textbox", { name: "Message to VAIC" }).fill("This one");
  await page.getByRole("button", { name: "Send to VAIC" }).click();
  await expect(page.locator(".msg-owner .sent-thumb")).toHaveCount(2);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/phone-sent.png` });
  // The light theme: the same glass, readable.
  await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/phone-sent-light.png` });
});

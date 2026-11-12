// Files (docs/FILES.md): the owner uploads a photo, a video and a PDF; each is described; search finds the photo by
// what is in it; the viewer previews, renames and has Download; VAIC shows a found file in the chat with a preview and
// Download, and two files numbered when it asks which. Screenshots for docs/screenshots.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mockBackend, PNG_1PX } from "./mock.ts";

const SHOTS = `${import.meta.dirname}/../../docs/screenshots`;
async function noSeriousA11y(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${label}: ${v.id} — ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("files: upload anything, find it by what's in it, preview, rename, download", async ({ page }) => {
  const m = await mockBackend(page);
  await page.goto("/#/files");
  await expect(page.getByRole("heading", { name: "Files" })).toBeVisible();
  await expect(page.getByText("Nothing here yet.")).toBeVisible();

  await page.locator(".files-drop input[type=file]").setInputFiles([
    { name: "IMG_sunrise.jpg", mimeType: "image/jpeg", buffer: PNG_1PX },
    { name: "barn.mov", mimeType: "video/quicktime", buffer: Buffer.from("not really a video") },
    { name: "Acme invoice.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") },
  ]);
  await expect.poll(() => m.files.puts.length).toBe(3);
  const grid = page.getByRole("list", { name: "Your files" });
  await expect(grid.getByRole("button", { name: "Open IMG_sunrise.jpg" })).toBeVisible();
  // A photo shows frosted glass over a blurred copy while it uploads, then comes into focus; the count counts it.
  const photo = grid.getByRole("button", { name: "Open IMG_sunrise.jpg" }).locator(".thumb-glass");
  await expect(page.getByText("3 files", { exact: true })).toBeVisible();
  await expect(grid.locator(".thumb-glass")).toHaveCount(1); // only the photo; the PDF keeps its icon
  await expect(grid.getByRole("status")).toHaveCount(0, { timeout: 10_000 }); // every file described, no status left
  await expect(photo).toHaveAttribute("data-state", "shown", { timeout: 10_000 });
  await noSeriousA11y(page, "files");
  await page.screenshot({ path: `${SHOTS}/files.png` });

  // Search by meaning: the photo is found by what the caption says, not its name.
  await page.getByRole("searchbox").fill("porsche at sunrise");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("1 file matches “porsche at sunrise”")).toBeVisible();
  await expect(grid.getByRole("button", { name: /^Open / })).toHaveCount(1);

  // Open it: a preview, what it is, Download, and rename.
  await grid.getByRole("button", { name: "Open IMG_sunrise.jpg" }).click();
  const dialog = page.getByRole("dialog", { name: "IMG_sunrise.jpg" });
  await expect(dialog.getByRole("img")).toBeVisible();
  await expect(dialog).toContainText("black Porsche 911");
  await expect(dialog.getByRole("link", { name: "Download" })).toHaveAttribute("href", /attachment/);
  await noSeriousA11y(page, "file viewer");
  await page.screenshot({ path: `${SHOTS}/files-viewer.png` });
  await dialog.getByLabel("Name").fill("Sunrise thumbnail.jpg");
  await dialog.getByLabel("Folder").fill("Thumbnails/2026");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect.poll(() => m.calls.some((c) => c.method === "PUT" && c.path.startsWith("/files/f-"))).toBe(true);
  expect(m.calls.find((c) => c.method === "PUT" && c.path.startsWith("/files/f-"))?.body).toEqual({
    name: "Sunrise thumbnail.jpg",
    folder: "Thumbnails/2026",
  });
  await expect(page.getByRole("heading", { name: "Sunrise thumbnail.jpg" })).toBeVisible();
});

test("VAIC shows a file it found in the chat, with a preview and Download; several are numbered", async ({ page }) => {
  const m = await mockBackend(page);
  m.files.items.push(
    {
      id: "f-aaaaaaaaaaaa",
      name: "IMG_sunrise.jpg",
      kind: "image",
      content_type: "image/jpeg",
      size_bytes: 2_400_000,
      folder: "Thumbnails",
      tags: [],
      status: "ready",
      added_by: "owner",
      taken_at: "2026-04-12T06:10:00Z",
      created_at: "2026-04-12T08:00:00Z",
      description: "A sunrise over the sea with a black Porsche 911 in front.",
    },
    {
      id: "f-bbbbbbbbbbbb",
      name: "Launch thumbnail.png",
      kind: "image",
      content_type: "image/png",
      size_bytes: 900_000,
      folder: "Departments/Media",
      tags: [],
      status: "ready",
      added_by: "wkr-media-1",
      department: "Media",
      created_at: "2026-05-02T08:00:00Z",
    },
  );
  await page.goto("/#/vaic");
  await page
    .getByRole("textbox", { name: /message/i })
    .fill("find the sunrise photo with the porsche from last spring");
  await page.getByRole("textbox", { name: /message/i }).press("Enter");
  m.send({
    type: "vaic.files",
    conversation: "main",
    files: [
      {
        id: "f-aaaaaaaaaaaa",
        name: "IMG_sunrise.jpg",
        kind: "image",
        size_bytes: 2_400_000,
        taken_at: "2026-04-12T06:10:00Z",
      },
    ],
  });
  m.send({
    type: "vaic.reply",
    conversation: "main",
    text: "Here it is, Sir: the sunrise with the black 911, from April.",
    done: true,
  });
  const chat = page.locator("main");
  const card = chat.getByRole("list", { name: "Files VAIC found" });
  await expect(card.getByRole("link", { name: "Download" })).toHaveAttribute("href", /f-aaaaaaaaaaaa.*attachment/);
  await expect(card.getByRole("img")).toBeVisible();
  await noSeriousA11y(page, "file in the chat");
  await page.screenshot({ path: `${SHOTS}/ace-file.png` });

  await page.getByRole("textbox", { name: /message/i }).fill("show me the thumbnails");
  await page.getByRole("textbox", { name: /message/i }).press("Enter");
  m.send({
    type: "vaic.files",
    conversation: "main",
    ask: true,
    files: [
      { id: "f-aaaaaaaaaaaa", name: "IMG_sunrise.jpg", kind: "image" },
      { id: "f-bbbbbbbbbbbb", name: "Launch thumbnail.png", kind: "image", department: "Media" },
    ],
  });
  m.send({ type: "vaic.reply", conversation: "main", text: "Two fit, Sir. The first or the second?", done: true });
  const many = chat.getByRole("list", { name: "Files VAIC found" }).last();
  await expect(many.getByRole("link", { name: "Download" })).toHaveCount(2);
  await expect(many).toContainText("Media");
});

test("storage by hand: open folders, go back up, scroll a long list, sort, list or grid, search names and folders", async ({
  page,
}) => {
  const m = await mockBackend(page);
  const file = (n: number, folder: string, name = `photo-${String(n).padStart(3, "0")}.jpg`) => ({
    id: `f-seed${String(n).padStart(8, "0")}`,
    name,
    kind: "image",
    content_type: "image/jpeg",
    size_bytes: 1000 + n,
    folder,
    tags: [],
    status: "ready",
    added_by: "owner",
    created_at: new Date(Date.UTC(2026, 0, 1) + n * 3_600_000).toISOString(),
    description: "",
  });
  for (let n = 1; n <= 75; n++) m.files.items.push(file(n, "Shoots/2026"));
  m.files.items.push(file(100, "Brand", "logo.svg"), file(101, "", "notes.txt"));
  m.files.items.push({ ...file(102, "Brand/Guides", "React best practices.pdf"), kind: "document" });

  await page.goto("/#/files");
  const folders = page.getByRole("list", { name: "Folders" });
  await expect(folders.getByRole("button", { name: /Brand/ })).toContainText("2 files");
  await expect(folders.getByRole("button", { name: /Shoots/ })).toContainText("75 files");
  await expect(page.getByRole("list", { name: "Your files" }).getByRole("button", { name: /^Open / })).toHaveCount(1); // notes.txt

  // Into Shoots, then 2026: 60 files, the rest load as the end scrolls into view.
  await folders.getByRole("button", { name: /Shoots/ }).click();
  await page.getByRole("list", { name: "Folders" }).getByRole("button", { name: /2026/ }).click();
  const crumbs = page.getByRole("navigation", { name: "Where you are" });
  await expect(crumbs.getByRole("listitem")).toHaveText(["Files", "Shoots", "2026"]);
  const files = page.getByRole("list", { name: "Your files" });
  await expect(files.getByRole("button", { name: /^Open / })).toHaveCount(60);
  await expect(page.getByText("75 files in “Shoots/2026”")).toBeVisible();
  await page.mouse.wheel(0, 20_000);
  await expect(files.getByRole("button", { name: /^Open / })).toHaveCount(75);
  await expect(page.getByRole("button", { name: /Show more/ })).toHaveCount(0);

  // Sort by name, as a list.
  await page.getByRole("group", { name: "Show as" }).getByRole("button", { name: "List" }).click();
  await page.getByLabel("Sort").click();
  await page.getByRole("option", { name: "Name Z–A" }).click();
  await expect(files.getByRole("button", { name: /^Open / }).first()).toHaveAccessibleName("Open photo-075.jpg");
  await noSeriousA11y(page, "files list");
  await page.screenshot({ path: `${SHOTS}/files-browse.png` });

  // Back up with the breadcrumbs, then search names and folders everywhere.
  await crumbs.getByRole("button", { name: "Files" }).click();
  await expect(crumbs).toContainText("Files");
  await page.getByRole("searchbox").fill("guides");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const found = page.getByRole("list", { name: "Folders that match" });
  await expect(found.getByRole("button", { name: /Brand\/Guides/ })).toBeVisible();
  await page.getByRole("searchbox").fill("react");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(files.getByRole("button", { name: "Open React best practices.pdf" })).toContainText("in Brand/Guides");
  await files.getByRole("button", { name: "Open React best practices.pdf" }).click();
  await expect(page.getByRole("dialog", { name: "React best practices.pdf" })).toBeVisible();
});

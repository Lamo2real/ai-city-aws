// Up to 10 images per chat message (decision 214); other files are never capped here.
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeItem } from "../src/lib/api.ts";
import { ONLY_FILES, attachedLine, bubbleText, isImageItem, sentAttachments, splitAttachments } from "../src/lib/attach.ts";
import { shortName } from "../src/components/ChatAttachments.tsx";
import { MAX_CHAT_IMAGES, capImages } from "../src/lib/knowledge.ts";

const f = (name: string, type: string) => new File(["x"], name, { type });
const imgs = (n: number) => Array.from({ length: n }, (_, i) => f(`p${i}.png`, "image/png"));

describe("capImages", () => {
  it("keeps up to 10 images and every other file", () => {
    const r = capImages([...imgs(12), f("a.pdf", "application/pdf")], 0);
    expect(MAX_CHAT_IMAGES).toBe(10);
    expect(r.files.filter((x) => x.type === "image/png")).toHaveLength(10);
    expect(r.files.some((x) => x.name === "a.pdf")).toBe(true);
    expect(r.left).toBe(2);
  });
  it("counts the images already attached", () => {
    expect(capImages(imgs(5), 7)).toMatchObject({ left: 2 });
    expect(capImages(imgs(3), 10).files).toHaveLength(0);
    expect(capImages(imgs(3), 0)).toMatchObject({ left: 0 });
  });
});

// ---------- thumbnails in the box and in the sent bubble (decision 256) ----------

const item = (id: string, title: string, kind: KnowledgeItem["kind"], content_type?: string): KnowledgeItem => ({
  id,
  title,
  kind,
  scope: "relevant",
  status: "ready",
  ...(content_type ? { content_type } : {}),
});

describe("the chat's attachment model", () => {
  const car = item("k-1", "car.jpg", "image", "image/jpeg");
  const shot = item("k-2", "shot.png", "other", "image/png"); // kind not known yet, type says image
  const pdf = item("k-3", "brief.pdf", "document", "application/pdf");

  it("knows an image by its kind or its content type", () => {
    expect([car, shot, pdf].map(isImageItem)).toEqual([true, true, false]);
  });
  it("keeps what a sent message needs to draw its attachments again", () => {
    expect(sentAttachments([car, pdf, shot])).toEqual([
      { id: "k-1", title: "car.jpg", image: true },
      { id: "k-3", title: "brief.pdf", image: false },
      { id: "k-2", title: "shot.png", image: true },
    ]);
  });
  it("splits images from other files, each in order", () => {
    const { images, others } = splitAttachments(sentAttachments([car, pdf, shot]));
    expect(images.map((x) => x.id)).toEqual(["k-1", "k-2"]);
    expect(others.map((x) => x.id)).toEqual(["k-3"]);
  });
  it("shows the owner's words without the line written for VAIC", () => {
    const sent = sentAttachments([car, pdf]);
    const body = `Is this a good car?\n\n${attachedLine([car, pdf])}`;
    expect(bubbleText(body, sent)).toBe("Is this a good car?");
    expect(bubbleText(`${ONLY_FILES}\n\n${attachedLine([car])}`, sent)).toBe("");
    // A message with no attachments is shown as it was written, even one that mentions the words.
    expect(bubbleText(body, undefined)).toBe(body);
    expect(bubbleText(ONLY_FILES, [])).toBe(ONLY_FILES);
  });
  it("shortens a long file name for a chip, keeping its extension", () => {
    expect(shortName("brief.pdf")).toBe("brief.pdf");
    const s = shortName("A9A8BF3C-3DE2-49B0-B7CD-69F0123456.pdf");
    expect(s.length).toBe(22);
    expect(s.endsWith("….pdf")).toBe(true);
  });
});

describe("where a thumbnail's picture comes from", () => {
  it("uses the local file at once, then a signed address that is read again before it expires", async () => {
    vi.resetModules();
    const download = vi.fn(async (id: string) => ({ url: `https://s3/${id}?sig`, file_name: "x", expires_in: 900 }));
    vi.doMock("../src/lib/api.ts", () => ({ knowledgeApi: { download } }));
    const created: string[] = [];
    URL.createObjectURL = vi.fn(() => {
      created.push("blob:1");
      return "blob:1";
    });
    URL.revokeObjectURL = vi.fn();
    const m = await import("../src/lib/chatImages.ts");
    m.keepLocal("k-1", new File(["x"], "car.jpg", { type: "image/jpeg" }));
    m.keepLocal("k-9", new File(["x"], "brief.pdf", { type: "application/pdf" })); // not an image: no preview
    expect(await m.imageUrl("k-1")).toBe("blob:1");
    expect(m.localImage("k-9")).toBeUndefined();
    expect(download).not.toHaveBeenCalled();
    m.forgetLocal("k-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    // After a reload (no local file): the knowledge item's download address, read once and reused.
    expect(await m.imageUrl("k-1")).toBe("https://s3/k-1?sig");
    expect(await m.imageUrl("k-1")).toBe("https://s3/k-1?sig");
    expect(download).toHaveBeenCalledTimes(1);
    await m.imageUrl("k-1", Date.now() + 900_000); // expired: read again
    expect(download).toHaveBeenCalledTimes(2);
    vi.doUnmock("../src/lib/api.ts");
  });
});

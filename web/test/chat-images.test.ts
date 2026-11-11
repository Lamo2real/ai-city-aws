// Up to 10 images per chat message (decision 214); other files are never capped here.
import { describe, expect, it } from "vitest";
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

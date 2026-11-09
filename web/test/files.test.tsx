// Files (docs/FILES.md): the screen's reducer, uploads straight to S3 (single and multipart), the chat's file
// cards (preview + Download, fresh addresses) and VAIC's `ace.files` event landing on its reply.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as filesLib from "../src/lib/files.ts";
import {
  fileStatusWords,
  initialFiles,
  reduceFiles,
  sizeWords,
  uploadToFiles,
  type StoredFile,
} from "../src/lib/files.ts";
import type { PutFn } from "../src/lib/upload.ts";
import { store } from "../src/lib/store.ts";
import { FileCards } from "../src/components/FileCards.tsx";
import { FilePreview } from "../src/components/Files.tsx";

const file = (over: Partial<StoredFile> = {}): StoredFile => ({
  id: "f-aaaaaaaaaaaa",
  name: "IMG_0042.jpg",
  kind: "image",
  content_type: "image/jpeg",
  size_bytes: 2_400_000,
  folder: "",
  tags: [],
  status: "ready",
  created_at: "2026-04-12T08:00:00Z",
  added_by: "owner",
  ...over,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the files reducer", () => {
  it("loads, adds on top, follows files.updated and forgets deleted files", () => {
    let s = reduceFiles(initialFiles(), { type: "loaded", files: [file()], folders: [], departments: [] });
    s = reduceFiles(s, { type: "upsert", file: file({ id: "f-bbbbbbbbbbbb", status: "uploading", folder: "Brand" }) });
    expect(s.files.map((f) => f.id)).toEqual(["f-bbbbbbbbbbbb", "f-aaaaaaaaaaaa"]);
    expect(s.folders).toEqual(["Brand"]);
    s = reduceFiles(s, { type: "progress", id: "f-bbbbbbbbbbbb", percent: 40 });
    s = reduceFiles(s, { type: "files.updated", id: "f-bbbbbbbbbbbb", status: "processing" });
    expect(s.progress["f-bbbbbbbbbbbb"]).toBeUndefined();
    expect(s.files[0]!.status).toBe("processing");
    s = reduceFiles(s, { type: "files.updated", id: "f-bbbbbbbbbbbb", status: "deleted" });
    expect(s.files.map((f) => f.id)).toEqual(["f-aaaaaaaaaaaa"]);
  });

  it("says what is happening in plain words, every error in full", () => {
    expect(fileStatusWords(file({ status: "uploading" }), 40)).toBe("Uploading 40 %");
    expect(fileStatusWords(file({ status: "processing", kind: "video" }))).toBe("Watching and listening");
    expect(fileStatusWords(file({ status: "failed", error: "Bedrock is busy (ThrottlingException)" }))).toContain(
      "ThrottlingException",
    );
    expect(sizeWords(2_400_000)).toBe("2.3 MB");
  });
});

describe("uploads go straight to S3", () => {
  it("one PUT for a small file, with the date the device gives", async () => {
    const start = vi.fn(async () => ({
      file: file({ status: "uploading" }),
      upload: { method: "PUT" as const, url: "https://s3/put", headers: { "content-type": "image/jpeg" } },
    }));
    const put: PutFn = vi.fn(async () => '"etag"');
    const f = new File([new Uint8Array(10)], "IMG_0042.jpg", { type: "image/jpeg", lastModified: 1775980800000 });
    const got = await uploadToFiles(f, { start, put, folder: "Thumbnails" });
    expect(got.id).toBe("f-aaaaaaaaaaaa");
    expect(start).toHaveBeenCalledWith({
      file_name: "IMG_0042.jpg",
      content_type: "image/jpeg",
      size_bytes: 10,
      folder: "Thumbnails",
      taken_at: 1775980800000,
    });
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("parts in parallel for a large one, then complete with the ETags", async () => {
    const start = vi.fn(async () => ({
      file: file({ status: "uploading" }),
      upload: { multipart: true as const, upload_id: "u1", part_size: 4, part_urls: ["p1", "p2", "p3"] },
    }));
    const put: PutFn = vi.fn(async (url: string) => `"${url}"`);
    const complete = vi.fn(async () => ({ file: file({ status: "processing" }) }));
    await uploadToFiles(new File([new Uint8Array(10)], "film.mov"), { start, put, complete });
    expect(complete).toHaveBeenCalledWith("f-aaaaaaaaaaaa", {
      upload_id: "u1",
      parts: [
        { part_number: 1, etag: '"p1"' },
        { part_number: 2, etag: '"p2"' },
        { part_number: 3, etag: '"p3"' },
      ],
    });
  });

  it("a stopped upload says why", async () => {
    const start = vi.fn(async () => ({
      file: file({ status: "uploading" }),
      upload: { method: "PUT" as const, url: "u", headers: {} },
    }));
    const put: PutFn = async () => {
      throw new Error("storage answered 403");
    };
    await expect(uploadToFiles(new File(["x"], "a.png"), { start, put, retryDelayMs: 0 })).rejects.toThrow(
      /storage answered 403/,
    );
  });
});

describe("files in the chat", () => {
  it("an image shows itself with a Download button, from fresh addresses", async () => {
    vi.spyOn(filesLib, "withLinks").mockResolvedValue(
      file({ url: "https://files/img?inline", download_url: "https://files/img?attachment", thumb_url: "https://t" }),
    );
    render(
      <FileCards files={[{ id: "f-aaaaaaaaaaaa", name: "IMG_0042.jpg", kind: "image", size_bytes: 2_400_000 }]} />,
    );
    const dl = await screen.findByRole("link", { name: "Download" });
    expect(dl.getAttribute("href")).toBe("https://files/img?attachment");
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://t");
  });

  it("several files are numbered so the owner can say which", async () => {
    vi.spyOn(filesLib, "withLinks").mockImplementation(async (id) => file({ id, url: "u", download_url: "d" }));
    render(
      <FileCards
        files={[
          { id: "f-aaaaaaaaaaaa", name: "a.jpg", kind: "image" },
          { id: "f-bbbbbbbbbbbb", name: "b.jpg", kind: "image" },
        ]}
      />,
    );
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(2));
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("a deleted file says so", async () => {
    vi.spyOn(filesLib, "withLinks").mockRejectedValue(Object.assign(new Error("gone"), { status: 404 }));
    render(<FileCards files={[{ id: "f-aaaaaaaaaaaa", name: "a.jpg", kind: "image" }]} />);
    expect(await screen.findByText("This file was deleted.")).toBeTruthy();
  });

  it("previews: a player for video, the first page for a PDF, a card for the rest", () => {
    const { container, rerender } = render(<FilePreview file={file({ kind: "video", url: "v", name: "a.mov" })} />);
    expect(container.querySelector("video")?.getAttribute("src")).toBe("v");
    rerender(
      <FilePreview file={file({ kind: "document", content_type: "application/pdf", url: "p", name: "x.pdf" })} />,
    );
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe("p#page=1&view=FitH&toolbar=0");
    rerender(
      <FilePreview file={file({ kind: "other", url: "z", name: "kit.zip", content_type: "application/zip" })} />,
    );
    expect(screen.getByText(/no preview, download it to open/)).toBeTruthy();
  });

  it("VAIC's ace.files lands on its reply, even when it comes before the first words", () => {
    store.set({ chat: [], turn: null });
    store.beginTurn();
    store.event({
      type: "ace.files",
      conversation: "main",
      files: [{ id: "f-aaaaaaaaaaaa", name: "a.jpg", kind: "image" }],
    });
    store.event({ type: "ace.reply", conversation: "main", text: "Here it is, Sir.", done: true });
    const line = store.get().chat.at(-1)!;
    expect(line.text).toBe("Here it is, Sir.");
    expect(line.files?.map((f) => f.id)).toEqual(["f-aaaaaaaaaaaa"]);
    // A project's own chat is not the main chat.
    store.event({
      type: "ace.files",
      conversation: "app-x",
      files: [{ id: "f-bbbbbbbbbbbb", name: "b", kind: "other" }],
    });
    expect(store.get().chat.at(-1)!.files).toHaveLength(1);
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { knowledgeApi, type KnowledgeItem } from "../src/lib/api.ts";
import {
  initialKnowledge,
  knowledge,
  reduceKnowledge,
  scheduleDelete,
  titleFrom,
  isLink,
} from "../src/lib/knowledge.ts";
import { uploadFile, UploadError, type PutFn } from "../src/lib/upload.ts";
import { KnowledgeScreen, statusWords } from "../src/components/Knowledge.tsx";
import { Toaster } from "../src/components/ui.tsx";

const item = (over: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  id: "k-1",
  kind: "document",
  title: "Lease.pdf",
  scope: "relevant",
  status: "ready",
  ...over,
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the knowledge reducer", () => {
  it("loads the list and the always-include budget", () => {
    const s = reduceKnowledge(initialKnowledge(), {
      type: "loaded",
      items: [item()],
      always_tokens: 3200,
      always_budget: 8000,
    });
    expect(s.loaded).toBe(true);
    expect(s.items).toHaveLength(1);
    expect([s.alwaysTokens, s.alwaysBudget]).toEqual([3200, 8000]);
  });

  it("adds a new item on top and merges a known one", () => {
    let s = reduceKnowledge(initialKnowledge(), { type: "upsert", item: item() });
    s = reduceKnowledge(s, { type: "upsert", item: item({ id: "k-2", title: "Song.mp3", kind: "audio" }) });
    expect(s.items.map((x) => x.id)).toEqual(["k-2", "k-1"]);
    s = reduceKnowledge(s, { type: "upsert", item: item({ scope: "always" }) });
    expect(s.items.find((x) => x.id === "k-1")?.scope).toBe("always");
    expect(s.items).toHaveLength(2);
  });

  it("applies knowledge.updated events, keeps the error only when failed, and adds items it did not know", () => {
    let s = reduceKnowledge(initialKnowledge(), { type: "upsert", item: item({ status: "uploading" }) });
    s = reduceKnowledge(s, { type: "progress", id: "k-1", percent: 40 });
    expect(s.progress["k-1"]).toBe(40);
    const ev = {
      type: "knowledge.updated",
      id: "k-1",
      title: "Lease.pdf",
      scope: "relevant",
      kind: "document",
    } as const;
    s = reduceKnowledge(s, { ...ev, status: "processing" });
    expect(s.items[0]!.status).toBe("processing");
    expect(s.progress["k-1"]).toBeUndefined(); // the upload is over
    s = reduceKnowledge(s, { ...ev, status: "failed", error: "The PDF is locked with a password." });
    expect(s.items[0]!.error).toBe("The PDF is locked with a password.");
    s = reduceKnowledge(s, { ...ev, status: "ready", error: "stale" });
    expect(s.items[0]!.error).toBeNull();
    s = reduceKnowledge(s, { ...ev, id: "k-9", title: "From VAIC", kind: "link", status: "processing" });
    expect(s.items[0]!.id).toBe("k-9");
  });

  it("hides, unhides and removes for Delete with Undo", () => {
    let s = reduceKnowledge(initialKnowledge(), { type: "upsert", item: item() });
    s = reduceKnowledge(s, { type: "hide", id: "k-1" });
    expect(s.hidden).toEqual(["k-1"]);
    s = reduceKnowledge(s, { type: "unhide", id: "k-1" });
    expect(s.hidden).toEqual([]);
    s = reduceKnowledge(s, { type: "hide", id: "k-1" });
    s = reduceKnowledge(s, { type: "removed", id: "k-1" });
    expect([s.items, s.hidden]).toEqual([[], []]);
  });

  it("keeps an upload this browser started when a list read before it arrives", () => {
    let s = reduceKnowledge(initialKnowledge(), { type: "upsert", item: item({ id: "k-new", status: "uploading" }) });
    s = reduceKnowledge(s, { type: "progress", id: "k-new", percent: 10 });
    s = reduceKnowledge(s, { type: "loaded", items: [item()], always_tokens: 0, always_budget: 8000 });
    expect(s.items.map((x) => x.id)).toEqual(["k-new", "k-1"]);
    expect(s.progress["k-new"]).toBe(10);
  });

  it("tells links from text and titles text by its first line", () => {
    expect(isLink("https://example.com/a?b=1")).toBe(true);
    expect(isLink("see https://example.com")).toBe(false);
    expect(titleFrom("  Shopping list\nmilk\neggs")).toBe("Shopping list");
    expect(titleFrom("x".repeat(100))).toHaveLength(78);
  });
});

describe("status words", () => {
  it("says what is happening in plain words", () => {
    expect(statusWords(item({ status: "uploading" }), 40)).toBe("Uploading 40 %");
    expect(statusWords(item({ status: "processing", kind: "video" }))).toBe("Transcribing");
    expect(statusWords(item({ status: "processing", kind: "image" }))).toBe("Reading the image");
    expect(statusWords(item())).toBe("Ready");
    expect(statusWords(item({ status: "failed", error: "The PDF is locked." }))).toBe("Failed: The PDF is locked.");
    expect(statusWords(item({ status: "unsupported", kind: "other" }))).toBe("Can't be searched yet");
    expect(statusWords(item({ status: "uploading" }), 10, "The upload stopped.")).toBe("Failed: The upload stopped.");
  });
});

describe("the upload helper", () => {
  const file = (bytes: number, name = "talk.mp4") => new File([new Uint8Array(bytes)], name, { type: "video/mp4" });

  it("uses one presigned PUT for a small file and reports progress up to 100 %", async () => {
    const start = vi.fn(async () => ({
      item: item({ id: "k-s", status: "uploading" }),
      upload: { method: "PUT" as const, url: "https://s3/one", headers: { "content-type": "video/mp4" } },
    }));
    const put = vi.fn<PutFn>(async (_u, body, _h, on) => {
      on(body.size / 2);
      return '"e1"';
    });
    const progress: number[] = [];
    const created = vi.fn();
    const done = await uploadFile(file(1000), { start, put, onProgress: (p) => progress.push(p), onCreated: created });
    expect(done.id).toBe("k-s");
    expect(start).toHaveBeenCalledWith({ file_name: "talk.mp4", content_type: "video/mp4", size_bytes: 1000 });
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: "k-s" }));
    expect(put).toHaveBeenCalledWith(
      "https://s3/one",
      expect.any(File),
      { "content-type": "video/mp4" },
      expect.any(Function),
    );
    expect(progress).toEqual([50, 100]);
  });

  it("uploads parts in parallel, retries a failed part and completes with the ETags in order", async () => {
    const start = vi.fn(async () => ({
      item: item({ id: "k-m", status: "uploading" }),
      upload: { multipart: true as const, upload_id: "up-1", part_size: 400, part_urls: ["p1", "p2", "p3"] },
    }));
    let inFlight = 0;
    let most = 0;
    let failedOnce = false;
    const sizes: Record<string, number> = {};
    const put = vi.fn<PutFn>(async (url, body, _h, on) => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      if (url === "p2" && !failedOnce) {
        failedOnce = true;
        on(100);
        throw new Error("network");
      }
      sizes[url] = body.size;
      on(body.size);
      return `"etag-${url}"`;
    });
    const complete = vi.fn(async () => ({ item: item({ id: "k-m", status: "processing" }) }));
    const progress: number[] = [];
    const done = await uploadFile(file(1000), {
      start,
      put,
      complete,
      retryDelayMs: 0,
      concurrency: 3,
      onProgress: (p) => progress.push(p),
    });
    expect(done.status).toBe("processing");
    expect(put).toHaveBeenCalledTimes(4); // part 2 twice
    expect(most).toBe(3);
    expect(sizes).toEqual({ p1: 400, p2: 400, p3: 200 });
    expect(complete).toHaveBeenCalledWith("k-m", {
      upload_id: "up-1",
      parts: [
        { part_number: 1, etag: '"etag-p1"' },
        { part_number: 2, etag: '"etag-p2"' },
        { part_number: 3, etag: '"etag-p3"' },
      ],
    });
    expect(progress.at(-1)).toBe(100);
  });

  it("gives up after the retries with a plain sentence and the created item", async () => {
    const start = vi.fn(async () => ({
      item: item({ id: "k-f", status: "uploading" }),
      upload: { method: "PUT" as const, url: "u", headers: {} },
    }));
    const put = vi.fn<PutFn>(async () => {
      throw new Error("network");
    });
    const e = await uploadFile(file(10, "a.pdf"), { start, put, retries: 2, retryDelayMs: 0 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(UploadError);
    expect((e as UploadError).item?.id).toBe("k-f");
    expect((e as UploadError).message).toMatch(/upload of “a.pdf” did not finish/);
    expect(put).toHaveBeenCalledTimes(3);
  });
});

describe("the Knowledge screen", () => {
  beforeEach(() => {
    knowledge.state = initialKnowledge();
  });

  it("shows the list, the budget, the scope choice and live status from events", async () => {
    vi.spyOn(knowledgeApi, "list").mockResolvedValue({
      items: [item(), item({ id: "k-2", title: "Holiday.mov", kind: "video", status: "processing", scope: "always" })],
      always_tokens: 3200,
      always_budget: 8000,
    });
    render(<KnowledgeScreen />);
    expect(await screen.findByText("Lease.pdf")).toBeTruthy();
    expect(screen.getByText(/40% of its space is used/)).toBeTruthy();
    expect(screen.getByText("Transcribing")).toBeTruthy();
    const group = screen.getByRole("group", { name: "How the agents use “Lease.pdf”" });
    expect((within(group).getByLabelText("When relevant") as HTMLInputElement).checked).toBe(true);
    expect(document.querySelectorAll(".btn-primary")).toHaveLength(1);
    act(() =>
      knowledge.event({
        type: "knowledge.updated",
        id: "k-2",
        status: "ready",
        title: "Holiday.mov",
        scope: "always",
        kind: "video",
      }),
    );
    expect(screen.getAllByText("Ready")).toHaveLength(2);
  });

  it("changes the scope with the API and puts it back when that fails", async () => {
    vi.spyOn(knowledgeApi, "list").mockResolvedValue({ items: [item()], always_tokens: 0, always_budget: 8000 });
    const update = vi.spyOn(knowledgeApi, "update").mockRejectedValue(new Error("down"));
    render(<KnowledgeScreen />);
    fireEvent.click(await screen.findByLabelText("Only when I ask"));
    await waitFor(() => expect(update).toHaveBeenCalledWith("k-1", { scope: "on_request" }));
    expect(await screen.findByText(/The choice was not saved/)).toBeTruthy();
    expect((screen.getByLabelText("When relevant") as HTMLInputElement).checked).toBe(true);
  });

  it("adds a pasted link with one primary button and an empty field afterwards", async () => {
    vi.spyOn(knowledgeApi, "list").mockResolvedValue({ items: [], always_tokens: 0, always_budget: 8000 });
    const addLink = vi.spyOn(knowledgeApi, "addLink").mockResolvedValue({
      item: item({ id: "k-l", kind: "link", title: "https://example.com", status: "processing" }),
    });
    render(<KnowledgeScreen />);
    expect(await screen.findByText(/Nothing stored yet/)).toBeTruthy();
    const box = screen.getByLabelText("Paste a link or text");
    fireEvent.change(box, { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    // Who can use it is asked first (decision 270); with nothing ticked, every department.
    fireEvent.click(await screen.findByRole("button", { name: "Add for every department" }));
    await waitFor(() => expect(addLink).toHaveBeenCalledWith("https://example.com", undefined, "all"));
    expect(await screen.findByText("Reading the page")).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("asks before deleting, hides at once and calls DELETE only after the Undo time", async () => {
    vi.spyOn(knowledgeApi, "list").mockResolvedValue({ items: [item()], always_tokens: 0, always_budget: 8000 });
    const remove = vi.spyOn(knowledgeApi, "remove").mockResolvedValue({ ok: true });
    render(
      <>
        <KnowledgeScreen />
        <Toaster />
      </>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Delete “Lease.pdf”" }));
    vi.useFakeTimers();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(screen.queryByText("Lease.pdf")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText("Lease.pdf")).toBeTruthy();

    const undo = scheduleDelete("k-1", () => undefined, 10_000);
    expect(typeof undo).toBe("function");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    expect(remove).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(remove).toHaveBeenCalledWith("k-1");
    expect(screen.queryByText("Lease.pdf")).toBeNull();
  });
});

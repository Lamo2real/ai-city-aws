// Stop (decision 183): the owner drops VAIC's answer to the message it is working on, like Stop in ChatGPT or Claude.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/api.ts", async (orig) => ({ ...(await orig<typeof import("../src/lib/api.ts")>()), api }));

import { flushOutbox, sendMessage, stopReply } from "../src/lib/actions.ts";
import { store } from "../src/lib/store.ts";

const reply = (text: string, done: boolean, id?: string) =>
  store.event({ type: "vaic.reply", conversation: "main", text, done, ...(id ? { message_id: id } : {}) });
const owner = () => store.get().chat.find((l) => l.who === "owner")!;

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue({});
  store.set({ chat: [], turn: null, presence: "idle" });
});
afterEach(cleanup);

describe("Stop", () => {
  it("drops the half-written answer, keeps the message marked stopped, and tells VAIC by the message id", async () => {
    await sendMessage("write me 50 sentences");
    const id = owner().id;
    expect(store.busyLine()?.id).toBe(id);
    reply("One. Two.", false, `owner-${id}`);
    expect(store.get().chat.at(-1)).toMatchObject({ who: "vaic", state: "streaming" });

    expect(stopReply()).toBe(true);
    expect(store.get().chat).toHaveLength(1);
    expect(owner()).toMatchObject({ stopped: true, text: "write me 50 sentences" });
    expect(store.get().turn).toBeNull();
    expect(store.get().presence).toBe("idle");
    expect(store.busyLine()).toBeUndefined(); // the composer is ready at once
    expect(api).toHaveBeenLastCalledWith(`/messages/${id}/stop`, { method: "POST", body: {} });
  });

  it("ignores anything still in flight for the stopped message, but not a reply to the next one", async () => {
    await sendMessage("first");
    const first = owner().id;
    stopReply();
    reply(" Three.", false, `owner-${first}`);
    reply("One. Two. Three.", true, `owner-${first}`);
    store.event({ type: "vaic.files", conversation: "main", message_id: `owner-${first}`, files: [{ id: "f1" }] });
    expect(store.get().chat).toHaveLength(1);

    await sendMessage("second");
    const second = store.get().chat.at(-1)!.id;
    reply("Hello.", true, `owner-${second}`);
    expect(store.get().chat.at(-1)).toMatchObject({ who: "vaic", text: "Hello.", state: "done" });
  });

  it("shows what VAIC had already done, and that work handed on keeps going", async () => {
    await sendMessage("build me a site");
    const id = owner().id;
    stopReply();
    store.event({
      type: "vaic.stopped",
      conversation: "main",
      message_id: `owner-${id}`,
      tools: [{ activity: "delegating", detail: "delegate_to_orchestrator" }],
    });
    expect(owner()).toMatchObject({ stopped: true, stoppedSteps: ["Passing this to my team"], handedOn: true });
  });

  it("a late confirmation for an old message does not end a newer turn", async () => {
    await sendMessage("first");
    const first = owner().id;
    stopReply();
    await sendMessage("second");
    reply("Wor", false);
    store.event({ type: "vaic.stopped", conversation: "main", message_id: `owner-${first}`, tools: [] });
    expect(store.get().turn).not.toBeNull();
    expect(store.get().chat.at(-1)).toMatchObject({ who: "vaic", text: "Wor", state: "streaming" });
  });

  it("another open HUD that hears VAIC stopped drops the answer too", async () => {
    await sendMessage("hello");
    const id = owner().id;
    reply("Hi th", false, `owner-${id}`);
    store.event({ type: "vaic.stopped", conversation: "main", message_id: `owner-${id}`, tools: [] });
    expect(store.get().chat).toHaveLength(1);
    expect(owner().stopped).toBe(true);
    expect(store.get().turn).toBeNull();
  });

  it("does nothing when VAIC is not working on anything", async () => {
    expect(stopReply()).toBe(false);
    await sendMessage("hi");
    reply("Hello.", true, `owner-${owner().id}`);
    expect(stopReply()).toBe(false);
    expect(api).toHaveBeenCalledTimes(1); // only the message itself
  });

  it("a stopped message that never went out is not sent later by the outbox", async () => {
    api.mockRejectedValueOnce(Object.assign(new Error("offline"), { status: 0 }));
    await sendMessage("offline words");
    expect(owner().state).toBe("failed");
    stopReply();
    api.mockClear();
    await flushOutbox();
    expect(api).not.toHaveBeenCalledWith("/messages", expect.anything());
  });

  it("removeLine takes a stopped message out, for Edit", async () => {
    await sendMessage("typo here");
    stopReply();
    store.removeLine(owner().id);
    expect(store.get().chat).toHaveLength(0);
  });
});

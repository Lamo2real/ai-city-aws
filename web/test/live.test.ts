// AIC's real-time voice on GPT-Live (decision 128), with WebRTC, audio and the API faked: the offer goes to
// /voice/live, the owner's words go to AIC on a delegation, and AIC's answer goes back to be said.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posted: Array<{ path: string; body: unknown }> = [];
vi.mock("../src/lib/api.ts", () => ({
  api: async (path: string, init: { body: string }) => {
    posted.push({ path, body: JSON.parse(init.body) });
    return { sdp: "v=0 answer", session_id: "live_1" };
  },
}));

import { forSpeech, startLive } from "../src/voice/live.ts";

class FakeChannel extends EventTarget {
  readyState = "open";
  sent: Array<Record<string, unknown>> = [];
  send(s: string) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    this.readyState = "closed";
  }
  emit(e: Record<string, unknown>) {
    this.dispatchEvent(Object.assign(new Event("message"), { data: JSON.stringify(e) }));
  }
}
let channel: FakeChannel;
class FakePeer extends EventTarget {
  iceGatheringState = "complete";
  connectionState = "new";
  localDescription: { sdp: string } | null = null;
  remote: unknown = null;
  addTrack() {}
  createDataChannel() {
    channel = new FakeChannel();
    return channel;
  }
  async createOffer() {
    return { type: "offer", sdp: "v=0 offer" };
  }
  async setLocalDescription(d: { sdp: string }) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: unknown) {
    this.remote = d;
    queueMicrotask(() => channel.emit({ type: "session.started", session: { id: "live_1" } }));
  }
  close() {}
}
class FakeAudioContext {
  createAnalyser() {
    return { fftSize: 512, getFloatTimeDomainData: (b: Float32Array) => b.fill(0) };
  }
  createMediaStreamSource() {
    return { connect() {} };
  }
  async resume() {}
  async close() {}
}

beforeEach(() => {
  posted.length = 0;
  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("MediaStream", class {});
  vi.stubGlobal(
    "Audio",
    class {
      autoplay = false;
      srcObject: unknown = null;
      play = async () => undefined;
    },
  );
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [], getAudioTracks: () => [] }) },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("GPT-Live as AIC's voice", () => {
  it("opens through /voice/live, sends the owner's words to AIC on a delegation and AIC's answer back", async () => {
    const asked: string[] = [];
    const thinking: boolean[] = [];
    const call = await startLive({
      ask: async (t) => {
        asked.push(t);
        return "**Two** jobs are running, Sir. See [the board](https://x.example).";
      },
      onUserWords: () => undefined,
      onThinking: (on) => thinking.push(on),
      onSpeaking: () => undefined,
      onEnd: () => undefined,
    });
    expect(posted).toEqual([{ path: "/voice/live", body: { sdp: "v=0 offer" } }]);
    channel.emit({ type: "session.input_transcript.delta", delta: "What's running " });
    channel.emit({ type: "session.input_transcript.delta", delta: "right now?" });
    channel.emit({ type: "session.delegation.created", delegation: { id: "item_1", target: "client" } });
    await vi.waitFor(() => expect(channel.sent.length).toBe(1), { timeout: 2000 });
    expect(asked).toEqual(["What's running right now?"]);
    expect(thinking).toEqual([true, false]);
    expect(channel.sent[0]).toEqual({
      type: "session.commentary.append",
      delegation_id: "item_1",
      content: "Two jobs are running, Sir. See the board.",
    });
    call.stop();
    expect(channel.sent.at(-1)).toEqual({ type: "session.close" });
  });

  it("says nothing it can't: no code, no links, and a long answer points to the chat", () => {
    expect(forSpeech("Run `npm test`:\n```\nnpm test\n```\ndone")).toBe("Run npm test: (there's code in the chat) done");
    const long = forSpeech("word ".repeat(1000));
    expect(long.length).toBeLessThan(1900);
    expect(long.endsWith("The rest is in the chat.")).toBe(true);
  });
});

// Mac Safari heard nothing in the voice conversation (the owner, 2026-11-10: the bar stayed on "Listening to you…",
// nothing was sent). An AudioContext made in the tap, before the microphone was granted, got only silence from the
// microphone. These run the real voice code in WebKit (Safari's engine, the "safari" project) and in Chromium, with
// that Safari behaviour played back: a context made before the grant reads silence. Transcribe is a mock that, like
// the real one, answers only when it gets sound. Nothing reaches AWS.
import { expect, test, type Page } from "@playwright/test";
import { crc32 } from "node:zlib";
import { mockBackend } from "./mock.ts";

test.use({ permissions: ["microphone"] });

/** One AWS event-stream message (what Transcribe streaming sends back). */
function frame(eventType: string, body: object): Buffer {
  const hs: Buffer[] = [];
  const pairs: [string, string][] = [
    [":message-type", "event"],
    [":event-type", eventType],
    [":content-type", "application/json"],
  ];
  for (const [k, v] of pairs) {
    const kb = Buffer.from(k);
    const vb = Buffer.from(v);
    const h = Buffer.alloc(4 + kb.length + vb.length);
    h.writeUInt8(kb.length, 0);
    kb.copy(h, 1);
    h.writeUInt8(7, 1 + kb.length);
    h.writeUInt16BE(vb.length, 2 + kb.length);
    vb.copy(h, 4 + kb.length);
    hs.push(h);
  }
  const headers = Buffer.concat(hs);
  const payload = Buffer.from(JSON.stringify(body));
  const pre = Buffer.alloc(8);
  pre.writeUInt32BE(12 + headers.length + payload.length + 4, 0);
  pre.writeUInt32BE(headers.length, 4);
  const pc = Buffer.alloc(4);
  pc.writeUInt32BE(crc32(pre) >>> 0, 0);
  const head = Buffer.concat([pre, pc, headers, payload]);
  const mc = Buffer.alloc(4);
  mc.writeUInt32BE(crc32(head) >>> 0, 0);
  return Buffer.concat([head, mc]);
}

/** The loudest 16-bit sample in one audio event the HUD sent. */
function loudest(msg: Buffer): number {
  const total = msg.readUInt32BE(0);
  const hl = msg.readUInt32BE(4);
  let max = 0;
  for (let o = 12 + hl; o + 1 < total - 4; o += 2) max = Math.max(max, Math.abs(msg.readInt16LE(o)));
  return max;
}

const said = (text: string) =>
  frame("TranscriptEvent", {
    Transcript: {
      Results: [
        {
          ResultId: "r1",
          IsPartial: false,
          Alternatives: [
            {
              Transcript: text,
              Items: text.split(" ").map((w) => ({ Type: "pronunciation", Content: w, Confidence: 0.98 })),
            },
          ],
        },
      ],
    },
  });

/** Mac Safari's behaviour: every AudioContext made before the microphone was granted (or all, with `always`) reads
 *  nothing but silence from it. A test fake microphone: a steady tone. */
async function safariMic(page: Page, always = false) {
  await page.addInitScript((always) => {
    const w = window as unknown as { __granted?: boolean };
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await gum(c);
      w.__granted = true;
      return s;
    };
    const Real = window.AudioContext;
    class SafariContext extends Real {
      private silent = always || !w.__granted;
      override createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
        if (this.silent) {
          const zero = this.createConstantSource();
          zero.offset.value = 0;
          zero.start();
          return zero as unknown as MediaStreamAudioSourceNode;
        }
        // The fake microphone: a 300 Hz tone, the same in every engine.
        void stream;
        const tone = this.createOscillator();
        tone.frequency.value = 300;
        const g = this.createGain();
        g.gain.value = 0.3;
        tone.connect(g);
        tone.start();
        return g as unknown as MediaStreamAudioSourceNode;
      }
    }
    window.AudioContext = SafariContext;
    (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext = SafariContext;
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  }, always);
}

async function realVoice(page: Page) {
  const m = await mockBackend(page, { realVoice: true });
  await page.route("https://cognito-identity.eu-north-1.amazonaws.com/**", (r) => {
    const target = r.request().headers()["x-amz-target"] ?? "";
    const body = target.endsWith("GetId")
      ? { IdentityId: "eu-north-1:test" }
      : {
          IdentityId: "eu-north-1:test",
          Credentials: {
            AccessKeyId: "AKIATEST",
            SecretKey: "s",
            SessionToken: "t",
            Expiration: Date.now() / 1000 + 3600,
          },
        };
    return r.fulfill({ status: 200, contentType: "application/x-amz-json-1.1", body: JSON.stringify(body) });
  });
  const heard = { frames: 0, loudest: 0 };
  // Transcribe: like the real one, it answers only once it got sound, never for silence.
  await page.routeWebSocket(/transcribestreaming/, (ws) => {
    let answered = false;
    ws.onMessage((msg) => {
      if (typeof msg === "string") return;
      heard.frames++;
      heard.loudest = Math.max(heard.loudest, loudest(msg));
      if (!answered && heard.loudest > 1000) {
        answered = true;
        setTimeout(() => ws.send(said("check my mail")), 300);
      }
    });
  });
  return { m, heard };
}

test("the voice conversation hears the owner when Safari gives the tap's audio context only silence", async ({
  page,
}) => {
  await safariMic(page);
  const { m, heard } = await realVoice(page);
  await page.goto("/#/vaic");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect.poll(() => m.calls.filter((c) => c.path === "/messages").length, { timeout: 10_000 }).toBe(1);
  expect(m.calls.find((c) => c.path === "/messages")?.body).toMatchObject({ text: "check my mail", voice: true });
  expect(heard.loudest).toBeGreaterThan(1000); // real sound went to the speech service, not silence
  await expect(page.locator(".voice")).toHaveAttribute("data-speaker", "thinking");
});

test("a microphone that gives only silence is said plainly, not left on 'Listening to you…'", async ({ page }) => {
  await safariMic(page, true);
  const { m } = await realVoice(page);
  await page.goto("/#/vaic");
  await page.getByRole("button", { name: "Talk to VAIC", exact: true }).click();
  await expect(page.getByText("no sound reaches VAIC from it")).toBeVisible({ timeout: 15_000 });
  expect(m.calls.filter((c) => c.path === "/messages")).toHaveLength(0);
});

// Decision 187: the bloop for taps that work, the kalimba for a tap on something switched off and for errors.
import { describe, expect, it } from "vitest";
import { BLOOP, KALIMBA, tapSound } from "../src/lib/tapFx.ts";

function el(html: string): Element {
  document.body.innerHTML = html;
  return document.querySelector("[data-hit]")!;
}

describe("which sound a tap gets", () => {
  it("a working button, link or plain page area: the bloop", () => {
    expect(tapSound(el("<button><span data-hit>Send</span></button>"))).toBe("ok");
    expect(tapSound(el('<a href="#/city" data-hit>City</a>'))).toBe("ok");
    expect(tapSound(el("<p data-hit>Just text</p>"))).toBe("ok");
    expect(tapSound(null)).toBe("ok");
  });
  it("a control that can't be used right now: the kalimba", () => {
    expect(tapSound(el("<button disabled><span data-hit>Save securely</span></button>"))).toBe("no");
    expect(tapSound(el('<div role="button" aria-disabled="true" data-hit>Connect</div>'))).toBe("no");
    expect(tapSound(el("<fieldset disabled><input data-hit /></fieldset>"))).toBe("no");
    expect(tapSound(el('<div aria-disabled="true"><button data-hit>Go</button></div>'))).toBe("no");
  });
  it("the two sounds are the owner's picks: 19 (synth bloop) and 11 (kalimba)", () => {
    expect(BLOOP).toMatchObject({ type: "triangle", from: 220, to: 440 });
    expect(KALIMBA).toMatchObject({ carrier: 784, ratio: 3.5 });
  });
});

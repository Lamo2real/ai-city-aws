import { describe, expect, it } from "vitest";
import { sendHomeQuestion, sentHomeLine, workersAtWork } from "../src/lib/workers.ts";

const agent = (id: string, kind: string, state = "active") => ({ id, kind, state }) as never;

describe("send everyone home", () => {
  it("counts only live workers, never managers, AIC or released workers", () => {
    const city = {
      agents: {
        ace: agent("ace", "core"),
        "mgr-apps": agent("mgr-apps", "manager"),
        "wkr-1": agent("wkr-1", "worker"),
        "wkr-2": agent("wkr-2", "worker"),
        "wkr-3": agent("wkr-3", "worker", "retired"),
      },
    } as never;
    expect(workersAtWork(city)).toBe(2);
    const dormant = {
      ...city,
      agents: {
        ...city.agents,
        d1: { id: "d1", kind: "worker", state: "dormant", worker_state: "idle" },
        r1: { id: "r1", kind: "worker", state: "active", worker_state: "released" },
      },
    } as never;
    expect(workersAtWork(dormant)).toBe(3); // dormant still sits at a desk; released does not
    expect(workersAtWork({ agents: {} } as never)).toBe(0);
  });
  it("asks and reports in plain words", () => {
    expect(sendHomeQuestion(1)).toBe("Send all 1 worker home? They'll drop what they're doing.");
    expect(sendHomeQuestion(21)).toBe("Send all 21 workers home? They'll drop what they're doing.");
    expect(sentHomeLine({ workers: 0, parts: 0 })).toBe("Nobody was at work.");
    expect(sentHomeLine({ workers: 3, parts: 0 })).toBe("Sent 3 workers home.");
    expect(sentHomeLine({ workers: 1, parts: 1 })).toBe("Sent 1 worker home. 1 part will wait for a new worker.");
  });
});

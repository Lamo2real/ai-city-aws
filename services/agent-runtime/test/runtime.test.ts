import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { Invocation } from "@aic/shared";
import { activityFor, usageFromModelUsage } from "../src/engine.ts";
import { loadPrompt, parsePrompt, render } from "../src/prompts.ts";
import { createRuntimeServer } from "../src/server.ts";

const inv = (over: Partial<Invocation> = {}): Invocation => ({
  id: "m1",
  role: "worker",
  agentId: "w1",
  department: "Eng",
  ticketId: "t1",
  taskId: "t0",
  kind: "task",
  from: "mgr",
  body: "go",
  sessionId: "s".repeat(33),
  async: false,
  ...over,
});

describe("runtime HTTP contract", () => {
  let close: (() => void) | undefined;
  afterEach(() => close?.());
  async function start(runTurn: (i: Invocation) => Promise<string>) {
    const server = createRuntimeServer({ runTurn });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    close = () => server.close();
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }
  it("answers /ping and runs a synchronous turn on /invocations", async () => {
    const url = await start(async () => "hello");
    expect(await (await fetch(`${url}/ping`)).json()).toMatchObject({ status: "Healthy" });
    const r = await fetch(`${url}/invocations`, { method: "POST", body: JSON.stringify(inv()) });
    expect(await r.json()).toEqual({ status: "success", response: "hello" });
  });
  it("accepts an async job at once and reports HealthyBusy until it ends", async () => {
    let finish!: () => void;
    const url = await start(() => new Promise<string>((r) => (finish = () => r("done"))));
    const r = await fetch(`${url}/invocations`, { method: "POST", body: JSON.stringify(inv({ async: true })) });
    expect(r.status).toBe(202);
    expect(((await (await fetch(`${url}/ping`)).json()) as { status: string }).status).toBe("HealthyBusy");
    finish();
    await new Promise((r) => setTimeout(r, 10));
    expect(((await (await fetch(`${url}/ping`)).json()) as { status: string }).status).toBe("Healthy");
  });
  it("rejects malformed invocations and hides error details", async () => {
    const url = await start(async () => {
      throw new Error("secret detail");
    });
    expect((await fetch(`${url}/invocations`, { method: "POST", body: "{" })).status).toBe(400);
    const r = await fetch(`${url}/invocations`, { method: "POST", body: JSON.stringify(inv()) });
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain("secret detail");
  });
});

describe("prompts", () => {
  it("every role prompt exists and lists its tools", () => {
    expect(loadPrompt("ace.md").tools).toContain("delegate_to_orchestrator");
    expect(loadPrompt("orchestrator.md").tools).toContain("sign_off");
    expect(loadPrompt("manager.md", { department: "Eng" }).tools).toContain("review");
    expect(loadPrompt("worker.md").tools).toEqual(["ask_manager", "report_to_manager"]);
  });
  it("Ace's prompt states its name, greetings, spoken style and limits", () => {
    const body = loadPrompt("ace.md").body;
    for (const s of [
      "Ace",
      "AIC",
      "yo Ace",
      "hi Ace",
      "what's up Ace",
      "how's it going Ace",
      "what's the status of the product, Ace?",
      "Short",
      "can't",
    ])
      expect(body).toContain(s);
  });
  it("values put into a prompt cannot add placeholders", () => {
    expect(render("Mission: {{mission}} {{secret}}", { mission: "{{secret}}", secret: "S" })).toBe("Mission: secret S");
  });
  it("parses frontmatter", () => {
    expect(parsePrompt("---\nname: x\ntools: a, b\n---\nbody")).toEqual({ name: "x", tools: ["a", "b"], body: "body" });
  });
});

describe("engine helpers", () => {
  it("splits cache writes by lifetime, attributing unlabelled writes to the role's TTL", () => {
    const u = usageFromModelUsage(
      {
        m: {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadInputTokens: 100,
          cacheCreationInputTokens: 50,
          cacheCreationEphemeral5mInputTokens: 20,
          cacheCreationEphemeral1hInputTokens: 10,
        },
      },
      "1h",
    );
    expect(u).toEqual({ input: 10, output: 5, cacheRead: 100, cacheWrite5m: 20, cacheWrite1h: 30 });
  });
  it("names activities for the City view", () => {
    expect(activityFor("Edit")).toBe("coding");
    expect(activityFor("mcp__city__hire_worker")).toBe("hiring");
    expect(activityFor("mcp__city__review")).toBe("reviewing");
  });
});

describe("Dockerfile", () => {
  const text = readFileSync(join(import.meta.dirname, "..", "Dockerfile"), "utf8");
  it("builds for arm64, serves 8080, runs as non-root, keeps Bedrock on", () => {
    expect(text.match(/--platform=linux\/arm64/g)?.length).toBe(2);
    expect(text).toMatch(/EXPOSE 8080/);
    expect(text).toMatch(/USER node/);
    expect(text).toMatch(/CLAUDE_CODE_USE_BEDROCK=1/);
    expect(text).toMatch(/CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1/);
    expect(text).not.toMatch(/ANTHROPIC_API_KEY|awscli|aws-cli/);
  });
});

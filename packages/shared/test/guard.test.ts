import { describe, expect, it } from "vitest";
import { FORBIDDEN_ENV, StartupRefused, bedrockEnv, startupGuard } from "../src/guard.ts";

const ok = { CLAUDE_CODE_USE_BEDROCK: "1", AWS_REGION: "eu-north-1" };

describe("startup guard", () => {
  it("starts with Bedrock on and nothing forbidden", () => {
    expect(() => startupGuard(ok)).not.toThrow();
  });
  it("refuses when Bedrock is off or missing", () => {
    expect(() => startupGuard({})).toThrow(StartupRefused);
    expect(() => startupGuard({ CLAUDE_CODE_USE_BEDROCK: "0" })).toThrow(/must be 1/);
  });
  it.each(FORBIDDEN_ENV)("refuses when %s is set", (name) => {
    expect(() => startupGuard({ ...ok, [name]: "x" })).toThrow(new RegExp(name));
  });
  it("names the variable but never prints its value", () => {
    try {
      startupGuard({ ...ok, ANTHROPIC_API_KEY: "sk-very-secret" });
    } catch (e) {
      expect((e as Error).message).not.toContain("sk-very-secret");
    }
  });
  it("refuses when worker shell env scrubbing is turned off", () => {
    expect(() => startupGuard({ ...ok, CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "0" })).toThrow(/SCRUB/);
  });
  it("the env it hands agents keeps Bedrock on, 1M context off and scrubbing on", () => {
    const env = bedrockEnv("eu-north-1");
    expect(env).toMatchObject({
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_DISABLE_1M_CONTEXT: "1",
      CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
    });
    expect(() => startupGuard(env)).not.toThrow();
  });
});

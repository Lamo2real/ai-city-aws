import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES, resolveRole, resolveRoleFromEnv } from "../src/models.ts";

describe("model map", () => {
  it("maps every role to its pinned model on global profiles", () => {
    const want = {
      ace: "sonnet-5-5",
      orchestrator: "fable-5-1",
      manager: "fable-5-1",
      worker: "opus-5-5",
      utility: "haiku-5-5",
    };
    for (const role of ROLES) {
      const r = resolveRole(role);
      expect(r.primary.name).toBe(want[role]);
      expect(r.primary.profileId.startsWith("global.")).toBe(true);
      expect(r.primary.invokeId).toBe(r.primary.profileId);
      expect(r.degraded).toBe(false);
    }
  });
  it("orchestrator and managers fall back to Opus 5.5; others have no fallback", () => {
    expect(resolveRole("orchestrator").fallback?.name).toBe("opus-5-5");
    expect(resolveRole("manager").fallback?.name).toBe("opus-5-5");
    for (const r of ["ace", "worker", "utility"] as const) expect(resolveRole(r).fallback).toBeNull();
  });
  it("uses the role's application inference profile when one is configured", () => {
    const arn = "arn:aws:bedrock:eu-north-1:111122223333:application-inference-profile/abc";
    const r = resolveRole("worker", { applicationProfiles: { worker: arn } });
    expect(r.primary.invokeId).toBe(arn);
    expect(r.primary.profileId).toBe("global.anthropic.claude-opus-5-5");
  });
  it("on eu. profiles Fable roles fall back to Opus 5.5 as their primary", () => {
    const r = resolveRole("manager", { prefix: "eu" });
    expect(r.degraded).toBe(true);
    expect(r.primary.name).toBe("opus-5-5");
    expect(r.primary.profileId).toBe("eu.anthropic.claude-opus-5-5");
    expect(r.fallback).toBeNull();
  });
  it("reads prefix and application profile from the environment", () => {
    const r = resolveRoleFromEnv("ace", { AIC_PROFILE_PREFIX: "us", AIC_APP_PROFILE_ACE: "arn:x" });
    expect(r.primary.profileId).toBe("us.anthropic.claude-sonnet-5-5");
    expect(r.primary.invokeId).toBe("arn:x");
  });
});

// "Nothing else in the code may contain a model ID."
describe("model IDs live only in config/models.json", () => {
  const root = join(import.meta.dirname, "..", "..", "..");
  const skip = new Set(["node_modules", ".git", "dist", ".terraform", "docs", "test-results", "playwright-report"]);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|mjs|json|tf|md|yml|sh|py)$/.test(name) && name !== "package-lock.json") files.push(p);
    }
  };
  walk(root);
  it("no other file names a Bedrock model or profile ID", () => {
    const allowed = new Set(["config/models.json", "packages/shared/test/models.test.ts"]);
    const offenders = files
      .map((f) => relative(root, f))
      .filter((f) => !allowed.has(f))
      .filter((f) =>
        /anthropic\.claude-|claude-(opus|sonnet|haiku|fable)-\d/.test(readFileSync(join(root, f), "utf8")),
      );
    expect(offenders).toEqual([]);
  });
});

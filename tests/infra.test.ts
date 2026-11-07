// Phase 7 gate, in the unit suite: the tag check and the IAM check over the real Terraform, plus
// negative cases proving each check actually fails on a bad input.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts without type declarations
import { checkRuntimeTagConditions, checkTags } from "../scripts/check-tags.mjs";
// @ts-expect-error plain .mjs scripts without type declarations
import { checkBoundaries, checkInline, checkWorker, rolePolicies } from "../scripts/check-iam.mjs";

const moduleText = (m: string) =>
  readFileSync(join(import.meta.dirname, "..", "infra", "modules", m, "main.tf"), "utf8");

type Stmt = { Sid?: string; Action: string | string[]; Resource: string | string[] };
const actions = (s: Stmt[]) => s.flatMap((x) => (Array.isArray(x.Action) ? x.Action : [x.Action]));

describe("cost allocation tags", () => {
  it("every taggable resource in infra/ carries Component (and AgentRole where required)", () => {
    const r = checkTags();
    expect(r.problems).toEqual([]);
    expect(r.checked).toBeGreaterThan(40);
  });
  it("fails a resource without tags, and an agent runtime without AgentRole", () => {
    const dir = mkdtempSync(join(tmpdir(), "tags-"));
    const f = join(dir, "main.tf");
    writeFileSync(
      f,
      `locals {\n  tags = { Component = "agents" }\n}\nresource "aws_s3_bucket" "x" {\n  bucket = "b"\n}\nresource "aws_bedrockagentcore_agent_runtime" "r" {\n  tags = local.tags\n}\n`,
    );
    const r = checkTags({
      files: [f],
      list: { taggable: ["aws_s3_bucket", "aws_bedrockagentcore_agent_runtime"], untaggable: [] },
    });
    expect(r.problems.some((p: string) => /aws_s3_bucket.x has no Component/.test(p))).toBe(true);
    expect(r.problems.some((p: string) => /agent_runtime.r has no AgentRole/.test(p))).toBe(true);
  });
});

describe("IAM", () => {
  it("workers: no iam:*, no wildcard secrets, no resource creation, Bedrock only on the worker profile", () => {
    expect(checkWorker()).toEqual([]);
    const w = rolePolicies("worker") as Stmt[];
    expect(actions(w).some((a) => a.startsWith("iam:"))).toBe(false);
    const invoke = w.filter((s) => actions([s]).some((a) => a.startsWith("bedrock:Invoke"))).flatMap((s) => s.Resource);
    expect(invoke.every((r) => /opus-5-5|aic-worker/.test(r))).toBe(true);
  });
  it("only the manager can call the Agent Factory, and only coordinators can send to every queue", () => {
    const can = (role: string, a: string) => actions(rolePolicies(role) as Stmt[]).includes(a);
    expect(can("manager", "lambda:InvokeFunction")).toBe(true);
    for (const r of ["ace", "orchestrator", "worker"]) expect(can(r, "lambda:InvokeFunction")).toBe(false);
    const workerQueues = (rolePolicies("worker") as Stmt[])
      .filter((s) => actions([s]).includes("sqs:SendMessage"))
      .flatMap((s) => s.Resource);
    expect(workerQueues).toEqual([expect.stringMatching(/aic-prod-manager$/)]);
  });
  it("Fable roles may invoke their Opus fallback; AIC only its own model (Haiku)", () => {
    const models = (role: string) =>
      (rolePolicies(role) as Stmt[])
        .filter((s) => actions([s]).includes("bedrock:InvokeModel"))
        .flatMap((s) => s.Resource)
        .join(" ");
    expect(models("orchestrator")).toMatch(/fable-5-1/);
    expect(models("orchestrator")).toMatch(/opus-5-5/);
    expect(models("ace")).toMatch(/haiku-5-5/);
    expect(models("ace")).not.toMatch(/sonnet|opus|fable/);
  });
  it("every role Terraform creates has a permission boundary", () => {
    expect(checkBoundaries()).toEqual([]);
  });
});

describe("IAM: connectors, mail and skills (inline Terraform policies)", () => {
  it("pass on the real Terraform", () => {
    expect(checkInline()).toEqual([]);
  });
  it("fails when the MCP host role gets anything beyond logs and its image", () => {
    const read = (m: string) =>
      m === "connectors"
        ? moduleText(m).replace(
            'Sid = "Logs", Effect = "Allow", Action = [',
            'Sid = "Logs", Effect = "Allow", Action = ["secretsmanager:GetSecretValue", ',
          )
        : moduleText(m);
    expect(checkInline({ read, modules: ["connectors"] })).toContain(
      "MCP host role has secretsmanager:GetSecretValue; it may only write logs and pull its image",
    );
  });
  it("fails when a role other than the bridge reads connector secrets", () => {
    const read = (m: string) =>
      m === "mail"
        ? moduleText(m).replace(
            'Action = ["kms:Decrypt"], Resource = var.kms_key_arn }',
            'Action = ["secretsmanager:GetSecretValue"], Resource = ["arn:aws:secretsmanager:r:1:secret:aic/prod/connectors/*"] }',
          )
        : moduleText(m);
    expect(checkInline({ read, modules: ["connectors", "mail"] })).toContain(
      "mail: a statement outside the bridge reads connector secrets",
    );
  });
  it("fails when runtime roles (the worker included) get Identity credentials, or the worker gets mail", () => {
    const read = (m: string) =>
      m === "skills"
        ? moduleText(m).replace(
            'Sid = "ReadSkillFiles", Effect = "Allow", Action = ["s3:GetObject"]',
            'Sid = "ReadSkillFiles", Effect = "Allow", Action = ["s3:GetObject", "bedrock-agentcore:GetResourceApiKey"]',
          )
        : moduleText(m);
    expect(checkInline({ read, modules: ["skills"] })).toContain(
      "skills: runtime roles (the worker too) get bedrock-agentcore:GetResourceApiKey",
    );
    expect(checkInline({ modules: [], prod: "reader_role_names = module.agents.role_names" })).toContain(
      "envs/prod: the mail read path must leave out the worker role",
    );
  });
  it("runtime-created secrets and providers must be tag-conditioned", () => {
    const f = join(mkdtempSync(join(tmpdir(), "tagcond-")), "main.tf");
    writeFileSync(
      f,
      `resource "aws_iam_role_policy" "p" {\n  policy = jsonencode({ Statement = [{ Effect = "Allow", Action = ["secretsmanager:CreateSecret"], Resource = ["arn:aws:secretsmanager:r:1:secret:aic/prod/connectors/*"] }] })\n}\n`,
    );
    expect(checkRuntimeTagConditions([f])).toHaveLength(2);
  });
});

describe("HUD content security policy", () => {
  it("lets the browser reach Cognito's sign-in API (our own sign-in screens use it directly)", async () => {
    const { readFileSync } = await import("node:fs");
    const tf = readFileSync("infra/modules/frontend/main.tf", "utf8");
    const connect = tf.split("\n").find((l) => l.includes('"connect-src'));
    expect(connect).toContain("https://cognito-idp.${var.region}.amazonaws.com");
  });
});

describe("voice credentials", () => {
  it("the identity pool trusts only the HUD's app client and skips the server-side check that refused valid tokens", async () => {
    const { readFileSync } = await import("node:fs");
    const tf = readFileSync("infra/modules/auth/main.tf", "utf8");
    const pool = tf.slice(tf.indexOf('resource "aws_cognito_identity_pool" "voice"'));
    const block = pool.slice(0, pool.indexOf("\n}\n"));
    expect(block).toMatch(/client_id\s+= aws_cognito_user_pool_client\.hud\.id/);
    expect(block).toMatch(/provider_name\s+= aws_cognito_user_pool\.this\.endpoint/);
    expect(block).toMatch(/allow_unauthenticated_identities\s+= false/);
    expect(block).toMatch(/server_side_token_check\s+= false/);
  });
});

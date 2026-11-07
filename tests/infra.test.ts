// Phase 7 gate, in the unit suite: the tag check and the IAM check over the real Terraform, plus
// negative cases proving each check actually fails on a bad input.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts without type declarations
import { checkTags } from "../scripts/check-tags.mjs";
// @ts-expect-error plain .mjs scripts without type declarations
import { checkBoundaries, checkWorker, rolePolicies, workspacePolicy } from "../scripts/check-iam.mjs";

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

describe("apps origin (docs/APPS.md)", () => {
  const read = async (p: string) => (await import("node:fs")).readFileSync(p, "utf8");
  const cspOf = (tf: string) => {
    const start = tf.indexOf("csp = join(");
    return tf.slice(start, tf.indexOf("])", start));
  };
  const directives = (csp: string) =>
    Object.fromEntries(
      [...csp.matchAll(/^\s*"([a-z-]+)\s*([^"]*)",?$/gm)].map((m) => [m[1], (m[2] ?? "").trim()]),
    ) as Record<string, string>;

  it("the apps CSP blocks the network, workers, frames and forms, and lets only CloudFront sites frame it", async () => {
    const d = directives(cspOf(await read("infra/modules/apps/main.tf")));
    expect(d["default-src"]).toBe("'none'");
    expect(d["connect-src"]).toBe("'none'");
    for (const k of ["worker-src", "frame-src", "form-action", "base-uri", "object-src"]) expect(d[k]).toBe("'none'");
    expect(d["script-src"]).toBe("'self' 'unsafe-inline'");
    expect(d["frame-ancestors"]).toBe("https://*.cloudfront.net");
  });

  it("the apps distribution has its own bucket, the HUD's WAF, no SPA rewrite, CORS GET/HEAD only", async () => {
    const tf = await read("infra/modules/apps/main.tf");
    expect(tf).toMatch(/bucket = "\$\{var\.name\}-apps"/);
    expect(tf).toMatch(/web_acl_id\s+= var\.waf_acl_arn/);
    expect(tf).not.toMatch(/custom_error_response/);
    expect(tf).not.toMatch(/frame_options/);
    expect(tf).toMatch(/items = \["GET", "HEAD"\]/);
    expect(tf).toMatch(/content_security_policy = local\.csp\s+override\s+= true/);
    expect(tf).toMatch(/prefix = "drafts\/"/);
    const prod = await read("infra/envs/prod/main.tf");
    expect(prod).toMatch(/waf_acl_arn = module\.frontend\.waf_acl_arn/);
    expect(prod).toMatch(/appsUrl\s+= module\.apps\.url/);
  });

  it("the HUD CSP frames only the apps origin and adds it to img-src, never to connect-src", async () => {
    const d = directives(cspOf(await read("infra/modules/frontend/main.tf")));
    expect(d["frame-src"]).toBe("${var.apps_url}");
    expect(d["img-src"]).toBe("'self' data: blob: ${var.apps_url}");
    expect(d["connect-src"]).not.toContain("apps_url");
    expect(d["frame-ancestors"]).toBe("'none'");
  });

  it("apps resources carry Component = apps", async () => {
    expect(await read("infra/modules/apps/main.tf")).toMatch(/tags = \{ Component = "apps" \}/);
    const api = await read("infra/modules/api/main.tf");
    expect(api).toMatch(/resource "aws_sqs_queue" "apps_dlq" \{[\s\S]*?tags\s+= \{ Component = "apps" \}/);
    expect(api).toMatch(
      /resource "aws_cloudwatch_event_rule" "app_submitted" \{[\s\S]*?tags\s+= \{ Component = "apps" \}/,
    );
    expect(api).toMatch(/tags = contains\(local\.apps_tagged, each\.key\) \? \{ Component = "apps" \} : local\.tags/);
    expect(api).toMatch(/apps_tagged\s+= \["apps", "app-bridge"\]/);
  });

  it("no worker or Orchestrator policy names the apps bucket", async () => {
    for (const role of ["worker", "orchestrator", "manager", "ace"]) {
      const text = JSON.stringify(rolePolicies(role));
      expect(text).not.toMatch(/aic-prod-apps|apps_bucket|live\//);
    }
    expect(JSON.stringify(workspacePolicy())).not.toMatch(/apps/);
    const { readdirSync } = await import("node:fs");
    for (const f of readdirSync("infra/modules/agents/policies"))
      expect(await read(`infra/modules/agents/policies/${f}`)).not.toMatch(/apps_bucket|-apps|cloudfront/);
    expect(await read("infra/modules/agents/main.tf")).not.toMatch(/apps_bucket|module\.apps|cloudfront/);
  });

  it("the apps Lambda: EventBridge on app.submitted, drafts/ only, APPDRAFTS only; only the API writes live/", async () => {
    const api = await read("infra/modules/api/main.tf");
    expect(api).toMatch(/apps\s+= \{ bundle = "app", handler = "aic\.lambdas\.apps\.handler"/);
    expect(api).toMatch(/"detail-type" = \["app\.submitted"\]/);
    const appsPerms = api.slice(api.indexOf("    apps = ["), api.indexOf("    ]", api.indexOf("    apps = [")));
    expect(appsPerms).toContain('"${var.apps_bucket_arn}/drafts/*"');
    expect(appsPerms).not.toContain("live/");
    expect(appsPerms).toContain('"dynamodb:LeadingKeys" = ["APPDRAFTS"]');
    expect(appsPerms).toContain('"${var.workspaces_arn}/hires/*/app/*"');
    expect(api.match(/live\/\*/g)?.length).toBe(2); // the API's ListBucket prefix and its Put/Delete
    expect(api).toMatch(/cloudfront:CreateInvalidation"\], Resource = \[var\.apps_distribution_arn\]/);
  });
});

describe("apps API routes", () => {
  it("the apps routes (v1 and the v2 bridge, proposals, PUT) sit behind the JWT authorizer, and CORS allows DELETE", async () => {
    const api = (await import("node:fs")).readFileSync("infra/modules/api/main.tf", "utf8");
    const routes = api.slice(api.indexOf("routes = ["), api.indexOf("]", api.indexOf("routes = [")));
    expect(routes).toContain('"GET /apps"');
    expect(routes).toContain('"DELETE /apps/{id}"');
    for (const r of ['"PUT /apps/{id}"', '"POST /apps/{id}/bridge"', '"POST /apps/{id}/proposals"'])
      expect(routes).toContain(r);
    expect(api).toMatch(/allow_methods = \["GET", "POST", "PUT", "DELETE"\]/);
  });
});

describe("app-bridge Lambda (docs/APPS.md v2)", () => {
  const api = () => readFileSync("infra/modules/api/main.tf", "utf8");
  const block = (tf: string, start: string) =>
    tf
      .slice(tf.indexOf(start), tf.indexOf("    ]", tf.indexOf(start)))
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
  it("runs the shared zip with its own handler", () => {
    expect(api()).toMatch(/app-bridge\s+= \{ bundle = "app", handler = "aic\.lambdas\.app_bridge\.handler"/);
    expect(api()).toMatch(/app_bridge_name = "\$\{var\.name\}-app-bridge"/);
  });
  it("only the api role may invoke it, and the api role has no Gateway access", () => {
    const tf = api();
    const apiPerms = block(tf, "    api = [");
    expect(apiPerms).toContain('function:${local.app_bridge_name}"');
    expect(apiPerms).not.toMatch(/bedrock-agentcore/);
    const invokes = [...tf.matchAll(/app_bridge_name\}"\]/g)].length;
    expect(invokes).toBe(1);
    expect(tf).not.toMatch(/aws_lambda_permission"[^{]*\{[^}]*app-bridge/);
    for (const role of ["worker", "orchestrator", "manager", "ace"])
      expect(JSON.stringify(rolePolicies(role))).not.toMatch(/app-bridge/);
  });
  it("reads only APPS, CONNECTORS and MAIL; writes only rate counters and app audit rows; no Gateway yet", () => {
    const perms = block(api(), "    app-bridge = [");
    expect(perms).toContain('"dynamodb:LeadingKeys" = ["APPS", "CONNECTORS", "MAIL"]');
    expect(perms).toContain('"dynamodb:LeadingKeys" = ["RATE#app-*", "TOOL#app-*"]');
    expect(perms).not.toMatch(
      /DeleteItem|s3:|events:|sqs:|InvokeGateway|CompleteResourceTokenAuth|CreateSecret|PutSecretValue/,
    );
    const reads = perms.split("\n").find((l) => l.includes('"APPS", "CONNECTORS", "MAIL"')) ?? "";
    expect(reads).not.toMatch(/PutItem|UpdateItem/);
  });
  it("mail reads: workload aic-prod-mail, the two providers and the vault, aic/prod/mail/* secrets only", () => {
    const tf = api();
    const perms = block(tf, "    app-bridge = [");
    expect(perms).toMatch(
      /"bedrock-agentcore:GetWorkloadAccessTokenForUserId"\], Resource = local\.mail_workload_arns/,
    );
    expect(perms).toMatch(
      /"bedrock-agentcore:GetResourceOauth2Token"\], Resource = concat\(local\.mail_workload_arns, \["\$\{local\.agentcore_arn\}:token-vault\/default"\], local\.mail_provider_arns\)/,
    );
    expect(perms).toContain(
      '"secretsmanager:GetSecretValue"], Resource = ["arn:aws:secretsmanager:${var.region}:${var.account_id}:secret:aic/prod/mail/*"]',
    );
    expect(tf).toMatch(/workload-identity\/\$\{var\.name\}-mail"\]/);
    expect(tf).toMatch(/for p in \["google", "microsoft"\]/);
    expect(block(tf, "    api = [")).not.toMatch(/bedrock-agentcore/);
  });
});

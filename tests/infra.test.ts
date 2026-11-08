// Phase 7 gate, in the unit suite: the tag check and the IAM check over the real Terraform, plus
// negative cases proving each check actually fails on a bad input.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts without type declarations
import { checkRuntimeTagConditions, checkTags } from "../scripts/check-tags.mjs";
// @ts-expect-error plain .mjs scripts without type declarations
import * as iam from "../scripts/check-iam.mjs";

const {
  checkBoundaries,
  checkInline,
  checkKnowledge,
  checkWorker,
  knowledgeStatements,
  rolePolicies,
  workspacePolicy,
} = iam;

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
  it("lets the browser reach Cognito's sign-in API (our own sign-in screens use it directly)", () => {
    const tf = readFileSync("infra/modules/frontend/main.tf", "utf8");
    const connect = tf.split("\n").find((l) => l.includes('"connect-src'));
    expect(connect).toContain("https://cognito-idp.${var.region}.amazonaws.com");
  });
});

describe("knowledge base (docs/KNOWLEDGE.md)", () => {
  const tf = readFileSync("infra/modules/knowledge/main.tf", "utf8");
  const api = readFileSync("infra/modules/api/main.tf", "utf8");
  const agents = readFileSync("infra/modules/agents/main.tf", "utf8");
  const prod = readFileSync("infra/envs/prod/main.tf", "utf8");
  type State = {
    Type: string;
    Parameters?: { Payload?: { action?: string } };
    Retry?: { ErrorEquals: string[]; MaxAttempts: number }[];
    Catch?: unknown[];
    Next?: string;
    Default?: string;
    Choices?: { Next: string }[];
    End?: boolean;
    Branches?: { StartAt: string; States: Record<string, State> }[];
  };
  const asl = JSON.parse(
    readFileSync("infra/modules/knowledge/pipeline.asl.json.tftpl", "utf8")
      .replaceAll("${function_arn}", "arn:aws:lambda:eu-north-1:1:function:aic-prod-knowledge")
      .replaceAll("${lambda_errors}", JSON.stringify(["Lambda.ServiceException"])),
  ) as { StartAt: string; States: Record<string, State> };
  // Every state, including those inside Parallel branches, with the scope (state names) it may jump to.
  const scopes: Record<string, State>[] = [asl.States];
  for (const st of Object.values(asl.States)) for (const b of st.Branches ?? []) scopes.push(b.States);
  const allStates = scopes.flatMap((sc) => Object.entries(sc));

  it("IAM: no IAM beyond passing the MediaConvert role, Bedrock only on Titan/Haiku, only AIC adds knowledge", () => {
    expect(checkKnowledge()).toEqual([]);
    for (const r of ["ace", "orchestrator", "manager", "worker"])
      expect(actions(rolePolicies(r) as Stmt[])).toContain("bedrock:Retrieve");
    expect(actions(rolePolicies("worker") as Stmt[])).not.toContain("s3:PutObject");
  });
  it("IAM check fails a wide PassRole, a KB role that invokes another model, and a boundary without the deny", () => {
    const wide = knowledgeStatements(
      `resource "aws_iam_role_policy" "fn" {\n  policy = jsonencode({\n      { Sid = "P", Effect = "Allow", Action = ["iam:PassRole"], Resource = "*" },\n  })\n}\n` +
        `resource "aws_iam_role_policy" "kb" {\n  policy = jsonencode({\n      { Sid = "E", Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = var.utility_invoke_arns },\n  })\n}\n`,
    );
    const p = checkKnowledge({ statements: wide, boundary: "" });
    expect(p.some((x: string) => /IAM action iam:PassRole/.test(x))).toBe(true);
    expect(p.some((x: string) => /kb\/E may invoke/.test(x))).toBe(true);
    expect(p.some((x: string) => /boundary does not deny/.test(x))).toBe(true);
    const wideDeployer = checkKnowledge({
      text: `Rules = [{ ResourceType = "index", Resource = ["index/x/items"], Permission = ["aoss:*"] }]\n      Principal = [var.deployer_arn]`,
    });
    expect(wideDeployer.some((x: string) => /deploy role may do more/.test(x))).toBe(true);
  });
  it("bucket: KMS, versioned, private, EventBridge on, CORS PUT from the HUD with ETag, work/ expires after 7 days", () => {
    expect(tf).toMatch(/resource "aws_s3_bucket" "this" \{[\s\S]*?bucket\s+= local\.base/);
    expect(tf).toContain('base      = "${var.name}-knowledge"');
    expect(tf).toMatch(/sse_algorithm\s+= "aws:kms"/);
    expect(tf).toMatch(/status = "Enabled"/);
    expect(tf).toMatch(/restrict_public_buckets = true/);
    expect(tf).toMatch(/eventbridge = true/);
    expect(tf).toMatch(/allowed_methods = \["PUT"\]/);
    expect(tf).toMatch(/allowed_origins = \[var\.app_origin\]/);
    expect(tf).toMatch(/expose_headers\s+= \["ETag"\]/);
    expect(tf).toMatch(/prefix = "work\/"\s*\}\s*expiration \{\s*days = 7/);
  });
  it("vectors: OpenSearch Serverless VECTORSEARCH (no standby, KMS, IAM-only), index items per section 14, KB on it", () => {
    expect(tf).toMatch(
      /jsondecode\(file\("\$\{path\.module\}\/\.\.\/\.\.\/\.\.\/config\/models\.json"\)\)\.embeddings\.knowledge/,
    );
    expect(tf).toMatch(/type\s+= "VECTORSEARCH"/);
    expect(tf).toMatch(/standby_replicas = "DISABLED"/);
    expect(tf).toMatch(/AWSOwnedKey = false\s+KmsARN\s+= var\.kms_key_arn/);
    expect(tf).not.toMatch(/s3vectors/);
    const mapping = /mappings = jsonencode\(([\s\S]*?)\n {2}\}\)/.exec(tf)![1];
    for (const want of [
      'type      = "knn_vector"',
      "dimension = local.embedding.dimensions",
      'engine = "faiss"',
      'space_type = "innerproduct"',
      "m = 16, ef_construction = 512",
      'metadata = { type = "text", index = false }',
      'item_id  = { type = "keyword" }',
      'scope    = { type = "keyword" }',
      'kind     = { type = "keyword" }',
    ])
      expect(mapping).toContain(want);
    expect(tf).toMatch(/index_knn_algo_param_ef_search = "512"/);
    expect(tf).toMatch(/type = "OPENSEARCH_SERVERLESS"/);
    expect(tf).toMatch(/vector_index_name = opensearch_index\.items\.name/);
    // The KB waits for the index, and a minute more: a fresh index isn't visible to Bedrock at once.
    expect(tf).toMatch(/depends_on = \[aws_iam_role_policy\.kb, opensearch_index\.items, time_sleep\.index\]/);
    expect(tf).toMatch(/resource "time_sleep" "index"[\s\S]*?create_duration = "60s"/);
    expect(tf).toMatch(/inclusion_prefixes\s+= \["normalized\/"\]/);
    expect(prod).toMatch(/aws_signature_service = "aoss"/);
    expect(tf).not.toMatch(/amazon\.titan|titan-embed/);
    const models = JSON.parse(readFileSync("config/models.json", "utf8"));
    expect(models.embeddings.knowledge.dimensions).toBe(1024);
  });
  it("graph: Neptune Analytics 16 m-NCU, no replica, public (IAM), KMS, deletion protection, no vector index", () => {
    const g = /resource "aws_neptunegraph_graph" "this" \{([\s\S]*?)\n\}/.exec(tf)![1];
    expect(g).toMatch(/graph_name\s+= "\$\{local\.base\}-graph"/);
    expect(g).toMatch(/provisioned_memory\s+= 16/);
    expect(g).toMatch(/replica_count\s+= 0/);
    expect(g).toMatch(/public_connectivity = true/);
    expect(g).toMatch(/kms_key_identifier\s+= var\.kms_key_arn/);
    expect(g).toMatch(/deletion_protection = var\.deletion_protection/);
    expect(g).not.toMatch(/vector_search_configuration/);
    for (const r of ["ace", "orchestrator", "manager", "worker"])
      expect(actions(rolePolicies(r) as Stmt[])).toContain("neptune-graph:ReadDataViaQuery");
  });
  it("lambdas: api 1024 MB with SnapStart behind the live alias; knowledge 2048 MB, reserved 50", () => {
    expect(api).toMatch(/handler = "aic\.lambdas\.api\.handler", timeout = 30, memory = 1024/);
    expect(api).toMatch(/publish = contains\(\["api", "dispatcher", "ws-broadcast"\], each\.key\)/);
    expect(api).toMatch(/apply_on = "PublishedVersions"/);
    expect(api).toMatch(/resource "aws_lambda_alias" "api_live" \{\s*name\s+= "live"/);
    expect(api).toContain("integration_uri        = aws_lambda_alias.api_live.invoke_arn");
    expect(api).toMatch(/qualifier\s+= aws_lambda_alias\.api_live\.name/);
    expect(tf).toMatch(/memory_size\s+= 2048/);
    expect(tf).toMatch(/reserved_concurrent_executions = 50/);
  });
  it("table: pk/sk, gsi1, gsi2, PITR, KMS", () => {
    const t = /resource "aws_dynamodb_table" "this" \{([\s\S]*?)\n\}/.exec(tf)![1];
    for (const k of ["pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk"]) expect(t).toContain(`name = "${k}"`);
    expect(t).toMatch(/name\s+= "gsi1"/);
    expect(t).toMatch(/name\s+= "gsi2"/);
    expect(t).toMatch(/point_in_time_recovery \{\s*enabled = true/);
    expect(t).toMatch(/kms_key_arn = var\.kms_key_arn/);
  });
  it("pipeline: every section-10 action, Lambda retries 3x, ThrottlingException on ingest 10x, enrich and ingest in parallel", () => {
    const tasks = allStates.filter(([, s]) => s.Type === "Task");
    const acts = tasks.map(([, s]) => s.Parameters!.Payload!.action).sort();
    expect(acts).toEqual(
      [
        "route",
        "prepare_document",
        "describe_image",
        "fetch_link",
        "start_mediaconvert",
        "check_mediaconvert",
        "start_transcribe",
        "check_transcribe",
        "transcript_to_text",
        "mark_unsupported",
        "enrich",
        "ingest",
        "check_ingest",
        "finish",
        "fail",
      ].sort(),
    );
    const top = new Set(Object.keys(asl.States));
    for (const [name, s] of tasks) {
      expect(s.Retry![0]).toMatchObject({ ErrorEquals: ["Lambda.ServiceException"], MaxAttempts: 3 });
      // top-level tasks catch into fail; tasks inside the Parallel branches fail the Parallel, which catches.
      if (top.has(name) && name !== "Fail")
        expect(s.Catch).toEqual([{ ErrorEquals: ["States.ALL"], ResultPath: "$.error", Next: "Fail" }]);
    }
    const par = asl.States.EnrichAndIngest!;
    expect(par.Type).toBe("Parallel");
    expect(par.Branches!.map((b) => b.StartAt)).toEqual(["Enrich", "Ingest"]);
    expect(par.Catch).toEqual([{ ErrorEquals: ["States.ALL"], ResultPath: "$.error", Next: "Fail" }]);
    expect(par.Next).toBe("Finish");
    expect(par.Branches![1]!.States.Ingest?.Retry?.[1]).toMatchObject({
      ErrorEquals: ["ThrottlingException"],
      MaxAttempts: 10,
    });
    expect(JSON.stringify(asl)).not.toMatch(/start_sync|check_sync|ConflictException/);
    // every transition points at a real state in its own scope
    for (const sc of scopes) {
      const names = new Set(Object.keys(sc));
      for (const s of Object.values(sc))
        for (const n of [s.Next, s.Default, ...(s.Choices ?? []).map((c) => c.Next)].filter(Boolean))
          expect(names).toContain(n);
    }
    expect(top).toContain(asl.StartAt);
    expect(tf).toMatch(/templatefile\("\$\{path\.module\}\/pipeline\.asl\.json\.tftpl"/);
    expect(tf).toMatch(/type\s+= "STANDARD"/);
    expect(asl.States.AfterLink?.Choices?.[0]?.Next).toBe("EnrichAndIngest");
    expect(tf).toMatch(/AIC_LEDGER_TABLE\s+= var\.ledger_table/);
  });
  it("start: raw/ object-created rule invokes the knowledge Lambda's start action (it names the run after the item)", () => {
    expect(tf).toMatch(/object = \{ key = \[\{ prefix = "raw\/" \}\] \}/);
    expect(tf).toMatch(/"detail-type" = \["Object Created"\]/);
    expect(tf).toContain('\\"action\\": \\"start\\"');
    expect(tf).toMatch(/handler\s+= "aic\.lambdas\.knowledge\.handler"/);
    expect(tf).toMatch(/states:StartExecution"\], Resource = \[local\.state_machine_arn\]/);
  });
  it("environment variables from section 8 reach the api, the knowledge Lambda and the runtimes", () => {
    for (const v of [
      "KNOWLEDGE_TABLE",
      "KNOWLEDGE_BUCKET",
      "KNOWLEDGE_BASE_ID",
      "KNOWLEDGE_DATA_SOURCE_ID",
      "KNOWLEDGE_GRAPH_ID",
      "KNOWLEDGE_STATE_MACHINE_ARN",
      "MEDIACONVERT_ROLE_ARN",
    ])
      expect(tf).toMatch(new RegExp(`\\b${v}\\s+=`));
    for (const v of [
      "KNOWLEDGE_TABLE",
      "KNOWLEDGE_BUCKET",
      "KNOWLEDGE_BASE_ID",
      "KNOWLEDGE_DATA_SOURCE_ID",
      "KNOWLEDGE_GRAPH_ID",
    ])
      expect(api).toContain(`${v} = var.`);
    for (const v of ["KNOWLEDGE_TABLE", "KNOWLEDGE_BASE_ID", "KNOWLEDGE_DATA_SOURCE_ID", "KNOWLEDGE_GRAPH_ID"])
      expect(agents).toMatch(new RegExp(`${v}\\s+= var\\.`));
    expect(agents).toContain('each.key == "ace" ? { KNOWLEDGE_BUCKET = var.knowledge_bucket } : {}');
    expect(prod).toMatch(/module "knowledge" \{/);
  });
  it("the HTTP API has every knowledge route behind the owner's JWT, and CORS allows DELETE", () => {
    for (const r of [
      "GET /knowledge",
      "GET /knowledge/{id}",
      "POST /knowledge/uploads",
      "POST /knowledge/uploads/{id}/complete",
      "POST /knowledge/links",
      "POST /knowledge/text",
      "PUT /knowledge/{id}",
      "DELETE /knowledge/{id}",
    ])
      expect(api).toContain(`"${r}"`);
    expect(api).toContain('allow_methods = ["GET", "POST", "PUT", "DELETE"]');
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
    for (const r of [
      '"PUT /apps/{id}"',
      '"POST /apps/{id}/bridge"',
      '"POST /apps/{id}/proposals"',
      '"POST /apps/{id}/rollback"',
    ])
      expect(routes).toContain(r);
    expect(api).toMatch(/allow_methods = \["GET", "POST", "PUT", "DELETE"\]/);
  });
});

describe("apps v3: workers read an app's current version from the public apps origin", () => {
  it("only the worker runtime gets AIC_APPS_URL, and no runtime role names the apps bucket", () => {
    const agents = readFileSync("infra/modules/agents/main.tf", "utf8");
    expect(agents).toMatch(/each\.key == "worker" && var\.apps_url != "" \? \{ AIC_APPS_URL = var\.apps_url \}/);
    expect(readFileSync("infra/envs/prod/main.tf", "utf8")).toMatch(/apps_url\s+= module\.apps\.url/);
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
    // Its one AgentCore right is signing the voice address to AIC's runtime (decision 120).
    expect(apiPerms.replace(/bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream/, "")).not.toMatch(/bedrock-agentcore/);
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
  it("mail reads come from the mail module's read path (its own ARNs), and the api role has no AgentCore access", () => {
    const tf = api();
    const perms = block(tf, "    app-bridge = [");
    expect(perms).not.toMatch(/bedrock-agentcore|secretsmanager/); // no hand-written Identity or secret ARNs here
    const mail = readFileSync(join(import.meta.dirname, "..", "infra", "modules", "mail", "main.tf"), "utf8");
    expect(mail).toMatch(
      /resource "aws_iam_role_policy" "app_bridge" \{\n {2}name {3}= "mail-read-path"\n {2}role {3}= var\.app_bridge_role_name/,
    );
    expect(mail).toMatch(/Statement = local\.read_path \}\)\n\}/);
    expect(mail).toMatch(/workload_arn\s+= "\$\{local\.directory\}\/workload-identity\/\$\{local\.workload\}"/);
    expect(mail).toMatch(/app_passwords\s+= "\$\{local\.sm\}:aic\/prod\/mail\/\*"/);
    expect(block(tf, "    api = [").replace(/bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream/, "")).not.toMatch(/bedrock-agentcore/);
    // The bridge's Gateway access is attached by the connectors module, on the gateway ARN only, never the api role.
    const conn = readFileSync(join(import.meta.dirname, "..", "infra", "modules", "connectors", "main.tf"), "utf8");
    expect(conn).toMatch(
      /resource "aws_iam_role_policy" "app_bridge_gateway" \{\n {2}name = "connectors-gateway"\n {2}role = var\.app_bridge_role_name/,
    );
    const prod = readFileSync(join(import.meta.dirname, "..", "infra", "envs", "prod", "main.tf"), "utf8");
    expect(prod.match(/app_bridge_role_name\s*=\s*module\.api\.role_names\["app-bridge"\]/g)).toHaveLength(2);
  });
});

describe("AIC's voice (Polly generative)", () => {
  it("the HUD may call Polly in its own region, which config.json names", async () => {
    const { readFileSync } = await import("node:fs");
    const fe = readFileSync("infra/modules/frontend/main.tf", "utf8");
    const connect = fe.split("\n").find((l) => l.includes('"connect-src')) ?? "";
    expect(connect).toContain("https://polly.${var.polly_region}.amazonaws.com");
    const prod = readFileSync("infra/envs/prod/main.tf", "utf8");
    expect(prod).toMatch(/pollyRegion\s+= var\.polly_region/);
    const vars = readFileSync("infra/envs/prod/variables.tf", "utf8");
    expect(vars).toMatch(/variable "polly_region"[\s\S]*?default\s+= "eu-central-1"/);
    // The voice role's Polly permission is not tied to a region, so Frankfurt needs no IAM change.
    const auth = readFileSync("infra/modules/auth/main.tf", "utf8");
    expect(auth).toMatch(/Action = \["polly:SynthesizeSpeech"\], Resource = "\*"/);
  });
});

describe("AIC's ears (Transcribe streaming in Frankfurt)", () => {
  it("Transcribe, its vocabulary, the CSP and config.json all use transcribe_region; the identity pool stays home", () => {
    const fe = readFileSync("infra/modules/frontend/main.tf", "utf8");
    const connect = fe.split("\n").find((l) => l.includes('"connect-src')) ?? "";
    expect(connect).toContain("https://transcribestreaming.${var.transcribe_region}.amazonaws.com");
    expect(connect).toContain("wss://transcribestreaming.${var.transcribe_region}.amazonaws.com:8443");
    expect(connect).toContain("https://cognito-identity.${var.region}.amazonaws.com");
    const prod = readFileSync("infra/envs/prod/main.tf", "utf8");
    expect(prod).toMatch(/alias\s+= "speech"\s+region = var\.transcribe_region/);
    expect(prod).toMatch(/providers\s+= \{ aws = aws, aws\.speech = aws\.speech \}/);
    expect(prod).toMatch(/transcribeRegion\s+= var\.transcribe_region/);
    const vars = readFileSync("infra/envs/prod/variables.tf", "utf8");
    expect(vars).toMatch(/variable "transcribe_region"[\s\S]*?default\s+= "eu-central-1"/);
    const auth = readFileSync("infra/modules/auth/main.tf", "utf8");
    expect(auth).toMatch(/resource "aws_transcribe_vocabulary" "speech_names" \{\s+provider\s+= aws\.speech/);
    expect(auth).toMatch(/tags\s+= local\.tags/);
    // Region-agnostic, as before: Frankfurt needs no IAM change.
    expect(auth).toMatch(
      /Action = \["transcribe:StartStreamTranscriptionWebSocket", "transcribe:StartStreamTranscription"\], Resource = "\*"/,
    );
  });
});

describe("AIC warm-keeper (the owner's under-3-seconds target)", () => {
  const api = readFileSync("infra/modules/api/main.tf", "utf8");
  const agents = readFileSync("infra/modules/agents/main.tf", "utf8");
  const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
  it("the scheduler pings AIC's runtime every 2 minutes, enabled from the start, and may invoke only that runtime", () => {
    expect(api).toMatch(
      /warm-ace\s*=\s*\{ schedule = "rate\(2 minutes\)", fn = "scheduler", input = \{ job = "warm_ace" \}, state = "ENABLED" \}/,
    );
    expect(api).toMatch(/state\s*=\s*lookup\(each\.value, "state", "DISABLED"\)/);
    const scheduler = api.slice(
      api.indexOf("    scheduler = ["),
      api.indexOf("    ]", api.indexOf("    scheduler = [")),
    );
    expect(scheduler).toMatch(/bedrock-agentcore:InvokeAgentRuntime.*var\.runtime_arns\["ace"\]/);
    expect(scheduler).not.toMatch(/values\(var\.runtime_arns\)/);
    expect(api).toMatch(
      /scheduler.*env = \{ AIC_RUNTIME_ARN_ACE = var\.runtime_arns\["ace"\], AIC_RUNTIME_VERSION = var\.runtime_version, AIC_WS_ENDPOINT = "https:\/\/\$\{aws_apigatewayv2_api\.ws\.id\}\.execute-api\.\$\{var\.region\}\.amazonaws\.com\/prod", AIC_CONNECTIONS_TABLE = var\.connections_table \}/,
    );
  });
  it("every scheduled job is an EventBridge rule with a resource-policy permission, not an EventBridge Scheduler schedule", () => {
    expect(api).toMatch(/resource "aws_cloudwatch_event_rule" "job" \{\n {2}for_each\s+= local\.jobs/);
    expect(api).toMatch(/schedule_expression = each\.value\.schedule/);
    expect(api).toMatch(
      /resource "aws_cloudwatch_event_target" "job"[\s\S]*?input\s+= jsonencode\(each\.value\.input\)/,
    );
    expect(api).toMatch(
      /resource "aws_lambda_permission" "job"[\s\S]*?principal\s+= "events\.amazonaws\.com"[\s\S]*?source_arn\s+= aws_cloudwatch_event_rule\.job\[each\.key\]\.arn/,
    );
    expect(api).not.toMatch(/aws_scheduler_schedule|scheduler\.amazonaws\.com|aws_iam_role" "scheduler"/);
    expect(api).toMatch(
      /improve\s*=\s*\{ schedule = "cron\(0 3 \? \* SUN \*\)", fn = "scheduler", input = \{ job = "improve" \} \}/,
    ); // stays DISABLED
  });
  it("the dispatcher and ws-broadcast are always on: published, a live alias, provisioned concurrency 1, and every trigger uses the alias", () => {
    expect(api).toMatch(/publish = contains\(\["api", "dispatcher", "ws-broadcast"\], each\.key\)/);
    expect(api).toMatch(
      /resource "aws_lambda_alias" "always_on" \{\n {2}for_each\s+= toset\(\["dispatcher", "ws-broadcast"\]\)/,
    );
    expect(api).toMatch(
      /resource "aws_lambda_provisioned_concurrency_config" "always_on" \{[\s\S]*?provisioned_concurrent_executions = 1/,
    );
    expect(api).toMatch(/function_name\s+= aws_lambda_alias\.always_on\["dispatcher"\]\.arn/); // the SQS mapping
    expect(api).toMatch(/each\.key == "ws-broadcast" \? aws_lambda_alias\.always_on\["ws-broadcast"\]\.arn/); // the EventBridge target
    expect(api).toMatch(
      /qualifier\s+= each\.key == "ws-broadcast" \? aws_lambda_alias\.always_on\["ws-broadcast"\]\.name : null/,
    ); // its permission
    // SnapStart and provisioned concurrency never meet on one function.
    expect(api).toMatch(/for_each = each\.key == "api" \? \[1\] : \[\]/);
  });
  it("AIC's session lives all day with a 30-minute idle window; the other coordinators keep an hour", () => {
    expect(agents).toMatch(/idle_runtime_session_timeout = each\.key == "ace" \? 1800 : 900/);
    expect(agents).toMatch(/max_lifetime\s*=\s*contains\(\["ace", "worker"\], each\.key\) \? 28800 : 3600/);
  });
  it("the deploy warms AIC right after apply, and a miss never fails the deploy", () => {
    const i = deploy.indexOf("terraform apply -input=false prod.tfplan");
    const after = deploy.slice(i, i + 900);
    expect(after).toMatch(/warm AIC's runtime/);
    expect(after).toMatch(/aws lambda invoke --function-name "\$fn" --payload '\{"job":"warm_ace"\}'/);
    expect(after).toMatch(/\|\| echo "warm-up skipped"/);
  });
});

describe("notifications: no email, one iPhone push per finished job (decision 90)", () => {
  const api = readFileSync("infra/modules/api/main.tf", "utf8");
  const bus = readFileSync("infra/modules/bus/main.tf", "utf8");
  const notifications = readFileSync("infra/modules/notifications/main.tf", "utf8");
  const prod = readFileSync("infra/envs/prod/main.tf", "utf8");
  it("nothing subscribes an email address to the city's topic, and the nudge job is gone", () => {
    expect(bus).not.toMatch(/aws_sns_topic_subscription/);
    expect(bus).not.toMatch(/protocol\s*=\s*"email"/);
    expect(api).not.toMatch(/job = "nudge"/);
    expect(api).not.toMatch(/AIC_NOTIFY_TOPIC_ARN|notify_topic_arn/);
  });
  it("the notifier is woken only for top-level jobs reaching their end", () => {
    expect(api).toMatch(
      /"detail-type" = \["ticket\.status"\], detail = \{ ticket = \{ kind = \["task"\], status = \["done", "failed", "cancelled"\] \} \}/,
    );
  });
  it("the Apple key is a secret the owner fills; platform applications and their rights exist only when apns_enabled", () => {
    expect(notifications).toMatch(/name\s*=\s*local\.secret_name/);
    expect(notifications).toMatch(/secret_name = "aic\/prod\/apns"/);
    expect(notifications).toMatch(/for_each\s*=\s*var\.apns_enabled \? local\.app_names : \{\}/);
    expect(notifications).toMatch(/count\s*=\s*var\.apns_enabled \? 1 : 0/);
    expect(notifications).toMatch(/apple_platform_team_id/);
    // The notifier may only publish to endpoints of these applications; the api may only register endpoints under them.
    expect(notifications).toMatch(
      /Sid = "Push", Effect = "Allow", Action = \["sns:Publish"\], Resource = local\.endpoints/,
    );
    expect(notifications).toMatch(/Action = \["sns:CreatePlatformEndpoint"\], Resource = values\(local\.app_arns\)/);
    expect(prod).toMatch(/module "notifications"/);
    expect(prod).toMatch(/apns_enabled\s*=\s*var\.apns_enabled/);
    expect(api).toMatch(
      /AIC_APNS_ARN\s*=\s*var\.apns_enabled \? "arn:aws:sns:\$\{var\.region\}:\$\{var\.account_id\}:app\/APNS\/\$\{var\.name\}-apns" : ""/,
    );
    for (const r of [
      "GET /devices",
      "POST /devices",
      "DELETE /devices/{id}",
      "GET /notifications/apns",
      "PUT /notifications/apns",
    ])
      expect(api).toContain(`"${r}"`);
  });
});

describe("voice: OpenAI text-to-speech (decision 96)", () => {
  const voice = readFileSync("infra/modules/voice/main.tf", "utf8");
  const prodTf = readFileSync("infra/envs/prod/main.tf", "utf8");
  const apiTf = readFileSync("infra/modules/api/main.tf", "utf8");
  it("the OpenAI key is a secret only the api function may read or store", () => {
    expect(voice).toMatch(/secret_name = "aic\/prod\/openai"/);
    expect(voice).toMatch(/kms_key_id\s*=\s*var\.kms_key_arn/);
    expect(voice).toMatch(
      /Action = \["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue", "secretsmanager:DescribeSecret"\], Resource = \[aws_secretsmanager_secret\.openai\.arn\]/,
    );
    expect(voice).toMatch(/role\s*=\s*var\.api_role_name/);
    expect(prodTf).toMatch(/module "voice"/);
    expect(prodTf).toMatch(/AIC_OPENAI_SECRET\s*=\s*"aic\/prod\/openai"/);
  });
  it("the speech and key routes exist", () => {
    for (const r of ["POST /speech", "GET /voice/openai", "PUT /voice/openai-key"]) expect(apiTf).toContain(`"${r}"`);
  });
});

describe("GitHub access (decision 110)", () => {
  const github = readFileSync("infra/modules/github/main.tf", "utf8");
  const prodTf = readFileSync("infra/envs/prod/main.tf", "utf8");
  const apiTf = readFileSync("infra/modules/api/main.tf", "utf8");
  const storage = readFileSync("infra/modules/storage/main.tf", "utf8");
  const agents = readFileSync("infra/modules/agents/main.tf", "utf8");
  const worker = readFileSync("infra/modules/agents/policies/worker.json.tftpl", "utf8");
  it("the token is one secret: the api stores and reads it, every runtime role reads it", () => {
    expect(github).toMatch(/secret_name = "aic\/prod\/github"/);
    expect(github).toMatch(/kms_key_id\s*=\s*var\.kms_key_arn/);
    expect(github).toMatch(
      /Action = \["secretsmanager:GetSecretValue", "secretsmanager:PutSecretValue", "secretsmanager:DescribeSecret"\], Resource = \[aws_secretsmanager_secret\.github\.arn\]/,
    );
    expect(github).toMatch(
      /Action = \["secretsmanager:GetSecretValue"\], Resource = \[aws_secretsmanager_secret\.github\.arn\]/,
    );
    expect(github).toMatch(/for_each\s*=\s*var\.agent_role_names/);
    expect(prodTf).toMatch(/module "github"/);
    expect(prodTf).toMatch(/agent_role_names = module\.agents\.role_names/);
    expect(prodTf).toMatch(/AIC_GITHUB_SECRET\s*=\s*"aic\/prod\/github"/);
  });
  it("the old empty container moves over instead of being destroyed, and nothing else grants the read", () => {
    expect(prodTf).toMatch(/from = module\.storage\.aws_secretsmanager_secret\.this\["github"\]/);
    expect(prodTf).toMatch(/to\s*=\s*module\.github\.aws_secretsmanager_secret\.github/);
    expect(storage).not.toMatch(/github = "/);
    expect(agents).not.toContain("github_secret_arn");
    expect(worker).not.toContain("secretsmanager");
  });
  it("the routes exist and the image has gh and curl", () => {
    for (const r of ["GET /github", "PUT /github/token", "DELETE /github/token"]) expect(apiTf).toContain(`"${r}"`);
    const docker = readFileSync("services/agent-runtime/Dockerfile", "utf8");
    expect(docker).toMatch(/ARG GH_VERSION=\d+\.\d+\.\d+/);
    expect(docker).toMatch(/ARG GH_SHA256=[0-9a-f]{64}/);
    expect(docker).toContain("sha256sum -c");
    expect(docker).toMatch(/mkdir -p \/tmp\/work \/workspace/);
  });
});

describe("the city is always on", () => {
  it("has no pause or resume route in the HTTP API", async () => {
    const { readFileSync } = await import("node:fs");
    const tf = readFileSync("infra/modules/api/main.tf", "utf8");
    expect(tf).not.toMatch(/\/city\/(pause|resume)/);
  });
});

describe("the owner's queue switch", () => {
  it("every SQS trigger follows queues_enabled, passed from the deploy variable AIC_QUEUES_ENABLED", async () => {
    const { readFileSync } = await import("node:fs");
    const api = readFileSync("infra/modules/api/main.tf", "utf8");
    expect(api).toMatch(/resource "aws_lambda_event_source_mapping" "queue" \{[^}]*enabled\s*=\s*var\.queues_enabled/s);
    expect(readFileSync("infra/envs/prod/main.tf", "utf8")).toMatch(/queues_enabled\s*=\s*var\.queues_enabled/);
    const wf = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(wf).toContain("vars.AIC_QUEUES_ENABLED");
    expect(wf).toContain('-var "queues_enabled=${QUEUES_ENABLED}"');
  });
});

describe("the owner's start over", () => {
  it("POST /city/reset is routed, and the api role may scan, batch-delete and purge for it", async () => {
    const { readFileSync } = await import("node:fs");
    const api = readFileSync("infra/modules/api/main.tf", "utf8");
    expect(api).toContain('"POST /city/reset"');
    expect(api).toContain('"POST /agents/{id}/home"'); // the City's Send home button
    expect(api).toContain('"dynamodb:Scan", "dynamodb:BatchWriteItem"');
    expect(api).toContain('"sqs:PurgeQueue"');
  });
});

describe("pre-configured departments (decision 113)", () => {
  const apiTf = readFileSync("infra/modules/api/main.tf", "utf8");
  const presets = JSON.parse(readFileSync("config/departments.json", "utf8"));
  it("the presets route is routed", () => {
    expect(apiTf).toContain('"GET /departments/presets"');
  });
  it("twelve departments and the shared tools: each skill has a SKILL.md and each connector an https url", () => {
    expect(presets.departments).toHaveLength(12);
    for (const d of [...presets.departments, presets.shared]) {
      if (d.key) expect(existsSync(`agents/departments/${d.key}.md`)).toBe(true);
      for (const s of d.skills) expect(existsSync(`agents/skills/${s}/SKILL.md`)).toBe(true);
      for (const c of d.connectors) expect(presets.connectors[c]?.url).toMatch(/^https:\/\//);
      for (const e of d.essential) expect(d.connectors).toContain(e);
    }
  });
  it("the Lambda package carries the bundled skills", () => {
    expect(readFileSync("backend/scripts/build_lambdas.py", "utf8")).toContain('"agents" / "skills"');
  });
});

describe("AIC's real-time voice (Nova Sonic, decision 120)", () => {
  const apiTf = readFileSync("infra/modules/api/main.tf", "utf8");
  const agentsTf = readFileSync("infra/modules/agents/main.tf", "utf8");
  const boundary = readFileSync("infra/modules/security/main.tf", "utf8");
  const fe = readFileSync("infra/modules/frontend/main.tf", "utf8");
  it("only AIC's role opens the two-way audio stream, on the voice models in config/models.json", () => {
    expect(boundary).toContain('"bedrock:InvokeModelWithBidirectionalStream"');
    const voice = agentsTf.slice(agentsTf.indexOf('resource "aws_iam_role_policy" "voice"'));
    expect(voice).toMatch(/role = aws_iam_role\.agent\["ace"\]\.id/);
    expect(voice).toContain("local.models.voice.speech");
    expect(agentsTf.match(/InvokeModelWithBidirectionalStream/g)).toHaveLength(1);
  });
  it("the API signs the browser's address to AIC's runtime only, and the HUD may open it", () => {
    expect(apiTf).toContain('"POST /voice/session"');
    expect(apiTf).toMatch(
      /"bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream"\], Resource = \[var\.runtime_arns\["ace"\], "\$\{var\.runtime_arns\["ace"\]\}\/\*"\]/,
    );
    expect(apiTf).toMatch(/AIC_RUNTIME_ARN_ACE = var\.runtime_arns\["ace"\], AIC_RUNTIME_VERSION = var\.runtime_version \}/);
    const connect = fe.split("\n").find((l) => l.includes('"connect-src')) ?? "";
    expect(connect).toContain("wss://bedrock-agentcore.${var.region}.amazonaws.com");
  });
});

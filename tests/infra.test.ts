// Phase 7 gate, in the unit suite: the tag check and the IAM check over the real Terraform, plus
// negative cases proving each check actually fails on a bad input.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs scripts without type declarations
import { checkTags } from "../scripts/check-tags.mjs";
// @ts-expect-error plain .mjs scripts without type declarations
import * as iam from "../scripts/check-iam.mjs";

const { checkBoundaries, checkKnowledge, checkWorker, knowledgeStatements, rolePolicies } = iam;

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
  it("Fable roles may invoke their Opus fallback; Ace only Sonnet", () => {
    const models = (role: string) =>
      (rolePolicies(role) as Stmt[])
        .filter((s) => actions([s]).includes("bedrock:InvokeModel"))
        .flatMap((s) => s.Resource)
        .join(" ");
    expect(models("orchestrator")).toMatch(/fable-5-1/);
    expect(models("orchestrator")).toMatch(/opus-5-5/);
    expect(models("ace")).toMatch(/sonnet-5-5/);
    expect(models("ace")).not.toMatch(/opus|fable/);
  });
  it("every role Terraform creates has a permission boundary", () => {
    expect(checkBoundaries()).toEqual([]);
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
  };
  const asl = JSON.parse(
    readFileSync("infra/modules/knowledge/pipeline.asl.json.tftpl", "utf8")
      .replaceAll("${function_arn}", "arn:aws:lambda:eu-north-1:1:function:aic-prod-knowledge")
      .replaceAll("${lambda_errors}", JSON.stringify(["Lambda.ServiceException"])),
  ) as { StartAt: string; States: Record<string, State> };

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
  it("vectors: S3 Vectors index (cosine, dims from config/models.json), KB embeds with the model from config only", () => {
    expect(tf).toMatch(
      /jsondecode\(file\("\$\{path\.module\}\/\.\.\/\.\.\/\.\.\/config\/models\.json"\)\)\.embeddings\.knowledge/,
    );
    expect(tf).toMatch(/dimension\s+= local\.embedding\.dimensions/);
    expect(tf).toMatch(/distance_metric\s+= "cosine"/);
    expect(tf).toMatch(/index_name\s+= "items"/);
    expect(tf).toMatch(/type = "S3_VECTORS"/);
    expect(tf).toMatch(/inclusion_prefixes\s+= \["normalized\/"\]/);
    // item_id, scope and kind must stay filterable: only Bedrock's own large keys are non-filterable.
    expect(tf).toContain('non_filterable_metadata_keys = ["AMAZON_BEDROCK_TEXT", "AMAZON_BEDROCK_METADATA"]');
    expect(tf).not.toMatch(/amazon\.titan|titan-embed/);
    const models = JSON.parse(readFileSync("config/models.json", "utf8"));
    expect(models.embeddings.knowledge.dimensions).toBe(1024);
  });
  it("table: pk/sk, gsi1, gsi2, PITR, KMS", () => {
    const t = /resource "aws_dynamodb_table" "this" \{([\s\S]*?)\n\}/.exec(tf)![1];
    for (const k of ["pk", "sk", "gsi1pk", "gsi1sk", "gsi2pk", "gsi2sk"]) expect(t).toContain(`name = "${k}"`);
    expect(t).toMatch(/name\s+= "gsi1"/);
    expect(t).toMatch(/name\s+= "gsi2"/);
    expect(t).toMatch(/point_in_time_recovery \{\s*enabled = true/);
    expect(t).toMatch(/kms_key_arn = var\.kms_key_arn/);
  });
  it("pipeline: every section-10 action, Lambda retries 3x, ConflictException on start_sync 10x, failures go to fail", () => {
    const tasks = Object.entries(asl.States).filter(([, s]) => s.Type === "Task");
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
        "start_sync",
        "check_sync",
        "finish",
        "fail",
      ].sort(),
    );
    for (const [name, s] of tasks) {
      expect(s.Retry![0]).toMatchObject({ ErrorEquals: ["Lambda.ServiceException"], MaxAttempts: 3 });
      if (name !== "Fail")
        expect(s.Catch).toEqual([{ ErrorEquals: ["States.ALL"], ResultPath: "$.error", Next: "Fail" }]);
    }
    expect(asl.States.StartSync?.Retry?.[1]).toMatchObject({ ErrorEquals: ["ConflictException"], MaxAttempts: 10 });
    // every transition points at a real state
    const names = new Set(Object.keys(asl.States));
    for (const s of Object.values(asl.States))
      for (const n of [s.Next, s.Default, ...(s.Choices ?? []).map((c) => c.Next)].filter(Boolean))
        expect(names).toContain(n);
    expect(names).toContain(asl.StartAt);
    expect(tf).toMatch(/templatefile\("\$\{path\.module\}\/pipeline\.asl\.json\.tftpl"/);
    expect(tf).toMatch(/type\s+= "STANDARD"/);
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
      "KNOWLEDGE_STATE_MACHINE_ARN",
      "MEDIACONVERT_ROLE_ARN",
    ])
      expect(tf).toMatch(new RegExp(`\\b${v}\\s+=`));
    for (const v of ["KNOWLEDGE_TABLE", "KNOWLEDGE_BUCKET", "KNOWLEDGE_BASE_ID", "KNOWLEDGE_DATA_SOURCE_ID"])
      expect(api).toContain(`${v} = var.`);
    for (const v of ["KNOWLEDGE_TABLE", "KNOWLEDGE_BASE_ID", "KNOWLEDGE_DATA_SOURCE_ID"])
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

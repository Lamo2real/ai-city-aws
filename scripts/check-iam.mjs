#!/usr/bin/env node
// IAM check: renders each agent role's policy templates (infra/modules/agents/policies) the way
// Terraform's templatefile does, with sample values, and asserts the worker's limits:
// no IAM actions, no wildcard GetSecretValue, no resource-creation actions, and Bedrock invoke only
// on the worker's own model profile. It also checks that every role has a permission boundary.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POLICIES = join(ROOT, "infra", "modules", "agents", "policies");
const models = JSON.parse(readFileSync(join(ROOT, "config", "models.json"), "utf8"));

const ACCOUNT = "111122223333";
const REGION = "eu-north-1";
const profile = (m) => `arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/global.${models.models[m].modelId}`;
const fm = (m) => `arn:aws:bedrock:*::foundation-model/${models.models[m].modelId}`;
const app = (r) => `arn:aws:bedrock:${REGION}:${ACCOUNT}:application-inference-profile/aic-${r}`;
const roleModels = (r) => [models.roles[r].model, models.roles[r].fallback].filter(Boolean);

export function render(file, vars) {
  const text = readFileSync(join(POLICIES, file), "utf8");
  const out = text.replace(/(\$?)\$\{([a-z_]+)\}/g, (all, esc, k) => {
    if (esc) return all.slice(1); // $${x} is a literal ${x}
    if (!(k in vars)) throw new Error(`${file}: no value for ${k}`);
    return vars[k];
  });
  return JSON.parse(out);
}

export function rolePolicies(role) {
  const common = render("common.json.tftpl", {
    region: REGION,
    account_id: ACCOUNT,
    ecr_repo_arn: `arn:aws:ecr:${REGION}:${ACCOUNT}:repository/aic-prod-agent-runtime`,
    memory_arn: `arn:aws:bedrock-agentcore:${REGION}:${ACCOUNT}:memory/aic_prod_${role}_memory-abc`,
    model_arns: JSON.stringify([app(role), ...roleModels(role).map(profile), ...roleModels(role).map(fm)]),
    profile_arns: JSON.stringify([app(role), ...roleModels(role).map(profile)]),
    kms_key_arn: `arn:aws:kms:${REGION}:${ACCOUNT}:key/k`,
    bus_arn: `arn:aws:events:${REGION}:${ACCOUNT}:event-bus/aic-prod`,
  });
  const ledger = `arn:aws:dynamodb:${REGION}:${ACCOUNT}:table/aic-prod-ledger`;
  const queues = ["ace", "orchestrator", "manager", "worker"].map(
    (q) => `arn:aws:sqs:${REGION}:${ACCOUNT}:aic-prod-${q}`,
  );
  const docs = [common];
  if (role === "worker") {
    docs.push(
      render("worker.json.tftpl", {
        region: REGION,
        ledger_arn: ledger,
        manager_queue_arn: queues[2],
        workspace_role_arn: `arn:aws:iam::${ACCOUNT}:role/aic-prod-worker-workspace`,
        github_secret_arn: `arn:aws:secretsmanager:${REGION}:${ACCOUNT}:secret:aic/prod/github-AbCd`,
      }),
    );
  } else {
    docs.push(render("coordinator.json.tftpl", { ledger_arn: ledger, queue_arns: JSON.stringify(queues) }));
    if (role === "manager")
      docs.push(
        render("factory.json.tftpl", { factory_arn: `arn:aws:lambda:${REGION}:${ACCOUNT}:function:aic-prod-factory` }),
      );
  }
  return docs.flatMap((d) => d.Statement);
}
export const workspacePolicy = () =>
  render("workspace.json.tftpl", {
    bucket_arn: "arn:aws:s3:::aic-prod-workspaces",
    kms_key_arn: "arn:aws:kms:x:1:key/k",
  }).Statement;

const list = (v) => (Array.isArray(v) ? v : [v]);
// Data-plane writes a worker legitimately makes; anything else that creates, deletes or runs is a resource change.
const DATA_PLANE = new Set([
  "logs:CreateLogStream",
  "logs:CreateLogGroup",
  "bedrock-agentcore:CreateEvent",
  "dynamodb:PutItem",
  "dynamodb:DeleteItem",
  "s3:PutObject",
  "s3:DeleteObject",
  "events:PutEvents",
  "logs:PutLogEvents",
  "xray:PutTraceSegments",
  "xray:PutTelemetryRecords",
  "cloudwatch:PutMetricData",
  "bedrock-agentcore:StartCodeInterpreterSession",
  "bedrock-agentcore:StartBrowserSession",
  "bedrock-agentcore:UpdateBrowserStream",
  "dynamodb:UpdateItem",
  "sts:TagSession",
]);
const CREATES = /:(Create|Delete|Put|Run|Start|Attach|Detach|Update|Modify|Register|Deregister|Terminate|Tag|Untag)/;

export function checkWorker() {
  const problems = [];
  const stmts = [...rolePolicies("worker"), ...workspacePolicy()];
  for (const s of stmts) {
    for (const a of list(s.Action)) {
      if (/^iam:/i.test(a)) problems.push(`worker has IAM action ${a}`);
      if (a === "*" || a.endsWith(":*")) problems.push(`worker has wildcard action ${a}`);
      if (CREATES.test(a) && !DATA_PLANE.has(a)) problems.push(`worker has resource-changing action ${a}`);
      if (
        a === "secretsmanager:GetSecretValue" &&
        list(s.Resource).some((r) => r.includes("*") || !r.includes(":secret:aic/prod/github"))
      )
        problems.push("worker can read secrets beyond the GitHub credential");
      if (/^bedrock:Invoke/.test(a)) {
        const allowed = new Set([app("worker"), ...roleModels("worker").map(profile), ...roleModels("worker").map(fm)]);
        for (const r of list(s.Resource))
          if (!allowed.has(r)) problems.push(`worker can invoke ${r}, which is not the worker profile`);
      }
    }
    if (
      s.Effect === "Allow" &&
      list(s.Resource).includes("*") &&
      list(s.Action).some((a) => /^(dynamodb|sqs|s3|secretsmanager|lambda|bedrock):/.test(a))
    )
      problems.push(`worker statement ${s.Sid} allows * on ${list(s.Action).join(",")}`);
  }
  const ledgerWrites = stmts.filter((s) =>
    list(s.Action).some((a) => a === "dynamodb:PutItem" || a === "dynamodb:UpdateItem"),
  );
  for (const s of ledgerWrites)
    if (!s.Condition?.["ForAllValues:StringLike"]?.["dynamodb:LeadingKeys"])
      problems.push("worker ledger writes are not limited by key prefix");
  if (
    ledgerWrites.some((s) =>
      s.Condition["ForAllValues:StringLike"]["dynamodb:LeadingKeys"].some((k) =>
        /^(CONFIG|DEPT|SPEC|Q#|APPROVED)/.test(k),
      ),
    )
  )
    problems.push("worker may write settings, departments, specialists, questions or owner approvals");
  if (
    !workspacePolicy().every(
      (s) =>
        list(s.Resource).every((r) => r.includes("${aws:PrincipalTag/hire_id}") || r.startsWith("arn:aws:kms")) ||
        s.Sid === "ListOwnHirePrefixOnly",
    )
  )
    problems.push("workspace access is not limited to the hire's own prefix");
  return problems;
}

export function checkBoundaries() {
  const problems = [];
  const dir = join(ROOT, "infra", "modules");
  for (const m of readdirSync(dir)) {
    let text;
    try {
      text = readFileSync(join(dir, m, "main.tf"), "utf8");
    } catch {
      continue;
    }
    for (const r of text.matchAll(/resource "aws_iam_role" "(\w+)" \{([\s\S]*?)\n\}/g))
      if (!/permissions_boundary\s*=/.test(r[2]))
        problems.push(`${m}: aws_iam_role.${r[1]} has no permission boundary`);
  }
  return problems;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = [...checkWorker(), ...checkBoundaries()];
  if (problems.length) {
    console.error(`IAM check failed (${problems.length}):\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(
    "IAM check passed: workers have no IAM, no wildcard secrets, no resource-creating actions, Bedrock only on the worker profile; every role has a permission boundary.",
  );
}

#!/usr/bin/env node
// IAM check: renders each agent role's policy templates (infra/modules/agents/policies) the way
// Terraform's templatefile does, with sample values, and asserts the worker's limits:
// no IAM actions, no wildcard GetSecretValue, no resource-creation actions, and Bedrock invoke only
// on the worker's own model profile. It also checks that every role has a permission boundary, and the
// connectors/mail/skills policies written inline in Terraform (jsonencode statements, read from the HCL):
// no Identity credential or Secrets Manager access for the worker or the MCP host, the MCP host role only
// writes logs (and pulls its image), only the bridge and the connectors Lambda read connector secrets, only
// the gateway role invokes the bridge, and the mail read path is never given to the worker.
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

// ---------- inline Terraform policies (connectors, mail, skills) ----------
const MODULES = join(ROOT, "infra", "modules");
const tf = (m) => readFileSync(join(MODULES, m, "main.tf"), "utf8");

/** Matching close brace/bracket for the opener at i (strings respected). */
function close(text, i) {
  const open = text[i];
  const shut = open === "{" ? "}" : "]";
  let depth = 0;
  for (let j = i, inStr = false; j < text.length; j++) {
    const c = text[j];
    if (inStr) {
      if (c === "\\") j++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === shut && --depth === 0) return j;
  }
  return -1;
}

/** Every `{ … Action = … }` object in HCL text, with its actions, the rest of its text, and its offset. */
export function hclStatements(text) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(/\bAction\s*=/g)) {
    let depth = 0,
      start = -1;
    for (let i = m.index; i >= 0; i--) {
      const c = text[i];
      if (c === "}" || c === "]") depth++;
      else if (c === "{" || c === "[") {
        if (depth === 0 && c === "{") {
          start = i;
          break;
        }
        if (depth > 0) depth--;
      }
    }
    if (start < 0 || seen.has(start)) continue;
    seen.add(start);
    const end = close(text, start);
    const body = text.slice(start, end + 1);
    const a = /\bAction\s*=\s*(\[[^\]]*\]|"[^"]*")/.exec(body);
    const actions = a ? [...a[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
    out.push({ start, body, actions, rest: a ? body.replace(a[0], "") : body });
  }
  return out;
}

/** Resolve `local.x` names in a statement to the text of their definitions (one-line locals). */
export function resolveLocals(text, body) {
  return body.replace(/local\.(\w+)/g, (all, k) => {
    const d = new RegExp(`^\\s*${k}\\s*=\\s*(.+)$`, "m").exec(text);
    return d ? `${all}(${d[1]})` : all;
  });
}

const IDENTITY_CREDENTIALS =
  /^bedrock-agentcore:(GetResource|CompleteResourceTokenAuth|GetWorkloadAccessToken|\w*CredentialProvider|\w*TokenVault)/;

/** The ranges of one function's list inside a module's `permissions = { … }` map. */
function permissionRange(text, fn) {
  const m = new RegExp(`^\\s*${fn}\\s*=\\s*\\[`, "m").exec(text.slice(text.indexOf("permissions = {")));
  if (!m) return [-1, -1];
  const s = text.indexOf("permissions = {") + m.index + m[0].length - 1;
  return [s, close(text, s)];
}
const inRange = (st, [a, b]) => st.start > a && st.start < b;

export function checkInline({
  read = tf,
  modules = readdirSync(MODULES),
  prod = readFileSync(join(ROOT, "infra", "envs", "prod", "main.tf"), "utf8"),
} = {}) {
  const problems = [];
  const conn = read("connectors");
  const mail = read("mail");

  // The MCP host role: its own log group and image, nothing else.
  const hostPolicy = blocks(conn, "aws_iam_role_policy", "mcp_host");
  if (!hostPolicy) problems.push("connectors: aws_iam_role_policy.mcp_host is missing");
  for (const s of hclStatements(hostPolicy ?? ""))
    for (const a of s.actions)
      if (!/^(logs:|ecr:(BatchGetImage|GetDownloadUrlForLayer|GetAuthorizationToken)$|kms:Decrypt$)/.test(a))
        problems.push(`MCP host role has ${a}; it may only write logs and pull its image`);

  // Only the bridge (and the connectors Lambda, which runs the same code at sync) read connector secrets.
  const allowed = [permissionRange(conn, "connector-bridge"), permissionRange(conn, "connectors")];
  for (const m of modules) {
    let text;
    try {
      text = read(m);
    } catch {
      continue;
    }
    for (const s of hclStatements(text)) {
      const res = resolveLocals(text, s.rest);
      const readsConnectorSecrets =
        s.actions.includes("secretsmanager:GetSecretValue") &&
        /aic\/prod\/connectors|!default\/apikey\/aic-conn/.test(res);
      if (readsConnectorSecrets && !(m === "connectors" && allowed.some((r) => inRange(s, r))))
        problems.push(`${m}: a statement outside the bridge reads connector secrets`);
      const invokesBridge = s.actions.includes("lambda:InvokeFunction") && /connector-bridge|bridge_arn/.test(res);
      if (invokesBridge && !(m === "connectors" && blocks(conn, "aws_iam_role_policy", "gateway")?.includes(s.body)))
        problems.push(`${m}: a role other than the gateway role may invoke the bridge`);
      if (
        ["connectors", "mail", "skills"].includes(m) &&
        !/Effect\s*=\s*"Deny"/.test(s.body) &&
        s.actions.some((a) => a === "*" || a.endsWith(":*"))
      )
        problems.push(`${m}: wildcard action in ${s.actions.join(",")}`);
    }
  }

  // The worker: nothing from the mail module, and nothing but InvokeGateway / skill reads from the others.
  if (!/!contains\(keys\(var\.reader_role_names\), "worker"\)/.test(mail))
    problems.push("mail: reader_role_names must refuse the worker role (validation)");
  if (!/reader_role_names\s*=\s*\{[^}]*if r != "worker"/.test(prod))
    problems.push("envs/prod: the mail read path must leave out the worker role");
  for (const [m, name] of [
    ["connectors", "runtime_gateway"],
    ["skills", "runtime_read"],
  ]) {
    for (const s of hclStatements(blocks(read(m), "aws_iam_role_policy", name) ?? ""))
      for (const a of s.actions)
        if (IDENTITY_CREDENTIALS.test(a) || a.startsWith("secretsmanager:"))
          problems.push(`${m}: runtime roles (the worker too) get ${a}`);
  }
  // And the worker's own templates: no Identity credentials, and workload tokens only for the runtimes' identities.
  for (const s of rolePolicies("worker"))
    for (const a of list(s.Action))
      if (IDENTITY_CREDENTIALS.test(a) && !/^bedrock-agentcore:GetWorkloadAccessToken/.test(a))
        problems.push(`worker has Identity credential action ${a}`);
      else if (
        /GetWorkloadAccessToken/.test(a) &&
        list(s.Resource).some((r) => /workload-identity\/(\*|aic-prod)/.test(r))
      )
        problems.push("worker may mint workload tokens for the connectors or mail identities");
  return problems;
}

/** The body of one `resource "<type>" "<name>"` block in HCL text. */
function blocks(text, type, name) {
  const m = new RegExp(`^resource "${type}" "${name}" \\{`, "m").exec(text);
  if (!m) return null;
  const s = m.index + m[0].length - 1;
  return text.slice(s, close(text, s) + 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const problems = [...checkWorker(), ...checkBoundaries(), ...checkInline()];
  if (problems.length) {
    console.error(`IAM check failed (${problems.length}):\n${problems.join("\n")}`);
    process.exit(1);
  }
  console.log(
    "IAM check passed: workers have no IAM, no wildcard secrets, no resource-creating actions, Bedrock only on the worker profile; every role has a permission boundary; the MCP host only logs, only the bridge reads connector secrets and only the gateway invokes it, and the worker gets no mail, Identity credentials or connector secrets.",
  );
}

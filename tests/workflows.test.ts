// Guards for the workflows: ci.yml runs only by hand; deploy.yml deploys prod on every push to main
// (the owner's choice, no approval) and from nowhere else; the OIDC trust is limited to the owner's repo.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const WF = join(ROOT, ".github", "workflows");
const files = readdirSync(WF).filter((f) => /\.ya?ml$/.test(f));

/** The `on:` block of a workflow, as the lines under it. */
function triggers(text: string): string[] {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^on:\s*$/.test(l) || /^on:\s*\S/.test(l));
  if (i < 0) return [];
  if (/^on:\s*\S/.test(lines[i]!)) return [lines[i]!.replace(/^on:\s*/, "")];
  const out: string[] = [];
  for (const l of lines.slice(i + 1)) {
    if (/^\S/.test(l)) break;
    const m = /^ {2}([a-z_]+):/.exec(l);
    if (m) out.push(m[1]!);
  }
  return out;
}

describe("GitHub workflows", () => {
  it("exist: ci.yml, deploy.yml, the desktop app's desktop.yml and the iPhone app's ios-testflight.yml", () => {
    expect(files.sort()).toEqual(["ci.yml", "deploy.yml", "desktop.yml", "ios-testflight.yml"]);
  });
  it("ios-testflight.yml builds only the iPhone app: pushes to main touching ios/, never AWS", () => {
    const text = readFileSync(join(WF, "ios-testflight.yml"), "utf8");
    expect(triggers(text)).toEqual(["push", "workflow_dispatch"]);
    expect(text).toMatch(/branches: \[main\]/);
    expect(text).toMatch(/paths: \["ios\/\*\*"/);
    expect(text).not.toMatch(/aws-actions|id-token: write|role-to-assume|terraform|\baws /);
    expect(text).toMatch(/permissions:\s*\n\s*contents: read/);
    // The App Store Connect key lives only in a temp file that is removed at the end.
    expect(text).toMatch(/rm -rf "\$RUNNER_TEMP\/asc"/);
  });
  it("ci.yml is started only by hand (workflow_dispatch)", () => {
    const text = readFileSync(join(WF, "ci.yml"), "utf8");
    expect(triggers(text)).toEqual(["workflow_dispatch"]);
    expect(text).not.toMatch(/^\s+(push|pull_request|schedule|workflow_run|pull_request_target):/m);
  });
  it("deploy.yml runs on pushes to main (and by hand), never on pull requests or forks", () => {
    const text = readFileSync(join(WF, "deploy.yml"), "utf8");
    expect(triggers(text)).toEqual(["push", "workflow_dispatch"]);
    expect(text).toMatch(/push:\n\s+branches: \[main\]\n/);
    expect(text).not.toMatch(/^\s+(pull_request|pull_request_target|schedule|workflow_run):/m);
    expect(text).toMatch(/github\.ref == 'refs\/heads\/main'/);
    expect(text).toMatch(/terraform apply -input=false prod\.tfplan/); // exactly the plan the run made
    expect(text).toMatch(/id-token: write/);
    expect(text).not.toMatch(/AWS_SECRET_ACCESS_KEY|aws-access-key-id/);
  });
  it("ci never touches AWS", () => {
    const text = readFileSync(join(WF, "ci.yml"), "utf8");
    expect(text).not.toMatch(/configure-aws-credentials|id-token: write|terraform apply|aws /);
  });
  it("deploy needs only the deploy role ARN and the owner's email (the rest is optional)", () => {
    const text = readFileSync(join(WF, "deploy.yml"), "utf8");
    const vars = new Set([...text.matchAll(/vars\.([A-Z0-9_]+)/g)].map((m) => m[1]));
    // Each setting is read as VAIC_* first, then the old AIC_* name, until the owner has renamed them (docs/RENAME_PLAN.md).
    const names = [
      "APNS_ENABLED",
      "QUEUES_ENABLED",
      "DEPLOY_ROLE_ARN",
      "MAIL_PROVIDERS",
      "MONTHLY_BUDGET_USD",
      "REGION",
      "STATE_BUCKET",
    ];
    expect([...vars].sort()).toEqual(names.flatMap((n) => [`VAIC_${n}`, `AIC_${n}`]).sort());
    // The owner email is a secret so it is masked in this public repository's logs.
    const secrets = new Set([...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]));
    expect([...secrets].sort()).toEqual(["AIC_OWNER_EMAIL", "VAIC_OWNER_EMAIL"]);
    expect(text).toMatch(/scripts\/ensure-state-bucket\.sh/); // the state bucket is created on the first run
    expect(text).toMatch(/STATE_BUCKET \|\| 'lamo-labs-state-bucket'/);
    expect(text).not.toMatch(/infra\/envs\/prod\/plan\.txt/); // the full plan stays in the masked log, not in an artifact
  });
  it("the deploy role trust allows only this repo's main branch and production environment", () => {
    // GitHub's immutable subject format: owner and repository IDs, so a renamed or re-created repo can't match.
    const doc = JSON.parse(readFileSync(join(ROOT, "docs", "deploy-role-trust-policy.json"), "utf8"));
    const cond = doc.Statement[0].Condition;
    expect(cond.StringEquals["token.actions.githubusercontent.com:aud"]).toBe("sts.amazonaws.com");
    expect(cond.StringEquals["token.actions.githubusercontent.com:sub"].sort()).toEqual(
      [
        "repo:Lamo2real@143636021/ai-city-aws@1448210802:environment:production",
        "repo:Lamo2real@143636021/ai-city-aws@1448210802:ref:refs/heads/main",
      ].sort(),
    );
    expect(cond.StringLike).toBeUndefined();
    expect(JSON.stringify(doc)).not.toMatch(/repo:[^"]*\*/);
  });
  it("the apply job unpacks the saved plan where terraform runs (infra/envs/prod)", () => {
    const text = readFileSync(join(WF, "deploy.yml"), "utf8");
    expect(text).toMatch(/download-artifact@v4\n\s+with:\n\s+name: prod-plan\n(\s+#.*\n)?\s+path: infra\/envs\/prod\n/);
  });
  it("one reviewed plan deploys from nothing: the image is pushed inside apply, before the runtimes", () => {
    const tf = readFileSync(join(ROOT, "infra", "modules", "agents", "main.tf"), "utf8");
    expect(tf).toMatch(/resource "terraform_data" "image"/);
    expect(tf).toMatch(/scripts\/push-image\.sh/);
    expect(tf).toMatch(/depends_on\s+= \[terraform_data\.image\]/);
  });
  it("checks, images and plan run side by side; apply waits for all of them (decision 263)", () => {
    const text = readFileSync(join(WF, "deploy.yml"), "utf8");
    expect(text).toMatch(/\n {2}apply:\n {4}needs: \[web, backend, build, image, plan\]\n/);
    expect(text).toMatch(/\n {2}plan:\n {4}needs: build\n/);
    expect(text).toMatch(/\n {2}image:\n {4}needs: build\n {4}runs-on: ubuntu-24\.04-arm\n/); // native ARM64, no QEMU
    expect(text).toMatch(/uv run pytest -q -n auto/);
    // The deploy queue is kept: one run at a time, never cancelled half-way.
    expect(text).toMatch(/concurrency:\n {2}group: deploy-prod\n {2}cancel-in-progress: false\n/);
  });
  it("Lambda code comes from S3, so the AWS provider updates every function in parallel", () => {
    const tf = ["api", "files", "knowledge", "connectors"]
      .map((m) => readFileSync(join(ROOT, "infra", "modules", m, "main.tf"), "utf8"))
      .join("\n");
    expect(tf).not.toMatch(/^\s+filename\s+=/m); // a local zip makes the provider upload one function at a time
    expect(tf).toMatch(/resource "aws_s3_object" "bundle"/);
  });
  it("version.json is never cached for a year: uploaded no-cache after index.html and invalidated", () => {
    const text = readFileSync(join(WF, "deploy.yml"), "utf8");
    expect(text).toMatch(/s3 sync web\/dist[^\n]*--exclude version\.json/);
    expect(text).toMatch(/s3 cp web\/dist\/version\.json "s3:\/\/\$\{BUCKET\}\/version\.json" --cache-control "no-cache"/);
    expect(text.indexOf("web/dist/index.html")).toBeLessThan(text.indexOf("web/dist/version.json"));
    expect(text).toMatch(/create-invalidation[^\n]*"\/version\.json"/);
  });
});

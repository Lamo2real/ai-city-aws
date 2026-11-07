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
  it("exist: ci.yml and deploy.yml", () => {
    expect(files.sort()).toEqual(["ci.yml", "deploy.yml"]);
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
    expect([...vars].sort()).toEqual(
      ["AIC_DEPLOY_ROLE_ARN", "AIC_MAIL_PROVIDERS", "AIC_MONTHLY_BUDGET_USD", "AIC_REGION", "AIC_STATE_BUCKET"].sort(),
    );
    // The owner email is a secret so it is masked in this public repository's logs.
    const secrets = new Set([...text.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]));
    expect([...secrets]).toEqual(["AIC_OWNER_EMAIL"]);
    expect(text).toMatch(/scripts\/ensure-state-bucket\.sh/); // the state bucket is created on the first run
    expect(text).toMatch(/AIC_STATE_BUCKET \|\| 'lamo-labs-state-bucket'/);
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
});

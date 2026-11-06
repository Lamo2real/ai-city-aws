// Guards for "nothing runs by itself": every workflow is workflow_dispatch only, deploys need the
// owner's approval, and the OIDC trust is limited to the owner's repo and main.
import { execFileSync } from "node:child_process";
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
  it.each(files)("%s is started only by hand (workflow_dispatch)", (f) => {
    const text = readFileSync(join(WF, f), "utf8");
    expect(triggers(text)).toEqual(["workflow_dispatch"]);
    expect(text).not.toMatch(/^\s+(push|pull_request|schedule|workflow_run|pull_request_target):/m);
  });
  it("deploy applies only after the owner's approval on the production environment, from main", () => {
    const text = readFileSync(join(WF, "deploy.yml"), "utf8");
    expect(text).toMatch(/environment: production/);
    expect(text).toMatch(/github\.ref == 'refs\/heads\/main'/);
    expect(text).toMatch(/terraform apply -input=false prod\.tfplan/); // the reviewed plan, exactly
    expect(text).toMatch(/id-token: write/);
    expect(text).not.toMatch(/AWS_SECRET_ACCESS_KEY|aws-access-key-id/);
  });
  it("ci never touches AWS", () => {
    const text = readFileSync(join(WF, "ci.yml"), "utf8");
    expect(text).not.toMatch(/configure-aws-credentials|id-token: write|terraform apply|aws /);
  });
  it("the OIDC deploy role trusts only the owner's repo, main and the production environment", () => {
    const tf = readFileSync(join(ROOT, "infra", "bootstrap", "main.tf"), "utf8");
    expect(tf).toMatch(/repo:\$\{var\.github_repo\}:environment:production/);
    expect(tf).toMatch(/\.github\/workflows\/deploy\.yml@refs\/heads\/main/);
    expect(tf).not.toMatch(/repo:\*|"repo:\$\{var\.github_repo\}:\*"/);
  });
});

describe("commits", () => {
  it("every commit message ends with [skip ci]", () => {
    let log: string;
    try {
      log = execFileSync("git", ["log", "--format=%B%x00"], { cwd: ROOT, encoding: "utf8" });
    } catch {
      return; // not a git checkout (e.g. a source tarball): nothing to check
    }
    const messages = log
      .split("\0")
      .map((m) => m.trim())
      .filter(Boolean);
    for (const m of messages) expect(m.split("\n")[0], m).toMatch(/\[skip ci\]$/);
  });
});

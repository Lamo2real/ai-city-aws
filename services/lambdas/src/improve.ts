// The weekly self-improvement loop, ported from upstream improve.ts and fenced harder. It is built
// and disabled: it runs only when AIC_SELF_IMPROVE=on (Terraform never sets it), and even then a
// change touching infra/, IAM, spend caps, the policy file or CI is refused outright.
export function improvementAllowed(env: NodeJS.ProcessEnv): { ok: true } | { ok: false; why: string } {
  if (env.AIC_SELF_IMPROVE !== "on") return { ok: false, why: "the self-improvement loop is disabled" };
  return { ok: true };
}

const FORBIDDEN = [
  /^infra\//,
  /^\.github\//,
  /^config\/(policy|caps)\.json$/,
  /(^|\/)iam[^/]*\.(tf|json)$/,
  /(^|\/)package(-lock)?\.json$/,
  /^packages\/shared\/src\/(policy|caps|guard)\.ts$/,
  /^scripts\/check-(tags|iam)\.mjs$/,
];

/** True when a changed path may never be changed by the loop. Existing tests are barred too. */
export function barred(change: { status: string; path: string }): boolean {
  const p = change.path.replace(/\\/g, "/").replace(/^\.\//, "");
  if (FORBIDDEN.some((re) => re.test(p.toLowerCase()) || re.test(p))) return true;
  return /(^|\/)tests?\/|\.test\.[a-z]+$/.test(p) && change.status !== "A";
}

export function reviewChanges(changes: Array<{ status: string; path: string }>): { ok: boolean; refused: string[] } {
  const refused = changes.filter(barred).map((c) => c.path);
  return { ok: refused.length === 0, refused };
}

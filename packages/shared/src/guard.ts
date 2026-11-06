// The startup guard: every runtime calls this before anything else. The product bills only through
// Amazon Bedrock with the execution role's credentials; anything else is refused.
export const FORBIDDEN_ENV = [
  "ANTHROPIC_API_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "AWS_BEARER_TOKEN_BEDROCK",
  "CLAUDE_CODE_USE_ANTHROPIC_AWS",
] as const;

export class StartupRefused extends Error {
  override name = "StartupRefused";
}

export function startupGuard(env: NodeJS.ProcessEnv = process.env): void {
  if (env.CLAUDE_CODE_USE_BEDROCK !== "1") {
    throw new StartupRefused(
      "Refusing to start: CLAUDE_CODE_USE_BEDROCK must be 1. AI City runs only on Amazon Bedrock.",
    );
  }
  // A value is never printed: only the variable's name.
  const found = FORBIDDEN_ENV.filter((k) => env[k] !== undefined && env[k] !== "");
  if (found.length) {
    throw new StartupRefused(
      `Refusing to start: ${found.join(", ")} must not be set. Bedrock is reached through the IAM role only.`,
    );
  }
  if (env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB === "0") {
    throw new StartupRefused("Refusing to start: CLAUDE_CODE_SUBPROCESS_ENV_SCRUB must stay on for worker shells.");
  }
}

/** The environment every agent process gets, on top of the role's own. */
export function bedrockEnv(region: string): Record<string, string> {
  return {
    CLAUDE_CODE_USE_BEDROCK: "1",
    AWS_REGION: region,
    CLAUDE_CODE_DISABLE_1M_CONTEXT: "1",
    CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
  };
}

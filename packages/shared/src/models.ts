// The one mapping module from roles to models. Ledger, caps and prices use the plain names;
// only this file and config/models.json know Bedrock IDs.
import { MODELS_CONFIG } from "./config.ts";

export type Role = "ace" | "orchestrator" | "manager" | "worker" | "utility";
export const ROLES: readonly Role[] = ["ace", "orchestrator", "manager", "worker", "utility"];
export type ModelName = "sonnet-5-5" | "opus-5-5" | "fable-5-1" | "haiku-5-5";
export type ProfilePrefix = "global" | "us" | "eu";
export type CacheTtl = "5m" | "1h";

export interface ModelsConfig {
  profilePrefix: string;
  models: Record<string, { label: string; modelId: string; prefixes: string[] }>;
  roles: Record<string, { model: string; fallback: string | null; cacheTtl: string }>;
}

export interface ResolvedModel {
  name: ModelName;
  label: string;
  /** System inference profile ID, e.g. "<prefix>.<modelId>". */
  profileId: string;
  /** What to pass as the model: the role's application inference profile ARN when one exists, else profileId. */
  invokeId: string;
}

export interface RoleModels {
  role: Role;
  primary: ResolvedModel;
  /** One retry target on refusal / no verdict / unavailable. Null when the role has none. */
  fallback: ResolvedModel | null;
  cacheTtl: CacheTtl;
  /** True when the configured model is not reachable with this prefix and the fallback became primary. */
  degraded: boolean;
}

export interface ResolveOptions {
  prefix?: ProfilePrefix;
  /** role -> application inference profile ARN, from Terraform outputs via environment. */
  applicationProfiles?: Partial<Record<Role, string>>;
  config?: ModelsConfig;
}

function resolveName(name: string, prefix: ProfilePrefix, cfg: ModelsConfig, appArn?: string): ResolvedModel | null {
  const m = cfg.models[name];
  if (!m) throw new Error(`unknown model name: ${name}`);
  if (!m.prefixes.includes(prefix)) return null;
  const profileId = `${prefix}.${m.modelId}`;
  return { name: name as ModelName, label: m.label, profileId, invokeId: appArn ?? profileId };
}

export function resolveRole(role: Role, opts: ResolveOptions = {}): RoleModels {
  const cfg = opts.config ?? (MODELS_CONFIG as ModelsConfig);
  const prefix = (opts.prefix ?? cfg.profilePrefix) as ProfilePrefix;
  const r = cfg.roles[role];
  if (!r) throw new Error(`unknown role: ${role}`);
  const appArn = opts.applicationProfiles?.[role];
  const primary = resolveName(r.model, prefix, cfg, appArn);
  // An application profile copies one model, so a fallback model is always called through its system profile.
  const fallback = r.fallback ? resolveName(r.fallback, prefix, cfg) : null;
  if (primary) return { role, primary, fallback, cacheTtl: r.cacheTtl as CacheTtl, degraded: false };
  if (!fallback) throw new Error(`${r.model} is not available on ${prefix}. profiles and ${role} has no fallback`);
  return { role, primary: fallback, fallback: null, cacheTtl: r.cacheTtl as CacheTtl, degraded: true };
}

/** Environment-driven resolution used inside Lambdas and the runtime container. */
export function resolveRoleFromEnv(role: Role, env: NodeJS.ProcessEnv = process.env): RoleModels {
  const prefix = (env.AIC_PROFILE_PREFIX as ProfilePrefix | undefined) ?? undefined;
  const key = `AIC_APP_PROFILE_${role.toUpperCase()}`;
  const arn = env[key];
  return resolveRole(role, { prefix, applicationProfiles: arn ? { [role]: arn } : {} });
}

export const modelLabel = (name: string): string => (MODELS_CONFIG as ModelsConfig).models[name]?.label ?? name;

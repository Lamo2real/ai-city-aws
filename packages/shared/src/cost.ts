// Cost math in plain model names. Every figure is an estimate; the AWS bill is the truth.
import { MODELS_CONFIG } from "./config.ts";
import type { CacheTtl, ProfilePrefix } from "./models.ts";

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  /** Cache writes split by TTL, because the 1-hour cache costs more to write. */
  cacheWrite5m: number;
  cacheWrite1h: number;
}
export const ZERO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };

interface PriceCfg {
  prices: Record<string, { input: number; output: number; cacheRead: number }>;
  cacheWriteMultiplier: Record<CacheTtl, number>;
  geoSurchargePct: number;
  longContext: Record<string, { thresholdTokens: number; multiplier: number }>;
}
const cfg = MODELS_CONFIG as unknown as PriceCfg;

export const totalTokens = (u: Usage): number => u.input + u.output + u.cacheRead + u.cacheWrite5m + u.cacheWrite1h;
/** Prompt size as the long-context tier measures it: everything sent in. */
export const promptTokens = (u: Usage): number => u.input + u.cacheRead + u.cacheWrite5m + u.cacheWrite1h;

export function estimateUsd(model: string, u: Usage, prefix: ProfilePrefix = "global"): number {
  const p = cfg.prices[model];
  if (!p) throw new Error(`no price for ${model}`);
  const perTok = (n: number, rate: number) => (n * rate) / 1_000_000;
  let total =
    perTok(u.input, p.input) +
    perTok(u.output, p.output) +
    perTok(u.cacheRead, p.cacheRead) +
    perTok(u.cacheWrite5m, p.input * cfg.cacheWriteMultiplier["5m"]) +
    perTok(u.cacheWrite1h, p.input * cfg.cacheWriteMultiplier["1h"]);
  const long = cfg.longContext[model];
  if (long && promptTokens(u) > long.thresholdTokens) total *= long.multiplier;
  if (prefix !== "global") total *= 1 + cfg.geoSurchargePct / 100;
  return total;
}

/** What caching saved on this turn compared with sending the cached tokens as plain input. */
export function cacheSavingsUsd(model: string, u: Usage, prefix: ProfilePrefix = "global"): number {
  if (!cfg.prices[model]) return 0;
  const without = estimateUsd(model, { ...u, input: u.input + u.cacheRead, cacheRead: 0 }, prefix);
  return Math.max(0, without - estimateUsd(model, u, prefix));
}

export const formatUsd = (v: number): string => `$${v.toFixed(2)}`;

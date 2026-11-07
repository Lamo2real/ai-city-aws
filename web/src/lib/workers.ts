// Who is at a desk right now: the live workers the City draws in the office windows. Used by the
// "Send everyone home" button, which must say how many it is about to send and go quiet when it is nobody.
import type { CityState } from "../city/city-state.js";

export function workersAtWork(city: CityState): number {
  // Everyone the City draws at a desk: active or dormant, but not retired or released.
  return Object.values(city.agents ?? {}).filter(
    (a) => a.kind === "worker" && a.state !== "retired" && a.worker_state !== "released",
  ).length;
}

export function sendHomeQuestion(n: number): string {
  return `Send all ${n} worker${n === 1 ? "" : "s"} home? They'll drop what they're doing.`;
}

export function sentHomeLine(r: { workers: number; parts: number }): string {
  if (r.workers === 0) return "Nobody was at work.";
  const w = `Sent ${r.workers} worker${r.workers === 1 ? "" : "s"} home.`;
  return r.parts ? `${w} ${r.parts} part${r.parts === 1 ? "" : "s"} will wait for a new worker.` : w;
}

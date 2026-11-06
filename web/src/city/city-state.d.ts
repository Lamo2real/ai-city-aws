// Types for the ported city-state.js (only what the React HUD uses).
export interface CityAgent {
  id: string;
  kind: "core" | "manager" | "worker" | "specialist";
  role: string;
  department: string | null;
  model: string;
  parent: string | null;
  state: string;
  worker_state?: string | null;
  total_cost_usd?: number;
  ticket_id?: string | null;
}
export interface CityTicket {
  id: string;
  goal: string;
  from: string;
  to: string;
  status: string;
  department: string | null;
  updated_at?: string;
}
export interface CityQuestion {
  id: string;
  asked_by: string;
  path: string;
  text: string;
  options: string[];
  default_answer: string;
  created_at: string;
}
export interface CityApproval {
  id: string;
  agent: string;
  action: string;
  reason: string;
}
export interface FeedLine {
  at: number;
  text: string;
  kind: string;
}
export interface CityState {
  agents: Record<string, CityAgent>;
  tickets: Record<string, CityTicket>;
  parked: Record<string, CityTicket>;
  questions: Record<string, CityQuestion>;
  approvals: Record<string, CityApproval>;
  departments: Record<string, { name: string; mission?: string; manager_id?: string; state?: string; builtAt: number }>;
  usage: { usd: number; turns: number; tokens: number } | null;
  spend: Record<string, number>;
  caps: {
    daily_global_usd: number | null;
    monthly_budget_usd: number | null;
    daily_department_usd: number | null;
  } | null;
  city: { paused?: boolean; reason?: string | null; running?: number | null; waiting?: number | null } | null;
  capHit: { cap: string; limit: number; spent: number } | null;
  costs: Record<string, { usd: number; tokens: number }>;
  feed: FeedLine[];
  now: number;
}
export const CORE: Set<string>;
export const COST_NOTE: string;
export const MODEL_NAME: Record<string, string>;
export const MODEL_COLOR: Record<string, string>;
export const VISUALS: Record<string, { label: string; words: string; pose: string }>;
export function initialState(now?: number): CityState;
export function applySnapshot(state: CityState, snap: unknown, now?: number): CityState;
export function reduce(state: CityState, event: unknown, now?: number): CityState;
export function departmentNames(state: CityState): string[];
export function deptOf(agent: CityAgent): string;
export function deptColor(name: string): string;
export function visualState(state: CityState, id: string, now?: number): string;
export function agentStatus(state: CityState, id: string, now?: number): string;
export function placement(
  state: CityState,
  id: string,
): { place: "hq" | "station" | "home"; dept: string; why: string } | null;
export function topBar(state: CityState): {
  agentsTotal: number;
  agentsActive: number;
  ticketsRunning: number;
  questionsWaiting: number;
  parked: number;
  usage: CityState["usage"];
};
export function gateStatus(state: CityState): {
  known: boolean;
  running: number | null;
  waiting: number | null;
  paused: { reason: string | null } | null;
};
export function stockholmTime(t: number): string;
export function ticketWords(status: string): string;
export function plainText(text: string, max?: number): { short: string; whole: boolean };
export function cityMessage(state: CityState): string | null;

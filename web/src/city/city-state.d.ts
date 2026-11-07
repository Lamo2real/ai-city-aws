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
  /** "app.publish" for an app waiting to be published; then the fields below are set. */
  /** ``connector.add`` for an add-connector approval (the chat shows a connector card). */
  kind?: string;
  /** An email or event shown in full before approving (MAIL_CALENDAR.md §5.5). */
  preview?: { kind: string; [k: string]: unknown };
  draft_id?: string;
  preview_url?: string;
  title?: string;
  description?: string;
  department?: string;
  /** app.publish, v2: what the app asks to read, and whether its manifest suggests pinning it. */
  capabilities?: Array<{ id: string; connector?: string; tool?: string; label?: string }>;
  pin?: boolean;
  requested_by?: string;
  /** app.publish, v3: set when this is a new version of an existing app. */
  replaces?: string;
  version?: number;
}
/** An app the city built and the owner published (docs/APPS.md). Title and description are agent text. */
export interface CityApp {
  app_id: string;
  slug: string;
  title: string;
  description?: string;
  icon_url?: string | null;
  url: string;
  department?: string;
  task_id?: string;
  published_at?: string;
  /** v2: what the owner allowed it to read (docs/APPS.md "v2: data bridge"), and whether it sits in the top bar. */
  grants?: Array<{ id: string; connector?: string; tool?: string }>;
  granted_at?: string;
  pinned?: boolean;
  /** v3: the current version (1 when never updated) and the earlier ones kept for a rollback, newest first. */
  version?: number;
  history?: Array<{ version?: number; title?: string; published_at?: string }>;
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
  apps: Record<string, CityApp>;
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
export interface CityPoint {
  x: number;
  y: number;
}
export interface CityBuilding {
  dept: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [k: string]: unknown;
}
export interface CityBlock {
  x: number;
  y: number;
  w: number;
  h: number;
  floors: number;
  cap: number;
  from: number;
}
export interface CityWorld {
  buildings: CityBuilding[];
  streets: Array<{ y: number; x0: number; x1: number }>;
  avenue: number;
  homes: { x: number; y: number; w: number; h: number; houses: CityPoint[]; blocks: CityBlock[] };
  [k: string]: unknown;
}
export const TILE: number;
export function layout(
  state: CityState,
  opts?: { portrait?: boolean; seats?: Record<string, number>; houses?: number; residents?: number },
): CityWorld;
export function managerSpot(building: CityBuilding): CityPoint;
export function blockWindow(world: CityWorld, slot: number): { x: number; y: number; w: number; h: number } | null;
export const BLOCK_PER_FLOOR: number;
export const BLOCK_MAX_FLOORS: number;
export function seatSpot(building: CityBuilding, seat: number): CityPoint;
export function seatRows(building: CityBuilding): number;
export function homeSpot(world: CityWorld, slot: number): CityPoint | null;
export function doorOf(building: CityBuilding): CityPoint;
export function walkRoute(world: CityWorld, from: CityPoint, to: CityPoint): CityPoint[];
export function commuteRoute(
  world: CityWorld,
  from: CityPoint,
  to: CityPoint,
  opts?: { leaving?: CityBuilding | null; entering?: CityBuilding | null },
): CityPoint[];
export function walkSpeed(route: CityPoint[], from: CityPoint): number;
export const WALK_PX_S: number;
export const COMMUTE_MS: number;
export function staggerMs(i: number): number;
export function walksOut(state: CityState, id: string, walked: Set<string>): boolean;
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

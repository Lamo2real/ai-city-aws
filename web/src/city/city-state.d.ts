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
  kind?: string;
  parent_id?: string | null;
  owner_words?: string;
  created_at?: string;
  from: string;
  to: string;
  status: string;
  department: string | null;
  updated_at?: string;
}
export interface CityQuestion {
  id: string;
  ticket_id?: string;
  asked_by: string;
  path: string;
  text: string;
  options: string[];
  default_answer: string;
  created_at: string;
}
export interface CityApproval {
  id: string;
  ticket_id?: string;
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
  created_at?: string;
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
  /** The event in plain words for the Activity panel; `many` has {n} for a grouped burst. */
  story?: { key: string; one: string; many?: string };
}
export function stories(feed: FeedLine[], limit?: number): Array<{ at: number; text: string; kind: string }>;
export function plainWho(state: CityState, id: string): string;
export interface CityState {
  agents: Record<string, CityAgent>;
  /** What each agent did last ("understanding", "coding", "failed"…), with its line in words when there is one. */
  activities: Record<string, { activity: string; detail?: string | null; at?: string }>;
  tickets: Record<string, CityTicket>;
  parked: Record<string, CityTicket>;
  questions: Record<string, CityQuestion>;
  approvals: Record<string, CityApproval>;
  departments: Record<
    string,
    {
      name: string;
      mission?: string;
      manager_id?: string;
      state?: string;
      worker_model?: string | null;
      builtAt: number;
    }
  >;
  usage: { usd: number; turns: number; tokens: number } | null;
  spend: Record<string, number>;
  caps: {
    daily_global_usd: number | null;
    monthly_budget_usd: number | null;
    daily_department_usd: number | null;
  } | null;
  city: { running?: number | null; waiting?: number | null } | null;
  capHit: { cap: string; limit: number; spent: number } | null;
  costs: Record<string, { usd: number; tokens: number }>;
  feed: FeedLine[];
  apps: Record<string, CityApp>;
  /** Connected tools with their City signs (decision 173). */
  connectors?: Record<string, CityConnectorSign>;
  now: number;
}
/** A connected tool as the City draws it: the departments that use it and its logo in City pixels (decision 173). */
export interface CityConnectorSign {
  id: string;
  label?: string;
  status: string;
  departments?: string[];
  every_department?: boolean;
  /** ``px`` is size×size characters: "." see-through, "a"… index ``colors``. */
  sign?: { size: number; colors: string[]; px: string };
}
export interface PlaqueSlot {
  x: number;
  y: number;
  sign: CityConnectorSign | null;
  more: number;
}
export const PLAQUE: number;
export function signsFor(state: CityState, dept: string): CityConnectorSign[];
export function plaqueSlots(
  signs: CityConnectorSign[],
  geo: { baseX: number; baseW: number; cx: number; foot: number },
): PlaqueSlot[];
export const CORE: Set<string>;
export const COST_NOTE: string;
export const MODEL_NAME: Record<string, string>;
export const MODEL_COLOR: Record<string, string>;
export const VISUALS: Record<string, { label: string; words: string; pose: string }>;
export function initialState(now?: number): CityState;
export function applySnapshot(state: CityState, snap: unknown, now?: number): CityState;
export function reduce(state: CityState, event: unknown, now?: number): CityState;
export function departmentNames(state: CityState): string[];
/** The towers standing: a demolished one keeps its lot until the next snapshot but is not a department any more. */
export function standingDepartments(state: CityState): string[];
export function deptOf(agent: CityAgent): string;
export function deptColor(name: string): string;
/** A stable number from a string: the same look on every load. */
export function hashOf(s: string): number;
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
export interface CityWorld {
  buildings: CityBuilding[];
  lots: Array<CityPoint & { w: number; h: number; demolished?: string }>;
  streets: Array<{ y: number; x0: number; x1: number }>;
  /** The road west of HQ and the side streets between towers, each as long as it runs (decision 166). */
  lanes: Array<{ x: number; y0: number; y1: number }>;
  avenue: number;
  hq: CityBuilding;
  width: number;
  height: number;
  portrait: boolean;
  hqStreet: number;
  officesEnd: number;
  /** The neighbourhood (decision 188): blocks of three apartment buildings, and on a phone the footpaths between rows. */
  homes: {
    x: number;
    y: number;
    w: number;
    h: number;
    apartments: CityApartment[];
    blocks: Array<{ x: number; y: number; w: number; h: number; mirror: boolean }>;
    paths: number[];
    /** Grass and trees: the top of a deep block, or a phone's row with one block. */
    parks: Array<{ x: number; y: number; w: number; h: number }>;
  };
  [k: string]: unknown;
}
/** One New York style apartment building, in tiles; its door is doorOf(it). */
export interface CityApartment {
  kind: "slim" | "mid" | "wide";
  block: number;
  x: number;
  y: number;
  w: number;
  h: number;
}
export const TILE: number;
/** Home slots per block of three apartment buildings. */
export const HOMES_PER_BLOCK: number;
/** A tower's footprint and height in tiles, from its name alone (decision 166). */
export function towerSize(name: string, portrait?: boolean): { w: number; h: number };
export function layout(
  state: CityState,
  opts?: { portrait?: boolean; seats?: Record<string, number>; homes?: number },
): CityWorld;
export function seatSpot(building: CityBuilding, seat: number): CityPoint;
export function homeSpot(world: CityWorld, slot: number): CityPoint | null;
/** The apartment building a home slot is in. */
export function homeOf(world: CityWorld, slot: number): CityApartment | null;
export function doorOf(building: { x: number; y: number; w: number; h: number }): CityPoint;
export function walkRoute(world: CityWorld, from: CityPoint, to: CityPoint): CityPoint[];
export function commuteRoute(
  world: CityWorld,
  from: CityPoint,
  to: CityPoint,
  opts?: { leaving?: CityBuilding | CityApartment | null; entering?: CityBuilding | CityApartment | null },
): CityPoint[];
export function walkSpeed(route: CityPoint[], from: CityPoint): number;
export const WALK_PX_S: number;
export const COMMUTE_MS: number;
export function staggerMs(i: number): number;
export function walksOut(state: CityState, id: string, walked: Set<string>): boolean;
export function residents(state: CityState): { ids: string[]; hidden: number };
export function placement(
  state: CityState,
  id: string,
): { place: "hq" | "station" | "home"; dept: string; why: string } | null;
export function topBar(state: CityState): {
  agentsTotal: number;
  /** Workers on a job right now (not managers, the Orchestrator or VAIC). */
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
};
export function stockholmTime(t: number): string;
export function ticketWords(status: string): string;
export function plainText(text: string, max?: number): { short: string; whole: boolean };
export function cityMessage(state: CityState): string | null;

export function workersWorking(state: unknown): number;

// ---------- Departments on demand, taxis and the mailman (decision 134) ----------
export type CityAnim = { dept: string; kind: "rise" | "build" | "demolish"; start: number; dur?: number };
export const ANIM_MS: { rise: number; build: number; demolish: number };
export const RISE_STAGGER_MS: number;
export function animProgress(anim: { kind: string; start: number; dur?: number }, now: number): number;
export function entranceAnims(buildings: CityBuilding[], start: number): CityAnim[];
export function standFraction(kind: string, k: number): number;
export type CityMail = { dept: string; dir: "out" | "back"; ticket: string; letters?: number };
export function mailFor(event: unknown, state: CityState): CityMail | null;
export const MAIL_QUEUE_MAX: number;
export function enqueueMail(queue: CityMail[], mail: CityMail): CityMail[];
export const BIKE_PX_S: number;
export const BIKE_LEG_MS: number;
export function bikeSpeed(route: CityPoint[], from: CityPoint): number;
export function streetLanes(world: CityWorld): Array<{ y0: number; y1: number; x0: number; x1: number }>;
export const CAB_PX_S: number;
export const CAB_GAP_PX: number;
export const CAB_FADE_PX: number;
export const MAP_MARGIN: number;
export function edgeAlpha(pos: number, from: number, to: number): number;
export function avenueLanes(world: CityWorld): Array<{ x0: number; x1: number; y0: number; y1: number }>;
export type CityJunction = { id: string; street: number; road: number; cx: number; cy: number; kind: "light" | "roundabout" | "giveway"; offset?: number };
export type CityLane = { id: string; axis: "x" | "y"; dir: 1 | -1; at: number; from: number; to: number; span: number; len: number; townFrom: number; townTo: number; controls: Array<{ j: CityJunction; dc: number; entryD: number; exitD: number; entryAng: number; exitAng: number }> };
export type CityCar = { id: string; lane: CityLane | null; d: number; v: number; f: number; lap: number; rare: boolean; commit: string | null; stopFor: string | null; braking: boolean; ring: { j: CityJunction; ang: number; exitAng: number; toLane: CityLane; toD: number } | null };
export type CityGuest = { id?: string; x: number; y: number; vertical: boolean; commit: string | null; ring: { j: CityJunction; ang: number } | null };
export type CityTraffic = { world: CityWorld; lanes: CityLane[]; junctions: CityJunction[]; cars: CityCar[]; guests: CityGuest[]; t: number; rand: () => number; margin: number; arrivals: number; rareOffset: number };
export type CityRoutePoint = CityPoint & { ring?: string };
export type CityRider = { x: number; y: number; to?: CityRoutePoint | null; rv?: number; rare?: boolean; stopFor?: string | null; commit?: string | null; braking?: boolean; guest?: CityGuest | null; boost?: number };
export const RIDE_PX_S: number;
export const TO_WORK_BOOST: number;
export function roundaboutDetours(js: CityJunction[], route: CityPoint[], ride: boolean[], from: CityPoint): { route: CityRoutePoint[]; ride: boolean[] };
export function ringOf(sim: CityTraffic, r: CityRider): CityJunction | null;
export function rideHold(sim: CityTraffic, r: CityRider): number;
export function rideStep(sim: CityTraffic, r: CityRider, dt: number): number;
export type CityTrafficCar = { id: string; x: number; y: number; east: boolean; vertical: boolean; alpha: number; rare: boolean; braking: boolean; v: number; lane?: string; ring?: string };
export const TOWN_PX_S: number;
export const HIGHWAY_PX_S: number;
export const RING_PX_S: number;
export const ACCEL_PX_S2: number;
export const BRAKE_PX_S2: number;
export const CAR_GAP_PX: number;
export const JUNCTION_HALF: number;
export const STOP_AT: number;
export const RING_R: number;
export const SIGNAL_MS: { green: number; amber: number; allRed: number };
export const SIGNAL_CYCLE_MS: number;
export const RED_MS: number;
export type SignalColour = "green" | "amber" | "red";
export function signalAt(junction: { offset?: number }, t: number): { x: SignalColour; y: SignalColour };
export function throughRoads(world: CityWorld): Array<{ x: number; y0: number; y1: number }>;
export function junctions(world: CityWorld): CityJunction[];
export function createTraffic(world: CityWorld, seed?: string): CityTraffic;
export function stepTraffic(sim: CityTraffic, dtMs: number): void;
export function trafficCars(sim: CityTraffic): CityTrafficCar[];
export const RARE_CAB_ODDS: number;
export function arrive(sim: CityTraffic): boolean;
export const CAB_SHARE: number;
export function cabsPerLane(spans: number[]): number[];
export function rideLegs(world: CityWorld, route: CityPoint[], from: CityPoint): boolean[];
export const CALL_PX: number;
/** A taxi called for a new hire: it drives from `start` to the kerb `at`, where the ride's leg `leg` begins. */
export function taxiCall(world: CityWorld, route: CityPoint[], ride: boolean[], from: CityPoint): { at: CityPoint; start: CityPoint; leg: number } | null;

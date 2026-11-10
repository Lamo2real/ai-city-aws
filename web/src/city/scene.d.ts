import type { CityState } from "./city-state.js";

export interface CityScene {
  load(snapshot: unknown): void;
  onEvent(event: unknown): void;
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  select(id: string | null): void;
  focusBuilding(dept: string): void;
  /** The department's tower on the map (its slot, plot and size), or null. */
  building(dept: string): { dept: string; slot: number; x: number; y: number; w: number; h: number } | null;
  resume(): void;
  readonly state: CityState;
  readonly people: Map<string, { id: string; x: number; y: number; key: string }>;
  readonly view: { x: number; y: number; zoom: number };
}
export function mountCity(
  root: HTMLElement,
  opts: {
    canvas?: HTMLCanvasElement;
    insets?: () => { l: number; t: number; r: number; b: number };
    onSelectAgent?: (id: string | null) => void;
    onSelectBuilding?: (dept: string) => void;
    /** A published app's arcade cabinet was clicked. */
    onOpenApp?: (slug: string) => void;
    onState?: (state: CityState) => void;
  },
): CityScene;

/** An agent as a 14×21 pixel picture (a data URL): from the front, or seated from behind facing its monitor. */
export function agentSprite(
  agent: { id: string; kind: string; department: string | null },
  facing?: "front" | "back",
): string;
/** A tower's colours, as on the map. */
export function towerLook(
  dept: string,
  slot?: number,
): { wall: string; shade: string; trim: string; glass: string; accent: string; light: string; dark: string };

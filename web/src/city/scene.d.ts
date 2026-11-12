import type { CityState } from "./city-state.js";

export interface CityScene {
  load(snapshot: unknown): void;
  /** Before the first snapshot: HQ, roads and homes at once, remembered towers as blurred placeholders (decision 249). */
  preview(): void;
  onEvent(event: unknown): void;
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  select(id: string | null): void;
  focusBuilding(dept: string): void;
  /** Where the department's tower is on the screen, in CSS pixels from the City's corner, or null. */
  screenOf(dept: string): { x: number; y: number } | null;
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

/** A tower's colours, as on the map. */
export function towerLook(
  dept: string,
  slot?: number,
): { wall: string; shade: string; trim: string; glass: string; accent: string; light: string; dark: string };

/** A Department Manager's suit and sunglasses colours. */
export const SUIT: { jacket: string; lapel: string; shirt: string; shades: string; glint: string };
/** Paints one person (14×20 art pixels) onto a 2D context. */
export function paintFigure(g: { fillStyle: unknown; fillRect(x: number, y: number, w: number, h: number): void }, agent: { id: string; kind: string; department?: string }, pose: string, frame: number, stride?: number | null): void;

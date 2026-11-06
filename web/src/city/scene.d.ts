import type { CityState } from "./city-state.js";

export interface CityScene {
  load(snapshot: unknown): void;
  onEvent(event: unknown): void;
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
  select(id: string | null): void;
  focusBuilding(dept: string): void;
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
    onState?: (state: CityState) => void;
  },
): CityScene;

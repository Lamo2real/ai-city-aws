// The City scene for the iPhone app: the web HUD's own scene.js and city-state.js on a full-screen canvas,
// so the phone and the browser draw the same town from the same code. This page has no network access and
// never sees a token: the app passes it the /city snapshot and each WebSocket event, and the page sends back
// only what was tapped ({ type: "agent" | "building" | "none", id }).
import { mountCity } from "../city/scene.js";

type Post = { postMessage(m: unknown): void };
const native = (): Post | undefined =>
  (window as unknown as { webkit?: { messageHandlers?: { city?: Post } } }).webkit?.messageHandlers?.city;
const tell = (type: "agent" | "building" | "none" | "ready", id: string | null = null) =>
  native()?.postMessage({ type, id });

const root = document.getElementById("city")!;
const scene = mountCity(root, {
  canvas: root.querySelector("canvas")!,
  onSelectAgent: (id) => tell(id ? "agent" : "none", id),
  onSelectBuilding: (dept) => tell("building", dept),
});

const api = {
  /** A /city snapshot (the same JSON the web HUD loads). */
  load: (snap: unknown) => scene.load(snap),
  /** One WebSocket event. */
  event: (e: unknown) => scene.onEvent(e),
  zoomIn: () => scene.zoomIn(),
  zoomOut: () => scene.zoomOut(),
  fit: () => scene.fit(),
  select: (id: string | null) => scene.select(id),
  focusBuilding: (dept: string) => scene.focusBuilding(dept),
  /** The tab came back into view. */
  resume: () => scene.resume(),
};
Object.defineProperty(window, "vaicCity", { value: Object.freeze(api) });
tell("ready");

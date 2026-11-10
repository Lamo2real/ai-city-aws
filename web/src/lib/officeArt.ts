// A floor of a department's tower as pixel art (decision 166), drawn in code like the rest of the City: an
// isometric cutaway room with two walls of tall windows onto the skyline at dusk, desks with monitors, a
// bookshelf, plants, a printer and a water cooler, and the people as small realistic figures in office chairs:
// seen from behind at their monitor, or turned to face you.
import { hashOf } from "../city/city-state.js";

type G = CanvasRenderingContext2D;
const INK = "#14131f";
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const rng = (seed: string) => {
  let x = hashOf(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
};
const shade = (hex: string, f: number) =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;

// ---------- The floor's plan: an isometric room (2:1), in art pixels ----------
const TW = 24,
  TH = 12,
  ZS = 1.5, // heights are written for a 16-pixel tile and drawn half as tall again
  WALL = 68,
  SLAB = 8;
/** How far apart two floors of the stack are, in art pixels. */
export const FLOOR_PITCH = WALL + 14;
export interface FloorPlan {
  cols: number;
  rows: number;
  GX: number;
  GY: number;
  W: number;
  H: number;
  /** The floor's left corner, where its number hangs. */
  corner: { x: number; y: number };
  /** Where each desk's person sits (the foot of their chair), by desk number. */
  seats: Array<{ x: number; y: number; depth: number }>;
}
type Pt = [number, number];
const projector =
  (GY: number) =>
  (x: number, y: number, z = 0): Pt => [GY * TW + 1 + (x - y) * TW, WALL + 4 + (x + y) * TH - z * ZS];
const deskAt = (i: number, cols: number) => ({ x: 1.5 + (i % cols) * 3, y: 1.3 + Math.floor(i / cols) * 4 });
/** A room with `cols` desks across and `rows` rows of them: the same for every floor of a building. */
export function floorPlan(cols: number, rows: number): FloorPlan {
  const GX = 2 + cols * 3,
    GY = 1 + rows * 4,
    P = projector(GY);
  const seats = Array.from({ length: cols * rows }, (_, i) => {
    const d = deskAt(i, cols),
      [x, y] = P(d.x + 1, d.y + 1.5);
    return { x: Math.round(x), y: Math.round(y), depth: Math.round((d.x + d.y) * 10) };
  });
  return {
    cols,
    rows,
    GX,
    GY,
    W: (GX + GY) * TW + 2,
    H: (GX + GY) * TH + WALL + SLAB + 6,
    corner: { x: 2, y: Math.round(P(0, GY)[1]) + SLAB + 3 },
    seats,
  };
}

// Flat-shaded shapes with crisp pixel edges: a polygon filled row by row, and a box from three of them.
function poly(g: G, pts: Pt[], c: string) {
  g.fillStyle = c;
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
    const yc = y + 0.5,
      xs: number[] = [];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc))
        xs.push(a[0] + ((yc - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    });
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]!),
        xb = Math.round(xs[i + 1]!);
      if (xb > xa) g.fillRect(xa, y, xb - xa, 1);
    }
  }
}
type Proj = (x: number, y: number, z?: number) => Pt;
function box(g: G, P: Proj, x: number, y: number, w: number, d: number, z0: number, z1: number, c: string) {
  poly(g, [P(x, y + d, z1), P(x + w, y + d, z1), P(x + w, y + d, z0), P(x, y + d, z0)], shade(c, 0.82));
  poly(g, [P(x + w, y + d, z1), P(x + w, y, z1), P(x + w, y, z0), P(x + w, y + d, z0)], shade(c, 0.66));
  poly(g, [P(x, y, z1), P(x + w, y, z1), P(x + w, y + d, z1), P(x, y + d, z1)], c);
}
// A vertical face, one screen column at a time: `paint(x, base, u)` gets the column, its foot and how far along.
function columns(g: G, a: Pt, b: Pt, paint: (x: number, base: number, u: number) => void) {
  const x0 = Math.round(a[0]),
    x1 = Math.round(b[0]);
  for (let x = x0; x < x1; x++) {
    const u = (x - x0) / Math.max(1, x1 - x0);
    paint(x, Math.round(a[1] + (b[1] - a[1]) * u), u);
  }
}
const SKY = ["#f0b06a", "#de8a58", "#b05a62", "#7a416c", "#4d3368", "#33295c", "#22224a"]; // from the horizon up
const BOOKS = ["#b8485a", "#d9744a", "#e0b04a", "#4f8f7a", "#4f7fb8", "#7a5fb0", "#c9c2b4", "#8a3b4a", "#3f6f9a"];
// A wall with tall windows onto the skyline at dusk; `board` hangs a whiteboard on its first cells instead.
function wall(g: G, a: Pt, b: Pt, cells: number, c: string, seed: string, board = false) {
  const r = rng(seed),
    Z0 = 18,
    Z1 = 60;
  let tower = 0,
    lit = false;
  columns(g, a, b, (x, base, u) => {
    R(g, x, base - WALL, 1, WALL, c);
    R(g, x, base - WALL - 2, 1, 2, shade(c, 1.25));
    R(g, x, base - 6, 1, 6, shade(c, 0.7));
    const cell = u * cells,
      at = cell % 3;
    if (board && cell < 3) {
      if (cell > 0.5 && cell < 2.6) {
        const edge = cell < 0.62 || cell > 2.48;
        R(g, x, base - 54, 1, 33, edge ? INK : "#f1ede2");
        R(g, x, base - 55, 1, 1, INK);
        R(g, x, base - 21, 1, 1, INK);
        if (!edge && r() < 0.5) R(g, x, base - 50 + Math.floor(r() * 24), 1, 2, r() < 0.5 ? "#4f7fb8" : "#b8485a");
      }
      return;
    }
    if (at < 0.45 || at > 2.55 || cell > cells - 0.3) return;
    const edge = at < 0.56 || at > 2.44 || Math.abs(at - 1.5) < 0.06;
    if (edge) {
      R(g, x, base - Z1 - 1, 1, Z1 - Z0 + 2, "#2c2026");
      return;
    }
    const h = Z1 - Z0;
    SKY.forEach((sc, i) =>
      R(g, x, base - Z0 - Math.ceil(((i + 1) * h) / SKY.length), 1, Math.ceil(h / SKY.length), sc),
    );
    if (x % 7 === 0) {
      tower = 8 + Math.floor(r() * (h - 10));
      lit = r() < 0.7;
    }
    R(g, x, base - Z0 - tower, 1, tower, "#1f1c3a");
    if (lit && x % 2 === 0)
      for (let z = 3; z < tower - 2; z += 5) if (r() < 0.6) R(g, x, base - Z0 - z, 1, 3, "#ffb347");
    R(g, x, base - Z1 - 1, 1, 1, "#2c2026");
    R(g, x, base - Z0, 1, 1, "#2c2026");
  });
}
function plant(g: G, at: Pt, tall: number) {
  const [x, base] = [Math.round(at[0]), Math.round(at[1])];
  R(g, x - 4, base - 8, 8, 8, "#e8e2d2");
  R(g, x - 4, base - 8, 8, 2, "#fbf7f0");
  R(g, x + 2, base - 6, 2, 6, "#c9c2b4");
  for (let i = 0; i < tall; i += 3) {
    const sway = ((i / 3) % 2 ? 1 : -1) * (2 + (i % 5));
    R(g, x + sway - 3, base - 11 - i, 6, 3, i % 2 ? "#2f7a4c" : "#3f9a5c");
    R(g, x - sway - 2, base - 10 - i, 4, 2, "#256240");
  }
  R(g, x - 1, base - 12 - tall, 2, 3, "#3f9a5c");
}
function desk(g: G, P: Proj, x: number, y: number, seed: string, used: boolean) {
  const wood = "#e0a050",
    h = hashOf(seed);
  box(g, P, x, y, 0.14, 1, 0, 10, "#b87838");
  box(g, P, x + 1.25, y + 0.06, 0.6, 0.88, 0, 10, "#c98a44");
  box(g, P, x + 1.86, y, 0.14, 1, 0, 10, "#b87838");
  box(g, P, x - 0.06, y - 0.06, 2.12, 1.12, 10, 12, wood);
  // One monitor, or two side by side; the screens face the chair.
  const two = (h >>> 2) % 3 === 0;
  for (const mx of two ? [x + 0.2, x + 1.05] : [x + 0.55]) {
    const w = two ? 0.75 : 0.9;
    box(g, P, mx + w / 2 - 0.08, y + 0.14, 0.16, 0.12, 12, 15, "#3a3d52");
    box(g, P, mx, y + 0.18, w, 0.07, 15, 27, "#2c2e3c");
    const sc = used ? ["#3aa0d8", "#58d8e8", "#f2b33d"][(h >>> 5) % 3]! : "#1a1c28";
    poly(
      g,
      [
        P(mx + 0.05, y + 0.25, 26),
        P(mx + w - 0.05, y + 0.25, 26),
        P(mx + w - 0.05, y + 0.25, 17),
        P(mx + 0.05, y + 0.25, 17),
      ],
      used ? "#16263f" : sc,
    );
    if (used)
      for (let z = 24; z > 18; z -= 2)
        poly(
          g,
          [
            P(mx + 0.12, y + 0.25, z),
            P(mx + 0.2 + ((h >>> z) % 5) / 10, y + 0.25, z),
            P(mx + 0.2 + ((h >>> z) % 5) / 10, y + 0.25, z - 1),
            P(mx + 0.12, y + 0.25, z - 1),
          ],
          z % 4 ? sc : "#8fe08a",
        );
  }
  poly(
    g,
    [P(x + 0.6, y + 0.55, 12), P(x + 1.3, y + 0.55, 12), P(x + 1.3, y + 0.8, 12), P(x + 0.6, y + 0.8, 12)],
    "#d5d8e0",
  );
  if (used) {
    const [mx, my] = P(x + 1.72, y + 0.5, 12);
    R(g, mx - 2, my - 4, 4, 4, "#fbf7f0");
    R(g, mx + 2, my - 3, 1, 2, "#c9c2b4");
  }
}

/** One floor's room on a canvas of `plan.W` × `plan.H` art pixels; `people` desks are in use. */
export function paintFloor(g: G, plan: FloorPlan, o: { seed: string; people: number; wall: string; wall2: string }) {
  const { GX, GY } = plan,
    P = projector(GY);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, plan.W, plan.H);
  // The slab and the floor, in two tones like big tiles.
  poly(g, [P(0, GY), P(GX, GY), P(GX, GY, -SLAB / ZS), P(0, GY, -SLAB / ZS)], "#1b1a2b");
  poly(g, [P(GX, GY), P(GX, 0), P(GX, 0, -SLAB / ZS), P(GX, GY, -SLAB / ZS)], "#141322");
  poly(g, [P(0, 0), P(GX, 0), P(GX, GY), P(0, GY)], "#34324a");
  for (let x = 0; x < GX; x++)
    for (let y = (x % 2) * 1; y < GY; y += 2) poly(g, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], "#383650");
  // A rug down the aisle in front of the first desks.
  poly(g, [P(1.2, GY - 1.6), P(GX - 1.2, GY - 1.6), P(GX - 1.2, GY - 0.5), P(1.2, GY - 0.5)], "#3f5f92");
  poly(g, [P(1.4, GY - 1.45), P(GX - 1.4, GY - 1.45), P(GX - 1.4, GY - 0.65), P(1.4, GY - 0.65)], "#4a6fb0");
  // The two back walls.
  wall(g, P(0, GY), P(0, 0), GY, o.wall, `${o.seed}L`);
  wall(g, P(0, 0), P(GX, 0), GX, o.wall2, `${o.seed}R`, true);
  R(g, P(0, 0)[0] - 1, P(0, 0)[1] - WALL - 2, 2, WALL + 2, shade(o.wall, 0.6));
  // Everything standing on the floor, far to near.
  const things: Array<{ depth: number; draw: () => void }> = [];
  const add = (depth: number, draw: () => void) => things.push({ depth, draw });
  add(GX - 2, () => {
    // A bookshelf against the right wall, its books facing the room.
    const x = GX - 3.2;
    box(g, P, x, 0.08, 2.2, 0.55, 0, 38, "#8a5a36");
    const r = rng(`${o.seed}books`);
    let c = BOOKS[0]!;
    columns(g, P(x + 0.1, 0.63), P(x + 2.1, 0.63), (cx, base) => {
      if (cx % 2 === 0) c = r() < 0.12 ? "#33221a" : BOOKS[Math.floor(r() * BOOKS.length)]!;
      for (let z = 4; z < 52; z += 17) {
        R(g, cx, base - z - 14, 1, 14, "#33221a");
        R(g, cx, base - z - 11 + (cx % 3), 1, 11 - (cx % 3), c);
      }
    });
  });
  add(1.4, () => {
    // A water cooler in the far corner.
    box(g, P, 0.25, 0.3, 0.5, 0.5, 0, 20, "#e8e2d2");
    box(g, P, 0.32, 0.37, 0.36, 0.36, 20, 29, "#8fc8e8");
  });
  add(GY - 1.2, () => {
    // The printer on its cabinet, against the left wall.
    box(g, P, 0.12, GY - 3.4, 0.8, 1.6, 0, 20, "#9aa0b0");
    box(g, P, 0.2, GY - 3.2, 0.62, 1.1, 20, 27, "#2c2e3c");
    poly(g, [P(0.3, GY - 3, 27.5), P(0.7, GY - 3, 27.5), P(0.7, GY - 2.4, 27.5), P(0.3, GY - 2.4, 27.5)], "#f1ede2");
  });
  add(GY + 0.2, () => plant(g, P(0.6, GY - 0.6), 30));
  add(GX + 0.2, () => plant(g, P(GX - 0.6, 0.9), 22));
  for (let i = 0; i < plan.cols * plan.rows; i++) {
    const d = deskAt(i, plan.cols);
    add(d.x + d.y, () => desk(g, P, d.x, d.y, `${o.seed}:${i}`, i < o.people));
  }
  things.sort((a, b) => a.depth - b.depth).forEach((t) => t.draw());
}

// ---------- The people: small realistic figures in an office chair ----------
const SKIN = ["#f3d2b3", "#e8b98f", "#d09a6c", "#b07a4f", "#8a5a3a", "#5e3d28"];
const HAIR = ["#2a1f1b", "#4a3022", "#7a4a28", "#b9853f", "#d8b765", "#8c3b24", "#8d8d98", "#1c1c24"];
const SHIRT = [
  "#c9d6e8",
  "#e8e2d2",
  "#7fa3c9",
  "#5f8f7a",
  "#b8686a",
  "#8a78b8",
  "#d9a25a",
  "#4f6f9a",
  "#9aa6b2",
  "#c98aa8",
];
const TROUSERS = ["#2d3148", "#3a3430", "#27404c", "#4a4a58"];
export const PERSON_W = 30;
export const PERSON_H = 56;
const CX = 14; // the figure's middle, inside the sprite
const CHAIR = "#23232d";

function chairBase(g: G) {
  R(g, CX - 1, 40, 3, 8, "#55556a");
  R(g, CX - 10, 48, 21, 2, "#2b2b36");
  for (const x of [CX - 10, CX - 1, CX + 8]) R(g, x, 50, 3, 2, INK);
}
function chairBack(g: G) {
  R(g, CX - 9, 16, 19, 1, INK);
  R(g, CX - 10, 17, 21, 21, INK);
  R(g, CX - 9, 18, 19, 19, CHAIR);
  R(g, CX - 8, 17, 17, 1, CHAIR);
  R(g, CX - 7, 19, 1, 15, "#34343f");
  R(g, CX - 6, 19, 11, 1, "#34343f");
  R(g, CX - 7, 30, 15, 1, "#191920");
}
function look(agent: { id: string; kind: string }) {
  const h = hashOf(`person:${agent.id}`);
  const skin = SKIN[h % SKIN.length]!,
    hair = HAIR[(h >>> 4) % HAIR.length]!;
  const manager = agent.kind === "manager";
  return {
    skin,
    skin2: shade(skin, 0.82),
    hair,
    hair2: shade(hair, 1.35),
    style: (h >>> 8) % 6,
    shirt: manager ? "#2c3350" : SHIRT[(h >>> 12) % SHIRT.length]!,
    legs: TROUSERS[(h >>> 16) % TROUSERS.length]!,
    beard: (h >>> 19) % 6 === 0,
    manager,
  };
}
// Seen from behind, at the monitor: hair, the nape, shoulders over the chair's back, arms forward to the keys.
function paintBack(g: G, agent: { id: string; kind: string }) {
  const p = look(agent);
  chairBase(g);
  R(g, CX - 9, 37, 19, 3, CHAIR);
  R(g, CX - 12, 14, 3, 10, p.shirt); // upper arms, either side of the chair's back
  R(g, CX + 10, 14, 3, 10, shade(p.shirt, 0.85));
  R(g, CX - 9, 13, 19, 6, p.shirt);
  R(g, CX - 8, 12, 17, 1, p.shirt);
  R(g, CX + 7, 13, 3, 6, shade(p.shirt, 0.85));
  chairBack(g);
  R(g, CX - 12, 28, 3, 2, INK);
  R(g, CX + 10, 28, 3, 2, INK);
  R(g, CX - 2, 10, 5, 3, p.skin2);
  R(g, CX - 5, 2, 11, 9, p.skin);
  R(g, CX - 4, 1, 9, 1, p.skin);
  R(g, CX - 6, 6, 1, 2, p.skin);
  R(g, CX + 6, 6, 1, 2, p.skin);
  const hair = (x: number, y: number, w: number, h: number, c = p.hair) => R(g, CX + x, y, w, h, c);
  switch (p.style) {
    case 1: // long
      hair(-6, 1, 13, 15);
      hair(-5, 0, 11, 1);
      hair(-4, 3, 1, 11, p.hair2);
      break;
    case 2: // a bun
      hair(-5, 1, 11, 7);
      hair(-2, -2, 5, 3);
      hair(-1, -2, 2, 1, p.hair2);
      break;
    case 3: // cropped
      hair(-5, 1, 11, 5, shade(p.hair, 1.15));
      hair(-4, 6, 9, 1, p.skin2);
      break;
    case 4: // curls
      hair(-7, 0, 15, 8);
      hair(-6, -1, 13, 1);
      for (const [x, y] of [
        [-5, 1],
        [0, 0],
        [4, 2],
        [-2, 4],
        [3, 5],
      ] as const)
        hair(x, y, 2, 1, p.hair2);
      break;
    case 5: // a ponytail
      hair(-5, 1, 11, 7);
      hair(-1, 7, 3, 9);
      hair(-1, 6, 3, 1, "#d8392b");
      break;
    default: // short
      hair(-5, 1, 11, 7);
      hair(-4, 0, 9, 1);
      hair(-4, 2, 1, 4, p.hair2);
  }
}
// Turned to you: the chair behind, a face, a collar, hands on the armrests, feet on the floor.
function paintFront(g: G, agent: { id: string; kind: string }) {
  const p = look(agent);
  chairBack(g);
  chairBase(g);
  R(g, CX - 9, 37, 19, 3, CHAIR);
  // Legs and shoes.
  R(g, CX - 7, 33, 15, 6, p.legs);
  R(g, CX - 6, 39, 5, 9, p.legs);
  R(g, CX + 2, 39, 5, 9, p.legs);
  R(g, CX - 2, 39, 1, 9, shade(p.legs, 0.7));
  R(g, CX + 6, 39, 1, 9, shade(p.legs, 0.7));
  R(g, CX - 7, 48, 6, 3, "#1c1a22");
  R(g, CX + 2, 48, 6, 3, "#1c1a22");
  // Torso and arms.
  R(g, CX - 8, 13, 17, 21, p.shirt);
  R(g, CX - 9, 14, 19, 6, p.shirt);
  R(g, CX + 6, 15, 3, 19, shade(p.shirt, 0.85));
  R(g, CX - 12, 15, 3, 13, p.shirt);
  R(g, CX + 10, 15, 3, 13, shade(p.shirt, 0.85));
  R(g, CX - 12, 28, 3, 3, p.skin);
  R(g, CX + 10, 28, 3, 3, p.skin);
  R(g, CX - 13, 31, 5, 2, INK);
  R(g, CX + 9, 31, 5, 2, INK);
  R(g, CX - 2, 11, 5, 3, p.skin2);
  if (p.manager) {
    R(g, CX - 2, 14, 5, 13, "#eef0f4"); // a shirt and tie under the jacket
    R(g, CX, 15, 1, 10, "#b8485a");
    R(g, CX - 3, 14, 1, 9, "#3a4266");
    R(g, CX + 3, 14, 1, 9, "#3a4266");
  } else {
    R(g, CX - 4, 13, 2, 2, shade(p.shirt, 1.18));
    R(g, CX + 3, 13, 2, 2, shade(p.shirt, 1.18));
    R(g, CX, 16, 1, 1, shade(p.shirt, 0.7));
    R(g, CX, 20, 1, 1, shade(p.shirt, 0.7));
  }
  // Head and face.
  R(g, CX - 5, 2, 11, 9, p.skin);
  R(g, CX - 4, 1, 9, 1, p.skin);
  R(g, CX - 4, 11, 9, 1, p.skin);
  R(g, CX - 6, 6, 1, 3, p.skin2);
  R(g, CX + 6, 6, 1, 3, p.skin2);
  R(g, CX + 4, 3, 2, 8, p.skin2);
  for (const x of [CX - 4, CX + 2]) {
    R(g, x, 4, 3, 1, shade(p.hair, 0.8));
    R(g, x, 6, 3, 2, "#fbf7f0");
  }
  R(g, CX - 3, 6, 1, 2, "#231a1a");
  R(g, CX + 3, 6, 1, 2, "#231a1a");
  R(g, CX, 7, 1, 2, p.skin2);
  R(g, CX - 1, 10, 3, 1, "#9a4a42");
  if (p.beard) {
    R(g, CX - 5, 8, 2, 3, p.hair);
    R(g, CX + 4, 8, 2, 3, p.hair);
    R(g, CX - 4, 11, 9, 1, p.hair);
    R(g, CX - 2, 9, 5, 1, p.hair);
  }
  const hair = (x: number, y: number, w: number, h: number, c = p.hair) => R(g, CX + x, y, w, h, c);
  switch (p.style) {
    case 1:
      hair(-5, 0, 11, 3);
      hair(-7, 2, 2, 14);
      hair(6, 2, 2, 14);
      hair(-6, 1, 1, 3);
      hair(6, 1, 1, 3);
      hair(-3, 1, 4, 1, p.hair2);
      break;
    case 2:
      hair(-5, 1, 11, 2);
      hair(-2, -2, 5, 3);
      hair(-6, 2, 1, 4);
      hair(6, 2, 1, 4);
      break;
    case 3:
      hair(-5, 1, 11, 1, shade(p.hair, 1.15));
      hair(-4, 0, 9, 1, shade(p.hair, 1.15));
      break;
    case 4:
      hair(-7, -1, 15, 4);
      hair(-7, 3, 2, 4);
      hair(6, 3, 2, 4);
      for (const [x, y] of [
        [-5, 0],
        [0, -1],
        [4, 1],
      ] as const)
        hair(x, y, 2, 1, p.hair2);
      break;
    case 5:
      hair(-5, 0, 11, 3);
      hair(-5, 3, 4, 1);
      hair(-6, 2, 1, 3);
      hair(6, 2, 1, 3);
      break;
    default:
      hair(-5, 1, 11, 2);
      hair(-4, 0, 9, 1);
      hair(-6, 2, 1, 3);
      hair(6, 2, 1, 3);
      hair(-2, 1, 4, 1, p.hair2);
  }
}

const sprites = new Map<string, string>();
/** A person in their chair as a PERSON_W × PERSON_H picture (a data URL), with a one-pixel ink outline. */
export function personSprite(agent: { id: string; kind: string }, facing: "back" | "front"): string {
  const key = `${agent.id}|${agent.kind}|${facing}`;
  const had = sprites.get(key);
  if (had) return had;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = PERSON_W;
    c.height = PERSON_H;
    return [c, c.getContext("2d")] as const;
  };
  const [src, s] = make();
  if (!s) return "";
  s.translate(1, 3);
  (facing === "back" ? paintBack : paintFront)(s, agent);
  const [mask, m] = make(),
    [out, o] = make();
  if (!m || !o) return "";
  m.drawImage(src, 0, 0);
  m.globalCompositeOperation = "source-in";
  m.fillStyle = INK;
  m.fillRect(0, 0, PERSON_W, PERSON_H);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const)
    o.drawImage(mask, dx, dy);
  o.drawImage(src, 0, 0);
  const url = out.toDataURL();
  sprites.set(key, url);
  return url;
}

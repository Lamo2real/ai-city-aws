// The City view scene, ported from the owner's Mac HUD (ai-city/jarvis/hud/city.js): the same pixel art,
// drawn in code, the same streets, plaza, fountain, offices, free lots and homes (New York apartment buildings since decision 188). Changed for AWS:
// VAIC stands in the plaza where Jarvis stood, the Orchestrator at the HQ entrance, no Secretary or
// Reviewer; each department's manager stands at its door; panels are React (see CityView.tsx).
// The City View: a small game world of the agents, drawn pixel by pixel on a canvas from city-state.js.
// All of the art is drawn here in code. Every person on screen is a real agent; only the scenery moves on its own.
import { PLAQUE, plaqueSlots, signsFor, COST_NOTE, CORE, INTEGRATION_MEANS, MODEL_NAME, TILE, VISUALS, ageText, agentPanel, agentStatus, applyLive, applySnapshot, assignSlots, checkText, cityMessage, courierFor, departmentNames, departmentPanel, deptColor, deptOf, doingWords, estUsd, plainText, ticketTone, ticketWords, gateStatus, hashOf, homeOf, homeSpot, identity, initialState, integrationGroups, layout, parkedRows, placement, walksOut, propFor, reduce, relTime, residents, seatSpot, stockholmTime, topBar, traceLines, usdRows, visitAllowed, visualState, walkRoute, workforceGroups, MAP_MARGIN, edgeAlpha, commuteRoute, doorOf, staggerMs, walkSpeed, ANIM_MS, animProgress, entranceAnims, lotsMemory, readLotsMemory, PITCH_X, standFraction, mailFor, enqueueMail, bikeSpeed, createTraffic, stepTraffic, trafficCars, signalAt, junctions, JUNCTION_HALF, STOP_AT, rideLegs, arrive, roundaboutDetours, rideStep, ringOf, taxiCall, RIDE_PX_S, TO_WORK_BOOST, HOMES_PER_BLOCK } from "./city-state.js";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const INK = "#1d1c36";
const rng = (seed) => { let x = hashOf(seed) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };
const newCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g]; };
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
// A filled oval on the pixel grid, row by row, so its edge stays crisp.
function oval(g, cx, cy, rx, ry, c) {
  g.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) { const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.3)) ** 2))); g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2, 1); }
}
// Draws `paint` with a one-pixel ink outline around everything it drew.
function outlined(w, h, paint, ink = INK) {
  const [src, s] = newCanvas(w, h); paint(s);
  const [mask, m] = newCanvas(w, h); m.drawImage(src, 0, 0); m.globalCompositeOperation = "source-in"; m.fillStyle = ink; m.fillRect(0, 0, w, h);
  const [out, o] = newCanvas(w, h);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) o.drawImage(mask, dx, dy);
  o.drawImage(src, 0, 0);
  return out;
}

// ---------- Lettering: my own 4×5 capitals, each glyph five rows of four bits ----------
const GLYPH = { A: "69F99", B: "E9E9E", C: "78887", D: "E999E", E: "F8E8F", F: "F8E88", G: "78B97", H: "99F99", I: "E444E", J: "31196", K: "9ACA9", L: "8888F", M: "9FF99", N: "9DB99", O: "69996", P: "E9E88", Q: "699A5", R: "E9EA9", S: "7861E", T: "E4444", U: "99996", V: "99966", W: "99FF9", X: "99699", Y: "AAE44", Z: "F124F", 0: "6BD96", 1: "4C44E", 2: "E168F", 3: "E161E", 4: "99F11", 5: "F8E1E", 6: "68E96", 7: "F1244", 8: "69696", 9: "69716", "-": "00F00", ".": "00040", ",": "00048", ":": "04040", "/": "11248", _: "0000F", "'": "44000", "!": "44404", "?": "69202", "(": "24442", ")": "42224", "&": "4A4A5", "+": "04E40", " ": "00000" };
const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const fontable = (s) => [...fold(s)].every((c) => GLYPH[c]);
const WIDE = { M: [17, 27, 21, 17, 17], W: [17, 17, 21, 27, 17] }; // five bits wide, or they read as H
const textW = (s) => [...fold(s)].reduce((w, c) => w + (WIDE[c] ? 6 : 5), 0) - 1;
// Agent-written names go through here as data. A name the capitals cannot spell falls back to plain canvas text.
function pixelText(g, s, x, y, c) {
  const t = fold(s);
  if (!fontable(s)) { g.fillStyle = c; g.font = "8px sans-serif"; g.textBaseline = "top"; g.fillText(String(s), x, y - 2); return; }
  g.fillStyle = c;
  let at = x;
  for (const ch of t) {
    const wide = WIDE[ch];
    for (let r = 0; r < 5; r++) { const bits = wide ? wide[r] : parseInt(GLYPH[ch][r], 16) << 1; for (let b = 0; b < 5; b++) if (bits & (16 >> b)) g.fillRect(at + b, y + r, 1, 1); }
    at += wide ? 6 : 5;
  }
}
const fit = (s, maxPx) => { let t = String(s); if (textW(t) <= maxPx) return t; while (t.length > 1 && textW(t) + 10 > maxPx) t = t.slice(0, -1); return `${t}..`; };

// ---------- Figures. A chunky toy person, 14×21, built from blocks; the look comes from the id alone ----------
const SKIN = ["#f6cfa8", "#eebb8e", "#d99b6c", "#b97a4e", "#8f5a38", "#6c422a"];
const HAIR = ["#3a2a22", "#6b4226", "#b5763a", "#e2c26a", "#c6543a", "#23222f", "#8a8aa0"];
const SHIRT = ["#e0625a", "#4f8fd6", "#49ad7c", "#e6a53c", "#9a6bd0", "#39a7a8", "#d2699e", "#7fa04a", "#c97a45", "#6f7bd8"];
const TROUSERS = ["#32344f", "#4a3a34", "#2d4a56", "#51406a"];
const tieColor = (name) => deptColor(name) === deptColor("other") ? SHIRT[hashOf(name) % SHIRT.length] : deptColor(name);

// Arms in each pose: [left dy, right dy, right dx, prop, head dy, body bob], one entry per frame of four.
const POSES = {
  rest: [[0, 0, 0], [0, 0, 0], [0, 0, 0, null, 0, 1], [0, 0, 0, null, 0, 1]],
  still: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  type: [[-2, -4, 0], [-4, -2, 0], [-2, -4, 0, null, 0, 1], [-4, -2, 0, null, 0, 1]],
  think: [[0, -6, -2], [0, -6, -2], [0, -6, -2, null, 0, 1], [0, -6, -2, null, 0, 1]],
  read: [[-3, -3, -3, "book"], [-3, -3, -3, "book"], [-3, -3, -3, "book2"], [-3, -3, -3, "book"]],
  tablet: [[-3, -3, -3, "tablet"], [-3, -3, -3, "tablet2"], [-3, -3, -3, "tablet"], [-3, -3, -3, "tablet2"]],
  wave: [[0, -8, 1], [0, -9, 2], [0, -8, 1], [0, -9, 0]],
  point: [[0, -4, 2], [0, -5, 3], [0, -4, 2], [0, -5, 3]],
  raise: [[0, -9, 0], [0, -9, 0], [0, -10, 0], [0, -10, 0]],
  clipboard: [[-3, -2, -3, "clip"], [-3, -3, -3, "clip"], [-3, -2, -3, "clip"], [-3, -3, -3, "clip"]],
  magnify: [[0, -5, 1, "lens"], [0, -6, 2, "lens"], [0, -5, 3, "lens"], [0, -6, 2, "lens"]],
  wait: [[0, 0, 0], [0, 0, 0], [0, 0, 0, null, 0, 1], [0, 0, 0, null, 0, 1]],
  alarm: [[-9, -9, 0, null, 0, -3], [-10, -10, 0, null, 0, -1], [-9, -9, 0, null, 0, -3], [-10, -10, 0, null, 0, 0]],
  slump: [[1, 1, 0, null, 2], [1, 1, 0, null, 2], [1, 1, 0, null, 2], [1, 1, 0, null, 2]],
};
const PROP = {
  book: (g, x, y) => { R(g, x, y, 8, 5, "#4f8fd6"); R(g, x + 1, y, 3, 4, "#fff6e0"); R(g, x + 4, y, 3, 4, "#fff6e0"); },
  book2: (g, x, y) => { R(g, x, y, 8, 5, "#4f8fd6"); R(g, x + 1, y, 3, 4, "#fff6e0"); R(g, x + 4, y, 3, 4, "#e7d9b8"); },
  tablet: (g, x, y) => { R(g, x + 1, y - 1, 6, 6, "#2a2d4a"); R(g, x + 2, y, 4, 4, "#8fdcff"); },
  tablet2: (g, x, y) => { R(g, x + 1, y - 1, 6, 6, "#2a2d4a"); R(g, x + 2, y, 4, 4, "#c8f0ff"); },
  clip: (g, x, y) => { R(g, x + 1, y - 2, 6, 7, "#8a5a33"); R(g, x + 2, y - 1, 4, 5, "#fff6e0"); R(g, x + 3, y - 3, 2, 2, "#c9c9d6"); },
};
// A Department Manager's dark suit (the owner, 2026-11-11): jacket and trousers, a white shirt, a tie in his
// department's colour, and sunglasses. His own skin and hair stay.
export const SUIT = { jacket: "#262b40", lapel: "#3a4266", shirt: "#eef0f4", shades: "#101018", glint: "#8fa4c8" };
export function paintFigure(g, agent, poseName, f, stride = null) {
  const id = agent.id, look = identity(id);
  const [ly, ry, rx, prop, headDy = 0, bob = 0] = POSES[poseName]?.[f % 4] ?? POSES.rest[0];
  const skin = id === "vaic" ? "#a7f0ff" : SKIN[look.skin];
  let shirt = SHIRT[look.shirt], legs = TROUSERS[look.trousers], hair = HAIR[look.hair];
  if (id === "vaic") { shirt = "#54c8ee"; legs = "#2f8fc0"; hair = null; }
  if (id === "orchestrator") { shirt = "#23222f"; legs = "#23222f"; }
  const suit = agent.kind === "manager";
  if (suit) { shirt = SUIT.jacket; legs = SUIT.jacket; }
  const top = 2 + bob;
  // Legs and shoes; a stride shortens one leg and then the other.
  const lL = stride === 1 ? 3 : 5, lR = stride === 3 ? 3 : 5;
  R(g, 4, top + 13, 3, lL, legs); R(g, 7, top + 13, 3, lR, legs);
  R(g, 4, top + 13 + lL, 3, 1, "#2a2030"); R(g, 7, top + 13 + lR, 3, 1, "#2a2030");
  // Left arm, body, right arm; a raised arm ends in a hand above the shoulder.
  const arm = (x, dy) => { R(g, x, top + 8 + Math.min(dy, 0), 2, 5 - Math.abs(Math.min(dy, 0)) / 3, shirt); R(g, x, top + 8 + Math.min(dy, 0) - (dy < 0 ? 1 : -4), 2, 2, skin); };
  arm(2, ly);
  R(g, 3, top + 8, 8, 6, shirt); R(g, 3, top + 13, 8, 1, "rgba(0,0,0,.18)");
  if (suit) { R(g, 5, top + 8, 1, 4, SUIT.lapel); R(g, 8, top + 8, 1, 4, SUIT.lapel); R(g, 6, top + 8, 2, 2, SUIT.shirt); R(g, 6, top + 9, 2, 4, tieColor(deptOf(agent))); }
  else R(g, 6, top + 8, 2, 2, agent.kind === "core" && id !== "vaic" ? "#fff6e0" : "rgba(255,255,255,.3)");
  arm(10 + (rx > 0 ? rx : 0) + (rx < 0 ? rx : 0), ry);
  // Head, a big friendly block with its corners knocked off.
  const hy = top + headDy;
  R(g, 3, hy + 1, 8, 7, skin); R(g, 4, hy, 6, 1, skin);
  if (headDy > 0) R(g, 5, hy + 5, 4, 1, "#3a2a22"); // eyes shut, head down
  else { R(g, 5, hy + 4, 1, 2, "#23202f"); R(g, 8, hy + 4, 1, 2, "#23202f"); R(g, 6, hy + 6, 2, 1, id === "vaic" ? "#2f8fc0" : "rgba(120,50,40,.55)"); }
  if (hair) switch (look.hairStyle) {
    case 0: R(g, 3, hy, 8, 3, hair); R(g, 3, hy + 3, 1, 2, hair); R(g, 10, hy + 3, 1, 2, hair); break;
    case 1: R(g, 3, hy, 8, 2, hair); R(g, 6, hy + 2, 5, 1, hair); break;
    case 2: R(g, 3, hy, 8, 3, hair); R(g, 5, hy - 2, 4, 2, hair); break;
    case 3: R(g, 3, hy, 8, 2, hair); R(g, 3, hy + 2, 1, 5, hair); R(g, 10, hy + 2, 1, 5, hair); break;
    default: R(g, 4, hy - 1, 6, 2, hair); R(g, 6, hy - 2, 2, 1, hair); R(g, 3, hy + 1, 8, 1, hair);
  }
  if (suit) { R(g, 4, hy + 4, 3, 2, SUIT.shades); R(g, 7, hy + 4, 3, 2, SUIT.shades); R(g, 3, hy + 4, 8, 1, SUIT.shades); R(g, 4, hy + 4, 1, 1, SUIT.glint); R(g, 7, hy + 4, 1, 1, SUIT.glint); }
  if (id === "vaic") { R(g, 4, hy + 3, 6, 1, "#ffffff"); R(g, 6, hy - 2, 2, 2, "#e8fbff"); }
  if (id === "orchestrator") { R(g, 4, hy - 3, 6, 4, "#23222f"); R(g, 3, hy + 1, 8, 1, "#c7a23c"); R(g, 12, top + 3, 1, 6, "#fff6e0"); }
  if (prop && PROP[prop]) PROP[prop](g, 3, top + 8);
  if (prop === "lens") { const x = 10 + rx, y = top + 1; R(g, x + 1, y - 3, 4, 4, "#bfe6ff"); R(g, x, y - 2, 1, 2, "#c7a23c"); R(g, x + 5, y - 2, 1, 2, "#c7a23c"); R(g, x + 1, y - 4, 4, 1, "#c7a23c"); R(g, x + 1, y + 1, 4, 1, "#c7a23c"); }
}
// A tower's colours, the same as on the map: its facade and its department's accent (by its slot).
export function towerLook(dept, slot = 0) {
  const f = FACADES[hashOf(dept) % FACADES.length], [accent, light, dark] = ROOFS[((slot % ROOFS.length) + ROOFS.length) % ROOFS.length];
  return { ...f, accent, light, dark };
}
const figures = new Map();
function figure(agent, pose, f, stride) {
  const key = `${agent.id}|${agent.kind}|${agent.department}|${pose}|${f % 4}|${stride}`;
  let c = figures.get(key);
  if (!c) { c = outlined(20, 26, (g) => { g.translate(3, 4); paintFigure(g, agent, pose, f, stride); }); figures.set(key, c); }
  return c;
}

// ---------- Bubble icons, 9×9, one per state ----------
const ICON_INK = { k: INK, w: "#ffffff", y: "#f4c63c", r: "#d8392b", b: "#3f7fd0", g: "#37a564", o: "#e8842c", s: "#8b8fa8", p: "#8a5ad0", n: "#8a5a33", c: "#8fdcff" };
const ICONS = {
  understanding: ["..kkkkk..", ".k.....k.", "k.......k", "k.k.k.k.k", "k.......k", ".k.....k.", "..kkkkk..", ".kk......", "k........"],
  reading: [".........", ".bbb.bbb.", "bwwwbwwwb", "bwkwbwkwb", "bwwwbwwwb", "bwkwbwkwb", "bwwwbwwwb", "bbbbbbbbb", "........."],
  researching: ["..bbbbb..", ".bggbbgb.", "bgggbbggb", "bgggbbbgb", "bbggbbbbb", "bbbbbggbb", "bbbbgggbb", ".bbbbggb.", "..bbbbb.."],
  browsing: ["kkkkkkkkk", "krkykgkkk", "kkkkkkkkk", "kwwwwwwwk", "kwbbbwwwk", "kwwwwwwwk", "kwbbwkwwk", "kwwwwkkwk", "kkkkkkkkk"],
  coding: ["kkkkkkkkk", "kcccccck.", "kcgcccck.", "kccgccck.", "kcgcckck.", "kcccccck.", "kkkkkkkk.", ".sssssss.", "sssssssss"],
  running: ["...s.s...", ".s.sss.s.", "..sssss..", "ssskkksss", ".ssk.kss.", "ssskkksss", "..sssss..", ".s.sss.s.", "...s.s..."],
  working: [".sssssss.", ".sssssss.", ".ss.n.ss.", "....n....", "....n....", "....n....", "....n....", "....n....", "....n...."],
  hiring: ["...nn....", "..nnnn...", "..nnnn.g.", "...nn.ggg", "..bbbb.g.", ".bbbbbb..", ".bbbbbb..", ".bbbbbb..", "........."],
  delegating: [".........", "....o....", "....oo...", "ooooooo..", "oooooooo.", "ooooooo..", "....oo...", "....o....", "........."],
  asking: ["..bbbbb..", ".bb...bb.", ".bb...bb.", ".....bb..", "....bb...", "...bb....", "...bb....", ".........", "...bb...."],
  answering: [".kkkkkkk.", "kwwwwwwwk", "kwkkkkkwk", "kwwwwwwwk", "kwkkkwwwk", "kwwwwwwwk", ".kkwkkkk.", "..kk.....", "..k......"],
  reporting: ["...sss...", ".nnnsnnn.", ".nwwwwwn.", ".nwwwgwn.", ".nwwgwwn.", ".ngwgwwn.", ".nwgwwwn.", ".nwwwwwn.", ".nnnnnnn."],
  reviewing: ["..kkkk...", ".kccccK..".replace("K", "k"), "kcwcccck.", "kcccccck.", "kcccccck.", ".kcccck..", "..kkkkkn.", "......nnn", ".......nn"],
  in_review: [".sssssss.", ".swwwwws.", ".swkkkws.", ".swwwwws.", ".swkkkws.", ".swwwwws.", ".sssssss.", ".........", ".p..p..p."],
  summarizing: ["......ooo", ".....oyyo", "kkkk.oyyk", "....oyyk.", "kkkoyyk..", "...kkk...", "kkk......", ".........", "kkkkkkk.."],
  remembering: ["..yyyyy..", ".yyyyyyy.", ".yywwyyy.", ".yyywyyy.", "..yyyyy..", "...yyy...", "...sss...", "...sss...", "....k...."],
  waiting_team: ["nnnnnnnnn", ".kwwwwwk.", ".kyyyyyk.", "..kyyyk..", "...kyk...", "..kwywk..", ".kwwywwk.", ".kyyyyyk.", "nnnnnnnnn"],
  waiting_owner: ["...rrr...", "...rrr...", "...rrr...", "...rrr...", "...rrr...", "....r....", ".........", "...rrr...", "...rrr..."],
  waiting_merge: [".g.....g.", "ggg...ggg", ".g.....g.", ".g.....g.", "..g...g..", "...g.g...", "....g....", "....g....", "...ggg..."],
  failed: ["rr.....rr", "rrr...rrr", ".rrr.rrr.", "..rrrrr..", "...rrr...", "..rrrrr..", ".rrr.rrr.", "rrr...rrr", "rr.....rr"],
  blocked: ["..rrrrr..", ".rrrrrrr.", "rrrrrrrrr", "rrrrrrrrr", "rwwwwwwwr", "rrrrrrrrr", "rrrrrrrrr", ".rrrrrrr.", "..rrrrr.."],
  paused: [".........", ".bbb.bbb.", ".bbb.bbb.", ".bbb.bbb.", ".bbb.bbb.", ".bbb.bbb.", ".bbb.bbb.", ".bbb.bbb.", "........."],
};
function paintIcon(g, key, x, y) {
  (ICONS[key] ?? []).forEach((row, r) => { [...row].forEach((ch, c) => { if (ch !== ".") { g.fillStyle = ICON_INK[ch]; g.fillRect(x + c, y + r, 1, 1); } }); });
}
const bubbles = new Map();
function bubble(key) {
  if (!bubbles.has(key)) {
    const loud = key === "waiting_owner", bad = key === "failed" || key === "blocked";
    bubbles.set(key, outlined(17, 18, (g) => {
      const fill = loud ? "#ffd84a" : bad ? "#ffe3dc" : "#fff6e0";
      R(g, 2, 1, 13, 13, fill); R(g, 1, 2, 15, 11, fill);
      if (key === "understanding") { R(g, 6, 14, 2, 1, fill); R(g, 7, 16, 1, 1, fill); } else { R(g, 7, 14, 3, 1, fill); R(g, 8, 15, 1, 1, fill); }
      paintIcon(g, key, 4, 3);
    }));
  }
  return bubbles.get(key);
}

// ---------- Desks ----------
const DESK_ITEM = {
  laptop: (g) => { R(g, 8, 0, 8, 5, "#3a3d5a"); R(g, 9, 1, 6, 3, "#8fdcff"); R(g, 7, 5, 10, 1, "#c9c9d6"); },
  camera: (g) => { R(g, 9, 1, 7, 5, "#2a2d4a"); R(g, 11, 2, 3, 3, "#8fdcff"); },
  chart: (g) => { R(g, 8, 0, 8, 6, "#fff6e0"); R(g, 9, 3, 1, 2, "#37a564"); R(g, 11, 2, 1, 3, "#37a564"); R(g, 13, 1, 1, 4, "#e8842c"); },
  wrench: (g) => { R(g, 8, 4, 8, 2, "#8b8fa8"); R(g, 15, 2, 2, 3, "#8b8fa8"); R(g, 7, 3, 2, 4, "#8b8fa8"); },
  ticket: (g) => { R(g, 8, 2, 8, 4, "#f4c63c"); R(g, 11, 2, 1, 4, "#c9962a"); },
  clipboard: (g) => { R(g, 9, 0, 6, 6, "#8a5a33"); R(g, 10, 1, 4, 5, "#fff6e0"); },
  none: () => {},
};
const desks = new Map();
// An arcade cabinet for each app the owner published: original pixel art, tinted per app.
const CABINET_W = 10, CABINET_H = 16;
const CABINET_TINTS = ["#e0625a", "#4f8fd6", "#49ad7c", "#9a6bd0", "#f4c63c", "#d2699e"];
const cabinets = new Map();
function cabinet(tint) {
  if (cabinets.has(tint)) return cabinets.get(tint);
  const [c, g] = newCanvas(CABINET_W, CABINET_H);
  R(g, 0, 0, 10, 16, INK);
  R(g, 1, 1, 8, 3, tint); R(g, 1, 1, 8, 1, "rgba(255,255,255,.35)"); // the marquee
  R(g, 1, 5, 8, 5, "#3a4660"); R(g, 2, 6, 2, 2, "#8fdcff"); R(g, 6, 7, 2, 2, "#f4c63c"); // the screen
  R(g, 1, 11, 8, 4, "#5a4a6e"); R(g, 3, 11, 1, 2, "#fff6e0"); R(g, 6, 12, 2, 1, "#49ad7c"); // stick and button
  R(g, 0, 15, 10, 1, "rgba(20,18,40,.5)");
  cabinets.set(tint, c);
  return c;
}
function desk(item = "none") {
  if (!desks.has(item)) desks.set(item, outlined(24, 16, (g) => {
    g.translate(0, 1);
    (DESK_ITEM[item] ?? DESK_ITEM.laptop)(g);
    R(g, 1, 6, 22, 3, "#c98f55"); R(g, 1, 6, 22, 1, "#e2ae72"); R(g, 1, 9, 22, 4, "#9a6638"); R(g, 3, 9, 18, 1, "#7d4f2a");
  }));
  return desks.get(item);
}

// ---------- Vehicles: yellow cabs and the mailman's bicycle (decision 134) ----------
function line(g, x0, y0, x1, y1, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) R(g, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 1, 1, c);
}
const CAB_Y = "#f4c63c", CAB_SHADE = "#c99a1f", CAB_GLASS = "#2c3550";
const cabs = new Map();
// A New York cab, side on (driving along a street, facing right) or nose on (driving up or down the avenue).
function cab(view) {
  if (!cabs.has(view)) cabs.set(view, view === "side" ? outlined(24, 14, (g) => {
    g.translate(1, 1);
    R(g, 1, 5, 20, 4, CAB_Y); R(g, 5, 2, 11, 4, CAB_Y); R(g, 1, 8, 20, 1, CAB_SHADE);
    R(g, 6, 3, 4, 2, CAB_GLASS); R(g, 11, 3, 4, 2, CAB_GLASS); R(g, 6, 3, 4, 1, "#8fb8d8"); R(g, 11, 3, 4, 1, "#8fb8d8");
    for (let x = 2; x < 20; x += 2) { R(g, x, 6, 1, 1, INK); R(g, x + 1, 7, 1, 1, "#fff6e0"); } // the checker band
    R(g, 20, 5, 1, 2, "#fff3b0"); R(g, 1, 5, 1, 2, "#d8392b"); // headlight, tail light
    R(g, 8, 0, 5, 2, "#fff3b0"); R(g, 9, 0, 3, 1, "#e6a53c"); // the roof light
    for (const wx of [3, 14]) { R(g, wx, 9, 4, 3, INK); R(g, wx + 1, 10, 2, 1, "#8b8fa8"); }
  }) : outlined(18, 17, (g) => {
    g.translate(1, 1);
    R(g, 1, 5, 14, 7, CAB_Y); R(g, 3, 2, 10, 4, CAB_Y); R(g, 4, 3, 8, 3, CAB_GLASS); R(g, 4, 3, 8, 1, "#8fb8d8");
    R(g, 6, 0, 4, 2, "#fff3b0"); R(g, 1, 8, 14, 1, INK); for (let x = 1; x < 15; x += 2) R(g, x, 8, 1, 1, "#fff6e0");
    R(g, 2, 9, 3, 2, "#fff3b0"); R(g, 11, 9, 3, 2, "#fff3b0"); R(g, 6, 10, 4, 1, INK); R(g, 1, 11, 14, 1, CAB_SHADE);
    R(g, 1, 12, 3, 3, INK); R(g, 12, 12, 3, 3, INK);
  }));
  return cabs.get(view);
}
// The rare one (1 in RARE_CAB_ODDS cars that enter the road, by a roll, the owner's wish): a low, wide black sports coupé with chrome rims, a
// tall swan-neck wing and a full-width rear light bar, still wearing the cab's roof light. An original drawing:
// no badges or marks. Side on, nose on (coming down the avenue) and tail on (going up it).
const GT_BODY = "#17171d", GT_DARK = "#0b0b10", GT_SHINE = "#3d3f50", GT_GLASS = "#283450", CHROME = "#d6dce8", CHROME_D = "#8f97a8";
function rareCabSprite(view) {
  const key = `rare-${view}`;
  if (cabs.has(key)) return cabs.get(key);
  const wheel = (g, x, y, w) => { R(g, x, y, w, 3, INK); R(g, x + 1, y, w - 2, 3, CHROME_D); R(g, x + 1, y + 1, w - 2, 1, CHROME); R(g, x + Math.floor(w / 2), y, 1, 3, CHROME); };
  const img = view === "side" ? outlined(24, 14, (g) => {
    g.translate(1, 1);
    R(g, 1, 6, 21, 3, GT_BODY); R(g, 2, 9, 18, 1, GT_DARK); // the low body and its sills
    R(g, 14, 5, 7, 1, GT_BODY); R(g, 5, 4, 9, 2, GT_BODY); R(g, 7, 3, 6, 1, GT_BODY); // bonnet, the fastback roof
    R(g, 12, 4, 2, 1, GT_GLASS); R(g, 8, 4, 4, 1, GT_GLASS); R(g, 9, 4, 2, 1, "#4f6b8e"); // windscreen and side glass
    R(g, 2, 6, 19, 1, GT_SHINE); R(g, 8, 3, 4, 1, GT_SHINE); // light along the shoulder and the roof
    R(g, 0, 1, 7, 1, GT_BODY); R(g, 0, 0, 1, 2, GT_BODY); R(g, 3, 2, 1, 3, GT_BODY); R(g, 5, 2, 1, 2, GT_BODY); // the swan-neck wing
    R(g, 9, 1, 3, 2, "#fff3b0"); R(g, 10, 1, 1, 1, "#e6a53c"); // the cab's roof light, as on every cab
    R(g, 21, 6, 1, 1, "#e8eef8"); R(g, 1, 6, 1, 2, "#e0302a"); // headlight, tail light
    wheel(g, 3, 9, 5); wheel(g, 15, 9, 5);
  }) : view === "front" ? outlined(18, 17, (g) => {
    g.translate(1, 1);
    R(g, 0, 6, 16, 6, GT_BODY); R(g, 2, 4, 12, 2, GT_BODY); R(g, 4, 1, 8, 1, GT_BODY);
    R(g, 3, 2, 10, 2, GT_GLASS); R(g, 4, 2, 8, 1, "#4f6b8e"); R(g, 2, 4, 12, 1, GT_SHINE);
    R(g, 6, 0, 4, 1, "#fff3b0"); // roof light
    R(g, 1, 6, 3, 2, "#e8eef8"); R(g, 12, 6, 3, 2, "#e8eef8"); R(g, 2, 6, 1, 1, "#ffffff"); R(g, 13, 6, 1, 1, "#ffffff"); // round lamps
    R(g, 4, 9, 8, 2, GT_DARK); for (let x = 5; x < 12; x += 2) R(g, x, 9, 1, 2, "#26262e"); // the wide intake
    R(g, 0, 11, 16, 1, GT_DARK);
    wheel(g, 0, 12, 3); wheel(g, 13, 12, 3);
  }) : outlined(18, 17, (g) => {
    g.translate(1, 1);
    R(g, 0, 0, 16, 1, GT_BODY); R(g, 0, 0, 1, 2, GT_BODY); R(g, 15, 0, 1, 2, GT_BODY); R(g, 4, 1, 1, 3, GT_BODY); R(g, 11, 1, 1, 3, GT_BODY); // the wing
    R(g, 7, 1, 2, 1, "#fff3b0"); // roof light, between the wing's necks
    R(g, 3, 3, 10, 1, GT_BODY); R(g, 4, 4, 8, 2, GT_GLASS); R(g, 1, 6, 14, 6, GT_BODY); R(g, 0, 7, 16, 4, GT_BODY);
    R(g, 0, 7, 16, 1, "#e0302a"); R(g, 4, 7, 8, 1, "#ff5a48"); // the full-width light bar
    R(g, 3, 10, 10, 2, GT_DARK); R(g, 7, 11, 2, 1, CHROME_D); // diffuser and the twin pipes
    wheel(g, 0, 12, 3); wheel(g, 13, 12, 3);
  });
  cabs.set(key, img);
  return img;
}
// The second rare one (1 in RARE_CAB_ODDS too, the owner's wish, 2026-11-12): a matte black supercar, a low sharp
// wedge with a big rear wing on two pylons, red Y-shaped tail lights, dark wheels with a flash of green caliper, and
// the cab's roof light like every car that carries a passenger. An original drawing inspired by the owner's photos:
// no badges, names or plates. Side on, nose on and tail on.
const LB_BODY = "#1d1e25", LB_DARK = "#08080c", LB_EDGE = "#3a3c4a", LB_GLASS = "#222b40", LB_GLINT = "#4a5a78", LB_RED = "#ff2f22", LB_RED2 = "#b3140f";
function lamboSprite(view) {
  const key = `lambo-${view}`;
  if (cabs.has(key)) return cabs.get(key);
  const wheel = (g, x, y, w) => { R(g, x, y, w, 3, INK); R(g, x + 1, y, w - 2, 3, "#2a2b33"); R(g, x + Math.floor(w / 2), y + 1, 1, 1, "#5a5d6a"); };
  const img = view === "side" ? outlined(24, 14, (g) => {
    g.translate(1, 1);
    R(g, 1, 7, 21, 2, LB_BODY); R(g, 1, 6, 20, 1, LB_BODY); R(g, 2, 5, 16, 1, LB_BODY); // the wedge, low at the nose
    R(g, 4, 4, 12, 1, LB_BODY); R(g, 6, 3, 8, 1, LB_BODY); R(g, 8, 2, 5, 1, LB_BODY); // the cab-forward canopy
    R(g, 9, 3, 4, 1, LB_GLASS); R(g, 8, 4, 7, 1, LB_GLASS); R(g, 12, 3, 1, 1, LB_GLINT); R(g, 14, 4, 1, 1, LB_GLINT); // glass
    R(g, 10, 5, 8, 1, LB_EDGE); R(g, 18, 6, 2, 1, LB_EDGE); R(g, 9, 2, 3, 1, LB_EDGE); // sharp creases catching the light
    R(g, 5, 6, 4, 1, LB_DARK); R(g, 4, 5, 3, 1, LB_DARK); // the side intake behind the door
    R(g, 0, 1, 7, 1, LB_BODY); R(g, 0, 0, 1, 3, LB_BODY); R(g, 3, 2, 1, 3, LB_BODY); R(g, 5, 2, 1, 2, LB_BODY); R(g, 1, 1, 5, 1, LB_EDGE); // the big wing on its pylons
    R(g, 9, 1, 3, 1, "#fff3b0"); R(g, 10, 1, 1, 1, "#e6a53c"); // the cab's roof light, as on every cab
    R(g, 19, 6, 2, 1, "#e8eef8"); R(g, 1, 6, 1, 2, LB_RED); R(g, 2, 6, 1, 1, LB_RED2); // headlight slit, the Y tail light
    R(g, 2, 9, 18, 1, LB_DARK); // the sill
    wheel(g, 3, 9, 5); wheel(g, 15, 9, 5); R(g, 5, 9, 1, 1, "#7ed321"); R(g, 17, 9, 1, 1, "#7ed321"); // a flash of green caliper
  }) : view === "front" ? outlined(18, 17, (g) => {
    g.translate(1, 1);
    R(g, 0, 7, 16, 5, LB_BODY); R(g, 1, 5, 14, 2, LB_BODY); R(g, 3, 2, 10, 3, LB_BODY); R(g, 4, 1, 8, 1, LB_BODY);
    R(g, 4, 2, 8, 2, LB_GLASS); R(g, 5, 2, 6, 1, LB_GLINT); R(g, 1, 5, 14, 1, LB_EDGE); // windscreen, the bonnet's edge
    R(g, 6, 0, 4, 1, "#fff3b0"); // roof light
    R(g, 1, 7, 4, 1, "#e8eef8"); R(g, 4, 6, 1, 1, "#e8eef8"); R(g, 11, 7, 4, 1, "#e8eef8"); R(g, 11, 6, 1, 1, "#e8eef8"); // the sharp headlight slits
    R(g, 1, 9, 4, 2, LB_DARK); R(g, 11, 9, 4, 2, LB_DARK); R(g, 6, 9, 4, 1, LB_DARK); // the big intakes
    R(g, 0, 11, 16, 1, LB_EDGE); // the splitter
    wheel(g, 0, 12, 3); wheel(g, 13, 12, 3);
  }) : outlined(18, 17, (g) => {
    g.translate(1, 1);
    R(g, 0, 0, 16, 1, LB_BODY); R(g, 1, 0, 14, 1, LB_EDGE); R(g, 0, 0, 1, 3, LB_BODY); R(g, 15, 0, 1, 3, LB_BODY); R(g, 5, 1, 1, 3, LB_BODY); R(g, 10, 1, 1, 3, LB_BODY); // the wing
    R(g, 7, 1, 2, 1, "#fff3b0"); // roof light, between the wing's pylons
    R(g, 3, 3, 10, 2, LB_BODY); for (let x = 4; x < 12; x += 2) R(g, x, 3, 1, 2, LB_EDGE); // the louvred engine cover
    R(g, 1, 5, 14, 7, LB_BODY); R(g, 0, 6, 16, 5, LB_BODY);
    for (const [a, b, c] of [[1, 3, 2], [12, 14, 13]]) { R(g, a, 6, 1, 1, LB_RED); R(g, b, 6, 1, 1, LB_RED); R(g, c, 7, 1, 2, LB_RED); R(g, c, 6, 1, 1, LB_RED2); } // the Y tail lights
    R(g, 6, 7, 4, 2, LB_DARK); R(g, 7, 7, 2, 1, "#8f97a8"); // the high centre exhaust
    R(g, 2, 10, 12, 2, LB_DARK); for (let x = 3; x < 13; x += 3) R(g, x, 10, 1, 2, LB_EDGE); // the diffuser
    wheel(g, 0, 12, 3); wheel(g, 13, 12, 3);
  });
  cabs.set(key, img);
  return img;
}
// A cab sprite: side on, or along the avenue nose on (coming down) / from behind (going up; the cab looks the same).
// `rare` is false, "porsche" or "lambo" (any other truthy value is the Porsche, as before).
const cabImg = (rare, view) => (rare === "lambo" ? lamboSprite(view) : rare ? rareCabSprite(view) : cab(view === "side" ? "side" : "front"));
// A cab's yellow outline, two pixels wide, for the taxi taking a new hire to work (decision 207).
const halos = new WeakMap();
function haloOf(img) {
  let h = halos.get(img);
  if (!h) {
    const [mask, m] = newCanvas(img.width, img.height); m.drawImage(img, 0, 0); m.globalCompositeOperation = "source-in"; m.fillStyle = "#ffd84a"; m.fillRect(0, 0, img.width, img.height);
    const [out, o] = newCanvas(img.width + 4, img.height + 4);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) <= 2) o.drawImage(mask, 2 + dx, 2 + dy);
    h = out; halos.set(img, h);
  }
  return h;
}
const bikes = new Map();
// The mailman on his bicycle, facing right: postal blue, a cap, a satchel, letters in the front basket.
function bike(frame, carrying) {
  const key = `${frame}${carrying ? "l" : ""}`;
  if (!bikes.has(key)) bikes.set(key, outlined(28, 30, (g) => {
    g.translate(2, 2);
    for (const [cx, cy] of [[5, 21], [19, 21]]) { oval(g, cx, cy, 4, 4, INK); oval(g, cx, cy, 3, 3, "#55525e"); R(g, cx - 2, cy - 2, 5, 5, "#55525e"); if (frame % 2) R(g, cx, cy - 3, 1, 7, "#8b8fa8"); else R(g, cx - 3, cy, 7, 1, "#8b8fa8"); R(g, cx, cy, 1, 1, "#cfd6e2"); }
    line(g, 5, 21, 9, 15, "#d8392b"); line(g, 9, 15, 17, 14, "#d8392b"); line(g, 17, 14, 19, 21, "#d8392b"); line(g, 9, 15, 12, 21, "#d8392b"); line(g, 12, 21, 5, 21, "#d8392b");
    R(g, 7, 13, 4, 1, INK); R(g, 16, 11, 3, 1, INK); line(g, 17, 11, 17, 14, INK); // saddle, handlebar
    R(g, 17, 12, 6, 3, "#b5823a"); R(g, 17, 12, 6, 1, "#d09c4c"); // the basket
    if (carrying) { R(g, 18, 9, 5, 4, "#fff6e0"); R(g, 18, 9, 5, 1, "#d8392b"); line(g, 18, 10, 20, 12, "#cfc4b0"); line(g, 22, 10, 20, 12, "#cfc4b0"); }
    const knee = frame % 2 ? [12, 15] : [13, 13], foot = frame % 2 ? [11, 21] : [14, 19];
    line(g, 9, 12, knee[0], knee[1], "#32344f"); line(g, knee[0], knee[1], foot[0], foot[1], "#32344f"); R(g, foot[0], foot[1], 2, 1, INK);
    R(g, 8, 5, 5, 8, "#2f5fa8"); R(g, 8, 5, 5, 1, "#4f8fd6"); // the uniform, leaning into the ride
    line(g, 12, 7, 16, 11, "#2f5fa8"); R(g, 16, 11, 1, 1, "#eebb8e");
    R(g, 6, 9, 3, 4, "#8a5a33"); R(g, 6, 9, 3, 1, "#a8743f"); // the satchel
    R(g, 9, 0, 5, 5, "#eebb8e"); R(g, 13, 2, 1, 1, INK); R(g, 8, -1, 6, 2, "#1f3f78"); R(g, 13, 0, 3, 1, "#1f3f78"); // head and cap
  }));
  return bikes.get(key);
}
const ENVELOPE = (g, x, y) => { R(g, x - 4, y - 3, 8, 6, INK); R(g, x - 3, y - 2, 6, 4, "#fff6e0"); R(g, x - 3, y - 2, 6, 1, "#d8392b"); R(g, x - 1, y, 2, 1, "#cfc4b0"); };

// ---------- The ground ----------
const PLAZA = ["#6f5c6c", "#776370", "#6a5768"], WALK = ["#7a7690", "#817d97", "#74708a"];
function paving(g, x, y, w, h, tones, grout, seed, size = 8) {
  const r = rng(seed);
  for (let ty = 0; ty < h; ty += size) for (let tx = 0; tx < w; tx += size) {
    R(g, x + tx, y + ty, Math.min(size, w - tx), Math.min(size, h - ty), tones[Math.floor(r() * tones.length)]);
    R(g, x + tx, y + ty, Math.min(size, w - tx), 1, grout);
    R(g, x + tx, y + ty, 1, Math.min(size, h - ty), grout);
  }
}
// Grass: one 128-pixel tile of blades, repeated (the larger map would cost a quarter-million rectangles otherwise).
let lawnTile = null;
function lawn(g, x, y, w, h, seed) {
  void seed;
  if (!lawnTile) {
    const [c, t] = newCanvas(128, 128), r = rng("lawn");
    R(t, 0, 0, 128, 128, "#2f6a52");
    for (let i = 0; i < (128 * 128) / 26; i++) R(t, Math.floor(r() * 128), Math.floor(r() * 127), 1, 2, r() > 0.5 ? "#387a5c" : "#29604a");
    lawnTile = c;
  }
  g.fillStyle = g.createPattern(lawnTile, "repeat");
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function roadH(g, x, y, w, h, seed) {
  R(g, x, y, w, h, "#3f4168");
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 40; i++) R(g, x + r() * w, y + r() * h, 1, 1, r() > 0.5 ? "#4a4c74" : "#383a5e");
}
function street(g, x0, x1, y, seed, avenues) { // tiles
  const X = x0 * TILE, W = (x1 - x0) * TILE, Y = y * TILE, H = 3 * TILE;
  paving(g, X, Y, W, 8, WALK, "#65617c", `${seed}n`);
  paving(g, X, Y + H - 8, W, 8, WALK, "#65617c", `${seed}s`);
  roadH(g, X, Y + 8, W, H - 16, seed);
  for (let dx = 4; dx < W; dx += 20) R(g, X + dx, Y + H / 2 - 1, 10, 2, "#b9a45a");
  for (const a of avenues) if (a >= x0 && a < x1) for (let k = 0; k < 4; k++) R(g, (a + 3) * TILE + 2, Y + 11 + k * 7, 8, 4, "#cfcfd6"); // a crossing beside each junction
}
function avenue(g, x, y0, y1, seed) { // tiles
  const X = x * TILE, Y = y0 * TILE, H = (y1 - y0) * TILE, W = 3 * TILE;
  paving(g, X, Y, 8, H, WALK, "#65617c", `${seed}w`);
  paving(g, X + W - 8, Y, 8, H, WALK, "#65617c", `${seed}e`);
  roadH(g, X + 8, Y, W - 16, H, seed);
  for (let dy = 4; dy < H; dy += 20) R(g, X + W / 2 - 1, Y + dy, 2, 10, "#b9a45a");
}

// A junction's paint (decision 173): a stop line on each approach where there are lights, give-way teeth on the
// street where it gives way to the avenue, and a roundabout: a ring of road round a little planted island.
function junctionMarks(g, j) {
  const { cx, cy } = j, s = STOP_AT, LINE = "#e8e6f0";
  const teeth = (x, y, w, h) => { for (let k = 0; k < Math.max(w, h); k += 4) R(g, x + (w > h ? k : 0), y + (w > h ? 0 : k), w > h ? 2 : w, w > h ? h : 2, LINE); };
  if (j.kind === "light") {
    R(g, cx - s - 2, cy, 2, 16, LINE); R(g, cx + s, cy - 16, 2, 16, LINE); // eastbound, westbound
    R(g, cx - 16, cy - s - 2, 16, 2, LINE); R(g, cx, cy + s, 16, 2, LINE); // southbound, northbound
  } else if (j.kind === "giveway") {
    teeth(cx - s - 2, cy, 2, 16); teeth(cx + s, cy - 16, 2, 16);
  } else if (j.kind === "roundabout") {
    // Twice the old size (decision 252): the ring road around RING_R (40), a kerb outside it, a planted island inside.
    const O = 52, I = 26;
    oval(g, cx, cy, O + 2, O + 2, "#65617c"); oval(g, cx, cy, O, O, "#3f4168");
    R(g, cx - O - 4, cy - 16, 2 * O + 8, 32, "#3f4168"); R(g, cx - 16, cy - O - 4, 32, 2 * O + 8, "#3f4168");
    for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; if (a % 2) R(g, cx + Math.cos(t) * (O - 3) - 1, cy + Math.sin(t) * (O - 3) - 1, 2, 2, "#56587e"); }
    teeth(cx - O, cy, 2, 16); teeth(cx + O - 2, cy - 16, 2, 16); teeth(cx - 16, cy - O, 16, 2); teeth(cx, cy + O - 2, 16, 2);
    oval(g, cx, cy, I, I, "#cfcfd6"); oval(g, cx, cy, I - 2, I - 2, "#387a5c");
    for (const [dx, dy, c] of [[-10, 4, "#f4c63c"], [8, 8, "#e0625a"], [-4, 12, "#fff6e0"], [12, -2, "#f4c63c"], [-14, -6, "#e0625a"], [2, -14, "#fff6e0"]]) R(g, cx + dx, cy + dy, 2, 2, c);
    R(g, cx - 1, cy - 6, 2, 7, "#6b4226"); oval(g, cx, cy - 10, 7, 6, "#2f7a52"); oval(g, cx - 1, cy - 12, 4, 3, "#4f9a6a");
  }
}
// A traffic light on its pole at the kerb, facing the traffic it holds: red, amber and green, one of them lit.
function signalHead(g, x, y, state) {
  R(g, x, y - 12, 2, 13, "#2a2d4a"); R(g, x - 1, y, 4, 1, "rgba(20,18,40,.4)");
  R(g, x - 2, y - 25, 6, 14, INK); R(g, x - 1, y - 24, 4, 12, "#24263f");
  const lamp = (dy, on, lit, off) => { R(g, x - 1 + 1, y - 24 + dy, 2, 2, on ? lit : off); if (on) { R(g, x - 1, y - 24 + dy, 4, 4, "rgba(255,255,255,.12)"); R(g, x, y - 23 + dy, 2, 2, lit); } };
  lamp(1, state === "red", "#ff4a3d", "#5a2430"); lamp(5, state === "amber", "#ffc23c", "#5a4a24"); lamp(9, state === "green", "#3ee08a", "#1f4a36");
}

// ---------- Scenery. It never pretends to be anyone ----------
function glow(g, cx, cy, big = 1) {
  oval(g, cx, cy, 28 * big, 13 * big, "rgba(255,206,130,.11)");
  oval(g, cx, cy, 20 * big, 9 * big, "rgba(255,206,130,.14)");
  oval(g, cx, cy, 11 * big, 5 * big, "rgba(255,218,160,.2)");
}
function lamp(g, x, y) {
  glow(g, x, y + 1);
  R(g, x - 3, y - 1, 7, 2, INK); R(g, x - 2, y - 2, 5, 1, "#3a3d5a");
  R(g, x - 1, y - 20, 2, 18, "#2a2d4a"); R(g, x, y - 20, 1, 18, "#3f4368");
  oval(g, x, y - 23, 6, 6, "rgba(255,226,150,.16)");
  oval(g, x, y - 23, 3, 3, INK); oval(g, x, y - 23, 2, 2, "#ffe9a0"); R(g, x - 1, y - 24, 1, 1, "#fff8d8");
}
function tree(g, x, y, r) {
  oval(g, x + 1, y, 9, 3, "rgba(20,18,40,.35)");
  R(g, x - 2, y - 9, 4, 9, "#6b4630"); R(g, x - 2, y - 9, 1, 9, "#7f5638"); R(g, x - 3, y - 1, 6, 2, "#5a3a28");
  const dx = Math.floor(r() * 3) - 1;
  for (const [ox, oy, rx, ry] of [[0, -22, 10, 11], [-5 + dx, -14, 7, 7], [5 + dx, -15, 7, 7]]) oval(g, x + ox, y + oy, rx + 1, ry + 1, INK);
  for (const [ox, oy, rx, ry] of [[0, -22, 10, 11], [-5 + dx, -14, 7, 7], [5 + dx, -15, 7, 7]]) oval(g, x + ox, y + oy, rx, ry, "#2c6b49");
  oval(g, x - 1, y - 24, 7, 7, "#3a8456");
  oval(g, x - 3, y - 27, 3, 3, "#59a468");
  oval(g, x - 6 + dx, y - 15, 3, 3, "#3a8456"); oval(g, x + 4 + dx, y - 16, 3, 3, "#3a8456");
}
function hedge(g, x, y, w) {
  R(g, x, y, w, 10, INK); R(g, x + 1, y + 1, w - 2, 8, "#2f6e4a"); R(g, x + 1, y + 1, w - 2, 3, "#3f8a57");
  const r = rng(`${x},${y}`);
  for (let i = 0; i < w / 3; i++) R(g, x + 1 + r() * (w - 3), y + 2 + r() * 6, 2, 1, r() > 0.5 ? "#55a265" : "#28603f");
}
function bench(g, x, y) {
  R(g, x, y, 22, 2, INK); R(g, x + 1, y + 1, 20, 3, "#c98f55"); R(g, x + 1, y + 1, 20, 1, "#e2ae72");
  R(g, x + 1, y + 5, 20, 3, "#a97444"); R(g, x, y + 4, 22, 1, INK); R(g, x, y + 8, 22, 1, INK);
  R(g, x + 2, y + 9, 2, 3, INK); R(g, x + 18, y + 9, 2, 3, INK);
}
function flowers(g, x, y, c) {
  R(g, x, y + 3, 16, 7, INK); R(g, x + 1, y + 4, 14, 5, "#a6794a"); R(g, x + 1, y + 4, 14, 1, "#c79660");
  const r = rng(`${x}f${y}`);
  for (let i = 0; i < 12; i++) R(g, x + 1 + r() * 13, y + r() * 3, 1, 2, i % 3 ? "#3f8a57" : c);
}
function stallRoof(g, x, y, w, a, b) { // a striped market awning with a scalloped edge
  R(g, x - 1, y - 1, w + 2, 9, INK);
  for (let i = 0; i < w; i += 4) { R(g, x + i, y, Math.min(4, w - i), 6, (i / 4) % 2 ? a : b); R(g, x + i + 1, y + 6, Math.min(2, w - i), 2, (i / 4) % 2 ? a : b); }
  R(g, x, y, w, 1, "rgba(255,255,255,.3)");
}
function sign(g, text, cx, y, maxW) {
  const label = fit(text, maxW), w = Math.min(textW(label), maxW) + 8;
  R(g, cx - w / 2 - 1, y - 1, w + 2, 11, INK); R(g, cx - w / 2, y, w, 9, "#c98f55"); R(g, cx - w / 2, y, w, 1, "#e2ae72"); R(g, cx - w / 2, y + 8, w, 1, "#8a5a33");
  pixelText(g, label, Math.round(cx - w / 2 + 4), y + 2, "#2e1c10");
}

// ---------- Connector signs (decision 173): a tenant plaque for each connected tool, by the tower's doors ----------
// The logo comes from the server already as City pixels (12×12, in the City's palette); with none, the plaque
// carries the tool's initial, big; the last place may say "+N" for the rest. Drawn into a 14×14 canvas.
const PLAQUE_TINTS = ["#3f7fd0", "#37a564", "#e8842c", "#9a6bd0", "#d8392b", "#3f9a9a", "#b84f78", "#8d9440"];
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
function plaque(item) {
  const [c, g] = newCanvas(PLAQUE, PLAQUE), s = item.sign?.sign, S = PLAQUE - 2;
  R(g, 0, 0, PLAQUE, PLAQUE, INK);
  if (item.more) {
    R(g, 1, 1, S, S, "#2c3550"); R(g, 1, 1, S, 1, "#3b4a66");
    const txt = textW(`+${item.more}`) <= S ? `+${item.more}` : "+";
    pixelText(g, txt, Math.round(1 + (S - textW(txt)) / 2), 5, "#fff6e0");
    return c;
  }
  const px = s && typeof s.px === "string" && s.px.length === s.size * s.size && s.size === S ? s.px : null;
  if (px) {
    const colors = Array.isArray(s.colors) ? s.colors.filter((x) => /^#[0-9a-f]{6}$/i.test(x)) : [];
    const used = [...px].filter((ch) => ch !== ".").map((ch) => colors[ch.charCodeAt(0) - 97]).filter(Boolean);
    const bright = used.length ? used.reduce((a, h) => a + lum(h), 0) / used.length : 0;
    R(g, 1, 1, S, S, bright > 150 ? "#2c3550" : "#fff6e0"); R(g, 1, 1, S, 1, bright > 150 ? "#3b4a66" : "#ffffff"); // a plate the logo shows up on
    for (let i = 0; i < px.length; i++) { const col = colors[px.charCodeAt(i) - 97]; if (px[i] !== "." && col) R(g, 1 + (i % S), 1 + Math.floor(i / S), 1, 1, col); }
    return c;
  }
  // No logo: the tool's initial, twice the size of the street lettering, on a plate in a colour of its own.
  const name = String(item.sign?.label ?? item.sign?.id ?? "?"), ch = [...fold(name)].find((x) => GLYPH[x] && x !== " ") ?? "?";
  R(g, 1, 1, S, S, PLAQUE_TINTS[hashOf(name) % PLAQUE_TINTS.length]); R(g, 1, 1, S, 1, "rgba(255,255,255,.35)");
  const rows = WIDE[ch] ?? [...GLYPH[ch]].map((h) => parseInt(h, 16) << 1);
  for (let r = 0; r < 5; r++) for (let b = 0; b < 5; b++) if (rows[r] & (16 >> b)) R(g, 2 + b * 2, 2 + r * 2, 2, 2, "#fff6e0");
  return c;
}

// Each department's own colours, by its slot, so twelve offices look like twelve offices.
const ROOFS = [["#c0533f", "#d96c50", "#9c3f30"], ["#3f7fa8", "#5499c2", "#2f6387"], ["#3f8f6a", "#55a97f", "#2f7052"], ["#b5823a", "#d09c4c", "#8e642a"], ["#7f5aa8", "#9a74c2", "#634587"], ["#b84f78", "#d26a92", "#923c5e"], ["#4a6fb0", "#6288c8", "#37558c"], ["#8d9440", "#a8ae52", "#6e7430"], ["#b0663a", "#cb7f4e", "#8c4f2c"], ["#3f9a9a", "#55b4b4", "#2f7878"], ["#a84848", "#c25e5e", "#863636"], ["#5f7a8a", "#7894a4", "#485e6c"]];
const WALLS = ["#e6d3ae", "#d9c6c0", "#cfd3c0", "#e2c8a8"];
// ---------- Towers (decision 117): one Manhattan-style tower per department, the same size whatever the headcount ----------
// Three facades so the streets don't repeat: limestone art deco, red brick, steel and glass. The accent (crown,
// canopy, stripes) is the department's own colour from ROOFS.
const FACADES = [
  { wall: "#d9cdb4", shade: "#b9ab90", trim: "#efe4cc", glass: "#2c3550" }, // limestone, art deco
  { wall: "#b7634a", shade: "#94503b", trim: "#d98a6c", glass: "#2a3048" }, // red brick, pre-war
  { wall: "#5d7088", shade: "#475a70", trim: "#8fa6c0", glass: "#22304a" }, // steel and glass
];
// The tower's sections, bottom up, in art pixels inside its plot: a lobby, then set-backs narrowing to a crown.
function towerShape(b) {
  const X = b.x * TILE, Y = b.y * TILE, W = b.w * TILE, H = b.h * TILE;
  const cx = X + W / 2, foot = Y + H - 14; // the pavement in front takes the last 14 px
  // Sized to the plot (decision 166): wider lots get wider towers, taller lots more floors; three silhouettes.
  const step = [[1, 0.82, 0.625, 0.41], [1, 0.9, 0.8, 0.45], [1, 0.7, 0.55, 0.4]][hashOf(`shape:${b.dept}`) % 3];
  const k = Math.max(0.7, (H - 66) / 126), base = W - 32;
  const tiers = [[base * step[0], 46 * k], [base * step[1], 46 * k], [base * step[2], 34 * k], [base * step[3], 12]].map(([w, h]) => [Math.round(w / 2) * 2, Math.round(h)]); // [width, height] from the street up
  const out = [];
  let top = foot;
  for (const [w, h] of tiers) { top -= h; out.push({ x: Math.round(cx - w / 2), y: top, w, h }); }
  return { cx, foot, tiers: out, top, X, Y, W, H };
}
// Every window of a tower, lowest floor first, so the lit ones fill up from the street as people come in.
function towerWindows(b) {
  const t = towerShape(b), out = [];
  t.tiers.slice(0, 3).forEach((tier, k) => {
    const first = k === 0 ? 30 : 6; // the lobby keeps its glass doors clear
    for (let y = tier.y + tier.h - first - 6; y >= tier.y + 6; y -= 9) for (let x = tier.x + 6; x + 4 <= tier.x + tier.w - 5; x += 8) out.push({ x, y, w: 4, h: 5 });
  });
  return out;
}
// The pavement and lamps of a tower's plot (they stay while the tower goes up or comes down).
function towerPlot(g, b) {
  const t = towerShape(b);
  paving(g, t.X, t.foot - 2, t.W, t.H - (t.foot - t.Y) + 2, WALK, "#5e5a74", b.dept);
  lamp(g, t.X + 6, t.foot + 10); lamp(g, t.X + t.W - 6, t.foot + 10);
}
function tower(g, b) { towerPlot(g, b); towerBody(g, b); }
// A building site: the plot's pavement, a dirt pit behind a striped hoarding (under a tower going up, or after one came down).
function site(g, b) {
  const t = towerShape(b), q = t.tiers[0];
  towerPlot(g, b);
  R(g, q.x - 3, t.foot - 10, q.w + 6, 10, INK); R(g, q.x - 2, t.foot - 9, q.w + 4, 8, "#6b5236");
  for (let x = q.x; x < q.x + q.w; x += 7) R(g, x, t.foot - 8, 3, 2, "#58432c");
  for (let x = q.x - 2; x < q.x + q.w + 2; x += 6) { R(g, x, t.foot - 3, 3, 3, "#f4c63c"); R(g, x + 3, t.foot - 3, 3, 3, INK); } // the hoarding
}
// The tower alone, drawn once into its own canvas, so it can rise, be built floor by floor, or be pulled down.
const towerSprites = new Map();
function towerSprite(b) {
  const key = `${b.dept}|${b.slot}|${b.x},${b.y},${b.w},${b.h}`;
  let c = towerSprites.get(key);
  if (!c) { const t = towerShape(b); const [cv, g] = newCanvas(t.W, t.H); g.translate(-t.X, -t.Y); towerBody(g, b); c = cv; towerSprites.set(key, c); }
  return c;
}
// The same tower as a soft, cool, blurred silhouette: the placeholder on its lot while the city loads (decision 249).
// Drawn small and scaled back up with smoothing, so it blurs the same in every browser and in the iPhone app.
const ghostSprites = new Map();
function ghostSprite(b) {
  const key = `${b.dept}|${b.slot}|${b.x},${b.y},${b.w},${b.h}`;
  let c = ghostSprites.get(key);
  if (!c) {
    const sp = towerSprite(b), f = 7;
    const [small, gs] = newCanvas(sp.width / f, sp.height / f);
    gs.imageSmoothingEnabled = true; gs.drawImage(sp, 0, 0, small.width, small.height);
    const [cv, g] = newCanvas(sp.width, sp.height);
    g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, sp.width, sp.height);
    g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(176,188,222,.6)"; g.fillRect(0, 0, sp.width, sp.height); // grey-blue, like a building in mist
    c = cv; ghostSprites.set(key, c);
  }
  return c;
}
function towerBody(g, b) {
  const t = towerShape(b), f = FACADES[hashOf(b.dept) % FACADES.length], [accent, light, dark] = ROOFS[b.slot % ROOFS.length];
  R(g, t.tiers[0].x - 4, t.foot - 1, t.tiers[0].w + 8, 4, "rgba(20,18,40,.35)"); // its shadow on the pavement
  // The body, tier by tier: an ink outline, the wall, a lit edge on the left and a shaded edge on the right.
  for (const [k, q] of t.tiers.entries()) {
    R(g, q.x - 1, q.y - 1, q.w + 2, q.h + 2, INK);
    R(g, q.x, q.y, q.w, q.h, f.wall);
    R(g, q.x, q.y, 2, q.h, f.trim); R(g, q.x + q.w - 3, q.y, 3, q.h, f.shade);
    if (k < 3) { R(g, q.x - 3, q.y - 2, q.w + 6, 3, INK); R(g, q.x - 2, q.y - 1, q.w + 4, 1, f.trim); } // the set-back ledge
    if (k > 0 && k < 3) for (let x = q.x + 5; x < q.x + q.w - 5; x += 8) R(g, x + 4, q.y + 2, 1, q.h - 4, f.shade); // pilasters between window bays
  }
  // Dark glass in every window; the lit ones are painted live, from the headcount.
  for (const w of towerWindows(b)) { R(g, w.x, w.y, w.w, w.h, f.glass); R(g, w.x, w.y, w.w, 1, "rgba(255,255,255,.12)"); }
  // The crown: stepped art-deco fins in the department's colour, a spire and its beacon.
  const c = t.tiers[3];
  R(g, c.x + 2, c.y + 2, c.w - 4, c.h - 4, accent);
  for (let x = c.x + 4; x < c.x + c.w - 4; x += 6) { R(g, x, c.y + 2, 2, c.h - 4, light); R(g, x + 2, c.y + c.h - 4, 2, 2, dark); }
  for (const [w, h] of [[30, 4], [16, 4], [6, 4]]) { const y0 = c.y - h - ([30, 16, 6].indexOf(w)) * 4; R(g, t.cx - w / 2 - 1, y0 - 1, w + 2, h + 2, INK); R(g, t.cx - w / 2, y0, w, h, accent); R(g, t.cx - w / 2, y0, w, 1, light); }
  R(g, t.cx - 1, c.y - 30, 2, 12, INK); R(g, t.cx - 0.5, c.y - 30, 1, 12, "#cfd6e2");
  // A band in the department's colour under each ledge, the name on the lobby, a canopy over the doors.
  const base = t.tiers[0];
  R(g, base.x, base.y + 3, base.w, 2, accent);
  R(g, base.x + 8, t.foot - 30, base.w - 16, 2, dark);
  const dw = 22, dx = Math.round(t.cx - dw / 2), dy = t.foot - 22;
  R(g, dx - 4, dy - 4, dw + 8, 4, INK); R(g, dx - 3, dy - 3, dw + 6, 2, accent); // the canopy
  R(g, dx - 1, dy - 1, dw + 2, 23, INK); R(g, dx, dy, dw, 22, "#1a2236"); // the doorway (the panels are live)
  for (const gx of [base.x + 8, base.x + base.w - 24]) { R(g, gx - 1, dy - 1, 18, 19, INK); R(g, gx, dy, 16, 17, "#3b4a66"); R(g, gx, dy, 16, 3, "#5b6f92"); R(g, gx + 7, dy, 2, 17, INK); } // lobby glass
  sign(g, b.dept, t.cx, base.y + 9, base.w - 10);
}
function freeLot(g, l, text) {
  const X = l.x * TILE, Y = l.y * TILE, W = l.w * TILE, H = l.h * TILE, r = rng(`${l.x},${l.y}`);
  lawn(g, X, Y, W, H, `${X}${Y}`);
  hedge(g, X + 2, Y + 2, W - 4);
  tree(g, X + 26, Y + 62, r); tree(g, X + W - 24, Y + 104, r);
  flowers(g, X + 40, Y + H - 22, "#e0c04a");
  if (!text) return;
  sign(g, text, X + W / 2, Y + H / 2 - 6, W - 20);
  R(g, X + W / 2 - 1, Y + H / 2 + 5, 2, 8, "#6b4630");
}

// Where the four of the core stand on the plaza, in art pixels from the corner of HQ's plot.
// The Orchestrator stands on the podium at the HQ entrance; VAIC in the plaza, by the fountain.
const CORE_SPOT = { orchestrator: [96, 100], vaic: [62, 152] };
// The executives' places at HQ while they advise (decision 140): in front of the boardroom window, left of the door.
const EXEC_SPOT = { "exec-ceo": [22, 92], "exec-coo": [36, 92], "exec-cfo": [22, 106], "exec-cto": [36, 106] };
const FOUNTAIN = [112, 140];
const CORE_DESK = new Set();
function headquarters(g, q) {
  const X = q.x * TILE, Y = q.y * TILE, W = q.w * TILE, H = q.h * TILE;
  paving(g, X, Y + 64, W, H - 64, PLAZA, "#5e4d5e", "hq", 8);
  const bx = X + 8, bw = W - 16, by = Y + 8;
  R(g, bx - 1, by + 69, bw + 2, 4, "rgba(20,18,40,.35)");
  R(g, bx - 1, by + 18, bw + 2, 52, INK); R(g, bx, by + 19, bw, 50, "#d6cdb8"); R(g, bx, by + 19, bw, 3, "rgba(60,30,40,.22)");
  R(g, bx - 3, by - 1, bw + 6, 21, INK); R(g, bx - 2, by, bw + 4, 19, "#3f5f92");
  for (let ry = 0; ry < 19; ry += 4) R(g, bx - 2, by + ry, bw + 4, 1, "#324c78");
  R(g, bx - 2, by, bw + 4, 2, "#5c7fb8");
  for (let wx = bx + 8; wx < bx + bw - 12; wx += 20) { if (Math.abs(wx + 7 - (X + W / 2)) < 26) continue; for (const wy of [by + 26, by + 46]) { R(g, wx - 1, wy - 1, 16, 15, INK); R(g, wx, wy, 14, 13, "#ffdf94"); R(g, wx, wy, 14, 3, "#ffefc0"); R(g, wx + 6, wy, 2, 13, INK); } }
  // The boardroom (decision 140): the four executives at their table, behind HQ's top-left window. Advice only.
  { const wx = bx + 8, wy = by + 26; R(g, wx + 1, wy + 8, 12, 2, "#7a4a2a"); for (const [i, c] of ["#c0504a", "#4f7fa0", "#e0c04a", "#6a7f4a"].entries()) R(g, wx + 1 + i * 3 + (i > 1 ? 1 : 0), wy + 5, 2, 3, c); }
  // The tower with its clock, and the grand door.
  const cx = X + W / 2;
  R(g, cx - 19, by - 8, 38, 78, INK); R(g, cx - 18, by - 7, 36, 77, "#e6dfc9"); R(g, cx - 18, by - 7, 36, 3, "#f4eedd");
  R(g, cx - 20, by - 13, 40, 7, INK); R(g, cx - 19, by - 12, 38, 5, "#3f5f92");
  oval(g, cx, by + 7, 9, 9, INK); oval(g, cx, by + 7, 8, 8, "#fff6e0"); R(g, cx, by + 1, 1, 6, INK); R(g, cx, by + 7, 5, 1, INK);
  R(g, cx - 11, by + 44, 22, 26, INK); R(g, cx - 10, by + 45, 20, 25, "#7a4a2a"); R(g, cx - 1, by + 45, 2, 25, INK); R(g, cx - 5, by + 58, 2, 2, "#f4c63c"); R(g, cx + 3, by + 58, 2, 2, "#f4c63c");
  stallRoof(g, cx - 20, by + 36, 40, "#3f5f92", "#f3e6cc");
  sign(g, "HQ", cx, by + 24, 30);
  // The podium the Orchestrator stands on, and the fountain's basin; the water is drawn live.
  const [ox, oy] = CORE_SPOT.orchestrator; oval(g, X + ox, Y + oy, 12, 4, INK); oval(g, X + ox, Y + oy - 1, 11, 3, "#c9b28a");
  const [fx, fy] = FOUNTAIN;
  glow(g, X + fx, Y + fy, 1.5);
  oval(g, X + fx, Y + fy + 2, 24, 11, "rgba(20,18,40,.3)");
  oval(g, X + fx, Y + fy, 24, 11, INK); oval(g, X + fx, Y + fy - 1, 23, 10, "#b5b4c4"); oval(g, X + fx, Y + fy - 1, 19, 8, "#55749c");
  R(g, X + fx - 2, Y + fy - 11, 4, 11, INK); R(g, X + fx - 1, Y + fy - 10, 2, 10, "#c9c9d6");
  lamp(g, X + 12, Y + H - 4); lamp(g, X + W - 12, Y + H - 4); lamp(g, X + 60, Y + 98); lamp(g, X + 132, Y + 98);
  bench(g, X + 150, Y + H - 28); flowers(g, X + 6, Y + 78, "#d2699e"); flowers(g, X + W - 22, Y + 78, "#e0c04a");
}
// ---------- The neighbourhood (decision 188): three New York apartment buildings on every block of homes ----------
// Brick and brownstone walls with rows of windows, black iron fire escapes zig-zagging down the front, a cornice and
// rooftop gear (water towers, bulkheads), a stoop or an awning at the door, and a few windows lit at dusk.
const APT_WALLS = {
  slim: [["#9a4a38", "#b45e49", "#76352a"], ["#8c4434", "#a65845", "#6a3024"]], // red brick
  mid: [["#6f4a3a", "#87604d", "#54362a"], ["#7b5241", "#946a56", "#5d3c2f"]], // brownstone
  wide: [["#b48e66", "#cba57c", "#8f6e4c"], ["#a98468", "#c09c7f", "#86654d"]], // buff brick
};
const AWNINGS = ["#2f6e4a", "#7a2f3a", "#2f416e"];
const STONE = "#d8cbb0", GLASS = "#2b3352", LIT = "#ffdf94", LIT_TOP = "#ffefc0";
const ROOF_GEAR = 14; // the top of a building's plot holds its water tower and bulkheads
function aptShape(a) {
  const X = a.x * TILE + 2, W = a.w * TILE - 4, foot = (a.y + a.h) * TILE, top = a.y * TILE + ROOF_GEAR;
  return { X, W, foot, top, cx: X + W / 2 };
}
// The windows of the upper floors, top floor first; the ground floor keeps the entrance (and the shops on a wide one).
function aptWindows(a) {
  const { W, foot, top, cx } = aptShape(a), cols = Math.max(2, Math.floor((W - 6) / 9)), x0 = Math.round(cx - (cols * 9 - 4) / 2), out = [];
  for (let y = top + 9, floor = 0; y + 8 <= foot - 21; y += 13, floor++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * 9, y, w: 5, h: 8, floor, col: c, cols });
  return out;
}
function waterTower(g, x, top) {
  R(g, x - 5, top - 5, 1, 5, INK); R(g, x + 4, top - 5, 1, 5, INK); R(g, x - 1, top - 4, 2, 4, INK); // the legs
  R(g, x - 6, top - 12, 12, 8, INK); R(g, x - 5, top - 11, 10, 6, "#8a5a3a"); R(g, x - 5, top - 11, 2, 6, "#a87048");
  R(g, x - 5, top - 9, 10, 1, "#4a3022"); R(g, x - 5, top - 7, 10, 1, "#4a3022"); // the hoops
  R(g, x - 5, top - 13, 10, 1, INK); R(g, x - 3, top - 14, 6, 1, INK); R(g, x - 4, top - 13, 8, 1, "#5a3a28"); // the cone
}
function bulkhead(g, x, top, w, c) {
  R(g, x - 1, top - 8, w + 2, 8, INK); R(g, x, top - 7, w, 7, c); R(g, x, top - 7, w, 1, "rgba(255,255,255,.18)");
  R(g, x + 2, top - 5, 3, 4, GLASS);
}
function apartment(g, a) {
  const { X, W, foot, top, cx } = aptShape(a), k = hashOf(`apt:${a.x},${a.y}`), [wall, light, dark] = APT_WALLS[a.kind][k % 2];
  // The pavement in front, where the residents stand, and the building's shadow on it.
  paving(g, X - 2, foot, W + 4, 16, WALK, "#5f5b74", `apt${a.x},${a.y}`, 8);
  R(g, X - 2, foot, W + 4, 3, "rgba(20,18,40,.35)");
  // The roof: a water tower on the brick ones, bulkheads and a chimney on the brownstone.
  if (a.kind === "mid") { bulkhead(g, X + 6, top, 12, dark); R(g, X + W - 14, top - 6, 4, 6, INK); R(g, X + W - 13, top - 5, 2, 5, "#7a3a2c"); }
  else if (a.kind === "slim") { bulkhead(g, X + 4, top, 14, dark); waterTower(g, X + W - 11, top); }
  else { waterTower(g, X + 12, top); bulkhead(g, X + W - 20, top, 10, dark); R(g, X + W / 2 - 4, top - 3, 8, 3, "#8f97a8"); }
  // The walls: brick courses (smooth stone on the brownstone), a lit edge on the left, a shaded one on the right.
  R(g, X - 1, top - 1, W + 2, foot - top + 1, INK); R(g, X, top, W, foot - top, wall);
  for (let y = top + 3; y < foot; y += a.kind === "mid" ? 6 : 3) R(g, X, y, W, 1, "rgba(0,0,0,.13)");
  if (a.kind !== "mid") for (let y = top + 1; y < foot; y += 6) for (let x = X + ((y / 3) % 2 ? 2 : 5); x < X + W; x += 6) R(g, x, y, 1, 2, "rgba(0,0,0,.09)");
  R(g, X, top, 2, foot - top, light); R(g, X + W - 3, top, 3, foot - top, dark);
  // The cornice with its dentils, and a stone belt over the ground floor.
  R(g, X - 3, top - 2, W + 6, 6, INK); R(g, X - 2, top - 1, W + 4, 3, STONE); R(g, X - 2, top - 1, W + 4, 1, "#f0e6cf");
  for (let x = X - 1; x < X + W + 2; x += 3) R(g, x, top + 2, 1, 1, "#a89a80");
  R(g, X, foot - 21, W, 2, STONE); R(g, X, foot - 19, W, 1, "rgba(0,0,0,.2)");
  // The windows: stone lintels, double-hung sashes, a few lit at dusk.
  const wins = aptWindows(a);
  for (const [i, w] of wins.entries()) {
    R(g, w.x - 1, w.y - 2, w.w + 2, 1, STONE); R(g, w.x - 1, w.y - 1, w.w + 2, w.h + 2, INK);
    const lit = hashOf(`${a.x},${a.y}:${i}`) % 7 === 0;
    R(g, w.x, w.y, w.w, w.h, lit ? LIT : GLASS); R(g, w.x, w.y, w.w, 1, lit ? LIT_TOP : "rgba(255,255,255,.14)");
    R(g, w.x, w.y + 4, w.w, 1, INK);
  }
  // The fire escape: black iron landings under two columns of windows, ladders zig-zagging between them.
  if (a.kind !== "wide" && wins.length) {
    const cols = wins[0].cols, c0 = a.kind === "slim" ? cols - 2 : 0, first = wins.find((w) => w.col === c0);
    const fx = first.x - 3, fw = 9 + 5 + 6, floors = Math.max(...wins.map((w) => w.floor)) + 1;
    for (let f = 0; f < floors; f++) {
      const y = top + 9 + f * 13 + 9;
      R(g, fx, y, fw, 1, INK); R(g, fx, y - 4, fw, 1, INK); // the landing and its rail
      for (let x = fx; x < fx + fw; x += 3) R(g, x, y - 3, 1, 3, INK);
      R(g, fx, y + 1, fw, 1, "rgba(0,0,0,.25)");
      if (f < floors - 1) line(g, f % 2 ? fx + 2 : fx + fw - 3, y, f % 2 ? fx + fw - 3 : fx + 2, y + 13, INK); // down to the next one
    }
    R(g, fx + 2, top + 9 + (floors - 1) * 13 + 10, 1, 5, INK); R(g, fx + 4, top + 9 + (floors - 1) * 13 + 10, 1, 5, INK); // the drop ladder, pulled up
  }
  // The way in: a door with a lit transom, under an awning, or up the brownstone's stoop.
  R(g, cx - 6, foot - 16, 12, 16, INK); R(g, cx - 5, foot - 15, 10, 15, "#4a2c1e"); R(g, cx - 5, foot - 15, 10, 3, LIT); R(g, cx - 5, foot - 12, 10, 1, INK);
  R(g, cx - 1, foot - 11, 1, 11, "#2e1c12"); R(g, cx + 2, foot - 6, 1, 1, "#f4c63c");
  if (a.kind === "mid") {
    for (const [i, hw] of [9, 11, 13].entries()) { R(g, cx - hw - 1, foot - 3 + i * 2, hw * 2 + 2, 3, INK); R(g, cx - hw, foot - 2 + i * 2, hw * 2, 1, STONE); }
    for (const sx of [cx - 13, cx + 12]) { R(g, sx, foot - 8, 1, 11, INK); R(g, sx - 1, foot - 9, 3, 1, INK); } // the iron railings
  } else {
    const aw = AWNINGS[k % AWNINGS.length];
    R(g, cx - 10, foot - 22, 20, 6, INK); R(g, cx - 9, foot - 21, 18, 4, aw); R(g, cx - 9, foot - 21, 18, 1, "rgba(255,255,255,.25)");
    R(g, cx - 10, foot - 16, 1, 16, INK); R(g, cx + 9, foot - 16, 1, 16, INK); // its poles
  }
  if (a.kind === "wide") for (const sx of [X + 4, cx + 13]) { // a corner shop either side, its windows aglow
    const sw = Math.min(cx - 13 - (X + 4), X + W - 4 - sx); if (sw < 8) continue;
    stallRoof(g, sx, foot - 20, sw, AWNINGS[(k + 1) % AWNINGS.length], "#f3e6cc");
    R(g, sx - 1, foot - 12, sw + 2, 12, INK); R(g, sx, foot - 11, sw, 10, "#e8c27a"); R(g, sx, foot - 11, sw, 2, "#f6dca0");
    for (let x = sx + 6; x < sx + sw - 2; x += 7) R(g, x, foot - 11, 1, 10, INK);
  }
}
// A block's courtyard: trees, a bench and a flower box in the gaps between its buildings.
const COURTYARD = { trees: [[4, 4.5], [9.2, 7.1], [9.3, 10.6]], bench: [8.1, 8.4], flowers: [0.3, 10.1] };
function courtyardItems(b) {
  const at = ([x, y]) => [(b.x + Math.floor((b.w - 10) / 2) + (b.mirror ? 10 - x : x)) * TILE, (b.y + y) * TILE];
  return { trees: COURTYARD.trees.map(at), bench: at(COURTYARD.bench), flowers: at(COURTYARD.flowers), mirror: b.mirror };
}

// Everything that does not move, baked once per layout, with a margin of countryside so the map runs off the screen's edges.
const MARGIN = MAP_MARGIN; // tiles of countryside, with the roads running on through it
const EDGE = 10; // tiles over which the map fades out at its border
const TREE_W = 24, TREE_H = 18; // the grid of tree spots, in pixels: neighbours never closer than 18 across or 14 down
function bake(world, skip = new Map(), unknown = false) {
  // The map spans [L, W] × [T, H] in pixels (west and north of HQ are negative, decision 250), plus the countryside.
  const L = (world.left ?? 0) * TILE, T = (world.top ?? 0) * TILE, W = world.width * TILE, H = world.height * TILE, M = MARGIN * TILE, r = rng("world");
  const [c, g] = newCanvas(W - L + M * 2, H - T + M * 2);
  g.translate(M - L, M - T);
  lawn(g, L - M, T - M, W - L + M * 2, H - T + M * 2, "lawn");
  const top = (world.top ?? 0) - MARGIN, bottom = world.height + MARGIN; // every avenue runs on off the map
  // The avenue east of HQ and the other avenues, each as long as it runs.
  const verticals = [{ x: world.avenue, y0: top, y1: bottom }, ...(world.lanes ?? [])];
  for (const v of verticals) avenue(g, v.x, v.y0, v.y1, `ave${v.x},${v.y0}`);
  const roads = world.streets.map((s) => ({ ...s, x0: s.x0 <= (world.left ?? 0) ? (world.left ?? 0) - MARGIN : s.x0, x1: s.x1 >= world.width ? world.width + MARGIN : s.x1 }));
  const through = verticals.filter((v) => v.y0 <= top).map((v) => v.x);
  const js = junctions(world), round = new Set(js.filter((j) => j.kind === "roundabout").map((j) => `${j.cx},${j.cy}`));
  for (const s of roads) street(g, s.x0, s.x1, s.y, `st${s.y}`, through.filter((a) => !round.has(`${(a + 1.5) * TILE},${(s.y + 1.5) * TILE}`)));
  for (const j of js) junctionMarks(g, j);
  // Trees wherever nothing else stands, far to near.
  const taken = [world.hq, ...world.buildings, ...world.lots, world.homes, ...roads.map((s) => ({ x: s.x0, y: s.y, w: s.x1 - s.x0, h: 3 })), ...verticals.map((v) => ({ x: v.x, y: v.y0, w: 3, h: v.y1 - v.y0 }))];
  const clear = (x, y) => taken.every((t) => x < (t.x * TILE) - 12 || x > (t.x + t.w) * TILE + 12 || y < t.y * TILE - 2 || y > (t.y + t.h) * TILE + 34);
  // Each tree has its own spot on a fixed grid, the same on every map whatever its size (decision 248): a new tower or
  // row only clears the trees where it stands, and no other tree moves. About one tree to 3000 square pixels.
  const spots = [];
  for (let j = Math.floor((T - M) / TREE_H); j * TREE_H < H + M; j++) for (let i = Math.floor((L - M) / TREE_W); i * TREE_W < W + M; i++) {
    const h = hashOf(`tree:${i},${j}`);
    if (h % 1000 >= 144) continue;
    const x = i * TREE_W + TREE_W / 2 + ((h >>> 10) % 7) - 3, y = j * TREE_H + TREE_H / 2 + ((h >>> 14) % 5) - 2;
    if (x >= L - M && x <= W + M && y >= T - M && y <= H + M && clear(x, y)) spots.push([x, y, h]);
  }
  spots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y, h] of spots) tree(g, x, y, rng(`tree:${h}`));
  const plotOnly = new Set(["rise", "ghost", "focus"]); // the tower itself is drawn live over its plot
  for (const b of world.buildings) if (b.archived) freeLot(g, b, "ARCHIVED"); else if (plotOnly.has(skip.get(b.dept))) towerPlot(g, b); else if (skip.has(b.dept)) site(g, b); else tower(g, b);
  for (const l of world.lots) if (l.demolished && skip.has(l.demolished)) site(g, { ...l, dept: l.demolished }); else freeLot(g, l, unknown ? "" : "FREE LOT"); // not known yet: no sign
  headquarters(g, world.hq);
  // The neighbourhood (decision 188): apartment buildings and their courtyards, far to near; trees in the parks.
  const onRoad = (y) => roads.some((s) => y > s.y * TILE - 30 && y < (s.y + 3) * TILE + 6);
  for (const p of world.homes.parks ?? []) for (let y = p.y * TILE + 34; y < (p.y + p.h) * TILE - 4; y += 44) for (let x = p.x * TILE + 16; x < (p.x + p.w) * TILE - 8; x += 52) { const ty = y + r() * 8; if (!onRoad(ty)) tree(g, x + r() * 10, ty, r); }
  const near = [];
  for (const b of world.homes.blocks) {
    const c = courtyardItems(b);
    for (const [x, y] of c.trees) near.push([y, () => tree(g, x, y, r)]);
    near.push([c.bench[1] + 8, () => bench(g, c.bench[0] - (c.mirror ? 22 : 0), c.bench[1])]);
    near.push([c.flowers[1] + 10, () => flowers(g, c.flowers[0] - (c.mirror ? 16 : 0), c.flowers[1], "#d2699e")]);
  }
  for (const a of world.homes.apartments) near.push([(a.y + a.h) * TILE, () => apartment(g, a)]);
  near.sort((p, q) => p[0] - q[0]).forEach(([, draw]) => draw());
  const FW = W - L + M * 2, FH = H - T + M * 2, X0 = L - M, Y0 = T - M;
  g.fillStyle = "rgba(38,30,78,.14)"; g.fillRect(X0, Y0, FW, FH); // the dusk wash over all of it
  // The map's border fades softly into the night, so roads and cabs run off into it rather than stopping at an edge.
  const E = EDGE * TILE, fade = (x0, y0, x1, y1, rx, ry, rw, rh) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, "rgba(22,30,40,.92)"); gr.addColorStop(1, "rgba(22,30,40,0)"); g.fillStyle = gr; g.fillRect(rx, ry, rw, rh); };
  fade(X0, 0, X0 + E, 0, X0, Y0, E, FH); fade(W + M, 0, W + M - E, 0, W + M - E, Y0, E, FH);
  fade(0, Y0, 0, Y0 + E, X0, Y0, FW, E); fade(0, H + M, 0, H + M - E, X0, H + M - E, FW, E);
  return c;
}

// How far to move along a route this frame: a gentle start and a gentle stop (never slower than a third of the
// pace), so a walk, a cab ride or the bicycle never lurches off or slams to a halt. Keeps its own tally on `o`.
function eased(o, step, toNext) {
  if (o.routeRef !== o.route) {
    o.routeRef = o.route; o.trav = 0;
    let len = 0, at = o;
    for (const q of o.route) { len += Math.hypot(q.x - at.x, q.y - at.y); at = q; }
    o.routeLen = len;
  }
  const left = Math.max(0, o.routeLen - o.trav), k = Math.min(1, 0.34 + Math.min(o.trav, left) / 30);
  const s = step * k;
  o.trav += Math.min(s, toNext);
  return s;
}

const DASH_MS = 320, WALK_SPEED = 46, SCENERY_MS = 125, TRAFFIC_MS = 50;
// Zoom is smooth and continuous (the owner, 2026-11-10): from far out to close up, eased between, never in steps.
const ZOOM_MIN = 0.35, ZOOM_MAX = 8, ZOOM_STEP = 1.5;

// `insets()` says how much of the root the HUD's own bars cover, so the map is fitted into the free part.
export function mountCity(root, { canvas: canvasEl, insets = () => ({ l: 0, t: 0, r: 0, b: 0 }), onSelectAgent = () => {}, onSelectBuilding = () => {}, onOpenApp = () => {}, onState = () => {} } = {}) {
  // A test hook for the rare cars' screenshots: data-rare-cabs="all" makes every car one of the two rare ones (half
  // each, by the car's id), "porsche" or "lambo" makes every car that one.
  const forcedRare = (id) => {
    const m = root.dataset.rareCabs;
    return m === "porsche" || m === "lambo" ? m : m === "all" ? (hashOf(`rare:${id}`) % 2 ? "lambo" : "porsche") : false;
  };
  const canvas = canvasEl ?? root.querySelector("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const el = (tag) => document.createElement(tag);
  let state = initialState();
  let world = null, ground = null, worldSig = "";
  const people = new Map(); // id → { id, x, y, key, move, route, flip, hop, say, visual, seated }
  const seats = new Map(); // dept → Map(id → seat)
  let homes = new Map();
  let effects = [], parcels = [];
  const doorQueue = new Map(); // door key → when it is next free, so walkers take turns instead of overlapping
  const lights = new Map(); // "apartment index:window" → lit until (performance.now() ms)
  const doors = new Map(); // dept → how far its doors are open, 0 (shut) … 1 (open)
  const doorHold = new Map(); // dept → keep the doors open until (performance.now() ms)
  const counts = new Map(); // dept → { n: people inside, delta: last change, at: when } (the roof counter)
  const cam = { x: 0, y: 0, wantX: 0, wantY: 0, zoom: 2, wantZoom: 2, anchor: null, userMoved: false };
  let OX = 0, OY = 0; // the camera rounded to whole art pixels, the same for the ground and everything on it
  const anims = new Map(); // dept → { kind: "rise" | "build" | "demolish", start, dur, b?, done? } (decision 134)
  const mail = { queue: [], rider: null, out: 0, back: 0 }; // the one mailman and the letters waiting for him
  let entered = false; // the towers' entrance has played (or there was nothing to show)
  let unknownLots = false; // loading with nothing remembered: the lots aren't known yet, so they carry no sign
  let leaving = []; // cabs driving off after dropping someone at a door
  let traffic = null, trafficSig = "", trafficAt = 0; // the cruising cabs, their lights and roundabouts (decision 173)
  root._anims = anims; // read-only test hooks (e2e/departments.spec.ts)
  root._mail = mail;
  const walked = new Set(); // ids that already walked home for good
  root._people = people; // a read-only test hook: e2e/commute.spec.ts watches who stands where
  root._counts = counts; // and the roof counters (e2e/towers.spec.ts)
  root._doors = doors;
  root._view = () => ({ x: cam.x, y: cam.y, zoom: cam.zoom }); // the camera, for tests that click a tower
  root._world = () => world; // the layout, for tests: towers keep one size whatever the headcount
  root._carSprite = cabImg; // the car sprites (false, "porsche", "lambo"; side, front, rear), for the rare cars' close-up screenshot
  const winBox = document.createElement("div"); winBox.id = "citywindows"; winBox.hidden = true; winBox.setAttribute("aria-hidden", "true"); root.append(winBox);
  let selected = null, hover = null, lastVisit = 0, hiddenHomes = 0, glowing = 0; // glowing: highlighted cabs drawn this frame

  const visible = () => root.offsetParent !== null && !document.hidden;
  const dpr = () => devicePixelRatio || 1;
  const isPortrait = () => root.clientWidth < 800 && root.clientHeight > root.clientWidth;

  // ---------- Who stands where: placement from the state, seats and homes kept stable, journeys only for real changes ----------
  function spotOf(id) {
    const where = placement(state, id);
    if (where.place === "hq") { const [x, y] = EXEC_SPOT[id] ?? CORE_SPOT[id] ?? CORE_SPOT.vaic; return { x: world.hq.x * TILE + x, y: world.hq.y * TILE + y, key: `hq:${id}`, seated: CORE_DESK.has(id) }; }
    const agent = state.agents[id];
    if (where.place === "station" && agent?.kind === "manager") {
      const b = world.buildings.find((x) => x.dept === where.dept);
      if (b) { const d = doorOf(b); return { x: d.x + 20, y: d.y + 6, key: `door:${where.dept}`, seated: false }; }
    }
    if (where.place === "station") {
      const b = world.buildings.find((x) => x.dept === where.dept), seat = seats.get(where.dept)?.get(id);
      if (b && seat !== undefined) return { ...seatSpot(b, seat), key: `desk:${where.dept}:${seat}`, seated: true };
    }
    return { ...homeSpot(world, homes.get(id) ?? 0), key: "home", seated: false };
  }
  const dust = (x, y, n, colors, speed = 40, life = 0.5) => { if (reduced() || !visible()) return; for (let i = 0; i < n && effects.length < 240; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random()); effects.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - speed * 0.3, c: colors[i % colors.length], life, g: speed * 1.6, s: 1 + (i % 2) }); } };
  const POOF = ["#fff6e0", "#e8dcc4", "#cfc4b0"], CONFETTI = ["#e0625a", "#f4c63c", "#49ad7c", "#4f8fd6", "#9a6bd0", "#fff6e0"];

  function sync(instant = false) {
    const list = Object.values(state.agents);
    const shown = residents(state);
    hiddenHomes = shown.hidden;
    const atDesk = new Map();
    for (const a of list) { const w = placement(state, a.id); if (w.place === "station" && a.kind !== "manager") { if (!atDesk.has(w.dept)) atDesk.set(w.dept, []); atDesk.get(w.dept).push(a.id); } }
    const seatCount = {};
    seats.forEach((_, d) => { if (!atDesk.has(d)) seats.delete(d); });
    for (const [d, ids] of atDesk) { const s = assignSlots(ids, seats.get(d)); seats.set(d, s); seatCount[d] = Math.max(...s.values()) + 1; }
    homes = assignSlots(shown.ids, homes);
    const portrait = isPortrait();
    const next = layout(state, { portrait, seats: seatCount, homes: Math.min(HOMES_PER_BLOCK, Math.max(-1, ...homes.values()) + 1) }); // one block of homes, never more (decision 213)
    const sig = JSON.stringify(next);
    const rebaked = sig !== worldSig;
    if (rebaked) {
      world = next; worldSig = sig; ground = bake(world, animSkip(), unknownLots); fitView();
      const roads = JSON.stringify([world.streets, world.lanes, world.avenue, world.left, world.top, world.width, world.height]);
      if (roads !== trafficSig) {
        // The roads changed: traffic starts afresh on them, the lights keep their clock.
        const t = traffic?.t ?? 0; traffic = createTraffic(world); traffic.t = t; trafficSig = roads; root._traffic = traffic;
        root.dataset.signals = String(traffic.junctions.filter((j) => j.kind === "light").length);
        root.dataset.roundabouts = String(traffic.junctions.filter((j) => j.kind === "roundabout").length);
        root._signals = () => traffic.junctions.filter((j) => j.kind === "light").map((j) => ({ id: j.id, ...signalAt(j, traffic.t) })); // for tests
      }
    }
    const wanted = new Set([...list.filter((a) => a.kind === "core" || CORE.has(a.id)).map((a) => a.id), ...shown.ids]);
    for (const id of people.keys()) if (!wanted.has(id)) { people.delete(id); if (selected === id) selected = null; if (hover === id) hover = null; }
    const still = instant || reduced() || !visible();
    for (const id of wanted) {
      const to = spotOf(id);
      let p = people.get(id);
      const fresh = !p;
      if (fresh) { const start = !still && to.key.startsWith("desk") ? homeSpot(world, homes.get(id) ?? 0) ?? to : to; p = { id, x: start.x, y: start.y, key: fresh && start === to ? to.key : "home", phase: hashOf(id) % 4, flip: false, hop: 0 }; setInside(p, !!start.inside); people.set(id, p); }
      if (p.visiting) continue; // VAIC is out; it comes back by itself
      p.seated = to.seated;
      if (p.key === to.key) { if (!p.move && !p.route) { p.x = to.x; p.y = to.y; } else if (p.route) p.route[p.route.length - 1] = to; else if (p.move) p.move.to = to; continue; } // a new layout only shifts them
      const fromKey = p.key;
      p.key = to.key;
      const walkHome = to.key === "home" && walksOut(state, id, walked);
      p.call = null; p.toWork = false; // a new journey cancels a taxi still on its way
      if (still) { p.x = to.x; p.y = to.y; p.move = null; p.route = null; p.waitUntil = null; p.speed = null; p.homecoming = false; setInside(p, !!to.inside); continue; }
      if (walkHome) {
        // Checking out: stand up, say so, take a turn at the door, and walk the streets home.
        const b = buildingOfKey(fromKey);
        p.move = null;
        p.route = commuteRoute(world, p, to, { leaving: fromKey.startsWith("desk:") ? b : null, entering: homeOf(world, homes.get(id) ?? 0) });
        planRide(p, { x: p.x, y: p.y }); // home by cab: from the kerb outside the tower to the kerb by the building, in at its door
        p.waitUntil = b ? queueAt(`door:${b.dept}`, 150) : performance.now();
        p.homecoming = true; // lights a window at home on arrival (step() clears it)
        p.say = { text: "CHECKED OUT", until: performance.now() + 1800 };
      } else if (state.agents[id]?.kind === "executive" && (to.key === "home" || fromKey === "home")) {
        // An executive called in to HQ, or going home after advising (decision 140): the streets, by cab where it can.
        const from = { x: p.x, y: p.y };
        p.move = null;
        const home = homeOf(world, homes.get(id) ?? 0);
        p.route = commuteRoute(world, from, to, to.key === "home" ? { entering: home } : { leaving: home });
        planRide(p, from);
        p.waitUntil = performance.now() + (to.key === "home" ? 300 : 500);
        p.homecoming = to.key === "home";
        if (to.key !== "home") lightHouse(id, 900);
        else p.say = { text: "HOME", until: performance.now() + 1500 };
        setInside(p, false);
      } else if (to.key === "home") { p.x = to.x; p.y = to.y; p.move = null; p.route = null; setInside(p, true); } // any other move home is instant, and indoors
      else if (to.key.startsWith("desk:") && (fresh || fromKey === "home") && buildingOfKey(to.key)) {
        // Hired: a window lights up at home, then the worker comes out of its building's door, along the streets and in.
        const b = buildingOfKey(to.key);
        const from = { x: p.x, y: p.y };
        p.move = null;
        p.route = commuteRoute(world, from, to, { leaving: homeOf(world, homes.get(id) ?? 0), entering: b });
        planRide(p, from); // to work by cab, hailed at the kerb by the building
        p.waitUntil = queueAt(`door:${b.dept}`, 700);
        // The taxi is called (decision 207): it drives to the kerb outside the apartment building and waits there; the
        // worker comes out once it has pulled up. It glows from the call until it drops the worker at the tower's door.
        const call = traffic && taxiCall(world, p.route, p.ride, from);
        p.toWork = true; p.call = null;
        if (call) p.call = { x: call.start.x, y: call.start.y, route: roundaboutDetours(traffic.junctions, [call.at], [true], call.start).route, at: performance.now(), here: false, rare: arrive(traffic), rv: 0, flip: call.at.x < call.start.x };
        const trip = call ? (Math.hypot(call.at.x - call.start.x, call.at.y - call.start.y) / RIDE_PX_S) * 1000 + 1500 : 0;
        lightHouse(id, Math.max(p.waitUntil - performance.now(), trip) + 500);
      } else dashTo(p, to);
    }
    const lit = [];
    for (const [d, m] of seats) for (const id of m.keys()) { const i = el("i"); i.dataset.lit = id; i.dataset.dept = d; lit.push(i); }
    winBox.replaceChildren(...lit);
    refreshVisuals();
    root.dataset.people = String(people.size);
  }
  // A commute's cab legs drive with the traffic (decision 177): round a roundabout rather than over it, at cab pace,
  // stopping for lights and giving way. The walks at either end keep the old brisk pace.
  function planRide(p, from) {
    p.ride = rideLegs(world, p.route, from);
    if (traffic) ({ route: p.route, ride: p.ride } = roundaboutDetours(traffic.junctions, p.route, p.ride, from));
    let walk = 0, at = from;
    p.route.forEach((q, i) => { if (!p.ride[i]) walk += Math.hypot(q.x - at.x, q.y - at.y); at = q; });
    p.speed = walkSpeed([{ x: walk, y: 0 }], { x: 0, y: 0 });
    p.rv = 0; p.commit = null; p.stopFor = null;
  }
  const buildingOfKey = (key) => {
    const m = /^(?:desk|door):([^:]+)/.exec(key ?? "");
    return m ? world.buildings.find((b) => b.dept === m[1]) : null;
  };
  /** A turn at a door: at the earliest `lead` ms from now, later if someone else just took it. */
  function queueAt(key, lead) {
    const at = Math.max(performance.now() + lead, doorQueue.get(key) ?? 0);
    doorQueue.set(key, at + staggerMs(1));
    return at;
  }
  /** Lights the worker's own window at home for a while (about to leave, or just home). */
  function lightHouse(id, ms) {
    const slot = homes.get(id) ?? 0, a = homeOf(world, slot);
    if (!a) return;
    const i = `${world.homes.apartments.indexOf(a)}:${hashOf(`win:${slot}`)}`;
    lights.set(i, Math.max(lights.get(i) ?? 0, performance.now() + ms));
    setTimeout(() => wake(), ms + 150);
  }
  /** In a tower (hidden, counted on its roof) or out on the streets. Who is inside which tower is kept apart from
   *  where they are going, so the counter drops only when they step out of the doors. */
  function setInside(p, yes) {
    const m = /^desk:([^:]+)/.exec(p.key ?? ""), home = p.key === "home" && world;
    p.inside = !!(yes && (m || home));
    // At home (decision 213): inside the apartment building, one lit window each, counted on its roof.
    p.insideOf = !p.inside ? null : m ? m[1] : `home:${world.homes.apartments.indexOf(homeOf(world, homes.get(p.id) ?? 0))}`;
  }
  function dashTo(p, to, then) {
    p.waitUntil = null;
    p.route = null;
    p.flip = to.x < p.x;
    p.move = { from: { x: p.x, y: p.y }, to, at: performance.now(), then };
    dust(p.x, p.y, 8, POOF);
  }
  function refreshVisuals() { const now = Date.now(); for (const p of people.values()) p.visual = visualState(state, p.id, now); }

  // ---------- Apps (docs/APPS.md): cabinets at the Application building, and a sign while one waits for the owner ----------
  // Application builds and publishes every app (decision 220); the old "Apps" department's apps stand there too.
  const appsDept = (x) => (!x?.department || /^apps?$/i.test(x.department) ? "Application" : x.department);
  const buildingOf = (name) => world?.buildings.find((x) => x.dept === name) ?? world?.buildings.find((x) => x.dept.toLowerCase() === String(name).toLowerCase());
  // Where each published app's cabinet stands: in a row on the pavement left of the door, at most four per building.
  function appMarkers() {
    const out = [], byB = new Map();
    for (const a of Object.values(state.apps ?? {}).sort((p, q) => String(p.published_at ?? "").localeCompare(String(q.published_at ?? "")))) {
      const b = buildingOf(appsDept(a));
      if (!b || b.archived) continue;
      if (!byB.has(b)) byB.set(b, []);
      byB.get(b).push(a);
    }
    for (const [b, list] of byB) {
      const X = b.x * TILE, top = (b.y + b.h) * TILE - 12 - CABINET_H + 4; // on the pavement, left of the doors
      list.slice(-4).forEach((a, i) => out.push({ app: a, x: X + 12 + i * 12, y: top, tint: CABINET_TINTS[hashOf(a.app_id) % CABINET_TINTS.length] }));
      if (list.length > 4) out.push({ more: list.length - 4, x: X + 12, y: top - 11 });
    }
    return out;
  }
  const waitingBuildings = () => { const out = new Set(); for (const a of Object.values(state.approvals)) if (a.kind === "app.publish") { const b = buildingOf(appsDept(a)); if (b) out.add(b); } return out; };
  function pickApp(ev, slack = 0) {
    const { x, y } = toArt(ev), extra = slack / cam.zoom;
    return appMarkers().find((m) => m.app && x >= m.x - extra && x < m.x + CABINET_W + extra && y >= m.y - extra && y < m.y + CABINET_H + extra)?.app ?? null;
  }
  function markApps() { const m = appMarkers().filter((x) => x.app); root.dataset.apps = String(m.length); root.dataset.appsWaiting = String(waitingBuildings().size); }

  // ---------- Live events ----------
  const PLACEMENT_EVENTS = new Set(["agent.hired", "agent.retired", "department.created", "department.demolished", "department.updated", "ticket.status", "worker.state", "worker.merge_waiting", "worker.merged", "tickets.parked", "executive.office"]);
  function onEvent(e) {
    const feedBefore = state.feed;
    const before = e.type === "department.created" ? state.departments[e.name] : null;
    if (e.type === "department.demolished") demolish(e.name);
    state = reduce(state, e);
    if (e.type === "department.created" && (!before || before.state === "demolished")) {
      root.dataset.built = String(Number(root.dataset.built ?? 0) + 1);
      if (!reduced() && visible()) anims.set(e.name, { kind: "build", start: performance.now(), dur: ANIM_MS.build });
    }
    if (PLACEMENT_EVENTS.has(e.type)) { sync(); markApps(); } else refreshVisuals();
    if (e.type === "connector.updated") wake(); // a sign goes up (or comes down) by the doors
    if (e.type.startsWith("department.")) { entered = true; ground = bake(world, animSkip(), unknownLots); wake(); }
    const letter = mailFor(e, state);
    if (letter) post(letter);
    const hop = courierFor(e); if (hop && !letter) courier(hop); // orchestrator ↔ manager goes by the mailman
    if (e.type === "vaic.visit") vaicVisit(e);
    if (e.type === "review.result" && e.verdict === "FAIL") { const t = state.tickets[e.ticket_id], p = t && people.get(t.to); if (p) dust(p.x, p.y - 20, 14, ["#55525e", "#77747f", "#99969f"], 18, 1.2); }
    if (e.type === "ticket.status" && e.ticket.status === "done") { const p = people.get(e.ticket.to); if (p) dust(p.x, p.y - 22, 28, CONFETTI, 70, 1); }
    if (e.type === "agent.hired" && e.agent) { const b = buildingOf(deptOf(e.agent)); if (b) dust((b.x + b.w / 2) * TILE, (b.y + 3) * TILE, 24, POOF, 60, 0.7); } // someone new walks in
    if (e.type === "app.published") { const b = buildingOf(appsDept(e)); if (b) { dust((b.x + b.w / 2) * TILE, (b.y + 1) * TILE, 90, CONFETTI, 90, 1.4); wake(); } }
    if (e.type.startsWith("app.") || e.type.startsWith("approval.")) { markApps(); wake(); }
    void feedBefore;
    onState(state);
  }

  // A parcel carried between two agents, only when a real ticket event says it moved.
  function courier({ from, to, kind }) {
    const a = people.get(from), b = people.get(to);
    if (!a || !b || reduced()) return;
    root.dataset.couriers = String(Number(root.dataset.couriers ?? 0) + 1);
    if (visible()) parcels.push({ from: { x: a.x, y: a.y - 14 }, target: b, t: 0, kind });
  }
  // ---------- Building and demolishing (decision 134) ----------
  const animSkip = () => new Map([...anims].filter(([, a]) => a.kind !== "demolish" || !a.done).map(([d, a]) => [d, a.kind]));
  function demolish(name) {
    const b = world?.buildings.find((x) => x.dept === name);
    root.dataset.demolished = String(Number(root.dataset.demolished ?? 0) + 1);
    counts.delete(name); doors.delete(name);
    if (b && !reduced() && visible()) anims.set(name, { kind: "demolish", start: performance.now(), dur: ANIM_MS.demolish, b: { ...b } });
    else anims.delete(name);
  }
  function finishAnim(dept, a) {
    const b = a.b ?? world.buildings.find((x) => x.dept === dept);
    if (!b) return;
    const t = towerShape(b);
    if (a.kind === "build") { dust(t.cx, t.top, 60, CONFETTI, 80, 1.2); dust(t.cx, t.foot, 24, POOF, 50, 0.7); }
    if (a.kind === "demolish") dust(t.cx, t.foot - 10, 50, RUBBLE, 60, 1.1);
  }
  const RUBBLE = ["#8b8fa8", "#77747f", "#b9ab90", "#55525e", "#cfc4b0"];
  function drawAnim(dept, a, now, ox, oy) {
    const b = a.b ?? world.buildings.find((x) => x.dept === dept);
    if (b && (a.kind === "ghost" || a.kind === "focus")) {
      // Loading (decision 249): the placeholder breathes softly; when the city's data is in, the real tower comes
      // into focus over it, in turn.
      const t = towerShape(b), X = t.X - ox, Y = t.Y - oy, k = a.kind === "focus" ? animProgress(a, now) : 0, e = k * k * (3 - 2 * k);
      const breathe = a.kind === "ghost" && !reduced() ? 0.12 * Math.sin(now / 520 + b.slot * 0.9) : 0;
      ctx.globalAlpha = (0.66 + breathe) * (1 - e); ctx.drawImage(ghostSprite(b), X, Y);
      if (e > 0) { ctx.globalAlpha = e; ctx.drawImage(towerSprite(b), X, Y); }
      ctx.globalAlpha = 1;
      return;
    }
    if (!b || now < a.start) return; // a tower that hasn't had its turn to rise yet stays a plot
    const k = animProgress(a, now), frac = standFraction(a.kind, k), t = towerShape(b), sp = towerSprite(b);
    const full = t.foot + 3 - t.Y, X = t.X - ox, Y = t.Y - oy, base = t.tiers[0];
    if (a.kind === "build") {
      const top = Math.round((t.foot - t.Y) * (1 - frac)); // floors go up from the street
      if (full - top > 0) ctx.drawImage(sp, 0, top, t.W, full - top, X, Y + top, t.W, full - top);
      if (k < 1) {
        const ty = t.Y + top;
        // Scaffolding around the floor going up, and a tower crane lifting the next beam.
        for (let x = base.x - 3; x <= base.x + base.w + 3; x += 8) R(ctx, x - ox, Math.max(ty - 12, t.Y) - oy, 1, Math.min(26, t.foot - ty + 12), "#8a6a44");
        for (const dy of [-12, 0, 12]) if (ty + dy < t.foot && ty + dy > t.Y) R(ctx, base.x - 4 - ox, ty + dy - oy, base.w + 8, 2, "#b5823a");
        const mx = t.X + t.W - 10, jy = t.Y + 4;
        R(ctx, mx - 1 - ox, jy - oy, 5, t.foot - jy, INK); R(ctx, mx - ox, jy - oy, 3, t.foot - jy, "#f4c63c");
        for (let y = jy + 3; y < t.foot; y += 6) R(ctx, mx - ox, y - oy, 3, 1, "#c99a1f");
        R(ctx, t.X + 8 - ox, jy - 1 - oy, mx - t.X - 2, 4, INK); R(ctx, t.X + 9 - ox, jy - oy, mx - t.X - 4, 2, "#f4c63c");
        R(ctx, mx - 3 - ox, jy - 6 - oy, 8, 6, INK); R(ctx, mx - 2 - ox, jy - 5 - oy, 6, 4, "#e6a53c"); // the crane's cab
        const hx = Math.round(t.cx + Math.sin(now / 420) * 18), hy = Math.max(jy + 8, ty - 16);
        R(ctx, hx - ox, jy + 2 - oy, 1, hy - jy - 2, INK); R(ctx, hx - 7 - ox, hy - oy, 14, 3, INK); R(ctx, hx - 6 - ox, hy + 1 - oy, 12, 1, "#8a6a44");
        if (Math.random() < 0.25) dust(t.cx + (Math.random() - 0.5) * base.w * 0.7, ty, 2, ["#ffe9a0", "#f4c63c", "#fff6e0"], 40, 0.3); // welding sparks
        if (Math.random() < 0.2) dust(t.cx + (Math.random() - 0.5) * base.w, t.foot, 1, POOF, 25, 0.5);
      }
      return;
    }
    const sink = Math.round((t.foot - t.Y) * (1 - frac)), rows = Math.min(full, full - sink);
    const shake = a.kind === "demolish" && k > 0.28 && k < 0.95 ? Math.round(Math.sin(now / 22) * 1.5) : 0;
    if (rows > 0) ctx.drawImage(sp, 0, 0, t.W, rows, X + shake, Y + sink, t.W, rows);
    if (a.kind === "rise" && k < 0.75 && Math.random() < 0.3) dust(t.cx + (Math.random() - 0.5) * base.w, t.foot, 2, POOF, 30, 0.45);
    if (a.kind === "demolish") {
      if (k < 0.32) {
        // The wrecking ball swings in from a crane beside the tower.
        const px = t.X + t.W + 6, py = t.Y + 30, L = 70, phi = -0.5 + Math.min(1, k / 0.3) * 1.07;
        const bx = px - L * Math.sin(phi), by = py + L * Math.cos(phi);
        R(ctx, px - 1 - ox, py - oy, 4, t.foot - py, INK); R(ctx, px - ox, py - oy, 2, t.foot - py, "#f4c63c");
        R(ctx, px - 8 - ox, py - 2 - oy, 14, 3, INK); R(ctx, px - 7 - ox, py - 1 - oy, 12, 1, "#f4c63c");
        line(ctx, px - ox, py - oy, Math.round(bx) - ox, Math.round(by) - oy, INK);
        oval(ctx, Math.round(bx) - ox, Math.round(by) - oy, 6, 6, INK); oval(ctx, Math.round(bx) - ox, Math.round(by) - oy, 5, 5, "#55525e"); R(ctx, Math.round(bx) - 2 - ox, Math.round(by) - 3 - oy, 2, 2, "#8b8fa8");
      }
      if (k > 0.3 && k < 1 && Math.random() < 0.7) dust(t.cx + (Math.random() - 0.5) * base.w, t.foot - Math.random() * 20, 3, RUBBLE, 45, 0.8);
    }
  }

  // ---------- The mailman (the owner's picture, 2026-11-09) ----------
  // The Orchestrator hands him a letter for a manager; he cycles over, hands it on, and rides back. A manager's
  // reply goes the other way. One mailman, one letter (or bundle) at a time; the rest wait in his queue.
  const parkSpot = () => ({ x: world.hq.x * TILE + 134, y: world.hq.y * TILE + 106 });
  const callOn = (b) => { const d = doorOf(b); return { x: d.x + 36, y: d.y + 10 }; };
  const pos = (v) => (typeof v === "function" ? v() : v);
  function post(m) {
    if (reduced() || !visible() || !world) { deliver(m.dir); return; } // nothing rides; the count still says it arrived
    mail.queue = enqueueMail(mail.queue, m);
    if (!mail.rider?.job) nextMail();
    wake();
  }
  function deliver(dir) {
    mail[dir] += 1;
    root.dataset[dir === "out" ? "mailOut" : "mailBack"] = String(mail[dir]);
  }
  function nextMail() {
    const r = mail.rider ?? (mail.rider = { ...parkSpot(), flip: false, carrying: false });
    const m = mail.queue.shift();
    if (!m) { r.job = null; r.legs = null; r.route = null; root.dataset.mailBusy = "0"; return; }
    const b = buildingOf(m.dept);
    if (!b || b.archived) { deliver(m.dir); nextMail(); return; } // the tower is gone: the letter is returned
    const park = parkSpot(), at = callOn(b);
    const orch = () => people.get("orchestrator"), mgr = () => people.get(state.departments[m.dept]?.manager_id) ?? at;
    r.job = m;
    r.legs = m.dir === "out"
      ? [{ pause: 650, letter: [orch, r], pick: true }, { ride: walkRoute(world, r, at) }, { pause: 550, letter: [r, mgr], drop: true, done: "out" }, { ride: walkRoute(world, at, park) }]
      : [{ ride: walkRoute(world, r, at) }, { pause: 550, letter: [mgr, r], pick: true }, { ride: walkRoute(world, at, park) }, { pause: 500, letter: [r, orch], drop: true, done: "back" }];
    root.dataset.mailBusy = "1";
    startLeg(r);
  }
  function startLeg(r) {
    const leg = r.legs?.[0];
    if (!leg) { nextMail(); return; }
    if (leg.ride) { r.route = leg.ride.slice(); r.speed = bikeSpeed(r.route, r); r.until = null; return; }
    r.route = null; r.until = performance.now() + leg.pause;
    if (leg.drop) r.carrying = false;
    const from = pos(leg.letter[0]), to = pos(leg.letter[1]);
    if (from && to && visible()) parcels.push({ from: { x: from.x, y: from.y - 14 }, target: to, t: 0, kind: "letter" });
  }
  function finishLeg(r) {
    const leg = r.legs.shift();
    if (leg.pick) r.carrying = true;
    if (leg.done) deliver(leg.done);
    startLeg(r);
  }
  function stepMail(dt, now) {
    const r = mail.rider;
    if (!r?.job) return false;
    if (r.route) {
      const to = r.route[0], dx = to.x - r.x, dy = to.y - r.y, d = Math.hypot(dx, dy), s = eased(r, r.speed * dt, d);
      if (Math.abs(dx) > 0.5) r.flip = dx < 0;
      if (d <= s) { r.x = to.x; r.y = to.y; r.route.shift(); if (!r.route.length) finishLeg(r); } else { r.x += (dx / d) * s; r.y += (dy / d) * s; }
    } else if (r.until && now >= r.until) finishLeg(r);
    return true;
  }
  function drawMail(now) {
    const r = mail.rider ?? { ...parkSpot(), flip: false, carrying: false };
    const moving = !!r.route, img = bike(moving && !reduced() ? Math.floor(now / 110) % 2 : 0, r.carrying);
    const x = Math.round(r.x) - OX, y = Math.round(r.y) - OY;
    ctx.fillStyle = "rgba(20,18,40,.35)"; ctx.fillRect(x - 11, y + 1, 22, 2);
    if (r.flip) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, -x - 14, y - 27); ctx.restore(); } else ctx.drawImage(img, x - 14, y - 27);
    if (r.job && (r.job.letters ?? 1) > 1 && r.carrying) label(`x${r.job.letters}`, r.x + 12, r.y - 36, INK, "#fff6e0");
  }

  // VAIC dashes over, says what it is doing, and comes back. Its status call can repeat fast: those are not new visits.
  function vaicVisit({ to, kind }) {
    const now = Date.now(), allowed = visitAllowed(lastVisit, now, to);
    lastVisit = now;
    if (!allowed) return;
    const j = people.get("vaic"), target = people.get(to);
    if (!j || !target || j.visiting) return;
    root.dataset.visits = String(Number(root.dataset.visits ?? 0) + 1);
    const words = kind === "ask" ? "ASKING" : "CHECKING IN", side = target.x > 40 ? -15 : 15;
    j.visiting = true;
    const back = () => { const home = spotOf("vaic"); j.visiting = false; if (reduced() || !visible()) { j.x = home.x; j.y = home.y; } else dashTo(j, home); };
    j.say = { text: words, until: performance.now() + 1500 };
    const arrived = () => { j.flip = side < 0 ? false : true; setTimeout(back, 1400); };
    if (reduced() || !visible()) { j.x = target.x + side; j.y = target.y; arrived(); } else dashTo(j, { x: target.x + side, y: target.y }, arrived);
  }

  // ---------- The view: smooth continuous zoom, crisp pixels from 1× up, pan and pinch ----------
  // The room the map may use: not under the side column on a wide screen, not under the top rows or bottom rows on a phone.
  function safeArea() {
    const n = insets();
    return { l: n.l, t: n.t, r: root.clientWidth - n.r, b: root.clientHeight - n.b };
  }
  // The canvas's size at this zoom, in art pixels (w, h). Only draw() applies it (apply = true), right before painting
  // the whole frame: resizing a canvas wipes it, so a resize from a wheel or pinch handler could show as a flash.
  // From one device pixel per art pixel up, the canvas holds art pixels and CSS scales them up, crisp. Further out,
  // the canvas holds device pixels and the drawing is scaled down into it: one art pixel per canvas pixel there would
  // make the canvas several times the screen, past what Safari will draw (it shows black), which made the map blink
  // black while zooming out (the owner, 2026-11-10, decision 174).
  function viewSize(apply = false) {
    const n = cam.zoom * dpr();
    const w = Math.max(1, Math.ceil(root.clientWidth * dpr() / n)), h = Math.max(1, Math.ceil(root.clientHeight * dpr() / n));
    if (!apply) return { w, h };
    const shrink = n < 1, cw = shrink ? Math.ceil(w * n) : w, ch = shrink ? Math.ceil(h * n) : h;
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    const s = shrink ? n : 1;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const cssW = `${(cw * n) / s / dpr()}px`, cssH = `${(ch * n) / s / dpr()}px`;
    if (canvas.style.width !== cssW) { canvas.style.width = cssW; canvas.style.height = cssH; }
    ctx.imageSmoothingEnabled = shrink; // smaller than a device pixel, sharp sampling would shimmer
    const look = cam.zoom < 1 ? "auto" : "";
    if (canvas.style.imageRendering !== look) canvas.style.imageRendering = look;
    const z = cam.zoom.toFixed(2);
    if (root.dataset.zoom !== z) root.dataset.zoom = z; // for tests
    return { w, h };
  }
  // Pan anywhere over the countryside, never past where the map has faded out (centred when it all fits).
  function clampCam(x, y) {
    const { w, h } = viewSize(), L = (world.left ?? 0) * TILE, T = (world.top ?? 0) * TILE, W = world.width * TILE, H = world.height * TILE, M = (MARGIN - EDGE / 2) * TILE;
    const keep = (v, lo, hi, size) => (hi - lo <= size ? (lo + hi - size) / 2 : Math.max(lo, Math.min(hi - size, v)));
    return [keep(x, L - M, W + M, w), keep(y, T - M, H + M, h)];
  }
  function centreOn(x, y, area = safeArea()) {
    const px = ((area.l + area.r) / 2) / cam.zoom, py = ((area.t + area.b) / 2) / cam.zoom;
    [cam.wantX, cam.wantY] = clampCam(x - px, y - py);
  }
  // The zoom that shows the whole map, centred on it. A phone has the same map (decision 250): it starts on HQ, close
  // enough to read (HQ's block and its neighbours across the screen), and pinch, pan or Fit shows the rest.
  function fitView(force = false) {
    if (!world || (cam.userMoved && !force) || !root.clientWidth) return;
    const area = safeArea(), L = (world.left ?? 0) * TILE, T = (world.top ?? 0) * TILE, W = world.width * TILE, H = world.height * TILE;
    const phone = world.portrait;
    const whole = Math.min((area.r - area.l) / (W - L), (area.b - area.t) / (H - T));
    const best = clampZoom(phone ? Math.max(whole, (area.r - area.l) / (3 * PITCH_X * TILE)) : Math.max(ZOOM_MIN, whole));
    cam.zoom = best; cam.wantZoom = best; cam.anchor = null;
    if (force) cam.userMoved = false;
    viewSize();
    const hq = world.hq;
    if (phone) centreOn((hq.x + hq.w / 2) * TILE, (hq.y + hq.h / 2) * TILE, area); else centreOn((L + W) / 2, (T + H) / 2, area);
    cam.x = cam.wantX; cam.y = cam.wantY;
  }
  // As far out as the whole countryside, faded border and all, is on screen (not further: past that is only empty
  // space), and as far in as ZOOM_MAX.
  function clampZoom(z) {
    let lo = ZOOM_MIN;
    if (world && root.clientWidth) {
      const M = (MARGIN - EDGE / 2) * TILE, W = (world.width - (world.left ?? 0)) * TILE, H = (world.height - (world.top ?? 0)) * TILE;
      lo = Math.max(ZOOM_MIN, Math.min(root.clientWidth / (W + 2 * M), root.clientHeight / (H + 2 * M)));
    }
    return Math.max(lo, Math.min(ZOOM_MAX, z));
  }
  // Zoom right now, keeping the point under (cx, cy) where it is: for a pinch, which follows the fingers.
  function setZoom(z, cx = root.clientWidth / 2, cy = root.clientHeight / 2) {
    z = clampZoom(z);
    const ax = cam.x + cx / cam.zoom, ay = cam.y + cy / cam.zoom;
    cam.zoom = z; cam.wantZoom = z; cam.anchor = null; cam.userMoved = true;
    viewSize();
    [cam.x, cam.y] = clampCam(ax - cx / z, ay - cy / z);
    cam.wantX = cam.x; cam.wantY = cam.y;
    wake();
  }
  // Zoom smoothly (eased in step()) towards z, keeping the map point under (cx, cy) under the pointer, or carrying
  // it to (tx, ty) on the way (a building flies to the middle). Reduced motion: at once.
  function zoomTo(z, cx = root.clientWidth / 2, cy = root.clientHeight / 2, tx = cx, ty = cy) {
    z = clampZoom(z);
    cam.userMoved = true;
    cam.wantZoom = z;
    cam.anchor = { ax: cam.x + cx / cam.zoom, ay: cam.y + cy / cam.zoom, cx, cy, tx, ty };
    if (reduced()) settleZoom(1);
    wake();
  }
  // One easing step of the zoom (k = 1: all the way). Returns whether it is still moving.
  function settleZoom(k) {
    const a = cam.anchor;
    if (!a) return false;
    const lz = Math.log(cam.zoom), lw = Math.log(cam.wantZoom), next = lz + (lw - lz) * k;
    cam.zoom = Math.abs(lw - next) < 0.002 ? cam.wantZoom : Math.exp(next);
    a.cx += (a.tx - a.cx) * k; a.cy += (a.ty - a.cy) * k;
    if (Math.abs(a.tx - a.cx) < 0.5 && Math.abs(a.ty - a.cy) < 0.5) { a.cx = a.tx; a.cy = a.ty; }
    viewSize();
    [cam.x, cam.y] = clampCam(a.ax - a.cx / cam.zoom, a.ay - a.cy / cam.zoom);
    cam.wantX = cam.x; cam.wantY = cam.y;
    if (cam.zoom === cam.wantZoom && a.cx === a.tx && a.cy === a.ty) cam.anchor = null;
    return !!cam.anchor;
  }
  const zoomStep = (dir, cx, cy) => zoomTo(cam.wantZoom * (dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP), cx, cy);
  const zoomToBuilding = (b) => {
    const area = safeArea(), bx = (b.x + b.w / 2) * TILE, by = (b.y + b.h / 2) * TILE;
    zoomTo(Math.max(cam.wantZoom, 3), (bx - cam.x) * cam.zoom, (by - cam.y) * cam.zoom, (area.l + area.r) / 2, (area.t + area.b) / 2);
  };

  // Pick by art position. Figures get a forgiving box: fingers are bigger than sprites.
  const toArt = (ev) => { const r = root.getBoundingClientRect(); return { x: cam.x + (ev.clientX - r.left) / cam.zoom, y: cam.y + (ev.clientY - r.top) / cam.zoom }; };
  function pickAgent(ev, slack = 0) {
    const { x, y } = toArt(ev), extra = slack / cam.zoom;
    let best = null, bestD = Infinity;
    for (const p of people.values()) {
      if (p.inside) continue; // inside the tower: tap the tower to see who is there
      const dx = Math.abs(x - p.x), dy = Math.abs(y - (p.y - 10));
      if (dx > 8 + extra || dy > 13 + extra) continue;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }
  function pickBuilding(ev) {
    const { x, y } = toArt(ev), tx = x / TILE, ty = y / TILE;
    for (const b of [world.hq, ...world.buildings]) if (!b.archived && tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return b.dept;
    return null;
  }

  let drag = null, pinchDist = 0;
  const pointers = new Map();
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const r = root.getBoundingClientRect();
    // A wheel notch, a trackpad scroll or a trackpad pinch (ctrlKey) all zoom in proportion to how far they move.
    const d = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1);
    zoomTo(cam.wantZoom * Math.exp(-d * (ev.ctrlKey ? 0.01 : 0.0018)), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });
  canvas.addEventListener("pointerdown", (ev) => {
    pointers.set(ev.pointerId, ev);
    canvas.setPointerCapture?.(ev.pointerId);
    if (pointers.size === 1) drag = { x: ev.clientX, y: ev.clientY, moved: false, cx: cam.x, cy: cam.y, touch: ev.pointerType === "touch" };
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!pointers.has(ev.pointerId)) {
      if (ev.pointerType !== "touch") { const p = pickAgent(ev); const next = p?.id ?? null; if (next !== hover) { hover = next; wake(); } canvas.style.cursor = next || pickApp(ev) || pickBuilding(ev) ? "pointer" : "grab"; }
      return;
    }
    pointers.set(ev.pointerId, ev);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinchDist) { const r = root.getBoundingClientRect(); setZoom(cam.zoom * (d / pinchDist), (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top); } // follows the fingers
      pinchDist = d;
      drag = null;
      return;
    }
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) { cam.userMoved = true; if (cam.anchor) { cam.anchor = null; cam.wantZoom = cam.zoom; } [cam.x, cam.y] = clampCam(drag.cx - dx / cam.zoom, drag.cy - dy / cam.zoom); cam.wantX = cam.x; cam.wantY = cam.y; wake(); }
  });
  const endPointer = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (drag && !drag.moved && ev.type === "pointerup") {
      const p = pickAgent(ev, drag.touch ? 14 : 0);
      const app = !p && pickApp(ev, drag.touch ? 6 : 0);
      if (p) selectAgent(p.id); else if (app) onOpenApp(app.slug); else { const dept = pickBuilding(ev); if (dept) onSelectBuilding(dept); else { selected = null; onSelectAgent(null); wake(); } }
    }
    if (!pointers.size) drag = null;
  };
  canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => { if (hover) { hover = null; wake(); } });
  canvas.addEventListener("dblclick", (ev) => { const dept = pickBuilding(ev); const b = dept && [world.hq, ...world.buildings].find((x) => x.dept === dept); if (b) zoomToBuilding(b); });
  root.addEventListener("keydown", (ev) => {
    if (ev.target.closest?.("input")) return;
    if (ev.key === "+" || ev.key === "=") zoomStep(1); else if (ev.key === "-") zoomStep(-1);
  });
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { if (world) { const was = world.portrait; if (was !== isPortrait()) { worldSig = ""; sync(true); } fitView(); wake(); } }).observe(root);

  function selectAgent(id) {
    const p = people.get(id);
    if (p) {
      selected = id;
      if (!reduced()) { p.hop = 1; dust(p.x, p.y - 8, 6, ["#ffe9a0", "#fff6e0"], 30, 0.4); }
      showAgentOnMap(p);
      wake();
    }
    onSelectAgent(id);
  }
  // A figure the panel would hide comes into view beside it.
  function showAgentOnMap(p) {
    requestAnimationFrame(() => {
      const area = safeArea();
      const sx = (p.x - cam.x) * cam.zoom, sy = (p.y - cam.y) * cam.zoom;
      if (sx < area.l + 30 || sx > area.r - 30 || sy < area.t + 50 || sy > area.b - 20) { centreOn(p.x, p.y - 10, area); wake(); }
    });
  }

  // ---------- Drawing ----------
  // A cab centred at (x, y) on screen: side on along a street, nose or tail on along the avenue. `glow`: it is taking
  // a new hire to work (decision 207), so it gets a soft yellow light around it and a yellow outline, like a
  // selected agent's marker; the light grows as the map zooms out so it still shows from far away.
  function drawCab(x, y, along, up, flip, rare, glow, now) {
    const img = cabImg(rare, along ? "side" : up ? "rear" : "front"), left = along ? x - 12 : x - 9, top = along ? y - 12 : y - 15;
    const blit = (im, l, t) => { if (flip && along) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(im, -l - im.width, t); ctx.restore(); } else ctx.drawImage(im, l, t); };
    if (glow) {
      glowing += 1;
      const pad = Math.max(3, Math.round(5 / cam.zoom)), k = reduced() ? 1 : 0.8 + 0.2 * Math.sin(now / 260), w = img.width, h = img.height;
      ctx.fillStyle = `rgba(255,216,74,${(0.3 * k).toFixed(3)})`;
      ctx.fillRect(left - pad, top - pad + 3, w + pad * 2, h + pad * 2 - 6); ctx.fillRect(left - pad + 3, top - pad, w + pad * 2 - 6, h + pad * 2);
      ctx.fillStyle = `rgba(255,216,74,${(0.4 * k).toFixed(3)})`; ctx.fillRect(left - 2, y - 1, w + 4, 4); // the light on the road under it
      blit(haloOf(img), left - 2, top - 2);
    } else { ctx.fillStyle = "rgba(20,18,40,.3)"; ctx.fillRect(x - 9, y + 1, 18, 2); }
    blit(img, left, top);
    if (glow) {
      // The selected agent's yellow arrow over it, bigger when the map is zoomed out so it reads from far away.
      const k = Math.max(1, Math.round(1.6 / cam.zoom)), bob = reduced() ? 0 : [0, 1, 2, 1][Math.floor(now / 180) % 4] * k, ay = top - 9 * k - bob;
      R(ctx, x - 4 * k, ay, 8 * k, 2 * k, INK); R(ctx, x - 3 * k, ay, 6 * k, 2 * k, "#ffd84a"); R(ctx, x - 3 * k, ay + 2 * k, 6 * k, 2 * k, INK); R(ctx, x - 2 * k, ay + 2 * k, 4 * k, k, "#ffd84a"); R(ctx, x - k, ay + 4 * k, 2 * k, 2 * k, INK);
    }
  }
  function drawPerson(p, now, f) {
    const a = state.agents[p.id];
    if (!a || p.inside) return;
    if (p.route && !p.waitUntil && p.ride?.[0]) {
      // Riding a cab: side on along a street, nose on along the avenue; the passenger is inside.
      const to = p.route[0], along = Math.abs(to.x - p.x) >= Math.abs(to.y - p.y), x = Math.round(p.x) - OX, y = Math.round(p.y) - OY;
      ctx.globalAlpha = Math.min(1, (now - (p.rideAt ?? 0)) / 260); // the cab pulls up rather than popping in
      drawCab(x, y, along, to.y < p.y, p.flip, p.rareCab || forcedRare(p.id), p.toWork, now);
      ctx.globalAlpha = 1;
      return;
    }
    const moving = !!(p.move || p.route), key = p.visual ?? "idle", vis = VISUALS[key] ?? VISUALS.working;
    const pose = moving ? "still" : key === "idle" && p.seated ? "still" : vis.pose;
    const frame = (f + p.phase) % 4;
    const stride = moving ? (Math.floor(now / (p.move ? 40 : 130)) % 4) : null;
    const hopY = p.hop > 0 ? -Math.round(Math.sin(p.hop * Math.PI) * 7) : 0;
    const floatY = p.id === "vaic" && !moving ? [-2, -3, -2, -1][f] : 0;
    const x = Math.round(p.x) - OX, y = Math.round(p.y) - OY;
    if (!p.seated || moving) { ctx.fillStyle = "rgba(20,18,40,.35)"; ctx.fillRect(x - 5, y, 10, 2); ctx.fillRect(x - 4, y + 2, 8, 1); }
    if (key === "waiting_owner" && !moving) { const k = reduced() ? 1 : f % 2; ctx.fillStyle = k ? "rgba(255,216,74,.45)" : "rgba(255,216,74,.25)"; ctx.fillRect(x - 11, y - 1, 22, 4); ctx.fillRect(x - 8, y - 3, 16, 8); }
    if (p.id === "vaic") { ctx.fillStyle = "rgba(120,220,255,.16)"; ctx.fillRect(x - 10, y - 24, 20, 26); ctx.fillRect(x - 7, y - 27, 14, 32); }
    const sprite = figure(a, pose, frame, stride);
    const sy = y - 24 + hopY + floatY;
    if (p.flip) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(sprite, -x - 10, sy); ctx.restore(); } else ctx.drawImage(sprite, x - 10, sy);
    if (p.seated && !moving) ctx.drawImage(desk(propFor(a) ?? "laptop"), x - 12, y - 11);
    if (key === "failed" && !reduced() && Math.random() < 0.05) dust(p.x, p.y - 22, 1, ["#77747f"], 8, 0.8);
  }
  function drawBubble(p, f) {
    const key = p.visual ?? "idle";
    if (p.move || p.route || p.inside) return;
    const x = Math.round(p.x) - OX, y = Math.round(p.y) - 24 - OY;
    if (key !== "idle") {
      const loud = key === "waiting_owner";
      const bounce = reduced() ? 0 : loud ? [0, -3, -5, -3][f] : key === "failed" || key === "blocked" ? 0 : [0, 0, -1, -1][(f + p.phase) % 4];
      const img = bubble(key);
      if (loud && !reduced() && f % 2) { ctx.fillStyle = "rgba(255,216,74,.4)"; ctx.fillRect(x - 12, y - 17 + bounce, 24, 19); }
      ctx.drawImage(img, x - 8, y - 15 + bounce);
    }
  }
  function label(text, wx, wy, fg = "#fff6e0", bg = INK) {
    const t = fit(text, 120), w = textW(t) + 6, x = Math.round(wx - w / 2) - OX, y = Math.round(wy) - OY;
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, 9); ctx.fillRect(x + 1, y - 1, w - 2, 11);
    pixelText(ctx, t, x + 3, y + 2, fg);
  }
  // Lit windows fill a tower in a fixed scattered order (never the same pattern twice across towers), one window
  // per person inside (the owner, 2026-11-09): one agent in, one window lit; an empty tower is dark.
  const windowOrder = new Map();
  function litOrder(b) {
    let o = windowOrder.get(b.dept);
    if (!o) { const ws = towerWindows(b); o = ws.map((w, i) => ({ w, k: hashOf(`${b.dept}:${i}`) })).sort((p, q) => p.k - q.k).map((x) => x.w); windowOrder.set(b.dept, o); }
    return o;
  }
  // The tenant plaques of every tower, drawn once per change of the connectors (decision 173). Where they hang the
  // lobby glass is walled over first, so a plaque never sits half on a window.
  let signsOfState = null;
  const signSprites = new Map();
  function signsOf(b) {
    if (state.connectors !== signsOfState) { signsOfState = state.connectors; signSprites.clear(); }
    const key = `${b.dept}|${b.slot}|${b.x},${b.y},${b.w},${b.h}`;
    if (signSprites.has(key)) return signSprites.get(key);
    const t = towerShape(b), base = t.tiers[0], slots = plaqueSlots(signsFor(state, b.dept), { baseX: base.x, baseW: base.w, cx: t.cx, foot: t.foot });
    let sprite = null;
    if (slots.length) {
      const [cv, g] = newCanvas(t.W, t.H), f = FACADES[hashOf(b.dept) % FACADES.length], dy = t.foot - 22;
      g.translate(-t.X, -t.Y);
      for (const gx of [base.x + 8, base.x + base.w - 24]) if (slots.some((p) => p.x < gx + 18 && p.x + PLAQUE > gx - 1)) { R(g, gx - 1, dy - 1, 18, 19, f.wall); R(g, gx - 1, dy + 17, 18, 1, f.shade); }
      for (const p of slots) { R(g, p.x + 1, p.y + PLAQUE, PLAQUE - 1, 1, "rgba(20,18,40,.35)"); g.drawImage(plaque(p), p.x, p.y); } // each with a little shadow under it
      sprite = cv;
    }
    signSprites.set(key, sprite);
    root.dataset.signs = String([...signSprites.values()].filter(Boolean).length); // for tests: towers with signs drawn
    return sprite;
  }
  function drawTowerLive(b, now, ox, oy) {
    const t = towerShape(b), n = counts.get(b.dept)?.n ?? 0, lit = litOrder(b).slice(0, Math.min(litOrder(b).length, n));
    for (const w of lit) { R(ctx, w.x - ox, w.y - oy, w.w, w.h, "#ffdf94"); R(ctx, w.x - ox, w.y - oy, w.w, 1, "#fff3cf"); }
    // The automatic doors: two glass panels that slide apart; the lobby glows warm behind them.
    const o = doors.get(b.dept) ?? 0, dw = 22, dx = Math.round(t.cx - dw / 2) - ox, dy = t.foot - 22 - oy, half = dw / 2, gap = Math.round(half * o);
    R(ctx, dx, dy, dw, 22, n ? "#ffd98a" : "#6b5a3e");
    if (o > 0) R(ctx, dx + half - gap, dy, gap * 2, 22, n ? "#ffe8b0" : "#8a7652");
    for (const [x, w] of [[dx, half - gap], [dx + half + gap, half - gap]]) if (w > 0) { R(ctx, x, dy, w, 22, "rgba(120,160,210,.82)"); R(ctx, x, dy, w, 3, "rgba(220,235,255,.9)"); R(ctx, x, dy, 1, 22, INK); R(ctx, x + w - 1, dy, 1, 22, INK); }
    R(ctx, dx, dy + 21, dw, 1, INK);
    const signs = signsOf(b);
    if (signs) ctx.drawImage(signs, t.X - ox, t.Y - oy);
    // The aircraft beacon on the spire blinks red, like every tower in Manhattan.
    if (!reduced() && Math.floor(now / 900) % 2) { R(ctx, t.cx - 1.5 - ox, t.top - 32 - oy, 3, 3, "#ff4a3d"); R(ctx, t.cx - 3 - ox, t.top - 33.5 - oy, 6, 6, "rgba(255,74,61,.25)"); }
  }
  // The roof counter: how many are inside. It pops when it changes, and a +1 / −1 floats up from it.
  function drawCounter(b, now) {
    const t = towerShape(b), c = counts.get(b.dept), n = c?.n ?? 0, cx = t.cx, y = t.top - 46;
    const age = c?.at ? now - c.at : Infinity;
    if (age < 450 && !reduced()) { const k = 1 - age / 450; ctx.fillStyle = c.delta > 0 ? `rgba(73,173,124,${0.55 * k})` : `rgba(224,98,90,${0.55 * k})`; ctx.fillRect(Math.round(cx - 14 - cam.x), Math.round(y - 4 - cam.y), 28, 17); }
    label(String(n), cx, y, INK, n ? "#ffd84a" : "#d9d1bf");
    if (c?.delta && age < 1100 && !reduced()) {
      const k = age / 1100, txt = c.delta > 0 ? `+${c.delta}` : `${c.delta}`, w = textW(txt) + 6;
      const x = Math.round(cx + 12 - cam.x), yy = Math.round(y - 4 - k * 18 - cam.y);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = c.delta > 0 ? "#49ad7c" : "#e0625a"; ctx.fillRect(x, yy, w, 9);
      pixelText(ctx, txt, x + 3, yy + 2, "#fff6e0");
      ctx.globalAlpha = 1;
    }
  }
  function draw(now) {
    const { w, h } = viewSize(true);
    const f = reduced() ? 0 : Math.floor(now / SCENERY_MS / 2) % 4;
    ctx.fillStyle = "#2d5d53"; ctx.fillRect(0, 0, w, h);
    const ox = Math.round(cam.x), oy = Math.round(cam.y);
    OX = ox; OY = oy;
    const M = MARGIN * TILE, gx = (world.left ?? 0) * TILE - M, gy = (world.top ?? 0) * TILE - M; // where the baked ground starts
    const sx = Math.max(0, ox - gx), sy = Math.max(0, oy - gy), dw = Math.min(w, ground.width - sx), dh = Math.min(h, ground.height - sy);
    if (dw > 0 && dh > 0) ctx.drawImage(ground, sx, sy, dw, dh, sx + gx - ox, sy + gy - oy, dw, dh); // only the part on screen
    // Scenery that moves: the fountain's jet and ripples.
    const fx = world.hq.x * TILE + FOUNTAIN[0] - ox, fy = world.hq.y * TILE + FOUNTAIN[1] - oy;
    const jet = [13, 15, 14, 16][f];
    R(ctx, fx - 1, fy - 10 - jet, 2, jet, "#bfe6ff"); R(ctx, fx - 3, fy - 10 - jet, 6, 1, "#d7f1ff");
    for (const [dx, dy] of [[-3, -8 - jet + (f * 3) % 6], [3, -8 - jet + ((f + 2) * 3) % 6], [-5, -4 - ((f * 2) % 4)], [5, -6 + ((f * 2) % 4)]]) R(ctx, fx + dx, fy + dy - 2, 1, 2, "#a8dcff");
    R(ctx, fx - 12 + f * 2, fy - 1, 6, 1, "#8ab2d6"); R(ctx, fx + 6 - f * 2, fy + 2, 7, 1, "#8ab2d6");
    // A lit window marks a home with movement: someone called in to work, or just home after checking out.
    for (const [i, until] of lights) {
      if (until <= now) { lights.delete(i); continue; }
      const [ai, wi] = i.split(":").map(Number), a = world.homes.apartments[ai], wins = a ? aptWindows(a) : [];
      const win = wins[wi % (wins.length || 1)];
      if (win) { R(ctx, win.x - ox, win.y - oy, win.w, win.h, LIT); R(ctx, win.x - ox, win.y - oy, win.w, 1, LIT_TOP); R(ctx, win.x - ox, win.y + 4 - oy, win.w, 1, INK); }
    }
    // Who is home (decision 213): one lit window each, from a stable order, and the number on the roof like a tower.
    const homeCount = new Map();
    for (const p of people.values()) if (p.inside && p.insideOf?.startsWith("home:")) { const ai = Number(p.insideOf.slice(5)); homeCount.set(ai, (homeCount.get(ai) ?? 0) + 1); }
    let athome = 0;
    world.homes.apartments.forEach((a, ai) => {
      const n = homeCount.get(ai) ?? 0, wins = aptWindows(a), { top, cx } = aptShape(a);
      athome += n;
      const order = wins.map((_, i) => i).sort((x, y) => hashOf(`home:${ai}:${x}`) - hashOf(`home:${ai}:${y}`));
      for (const i of order.slice(0, n)) { const win = wins[i]; R(ctx, win.x - ox, win.y - oy, win.w, win.h, LIT); R(ctx, win.x - ox, win.y - oy, win.w, 1, LIT_TOP); R(ctx, win.x - ox, win.y + 4 - oy, win.w, 1, INK); }
      label(String(n), cx, top - 22, INK, n ? "#ffd84a" : "#d9d1bf");
    });
    if (root.dataset.atHome !== String(athome)) root.dataset.atHome = String(athome); // for tests
    const lastBlock = world.homes.blocks.at(-1); // the sign hangs over the last block's courtyard
    if (hiddenHomes && lastBlock) label(`+${hiddenHomes} MORE IN WORKFORCE`, (lastBlock.x + lastBlock.w / 2) * TILE, lastBlock.y * TILE + 2);
    // The towers' live parts: lit windows for the people inside, the sliding doors, the beacon and the roof counter.
    for (const b of world.buildings) if (!b.archived && !anims.has(b.dept)) drawTowerLive(b, now, ox, oy);
    for (const [d, a] of anims) drawAnim(d, a, now, ox, oy);
    // Yellow cabs cruising the streets (parked where they are with reduced motion), and the ones driving off.
    if (!reduced() && trafficAt) stepTraffic(traffic, now - trafficAt);
    trafficAt = now;
    const cars = trafficCars(traffic);
    if (root.dataset.cabs !== String(cars.length)) root.dataset.cabs = String(cars.length); // for tests
    let rareShown = 0, lamboShown = 0;
    glowing = 0;
    for (const c of cars) {
      const x = Math.round(c.x) - 12 - ox, y = Math.round(c.y) - 12 - oy;
      if (c.alpha <= 0 || x < -30 || x > w + 30 || y < -20 || y > h + 20) continue;
      ctx.globalAlpha = c.alpha; // fading in from beyond the map's edge, or out past it
      const rare = c.rare || forcedRare(c.id), img = cabImg(rare, c.vertical ? (c.east ? "rear" : "front") : "side"), brake = c.braking && !rare ? "#ff3a2a" : null;
      if (c.vertical) { R(ctx, x + 4, y + 18, 14, 2, "rgba(20,18,40,.3)"); ctx.drawImage(img, x + 3, y + 3); if (brake && c.east) { R(ctx, x + 6, y + 13, 3, 2, brake); R(ctx, x + 15, y + 13, 3, 2, brake); } }
      else {
        R(ctx, x + 3, y + 12, 18, 2, "rgba(20,18,40,.3)");
        if (c.east) ctx.drawImage(img, x, y); else { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, -x - 24, y); ctx.restore(); }
        if (brake) R(ctx, c.east ? x + 1 : x + 21, y + 6, 2, 2, brake); // brake lights
      }
      if (rare) rareShown += 1;
      if (rare === "lambo") lamboShown += 1;
    }
    ctx.globalAlpha = 1;
    // The traffic lights, one at the kerb before the stop line on each approach.
    for (const j of traffic.junctions) {
      if (j.kind !== "light") continue;
      const sig = signalAt(j, traffic.t), s = STOP_AT, k = JUNCTION_HALF - 3;
      for (const [dx, dy, axis] of [[-s + 2, k, "x"], [s - 2, -k + 4, "x"], [-k, -s + 2, "y"], [k, s + 4, "y"]]) {
        const x = j.cx + dx - ox, y = j.cy + dy - oy;
        if (x > -10 && x < w + 10 && y > -30 && y < h + 10) signalHead(ctx, x, y, sig[axis]);
      }
    }
    if (root.dataset.rareShown !== String(rareShown)) root.dataset.rareShown = String(rareShown); // for tests
    if (root.dataset.lamboShown !== String(lamboShown)) root.dataset.lamboShown = String(lamboShown);
    for (const c of leaving) { const x = Math.round(c.x) - 12 - ox, y = Math.round(c.y) - 12 - oy, img = cabImg(c.rare || forcedRare(c.id), "side"); ctx.globalAlpha = Math.max(0, 1 - c.t / 1.4); if (c.east) ctx.drawImage(img, x, y); else { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(img, -x - 24, y); ctx.restore(); } ctx.globalAlpha = 1; }
    // The apps' cabinets stand in front of the Apps building; the people walk in front of them.
    const marks = appMarkers();
    for (const m of marks) { if (m.app) { ctx.drawImage(cabinet(m.tint), Math.round(m.x) - OX, Math.round(m.y) - OY); } else label(`+${m.more}`, m.x + 10, m.y, INK, "#ffd84a"); }
    const first = marks.find((m) => m.app); // where the first cabinet is on screen, for tests and tooling
    root.dataset.appSpot = first ? `${Math.round((first.x + CABINET_W / 2 - cam.x) * cam.zoom)},${Math.round((first.y + CABINET_H / 2 - cam.y) * cam.zoom)}` : "";
    // Everyone, back to front.
    const order = [...people.values()].sort((a, b) => a.y - b.y);
    let calls = 0;
    for (const p of order) if (p.call) { // the taxis called for new hires: on their way, or waiting at the kerb
      const c = p.call;
      calls += 1;
      ctx.globalAlpha = Math.min(1, (now - c.at) / 400);
      drawCab(Math.round(c.x) - OX, Math.round(c.y) - OY, c.along ?? true, !!c.up, c.flip, c.rare || forcedRare(p.id), true, now);
      ctx.globalAlpha = 1;
    }
    for (const p of order) drawPerson(p, now, f);
    if (root.dataset.taxiCalls !== String(calls)) root.dataset.taxiCalls = String(calls); // for tests
    if (root.dataset.glowingCabs !== String(glowing)) root.dataset.glowingCabs = String(glowing);
    drawMail(now);
    for (const p of parcels) {
      const tx = p.target.x, ty = p.target.y - 14, k = p.t, ax = p.from.x + (tx - p.from.x) * k, ay = p.from.y + (ty - p.from.y) * k;
      const x = Math.round(ax) - OX, y = Math.round(ay - Math.sin(k * Math.PI) * 26) - OY;
      R(ctx, Math.round(ax) - OX - 3, Math.round(ay) - OY + 12, 6, 2, "rgba(20,18,40,.35)");
      if (p.kind === "letter") ENVELOPE(ctx, x, y);
      else { R(ctx, x - 4, y - 4, 8, 7, INK); R(ctx, x - 3, y - 3, 6, 5, p.kind === "ticket" ? "#f4c63c" : "#49ad7c"); R(ctx, x - 1, y - 3, 2, 5, "#fff6e0"); }
    }
    for (const b of world.buildings) if (!b.archived && !anims.has(b.dept)) drawCounter(b, now);
    for (const p of order) drawBubble(p, f);
    for (const e of effects) R(ctx, Math.round(e.x) - OX, Math.round(e.y) - OY, e.s, e.s, e.c);
    // The one being looked at gets an arrow and its name; so does whoever the mouse is on, and the core keep name plates.
    for (const p of order) if (p.id === selected || p.id === hover || CORE.has(p.id)) {
      const a = state.agents[p.id];
      if (a) label(p.id === hover && p.visual && p.visual !== "idle" ? `${p.id === "vaic" ? "VAIC" : p.id}: ${VISUALS[p.visual].label}` : p.id === "vaic" ? "VAIC" : p.id, p.x, p.y + 4, p.id === selected ? INK : "#fff6e0", p.id === selected ? "#ffd84a" : INK);
    }
    // A publish approval is open: the Apps building waits for the owner.
    for (const b of waitingBuildings()) { const k = reduced() ? 1 : f % 2, cx = (b.x + b.w / 2) * TILE, y = b.y * TILE - 12; if (k) { ctx.fillStyle = "rgba(255,216,74,.35)"; ctx.fillRect(Math.round(cx - 50 - cam.x), Math.round(y - 3 - cam.y), 100, 15); } label("WAITING FOR YOU", cx, y, INK, "#ffd84a"); }
    for (const p of order) if (p.say && p.say.until > performance.now()) label(p.say.text, p.x, p.y - 46, INK, "#8fdcff"); // VAIC's word stays on top of every mark
    const s = selected && people.get(selected);
    if (s) { const bob = reduced() ? 0 : [0, 1, 2, 1][f]; const x = Math.round(s.x) - OX, y = Math.round(s.y) - OY - (s.visual && s.visual !== "idle" ? 46 : 32) + bob; R(ctx, x - 4, y, 8, 2, INK); R(ctx, x - 3, y, 6, 2, "#ffd84a"); R(ctx, x - 3, y + 2, 6, 2, INK); R(ctx, x - 2, y + 2, 4, 1, "#ffd84a"); R(ctx, x - 1, y + 4, 2, 2, INK); }
  }

  // The frame loop. Scenery ticks at a low rate; only journeys, effects and parcels ask for every frame.
  let last = performance.now(), lastDraw = 0, fpsN = 0, fpsT = last, paused = true, needDraw = true;
  const wake = () => { needDraw = true; resume(); };
  function step(dt, now) {
    let busy = false;
    for (const p of people.values()) {
      if (p.hop > 0) { p.hop = Math.max(0, p.hop - dt * 2.6); busy = true; }
      if (p.call) busy = true; // the glow breathes
      if (p.call && !p.call.here) {
        // The called taxi drives to the kerb with the traffic, slows and stops there (or gives up queueing after 25 s).
        const c = p.call, to = c.route[0], dx = to.x - c.x, dy = to.y - c.y, d = Math.hypot(dx, dy);
        let left = d, at = to;
        for (const q of c.route.slice(1)) { left += Math.hypot(q.x - at.x, q.y - at.y); at = q; }
        c.to = to;
        let s = traffic ? rideStep(traffic, c, dt) : RIDE_PX_S * dt;
        c.rv = Math.min(c.rv ?? RIDE_PX_S, Math.max(12, left * 2.2)); s = Math.min(s, c.rv * dt);
        if (Math.abs(dx) > 0.5) c.flip = dx < 0;
        if (d > 0.5) { c.along = Math.abs(dx) >= Math.abs(dy); c.up = dy < 0; }
        if (d <= s) { c.x = to.x; c.y = to.y; c.route.shift(); } else { c.x += (dx / d) * s; c.y += (dy / d) * s; }
        if (!c.route.length || now - c.at > 25_000) { const k = c.route.at(-1) ?? c; c.x = k.x; c.y = k.y; c.route = []; c.here = true; dust(c.x, c.y, 4, ["#f4c63c", "#fff6e0"], 18, 0.3); }
      }
      if (p.waitUntil) {
        if (now < p.waitUntil) { busy = true; continue; }
        p.waitUntil = null;
      }
      if (p.call && !p.call.here) continue; // the worker stays home until the taxi has pulled up
      if (p.inside && p.route) { setInside(p, false); dust(p.x, p.y - 6, 6, POOF, 20, 0.35); } // out through the doors
      if (p.move) {
        busy = true;
        const t = Math.max(0, Math.min(1, (now - p.move.at) / DASH_MS)); // by the clock: a slow machine still gets there on time
        const e = 1 - (1 - t) ** 3;
        const { from, to } = p.move;
        p.x = from.x + (to.x - from.x) * e; p.y = from.y + (to.y - from.y) * e;
        if (Math.random() < 0.5) dust(p.x, p.y - 2, 1, POOF, 12, 0.3);
        if (t >= 1) { const then = p.move.then; p.move = null; if (p.key.startsWith("desk:")) setInside(p, true); else dust(p.x, p.y - 4, 12, ["#ffe9a0", "#fff6e0", "#f4c63c"], 50, 0.45); then?.(); }
      } else if (p.route) {
        busy = true;
        const to = p.route[0], dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy);
        let s;
        if (p.ride?.[0] && traffic) { p.to = to; p.rare = p.rareCab || forcedRare(p.id); p.boost = p.toWork ? TO_WORK_BOOST : 1; s = rideStep(traffic, p, dt); } // a cab in the traffic
        else s = eased(p, (p.speed ?? WALK_SPEED) * dt, d);
        if (Math.abs(dx) > 0.5) p.flip = dx < 0;
        if (d <= s) {
          p.x = to.x; p.y = to.y; p.route.shift(); p.ride?.shift();
          if (to.ring && !p.route[0]?.ring) p.commit = null; // off the roundabout
          if (!p.route.length) {
            p.route = null; p.speed = null; p.ride = null; p.toWork = false; // dropped at the door: the glow goes out
            if (p.key.startsWith("desk:") || p.key === "home") setInside(p, true); // in through the doors: out of sight, counted on the roof
            if (p.homecoming) { p.homecoming = false; lightHouse(p.id, 1500); dust(p.x, p.y - 8, 10, POOF, 28, 0.5); } // home: the light goes on, then out
          }
        } else { p.x += (dx / d) * s; p.y += (dy / d) * s; }
      }
      // Hailing a cab at the kerb, and its driving off after the drop.
      const riding = !!(p.route && !p.waitUntil && p.ride?.[0]);
      if (riding && !p.wasRiding && p.call) { p.rideAt = now - 1000; p.rareCab = p.call.rare; p.call = null; root.dataset.taxiRides = String(Number(root.dataset.taxiRides ?? 0) + 1); dust(p.x, p.y, 6, ["#f4c63c", "#fff6e0"], 24, 0.35); } // in: the called taxi becomes the ride
      else if (riding && !p.wasRiding) { p.rideAt = now; p.rareCab = traffic ? arrive(traffic) : false; /* a hailed cab enters the road and takes the next number: 1 in 50 is the Porsche, 1 in 50 the Lamborghini */ root.dataset.taxiRides = String(Number(root.dataset.taxiRides ?? 0) + 1); dust(p.x, p.y, 6, ["#f4c63c", "#fff6e0"], 24, 0.35); }
      if (!riding && p.wasRiding && !p.inside) leaving.push({ id: p.id, x: p.x, y: p.y, east: !p.flip, t: 0, rare: p.rareCab });
      p.wasRiding = riding;
    }
    if (traffic) {
      // The commuters' cabs, as the traffic sees them: crossing a junction, waiting at a line, or on a roundabout.
      traffic.guests = [];
      for (const p of people.values()) {
        const c = p.call;
        if (c && !c.here && c.route[0]) { const to = c.route[0], j = ringOf(traffic, { x: c.x, y: c.y, to }); c.guest = { id: `${p.id}:call`, x: c.x, y: c.y, vertical: Math.abs(to.y - c.y) > Math.abs(to.x - c.x), commit: c.commit, ring: j ? { j, ang: Math.atan2(c.y - j.cy, c.x - j.cx) } : null }; traffic.guests.push(c.guest); }
        if (!(p.route && !p.waitUntil && p.ride?.[0])) { p.guest = null; continue; }
        const to = p.route[0], j = ringOf(traffic, { x: p.x, y: p.y, to });
        p.guest = { id: p.id, x: p.x, y: p.y, vertical: Math.abs(to.y - p.y) > Math.abs(to.x - p.x), commit: p.commit, ring: j ? { j, ang: Math.atan2(p.y - j.cy, p.x - j.cx) } : null };
        traffic.guests.push(p.guest);
      }
    }
    if (stepMail(dt, now)) busy = true;
    if (leaving.length) { busy = true; leaving = leaving.filter((c) => { c.t += dt; c.x += (c.east ? 1 : -1) * 70 * dt; return c.t < 1.4; }); }
    if (anims.size) {
      busy = true;
      for (const [d, a] of anims) if (!a.done && animProgress(a, now) >= 1) { a.done = true; finishAnim(d, a); }
      // Bake the finished towers into the ground once everything has settled (not once per tower).
      if ([...anims.values()].every((a) => a.done)) { anims.clear(); ground = bake(world, animSkip(), unknownLots); }
    }
    // The roof counters follow who is really inside; the doors open for anyone at them, and shut behind.
    const inside = new Map();
    for (const p of people.values()) if (p.inside && p.insideOf) inside.set(p.insideOf, (inside.get(p.insideOf) ?? 0) + 1);
    for (const b of world.buildings) {
      const n = inside.get(b.dept) ?? 0, c = counts.get(b.dept);
      if (!c) counts.set(b.dept, { n, delta: 0, at: 0 });
      else if (c.n !== n) { counts.set(b.dept, { n, delta: n - c.n, at: now }); root.dataset[`count${b.slot}`] = String(n); }
      if (c?.at && now - c.at < 1100) busy = true;
      const d = doorOf(b);
      const near = [...people.values()].some((p) => (p.route || p.move) && !p.inside && Math.hypot(p.x - d.x, p.y - d.y) < 36) ||
        [...people.values()].some((p) => p.inside && p.insideOf === b.dept && p.route && (!p.waitUntil || p.waitUntil - now < 450));
      if (near) doorHold.set(b.dept, now + 650); // they stay open a moment after someone passes, then slide shut
      const was = doors.get(b.dept) ?? 0, want = now < (doorHold.get(b.dept) ?? 0) ? 1 : 0;
      if (was !== want) { const v = reduced() ? want : Math.max(0, Math.min(1, was + (want > was ? 1 : -1) * dt * 5)); doors.set(b.dept, v); busy = true; }
    }
    if (effects.length) { busy = true; effects = effects.filter((e) => { e.life -= dt; e.vy += e.g * dt; e.x += e.vx * dt; e.y += e.vy * dt; return e.life > 0; }); }
    if (parcels.length) {
      busy = true;
      parcels = parcels.filter((p) => { p.t += dt / 0.9; if (p.t < 1) return true; dust(p.target.x, p.target.y - 14, 8, p.kind === "ticket" ? ["#f4c63c", "#fff6e0"] : ["#49ad7c", "#fff6e0"], 34, 0.4); return false; });
    }
    if (cam.anchor && settleZoom(reduced() ? 1 : Math.min(1, dt * 10))) busy = true;
    if (Math.abs(cam.wantX - cam.x) > 0.5 || Math.abs(cam.wantY - cam.y) > 0.5) {
      busy = true;
      const k = reduced() ? 1 : Math.min(1, dt * 8);
      cam.x += (cam.wantX - cam.x) * k; cam.y += (cam.wantY - cam.y) * k;
    }
    return busy;
  }
  function frame(now) {
    if (root.offsetParent === null) { paused = true; return; }
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000)); last = now;
    const busy = world ? step(dt, now) : false;
    if (world && (busy || needDraw || now - lastDraw >= (reduced() ? SCENERY_MS : TRAFFIC_MS))) { draw(now); lastDraw = now; needDraw = false; fpsN++; }
    if (now - fpsT > 2000) { root.dataset.fps = String(Math.round((fpsN * 1000) / (now - fpsT))); fpsN = 0; fpsT = now; }
    requestAnimationFrame(frame);
  }
  function resume() { if (paused && root.offsetParent !== null) { paused = false; last = performance.now(); requestAnimationFrame(frame); } }


  // ---------- Data in: a snapshot, then events (from the HUD's WebSocket) ----------
  // Before the server answers (decision 249): HQ, the roads and the homes at once (they never move), and every tower
  // remembered from the last visit as a blurred placeholder on its own lot. First paint never waits on the network.
  const MEMORY = "vaic.city.lots";
  function preview() {
    if (Object.keys(state.departments).length) return; // the city is already here
    let saved = null;
    try { saved = readLotsMemory(localStorage.getItem(MEMORY)); } catch { /* storage blocked: nothing remembered */ }
    state = applySnapshot(state, { agents: [], tickets: [], questions: [], ...(saved ?? {}) });
    unknownLots = !saved;
    root.dataset.cityLoading = "1";
    if (!ctx) return;
    sync(true);
    for (const b of world.buildings) if (!b.archived) anims.set(b.dept, { kind: "ghost", start: performance.now(), dur: ANIM_MS.ghost });
    ground = bake(world, animSkip(), unknownLots); fitView(); needDraw = true; resume();
  }
  function load(snap) {
    state = applySnapshot(state, snap ?? { agents: [], tickets: [], questions: [] });
    unknownLots = false;
    root.dataset.cityLoading = "0";
    if (Array.isArray(snap?.departments)) try { localStorage.setItem(MEMORY, JSON.stringify(lotsMemory(state))); } catch { /* private mode: nothing remembered */ }
    const ghosts = new Set([...anims].filter(([, a]) => a.kind === "ghost").map(([d]) => d));
    for (const d of ghosts) anims.delete(d);
    parcels = []; effects = [];
    // A snapshot (opening or reloading the page, a reconnect) places everyone where they are now, at once: someone
    // already working is in its lit window, not riding in from home again (the owner, decision 211). Only a live
    // event while the City is open plays the walk, the taxi and the ride.
    if (ctx) {
      sync(true);
      // The page opens with every tower rising out of the ground in turn: once, on the first snapshot that has
      // towers (not with reduced motion or a hidden tab).
      if (!entered && world.buildings.length) {
        entered = true;
        if (!reduced() && visible()) for (const a of entranceAnims(world.buildings, performance.now() + (ghosts.size ? 0 : 200), ghosts)) anims.set(a.dept, a);
      }
      if (ghosts.size || anims.size) ground = bake(world, animSkip(), unknownLots); // placeholders gone, or towers coming in
      fitView(); markApps(); needDraw = true; resume();
    }
    onState(state);
  }
  if (typeof ResizeObserver === "undefined") window.addEventListener("resize", () => { if (world) { fitView(); wake(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  root.dataset.cityReady = "1";
  return {
    load,
    preview,
    onEvent: (e) => { if (ctx && world) onEvent(e); else { state = reduce(state, e); onState(state); } },
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
    fit: () => { fitView(true); wake(); },
    select: (id) => { if (id) selectAgent(id); else { selected = null; wake(); } },
    building: (dept) => world?.buildings.find((x) => x.dept === dept) ?? null,
    screenOf: (dept) => { const b = world?.buildings.find((x) => x.dept === dept); return b ? { x: ((b.x + b.w / 2) * TILE - cam.x) * cam.zoom, y: ((b.y + b.h * 0.55) * TILE - cam.y) * cam.zoom } : null; },
    focusBuilding: (dept) => { const b = world && [world.hq, ...world.buildings].find((x) => x.dept === dept); if (b) zoomToBuilding(b); },
    resume() { resume(); if (world) { fitView(); wake(); } },
    get state() { return state; },
    get people() { return people; },
    get view() { return { x: cam.x, y: cam.y, zoom: cam.zoom }; },
  };
}

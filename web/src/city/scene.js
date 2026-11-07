// The City view scene, ported from the owner's Mac HUD (ai-city/jarvis/hud/city.js): the same pixel art,
// drawn in code, the same streets, plaza, fountain, offices, free lots and houses. Changed for AWS:
// AIC stands in the plaza where Jarvis stood, the Orchestrator at the HQ entrance, no Secretary or
// Reviewer; each department's manager stands at its door; panels are React (see CityView.tsx).
// The City View: a small game world of the agents, drawn pixel by pixel on a canvas from city-state.js.
// All of the art is drawn here in code. Every person on screen is a real agent; only the scenery moves on its own.
import { BUILDING_H, COST_NOTE, CORE, INTEGRATION_MEANS, MODEL_NAME, TILE, VISUALS, ageText, agentPanel, agentStatus, applyLive, applySnapshot, assignSlots, checkText, cityMessage, courierFor, departmentNames, departmentPanel, deptColor, deptOf, doingWords, estUsd, plainText, ticketTone, ticketWords, gateStatus, hashOf, homeSpot, identity, initialState, integrationGroups, layout, parkedRows, placement, walksOut, propFor, reduce, relTime, residents, seatRows, seatSpot, stockholmTime, topBar, traceLines, usdRows, visitAllowed, visualState, walkRoute, workforceGroups, commuteRoute, doorOf, staggerMs, walkSpeed } from "./city-state.js";

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
const hatColor = (name) => deptColor(name) === deptColor("other") ? SHIRT[hashOf(name) % SHIRT.length] : deptColor(name);

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
function paintFigure(g, agent, poseName, f, stride = null) {
  const id = agent.id, look = identity(id);
  const [ly, ry, rx, prop, headDy = 0, bob = 0] = POSES[poseName]?.[f % 4] ?? POSES.rest[0];
  const skin = id === "ace" ? "#a7f0ff" : SKIN[look.skin];
  let shirt = SHIRT[look.shirt], legs = TROUSERS[look.trousers], hair = HAIR[look.hair];
  if (id === "ace") { shirt = "#54c8ee"; legs = "#2f8fc0"; hair = null; }
  if (id === "orchestrator") { shirt = "#23222f"; legs = "#23222f"; }
  if (agent.kind === "manager") shirt = hatColor(deptOf(agent));
  const top = 2 + bob;
  // Legs and shoes; a stride shortens one leg and then the other.
  const lL = stride === 1 ? 3 : 5, lR = stride === 3 ? 3 : 5;
  R(g, 4, top + 13, 3, lL, legs); R(g, 7, top + 13, 3, lR, legs);
  R(g, 4, top + 13 + lL, 3, 1, "#2a2030"); R(g, 7, top + 13 + lR, 3, 1, "#2a2030");
  // Left arm, body, right arm; a raised arm ends in a hand above the shoulder.
  const arm = (x, dy) => { R(g, x, top + 8 + Math.min(dy, 0), 2, 5 - Math.abs(Math.min(dy, 0)) / 3, shirt); R(g, x, top + 8 + Math.min(dy, 0) - (dy < 0 ? 1 : -4), 2, 2, skin); };
  arm(2, ly);
  R(g, 3, top + 8, 8, 6, shirt); R(g, 3, top + 13, 8, 1, "rgba(0,0,0,.18)");
  R(g, 6, top + 8, 2, 2, agent.kind === "core" && id !== "ace" ? "#fff6e0" : "rgba(255,255,255,.3)");
  arm(10 + (rx > 0 ? rx : 0) + (rx < 0 ? rx : 0), ry);
  // Head, a big friendly block with its corners knocked off.
  const hy = top + headDy;
  R(g, 3, hy + 1, 8, 7, skin); R(g, 4, hy, 6, 1, skin);
  if (headDy > 0) R(g, 5, hy + 5, 4, 1, "#3a2a22"); // eyes shut, head down
  else { R(g, 5, hy + 4, 1, 2, "#23202f"); R(g, 8, hy + 4, 1, 2, "#23202f"); R(g, 6, hy + 6, 2, 1, id === "ace" ? "#2f8fc0" : "rgba(120,50,40,.55)"); }
  if (hair) switch (look.hairStyle) {
    case 0: R(g, 3, hy, 8, 3, hair); R(g, 3, hy + 3, 1, 2, hair); R(g, 10, hy + 3, 1, 2, hair); break;
    case 1: R(g, 3, hy, 8, 2, hair); R(g, 6, hy + 2, 5, 1, hair); break;
    case 2: R(g, 3, hy, 8, 3, hair); R(g, 5, hy - 2, 4, 2, hair); break;
    case 3: R(g, 3, hy, 8, 2, hair); R(g, 3, hy + 2, 1, 5, hair); R(g, 10, hy + 2, 1, 5, hair); break;
    default: R(g, 4, hy - 1, 6, 2, hair); R(g, 6, hy - 2, 2, 1, hair); R(g, 3, hy + 1, 8, 1, hair);
  }
  if (agent.kind === "manager") { const c = hatColor(deptOf(agent)); R(g, 3, hy - 2, 8, 3, c); R(g, 2, hy + 1, 10, 1, c); R(g, 4, hy - 2, 3, 1, "rgba(255,255,255,.35)"); }
  if (id === "ace") { R(g, 4, hy + 3, 6, 1, "#ffffff"); R(g, 6, hy - 2, 2, 2, "#e8fbff"); }
  if (id === "orchestrator") { R(g, 4, hy - 3, 6, 4, "#23222f"); R(g, 3, hy + 1, 8, 1, "#c7a23c"); R(g, 12, top + 3, 1, 6, "#fff6e0"); }
  if (prop && PROP[prop]) PROP[prop](g, 3, top + 8);
  if (prop === "lens") { const x = 10 + rx, y = top + 1; R(g, x + 1, y - 3, 4, 4, "#bfe6ff"); R(g, x, y - 2, 1, 2, "#c7a23c"); R(g, x + 5, y - 2, 1, 2, "#c7a23c"); R(g, x + 1, y - 4, 4, 1, "#c7a23c"); R(g, x + 1, y + 1, 4, 1, "#c7a23c"); }
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
function lawn(g, x, y, w, h, seed) {
  R(g, x, y, w, h, "#2f6a52");
  const r = rng(seed), blades = (w * h) / 26;
  for (let i = 0; i < blades; i++) { R(g, x + r() * w, y + r() * h, 1, 2, r() > 0.5 ? "#387a5c" : "#29604a"); }
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

// Each department's own colours, by its slot, so twelve offices look like twelve offices.
const ROOFS = [["#c0533f", "#d96c50", "#9c3f30"], ["#3f7fa8", "#5499c2", "#2f6387"], ["#3f8f6a", "#55a97f", "#2f7052"], ["#b5823a", "#d09c4c", "#8e642a"], ["#7f5aa8", "#9a74c2", "#634587"], ["#b84f78", "#d26a92", "#923c5e"], ["#4a6fb0", "#6288c8", "#37558c"], ["#8d9440", "#a8ae52", "#6e7430"], ["#b0663a", "#cb7f4e", "#8c4f2c"], ["#3f9a9a", "#55b4b4", "#2f7878"], ["#a84848", "#c25e5e", "#863636"], ["#5f7a8a", "#7894a4", "#485e6c"]];
const WALLS = ["#e6d3ae", "#d9c6c0", "#cfd3c0", "#e2c8a8"];
// A window around a seat: the cell's width, from above the figure's head to just under the desk.
const windowRect = (p, b) => { const pitch = (b.w * TILE - 8) / 4; return { x: Math.round(p.x - pitch / 2) + 1, y: p.y - 22, w: Math.round(pitch) - 2, h: 28, pitch }; };
function office(g, b) {
  const X = b.x * TILE, Y = b.y * TILE, W = b.w * TILE, H = b.h * TILE, r = rng(b.dept);
  const [roof, light, dark] = ROOFS[b.slot % ROOFS.length], wall = WALLS[hashOf(b.dept) % WALLS.length];
  paving(g, X, Y + 56, W, H - 56, PLAZA, "#5e4d5e", b.dept);
  // The building: roof, then the wall with windows and a door, on a little shadow.
  const bx = X + 8, bw = W - 16, by = Y + 2;
  R(g, bx - 1, by + 70, bw + 2, 4, "rgba(20,18,40,.35)");
  R(g, bx - 1, by + 26, bw + 2, 45, INK); R(g, bx, by + 27, bw, 43, wall); R(g, bx, by + 27, bw, 3, "rgba(60,30,40,.25)");
  R(g, bx - 3, by - 1, bw + 6, 29, INK); R(g, bx - 2, by, bw + 4, 27, roof);
  for (let ry = 0; ry < 27; ry += 5) { R(g, bx - 2, by + ry, bw + 4, 1, dark); for (let rx = (ry / 5) % 2 ? 4 : 0; rx < bw + 4; rx += 8) R(g, bx - 2 + rx, by + ry, 1, 5, dark); }
  R(g, bx - 2, by, bw + 4, 2, light);
  if (hashOf(b.dept) % 2) { R(g, bx + 10, by - 4, 8, 7, INK); R(g, bx + 11, by - 3, 6, 5, "#8a5a50"); } // a chimney on some
  // Lit windows either side of the door.
  for (const wx of [bx + 8, bx + 28, bx + bw - 44, bx + bw - 24]) { R(g, wx - 1, by + 43, 16, 14, INK); R(g, wx, by + 44, 14, 12, "#ffdf94"); R(g, wx, by + 44, 14, 3, "#ffefc0"); R(g, wx + 6, by + 44, 2, 12, INK); R(g, wx, by + 49, 14, 1, INK); R(g, wx - 1, by + 57, 16, 2, dark); }
  const dx = X + W / 2 - 8;
  R(g, dx - 1, by + 48, 18, 23, INK); R(g, dx, by + 49, 16, 21, "#7a4a2a"); R(g, dx + 7, by + 49, 2, 21, INK); R(g, dx + 11, by + 60, 2, 2, "#f4c63c"); R(g, dx + 3, by + 60, 2, 2, "#f4c63c");
  stallRoof(g, X + W / 2 - 16, by + 39, 32, roof, "#f3e6cc");
  sign(g, b.dept, X + W / 2, by + 27, W - 26);
  // The terrace: a seat for everyone, with a lamp and planters at its edges.
  // The glass front: a dark pane behind each seat's desk. The lit glow and the mullions and sill are drawn live, around the figure.
  for (let s = 0; s < seatRows(b) * 4; s++) { const p = seatSpot(b, s), q = windowRect(p, b); R(g, q.x - 1, q.y - 1, q.w + 2, q.h + 2, INK); R(g, q.x, q.y, q.w, q.h, "#3a4660"); R(g, p.x - 8, p.y + 2, 16, 2, "rgba(20,18,40,.28)"); g.drawImage(desk("none"), p.x - 12, p.y - 11); }
  lamp(g, X + 1, Y + BUILDING_H * TILE + 8); lamp(g, X + W - 1, Y + BUILDING_H * TILE + 8);
  if (r() > 0.5) flowers(g, X + W - 18, Y + H - 12, "#d2699e");
}
function freeLot(g, l, text) {
  const X = l.x * TILE, Y = l.y * TILE, W = l.w * TILE, H = l.h * TILE, r = rng(`${l.x},${l.y}`);
  lawn(g, X, Y, W, H, `${X}${Y}`);
  hedge(g, X + 2, Y + 2, W - 4);
  tree(g, X + 26, Y + 62, r); tree(g, X + W - 24, Y + 104, r);
  flowers(g, X + 40, Y + H - 22, "#e0c04a");
  sign(g, text, X + W / 2, Y + H / 2 - 6, W - 20);
  R(g, X + W / 2 - 1, Y + H / 2 + 5, 2, 8, "#6b4630");
}

// Where the four of the core stand on the plaza, in art pixels from the corner of HQ's plot.
// The Orchestrator stands on the podium at the HQ entrance; AIC in the plaza, by the fountain.
const CORE_SPOT = { orchestrator: [96, 100], ace: [62, 152] };
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
const ROOF_HOUSE = [["#b0533f", "#c96a50"], ["#4f7fa0", "#6799b8"], ["#7f6a44", "#99835a"], ["#6a7f4a", "#83995e"], ["#8a5a80", "#a4749a"]];
const houseWindows = (h) => ({ x: h.x * TILE + 7, y: h.y * TILE + 22, w: 8, h: 7 });
function house(g, h, i) {
  const X = h.x * TILE, Y = h.y * TILE, [roof, light] = ROOF_HOUSE[hashOf(`${h.x},${h.y}`) % ROOF_HOUSE.length];
  R(g, X + 3, Y + 37, 42, 3, "rgba(20,18,40,.3)");
  R(g, X + 4, Y + 15, 40, 23, INK); R(g, X + 5, Y + 16, 38, 21, "#e4d6b6");
  R(g, X + 2, Y + 3, 44, 15, INK); R(g, X + 3, Y + 4, 42, 13, roof); R(g, X + 3, Y + 4, 42, 2, light);
  for (let ry = 4; ry < 17; ry += 4) R(g, X + 3, Y + ry, 42, 1, "rgba(0,0,0,.18)");
  R(g, X + 26, Y + 23, 10, 15, INK); R(g, X + 27, Y + 24, 8, 14, "#7a4a2a"); R(g, X + 33, Y + 31, 1, 2, "#f4c63c");
  const w = houseWindows(h);
  R(g, w.x - 1, w.y - 1, w.w + 2, w.h + 2, INK); R(g, w.x, w.y, w.w, w.h, "#3a3f62");
  R(g, X + 3, Y + 41 + (i % 2), 8, 1, "#387a5c");
}

// Everything that does not move, baked once per layout, with a margin of countryside so the map runs off the screen's edges.
const MARGIN = 30; // tiles
function bake(world) {
  const W = world.width * TILE, H = world.height * TILE, M = MARGIN * TILE, r = rng("world");
  const [c, g] = newCanvas(W + M * 2, H + M * 2);
  g.translate(M, M);
  lawn(g, -M, -M, W + M * 2, H + M * 2, "lawn");
  const columns = [...new Set(world.buildings.concat(world.lots).map((b) => b.x))].sort((a, b) => a - b);
  const top = world.portrait ? world.hqStreet : -MARGIN, bottom = world.portrait ? world.officesEnd + 3 : world.height + MARGIN;
  const verticals = [world.avenue, ...columns.slice(1).map((x) => x - 3).filter((x) => x !== world.avenue)];
  for (const x of verticals) avenue(g, x, top, bottom, `ave${x}`);
  const roads = world.streets.map((s) => ({ ...s, x0: s.x0 === 0 ? -MARGIN : s.x0, x1: s.x1 === world.width ? world.width + MARGIN : s.x1 }));
  for (const s of roads) street(g, s.x0, s.x1, s.y, `st${s.y}`, [world.avenue]);
  // Trees wherever nothing else stands, far to near.
  const taken = [world.hq, ...world.buildings, ...world.lots, world.homes, ...roads.map((s) => ({ x: s.x0, y: s.y, w: s.x1 - s.x0, h: 3 })), ...verticals.map((x) => ({ x, y: top, w: 3, h: bottom - top }))];
  const clear = (x, y) => taken.every((t) => x < (t.x * TILE) - 12 || x > (t.x + t.w) * TILE + 12 || y < t.y * TILE - 2 || y > (t.y + t.h) * TILE + 34);
  const spots = [];
  for (let i = 0; i < ((W + M * 2) * (H + M * 2)) / 3000; i++) { const x = -M + r() * (W + M * 2), y = -M + r() * (H + M * 2); if (clear(x, y)) spots.push([Math.round(x), Math.round(y)]); }
  spots.sort((a, b) => a[1] - b[1]);
  const kept = [];
  for (const [x, y] of spots) if (kept.every(([kx, ky]) => Math.abs(kx - x) > 18 || Math.abs(ky - y) > 14)) kept.push([x, y]);
  for (const [x, y] of kept) tree(g, x, y, r);
  for (const b of world.buildings) if (b.archived) freeLot(g, b, "ARCHIVED"); else office(g, b);
  for (const l of world.lots) freeLot(g, l, "FREE LOT");
  headquarters(g, world.hq);
  // The neighbourhood: houses, with trees where no house stands yet.
  const hx = world.homes.x * TILE, hy = world.homes.y * TILE, hw = world.homes.w * TILE;
  world.homes.houses.forEach((h, i) => house(g, h, i));
  const below = world.homes.houses.at(-1), freeY = below ? below.y * TILE + 68 : hy;
  for (let y = freeY; y < hy + world.homes.h * TILE - 16; y += 44) for (let x = hx + 16; x < hx + hw - 8; x += 52) tree(g, x + r() * 10, y + 26 + r() * 8, r);
  g.fillStyle = "rgba(38,30,78,.14)"; g.fillRect(-M, -M, W + M * 2, H + M * 2); // the dusk wash over all of it
  return c;
}

const DASH_MS = 320, WALK_SPEED = 46, SCENERY_MS = 125, ZOOMS = [1, 1.5, 2, 3, 4, 5, 6];

// `insets()` says how much of the root the HUD's own bars cover, so the map is fitted into the free part.
export function mountCity(root, { canvas: canvasEl, insets = () => ({ l: 0, t: 0, r: 0, b: 0 }), onSelectAgent = () => {}, onSelectBuilding = () => {}, onOpenApp = () => {}, onState = () => {} } = {}) {
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
  const lights = new Map(); // house index → lit until (performance.now() ms)
  const cam = { x: 0, y: 0, wantX: 0, wantY: 0, zoom: 2, userMoved: false };
  const walked = new Set(); // ids that already walked home for good
  root._people = people; // a read-only test hook: e2e/commute.spec.ts watches who stands where
  const winBox = document.createElement("div"); winBox.id = "citywindows"; winBox.hidden = true; winBox.setAttribute("aria-hidden", "true"); root.append(winBox);
  let selected = null, hover = null, lastVisit = 0, hiddenHomes = 0;

  const visible = () => root.offsetParent !== null && !document.hidden;
  const dpr = () => devicePixelRatio || 1;
  const isPortrait = () => root.clientWidth < 800 && root.clientHeight > root.clientWidth;

  // ---------- Who stands where: placement from the state, seats and houses kept stable, journeys only for real changes ----------
  function spotOf(id) {
    const where = placement(state, id);
    if (where.place === "hq") { const [x, y] = CORE_SPOT[id] ?? CORE_SPOT.ace; return { x: world.hq.x * TILE + x, y: world.hq.y * TILE + y, key: `hq:${id}`, seated: CORE_DESK.has(id) }; }
    const agent = state.agents[id];
    if (where.place === "station" && agent?.kind === "manager") {
      const b = world.buildings.find((x) => x.dept === where.dept);
      if (b) return { x: (b.x + b.w / 2) * TILE + 14, y: b.y * TILE + 78, key: `door:${where.dept}`, seated: false };
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
    const minHouses = portrait ? 7 : 8;
    const houses = Math.max(minHouses, Math.ceil((Math.max(-1, ...homes.values()) + 1) / 2));
    const next = layout(state, { portrait, seats: seatCount, houses });
    const sig = JSON.stringify(next);
    const rebaked = sig !== worldSig;
    if (rebaked) { world = next; worldSig = sig; ground = bake(world); fitView(); }
    const wanted = new Set([...list.filter((a) => a.kind === "core" || CORE.has(a.id)).map((a) => a.id), ...shown.ids]);
    for (const id of people.keys()) if (!wanted.has(id)) { people.delete(id); if (selected === id) selected = null; if (hover === id) hover = null; }
    const still = instant || reduced() || !visible();
    for (const id of wanted) {
      const to = spotOf(id);
      let p = people.get(id);
      const fresh = !p;
      if (fresh) { const start = !still && to.key.startsWith("desk") ? homeSpot(world, homes.get(id) ?? 0) ?? to : to; p = { id, x: start.x, y: start.y, key: fresh && start === to ? to.key : "home", phase: hashOf(id) % 4, flip: false, hop: 0 }; people.set(id, p); }
      if (p.visiting) continue; // AIC is out; it comes back by itself
      p.seated = to.seated;
      if (p.key === to.key) { if (!p.move && !p.route) { p.x = to.x; p.y = to.y; } else if (p.route) p.route[p.route.length - 1] = to; else if (p.move) p.move.to = to; continue; } // a new layout only shifts them
      const fromKey = p.key;
      p.key = to.key;
      const walkHome = to.key === "home" && walksOut(state, id, walked);
      if (still) { p.x = to.x; p.y = to.y; p.move = null; p.route = null; p.waitUntil = null; p.speed = null; p.homecoming = false; continue; }
      if (walkHome) {
        // Checking out: stand up, say so, take a turn at the door, and walk the streets home.
        const b = buildingOfKey(fromKey);
        p.move = null;
        p.route = commuteRoute(world, p, to, { leaving: fromKey.startsWith("desk:") ? b : null });
        p.speed = walkSpeed(p.route, p);
        p.waitUntil = b ? queueAt(`door:${b.dept}`, 150) : performance.now();
        p.homecoming = true; // lights the house on arrival (step() clears it)
        p.say = { text: "CHECKED OUT", until: performance.now() + 1800 };
      } else if (to.key === "home") { p.x = to.x; p.y = to.y; p.move = null; p.route = null; } // any other move home is instant
      else if (to.key.startsWith("desk:") && (fresh || fromKey === "home") && buildingOfKey(to.key)) {
        // Hired: the house lights up, then the worker walks out, along the streets and in through the door.
        const b = buildingOfKey(to.key);
        const from = { x: p.x, y: p.y };
        p.move = null;
        p.route = commuteRoute(world, from, to, { entering: b });
        p.speed = walkSpeed(p.route, from);
        p.waitUntil = queueAt(`door:${b.dept}`, 700);
        lightHouse(id, p.waitUntil - performance.now() + 500);
      } else dashTo(p, to);
    }
    const lit = [];
    for (const [d, m] of seats) for (const id of m.keys()) { const i = el("i"); i.dataset.lit = id; i.dataset.dept = d; lit.push(i); }
    winBox.replaceChildren(...lit);
    refreshVisuals();
    root.dataset.people = String(people.size);
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
  /** Lights a house window for a while (a worker about to leave, or just home). */
  function lightHouse(id, ms) {
    const i = Math.floor((homes.get(id) ?? 0) / 2);
    lights.set(i, Math.max(lights.get(i) ?? 0, performance.now() + ms));
    setTimeout(() => wake(), ms + 150);
  }
  function dashTo(p, to, then) {
    p.waitUntil = null;
    p.route = null;
    p.flip = to.x < p.x;
    p.move = { from: { x: p.x, y: p.y }, to, at: performance.now(), then };
    dust(p.x, p.y, 8, POOF);
  }
  function refreshVisuals() { const now = Date.now(); for (const p of people.values()) p.visual = visualState(state, p.id, now); }

  // ---------- Apps (docs/APPS.md): cabinets at the Apps building, and a sign while one waits for the owner ----------
  const appsDept = (x) => x?.department || "Apps";
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
      const X = b.x * TILE, top = b.y * TILE + 2 + 72 - CABINET_H + 6;
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
  const PLACEMENT_EVENTS = new Set(["agent.hired", "agent.retired", "department.created", "department.updated", "ticket.status", "worker.state", "worker.merge_waiting", "worker.merged", "tickets.parked"]);
  function onEvent(e) {
    const feedBefore = state.feed;
    state = reduce(state, e);
    if (PLACEMENT_EVENTS.has(e.type)) { sync(); markApps(); } else refreshVisuals();
    const hop = courierFor(e); if (hop) courier(hop);
    if (e.type === "ace.visit") aceVisit(e);
    if (e.type === "review.result" && e.verdict === "FAIL") { const t = state.tickets[e.ticket_id], p = t && people.get(t.to); if (p) dust(p.x, p.y - 20, 14, ["#55525e", "#77747f", "#99969f"], 18, 1.2); }
    if (e.type === "ticket.status" && e.ticket.status === "done") { const p = people.get(e.ticket.to); if (p) dust(p.x, p.y - 22, 28, CONFETTI, 70, 1); }
    if (e.type === "agent.hired" && e.agent) { const b = buildingOf(deptOf(e.agent)); if (b) dust((b.x + b.w / 2) * TILE, (b.y + 3) * TILE, 24, POOF, 60, 0.7); } // someone new walks in
    if (e.type === "app.published") { const b = buildingOf(appsDept(e)); if (b) { dust((b.x + b.w / 2) * TILE, (b.y + 1) * TILE, 90, CONFETTI, 90, 1.4); wake(); } }
    if (e.type.startsWith("app.") || e.type.startsWith("approval.")) { markApps(); wake(); }
    if (e.type === "department.created") { const b = world.buildings.find((x) => x.dept === e.name); if (b) dust((b.x + b.w / 2) * TILE, (b.y + 3) * TILE, 40, POOF, 70, 0.8); }
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
  // AIC dashes over, says what it is doing, and comes back. Its status call can repeat fast: those are not new visits.
  function aceVisit({ to, kind }) {
    const now = Date.now(), allowed = visitAllowed(lastVisit, now, to);
    lastVisit = now;
    if (!allowed) return;
    const j = people.get("ace"), target = people.get(to);
    if (!j || !target || j.visiting) return;
    root.dataset.visits = String(Number(root.dataset.visits ?? 0) + 1);
    const words = kind === "ask" ? "ASKING" : "CHECKING IN", side = target.x > 40 ? -15 : 15;
    j.visiting = true;
    const back = () => { const home = spotOf("ace"); j.visiting = false; if (reduced() || !visible()) { j.x = home.x; j.y = home.y; } else dashTo(j, home); };
    j.say = { text: words, until: performance.now() + 1500 };
    const arrived = () => { j.flip = side < 0 ? false : true; setTimeout(back, 1400); };
    if (reduced() || !visible()) { j.x = target.x + side; j.y = target.y; arrived(); } else dashTo(j, { x: target.x + side, y: target.y }, arrived);
  }

  // ---------- The view: integer-ish zoom, crisp pixels, pan and pinch ----------
  // The room the map may use: not under the side column on a wide screen, not under the top rows or bottom rows on a phone.
  function safeArea() {
    const n = insets();
    return { l: n.l, t: n.t, r: root.clientWidth - n.r, b: root.clientHeight - n.b };
  }
  function viewSize() {
    const n = cam.zoom * dpr();
    const w = Math.max(1, Math.ceil(root.clientWidth * dpr() / n)), h = Math.max(1, Math.ceil(root.clientHeight * dpr() / n));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const cssW = `${(w * n) / dpr()}px`, cssH = `${(h * n) / dpr()}px`;
    if (canvas.style.width !== cssW) { canvas.style.width = cssW; canvas.style.height = cssH; }
    ctx.imageSmoothingEnabled = false;
    return { w, h };
  }
  function clampCam(x, y) {
    const { w, h } = viewSize(), W = world.width * TILE, H = world.height * TILE;
    return [Math.max(-w * 0.6, Math.min(W - w * 0.4, x)), Math.max(-h * 0.6, Math.min(H - h * 0.4, y))]; // a little past the edge, never lost
  }
  function centreOn(x, y, area = safeArea()) {
    const px = ((area.l + area.r) / 2) / cam.zoom, py = ((area.t + area.b) / 2) / cam.zoom;
    [cam.wantX, cam.wantY] = clampCam(x - px, y - py);
  }
  // The biggest zoom that shows the whole map, and never below one art pixel per screen pixel.
  function fitView(force = false) {
    if (!world || (cam.userMoved && !force) || !root.clientWidth) return;
    const area = safeArea(), W = world.width * TILE, H = world.height * TILE;
    const portrait = world.portrait;
    const usable = ZOOMS.filter((z) => z * dpr() === Math.round(z * dpr()) || dpr() === 1);
    let best = 1;
    for (const z of usable.length ? usable : ZOOMS) if (W * z <= area.r - area.l && (portrait || H * z <= area.b - area.t)) best = z;
    cam.zoom = best;
    if (force) cam.userMoved = false;
    viewSize();
    centreOn(W / 2, portrait ? (area.b - area.t) / 2 / best : H / 2, area); // a phone starts at the top of the map, HQ first
    cam.x = cam.wantX; cam.y = cam.wantY;
  }
  function setZoom(z, cx = root.clientWidth / 2, cy = root.clientHeight / 2) {
    if (z === cam.zoom) return;
    const ax = cam.x + cx / cam.zoom, ay = cam.y + cy / cam.zoom;
    cam.zoom = z; cam.userMoved = true;
    viewSize();
    [cam.x, cam.y] = clampCam(ax - cx / z, ay - cy / z);
    cam.wantX = cam.x; cam.wantY = cam.y;
    wake();
  }
  const zoomStep = (dir, cx, cy) => { const i = ZOOMS.indexOf(cam.zoom) + dir; if (ZOOMS[i]) setZoom(ZOOMS[i], cx, cy); };
  const zoomToBuilding = (b) => { cam.userMoved = true; const i = Math.max(ZOOMS.indexOf(cam.zoom), ZOOMS.indexOf(3)); cam.zoom = ZOOMS[i]; viewSize(); centreOn((b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE); wake(); };

  // Pick by art position. Figures get a forgiving box: fingers are bigger than sprites.
  const toArt = (ev) => { const r = root.getBoundingClientRect(); return { x: cam.x + (ev.clientX - r.left) / cam.zoom, y: cam.y + (ev.clientY - r.top) / cam.zoom }; };
  function pickAgent(ev, slack = 0) {
    const { x, y } = toArt(ev), extra = slack / cam.zoom;
    let best = null, bestD = Infinity;
    for (const p of people.values()) {
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
    if (Math.abs(ev.deltaY) < 4 && !ev.ctrlKey) return;
    const r = root.getBoundingClientRect();
    wheelSum += ev.deltaY;
    if (Math.abs(wheelSum) > 60) { zoomStep(wheelSum < 0 ? 1 : -1, ev.clientX - r.left, ev.clientY - r.top); wheelSum = 0; }
  }, { passive: false });
  let wheelSum = 0;
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
      if (pinchDist && Math.abs(d / pinchDist - 1) > 0.25) { const r = root.getBoundingClientRect(); zoomStep(d > pinchDist ? 1 : -1, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top); pinchDist = d; }
      if (!pinchDist) pinchDist = d;
      drag = null;
      return;
    }
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) { cam.userMoved = true; [cam.x, cam.y] = clampCam(drag.cx - dx / cam.zoom, drag.cy - dy / cam.zoom); cam.wantX = cam.x; cam.wantY = cam.y; wake(); }
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
  function drawPerson(p, now, f) {
    const a = state.agents[p.id];
    if (!a) return;
    const moving = !!(p.move || p.route), key = p.visual ?? "idle", vis = VISUALS[key] ?? VISUALS.working;
    const pose = moving ? "still" : key === "idle" && p.seated ? "still" : vis.pose;
    const frame = (f + p.phase) % 4;
    const stride = moving ? (Math.floor(now / (p.move ? 40 : 130)) % 4) : null;
    const hopY = p.hop > 0 ? -Math.round(Math.sin(p.hop * Math.PI) * 7) : 0;
    const floatY = p.id === "ace" && !moving ? [-2, -3, -2, -1][f] : 0;
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
    if (!p.seated || moving) { ctx.fillStyle = "rgba(20,18,40,.35)"; ctx.fillRect(x - 5, y, 10, 2); ctx.fillRect(x - 4, y + 2, 8, 1); }
    if (key === "waiting_owner" && !moving) { const k = reduced() ? 1 : f % 2; ctx.fillStyle = k ? "rgba(255,216,74,.45)" : "rgba(255,216,74,.25)"; ctx.fillRect(x - 11, y - 1, 22, 4); ctx.fillRect(x - 8, y - 3, 16, 8); }
    if (p.id === "ace") { ctx.fillStyle = "rgba(120,220,255,.16)"; ctx.fillRect(x - 10, y - 24, 20, 26); ctx.fillRect(x - 7, y - 27, 14, 32); }
    const sprite = figure(a, pose, frame, stride);
    const sy = y - 24 + hopY + floatY;
    if (p.flip) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(sprite, -x - 10, sy); ctx.restore(); } else ctx.drawImage(sprite, x - 10, sy);
    if (p.seated && !moving) ctx.drawImage(desk(propFor(a) ?? "laptop"), x - 12, y - 11);
    if (key === "failed" && !reduced() && Math.random() < 0.05) dust(p.x, p.y - 22, 1, ["#77747f"], 8, 0.8);
  }
  function drawBubble(p, f) {
    const key = p.visual ?? "idle";
    if (p.move || p.route) return;
    const x = Math.round(p.x - cam.x), y = Math.round(p.y - 24 - cam.y);
    if (key !== "idle") {
      const loud = key === "waiting_owner";
      const bounce = reduced() ? 0 : loud ? [0, -3, -5, -3][f] : key === "failed" || key === "blocked" ? 0 : [0, 0, -1, -1][(f + p.phase) % 4];
      const img = bubble(key);
      if (loud && !reduced() && f % 2) { ctx.fillStyle = "rgba(255,216,74,.4)"; ctx.fillRect(x - 12, y - 17 + bounce, 24, 19); }
      ctx.drawImage(img, x - 8, y - 15 + bounce);
    }
  }
  function label(text, wx, wy, fg = "#fff6e0", bg = INK) {
    const t = fit(text, 120), w = textW(t) + 6, x = Math.round(wx - cam.x - w / 2), y = Math.round(wy - cam.y);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, 9); ctx.fillRect(x + 1, y - 1, w - 2, 11);
    pixelText(ctx, t, x + 3, y + 2, fg);
  }
  function draw(now) {
    const { w, h } = viewSize();
    const f = reduced() ? 0 : Math.floor(now / SCENERY_MS / 2) % 4;
    ctx.fillStyle = "#2d5d53"; ctx.fillRect(0, 0, w, h);
    const ox = Math.round(cam.x), oy = Math.round(cam.y);
    const M = MARGIN * TILE, sx = Math.max(0, ox + M), sy = Math.max(0, oy + M), dw = Math.min(w, ground.width - sx), dh = Math.min(h, ground.height - sy);
    if (dw > 0 && dh > 0) ctx.drawImage(ground, sx, sy, dw, dh, sx - ox - M, sy - oy - M, dw, dh); // only the part on screen
    // Scenery that moves: the fountain's jet and ripples.
    const fx = world.hq.x * TILE + FOUNTAIN[0] - ox, fy = world.hq.y * TILE + FOUNTAIN[1] - oy;
    const jet = [13, 15, 14, 16][f];
    R(ctx, fx - 1, fy - 10 - jet, 2, jet, "#bfe6ff"); R(ctx, fx - 3, fy - 10 - jet, 6, 1, "#d7f1ff");
    for (const [dx, dy] of [[-3, -8 - jet + (f * 3) % 6], [3, -8 - jet + ((f + 2) * 3) % 6], [-5, -4 - ((f * 2) % 4)], [5, -6 + ((f * 2) % 4)]]) R(ctx, fx + dx, fy + dy - 2, 1, 2, "#a8dcff");
    R(ctx, fx - 12 + f * 2, fy - 1, 6, 1, "#8ab2d6"); R(ctx, fx + 6 - f * 2, fy + 2, 7, 1, "#8ab2d6");
    // A lit window marks a house with movement: someone called in to work, or just home after checking out.
    for (const [i, until] of lights) {
      if (until <= now) { lights.delete(i); continue; }
      const hh = world.homes.houses[i];
      if (hh) { const win = houseWindows(hh); R(ctx, win.x - ox, win.y - oy, win.w, win.h, "#ffdf94"); R(ctx, win.x - ox, win.y - oy, win.w, 2, "#ffefc0"); }
    }
    if (hiddenHomes) label(`+${hiddenHomes} MORE IN WORKFORCE`, world.homes.x * TILE + 60, (world.homes.y + world.homes.h) * TILE - 12);
    // Lit glass behind the desks: one window per occupied seat.
    const litWin = [];
    for (const [d, m] of seats) { const b = world.buildings.find((x) => x.dept === d); if (!b) continue; for (const seat of m.values()) { const q = windowRect(seatSpot(b, seat), b); litWin.push(q); R(ctx, q.x - ox, q.y - oy, q.w, q.h, "#ffdf94"); R(ctx, q.x - ox, q.y - oy, q.w, 4, "#ffefc0"); } }
    // A count badge on each department with people at their desks.
    for (const [d, m] of seats) { const b = world.buildings.find((x) => x.dept === d); if (b && m.size) label(`${m.size}`, (b.x + b.w) * TILE - 18, b.y * TILE + 2, INK, "#ffd84a"); }
    // The apps' cabinets stand in front of the Apps building; the people walk in front of them.
    const marks = appMarkers();
    for (const m of marks) { if (m.app) { ctx.drawImage(cabinet(m.tint), Math.round(m.x - cam.x), Math.round(m.y - cam.y)); } else label(`+${m.more}`, m.x + 10, m.y, INK, "#ffd84a"); }
    const first = marks.find((m) => m.app); // where the first cabinet is on screen, for tests and tooling
    root.dataset.appSpot = first ? `${Math.round((first.x + CABINET_W / 2 - cam.x) * cam.zoom)},${Math.round((first.y + CABINET_H / 2 - cam.y) * cam.zoom)}` : "";
    // Everyone, back to front.
    const order = [...people.values()].sort((a, b) => a.y - b.y);
    for (const p of order) drawPerson(p, now, f);
    for (const p of parcels) {
      const tx = p.target.x, ty = p.target.y - 14, k = p.t, ax = p.from.x + (tx - p.from.x) * k, ay = p.from.y + (ty - p.from.y) * k;
      const x = Math.round(ax - cam.x), y = Math.round(ay - cam.y - Math.sin(k * Math.PI) * 26);
      R(ctx, Math.round(ax - cam.x) - 3, Math.round(ay - cam.y) + 12, 6, 2, "rgba(20,18,40,.35)");
      R(ctx, x - 4, y - 4, 8, 7, INK); R(ctx, x - 3, y - 3, 6, 5, p.kind === "ticket" ? "#f4c63c" : "#49ad7c"); R(ctx, x - 1, y - 3, 2, 5, "#fff6e0");
    }
    // The mullions and sill sit in front of the figures; every occupied window keeps a name plate cut to its width.
    for (const q of litWin) { R(ctx, q.x - ox, q.y - oy, 1, q.h, INK); R(ctx, q.x + q.w - 1 - ox, q.y - oy, 1, q.h, INK); R(ctx, q.x + Math.floor(q.w / 2) - ox, q.y - oy, 1, 6, INK); R(ctx, q.x - ox, q.y - oy, q.w, 1, INK); R(ctx, q.x - 1 - ox, q.y + q.h - oy, q.w + 2, 2, "#8c7a66"); }
    for (const p of order) if (p.key.startsWith("desk") && !p.move && p.id !== selected && p.id !== hover) label(fit(p.id, Math.round((world.buildings[0] ? (world.buildings[0].w * TILE - 8) / 4 : 34) - 8)), p.x, p.y + 8);
    for (const p of order) drawBubble(p, f);
    for (const e of effects) R(ctx, e.x - cam.x, e.y - cam.y, e.s, e.s, e.c);
    // The one being looked at gets an arrow and its name; so does whoever the mouse is on, and the core keep name plates.
    for (const p of order) if (p.id === selected || p.id === hover || CORE.has(p.id)) {
      const a = state.agents[p.id];
      if (a) label(p.id === hover && p.visual && p.visual !== "idle" ? `${p.id === "ace" ? "AIC" : p.id}: ${VISUALS[p.visual].label}` : p.id === "ace" ? "AIC" : p.id, p.x, p.y + 4, p.id === selected ? INK : "#fff6e0", p.id === selected ? "#ffd84a" : INK);
    }
    // A publish approval is open: the Apps building waits for the owner.
    for (const b of waitingBuildings()) { const k = reduced() ? 1 : f % 2, cx = (b.x + b.w / 2) * TILE, y = b.y * TILE - 12; if (k) { ctx.fillStyle = "rgba(255,216,74,.35)"; ctx.fillRect(Math.round(cx - 50 - cam.x), Math.round(y - 3 - cam.y), 100, 15); } label("WAITING FOR YOU", cx, y, INK, "#ffd84a"); }
    for (const p of order) if (p.say && p.say.until > performance.now()) label(p.say.text, p.x, p.y - 46, INK, "#8fdcff"); // AIC's word stays on top of every mark
    const s = selected && people.get(selected);
    if (s) { const bob = reduced() ? 0 : [0, 1, 2, 1][f]; const x = Math.round(s.x - cam.x), y = Math.round(s.y - cam.y) - (s.visual && s.visual !== "idle" ? 46 : 32) + bob; R(ctx, x - 4, y, 8, 2, INK); R(ctx, x - 3, y, 6, 2, "#ffd84a"); R(ctx, x - 3, y + 2, 6, 2, INK); R(ctx, x - 2, y + 2, 4, 1, "#ffd84a"); R(ctx, x - 1, y + 4, 2, 2, INK); }
  }

  // The frame loop. Scenery ticks at a low rate; only journeys, effects and parcels ask for every frame.
  let last = performance.now(), lastDraw = 0, fpsN = 0, fpsT = last, paused = true, needDraw = true;
  const wake = () => { needDraw = true; resume(); };
  function step(dt, now) {
    let busy = false;
    for (const p of people.values()) {
      if (p.hop > 0) { p.hop = Math.max(0, p.hop - dt * 2.6); busy = true; }
      if (p.waitUntil) {
        if (now < p.waitUntil) { busy = true; continue; }
        p.waitUntil = null;
      }
      if (p.move) {
        busy = true;
        const t = Math.max(0, Math.min(1, (now - p.move.at) / DASH_MS)); // by the clock: a slow machine still gets there on time
        const e = 1 - (1 - t) ** 3;
        const { from, to } = p.move;
        p.x = from.x + (to.x - from.x) * e; p.y = from.y + (to.y - from.y) * e;
        if (Math.random() < 0.5) dust(p.x, p.y - 2, 1, POOF, 12, 0.3);
        if (t >= 1) { const then = p.move.then; p.move = null; dust(p.x, p.y - 4, 12, ["#ffe9a0", "#fff6e0", "#f4c63c"], 50, 0.45); then?.(); }
      } else if (p.route) {
        busy = true;
        const to = p.route[0], dx = to.x - p.x, dy = to.y - p.y, d = Math.hypot(dx, dy), s = (p.speed ?? WALK_SPEED) * dt;
        if (Math.abs(dx) > 0.5) p.flip = dx < 0;
        if (d <= s) {
          p.x = to.x; p.y = to.y; p.route.shift();
          if (!p.route.length) {
            p.route = null; p.speed = null;
            if (p.homecoming) { p.homecoming = false; lightHouse(p.id, 1500); dust(p.x, p.y - 8, 10, POOF, 28, 0.5); } // home: the light goes on, then out
          }
        } else { p.x += (dx / d) * s; p.y += (dy / d) * s; }
      }
    }
    if (effects.length) { busy = true; effects = effects.filter((e) => { e.life -= dt; e.vy += e.g * dt; e.x += e.vx * dt; e.y += e.vy * dt; return e.life > 0; }); }
    if (parcels.length) {
      busy = true;
      parcels = parcels.filter((p) => { p.t += dt / 0.9; if (p.t < 1) return true; dust(p.target.x, p.target.y - 14, 8, p.kind === "ticket" ? ["#f4c63c", "#fff6e0"] : ["#49ad7c", "#fff6e0"], 34, 0.4); return false; });
    }
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
    if (world && (busy || needDraw || now - lastDraw >= SCENERY_MS)) { draw(now); lastDraw = now; needDraw = false; fpsN++; }
    if (now - fpsT > 2000) { root.dataset.fps = String(Math.round((fpsN * 1000) / (now - fpsT))); fpsN = 0; fpsT = now; }
    requestAnimationFrame(frame);
  }
  function resume() { if (paused && root.offsetParent !== null) { paused = false; last = performance.now(); requestAnimationFrame(frame); } }


  // ---------- Data in: a snapshot, then events (from the HUD's WebSocket) ----------
  function load(snap) {
    state = applySnapshot(state, snap ?? { agents: [], tickets: [], questions: [] });
    parcels = []; effects = [];
    // The people stay: a later snapshot (a reconnect, or one racing live events) converges by walking anyone
    // whose place changed in the meantime, instead of clearing the town and teleporting everyone. Only the
    // very first load, before there is a world, places people instantly.
    if (ctx) { sync(!world); fitView(); markApps(); needDraw = true; resume(); }
    onState(state);
  }
  if (typeof ResizeObserver === "undefined") window.addEventListener("resize", () => { if (world) { fitView(); wake(); } });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  root.dataset.cityReady = "1";
  return {
    load,
    onEvent: (e) => { if (ctx && world) onEvent(e); else { state = reduce(state, e); onState(state); } },
    zoomIn: () => zoomStep(1),
    zoomOut: () => zoomStep(-1),
    fit: () => { fitView(true); wake(); },
    select: (id) => { if (id) selectAgent(id); else { selected = null; wake(); } },
    focusBuilding: (dept) => { const b = world && [world.hq, ...world.buildings].find((x) => x.dept === dept); if (b) zoomToBuilding(b); },
    resume() { resume(); if (world) { fitView(); wake(); } },
    get state() { return state; },
    get people() { return people; },
    get view() { return { x: cam.x, y: cam.y, zoom: cam.zoom }; },
  };
}

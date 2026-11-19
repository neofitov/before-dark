// Where the camp's places go round the board (camp.js builds them; main.js frames the camera on them). Plain numbers, no
// three.js, so node's tests can check it (test/layout.test.mjs).
//
// A wide screen: until 2026-11-18 a fixed place round the board for each part, the same in every level, out along its
// direction from the game's largest board until all it builds clears the workers' path (SLOT, wideLayout); its camp behind
// the board ran off the top of CrazyGames' frame on a laptop. Now worked out from the screen too (wideFit, below the upright
// ones): a row behind the board and a column down each side, the parts moving out to the side columns as the height runs
// short, the board never framed smaller than it was.
// A phone held upright (Oleg, 2026-11-07: "rearrange camp top-bottom for portrait"): a row behind the board (the tent, the
// campfire with the beds behind it, the workshop) and one in front of it (the water, the stores). Those places were hand-set
// numbers for the largest board (7x7), and the camera framed that board on every level, so the easier curve's 5x5 and 6x6
// boards sat small in the middle of the phone (Oleg's yes, 2026-11-18). Now each is worked out from the screen when a level
// is laid out (uprightLayout): the camera frames this level's board and the ring round it where the gate workers stand across
// the width; each row is pushed out from the board just past the gates' ground and the workers' path (plus breathing room
// while the height allows) and spread across the ground the camera sees at the row's depth (the row behind is further away,
// so wider); a row that does not fit closes its gaps, then the camera pulls back until everything built is on the screen.

import { gateLeaf } from '../slide/model.js';

// the ground's height (board.js GROUND), and how high the builds reach at their sides: the shop's roofs stand on posts 1.45
// tall (tiers.js, the workshop's shelter), and from the camera a thing high up runs further out to the screen's side than its
// foot (it is nearer)
export const GROUND = -0.32, TALL = GROUND + 1.5;
export const KIND = { red: 'fire', orange: 'tent', green: 'bench', blue: 'water', purple: 'chest', yellow: 'beds' };
// the kinds of build at a colour's place: the campfire's place holds the beds' ground behind it (the bed maker works there,
// early crews sleep there on bedrolls before any bed is built, the shop's string lights and flag stand on poles at its back
// corners); upright, a level where none of that can be has the campfire's own ground only (a site with beds: false)
export const kindsAt = (color, site = null) => (color === 'red' || color === 'yellow' ? (site && site.beds === false ? ['fire'] : ['fire', 'beds']) : [KIND[color]]);

// The ground each part of the camp takes once everything is built (all its stages and extras): a rectangle in its site's frame,
// `across` along the site's right and `towards` the board, from the site's middle (the beds go round the campfire, behind
// it). Everything else follows from these (Oleg, 2026-10-24: a bed stood in a tree; "make sure this doesn't happen in future
// level designs, not just for beds but everything the npcs build"): each place is pushed out from the board until its
// rectangle clears the path the workers walk round the board; the forest grows round the rectangles (camp.js campKeepOut,
// world.js plantForest); tools/check-camp.js fails when anything built pokes out of its rectangle or runs into the board, the
// path, a gate or another part. A new build or a bigger one: widen its rectangle here.
export const PLAN = {
  fire: { across: [-1.15, 1.15], towards: [-1.05, 0.9] },
  tent: { across: [-0.75, 0.95], towards: [-1.45, 1.45] },
  bench: { across: [-1.35, 1.35], towards: [-0.7, 0.85] },
  water: { across: [-1.1, 1.2], towards: [-0.95, 0.4] },
  chest: { across: [-0.9, 1.35], towards: [-0.7, 0.85] },
  beds: { across: [-2.4, 2.45], towards: [-2.5, 0.2] },
};
// the workers' path round a board: a rounded rectangle a step outside the frame (camp.js loop)
export const PATH = { out: 1.05, round: 0.7, clear: 0.35 };
// how far a point lies outside that path round a board w x h (negative: inside it)
export function pathGap(x, z, w, h) {
  const qx = Math.abs(x) - (w / 2 + PATH.out - PATH.round), qz = Math.abs(z) - (h / 2 + PATH.out - PATH.round);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - PATH.round;
}
// a site's rectangle as points round its edge (world [x, z]); pos and f: { x, z }
export function edge(pos, f, plan) {
  const r = [-f.z, f.x], pts = [];
  const [a0, a1] = plan.across, [b0, b1] = plan.towards;
  for (let k = 0; k <= 20; k++) {
    const a = a0 + ((a1 - a0) * k) / 20, b = b0 + ((b1 - b0) * k) / 20;
    for (const [u, v] of [[a, b0], [a, b1], [a0, b], [a1, b]]) pts.push([pos.x + r[0] * u + f.x * v, pos.z + r[1] * u + f.z * v]);
  }
  return pts;
}
// how far a point lies outside a site's rectangle for one kind (0 on it)
export function rectGap(site, kind, x, z) {
  const { across, towards } = PLAN[kind], dx = x - site.x, dz = z - site.z;
  const a = dx * -site.f.z + dz * site.f.x, b = dx * site.f.x + dz * site.f.z;
  return Math.hypot(Math.max(0, across[0] - a, a - across[1]), Math.max(0, towards[0] - b, b - towards[1]));
}
// a site's rectangle for one kind in the world, [x0, x1, z0, z1] (upright the sites face straight along z, so it is square to
// the axes)
export function rectOf(site, kind) {
  const { across, towards } = PLAN[kind], r = [-site.f.z, site.f.x], xs = [], zs = [];
  for (const a of across) for (const b of towards) xs.push(site.x + r[0] * a + site.f.x * b), zs.push(site.z + r[1] * a + site.f.z * b);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}

// ---- a wide screen until 2026-11-18: [angle round the board] for the largest board (unchanged since 2026-10-24; still the
// old framing's camp, wideToday, and the places when none are worked out, as for the prototype's levels) ----
const SLOT = { red: -90, orange: -140, green: -40, blue: 180, purple: 0, yellow: 150 };
export function wideLayout(colors, size) {
  const rx = size.w / 2 + 3, rz = size.h / 2 + 2.8, sites = {};
  for (const color of colors) {
    const a = ((color === 'yellow' ? SLOT.red : SLOT[color]) * Math.PI) / 180, dir = { x: Math.cos(a) * rx, z: Math.sin(a) * rz };
    const n = Math.hypot(dir.x, dir.z), f = { x: -dir.x / n, z: -dir.z / n };
    let t = 1;
    while (t < 3 && kindsAt(color).some((k) => edge({ x: dir.x * t, z: dir.z * t }, f, PLAN[k]).some(([x, z]) => pathGap(x, z, size.w, size.h) < PATH.clear))) t += 0.02;
    sites[color] = { x: dir.x * t, z: dir.z * t, f, lean: 0 };
  }
  return sites;
}

// ---- a phone held upright ----
// each place: [its row's side (-1 behind the board, 1 in front), where in the row (-1 left, 0 the middle, 1 right), its
// breathing room (past the gates' ground: the row behind a cell and a half, room round the board and the far gates' workers
// in view, Oleg 2026-11-07; the row in front less), and how far the worker stands in from the place's middle, along its right,
// towards the phone's middle (the row in front is nearer the camera, so its sides are cut first)]. The yellow crew works at the
// campfire's place: the camp sleeps round it, in the beds she builds (Oleg, 2026-10-24)
export const ROW = { orange: [-1, -1, 1.5], red: [-1, 0, 1.5], green: [-1, 1, 1.5], blue: [1, -1, 0.9, 0.7], purple: [1, 1, 0.9, -0.7] };
const placeOf = (color) => (color === 'yellow' ? 'red' : color);
// the camera upright (main.js frameFor): its look down (degrees), its height of view, the bars at the top and bottom of the
// screen (CSS px: the HUD, the hint line), the ring round the board where the gate workers stand, and how wide the board and
// that ring may run across the screen
export const VIEW = { elev: 60, fov: 40, top: 120, bottom: 110, ring: 1.15, wide: 0.97 };
// the room each row starts past (the ground in front of the gates, where the crates land and the workers wait, reaches 1.9
// out: tools/check-camp.js NEAR.front); between places in a row (wanted, and at the least once a row is closed up); from the
// screen's sides (a share of the half width: wanted, and at the least); a gate's leaf, open or shut (check-camp NEAR.door);
// the most room between places in a row on a wide screen, and how far past the board's sides the row in front may reach in
const GAP = { start: 2.05, between: 0.6, betweenMin: 0.3, side: 0.07, sideMin: 0.02, door: 0.2, most: 1.2, out: 0.6 };
// the breathing room tried, as a share of each place's own (ROW): all of it while the screen's height allows, less on a short
// screen before the camera pulls back
const BREATH = [1, 0.75, 0.5, 0.25, 0];
// how far the camera may pull back for the camp to fit between the bars (the cap, given the largest board): to the largest
// board's own framing, as every level had before 2026-11-18, and further while the board's cells stay this big (CSS px
// across, at the board's middle): the 7x7's cell on a 390x844 phone, where it is framed by its own width (2026-11-18, Oleg
// "build 1-4": a 768x1024 tablet tucked the row behind under the top bar with 64 px cells). A short phone's cells are smaller
// than that already at the old framing, so it stays as it was
export const CELL_MIN = 37.4;
// the board's cell across at its middle (CSS px), seen by a camera (uprightCamera's)
export const cellOn = (screen, cam) => ((cam.project(0.5, 0.3, 0)[0] - cam.project(-0.5, 0.3, 0)[0]) / 2) * screen.w;

// the camera: looking down at elev from distance d at the point (0, 0, lz); project(x, y, z) -> the screen's [-1, 1] both ways
export function uprightCamera(screen, d, lz, view = VIEW) {
  const e = (view.elev * Math.PI) / 180, s = Math.sin(e), c = Math.cos(e), tf = Math.tan((view.fov * Math.PI) / 360), aspect = screen.w / screen.h;
  const depth = (y, z) => d - (s * y + c * (z - lz));
  return {
    d, lz, elev: view.elev,
    project: (x, y, z) => {
      const D = depth(y, z);
      return [x / (D * tf * aspect), (c * y - s * (z - lz)) / (D * tf)];
    },
    // the half width the screen shows at a depth, out to `lim` of its half width
    half: (y, z, lim = 1) => lim * tf * aspect * depth(y, z),
    // the bars, as the screen's -1..1
    top: 1 - (2 * view.top) / screen.h, bottom: -1 + (2 * view.bottom) / screen.h,
  };
}

// the screen's height of a point (-1..1) seen from distance d looking at lz (uprightCamera's project, without making one)
function heightOn(screen, d, lz, view, y, z) {
  const e = (view.elev * Math.PI) / 180, s = Math.sin(e), c = Math.cos(e), tf = Math.tan((view.fov * Math.PI) / 360);
  return (c * y - s * (z - lz)) / ((d - (s * y + c * (z - lz))) * tf);
}
// the camera looking at lz that puts the camp's depth (from `back`, its far end up at the height of its roofs, to `front`)
// in the middle of the room between the bars (Oleg, 2026-11-07: a tall phone's extra height goes to the camp)
function centred(screen, d, back, front, view) {
  const mid = -(view.top - view.bottom) / screen.h;   // ((1 - 2 top / h) + (-1 + 2 bottom / h)) / 2
  let lo = -40, hi = 40;
  for (let k = 0; k < 30; k++) {
    const lz = (lo + hi) / 2;
    // looking further back (-z) brings everything down the screen
    if ((heightOn(screen, d, lz, view, 1.2, back) + heightOn(screen, d, lz, view, GROUND, front)) / 2 > mid) hi = lz;
    else lo = lz;
  }
  return uprightCamera(screen, d, (lo + hi) / 2, view);
}
// the furthest the camera may stand (centred on the camp's depth from back to front) with the board's cells still CELL_MIN,
// from `near` (the nearest framing: the board and its ring across the width) out
function cellDist(screen, back, front, view, near) {
  const big = (d) => cellOn(screen, centred(screen, d, back, front, view)) >= CELL_MIN;
  let lo = near, hi = 120;
  if (!big(lo)) return lo;
  for (let n = 0; n < 30; n++) (big((lo + hi) / 2) ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2));
  return lo;
}

// how far each row of a board w x h is pushed out (the z of its places), with breathing room k (a share of each place's own):
// past the gates' ground, then on until every rectangle clears the workers' path and every gate leaf (doors: [[x0, z0, x1,
// z1]], the leaves open and shut) at the place's x
function rowZ(color, board, k, x, doors, beds = true) {
  const [side, , back] = ROW[color], kinds = kindsAt(color, { beds }), f = { x: 0, z: -side };
  let t = GAP.start + back * k + Math.max(...kinds.map((n) => PLAN[n].towards[1]));
  const blocked = (site) => kinds.some((n) => edge(site, f, PLAN[n]).some(([px, pz]) => pathGap(px, pz, board.w, board.h) < PATH.clear
    || doors.some(([x0, z0, x1, z1]) => segGap(px, pz, x0, z0, x1, z1) < GAP.door)));
  while (t < 9 && blocked({ x, z: side * (board.h / 2 + t) })) t += 0.02;
  return side * (board.h / 2 + t);
}
function segGap(px, pz, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, u = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - x0 - u * dx, pz - z0 - u * dz);
}

// a row's places across the ground the camera sees at their depth (the narrowest of their rectangles' nearest edges, at the
// height of the roofs): the side ones out towards the screen's sides, `side` of its half width in from them; the middle one (the
// campfire) in the middle, or as near it as leaves `between` to each neighbour; then, on a wide screen, the side ones in
// again until no gap is wider than GAP.most (the camp kept together; the row in front, whose middle is open ground, no
// further out than the board's sides and a little). Null if they do not fit
function spread(row, cam, side, between, board) {
  const ext = (p) => {
    const rects = p.kinds.map((n) => rectOf({ x: 0, z: p.z, f: p.f }, n));
    return { lo: Math.min(...rects.map((r) => r[0])), hi: Math.max(...rects.map((r) => r[1])), near: Math.max(...rects.map((r) => r[3])) };
  };
  if (!row.length) return {};
  const X = Math.min(...row.map((p) => cam.half(TALL, ext(p).near, 1 - side)));
  const left = row.find((p) => p.at < 0), mid = row.find((p) => p.at === 0), right = row.find((p) => p.at > 0), xs = {};
  const L = left && ext(left), M = mid && ext(mid), R = right && ext(right);
  if (left) xs[left.color] = -X - L.lo;
  if (right) xs[right.color] = X - R.hi;
  if (mid) {
    const lo = (left ? xs[left.color] + L.hi + between : -X) - M.lo, hi = (right ? xs[right.color] + R.lo - between : X) - M.hi;
    if (lo > hi + 1e-9) return null;
    const x = (xs[mid.color] = Math.min(Math.max(0, lo), hi));
    if (left) xs[left.color] = Math.max(xs[left.color], x + M.lo - GAP.most - L.hi);
    if (right) xs[right.color] = Math.min(xs[right.color], x + M.hi + GAP.most - R.lo);
  } else {
    if (left && right && xs[right.color] + R.lo - (xs[left.color] + L.hi) < between - 1e-9) return null;
    if (left) xs[left.color] = Math.max(xs[left.color], -board.w / 2 - GAP.out - L.hi);
    if (right) xs[right.color] = Math.min(xs[right.color], board.w / 2 + GAP.out - R.lo);
  }
  return xs;
}

// the rows for a board, its parts and a screen, before any gate leaf: the breathing room tried from all of it down, each with
// the nearest camera that fits the board's width and everything built; the first that needs the camera no further out than
// the board's width does, or else the one that comes nearest
const rowsKept = new Map();
function bestRows(board, places, screen, view, beds, cap) {
  const ring = view.ring, wide = view.wide, doors = [], tries = [];
  let best = null;
  for (const k of BREATH) {
    const row = places.map((color) => {
      const [side, at, , lean = 0] = ROW[color];
      return { color, side, at, lean, kinds: kindsAt(color, { beds }), f: { x: 0, z: -side }, z: rowZ(color, board, k, 0, doors, beds) };
    });
    // (the camp's depth reaches the gates' ground at least, where the crates land and the workers wait: a level with no row in
    // front keeps its near gates' workers above the bottom bar)
    let back = -board.h / 2 - GAP.start, front = board.h / 2 + GAP.start;
    for (const p of row) for (const n of p.kinds) {
      const r = rectOf({ x: 0, z: p.z, f: p.f }, n);
      back = Math.min(back, r[2]);
      front = Math.max(front, r[3]);
    }
    const tryAt = (d, loose = false) => {
      const cam = centred(screen, d, back, front, view);
      if (!loose && (cam.project(0, 1.2, back)[1] > cam.top || cam.project(0, GROUND, front)[1] < cam.bottom)) return null;
      // close up a row before the camera pulls back: the screen's sides first, then the gaps between
      for (const [side, between] of [[GAP.side, GAP.between], [GAP.sideMin, GAP.between], [GAP.sideMin, GAP.betweenMin]]) {
        const xs = {};
        let ok = true;
        for (const s of [-1, 1]) {
          const r = spread(row.filter((p) => p.side === s), cam, side, between, board);
          if (!r) ok = false;
          else Object.assign(xs, r);
        }
        if (ok) return { cam, xs };
      }
      return null;
    };
    // the board and its ring across the width: the nearest the camera comes (its corners nearest the camera, half a metre up,
    // are the widest on the screen)
    const ringDist = (b) => {
      const fits = (d) => Math.abs(centred(screen, d, back, front, view).project(b.w / 2 + ring, 0.5, b.h / 2 + ring)[0]) <= wide;
      let lo = 2, hi = 120;
      for (let n = 0; n < 30; n++) (fits((lo + hi) / 2) ? (hi = (lo + hi) / 2) : (lo = (lo + hi) / 2));
      return hi;
    };
    const dRing = ringDist(board), dCap = cap ? Math.max(dRing, ringDist(cap), cellDist(screen, back, front, view, dRing)) : Infinity;
    let got = tryAt(dRing);
    if (!got) {
      // further out until it fits (everything only fits better further out)
      let a = dRing, b = dRing;
      while (!tryAt(b) && b < 120) (a = b), (b = b * 1.25 + 0.5);
      for (let n = 0; n < 24; n++) (tryAt((a + b) / 2) ? (b = (a + b) / 2) : (a = (a + b) / 2));
      got = tryAt(b);
    }
    tries.push({ k, row, dRing, dCap, tryAt });
    if (!got) continue;
    const found = { k, row, dRing, d: got.cam.d, cam: got.cam, xs: got.xs, pulled: got.cam.d > dRing + 0.06 };
    if (!found.pulled) {
      best = found;
      break;
    }
    // (pulled back even so: keep the try that comes nearest)
    if (!best || found.d < best.d - 0.06) best = found;
  }
  // never further out than the largest board's framing (what every level had before 2026-11-18), or than keeps the cells
  // CELL_MIN if that is further, once every breathing room has been tried: on a short phone the rows then tuck under the
  // bars, as they did, rather than the board shrinking (the first sheet: 360x640's 7x7 went from 34 to 28 px a cell); a
  // tablet's big cells leave room to pull back until everything fits. Across the width everything still fits
  const t = best && best.pulled && tries.find((x) => x.k === best.k);
  if (t && best.d > t.dCap + 0.06) {
    const near = t.tryAt(t.dCap, true);
    if (near) best = { ...best, d: near.cam.d, cam: near.cam, xs: near.xs, capped: true };
  }
  return best;
}

// The places upright for this level, worked out from the screen: board { w, h } (the level's own), colors (the camp's parts so
// far), screen { w, h } (CSS px), doors (the level's gate leaves, open and shut: [[x0, z0, x1, z1]]), beds (whether the beds'
// ground behind the campfire is kept: kindsAt). Returns the sites
// ({ colour: { x, z, f, lean } }), the camera that frames them (d, lz) and how it got there: breath (the share of the breathing
// room kept), pulled (the camera further out than the board's width needs, for the camp to fit)
export function uprightLayout(board, colors, screen, { doors = [], view = VIEW, beds = true, cap = null } = {}) {
  const places = [...new Set(colors.map(placeOf))].filter((c) => ROW[c]);
  // (the same board, parts and screen give the same rows: kept, as main.js asks for every level's when the forest is planted;
  // only the gate leaves differ from level to level)
  const key = `${board.w}x${board.h}|${screen.w}x${screen.h}|${places.join(',')}|${beds}|${view.elev},${view.fov},${view.top},${view.bottom},${view.ring},${view.wide}|${cap ? cap.w + 'x' + cap.h : ''}`;
  if (!rowsKept.has(key)) {
    if (rowsKept.size > 400) rowsKept.clear();
    rowsKept.set(key, bestRows(board, places, screen, view, beds, cap));
  }
  const best = rowsKept.get(key);
  // (nothing fits a screen this small, whatever the breathing room: none, main.js keeps the old fixed places)
  if (!best) return null;

  // the gate leaves are at fixed x: once the places' x are known, one standing behind a leaf goes further out
  const at = {};
  let moved = false;
  for (const p of best.row) {
    const x = best.xs[p.color], z = doors.length ? rowZ(p.color, board, best.k, x, doors, beds) : p.z;
    moved ||= Math.abs(z - p.z) > 1e-9;
    at[p.color] = { x, z, f: p.f, lean: p.lean, ...(p.color === 'red' ? { beds } : {}) };
  }
  // each colour at its place (the yellow crew at the campfire's, with no lean of her own: camp.js works out where she stands)
  const sites = {};
  for (const c of colors) if (at[placeOf(c)]) sites[c] = c === 'yellow' ? { ...at.red, lean: 0 } : at[c];
  // (one that went further out: framed again, so it stays on the screen)
  const cam = moved ? uprightFrame(board, sites, screen, view, cap) : best.cam;
  return { sites, cam: { d: cam.d, lz: cam.lz }, breath: best.k, pulled: cam.d > best.dRing + 0.06, dRing: best.dRing, capped: !!(best.capped || cam.capped) };
}

// the nearest camera for places already laid out (the screen changed shape within a level, the phone's bars came or went):
// the board and its ring across the width, the camp's depth centred between the bars, every rectangle on the ground the
// camera sees; further out until they are
export function uprightFrame(board, sites, screen, view = VIEW, cap = null) {
  const rects = Object.entries(sites).flatMap(([c, s]) => kindsAt(c, s).map((n) => rectOf(s, n)));
  let back = -board.h / 2 - GAP.start, front = board.h / 2 + GAP.start;
  for (const r of rects) (back = Math.min(back, r[2])), (front = Math.max(front, r[3]));
  const cornersOf = (b) => {
    const out = [];
    for (const x of [-b.w / 2 - view.ring, b.w / 2 + view.ring]) for (const z of [-b.h / 2 - view.ring, b.h / 2 + view.ring]) for (const y of [GROUND, 0.5]) out.push([x, y, z]);
    return out;
  };
  const corners = cornersOf(board);
  // all: everything between the bars too; wideOnly: across the width only (the rows may tuck under the bars)
  const fits = (d, all, wideOnly = false, pts = corners) => {
    const cam = centred(screen, d, back, front, view);
    if (!pts.every(([x, y, z]) => Math.abs(cam.project(x, y, z)[0]) <= view.wide)) return null;
    if (!all) return cam;
    if (!wideOnly && (cam.project(0, 1.2, back)[1] > cam.top + 1e-6 || cam.project(0, GROUND, front)[1] < cam.bottom - 1e-6)) return null;
    return rects.every(([x0, x1, , z1]) => Math.max(Math.abs(x0), Math.abs(x1)) <= cam.half(TALL, z1, 1 - GAP.sideMin) + 1e-6) ? cam : null;
  };
  const nearest = (pts) => {
    let lo = 2, hi = 120;
    for (let n = 0; n < 40; n++) (fits((lo + hi) / 2, false, false, pts) ? (hi = (lo + hi) / 2) : (lo = (lo + hi) / 2));
    return hi;
  };
  const hi = nearest(corners);
  let cam = fits(hi, true);
  if (!cam) {
    let a = hi, b = hi;
    while (!fits(b, true) && b < 120) (a = b), (b = b * 1.25 + 0.5);
    for (let n = 0; n < 30; n++) (fits((a + b) / 2, true) ? (b = (a + b) / 2) : (a = (a + b) / 2));
    cam = fits(b, true) || centred(screen, b, back, front, view);
    // (never further out than the largest board's framing, or keeping the cells CELL_MIN: bestRows)
    const dCap = cap ? Math.max(hi, nearest(cornersOf(cap)), cellDist(screen, back, front, view, hi)) : Infinity, near = cam.d > dCap + 0.06 && fits(dCap, true, true);
    if (near) cam = Object.assign(near, { capped: true });
  }
  return cam;
}

// ---- a wide screen, worked out from the screen (2026-11-18, Oleg: the landscape camp to fit the screen as the phone's does) ----
// Until now a wide screen had the fixed places above (wideLayout) round the largest board, and the camera framed the board
// (main.js frameFor: the board and its gates' mats as big as the screen allows, zoomed out by up to a third on a taller
// screen, or only as far as showed the whole camp); on CrazyGames' frame on a laptop (897x462) the camp behind the board ran
// off the top. Now each level's places come from the screen and its own board: a row behind the board and a column down
// each side, each place pushed out from the board just past the gates' ground (and some breathing room while the screen has
// it), the columns stacked down the ground the camera shows beside the board, centred on the board where they can be. A
// wide screen's spare room is at its sides, so the places move out from behind the board to the sides as the height runs
// short. Which part goes where (ARRANGE) is the first of these that fits on the screen, the board no smaller than before
// (the camera never further back from the board than its old framing, wideToday):
//  1. the ring as it was: the tent, the campfire with its beds and the workshop behind the board; the water left, the stores right;
//  2. the tent and the workshop down the sides, above the water and the stores; the campfire behind the middle;
//  3. the campfire down the left side too, between the tent and the water;
//  4. the campfire above the water on the left, the tent above the workshop and the stores on the right (the shortest frames).
// Each is tried with its breathing room from all of it down, and the camera from the nearest that frames the board out to its
// old framing; if none fits, the one that runs least under the top bar is kept at the old framing, its far places tucked under
// the bar as before, rather than the board made smaller. The same screen, level and camp always give the same places.

// the camera playing on a wide screen (main.js frameFor): its height of view; the bars main.js frames the board between (CSS
// px: room for the HUD's middle at the top, a little at the bottom; a short screen has the HUD on one line); the HUD's real
// heights, which every place keeps clear of (measured in slice.html, 2026-11-18: the level, moves and target down to 98 px
// and the corner buttons to 62; on one line, the buttons to 62; the hint button 59 up from the bottom); the height a place's
// far edge reaches (as upright, the roofs' height: VIEW and the tests); when the screen is short
// (and a phone on its side: shorter than CrazyGames' laptop frame, 462, the shortest wide screen before phones played on
// their side, 2026-11-18)
export const WIDE = { fov: 32, frame: { top: 95, short: 56, bottom: 40 }, hud: { top: 100, short: 64, bottom: 60 }, high: 1.2, short: 560, phone: 440 };
// the camera's look down while playing (main.js frameFor: steeper on the 7x7) and the bars, for a board on a screen
export function wideView(board, screen) {
  const short = screen.h <= WIDE.short;
  return { elev: 60 + (Math.max(board.w, board.h) >= 7 ? 5 : 0), fov: WIDE.fov, top: short ? WIDE.hud.short : WIDE.hud.top, bottom: WIDE.hud.bottom,
    frameTop: short ? WIDE.frame.short : WIDE.frame.top, frameBottom: WIDE.frame.bottom, short };
}
const OUT = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
// the box main.js frameFor fits the board by: its frame and its gates' mats (where the crates land, and a step out past them
// and to each side: board.js puts a colour's mat at its first gate); on a short screen the board and a little over a cell
// round it. [x0, x1, z0, z1]
function matsBox(L) {
  const xs = [-L.w / 2 - 0.45, L.w / 2 + 0.45], zs = [-L.h / 2 - 0.45, L.h / 2 + 0.45], seen = new Set();
  for (const g of L.gates || []) {
    if (seen.has(g.color)) continue;
    seen.add(g.color);
    const o = OUT[g.side], along = g.side === 'top' || g.side === 'bottom';
    const mid = along ? [-L.w / 2 + g.at + g.len / 2, g.side === 'top' ? -L.h / 2 : L.h / 2] : [g.side === 'left' ? -L.w / 2 : L.w / 2, -L.h / 2 + g.at + g.len / 2];
    for (const s of [0.9, -0.9]) xs.push(mid[0] + o[0] * 2.1 - o[1] * s), zs.push(mid[1] + o[1] * 2.1 + o[0] * s);
  }
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}
export const boardBox = (L, short) => (short ? [-L.w / 2 - 1.35, L.w / 2 + 1.35, -L.h / 2 - 1.35, L.h / 2 + 1.35] : matsBox(L));
// main.js frameFor's fit in plain numbers: the nearest distance, in quarter steps from 6 (to 80), at which a box on the
// ground up to `high` fits across 0.97 of the width and between the frame's bars, slid along the ground to the middle
// between them (main.js tries each step in turn; it fits further out once it fits, so halving the steps finds the same one)
function fitBox(screen, view, [x0, x1, z0, z1], high = 1.4) {
  const v = { ...view, top: view.frameTop, bottom: view.frameBottom }, mx = (x0 + x1) / 2, mid = (z0 + z1) / 2;
  const at = (d) => {
    const span = (z) => {
      const cam = uprightCamera(screen, d, z, v);
      let x = 0, y0 = Infinity, y1 = -Infinity;
      for (const X of [x0, x1]) for (const Z of [z0, z1]) for (const Y of [GROUND, high]) {
        const [px, py] = cam.project(X - mx, Y, Z);
        (x = Math.max(x, Math.abs(px))), (y0 = Math.min(y0, py)), (y1 = Math.max(y1, py));
      }
      return { x, y0, y1, cam };
    };
    let lo = mid - 12, hi = mid + 12, lz = mid;
    for (let k = 0; k < 18; k++) {
      lz = (lo + hi) / 2;
      const sp = span(lz);
      if ((sp.y0 + sp.y1) / 2 > (sp.cam.top + sp.cam.bottom) / 2) hi = lz;
      else lo = lz;
    }
    const sp = span(lz);
    return { d, lz, mx, ok: sp.x < 0.97 && sp.y1 < sp.cam.top && sp.y0 > sp.cam.bottom };
  };
  let a = -1, b = 295;   // (steps: 6 + b / 4 is 79.75, the last main.js tries)
  if (!at(6 + b / 4).ok) return { ...at(79.75), d: 80 };
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (at(6 + m / 4).ok) b = m;
    else a = m;
  }
  const { d, lz } = at(6 + b / 4);
  return { d, lz, mx };
}
// how far the camera is from the board's middle (a crate's height up, where BD3.screen measures a cell): the cells' size on
// the screen goes as one over it
export function boardDepth(view, d, lz) {
  const e = (view.elev * Math.PI) / 180;
  return d + Math.cos(e) * lz - 0.3 * Math.sin(e);
}
// The camera main.js gave a wide screen until 2026-11-18, for level L with the camp's parts so far (colors): the board and its
// mats as big as the screen allows, then out by up to a third on a taller screen (3% on a short one), or only as far as the
// whole camp at its old places (wideLayout round the largest board, `size`) fitted. { d, lz, depth }: the new places never
// put the camera further back from the board than this
export function wideToday(L, colors, screen, view = wideView(L, screen), size = { w: 7, h: 7 }) {
  const near = fitBox(screen, view, boardBox(L, view.short)), out = 1.03 + 0.32 * Math.min(1, Math.max(0, (screen.h - 480) / 220));
  const [x0, x1, z0, z1] = matsBox(L), xs = [x0, x1], zs = [z0, z1];
  for (const s of Object.values(wideLayout(colors, size))) {
    const r = [-s.f.z, s.f.x];
    for (const [a, b] of [[1.2, -0.9], [-1.2, -0.9], [0, 1.2]]) xs.push(s.x + r[0] * a + s.f.x * b), zs.push(s.z + r[1] * a + s.f.z * b);
  }
  const whole = fitBox(screen, view, [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  const cam = whole.d <= near.d * out ? whole : { d: near.d * out, lz: near.lz, mx: near.mx };
  return { ...cam, depth: boardDepth(view, cam.d, cam.lz) };
}
// A phone on its side (2026-11-18, Oleg: the "turn your phone upright" screen went, a phone held sideways plays) had no old
// framing in play, and the old framing of a small board left no room for the camp round it there (a 5x5 with the full camp
// on 844x390 tucked the row behind under the bar): where nothing fits at its own old framing, the camera may stand as far
// back as the largest board's old framing on that screen (the cells no smaller than the largest board's), the nearest that
// fits. The furthest depth (as boardDepth) that allows, or null on any other screen
export function phoneCap(colors, screen, size = { w: 7, h: 7 }) {
  if (screen.h > WIDE.phone) return null;
  const big = { w: size.w, h: size.h, gates: [] };
  return wideToday(big, colors, screen, wideView(big, screen), size).depth;
}

// the places on a wide screen, most wanted first: back, the row behind the board (left to right); left and right, the
// columns down the board's sides (from the back down)
export const ARRANGE = [
  { back: ['orange', 'red', 'green'], left: ['blue'], right: ['purple'] },
  { back: ['red'], left: ['orange', 'blue'], right: ['green', 'purple'] },
  { back: [], left: ['orange', 'red', 'blue'], right: ['green', 'purple'] },
  { back: [], left: ['red', 'blue'], right: ['orange', 'green', 'purple'] },
];
// the breathing room past the gates' ground, behind the board and beside it, tried from all of it down
const WROOM = { back: 1, side: 0.8 }, WBREATH = [1, 0.5, 0];
// a place's ground relative to its middle, facing f: [x0, x1, z0, z1] round all its kinds
function spanOf(color, f, beds) {
  const rs = kindsAt(color, { beds }).map((n) => rectOf({ x: 0, z: 0, f }, n));
  return [Math.min(...rs.map((r) => r[0])), Math.max(...rs.map((r) => r[1])), Math.min(...rs.map((r) => r[2])), Math.max(...rs.map((r) => r[3]))];
}
// does a place's ground clear the workers' path and every gate leaf
function clearAt(site, kinds, board, doors, leavesOnly = false) {
  return !kinds.some((n) => edge(site, site.f, PLAN[n]).some(([px, pz]) => (!leavesOnly && pathGap(px, pz, board.w, board.h) < PATH.clear)
    || doors.some(([x0, z0, x1, z1]) => segGap(px, pz, x0, z0, x1, z1) < GAP.door)));
}
// does a column's place clear every gate leaf (only those that come near its ground are looked at)
function leavesClear(site, p, doors) {
  const x0 = site.x + p.r[0] - 0.5, x1 = site.x + p.r[1] + 0.5, z0 = site.z + p.r[2] - 0.5, z1 = site.z + p.r[3] + 0.5;
  const near = doors.filter(([ax, az, bx, bz]) => Math.max(ax, bx) > x0 && Math.min(ax, bx) < x1 && Math.max(az, bz) > z0 && Math.min(az, bz) < z1);
  return !near.length || clearAt(site, p.kinds, { w: 0, h: 0 }, near, true);
}
// the parts of an arrangement that do not move with the camera: the row behind (its places pushed out past the gates' ground
// and the breathing room, then on until clear of the path and the gate leaves; the campfire in the middle, the tent and the
// workshop at the board's behind corners, or out past the campfire's ground with `between` to it) and the columns' order,
// each place's ground and the line their inner edges keep, past the side gates' ground and the breathing room
function wideParts(board, use, k, beds, doors) {
  const back = [], cols = [];
  const F = { x: 0, z: 1 }, fire = use.back.includes('red') ? spanOf('red', F, beds) : null;
  for (const color of use.back) {
    const r = spanOf(color, F, beds), kinds = kindsAt(color, { beds });
    let x = 0;
    if (color === 'orange') x = Math.min((fire ? fire[0] : 0) - GAP.between, -board.w / 2 + 0.5) - r[1];
    else if (color === 'green') x = Math.max((fire ? fire[1] : 0) + GAP.between, board.w / 2 - 0.5) - r[0];
    let t = GAP.start + WROOM.back * k;
    while (t < 9 && !clearAt({ x, z: -board.h / 2 - t - r[3], f: F }, kinds, board, doors)) t += 0.02;
    back.push({ color, x, z: -board.h / 2 - t - r[3], f: F, kinds, r: [x + r[0], x + r[1], -board.h / 2 - t - r[3] + r[2], -board.h / 2 - t] });
  }
  const X0 = board.w / 2 + GAP.start + WROOM.side * k;
  for (const [side, list] of [[-1, use.left], [1, use.right]]) {
    const f = { x: -side, z: 0 };
    cols.push({ side, items: list.map((color) => {
      const r = spanOf(color, f, beds);
      return { color, f, kinds: kindsAt(color, { beds }), r, x: side < 0 ? -X0 - r[1] : X0 - r[0] };
    }) });
  }
  return { back, cols, k };
}
// the looks (the camera's lz) at distance d that keep the board's box between the frame's bars and across 0.97 of the
// width (the near corners up at 1.4 are the widest); null if none
function boardRange(screen, view, box, d) {
  const e = (view.elev * Math.PI) / 180, s = Math.sin(e), c = Math.cos(e), tf = Math.tan((view.fov * Math.PI) / 360), aspect = screen.w / screen.h;
  const ft = 1 - (2 * view.frameTop) / screen.h, fb = -1 + (2 * view.frameBottom) / screen.h, [x0, x1, z0, z1] = box;
  const hi = z0 - zOnBar(s, c, tf, d, 1.4, ft), X = Math.max(-x0, x1);
  const lo = Math.max(z1 - zOnBar(s, c, tf, d, GROUND, fb), (X / (0.97 * tf * aspect) - d + s * 1.4 + c * z1) / c);
  return lo <= hi + 1e-9 ? [lo, hi] : null;
}
// how far (z - lz) a point at height y lies when it shows at the screen's height ys (the camera looking down at s = sin, c =
// cos of its angle from distance d, tf = tan of half its view): further back, higher up the screen
function zOnBar(s, c, tf, d, y, ys) {
  return (c * y - ys * tf * (d - s * y)) / (s - ys * tf * c);
}
// the camera at distance d: looking at the camp's depth (the board's box and the row behind; the columns follow the camera)
// centred between the HUD's bars, as far as the board's box stays between the frame's; null if the box does not fit (loose:
// centred even so)
function wideCam(screen, view, box, back, d, loose = false) {
  const range = boardRange(screen, view, box, d);
  if (!range && !loose) return null;
  // (as centred: the camp's far end up at 1.2 and its near end on the ground, halfway between the bars)
  const e = (view.elev * Math.PI) / 180, s = Math.sin(e), c = Math.cos(e), tf = Math.tan((view.fov * Math.PI) / 360);
  const at = (lz, y, z) => (c * y - s * (z - lz)) / ((d - (s * y + c * (z - lz))) * tf), want = -(view.top - view.bottom) / screen.h, far = Math.min(box[2], back);
  let lo = -40, hi = 40;
  for (let k = 0; k < 30; k++) {
    const lz = (lo + hi) / 2;
    if ((at(lz, 1.2, far) + at(lz, GROUND, box[3])) / 2 > want) hi = lz;
    else lo = lz;
  }
  const mid = (lo + hi) / 2;
  return uprightCamera(screen, d, range ? Math.min(Math.max(mid, range[0]), range[1]) : mid, view);
}
const backOf = (parts) => Math.min(Infinity, ...parts.back.map((p) => p.r[2]));
// The camera at distance d for an arrangement's parts, and where the columns' places go on it (each column stacked down
// the ground between the bars, centred on the board's middle where it can be, below any place of the row behind that
// reaches over it); null if anything is off the screen. margins: [from the screen's sides, a share of its half width;
// between places]. loose (the old framing, where nothing fits): 1, a column stacked up from the bottom bar and what does not
// fit under the top bar left there (how far: `over`), still across the width; 2, across the width too (the last resort)
function wideAt(parts, board, screen, view, box, d, [side, between], doors, loose = 0) {
  const cam = wideCam(screen, view, box, backOf(parts), d, loose > 0);
  if (!cam) return null;
  const lz = cam.lz;
  const e = (view.elev * Math.PI) / 180, s = Math.sin(e), c = Math.cos(e), tf = Math.tan((view.fov * Math.PI) / 360);
  // the ground between the bars: a far edge (up at the roofs' height) no further back than zTop, a near edge no nearer than zBot
  const zTop = lz + zOnBar(s, c, tf, d, WIDE.high, cam.top), zBot = lz + zOnBar(s, c, tf, d, GROUND, cam.bottom);
  const inside = ([x0, x1, , z1]) => loose > 1 || Math.max(Math.abs(x0), Math.abs(x1)) <= cam.half(TALL, z1, 1 - side) + 1e-9;
  let over = 0;
  for (const p of parts.back) {
    if (!inside(p.r) || p.r[3] > zBot + 1e-9) return null;
    over = Math.max(over, zTop - p.r[2]);
  }
  if (over > 1e-9 && !loose) return null;
  const sites = Object.fromEntries(parts.back.map((p) => [p.color, { x: p.x, z: p.z, f: p.f }]));
  for (const col of parts.cols) {
    if (!col.items.length) continue;
    // (below any place of the row behind that reaches out over the column)
    const xa = Math.min(...col.items.map((p) => p.x + p.r[0])), xb = Math.max(...col.items.map((p) => p.x + p.r[1]));
    let lo = zTop;
    for (const p of parts.back) if (p.r[0] < xb && p.r[1] > xa) lo = Math.max(lo, p.r[3] + between);
    const depth = col.items.reduce((t, p) => t + p.r[3] - p.r[2], 0) + between * (col.items.length - 1);
    if (depth > zBot - lo + 1e-9 && !loose) return null;
    let z = loose && depth > zBot - lo ? zBot - depth : Math.min(Math.max(-depth / 2, lo), zBot - depth);
    over = Math.max(over, lo - z);
    for (const p of col.items) {
      const site = { x: p.x, z: z - p.r[2], f: p.f };
      // (out past a gate leaf folded open beyond the board's corner: the path and the gates' ground never reach a column)
      for (let t = 0; t < 3 && !leavesClear(site, p, doors); t += 0.02) site.x += col.side * 0.02;
      const dx = site.x - p.x;
      if (!inside([p.x + p.r[0] + dx, p.x + p.r[1] + dx, 0, z + p.r[3] - p.r[2]])) return null;
      sites[p.color] = site;
      z += p.r[3] - p.r[2] + between;
    }
  }
  return { cam, sites, over: Math.max(0, over) };
}
// the nearest distance at which a test holds (it holds further out once it holds), from lo, or null by 120
function nearestD(lo, ok) {
  let a = lo, b = lo;
  if (ok(b)) return b;
  while (!ok(b)) {
    if (b > 120) return null;
    (a = b), (b = b * 1.25 + 0.5);
  }
  for (let n = 0; n < 26; n++) (ok((a + b) / 2) ? (b = (a + b) / 2) : (a = (a + b) / 2));
  return b;
}
// the distance at which the board's depth from the camera, with the look wideCam takes, reaches `depth`
function dForDepth(screen, view, box, back, depth) {
  let a = 2, b = depth + 20;
  for (let n = 0; n < 40; n++) {
    const m = (a + b) / 2;
    if (boardDepth(view, m, wideCam(screen, view, box, back, m, true).lz) > depth) b = m;
    else a = m;
  }
  return a;
}

// The places on a wide screen for this level, worked out from the screen: board { w, h, gates } (the level's own: its mats are
// in the board's framing), colors (the camp's parts so far), screen { w, h } (CSS px), doors (the level's gate leaves, open and
// shut), beds (whether the beds' ground behind the campfire is kept: kindsAt), today (the old framing's camera: wideToday).
// Returns the sites ({ colour: { x, z, f, lean } }), the camera that frames them (d, lz) and how it got there: arrange (its
// index in ARRANGE), breath (the share of the breathing room kept), capped (nothing fitted: at the old framing, tucked)
export function wideFit(board, colors, screen, { doors = [], view = wideView(board, screen), beds = true, today = null, size = { w: 7, h: 7 } } = {}) {
  const places = [...new Set(colors.map(placeOf))].filter((c) => KIND[c]);
  let cap = (today || wideToday(board, colors, screen, view, size)).depth;
  const box = boardBox(board, view.short);
  const dBoard = nearestD(2, (d) => !!boardRange(screen, view, box, d)) || 20;
  const seen = new Set(), tries = [], capAt = new Map(), arranged = [];
  for (const [n, a] of ARRANGE.entries()) {
    const use = { back: a.back.filter((c) => places.includes(c)), left: a.left.filter((c) => places.includes(c)), right: a.right.filter((c) => places.includes(c)) };
    const key = JSON.stringify(use);
    if (seen.has(key)) continue;
    seen.add(key);
    arranged.push([n, use]);
    tries.push({ n, parts: wideParts(board, use, 0, beds, doors) });
  }
  // the first arrangement that fits with the camera no further back than `depth` (nearest: of all that fit, the one nearest
  // the board)
  const search = (depth, nearest = false) => {
    let best = null;
    for (const [n, use] of arranged) {
      for (const k of WBREATH) {
        const parts = wideParts(board, use, k, beds, doors);
        // (it fits nearer only if it fits at the old framing: the nearest, between the board's own framing and that)
        const back = backOf(parts), key = `${back}|${depth}`, dCap = capAt.get(key) ?? capAt.set(key, dForDepth(screen, view, box, back, depth)).get(key);
        for (const m of [[GAP.side, GAP.between], [GAP.sideMin, GAP.betweenMin]]) {
          const ok = (x) => !!wideAt(parts, board, screen, view, box, x, m, doors);
          if (!ok(dCap)) continue;
          let a = Math.min(dBoard, dCap), b = dCap;
          if (ok(a)) b = a;
          else for (let r = 0; r < 22; r++) (ok((a + b) / 2) ? (b = (a + b) / 2) : (a = (a + b) / 2));
          const got = { ...wideAt(parts, board, screen, view, box, b, m, doors), arrange: n, breath: k };
          if (!nearest) return got;
          if (!best || boardDepth(view, got.cam.d, got.cam.lz) < boardDepth(view, best.cam.d, best.cam.lz) - 1e-6) best = got;
          break;
        }
      }
    }
    return best;
  };
  let best = search(cap);
  // (a phone on its side where nothing fits: back as far as the largest board's old framing, phoneCap)
  const phone = best ? null : phoneCap(colors, screen, size);
  if (phone > cap + 1e-9) {
    const got = search(phone, true);
    if (got) (best = got), (cap = phone);
  }
  // nothing fits with the board as big as before: at the old framing's depth, the arrangement whose places run least under
  // the top bar (still across the width; the first, if none is)
  for (const loose of [1, 2]) for (const { n, parts } of best ? [] : tries) {
    const d = dForDepth(screen, view, box, backOf(parts), cap);
    const got = wideAt(parts, board, screen, view, box, d, [GAP.sideMin, GAP.betweenMin], doors, loose);
    if (got && (!best || got.over < best.over - 1e-6)) best = { ...got, arrange: n, breath: 0, capped: true };
  }
  // (no arrangement fits a screen this small even so: none, main.js keeps the old fixed places)
  if (!best) return null;
  const sites = {};
  for (const c of colors) {
    const s = best.sites[placeOf(c)];
    if (s) sites[c] = { ...s, lean: 0, ...(placeOf(c) === 'red' ? { beds } : {}) };
  }
  return { sites, cam: { d: best.cam.d, lz: best.cam.lz }, arrange: best.arrange, breath: best.breath, capped: !!best.capped, depth: boardDepth(view, best.cam.d, best.cam.lz), cap, dBoard };
}

// the nearest camera for places already laid out on a wide screen (the screen changed size within a level): the board's box
// between the frame's bars, every place's ground between the HUD's bars and across the width, no further back from the board
// than `cap` (the old framing's depth on this screen: wideToday); there, if they do not fit, the far ones under the top bar
export function wideFrame(board, sites, screen, view, cap) {
  const box = boardBox(board, view.short), own = Object.entries(sites).filter(([c]) => !(c === 'yellow' && sites.red));
  const rects = own.flatMap(([c, s]) => kindsAt(c, s).map((n) => rectOf(s, n)));
  // (the row behind faces the board's back: its far edge is the camp's depth, as wideFit takes it)
  const back = Math.min(Infinity, ...own.filter(([, s]) => s.f.z > 0.5).flatMap(([c, s]) => kindsAt(c, s).map((n) => rectOf(s, n)[2])));
  const at = (d, loose = false) => {
    const cam = wideCam(screen, view, box, back, d, loose);
    if (!cam || loose) return cam;
    const ok = rects.every(([x0, x1, z0, z1]) => Math.max(Math.abs(x0), Math.abs(x1)) <= cam.half(TALL, z1, 1 - GAP.sideMin) + 1e-6
      && cam.project(0, WIDE.high, z0)[1] <= cam.top + 1e-6 && cam.project(0, GROUND, z1)[1] >= cam.bottom - 1e-6);
    return ok ? cam : null;
  };
  const dBoard = nearestD(2, (d) => !!boardRange(screen, view, box, d)) || 20, d = nearestD(dBoard, (x) => !!at(x));
  const cam = d != null && at(d);
  if (cam && boardDepth(view, cam.d, cam.lz) <= cap + 1e-9) return cam;
  return Object.assign(at(dForDepth(screen, view, box, back, cap), true), { capped: true });
}

// a level's bedtime gate leaves (board.js draws them), open and shut, as lines on the ground [x0, z0, x1, z1]: one folded open
// along the frame can reach past the board's corner, under a place of the row beyond it
export function doorLines(L) {
  const ox = -L.w / 2, oz = -L.h / 2, out = [], OFF = 0.37;
  for (const g of L.gates) {
    if (g.closeAt == null && g.openAt == null) continue;
    const o = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[g.side], along = g.side === 'top' || g.side === 'bottom';
    const mid = along ? [ox + g.at + g.len / 2, g.side === 'top' ? oz : oz + L.h] : [g.side === 'left' ? ox : ox + L.w, oz + g.at + g.len / 2];
    const { high, at, len } = gateLeaf(L, g);
    const hinge = along ? [ox + at + o[0] * OFF, mid[1] + o[1] * OFF] : [mid[0] + o[0] * OFF, oz + at + o[1] * OFF];
    const outward = { top: Math.PI / 2, bottom: -Math.PI / 2, left: -Math.PI, right: 0 }[g.side];
    const shut = (along ? 0 : -Math.PI / 2) + (high ? Math.PI : 0), open = shut + 2 * Math.atan2(Math.sin(outward - shut), Math.cos(outward - shut));
    for (const a of [open, shut]) out.push([hinge[0], hinge[1], hinge[0] + Math.cos(a) * len, hinge[1] - Math.sin(a) * len]);
  }
  return out;
}

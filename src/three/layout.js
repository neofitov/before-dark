// Where the camp's places go round the board (camp.js builds them; main.js frames the camera on them). Plain numbers, no
// three.js, so node's tests can check it (test/layout.test.mjs).
//
// A wide screen: a fixed place round the board for each part, the same in every level, out along its direction from the
// game's largest board until all it builds clears the workers' path (SLOT).
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

// ---- a wide screen: [angle round the board] for the largest board (unchanged since 2026-10-24) ----
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
    const dRing = ringDist(board), dCap = cap ? Math.max(dRing, ringDist(cap)) : Infinity;
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
  // never further out than the largest board's framing (what every level had before 2026-11-18), once every breathing room
  // has been tried: on a short phone the rows then tuck under the bars, as they did, rather than the board shrinking (the
  // first sheet: 360x640's 7x7 went from 34 to 28 px a cell). Across the width everything still fits
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
    // (never further out than the largest board's framing: bestRows)
    const dCap = cap ? Math.max(hi, nearest(cornersOf(cap))) : Infinity, near = cam.d > dCap + 0.06 && fits(dCap, true, true);
    if (near) cam = Object.assign(near, { capped: true });
  }
  return cam;
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

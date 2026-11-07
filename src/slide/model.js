// Prototype A, "Crates to camp" (slide-to-exit, in the style of Color Block Jam). Supply crates of a colour sit on a grid with
// rocks and trees. Each colour has a gate on the board's edge: its camp spot (the fire, the tent, the water barrel...). A crate
// is dragged along free cells (any path; one drag is one move) and leaves through a gate of its colour that is at least as
// wide as the crate's side facing it. Crates never turn.
//
// A level: { w, h, walls: [[x, y]], gates: [{ side, at, len, color }], blocks: [{ x, y, w, h, color }] }, x to the right and y
// down. A gate on 'top' spans cells at..at+len-1 of the top edge; 'left' and 'right' gates span rows. Positions: one [x, y] per
// block, null once it has left.
//
// More for the 3D game's later levels (2026-10-28, a new thing every few levels): a crate may be `axis: 'x'` or 'y', heavy on
// runners, sliding only that way (and leaving only through a gate at an end of that line); a crate may be padlocked,
// `lock: k`, staying put while crate k (the one with its key) is still on the board; a gate may open late, `openAt`, its
// crew back from the forest after that move. Long loads (four cells) and a pond in a corner (cells in `walls`, listed again
// in `pond` for the look) need no rule of their own.

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// cells taken by rocks (1), crates (2) and the dark (3, a mask from dark.js), leaving out crate `skip`
export function occupancy(level, pos, skip = -1, dark = null) {
  const occ = new Uint8Array(level.w * level.h);
  if (dark) for (let k = 0; k < occ.length; k++) if (dark[k]) occ[k] = 3;
  for (const [x, y] of level.walls) occ[y * level.w + x] = 1;
  level.blocks.forEach((b, i) => {
    const p = pos[i];
    if (!p || i === skip) return;
    for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) occ[(p[1] + j) * level.w + p[0] + k] = 2;
  });
  return occ;
}

export function fits(level, occ, b, x, y) {
  if (x < 0 || y < 0 || x + b.w > level.w || y + b.h > level.h) return false;
  for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) if (occ[(y + j) * level.w + x + k]) return false;
  return true;
}

const key = (x, y) => y * 64 + x;

// every top-left position crate i can be dragged to (breadth-first from where it is, so cells[0] is its own spot) and the step
// before each (for the path a drag follows); dark cells (a mask) block it like rocks
export function reach(level, pos, i, from = pos[i], dark = null) {
  const b = level.blocks[i], occ = occupancy(level, pos, i, dark);
  const prev = new Map([[key(from[0], from[1]), -1]]);
  const cells = [from];
  if (locked(level, pos, i)) return { cells, prev, has: (x, y) => prev.has(key(x, y)) };
  for (let q = 0; q < cells.length; q++) {
    const [x, y] = cells[q];
    for (const [dx, dy] of DIRS) {
      if ((b.axis === 'x' && dy) || (b.axis === 'y' && dx)) continue;   // on runners: one way only
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || !fits(level, occ, b, nx, ny)) continue;
      prev.set(k, key(x, y));
      cells.push([nx, ny]);
    }
  }
  return { cells, prev, has: (x, y) => prev.has(key(x, y)) };
}

// the cells a drag passes through, start to end
export function pathTo(r, x, y) {
  const out = [];
  for (let k = key(x, y); k !== -1 && k !== undefined; k = r.prev.get(k)) out.push([k % 64, Math.floor(k / 64)]);
  return out.reverse();
}

// a padlocked crate, its key's crate still on the board
export const locked = (level, pos, i) => level.blocks[i].lock != null && !!pos[level.blocks[i].lock];

// bedtime (Oleg's twist b, 2026-10-24): a gate may close for the night: its worker shuts it after move `closeAt` and goes to
// bed. A crew back late (2026-10-28): a gate may open only after move `openAt`. Otherwise it is open; and with no clock at
// all (moves null: the daylight solver) every gate is.
export const gateOpen = (g, moves = 0) => moves == null || ((g.openAt == null || moves >= g.openAt) && (g.closeAt == null || moves < g.closeAt));
// open now or later: not yet shut for the night
export const gateAlive = (g, moves = 0) => g.closeAt == null || moves < g.closeAt;

// the gate crate i leaves through from (x, y) with `moves` moves made (null: no clock), or null
export function exitGate(level, i, x, y, moves = null) {
  const b = level.blocks[i];
  for (const g of level.gates) {
    if (g.color !== b.color || !gateOpen(g, moves)) continue;
    if ((b.axis === 'x' && (g.side === 'top' || g.side === 'bottom')) || (b.axis === 'y' && (g.side === 'left' || g.side === 'right'))) continue;
    if (g.side === 'top' && y === 0 && x >= g.at && x + b.w <= g.at + g.len) return g;
    if (g.side === 'bottom' && y + b.h === level.h && x >= g.at && x + b.w <= g.at + g.len) return g;
    if (g.side === 'left' && x === 0 && y >= g.at && y + b.h <= g.at + g.len) return g;
    if (g.side === 'right' && x + b.w === level.w && y >= g.at && y + b.h <= g.at + g.len) return g;
  }
  return null;
}

// the first spot (nearest by drag) where crate i could leave, or null
export function exitSpot(level, pos, i, dark = null, moves = null) {
  if (!pos[i]) return null;
  for (const c of reach(level, pos, i, pos[i], dark).cells) if (exitGate(level, i, c[0], c[1], moves)) return c;
  return null;
}

// the crates still on the board whose colour has no gate open now or later (after bedtime they can never leave)
export function stranded(level, pos, moves) {
  return level.blocks.map((b, i) => (pos[i] && !level.gates.some((g) => g.color === b.color && gateAlive(g, moves)) ? i : -1)).filter((i) => i >= 0);
}

// the next gate to close after `moves` moves: { gate, at } (the soonest), or null
export function nextBedtime(level, moves) {
  let best = null;
  for (const g of level.gates) if (g.closeAt != null && g.closeAt > moves && (!best || g.closeAt < best.at)) best = { gate: g, at: g.closeAt };
  return best;
}

// the next late gate to open after `moves` moves: { gate, at }, or null
export function nextOpening(level, moves) {
  let best = null;
  for (const g of level.gates) if (g.openAt != null && g.openAt > moves && (!best || g.openAt < best.at)) best = { gate: g, at: g.openAt };
  return best;
}

export const startPos = (level) => level.blocks.map((b) => [b.x, b.y]);
export const left = (pos) => pos.reduce((n, p) => n + (p ? 1 : 0), 0);

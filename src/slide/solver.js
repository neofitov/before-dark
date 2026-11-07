// The fewest moves that clear a level. Every crate needs one move to leave; the extra moves are the ones that put a crate
// aside. A crate that can reach its gate may always leave at once in some best solution (leaving only frees cells), so the
// search lets every crate that can leave go, and branches only on putting a crate aside, breadth-first by the number of those.
import { reach, exitSpot, exitGate, startPos, stranded } from './model.js';
import { darkTimes, darkMask, lostCrates } from './dark.js';

const keyOf = (pos) => pos.map((p) => (p ? p[0] + ',' + p[1] : '-')).join(';');

// let every crate that can reach its gate leave; returns the new positions and those exit moves
export function settle(level, pos) {
  pos = pos.slice();
  const exits = [];
  for (let again = true; again; ) {
    again = false;
    for (let i = 0; i < pos.length; i++) {
      const at = exitSpot(level, pos, i);
      if (!at) continue;
      exits.push({ i, to: at, exit: true });
      pos[i] = null;
      again = true;
    }
  }
  return [pos, exits];
}

// { par, aside, moves: [{ i, to: [x, y], exit }] } or { par: null } when unsolvable within maxAside (or past maxStates)
export function solve(level, { maxAside = 4, maxStates = 120000 } = {}) {
  const [p0, e0] = settle(level, startPos(level));
  let layer = [{ pos: p0, moves: e0 }];
  const seen = new Set([keyOf(p0)]);
  let states = 1;
  for (let aside = 0; aside <= maxAside; aside++) {
    for (const s of layer) if (s.pos.every((p) => !p)) return { par: level.blocks.length + aside, aside, moves: s.moves, states };
    if (aside === maxAside) break;
    const next = [];
    for (const s of layer) {
      for (let i = 0; i < s.pos.length; i++) {
        if (!s.pos[i]) continue;
        const r = reach(level, s.pos, i);
        for (let c = 1; c < r.cells.length; c++) {
          const moved = s.pos.slice();
          moved[i] = r.cells[c];
          const [settled, exits] = settle(level, moved);
          const k = keyOf(settled);
          if (seen.has(k)) continue;
          seen.add(k);
          if (++states > maxStates) return { par: null, aside: null, states, capped: true };
          next.push({ pos: settled, moves: s.moves.concat([{ i, to: r.cells[c], exit: false }], exits) });
        }
      }
    }
    if (!next.length) break;
    layer = next;
  }
  return { par: null, aside: null, states };
}

// With the dark (dark.js) or gates closing at bedtime (model.js) the order and the timing matter, so exits are not settled for
// free: every move is a step in time.
// Best-first by (moves made + crates left), a lower bound since each crate needs a move, so the search spends its effort on the
// moves put aside, as above, while trying every order. A crate that can leave only leaves (leaving frees cells and takes it
// out of the dark's way, never worse than another move of that crate), and a position met again later is dropped (later only
// means more dark). `from: { pos, moves }` starts from a level in play (the hint: the best way on from here); par is then the
// moves of the whole level, aside counts from there on; `until` (a performance.now() time) gives up then, as past maxStates;
// `onProgress(states)` now and then (the helper's card counts them: main.js).
// { par, aside, moves: [{ i, to, exit }], states } or { par: null } (capped: true when it gave up)
export function solveTimed(level, { maxAside = 4, maxStates = 800000, from = null, until = 0, onProgress = null } = {}) {
  const at = darkTimes(level), W = level.w, n = level.blocks.length;
  // lost: a crate caught by the dark, or left with its gate closed for the night
  const lost = (pos, moves) => stranded(level, pos, moves).length > 0 || level.blocks.some((b, i) => {
    const p = pos[i];
    if (!p) return false;
    for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) if (at[(p[1] + j) * W + p[0] + k] <= moves) return true;
    return false;
  });
  const start = from ? from.pos : startPos(level), g0 = from ? from.moves : 0, n0 = start.filter(Boolean).length, top = g0 + n0 + maxAside;
  if (lost(start, g0)) return { par: null, states: 0 };
  const buckets = [];
  buckets[g0 + n0] = [{ pos: start, g: g0, left: n0, prev: null, move: null }];
  const best = new Map([[keyOf(start), g0]]);
  let states = 1, looked = 0;
  for (let f = g0 + n0; f <= top; f++) {
    const bucket = buckets[f] || [];
    for (let q = 0; q < bucket.length; q++) {
      const s = bucket[q];
      if (best.get(keyOf(s.pos)) < s.g) continue;
      looked++;
      if (until && !(looked & 127) && performance.now() > until) return { par: null, states, capped: true };
      if (onProgress && !(looked & 1023)) onProgress(states);
      if (!s.left) {
        const moves = [];
        for (let x = s; x.prev; x = x.prev) moves.unshift(x.move);
        return { par: s.g, aside: s.g - g0 - n0, moves, states };
      }
      const mask = darkMask(level, s.g);
      for (let i = 0; i < n; i++) {
        if (!s.pos[i]) continue;
        const r = reach(level, s.pos, i, s.pos[i], mask);
        const out = r.cells.find((c) => exitGate(level, i, c[0], c[1], s.g));
        const options = out ? [[out, true]] : r.cells.slice(1).map((c) => [c, false]);
        for (const [c, exit] of options) {
          const moved = s.pos.slice();
          moved[i] = exit ? null : c;
          if (lost(moved, s.g + 1)) continue;
          const k = keyOf(moved), g = s.g + 1;
          if (best.has(k) && best.get(k) <= g) continue;
          best.set(k, g);
          if (++states > maxStates) return { par: null, states, capped: true };
          const left = s.left - (exit ? 1 : 0), nf = g + left;
          if (nf > top) continue;
          (buckets[nf] ||= []).push({ pos: moved, g, left, prev: s, move: { i, to: c, exit } });
        }
      }
    }
  }
  return { par: null, states };
}

// plays a list of moves by the rules, the dark and bedtime included: { ok, moves, lost: crate index or null, bad: move index or null }
export function replay(level, moves) {
  let pos = startPos(level);
  for (const [n, m] of moves.entries()) {
    const mask = darkMask(level, n);
    if (!pos[m.i] || !reach(level, pos, m.i, pos[m.i], mask).has(m.to[0], m.to[1])) return { ok: false, bad: n, lost: null };
    if (m.exit && !exitGate(level, m.i, m.to[0], m.to[1], n)) return { ok: false, bad: n, lost: null };
    pos = pos.slice();
    pos[m.i] = m.exit ? null : m.to;
    const gone = [...lostCrates(level, pos, n + 1), ...stranded(level, pos, n + 1)];
    if (gone.length) return { ok: false, bad: n, lost: gone[0] };
  }
  return { ok: pos.every((p) => !p), moves: moves.length, bad: null, lost: null };
}

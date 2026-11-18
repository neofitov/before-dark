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

// Can the level still be cleared from a position in play, within `limit` moves in all (the moves before dark)? Ember's dead-end
// check asks only that (main.js lookAhead, in a worker): no best way, no path back, so it keeps far less per position than
// solveTimed and proves dead ends that need many more positions (2026-11-18: two dead first moves on level 16, old level 7,
// took 159,000 and 166,000 of solveTimed's, past the check's cap). Depth-first by the level's rules and clock: a crate that
// can leave only leaves, the crews going to bed soonest first; a crew with more crates on the board than moves to its bedtime
// (counted with the crews before it) can't make it. Each position shown to fail is kept (one short string), with the moves it
// failed at: with no crew back late and no dark, gates only shut, so it fails later too. from: { pos, moves }; maxStates
// and until (a performance.now() time) give up. { ok: true | false | null (gave up), states }
export function canFinish(level, { from, limit, maxStates = 1000000, until = 0 }) {
  const n = level.blocks.length, W = level.w, at = darkTimes(level), dark = !!(level.dark && level.dark.length);
  const mono = !level.gates.some((g) => g.openAt != null) && !dark;
  const due = level.blocks.map((b) => Math.min(Infinity, ...level.gates.filter((g) => g.color === b.color && g.closeAt != null).map((g) => g.closeAt)));
  // after which move each crate can never leave (its colour's gates all shut for the night: model.js stranded), Infinity: never
  const shut = level.blocks.map((b) => (level.gates.some((g) => g.color === b.color && g.closeAt == null) ? Infinity : Math.max(-1, ...level.gates.filter((g) => g.color === b.color).map((g) => g.closeAt))));
  const beds = level.gates.filter((g) => g.closeAt != null && !level.gates.some((o) => o.color === g.color && o.closeAt == null)).sort((a, b) => a.closeAt - b.closeAt);
  const lost = (pos, moves) => {
    for (let i = 0; i < n; i++) {
      const p = pos[i];
      if (!p) continue;
      if (shut[i] <= moves) return true;
      if (!dark) continue;
      const b = level.blocks[i];
      for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) if (at[(p[1] + j) * W + p[0] + k] <= moves) return true;
    }
    return false;
  };
  // (each crew counted once, at its soonest bedtime still to come: a bit each)
  const crew = [...new Set(level.blocks.map((b) => b.color))], bit = (c) => 1 << crew.indexOf(c), colorBit = level.blocks.map((b) => bit(b.color)), bedBit = beds.map((g) => bit(g.color));
  const lateForBed = (pos, moves) => {
    let need = 0, counted = 0;
    for (let k = 0; k < beds.length; k++) {
      if (beds[k].closeAt <= moves) continue;
      if (!(counted & bedBit[k])) {
        counted |= bedBit[k];
        for (let i = 0; i < n; i++) if (pos[i] && colorBit[i] === bedBit[k]) need++;
      }
      if (need > beds[k].closeAt - moves) return true;
    }
    return false;
  };
  // a position as one number: each crate's cell (or gone) a digit in base w * h + 1, so a child's is its parent's with one
  // digit changed (a string where the number would pass 2^53)
  const base = W * level.h + 1, exact = Math.pow(base, n) < Number.MAX_SAFE_INTEGER, unit = level.blocks.map((_, i) => Math.pow(base, i));
  const digit = (p) => (p ? 1 + p[1] * W + p[0] : 0);
  const keyOf = (pos) => (exact ? pos.reduce((s, p, i) => s + digit(p) * unit[i], 0) : pos.map((p) => digit(p)).join(','));
  const failed = new Map();
  let states = 0;
  const GAVE_UP = {};
  const go = (pos, moves, left, pk) => {
    if (!left) return true;
    if (moves + left > limit) return false;
    const k = mono ? pk : pk + '|' + moves;
    const was = failed.get(k);
    if (was !== undefined && was <= moves) return false;
    if (lost(pos, moves) || lateForBed(pos, moves)) return false;
    if (++states > maxStates || (until && !(states & 255) && performance.now() > until)) throw GAVE_UP;
    const mask = darkMask(level, moves), exits = [], asides = [];
    for (let i = 0; i < n; i++) {
      if (!pos[i]) continue;
      const r = reach(level, pos, i, pos[i], mask);
      const out = r.cells.find((c) => exitGate(level, i, c[0], c[1], moves));
      if (out) exits.push(i);
      else if (moves + left < limit) for (let c = 1; c < r.cells.length; c++) asides.push(i, c, r.cells[c]);
    }
    exits.sort((a, b) => due[a] - due[b]);
    const child = (i, to) => (exact ? pk + (digit(to) - digit(pos[i])) * unit[i] : null);
    for (const i of exits) {
      const p = pos.slice();
      p[i] = null;
      if (go(p, moves + 1, left - 1, exact ? child(i, null) : keyOf(p))) return true;
    }
    for (let a = 0; a < asides.length; a += 3) {
      const i = asides[a], c = asides[a + 2], p = pos.slice();
      p[i] = c;
      if (go(p, moves + 1, left, exact ? child(i, c) : keyOf(p))) return true;
    }
    failed.set(k, mono ? moves : 0);   // (not there, or there from more moves: it was looked up above)
    return false;
  };
  try {
    return { ok: go(from.pos, from.moves, from.pos.filter(Boolean).length, keyOf(from.pos)), states };
  } catch (e) {
    if (e === GAVE_UP) return { ok: null, states };
    throw e;
  }
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

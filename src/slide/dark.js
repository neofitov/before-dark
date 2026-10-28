// The dark creeping in (Oleg's twist b, 2026-10-23): night comes in from the forest. A level may list fronts, each
// { side, start, every, depth }: the board's edge line on that side (a column for left/right, a row for top/bottom) goes dark
// after move `start`, the next line in `every` moves later, `depth` lines in all. A dark cell takes no crate (it blocks a
// drag like a rock) and a crate standing on a cell when it goes dark is lost: the camp is not ready, the level is lost.

// the move after which each cell goes dark (Infinity: never), by cell index y * w + x
export function darkTimes(level) {
  const at = new Float64Array(level.w * level.h).fill(Infinity);
  for (const f of level.dark || []) {
    for (let k = 0; k < f.depth; k++) {
      const when = f.start + k * f.every;
      const line = f.side === 'left' ? k : f.side === 'right' ? level.w - 1 - k : f.side === 'top' ? k : level.h - 1 - k;
      const across = f.side === 'left' || f.side === 'right';
      for (let j = 0; j < (across ? level.h : level.w); j++) {
        const idx = across ? j * level.w + line : line * level.w + j;
        at[idx] = Math.min(at[idx], when);
      }
    }
  }
  return at;
}

// the dark cells once `moves` moves are made (1 = dark), or null when the level has no dark
export function darkMask(level, moves) {
  if (!level.dark || !level.dark.length) return null;
  const at = darkTimes(level), mask = new Uint8Array(at.length);
  for (let k = 0; k < at.length; k++) mask[k] = at[k] <= moves ? 1 : 0;
  return mask;
}

// the crates standing on a dark cell once `moves` moves are made
export function lostCrates(level, pos, moves) {
  const mask = darkMask(level, moves);
  if (!mask) return [];
  const out = [];
  level.blocks.forEach((b, i) => {
    const p = pos[i];
    if (!p) return;
    for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) if (mask[(p[1] + j) * level.w + p[0] + k]) return void out.push(i);
  });
  return out;
}

// the next cells to go dark after `moves` moves: { after: the move count it happens at, cells: [[x, y]] }, or null
export function nextDark(level, moves) {
  const at = darkTimes(level);
  let when = Infinity;
  for (const v of at) if (v > moves && v < when) when = v;
  if (when === Infinity) return null;
  const cells = [];
  for (let k = 0; k < at.length; k++) if (at[k] === when) cells.push([k % level.w, Math.floor(k / level.w)]);
  return { after: when, cells };
}

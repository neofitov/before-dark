// the hint's search, off the page's thread: the best way on from a level in play (solver.js), which on a big board takes
// seconds; the game plays on meanwhile (main.js hint). It tells the page how many positions it has looked at as it goes
// (Ember's card counts them) and, at the end, the first move, the moves of the whole level that way, and the count.
// look: the dead-end check's question instead (main.js lookAhead): can the level still be won from here, yes or no (solver.js
// canFinish, which keeps much less per position, so it can look further: 2026-11-18, two dead first moves on level 16 passed
// the old cap of 150,000 positions and Ember said nothing); the page ends it (terminate) when the player moves again
import { solveTimed, canFinish } from '../slide/solver.js';

// states: the most positions it keeps
self.onmessage = ({ data: { ask, level, pos, moves, aside, secs, states = 800000, look = false } }) => {
  const until = performance.now() + secs * 1000;
  if (look) {
    const r = aside < 0 ? { ok: false, states: 0 } : canFinish(level, { from: { pos, moves }, limit: moves + pos.filter(Boolean).length + aside, maxStates: states, until });
    return self.postMessage({ ask, look: true, ok: r.ok, states: r.states, capped: r.ok == null });
  }
  let last = 0;
  const onProgress = (states) => {
    const now = performance.now();
    if (now - last < 80) return;
    last = now;
    self.postMessage({ ask, progress: states });
  };
  const r = aside < 0 ? { par: null, states: 0 } : solveTimed(level, { maxAside: aside, maxStates: states, from: { pos, moves }, until, onProgress });
  self.postMessage({ ask, move: r.moves?.[0] ?? null, par: r.par, states: r.states ?? 0, capped: !!r.capped });
};

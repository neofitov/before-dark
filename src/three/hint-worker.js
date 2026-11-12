// the hint's search, off the page's thread: the best way on from a level in play (solver.js), which on a big board takes
// seconds; the game plays on meanwhile (main.js hint). It tells the page how many positions it has looked at as it goes
// (Ember's card counts them) and, at the end, the first move, the moves of the whole level that way, and the count
import { solveTimed } from '../slide/solver.js';

// states: the most positions it keeps (the dead-end check passes a smaller cap than the hint: main.js lookAhead)
self.onmessage = ({ data: { ask, level, pos, moves, aside, secs, states = 800000 } }) => {
  let last = 0;
  const onProgress = (states) => {
    const now = performance.now();
    if (now - last < 80) return;
    last = now;
    self.postMessage({ ask, progress: states });
  };
  const r = aside < 0 ? { par: null, states: 0 } : solveTimed(level, { maxAside: aside, maxStates: states, from: { pos, moves }, until: performance.now() + secs * 1000, onProgress });
  self.postMessage({ ask, move: r.moves?.[0] ?? null, par: r.par, states: r.states ?? 0, capped: !!r.capped });
};

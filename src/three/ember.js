// Ember, the camp's helper (2026-11-07, Oleg on the hints: "its good AI vibe i want to enhance the AI look and feel"): a card
// over the bottom of the screen with a glowing orb that pulses while it thinks. Thinking, it counts the positions the solver
// has looked at (its own count, main.js hint); answering, its words are typed out: the move, then what it leaves, then why.
// `instant` (?playtest): no typing, the words at once.
export function makeEmber(el, instant = false) {
  const state = el.querySelector('.state'), say = el.querySelector('.say'), facts = el.querySelector('.facts'), why = el.querySelector('.why');
  let timer = 0;
  // the lines typed one after another, a letter at a time
  function type(lines) {
    clearInterval(timer);
    for (const [node] of lines) node.textContent = '';
    if (instant) {
      for (const [node, text] of lines) node.textContent = text;
      return;
    }
    let k = 0, c = 0;
    timer = setInterval(() => {
      while (k < lines.length && c >= lines[k][1].length) (k++, (c = 0));
      if (k >= lines.length) return clearInterval(timer);
      const [node, text, step = 2] = lines[k];
      c = Math.min(text.length, c + step);
      node.textContent = text.slice(0, c);
    }, 18);
  }
  return {
    think() {
      clearInterval(timer);
      el.classList.add('on', 'thinking');
      state.textContent = 'thinking';
      say.textContent = 'Looking for the best move…';
      facts.textContent = '';
      why.textContent = '';
    },
    progress(n) {
      if (el.classList.contains('thinking')) facts.textContent = `Analysing ${n.toLocaleString('en')} positions`;
    },
    // { say, facts, why, state }
    answer(a) {
      el.classList.add('on');
      el.classList.remove('thinking');
      state.textContent = a.state || 'found a move';
      type([[say, a.say, 2], [facts, a.facts || '', 3], [why, a.why || '', 3]]);
    },
    close() {
      clearInterval(timer);
      el.classList.remove('on', 'thinking');
    },
    open: () => el.classList.contains('on'),
  };
}

// Ember speaking up unasked (Oleg, 2026-11-07: "there are still some messages that are not going thru ember - the heavy
// crate moves only 1 direction ... think of a smart way to show those proactive messages - maybe ember button blinks"): a
// bubble over Ember's button, its orb glowing, the words typed out, and the button pulsing a few times as a new line comes.
// Every word the game says during play comes this way: why a drag was refused, level 1's lessons, "Show me"'s progress.
export function makeBubble(el, btn, instant = false) {
  const text = el.querySelector('.text');
  let shown = '', timer = 0;
  return {
    set(line) {
      if (line === shown) return;
      shown = line;
      clearInterval(timer);
      el.classList.toggle('on', !!line);
      if (!line) return;   // (the words stay while the bubble fades)
      btn.classList.remove('speak');
      void btn.offsetWidth;   // (restarts the pulse)
      btn.classList.add('speak');
      if (instant) return void (text.textContent = line);
      let c = 0;
      text.textContent = '';
      timer = setInterval(() => {
        c = Math.min(line.length, c + 3);
        text.textContent = line.slice(0, c);
        if (c >= line.length) clearInterval(timer);
      }, 18);
    },
  };
}

// The camp's music, made in code (Oleg, 2026-10-24: "add music"): a fingerpicked guitar by the fire in a lilting 6/8, a
// warm pad under it and now and then a whistled tune over it, in D major. The guitar is plucked strings (Karplus-Strong:
// a burst of noise round a short loop that loses its brightness as it rings), rendered once per note. As the evening
// comes the playing slows a little, thins out and darkens; at night the whistling stops and only a few strings ring.
// Works on any audio context (an OfflineAudioContext renders it to a file: tools/music-preview.html).

// the progression, one chord per bar; each chord: bass, then the strings picked above it (MIDI notes)
const CHORDS = {
  D: [38, 45, 50, 54, 57, 62], A: [45, 52, 57, 61, 64, 69], Bm: [47, 54, 59, 62, 66, 71], G: [43, 50, 55, 59, 62, 67],
  Em: [40, 47, 52, 55, 59, 64], 'F#m': [42, 49, 54, 57, 61, 66],
};
const SONG = ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D', 'G', 'D', 'Em', 'A', 'G', 'D', 'Em', 'A', 'D', 'A', 'Bm', 'G', 'Em', 'F#m', 'G', 'D'];
// the picking in each bar (six eighths): which string of the chord (0 is the bass)
const PICK = [[0, 2, 3, 4, 3, 2], [0, 2, 3, 5, 3, 2], [0, 3, 2, 4, 2, 3], [0, 2, 4, 3, 5, 3]];
// the whistled tune's notes: D major pentatonic, an octave and a bit up
const TUNE = [74, 76, 78, 81, 83, 86, 88];

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

export function makeMusic(ctx, dest) {
  const sr = ctx.sampleRate;
  // the bus: a gentle lowpass the evening closes, a room, the level
  const bus = ctx.createGain(), tone = ctx.createBiquadFilter(), dry = ctx.createGain(), wet = ctx.createGain(), room = ctx.createConvolver();
  tone.type = 'lowpass';
  tone.frequency.value = 9000;
  bus.gain.value = 1;
  bus.connect(tone);
  tone.connect(dry).connect(dest);
  tone.connect(room).connect(wet).connect(dest);
  dry.gain.value = 0.85;
  wet.gain.value = 0.32;
  room.buffer = impulse(ctx, 2.4);

  // ---- plucked strings ----
  const strings = {};
  function string(m) {
    if (strings[m]) return strings[m];
    const f = midiHz(m), n = Math.round(sr / f), len = Math.floor(sr * (m < 50 ? 3.2 : 2.4)), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    // the pluck: noise, softened (a thumb, not a pick), then the loop: each pass averages neighbours and loses a little
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = last * 0.55 + (Math.random() * 2 - 1) * 0.45;
      d[i] = last;
    }
    const keep = m < 50 ? 0.9985 : 0.9965;
    for (let i = n; i < len; i++) d[i] = keep * 0.5 * (d[i - n] + d[i - n - 1 < 0 ? 0 : i - n - 1]);
    // fade the tail to nothing
    for (let i = len - 2000; i < len; i++) d[i] *= (len - i) / 2000;
    return (strings[m] = b);
  }
  function pluck(m, at, vol) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.buffer = string(m);
    g.gain.value = vol;
    if (p) {
      p.pan.value = (m - 56) / 40;
      s.connect(g).connect(p).connect(bus);
    } else s.connect(g).connect(bus);
    s.start(at);
  }
  // ---- the pad: the chord's root, fifth and third, warm and slow ----
  function pad(chord, at, len, vol) {
    for (const [k, m] of [chord[0] + 12, chord[1], chord[3]].entries()) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(m);
        o.detune.value = det + k * 2;
        f.type = 'lowpass';
        f.frequency.value = 650;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(vol, at + len * 0.35);
        g.gain.linearRampToValueAtTime(vol * 0.8, at + len * 0.8);
        g.gain.linearRampToValueAtTime(0, at + len + 0.6);
        o.connect(f).connect(g).connect(bus);
        o.start(at);
        o.stop(at + len + 0.7);
      }
    }
  }
  // ---- the whistle: a soft sine with a little vibrato and breath ----
  function whistle(m, at, len, vol) {
    const o = ctx.createOscillator(), v = ctx.createOscillator(), vg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = midiHz(m);
    v.frequency.value = 5.2;
    vg.gain.value = midiHz(m) * 0.006;
    v.connect(vg).connect(o.frequency);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.06);
    g.gain.setValueAtTime(vol, at + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0005, at + len + 0.25);
    o.connect(g).connect(bus);
    o.start(at);
    v.start(at);
    o.stop(at + len + 0.3);
    v.stop(at + len + 0.3);
  }

  // ---- the player: bars scheduled a little ahead of the clock ----
  let bar = 0, next = null, dusk = 0, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function playBar(at) {
    const name = SONG[bar % SONG.length], chord = CHORDS[name], eighth = 0.27 * (1 + dusk * 0.12), sparse = Math.max(0, dusk - 0.3) * 0.9;
    const pick = PICK[(bar + (bar >> 3)) % PICK.length];
    pad(chord, at, eighth * 6, 0.016 * (1 - dusk * 0.4));
    for (let k = 0; k < 6; k++) {
      if (k && rnd() < sparse * (k % 3 ? 1 : 0.4)) continue;
      const m = chord[pick[k]], t = at + k * eighth + (rnd() - 0.5) * 0.016;
      pluck(m, t, (k === 0 ? 0.5 : 0.3) * (0.85 + rnd() * 0.3) * (1 - dusk * 0.25));
    }
    // the tune: in the second half of each round, on chord notes, every other bar or so; not at night
    if (bar % SONG.length >= 8 && dusk < 0.8 && rnd() < 0.7) {
      const near = TUNE.filter((m) => chord.some((c) => (m - c) % 12 === 0));
      const a = near[Math.floor(rnd() * near.length)], b = TUNE[Math.max(0, Math.min(TUNE.length - 1, TUNE.indexOf(a) + (rnd() < 0.5 ? -1 : 1)))];
      whistle(a, at, eighth * 2.6, 0.05);
      if (rnd() < 0.6) whistle(b, at + eighth * 3, eighth * 2.4, 0.042);
    }
    bar++;
    return eighth * 6;
  }
  return {
    // keep the bars coming up to `until` (seconds on the context's clock); from `start` the first time
    schedule(until, start = ctx.currentTime + 0.1) {
      if (next == null) next = start;
      while (next < until) next += playBar(next);
    },
    // the evening: 0 afternoon .. 1 night
    setDusk(d) {
      dusk = d;
      tone.frequency.setTargetAtTime(9000 - d * 6200, ctx.currentTime, 1.5);
    },
    // the level of the whole music
    setLevel(v) {
      bus.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
    },
    // a few strings of the chord now playing, for the game's moments: rising (a crate home, the win) or falling (lost)
    phrase(notes, at = ctx.currentTime + 0.02, gap = 0.11, vol = 0.45) {
      notes.forEach((m, k) => pluck(m, at + k * gap, vol));
    },
    whistle,
    chordNow: () => CHORDS[SONG[Math.max(0, bar - 1) % SONG.length]],
  };
}

// a room: two seconds of noise dying away, a little different in each ear
function impulse(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  return b;
}

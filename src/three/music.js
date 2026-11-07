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

// the voices the picked notes can have (Oleg, 2026-11-07: "sounds like out of tune guitar"): each fills a note's buffer d
// at frequency f. 'guitar' is the first one, whose loop was a whole number of samples plus the averaging's half: its strings
// came out 0-15 cents flat, the top ones worst, against the pad and the whistle, which are exact. 'tuned' is the same string
// with an allpass taking the fraction (Jaffe and Smith), in tune to the cent; 'kalimba' and 'piano' are made of sines
const VOICES = {
  guitar(d, f, m, sr) {
    const n = Math.round(sr / f);
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = last * 0.55 + (Math.random() * 2 - 1) * 0.45;
      d[i] = last;
    }
    const keep = m < 50 ? 0.9985 : 0.9965;
    for (let i = n; i < d.length; i++) d[i] = keep * 0.5 * (d[i - n] + d[i - n - 1 < 0 ? 0 : i - n - 1]);
  },
  tuned(d, f, m, sr) {
    // the loop: a line of N samples, the averaging (half a sample) and an allpass for the rest of the period
    const P = sr / f, N = Math.floor(P - 0.6), frac = P - 0.5 - N, C = (1 - frac) / (1 + frac), line = new Float32Array(N);
    let last = 0;
    for (let i = 0; i < N; i++) {
      last = last * 0.55 + (Math.random() * 2 - 1) * 0.45;
      line[i] = last;
    }
    const keep = m < 50 ? 0.9985 : 0.9965;
    let p = 0, prev = 0, ax = 0, ay = 0;
    for (let i = 0; i < d.length; i++) {
      const x = line[p];
      d[i] = x;
      const avg = keep * 0.5 * (x + prev), y = C * avg + ax - C * ay;
      prev = x;
      ax = avg;
      ay = y;
      line[p] = y;
      p = (p + 1) % N;
    }
  },
  // a thumb piano's tine: the note, a faint octave, and the tine's own high partials (6.27 and 17.55 times, a clamped bar's)
  // that ring only for the pluck
  kalimba(d, f, m, sr) {
    const ring = m < 50 ? 2.2 : 1.5 - (m - 50) * 0.02, parts = [[1, 1, ring], [2, 0.06, ring * 0.4], [6.27, m < 50 ? 0.05 : 0.2, 0.07], [17.55, m < 50 ? 0 : 0.05, 0.025]];
    for (let i = 0; i < d.length; i++) {
      const t = i / sr, on = Math.min(1, t / 0.0015);
      let v = 0;
      for (const [r, a, tau] of parts) if (f * r < sr / 2.2) v += a * Math.sin(2 * Math.PI * f * r * t) * Math.exp(-t / tau);
      d[i] = 0.55 * on * v;
    }
  },
  // a soft electric piano: a sine bent by another at the same pitch, the bend dying away (warm after the strike). Low down
  // the bend is small and the note shorter. No bell at the strike (2026-11-07, Oleg: "bubbling ... like a tube hitting
  // water": a short sine 14 times the note, dying in 40 ms, is a bubble's own sound; under the middle notes it sat at
  // 2-3.5 kHz, where bubbles are)
  piano(d, f, m, sr) {
    const ring = m < 50 ? 1.9 : 1.8 - (m - 50) * 0.025, depth = 1.6 * Math.min(1, Math.max(0.12, (m - 45) / 25));
    // the bass notes: a soft 12 ms onset and most of the sound in the overtones, the fundamental weak, as a piano's low
    // strings (2026-11-07, Oleg: a laptop speaker buzzed from the second chord on, where a near-pure 110 Hz bass note was the
    // loudest thing in the music; a speaker that small cannot play it; the overtones still carry the pitch)
    if (m < 50) {
      for (let i = 0; i < d.length; i++) {
        const t = i / sr, w = 2 * Math.PI * f * t, on = Math.min(1, t / 0.012);
        d[i] = 0.4 * on * Math.exp(-t / ring) * (0.5 * Math.sin(w) + 0.62 * Math.sin(2 * w) * Math.exp(-t / 0.9) + 0.32 * Math.sin(3 * w) * Math.exp(-t / 0.5) + 0.14 * Math.sin(4 * w) * Math.exp(-t / 0.3));
      }
      return;
    }
    for (let i = 0; i < d.length; i++) {
      const t = i / sr, on = Math.min(1, t / 0.003), w = 2 * Math.PI * f * t, bend = 0.25 * Math.min(1, depth) + depth * Math.exp(-t / 0.35);
      d[i] = 0.5 * on * Math.sin(w + bend * Math.sin(w)) * Math.exp(-t / ring);
    }
  },
};

// options (2026-11-07, Oleg on the soft piano: calm, "but there are like underwater sounds around it"): the pad 'warm' (two
// sawtooths a few cents apart, muffled: they beat, a slow wobble) or 'still' (sines, no detune, no beating) or 'none'; the
// tune over it 'whistle' (a sine with vibrato) or 'voice' (played on the voice, a right hand); the room 'rough' (raw
// noise dying away) or 'smooth' (darker, shorter, a little later)
// (and for listening to a part alone: `only(m)` keeps just those picked notes; lead 'none'; room 'dry')
// lowCut: a highpass at the start (2026-11-07, Oleg: his laptop speaker crackled; a fifth of the music's energy was below
// 120 Hz, which small speakers cannot play and buzz on; the bass notes' overtones still carry their pitch)
// damp: a pedal change at every chord (2026-11-07, Oleg: "buzzing and trembling"): the last bar's notes die in a fifth of a
// second as the next chord comes, instead of ringing on into it; low notes a step apart beat 5-14 times a second
export function makeMusic(ctx, dest, { voice = 'guitar', pad: padKind = 'warm', lead = 'whistle', room: roomKind = 'rough', only = null, lowCut = 0, damp = false } = {}) {
  const sr = ctx.sampleRate;
  // the bus: a gentle lowpass the evening closes, a room, the level
  const bus = ctx.createGain(), tone = ctx.createBiquadFilter(), dry = ctx.createGain(), wet = ctx.createGain(), room = ctx.createConvolver();
  tone.type = 'lowpass';
  tone.frequency.value = 9000;
  bus.gain.value = 1;
  if (lowCut) {
    const cut = ctx.createBiquadFilter(), cut2 = ctx.createBiquadFilter();
    cut.type = cut2.type = 'highpass';
    cut.frequency.value = cut2.frequency.value = lowCut;
    bus.connect(cut).connect(cut2).connect(tone);
  } else bus.connect(tone);
  tone.connect(dry).connect(dest);
  // the smooth room takes no lows (they muddy and rumble in it)
  const roomIn = roomKind === 'smooth' ? Object.assign(ctx.createBiquadFilter(), { type: 'highpass' }) : null;
  if (roomIn) {
    roomIn.frequency.value = 240;
    tone.connect(roomIn).connect(room).connect(wet).connect(dest);
  } else tone.connect(room).connect(wet).connect(dest);
  dry.gain.value = 0.85;
  wet.gain.value = roomKind === 'dry' ? 0 : roomKind === 'smooth' ? 0.24 : 0.32;
  room.buffer = roomKind === 'smooth' ? smoothImpulse(ctx, 2) : impulse(ctx, 2.4);

  // ---- plucked strings ----
  const strings = {};
  function string(m) {
    if (strings[m]) return strings[m];
    const len = Math.floor(sr * (m < 50 ? 3.2 : 2.4)), b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
    // the pluck (for the strings: noise, softened, a thumb not a pick, round a loop that averages neighbours and loses a little)
    (VOICES[voice] || VOICES.guitar)(d, midiHz(m), m, sr);
    // fade the tail to nothing
    for (let i = len - 2000; i < len; i++) d[i] *= (len - i) / 2000;
    return (strings[m] = b);
  }
  let sounding = [];
  function pluck(m, at, vol, free = false) {
    if (only && !only(m)) return;
    const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.buffer = string(m);
    g.gain.value = vol;
    if (p) {
      p.pan.value = (m - 56) / 40;
      s.connect(g).connect(p).connect(bus);
    } else s.connect(g).connect(bus);
    s.start(at);
    if (damp && !free) sounding.push(g);
  }
  // ---- the pad: the chord's root, fifth and third, warm and slow ----
  function pad(chord, at, len, vol) {
    if (padKind === 'none') return;
    if (padKind === 'still') return stillPad(chord, at, len, vol);
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
  // the still pad: the same three notes as sines, in tune and steady, rising and falling slowly
  function stillPad(chord, at, len, vol) {
    for (const m of [chord[0] + 12, chord[3], chord[4]]) {   // all above 147 Hz (a small speaker's floor)
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = midiHz(m);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol * 1.3, at + len * 0.4);
      g.gain.linearRampToValueAtTime(vol * 1.05, at + len * 0.85);
      g.gain.linearRampToValueAtTime(0, at + len + (damp ? 0.25 : 0.8));
      o.connect(g).connect(bus);
      o.start(at);
      o.stop(at + len + (damp ? 0.35 : 0.9));
    }
  }
  // the tune: whistled, or played on the voice (softly, over the picking)
  const tune = (m, at, len, vol) => (lead === 'none' ? null : lead === 'voice' ? pluck(m, at, vol * 4.4) : whistle(m, at, len, vol));
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
    // the pedal change: the last bar's notes let go as this one starts
    for (const g of sounding) g.gain.setTargetAtTime(0, at, 0.06);
    sounding = [];
    pad(chord, at, eighth * 6, 0.016 * (1 - dusk * 0.4));
    for (let k = 0; k < 6; k++) {
      if (k && rnd() < sparse * (k % 3 ? 1 : 0.4)) continue;
      const m = chord[pick[k]], t = at + k * eighth + (rnd() - 0.5) * 0.016;
      pluck(m, t, (k === 0 ? (voice === 'piano' ? 0.34 : 0.5) : 0.3) * (0.85 + rnd() * 0.3) * (1 - dusk * 0.25));
    }
    // the tune: in the second half of each round, on chord notes, every other bar or so; not at night
    if (bar % SONG.length >= 8 && dusk < 0.8 && rnd() < 0.7) {
      const near = TUNE.filter((m) => chord.some((c) => (m - c) % 12 === 0));
      const a = near[Math.floor(rnd() * near.length)], b = TUNE[Math.max(0, Math.min(TUNE.length - 1, TUNE.indexOf(a) + (rnd() < 0.5 ? -1 : 1)))];
      tune(a, at, eighth * 2.6, 0.05);
      if (rnd() < 0.6) tune(b, at + eighth * 3, eighth * 2.4, 0.042);
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
      notes.forEach((m, k) => pluck(m, at + k * gap, vol, true));
    },
    whistle,
    chordNow: () => CHORDS[SONG[Math.max(0, bar - 1) % SONG.length]],
  };
}

// The camp's music since 2026-11-07: a recording, Oleg's pick of the samples ("Before Dark camp piano", calm solo piano in
// D major, 6/8, made with ACE-Step v1.5 XL on acemusic.ai, free for commercial use: assets/LICENSES.md), after the music
// made in code above sounded wrong on his speakers. Played through, each round fading into the next over its last
// seconds; the evening closes a lowpass over it, as it did over the strings. The same calls as makeMusic's player
// (schedule, setDusk, setLevel, chordNow: the key's home chord, for the moments' notes); `ready` once it is decoded.
export function makeTrack(ctx, dest, url) {
  const bus = ctx.createGain(), tone = ctx.createBiquadFilter(), FADE = 4;
  tone.type = 'lowpass';
  tone.frequency.value = 12000;
  bus.connect(tone).connect(dest);
  let buffer = null, next = null;
  const ready = fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((d) => (buffer = d)).catch(() => null);
  function round(at, first) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), len = buffer.duration;
    s.buffer = buffer;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(1, at + (first ? 1.5 : FADE));
    g.gain.setValueAtTime(1, at + len - FADE);
    g.gain.linearRampToValueAtTime(0, at + len);
    s.connect(g).connect(bus);
    s.start(at);
    s.stop(at + len + 0.05);
  }
  return {
    ready,
    schedule(until, start = ctx.currentTime + 0.1) {
      if (!buffer) return;
      const first = next == null;
      if (first) next = start;
      while (next < until) {
        round(next, first && next === start);
        next += buffer.duration - FADE;
      }
    },
    setDusk(d) {
      tone.frequency.setTargetAtTime(12000 - d * 8500, ctx.currentTime, 1.5);
    },
    setLevel(v) {
      bus.gain.setTargetAtTime(v, ctx.currentTime, 0.4);
    },
    chordNow: () => CHORDS.D,
  };
}

// a smoother room: noise darkened by a lowpass that closes as it dies, after 14 ms, a little different in each ear
function smoothImpulse(ctx, seconds) {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds), pre = Math.floor(sr * 0.014), b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const u = (i - pre) / (len - pre), k = 0.35 * (1 - u * 0.8);
      lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-u * 6.5) * Math.min(1, (i - pre) / (sr * 0.004));
    }
  }
  return b;
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

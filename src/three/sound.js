// Sounds of the 3D board: Kenney's CC0 wood and camp sounds (mp3, which iPhones play) through Web Audio, each play a little
// off in pitch and volume so no two moves sound alike; and an evening made in code: birds while it is light, crickets as it
// darkens, the fire's crackle growing with the fire and the wind's gusts; and the camp's music (a recording,
// assets/music, played by music.js makeTrack), which the game's moments join in key: a note for each crate home, rising; a tune for the win. Each trade sounds like its work
// (stones for the fire, a mallet and canvas for the tent, a hammer on planks, a splash, coins and a ledger, blankets).
// Nothing plays before the first touch (browsers' autoplay rule) and nothing here ever throws. No creaks or door sounds
// (Oleg hates them) and no sliding scrape.
import { makeMusic, makeTrack } from './music.js';

// the music: a recording (music.js makeTrack); the game's moments (a crate home, the win, the stars) are played on the piano
// made in code, in the recording's key (D major), in tune (the first strings were up to 15 cents flat: 2026-11-07)
const TRACK = 'assets/music/camp-piano.mp3', STING = { voice: 'piano', room: 'smooth' };

const FILES = {
  pick: ['pick1', 'pick2', 'pick3'], drop: ['drop1', 'drop2', 'drop3'], heavy: ['heavy1'], bump: ['bump1', 'bump2'],
  cloth: ['cloth1', 'cloth2', 'cloth3', 'cloth4'], coins: ['coins1', 'coins2'], latch: ['latch1'], chop: ['chop1'], leather: ['leather1'],
  stone: ['stone1', 'stone2', 'stone3'], thud: ['thud1', 'thud2', 'thud3'], tap: ['tap1', 'tap2', 'tap3'], plank: ['plank1', 'plank2'],
  soft: ['soft1', 'soft2'], glass: ['glass1'], book: ['book1', 'book2'], click: ['click1'],
};
const buf = {};
// a sound's file, found from this module (so tools' pages load them too)
const file = (n) => new URL(`../../assets/sfx3d/${n}.mp3`, import.meta.url);
// Sound and music are switched apart (settings, playtest 2026-10-28: published games all have the two toggles). `out` carries
// the sounds (with the evening's ambience `amb` in it), `mg` the music, both into `master`. The game's tunes (a crate home,
// the win) are sounds: they play through their own strings (`sting`) on `out`, in the music's key.
let ac = null, master = null, out = null, mg = null, weather = null, amb = null, music = null, sting = null, muted = false, musicOff = false;
let dusk = 0, musicDusk = -1, fire = 0.3, nextBird = 0, nextCricket = 0, nextCrackle = 0;
// ?playtest keeps the switches in its own tab, as main.js keeps the progress
const keep = (() => {
  try {
    return /[?&]playtest\b/.test(location.search) ? sessionStorage : localStorage;
  } catch {
    return null;
  }
})();
try {
  const old = keep.getItem('bd.muted') === '1';
  muted = (keep.getItem('bd.sound') ?? (old ? '0' : '1')) === '0';
  musicOff = (keep.getItem('bd.music') ?? (old ? '0' : '1')) === '0';
} catch {}

export const isMuted = () => muted;
export const soundOn = () => !muted;
export const musicOn = () => !musicOff;

// (switched on in the settings, a tap: the sound starts afresh on a new audio context, so a phone whose sound died can get it
// back by hand: see restart)
export function setSound(on) {
  muted = !on;
  try {
    keep.setItem('bd.sound', on ? '1' : '0');
  } catch {}
  if (on && settled()) restart();
  else if (out) out.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05);
}
export function setMusic(on) {
  musicOff = !on;
  try {
    keep.setItem('bd.music', on ? '1' : '0');
  } catch {}
  if (on && settled()) restart();
  else if (mg) mg.gain.setTargetAtTime(on ? 0.34 : 0, ac.currentTime, 0.2);
}
// (not when the context was made by this same tap)
const settled = () => ac && performance.now() - builtAt > 1000;
// the old single switch: both off, or both on
export function toggleMute() {
  const on = muted && musicOff;
  setSound(on);
  setMusic(on);
}

// ?playtest (simulated players, checks) never makes a sound: those tabs run on Oleg's PC
const silent = /[?&](playtest|silent)\b/.test(location.search);

// iPhones lose a page's sound when it goes to the background and comes back (2026-11-09, Oleg, on CrazyGames: the sound gone
// after minimising the browser, and neither the settings nor a reload brought it back). Every iPhone browser is Safari's
// engine, and its audio context can come back "interrupted", or say "running" and play nothing, and a reload need not help
// (WebKit bugs 276016, 276687, open). The cure reported there: stop the context and start it again (kick). So it is kicked
// when it is made, when the page comes back to the front and at the first touch after; one that will not run after a kick
// is closed and a new one made at the next touch (restart), and switching sound or music on in the settings makes a new one.
let stale = false, broken = false, made = 0, kicks = 0, builtAt = 0;

// call from a touch or click: makes the audio context (and loads the sounds) once, and mends it when it has gone quiet
export function wake() {
  if (silent) return;
  try {
    if (!ac) return makeContext();
    if (broken || ac.state === 'closed') return restart();
    if (stale || ac.state !== 'running') {
      stale = false;
      kick();
    }
  } catch {}
}

function makeContext() {
  try {
    const c = (ac = new (window.AudioContext || window.webkitAudioContext)()), gen = ++made;
    builtAt = performance.now();
    master = c.createGain();
    master.connect(c.destination);
    out = c.createGain();
    out.gain.value = muted ? 0 : 1;
    out.connect(master);
    amb = c.createGain();
    amb.gain.value = 0.5;
    amb.connect(out);
    for (const list of Object.values(FILES)) {
      for (const n of list) {
        fetch(file(n)).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((d) => gen === made && (buf[n] = d)).catch(() => {});
      }
    }
    weather = makeWeatherLoops();
    mg = c.createGain();
    mg.gain.value = musicOff ? 0 : 0.34;
    mg.connect(master);
    music = makeTrack(c, mg, TRACK);
    const sg = c.createGain();
    sg.gain.value = 0.34;
    sg.connect(out);
    sting = makeMusic(c, sg, STING);
    // (a new context on an iPhone whose sound has died can be silent too: kicked once it has started)
    setTimeout(() => ac === c && kick(), 300);
  } catch {
    ac = null;
  }
}

// the context closed and a new one made, with everything on it (the music starts again from the top)
function restart() {
  const old = ac;
  ac = master = out = mg = weather = amb = music = sting = null;
  for (const n of Object.keys(buf)) delete buf[n];
  nextBird = nextCricket = nextCrackle = 0;
  musicDusk = -1;
  stale = broken = false;
  try {
    old.close().catch(() => {});
  } catch {}
  makeContext();
}

// stopped and started again; if it is not running with its clock going a moment later (the page in front), it is broken
// and the next touch makes a new one
function kick() {
  const c = ac, k = ++kicks;
  if (!c) return;
  const go = () => c.resume();
  c.suspend().then(go, go).catch(() => {});
  const t0 = c.currentTime;
  setTimeout(() => {
    if (ac === c && k === kicks && !document.hidden && (c.state !== 'running' || c.currentTime < t0 + 0.2)) broken = true;
  }, 900);
}

// the page hidden (another app in front, the phone locked) stops everything (2026-11-07, Oleg: the music played on on
// Android with the browser minimised or the phone locked); back in front, kicked, and again at the next touch
function hide() {
  stale = true;
  kicks++;
  if (ac) ac.suspend().catch(() => {});
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hide();
  else if (ac) kick();
});
addEventListener('pagehide', hide);
addEventListener('pageshow', (e) => e.persisted && ((stale = true), ac && kick()));
// (Safari 16.4 and later say when the phone's audio was interrupted, a call say: the next touch kicks it)
try {
  navigator.audioSession?.addEventListener?.('statechange', () => navigator.audioSession.state !== 'active' && (stale = true));
} catch {}

// one of the named sound's variants; vol 0..1, rate around 1, both jittered
export function play(name, vol = 0.6, rate = 1, delay = 0) {
  if (!ac || muted) return;
  const list = FILES[name];
  const b = list && buf[list[Math.floor(Math.random() * list.length)]];
  if (!b) return;
  try {
    const s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = b;
    s.playbackRate.value = rate * (0.92 + Math.random() * 0.16);
    g.gain.value = vol * (0.85 + Math.random() * 0.3);
    s.connect(g).connect(out);
    s.start(ac.currentTime + delay);
  } catch {}
}

// a soft tone or chord made in code (the camp's cheers); notes in Hz
export function chime(notes, vol = 0.18, len = 0.5, delay = 0) {
  if (!ac || muted) return;
  try {
    notes.forEach((f, k) => {
      const t = ac.currentTime + delay + k * 0.07, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + len);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  } catch {}
}

function noiseBuffer(seconds) {
  const b = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;   // a little brown: wood on sand, not hiss
    d[i] = last;
  }
  return b;
}

// a looped noise for the wind (a low rush), silent until the weather turns it up. No rain sound: filtered noise was a hiss,
// not rain (Oleg, 2026-11-07: "remove the rain sound - its like hissing noise not real rain"); rain is seen, not heard
function makeWeatherLoops() {
  const loop = (type, freq, q) => {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuffer(3);
    s.loop = true;
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.value = 0;
    s.connect(f).connect(g).connect(amb);
    s.start(0, Math.random() * 2);
    return { f, g };
  };
  return { wind: loop('lowpass', 420, 0.7) };
}

// wind 0..1 (rain: no sound)
export function setWeather(rain, windK) {
  if (!weather) return;
  weather.wind.g.gain.setTargetAtTime(Math.min(windK, 1) * 0.5, ac.currentTime, 0.4);
  weather.wind.f.frequency.setTargetAtTime(300 + windK * 500, ac.currentTime, 0.4);
}

// a soft tick as a crate passes over a tile's edge (wood on wood, quiet)
export function cellTick(speed = 1) {
  play('pick', 0.09 + Math.min(speed, 6) * 0.015, 1.5);
}

// the evening: t 0 (afternoon) .. 1 (night); f the fire's size 0..1
export function setEvening(t, f) {
  dusk = t;
  fire = f;
}

export function tick() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime;
  // (the recording keeps its place while the music is off, silent on its muted bus, so it comes back where it would be)
  if (music) {
    music.schedule(now + 0.8);
    if (Math.abs(dusk - musicDusk) > 0.03) music.setDusk((musicDusk = dusk));
  }
  if (muted) return;
  if (now > nextBird) {
    nextBird = now + 1.2 + Math.random() * 3 + dusk * 6;
    if (Math.random() > dusk * 1.1) bird(now);
  }
  if (now > nextCricket) {
    nextCricket = now + 0.55 + Math.random() * 0.5;
    if (dusk > 0.35) cricket(now, Math.min((dusk - 0.35) * 1.6, 1));
  }
  if (now > nextCrackle) {
    nextCrackle = now + 0.05 + Math.random() * (0.5 - fire * 0.35);
    crackle(now, 0.25 + fire * 0.75);
  }
}

function bird(t) {
  const n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400;
  for (let k = 0; k < n; k++) {
    const t0 = t + k * (0.09 + Math.random() * 0.05), o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.4), t0 + 0.06);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.025, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.08);
    o.connect(g).connect(amb);
    o.start(t0);
    o.stop(t0 + 0.1);
  }
}

function cricket(t, k) {
  for (let p = 0; p < 3; p++) {
    const t0 = t + p * 0.045, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 4300 + Math.random() * 120;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.012 * k, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0002, t0 + 0.03);
    o.connect(g).connect(amb);
    o.start(t0);
    o.stop(t0 + 0.04);
  }
}

let crackleBuf = null;
function crackle(t, k) {
  if (!crackleBuf) crackleBuf = noiseBuffer(0.2);
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = crackleBuf;
  f.type = 'highpass';
  f.frequency.value = 1800 + Math.random() * 2500;
  g.gain.setValueAtTime(0.05 * k * Math.random(), t);
  g.gain.exponentialRampToValueAtTime(0.0003, t + 0.015 + Math.random() * 0.03);
  s.connect(f).connect(g).connect(amb);
  s.start(t, Math.random() * 0.15, 0.05);
}

// ---- the game's moments ----

// air: a crate thrown out through its gate (up), or pulled back by an undo (down)
export function whoosh(up = true, vol = 0.18, delay = 0) {
  if (!ac || muted) return;
  try {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuffer(0.5);
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(up ? 380 : 1800, t);
    f.frequency.exponentialRampToValueAtTime(up ? 2200 : 320, t + 0.32);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4);
    s.connect(f).connect(g).connect(out);
    s.start(t);
  } catch {}
}

// water: a slosh and a few bubbles
export function splash(vol = 0.3, delay = 0) {
  if (!ac || muted) return;
  try {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuffer(0.6);
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.35);
    f.Q.value = 0.8;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 0.45);
    s.connect(f).connect(g).connect(out);
    s.start(t);
    for (let k = 0; k < 4; k++) {
      const t0 = t + 0.08 + k * (0.05 + Math.random() * 0.06), o = ac.createOscillator(), og = ac.createGain(), f0 = 500 + Math.random() * 600;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t0 + 0.05);
      og.gain.setValueAtTime(0, t0);
      og.gain.linearRampToValueAtTime(vol * 0.25, t0 + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.06);
      o.connect(og).connect(out);
      o.start(t0);
      o.stop(t0 + 0.08);
    }
  } catch {}
}

// a stage of a trade's work: each sounds like what it does
export function build(kind) {
  if (kind === 'fire') {
    play('stone', 0.45);
    play('stone', 0.35, 1, 0.14);
  } else if (kind === 'tent') {
    play('thud', 0.4);
    play('thud', 0.35, 1, 0.2);
    play('cloth', 0.3, 1, 0.4);
  } else if (kind === 'bench') {
    play('tap', 0.3);
    play('tap', 0.3, 1, 0.15);
    play('plank', 0.35, 1, 0.34);
  } else if (kind === 'water') {
    splash(0.28);
    play('drop', 0.25, 1.2, 0.05);
  } else if (kind === 'chest') {
    play('coins', 0.35);
    play('book', 0.35, 1, 0.22);
  } else if (kind === 'beds') {
    play('cloth', 0.4);
    play('soft', 0.35, 1, 0.2);
  } else play('chop', 0.3, 1.15);
}

// a crate home on its gate's mat: a string of the music's chord, higher with each crate of the level
export function home(n) {
  if (!ac || muted || !sting) return;
  try {
    const c = music.chordNow(), top = c.slice(2), up = [...top, ...top.map((m) => m + 12), ...top.map((m) => m + 24)];
    sting.phrase([up[Math.min(n, up.length - 1)]], ac.currentTime + 0.02, 0, 0.5);
  } catch {}
}

// the game's ends and the camp's moments, in the music's key (D major)
export function jingle(kind, delay = 0) {
  if (!ac || muted || !sting) return;
  try {
    const t = ac.currentTime + 0.03 + delay;
    if (kind === 'win') {
      sting.phrase([62, 66, 69, 74, 78, 81], t, 0.12, 0.55);
      sting.whistle(86, t + 0.8, 0.9, 0.05);
      play('glass', 0.25, 1.4, 0.75 + delay);
    } else if (kind === 'done') {
      sting.phrase([69, 74, 78, 81], t, 0.1, 0.45);
      play('glass', 0.18, 1.6, 0.35 + delay);
    } else if (kind === 'lose') sting.phrase([69, 65, 62, 57], t, 0.22, 0.45);
    else if (kind === 'start') sting.phrase([50, 54, 57, 62, 66], t, 0.05, 0.35);
  } catch {}
}

// an owl, as a crew goes to bed: hoo... hoo-hoo
export function owl(delay = 0.3) {
  if (!ac || muted) return;
  try {
    [0, 0.55, 0.78].forEach((d, k) => {
      const t = ac.currentTime + delay + d, o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(), len = k ? 0.2 : 0.42;
      o.type = 'triangle';
      o.frequency.setValueAtTime(410, t);
      o.frequency.linearRampToValueAtTime(370, t + len);
      f.type = 'lowpass';
      f.frequency.value = 900;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0005, t + len + 0.1);
      o.connect(f).connect(g).connect(amb);
      o.start(t);
      o.stop(t + len + 0.15);
    });
  } catch {}
}

// a bedtime gate swung shut: wood against the post, then the latch
export function gateShut() {
  play('thud', 0.5, 0.9);
  play('click', 0.35, 1, 0.12);
}

// for previews (tools/sound-preview.html): run the sounds on another audio context (an OfflineAudioContext) and its loaded
// buffers, then back
export async function borrow(ctx, files = true) {
  const keep = { ac, out, amb, music, sting, muted };
  ac = ctx;
  out = ctx.createGain();
  out.connect(ctx.destination);
  amb = ctx.createGain();
  amb.gain.value = 0.5;
  amb.connect(out);
  muted = false;
  const mg = ctx.createGain();
  mg.gain.value = 0.34;
  mg.connect(out);
  music = files ? makeTrack(ctx, mg, TRACK) : makeMusic(ctx, mg);
  sting = makeMusic(ctx, mg, STING);
  if (files) {
    await Promise.all(Object.values(FILES).flat().map((n) => fetch(file(n)).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((d) => (buf[n] = d)).catch(() => {})));
    await music.ready;
  }
  return {
    music,
    back() {
      ({ ac, out, amb, music, sting, muted } = keep);
    },
  };
}

// a star landing on the end card (k: 0, 1, 2): a bright string, higher for each
export function star(k) {
  if (!ac || muted || !sting) return;
  try {
    sting.phrase([[74, 78, 81][k] || 86], ac.currentTime + 0.02, 0, 0.55);
    play('glass', 0.16, 1.3 + k * 0.15);
  } catch {}
}

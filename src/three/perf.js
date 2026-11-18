// Performance numbers for the play stats (Oleg, 2026-11-18: "measure performance statistics like the load time of setting
// up camp"; on the first day two phones took 8-9 s to reach play). Sent through stats.js like every other event, nothing
// personal: how long things take, how smoothly the game draws, what broke, and the device's class.
// - startup: page fetched, code running, models loaded, first frame drawn (ms since the page was asked for); how much was
//   downloaded and how much came from the browser's cache; the device's class (graphics chip family and model, CPU cores,
//   memory, connection) and the quality the game started at
// - level_ready (main.js): how long "setting up camp" took, split into building the level and its first draw
// - level_perf: per level, how smoothly it drew (frames a second, the slowest tenth of frames, the longest freeze, frames over
//   50 ms, the page's long tasks, the heap where the browser tells it)
// - error / gl_lost: JavaScript errors from the game's own files (the message's first words, the file, the line), a model that
//   failed to load, the 3D context lost
import { track, beforeLeave } from './stats.js';

const marks = {};
// a moment of the startup, the first time it happens (ms since the page was asked for)
export const mark = (name) => (marks[name] ??= Math.round(performance.now()));

// the graphics chip as a family and model only ("ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 (0x00001F08) Direct3D11 vs_5_0
// ps_5_0, D3D11)" -> "NVIDIA GeForce RTX 2060"; "Adreno (TM) 610" -> "Adreno 610"): enough to tell weak phones from strong
function chip(s) {
  if (!s) return null;
  return String(s).replace(/^ANGLE \([^,]*,\s*/, '').replace(/^ANGLE \w+ Renderer:\s*/i, '').replace(/\s*\(0x[0-9a-f]+\)/gi, '').replace(/\s*(Direct3D|OpenGL|Vulkan|Metal).*$/i, '')
    .replace(/\((TM|R)\)/gi, '').replace(/,.*$/, '').replace(/\s+/g, ' ').trim().slice(0, 40) || null;
}
function device(renderer) {
  let gpu = null;
  try {
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = chip(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch { /* no context */ }
  const c = navigator.connection;
  return { gpu, cores: navigator.hardwareConcurrency || null, mem: navigator.deviceMemory || null, net: (c && c.effectiveType) || null, save: c ? !!c.saveData : null };
}

// once the first frame is drawn
let sent = false;
export function startup(renderer, extra = {}) {
  if (sent) return;
  sent = true;
  mark('first');
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  let kb = 0, files = 0, cached = 0;
  for (const r of (performance.getEntriesByType && performance.getEntriesByType('resource')) || []) {
    files++;
    kb += r.transferSize || 0;
    if (r.transferSize === 0 && r.decodedBodySize > 0) cached++;
  }
  track('startup', {
    html: nav ? Math.round(nav.responseEnd) : null, dom: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
    code: marks.code ?? null, models: marks.models ?? null, first: marks.first, kb: Math.round(kb / 1024), files, cached,
    ...device(renderer), ...extra,
  });
}

// ---- how smoothly each level draws: frame times in 2 ms buckets up to 200 ms ----
const H = new Uint32Array(101);
let frames = 0, slow = 0, worst = 0, longN = 0, longMs = 0;
// one frame's time (ms) while the page is shown and no level is being set up
export function frameTime(ms) {
  if (!(ms > 0) || ms > 1000) return;   // (a tab coming back after a while: not a frame)
  frames++;
  if (ms > 50) slow++;
  if (ms > worst) worst = ms;
  H[Math.min(100, Math.floor(ms / 2))]++;
}
const pct = (p) => {
  const need = frames * p;
  let acc = 0;
  for (let k = 0; k <= 100; k++) if ((acc += H[k]) >= need) return k * 2 + 1;
  return 201;
};
export function levelPerf() {
  if (!frames) return null;
  return {
    fps: Math.round(1000 / pct(0.5)), p90: pct(0.9), worst: Math.round(worst), slow, frames, long: longN, longMs: Math.round(longMs),
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  };
}
export function resetLevel() {
  H.fill(0);
  frames = slow = worst = longN = longMs = 0;
}
// the page frozen 50 ms or more (Chrome and Edge tell this; others leave it at 0)
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) (longN++), (longMs += e.duration);
  }).observe({ type: 'longtask', buffered: false });
} catch { /* not told */ }

// the level so far when the page goes away (main.js: the level and its quality step)
let level = () => null;
export const onLevel = (fn) => (level = fn);
beforeLeave.push(() => {
  const at = level(), p = levelPerf();
  if (at && p) track('level_perf', { ...at, ...p, left: true });
});

// ---- what broke ----
let errs = 0;
function broke(kind, msg, src = '', line = 0) {
  if (++errs > 8) return;   // (one broken thing can throw every frame)
  track('error', { kind, msg: String(msg || '').slice(0, 40), src: String(src || '').split(/[\\/]/).pop().split('?')[0].slice(0, 24), line: line || 0 });
}
addEventListener('error', (e) => {
  // (only the game's own files: a browser extension's errors are not ours, nor anyone's business)
  if (e.target && e.target !== window && e.target.src) return broke('file', 'failed to load', e.target.src);
  if (e.filename && !e.filename.startsWith(location.origin)) return;
  broke('js', e.message, e.filename, e.lineno);
}, true);
addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  if (r && r.stack && !String(r.stack).includes(location.origin)) return;
  broke('promise', (r && r.message) || r);
});
export const modelFailed = (name) => broke('model', name);
export function watchGl(canvas) {
  canvas.addEventListener('webglcontextlost', () => track('gl_lost', {}));
  canvas.addEventListener('webglcontextrestored', () => track('gl_restored', {}));
}

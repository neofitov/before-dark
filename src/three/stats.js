// Anonymous play statistics (Oleg, 2026-11-18): which levels players start, win, lose and leave on, to find where the game
// is too hard. CrazyGames' dashboard has no per-level numbers. A random id kept in this browser, a session id and named
// events with a few numbers: no names, no IP address, nothing personal. Events go in batches to our own collector, a
// Cloudflare Worker with a D1 database (stats/worker.js, stats/README.md).
// Local copies (localhost, the home network) and ?playtest keep their events in this tab's sessionStorage ("bd.events")
// instead, so tests never mix with real players; ?stats=live sends from anywhere. Settings has a switch ("bd.stats" = "off").
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.)/.test(location.hostname) || /[?&]playtest\b/.test(location.search);
const ENDPOINT = LOCAL && !/[?&]stats=live\b/.test(location.search) ? null : 'https://bd-stats.neofitov.workers.dev/e';
const VERSION = 'dabd9d2';   // the release build writes the commit here (tools/release.mjs)
const HOST = /crazygames\.com$/.test(location.hostname) ? 'cg' : /github\.io$/.test(location.hostname) ? 'pages' : LOCAL ? 'local' : 'other';

let store;
try {
  store = localStorage;
} catch {
  store = null;
}
const get = (k) => { try { return store && store.getItem(k); } catch { return null; } };
const set = (k, v) => { try { if (store) store.setItem(k, v); } catch { /* storage blocked */ } };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

let off = get('bd.stats') === 'off';
let uid = get('bd.uid');
const returning = !!uid;
if (!uid) {
  uid = rid();
  set('bd.uid', uid);
  set('bd.first', String(Date.now()));
}
const firstSeen = Number(get('bd.first')) || Date.now();
const sid = rid();
const started = performance.now();
const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100) ? 'mobile' : 'desktop';
let queue = [];

export const statsOn = () => !off;
export const firstVisit = !returning;

// the solver's videos and covers (?film, ?cover, ?watch) are not players: nothing is counted, and nothing is stored
export const quiet = () => {
  off = true;
  queue = [];
};

export function setStats(on) {
  off = !on;
  set('bd.stats', on ? 'on' : 'off');
  if (off) queue = [];
}

export function track(name, data = {}) {
  if (off) return;
  queue.push({ e: name, s: +((performance.now() - started) / 1000).toFixed(1), ...data });
  if (queue.length >= 20) flush();
}

export function flush(final = false) {
  if (!queue.length) return;
  const batch = { uid, sid, v: VERSION, device, host: HOST, day: Math.floor((Date.now() - firstSeen) / 86400000), events: queue };
  queue = [];
  if (!ENDPOINT) {
    try {
      const kept = JSON.parse(sessionStorage.getItem('bd.events') || '[]');
      kept.push(...batch.events.map((e) => ({ ...e, device: batch.device, day: batch.day })));
      sessionStorage.setItem('bd.events', JSON.stringify(kept.slice(-500)));
    } catch { /* storage blocked */ }
    return;
  }
  const body = JSON.stringify(batch);
  if (final && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
  else fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
}

// where the player is when the page goes away (main.js sets it: level, moves, time in the level)
let where = () => ({});
export const onLeave = (fn) => (where = fn);

setInterval(() => flush(), 30000);
addEventListener('pagehide', () => {
  track('session_end', where());
  flush(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush(true);
});

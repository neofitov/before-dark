// Before Dark in 3D: "Crates to camp" in the full look, three levels (src/three/campaign.js). The rules are the 2D prototype's
// (src/slide) plus, from level 2, bedtime: some crews turn in early, their worker shutting their gate after a set move (rules
// src/slide/model.js, the workers in camp.js); the camp
// stays and grows from level to level (camp.js). The drag is physical: a crate follows the finger and is
// stopped by what is in its way (rocks, logs, other crates, the frame), slips into a gap when nearly lined up, and leaves only
// through a gate of its colour that it fits; let go, it settles on the nearest cell. A delivered crate hops onto its camp
// spot's mat, where the spot's worker unpacks it and the camp grows (camp.js). Every move brings the evening on, until night
// falls; the weather (weather.js) blows, rains or mists over the glade.
// Address options: ?level=N (1-3; ?proto&level=N: the prototype's 10), ?weather=breeze|rain|mist|clear, ?gates=sill|lane|none,
// ?watch (the solver plays), ?film&w=&h=&secs=&name= (frame-by-frame capture for videos), ?playtest (see PT below).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LEVELS } from '../slide/levels.js';
import { CAMPAIGN } from './campaign.js';
import { reach, pathTo, exitGate, exitSpot, startPos, left, gateOpen, stranded, nextBedtime, locked } from '../slide/model.js';
import { darkMask, lostCrates } from '../slide/dark.js';
import { makeWorld, plantForest, natureMaterial, LOW } from './world.js';
import { buildBoard, buildCrate, waveFlags, stencilCanvas, setCrateGlow, wallModel, SUPPLY, GROUND } from './board.js';
import { makeParticles, dustPuff, unpackBurst } from './fx.js';
import { makeCamp, campKeepOut, campDepth } from './camp.js';
import { EXTRAS, earned } from './extras.js';
import { drawTrail, drawExtras, nextExtra, icon } from './trail.js';
import { makeWeather, KINDS } from './weather.js';
import * as sfx from './sound.js';
import { makeEmber, makeBubble } from './ember.js';

const KENNEY = ['barrel-open', 'barrel', 'chest', 'bedroll', 'resource-wood', 'bucket', 'box-open', 'stump_round', 'stump_old', 'deer', 'fox'];
const PEOPLE = ['character-male-b', 'character-female-b', 'character-male-e', 'character-male-a', 'character-female-c', 'character-female-f'];
const NATURE = ['CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Pine_1', 'Pine_4', 'Pine_5', 'TwistedTree_3', 'Bush_Common', 'Bush_Common_Flowers',
  'Fern_1', 'Plant_1', 'Plant_7', 'Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall', 'Flower_3_Group',
  'Flower_4_Group', 'Clover_1', 'Mushroom_Common', 'Pebble_Round_1', 'Pebble_Round_2', 'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'];
// who turns in early, for the hint and the cards
const CREW_NAME = { red: 'The fire keeper', orange: 'The tent crew', green: 'The carpenter', blue: 'The water carrier', purple: 'The storekeeper', yellow: 'The bed maker' };
const CAMP_NAME = { red: 'the campfire', orange: 'the tent', green: 'the workshop', blue: 'the water barrel', purple: 'the treasure chest', yellow: 'the bedrolls' };
const OUT = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const WEATHER_LABEL = { breeze: '🍃 Breeze', rain: '🌧 Rain', mist: '🌫 Mist', clear: '☀ Clear' };

const q = new URLSearchParams(location.search);
const film = q.has('film'), watchUrl = q.has('watch') || film, cover = q.has('cover');
// the solver plays: ?watch, or the player pressed "Show me" on the end card (playtest 2026-10-24, Ruth: show the target way)
let showing = false;
const watching = () => watchUrl || showing;
// the levels: the game's three, or the prototype's ten; where a player is: saved (the furthest level reached), or ?level
const LIST = q.has('proto') ? LEVELS : CAMPAIGN;
// where progress is kept: the browser's storage; ?playtest keeps it in the tab (sessionStorage), so simulated players in
// parallel tabs each have their own stars and none of it stays behind. ?playtest&seed=3322322 starts one as a returning
// player, with those stars won on levels 1, 2, ...
const store = (() => {
  try {
    return q.has('playtest') ? sessionStorage : localStorage;
  } catch {
    return null;
  }
})();
try {
  if (q.has('playtest') && q.has('seed') && !store.getItem('bd3.reached')) {
    const seed = [...q.get('seed')].map(Number);
    store.setItem('bd3.reached', String(seed.length));
    store.setItem('bd3.stars', JSON.stringify({ ...seed }));
    store.setItem('bd.howto', '1');
  }
} catch {}
let reached = 0;
try {
  reached = Number(store.getItem('bd3.reached')) || 0;
} catch {}
// the most stars won on each level, saved (benchmark 2026-10-28, item 2): the camp trail shows them, and their total earns the
// camp's extras (extras.js); ?stars=N stands for a total of N (checks, covers)
let best = {};
try {
  best = JSON.parse(store.getItem('bd3.stars') || '{}') || {};
} catch {}
const starTotal = () => (q.has('stars') ? Number(q.get('stars')) || 0 : Object.values(best).reduce((s, n) => s + n, 0));
// what the last win earned (the win card shows it): extras new to the camp, stars more than the level's best; and the total
// the HUD shows, which counts the new stars in as they fly to it
let fresh = [], gained = 0, shownTotal = starTotal();
let levelIndex = Math.min(Math.max((Number(q.get('level')) || (q.has('proto') ? 5 : q.has('playtest') && !q.has('seed') ? 1 : reached + 1)) - 1, 0), LIST.length - 1);
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
// whose campers: Kenney's Mini Characters (Oleg's pick, 2026-10-24); ?people=own shows the ones drawn in code (people.js)
const peopleStyle = q.get('people') || 'kenney';

const world = makeWorld($('game'));
const { renderer, scene, camera } = world;
const fx = { dust: makeParticles(scene, { max: 900 }), glow: makeParticles(scene, { max: 600, glow: true }), smoke: makeParticles(scene, { max: 260 }) };

// ---- models: loaded once; static ones cloned per use; plants get the shared, swaying nature materials ----

const gltfs = new Map(), sizes = new Map();
const models = {
  get: (n) => (gltfs.has(n) ? gltfs.get(n).scene.clone(true) : null),
  raw: (n) => gltfs.get(n) || null,
  height: (n) => sizes.get(n)?.y || 1,
  width: (n) => Math.max(sizes.get(n)?.x || 1, sizes.get(n)?.z || 1),
  heightAbove: (n) => sizes.get(n)?.top || 1,
};
async function loadModels() {
  const loader = new GLTFLoader();
  const load = (n, url, nature) => loader.loadAsync(url).then((g) => {
    g.scene.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      if (nature) {
        m.material = Array.isArray(m.material) ? m.material.map((x) => natureMaterial(x.name, n)) : natureMaterial(m.material.name, n);
        // the shared materials tint by vertex colour: a model without any gets plain white (else it renders black)
        if (!m.geometry.attributes.color) m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(m.geometry.attributes.position.count * 3).fill(1), 3));
      } else if (m.material.map) m.material.map.anisotropy = 4;
    });
    const box = new THREE.Box3().setFromObject(g.scene), s = box.getSize(new THREE.Vector3());
    sizes.set(n, { x: s.x, y: s.y, z: s.z, top: box.max.y });
    gltfs.set(n, g);
  }).catch((e) => console.warn('model', n, e));
  const all = KENNEY.length + PEOPLE.length + NATURE.length;
  let done = 0;
  const tick = (p) => p.then(() => ($('loadBar') && ($('loadBar').style.width = `${4 + (96 * ++done) / all}%`)));
  await Promise.all([
    ...KENNEY.map((n) => tick(load(n, `assets/models/${n}.glb`))),
    ...PEOPLE.map((n) => tick(load(n, `assets/models/people/${n}.glb`))),
    ...NATURE.map((n) => tick(load(n, `assets/nature/${n}.glb`, true))),
  ]);
}

let campPortrait = false, L, board, camp, weather, crates, pos, moves, hist, state, drag, duskShown = 0, endAt = 0, wonAt = 0, cheered = 0, t = 0, lastBump = 0, firstMove = true, spots, lostTo = null;
// a win that earned the camp something new: the camera has been to it (spotlight), and where it is (null: on the board)
let spotlit = false, spotAt = null, unlockUntil = 0;
// a heavy crate picked up: which, and when (its way blinks on the ground for a moment: board.way)
let blinkI = -1, blinkAt = 0;
// Ember's hinted move that ends on the board, and the position it was given for (its end stays outlined while that holds)
let aimed = null;
// the largest board in the game: the camp's places and the forest's clearing are the same in every level
const SIZE = { w: Math.max(...LIST.map((l) => l.w)), h: Math.max(...LIST.map((l) => l.h)) };

// what the levels bring to the camp: its parts so far (in the order they came), and each colour's crates before this level and
// in the whole game (the camp stays and grows: camp.js)
function story(k) {
  const count = (l, c) => l.blocks.filter((b) => b.color === c).length, colors = [], prior = {}, total = {};
  LIST.forEach((l, n) => {
    for (const b of l.blocks) {
      if (n <= k && !colors.includes(b.color)) colors.push(b.color);
      total[b.color] = (total[b.color] || 0) + 1;
      if (n < k) prior[b.color] = (prior[b.color] || 0) + 1;
    }
  });
  // ?camp=full: everything the game builds stands already (tools/check-camp.js)
  if (q.get('camp') === 'full') for (const c of Object.keys(total)) {
    prior[c] = total[c];
    if (!colors.includes(c)) colors.push(c);
  }
  return q.has('proto') ? null : { colors, prior, total, size: SIZE, count, extras: earned(starTotal()) };
}

function cellCenter(i, x, y) {
  const b = L.blocks[i];
  return new THREE.Vector3(board.ox + x + b.w / 2, 0, board.oz + y + b.h / 2);
}

function load() {
  if (board) {
    scene.remove(board.group);
    for (const c of crates) scene.remove(c.group);
    camp.dispose();
  }
  L = LIST[levelIndex];
  // each level has its own weather (Oleg, 2026-10-24); the pill still changes it while playing, ?weather= for tests
  if (weather) weather.set(q.get('weather') || L.weather || 'breeze');
  board = buildBoard(scene, models, L, { gates: q.get('gates') });
  spots = board.spots;
  const [vw, vh] = viewSize();
  campPortrait = vh > vw;
  camp = makeCamp(scene, models, board, L, fx, peopleStyle, campPortrait, story(levelIndex));
  lostTo = null;
  hinted = note = thinking = warned = null;
  hintAsk++;   // a search still running is for the last try
  lookAsk++;
  spotlit = false;
  spotAt = null;
  unlockUntil = 0;
  blinkI = -1;
  aimed = null;
  $('unlockNote').classList.remove('on');
  ember.close();
  firstMove = true;
  duskShown = 0;
  pos = startPos(L);
  moves = 0;
  hist = [];
  state = 'play';
  drag = null;
  endAt = wonAt = cheered = 0;
  celebrate = 0;
  fresh = [];
  gained = 0;
  shownTotal = starTotal();
  crates = L.blocks.map((b, i) => {
    // two padlocks or more: each lock and its key carry the same number (playtest 2026-10-29, level 16: both locks yellow, two
    // yellow crates with keys, "which key opens which lock?")
    const locks = L.blocks.filter((o) => o.lock != null), n = locks.length > 1 ? locks.indexOf(b.lock != null ? b : locks.find((o) => o.lock === i)) + 1 : 0;
    const c = buildCrate(models, b, { key: L.blocks.some((o) => o.lock === i), lockColor: b.lock != null ? L.blocks[b.lock].color : null, mark: n > 0 ? n : null }), at = cellCenter(i, b.x, b.y);
    c.group.position.copy(at);
    scene.add(c.group);
    return { ...c, b, i, cur: at.clone(), target: at.clone(), vel: new THREE.Vector3(), path: [], lift: 0, liftV: 0, squash: 0, squashV: 0, tiltX: 0, tiltZ: 0, jig: 0, out: null, gone: false, trip: 0, lockK: 1 };
  });
  $('card').classList.remove('on');
  legend();
  ui();
  view = 'play';
  resize();
  sfx.jingle('start');
}

// setting a level up takes a moment (the camp and its builds made anew, then drawn: about a quarter of a second on a PC, a
// second on a phone) and the page stands still meanwhile (Oleg, 2026-11-07: "restart button freezes the game - add a
// loading indicator"): a spinner shows first, the work runs once it is on screen, and it goes after the new level's first
// frame. Tests (?playtest) run it at once
let busyNow = false;
function busy(fn) {
  if (playtest || film || cover) return fn();
  if (busyNow) return;
  busyNow = true;
  $('busy').classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try {
      fn();
      renderer.compile(scene, camera);
      renderer.render(scene, camera);
    } finally {
      requestAnimationFrame(() => {
        busyNow = false;
        $('busy').classList.remove('on');
      });
    }
  }));
}

// ---- the physical drag: the crate's footprint (in cells, fractions allowed) against walls, crates, the frame and gates ----

function occupancy(skip) {
  const occ = new Uint8Array(L.w * L.h), dark = darkMask(L, moves);
  if (dark) for (let k = 0; k < occ.length; k++) if (dark[k]) occ[k] = 3;   // the dark takes no crate
  for (const [x, y] of L.walls) occ[y * L.w + x] = 1;
  L.blocks.forEach((b, k) => {
    const p = pos[k];
    if (!p || k === skip) return;
    for (let j = 0; j < b.h; j++) for (let x = 0; x < b.w; x++) occ[(p[1] + j) * L.w + p[0] + x] = 2;
  });
  return occ;
}

// an open gate of the crate's colour on that side, wide enough and lined up with the crate
function throughGate(i, side, x, y) {
  const b = L.blocks[i], e = 0.08;
  return L.gates.some((g) => g.side === side && g.color === b.color && gateOpen(g, moves) && (side === 'left' || side === 'right' ? y >= g.at - e && y + b.h <= g.at + g.len + e : x >= g.at - e && x + b.w <= g.at + g.len + e));
}

function fits(i, x, y, occ) {
  const b = L.blocks[i], e = 1e-3;
  const x0 = Math.floor(x + e), x1 = Math.ceil(x + b.w - e) - 1, y0 = Math.floor(y + e), y1 = Math.ceil(y + b.h - e) - 1;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const ox = cx < 0 || cx >= L.w, oy = cy < 0 || cy >= L.h;
      if (ox && oy) return false;
      if (ox || oy) {
        if (!throughGate(i, cx < 0 ? 'left' : cx >= L.w ? 'right' : cy < 0 ? 'top' : 'bottom', x, y)) return false;
        continue;
      }
      if (occ[cy * L.w + cx]) return false;
    }
  }
  return true;
}

// how far along (dx, dy) the crate can go before touching something (all of it, or the part up to contact)
function sweep(i, x, y, dx, dy, occ) {
  if (fits(i, x + dx, y + dy, occ)) return 1;
  let lo = 0, hi = 1;
  for (let k = 0; k < 10; k++) {
    const m = (lo + hi) / 2;
    if (fits(i, x + dx * m, y + dy * m, occ)) lo = m;
    else hi = m;
  }
  return lo;
}

// pushed towards a gate of its colour and roughly in line with it (up to most of a cell either way: a crate held near one end
// is off by that much when the finger aims at the gate), the crate is pulled into line, so a crate as wide as the gate slips
// out without fiddling (Oleg: they passed "a little hard"; playtest 2026-10-24)
function gatePull(i, x, y, dx, dy, occ) {
  const b = L.blocks[i];
  for (const g of L.gates) {
    if (g.color !== b.color || !gateOpen(g, moves)) continue;
    const across = g.side === 'left' || g.side === 'right', span = across ? b.h : b.w;
    if (span > g.len) continue;
    // mainly towards it (a crate passing by the gate is not pulled into it)
    const main = across ? Math.abs(dx) >= Math.abs(dy) : Math.abs(dy) >= Math.abs(dx);
    const toward = main && (g.side === 'left' ? dx < 0 && x < 1.3 : g.side === 'right' ? dx > 0 && x + b.w > L.w - 1.3 : g.side === 'top' ? dy < 0 && y < 1.3 : dy > 0 && y + b.h > L.h - 1.3);
    if (!toward) continue;
    const p = across ? y : x, lo = g.at, hi = g.at + g.len - span;
    if (p < lo - 0.85 || p > hi + 0.85) continue;
    const d = clamp(clamp(Math.round(p), lo, hi) - p, -0.12, 0.12);   // onto a whole row in the opening (half in two rows would catch)
    if (d && (across ? fits(i, x, y + d, occ) : fits(i, x + d, y, occ))) return { x: across ? x : x + d, y: across ? y + d : y, across };
    return { x, y, across };
  }
  return null;
}

// one small step of the dragged crate towards the finger. Along its main way it follows the finger; across it, it keeps
// near its lane. Blocked ahead, it slips sideways into the open lane nearest the finger (a gap, a corridor round a corner:
// a finger that turns a little early or holds the crate off its middle still gets there, playtest 2026-10-24); with no
// lane open it slides along what blocks it. Pulled in line with its gate, the finger's sideways wobble no longer counts.
function slideStep(i, x, y, dx, dy, tx, ty, occ) {
  // a heavy crate on runners goes only along them (2026-10-28): the finger's other way does not count
  const axis = L.blocks[i].axis;
  if (axis === 'x') (dy = 0), (ty = y);
  if (axis === 'y') (dx = 0), (tx = x);
  const pull = gatePull(i, x, y, dx, dy, occ);
  if (pull) {
    ({ x, y } = pull);
    if (pull.across) dy = 0;
    else dx = 0;
  }
  const h = Math.abs(dx) >= Math.abs(dy), P = (a, c) => (h ? [a, c] : [c, a]);   // a: the main way, c: across it
  let a = h ? x : y, c = h ? y : x;
  const da = h ? dx : dy, dc = h ? dy : dx, tc = h ? ty : tx;
  const free = (a2, c2) => fits(i, ...P(a2, c2), occ), go = (sa, sc) => sweep(i, ...P(a, c), ...P(sa, sc), occ);
  if (!pull && !axis) {
    let lane = null;
    if (Math.abs(da) > 1e-3 && !free(a + da, c)) {
      // only a lane where the finger is (a lane a row away from it would carry the crate off past the finger)
      lane = [Math.floor(tc), Math.ceil(tc), Math.round(c)].sort((p, q) => Math.abs(p - tc) - Math.abs(q - tc)).find((l) => Math.abs(l - c) <= 1 && Math.abs(l - tc) < 0.75 && free(a + da, l));
      if (lane !== undefined) {
        const s = clamp(lane - c, -0.15, 0.15);
        c += s * go(0, s);
      }
    }
    if (lane === null || lane === undefined) {
      const s = clamp(Math.round(c) - c, -0.07, 0.07);
      if (s && lane === null && free(a, c + s)) c += s;
      c += dc * go(0, dc);
    }
  }
  a += da * go(da, 0);
  return P(a, c);
}

// move the dragged crate towards (tx, ty) in small steps
function slide(tx, ty) {
  const i = drag.i, occ = drag.occ;
  let { fx: x, fy: y } = drag, stuck = false;
  for (let n = 0; n < 60; n++) {
    const dx = clamp(tx - x, -0.2, 0.2), dy = clamp(ty - y, -0.2, 0.2);
    if (Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) break;
    const px = x, py = y;
    [x, y] = slideStep(i, x, y, dx, dy, tx, ty, occ);
    if (Math.abs(x - px) < 1e-4 && Math.abs(y - py) < 1e-4) {
      stuck = true;
      break;
    }
  }
  drag.fx = x;
  drag.fy = y;
  return stuck && Math.hypot(tx - x, ty - y) > 0.25;
}

function grab(i, gx, gy) {
  drag = { i, from: pos[i].slice(), before: pos.map((p) => (p ? p.slice() : null)), grabX: gx - pos[i][0], grabY: gy - pos[i][1], fx: pos[i][0], fy: pos[i][1], tx: pos[i][0], ty: pos[i][1], occ: occupancy(i), cell: pos[i].join() };
  crates[i].liftV += 2;
  sfx.play('pick', 0.5);
  if (L.blocks[i].axis) (blinkI = i), (blinkAt = t);
  // the hand (a hint, level 1's lesson) is done with once a crate is in hand
  $('hand').style.opacity = 0;
  hinted = null;
  if (!thinking) ember.close();
}

function steer(gx, gy) {
  if (!drag) return;
  drag.tx = gx - drag.grabX;
  drag.ty = gy - drag.grabY;
  if (drag.route) return;   // on its way round a corner by itself (follow)
  const blocked = slide(drag.tx, drag.ty);
  if (blocked && Math.hypot(drag.tx - drag.fx, drag.ty - drag.fy) > 0.6) drag.route = true;
  moved(blocked);
}

// stuck, with the finger on a cell the crate could reach by the most direct way there (a corner taken a little early, or a
// crate held off its middle, playtest 2026-10-24): it goes there by itself along the free cells, quickly but visibly. Never
// round an obstacle (a path longer than straight across and along), so a crate pushed past a rock still stops at it.
function follow(dt) {
  const i = drag.i, b = L.blocks[i], cx = Math.round(drag.fx), cy = Math.round(drag.fy);
  const gx = clamp(Math.round(drag.tx), 0, L.w - b.w), gy = clamp(Math.round(drag.ty), 0, L.h - b.h);
  const r = reach(L, pos, i, [cx, cy], darkMask(L, moves)), path = r.has(gx, gy) ? pathTo(r, gx, gy) : null;
  if (!path || path.length - 1 > Math.abs(gx - cx) + Math.abs(gy - cy)) {
    drag.route = false;
    noWay();
    return;
  }
  let budget = 12 * dt, k = 0;
  while (budget > 1e-4) {
    const onCell = Math.abs(drag.fx - path[k][0]) < 1e-3 && Math.abs(drag.fy - path[k][1]) < 1e-3;
    if (onCell && k === path.length - 1) break;
    const [wx, wy] = onCell ? path[++k] : path[k];
    const dx = clamp(wx - drag.fx, -budget, budget), mx = dx * sweep(i, drag.fx, drag.fy, dx, 0, drag.occ);
    drag.fx += mx;
    budget -= Math.abs(mx);
    const dy = clamp(wy - drag.fy, -budget, budget), my = dy * sweep(i, drag.fx, drag.fy, 0, dy, drag.occ);
    drag.fy += my;
    budget -= Math.abs(my);
    if (Math.abs(mx) + Math.abs(my) < 1e-4) break;
  }
  const done = Math.abs(drag.fx - gx) < 1e-3 && Math.abs(drag.fy - gy) < 1e-3;
  if (done) {
    drag.route = false;
    slide(drag.tx, drag.ty);   // and on to the finger (out through a gate, say)
  }
  moved(false);
}

// ---- the win's fireworks: bursts in the crews' colours over the camp for a few seconds ----
let celebrate = 0, nextBurst = 0;
function fireworks(dt) {
  if (celebrate <= 0) return;
  celebrate -= dt;
  if ((nextBurst -= dt) > 0) return;
  nextBurst = 0.18 + Math.random() * 0.22;
  const sites = Object.values(camp.sites), s = sites[Math.floor(Math.random() * sites.length)], colors = Object.keys(camp.sites);
  const color = parseInt(SUPPLY[colors[Math.floor(Math.random() * colors.length)]].flag.slice(1), 16);
  const x = (s ? s.pos.x * 0.7 : 0) + (Math.random() - 0.5) * 4, z = (s ? s.pos.z * 0.7 : 0) + (Math.random() - 0.5) * 4, y = 4.5 + Math.random() * 2;
  for (let k = 0; k < 40; k++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), sp = 3.4 + Math.random() * 1.4;
    fx.glow.spawn({ x, y, z, vx: Math.sin(b) * Math.cos(a) * sp, vy: Math.cos(b) * sp, vz: Math.sin(b) * Math.sin(a) * sp, life: 1.1 + Math.random() * 0.5, size: 0.32, color, alpha: 1, gravity: 1.4, drag: 1.1 });
  }
  fx.glow.spawn({ x, y, z, life: 0.35, size: 2.2, color: 0xfff2c8, alpha: 0.8 });   // the flash at its heart
  sfx.play('pick', 0.12, 2.2);
}

// ---- the first level teaches by doing: until the first crate is picked up, a hand drags the level's first move (its crate
// out through its gate, along its path), over and over; then, once a crate can go out round a corner and until the player
// has dragged one round a corner, that drag (playtest 2026-10-29: four of five players found corner drags by accident, level
// 4's card was the first to tell, and level 1's target needs them). Returns the crate's colour while the hand holds it (its
// lane lights, as for a player) ----
let handT = 0, cornerAt = -1, corner = null, turnedOnce = false;
// ---- the hint (playtest 2026-10-29, Leo, Dan, Jonas; benchmark 2026-11-07: help with one move during a level, not only "Show
// me" after it): the best next move from here, shown by the same hand, until a crate is picked up. On the level's own way
// that is its next move; off it, the solver works out the best way on in a worker (a big board takes seconds); with no way
// left in the moves there are, it says how far to undo ----
let hinted = null, hintAsk = 0, hintWorker = null, hintBusy = false;
const posKey = (p) => p.map((c) => (c ? c.join() : '-')).join(';');
// where the level's own way stands after k of its moves
function wayAt(k) {
  let p = startPos(L);
  for (const m of L.solution.slice(0, k)) {
    p = p.slice();
    p[m.i] = m.exit ? null : m.to;
  }
  return posKey(p);
}
// ---- Ember, the camp's helper (ember.js; 2026-11-07, Oleg: "its good AI vibe i want to enhance the AI look and feel"):
// asked, it thinks where it can be seen: sparks trace moves it could make over the board, a light sweeps the board, its card
// counts the positions the solver has looked at (the solver's own count). Then it answers: the move (a glowing copy of the
// crate shows it), what that leaves (the moves to finish, the stars still possible), why (from the rules: its crew's
// bedtime, a padlock it opens, a crate it clears the way for) and the camp's next bedtime or crew back late, no longer
// always in the hint line. It thinks for a second at least and at most 3 (1.2 on the level's own way, whose next move it
// then falls back on: always a way, at the target)
const ember = makeEmber($('ember'), q.has('playtest')), bubble = makeBubble($('hint'), $('hintBtn'), q.has('playtest'));
let thinking = null, emberUntil = 0;
$('ember').onclick = () => {
  if (thinking) return;
  hinted = null;
  ember.close();
};
function hint() {
  if (state !== 'play' || watching() || drag || q.has('proto') || thinking) return;
  const ask = ++hintAsk, at = posKey(pos) + '|' + moves, onWay = posKey(pos) === wayAt(moves), t0 = performance.now();
  hinted = null;
  emberUntil = 0;
  thinking = { next: 0, blip: 0, s: 0 };
  ember.think();
  const finish = (r) => {
    if (ask !== hintAsk) return;
    setTimeout(() => {
      if (ask !== hintAsk) return;
      thinking = null;
      if (at !== posKey(pos) + '|' + moves || state !== 'play') return ember.close();
      answer(r);
    }, q.has('playtest') ? 0 : Math.max(0, 1000 - (performance.now() - t0)));
  };
  const fallback = (r) => (r.move || !onWay ? r : { move: L.solution[moves], par: L.par, states: r.states });
  if (hintBusy) {
    hintWorker.terminate();
    hintWorker = null;
  }
  try {
    hintWorker ||= new Worker(new URL('./hint-worker.js', import.meta.url), { type: 'module' });
  } catch {
    return finish(fallback({ move: null, states: 0, capped: true }));
  }
  hintBusy = true;
  hintWorker.onmessage = ({ data }) => {
    if (data.ask !== hintAsk) return;
    if (data.progress != null) return ember.progress(data.progress);
    hintBusy = false;
    ember.progress(data.states);
    finish(fallback(data));
  };
  hintWorker.postMessage({ ask, level: L, pos, moves, aside: L.budget - moves - left(pos), secs: onWay ? 1.2 : 3 });
}
const crewName = (c, lower = false) => (lower ? CREW_NAME[c].replace(/^The/, 'the') : CREW_NAME[c]);
const movesWord = (n) => (n === 1 ? 'one move' : `${n} moves`);
// a crate in words: "the water crate", or with two or more of its colour on the board, which one, as the screen shows them
// (playtest 2026-11-07, Maya: "Move the water crate" with two water crates on the board)
function crateWords(i) {
  const b = L.blocks[i], name = SUPPLY[b.color].name, twins = pos.map((p, j) => (p && j !== i && L.blocks[j].color === b.color ? j : -1)).filter((j) => j >= 0);
  if (!twins.length) return `the ${name} crate`;
  const mid = (j) => [pos[j][0] + L.blocks[j].w / 2, pos[j][1] + L.blocks[j].h / 2], [x, y] = mid(i);
  if (twins.length === 1) {
    const [ox, oy] = mid(twins[0]), dx = x - ox, dy = y - oy;
    return `the ${Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom'} ${name} crate`;
  }
  const col = x < L.w / 3 ? 'left' : x > (2 * L.w) / 3 ? 'right' : '', row = y < L.h / 3 ? 'top' : y > (2 * L.h) / 3 ? 'bottom' : '';
  return `the ${name} crate ${row || col ? `at the ${[row, col].filter(Boolean).join(' ')}` : 'in the middle'}`;
}
function answer(r) {
  if (!r.move) return offWay(r.capped);
  const m = r.move, which = crateWords(m.i), more = r.par - moves, stars = starsFor(r.par), why = reasonFor(m);
  hinted = { m, at: moves, until: t + 14 };
  // (and where it ends stays outlined until the board changes: board.aim)
  aimed = m.exit ? null : { m, key: posKey(pos) };
  ember.answer({
    // (where it goes: the glowing copy glides there and waits; it read as a stop on the way, playtest 2026-11-07, Maya)
    say: m.exit ? `Move ${which} out through its gate.` : `Move ${which} to the outlined spot, where its glowing copy stops.`,
    facts: `Best from here: ${more} more move${more === 1 ? '' : 's'} · ${stars === 3 ? '★★★ still possible' : stars === 2 ? 'now ★★ at best' : 'now ★ at best'}`,
    why: [why.text, headsUp(why.crew)].filter(Boolean).join(' '),
  });
  sfx.chime([784, 1047, 1319], 0.06, 0.8);
}
// why this move, from the rules: its crew's bedtime close, the key it holds, a crate it opens the way for; else what it is
function reasonFor(m) {
  const b = L.blocks[m.i], name = SUPPLY[b.color].name;
  const bed = L.gates.filter((g) => g.color === b.color && g.closeAt > moves).sort((a, c) => a.closeAt - c.closeAt)[0];
  if (m.exit && bed && bed.closeAt - moves <= 3) return { text: `${crewName(b.color)} goes to bed in ${movesWord(bed.closeAt - moves)}, so the ${name} goes first.`, crew: b.color };
  const opens = L.blocks.findIndex((o, k) => o.lock === m.i && pos[k]);
  if (m.exit && opens >= 0) return { text: `It holds the key to the padlocked ${SUPPLY[L.blocks[opens].color].name} crate.` };
  const after = pos.map((p) => p && p.slice());
  after[m.i] = m.exit ? null : m.to.slice();
  const freed = L.blocks.findIndex((o, k) => k !== m.i && pos[k] && !exitSpot(L, pos, k, darkMask(L, moves), moves) && exitSpot(L, after, k, darkMask(L, moves + 1), moves + 1));
  if (freed >= 0) return { text: `That opens the way out for the ${SUPPLY[L.blocks[freed].color].name} crate.` };
  return { text: m.exit ? 'Nothing stands in its way: it can go out now.' : 'Parked there, it keeps the way clear for the next moves.' };
}
// the camp's next deadline: a crew back late, or the next crew to bed with crates still to come (not one the why named)
function headsUp(said) {
  const due = (k) => L.gates.filter((g) => g[k] > moves && pos.some((p, j) => p && L.blocks[j].color === g.color)).sort((a, c) => a[k] - c[k])[0];
  const bed = due('closeAt'), late = due('openAt');
  if (late && (!bed || late.openAt <= bed.closeAt)) return `Heads-up: ${crewName(late.color, true)} is back in ${movesWord(late.openAt - moves)}.`;
  if (bed && bed.color !== said) return `Heads-up: ${crewName(bed.color, true)} goes to bed in ${movesWord(bed.closeAt - moves)}.`;
  return '';
}
// no way on from here in the moves left (or none found in time): back to the last point on the level's own way
function offWay(unsure) {
  const { back, restart, el } = backToWay();
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
  emberUntil = t + 8;
  ember.answer({
    state: unsure ? 'not sure' : 'no way left',
    say: unsure ? 'I can’t find a sure way on from here.' : 'There is no way to finish from here in the moves left.',
    facts: restart ? 'Restart to try again.' : `Undo ${movesWord(back)} to get back on track.`,
    why: headsUp(null),
  });
  sfx.chime([523, 440], 0.05, 0.6);
}
// how far back the last point on the level's own way is (a sure way on from there), and the button that gets there
function backToWay() {
  let k = moves - 1;
  while (k > 0 && posKey(hist[k]) !== wayAt(k)) k--;
  const back = moves - Math.max(k, 0), restart = back === moves && back > 3;
  return { back, restart, el: restart ? $('restart') : $('undo') };
}
// ---- a look ahead after every move (playtest 2026-11-07, Jonas and Maya: a crew could no longer make bedtime, and they
// found out moves later, when its gate shut): a crew with more crates on the board than moves to its bedtime is told at once;
// otherwise, off the level's own way, the solver looks for any way to finish in the moves left (in a worker, a second or two)
// and, finding none, Ember says so unasked and Undo pulses. A search cut short by its time says nothing ----
let lookWorker = null, lookAsk = 0, lookBusy = false, warned = null;
function lookAhead() {
  const ask = ++lookAsk, at = posKey(pos) + '|' + moves;
  if (state !== 'play' || watching() || q.has('proto') || warned === at) return;
  for (const color of new Set(L.gates.filter((g) => g.closeAt > moves).map((g) => g.color))) {
    const gates = L.gates.filter((g) => g.color === color);
    if (gates.some((g) => g.closeAt == null)) continue;
    const n = pos.filter((p, j) => p && L.blocks[j].color === color).length;
    if (n > Math.max(...gates.map((g) => g.closeAt)) - moves) return stuck(at, color);
  }
  if (posKey(pos) === wayAt(moves)) return;
  if (lookBusy) {
    lookWorker.terminate();
    lookWorker = null;
  }
  try {
    lookWorker ||= new Worker(new URL('./hint-worker.js', import.meta.url), { type: 'module' });
  } catch {
    return;
  }
  lookBusy = true;
  lookWorker.onmessage = ({ data }) => {
    if (data.progress != null || data.ask !== lookAsk) return;
    lookBusy = false;
    if (!data.move && !data.capped && at === posKey(pos) + '|' + moves && state === 'play' && !drag) stuck(at, null);
  };
  lookWorker.postMessage({ ask, level: L, pos, moves, aside: L.budget - moves - left(pos), secs: LOW ? 1.2 : 2 });
}
function stuck(at, color) {
  warned = at;
  const { back, restart, el } = backToWay();
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
  const fix = restart ? 'Restart to try again.' : back === 1 ? 'Undo takes the last move back.' : `Undo ${movesWord(back)} to get back on track.`;
  say(color ? `${crewName(color)} can’t get every ${SUPPLY[color].name} crate out before bed now. ${fix}` : `No way to finish from here now. ${fix}`, 8);
  note.warn = true;
  sfx.chime([523, 440], 0.05, 0.6);
}
// thinking, seen: sparks trace a move it could make, again and again; a band of light sweeps the board; soft blips
let scanBand = null;
function emberThink(dt) {
  if ((thinking.next -= dt) <= 0) {
    thinking.next = 0.11;
    const live = pos.map((p, i) => (p && !locked(L, pos, i) ? i : -1)).filter((i) => i >= 0), i = live[Math.floor(Math.random() * live.length)];
    if (i != null) {
      const r = reach(L, pos, i, pos[i], darkMask(L, moves)), c = r.cells.length > 1 && r.cells[1 + Math.floor(Math.random() * (r.cells.length - 1))];
      if (c) pathTo(r, c[0], c[1]).forEach(([x, y], k) => {
        const at = cellCenter(i, x, y);
        fx.glow.spawn({ x: at.x, y: 0.72, z: at.z, life: 0.3 + k * 0.06, size: 0.26, color: 0x7fe6ff, alpha: 0.85 });
      });
    }
  }
  if ((thinking.blip -= dt) <= 0) {
    thinking.blip = 0.32;
    sfx.chime([1318], 0.022, 0.12);
  }
  if (!scanBand) {
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 64;
    const g = cv.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#000');
    grad.addColorStop(0.5, '#fff');
    grad.addColorStop(1, '#000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    scanBand = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, alphaMap: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
    scanBand.renderOrder = 5;
    scene.add(scanBand);
  }
  thinking.s = (thinking.s + dt / 0.9) % 1;
  scanBand.scale.set(L.w + 0.4, 1, 1);
  scanBand.position.set(board.ox + L.w / 2, 0.74, board.oz - 0.45 + thinking.s * (L.h + 0.9));
}
// the hinted move shown by a glowing copy of its crate gliding its way, out through the gate too, over and over
let ghostT = 0, ghostOf = null, ghostObj = null;
// (a plain cyan tint: added light washed out over the pale floor)
const holo = new THREE.MeshBasicMaterial({ color: 0x3fd4ff, transparent: true, opacity: 0.62, depthWrite: false });
let ghostSpark = 0;
function ghost(dt, m) {
  if (!m) {
    if (ghostObj) scene.remove(ghostObj);
    ghostObj = ghostOf = null;
    return;
  }
  if (ghostOf !== m) {
    if (ghostObj) scene.remove(ghostObj);
    ghostObj = crates[m.i].group.clone(true);
    ghostObj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = holo;
      o.castShadow = o.receiveShadow = false;
    });
    scene.add(ghostObj);
    ghostOf = m;
    ghostT = 0;
    crates[m.i].squashV += 4.5;
  }
  const pts = pathTo(reach(L, pos, m.i, pos[m.i], darkMask(L, moves)), m.to[0], m.to[1]).map(([x, y]) => cellCenter(m.i, x, y));
  if (m.exit) {
    const o = OUT[exitGate(L, m.i, m.to[0], m.to[1], moves).side];
    pts.push(pts[pts.length - 1].clone().add(new THREE.Vector3(o[0] * 1.3, 0, o[1] * 1.3)));
  }
  // it glides (0.35-1.85 s), then waits where the move ends for a second before it fades (it used to fade as it arrived: the
  // spot read as a stop on the way, playtest 2026-11-07, Maya); the real crate stretches up at the start (no thud, unlike a
  // hop), so it is plain which one
  const was = ghostT;
  ghostT = (ghostT + dt) % 3.4;
  if (ghostT < was) crates[m.i].squashV += 4.5;
  const lens = pts.slice(1).map((p, k) => p.distanceTo(pts[k])), all = lens.reduce((a, c) => a + c, 0) || 1;
  let left = Math.min(1, Math.max(0, (ghostT - 0.35) / 1.5)) * all, k = 0;
  while (k < lens.length - 1 && left > lens[k]) left -= lens[k++];
  const at = lens.length ? pts[k].clone().lerp(pts[k + 1], lens[k] ? Math.min(1, left / lens[k]) : 0) : pts[0];
  ghostObj.position.set(at.x, 0.08 + 0.04 * Math.sin(ghostT * 7), at.z);
  const fade = ghostT < 0.3 ? ghostT / 0.3 : ghostT > 2.9 ? Math.max(0, 1 - (ghostT - 2.9) / 0.45) : 1;
  holo.opacity = 0.62 * fade;
  // a trail of sparks behind it as it glides
  if ((ghostSpark -= dt) <= 0 && fade > 0.5 && ghostT > 0.35 && ghostT < 1.85) {
    ghostSpark = 0.06;
    fx.glow.spawn({ x: at.x + (Math.random() - 0.5) * 0.4, y: 0.45 + Math.random() * 0.3, z: at.z + (Math.random() - 0.5) * 0.4, life: 0.5, size: 0.2, color: 0x9ff3ff, alpha: 0.75 });
  }
}
// a crate that can go out now round at least one corner: the shortest such drag, or null
function cornerMove() {
  if (cornerAt === moves) return corner;
  cornerAt = moves;
  corner = null;
  const mask = darkMask(L, moves);
  L.blocks.forEach((b, i) => {
    if (!pos[i]) return;
    const r = reach(L, pos, i, pos[i], mask);
    for (const c of r.cells) {
      const g = exitGate(L, i, c[0], c[1], moves);
      if (!g) continue;
      const path = pathTo(r, c[0], c[1]), dirs = path.slice(1).map((p, k) => [p[0] - path[k][0], p[1] - path[k][1]]).concat([OUT[g.side]]);
      const turns = dirs.some((d, k) => k && (d[0] !== dirs[k - 1][0] || d[1] !== dirs[k - 1][1]));
      if (turns && (!corner || path.length < corner.len)) corner = { i, to: c, exit: true, len: path.length };
    }
  });
  return corner;
}
function teach(dt) {
  if (hinted && (drag || hinted.at !== moves || t > hinted.until || state !== 'play')) {
    hinted = null;
    if (!thinking) ember.close();
  }
  if (!hinted && !thinking && emberUntil && t > emberUntil) {
    emberUntil = 0;
    ember.close();
  }
  const free = !drag && state === 'play' && !watching() && !$('howto').classList.contains('on'), el = $('hand');
  // a hint: the glowing copy of its crate, the crate's lane lit
  ghost(dt, free && hinted ? hinted.m : null);
  if (free && hinted) {
    el.style.opacity = 0;
    handT = 0;
    return L.blocks[hinted.m.i].color;
  }
  // level 1's lesson: the hand
  const m = free && levelIndex === 0 && !q.has('proto') && (moves === 0 ? L.solution[0] : !turnedOnce ? cornerMove() : null);
  if (!m) {
    el.style.opacity = 0;
    handT = 0;
    return null;
  }
  const b = L.blocks[m.i], p = pos[m.i];
  const pts = [[p[0], p[1]], ...pathTo(reach(L, pos, m.i, p, darkMask(L, moves)), m.to[0], m.to[1]).slice(1)].map(([x, y]) => [x + b.w / 2, y + b.h / 2]);
  if (m.exit) {
    const o = OUT[exitGate(L, m.i, m.to[0], m.to[1], moves).side], e = pts[pts.length - 1];
    pts.push([e[0] + o[0] * 0.9, e[1] + o[1] * 0.9]);
  }
  handT = (handT + dt) % 3.2;
  const u = handT < 0.5 ? 0 : Math.min(1, (handT - 0.5) / 1.5), lens = pts.slice(1).map((q, k) => Math.hypot(q[0] - pts[k][0], q[1] - pts[k][1])), all = lens.reduce((a, c) => a + c, 0) || 1;
  let left = u * all, k = 0;
  while (k < lens.length - 1 && left > lens[k]) left -= lens[k++];
  const a = pts[k], c = pts[Math.min(k + 1, pts.length - 1)], f = lens[k] ? left / lens[k] : 0;
  const [sx, sy] = window.BD3.screen(a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f);
  const press = handT > 0.3 && handT < 2.1, alpha = handT < 0.25 ? handT / 0.25 : handT > 2.1 ? Math.max(0, 1 - (handT - 2.1) / 0.4) : 1;
  el.style.opacity = alpha;
  el.style.transform = `translate(${sx - 14}px, ${sy - 6}px) scale(${press ? 0.9 : 1.05})`;
  return press ? b.color : null;
}

// pulled against something it cannot pass: the crate shakes with a knock, and what stops it (a crate, a rock, the frame)
// flashes red (playtest 2026-10-24: a blocked crate just did nothing, "it feels broken")
let lastNoWay = 0;
// a word in the hint line for a moment, in game time (a still picture just after still has it): why a drag was refused, the
// hint
let note = null;
function say(text, secs = 2.6, hint = false) {
  note = text ? { text, until: t + secs, hint } : null;
  ui();
}
// a padlocked crate tried: its padlock rattles, and the hint names the crate with its key for a moment
function rattle(i) {
  const key = L.blocks[L.blocks[i].lock];
  crates[i].jig = 1;
  sfx.play('bump', 0.35, 1.6);
  const p = pos[i], b = L.blocks[i], cells = [];
  for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) cells.push([p[0] + k, p[1] + j]);
  board.flash(cells);
  // (which one, with two of the key's colour on the board: playtest 2026-11-09, Dan, levels 16 and 20, "a coin flip")
  say(`Padlocked: its key is in ${crateWords(L.blocks[i].lock)}`);
}

function noWay() {
  if (!drag || t - lastNoWay < 0.7) return;
  const i = drag.i, b = L.blocks[i], dx = drag.tx - drag.fx, dy = drag.ty - drag.fy;
  if (Math.hypot(dx, dy) < 0.45) return;
  lastNoWay = t;
  // a heavy crate pulled across its skids
  if (b.axis && (b.axis === 'x' ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) > Math.abs(dy))) {
    crates[i].jig = 1;
    sfx.play('bump', 0.22, 0.85);
    (blinkI = i), (blinkAt = t);
    return say('Heavy crate: it slides only along its skids');
  }
  const x0 = Math.round(drag.fx), y0 = Math.round(drag.fy), cells = [];
  if (Math.abs(dx) >= Math.abs(dy)) for (let k = 0; k < b.h; k++) cells.push([dx > 0 ? x0 + b.w : x0 - 1, y0 + k]);
  else for (let k = 0; k < b.w; k++) cells.push([x0 + k, dy > 0 ? y0 + b.h : y0 - 1]);
  const hit = cells.filter(([x, y]) => x < 0 || y < 0 || x >= L.w || y >= L.h || drag.occ[y * L.w + x]);
  if (!hit.length) return;
  board.flash(hit);
  for (const [x, y] of hit) {
    const j = blockAt(x, y);
    if (j >= 0 && j !== i) crates[j].jig = 1;
  }
  crates[i].jig = 1;
  crates[i].squashV -= 1;
  sfx.play('bump', 0.22, 0.85);
  if (hit.some(([x, y]) => /rock|stump/.test(blockerName(x, y) || ''))) tipRocks();
  // into the frame where a gate is: why it would not let the crate out (playtest 2026-10-29 and benchmark 2026-11-07: a drag
  // into the wrong gate did nothing anyone could see)
  const edge = hit.find(([x, y]) => x < 0 || y < 0 || x >= L.w || y >= L.h);
  if (!edge) return;
  const side = edge[0] < 0 ? 'left' : edge[0] >= L.w ? 'right' : edge[1] < 0 ? 'top' : 'bottom', across = side === 'left' || side === 'right';
  const lo = across ? y0 : x0, hi = lo + (across ? b.h : b.w), here = L.gates.filter((g) => g.side === side && g.at < hi && g.at + g.len > lo);
  const mine = here.find((g) => g.color === b.color);
  if (mine && mine.openAt > moves) say(`${CREW_NAME[b.color]} is not back yet`);
  else if (mine && b.axis && (b.axis === 'x') !== across) ((blinkI = i), (blinkAt = t), say('Heavy crates leave only along their skids'));
  else if (mine && (across ? b.h : b.w) > mine.len) say('Too wide for this gate');
  else if (mine) say('Line it up with its gate');
  else if (here.length) say(`Not this gate: this crate goes out by the ${b.color} flags`);
}

function moved(blocked) {
  const i = drag.i, b = L.blocks[i], c = crates[i];
  if (blocked && !drag.route) noWay();
  c.target.copy(cellCenter(i, drag.fx, drag.fy));
  // how far this drag has taken it each way (to tell a crate brought up to its gate from one that passes by)
  const ext = (drag.ext ||= { x0: drag.from[0], x1: drag.from[0], y0: drag.from[1], y1: drag.from[1] });
  ext.x0 = Math.min(ext.x0, drag.fx);
  ext.x1 = Math.max(ext.x1, drag.fx);
  ext.y0 = Math.min(ext.y0, drag.fy);
  ext.y1 = Math.max(ext.y1, drag.fy);
  if (ext.x1 - ext.x0 > 0.6 && ext.y1 - ext.y0 > 0.6) turnedOnce = true;   // round a corner (level 1's lesson is learnt)
  // a soft tick each time it crosses into another cell; a knock when it runs into something
  const cell = `${Math.round(drag.fx)},${Math.round(drag.fy)}`;
  if (cell !== drag.cell) {
    drag.cell = cell;
    sfx.cellTick(c.vel.length());
  }
  if (blocked && t - lastBump > 0.3 && c.vel.length() > 1.2) {
    lastBump = t;
    sfx.play('bump', clamp(c.vel.length() * 0.08, 0.15, 0.45));
    c.squashV -= 1.5;
    c.jig = 1;
  }
  // out through its gate: past the edge by more than half its depth (at most 3/4 of a cell, for the long crates)
  const dw = Math.min(b.w * 0.55, 0.75), dh = Math.min(b.h * 0.55, 0.75);
  const side = drag.fx < -dw ? 'left' : drag.fx > L.w - b.w + dw ? 'right' : drag.fy < -dh ? 'top' : drag.fy > L.h - b.h + dh ? 'bottom' : null;
  if (side) {
    const x = side === 'left' ? 0 : side === 'right' ? L.w - b.w : Math.round(drag.fx), y = side === 'top' ? 0 : side === 'bottom' ? L.h - b.h : Math.round(drag.fy);
    const gate = exitGate(L, i, x, y, moves);
    if (gate) {
      const { from, before } = drag;
      pos[i] = [x, y];
      drag = null;
      deliver(i, gate);
      endMove(i, from, before);
    }
  }
}

// where the held crate settles if let go now: the nearest free cell (the footprint is free, so a rounding of it is too)
function settleSpot() {
  const { i, from, occ } = drag, b = L.blocks[i];
  const cands = [[Math.round(drag.fx), Math.round(drag.fy)], [Math.floor(drag.fx), Math.floor(drag.fy)], [Math.ceil(drag.fx), Math.ceil(drag.fy)], [Math.floor(drag.fx), Math.ceil(drag.fy)], [Math.ceil(drag.fx), Math.floor(drag.fy)]]
    .map(([x, y]) => [clamp(x, 0, L.w - b.w), clamp(y, 0, L.h - b.h)]);
  return cands.find(([x, y]) => fits(i, x, y, occ)) || from;
}

// what stands on a cell, in words: a rock, a stump, the pond, a crate; null if nothing (or off the board)
function blockerName(x, y) {
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return null;
  if ((L.pond || []).some(([px, py]) => px === x && py === y)) return 'the pond';
  if (L.walls.some(([wx, wy]) => wx === x && wy === y)) return wallModel(x, y).startsWith('stump') ? 'a stump' : 'a rock';
  const j = blockAt(x, y);
  return j >= 0 ? `the ${SUPPLY[L.blocks[j].color].name} crate` : null;
}
// the first time a crate runs into a rock or a stump: what they are, there and then (playtest 2026-11-07, Ruth, Jonas, Leo:
// level 3 needed it, level 4's card said it)
function tipRocks() {
  if (watching()) return;
  try {
    if (store.getItem('bd3.tipRocks') === '1' && !playtest) return;
    store.setItem('bd3.tipRocks', '1');
  } catch {}
  say('Rocks and stumps never move: drag round them. Corners and all, it is one move', 5);
}
// let go short of the finger, stopped by something on the way: the drag still counts, so say what stopped it, flash it, and
// point at Undo (playtest 2026-11-07, Leo: two drags fell short on level 6 with no sign why, and bedtime came)
function stoppedShort(i, spot, tx, ty) {
  const b = L.blocks[i], dx = tx - spot[0], dy = ty - spot[1];
  if (Math.hypot(dx, dy) < 1.4) return;
  const cells = [];
  if (Math.abs(dx) >= Math.abs(dy)) for (let k = 0; k < b.h; k++) cells.push([dx > 0 ? spot[0] + b.w : spot[0] - 1, spot[1] + k]);
  else for (let k = 0; k < b.w; k++) cells.push([spot[0] + k, dy > 0 ? spot[1] + b.h : spot[1] - 1]);
  const hit = cells.filter(([x, y]) => blockerName(x, y));
  if (!hit.length) return;
  board.flash(hit);
  const what = blockerName(...hit[0]), el = $('undo');
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
  say(`Stopped by ${what}. It still counts as a move: Undo gives it back`, 4);
  note.drag = true;
  if (what === 'a rock' || what === 'a stump') try {
    store.setItem('bd3.tipRocks', '1');
  } catch {}
}

function release() {
  if (!drag) return;
  const { i, from, before } = drag, spot = settleSpot();
  // let go in front of its own gate after bringing it there, or while still pushing into it: out it goes (a finger aims at
  // the flags, which stand above the ground, so on the near side it lets go a row short; playtest 2026-10-24)
  const gate = exitGate(L, i, spot[0], spot[1], moves);
  if (gate) {
    const [ox, oy] = OUT[gate.side], push = (drag.tx - drag.fx) * ox + (drag.ty - drag.fy) * oy;
    // how far it came towards the gate from the farthest this drag took it the other way
    const e = drag.ext || { x0: from[0], x1: from[0], y0: from[1], y1: from[1] };
    const came = ox < 0 ? e.x1 - spot[0] : ox > 0 ? spot[0] - e.x0 : oy < 0 ? e.y1 - spot[1] : spot[1] - e.y0;
    const into = (drag.fx - spot[0]) * ox + (drag.fy - spot[1]) * oy;   // already partly out through it
    if (push > 0.15 || came >= 0.9 || into > 0.1) {
      drag = null;
      pos[i] = spot.slice();
      deliver(i, gate);
      endMove(i, from, before);
      return;
    }
  }
  const { tx, ty } = drag;
  drag = null;
  pos[i] = spot.slice();
  crates[i].target.copy(cellCenter(i, spot[0], spot[1]));
  if ((spot[0] !== from[0] || spot[1] !== from[1]) && !watching()) stoppedShort(i, spot, tx, ty);
  endMove(i, from, before);
}

// ---- the rules' bookkeeping (the 2D prototype's) ----

function blockAt(cx, cy) {
  for (let i = 0; i < L.blocks.length; i++) {
    const p = pos[i], b = L.blocks[i];
    if (p && cx >= p[0] && cx < p[0] + b.w && cy >= p[1] && cy < p[1] + b.h) return i;
  }
  return -1;
}

// a finger is wider than a phone's cell: a touch just beside a crate still picks it up
function crateNear(gx, gy, tolerance = 0.4) {
  let best = -1, bd = tolerance;
  pos.forEach((p, i) => {
    if (!p) return;
    const b = L.blocks[i], dx = Math.max(p[0] - gx, 0, gx - (p[0] + b.w)), dy = Math.max(p[1] - gy, 0, gy - (p[1] + b.h)), d = Math.hypot(dx, dy);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

function deliver(i, gate) {
  const c = crates[i], b = L.blocks[i], o = OUT[gate.side], s = spots[b.color];
  const reachOut = (o[0] ? b.w : b.h) / 2 + 0.5, last = cellCenter(i, pos[i][0], pos[i][1]);
  c.trip++;
  c.out = { phase: 'slide', to: last.clone().add(new THREE.Vector3(o[0] * reachOut, 0, o[1] * reachOut)), t: 0, trip: c.trip, slot: s.waitingCount = (s.waitingCount || 0) + 1 };
  pos[i] = null;
}

function endMove(i, from, before) {
  const p = pos[i];
  if (p && p[0] === from[0] && p[1] === from[1]) return;
  hist.push(before);
  moves++;
  firstMove = false;
  const lost = [...stranded(L, pos, moves), ...lostCrates(L, pos, moves)];
  if (lost.length) {
    // a crew went to bed with its crates still on the board: they can never reach it now, and the camp will not be ready
    state = 'lost';
    lostTo = lost[0];
    sfx.play('heavy', 0.35, 0.55);
    endAt = t + 3.4;   // time to see the worker shut the gate
  } else if (!left(pos)) {
    state = 'won';
    wonAt = t;
    if (!q.has('proto') && !watching()) {
      reached = Math.max(reached, Math.min(levelIndex + 1, LIST.length - 1));
      const had = earned(starTotal()), before = best[levelIndex] || 0;
      best[levelIndex] = Math.max(before, starsFor(moves));
      gained = best[levelIndex] - before;
      fresh = earned(starTotal()).filter((id) => !had.includes(id));
      try {
        store.setItem('bd3.reached', String(reached));
        store.setItem('bd3.stars', JSON.stringify(best));
      } catch {}
    }
  } else if (moves >= L.budget) {
    state = 'lost';
    endAt = t + 1.6;
  }
  ui();
  lookAhead();
}

function undo() {
  if (!hist.length || drag || !(state === 'play' || (state === 'lost' && lostTo !== null))) return;
  if (state === 'lost') {
    // out of the dark again: the move that lost the crate is taken back
    state = 'play';
    lostTo = null;
    endAt = 0;
    setView('play');
    $('card').classList.remove('on');

  }
  const before = hist.pop();
  moves--;
  before.forEach((p, i) => {
    const c = crates[i];
    if (!p) return;
    if (!pos[i]) {   // a delivered crate comes back: it drops onto its old cell; its worker drops the job, its building steps back
      if (c.api) camp.cancel(L.blocks[i].color, c.api);
      c.api = null;
      c.trip++;   // a pending unpack for its earlier trip no longer applies
      c.gone = false;
      c.out = null;
      c.group.visible = true;
      c.group.scale.setScalar(1);
      c.body.rotation.set(0, 0, 0);
      c.cur.copy(cellCenter(i, p[0], p[1]));
      c.target.copy(c.cur);
      c.vel.set(0, 0, 0);
      c.path = [];
      c.lift = 1.1;
      c.liftV = 0;
      const s = spots[L.blocks[i].color];
      s.waitingCount = Math.max(0, (s.waitingCount || 1) - 1);
    } else if (pos[i][0] !== p[0] || pos[i][1] !== p[1]) {
      const r = reach(L, pos, i);
      c.path = r.has(p[0], p[1]) ? pathTo(r, p[0], p[1]).slice(1).map(([x, y]) => cellCenter(i, x, y)) : [cellCenter(i, p[0], p[1])];
      c.target.copy(cellCenter(i, p[0], p[1]));   // where it rests afterwards (it went back to the drag's end: playtest 2026-10-24)
    }
  });
  pos = before.map((p) => (p ? p.slice() : null));
  // Ember's answer was for the board before the undo: it goes (a search under way finds the board changed and closes;
  // playtest 2026-11-07, Maya: the card still said "goes to bed in 2 moves" after Undo, the gate said 4)
  hinted = null;
  emberUntil = 0;
  if (!thinking) ember.close();
  // (and a warning, or a word about the drag just undone, was about the board before it too)
  if (note && (note.warn || note.drag)) note = null;
  sfx.play('pick', 0.4, 0.9);
  sfx.whoosh(false, 0.14);
  ui();
  lookAhead();
}

// ---- input: the pointer on the board's plane, in cells ----

const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3), hitP = new THREE.Vector3(), ndc = new THREE.Vector2();
function gridAt(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.ray.intersectPlane(plane, hitP)) return null;
  return { x: hitP.x - board.ox, y: hitP.z - board.oz };
}

const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  sfx.wake();
  if (state !== 'play' || watching() || drag) return;
  const g = gridAt(e);
  let i = g ? blockAt(Math.floor(g.x), Math.floor(g.y)) : -1;
  if (g && i < 0) i = crateNear(g.x, g.y);
  if (i < 0) {
    const tag = tagAt(e);
    if (tag) explainTag(tag);
    return;
  }
  if (locked(L, pos, i)) return rattle(i);
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  grab(i, g.x, g.y);
  pointerLook(e);
});
// a tap on a countdown tag over a gate: what it counts (playtest 2026-11-09, Dan, level 19: tapping it did nothing, and
// which crew was late and which early was a guess)
function tagAt(e) {
  const r = canvas.getBoundingClientRect(), reach = Math.max(28, r.height * 0.045);
  for (const tag of camp.tags()) {
    const p = tag.at.clone().project(camera), sx = r.left + ((p.x + 1) / 2) * r.width, sy = r.top + ((1 - p.y) / 2) * r.height;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < reach) return tag;
  }
  return null;
}
function explainTag(tag) {
  sfx.play('pick', 0.2, 1.6);
  say(tag.late ? `${crewName(tag.color)} is out in the forest, back in ${movesWord(tag.n)}: their gate opens then` : `${crewName(tag.color)} goes to bed in ${movesWord(tag.n)}: their gate shuts then`, 4);
}
// a mouse over a crate it can take: an open hand, a closed one while dragging, "no" over a padlocked crate (Oleg,
// 2026-11-07: "on desktop the cursor is not indicating that draggable option is available")
function pointerLook(e) {
  let look = '';
  if (drag) look = 'grabbing';
  else if (e.pointerType === 'mouse' && state === 'play' && !watching()) {
    const g = gridAt(e);
    let i = g ? blockAt(Math.floor(g.x), Math.floor(g.y)) : -1;
    if (g && i < 0) i = crateNear(g.x, g.y);
    if (i >= 0) look = locked(L, pos, i) ? 'not-allowed' : 'grab';
    else if (tagAt(e)) look = 'help';
  }
  if (canvas.style.cursor !== look) canvas.style.cursor = look;
}
canvas.addEventListener('pointermove', (e) => {
  pointerLook(e);
  if (!drag) return;
  const g = gridAt(e);
  if (g) steer(g.x, g.y);
});
for (const type of ['pointerup', 'pointercancel']) {
  canvas.addEventListener(type, (e) => {
    release();
    pointerLook(e);
  });
}
canvas.addEventListener('pointerleave', () => !drag && (canvas.style.cursor = ''));
window.addEventListener('contextmenu', (e) => e.preventDefault());
$('restart').onclick = () => {
  sfx.wake();
  showing = false;   // (a "Show me" skipped, then Restart: the player's own try, not the replay again)
  busy(load);
};
$('undo').onclick = () => {
  sfx.wake();
  undo();
};
$('hintBtn').onclick = () => {
  sfx.wake();
  if (!showing) return hint();
  skipCard();
};
// settings (playtest 2026-10-28: published games all have sound and music apart, and a panel): sound, music, how to play,
// restart
function settingsUi() {
  for (const [id, on] of [['setSound', sfx.soundOn()], ['setMusic', sfx.musicOn()]]) {
    $(id).classList.toggle('off', !on);
    $(id).querySelector('b').textContent = on ? 'on' : 'off';
  }
}
$('gear').onclick = () => {
  sfx.wake();
  settingsUi();
  $('settings').classList.add('on');
};
$('setSound').onclick = () => {
  sfx.wake();
  sfx.setSound(!sfx.soundOn());
  settingsUi();
};
$('setMusic').onclick = () => {
  sfx.wake();
  sfx.setMusic(!sfx.musicOn());
  settingsUi();
};
$('setHelp').onclick = () => {
  $('settings').classList.remove('on');
  $('howto').classList.add('on');
};
$('setRestart').onclick = () => {
  $('settings').classList.remove('on');
  showing = false;
  busy(load);
};
$('setClose').onclick = () => $('settings').classList.remove('on');
$('settings').onclick = (e) => e.target === $('settings') && $('settings').classList.remove('on');
$('howtoGo').onclick = () => {
  sfx.wake();
  $('howto').classList.remove('on');
  try {
    store.setItem('bd.howto', '1');
  } catch {}
};
// the weather button is for reviews only (?review); players get each level's own weather
if (!q.has('review')) $('pills').style.display = 'none';
// iPhones: sound starts (and comes back after a call or another app) only inside a touch's end or a click
for (const type of ['touchend', 'click']) document.addEventListener(type, () => sfx.wake(), { passive: true });
// the mouse wheel never scrolls the page round the game (2026-11-09, playtest on the live CrazyGames page: one flick over the
// game scrolled their page 300 px and the board slid under its header); only a card or sheet that can still scroll that way
// takes it
addEventListener(
  'wheel',
  (e) => {
    for (let el = e.target; el instanceof Element && el !== document.body; el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY)) {
        if (e.deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return;
      }
    }
    e.preventDefault();
  },
  { passive: false },
);
$('weather').onclick = () => {
  sfx.wake();
  weather.set(KINDS[(KINDS.indexOf(weather.kind()) + 1) % KINDS.length]);
  ui();
};

// ---- the feel: springs, landings, deliveries ----

function updateCrate(c, i, dt) {
  if (c.lock) {
    // the padlock and chains drop away a moment after the crate with its key has gone (back again on an undo)
    const want = locked(L, pos, i) ? 1 : 0, was = c.lockK;
    c.lockK = want ? Math.min(1, c.lockK + dt * 4) : Math.max(0, c.lockK - dt * 1.6);
    const k = Math.min(1, c.lockK * 1.6);
    c.lock.scale.setScalar(Math.max(0.001, k));
    c.lock.visible = c.lockK > 0.01;
    if (was >= 0.62 && c.lockK < 0.62) {
      sfx.play('pick', 0.4, 1.5);
      for (let n = 0; n < 24; n++) {
        const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.4;
        fx.glow.spawn({ x: c.cur.x, y: 0.5 + Math.random() * 0.3, z: c.cur.z, vx: Math.cos(a) * sp, vy: 1.2 + Math.random() * 1.4, vz: Math.sin(a) * sp, life: 0.6 + Math.random() * 0.4, size: 0.1, color: 0xffe08a, alpha: 1, gravity: 2.4, drag: 1.2 });
      }
    }
  }
  if (c.gone) return;
  const held = drag && drag.i === i;
  let target = c.path.length ? c.path[0] : c.target;
  if (c.out) {
    if (c.out.phase === 'slide') {
      target = c.out.to;
      if (c.cur.distanceTo(target) < 0.15) {
        Object.assign(c.out, { phase: 'hop', t: 0, from: c.cur.clone(), fromLift: c.lift });
        sfx.play('bump', 0.3, 1.2);
        sfx.whoosh(true, 0.16);
        // sparkles in its colour as it passes its gate
        const col = parseInt(SUPPLY[c.b.color].flag.slice(1), 16);
        for (let k = 0; k < 34; k++) {
          const a = Math.random() * Math.PI * 2, sp = 1.2 + Math.random() * 2;
          fx.glow.spawn({ x: c.cur.x, y: 0.4 + Math.random() * 0.4, z: c.cur.z, vx: Math.cos(a) * sp, vy: 1.4 + Math.random() * 2, vz: Math.sin(a) * sp, life: 0.7 + Math.random() * 0.5, size: k % 3 ? 0.17 : 0.12, color: k % 3 ? col : 0xfff2c8, alpha: 1, gravity: 2.6, drag: 1.2 });
        }
        fx.glow.spawn({ x: c.cur.x, y: 0.6, z: c.cur.z, life: 0.3, size: 1.6, color: col, alpha: 0.7 });
      }
    }
    if (c.out.phase === 'hop') return hop(c, i, dt);
    if (c.out.phase === 'wait' || c.out.phase === 'carried') return;   // on the mat, or in a worker's hands (camp.js moves it)
  }
  if (held) {
    // held: exactly where the drag's physics put it (a lagging spring would cut corners across rocks and crates); its
    // weight shows in the lean and the lift instead
    c.vel.x += ((target.x - c.cur.x) / Math.max(dt, 1e-3) - c.vel.x) * 0.35;
    c.vel.z += ((target.z - c.cur.z) / Math.max(dt, 1e-3) - c.vel.z) * 0.35;
    c.cur.x = target.x;
    c.cur.z = target.z;
  } else {
    // let go: a short, slightly soft settle onto its cell (the way there is free: both ends are)
    const k = 260, damp = 2 * Math.sqrt(k) * 0.85;
    c.vel.x += ((target.x - c.cur.x) * k - c.vel.x * damp) * dt;
    c.vel.z += ((target.z - c.cur.z) * k - c.vel.z * damp) * dt;
    const sp = Math.hypot(c.vel.x, c.vel.z);
    if (sp > 14) c.vel.multiplyScalar(14 / sp);
    c.cur.x += c.vel.x * dt;
    c.cur.z += c.vel.z * dt;
  }
  if (c.path.length && c.cur.distanceTo(c.path[0]) < (c.path.length > 1 ? 0.3 : 0.05)) c.path.shift();
  // lift: a little up while held, then down with a thud
  const wantLift = held ? 0.12 : c.out ? 0.1 : 0;
  c.liftV += ((wantLift - c.lift) * 260 - c.liftV * (held ? 20 : 6)) * dt - (held ? 0 : 9.8 * dt);
  c.lift += c.liftV * dt;
  if (c.lift < 0) {
    if (c.liftV < -1) land(c, -c.liftV);
    c.lift = 0;
    c.liftV = c.liftV < -1 ? -c.liftV * 0.2 : 0;
  }
  c.squashV += (-c.squash * 420 - c.squashV * 14) * dt;
  c.squash += c.squashV * dt;
  c.jig = Math.max(0, c.jig - dt * 3);
  const lean = 0.035;
  c.tiltZ += (clamp(-c.vel.x * lean, -0.18, 0.18) - c.tiltZ) * Math.min(1, dt * 12);
  c.tiltX += (clamp(c.vel.z * lean, -0.18, 0.18) - c.tiltX) * Math.min(1, dt * 12);
  c.group.position.set(c.cur.x, 0, c.cur.z);
  c.body.position.y = c.lift;
  c.body.rotation.set(c.tiltX, Math.sin(t * 40) * 0.05 * c.jig, c.tiltZ);
  // a key crate's gold key glints now and then (each its own beat)
  if (c.keyGold) c.keyGold.emissiveIntensity = 0.3 + 1.1 * Math.max(0, Math.sin(t * 1.6 + i * 2.1)) ** 10;
  const s = clamp(c.squash, -0.25, 0.25);
  c.body.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);
}

function land(c, speed) {
  const k = Math.min(speed / 4, 1);
  c.squashV -= 2 + speed * 1.4;
  dustPuff(fx.dust, c.cur.x, c.cur.z, c.b.w - 0.1, c.b.h - 0.1, 0.3 + k * 0.6);
  sfx.play(speed > 3.2 ? 'heavy' : 'drop', 0.3 + k * 0.45, 1.05 - k * 0.15);
}

// out of the gate in an arc onto the gate's mat, where it waits, packed, for the worker to carry it off to the camp
function hop(c, i, dt) {
  const o = c.out, color = L.blocks[i].color, s = spots[color];
  o.t += dt / 0.55;
  const u = Math.min(o.t, 1), e = u * u * (3 - 2 * u);
  const to = s.pos.clone().addScaledVector(s.side, ((o.slot - 1) % 3 - 1) * 0.3).addScaledVector(s.out, -0.1);
  c.cur.lerpVectors(o.from, to, e);
  c.group.position.set(c.cur.x, 0, c.cur.z);
  c.body.position.y = THREE.MathUtils.lerp(o.fromLift, GROUND, e) + Math.sin(Math.PI * u) * 0.8;
  c.body.rotation.set(0, u * Math.PI * 1.0, Math.sin(Math.PI * u) * 0.35);
  c.group.scale.setScalar(1 - 0.42 * e);
  if (u < 1) return;
  o.phase = 'wait';
  c.body.rotation.set(0, Math.PI, 0);
  dustPuff(fx.dust, c.cur.x, c.cur.z, 0.5, 0.5, 0.6);
  sfx.play('drop', 0.45, 0.95);
  sfx.home(crates.filter((x) => x.out).length - 1);   // a note of the music's chord, higher with each crate home
  const trip = c.trip, live = () => c.trip === trip && !c.gone;
  c.api = {
    at: () => c.cur,
    // its ground on the mat (the worker stands beside it to pick it up)
    size: () => [c.b.w * c.group.scale.x, c.b.h * c.group.scale.x],
    // picked up: from now on the worker's hands move it
    lift() {
      if (!live()) return;
      o.phase = 'carried';
      s.waitingCount = Math.max(0, (s.waitingCount || 1) - 1);
    },
    hold(p, heading) {
      if (!live()) return;
      c.cur.copy(p).setY(0);
      c.group.scale.setScalar(0.42);
      c.group.position.set(p.x, p.y - 0.12, p.z);   // the crate's middle in the hands (it is 0.56 high, scaled to 0.42)
      c.body.position.y = 0;
      c.body.rotation.set(0, heading, 0);
    },
    // set down at the building site and opened: the supplies go into the work
    unpack(at) {
      if (!live()) return false;
      c.gone = true;
      c.group.visible = false;
      unpackBurst(fx.dust, fx.glow, at.x, GROUND + 0.2, at.z, new THREE.Color(SUPPLY[color].flag).getHex());
      return true;
    },
  };
  camp.arrived(color, c.api);
}

function fireflies(dt) {
  if (duskShown < 0.45 || weather.kind() === 'rain' || Math.random() > dt * 6 * duskShown) return;
  const a = Math.random() * Math.PI * 2, d = Math.max(L.w, L.h) / 2 + 1.5 + Math.random() * 3.5;
  fx.glow.spawn({ x: Math.cos(a) * d * 1.2, y: 0.2 + Math.random() * 1.2, z: Math.sin(a) * d, life: 4 + Math.random() * 3, size: 0.09, color: 0xd8ff7a, alpha: 0.9, wander: 1.2, drag: 1.2, blink: 3 + Math.random() * 3 });
}

// ---- the watching bot: plays the level's proven best solution with the same drags a finger makes ----

let bot = null;
function botStep(dt) {
  if (!watching() || state !== 'play') return;
  if (!bot) bot = { k: 0, wait: film ? 1.2 : 1.5, step: null };
  if (bot.halt) return;
  if (bot.wait > 0) return void (bot.wait -= dt);
  const m = L.solution[bot.k];
  if (!m) return;
  if (!bot.step) {
    // a virtual finger on the crate's first cell, moving smoothly through the path's cells (and out through the gate)
    const p = pos[m.i], b = L.blocks[m.i], pts = pathTo(reach(L, pos, m.i, pos[m.i], darkMask(L, moves)), m.to[0], m.to[1]).slice(1).map(([x, y]) => [x + 0.5, y + 0.5]);
    if (m.exit) {
      const o = OUT[exitGate(L, m.i, m.to[0], m.to[1], moves).side];
      pts.push([m.to[0] + 0.5 + o[0] * (b.w + 0.6), m.to[1] + 0.5 + o[1] * (b.h + 0.6)]);
    }
    grab(m.i, p[0] + 0.5, p[1] + 0.5);
    bot.step = { finger: [p[0] + 0.5, p[1] + 0.5], pts, pause: slowBot() ? 0.55 : 0.15 };
    return;
  }
  if ((bot.step.pause -= dt) > 0) return;
  const f = bot.step.finger, goal = bot.step.pts[0];
  if (goal && drag) {
    const dx = goal[0] - f[0], dy = goal[1] - f[1], d = Math.hypot(dx, dy), stepLen = (slowBot() ? 4 : 7.5) * dt;
    if (d <= stepLen) {
      f[0] = goal[0];
      f[1] = goal[1];
      bot.step.pts.shift();
    } else {
      f[0] += (dx / d) * stepLen;
      f[1] += (dy / d) * stepLen;
    }
    steer(f[0], f[1]);
    return;
  }
  release();
  bot.k++;
  bot.step = null;
  bot.wait = slowBot() ? 1 : m.exit ? 0.8 : 0.5;
}
// "Show me" for a player: slower than the watching modes and the store videos (?watch, ?film), with a pause between moves
// (playtest 2026-10-29: three players could not follow it)
const slowBot = () => showing && !watchUrl;

// ---- the evening, the camera, the HUD ----

// The camera's frames. 'play': the board and the ground in front of its gates as large as the screen allows, with as much of
// the camp round it as fits while the board stays big (on a phone the board fills the width and the camp runs off the
// sides; Oleg, 2026-10-24: the phone board was too small); 'camp': everything, the whole camp; 'end': everything above the
// end card at the bottom (the card used to sit over the middle and hide the camp, the level's reward). The camera glides
// from one frame to the next.
let view = 'play';
const UPRIGHT = Number(q.get('upright')) || 60;
function frameFor(w, h, kind) {
  const board = [new THREE.Vector3(-L.w / 2 - 0.45, 0, -L.h / 2 - 0.45), new THREE.Vector3(L.w / 2 + 0.45, 0, L.h / 2 + 0.45)];
  for (const s of Object.values(spots)) board.push(s.pos.clone().addScaledVector(s.out, 0.7).addScaledVector(s.side, 0.9), s.pos.clone().addScaledVector(s.out, 0.7).addScaledVector(s.side, -0.9));
  const all = [...board, ...camp.extent()];
  const portrait = h > w;
  camera.aspect = w / h;
  camera.fov = portrait ? 40 : 32;
  camera.updateProjectionMatrix();
  // a steeper look on the big boards, so tall crates don't lean over the next column (benchmark 2026-10-28)
  const big = Math.max(L.w, L.h) >= 7 ? 1 : 0;
  // and steeper still while playing (benchmark 2026-11-07: the tops of tall crates stood over the next row, so rows and gate
  // widths read wrong); the camp and the end frame keep the lower, wider look, and the camera glides between them
  const play = kind === 'play' ? (portrait ? 6 : 8) : 0;
  // (upright, playing: the same angle in every level, low enough to show the camp's row behind the board)
  const elev = THREE.MathUtils.degToRad(portrait && kind === 'play' ? UPRIGHT : (portrait ? 62 : 52) + big * (portrait ? 3 : 5) + play), dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
  // the end frame keeps the end card's own height free at the bottom (measured once it shows; a short screen gets a compact card)
  const box = $('card').classList.contains('on') && $('card').querySelector('.box').getBoundingClientRect();
  const cardRoom = box && box.height ? box.height + 22 : portrait ? 250 : 210;
  // (a phone keeps room at the bottom for the hint line and its button; a short wide screen, the CrazyGames frame on a laptop,
  // has the bar on one line: slice.html)
  const short = !portrait && h <= 560;
  const top = 1 - (2 * (portrait ? 120 : short ? 56 : 95)) / h, bottom = -1 + (2 * (kind === 'end' ? cardRoom : portrait ? 110 : 40)) / h;
  // the distance at which a set of ground points fits between the margins, slid along the ground so they sit in the middle
  // of the space between the top bar and the bottom margin (the end card's room)
  const span = (look, d, corners) => {
    camera.position.copy(look).addScaledVector(dir, d);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    let x = 0, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) {
      const p = c.clone().project(camera);
      x = Math.max(x, Math.abs(p.x)), y0 = Math.min(y0, p.y), y1 = Math.max(y1, p.y);
    }
    return { x, y0, y1 };
  };
  const fit = (pts, high = 1.4) => {
    const box = new THREE.Box3().setFromPoints(pts.map((p) => p.clone().setY(0))), mid = box.getCenter(new THREE.Vector3()).setY(0);
    const corners = [];
    for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) for (const y of [GROUND, high]) corners.push(new THREE.Vector3(x, y, z));
    let look = mid.clone(), d = 6;
    for (; d < 80; d += 0.25) {
      // looking further back (-z) brings everything down the screen
      let lo = mid.z - 12, hi = mid.z + 12;
      for (let k = 0; k < 18; k++) {
        look.z = (lo + hi) / 2;
        const sp = span(look, d, corners);
        if ((sp.y0 + sp.y1) / 2 > (top + bottom) / 2) hi = look.z;
        else lo = look.z;
      }
      const sp = span(look, d, corners);
      if (sp.x < 0.97 && sp.y1 < top && sp.y0 > bottom) break;
    }
    return { look, d };
  };
  const whole = fit(all);
  // a newly earned extra: closer in on its place, with a little of the camp round it (on the board: the whole camp)
  if (kind === 'extra') {
    if (!spotAt) return { ...whole, dir };
    const s = spotAt, m = 3.2;
    return { ...fit([new THREE.Vector3(s.x - s.w / 2 - m, 0, s.z - s.d / 2 - m), new THREE.Vector3(s.x + s.w / 2 + m, 0, s.z + s.d / 2 + m)], 1.2), dir };
  }
  if (kind !== 'play') return { ...whole, dir };
  // playing: on a phone the board and its gates' paths fill the width (the crates' landing spots and the camp run off the
  // sides); on a wide screen zoomed out from the board's own frame only as far as keeps the board big (a third at most)
  // a phone upright (2026-11-07, Oleg: the camp in rows behind and in front of the board, "reduce board size just enough for
  // the workers to be visible"): one framing for every level, the game's largest board and the ring round it where the gate
  // workers stand across the phone's width, the camp's rows in the height left over (camp.js ROW); every level's cells are
  // then the same size
  if (portrait) {
    const ring = 1.15, phone = fit([new THREE.Vector3(-SIZE.w / 2 - ring, 0, -SIZE.h / 2 - ring), new THREE.Vector3(SIZE.w / 2 + ring, 0, SIZE.h / 2 + ring)], 0.5);
    // then slid along the ground so the camp's whole depth, its row behind the board to the extras in front, sits in the
    // middle of the room between the bars: a tall phone's extra height goes to the camp, not to empty ground (Oleg,
    // 2026-11-07, on an Android phone: the top crowded, the bottom bare)
    const [z0, z1] = campDepth(SIZE, true), ends = [new THREE.Vector3(0, 1.2, z0), new THREE.Vector3(0, GROUND, z1)], look = phone.look.clone();
    let lo = look.z - 12, hi = look.z + 12;
    for (let k = 0; k < 20; k++) {
      look.z = (lo + hi) / 2;
      const sp = span(look, phone.d, ends);
      if ((sp.y0 + sp.y1) / 2 > (top + bottom) / 2) hi = look.z;
      else lo = look.z;
    }
    return { look, d: phone.d, dir };
  }
  // (a short wide screen, the CrazyGames frame on a laptop at 462 px: hardly zoomed out at all, the board as big as it goes,
  // the camp running off the top and bottom; the board was 200 px there with 26 px cells, playtest 2026-11-09)
  // (there, the board and a little over a cell round it, its gates' mouths, not the camp spots out in front)
  const m = 1.35, near = short ? fit([new THREE.Vector3(-L.w / 2 - m, 0, -L.h / 2 - m), new THREE.Vector3(L.w / 2 + m, 0, L.h / 2 + m)]) : fit(board);
  const out = 1.03 + 0.32 * clamp((h - 480) / 220, 0, 1);
  return whole.d <= near.d * out ? { ...whole, dir } : { look: near.look, d: near.d * out, dir };
}
function fitCamera(w, h, glide = false) {
  const f = frameFor(w, h, view), u = camera.userData;
  camera.userData = { look: glide && u.look ? u.look : f.look.clone(), d: glide && u.d ? u.d : f.d, dir: glide && u.dir ? u.dir : f.dir.clone(), to: f };
  world.fitFog(Math.max(f.d, frameFor(w, h, 'camp').d));
  const all = [...Object.values(spots).map((s) => s.pos), ...camp.extent()], box = new THREE.Box3().setFromPoints(all.map((p) => p.clone().setY(0)));
  box.expandByPoint(new THREE.Vector3(-L.w / 2 - 0.5, 0, -L.h / 2 - 0.5)).expandByPoint(new THREE.Vector3(L.w / 2 + 0.5, 0, L.h / 2 + 0.5));
  world.fitArea(Math.max(-box.min.x, box.max.x), Math.max(-box.min.z, box.max.z));
}
// the picture's size: the screen's, or the fixed one a film or a cover is made at
const viewSize = () => (film || cover ? [Number(q.get('w')) || 1920, Number(q.get('h')) || 1080] : [canvas.clientWidth, canvas.clientHeight]);
function setView(kind) {
  view = kind;
  fitCamera(...viewSize(), true);
}

function resize() {
  rotateCheck();
  if (!L) return;
  const [w, h] = viewSize();
  // turned before the first move: the camp laid out again for the new shape (its places differ upright and on its side)
  if (h > w !== campPortrait && moves === 0 && state === 'play' && !drag && !watching() && !film && !cover) return busy(load);
  if (film || cover) renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  fitCamera(w, h);
  const ps = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const p of Object.values(fx)) p.setScale(ps);
}
new ResizeObserver(resize).observe(canvas);

// a phone on its side (Oleg, 2026-11-07: "optimize the portrait mode only", then "should show on overlay blocking playing",
// after Raccoon Gunner on jest.com): a screen over the whole game asks to turn it upright and goes when it turns. Phones
// only: a touch screen with no hover, on its side and short; a desktop window, however shaped, plays on
const phone = matchMedia('(hover: none) and (pointer: coarse)');
// (a declaration, so resize() above can call it before this line has run)
function rotateCheck() {
  $('rotate').classList.toggle('on', phone.matches && innerWidth > innerHeight && innerHeight < 560 && !film && !cover);
}
addEventListener('resize', rotateCheck);
matchMedia('(orientation: portrait)').addEventListener?.('change', rotateCheck);
rotateCheck();

const starsFor = (m) => (m <= L.par ? 3 : m <= L.par + 1 ? 2 : 1);
function ui() {
  const leftMoves = Math.max(0, L.budget - moves);
  $('starTotal').textContent = shownTotal;
  // the star goal up front ("Best: 9" read as somebody's score, playtest 2026-10-24)
  $('level').textContent = `Level ${levelIndex + 1}`;
  // (while "Show me" plays, or after it is skipped, the way's length: "8 moves before dark" over a stopped replay misled,
  // playtest 2026-11-09, Maya)
  $('movesText').textContent = state === 'won' ? 'All delivered!' : showing ? `The way in ${L.par} moves` : leftMoves === 1 ? '1 move before dark' : `${leftMoves} moves before dark`;
  $('moves').classList.toggle('low', leftMoves <= 2 && state === 'play');
  $('best').innerHTML = `<b>★★★</b> in ${L.par} moves`;
  $('undo').disabled = !hist.length || !(state === 'play' || (state === 'lost' && lostTo !== null));
  // (the countdowns to bedtime and to a crew back late live in Ember's answers since 2026-11-07, Oleg: "not displayed
  // constantly but when the user uses the assistant"; the gates still carry their numbers)
  // (nothing in the bubble under a card: "Show me"'s caption stuck out behind the "Your turn?" card, playtest 2026-11-09, Maya)
  bubble.set($('card').classList.contains('on') ? '' : note ? note.text : watching() ? (showing ? `The way in ${L.par} moves: move ${Math.min(moves + 1, L.par)} of ${L.par}` : '') : levelIndex === 0 && !q.has('proto') && moves === 0 ? 'Drag a crate out through the gate of its colour' : levelIndex === 0 && !q.has('proto') && moves > 0 && !turnedOnce && state === 'play' && cornerMove() ? 'One drag can turn corners: still one move' : levelIndex === 0 && !q.has('proto') && moves <= 2 && state === 'play' ? 'One drag is one move: fewer moves, more stars' : '');
  if (weather) $('weather').textContent = WEATHER_LABEL[weather.kind()];
  const hb = $('hintBtn');
  hb.hidden = watchUrl || cover || q.has('proto') || state !== 'play' || $('card').classList.contains('on');
  hb.classList.toggle('skip', showing);
  hb.textContent = showing ? '⏭ Skip' : '✨ Ask Ember';
}

// a card's legend: each of this level's crates and the part of the camp it is for; colours not in `known` are marked new
function legend(el = $('legend'), known = null) {
  el.innerHTML = '';
  const seen = new Set();
  for (const g of L.gates) {
    if (seen.has(g.color)) continue;
    seen.add(g.color);
    const s = SUPPLY[g.color], row = document.createElement('div');
    row.className = 'row';
    const fresh = known && !known.has(g.color) ? ' <span class="new">new</span>' : '';
    row.innerHTML = `<div class="chip" style="background:${s.paint}"><img alt="" src="${stencilCanvas(s.icon, false).toDataURL()}"></div><div><b>${s.name[0].toUpperCase() + s.name.slice(1)}</b> goes to ${CAMP_NAME[g.color]}${fresh}</div>`;
    el.append(row);
  }
}

// a new level's card: what is new on it (the dark, from level 2) and what it brings to the camp, the new parts marked
// a level's card: one line, a picture and the new supplies (playtest 2026-10-24: the old cards were walls of text, read only
// in bold). The picture is bedtime's (in slice.html) unless the level brings something else new (PIC)
const PIC = {
  long: '<rect x="2" y="8" width="50" height="38" rx="3" fill="#dcc38e"/><rect x="5" y="20" width="44" height="13" rx="3" fill="#f0942e"/><path d="M13 20v13M41 20v13" stroke="#3c3a3a" stroke-width="2.4"/><path d="M27 23l4 7h-8z" fill="#f6ead0"/><path d="M2 40h50" stroke="#b49a68"/>',
  heavy: '<rect x="2" y="8" width="50" height="38" rx="3" fill="#dcc38e"/><rect x="15" y="15" width="24" height="20" rx="3" fill="#f0c232"/><path d="M12 37h30" stroke="#2c2a2a" stroke-width="3.5" stroke-linecap="round"/><path d="M11 37l-2-4M43 37l2-4" stroke="#2c2a2a" stroke-width="3" stroke-linecap="round"/><path d="M4 25l7-6v12zM50 25l-7-6v12z" fill="#fff"/><path d="M27 18v14" stroke="#3c3a3a" stroke-width="1" opacity=".3"/>',
  pond: '<rect x="2" y="2" width="50" height="50" rx="3" fill="#dcc38e"/><path d="M2 5a3 3 0 0 1 3-3h25v14H16v14H2z" fill="#3f8fc8"/><circle cx="11" cy="11" r="4.5" fill="#4f9a3a"/><circle cx="22" cy="9" r="3" fill="#4f9a3a"/><path d="M5 26v-8M8 27v-6M27 13v-8" stroke="#6a9a3a" stroke-width="1.6"/><rect x="31" y="31" width="14" height="14" rx="2" fill="#e0543a"/>',
  padlock: '<rect x="3" y="18" width="30" height="24" rx="3" fill="#f0942e"/><path d="M3 30h30M18 18v24" stroke="#8a8c90" stroke-width="3.4"/><path d="M14 26v-3.5a4 4 0 0 1 8 0V26" stroke="#8a8c90" stroke-width="2.6" fill="none"/><rect x="11.5" y="25" width="13" height="11" rx="2" fill="#3b8fde"/><rect x="37" y="6" width="15" height="15" rx="2" fill="#3b8fde"/><circle cx="41.5" cy="13.5" r="2.6" stroke="#f2c440" stroke-width="1.8" fill="none"/><path d="M44 13.5h5.5M48 13.5v2.4" stroke="#f2c440" stroke-width="1.8"/>',
  // round the rocks: a crate's one drag bending round a rock and a stump (2026-11-07: levels without a picture showed
  // bedtime's, a "2" on a gate, whatever their rule; Maya)
  rocks: '<rect x="2" y="2" width="50" height="50" rx="3" fill="#dcc38e"/><path d="M2 19h50M2 36h50M19 2v50M36 2v50" stroke="#b49a68" stroke-width="1"/><ellipse cx="28" cy="27" rx="7" ry="6" fill="#7d8088"/><ellipse cx="26" cy="25" rx="3" ry="2" fill="#a2a6ae"/><rect x="38" y="38" width="12" height="12" rx="2" fill="#8a5a32"/><ellipse cx="44" cy="42" rx="4" ry="2.5" fill="#c49a6a"/><rect x="5" y="40" width="12" height="9" rx="2" fill="#3b8fde"/><path d="M11 40V12h34" stroke="#3b8fde" stroke-width="2.4" fill="none" stroke-dasharray="3 2.4" stroke-linecap="round"/><path d="M43 8l5 4-5 4z" fill="#3b8fde"/>',
  // every crew's gate: the board with a gate of each colour round it
  gates: '<rect x="8" y="8" width="38" height="38" rx="3" fill="#dcc38e"/><path d="M8 21h38M8 33h38M21 8v38M33 8v38" stroke="#b49a68" stroke-width="1"/><rect x="12" y="3" width="10" height="5" rx="1" fill="#e0543a"/><rect x="30" y="3" width="10" height="5" rx="1" fill="#f0942e"/><rect x="46" y="14" width="5" height="10" rx="1" fill="#4fa83a"/><rect x="46" y="30" width="5" height="10" rx="1" fill="#3b8fde"/><rect x="14" y="46" width="10" height="5" rx="1" fill="#9a5ad0"/><rect x="3" y="26" width="5" height="10" rx="1" fill="#f0c232"/><rect x="23" y="23" width="9" height="9" rx="2" fill="#9a5ad0"/>',
  late: '<path d="M38 4l-9 16h18z M38 12l-11 18h22z" fill="#3e7a34"/><rect x="36.5" y="29" width="3" height="5" fill="#6a4628"/><rect x="2" y="36" width="50" height="6" rx="2" fill="#9a6a3c"/><g fill="#5a3a22"><rect x="8" y="26" width="3" height="16"/><rect x="13" y="26" width="3" height="16"/><rect x="18" y="26" width="3" height="16"/></g><rect x="6" y="25" width="17" height="3" fill="#f05a3c"/><circle cx="45" cy="47" r="3" fill="#ffd2a0"/><path d="M30 48h-8m3-3-3 3 3 3" stroke="#3e9e38" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="14" cy="15" r="6.5" fill="#e2f6d2" stroke="#3a2c4a" stroke-width="1.2"/><text x="14" y="18" font-size="8.5" font-weight="800" fill="#2a2238" text-anchor="middle" font-family="system-ui">4</text>',
};
let bedtimePic = null;
const INTRO = [
  null,
  { title: 'Level 2: bedtime', rule: '<b>Some crews go to bed early.</b> The number on a gate is the moves they have left.' },
  { title: 'Level 3: two early crews', rule: '<b>Two crews go to bed early.</b> Whose crates go first?' },
  // (it taught dragging round corners, which level 1 already needs: playtest 2026-11-09, Leo, Maya)
  { title: 'Level 4: round the rocks', rule: '<b>Rocks and stumps all over:</b> plan each crate’s way round them.', pic: 'rocks' },
  { title: 'Level 5: three early crews', rule: '<b>Three crews go to bed early.</b> Watch the numbers on the gates.' },
  { title: 'Level 6: tight corners', rule: '<b>More rocks, two early crews.</b> Plan who goes first.', pic: 'rocks' },
  { title: 'Level 7: the whole camp', rule: '<b>Every crew is here:</b> all six gates.', pic: 'gates' },
  // (it said they "turn no corners in a tight spot": a rule that never bit, playtest 2026-11-07, all five)
  { title: 'Level 8: long loads', rule: '<b>Long loads</b> are four cells long: to move sideways they need a gap four cells wide.', pic: 'long' },
  { title: 'Level 9: long loads at bedtime', rule: '<b>Long loads and an early crew.</b> Make room before the gate shuts.', pic: 'long' },
  { title: 'Level 10: heavy crates', rule: '<b>Heavy crates run on skids:</b> they slide only along them. Pick one up to see its way.', pic: 'heavy' },
  { title: 'Level 11: heavy and long', rule: '<b>Heavy crates, a long load</b> and a crew that turns in early.', pic: 'heavy' },
  { title: 'Level 12: the pond', rule: '<b>A pond fills a corner.</b> Nothing crosses the water.', pic: 'pond' },
  { title: 'Level 13: by the water', rule: '<b>A bigger pond, a heavy crate</b> and two early crews.', pic: 'pond' },
  // (the lock's colour rule came only on level 16's card: playtest 2026-11-09, Ruth, Jonas)
  { title: 'Level 14: the padlock', rule: '<b>A padlocked crate</b> stays put until the crate with its key is out. The lock’s colour is the key crate’s.', pic: 'padlock' },
  { title: 'Level 15: keys and bedtime', rule: '<b>A padlock and an early crew.</b> Whose key goes first?', pic: 'padlock' },
  { title: 'Level 16: two padlocks', rule: '<b>Two padlocks:</b> the colour on each lock is the crate with its key.', pic: 'padlock' },
  { title: 'Level 17: back late', rule: '<b>A crew is out in the forest.</b> Their gate opens when they are back.', pic: 'late' },
  { title: 'Level 18: late and early', rule: '<b>One crew back late, one to bed early.</b> Time it.', pic: 'late' },
  { title: 'Level 19: a long evening', rule: '<b>Pond, padlock, skids, a late crew</b> and an early one.', pic: 'gates' },
  { title: 'Level 20: the last night', rule: '<b>Everything at once</b>, and every crew in camp.', pic: 'gates' },
];
function intro() {
  $('intro').classList.remove('on');   // another level's, left under the camp trail
  const I = !q.has('proto') && !watching() && INTRO[levelIndex];
  if (!I) return;
  let seen = false;
  try {
    seen = store.getItem(`bd3.card${levelIndex}`) === '1';
  } catch {}
  if (seen && !playtest) return;
  const before = new Set(LIST.slice(0, levelIndex).flatMap((l) => l.blocks.map((b) => b.color)));
  $('introTitle').textContent = I.title;
  $('introRule').innerHTML = I.rule;
  bedtimePic ??= $('introPic').innerHTML;
  $('introPic').innerHTML = PIC[I.pic] || bedtimePic;
  legend($('introLegend'), before);
  $('intro').classList.add('on');
}
$('introGo').onclick = () => {
  sfx.wake();
  $('intro').classList.remove('on');
  try {
    store.setItem(`bd3.card${levelIndex}`, '1');
  } catch {}
};

function button(text, go, alt) {
  const b = document.createElement('button');
  b.textContent = text;
  if (alt) b.className = 'alt';
  b.onclick = () => {
    sfx.wake();
    go();
  };
  $('cardBtns').append(b);
}
// "Show me" skipped: the solver stops where it is and the card that ends it comes at once, to try it or go on (playtest
// 2026-11-07, Maya: Skip threw her back into the level she had won, with no way on but the trail)
function skipCard() {
  const last = levelIndex >= LIST.length - 1;
  if (drag) release();
  bot = { halt: true };
  $('cardBtns').innerHTML = '';
  $('cardTitle').textContent = `The way in ${L.par} moves`;
  $('cardStars').textContent = '';
  $('cardText').textContent = 'Your turn?';
  $('cardExtra').innerHTML = '';
  button('Try it', () => ((showing = false), busy(load)));
  if (!last) button('Next level', () => ((showing = false), busy(() => goTo(levelIndex + 1))), true);
  $('card').classList.remove('won');
  $('card').classList.add('on');
  if (view !== 'end') setView('end');
  ui();
}
function showCard() {
  const won = state === 'won', stars = starsFor(moves), last = levelIndex >= LIST.length - 1;
  $('cardBtns').innerHTML = '';
  if (won) {
    $('cardTitle').textContent = last ? 'The camp is ready for the night' : 'Camp ready before dark';
    $('cardStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    if (!showing) $('cardTitle').textContent = last ? 'The camp is ready for the night!' : 'Camp ready!';
    if (showing) {
      $('cardTitle').textContent = `The way in ${L.par} moves`;
      $('cardStars').textContent = '';
      $('cardText').textContent = 'Your turn?';
      button('Try it', () => ((showing = false), busy(load)));
      if (!last) button('Next level', () => ((showing = false), busy(() => goTo(levelIndex + 1))), true);
    } else {
      $('cardText').textContent = `${moves} moves (target ${L.par})${last && !q.has('proto') ? '. More levels soon!' : ''}`;
      // a level played again from the trail: on to where the player had got to, not the level after this one (playtest
      // 2026-11-07, Maya: after replaying level 1, "Next level" took her to level 2 when she was on level 12)
      const furthest = Math.min(reached, LIST.length - 1), ahead = !q.has('proto') && furthest > levelIndex + 1;
      // (instead of "Next level": three buttons do not fit a phone's card; the trail, behind the star, has every level)
      if (ahead) button(`Back to level ${furthest + 1}`, () => busy(() => goTo(furthest)));
      else if (!last) button('Next level', () => busy(() => goTo(levelIndex + 1)));
      button('Play again', () => busy(load), !last);
      if (stars < 3) button('Show me', () => ((showing = true), (bot = null), busy(load)), true);
      if (last) button('Camp trail', openTrail, true);
    }
  } else if (lostTo !== null) {
    $('cardTitle').textContent = 'Gone to bed';
    $('cardStars').textContent = '';
    $('cardText').textContent = `${CREW_NAME[L.blocks[lostTo].color]} shut the gate before the ${SUPPLY[L.blocks[lostTo].color].name} came.`;
    button('Undo', () => undo());
    button('Try again', () => busy(load), true);
    button('Show me', () => ((showing = true), (bot = null), busy(load)), true);
  } else {
    $('cardTitle').textContent = 'Night fell';
    $('cardStars').textContent = '';
    $('cardText').textContent = 'The camp was not ready in time.';
    button('Try again', () => busy(load));
  }
  $('card').classList.toggle('won', won && !showing);
  $('cardExtra').innerHTML = '';
  if (won && !showing) {
    $('cardStars').innerHTML = [0, 1, 2].map((k) => `<span class="star${k < stars ? '' : ' off'}" style="animation-delay:${0.35 + k * 0.28}s">★</span>`).join('');
    for (let k = 0; k < stars; k++) setTimeout(() => sfx.star(k), 350 + k * 280);
    celebrate = 3.2;
    // the camp's new extra pops up as the stars land; the card names it, or says what the next one needs
    const total = starTotal(), next = nextExtra(total), extra = fresh.length && EXTRAS.find((e) => e.id === fresh[fresh.length - 1]);
    if (!spotlit) for (const id of fresh) camp.extras.reveal(id, 1.3);
    if (extra) $('cardExtra').innerHTML = `<span class="unlock">${icon(extra.id, 26)}<span>New for the camp: <b>${extra.name}</b>!</span></span>`;
    else if (!q.has('proto')) $('cardExtra').innerHTML = next ? `★ ${total} · ${next.need} more for the ${next.name.toLowerCase()}` : `★ ${total} · every extra is in the camp`;
    flyStars(stars - gained, stars);
  }
  $('card').classList.add('on');
  ui();
  if (view !== 'end') setView('end');
  if (won) sfx.jingle('win');
  else {
    sfx.play('heavy', 0.4, 0.6);
    sfx.jingle('lose', 0.2);
  }
}

// the camera to the camp's newly earned extra (the last, if two came at once), which pops up as it gets there
function spotlight() {
  spotlit = true;
  const extra = EXTRAS.find((e) => e.id === fresh[fresh.length - 1]);
  spotAt = camp.extras.where(extra.id);
  setView('extra');
  for (const id of fresh) camp.extras.reveal(id, 0.7);
  $('unlockNote').innerHTML = `${icon(extra.id, 30)}<span>New for the camp: <b>${extra.name}</b>!</span>`;
  $('unlockNote').classList.add('on');
  unlockUntil = t + 2.7;
  setTimeout(() => sfx.chime([659, 880, 1175], 0.06, 0.9), playtest ? 0 : 700);
}

// the stars won beyond the level's best fly from the card to the total by the trail button, counting it up as they land
function flyStars(from, to) {
  // ?playtest: a background tab runs timers late and draws no frames, so there the stars land at once (playtest 2026-10-29:
  // the total lagged a level behind the card)
  if (playtest) {
    $('starTotal').textContent = shownTotal += to - from;
    return;
  }
  const card = camp;
  for (let k = from; k < to; k++) {
    setTimeout(() => {
      const star = $('cardStars').children[k], pill = $('trail');
      if (card !== camp || !star || !$('card').classList.contains('on')) return;
      const a = star.getBoundingClientRect(), b = pill.getBoundingClientRect(), f = document.createElement('div');
      f.className = 'flyer';
      f.textContent = '★';
      Object.assign(f.style, { left: `${a.left + a.width / 2}px`, top: `${a.top + a.height / 2}px` });
      document.body.append(f);
      requestAnimationFrame(() => (f.style.transform = `translate(${b.left + 18 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) scale(0.45)`));
      setTimeout(() => {
        f.remove();
        if (card !== camp) return;
        $('starTotal').textContent = ++shownTotal;
        pill.classList.remove('bump');
        void pill.offsetWidth;
        pill.classList.add('bump');
        sfx.play('pick', 0.25, 1.8 + k * 0.15);
      }, 650);
    }, 1100 + k * 280);
  }
}

// ---- the camp trail (the level map): each level's stars, the total, the camp's extras; a level to play ----
function openTrail() {
  sfx.wake();
  const total = starTotal(), open = Math.max(reached, levelIndex);
  $('mapTotal').textContent = total;
  $('mapMax').textContent = LIST.length * 3;
  $('settings').classList.remove('on');
  $('map').classList.add('on');   // first, so the trail can measure its width
  const pick = (k) => {
    $('map').classList.remove('on');
    if (k !== levelIndex || state !== 'play') busy(() => goTo(k));
  };
  drawTrail($('mapTrail'), { count: LIST.length, best, open, current: levelIndex, pick });
  drawExtras($('mapExtras'), $('mapNext'), total);
  // the button: the first open level without stars, else the one in play
  const first = LIST.findIndex((_, k) => k <= open && !best[k]), play = first >= 0 ? first : levelIndex;
  $('mapPlay').textContent = play === levelIndex && state === 'play' ? `Back to level ${play + 1}` : `Play level ${play + 1}`;
  $('mapPlay').onclick = () => pick(play);
}
$('trail').onclick = openTrail;
$('setTrail').onclick = openTrail;
$('mapClose').onclick = () => $('map').classList.remove('on');

// to another level: a new day; the camp keeps what it has (camp.js builds it from the levels before)
function goTo(k) {
  levelIndex = k;
  bot = null;
  // (a "Show me" skipped, then another level from the camp trail: that level played itself; found 2026-11-09)
  showing = false;
  load();
  intro();
}

function step(dt) {
  t += dt;
  botStep(dt);
  if (drag && drag.route) follow(dt);
  crates.forEach((c, i) => updateCrate(c, i, dt));
  const wantDusk = q.has('dusk') ? Number(q.get('dusk')) : state === 'lost' ? 1 : state === 'won' ? Math.min(moves / L.budget, 0.75) : moves / L.budget;
  duskShown += (wantDusk - duskShown) * Math.min(1, dt * 1.6);
  weather.update(dt);
  world.setEvening(duskShown, weather.light());
  setCrateGlow(clamp((duskShown - 0.45) * 0.5, 0, 0.25) + (1 - weather.light().sun) * 0.2);
  if (note && t >= note.until) say('', 0);
  sfx.setEvening(duskShown, camp.fireSize());
  sfx.tick();
  camp.update(dt, t, duskShown, state, moves, new Set(L.blocks.filter((b, k) => pos[k]).map((b) => b.color)));
  fireflies(dt);
  waveFlags(board.flags, t);
  if (thinking) emberThink(dt);
  if (scanBand) scanBand.visible = !!thinking;
  board.mark(drag && !watching() ? [...settleSpot(), L.blocks[drag.i].w, L.blocks[drag.i].h] : null);
  if (aimed && (state !== 'play' || posKey(pos) !== aimed.key)) aimed = null;
  board.aim(aimed && !watching() ? [aimed.m.to[0], aimed.m.to[1], L.blocks[aimed.m.i].w, L.blocks[aimed.m.i].h] : null);
  const wc = blinkI >= 0 && crates[blinkI] && !crates[blinkI].gone && !crates[blinkI].out ? crates[blinkI] : null;
  board.way(wc ? { x: wc.cur.x, z: wc.cur.z, w: wc.b.w, h: wc.b.h, axis: wc.b.axis === 'x' ? 'x' : 'z', age: t - blinkAt } : null);
  board.tick(dt, t, drag ? L.blocks[drag.i].color : teach(dt));
  fireworks(dt);
  // a gate's arch fades while a crate is in its lane by the opening (it would hide the crate on the near side)
  for (const a of board.arches) {
    const along = a.g.side === 'top' || a.g.side === 'bottom';
    const near = crates.some((c) => !c.gone && !(c.out && c.out.phase !== 'slide') && (along ? Math.abs(c.cur.x - a.at.x) < a.g.len / 2 + 0.7 && Math.abs(c.cur.z - a.at.z) < 1.3 : Math.abs(c.cur.z - a.at.z) < a.g.len / 2 + 0.7 && Math.abs(c.cur.x - a.at.x) < 1.3));
    a.fade += ((near ? 0.25 : 1) - a.fade) * Math.min(1, dt * 8);
    for (const m of a.mats) m.opacity = a.fade;
  }
  for (const p of Object.values(fx)) p.update(dt);
  // won: the card comes up soon after the last crate is out (playtest 2026-10-24: 8-10 s of waiting for the camp was too
  // long), the camera back over the whole camp; the workers finish building behind it and cheer when they are done
  if (state === 'won') {
    if (!cheered && crates.every((c) => c.gone) && !camp.busy()) {
      cheered = t;
      camp.cheer();
    }
    if (!endAt && t - wonAt > 1.4) endAt = t;
  }
  if (unlockUntil && t >= unlockUntil) {
    unlockUntil = 0;
    $('unlockNote').classList.remove('on');
  }
  // a win that earned the camp something new: the camera goes to it first, it pops up, a note names it; then the card
  // (playtest 2026-11-07, Jonas, Dan, Leo: the card covered the part of the camp where it appeared, so they missed it)
  if (endAt && t >= endAt && state === 'won' && !showing && !watchUrl && fresh.length && !spotlit) {
    spotlight();
    endAt = t + 2.8;
  } else if (endAt && t >= endAt) {
    endAt = Infinity;
    showCard();
    if (watchUrl && !film && !q.has('stay')) {
      const next = state === 'won' && !q.has('proto') ? (levelIndex + 1) % LIST.length : levelIndex;
      setTimeout(() => goTo(next), 3500);
    }
  }
  // the camera glides to its frame and breathes a little
  const u = camera.userData, k = 1 - Math.exp(-dt * 2.2);
  if (u.to) {
    u.look.lerp(u.to.look, k);
    u.d += (u.to.d - u.d) * k;
    u.dir.lerp(u.to.dir, k).normalize();
  }
  camera.position.copy(u.look).addScaledVector(u.dir, u.d);
  camera.position.x += Math.sin(t * 0.21) * 0.06;
  camera.position.y += Math.sin(t * 0.17) * 0.04;
  camera.lookAt(u.look);
}

let last = performance.now();
// a phone (world.js LOW): the sun's shadows redrawn every other frame (every frame while a crate is in hand, so its shadow
// keeps up), and if it still runs under about 36 frames a second over two seconds of play, one pixel per point from then on
let shadowTick = 0;
const pace = { n: 0, sum: 0 };
function frame(now) {
  const raw = now - last, dt = Math.min(raw / 1000, 0.05);
  last = now;
  if (document.visibilityState === 'visible' && !playtest) step(dt);
  if (LOW) renderer.shadowMap.autoUpdate = !!drag || (++shadowTick & 1) === 0;
  renderer.render(scene, camera);
  renderer.shadowMap.autoUpdate = true;
  if (LOW && !playtest && renderer.getPixelRatio() > 1 && document.visibilityState === 'visible' && state === 'play' && raw < 200) {
    pace.sum += raw;
    if (++pace.n >= 120) {
      if (pace.sum / pace.n > 28) {
        renderer.setPixelRatio(1);
        resize();
      }
      pace.n = pace.sum = 0;
    }
  }
  requestAnimationFrame(frame);
}

// ?playtest: the clock stands still and moves only through these helpers, so simulated players (each in a background tab, in
// parallel) take their time to look and think. look() saves the screen, with the page's text, buttons and cards drawn in, to
// the scratch saver (127.0.0.1:5199) as <name>.jpg for the tester to open.
const playtest = q.has('playtest');
let played = 0, PT = null;
if (playtest) {
  // ?hz=144: the game stepped as a 144 Hz screen would (CrazyGames: physics the same at 144 and 165 Hz)
  const HZ = Number(q.get('hz')) || 60;
  const tick = () => {
    step(1 / HZ);
    played += 1000 / HZ;
  };
  const at = (x, y) => document.elementFromPoint(x, y) || canvas;
  const fire = (el, type, x, y, kind) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: kind, bubbles: true, isPrimary: true }));
  PT = {
    run(ms) {
      for (let k = 0; k < Math.min(ms, 10000) / (1000 / HZ); k++) tick();
      renderer.render(scene, camera);
      return `played ${(played / 1000).toFixed(1)} s`;
    },
    // press at one point, slide to another over ms (the game plays meanwhile), let go; or drag([[x, y], [x, y], ...], ms) through
    // bends. The points after the first are where the crate's middle should go: the hand keeps its grip, as a player watching
    // the crate would (a still picture between moves can't show a tester how far off the middle they took hold). The checks
    // use that; simulated players pass hold 'spot': the later points are where the cell they pressed goes (playtest
    // 2026-10-29: testers aimed the cell they held, and the middle rule shifted long crates sideways by up to a cell and a half)
    drag(x1, y1, x2, y2, ms = 600, kind = 'mouse', hold = 'middle') {
      let pts = Array.isArray(x1) ? x1 : [[x1, y1], [x2, y2]];
      if (Array.isArray(x1)) [ms, kind, hold] = [y1 ?? 600, x2 ?? 'mouse', y2 ?? 'middle'];
      const el = at(...pts[0]), n = Math.max(2, Math.round(Math.min(ms, 10000) / (1000 / HZ) / (pts.length - 1)));
      fire(el, 'pointerdown', ...pts[0], kind);
      if (drag) {
        // (a press on the line between two of the crate's cells, its middle say, is taken as it is: no cell to aim)
        const b = L.blocks[drag.i], spot = (g, n) => {
            const f = g - Math.min(Math.floor(g), n - 1);
            return Math.abs(f - 0.5) < 0.35 ? f - 0.5 : 0;
          },
          ox = hold === 'spot' ? spot(drag.grabX, b.w) : drag.grabX - b.w / 2,
          oy = hold === 'spot' ? spot(drag.grabY, b.h) : drag.grabY - b.h / 2;
        pts = pts.map((p, k) => {
          const g = k && gridAt({ clientX: p[0], clientY: p[1] });
          return g ? window.BD3.screen(g.x + ox, g.y + oy) : p;
        });
      }
      for (let s = 1; s < pts.length; s++) {
        const [ax, ay] = pts[s - 1], [bx, by] = pts[s];
        for (let k = 1; k <= n; k++) {
          fire(el, 'pointermove', ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, kind);
          tick();
        }
      }
      fire(el, 'pointerup', ...pts[pts.length - 1], kind);
      for (let k = 0; k < 20; k++) tick();
      renderer.render(scene, camera);
      return `dragged; played ${(played / 1000).toFixed(1)} s`;
    },
    tap(x, y, kind = 'mouse') {
      const el = at(x, y);
      fire(el, 'pointerdown', x, y, kind);
      tick();
      fire(el, 'pointerup', x, y, kind);
      (el.closest('button') || el).click?.();
      for (let k = 0; k < 10; k++) tick();
      renderer.render(scene, camera);
      return `tapped ${el.closest('button') ? 'a button' : el.tagName.toLowerCase()}`;
    },
    async look(name) {
      renderer.render(scene, camera);
      // the page's own animations and fades (the card, its stars popping) run on the screen's frames, which a background tab
      // doesn't get: finished, as a player looking a moment later would see them
      for (const a of document.getAnimations()) {
        try {
          a.finish();
        } catch {}
      }
      // (?lookmax=1280: bigger pictures, for store screenshots)
      const r = canvas.getBoundingClientRect(), k = Math.min(1, (Number(q.get('lookmax')) || 800) / Math.max(innerWidth, innerHeight));
      const out = document.createElement('canvas');
      out.width = Math.round(innerWidth * k);
      out.height = Math.round(innerHeight * k);
      const g = out.getContext('2d');
      g.drawImage(canvas, r.left * k, r.top * k, r.width * k, r.height * k);
      // the page's own layer (HUD, hint, cards) painted over it: backgrounds, icons and words where they sit on screen
      const paint = async (el) => {
        const cs = getComputedStyle(el), b = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || !b.width) return;
        // a gradient (the trail's sheet and stops): its last colour stands for it
        const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : (cs.backgroundImage.match(/rgba?\([^)]*\)/g) || []).pop();
        if (bg && !/,\s*0\)$/.test(bg)) {
          g.fillStyle = bg;
          g.beginPath();
          g.roundRect(b.left * k, b.top * k, b.width * k, b.height * k, Math.min(parseFloat(cs.borderTopLeftRadius) || 0, b.height / 2) * k);
          g.fill();
        }
        if (el.tagName.toLowerCase() === 'svg' || el.tagName === 'IMG') {
          const img = el.tagName === 'IMG' ? el : new Image();
          if (img !== el) {
            // drawn from a copy that carries the styles the page's CSS gives its parts (the trail's path)
            const copy = el.cloneNode(true), to = [copy, ...copy.querySelectorAll('*')];
            [el, ...el.querySelectorAll('*')].forEach((n, i) => {
              const c = getComputedStyle(n);
              for (const p of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity']) to[i].style.setProperty(p, c.getPropertyValue(p));
            });
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(copy));
            await img.decode().catch(() => {});
          }
          g.drawImage(img, b.left * k, b.top * k, b.width * k, b.height * k);
          return;
        }
        for (const n of el.childNodes) {
          if (n.nodeType === 1) await paint(n);
          else if (n.nodeType === 3 && n.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(n);
            const rows = [...range.getClientRects()].filter((q) => q.width > 0), words = n.textContent.trim().split(/\s+/);
            g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`;
            g.fillStyle = cs.color;
            g.textBaseline = 'middle';
            g.shadowColor = cs.textShadow !== 'none' ? 'rgba(0,0,0,0.6)' : 'transparent';
            g.shadowBlur = 4 * k;
            let w = 0;
            rows.forEach((row, ri) => {
              let line = '';
              while (w < words.length) {
                const next = line ? `${line} ${words[w]}` : words[w];
                if (line && ri < rows.length - 1 && g.measureText(next).width > row.width * k + 2) break;
                line = next;
                w++;
              }
              g.fillText(ri === 0 && /^\s/.test(n.textContent) ? ` ${line}` : line, row.left * k, (row.top + row.height / 2) * k);
            });
            g.shadowColor = 'transparent';
          }
        }
      };
      // the teaching hand (an svg): drawn as a picture where it is
      const hand = $('hand');
      if (Number(hand.style.opacity) > 0.05) {
        const hb = hand.getBoundingClientRect(), img = new Image();
        img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(hand.querySelector('svg').outerHTML.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
        await img.decode().catch(() => {});
        g.globalAlpha = Number(hand.style.opacity);
        g.drawImage(img, hb.left * k, hb.top * k, hb.width * k, hb.height * k);
        g.globalAlpha = 1;
      }
      // in the page's own order: the settings, cards and the trail over the game's buttons
      const z = (el) => Number(getComputedStyle(el).zIndex) || 0;
      for (const el of [$('hud'), $('hint'), $('ember'), $('hintBtn'), $('pills'), $('unlockNote'), $('card'), $('settings'), $('howto'), $('intro'), $('map'), $('rotate')].sort((a, b) => z(a) - z(b))) await paint(el);
      const res = await fetch(`http://127.0.0.1:5199/${name}`, { method: 'POST', body: out.toDataURL('image/jpeg', 0.75) }).catch(() => null);
      return res && res.ok ? `look: ${out.width}x${out.height}; page x = image x * ${(1 / k).toFixed(3)}, page y = image y * ${(1 / k).toFixed(3)}; played ${(played / 1000).toFixed(1)} s` : 'look failed';
    },
  };
}

// film: fixed 1/30 s steps, each frame posted to the scratch saver (127.0.0.1:5199) as <name>_NNNN.jpg
// covers and films wait until every texture in the scene has its picture (a cold cache: the rocks came out black, 2026-11-07)
async function texturesReady(ms = 8000) {
  const t0 = performance.now();
  for (;;) {
    let waiting = false;
    scene.traverse((o) => {
      for (const m of [].concat(o.material || [])) for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap']) {
        const img = m[k]?.image;
        if (m[k] && (!img || (img.complete === false) || (img.width === 0 && !img.data))) waiting = true;
      }
    });
    if (!waiting || performance.now() - t0 > ms) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function filmLoop() {
  await texturesReady();
  const seconds = Number(q.get('secs')) || 40, name = q.get('name') || 'bd';
  const shot = (n) => fetch(`http://127.0.0.1:5199/${name}_${String(n).padStart(4, '0')}`, { method: 'POST', body: canvas.toDataURL('image/jpeg', 0.9) }).catch(() => {});
  let n = 0;
  for (; n < seconds * 30; n++) {
    step(1 / 30);
    renderer.render(scene, camera);
    await shot(n);
    if (endAt === Infinity) break;
  }
  for (let k = 0; k < 60; k++) {   // 2 s on the finished camp
    step(1 / 30);
    renderer.render(scene, camera);
    await shot(++n);
  }
  window.filmDone = true;
}

// ?cover&w=&h=&name= (with ?camp=full&level=7&dusk=0.4&weather=clear, say): the store covers (CrazyGames: 1920x1080,
// 800x1200, 800x800, the title the only text, no border): the whole camp at the given light, the title at the bottom
// (their crop marks the top-left for labels), posted to the scratch saver as <name>.jpg
async function coverShot() {
  const W = Number(q.get('w')) || 1920, H = Number(q.get('h')) || 1080, zoom = Number(q.get('zoom')) || 1;
  view = 'end';   // the whole camp, room kept at the bottom (for the title here)
  resize();
  camera.userData.d *= zoom;
  camera.userData.to.d *= zoom;
  await texturesReady();
  for (let k = 0; k < 150; k++) step(1 / 30);
  // the title is the only text a cover may carry: no bedtime numbers
  scene.traverse((o) => o.isSprite && (o.visible = false));
  renderer.render(scene, camera);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');
  g.drawImage(canvas, 0, 0, W, H);
  // a soft dusk at the bottom for the title to sit on
  const fade = g.createLinearGradient(0, H * 0.62, 0, H);
  fade.addColorStop(0, 'rgba(14, 10, 24, 0)');
  fade.addColorStop(1, 'rgba(14, 10, 24, 0.62)');
  g.fillStyle = fade;
  g.fillRect(0, H * 0.62, W, H * 0.38);
  const title = 'Before Dark';
  let size = Math.min(W * 0.16, H * 0.16);
  g.font = `italic 700 ${size}px Georgia, 'Times New Roman', serif`;
  while (g.measureText(title).width > W * 0.84) g.font = `italic 700 ${(size *= 0.95)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const x = W / 2, y = H - Math.max(H * 0.07, size * 0.42);
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(255, 150, 60, 0.75)';
  g.shadowBlur = size * 0.35;
  g.lineWidth = size * 0.09;
  g.strokeStyle = '#3a2414';
  g.strokeText(title, x, y);
  g.shadowBlur = 0;
  const ink = g.createLinearGradient(0, y - size, 0, y);
  ink.addColorStop(0, '#fff6dc');
  ink.addColorStop(1, '#ffc46a');
  g.fillStyle = ink;
  g.fillText(title, x, y);
  await fetch(`http://127.0.0.1:5199/${q.get('name') || 'cover'}`, { method: 'POST', body: out.toDataURL('image/jpeg', 0.92) }).catch(() => {});
  window.coverDone = true;
}

// a handle for automated checks: the state, and where a cell (x, y in cells, fractions allowed) is on screen in CSS pixels
window.BD3 = {
  state: () => ({ level: levelIndex + 1, moves, left: left(pos), state, lostTo, bedtime: nextBedtime(L, moves), dusk: duskShown, budget: L.budget, par: L.par, pos: pos.map((p) => p && p.slice()), weather: weather.kind() }),
  goTo: (k) => goTo(k - 1),
  // a hidden test tab gets no resize notices until it draws (a phone turned in a check): what they would do
  resize: () => (rotateCheck(), resize(), { portrait: campPortrait, rotate: $('rotate').classList.contains('on') }),
  levels: () => LIST.length,
  workers: () => camp.workers(),
  screen(x, y) {
    const p = new THREE.Vector3(board.ox + x, 0.3, board.oz + y).project(camera), r = canvas.getBoundingClientRect();
    return [Math.round(r.left + ((p.x + 1) / 2) * r.width), Math.round(r.top + ((1 - p.y) / 2) * r.height)];
  },
  // for close looks in checks: frame a point (x, z) from distance d, and the camp's sites
  frame(x, z, d) {
    Object.assign(camera.userData, { look: new THREE.Vector3(x, 0, z), d, to: null });
  },
  sites: () => Object.fromEntries(Object.entries(camp.sites).map(([k, s]) => [k, [+s.pos.x.toFixed(2), +s.pos.z.toFixed(2)]])),
  // for tools/check-camp.js: how far each site's builds reach, what the forest planted, the board, and the bedtime gates swung open
  campReach: () => camp.reach(),
  forest: () => forest.userData.items,
  keepOut: () => campKeepOut(SIZE),
  board: () => ({ ox: board.ox, oz: board.oz, w: L.w, h: L.h, gates: L.gates }),
  campBoxes: () => camp.boxes(),
  campLoop: () => camp.loop(),
  doors: () => Object.entries(board.doors || {}).map(([color, d]) => {
    const tip = (a) => [d.hinge.x + Math.cos(a) * d.len, d.hinge.z - Math.sin(a) * d.len];
    return { color, hinge: [d.hinge.x, d.hinge.z], open: tip(d.open), shut: tip(d.shut) };
  }),
  blocks: () => L.blocks, level: () => L, drag: () => drag && { ...drag, occ: undefined, before: undefined }, crates: () => crates.map((c) => ({ x: c.cur.x - board.ox - c.b.w / 2, y: c.cur.z - board.oz - c.b.h / 2, gone: c.gone, out: !!c.out })), step, scene, camera, renderer,
};

await loadModels();
// the forest keeps out of every place the camp can have (Oleg: a bed stood in a tree)
const forest = plantForest(scene, models, SIZE.w / 2 + 2.2, SIZE.h / 2 + 2.2, 7, campKeepOut(SIZE));
load();
weather = makeWeather(scene, fx, { hx: SIZE.w / 2 + 3, hz: SIZE.h / 2 + 3, bx: SIZE.w / 2, bz: SIZE.h / 2 });
weather.set(q.get('weather') || L.weather || 'breeze');
resize();
ui();
$('load').style.opacity = 0;
setTimeout(() => $('load')?.remove(), 600);
if (playtest) {
  $('load').remove();   // a background tab runs timers late
  window.PT = PT;   // ready
}
let seenHowto = false;
try {
  seenHowto = store.getItem('bd.howto') === '1';
} catch {}
// the first level teaches by doing: no card first, a hand shows the first drag (teach(); the ? button still shows how to play)
intro();
// a returning player starts on the camp trail (a new one goes straight into level 1)
if (reached > 0 && (!playtest || q.has('seed')) && !film && !cover && !watchUrl && !q.has('level') && !q.has('proto')) openTrail();
if (film || cover) {
  for (const id of ['hud', 'pills', 'hint', 'intro', 'howto']) $(id).style.display = 'none';
  if (film) filmLoop();
  else coverShot();
} else requestAnimationFrame(frame);

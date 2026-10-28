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
import { reach, pathTo, exitGate, startPos, left, gateOpen, stranded, nextBedtime } from '../slide/model.js';
import { darkMask, lostCrates } from '../slide/dark.js';
import { makeWorld, plantForest, natureMaterial } from './world.js';
import { buildBoard, buildCrate, waveFlags, stencilCanvas, SUPPLY, GROUND } from './board.js';
import { makeParticles, dustPuff, unpackBurst } from './fx.js';
import { makeCamp, campKeepOut } from './camp.js';
import { makeWeather, KINDS } from './weather.js';
import * as sfx from './sound.js';

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
let reached = 0;
try {
  reached = Number(localStorage.getItem('bd3.reached')) || 0;
} catch {}
let levelIndex = Math.min(Math.max((Number(q.get('level')) || (q.has('proto') ? 5 : q.has('playtest') ? 1 : reached + 1)) - 1, 0), LIST.length - 1);
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
  await Promise.all([
    ...KENNEY.map((n) => load(n, `assets/models/${n}.glb`)),
    ...PEOPLE.map((n) => load(n, `assets/models/people/${n}.glb`)),
    ...NATURE.map((n) => load(n, `assets/nature/${n}.glb`, true)),
  ]);
}

let L, board, camp, weather, crates, pos, moves, hist, state, drag, duskShown = 0, endAt = 0, wonAt = 0, cheered = 0, t = 0, lastBump = 0, firstMove = true, spots, lostTo = null;
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
  return q.has('proto') ? null : { colors, prior, total, size: SIZE, count };
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
  camp = makeCamp(scene, models, board, L, fx, peopleStyle, vh > vw, story(levelIndex));
  lostTo = null;
  firstMove = true;
  duskShown = 0;
  pos = startPos(L);
  moves = 0;
  hist = [];
  state = 'play';
  drag = null;
  endAt = wonAt = cheered = 0;
  crates = L.blocks.map((b, i) => {
    const c = buildCrate(models, b), at = cellCenter(i, b.x, b.y);
    c.group.position.copy(at);
    scene.add(c.group);
    return { ...c, b, i, cur: at.clone(), target: at.clone(), vel: new THREE.Vector3(), path: [], lift: 0, liftV: 0, squash: 0, squashV: 0, tiltX: 0, tiltZ: 0, jig: 0, out: null, gone: false, trip: 0 };
  });
  $('card').classList.remove('on');
  legend();
  ui();
  view = 'play';
  resize();
  sfx.jingle('start');
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
  if (!pull) {
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

// ---- the first level teaches by doing: until the first crate is picked up, a hand drags the level's first move (its crate
// out through its gate, along its path), over and over. Returns the crate's colour while the hand holds it (its lane
// lights, as for a player) ----
let handT = 0;
function teach(dt) {
  const el = $('hand'), on = levelIndex === 0 && moves === 0 && !drag && state === 'play' && !watching() && !q.has('proto') && !$('howto').classList.contains('on');
  if (!on) {
    el.style.opacity = 0;
    handT = 0;
    return null;
  }
  const m = L.solution[0], b = L.blocks[m.i], p = pos[m.i];
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
function noWay() {
  if (!drag || t - lastNoWay < 0.7) return;
  const i = drag.i, b = L.blocks[i], dx = drag.tx - drag.fx, dy = drag.ty - drag.fy;
  if (Math.hypot(dx, dy) < 0.45) return;
  lastNoWay = t;
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

function release() {
  if (!drag) return;
  const { i, from, before, occ } = drag, b = L.blocks[i];
  // settle on the nearest free cell (the footprint is free, so a rounding of it is too)
  const cands = [[Math.round(drag.fx), Math.round(drag.fy)], [Math.floor(drag.fx), Math.floor(drag.fy)], [Math.ceil(drag.fx), Math.ceil(drag.fy)], [Math.floor(drag.fx), Math.ceil(drag.fy)], [Math.ceil(drag.fx), Math.floor(drag.fy)]]
    .map(([x, y]) => [clamp(x, 0, L.w - b.w), clamp(y, 0, L.h - b.h)]);
  const spot = cands.find(([x, y]) => fits(i, x, y, occ)) || from;
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
  drag = null;
  pos[i] = spot.slice();
  crates[i].target.copy(cellCenter(i, spot[0], spot[1]));
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
      try {
        localStorage.setItem('bd3.reached', String(reached));
      } catch {}
    }
  } else if (moves >= L.budget) {
    state = 'lost';
    endAt = t + 1.6;
  }
  ui();
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
  sfx.play('pick', 0.4, 0.9);
  sfx.whoosh(false, 0.14);
  ui();
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
  if (!g) return;
  let i = blockAt(Math.floor(g.x), Math.floor(g.y));
  if (i < 0) i = crateNear(g.x, g.y);
  if (i < 0) return;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
  grab(i, g.x, g.y);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const g = gridAt(e);
  if (g) steer(g.x, g.y);
});
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
window.addEventListener('contextmenu', (e) => e.preventDefault());
$('restart').onclick = () => {
  sfx.wake();
  load();
};
$('undo').onclick = () => {
  sfx.wake();
  undo();
};
$('sound').onclick = () => {
  sfx.wake();
  sfx.toggleMute();
  ui();
};
$('help').onclick = () => {
  sfx.wake();
  $('howto').classList.add('on');
};
$('howtoGo').onclick = () => {
  sfx.wake();
  $('howto').classList.remove('on');
  try {
    localStorage.setItem('bd.howto', '1');
  } catch {}
};
// the weather button is for reviews only (?review); players get each level's own weather
if (!q.has('review')) $('pills').style.display = 'none';
// iPhones: sound starts (and comes back after a call or another app) only inside a touch's end or a click
for (const type of ['touchend', 'click']) document.addEventListener(type, () => sfx.wake(), { passive: true });
$('weather').onclick = () => {
  sfx.wake();
  weather.set(KINDS[(KINDS.indexOf(weather.kind()) + 1) % KINDS.length]);
  ui();
};

// ---- the feel: springs, landings, deliveries ----

function updateCrate(c, i, dt) {
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
    bot.step = { finger: [p[0] + 0.5, p[1] + 0.5], pts, pause: 0.15 };
    return;
  }
  if ((bot.step.pause -= dt) > 0) return;
  const f = bot.step.finger, goal = bot.step.pts[0];
  if (goal && drag) {
    const dx = goal[0] - f[0], dy = goal[1] - f[1], d = Math.hypot(dx, dy), stepLen = 7.5 * dt;
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
  bot.wait = m.exit ? 0.8 : 0.5;
}

// ---- the evening, the camera, the HUD ----

// The camera's frames. 'play': the board and the ground in front of its gates as large as the screen allows, with as much of
// the camp round it as fits while the board stays big (on a phone the board fills the width and the camp runs off the
// sides; Oleg, 2026-10-24: the phone board was too small); 'camp': everything, the whole camp; 'end': everything above the
// end card at the bottom (the card used to sit over the middle and hide the camp, the level's reward). The camera glides
// from one frame to the next.
let view = 'play';
function frameFor(w, h, kind) {
  const board = [new THREE.Vector3(-L.w / 2 - 0.45, 0, -L.h / 2 - 0.45), new THREE.Vector3(L.w / 2 + 0.45, 0, L.h / 2 + 0.45)];
  for (const s of Object.values(spots)) board.push(s.pos.clone().addScaledVector(s.out, 0.7).addScaledVector(s.side, 0.9), s.pos.clone().addScaledVector(s.out, 0.7).addScaledVector(s.side, -0.9));
  const all = [...board, ...camp.extent()];
  const portrait = h > w;
  camera.aspect = w / h;
  camera.fov = portrait ? 40 : 32;
  camera.updateProjectionMatrix();
  const elev = THREE.MathUtils.degToRad(portrait ? 62 : 52), dir = new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
  // the end frame keeps the end card's own height free at the bottom (measured once it shows; a short screen gets a compact card)
  const box = $('card').classList.contains('on') && $('card').querySelector('.box').getBoundingClientRect();
  const cardRoom = box && box.height ? box.height + 22 : portrait ? 250 : 210;
  const top = 1 - (2 * (portrait ? 120 : 95)) / h, bottom = -1 + (2 * (kind === 'end' ? cardRoom : 40)) / h;
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
  if (kind !== 'play') return { ...whole, dir };
  // playing: on a phone the board and its gates' paths fill the width (the crates' landing spots and the camp run off the
  // sides); on a wide screen zoomed out from the board's own frame only as far as keeps the board big (a third at most)
  if (portrait) {
    const m = 0.8, phone = fit([new THREE.Vector3(-L.w / 2 - m, 0, -L.h / 2 - m), new THREE.Vector3(L.w / 2 + m, 0, L.h / 2 + m)], 0.5);
    return { ...phone, dir };
  }
  const near = fit(board);
  return whole.d <= near.d * 1.35 ? { ...whole, dir } : { look: near.look, d: near.d * 1.35, dir };
}
function fitCamera(w, h, glide = false) {
  const f = frameFor(w, h, view), u = camera.userData;
  camera.userData = { look: glide && u.look ? u.look : f.look.clone(), d: glide && u.d ? u.d : f.d, dir: f.dir, to: f };
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
  if (!L) return;
  const [w, h] = viewSize();
  if (film || cover) renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  fitCamera(w, h);
  const ps = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const p of Object.values(fx)) p.setScale(ps);
}
new ResizeObserver(resize).observe(canvas);

function ui() {
  const leftMoves = Math.max(0, L.budget - moves), stars = moves <= L.par ? 3 : moves <= L.par + 1 ? 2 : 1;
  // the star goal up front ("Best: 9" read as somebody's score, playtest 2026-10-24)
  $('level').textContent = `Level ${levelIndex + 1}`;
  $('movesText').textContent = state === 'won' ? 'All delivered!' : leftMoves === 1 ? '1 move before dark' : `${leftMoves} moves before dark`;
  $('moves').classList.toggle('low', leftMoves <= 2 && state === 'play');
  $('best').textContent = state === 'won' ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} in ${moves} moves` : `★★★ in ${L.par} moves`;
  $('undo').disabled = !hist.length || !(state === 'play' || (state === 'lost' && lostTo !== null));
  $('sound').textContent = sfx.isMuted() ? '✕' : '♪';
  // the dark's countdown, from level 2: when it takes its next cells
  // bedtime's countdown, from level 2: the next gate to close that still has crates to come
  const bed = state === 'play' ? L.gates.filter((g) => g.closeAt > moves && pos.some((p, k) => p && L.blocks[k].color === g.color)).sort((a, b) => a.closeAt - b.closeAt)[0] : null;
  const n = bed && bed.closeAt - moves, crew = bed && CREW_NAME[bed.color];
  $('hint').textContent = watching() ? (showing ? `The way in ${L.par} moves` : '') : bed ? (n === 1 ? `${crew} goes to bed after your next move` : `${crew} goes to bed in ${n} moves`) : levelIndex === 0 && !q.has('proto') && moves === 0 ? 'Drag a crate out through the gate of its colour' : levelIndex === 0 && !q.has('proto') && moves === 1 && state === 'play' ? 'One drag is one move: fewer moves, more stars' : '';
  if (weather) $('weather').textContent = WEATHER_LABEL[weather.kind()];
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
// in bold)
const INTRO = [
  null,
  { title: 'Level 2: bedtime', rule: '<b>Some crews go to bed early.</b> The number on a gate is the moves they have left.' },
  { title: 'Level 3: two early crews', rule: '<b>Two crews go to bed early.</b> Whose crates go first?' },
  { title: 'Level 4: round the rocks', rule: '<b>Rocks never move.</b> Drag a crate round them in one go.' },
  { title: 'Level 5: three early crews', rule: '<b>Three crews go to bed early.</b> Watch the numbers on the gates.' },
  { title: 'Level 6: tight corners', rule: '<b>More rocks, two early crews.</b> Plan who goes first.' },
  { title: 'Level 7: the whole camp', rule: '<b>Every crew is here:</b> all six gates.' },
];
function intro() {
  const I = !q.has('proto') && !watching() && INTRO[levelIndex];
  if (!I) return;
  let seen = false;
  try {
    seen = localStorage.getItem(`bd3.card${levelIndex}`) === '1';
  } catch {}
  if (seen && !playtest) return;
  const before = new Set(LIST.slice(0, levelIndex).flatMap((l) => l.blocks.map((b) => b.color)));
  $('introTitle').textContent = I.title;
  $('introRule').innerHTML = I.rule;
  legend($('introLegend'), before);
  $('intro').classList.add('on');
}
$('introGo').onclick = () => {
  sfx.wake();
  $('intro').classList.remove('on');
  try {
    localStorage.setItem(`bd3.card${levelIndex}`, '1');
  } catch {}
};

function showCard() {
  const won = state === 'won', stars = moves <= L.par ? 3 : moves <= L.par + 1 ? 2 : 1, last = levelIndex >= LIST.length - 1;
  const button = (text, go, alt) => {
    const b = document.createElement('button');
    b.textContent = text;
    if (alt) b.className = 'alt';
    b.onclick = () => {
      sfx.wake();
      go();
    };
    $('cardBtns').append(b);
  };
  $('cardBtns').innerHTML = '';
  if (won) {
    $('cardTitle').textContent = last ? 'The camp is ready for the night' : 'Camp ready before dark';
    $('cardStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    if (showing) {
      $('cardTitle').textContent = `The way in ${L.par} moves`;
      $('cardStars').textContent = '';
      $('cardText').textContent = 'Your turn?';
      button('Try it', () => ((showing = false), load()));
      if (!last) button('Next level', () => ((showing = false), goTo(levelIndex + 1)), true);
    } else {
      $('cardText').textContent = `${moves} moves (target ${L.par})${last && !q.has('proto') ? '. More levels soon!' : ''}`;
      if (!last) button('Next level', () => goTo(levelIndex + 1));
      button('Play again', () => load(), !last);
      if (stars < 3) button('Show me', () => ((showing = true), (bot = null), load()), true);
      if (last && levelIndex > 0) button('From level 1', () => goTo(0), true);
    }
  } else if (lostTo !== null) {
    $('cardTitle').textContent = 'Gone to bed';
    $('cardStars').textContent = '';
    $('cardText').textContent = `${CREW_NAME[L.blocks[lostTo].color]} shut the gate before the ${SUPPLY[L.blocks[lostTo].color].name} came.`;
    button('Undo', () => undo());
    button('Try again', () => load(), true);
    button('Show me', () => ((showing = true), (bot = null), load()), true);
  } else {
    $('cardTitle').textContent = 'Night fell';
    $('cardStars').textContent = '';
    $('cardText').textContent = 'The camp was not ready in time.';
    button('Try again', () => load());
  }
  $('card').classList.add('on');
  if (view !== 'end') setView('end');
  if (won) sfx.jingle('win');
  else {
    sfx.play('heavy', 0.4, 0.6);
    sfx.jingle('lose', 0.2);
  }
}

// to another level: a new day; the camp keeps what it has (camp.js builds it from the levels before)
function goTo(k) {
  levelIndex = k;
  bot = null;
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
  sfx.setEvening(duskShown, camp.fireSize());
  sfx.tick();
  camp.update(dt, t, duskShown, state, moves);
  fireflies(dt);
  waveFlags(board.flags, t);
  board.tick(dt, t, drag ? L.blocks[drag.i].color : teach(dt));
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
  if (endAt && t >= endAt) {
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
  }
  camera.position.copy(u.look).addScaledVector(u.dir, u.d);
  camera.position.x += Math.sin(t * 0.21) * 0.06;
  camera.position.y += Math.sin(t * 0.17) * 0.04;
  camera.lookAt(u.look);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (document.visibilityState === 'visible' && !playtest) step(dt);
  renderer.render(scene, camera);
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
    // the crate would (a still picture between moves can't show a tester how far off the middle they took hold)
    drag(x1, y1, x2, y2, ms = 600, kind = 'mouse') {
      let pts = Array.isArray(x1) ? x1 : [[x1, y1], [x2, y2]];
      if (Array.isArray(x1)) [ms, kind] = [y1 ?? 600, x2 ?? 'mouse'];
      const el = at(...pts[0]), n = Math.max(2, Math.round(Math.min(ms, 10000) / (1000 / HZ) / (pts.length - 1)));
      fire(el, 'pointerdown', ...pts[0], kind);
      if (drag) {
        const b = L.blocks[drag.i], ox = drag.grabX - b.w / 2, oy = drag.grabY - b.h / 2;
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
      const r = canvas.getBoundingClientRect(), k = Math.min(1, 800 / Math.max(innerWidth, innerHeight));
      const out = document.createElement('canvas');
      out.width = Math.round(innerWidth * k);
      out.height = Math.round(innerHeight * k);
      const g = out.getContext('2d');
      g.drawImage(canvas, r.left * k, r.top * k, r.width * k, r.height * k);
      // the page's own layer (HUD, hint, cards) painted over it: backgrounds, icons and words where they sit on screen
      const paint = async (el) => {
        const cs = getComputedStyle(el), b = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || !b.width) return;
        const bg = cs.backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)') {
          g.fillStyle = bg;
          g.beginPath();
          g.roundRect(b.left * k, b.top * k, b.width * k, b.height * k, Math.min(parseFloat(cs.borderTopLeftRadius) || 0, b.height / 2) * k);
          g.fill();
        }
        if (el.tagName.toLowerCase() === 'svg' || el.tagName === 'IMG') {
          const img = el.tagName === 'IMG' ? el : new Image();
          if (img !== el) {
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el));
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
      for (const el of [$('hud'), $('hint'), $('pills'), $('howto'), $('intro'), $('card')]) await paint(el);
      const res = await fetch(`http://127.0.0.1:5199/${name}`, { method: 'POST', body: out.toDataURL('image/jpeg', 0.75) }).catch(() => null);
      return res && res.ok ? `look: ${out.width}x${out.height}; page x = image x * ${(1 / k).toFixed(3)}, page y = image y * ${(1 / k).toFixed(3)}; played ${(played / 1000).toFixed(1)} s` : 'look failed';
    },
  };
}

// film: fixed 1/30 s steps, each frame posted to the scratch saver (127.0.0.1:5199) as <name>_NNNN.jpg
async function filmLoop() {
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
  seenHowto = localStorage.getItem('bd.howto') === '1';
} catch {}
// the first level teaches by doing: no card first, a hand shows the first drag (teach(); the ? button still shows how to play)
intro();
if (film || cover) {
  for (const id of ['hud', 'pills', 'hint', 'intro', 'howto']) $(id).style.display = 'none';
  if (film) filmLoop();
  else coverShot();
} else requestAnimationFrame(frame);

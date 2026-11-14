// The camp's extras: what the stars earn (benchmark 2026-10-28, item 2: every published game has a progression layer; ours is
// the camp's own collection, not coins). Each stands in every level once the star total reaches it, made here in code:
// lanterns on the board's corner posts, a string of pennants along its back, a hammock, a tame fox on its cushion, a canoe on
// trestles, the camp's flag, a rack of fish drying and a signpost. The ones on the ground have their own places, the same in
// every level: the two front corners of the clearing on a wide screen, the strip under the board on a phone. They are part of
// the camp's ground plan (camp.js campKeepOut), so the forest and the animals keep off them and tools/check-camp.js checks
// them like the builds.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GROUND, SUPPLY, fitted, canvasTex, woodMaterial } from './board.js';
import { animal } from './wildlife.js';

export const EXTRAS = [
  { id: 'lanterns', name: 'Lanterns', stars: 3 },
  { id: 'bunting', name: 'Bunting', stars: 7 },
  { id: 'hammock', name: 'Hammock', stars: 12 },
  { id: 'fox', name: 'Camp fox', stars: 18 },
  { id: 'canoe', name: 'Canoe', stars: 25 },
  { id: 'flag', name: 'Camp flag', stars: 33 },
  { id: 'fish', name: 'Fish rack', stars: 42 },
  { id: 'signpost', name: 'Signpost', stars: 51 },
];
export const earned = (total) => EXTRAS.filter((e) => total >= e.stars).map((e) => e.id);

// the ground each one takes: [x, z, width along x, depth along z]. On a wide screen x runs out from the board's side (the sign
// says which side) and z from its front edge; on a phone x is from the middle and z from the front edge
const SPOT = {
  landscape: { hammock: [-3.9, -0.25, 2.7, 1.1], fox: [-2.6, 1.05, 0.9, 0.9], fish: [-5.15, 1.05, 1.9, 0.8], canoe: [3.75, -0.35, 2.5, 1.2], flag: [4.7, -1.55, 1.3, 0.8], signpost: [2.55, 1.05, 1.4, 0.8],
    // the shop's things (2026-11-14, shop.js), in the ground the camp leaves free: by the tent and the workshop behind the
    // board (past the far gates' ground), left of the water, right of the stores
    bigtent: [-0.75, -10.75, 1.7, 1.6], logs: [0.75, -10.6, 1.3, 1.2], lamppost: [-0.15, -9.55, 0.9, 0.6], lantern: [0.15, -9.5, 0.6, 0.6],
    garden: [-5.35, -2.95, 1.5, 1.1], pumpkins: [-4.95, -1.35, 1.0, 0.8], campbench: [4.8, -4.75, 1.3, 0.6], candles: [4.95, -2.6, 0.55, 0.55] },
  // upright (2026-11-07): between the water and the stores in front of the board (camp.js ROW), past the gates' ground
  // (all 0.4 further out with the row in front, 2026-11-07)
  portrait: { hammock: [-1.45, 3.5, 2.7, 1.1], canoe: [1.45, 3.55, 2.5, 1.2], fox: [-2.4, 4.85, 0.9, 0.9], fish: [-0.75, 4.8, 1.9, 0.8], signpost: [0.95, 4.8, 1.4, 0.8], flag: [2.35, 4.8, 1.3, 0.8],
    // the shop's things: a second row under the extras (the camp's depth counts them only once bought: camp.js campDepth)
    bigtent: [-3.75, 6.45, 1.7, 1.6], logs: [-2.1, 6.2, 1.3, 1.2], garden: [-0.45, 6.15, 1.5, 1.1], campbench: [1.1, 6.05, 1.3, 0.6],
    pumpkins: [2.4, 6.1, 1.0, 0.8], lamppost: [3.3, 6.0, 0.9, 0.6], lantern: [3.95, 6.0, 0.6, 0.6], candles: [4.55, 5.95, 0.55, 0.55] },
};
// the shop's things keep their own ground each (the first extras keep the block round their corner, extrasKeepOut)
// (bigtent, campbench: not 'tent' and 'bench', the camp's own builds' kinds, camp.js PLAN)
export const DECOR = ['bigtent', 'logs', 'lamppost', 'lantern', 'garden', 'pumpkins', 'campbench', 'candles'];
// each ground extra's rectangle for the game's largest board: { x, z, w, d }
export function extraSpots(size, portrait) {
  const W = size.w / 2, H = size.h / 2, out = {};
  for (const [id, [x, z, w, d]] of Object.entries(SPOT[portrait ? 'portrait' : 'landscape'])) {
    out[id] = { x: portrait ? x : Math.sign(x) * (W + Math.abs(x)), z: H + z, w, d };
  }
  return out;
}
// their ground, as camp.js campKeepOut gives it (gap(x, z): how far a point lies outside the rectangle): the block round all
// of an area's places (a wide screen has two, one each side; a phone one), so the forest and the animals keep off the corner
// as a whole, not only off each piece
export function extrasKeepOut(size) {
  return [false, true].flatMap((portrait) => {
    const areas = {};
    for (const [id, s] of Object.entries(extraSpots(size, portrait))) {
      const a = (areas[DECOR.includes(id) ? id : portrait ? 'middle' : s.x < 0 ? 'left' : 'right'] ||= [Infinity, -Infinity, Infinity, -Infinity]);
      a[0] = Math.min(a[0], s.x - s.w / 2), a[1] = Math.max(a[1], s.x + s.w / 2), a[2] = Math.min(a[2], s.z - s.d / 2), a[3] = Math.max(a[3], s.z + s.d / 2);
    }
    return Object.entries(areas).map(([side, [x0, x1, z0, z1]]) => ({
      color: 'extra', kind: `extras (${side})`, portrait, x: (x0 + x1) / 2, z: (z0 + z1) / 2,
      gap: (x, z) => Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1)),
    }));
  });
}

let mats = null;
function materials() {
  if (mats) return mats;
  const stripes = canvasTex(128, (g, s) => {
    const cols = ['#e8dcc0', '#c84a3a', '#e8dcc0', '#3a7ab8'];
    for (let k = 0; k < 8; k++) {
      g.fillStyle = cols[k % 4];
      g.fillRect(0, (k * s) / 8, s, s / 8);
    }
  });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  const flag = canvasTex(128, (g, s) => {
    ['red', 'orange', 'yellow', 'green', 'blue', 'purple'].forEach((c, k) => {
      g.fillStyle = SUPPLY[c].flag;
      g.fillRect(0, (k * s) / 6, s, s / 6 + 1);
    });
  });
  return (mats = {
    pole: woodMaterial('#7a5530', 41), post: woodMaterial('#6a4628', 42), plank: woodMaterial('#b08050', 43),
    hull: new THREE.MeshStandardMaterial({ color: 0xc4522c, roughness: 0.55, side: THREE.DoubleSide }), gunwale: woodMaterial('#5a3a1e', 44),
    metal: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf2c440, roughness: 0.3, metalness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffb060, emissiveIntensity: 0.4, roughness: 0.2 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc8b080, roughness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.95, side: THREE.DoubleSide }),
    flag: new THREE.MeshStandardMaterial({ map: flag, roughness: 0.9, side: THREE.DoubleSide }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x8a5ab0, roughness: 1 }), bowl: new THREE.MeshStandardMaterial({ color: 0x3f7ab8, roughness: 0.5 }),
    pillow: new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 1 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 1, flatShading: true }),
    fish: new THREE.MeshStandardMaterial({ color: 0x6f9cc0, roughness: 0.3, metalness: 0.35 }),
    pennant: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    halo: new THREE.SpriteMaterial({ map: halo(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  });
}
function halo() {
  return canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
};
const cyl = (r, h, mat, x, y, z) => mesh(new THREE.CylinderGeometry(r, r, h, 8), mat, x, y + h / 2, z);

// ---- on the board: a lantern on a crooked pole at each corner post; pennants strung between the two at the back ----
function lanterns(M, board) {
  const g = new THREE.Group(), glows = [];
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [sx, sz] of corners) {
    const x = sx < 0 ? board.ox - 0.12 : board.ox + board.w + 0.12, z = sz < 0 ? board.oz - 0.12 : board.oz + board.h + 0.12;
    const pole = new THREE.Group();
    pole.position.set(x, GROUND + 0.62, z);
    pole.rotation.y = Math.atan2(sx, sz);   // the arm reaches out from the board's corner
    pole.add(cyl(0.055, 1.2, M.pole, 0, 0, 0), mesh(new RoundedBoxGeometry(0.07, 0.07, 0.4, 1, 0.025), M.pole, 0, 1.16, 0.17));
    const lamp = new THREE.Group();
    lamp.position.set(0, 0.86, 0.32);
    lamp.scale.setScalar(1.5);   // big enough to read from the game's camera
    lamp.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4), M.metal, 0, 0.13, 0),
      mesh(new THREE.ConeGeometry(0.11, 0.09, 8), M.metal, 0, 0.06, 0), mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8), M.glass, 0, -0.06, 0),
      mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8), M.metal, 0, -0.145, 0));
    const glow = new THREE.Sprite(M.halo.clone());
    glow.scale.setScalar(0.9);
    glow.position.set(0, -0.05, 0);
    lamp.add(glow);
    glows.push(glow);
    pole.add(lamp);
    g.add(pole);
  }
  return { group: g, update: (dt, t, dusk) => {
    M.glass.emissiveIntensity = 0.3 + dusk * 1.8;
    glows.forEach((s, k) => (s.material.opacity = (0.1 + dusk * 0.85) * (1 + Math.sin(t * 9 + k * 2) * 0.05)));
  } };
}

function bunting(M, board) {
  const y0 = GROUND + 0.62 + 1.0, x0 = board.ox - 0.12, x1 = board.ox + board.w + 0.12, z = board.oz - 0.12, sag = 0.32;
  // behind a far gate's banner (board.js) the line steps back and has no pennants: the banner stays whole (2026-10-29)
  const behind = (x) => Math.max(0, ...(board.signs || []).map(([a, b]) => Math.min(1, Math.min(x - a + 0.4, b + 0.4 - x) / 0.3)));
  const at = (u) => {
    const x = x0 + (x1 - x0) * u;
    return new THREE.Vector3(x, y0 - sag * (1 - (2 * u - 1) ** 2), z - 0.62 * behind(x));
  };
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 49 }, (_, k) => at(k / 48)));
  const g = new THREE.Group();
  g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.012, 4), M.rope));
  // the pennants: one geometry, a triangle each in the crews' colours, their tips swaying in the breeze
  const all = Math.max(6, Math.round((x1 - x0) / 0.42)), colors = Object.values(SUPPLY).map((s) => new THREE.Color(s.flag));
  const us = Array.from({ length: all }, (_, k) => (k + 0.5) / all).filter((u) => !behind(x0 + (x1 - x0) * u)), n = us.length;
  const pos = new Float32Array(n * 9), col = new Float32Array(n * 9), tips = [];
  for (let k = 0; k < n; k++) {
    const u = us[k], a = at(u - 0.18 / (x1 - x0)), b = at(u + 0.18 / (x1 - x0)), m = at(u);
    pos.set([a.x, a.y, a.z, b.x, b.y, b.z, m.x, m.y - 0.3, m.z], k * 9);
    for (let v = 0; v < 3; v++) col.set(colors[k % colors.length].toArray(), k * 9 + v * 3);
    tips.push(m);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const flags = mesh(geo, M.pennant);
  flags.receiveShadow = false;
  g.add(flags);
  return { group: g, update: (dt, t) => {
    for (let k = 0; k < n; k++) pos[k * 9 + 8] = tips[k].z + Math.sin(t * 3.1 + k * 0.9) * 0.07;
    geo.attributes.position.needsUpdate = true;
  } };
}

// ---- on the ground ----
function hammock(M) {
  const g = new THREE.Group();
  for (const x of [-1.15, 1.15]) {
    g.add(cyl(0.06, 1.15, M.post, x, 0, 0), mesh(new RoundedBoxGeometry(0.14, 0.08, 0.7, 1, 0.03), M.post, x, 0.04, 0));
    const rope = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.48, 4), M.rope, x * 0.85, 0.885, 0);
    rope.rotation.z = x > 0 ? -0.82 : 0.82;   // from the cloth's end up to the post's top
    g.add(rope);
  }
  // the cloth: a strip sagging between the ropes, its sides curled up
  const geo = new THREE.PlaneGeometry(1.6, 0.62, 16, 6);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const u = p.getX(k) / 0.8, v = p.getZ(k) / 0.31;
    p.setY(k, 0.72 - 0.3 * (1 - u * u) + 0.12 * v * v * (1 - 0.6 * u * u));
    p.setZ(k, p.getZ(k) * (1 - 0.75 * u * u));   // gathered at the ends
  }
  geo.computeVertexNormals();
  g.add(mesh(geo, M.cloth), mesh(new RoundedBoxGeometry(0.26, 0.09, 0.3, 2, 0.04), M.pillow, -0.62, 0.62, 0));
  return { group: g };
}

function fox(M, models) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.07, 16), M.cushion, 0, 0.035, 0), cyl(0.07, 0.05, M.bowl, 0.33, 0, 0.24));
  const me = animal(models, 'fox', { length: 0.72 });
  if (!me) return { group: g };
  // a paler, golden coat than the wild ones, so it reads as the camp's own
  me.model.traverse((m) => {
    if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (mat.name === 'Main') mat.color.set('#f0a85a');
  });
  me.root.position.y = 0.08;
  me.root.rotation.y = 0.6;
  g.add(me.root);
  let mode = 'Idle_2_HeadLow', timer = 3;
  me.play(mode);
  return { group: g, update: (dt) => {
    me.mixer.update(dt);
    if ((timer -= dt) > 0) return;
    mode = mode === 'Idle' ? 'Idle_2_HeadLow' : Math.random() < 0.5 ? 'Idle' : 'Idle_2';
    timer = mode === 'Idle_2_HeadLow' ? 5 + Math.random() * 5 : 2 + Math.random() * 2;
    me.play(mode);
  } };
}

function canoe(M) {
  const g = new THREE.Group();
  for (const x of [-0.6, 0.6]) {
    g.add(mesh(new RoundedBoxGeometry(0.1, 0.06, 0.62, 1, 0.02), M.plank, x, 0.42, 0));
    for (const z of [-0.24, 0.24]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), M.post, x, 0.2, z));
  }
  // the hull, upside down: half an ellipsoid pinched to a point at both ends, painted, with dark gunwales round its rim and a
  // keel along its top
  const L = 1.1, H = 0.34, B = 0.3, shape = (x, y, z) => [x * L, (y - 0.25 * x * x) * H, z * Math.sqrt(Math.max(0, 1 - x * x)) * B];
  const geo = new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let k = 0; k < p.count; k++) p.setXYZ(k, ...shape(p.getX(k), p.getY(k), p.getZ(k)));
  geo.computeVertexNormals();
  const hull = new THREE.Group();
  hull.position.y = 0.45;
  hull.add(mesh(geo, M.hull));
  const line = (pts, closed) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), 60, 0.028, 5, closed), M.gunwale);
  const rim = [], keel = [];
  for (let k = 0; k <= 40; k++) {
    const a = (k / 40) * Math.PI * 2, u = (k / 40) * 2 - 1;
    rim.push(new THREE.Vector3(...shape(Math.cos(a) * 0.985, 0, Math.sin(a))));
    keel.push(new THREE.Vector3(...shape(u * 0.97, Math.sqrt(1 - u * u * 0.94), 0)));
  }
  hull.add(line(rim, true), line(keel, false));
  g.add(hull);
  const paddle = new THREE.Group();
  paddle.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), M.plank, 0, 0, 0), mesh(new RoundedBoxGeometry(0.14, 0.32, 0.03, 1, 0.012), M.plank, 0, -0.55, 0));
  paddle.position.set(-0.25, 0.025, 0);
  paddle.rotation.set(Math.PI / 2, 0, Math.PI / 2);   // flat on the ground, the blade along x
  const holder = new THREE.Group();
  holder.add(paddle);
  holder.position.set(0.2, 0, 0.36);
  holder.rotation.y = 0.2;
  g.add(holder);
  return { group: g };
}

function flag(M) {
  const outer = new THREE.Group(), g = new THREE.Group();
  g.position.x = -0.3;   // the pole left of the middle, the cloth flying right: the outline centred on its place
  outer.add(g);
  [[0, 0, 0.22], [0.2, 0.12, 0.15], [-0.16, 0.16, 0.14], [0.06, -0.2, 0.13]].forEach(([x, z, r]) => {
    const s = mesh(new THREE.DodecahedronGeometry(r), M.stone, x, r * 0.5, z);
    s.scale.y = 0.6;
    g.add(s);
  });
  g.add(cyl(0.04, 2.7, M.pole, 0, 0, 0), mesh(new THREE.SphereGeometry(0.07, 10, 8), M.gold, 0, 2.74, 0));
  const geo = new THREE.PlaneGeometry(0.9, 0.54, 10, 1), p = geo.attributes.position, base = Float32Array.from(p.array);
  const cloth = mesh(geo, M.flag, 0.47, 2.36, 0);
  g.add(cloth);
  return { group: outer, update: (dt, t) => {
    for (let k = 0; k < p.count; k++) {
      const u = (base[k * 3] + 0.45) / 0.9;
      p.setZ(k, Math.sin(t * 4 - u * 5) * 0.09 * u);
      p.setY(k, base[k * 3 + 1] - u * u * 0.05);
    }
    p.needsUpdate = true;
  } };
}

function fish(M, models) {
  const g = new THREE.Group();
  for (const x of [-0.58, 0.58]) g.add(cyl(0.045, 1.05, M.post, x, 0, 0));
  const bar = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), M.pole, 0, 1.0, 0);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  // the fish hang by their tails: flat bodies turned side on to the camera
  const body = new THREE.SphereGeometry(0.1, 12, 8), tail = new THREE.ConeGeometry(0.1, 0.13, 3);
  tail.rotateX(Math.PI);
  [-0.38, -0.13, 0.13, 0.38].forEach((x, k) => {
    const f = new THREE.Group();
    const b = mesh(body, M.fish, 0, 0, 0);
    b.scale.set(0.4, 2.3, 1.05);
    const tl = mesh(tail, M.fish, 0, 0.27, 0);
    tl.scale.set(0.3, 1, 1.25);
    f.add(b, tl, mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 3), M.rope, 0, 0.37, 0));
    f.position.set(x, 0.56 + (k % 2) * 0.03, 0);
    f.rotation.y = Math.PI / 2 + (k - 1.5) * 0.12;   // side on to the camera
    g.add(f);
  });
  const rod = mesh(new THREE.CylinderGeometry(0.01, 0.02, 1.7, 5), M.plank, 0.72, 0.8, 0.2);
  rod.rotation.z = -0.2;
  g.add(rod);
  const bucket = models.get('bucket');
  if (bucket) {
    const b = fitted(bucket, 0.3);
    b.position.set(-0.3, 0, 0.26);
    b.traverse((m) => m.isMesh && (m.castShadow = true));
    g.add(b);
  }
  return { group: g };
}

function signpost(M) {
  const g = new THREE.Group();
  g.add(cyl(0.06, 1.55, M.post, 0, 0, 0));
  // the arms point off to the sides, so the sign stays narrow from front to back
  [['CAMP', 1.32, 0.3], ['LAKE', 1.08, Math.PI + 0.25], ['FOREST', 0.84, -0.45]].forEach(([word, y, turn], k) => {
    const tex = canvasTex(128, (c, s) => {
      c.fillStyle = '#c89a62';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#4a2e16';
      c.font = 'bold 30px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(word, s / 2 - 6, s / 2);
    });
    const arm = new THREE.Group(), back = tex.clone();
    tex.repeat.set(1, 0.27);
    tex.offset.set(0, 0.365);
    back.repeat.set(1, 0.27);   // the words on the back face too
    back.offset.set(0, 0.365);
    const words = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.9 });
    const board = mesh(new THREE.BoxGeometry(0.62, 0.17, 0.04), [M.plank, M.plank, M.plank, M.plank, words(tex), words(back)], 0.3, 0, 0);
    const point = new THREE.CylinderGeometry(0.085, 0.085, 0.04, 3);
    point.rotateX(Math.PI / 2);
    point.rotateZ(Math.PI / 2);   // a triangle pointing along the board
    const tip = mesh(point, M.plank, 0.62, 0, 0);
    arm.add(board, tip);
    arm.position.y = y;
    arm.rotation.y = turn;
    g.add(arm);
  });
  return { group: g };
}

const MAKE = { lanterns, bunting, hammock, fox, canoe, flag, fish, signpost };

// ---- bought in the shop (2026-11-14, shop.js): CC0 models fitted to their places (shop.js SHOP_MODELS), the lights glowing
// at dusk like the lanterns ----
function glowAt(M, g, x, y, z, s) {
  const sp = new THREE.Sprite(M.halo.clone());
  sp.scale.setScalar(s);
  sp.position.set(x, y, z);
  g.add(sp);
  return sp;
}
export function decor(id, M, models) {
  const g = new THREE.Group(), glows = [];
  const put = (name, size, x = 0, z = 0, turn = 0) => {
    const src = models.get(name);
    if (!src) return 0;
    const m = fitted(src, size);
    m.position.set(x, 0, z);
    m.rotation.y = turn;
    g.add(m);
    return new THREE.Box3().setFromObject(m).max.y;   // its height
  };
  if (id === 'candles') glows.push(glowAt(M, g, 0, put('shop-candles', 0.44) * 0.95, 0, 0.8));
  if (id === 'pumpkins') {
    const h = put('shop-pumpkin', 0.5, -0.17, 0.08, 0.35);
    put('shop-pumpkin-small', 0.3, 0.27, 0.16, -0.5);
    put('shop-pumpkin-yellow', 0.3, 0.17, -0.2, 0.9);
    glows.push(glowAt(M, g, -0.17, h * 0.5, 0.2, 0.8));
  }
  if (id === 'lantern') glows.push(glowAt(M, g, 0, put('shop-lantern', 0.5) * 0.5, 0, 1.5));
  if (id === 'lamppost') glows.push(glowAt(M, g, 0, put('shop-lamppost', 0.8, 0, 0, Math.PI / 2) * 0.72, 0, 1.4));   // (its arm across, along x)
  if (id === 'campbench') put('shop-bench', 1.15);
  if (id === 'logs') put('shop-logs', 1.15, 0, 0, Math.PI / 2);   // (the long side along x)
  if (id === 'bigtent') put('shop-tent', 1.5);
  if (id === 'garden') {
    // a patch of dug earth, corn at the back and wheat in front
    g.add(mesh(new RoundedBoxGeometry(1.35, 0.06, 0.95, 1, 0.025), new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 1 }), 0, 0.03, 0));
    for (const x of [-0.42, 0, 0.42]) put('shop-corn', 0.34, x, -0.25, x * 2);
    for (const x of [-0.45, -0.15, 0.15, 0.45]) put('shop-wheat', 0.26, x, 0.24, x * 3);
  }
  return { group: g, update: (dt, t, dusk) => glows.forEach((s, k) => (s.material.opacity = (0.06 + dusk * 0.85) * (1 + Math.sin(t * 8 + k * 2) * 0.06))) };
}

// ---- a pet (Kenney Cube Pets): it wanders the camp's free ground (camp.js gives it: points to go to and free(x, z) for the
// way there), stops to look round or eat, and dances when the level is won ----
const PET_H = { chick: 0.5, bunny: 0.56, cat: 0.56, beaver: 0.58, dog: 0.62, parrot: 0.56 };   // (the campers 0.95; smaller got lost from the camera)
function pet(id, models, ground, seed) {
  const me = animal(models, `pet-${id}`, { height: PET_H[id] || 0.42 });
  if (!me || !ground?.points.length) return null;
  let rnd = seed * 9301 + 49297;
  const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const start = ground.points[Math.floor(R() * ground.points.length)];
  me.root.position.set(start[0], GROUND, start[1]);
  me.root.rotation.y = R() * Math.PI * 2;
  const g = new THREE.Group();
  g.add(me.root);
  let mode = 'idle', timer = 1 + R() * 3, to = null;
  me.play('idle');
  // a free straight way to a point near by
  const clear = (x0, z0, x1, z1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.2);
    for (let k = 1; k <= n; k++) if (!ground.free(x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n)) return false;
    return true;
  };
  return { group: g, pet: true, root: me.root, where: () => me.root.position, update: (dt, t, dusk, state) => {
    me.mixer.update(dt);
    const p = me.root.position;
    if (state === 'won') {
      if (mode !== 'dance') (mode = 'dance'), me.play('dance'), (to = null);
      return;
    }
    if (mode === 'dance') (mode = 'idle'), me.play('idle'), (timer = 1);
    if (mode === 'walk' && to) {
      const dx = to[0] - p.x, dz = to[1] - p.z, d = Math.hypot(dx, dz), step = Math.min(d, 0.75 * dt);
      p.x += (dx / (d || 1)) * step;
      p.z += (dz / (d || 1)) * step;
      const want = Math.atan2(dx, dz);
      let turn = want - me.root.rotation.y;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      me.root.rotation.y += turn * Math.min(1, dt * 8);
      if (d < 0.05) (mode = R() < 0.35 ? 'eat' : 'idle'), me.play(mode), (timer = 2 + R() * 4), (to = null);
      return;
    }
    if ((timer -= dt) > 0) return;
    // somewhere else, within a few steps, by a free straight way
    for (let tries = 0; tries < 12; tries++) {
      const q = ground.points[Math.floor(R() * ground.points.length)];
      if (Math.hypot(q[0] - p.x, q[1] - p.z) > 4 || !clear(p.x, p.z, q[0], q[1])) continue;
      to = q;
      mode = 'walk';
      me.play('walk');
      return;
    }
    timer = 1 + R() * 2;
  } };
}

// the earned extras in this level's camp. scene: the camp's (its pieces go when the camp does); size: the game's largest board;
// ground: the camp's free ground for the pets (camp.js)
export function makeExtras(scene, models, board, size, portrait, ids, fx, ground) {
  const M = materials(), spots = extraSpots(size, portrait), built = {}, reveals = [];
  const build = (id) => {
    if (built[id]) return null;
    const isPet = id in PET_H;
    if (!MAKE[id] && !DECOR.includes(id) && !isPet) return null;
    const e = isPet ? pet(id, models, ground, Object.keys(PET_H).indexOf(id) + 1) : DECOR.includes(id) ? decor(id, M, models) : MAKE[id](M, id === 'lanterns' || id === 'bunting' ? board : models);
    if (!e) return null;
    if (spots[id]) {
      const s = spots[id];
      e.group.position.set(s.x, GROUND, s.z);
      if (portrait && id === 'canoe') e.group.rotation.y = 0.15;
    }
    e.group.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
    scene.add(e.group);
    return (built[id] = e);
  };
  ids.forEach(build);
  return {
    has: (id) => !!built[id],
    // a ground extra's place ({ x, z, w, d }), for the camera to go and look at it when it is earned; null for the ones on the
    // board (the lanterns, the bunting)
    where: (id) => spots[id] || (built[id]?.pet ? { x: built[id].where().x, z: built[id].where().z, w: 1, d: 1, pet: true } : null),
    // a newly earned one appears, after `delay` s, with a pop and a shower of sparks (the win card names it). It is built
    // at once, so the camera's end frame takes it in
    reveal(id, delay = 0) {
      const e = build(id);
      if (!e) return;
      (e.root || e.group).scale.setScalar(0.001);   // a pet: itself (its group stands at the world's middle)
      reveals.push({ id, e, t: -delay, sparked: false });
    },
    update(dt, t, dusk, state) {
      for (const e of Object.values(built)) e.update?.(dt, t, dusk, state);
      for (let k = reveals.length - 1; k >= 0; k--) {
        const r = reveals[k];
        r.t += dt;
        if (r.t < 0) continue;
        if (!r.sparked) {
          r.sparked = true;
          const s = spots[r.id], sites = s ? [new THREE.Vector3(s.x, 0, s.z)] : r.e.pet ? [r.e.where().clone().setY(0)] : [new THREE.Vector3(board.ox, 0, board.oz), new THREE.Vector3(board.ox + board.w, 0, board.oz)];
          for (const p of sites) for (let n = 0; n < 30; n++) {
            const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 1.8;
            fx.glow.spawn({ x: p.x, y: 0.5 + Math.random() * 0.5, z: p.z, vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2, vz: Math.sin(a) * sp, life: 0.8 + Math.random() * 0.5, size: 0.14, color: 0xffe08a, alpha: 1, gravity: 2.2, drag: 1 });
          }
        }
        const u = Math.min(1, r.t / 0.6), s = u >= 1 ? 1 : 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
        (r.e.root || r.e.group).scale.setScalar(Math.max(0.001, s));
        if (u >= 1) reveals.splice(k, 1);
      }
    },
    // the ground the built ones stand on, for the camera's frame
    extent: () => Object.keys(built).filter((id) => spots[id]).flatMap((id) => {
      const s = spots[id];
      return [new THREE.Vector3(s.x - s.w / 2, 0, s.z - s.d / 2), new THREE.Vector3(s.x + s.w / 2, 0, s.z + s.d / 2)];
    }),
    // for tools/check-camp.js: the ground ones' meshes, as camp.boxes() gives the builds' ({ color, kind, pts }), and their spots
    boxes: () => Object.entries(built).filter(([id]) => spots[id]).flatMap(([id, e]) => {
      const out = [], v = new THREE.Vector3();
      e.group.updateWorldMatrix(true, true);
      e.group.traverseVisible((m) => {
        if (!m.isMesh || m.isSkinnedMesh) return;
        const bb = (m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox)), pts = [];
        for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
          v.set(x, y, z).applyMatrix4(m.matrixWorld);
          pts.push([v.x, v.z]);
        }
        out.push({ color: 'extra', kind: id, pts, spot: spots[id] });
      });
      return out;
    }),
  };
}

// one of the shop's things on its own, for its picture in the shop (tools/shop-icons.js): built as in the camp, the lanterns
// and the bunting round a small board, a pet standing
export function shopObject(id, models) {
  const M = materials();
  if (id in PET_H) {
    const me = animal(models, `pet-${id}`, { height: PET_H[id] });
    if (me) me.play('idle');
    return me && me.root;
  }
  if (DECOR.includes(id)) return decor(id, M, models).group;
  if (!MAKE[id]) return null;
  return MAKE[id](M, id === 'lanterns' || id === 'bunting' ? { ox: -0.6, oz: -0.45, w: 1.2, h: 0.9, signs: [] } : models).group;
}

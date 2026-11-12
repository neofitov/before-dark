// The camp, built round the board from nothing (Oleg, 2026-10-24; his twist a, the camp grows). Each gate has its worker
// waiting on the gate's mat. A crate that comes out lands on the mat; the worker picks it up, carries it round the board to
// their building site, unpacks it and builds the next stages of their own work: the campfire (stones, a log teepee, the fire
// lit, log benches, a cooking tripod, a woodpile), the tent (groundsheet, A-frame poles, ridge pole, canvas, guy ropes, a
// lantern), the workshop (sawhorses, a plank top, tools and a vice, shelter posts, a plank roof, timber and a chopping
// block), the water place, the stores, the beds. Every piece is made here in code and drops into place. The more crates a
// level brings, the more each build gets. Workers cheer when the camp is ready and sit down as night falls; deer, foxes and
// birds are about the glade (wildlife.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { fitted, GROUND, makeFire, flickerFire, woodMaterial, canvasTex } from './board.js';
import { dustPuff } from './fx.js';
import { makeCamper } from './people.js';
import { makeWildlife } from './wildlife.js';
import { makeExtras, extrasKeepOut, extraSpots } from './extras.js';
import * as sfx from './sound.js';

const KIND = { red: 'fire', orange: 'tent', green: 'bench', blue: 'water', purple: 'chest', yellow: 'beds' };
// how fast the workers go (Oleg, 2026-10-24: "make the npc move and do work faster", then "even faster"; at first it was walk
// 1.7, carry 1.35, run 3.4 and the work about 2.5 times as slow); people.js plays their clips faster to match (PACE)
const SPEED = { walk: 3.9, carry: 3.3, run: 5.6, stroll: 1.5 };
const WORK = { pickup: 0.18, putdown: 0.14, stage: 0.2, finish: 0.3, swing: 0.4 };
// where each part piles its extras (makeCamp's extra(): a crate more than its stages): a spot in its frame and what goes there
const PILE = { fire: [-0.85, 0.55, 'log'], tent: [0, -0.35, 'box'], bench: [1.05, 0.15, 'plank'], water: [0.05, -0.62, 'bucket'], chest: [-0.55, -0.2, 'box'], beds: [0, -2.05, 'blanket'] };

// The ground each part of the camp takes once everything is built (all its stages and extras): a rectangle in its site's frame,
// `across` along the site's right and `towards` the board, from the site's middle (the beds go round the campfire, behind
// it). Everything else follows from these (Oleg, 2026-10-24: a bed stood in a tree; "make sure this doesn't happen in future
// level designs, not just for beds but everything the npcs build"): each place is pushed out from the board until its
// rectangle clears the path the workers walk round the largest board (campLayout); the forest grows round the rectangles
// (campKeepOut, world.js plantForest); tools/check-camp.js fails when anything built pokes out of its rectangle or runs into
// the board, the path, a gate or another part. A new build or a bigger one: widen its rectangle here.
export const PLAN = {
  fire: { across: [-1.15, 1.15], towards: [-1.05, 0.9] },
  tent: { across: [-0.75, 0.95], towards: [-1.45, 1.45] },
  bench: { across: [-1.35, 1.35], towards: [-0.7, 0.85] },
  water: { across: [-1.1, 1.2], towards: [-0.95, 0.4] },
  chest: { across: [-0.9, 1.35], towards: [-0.7, 0.85] },
  beds: { across: [-2.4, 2.45], towards: [-2.5, 0.2] },
};
// the workers' path round a board: a rounded rectangle a step outside the frame (makeCamp's loop)
const PATH = { out: 1.05, round: 0.7, clear: 0.35 };
// how far a point lies outside that path round a board w x h (negative: inside it)
function pathGap(x, z, w, h) {
  const qx = Math.abs(x) - (w / 2 + PATH.out - PATH.round), qz = Math.abs(z) - (h / 2 + PATH.out - PATH.round);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - PATH.round;
}
// a site's rectangle as points round its edge (world x, z)
function edge(pos, f, plan) {
  const r = [-f.z, f.x], pts = [];
  const [a0, a1] = plan.across, [b0, b1] = plan.towards;
  for (let k = 0; k <= 20; k++) {
    const a = a0 + ((a1 - a0) * k) / 20, b = b0 + ((b1 - b0) * k) / 20;
    for (const [u, v] of [[a, b0], [a, b1], [a0, b], [a1, b]]) pts.push([pos.x + r[0] * u + f.x * v, pos.z + r[1] * u + f.z * v]);
  }
  return pts;
}

// where each colour's site goes: a fixed place round the board for each part of the camp, the same in every level (the camp
// stays and grows from level to level), never in front of the board on a wide screen; out along its direction from the
// board until all it will build clears the workers' path. `size` is the game's largest board.
const SLOT = { landscape: { red: -90, orange: -140, green: -40, blue: 180, purple: 0, yellow: 150 } };
// a phone held upright (Oleg, 2026-11-07: "rearrange camp top-bottom for portrait"; the board fills the phone's width and the
// places round it were off the screen's sides): a row behind the board (the tent, the campfire with the beds behind it, the
// workshop) and one in front of it (the water, the stores), across the width the phone shows: [x, the row's side]
// (each row starts past the ground in front of the gates, where the crates land and the workers wait: tools/check-camp.js)
// (the third number: further out than that. The row behind a cell further back, room to breathe round the board and the far
// gates' workers in view: Oleg, 2026-11-07; the workshop more, level 20's red gate on the right folds its leaf back along the
// frame towards it; the row in front half a cell. Half a cell more each when the board grew again and the workers left the
// gates for their own places, Oleg 2026-11-07: "increase board size more and breathing space more")
// (the fourth: how far the worker stands in from the site's middle, along its right, towards the phone's middle: the row in
// front is nearer the camera, so its sides are cut first)
const ROW = { red: [0, -1, 1.5], orange: [-3.7, -1, 1.5], green: [3.9, -1, 2.4], blue: [-4.1, 1, 0.9, 0.7], purple: [3.95, 1, 0.9, -0.7], yellow: [0, 1] };
export function campLayout(colors, size, portrait) {
  const rx = size.w / 2 + 3, rz = size.h / 2 + 2.8, sites = {};
  for (const color of colors) {
    const kinds = color === 'red' || color === 'yellow' ? ['fire', 'beds'] : [KIND[color]];
    if (portrait) {
      // straight out from the board's side until all it builds clears the path
      const [x, side, back = 0, lean = 0] = ROW[color], f = new THREE.Vector3(0, 0, -side), at = (t) => new THREE.Vector3(x, 0, side * (size.h / 2 + t));
      let t = 2.05 + back + Math.max(...kinds.map((k) => PLAN[k].towards[1]));
      while (t < 6 && kinds.some((k) => edge(at(t), f, PLAN[k]).some(([px, pz]) => pathGap(px, pz, size.w, size.h) < PATH.clear))) t += 0.02;
      sites[color] = { pos: at(t).setY(GROUND), f, r: new THREE.Vector3(-f.z, 0, f.x), kind: KIND[color], color, lean };
      continue;
    }
    const a = (SLOT.landscape[color] * Math.PI) / 180, dir = new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz);
    const f = dir.clone().negate().normalize();
    let t = 1;
    while (t < 3 && kinds.some((k) => edge(dir.clone().multiplyScalar(t), f, PLAN[k]).some(([x, z]) => pathGap(x, z, size.w, size.h) < PATH.clear))) t += 0.02;
    const pos = dir.multiplyScalar(t).setY(GROUND);
    sites[color] = { pos, f, r: new THREE.Vector3(-f.z, 0, f.x), kind: KIND[color], color };
  }
  // the bed maker works at the campfire: the camp sleeps round it, in the beds she builds (Oleg, 2026-10-24)
  if (sites.yellow) {
    const fire = campLayout(['red'], size, portrait).red;
    Object.assign(sites.yellow, { pos: fire.pos.clone(), f: fire.f.clone(), r: fire.r.clone() });
  }
  return sites;
}

// how deep the camp is upright, front to back: from the back of its row behind the board to the front of the extras before
// it (main.js frames an upright phone to centre this)
export function campDepth(size, portrait) {
  let z0 = Infinity, z1 = -Infinity;
  for (const s of Object.values(campLayout(Object.keys(KIND), size, portrait))) {
    for (const k of s.color === 'red' || s.color === 'yellow' ? ['fire', 'beds'] : [s.kind]) {
      for (const [, z] of edge(s.pos, s.f, PLAN[k])) (z0 = Math.min(z0, z)), (z1 = Math.max(z1, z));
    }
  }
  for (const e of Object.values(extraSpots(size, portrait))) (z0 = Math.min(z0, e.z - e.d / 2)), (z1 = Math.max(z1, e.z + e.d / 2));
  return [z0, z1];
}

// every place the camp can have, in both screen shapes: the ground the forest keeps out of (and the extras' places,
// extras.js). `size` is the game's largest board; each has `gap(x, z)`, how far a point lies outside its rectangle
export function campKeepOut(size) {
  return [...[false, true].flatMap((portrait) => Object.values(campLayout(Object.keys(KIND), size, portrait)).map((s) => {
    const { across, towards } = PLAN[s.kind];
    const gap = (x, z) => {
      const dx = x - s.pos.x, dz = z - s.pos.z, a = dx * s.r.x + dz * s.r.z, b = dx * s.f.x + dz * s.f.z;
      return Math.hypot(Math.max(0, across[0] - a, a - across[1]), Math.max(0, towards[0] - b, b - towards[1]));
    };
    return { color: s.color, kind: s.kind, portrait, x: s.pos.x, z: s.pos.z, gap };
  })), ...extrasKeepOut(size)];
}

// story: what the game's levels bring ({ colors: the camp's parts so far, prior: { colour: crates brought by earlier levels },
// total: { colour: crates in the whole game }, size: the largest board, extras: what the stars have earned (extras.js) });
// without it, this level alone
export function makeCamp(world, models, board, L, fx, style, portrait, story) {
  const added = [], pops = [], drops = [];
  const scene = { add: (...o) => (added.push(...o), world.add(...o)), remove: (...o) => world.remove(...o) };
  const spots = board.spots;
  story ||= { colors: Object.keys(spots), prior: {}, total: Object.fromEntries(Object.entries(spots).map(([c, s]) => [c, s.total])), size: L };
  const sites = campLayout(story.colors, story.size, portrait);
  const M = materials();

  // the camp's beds: four places round the campfire, feet to the fire. The bed maker builds proper beds there (BUILD.beds);
  // a crew turning in early sleeps in its place's bed, or on a bedroll rolled out on the ground while there is none yet
  const fireSite = sites.red || Object.values(sites)[0];
  const beds = [[-1.6, -0.35], [1.65, -0.45], [-0.95, -1.6], [0.95, -1.65]].map(([a, b]) => {
    const pos = fireSite.pos.clone().addScaledVector(fireSite.r, a).addScaledVector(fireSite.f, b).setY(GROUND);
    const toFire = fireSite.pos.clone().sub(pos).setY(0).normalize(), yaw = Math.atan2(toFire.x, toFire.z);
    const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    return { pos, yaw, f, frame: null, roll: null, side: pos.clone().add(new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(0.62)) };
  });
  const made = (bed) => !!(bed.frame && bed.frame.parent);
  // a group at a bed, turned with it: its children sit in the bed's own frame (z runs from the pillow to the fire)
  function atBed(bed, ...children) {
    const g = new THREE.Group();
    g.position.copy(bed.pos);
    g.rotation.y = bed.yaw;
    g.add(...children);
    g.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
    scene.add(g);
    return g;
  }
  const part = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  };
  // a wooden bed with a mattress, full size (a camper is 0.95 tall)
  function bedFrame(k) {
    const bed = beds[k], leg = new RoundedBoxGeometry(0.07, 0.26, 0.07, 1, 0.015), rail = new RoundedBoxGeometry(0.06, 0.09, 1.18, 1, 0.02);
    bed.frame = atBed(bed,
      ...[[-0.28, -0.56], [0.28, -0.56], [-0.28, 0.56], [0.28, 0.56]].map(([x, z]) => part(leg, M.post, x, 0.13, z)),
      part(rail, M.plank, -0.29, 0.2, 0), part(rail, M.plank, 0.29, 0.2, 0),
      part(new RoundedBoxGeometry(0.64, 0.34, 0.06, 1, 0.02), M.plankDark, 0, 0.3, -0.6),
      part(new RoundedBoxGeometry(0.56, 0.11, 1.1, 2, 0.04), M.mattress, 0, 0.29, 0));
    return [pop(bed.frame)];
  }
  // its pillow and a blanket folded at the foot
  function bedDressing(k) {
    const bed = beds[k];
    return [pop(atBed(bed, part(new RoundedBoxGeometry(0.36, 0.1, 0.2, 2, 0.04), M.pillow, 0, 0.38, -0.42), part(new RoundedBoxGeometry(0.52, 0.07, 0.3, 2, 0.03), M.blanket, 0, 0.38, 0.36)), 0.1)];
  }
  // what earlier levels built is put up silently when a level starts
  let quiet = false;
  const say = (...a) => quiet || sfx.play(...a);

  // ---- pieces dropping into place ----
  function pop(obj, delay = 0, drop = 0.35) {
    obj.userData.size = obj.scale.x;
    obj.scale.setScalar(0.0001);
    obj.userData.y0 = obj.position.y;
    pops.push({ obj, t: -delay, drop, dusted: false });
    return obj;
  }
  // a piece at local (a along the site's right, y up, b towards the board), turned by rot about y
  function place(site, obj, a, y, b, rot = 0) {
    obj.position.copy(site.pos).addScaledVector(site.r, a).addScaledVector(site.f, b);
    obj.position.y = GROUND + y;
    obj.rotation.y = Math.atan2(site.f.x, site.f.z) + rot;
    obj.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
    scene.add(obj);
    return obj;
  }

  // ---- the builds: each a list of stages; a stage adds pieces (returned, so an undo can take them away again) ----
  const BUILD = {
    fire: [
      (s) => ring(9, 0.3, (k) => stone(0.12 + (k % 3) * 0.025)).map(([o, a, b], k) => pop(place(s, o, a, 0, b, k), k * 0.05)),
      // a teepee of logs leaning together over the stones
      (s) => Array.from({ length: 6 }, (_, k) => {
        const a = (k / 6) * Math.PI * 2, g = new THREE.CylinderGeometry(0.028, 0.034, 0.48, 8);
        g.rotateX(Math.PI / 2);
        g.translate(0, 0, 0.24);
        const pivot = new THREE.Group();
        pivot.add(new THREE.Mesh(g, [M.bark, M.endGrain, M.endGrain]));
        place(s, pivot, Math.cos(a) * 0.17, 0.01, Math.sin(a) * 0.17);
        pivot.lookAt(s.pos.x, GROUND + 0.42, s.pos.z);
        return pop(pivot, k * 0.06, 0.2);
      }),
      (s) => {
        s.fire = makeFire(scene, s.pos);
        s.fire.size = 0.3;
        s.fire.group.traverse((m) => (m.castShadow = false));
        s.fire.group.scale.setScalar(0.0001);
        pops.push({ obj: s.fire.group, t: 0, drop: 0 });
        s.fire.group.userData.size = 1;
        say('drop', 0.3, 1.6);
        return [s.fire.group];
      },
      (s) => [pop(place(s, logMesh(0.95, 0.075), 0, 0.075, -0.85)), pop(place(s, logMesh(0.85, 0.07), 0.85, 0.07, 0.05, Math.PI / 2 + 0.25), 0.2)],
      (s) => tripod(s),
      (s) => woodpile(s, -0.85, 0.55),
    ],
    tent: [
      (s) => [pop(place(s, new THREE.Mesh(new RoundedBoxGeometry(1.15, 0.02, 1.45, 1, 0.008), M.sheet), 0, 0.01, 0))],
      (s) => tentPoles(s),
      (s) => [pop(place(s, pole(1.4), 0, 0.88, 0).rotateX(Math.PI / 2))],
      (s) => tentCanvas(s),
      (s) => tentRopes(s),
      (s) => [...lantern(s, 0.75, 0.75, 0.82), pop(place(s, rolled(M.roll), 0, 0.09, 0.3), 0.2)],
    ],
    bench: [
      (s) => [-0.42, 0.42].map((a, k) => pop(place(s, sawhorse(), a, 0, 0), k * 0.15)),
      (s) => [-0.19, 0, 0.19].map((b, k) => pop(place(s, new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.06, 0.18, 1, 0.012), M.plank), 0, 0.53, b), k * 0.12)),
      (s) => benchTools(s),
      (s) => [-0.8, 0.8].map((a, k) => pop(place(s, post(1.3), a, 0, -0.5), k * 0.12)),
      (s) => toolWall(s),
      (s) => [...plankStack(s, 1.05, 0.15), ...choppingBlock(s, -1.05, 0.55)],
    ],
    water: [
      (s) => [pop(place(s, trough(), 0, 0, 0.1))],
      (s) => [pop(place(s, fitted(models.get('barrel-open') || new THREE.Group(), 0.42), -0.75, 0, -0.1))],
      (s) => {
        s.level = 1;
        return [];
      },
      (s) => [0.75, 0.95].map((a, k) => pop(place(s, fitted(models.get('bucket') || new THREE.Group(), 0.24), a, 0, k ? -0.3 : 0.1), k * 0.15)),
      (s) => [pop(place(s, fitted(models.get('barrel') || new THREE.Group(), 0.4), -0.75, 0, -0.65))],
      (s) => lantern(s, 0.6, -0.5, 0.9),
    ],
    chest: [
      (s) => [pop(place(s, fitted(models.get('box-open') || new THREE.Group(), 0.42), -0.55, 0, -0.2)), pop(place(s, fitted(models.get('box-open') || new THREE.Group(), 0.36), -0.55, 0.36, -0.2, 0.3), 0.2)],
      (s) => [pop(place(s, fitted(models.get('chest') || new THREE.Group(), 0.5), 0.25, 0, 0))],
      (s) => coins(s, 0.25, 0.42),
      (s) => lantern(s, -0.55, 0.62, 0.6),
      (s) => [pop(place(s, new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), M.rug).rotateX(-Math.PI / 2), 0, 0.012, 0.05))],
      (s) => [pop(place(s, fitted(models.get('box-open') || new THREE.Group(), 0.4), 0.95, 0, -0.3, -0.4))],
    ],
    beds: [
      () => bedFrame(0),
      () => bedDressing(0),
      () => bedFrame(1),
      () => bedDressing(1),
      () => [...bedFrame(2), ...bedDressing(2)],
      () => [...bedFrame(3), ...bedDressing(3)],
    ],
  };

  // ---- pieces, made in code ----
  function stone(size) {
    const m = models.get(['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'][Math.floor(Math.random() * 3)]);
    return m ? fitted(m, size) : new THREE.Mesh(new THREE.DodecahedronGeometry(size / 2), M.stone);
  }
  function ring(n, rad, make) {
    return Array.from({ length: n }, (_, k) => {
      const a = (k / n) * Math.PI * 2;
      return [make(k), Math.cos(a) * rad, Math.sin(a) * rad];
    });
  }
  function logMesh(len, rad) {
    const g = new THREE.CylinderGeometry(rad, rad * 1.05, len, 10);
    g.rotateZ(Math.PI / 2);
    return new THREE.Mesh(g, [M.bark, M.endGrain, M.endGrain]);
  }
  function pole(len, rad = 0.018) {
    return new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.1, len, 8), M.pole);
  }
  function post(h) {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.08, h, 0.08, 1, 0.015), M.post);
    p.geometry.translate(0, h / 2, 0);
    return p;
  }
  function tripod(s) {
    const out = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3, p = pole(0.95, 0.016);
      const foot = new THREE.Vector3(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
      place(s, p, foot.x * 0.5, 0.44, foot.z * 0.5);
      p.rotation.set(Math.sin(a) * 0.38, 0, -Math.cos(a) * 0.38, 'XYZ');
      out.push(pop(p, k * 0.1));
    }
    const pot = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.13, 14), M.metal);
    pot.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 16, Math.PI), M.metal);
    handle.position.y = 0.065;
    pot.add(handle);
    const chain = pole(0.22, 0.004);
    chain.position.y = 0.2;
    pot.add(chain);
    out.push(pop(place(s, pot, 0, 0.42, 0), 0.35));
    say('pot', 0.4, 1, 0.35);
    return out;
  }
  function woodpile(s, a0, b0) {
    const out = [];
    let k = 0;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4 - row; i++) {
        const o = place(s, logMesh(0.42, 0.045), a0 + (i - (3 - row) / 2) * 0.095, 0.045 + row * 0.08, b0, Math.PI / 2);
        out.push(pop(o, k++ * 0.06));
      }
    }
    return out;
  }
  function tentPoles(s) {
    const out = [];
    for (const b of [-0.68, 0.68]) {
      for (const side of [-1, 1]) {
        const p = pole(1.1);
        place(s, p, side * 0.26, 0.44, b);
        p.rotateZ(side * 0.55);
        out.push(pop(p, out.length * 0.08));
      }
    }
    return out;
  }
  function tentCanvas(s) {
    // two sloping sides from the ridge (0.88 up) down to the ground half a metre out, the back closed, the front flaps open
    const out = [], len = 1.38, half = 0.55, h = 0.88;
    for (const side of [-1, 1]) {
      // a sheet from the ridge (u = 0) down to the ground (u = 1), sagging a little between the poles
      const g = new THREE.PlaneGeometry(1, len, 6, 8), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = p.getY(i) / len, sag = Math.sin(u * Math.PI) * 0.035 * (1 - Math.abs(v) * 1.4);
        p.setXYZ(i, side * (half * u - sag * 0.6), h * (1 - u) - sag, p.getY(i));
      }
      g.computeVertexNormals();
      const holder = new THREE.Group();
      holder.add(new THREE.Mesh(g, M.canvas));
      out.push(pop(place(s, holder, 0, 0, 0), side > 0 ? 0.2 : 0, 0.6));
    }
    const back = new THREE.Mesh(tri(half, h), M.canvas);
    out.push(pop(place(s, back, 0, 0, -len / 2), 0.35, 0.3));
    for (const side of [-1, 1]) {
      const flap = new THREE.Mesh(halfTri(half, h, side), M.canvasDark);
      place(s, flap, 0, 0, len / 2);
      flap.rotateY(-side * 0.9);
      out.push(pop(flap, 0.45, 0.2));
    }
    say('cloth', 0.6);
    return out;
  }
  function tri(half, h) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-half, 0, 0, half, 0, 0, 0, h, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    g.setIndex([0, 1, 2]);
    g.computeVertexNormals();
    return g;
  }
  function halfTri(half, h, side) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, side * half, 0, 0, 0, h, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    g.setIndex(side > 0 ? [0, 1, 2] : [0, 2, 1]);
    g.computeVertexNormals();
    return g;
  }
  function tentRopes(s) {
    const out = [];
    for (const b of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.08, 4), M.rope);
      place(s, rope, 0, 0.44, b * 1.0);
      rope.rotateX(-b * 0.62);
      out.push(pop(rope, out.length * 0.1, 0));
      const peg = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 5), M.post);
      place(s, peg, 0, 0.03, b * 1.32);
      peg.rotation.x = Math.PI;
      out.push(pop(peg, out.length * 0.1, 0.2));
    }
    for (const a of [-0.62, 0.62]) for (const b of [-0.5, 0.5]) {
      const peg = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.07, 5), M.post);
      place(s, peg, a, 0.02, b);
      peg.rotation.x = Math.PI;
      out.push(pop(peg, out.length * 0.06, 0.2));
    }
    return out;
  }
  function rolled(material) {
    const g = new THREE.CylinderGeometry(0.09, 0.09, 0.5, 14);
    g.rotateZ(Math.PI / 2);
    return new THREE.Mesh(g, material);
  }
  function lantern(s, a, b, y = 0.82) {
    const g = new THREE.Group();
    const cage = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.13, 0.09, 1, 0.01), M.glass);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.05, 4), M.metal);
    top.position.y = 0.09;
    top.rotation.y = Math.PI / 4;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd38a }));
    const light = new THREE.PointLight(0xffb060, 0, 3.2, 1.8);
    g.add(cage, top, flame, light);
    g.userData.lamp = light;
    lamps.push(light);
    const post2 = post(y - 0.06);
    const holder = new THREE.Group();
    holder.add(post2);
    g.position.y = y;
    holder.add(g);
    return [pop(place(s, holder, a, 0, b), 0.1)];
  }
  function sawhorse() {
    const g = new THREE.Group(), beam = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.07, 0.5, 1, 0.01), M.post);
    beam.position.y = 0.47;
    g.add(beam);
    for (const z of [-0.2, 0.2]) for (const x of [-1, 1]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.52, 0.05, 1, 0.008), M.post);
      leg.position.set(x * 0.08, 0.24, z);
      leg.rotation.z = x * 0.3;
      g.add(leg);
    }
    return g;
  }
  function benchTools(s) {
    const out = [];
    // a vice at the right end
    const vice = new THREE.Group(), jaw = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 0.1, 1, 0.01), M.metal);
    vice.add(jaw);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), M.metal);
    screw.rotation.x = Math.PI / 2;
    screw.position.z = 0.12;
    vice.add(screw);
    out.push(pop(place(s, vice, 0.55, 0.61, 0.2), 0));
    // a hammer, a saw and a hand plane on the top
    const hammer = new THREE.Group(), hh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), M.handle);
    hh.rotation.z = Math.PI / 2;
    const hd = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.05, 0.1, 1, 0.008), M.metal);
    hd.position.x = 0.14;
    hammer.add(hh, hd);
    out.push(pop(place(s, hammer, -0.25, 0.575, 0.1, 0.4), 0.15));
    const saw = new THREE.Group(), blade = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.004, 0.11), M.steel), grip = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.03, 0.08, 1, 0.01), M.handle);
    grip.position.x = -0.25;
    saw.add(blade, grip);
    out.push(pop(place(s, saw, 0.1, 0.565, -0.12, -0.2), 0.3));
    const plane = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.06, 1, 0.012), M.handle);
    out.push(pop(place(s, plane, -0.45, 0.585, -0.14, 0.2), 0.45));
    for (let k = 0; k < 3; k++) {
      const shaving = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 10, Math.PI * 1.5), M.shaving);
      out.push(pop(place(s, shaving, -0.1 + k * 0.13, 0.565, 0.18 - k * 0.05, k), 0.5 + k * 0.05, 0));
    }
    say('latch', 0.4, 1, 0.1);
    return out;
  }
  // the back wall of the workshop: planks between the two posts, the tools hanging on it, a little roof along the top
  function toolWall(s) {
    const out = [];
    for (let k = 0; k < 5; k++) {
      const plank = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.2, 0.035, 1, 0.01), k % 2 ? M.plank : M.plankDark);
      out.push(pop(place(s, plank, 0, 0.32 + k * 0.205, -0.53), k * 0.07, 0.4));
    }
    const roof = new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.035, 0.42, 1, 0.01), M.plankDark);
    place(s, roof, 0, 1.36, -0.4);
    roof.rotateX(0.35);
    out.push(pop(roof, 0.4, 0.4));
    // hanging: a saw, an axe, a hammer and a coil of rope
    const saw = new THREE.Group(), blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.004), M.steel), grip = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.08, 0.03, 1, 0.01), M.handle);
    grip.position.x = 0.24;
    saw.add(blade, grip);
    out.push(pop(place(s, saw, -0.45, 0.95, -0.5), 0.5, 0.1));
    const axe = new THREE.Group(), ah = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.45, 6), M.handle), head = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.07, 0.015, 1, 0.005), M.steel);
    head.position.set(0.04, 0.2, 0);
    axe.add(ah, head);
    out.push(pop(place(s, axe, 0.05, 0.85, -0.5), 0.6, 0.1));
    const hammer = new THREE.Group(), hh = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.3, 6), M.handle), hd = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.045, 0.04, 1, 0.008), M.metal);
    hd.position.y = 0.15;
    hammer.add(hh, hd);
    out.push(pop(place(s, hammer, 0.4, 0.88, -0.5), 0.7, 0.1));
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 16), M.rope);
    out.push(pop(place(s, coil, 0.68, 0.95, -0.5), 0.8, 0.1));
    return out;
  }
  function plankStack(s, a, b) {
    const out = [];
    for (let k = 0; k < 6; k++) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.035, 0.95, 1, 0.008), k % 2 ? M.plank : M.plankDark);
      out.push(pop(place(s, p, a + (k % 2) * 0.17 - 0.08, 0.02 + Math.floor(k / 2) * 0.037, b), k * 0.07, 0.3));
    }
    return out;
  }
  function choppingBlock(s, a, b) {
    const block = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.3, 14), [M.bark, M.endGrain, M.endGrain]);
    block.geometry.translate(0, 0.15, 0);
    const axe = new THREE.Group(), handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.42, 6), M.handle), head = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.06, 0.015, 1, 0.005), M.steel);
    handle.position.y = 0.21;
    head.position.set(0.04, 0.4, 0);
    axe.add(handle, head);
    axe.rotation.z = 0.5;
    axe.position.set(0.02, 0.26, 0);
    block.add(axe);
    return [pop(place(s, block, a, 0, b), 0.4)];
  }
  function trough() {
    const g = new THREE.Group(), w = 0.9, d = 0.32, h = 0.24;
    for (const [x, z, sx, sz] of [[0, -d / 2, w, 0.035], [0, d / 2, w, 0.035], [-w / 2, 0, 0.035, d], [w / 2, 0, 0.035, d]]) {
      const side = new THREE.Mesh(new RoundedBoxGeometry(sx, h, sz, 1, 0.008), M.plank);
      side.position.set(x, h / 2, z);
      g.add(side);
    }
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), M.plankDark);
    bottom.position.y = 0.03;
    g.add(bottom);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.04, d - 0.04), M.water);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.05;
    water.userData.water = { lo: 0.05, hi: h - 0.04 };
    g.add(water);
    waters.push(water);
    return g;
  }
  function coins(s, a, b) {
    const out = [];
    for (let k = 0; k < 9; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10), M.gold);
      out.push(pop(place(s, c, a + (Math.random() - 0.5) * 0.25, 0.42 + Math.random() * 0.02, b * 0.1 + (Math.random() - 0.5) * 0.2), k * 0.05, 0.2));
    }
    for (let n = 0; n < (quiet ? 0 : 24); n++) fx.glow.spawn({ x: s.pos.x, y: GROUND + 0.5, z: s.pos.z, vx: (Math.random() - 0.5) * 0.6, vy: 0.5, vz: (Math.random() - 0.5) * 0.6, life: 1.4, size: 0.12, color: 0xffe080, alpha: 1, blink: 9, drag: 1 });
    say('coins', 0.55);
    return out;
  }
  function blanketLine(len) {
    const g = new THREE.Group(), rope = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, len, 4), M.rope);
    rope.rotation.z = Math.PI / 2;
    g.add(rope);
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45, 4, 3), M.blanket);
    blanket.position.set(0.2, -0.22, 0);
    g.add(blanket);
    return g;
  }

  // ---- the workers: one per part of the camp, busy at their own place (Oleg, 2026-11-07: "make the workers be busy at their
  // workplace instead of waiting at the gates - only when crate is dropped they come and get it. this way they will always be
  // visible"); a crate on their gate's mat and they run round the board for it ----
  const workers = {}, lamps = [], waters = [];
  // (the bed maker in front of the campfire, on the other side of it from the fire keeper, by the bed there: behind the fire
  // she was out of sight, Oleg 2026-11-07)
  const workSpot = (site) => site.kind === 'beds' ? site.pos.clone().addScaledVector(site.f, 0.5).addScaledVector(site.r, -1.0) : site.pos.clone().addScaledVector(site.f, site.kind === 'fire' ? 0.75 : site.kind === 'tent' ? 1.05 : 0.8).addScaledVector(site.r, site.kind === 'fire' ? 0.45 : site.lean || 0);
  // a crew back late waits out beyond its gate, clear of the camp's places and the other workers (upright, a far gate's
  // forest edge is the camp's row behind the board: 2026-11-07, the tent crew stood on the bed maker)
  const homes = Object.values(sites).map((x) => workSpot(x));
  function awayFrom(s) {
    const clear = (p) => homes.every((h) => h.distanceTo(p) > 1.1) && Object.values(sites).every((x) => {
      const { across, towards } = PLAN[x.kind], d = p.clone().sub(x.pos), a = d.dot(x.r), b = d.dot(x.f);
      return Math.hypot(Math.max(0, across[0] - a, a - across[1]), Math.max(0, towards[0] - b, b - towards[1])) > 0.3;
    }) && Object.values(extraSpots(story.size, portrait)).every((e) => Math.hypot(Math.max(0, Math.abs(p.x - e.x) - e.w / 2), Math.max(0, Math.abs(p.z - e.z) - e.d / 2)) > 0.3);
    for (const out of [2.7, 2.2, 3.2]) {
      for (const side of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.4, -2.4, 3, -3]) {
        const p = s.pos.clone().addScaledVector(s.out, out).addScaledVector(s.side, side).setY(GROUND);
        if (clear(p)) return p;
      }
    }
    return s.pos.clone().addScaledVector(s.out, 2.7).addScaledVector(s.side, 0.6).setY(GROUND);
  }
  for (const [color, site] of Object.entries(sites)) {
    const s = spots[color], before = story.prior[color] || 0, all = story.total[color] || (s ? s.total : 0);
    const camper = makeCamper(style, site.kind, new THREE.Color(SUPPLY_FLAG[color]).getStyle(), models);
    site.stage = 0;
    site.level = 0;
    site.got = before;
    site.total = before + (s ? s.total : 0);
    // stages per crate: six spread over all the colour's crates in the game; more crates than six get extra stages
    site.plan = Array.from({ length: all }, (_, k) => Math.max(1, Math.round(((k + 1) * 6) / all) - Math.round((k * 6) / all)));
    // the stages earlier levels built stand already
    quiet = true;
    const p0 = pops.length, a0 = added.length;
    for (let k = 0; k < before; k++) {
      for (let n = 0; n < (site.plan[k] || 1); n++) {
        const make = BUILD[site.kind][site.stage] || extra(site.kind);
        site.stage++;
        make(site);
      }
    }
    for (let k = p0; k < pops.length; k++) Object.assign(pops[k], { t: 1, dusted: true });
    site.prebuilt = added.slice(a0);
    if (site.fire) site.fire.size = fireSize(site.stage);
    quiet = false;
    const home = workSpot(site).setY(GROUND);
    const w = { color, site, camper, home, pos: home.clone(), heading: Math.atan2(site.pos.x - home.x, site.pos.z - home.z), queue: [], job: null, path: [], phase: s ? 'wait' : 'home', t: 0, done: !s, beat: Object.keys(workers).length * 2.3 };
    // bedtime (twist b): this crew turns in after a set move: the gate's leaf, and a tag over the worker with the moves left
    const g = L.gates.find((x) => x.color === color && x.closeAt != null), late = L.gates.find((x) => x.color === color && x.openAt != null);
    // a crew back late (2026-10-28): out at the forest's edge beyond their gate, which stays shut until they are back; a tag on
    // the gate counts the moves till then
    if (late && board.doors?.[color] && s) {
      w.door = board.doors[color];
      w.openAt = late.openAt;
      w.late = true;
      w.away = awayFrom(s);
      w.pos.copy(w.away);
      w.awayAt = w.away.clone();
      w.phase = 'away';
      w.tag = sleepTag(true, color);
      scene.add(w.tag);
    }
    if (g && board.doors?.[color]) {
      w.door = board.doors[color];
      w.closeAt = g.closeAt;
      w.tag = sleepTag(false, color);
      scene.add(w.tag);
      w.bed = beds[Object.values(workers).filter((x) => x.door).length % beds.length];
      // a bedroll for while there is no bed at that place yet, and the crew's own blanket
      w.bed.roll ||= atBed(w.bed, part(new RoundedBoxGeometry(0.56, 0.05, 1.1, 1, 0.02), M.roll, 0, 0.025, 0), part(new RoundedBoxGeometry(0.34, 0.09, 0.2, 2, 0.04), M.sheet, 0, 0.09, -0.42));
      w.bed.roll.visible = false;
      w.blanket = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.13, 0.66, 2, 0.05), new THREE.MeshStandardMaterial({ color: SUPPLY_FLAG[color], roughness: 0.95 }));
      w.blanket.castShadow = true;
      w.blanket.visible = false;
      scene.add(w.blanket);
    }
    w.camper.root.position.copy(w.pos);
    scene.add(w.camper.root);
    workers[color] = w;
  }

  // the loop round the board the workers walk on (a rounded rectangle a step outside the frame)
  const mx = L.w / 2 + 1.05, mz = L.h / 2 + 1.05, R = 0.7;
  const sideLen = [2 * (mx - R), 2 * (mz - R)], arc = (Math.PI / 2) * R, per = 2 * sideLen[0] + 2 * sideLen[1] + 4 * arc;
  function loopAt(s) {
    s = ((s % per) + per) % per;
    const corner = (cx, cz, a) => [cx + Math.cos(a) * R, cz + Math.sin(a) * R];
    const segs = [
      [sideLen[0], (u) => [-mx + R + u, -mz]], [arc, (u) => corner(mx - R, -mz + R, -Math.PI / 2 + u / R)],
      [sideLen[1], (u) => [mx, -mz + R + u]], [arc, (u) => corner(mx - R, mz - R, u / R)],
      [sideLen[0], (u) => [mx - R - u, mz]], [arc, (u) => corner(-mx + R, mz - R, Math.PI / 2 + u / R)],
      [sideLen[1], (u) => [-mx, mz - R - u]], [arc, (u) => corner(-mx + R, -mz + R, Math.PI + u / R)],
    ];
    for (const [len, f] of segs) {
      if (s <= len) return f(s);
      s -= len;
    }
    return segs[0][1](0);
  }
  function loopParam(p) {
    let best = 0, bd = Infinity;
    for (let s = 0; s < per; s += 0.08) {
      const [x, z] = loopAt(s), d = (x - p.x) ** 2 + (z - p.z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
  function route(from, to) {
    const s0 = loopParam(from), s1 = loopParam(to);
    let ds = s1 - s0;
    if (ds > per / 2) ds -= per;
    if (ds < -per / 2) ds += per;
    const pts = [];
    const [x0, z0] = loopAt(s0);
    pts.push(new THREE.Vector3(x0, GROUND, z0));
    const n = Math.max(1, Math.ceil(Math.abs(ds) / 0.3));
    for (let k = 1; k <= n; k++) {
      const [x, z] = loopAt(s0 + (ds * k) / n);
      pts.push(new THREE.Vector3(x, GROUND, z));
    }
    pts.push(to.clone().setY(GROUND));
    return aroundFire(from, pts);
  }
  // nobody walks through the campfire (Oleg, 2026-11-07: "do not let workers step on the fire"; the bed maker works behind
  // it and the beds stand round it): a leg of a walk that passes too near it goes round it instead
  const FIRE = 0.8;
  function aroundFire(from, pts) {
    const fire = sites.red?.pos;
    if (!fire) return pts;
    const out = [];
    let a = from;
    for (const b of pts) {
      const ab = b.clone().sub(a).setY(0), len2 = ab.lengthSq();
      const u = len2 > 1e-6 ? fire.clone().sub(a).setY(0).dot(ab) / len2 : 0;
      const off = a.clone().addScaledVector(ab, u).sub(fire).setY(0), d = off.length();
      if (u > 0 && u < 1 && d < FIRE) {
        if (d < 1e-3) off.set(-ab.z, 0, ab.x);
        off.normalize();
        const n = ab.normalize(), r = FIRE + 0.12;
        out.push(fire.clone().addScaledVector(off, r).addScaledVector(n, -0.7 * r).setY(GROUND), fire.clone().addScaledVector(off, r).addScaledVector(n, 0.7 * r).setY(GROUND));
      }
      out.push(b);
      a = b;
    }
    return out;
  }
  // where to stand to pick up a crate on its mat: beside it, on the side the walk comes from
  function toCrate(from, crate) {
    const c = crate.at().clone().setY(GROUND), pts = route(from, c), [cw, ch] = crate.size?.() || [0.6, 0.6];
    pts.pop();
    const n = pts.length;
    let dir = n > 1 ? pts[n - 2].clone().sub(pts[n - 1]).setY(0) : new THREE.Vector3();
    if (dir.lengthSq() < 1e-4) dir = from.clone().sub(c).setY(0);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    const reach = (Math.abs(dir.x) * cw + Math.abs(dir.z) * ch) / 2 + 0.3;
    while (pts.length && pts[pts.length - 1].distanceTo(c) < reach) pts.pop();
    pts.push(c.addScaledVector(dir, reach));
    return pts;
  }
  // a crate has landed on its gate's mat
  function arrived(color, crate) {
    workers[color].queue.push({ crate, pieces: [], stage: 'waiting' });
  }

  // undo: forget a crate's job; anything it built comes down again
  function cancel(color, crate) {
    const w = workers[color];
    w.queue = w.queue.filter((j) => j.crate !== crate);
    for (const job of [w.job, ...(w.done ? [] : [])]) {
      if (!job || job.crate !== crate) continue;
      w.job = null;
      w.path = route(w.pos, w.home);
      w.phase = 'return';
      w.camper.play('walk');
    }
    const built = w.site.history?.find((h) => h.crate === crate);
    if (built) {
      for (const o of built.pieces) scene.remove(o);
      w.site.stage -= built.stages;
      w.site.got--;
      w.site.history = w.site.history.filter((h) => h !== built);
      if (w.site.kind === 'fire' && w.site.stage < 3 && w.site.fire) w.site.fire = null;
      if (w.site.kind === 'water' && w.site.stage < 3) w.site.level = 0;
      w.done = false;
      w.path = route(w.pos, w.home);
      w.phase = 'return';
      w.camper.play('walk');
    }
  }

  function walkTo(w, target, phase, how = 'walk') {
    w.path = route(w.pos, target);
    w.phase = phase;
    w.camper.play(how);
  }

  function step(w, dt) {
    if (!w.path.length) return true;
    const target = w.path[0], d = target.clone().sub(w.pos);
    d.y = 0;
    const dist = d.length(), sp = (w.phase === 'carry' ? SPEED.carry : w.phase === 'toDoor' || w.phase === 'toCrate' ? SPEED.run : SPEED.walk) * dt;
    if (dist <= sp) {
      w.pos.copy(target);
      w.path.shift();
    } else w.pos.addScaledVector(d, sp / dist);
    if (dist > 1e-3) w.heading = turn(w.heading, Math.atan2(d.x, d.z), dt * 12);
    return !w.path.length;
  }

  // bedtime: once the job in hand (and any crate waiting) is done, to the gate, swing it shut, then off to bed by the fire;
  // on an undo before bedtime, back to swing it open again. True while it is busy with that.
  // The gate follows the rules every moment, undo included: shut from the crew's bedtime on, open before it. When it is the
  // wrong way round the worker sets it right first (a crate in hand is set down where they stand and fetched afterwards; a
  // crate not yet reached waits; only a build already under way is finished first). With the gate shut, any work left is
  // done (a crate that lands on the mat later gets them out of bed), then bed. Before bedtime anyone in bed gets up.
  // True while this has the worker.
  function sleepy(w, dt) {
    const d = w.door, shut = w.bedtime || w.late, is = (...phases) => phases.includes(w.phase);
    const back = () => walkTo(w, w.home, 'backHome');
    // with a crate waiting (on the mat, or set down on the way to the gate), straight to it from here, not home first and
    // out again (Oleg, 2026-11-07: "when worker needs to close the gate makes double trip to the working place")
    const resume = () => {
      if (w.queue.length && !w.job) {
        w.phase = 'wait';
        w.path = [];
      } else back();
    };
    // the gate the wrong way round, and nobody on it yet
    if ((shut ? d.k < 1 : d.k > 0) && !is('toDoor', 'closing', 'toOpen', 'opening')) {
      if (is('putdown', 'build')) return false;
      if (w.job && is('carry')) {
        w.job.crate.hold(w.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(w.heading), 0, Math.cos(w.heading)), 0.32).setY(GROUND + 0.12), w.heading);
        w.queue.unshift(w.job);
        w.job = null;
      } else if (w.job && is('toCrate', 'pickup')) {
        w.queue.unshift(w.job);
        w.job = null;
      }
      walkTo(w, d.handle(d.k), shut ? 'toDoor' : 'toOpen', 'run');
      return true;
    }
    // on the way to the gate, or swinging it (the way the rules want it now)
    if (is('toDoor', 'toOpen')) {
      w.phase = shut ? 'toDoor' : 'toOpen';
      if (step(w, dt)) {
        w.phase = shut ? 'closing' : 'opening';
        w.t = 0;
        w.camper.play('pickup');
      }
      return true;
    }
    if (is('closing', 'opening')) {
      w.phase = shut ? 'closing' : 'opening';
      w.heading = turn(w.heading, Math.atan2(d.hinge.x - w.pos.x, d.hinge.z - w.pos.z), dt * 8);
      d.set(Math.min(1, Math.max(0, d.k + (shut ? dt : -dt) / WORK.swing)));
      w.pos.lerp(d.handle(d.k), Math.min(1, dt * 10));
      if (shut ? d.k >= 1 : d.k <= 0) {
        if (shut) sfx.gateShut();
        if (shut && w.late) walkTo(w, w.away, 'toAway');
        else if (shut && !w.job && !w.queue.length) walkTo(w, w.bed.side, 'toBed');
        else resume();
      }
      return true;
    }
    if (shut) {
      // work left (a crate on the mat, one set down on the way): out of bed and back to it; then bed
      // a late crew out in the forest: there, gathering, or on the way back out to it; a move before they are due, back
      // and waiting by the shut gate, so it swings open on time
      if (w.late) {
        const spot = w.soon ? d.handle(1) : w.away;
        if (!w.awayAt || w.awayAt.distanceTo(spot) > 0.01 || !is('toAway', 'away')) {
          w.awayAt = spot.clone();
          walkTo(w, spot, 'toAway', w.soon ? 'run' : 'walk');
        } else if (is('toAway')) {
          if (step(w, dt)) w.phase = 'away';
        } else if (w.soon) {
          w.heading = turn(w.heading, Math.atan2(d.hinge.x - w.pos.x, d.hinge.z - w.pos.z), dt * 5);
          w.camper.play('idle');
        } else {
          w.heading = turn(w.heading, Math.atan2(w.away.x, w.away.z), dt * 3);
          w.camper.play(Math.sin(w.t * 0.9) > 0.6 ? 'pickup' : 'idle');   // gathering
        }
        return true;
      }
      if (w.job || w.queue.length) {
        if (is('toBed', 'asleep')) resume();
        else if (is('backHome')) {
          if (step(w, dt)) w.phase = 'wait';
        } else return false;
        return true;
      }
      if (is('toBed')) {
        if (step(w, dt)) {
          w.phase = 'asleep';
          sfx.owl();
        }
        return true;
      }
      if (is('asleep')) {
        // lying in bed under the blanket, a z drifting up from the pillow now and then
        w.camper.play('idle');
        const head = w.bed.pos.clone().addScaledVector(w.bed.f, -0.42);
        if (Math.random() < dt * 1.2) fx.glow.spawn({ x: head.x, y: GROUND + 0.35, z: head.z, vx: 0.1, vy: 0.22, life: 1.8, size: 0.1, color: 0xcfe0ff, alpha: 0.8, drag: 0.3 });
        return true;
      }
      if (!is('wait', 'home', 'return', 'backHome')) return false;
      walkTo(w, w.bed.side, 'toBed');
      return true;
    }
    // before bedtime, the gate open: up and back to the gate
    if (is('toBed', 'asleep', 'toAway', 'away')) {
      resume();
      return true;
    }
    if (is('backHome')) {
      if (step(w, dt)) w.phase = w.done ? 'home' : 'wait';
      return true;
    }
    return false;
  }

  // between crates, at their own place: a while at their work (turned to it), then a look over at the board; they sit as
  // night comes, and cheer at the end
  function busy(w, dt, dusk, state) {
    const site = w.site;
    w.beat += dt;
    if (w.cheer > 0) {
      w.cheer -= dt;
      w.heading = turn(w.heading, Math.atan2(-w.pos.x, -w.pos.z), dt * 6);
      return w.camper.play('cheer');
    }
    if (dusk > 0.9 || state === 'lost') {
      w.heading = turn(w.heading, Math.atan2(-w.pos.x, -w.pos.z), dt * 3);
      return w.camper.play('sit');
    }
    if (site.stage === 0) return chores(w, dt);
    // (left mid-chore when the first stage went up: back to the work first)
    if (w.pos.distanceTo(w.home) > 0.1) {
      w.chore = null;
      return along(w, [w.home], dt);
    }
    const at = w.beat % 9 < 6;
    w.heading = turn(w.heading, at ? Math.atan2(site.pos.x - w.pos.x, site.pos.z - w.pos.z) : Math.atan2(-w.pos.x, -w.pos.z), dt * 4);
    w.camper.play(at ? 'tinker' : 'idle');
  }

  // nothing built at their place yet (Oleg, 2026-11-07: "workers should be working when they haven't started the
  // construction yet"): they get the ground ready, about their place: over to a spot, down to gather (a little dust), back
  // with it to where the work will stand, down again to set it there, a look over at the board, and again
  function chores(w, dt) {
    const c = (w.chore ||= { step: 'look', t: 0.6 + (w.beat % 1.3), pts: [] });
    c.t -= dt;
    if (c.step === 'go' || c.step === 'back') {
      if (!along(w, c.pts, dt)) return;
      c.step = c.step === 'go' ? 'pick' : 'drop';
      c.t = c.step === 'pick' ? 1.1 + Math.random() * 0.6 : 0.6;
      c.puff = 0;
      return w.camper.play('gather');
    }
    if (c.step === 'pick' || c.step === 'drop') {
      w.camper.play('gather');
      c.puff -= dt;
      if (c.puff <= 0 && !quiet) {
        c.puff = 0.55;
        const hand = w.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(w.heading), 0, Math.cos(w.heading)), 0.32);
        dustPuff(fx.dust, hand.x, hand.z, 0.25, 0.25, 0.12);
      }
      if (c.t > 0) return;
      if (c.step === 'pick') {
        c.step = 'back';
        c.pts = aroundFire(w.pos, [heap(w)]);
      } else {
        c.step = 'look';
        c.t = 1 + Math.random() * 1.2;
      }
      return;
    }
    // a look over at the board, then off to the next spot
    w.heading = turn(w.heading, Math.atan2(-w.pos.x, -w.pos.z), dt * 4);
    w.camper.play('idle');
    if (c.t > 0) return;
    c.step = 'go';
    c.pts = aroundFire(w.pos, [choreSpot(w)]);
  }
  // where what they gather goes: the middle of where the work will stand (the bed maker's, where the first bed goes)
  const heap = (w) => (w.site.kind === 'beds' ? beds[0].pos : w.site.pos).clone().addScaledVector(w.site.f, 0.45).setY(GROUND);
  // a spot about their place: on its ground, near their own place, clear of a lit fire and of the other workers. Upright, in
  // front of it rather than behind (towards the board, short of the path; behind, they went up under the top bar) and no
  // further out to the side than they live
  function choreSpot(w) {
    const { across, towards } = PLAN[w.site.kind], site = w.site, fire = sites.red?.stage ? sites.red.pos : null;
    const hv = w.home.clone().sub(site.pos).dot(site.f), size = story.size;
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.9;
      const p = w.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)), d = p.clone().sub(site.pos);
      const u = d.dot(site.r), v = d.dot(site.f);
      if (u < across[0] + 0.2 || u > across[1] - 0.2 || v < towards[0] + 0.2) continue;
      if (portrait ? v < hv - 0.5 || v > towards[1] + 0.8 || pathGap(p.x, p.z, size.w, size.h) < 0.7 || Math.abs(p.x) > Math.max(3.4, Math.abs(w.home.x)) + 0.2 : v > towards[1] - 0.1) continue;
      if (fire && p.distanceTo(fire) < FIRE + 0.3) continue;
      if (Object.values(workers).some((o) => o !== w && o.home.distanceTo(p) < 0.7)) continue;
      return p;
    }
    return w.home.clone();
  }
  // a short walk at an easy pace (round a lit fire); true on arrival
  function along(w, pts, dt) {
    while (pts.length) {
      const d = pts[0].clone().sub(w.pos).setY(0), dist = d.length(), sp = SPEED.stroll * dt;
      if (dist > 1e-3) w.heading = turn(w.heading, Math.atan2(d.x, d.z), dt * 10);
      if (dist > sp) {
        w.pos.addScaledVector(d, sp / dist);
        w.camper.play('stroll');
        return false;
      }
      w.pos.copy(pts.shift()).setY(GROUND);
    }
    return true;
  }

  function updateWorker(w, dt, t, dusk, state) {
    const site = w.site;
    w.t += dt;
    if (w.phase !== 'wait' && w.phase !== 'home') w.chore = null;
    if (w.door && sleepy(w, dt)) {
      // turning in (or getting up again): sleepy() moved it
    } else if (w.phase === 'wait') {
      // busy at their own place; off round the board at a run as soon as a crate lands on their mat
      if (w.queue.length) {
        w.job = w.queue.shift();
        w.path = toCrate(w.pos, w.job.crate);
        w.phase = 'toCrate';
        w.camper.play('run');
      } else busy(w, dt, dusk, state);
    } else if (w.phase === 'toCrate') {
      if (step(w, dt)) {
        w.phase = 'pickup';
        w.t = 0;
        w.camper.play('pickup');
      }
    } else if (w.phase === 'pickup') {
      const c = w.job.crate.at();
      w.heading = turn(w.heading, Math.atan2(c.x - w.pos.x, c.z - w.pos.z), dt * 10);
      if (w.t > WORK.pickup) {
        w.job.crate.lift();
        sfx.play('pick', 0.4, 0.9);
        walkTo(w, workSpot(site), 'carry', 'carry');
      }
    } else if (w.phase === 'carry') {
      if (step(w, dt)) {
        w.phase = 'putdown';
        w.t = 0;
        w.camper.play('pickup');
      }
    } else if (w.phase === 'putdown') {
      w.heading = turn(w.heading, Math.atan2(site.pos.x - w.pos.x, site.pos.z - w.pos.z), dt * 10);
      if (w.t > WORK.putdown) {
        w.job.crate.unpack(w.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(w.heading), 0, Math.cos(w.heading)), 0.32));
        w.phase = 'build';
        w.t = 0;
        w.job.stagesLeft = site.plan[site.got] || 1;
        w.job.pieces = [];
        site.got++;
        w.camper.play('work');
      }
    } else if (w.phase === 'build') {
      w.heading = turn(w.heading, Math.atan2(site.pos.x - w.pos.x, site.pos.z - w.pos.z), dt * 8);
      // a stage every WORK.stage seconds of work
      if (w.t > WORK.stage && w.job.stagesLeft > 0) {
        w.t = 0;
        w.job.stagesLeft--;
        const make = BUILD[site.kind][site.stage] || extra(site.kind);
        site.stage++;
        const pieces = (make(site) || []).flat().filter(Boolean);
        w.job.pieces.push(...pieces);
        w.job.stages = (w.job.stages || 0) + 1;
        sfx.build(site.kind);
        if (site.fire) site.fire.size = fireSize(site.stage);
      }
      if (w.job.stagesLeft <= 0 && w.t > WORK.finish) {
        (site.history ||= []).push({ crate: w.job.crate, pieces: w.job.pieces, stages: w.job.stages });
        w.job = null;
        if (site.got >= site.total) {
          w.done = true;
          w.phase = 'home';
          sfx.jingle('done');
          for (let n = 0; n < 26; n++) {
            const a = Math.random() * Math.PI * 2, sp = 0.5 + Math.random() * 1.4;
            fx.glow.spawn({ x: site.pos.x, y: GROUND + 0.6, z: site.pos.z, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp, life: 1.1, size: 0.14, color: 0xffd36a, alpha: 0.95, gravity: 1, drag: 1.2 });
          }
        } else w.phase = 'wait';   // and back to their work, where they stand
      }
    } else if (w.phase === 'return') {
      if (step(w, dt)) w.phase = 'wait';
    } else if (w.phase === 'home') busy(w, dt, dusk, state);   // all this level brings them built
    const lying = w.bed && w.phase === 'asleep', up = w.bed && made(w.bed) ? 0.34 : 0.06;
    if (w.bed) {
      w.blanket.visible = lying;
      if (lying) {
        w.blanket.position.copy(w.bed.pos).addScaledVector(w.bed.f, 0.16).setY(GROUND + up + 0.1);
        w.blanket.rotation.y = w.bed.yaw;
      }
    }
    w.camper.lying?.(lying);
    if (lying) {
      // on the back, on the bed (or the bedroll): feet towards the fire, head on the pillow, under the crew's blanket
      w.camper.root.position.copy(w.bed.pos).addScaledVector(w.bed.f, 0.44).setY(GROUND + up + 0.08);
      w.camper.root.rotation.set(-Math.PI / 2, w.bed.yaw, 0, 'YXZ');
    } else {
      w.camper.root.position.copy(w.pos);
      w.camper.root.rotation.set(0, w.heading, 0, 'YXZ');
    }
    w.camper.update(dt);
    w.camper.root.updateMatrixWorld();
    if (w.job && (w.phase === 'carry' || w.phase === 'putdown')) w.job.crate.hold(w.camper.hand(new THREE.Vector3()), w.heading);
  }

  // more crates than stages: each extra one adds to a pile at a set place of its part, resting on what is already there, so
  // a part never spreads (its ground plan, PLAN, holds; the extras used to land anywhere round it, onto the beds even):
  // logs on the woodpile, supplies inside the tent, planks on the timber stack, buckets behind the trough, boxes on the
  // stores' stack, folded blankets between the beds' heads
  function extra(kind) {
    return (s) => {
      const [a0, b0, item] = PILE[kind] || [0, -0.9, 'box'];
      s.pile = (s.pile || []).filter((o) => o.parent);
      if (s.pile.length >= 6) return [];   // a pile of six at most (twenty levels bring far more crates than stages)
      const k = s.pile.length, a = a0 + (k % 2 ? 0.1 : -0.1), b = b0 + (k % 4 < 2 ? -0.06 : 0.06);
      // on top of whatever stands at that spot already
      const at = s.pos.clone().addScaledVector(s.r, a).addScaledVector(s.f, b), box = new THREE.Box3();
      let top = 0;
      for (const o of [...(s.prebuilt || []), ...(s.history || []).flatMap((h) => h.pieces), ...s.pile]) {
        if (!o.parent || box.setFromObject(o).isEmpty()) continue;
        if (at.x > box.min.x && at.x < box.max.x && at.z > box.min.z && at.z < box.max.z) top = Math.max(top, box.max.y - GROUND);
      }
      const rot = (k * 0.7) % 0.6 - 0.3;
      let piece;
      if (item === 'plank') piece = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.035, 0.95, 1, 0.008), k % 2 ? M.plank : M.plankDark);
      else if (item === 'blanket') piece = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.07, 0.3, 2, 0.03), k % 2 ? M.blanket : M.mattress);
      else {
        const m = models.get(item === 'log' ? 'resource-wood' : item === 'bucket' ? 'bucket' : 'box-open');
        if (!m) return [];
        piece = fitted(m, item === 'bucket' ? 0.22 : 0.3);
      }
      const p = pop(place(s, piece, a, Math.min(top, 1.6), b, item === 'plank' ? 0 : rot), 0, 0.25);
      s.pile.push(p);
      return [p];
    };
  }

  // the deer, foxes and birds round the glade (wildlife.js)
  const wildlife = makeWildlife(scene, models, story.size, campKeepOut(story.size), () => Object.values(workers).map((w) => w.pos));
  // (signs: where the far side's gate banners stand, board.js: the bunting passes behind them)
  const signs = L.gates.filter((g) => g.side === 'top').map((g) => [board.ox + g.at, board.ox + g.at + g.len]);
  const extras = makeExtras(scene, models, { ox: board.ox, oz: board.oz, w: board.W, h: board.H, signs }, story.size, portrait, story.extras || [], fx);

  function update(dt, t, dusk, state, moves = 0, onBoard = null) {
    for (const w of Object.values(workers)) {
      if (!w.door) continue;
      w.bedtime = moves >= w.closeAt;
      w.late = w.openAt != null && moves < w.openAt;
      w.soon = w.late && moves >= w.openAt - 1;
      // the tag: the moves left before this crew turns in (red on the last one), or till a late crew is back
      // on the gate itself, big (playtest 2026-10-24: the number over a small worker off the board was missed)
      const sp = spots[w.color];
      // (none once the crew's crates are all out: playtest 2026-10-29, a "1" left on a gate looked like a job still to do)
      w.tag.visible = (w.openAt != null ? w.late : !w.bedtime) && state === 'play' && (!onBoard || onBoard.has(w.color));
      // (a gate on the far side: up over its banner, board.js, so the number never covers the gate's sign)
      // (and on the near side further out, and lower: standing up there it reaches up the screen over the last row; the tags
      // grew in the playtest of 2026-11-09, and a gate mark must never cover a crate)
      const far = sp && sp.out.z < -0.5, near = sp && sp.out.z > 0.5;
      if (sp) w.tag.position.copy(sp.gateMid).addScaledVector(sp.out, far ? 1.0 : near ? 0.95 : 0.55).setY(GROUND + (far ? 2.3 : near ? 1.2 : 1.55));
      else w.tag.position.set(w.pos.x, GROUND + 1.35, w.pos.z);
      w.tag.userData.set(w.openAt != null ? w.openAt - moves : w.closeAt - moves);
    }
    for (const p of pops) {
      p.t += dt;
      const g = Math.min(1, Math.max(0, p.t) * 3.2), e = 1 + Math.sin(g * Math.PI * 1.4) * (1 - g) * 0.45;
      p.obj.scale.setScalar(Math.max(0.0001, (p.obj.userData.size ?? 1) * g * e));
      if (p.drop) p.obj.position.y = p.obj.userData.y0 + (1 - g) * (1 - g) * p.drop;
      if (!p.dusted && p.t > 0.25 && p.drop > 0.1) {
        p.dusted = true;
        fx.dust.spawn({ x: p.obj.position.x, y: GROUND + 0.05, z: p.obj.position.z, vx: 0.4, vy: 0.3, vz: 0.4, life: 0.5, size: 0.18, grow: 0.5, color: 0xd8c39a, alpha: 0.5, drag: 3 });
        fx.dust.spawn({ x: p.obj.position.x, y: GROUND + 0.05, z: p.obj.position.z, vx: -0.4, vy: 0.3, vz: -0.3, life: 0.5, size: 0.18, grow: 0.5, color: 0xd8c39a, alpha: 0.5, drag: 3 });
      }
    }
    for (let k = pops.length - 1; k >= 0; k--) if (pops[k].t > 0.6) pops.splice(k, 1);
    for (const w of Object.values(workers)) updateWorker(w, dt, t, dusk, state);
    // a bedroll lies rolled out only under someone asleep where there is no bed yet
    for (const bed of beds) if (bed.roll) bed.roll.visible = !made(bed) && Object.values(workers).some((x) => x.bed === bed && x.phase === 'asleep');
    // the fire: flicker, sparks and smoke
    for (const site of Object.values(sites)) {
      if (!site.fire) continue;
      flickerFire(site.fire, t, dusk);
      const f = site.fire.size;
      if (Math.random() < dt * (6 + f * 20)) fx.glow.spawn({ x: site.pos.x + (Math.random() - 0.5) * 0.15, y: GROUND + 0.3, z: site.pos.z + (Math.random() - 0.5) * 0.15, vy: 0.8 + Math.random() * 1.2, life: 0.8 + Math.random() * 0.8, size: 0.05 + f * 0.05, color: 0xffa040, alpha: 1, wander: 3, drag: 0.5 });
      if (Math.random() < dt * (3 + f * 5)) fx.smoke.spawn({ x: site.pos.x, y: GROUND + 0.5 + f * 0.3, z: site.pos.z, vx: 0.15, vy: 0.5, vz: -0.05, life: 2.5, size: 0.25, grow: 0.5, color: 0x8a8a90, alpha: 0.22, wander: 0.4, drag: 0.3 });
    }
    for (const l of lamps) l.intensity = (0.3 + dusk * 2.4) * (1 + Math.sin(t * 9 + l.id) * 0.05);
    for (const wtr of waters) {
      const site = Object.values(sites).find((x) => x.kind === 'water');
      const want = wtr.userData.water.lo + (wtr.userData.water.hi - wtr.userData.water.lo) * (site?.level || 0.15);
      wtr.position.y += (want - wtr.position.y) * Math.min(1, dt * 2);
    }
    wildlife.update(dt, t, dusk);
    extras.update(dt, t, dusk);
  }

  return {
    sites, arrived, cancel, update, extras,
    // for checks: each worker's phase, job and bedtime
    // the countdown tags on show, for a tap on one to be explained (main.js): its crew, whether it is back late or to bed early,
    // the moves it shows, and where it is
    tags: () => Object.entries(workers).filter(([, w]) => w.tag && w.tag.visible).map(([color, w]) => ({ color, late: w.openAt != null, n: w.tag.userData.shown, at: w.tag.position.clone() })),
    workers: () => Object.fromEntries(Object.entries(workers).map(([c, w]) => [c, { phase: w.phase, done: w.done, job: !!w.job, queue: w.queue.length, bedtime: w.bedtime, door: w.door && +w.door.k.toFixed(2), got: w.site.got, total: w.site.total, pos: [+w.pos.x.toFixed(2), +w.pos.z.toFixed(2)], path: w.path.length, to: w.path.length ? [+w.path[w.path.length - 1].x.toFixed(2), +w.path[w.path.length - 1].z.toFixed(2)] : null }])),
    busy: () => Object.values(workers).some((w) => !w.done || w.queue.length),
    cheer: () => Object.values(workers).forEach((w) => (w.cheer = 2.4)),
    fireSize: () => Object.values(sites).find((s) => s.fire)?.fire.size || 0,
    extent: () => [...Object.values(sites).flatMap((s) => [s.pos.clone().addScaledVector(s.r, 1.2).addScaledVector(s.f, -0.9), s.pos.clone().addScaledVector(s.r, -1.2).addScaledVector(s.f, -0.9), s.pos.clone().addScaledVector(s.f, 1.2)]), ...extras.extent()],
    // off the scene; what went (main.js frees what nothing else uses: free.js)
    dispose: () => (world.remove(...added), added),
    // for checks: how far what stands at each site reaches, in its frame (across its right, towards the board), against its
    // PLAN (tools/check-camp.js)
    reach: () => Object.fromEntries(Object.entries(sites).map(([color, site]) => {
      const ab = [Infinity, -Infinity, Infinity, -Infinity], v = new THREE.Vector3();
      for (const o of [...(site.prebuilt || []), ...(site.history || []).flatMap((h) => h.pieces)]) {
        if (!o.parent || !o.visible) continue;
        o.updateWorldMatrix(true, true);
        o.traverseVisible((m) => {
          if (!m.isMesh) return;
          const bb = (m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox));
          for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
            v.set(x, y, z).applyMatrix4(m.matrixWorld).sub(site.pos);
            const a = v.x * site.r.x + v.z * site.r.z, b = v.x * site.f.x + v.z * site.f.z;
            ab[0] = Math.min(ab[0], a), ab[1] = Math.max(ab[1], a), ab[2] = Math.min(ab[2], b), ab[3] = Math.max(ab[3], b);
          }
        });
      }
      const round = (x) => +x.toFixed(2);
      return [color, { kind: site.kind, across: [round(ab[0]), round(ab[1])], towards: [round(ab[2]), round(ab[3])], plan: PLAN[site.kind] }];
    })),
    // for checks: the path the workers walk round the board, as points
    loop: () => Array.from({ length: Math.ceil(per / 0.2) }, (_, k) => loopAt(k * 0.2)),
    // for checks: the ground plan of every visible part built at each site: per mesh, the corners of its box, turned and
    // placed as it stands ({ color, kind, pts: [[x, z] x 8] })
    boxes: () => [...extras.boxes(), ...Object.entries(sites).flatMap(([color, site]) => {
      const out = [], v = new THREE.Vector3();
      for (const o of [...(site.prebuilt || []), ...(site.history || []).flatMap((h) => h.pieces)]) {
        if (!o.parent || !o.visible) continue;
        o.updateWorldMatrix(true, true);
        o.traverseVisible((m) => {
          if (!m.isMesh) return;
          const bb = (m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox)), pts = [];
          for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
            v.set(x, y, z).applyMatrix4(m.matrixWorld);
            pts.push([v.x, v.z]);
          }
          out.push({ color, kind: site.kind, pts });
        });
      }
      return out;
    })],
  };
}

// the fire grows with its stages (lit at the third), a little more with each extra load
const fireSize = (stage) => [0, 0, 0, 0.35, 0.5, 0.75, 1][Math.min(stage, 6)] + Math.max(0, stage - 6) * 0.05;

// the tag over a crew that turns in early: the moves left, with a moon; or (late) the moves till a crew is back, green, with
// a pine tree (they are out in the forest). The marks were a small "z" and "↩" until the playtest of 2026-11-09 (Dan, level
// 19: both tags looked alike, "which crew is late and which is early?")
function sleepTag(late = false, color = null) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const tex = new THREE.CanvasTexture(cv), sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.renderOrder = 5;
  // (0.85 until 2026-11-09: about 30 px across on a laptop, its marks too small to read; Ruth)
  sprite.scale.setScalar(1.15);
  let shown = null;
  sprite.userData.set = (n) => {
    if (n === shown) return;
    shown = sprite.userData.shown = n;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = late ? '#e2f6d2' : n <= 1 ? '#d8452e' : '#fff6e2';
    g.beginPath();
    g.arc(60, 68, 50, 0, Math.PI * 2);
    g.fill();
    // ringed in its crew's colour, so a number reads as its gate's with two or three of them about (playtest 2026-11-09,
    // Maya, levels 5 and 13)
    if (color) {
      g.lineWidth = 12;
      g.strokeStyle = SUPPLY_FLAG[color];
      g.stroke();
      g.beginPath();
      g.arc(60, 68, 56, 0, Math.PI * 2);
    }
    g.lineWidth = 5;
    g.strokeStyle = '#3a2c4a';
    g.stroke();
    g.fillStyle = !late && n <= 1 ? '#fff' : '#2a2238';
    g.font = 'bold 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), 60, 72);
    // the mark: a badge at the top right
    g.beginPath();
    g.arc(102, 26, 23, 0, Math.PI * 2);
    g.fillStyle = late ? '#2f7a2c' : '#2c3466';
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#3a2c4a';
    g.stroke();
    if (late) {
      // a pine: two tiers and a trunk
      g.fillStyle = '#e9ffd8';
      g.beginPath();
      g.moveTo(102, 9), g.lineTo(90, 27), g.lineTo(114, 27), g.closePath();
      g.moveTo(102, 17), g.lineTo(87, 37), g.lineTo(117, 37), g.closePath();
      g.fill();
      g.fillRect(99, 37, 6, 6);
    } else {
      // a crescent moon
      g.fillStyle = '#ffd84a';
      g.beginPath();
      g.arc(100, 26, 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2c3466';
      g.beginPath();
      g.arc(107, 21, 12, 0, Math.PI * 2);
      g.fill();
    }
    tex.needsUpdate = true;
  };
  return sprite;
}

const SUPPLY_FLAG = { red: '#f05a3c', orange: '#ff9d2e', blue: '#3f9cf0', green: '#5cc753', purple: '#ab70f0', yellow: '#ffd23a' };

function turn(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

// shared materials for the builds
let mats = null;
function materials() {
  if (mats) return mats;
  const cloth = (base, line) => {
    const map = canvasTex(128, (g, s) => {
      g.fillStyle = base;
      g.fillRect(0, 0, s, s);
      g.strokeStyle = line;
      g.lineWidth = 1;
      for (let k = 0; k < s; k += 4) {
        g.globalAlpha = 0.12;
        g.beginPath();
        g.moveTo(0, k);
        g.lineTo(s, k);
        g.stroke();
      }
      g.globalAlpha = 0.5;
      g.setLineDash([4, 3]);
      g.strokeRect(6, 6, s - 12, s - 12);
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.95, side: THREE.DoubleSide });
  };
  const endGrain = new THREE.MeshStandardMaterial({
    map: canvasTex(64, (g, s) => {
      g.fillStyle = '#c8a070';
      g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(110,70,30,0.5)';
      for (let r = 4; r < s / 2; r += 5) {
        g.beginPath();
        g.arc(s / 2, s / 2, r, 0, Math.PI * 2);
        g.stroke();
      }
    }),
    roughness: 0.9,
  });
  return (mats = {
    bark: woodMaterial('#5a3e26', 31), endGrain, pole: woodMaterial('#7a5530', 32), post: woodMaterial('#6a4628', 33),
    plank: woodMaterial('#b08050', 34), plankDark: woodMaterial('#8a6038', 35), handle: woodMaterial('#9a6a3a', 36),
    metal: new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.5, metalness: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.8 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf2c440, roughness: 0.3, metalness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffb060, emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.85 }),
    canvas: cloth('#d8893a', '#7a4010'), canvasDark: cloth('#b86e2c', '#6a3008'), sheet: cloth('#4a5a3a', '#2a3020'),
    roll: cloth('#5a6a8a', '#2a3a5a'), mattress: cloth('#e6dcc4', '#b8a888'), blanket: cloth('#a03a3a', '#5a1a1a'), rug: cloth('#8a5ab0', '#4a2a6a'),
    pillow: new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 1 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc8b080, roughness: 1 }),
    shaving: new THREE.MeshStandardMaterial({ color: 0xe0c090, roughness: 1, side: THREE.DoubleSide }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8a8a80, roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: 0x3f8fd8, roughness: 0.15, transparent: true, opacity: 0.85 }),
  });
}


// The campers' trades (Oleg, 2026-10-24: they have professions now, so stock models make no sense, "the storekeeper doesn't
// look like a storekeeper and has guns"). Kenney's Mini Characters keep their bodies and animations; each is dressed here in
// code for their trade, the pieces hung on the skeleton's bones so they move with every animation. Sizes are in the bones'
// own units (a Kenney character is 0.68 tall). The torso bone sits at the hips, at the back of the body: the torso is a box
// 0.25 wide (x ±0.126), its front at z 0.13, its back at z -0.13, its top at y 0.167 where the head bone sits. The head is
// wider than the torso (x ±0.227, z -0.17..0.2 from its bone, 0.33 tall), so nothing can hang over a shoulder: it would be
// inside the head. What reads from the game camera is the hat and one big thing each: the load on the back (logs, a saw, the
// yoke, blankets), a coil of rope, a striped apron. Tools hang at the belt, never in the hands (the hands carry crates).
// A new camper gets the same (Oleg: "keep that professional look in mind when you design a new npc"): a plain base with
// nothing off-theme, a hat of their trade and one big thing of it, added here and looked at in tools/trades.html.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const mats = {};
const M = (c, rough = 0.85, metal = 0) => (mats[c + rough + metal] ||= new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }));
const box = (w, h, d, c, r = 0.012) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), M(c));
const cyl = (rt, rb, h, c, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c));
const ring = (r, tube, c, metal = 0.3) => new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 24), M(c, 0.5, metal));
function at(parent, mesh, x, y, z, rx = 0, ry = 0, rz = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.traverse((m) => m.isMesh && (m.castShadow = true));
  parent.add(mesh);
  return mesh;
}
const FRONT = 0.148, SIDE = 0.142, BACK = -0.142;

// a tool at the belt, on one side: a handle hanging down, its head on top
function beltTool(torso, side, handle, head) {
  const g = new THREE.Group();
  at(g, cyl(0.012, 0.012, 0.16, handle), 0, -0.07, 0);
  at(g, head, 0, 0.015, 0);
  return at(torso, g, side * SIDE, 0.0, 0.06, 0.15, 0, side * 0.2);
}

// an apron: the bib over the front, tied round the waist; a shop apron has stripes
function apron(torso, c, pocket, stripe) {
  at(torso, box(0.21, 0.27, 0.014, c, 0.006), 0, 0.01, FRONT);
  at(torso, box(0.27, 0.024, 0.275, c, 0.008), 0, 0.03, 0);
  if (stripe) for (const x of [-0.065, 0, 0.065]) at(torso, box(0.024, 0.27, 0.004, stripe, 0.002), x, 0.01, FRONT + 0.008);
  if (pocket) at(torso, box(0.12, 0.055, 0.012, pocket, 0.005), 0, -0.03, FRONT + 0.011);
}

// the load on the back: hidden while its wearer lies in bed
const pack = (torso) => at(torso, new THREE.Group(), 0, 0, 0);

const GEAR = {
  // the fire keeper: a knit cap with a bobble, a sooty apron, a bundle of firewood on the back, an iron poker at the belt
  fire(head, torso) {
    at(head, box(0.47, 0.13, 0.37, '#8a2a22', 0.06), 0, 0.34, -0.005);
    at(head, box(0.48, 0.05, 0.38, '#5e1a14', 0.02), 0, 0.285, -0.005);
    at(head, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M('#ece0c8')), 0, 0.42, 0);
    apron(torso, '#4a3428');
    const logs = pack(torso);
    for (const [y, z, c] of [[0.02, -0.18, '#7a5236'], [0.02, -0.25, '#6a4a30'], [0.085, -0.215, '#80583a']]) {
      at(logs, cyl(0.036, 0.036, 0.3, c, 8), 0, y, z, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) at(logs, cyl(0.03, 0.03, 0.004, '#d8b888', 8), s * 0.151, y, z, 0, 0, Math.PI / 2);
    }
    for (const x of [-0.08, 0.08]) at(logs, box(0.022, 0.15, 0.13, '#3a2a20', 0.006), x, 0.05, -0.2);
    const poker = new THREE.Group();
    at(poker, cyl(0.01, 0.01, 0.3, '#2a2a2c'), 0, -0.09, 0);
    at(poker, box(0.06, 0.014, 0.014, '#2a2a2c', 0.004), 0.025, -0.235, 0);
    at(torso, poker, SIDE, 0.02, 0.04, 0.1, 0, 0.18);
    return logs;
  },
  // the tent crew: a canvas bandana, a coil of rope slung across the body, a mallet at the belt
  tent(head, torso) {
    at(head, box(0.47, 0.06, 0.375, '#d8c89a', 0.02), 0, 0.255, -0.004);
    at(head, box(0.06, 0.06, 0.05, '#d8c89a', 0.015), 0.035, 0.25, -0.2, 0, 0, 0.6);
    at(head, box(0.06, 0.05, 0.05, '#d8c89a', 0.015), -0.035, 0.24, -0.2, 0, 0, -0.6);
    const coil = at(torso, new THREE.Group(), 0, 0.075, 0, 0, 0, 0.72);
    for (const [k, r] of [[0, 0.205], [1, 0.195], [2, 0.205]]) at(coil, ring(r, 0.016, k === 1 ? '#a8865a' : '#b8966a', 0), 0, (k - 1) * 0.022, 0, Math.PI / 2, 0, 0);
    beltTool(torso, -1, '#9a6a3a', at(new THREE.Group(), cyl(0.036, 0.036, 0.1, '#7a5030'), 0, 0, 0, 0, 0, Math.PI / 2));
  },
  // the carpenter: a flat cap, a leather apron, a pencil behind the ear, a saw on the back, a hammer at the belt
  bench(head, torso) {
    at(head, cyl(0.215, 0.22, 0.06, '#6a5a44'), 0, 0.345, -0.01);
    at(head, box(0.3, 0.02, 0.13, '#5a4a38', 0.008), 0, 0.322, 0.17);
    at(head, cyl(0.008, 0.008, 0.1, '#e8c040', 6), 0.228, 0.17, 0.02, 0.2, 0, 0.4);
    apron(torso, '#8a5a30', '#6a4020');
    const back = pack(torso), saw = at(back, new THREE.Group(), 0, 0.06, BACK - 0.012, 0, 0, 0.75);
    at(saw, box(0.32, 0.085, 0.008, '#c4c8d0', 0.003), 0.03, 0, 0).material = M('#c4c8d0', 0.35, 0.6);
    at(saw, box(0.075, 0.09, 0.03, '#8a5a30', 0.012), -0.16, 0.005, 0);
    beltTool(torso, 1, '#9a6a3a', box(0.1, 0.034, 0.034, '#4a4a50', 0.008));
    return back;
  },
  // the water carrier: a straw hat, a yoke across the back of the shoulders with a bucket hanging from each end
  water(head, torso) {
    at(head, cyl(0.33, 0.33, 0.014, '#d8b860', 24), 0, 0.33, 0);
    at(head, cyl(0.17, 0.195, 0.1, '#d8b860', 20), 0, 0.385, 0);
    at(head, cyl(0.197, 0.197, 0.026, '#3a6aa8', 20), 0, 0.35, 0);
    const yoke = pack(torso);
    at(yoke, box(0.66, 0.034, 0.034, '#9a6a3a', 0.01), 0, 0.15, -0.16);
    for (const x of [-0.31, 0.31]) {
      at(yoke, cyl(0.004, 0.004, 0.1, '#c8a870', 4), x, 0.095, -0.16);
      at(yoke, cyl(0.06, 0.048, 0.095, '#8a5a30'), x, 0.0, -0.16);
      at(yoke, cyl(0.062, 0.062, 0.012, '#4a4a50'), x, 0.03, -0.16);
      at(yoke, cyl(0.052, 0.052, 0.004, '#4a90d0'), x, 0.045, -0.16);
    }
    return yoke;
  },
  // the storekeeper: spectacles, a striped shop apron, the stores' ledger under her arm, a ring of keys at the belt
  chest(head, torso, arms) {
    for (const x of [-0.075, 0.075]) at(head, ring(0.042, 0.009, '#3a3030'), x, 0.165, 0.176);
    at(head, box(0.05, 0.012, 0.012, '#3a3030', 0.003), 0, 0.172, 0.178);
    apron(torso, '#eef0f2', '#d8dce4', '#3a5a8a');
    // under the arm: below it in the bind pose (arms out), between arm and body once the arm hangs
    const ledger = at(arms.left, new THREE.Group(), 0.11, -0.115, 0.01);
    at(ledger, box(0.17, 0.036, 0.13, '#6a3a8a', 0.008), 0, 0, 0);
    at(ledger, box(0.155, 0.038, 0.115, '#f4ecd8', 0.004), 0.004, 0, 0.006);
    const keys = at(torso, ring(0.034, 0.007, '#d8b040', 0.6), -SIDE - 0.004, 0.0, 0.05, 0, Math.PI / 2, 0);
    for (const [y, rz] of [[-0.05, 0], [-0.045, 0.35], [-0.045, -0.35]]) at(keys, box(0.012, 0.055, 0.005, '#c8a040', 0.002), 0, y, 0, 0, 0, rz).material = M('#c8a040', 0.4, 0.6);
  },
  // the bed maker: a long nightcap drooping to one side with a bobble on its tip, a stack of folded blankets on her back
  beds(head, torso) {
    at(head, box(0.48, 0.06, 0.38, '#7aa0d0', 0.02), 0, 0.29, -0.005);
    at(head, box(0.46, 0.09, 0.36, '#f0ead8', 0.04), 0, 0.355, -0.005);
    const tip = at(head, new THREE.Group(), 0.02, 0.385, -0.02, 0, 0, -1.0);
    at(tip, cyl(0.075, 0.15, 0.16, '#7aa0d0'), 0, 0.08, 0);
    const end = at(tip, new THREE.Group(), 0, 0.16, 0, 0, 0, -0.8);
    at(end, cyl(0.014, 0.075, 0.14, '#f0ead8'), 0, 0.07, 0);
    at(end, new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M('#f0ead8')), 0, 0.15, 0);
    const stack = pack(torso);
    for (const [k, c] of ['#a03a3a', '#efe6d0', '#4a7ab0', '#e0a040'].entries()) at(stack, box(0.27, 0.042, 0.12, c, 0.016), 0, 0.0 + k * 0.044, -0.27);
    for (const x of [-0.08, 0.08]) at(stack, box(0.02, 0.19, 0.13, '#5a3a28', 0.006), x, 0.066, -0.27);
    return stack;
  },
};

// dresses a cloned Kenney character (its bones found by name) for the trade of `who` (a camp kind); returns the load it
// carries on its back (or null), so the camp can hide it while its wearer lies in bed
export function dress(model, who) {
  const head = model.getObjectByName('head'), torso = model.getObjectByName('torso');
  const arms = { left: model.getObjectByName('arm-left'), right: model.getObjectByName('arm-right') };
  return (head && torso && arms.left && GEAR[who]?.(head, torso, arms)) || null;
}

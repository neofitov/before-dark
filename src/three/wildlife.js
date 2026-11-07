// The glade's wildlife (Oleg, 2026-10-24: "add 1 more deer and a couple of foxes and birds to make the forest feel more
// alive"). Two deer graze at the forest's edge, now and then look up or take a few steps, and leave as night falls. Two
// foxes trot along the edge, stop to sniff, sit and look about; out at night anyway, they stay, their eyes catching the
// firelight. Birds, made in code: a few on the ground round the clearing, pecking and hopping, up and off when a worker
// comes near, gone to roost at night; and now and then a small flock crossing high over the glade. Everything keeps to its
// own ground: off the camp's (camp.js campKeepOut) and off the board and the workers' path.
// Quaternius' CC0 deer and fox (assets/LICENSES.md).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { GROUND } from './board.js';

// size: the game's largest board; keepOut: the camp's ground; people: where the workers are now (for the birds)
export function makeWildlife(scene, models, size, keepOut, people) {
  const hx = size.w / 2 + 2.2, hz = size.h / 2 + 2.2;
  // a point on an ellipse round the glade, `out` beyond the forest's inner edge
  const ring = (a, out) => new THREE.Vector3(Math.cos(a) * (hx * 1.25 + out), GROUND, Math.sin(a) * (hz + out * 0.9));
  const free = (p, margin) => keepOut.every((c) => c.gap(p.x, p.z) > margin);
  // the nearest angle to `at` on the ring where an animal can start, off everybody's ground
  const start = (at, out) => {
    for (let d = 0; d < 2.5; d += 0.05) for (const a of [at + d, at - d]) if (free(ring(a, out), 0.9)) return a;
    return at;
  };
  const animals = [
    grazer(scene, models, 'deer', ring, free, { at: start(-0.75, 3.2), out: 3.2, height: 1.05 }),
    grazer(scene, models, 'deer', ring, free, { at: start(-2.0, 2.8), out: 2.8, height: 0.95 }),
    trotter(scene, models, ring, free, { at: start(Math.PI - 0.55, 2.3), out: 2.3 }),
    trotter(scene, models, ring, free, { at: start(0.35, 2.5), out: 2.5 }),
    ...[0, 1, 2].map((k) => groundBird(scene, size, free, people, k)),
    flock(scene, size),
  ].filter(Boolean);
  return {
    update(dt, t, dusk) {
      for (const a of animals) a.update(dt, t, dusk);
    },
  };
}

// a skinned model from the loaded ones, cloned, scaled to `height` (or `length`), casting shadows, with its clips by name
export function animal(models, name, { height, length }) {
  const src = models.raw(name);
  if (!src) return null;
  const model = cloneSkinned(src.scene), root = new THREE.Group();
  root.name = name;
  const sz = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(height ? height / sz.y : length / Math.max(sz.x, sz.z));
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      mat.transparent = false;
      mat.roughness = 0.9;
    }
  });
  root.add(model);
  const mixer = new THREE.AnimationMixer(model), acts = {};
  for (const clip of src.animations) acts[clip.name.split('|').pop()] = mixer.clipAction(clip);
  let current = null;
  const play = (n) => {
    const act = acts[n];
    if (!act || act === current) return;
    act.reset().play();
    if (current) current.crossFadeTo(act, 0.35, false);
    current = act;
  };
  mixer.update(Math.random() * 3);
  return { root, model, mixer, play, acts };
}

// ---- a deer: grazes at the forest's edge, now and then looks up or takes a few steps; leaves when night falls ----
function grazer(scene, models, name, ring, free, { at, out, height }) {
  const a0 = at, me = animal(models, name, { height });
  if (!me) return null;
  const { root, mixer, play } = me;
  let a = a0, mode = 'eat', timer = 3 + Math.random() * 6, gone = false, dir = 1;
  root.position.copy(ring(a, out));
  root.rotation.y = Math.random() * Math.PI * 2;
  scene.add(root);
  play('Eating');
  return {
    update(dt, t, dusk) {
      mixer.update(dt);
      if (gone) return;
      timer -= dt;
      if (dusk > 0.85 && mode !== 'leave') {
        mode = 'leave';
        play('Walk');
      }
      if (mode === 'leave') {
        const away = root.position.clone().setY(0).normalize();
        root.position.addScaledVector(away, dt * 0.9);
        root.rotation.y = Math.atan2(away.x, away.z);
        if (root.position.length() > 24) (gone = true), (root.visible = false);
        return;
      }
      if (timer > 0) {
        if (mode === 'walk') {
          const next = ring(a + dt * 0.06 * dir, out);
          if (!free(next, 0.6)) dir = -dir;
          else {
            const d = next.clone().sub(root.position);
            a += dt * 0.06 * dir;
            root.position.copy(next);
            if (d.lengthSq() > 1e-8) root.rotation.y = Math.atan2(d.x, d.z);
          }
        }
        return;
      }
      const r = Math.random();
      if (mode === 'eat' && r < 0.45) {
        mode = 'look';
        play(Math.random() < 0.5 ? 'Idle' : 'Idle_2');
        timer = 2.5 + Math.random() * 2;
      } else if (r < 0.7) {
        mode = 'walk';
        dir = Math.abs(a - a0) > 0.3 ? -Math.sign(a - a0) : Math.random() < 0.5 ? 1 : -1;
        play('Walk');
        timer = 2 + Math.random() * 2;
      } else {
        mode = 'eat';
        play(Math.random() < 0.7 ? 'Eating' : 'Idle_Headlow');
        timer = 5 + Math.random() * 5;
      }
    },
  };
}

// ---- a fox: trots along the forest's edge, stops to sniff the ground or sits and looks about, now and then dashes on ----
function trotter(scene, models, ring, free, { at, out }) {
  const me = animal(models, 'fox', { length: 0.85 });
  if (!me) return null;
  const { root, model, mixer, play } = me;
  // a bright fox-orange coat (the model's own reads brown from the game's camera); eyes that catch the firelight at night
  let eyes = null;
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (mat.name === 'Main') mat.color.set('#e8742c');
      if (mat.name === 'Eyes') eyes = mat;
    }
  });
  if (eyes) eyes.emissive = new THREE.Color(0xffc23a);
  const a0 = at, SPEED = { Walk: 0.075, Gallop: 0.22 };
  let a = a0, mode = 'Walk', timer = 2 + Math.random() * 3, dir = Math.random() < 0.5 ? 1 : -1;
  root.position.copy(ring(a, out));
  scene.add(root);
  play('Walk');
  return {
    update(dt, t, dusk) {
      mixer.update(dt);
      if (eyes) eyes.emissiveIntensity = Math.max(0, dusk - 0.4) * 2.5;
      timer -= dt;
      if (SPEED[mode]) {
        const next = ring(a + dt * SPEED[mode] * dir, out);
        if (!free(next, 0.6) || Math.abs(a + dt * SPEED[mode] * dir - a0) > 0.5) dir = -dir;
        else {
          const d = next.clone().sub(root.position);
          a += dt * SPEED[mode] * dir;
          root.position.copy(next);
          if (d.lengthSq() > 1e-8) root.rotation.y = Math.atan2(d.x, d.z);
        }
      }
      if (timer > 0) return;
      const r = Math.random();
      if (mode !== 'Walk' && r < 0.6) (mode = 'Walk'), (timer = 2 + Math.random() * 4);
      else if (r < 0.3) (mode = 'Idle_2_HeadLow'), (timer = 1.5 + Math.random() * 2);
      else if (r < 0.55) (mode = 'Eating'), (timer = 2 + Math.random() * 2);
      else if (r < 0.85) (mode = 'Idle'), (timer = 2.5 + Math.random() * 3);
      else (mode = 'Gallop'), (timer = 0.8 + Math.random() * 0.6), (dir = Math.random() < 0.5 ? 1 : -1);
      play(mode);
    },
  };
}

// ---- birds, made in code: a round body, a head with a beak, a tail and two wings that flap ----
const BIRDS = [
  { body: '#8a6a4a', head: '#5e4430', wing: '#6a4e36', belly: '#d8c4a4' },   // a sparrow
  { body: '#6a6a72', head: '#3a3a40', wing: '#4e4e56', belly: '#e0763a' },   // a robin
  { body: '#d8c040', head: '#3a6ab0', wing: '#5a86c0', belly: '#e8d870' },   // a blue tit
];
function makeBird(look) {
  const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
  const root = new THREE.Group(), g = new THREE.Group();
  root.add(g);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(look.body));
  body.scale.set(0.9, 0.85, 1.35);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(look.belly));
  belly.scale.set(0.85, 0.8, 1.1);
  belly.position.set(0, -0.015, 0.02);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), mat(look.head));
  head.position.set(0, 0.06, 0.075);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 6), mat('#e0a030'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.055, 0.125);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.08), mat(look.wing));
  tail.position.set(0, 0.02, -0.11);
  tail.rotation.x = -0.35;
  g.add(body, belly, head, beak, tail);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group(), w = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.07), mat(look.wing));
    w.position.x = s * 0.06;
    pivot.add(w);
    pivot.position.set(s * 0.045, 0.03, 0);
    g.add(pivot);
    return pivot;
  });
  g.traverse((m) => m.isMesh && (m.castShadow = true));
  // open: 0 folded back along the body, 1 spread; flap: the beat
  const pose = (open, flap) => wings.forEach((p, k) => {
    const s = k ? 1 : -1;
    p.rotation.set(0, s * (1 - open) * 1.32, s * open * Math.sin(flap) * 0.9);
  });
  pose(0, 0);
  return { root, g, head, pose };
}

// a bird on the ground round the clearing: pecks, hops, looks about; flies off to another spot when a worker comes near, and
// to roost when night falls
function groundBird(scene, size, free, people, k) {
  const b = makeBird(BIRDS[k % BIRDS.length]);
  b.root.scale.setScalar(1.35);
  b.root.name = 'bird';
  // never on the board or its frame and the gates' paths (playtest 2026-10-24: birds landed on the board)
  const off = (p) => Math.abs(p.x) > size.w / 2 + 1.5 || Math.abs(p.z) > size.h / 2 + 1.5;
  const spot = (near) => {
    const a0 = near && Math.atan2(near.z / (size.h / 2 + 2), near.x / (size.w / 2 + 2));
    for (let n = 0; n < 60; n++) {
      const a = near ? a0 + (Math.random() - 0.5) * 1.1 : Math.random() * Math.PI * 2, d = 1.6 + Math.random() * 2.2;
      const p = new THREE.Vector3(Math.cos(a) * (size.w / 2 + d), GROUND, Math.sin(a) * (size.h / 2 + d));
      if (free(p, 0.4) && off(p) && Math.abs(p.x) < size.w / 2 + 4.5) return p;
    }
    return new THREE.Vector3(0, GROUND, -size.h / 2 - 2.2);
  };
  let mode = 'ground', timer = 1 + Math.random() * 2, from = null, to = spot(), fly = 0, flyT = 1, heading = Math.random() * 6, hop = 0;
  b.root.position.copy(to);
  scene.add(b.root);
  const takeOff = (dest) => {
    from = b.root.position.clone();
    to = dest;
    fly = 0;
    flyT = Math.max(0.8, from.distanceTo(to) / 3.2);
    mode = 'fly';
  };
  return {
    update(dt, t, dusk) {
      if (mode === 'roost') return;
      if (mode === 'fly') {
        fly += dt / flyT;
        const u = Math.min(1, fly), p = from.clone().lerp(to, u);
        p.y += Math.sin(u * Math.PI) * Math.min(2.2, 0.6 + from.distanceTo(to) * 0.25);
        const d = p.clone().sub(b.root.position);
        b.root.position.copy(p);
        if (d.lengthSq() > 1e-8) heading = Math.atan2(d.x, d.z);
        b.root.rotation.y = heading;
        b.pose(1, t * 38);
        if (u >= 1) {
          if (to.y > GROUND + 1) (mode = 'roost'), (b.root.visible = false);
          else (mode = 'ground'), (timer = 0.5 + Math.random()), b.pose(0, 0);
        }
        return;
      }
      // on the ground: off to roost at night, away from anyone coming close
      if (dusk > 0.8) return takeOff(b.root.position.clone().setY(0).normalize().multiplyScalar(18).setY(GROUND + 5));
      if (people().some((q) => q.distanceTo(b.root.position) < 1.3)) return takeOff(spot(b.root.position));
      timer -= dt;
      hop = Math.max(0, hop - dt);
      b.root.position.y = GROUND + Math.sin((hop / 0.25) * Math.PI) * 0.08;
      if (timer <= 0) {
        const r = Math.random();
        if (r < 0.45) b.head.userData.peck = 0.35;
        else if (r < 0.75) {
          heading += (Math.random() - 0.5) * 2;
          const step = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)).multiplyScalar(0.18).add(b.root.position);
          if (free(step, 0.4) && off(step)) (b.root.position.x = step.x), (b.root.position.z = step.z), (hop = 0.25);
        } else if (r < 0.8) takeOff(spot(b.root.position));
        else heading += (Math.random() - 0.5) * 1.5;
        timer = 0.4 + Math.random() * 1.2;
      }
      const peck = (b.head.userData.peck = Math.max(0, (b.head.userData.peck || 0) - dt));
      b.g.rotation.x = Math.sin((peck / 0.35) * Math.PI) * 0.7;
      b.root.rotation.y = heading;
    },
  };
}

// now and then a small flock crossing high over the glade, from one side of the forest to the other (not at night)
function flock(scene, size) {
  const birds = Array.from({ length: 6 }, (_, k) => {
    const b = makeBird(BIRDS[k % 2]);
    b.root.scale.setScalar(1.6);
    b.root.name = 'flock';
    b.root.visible = false;
    // high up, no shadows: sweeping over the board they read as dark things creeping in (playtest 2026-10-24, Leo)
    b.root.traverse((m) => (m.castShadow = false));
    scene.add(b.root);
    return { ...b, off: new THREE.Vector3((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 2.4), phase: Math.random() * 6 };
  });
  let wait = 6 + Math.random() * 8, at = null, dir = null, u = 0;
  const R = Math.max(size.w, size.h) / 2 + 14;
  return {
    update(dt, t, dusk) {
      if (!at) {
        wait -= dt;
        if (wait > 0 || dusk > 0.7) return;
        const a = Math.random() * Math.PI * 2, a2 = a + Math.PI + (Math.random() - 0.5) * 1.2;
        at = new THREE.Vector3(Math.cos(a) * R, GROUND + 3.5 + Math.random() * 1.5, Math.sin(a) * R * 0.8 - 2);
        dir = new THREE.Vector3(Math.cos(a2) * R, at.y, Math.sin(a2) * R * 0.8 - 2).sub(at);
        u = 0;
        for (const b of birds) (b.root.visible = true), (b.root.rotation.y = Math.atan2(dir.x, dir.z));
      }
      u += (dt * 4.2) / dir.length();
      for (const b of birds) {
        b.root.position.copy(at).addScaledVector(dir, u).add(b.off);
        b.root.position.y += Math.sin(t * 2 + b.phase) * 0.12;
        // bursts of flapping between glides
        const beat = Math.sin(t * 0.9 + b.phase) > -0.3;
        b.pose(1, beat ? t * 30 + b.phase : 0.3);
      }
      if (u >= 1) {
        at = null;
        wait = 14 + Math.random() * 16;
        for (const b of birds) b.root.visible = false;
      }
    },
  };
}

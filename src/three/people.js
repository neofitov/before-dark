// The campers, in two styles to compare (Oleg, 2026-10-24): 'own', drawn and animated here in code (natural proportions,
// outdoor clothes: plaid shirt, shorts or trousers, boots, a hat, sometimes a backpack), and 'kenney', Kenney's Mini
// Characters (CC0) with their own animations. Both wear a scout's neckerchief in their gate's colour and answer the same
// calls: play('idle' | 'walk' | 'carry' | 'pickup' | 'work' | 'sit' | 'cheer'), update(dt), hand() (where a carried crate goes).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { dress } from './trades.js';

export const HEIGHT = 0.95;

// the six campers: who they are in each style
export const CREW = {
  fire: { kenney: 'character-male-b', skin: '#e0ac86', hair: '#6b3a1e', beard: true, shirt: ['#b8352a', '#5a1a14'], legs: '#4a5a3a', long: true, hat: 'beanie', hatColor: '#3a4a5a', pack: false },
  tent: { kenney: 'character-female-b', skin: '#f0c8a8', hair: '#c96a2a', bun: true, shirt: ['#e0a23a', '#8a5a1a'], legs: '#3a4a6a', long: false, hat: 'bucket', hatColor: '#8a7a50', pack: true },
  bench: { kenney: 'character-male-e', skin: '#c99068', hair: '#2a1a10', shirt: ['#3a6a9a', '#1a3050'], legs: '#6a5034', long: true, hat: 'cap', hatColor: '#c8a040', pack: false, apron: true },
  water: { kenney: 'character-male-a', skin: '#8a5a3a', hair: '#1a1210', shirt: ['#3a8a5a', '#1a4a2a'], legs: '#7a6a4a', long: false, hat: 'bucket', hatColor: '#5a6a3a', pack: true },
  chest: { kenney: 'character-female-c', skin: '#7a4a32', hair: '#1a1210', bun: true, shirt: ['#7a4aa0', '#3a2050'], legs: '#3a3a4a', long: true, hat: null, pack: false },
  beds: { kenney: 'character-female-f', skin: '#f2d0b4', hair: '#9a4a2a', long_hair: true, shirt: ['#d0b030', '#6a5a14'], legs: '#4a4a3a', long: false, hat: 'beanie', hatColor: '#a03a3a', pack: true },
};

export function makeCamper(style, who, color, models) {
  return style === 'kenney' ? kenneyCamper(CREW[who], color, models, who) : ownCamper(CREW[who], color);
}

const mat = (c, rough = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough });

// a plaid flannel, the camp shirt
const plaids = {};
function plaid([a, b]) {
  const key = a + b;
  if (plaids[key]) return plaids[key];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.globalAlpha = 0.55;
  g.fillStyle = b;
  for (let k = 0; k < 64; k += 16) {
    g.fillRect(k, 0, 6, 64);
    g.fillRect(0, k, 64, 6);
  }
  g.globalAlpha = 0.25;
  g.fillStyle = '#fff';
  for (let k = 8; k < 64; k += 16) {
    g.fillRect(k, 0, 1, 64);
    g.fillRect(0, k, 64, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.magFilter = THREE.NearestFilter;
  return (plaids[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
}

// the neckerchief: a folded triangle of cloth in the gate's colour, knotted at the throat
function neckerchief(color, size) {
  const g = new THREE.BufferGeometry(), w = size, h = size * 0.9;
  g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, -h, w * 0.15], 3));
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(size * 0.13, 8, 6), m.material);
  knot.position.set(0, -h * 0.12, w * 0.04);
  m.add(knot);
  return m;
}

// ---- my own camper: a jointed figure of rounded parts, posed in code ----

function ownCamper(c, color) {
  const root = new THREE.Group(), shadows = [];
  const part = (geo, material, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const joint = (parent, x, y, z) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    return j;
  };
  const skin = mat(c.skin, 0.7), shirt = plaid(c.shirt), legsM = mat(c.legs), boots = mat('#4a3020', 0.6), hairM = mat(c.hair, 0.9);
  // proportions in metres of a 1.7 m person, scaled to HEIGHT at the end
  const hips = joint(root, 0, 0.92, 0);
  part(new RoundedBoxGeometry(0.34, 0.16, 0.2, 2, 0.05), legsM, hips, 0, 0.02, 0);
  const torso = joint(hips, 0, 0.08, 0);
  part(new RoundedBoxGeometry(0.36, 0.48, 0.22, 3, 0.07), shirt, torso, 0, 0.24, 0);
  if (c.apron) part(new RoundedBoxGeometry(0.3, 0.42, 0.04, 2, 0.015), mat('#7a5a3a'), torso, 0, 0.18, 0.115);
  const scarf = neckerchief(color, 0.2);
  scarf.position.set(0, 0.47, 0.115);
  scarf.rotation.x = -0.15;
  torso.add(scarf);
  if (c.pack) {
    const pack = part(new RoundedBoxGeometry(0.3, 0.38, 0.16, 2, 0.05), mat('#5a6a3a'), torso, 0, 0.26, -0.19);
    part(new RoundedBoxGeometry(0.32, 0.1, 0.1, 2, 0.04), mat('#7a3a2a'), pack, 0, 0.23, 0);   // the bedroll on top
  }
  const neck = joint(torso, 0, 0.5, 0);
  part(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10), skin, neck, 0, 0.03, 0);
  const head = joint(neck, 0, 0.08, 0);
  part(new THREE.SphereGeometry(0.115, 18, 14), skin, head, 0, 0.11, 0).scale.set(1, 1.08, 1.02);
  // face: eyes, a nose, ears; hair, beard and hat
  for (const s of [-1, 1]) {
    part(new THREE.SphereGeometry(0.014, 8, 6), mat('#1a1a1a', 0.4), head, s * 0.04, 0.13, 0.104);
    part(new THREE.SphereGeometry(0.025, 8, 6), skin, head, s * 0.112, 0.11, 0);
  }
  part(new THREE.SphereGeometry(0.02, 8, 6), skin, head, 0, 0.1, 0.118);
  const hairCap = part(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, head, 0, 0.125, -0.008);
  hairCap.rotation.x = -0.25;
  if (c.bun) part(new THREE.SphereGeometry(0.055, 12, 10), hairM, head, 0, 0.2, -0.1);
  if (c.long_hair) part(new RoundedBoxGeometry(0.22, 0.2, 0.08, 2, 0.04), hairM, head, 0, 0.02, -0.085);
  if (c.beard) part(new RoundedBoxGeometry(0.17, 0.11, 0.09, 2, 0.04), hairM, head, 0, 0.04, 0.07);
  if (c.hat === 'bucket') {
    const hm = mat(c.hatColor);
    part(new THREE.CylinderGeometry(0.1, 0.12, 0.09, 16), hm, head, 0, 0.23, 0);
    part(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 20), hm, head, 0, 0.19, 0);
  } else if (c.hat === 'beanie') {
    part(new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(c.hatColor), head, 0, 0.15, 0);
    part(new THREE.SphereGeometry(0.035, 8, 6), mat('#e8e0d0'), head, 0, 0.28, 0);
  } else if (c.hat === 'cap') {
    const hm = mat(c.hatColor);
    part(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hm, head, 0, 0.15, 0);
    part(new RoundedBoxGeometry(0.16, 0.015, 0.1, 1, 0.006), hm, head, 0, 0.17, 0.12);
  }
  // arms: shoulder, elbow; legs: hip, knee
  const limb = (parent, x, y, sleeve, lower, len, rad, hand) => {
    const sh = joint(parent, x, y, 0);
    part(new THREE.CapsuleGeometry(rad, len, 4, 10), sleeve, sh, 0, -len / 2 - rad * 0.4, 0);
    const el = joint(sh, 0, -len - rad * 0.6, 0);
    part(new THREE.CapsuleGeometry(rad * 0.9, len * 0.92, 4, 10), lower, el, 0, -len / 2, 0);
    if (hand) part(new THREE.SphereGeometry(rad * 1.15, 10, 8), hand, el, 0, -len - rad * 0.3, 0.01);
    return [sh, el];
  };
  const [shL, elL] = limb(torso, -0.235, 0.44, shirt, skin, 0.23, 0.062, skin);
  const [shR, elR] = limb(torso, 0.235, 0.44, shirt, skin, 0.23, 0.062, skin);
  const legLower = c.long ? legsM : skin;
  const [hipL, knL] = limb(hips, -0.095, 0, legsM, legLower, 0.35, 0.082, null);
  const [hipR, knR] = limb(hips, 0.095, 0, legsM, legLower, 0.35, 0.082, null);
  for (const kn of [knL, knR]) part(new RoundedBoxGeometry(0.14, 0.09, 0.22, 2, 0.035), boots, kn, 0, -0.38, 0.035);
  head.scale.setScalar(1.3);   // a little larger than life, so a face reads from the camera's height
  root.scale.setScalar(HEIGHT / 1.85);

  // poses: joint angles, eased towards the state's pose each frame (so states blend into each other)
  const J = { hips, torso, head, shL, elL, shR, elR, hipL, knL, hipR, knR };
  const cur = {}, want = {};
  for (const k of Object.keys(J)) cur[k] = { x: 0, y: 0, z: 0 };
  let state = 'idle', t = Math.random() * 10, hipY = 0.92, hipYWant = 0.92;
  function pose(dt) {
    t += dt;
    for (const k of Object.keys(J)) want[k] = { x: 0, y: 0, z: 0 };
    hipYWant = 0.92;
    const W = Math.sin(t * 9), W2 = Math.cos(t * 9);
    const arms = (l, r, el = 0.15) => {
      want.shL.x = l;
      want.shR.x = r;
      want.elL.x = -el;
      want.elR.x = -el;
      want.shL.z = 0.08;
      want.shR.z = -0.08;
    };
    if (state === 'idle') {
      arms(Math.sin(t * 1.3) * 0.04, -Math.sin(t * 1.3) * 0.04);
      want.torso.x = Math.sin(t * 1.1) * 0.02;
      want.head.y = Math.sin(t * 0.5) * 0.35;
    } else if (state === 'walk' || state === 'carry') {
      want.hipL.x = W * 0.55;
      want.hipR.x = -W * 0.55;
      want.knL.x = Math.max(0, -W2) * 0.9;
      want.knR.x = Math.max(0, W2) * 0.9;
      hipYWant = 0.9 + Math.abs(W2) * 0.03;
      if (state === 'walk') arms(-W * 0.5, W * 0.5, 0.35);
      else {
        arms(-0.55, -0.55, 1.05);   // forearms level, the crate held against the chest
        want.torso.x = -0.08;
      }
    } else if (state === 'pickup') {
      hipYWant = 0.62;
      want.hipL.x = want.hipR.x = -1.1;
      want.knL.x = want.knR.x = 1.7;
      want.torso.x = 0.45;
      arms(-0.9, -0.9, 0.3);
    } else if (state === 'work') {
      // hammering: the right arm swings down, the left steadies the piece
      const s = (Math.sin(t * 8) + 1) / 2;
      want.torso.x = 0.3;
      hipYWant = 0.86;
      want.hipL.x = want.hipR.x = -0.2;
      want.knL.x = want.knR.x = 0.4;
      want.shL.x = -0.9;
      want.elL.x = -0.6;
      want.shR.x = -2.4 + s * 1.6;
      want.elR.x = -0.4 - s * 0.6;
    } else if (state === 'sit') {
      hipYWant = 0.24;
      want.hipL.x = want.hipR.x = -1.45;
      want.knL.x = want.knR.x = 1.45;
      want.hipL.z = 0.12;
      want.hipR.z = -0.12;
      arms(-0.6, -0.6, 0.6);
      want.head.x = 0.1 + Math.sin(t * 0.7) * 0.05;
    } else if (state === 'cheer') {
      const s = Math.sin(t * 10);
      hipYWant = 0.92 + Math.max(0, s) * 0.08;
      want.shL.x = -2.8;
      want.shR.x = -2.8;
      want.shL.z = 0.3 + s * 0.2;
      want.shR.z = -0.3 - s * 0.2;
      want.elL.x = want.elR.x = -0.2;
      want.head.x = -0.2;
    }
    const k = Math.min(1, dt * 12);
    for (const n of Object.keys(J)) {
      for (const a of ['x', 'y', 'z']) cur[n][a] += (want[n][a] - cur[n][a]) * k;
      J[n].rotation.set(cur[n].x, cur[n].y, cur[n].z);
    }
    hipY += (hipYWant - hipY) * k;
    hips.position.y = hipY;
  }
  pose(0.001);
  return {
    root,
    play(s) {
      state = s === 'run' || s === 'stroll' ? 'walk' : s === 'tinker' ? 'work' : s === 'gather' ? 'pickup' : s;
    },
    update: pose,
    hand: (out) => out.set(0, 1.12, 0.36).applyMatrix4(root.matrixWorld),
  };
}

// ---- Kenney's Mini Characters, played with their own clips (carrying = the walk's legs with the holding arms) ----

function kenneyCamper(c, color, models, who) {
  const src = models.raw(c.kenney);
  if (!src) return ownCamper(c, color);
  const model = cloneSkinned(src.scene), root = new THREE.Group();
  root.add(model);
  const box = new THREE.Box3().setFromObject(model), h = box.getSize(new THREE.Vector3()).y;
  model.scale.setScalar(HEIGHT * 0.9 / h);
  model.traverse((m) => m.isMesh && (m.castShadow = true));
  const mixer = new THREE.AnimationMixer(model), clips = {};
  for (const a of src.animations) clips[a.name] = a;
  const legsOnly = clips.walk && new THREE.AnimationClip('carry-walk', clips.walk.duration, clips.walk.tracks.filter((tr) => !/arm/.test(tr.name)));
  const actions = {};
  const act = (clip) => clip && (actions[clip.name] ||= mixer.clipAction(clip));
  const MAP = { idle: ['idle'], walk: ['walk'], run: ['sprint'], carry: [legsOnly, 'holding-both'], pickup: ['pick-up'], work: ['interact-right'], tinker: ['interact-right'], stroll: ['walk'], gather: ['pick-up'], sit: ['sit'], cheer: ['emote-yes'] };
  // the clips sped up with the camp's faster workers (camp.js SPEED, WORK), so the feet keep up with the ground
  // (tinker: busy at their own place between crates, the work's clip at an easy pace, Oleg 2026-11-07)
  // (stroll and gather: about their place before anything is built there, camp.js chores)
  const PACE = { walk: 2.25, run: 1.6, carry: 2.45, pickup: 2.4, work: 2.4, tinker: 0.9, stroll: 0.9, gather: 1.1 };
  let playing = [], now = '';
  // the neckerchief on the torso bone
  let torso = null;
  model.traverse((o) => o.name === 'torso' && (torso = o));
  if (torso) {
    const scarf = neckerchief(color, 0.22 / model.scale.x * (HEIGHT / 1.7) * 1.3);
    const tb = new THREE.Box3().setFromObject(torso), ts = tb.getSize(new THREE.Vector3());
    scarf.position.set(0, ts.y / model.scale.x * 0.85, ts.z / model.scale.x * 0.5);
    torso.add(scarf);
  }
  // dressed for their trade (trades.js); the load on the back comes off in bed
  const pack = dress(model, who);
  return {
    root,
    lying(on) {
      if (pack) pack.visible = !on;
    },
    play(s) {
      const next = (MAP[s] || MAP.idle).map((x) => act(typeof x === 'string' ? clips[x] : x)).filter(Boolean);
      if (s === now) return;
      now = s;
      if (next.length === playing.length && next.every((a, k) => a === playing[k])) return void next.forEach((a) => a.setEffectiveTimeScale(PACE[s] || 1));
      for (const a of playing) if (!next.includes(a)) a.fadeOut(0.2);
      for (const a of next) a.reset().setEffectiveTimeScale(PACE[s] || 1).fadeIn(0.2).play();
      playing = next;
    },
    update: (dt) => mixer.update(dt),
    hand: (out) => out.set(0, HEIGHT * 0.5, HEIGHT * 0.32).applyMatrix4(root.matrixWorld),
  };
}

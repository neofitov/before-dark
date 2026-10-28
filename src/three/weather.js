// The weather over the glade. breeze: a gusting wind (the forest, grass and flags sway; leaves blow across) and clouds that
// now and then pass over the sun; rain: grey light, streaks slanted by the wind, splashes on the board, its hiss; mist: the
// forest fades into white and low banks of mist drift at the clearing's edge; clear: calm and bright.
import * as THREE from 'three';
import { wind } from './world.js';
import { GROUND } from './board.js';
import * as sfx from './sound.js';

export const KINDS = ['breeze', 'rain', 'mist', 'clear'];
const LOOK = {   // wind, sun, sky light, grey, fog near/far, rain, leaves
  clear: { wind: 0.15, sun: 1, hemi: 1, grey: 0, fogNear: 1, fogFar: 1, rain: 0, leaves: 0 },
  breeze: { wind: 0.55, sun: 1, hemi: 1, grey: 0, fogNear: 1, fogFar: 1, rain: 0, leaves: 1 },
  rain: { wind: 0.7, sun: 0.38, hemi: 0.85, grey: 0.65, fogNear: 0.85, fogFar: 0.7, rain: 1, leaves: 0.3 },
  mist: { wind: 0.1, sun: 0.7, hemi: 1.05, grey: 0.35, fogNear: 0.72, fogFar: 0.55, rain: 0, leaves: 0 },
};

export function makeWeather(scene, fx, area) {
  let kind = 'breeze';
  const cur = { ...LOOK.breeze };

  // rain: short streaks in a box over the glade, falling fast and slanting with the wind
  const N = 1100, R = Math.max(area.hx, area.hz) + 4, rainPos = new Float32Array(N * 6), seeds = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    seeds[i * 3] = (Math.random() * 2 - 1) * R;
    seeds[i * 3 + 1] = Math.random() * 9;
    seeds[i * 3 + 2] = (Math.random() * 2 - 1) * R;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xb8c6dc, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // leaves blowing across: little cards spinning in the wind
  const LEAVES = 46, leafMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 });
  const leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.07), leafMat, LEAVES);
  leafMesh.frustumCulled = false;
  const leafCol = ['#d98a2b', '#c9562a', '#e6b83a', '#8aa63a', '#b5732d'].map((c) => new THREE.Color(c));
  const leaves = Array.from({ length: LEAVES }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: -Math.random() * 6, on: false }));
  leaves.forEach((l, i) => leafMesh.setColorAt(i, leafCol[i % leafCol.length]));
  scene.add(leafMesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), hide = new THREE.Matrix4().makeScale(0, 0, 0);

  function set(k) {
    kind = KINDS.includes(k) ? k : 'breeze';
  }

  let t = 0;
  function update(dt) {
    t += dt;
    const want = LOOK[kind];
    for (const key of Object.keys(cur)) cur[key] += (want[key] - cur[key]) * Math.min(1, dt * 0.8);
    // gusts: slow swells with quick flurries on top
    const gust = Math.max(0, Math.sin(t * 0.37) * 0.6 + Math.sin(t * 1.13 + 1) * 0.3 + Math.sin(t * 2.9) * 0.1);
    wind.k.value = cur.wind * (0.6 + gust * 0.8);
    wind.t.value += dt * (0.8 + cur.wind * 1.4);
    // clouds now and then over the sun
    const cloud = Math.max(0, Math.sin(t * 0.11) * Math.sin(t * 0.067 + 2)) * (kind === 'breeze' ? 0.55 : kind === 'clear' ? 0.15 : 0.2);
    cur.cloudSun = 1 - cloud;
    // rain
    rainMat.opacity = 0.42 * cur.rain;
    rain.visible = cur.rain > 0.02;
    if (rain.visible) {
      const sx = wind.dir.value.x * wind.k.value * 0.5, sz = wind.dir.value.y * wind.k.value * 0.5;
      for (let i = 0; i < N; i++) {
        let y = seeds[i * 3 + 1] - ((t * 13 + i * 0.37) % 9.5);
        if (y < GROUND) y += 9.5;
        const x = seeds[i * 3] + sx * y, z = seeds[i * 3 + 2] + sz * y;
        rainPos.set([x, y, z, x - sx * 0.35, y + 0.35, z - sz * 0.35], i * 6);
      }
      rainGeo.attributes.position.needsUpdate = true;
      for (let k = 0; k < 40 * cur.rain * dt * 30; k++) {   // splashes on the board and the ground
        const x = (Math.random() * 2 - 1) * area.hx, z = (Math.random() * 2 - 1) * area.hz, onBoard = Math.abs(x) < area.bx && Math.abs(z) < area.bz;
        fx.dust.spawn({ x, y: onBoard ? 0.02 : GROUND + 0.02, z, vx: (Math.random() - 0.5) * 0.4, vy: 0.5 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.4, life: 0.22, size: 0.05, color: 0xdfe8f6, alpha: 0.7, gravity: 6 });
      }
    }
    // leaves
    const dir = wind.dir.value, strength = wind.k.value;
    leaves.forEach((l, i) => {
      l.life -= dt;
      if (!l.on && l.life < 0 && Math.random() < cur.leaves * dt * 1.5) {
        // set off from the upwind side, high in the trees
        const across = (Math.random() * 2 - 1) * (area.hx + 3);
        l.p.set(-dir.x * (area.hx + 5) - dir.y * across, 2.5 + Math.random() * 2.5, -dir.y * (area.hz + 5) + dir.x * across);
        l.v.set(dir.x * 1.5, -0.5, dir.y * 1.5);
        l.spin.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
        l.on = true;
        l.life = 9;
      }
      if (!l.on) return leafMesh.setMatrixAt(i, hide);
      l.v.x += (dir.x * (1 + strength * 4) - l.v.x) * dt * 0.8;
      l.v.z += (dir.y * (1 + strength * 4) - l.v.z) * dt * 0.8;
      l.v.y += (-0.45 + Math.sin(t * 3 + i) * 0.6 - l.v.y) * dt * 2;
      l.p.addScaledVector(l.v, dt);
      if (l.p.y < GROUND + 0.02) {
        l.p.y = GROUND + 0.02;
        l.v.multiplyScalar(0.9);
      }
      l.rot.x += l.spin.x * dt;
      l.rot.y += l.spin.y * dt;
      l.rot.z += l.spin.z * dt;
      if (l.life < 0 || Math.abs(l.p.x) > area.hx + 9 || Math.abs(l.p.z) > area.hz + 9) l.on = false;
      m4.compose(l.p, q.setFromEuler(l.rot), one);
      leafMesh.setMatrixAt(i, l.on ? m4 : hide);
    });
    leafMesh.instanceMatrix.needsUpdate = true;
    // mist banks drifting low at the clearing's edge
    if (cur.grey > 0.2 && kind === 'mist' && Math.random() < dt * 5) {
      const a = Math.random() * Math.PI * 2, d = Math.max(area.hx, area.hz) + 1 + Math.random() * 3;
      fx.smoke.spawn({ x: Math.cos(a) * d * 1.2, y: GROUND + 0.3 + Math.random() * 0.4, z: Math.sin(a) * d, vx: dir.x * 0.25, vy: 0.02, vz: dir.y * 0.25, life: 7, size: 2.4, grow: 0.4, color: 0xeef2f6, alpha: 0.16, drag: 0.05 });
    }
    sfx.setWeather(cur.rain, strength * (kind === 'breeze' ? 1 : 0.5));
  }

  // the light's share: { sun, hemi, grey, fogNear, fogFar }
  const light = () => ({ sun: cur.sun * (cur.cloudSun ?? 1), hemi: cur.hemi, grey: cur.grey, fogNear: cur.fogNear, fogFar: cur.fogFar });
  return { set, update, light, kind: () => kind };
}

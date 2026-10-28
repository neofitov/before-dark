// Particles for the 3D board: dust when a crate lands, chips and sparkles when one is unpacked, the fire's sparks and smoke,
// fireflies at dusk. One pool of soft round points per look (normal or glowing), sized in world units, faded by age.
import * as THREE from 'three';

const VERT = `
attribute float size;
attribute vec4 tint;
uniform float scale;
varying vec4 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec4 vTint;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.12, d);
  gl_FragColor = vec4(vTint.rgb, vTint.a * a);
  #include <colorspace_fragment>
}`;

export function makeParticles(scene, { max = 400, glow = false } = {}) {
  const pos = new Float32Array(max * 3), size = new Float32Array(max), tint = new Float32Array(max * 4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  g.setAttribute('tint', new THREE.BufferAttribute(tint, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: { scale: { value: 600 } },
    transparent: true, depthWrite: false, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = glow ? 3 : 2;
  scene.add(points);
  const parts = [];
  const c = new THREE.Color();

  // p: { x, y, z, vx, vy, vz, life, size, grow, color, alpha, gravity, drag, wander, blink }
  function spawn(p) {
    if (parts.length >= max) parts.shift();
    parts.push({ vx: 0, vy: 0, vz: 0, life: 1, size: 0.2, grow: 0, color: 0xffffff, alpha: 1, gravity: 0, drag: 0, wander: 0, blink: 0, ...p, age: 0, seed: Math.random() * 10 });
  }

  function update(dt) {
    let n = 0;
    for (let k = parts.length - 1; k >= 0; k--) if ((parts[k].age += dt) >= parts[k].life) parts.splice(k, 1);
    for (const p of parts) {
      p.vy -= p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vz *= d;
      if (p.wander) {
        const t = p.age * 1.7 + p.seed;
        p.vx += Math.sin(t * 1.3) * p.wander * dt;
        p.vz += Math.cos(t * 1.1) * p.wander * dt;
        p.vy += Math.sin(t * 2.1) * p.wander * 0.5 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.floor !== undefined && p.y < p.floor) {
        p.y = p.floor;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      const k = p.age / p.life, fade = Math.min(1, k * 8) * (1 - k * k);
      const blink = p.blink ? 0.5 + 0.5 * Math.sin(p.age * p.blink + p.seed * 6) : 1;
      pos[n * 3] = p.x;
      pos[n * 3 + 1] = p.y;
      pos[n * 3 + 2] = p.z;
      size[n] = p.size + p.grow * p.age;
      c.set(p.color);
      tint[n * 4] = c.r;
      tint[n * 4 + 1] = c.g;
      tint[n * 4 + 2] = c.b;
      tint[n * 4 + 3] = p.alpha * fade * blink;
      n++;
    }
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = g.attributes.size.needsUpdate = g.attributes.tint.needsUpdate = true;
  }

  return { spawn, update, setScale: (s) => (mat.uniforms.scale.value = s), count: () => parts.length };
}

// a puff of dust around a crate's foot; w, h its size in cells, strength 0..1
export function dustPuff(fx, x, z, w, h, strength = 1) {
  const n = Math.round(10 + 14 * strength);
  for (let k = 0; k < n; k++) {
    const side = k % 4, u = Math.random() - 0.5;
    const ox = side === 0 ? -w / 2 : side === 1 ? w / 2 : u * w, oz = side === 2 ? -h / 2 : side === 3 ? h / 2 : u * h;
    const out = 0.6 + Math.random() * 1.2 * strength;
    fx.spawn({
      x: x + ox, y: 0.05, z: z + oz, vx: Math.sign(ox || u) * (side < 2 ? out : 0.2) + u * 0.3, vy: 0.25 + Math.random() * 0.5, vz: Math.sign(oz || u) * (side >= 2 ? out : 0.2) + u * 0.3,
      life: 0.5 + Math.random() * 0.5, size: 0.14, grow: 0.5, color: 0xd8c39a, alpha: 0.55 * strength + 0.15, drag: 4, gravity: 0.3,
    });
  }
}

// wood chips and a gold sparkle when a crate is unpacked at its camp spot
export function unpackBurst(fx, glow, x, y, z, color) {
  for (let k = 0; k < 18; k++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2;
    fx.spawn({ x, y, z, vx: Math.cos(a) * s, vy: 2 + Math.random() * 2.5, vz: Math.sin(a) * s, life: 0.8 + Math.random() * 0.4, size: 0.07, color: k % 3 ? 0x9a6a3c : color, alpha: 1, gravity: 9, drag: 0.8, floor: 0.03 });
  }
  for (let k = 0; k < 22; k++) {
    const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.6;
    glow.spawn({ x, y: y + 0.2, z, vx: Math.cos(a) * s, vy: 1 + Math.random() * 1.8, vz: Math.sin(a) * s, life: 0.7 + Math.random() * 0.6, size: 0.16, color: 0xffd36a, alpha: 0.9, gravity: 1.2, drag: 1.5 });
  }
}

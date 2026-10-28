// The world around the board: renderer, camera, a sky dome, the grass with its sandy clearing, the forest ring and the light,
// which runs from a golden afternoon (t = 0) through sunset to a blue night (t = 1) as moves run out; the weather dims and
// greys it. The forest is Quaternius' Stylized Nature MegaKit (CC0): textured bark and leaf cards that sway in the wind.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../lib/rng.js';

const KEYS = [   // t, sky top, horizon, sun colour, sun strength, sun height (deg), sky light, ground light, hemi strength, exposure
  [0, '#77b8ea', '#f6e3b8', '#fff0d2', 2.6, 50, '#cfe6ff', '#6a5a3a', 1.15, 1.0],
  [0.5, '#6a6fb5', '#f6a865', '#ffc488', 2.6, 34, '#ffe0c0', '#6a4e38', 1.15, 1.05],
  [0.78, '#3d4290', '#e07a55', '#ff9a5c', 2.3, 22, '#d8b8e8', '#4a3440', 1.15, 1.15],
  [0.92, '#1c2258', '#7a4a6a', '#c890b0', 1.2, 26, '#8a96e0', '#262634', 0.95, 1.2],
  [1, '#0a0f2c', '#202a58', '#a8bcff', 0.9, 40, '#7080d0', '#181826', 0.8, 1.2],
];

// the wind every swaying material shares: time, strength (0 calm .. 1 storm) and direction
export const wind = { t: { value: 0 }, k: { value: 0.35 }, dir: { value: new THREE.Vector2(0.8, 0.35).normalize() } };

export function makeWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]film\b/.test(location.search) });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  scene.fog = new THREE.Fog(0xf6e3b8, 22, 55);

  // sky dome: a gradient with the sun's glow, stars at night
  const skyU = { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, stars: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float stars; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y * 1.8 + 0.08, 0.0, 1.0); vec3 col = mix(horizon, top, pow(h, 0.65));
        float s = max(dot(d, normalize(sunDir)), 0.0); col += sunColor * (pow(s, 900.0) * 2.5 + pow(s, 10.0) * 0.3);
        if (stars > 0.0 && d.y > 0.02) { vec3 p = floor(d * 220.0); float n = fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); col += step(0.9972, n) * stars; }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6a5a3a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // the ground: grass with a worn, sandy clearing round the board and the camp
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.32;
  ground.receiveShadow = true;
  scene.add(ground);
  const clearing = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshStandardMaterial({ map: clearingTexture(), transparent: true, roughness: 1, depthWrite: false }));
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.y = -0.31;
  clearing.receiveShadow = true;
  scene.add(clearing);

  const c = (h) => new THREE.Color(h);
  const grey = new THREE.Color('#8a9098');
  // t: the evening; w: the weather's say, { sun, hemi, grey, fogNear, fogFar } (1, 1, 0, 1, 1 when clear)
  function setEvening(t, w = { sun: 1, hemi: 1, grey: 0, fogNear: 1, fogFar: 1 }) {
    let a = KEYS[0], b = KEYS[1];
    for (let k = 0; k < KEYS.length - 1; k++) if (t >= KEYS[k][0]) [a, b] = [KEYS[k], KEYS[k + 1]];
    const u = Math.min(Math.max((t - a[0]) / (b[0] - a[0]), 0), 1), lerp = (x, y) => x + (y - x) * u, mix = (x, y) => c(x).lerp(c(y), u);
    skyU.top.value.copy(mix(a[1], b[1])).lerp(grey, w.grey * 0.7);
    skyU.horizon.value.copy(mix(a[2], b[2])).lerp(grey, w.grey * 0.6);
    const sunCol = mix(a[3], b[3]).lerp(grey, w.grey * 0.4);
    sun.color.copy(sunCol);
    sun.intensity = lerp(a[4], b[4]) * w.sun;
    // the sun stands behind the viewer's left shoulder (shadows fall away, up the screen) and swings low to the west through
    // the evening; the moon then takes over the same light, higher up (no jump in the shadows)
    const night = t > 0.9, elev = THREE.MathUtils.degToRad(lerp(a[5], b[5])), az = THREE.MathUtils.degToRad(118 + t * 45);
    sun.position.set(Math.cos(az) * Math.cos(elev) * 20, Math.sin(elev) * 20, Math.sin(az) * Math.cos(elev) * 20);
    skyU.sunDir.value.copy(sun.position).normalize();
    skyU.sunColor.value.copy(sunCol).multiplyScalar((night ? 0.3 : 1) * (1 - w.grey * 0.8));
    skyU.stars.value = Math.max(0, (t - 0.75) * 4) * (1 - w.grey);
    hemi.color.copy(mix(a[6], b[6])).lerp(grey, w.grey * 0.5);
    hemi.groundColor.copy(mix(a[7], b[7]));
    hemi.intensity = lerp(a[8], b[8]) * w.hemi;
    renderer.toneMappingExposure = lerp(a[9], b[9]);
    scene.fog.color.copy(skyU.horizon.value).lerp(skyU.top.value, 0.25);
    scene.fog.near = fogRange[0] * w.fogNear;
    scene.fog.far = fogRange[1] * w.fogFar;
  }
  // the haze starts past the camp: a camera further out (a phone, a bigger board) pushes it back
  let fogRange = [22, 55];
  const fitFog = (d) => (fogRange = [Math.max(22, d + 8), Math.max(55, d * 2.6)]);

  // area: the board and camp's half extents; the shadow camera and the clearing fit them
  function fitArea(hx, hz) {
    const r = Math.hypot(hx, hz) + 1.5;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 60 });
    sun.shadow.camera.updateProjectionMatrix();
    clearing.scale.set(Math.max(hx, hz) * 1.25 + 1, Math.max(hx, hz) + 1, 1);
  }

  return { renderer, scene, camera, sun, hemi, setEvening, fitArea, fitFog, sky };
}

// ---- the Quaternius plants: one shared material per texture, leaves cut out of their cards and swaying ----

const TEX = {
  Bark_NormalTree: 'bark.jpg', Material: 'bark.jpg', Bark_TwistedTree: 'bark-twisted.jpg', Leaves_NormalTree: 'leaves-tree.png',
  Leaves_Pine: 'leaves-pine.png', Leaves_TwistedTree: 'leaves-twisted.png', Leaves: 'leaves.png', Grass: 'grass.png',
  Flowers: 'flowers.png', Mushrooms: 'mushrooms.jpg', Rocks: 'rocks.jpg', PathRocks: 'pathrocks.jpg',
};
const SWAY = { Leaves_NormalTree: 1, Leaves_Pine: 0.7, Leaves_TwistedTree: 1, Leaves: 1.3, Grass: 1.6, Flowers: 1.4 };
const natureMats = {};
const texLoader = new THREE.TextureLoader();

// the material for a plant part; bush leaves use the green tree leaves (their own are the twisted tree's red)
export function natureMaterial(name, model = '') {
  const key = model.startsWith('Bush') && name === 'Leaves_TwistedTree' ? 'Leaves_NormalTree' : name;
  if (natureMats[key]) return natureMats[key];
  const file = TEX[key], cut = /Leaves|Leaf|Flowers/.test(key);
  const map = file ? texLoader.load(`assets/nature/${file}`) : null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 1, metalness: 0, alphaTest: cut ? 0.45 : 0, side: cut ? THREE.DoubleSide : THREE.FrontSide });
  m.name = key;
  if (SWAY[key]) swaying(m, SWAY[key]);
  return (natureMats[key] = m);
}

// world-space sway: the higher a vertex stands, the further the wind pushes it, in waves rolling along the wind
export function swaying(m, k) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uWindT = wind.t;
    s.uniforms.uWindK = wind.k;
    s.uniforms.uWindDir = wind.dir;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindT; uniform float uWindK; uniform vec2 uWindDir;')
      .replace('#include <project_vertex>', `
        vec4 swayW = modelMatrix * vec4(transformed, 1.0);
        float swayH = max(swayW.y + 0.32, 0.0);
        float swayP = dot(swayW.xz, uWindDir) * 0.35 + swayW.x * 0.21 - swayW.z * 0.17;
        float gust = sin(uWindT * 1.3 + swayP) * 0.6 + sin(uWindT * 2.9 + swayP * 1.7) * 0.3 + sin(uWindT * 7.0 + swayP * 3.1) * 0.1;
        float push = uWindK * ${k.toFixed(2)} * swayH * 0.05 * (0.55 + gust);
        transformed.xz += (inverse(mat3(modelMatrix)) * vec3(uWindDir.x, 0.0, uWindDir.y)).xz * push;
        transformed.y -= push * 0.15;
        #include <project_vertex>`);
  };
  m.customProgramCacheKey = () => 'sway' + k;
}

// the forest ring: trees thick at the clearing's edge and thinning outwards, bushes, ferns and rocks among them, grass,
// flowers, clover and mushrooms where the sand turns to grass (seeded, so it never jumps). Nothing grows on `keepOut`, the
// ground of the camp's places (camp.js campKeepOut: each with gap(x, z)): a plant stays out when its own spread (a tree's
// crown) would reach in.
// What was planted is kept in `userData.items` ({ name, x, z, r }) for checks.
export function plantForest(scene, models, hx, hz, seed = 7, keepOut = []) {
  const r = rng(seed), near = new THREE.Group(), far = new THREE.Group();
  let group = near;
  const trees = [['CommonTree_3', 3.6, 5.2], ['CommonTree_4', 3.8, 5.6], ['CommonTree_5', 3.4, 4.8], ['Pine_1', 3.8, 5.6], ['Pine_4', 4.4, 6.2], ['Pine_5', 3.6, 5], ['TwistedTree_3', 3.6, 4.4]];
  const shrubs = [['Bush_Common', 0.7, 1.1], ['Bush_Common_Flowers', 0.7, 1.1], ['Fern_1', 0.45, 0.7], ['Rock_Medium_1', 0.4, 0.7], ['Rock_Medium_2', 0.35, 0.6], ['Plant_1', 0.5, 0.8], ['stump_old', 0.25, 0.35]];
  const ground = [['Grass_Common_Short', 0.3, 0.45], ['Grass_Common_Tall', 0.4, 0.6], ['Grass_Common_Short', 0.3, 0.45], ['Grass_Wispy_Short', 0.3, 0.45], ['Grass_Wispy_Tall', 0.45, 0.65], ['Flower_3_Group', 0.35, 0.55], ['Flower_4_Group', 0.35, 0.55], ['Clover_1', 0.18, 0.28], ['Mushroom_Common', 0.12, 0.2], ['Plant_7', 0.08, 0.12], ['Plant_7', 0.08, 0.12], ['Pebble_Round_1', 0.05, 0.08], ['Pebble_Round_2', 0.05, 0.08]];
  const inside = (x, z, m) => (x / (hx * 1.25 + m)) ** 2 + (z / (hz + m)) ** 2 < 1;
  const items = [], spread = {};
  const place = ([name, lo, hi], x, z) => {
    const m = models.get(name);
    if (!m) return;
    const h = models.height(name), turn = r.next() * Math.PI * 2, scale = (lo + r.next() * (hi - lo)) / h;
    // its spread in the ground plan: the model's half-width at this size (a tree's crown is rounder than its box: 0.8)
    if (!(name in spread)) {
      const sz = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
      spread[name] = (Math.max(sz.x, sz.z) / 2) * 0.8;
    }
    const reach = spread[name] * scale;
    if (keepOut.some((c) => c.gap(x, z) < reach)) return;
    m.position.set(x, -0.32, z);
    m.rotation.y = turn;
    m.scale.setScalar(scale);
    group.add(m);
    items.push({ name, x: +x.toFixed(2), z: +z.toFixed(2), r: +reach.toFixed(2) });
  };
  const ring = (k, spread) => {
    const a = r.next() * Math.PI * 2, d = 1 + Math.pow(r.next(), 1.6) * spread;
    return [Math.cos(a) * (hx * 1.25 + k) * d, Math.sin(a) * (hz + k) * d];
  };
  // trees: the near ring casts shadows into the clearing, the far ones only fill the view (and cost no shadow work);
  // three autumn maples for colour (they are the heaviest model)
  let maples = 0;
  for (let k = 0; k < 110; k++) {
    const [x, z] = ring(2, 1.5);
    if (inside(x, z, 1.7) || (z > 0 && inside(x, z, 9))) continue;   // none close in front: they would hide the board
    group = inside(x, z, 4.5) ? near : far;
    const maple = maples < 3 && z < 0 && r.next() < 0.12;
    if (maple) maples++;
    place(maple ? trees[6] : trees[r.int(6)], x, z);
  }
  group = near;
  for (let k = 0; k < 90; k++) {
    const [x, z] = ring(0.9, 0.9);
    if (inside(x, z, 0.8)) continue;
    place(r.pick(shrubs), x, z);
  }
  for (let k = 0; k < 300; k++) {
    const [x, z] = ring(0.35, 0.75);
    if (inside(x, z, 0.3)) continue;
    place(r.pick(ground), x, z);
  }
  const out = new THREE.Group(), merged = mergeStatic(near), back = mergeStatic(far);
  back.traverse((m) => m.isMesh && (m.castShadow = false));
  out.add(merged, back);
  out.userData.items = items;
  scene.add(out);
  return out;
}

// the forest never moves (but for the wind in its shader): its meshes become one per material
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const sets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const base = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const groups = base.groups.length ? base.groups : [{ start: 0, count: base.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      const g = slice(base, gr.start, gr.count);
      g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(n)) g.deleteAttribute(n);
      if (g.attributes.color.itemSize === 4) g.setAttribute('color', toRGB(g.attributes.color));
      const key = mat.uuid + '|' + Object.keys(g.attributes).sort().join(',');
      if (!sets.has(key)) sets.set(key, { material: mat, geos: [] });
      sets.get(key).geos.push(g);
    }
  });
  const out = new THREE.Group();
  for (const { material, geos } of sets.values()) {
    const g = mergeGeometries(geos);
    if (!g) continue;
    const m = new THREE.Mesh(g, material);
    m.castShadow = m.receiveShadow = true;
    out.add(m);
  }
  return out;
}

// a range of vertices as plain floats (models store some attributes interleaved or as normalised integers)
function slice(geo, start, count) {
  const g = new THREE.BufferGeometry();
  for (const [n, a] of Object.entries(geo.attributes)) {
    const out = new Float32Array(count * a.itemSize), get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = get[c].call(a, start + i);
    g.setAttribute(n, new THREE.BufferAttribute(out, a.itemSize));
  }
  return g;
}

function toRGB(a) {
  const out = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) {
    out[i * 3] = a.getX(i);
    out[i * 3 + 1] = a.getY(i);
    out[i * 3 + 2] = a.getZ(i);
  }
  return new THREE.Float32BufferAttribute(out, 3);
}

function canvasTexture(size, draw, repeat = 1) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function grassTexture() {
  const r = rng(3);
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#5c8a3c';
    g.fillRect(0, 0, s, s);
    // soft patches of lighter and darker grass, then blades
    for (let k = 0; k < 60; k++) {
      const x = r.next() * s, y = r.next() * s, rad = 20 + r.next() * 60, grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, r.next() < 0.5 ? 'rgba(120,160,70,0.35)' : 'rgba(60,90,40,0.35)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const tones = ['#6a9c46', '#557f37', '#73a64c', '#4f7733', '#7aa852', '#8aa85a'];
    for (let k = 0; k < 3200; k++) {
      g.fillStyle = r.pick(tones);
      g.globalAlpha = 0.3 + r.next() * 0.4;
      g.fillRect(r.next() * s, r.next() * s, 1.5 + r.next() * 2, 5 + r.next() * 9);
    }
  }, 26);
}

function clearingTexture() {
  const r = rng(5);
  return canvasTexture(512, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.1, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(196,170,118,1)');
    grad.addColorStop(0.7, 'rgba(172,148,100,0.95)');
    grad.addColorStop(1, 'rgba(150,130,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 1400; k++) {
      const x = r.next() * s, y = r.next() * s, d = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
      if (d > 0.9) continue;
      g.fillStyle = r.next() < 0.5 ? 'rgba(110,88,56,0.22)' : 'rgba(232,212,165,0.22)';
      g.beginPath();
      g.arc(x, y, 0.8 + r.next() * 2.8, 0, Math.PI * 2);
      g.fill();
    }
  });
}

// The camp's upgrades from the shop (shop.js; 2026-11-14, Oleg: "restructure the buy upgrades so they offer visual upgrades
// without making the place look like junkyard"; looks chosen from the mock-ups in crazygames/cover-options/tiers-2026-11-14).
// Each part of the camp has three tiers. A tier never adds a thing to stand round the camp: it changes the part in its own
// ground (camp.js PLAN), made like the camp itself (its wood, its canvas):
// - materials: the tent's canvas, the beds' blankets;
// - pieces in the part's ground: a rug, an awning, a pump, a well, a shed, a paved circle;
// - and some of the part's own pieces give way to the tier's (the water's model barrels to wooden ones, the stores' loose
//   boxes to a tidy stack, the fire's tripod to a cooking spit).
// The parts are still built stage by stage over the levels (camp.js BUILD): each tier piece comes with the stage it belongs
// to (a roof over the workbench once the bench is up), so a tier bought early shows on a part half built.
// Also here: the slots (the string lights, the camp flag) and the crews' tools (people.js).
import * as THREE from 'three';
import { woodMaterial, canvasTex } from './board.js';

export const CREW = { orange: '#ff9d2e', green: '#5cc753', red: '#f05a3c', blue: '#3f9cf0', purple: '#ab70f0', yellow: '#ffd23a' };

// ---- materials ----
function clothTex(draw) {
  const t = canvasTex(128, (g, s) => {
    draw(g, s);
    g.strokeStyle = 'rgba(60,30,10,0.5)';
    g.lineWidth = 1;
    for (let k = 0; k < s; k += 4) {
      g.globalAlpha = 0.1;
      g.beginPath();
      g.moveTo(0, k);
      g.lineTo(s, k);
      g.stroke();
    }
    g.globalAlpha = 0.45;
    g.setLineDash([4, 3]);
    g.strokeRect(5, 5, s - 10, s - 10);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const mats = {};
const once = (key, make) => (mats[key] ||= make());
const cloth = (base) => once(`cloth${base}`, () => new THREE.MeshStandardMaterial({ map: clothTex((g, s) => ((g.fillStyle = base), g.fillRect(0, 0, s, s))), roughness: 0.95, side: THREE.DoubleSide }));
// stripes across the texture's width (vertical = true) or down it
const striped = (a, b, n = 6, rep = 1, vertical = true) => once(`stripe${a}${b}${n}${rep}${vertical}`, () => {
  const t = clothTex((g, s) => {
    for (let k = 0; k < n; k++) {
      g.fillStyle = k % 2 ? b : a;
      if (vertical) g.fillRect((k * s) / n, 0, s / n + 1, s);
      else g.fillRect(0, (k * s) / n, s, s / n + 1);
    }
  });
  t.repeat.set(rep, rep);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
});
const std = (color, x = {}) => once(`std${color}${JSON.stringify(x)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...x }));
const wood = (base, seed) => once(`wood${base}`, () => woodMaterial(base, seed));
// (bright colours and little metalness: the scene has no reflections to show, so real metal renders nearly black)
export const METAL = {
  1: () => std(0x5e636c, { metalness: 0.25, roughness: 0.5 }),   // (iron: darker than the steel)
  2: () => std(0xeef2f6, { metalness: 0.3, roughness: 0.25, emissive: 0x303438, emissiveIntensity: 0.4 }),
  3: () => std(0xffd040, { metalness: 0.3, roughness: 0.25, emissive: 0x8a6000, emissiveIntensity: 0.55 }),
};
const glow = () => std(0xffe6a0, { emissive: 0xffc060, emissiveIntensity: 1.8 });
const P = {
  pole: () => wood('#7a5530', 32), post: () => wood('#6a4628', 33), plank: () => wood('#b08050', 34), plankDark: () => wood('#8a6038', 35),
  bark: () => wood('#5a3e26', 31), stone: () => std(0x9a968c, { roughness: 1 }), metal: () => std(0x3a3a3a, { roughness: 0.5, metalness: 0.6 }),
  water: () => std(0x3f8fd8, { roughness: 0.15 }),
};

// ---- shapes ----
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r0, r1, h, m, n = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), m);
const grp = (...c) => {
  const g = new THREE.Group();
  if (c.length) g.add(...c);
  return g;
};
const at = (o, x, y, z, ry = 0) => {
  o.position.set(x, y, z);
  o.rotation.y = ry;
  return o;
};
function pole(x, z, h, r = 0.035, m = P.pole()) {
  return at(cyl(r, r * 1.15, h, m, 8), x, h / 2, z);
}
function tri(p, m) {
  const s = new THREE.Shape();
  s.moveTo(p[0], p[1]);
  s.lineTo(p[2], p[3]);
  s.lineTo(p[4], p[5]);
  return new THREE.Mesh(new THREE.ShapeGeometry(s), m);
}
// a flat panel from (x0, y0) to (x1, y1) across, `len` along z (in a group, so moving it keeps the panel's own height)
function slope(x0, y0, x1, y1, len, m, th = 0.03) {
  const dx = x1 - x0, dy = y1 - y0, b = box(Math.hypot(dx, dy), th, len, m);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
  b.rotation.z = Math.atan2(dy, dx);
  return grp(b);
}
function pennant(color, h = 1.5, size = 1) {
  const f = tri([0, 0, 0.42 * size, -0.11 * size, 0, -0.22 * size], std(color, { side: THREE.DoubleSide }));
  f.position.set(0.03, h - 0.04, 0);
  return grp(pole(0, 0, h, 0.022), f);
}
function sag(p0, p1, n, s) {
  return Array.from({ length: n + 1 }, (_, k) => p0.clone().lerp(p1, k / n).add(new THREE.Vector3(0, -s * 4 * (k / n) * (1 - k / n), 0)));
}
function flagLine(p0, p1, colors, n, s) {
  const g = new THREE.Group(), pts = sag(p0, p1, n, s);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x4a3a28 })));
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[k + 1], m = a.clone().lerp(b, 0.5);
    const geo = new THREE.BufferGeometry().setFromPoints([a.clone().lerp(m, 0.12), b.clone().lerp(m, 0.12), m.clone().add(new THREE.Vector3(0, -0.13, 0))]);
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, std(colors[k % colors.length], { side: THREE.DoubleSide })));
  }
  return g;
}
function bulbs(p0, p1, n, s) {
  const g = new THREE.Group(), pts = sag(p0, p1, n, s);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a3428 })));
  const geo = new THREE.SphereGeometry(0.04, 8, 6);
  for (const p of pts.slice(1, -1)) g.add(at(new THREE.Mesh(geo, glow()), p.x, p.y - 0.045, p.z));
  return g;
}
function rug(color, w, d) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), striped(color, '#f3e6c8', 6));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  const g = grp(m);
  g.userData.flat = true;
  return g;
}
// a gable roof on four posts: w across, d deep, posts h tall
function shelter(w, d, h, roof, pitch = 0.35) {
  const g = new THREE.Group();
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.add(pole(x, z, h, 0.045, P.post()));
  g.add(slope(-w / 2 - 0.12, h - 0.02, 0, h + pitch, d + 0.25, roof, 0.05), slope(0, h + pitch, w / 2 + 0.12, h - 0.02, d + 0.25, roof, 0.05));
  g.add(at(box(0.06, 0.06, d + 0.3, P.plankDark()), 0, h + pitch + 0.02, 0));
  return g;
}
function barrel(band) {
  const g = grp(at(cyl(0.17, 0.15, 0.42, P.plank(), 14), 0, 0.21, 0));
  for (const y of [0.09, 0.33]) {
    const t = at(new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.018, 6, 18), std(band)), 0, y, 0);
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  g.add(at(cyl(0.165, 0.165, 0.03, P.plankDark(), 14), 0, 0.43, 0));
  return g;
}
function lantern() {
  const cap = at(cyl(0.01, 0.1, 0.07, P.metal(), 4), 0, 0.3, 0);
  cap.rotation.y = Math.PI / 4;
  return grp(at(box(0.13, 0.17, 0.13, glow()), 0, 0.18, 0), cap, at(box(0.15, 0.03, 0.15, P.metal()), 0, 0.08, 0));
}
let plaidMat = null;
// a soft plaid in the beds crew's yellow, with cream and a thin red line
export function plaid() {
  return (plaidMat ||= new THREE.MeshStandardMaterial({
    roughness: 1,
    map: clothTex((g, s) => {
      g.fillStyle = '#e8b830';
      g.fillRect(0, 0, s, s);
      g.globalAlpha = 0.45;
      g.fillStyle = '#f6ecd0';
      for (const k of [0.15, 0.6]) g.fillRect(k * s, 0, s * 0.16, s), g.fillRect(0, k * s, s, s * 0.16);
      g.globalAlpha = 0.6;
      g.fillStyle = '#b8402e';
      for (const k of [0.42, 0.9]) g.fillRect(k * s, 0, s * 0.03, s), g.fillRect(0, k * s, s, s * 0.03);
      g.globalAlpha = 1;
    }),
  }));
}
let stoneT = null;
function stoneFloor() {
  return once('stoneFloor', () => {
    const tex = (stoneT = canvasTex(256, (g, sz) => {
      g.fillStyle = '#8f7f66';
      g.fillRect(0, 0, sz, sz);
      let seed = 7;
      const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 110; k++) {
        const x = R() * sz, y = R() * sz, w = 16 + R() * 22, h = 12 + R() * 18;
        g.fillStyle = `hsl(${30 + R() * 14}, ${14 + R() * 12}%, ${44 + R() * 14}%)`;
        g.beginPath();
        g.ellipse(x, y, w / 2, h / 2, R() * 3, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(70,60,45,0.35)';
        g.stroke();
      }
    }));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  });
}

// ---- each part's tier pieces: [key, object, a (across), y, b (towards the board), turn], for the stage it has got to ----
// (keys name the pieces, so a piece new since the last time pops up, camp.js redress)
const DRESS = {
  tent(t, stage) {
    const out = [];
    if (t >= 1 && stage >= 1) out.push(['rug', rug(CREW.orange, 0.8, 0.5), -0.05, 0, 1.12]);
    if (t >= 1 && t < 3 && stage >= 2) out.push(['pennant', pennant(CREW.orange, t === 2 ? 1.75 : 1.45), 0.7, 0, -1.15]);
    if (t >= 3 && stage >= 4) {
      // an awning out over the door on two poles, the crew's flags along the ridge, a taller pennant
      out.push(['awning', grp(at(slope(-0.5, 0.86, 0.5, 0.8, 0.5, striped('#ef8d34', '#f6e8cc', 8)), 0, 0, 0.0), pole(-0.5, 0.25, 0.83, 0.022), pole(0.5, 0.25, 0.83, 0.022)), 0, 0, 0.92]);
      out.push(['ridge', 'ridge', 0, 0, 0]);
      out.push(['pennant3', pennant(CREW.orange, 2.0, 1.2), 0.7, 0, -1.2]);
    }
    return out;
  },
  fire(t, stage) {
    const out = [];
    if (t >= 1 && stage >= 1) {
      // a ring of big flat stones round the fire (in its ground: the front is the gates' way, check-camp)
      const ring = new THREE.Group();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, st = at(box(0.17, 0.08, 0.12, P.stone()), Math.cos(a) * 0.48, 0.04, Math.sin(a) * 0.48);
        st.rotation.y = -a;
        ring.add(st);
      }
      out.push(['ring', ring, 0, 0, 0]);
    }
    if (t >= 1 && stage >= 3) {
      // another log to sit on, on the fire's free side (the camp's own lies on the other)
      const seat = cyl(0.075, 0.08, 0.72, P.bark(), 10);
      seat.rotation.z = Math.PI / 2;
      seat.position.y = 0.075;
      out.push(['seat', grp(seat), -0.78, 0, 0.26, -(Math.PI / 2 + 0.25)]);   // (clear of the nearest bed's foot: check-camp)
    }
    if (t >= 2 && stage >= 3) {
      const g = new THREE.Group();
      for (const x of [-0.42, 0.42]) g.add(pole(x, 0, 0.62, 0.022), at(box(0.04, 0.12, 0.02, P.pole()), x, 0.66, 0));
      const bar = at(cyl(0.016, 0.016, 0.95, P.pole(), 6), 0, 0.64, 0);
      bar.rotation.z = Math.PI / 2;
      g.add(bar, at(cyl(0.12, 0.09, 0.15, P.metal(), 14), 0, 0.42, 0), at(cyl(0.105, 0.105, 0.01, std(0x9a5a2a), 14), 0, 0.495, 0), at(cyl(0.006, 0.006, 0.12, P.metal(), 4), 0, 0.56, 0));
      out.push(['spit', g, 0, 0, 0]);
    }
    if (t >= 3 && stage >= 1) {
      // flat stones round the fire and the beds, inside the beds' ground
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), stoneFloor()), edge = new THREE.Mesh(new THREE.RingGeometry(2.25, 2.38, 48), std(0x6e6656));
      disc.rotation.x = edge.rotation.x = -Math.PI / 2;
      disc.position.y = 0.006;
      edge.position.y = 0.008;
      const g = grp(disc, edge);
      g.userData.flat = true;
      out.push(['plaza', g, 0, 0, -0.8]);
    }
    return out;
  },
  // the beds' own: per bed built (camp.js passes which), a rug under it and a shade over its head
  beds(t, stage, ctx) {
    const out = [];
    ctx.beds.forEach((bed, k) => {
      if (!ctx.made(bed)) return;
      if (t >= 2) {
        const r = rug(CREW.yellow, 1.0, 1.42);
        r.userData.bed = bed;
        out.push([`rug${k}`, r, 0, 0, 0, 0, bed]);
      }
      if (t >= 3) {
        const shade = grp(pole(-0.34, -0.66, 1.0, 0.02), pole(0.34, -0.66, 1.0, 0.02), at(slope(-0.36, 1.0, 0.36, 0.97, 0.5, striped('#ffd23a', '#f6e8cc', 8)), 0, 0, -0.45));
        out.push([`shade${k}`, shade, 0, 0, 0, 0, bed]);
      }
    });
    return out;
  },
  bench(t, stage) {
    const out = [];
    if (t >= 1 && t < 3 && stage >= 2) {
      out.push(['awning', grp(pole(-1.15, 0.55, 1.5, 0.035), pole(1.15, 0.55, 1.5, 0.035), slope(-1.2, 1.5, 1.2, 1.5, 1.2, striped('#5cc753', '#f3e6c8', 8, 2))), 0, 0, -0.05]);
    }
    if (t >= 2 && stage >= 3) {
      out.push(['anvil', grp(at(cyl(0.15, 0.18, 0.3, P.bark(), 10), 0, 0.15, 0), at(box(0.3, 0.09, 0.12, P.metal()), 0, 0.345, 0), at(box(0.13, 0.055, 0.09, P.metal()), 0.19, 0.36, 0)), -0.5, 0, 0.56, 0.3]);
      const wheel = at(cyl(0.18, 0.18, 0.06, P.stone(), 18), 0, 0.4, 0);
      wheel.rotation.z = Math.PI / 2;
      out.push(['grind', grp(at(box(0.07, 0.4, 0.26, P.plankDark()), -0.09, 0.2, 0), at(box(0.07, 0.4, 0.26, P.plankDark()), 0.09, 0.2, 0), wheel), 0.5, 0, 0.56, -0.3]);
    }
    if (t >= 3 && stage >= 2) {
      out.push(['roof', shelter(2.36, 1.05, 1.45, wood('#4f9a45', 41)), 0, 0, 0.06]);
      out.push(['sign', grp(at(box(0.62, 0.3, 0.04, P.plank()), 0, 1.3, 0.69), at(box(0.66, 0.34, 0.02, std(CREW.green)), 0, 1.3, 0.665)), 0, 0, 0]);
    }
    return out;
  },
  water(t, stage) {
    const out = [];
    if (t >= 1 && t < 3) {
      if (stage >= 2) out.push(['barrel1', barrel(CREW.blue), -0.75, 0, -0.1]);
      if (stage >= 5) out.push(['barrel2', barrel(CREW.blue), -0.75, 0, -0.62]);
    }
    if (t === 2 && stage >= 1) {
      const pump = grp(at(box(0.11, 0.8, 0.11, P.post()), 0, 0.4, 0), at(box(0.05, 0.05, 0.24, P.metal()), 0, 0.72, 0.13), at(box(0.035, 0.035, 0.42, P.metal()), 0, 0.86, -0.12));
      pump.children[2].rotation.x = 0.5;
      out.push(['pump', pump, 0, 0, -0.2]);
    }
    if (t >= 3) {
      if (stage >= 2) {
        const well = new THREE.Group();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2, st = at(box(0.19, 0.4, 0.12, P.stone()), Math.cos(a) * 0.33, 0.2, Math.sin(a) * 0.33);
          st.rotation.y = -a + Math.PI / 2;
          well.add(st);
        }
        well.add(at(cyl(0.29, 0.29, 0.02, P.water(), 20), 0, 0.3, 0), shelter(0.85, 0.5, 0.95, wood('#3f7fc8', 42), 0.25));
        const crank = at(cyl(0.022, 0.022, 0.9, P.pole(), 6), 0, 0.78, 0);
        crank.rotation.z = Math.PI / 2;
        well.add(crank, at(cyl(0.07, 0.06, 0.1, P.plank(), 10), 0, 0.52, 0));
        out.push(['well', well, -0.52, 0, -0.5]);
      }
      if (stage >= 5) out.push(['barrel2', barrel(CREW.blue), 0.98, 0, -0.7]);
    }
    return out;
  },
  chest(t, stage) {
    const out = [];
    if (t >= 1 && stage >= 1) {
      // the boxes stacked neatly, a purple tarp over the top
      const g = new THREE.Group(), mk = (w, h, d) => box(w, h, d, P.plank());
      g.add(at(mk(0.38, 0.32, 0.38), -0.2, 0.16, 0), at(mk(0.38, 0.32, 0.38), 0.2, 0.16, 0.02));
      if (stage >= 6) g.add(at(mk(0.36, 0.3, 0.36), 0, 0.47, 0, 0.3));
      for (const c of g.children) c.add(new THREE.LineSegments(new THREE.EdgesGeometry(c.geometry), new THREE.LineBasicMaterial({ color: 0x5a3a20 })));
      const tarp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), cloth(CREW.purple));
      tarp.rotation.x = -Math.PI / 2;
      tarp.position.y = stage >= 6 ? 0.625 : 0.325;
      g.add(tarp);
      out.push([`stack${stage >= 6 ? 3 : 2}`, g, -0.3, 0, -0.2]);
    }
    if (t === 2 && stage >= 1) out.push(['shelter', shelter(1.5, 0.95, 1.15, striped('#ab70f0', '#f3e6c8', 8, 2), 0.3), 0, 0, -0.02]);
    if (t >= 3 && stage >= 1) {
      // a little shed: plank walls on three sides, a purple roof, a purple door left open, a coin sign
      const g = new THREE.Group(), w = 1.46, d = 0.9, h = 1.05;
      g.add(at(box(w, h, 0.05, P.plank()), 0, h / 2, -d / 2), at(box(0.05, h, d, P.plank()), -w / 2, h / 2, 0), at(box(0.05, h, d, P.plank()), w / 2, h / 2, 0));
      const door = at(box(0.48, 0.82, 0.04, std(CREW.purple)), -w / 2 + 0.05, 0.41, d / 2 + 0.2, -1.2);
      g.add(door, at(box(w * 0.5, 0.16, 0.04, P.plank()), w * 0.22, h - 0.08, d / 2), shelter(w, d, h, wood('#8e5cc0', 43), 0.3));
      g.add(at(grp(at(new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), std(0xf2c440, { metalness: 0.3, roughness: 0.3, emissive: 0x6a4a00, emissiveIntensity: 0.4 })), 0, 0, 0.03), at(box(0.32, 0.32, 0.03, P.plank()), 0, 0, 0)), w * 0.25, h + 0.1, d / 2 + 0.05));
      out.push(['shed', g, 0, 0, -0.05]);
    }
    return out;
  },
};
// the part's own pieces that give way to a tier (by their role, camp.js ROLE)
const GIVE = {
  water: (t) => (t >= 1 ? ['barrel'] : []),
  chest: (t) => (t >= 1 ? ['boxes'] : []),
  fire: (t) => (t >= 2 ? ['tripod'] : []),
};
export const dressFor = (kind, tier, stage, ctx) => (tier > 0 && DRESS[kind] ? DRESS[kind](tier, stage, ctx) : []);
export const givesWay = (kind, tier) => (GIVE[kind] ? GIVE[kind](tier) : []);
// the part's own materials a tier swaps (camp.js M by name -> the tier's)
export function swapsFor(kind, tier) {
  // (tier 2 brighter than the camp's own canvas, #d8893a, so the new canvas shows)
  if (kind === 'tent' && tier >= 2) return { canvas: tier === 3 ? striped('#ff9a2e', '#f6e8cc', 8, 1, false) : cloth('#ffa53a'), canvasDark: cloth('#f6e8cc') };
  if (kind === 'beds' && tier >= 1) return { blanket: plaid() };
  return {};
}
// the striped tent's flags along its ridge (from the back pole's top to the front's): its height and length from camp.js
export function ridgeFlags(p0, p1) {
  return flagLine(p0, p1, ['#ff9d2e', '#ffd23a', '#f6e8cc'], 7, 0.03);
}

// ---- the slots, round the fire: the string lights (behind the beds on two poles, then out to the tent and the workshop) and
// the camp flag (on the left pole). ends: (a, y, b) -> a point in the fire's frame ----
export function slotPieces(lights, flag, fire, toTent, toBench) {
  const out = [];
  const left = fire(2.45, 0, -1.95), right = fire(-2.45, 0, -1.95);
  if (lights >= 1 || flag) {
    for (const [k, p] of [[0, left], [1, right]]) {
      if (k === 1 && lights < 1) continue;
      const tall = k === 0 && flag ? 2.6 : 1.8;
      out.push([`pole${k}`, at(cyl(0.03, 0.036, tall, P.pole(), 8), p.x, p.y + tall / 2, p.z)]);
    }
  }
  if (lights >= 1) out.push(['lights', bulbs(left.clone().setY(left.y + 1.75), right.clone().setY(right.y + 1.75), 18, 0.35)]);
  if (lights >= 2) {
    if (toTent) out.push(['lightsT', bulbs(left.clone().setY(left.y + 1.75), toTent, 12, 0.3)]);
    if (toBench) out.push(['lightsB', bulbs(right.clone().setY(right.y + 1.75), toBench, 12, 0.3)]);
  }
  if (flag) {
    const f = at(box(0.75, 0.45, 0.015, std(0xffffff, { map: flagTex() })), left.x + 0.4, left.y + 2.32, left.z);
    out.push(['flag', f]);
  }
  return out;
}
let flagT = null;
function flagTex() {
  return (flagT ||= canvasTex(128, (g, s) => {
    ['#f05a3c', '#ff9d2e', '#ffd23a', '#5cc753', '#3f9cf0', '#ab70f0'].forEach((c, k) => ((g.fillStyle = c), g.fillRect(0, (k * s) / 6, s, s / 6 + 1)));
    g.fillStyle = '#fff6e2';
    g.beginPath();
    g.arc(s * 0.32, s * 0.5, s * 0.16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a2238';
    g.beginPath();
    g.arc(s * 0.38, s * 0.45, s * 0.13, 0, Math.PI * 2);
    g.fill();
  }));
}

// ---- the crews' tools (people.js): held in the right hand at the bottom of the handle, its head up; in the arm bone's units
// (a Kenney character is 0.68 tall). One for each trade: the fire keeper's axe, the carpenter's hammer, the tent maker's
// mallet, the water carrier's ladle, the storekeeper's big key, the bed maker's duster ----
export function makeTool(who, tier) {
  const metal = METAL[tier](), handle = wood('#a87240', 52), g = new THREE.Group();
  const shaft = (len, r = 0.015) => at(cyl(r, r * 1.12, len, handle, 8), 0, len / 2 - 0.04, 0);
  if (who === 'fire') g.add(shaft(0.34), at(box(0.11, 0.075, 0.022, metal), 0.05, 0.29, 0));
  else if (who === 'bench') g.add(shaft(0.26), at(box(0.12, 0.05, 0.05, metal), 0, 0.22, 0));
  else if (who === 'tent') {
    const head = at(cyl(0.05, 0.05, 0.13, wood('#c8a070', 53), 12), 0, 0.23, 0);
    head.rotation.z = Math.PI / 2;
    g.add(shaft(0.26), head);
    for (const x of [-0.05, 0.05]) {
      const band = at(cyl(0.053, 0.053, 0.014, metal, 12), x, 0.23, 0);
      band.rotation.z = Math.PI / 2;
      g.add(band);
    }
  } else if (who === 'water') g.add(shaft(0.3, 0.012), at(cyl(0.06, 0.045, 0.06, metal, 12), 0.03, 0.27, 0));
  else if (who === 'chest') {
    const ring = at(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 14), metal), 0, 0.02, 0);
    g.add(ring, at(cyl(0.013, 0.013, 0.22, metal, 6), 0, 0.15, 0), at(box(0.05, 0.035, 0.014, metal), 0.025, 0.24, 0), at(box(0.035, 0.03, 0.014, metal), 0.02, 0.19, 0));
  } else {
    // a feather duster: a handle and a puff
    g.add(shaft(0.24, 0.012));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, puff = at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std(['#f05a3c', '#ffd23a', '#f6ecd0'][k % 3])), Math.cos(a) * 0.035, 0.23 + (k % 2) * 0.02, Math.sin(a) * 0.035);
      g.add(puff);
    }
    g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std('#f6ecd0')), 0, 0.27, 0));
    // (its tip: the metal of its tier, a ferrule)
    g.add(at(cyl(0.017, 0.017, 0.03, metal, 8), 0, 0.19, 0));
  }
  g.traverse((m) => m.isMesh && (m.castShadow = true));
  return g;
}

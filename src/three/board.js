// The board in 3D: a wooden tray of sandy tiles on a slab of earth, rocks and stumps where a level has walls, painted supply
// crates with iron straps and their supply on the lid, and outside each gate its camp spot (the fire, the tent, the water
// barrel...) on a coloured mat between two flag posts. One cell is one unit; the board is centred on the origin, x to the right
// and z towards the viewer (a level's y).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from '../lib/rng.js';

export const GROUND = -0.32, CRATE_H = 0.56;

// colour: the paint, the flag, the stencil on the lid (what the camp builds from it: camp.js)
export const SUPPLY = {
  red: { paint: '#e0543a', flag: '#f05a3c', icon: 'flame', name: 'firewood' },
  orange: { paint: '#f0942e', flag: '#ff9d2e', icon: 'tent', name: 'canvas' },
  blue: { paint: '#3b8fde', flag: '#3f9cf0', icon: 'drop', name: 'water' },
  green: { paint: '#4fb048', flag: '#5cc753', icon: 'hammer', name: 'tools' },
  purple: { paint: '#9a63d8', flag: '#ab70f0', icon: 'gem', name: 'valuables' },
  yellow: { paint: '#f0c232', flag: '#ffd23a', icon: 'moon', name: 'bedding' },
};

// a model scaled so its footprint's longer side is `size`, sitting on y = 0 and centred, inside a holder group
export function fitted(model, size) {
  const holder = new THREE.Group(), box = new THREE.Box3().setFromObject(model), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x, -box.min.y, -c.z);
  holder.add(model);
  holder.scale.setScalar(size / Math.max(s.x, s.z, 1e-3));
  return holder;
}

const shadows = (o) => o.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));

export function buildBoard(scene, models, L, opts = {}) {
  const W = L.w, H = L.h, ox = -W / 2, oz = -H / 2, r = rng(L.seed || 1);
  const group = new THREE.Group();
  scene.add(group);
  const wood = woodMaterial('#9a6a3c', 11), woodDark = woodMaterial('#6e4826', 12);

  // the slab of earth under the tray and the tiles
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.5, 0.24, H + 0.5, 2, 0.06), new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 1 }));
  slab.position.y = GROUND + 0.12;
  slab.receiveShadow = true;
  group.add(slab);
  const tileGeo = new RoundedBoxGeometry(0.95, 0.12, 0.95, 2, 0.035), tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, W * H), m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = y * W + x;
      m4.makeTranslation(ox + x + 0.5, -0.06, oz + y + 0.5);
      tiles.setMatrixAt(k, m4);
      col.set('#dcc38e').offsetHSL((r.next() - 0.5) * 0.02, (r.next() - 0.5) * 0.06, (r.next() - 0.5) * 0.07);
      tiles.setColorAt(k, col);
    }
  }
  tiles.receiveShadow = true;
  group.add(tiles);

  // the frame: plank segments along each edge, left open where a gate is, posts at the corners
  const inGate = (side, k) => L.gates.some((g) => g.side === side && k >= g.at && k < g.at + g.len);
  const plankX = new RoundedBoxGeometry(1.01, 0.46, 0.24, 2, 0.05), plankZ = new RoundedBoxGeometry(0.24, 0.46, 1.01, 2, 0.05);
  const addPlank = (geo, x, z) => {
    const p = new THREE.Mesh(geo, r.next() < 0.5 ? wood : woodDark);
    p.position.set(x, GROUND + 0.23 + (r.next() - 0.5) * 0.02, z);
    p.rotation.y = (r.next() - 0.5) * 0.02;
    p.castShadow = p.receiveShadow = true;
    group.add(p);
  };
  for (let k = 0; k < W; k++) {
    if (!inGate('top', k)) addPlank(plankX, ox + k + 0.5, oz - 0.12);
    if (!inGate('bottom', k)) addPlank(plankX, ox + k + 0.5, oz + H + 0.12);
  }
  for (let k = 0; k < H; k++) {
    if (!inGate('left', k)) addPlank(plankZ, ox - 0.12, oz + k + 0.5);
    if (!inGate('right', k)) addPlank(plankZ, ox + W + 0.12, oz + k + 0.5);
  }
  const postGeo = new RoundedBoxGeometry(0.34, 0.62, 0.34, 2, 0.06);
  for (const [x, z] of [[ox - 0.12, oz - 0.12], [ox + W + 0.12, oz - 0.12], [ox - 0.12, oz + H + 0.12], [ox + W + 0.12, oz + H + 0.12]]) {
    const p = new THREE.Mesh(postGeo, woodDark);
    p.position.set(x, GROUND + 0.31, z);
    p.castShadow = p.receiveShadow = true;
    group.add(p);
  }

  // walls: rocks and stumps fitted to their cell
  const wallModels = ['Rock_Medium_1', 'stump_round', 'Rock_Medium_3', 'Rock_Medium_2', 'stump_old'];
  for (const [x, y] of L.walls) {
    const name = wallModels[(x * 7 + y * 3) % wallModels.length], m = models.get(name);
    if (!m) continue;
    const f = fitted(m, name.startsWith('stump') ? 0.7 : 0.92);
    f.position.set(ox + x + 0.5, 0, oz + y + 0.5);
    f.rotation.y = r.next() * Math.PI * 2;
    shadows(f);
    group.add(f);
  }

  // gates: the opening's two flag posts, a mat outside and the camp spot on it
  const spots = {}, flags = [], arches = [], doors = {};
  for (const g of L.gates) {
    const s = SUPPLY[g.color], out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] }[g.side];
    const along = g.side === 'top' || g.side === 'bottom';
    const mid = along ? [ox + g.at + g.len / 2, g.side === 'top' ? oz : oz + H] : [g.side === 'left' ? ox : ox + W, oz + g.at + g.len / 2];
    // the posts stand just outside the opening (a crate as wide as the gate passes between them)
    const ends = along ? [[ox + g.at - 0.17, mid[1]], [ox + g.at + g.len + 0.17, mid[1]]] : [[mid[0], oz + g.at - 0.17], [mid[0], oz + g.at + g.len + 0.17]];
    const paintPost = new THREE.MeshStandardMaterial({ color: s.flag, roughness: 0.6 });
    for (const [ex, ez] of ends) {
      // painted gate posts in the gate's colour, a pennant on each
      const post = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.8, 0.32, 2, 0.07), paintPost);
      post.position.set(ex + out[0] * 0.12, GROUND + 0.4, ez + out[1] * 0.12);
      post.castShadow = post.receiveShadow = true;
      group.add(post);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 8), woodDark);
      pole.position.set(post.position.x, GROUND + 1.2, post.position.z);
      pole.castShadow = true;
      group.add(pole);
      const flag = makeFlag(s.flag);
      flag.position.set(pole.position.x, GROUND + 1.48, pole.position.z);
      flag.rotation.y = -0.35;   // one wind for all, blowing to the right and a little towards the viewer: every flag shows its face
      group.add(flag);
      flags.push(flag);
    }
    // where the crates land and the gate's worker waits (no mat: the gate's colours say enough, Oleg 2026-10-24)
    const spotPos = new THREE.Vector3(mid[0] + out[0] * 1.4, GROUND, mid[1] + out[1] * 1.4);
    // which cells a gate covers (every playtester guessed it from the flags, 2026-10-24): Oleg's call, everything between the
    // flags in the gate's colour, the threshold in the frame's gap and the planks out of it, exactly the opening's width
    // (?gates=sill|arch|lane|none shows the options he was drawn)
    const paint = new THREE.MeshStandardMaterial({ color: s.flag, roughness: 0.55, emissive: s.flag, emissiveIntensity: 0.12 });
    const style = opts.gates || 'paint';
    const painted = style === 'paint';
    // a short path of planks out of the gate
    const path = new THREE.Mesh(new RoundedBoxGeometry(along ? g.len * (painted ? 1 : 0.9) : 0.9, 0.05, along ? 0.9 : g.len * (painted ? 1 : 0.9), 1, 0.02), woodMaterial(painted ? s.paint : '#a77b4a', 13));
    path.position.set(mid[0] + out[0] * 0.55, GROUND + 0.03, mid[1] + out[1] * 0.55);
    path.receiveShadow = true;
    group.add(path);
    if (style === 'sill' || painted) {
      // a painted threshold across the opening, exactly as wide as it
      const sill = (new THREE.Mesh(new RoundedBoxGeometry(along ? g.len - 0.04 : 0.26, 0.07, along ? 0.26 : g.len - 0.04, 1, 0.02), paint));
      sill.position.set(mid[0] + out[0] * 0.12, 0.0, mid[1] + out[1] * 0.12);
      sill.receiveShadow = true;
      group.add(sill);
    } else if (style === 'arch') {
      // a painted beam over the two posts, the opening's width, with the supply's sign on top: a doorway. It fades while a
      // crate is under it or held near it (on the near side it would hide the crate)
      const span = g.len + 0.34 + 0.32, signMat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(stencilCanvas(s.icon, false)), transparent: true, roughness: 0.8 });
      const signWood = woodMaterial('#c9a06a', 14).clone();
      const beam = new THREE.Mesh(new RoundedBoxGeometry(along ? span : 0.2, 0.18, along ? 0.2 : span, 2, 0.05), paint);
      beam.position.set(mid[0] + out[0] * 0.12, GROUND + 0.9, mid[1] + out[1] * 0.12);
      beam.castShadow = true;
      group.add(beam);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), signMat);
      const board2 = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.05, 1, 0.02), signWood);
      board2.position.set(beam.position.x, GROUND + 1.25, beam.position.z);
      board2.lookAt(board2.position.x, board2.position.y, board2.position.z + 10);   // faces the viewer
      sign.position.copy(board2.position).add(new THREE.Vector3(0, 0, 0.03));
      group.add(board2, sign);
      for (const m of [paint, signWood]) m.transparent = true;
      arches.push({ g, mats: [paint, signWood, signMat], fade: 1, at: new THREE.Vector3(mid[0], 0, mid[1]) });
    } else if (style === 'lane') {
      // the cells by the opening tinted in the gate's colour: the row (or column) a crate leaves from
      for (let k = g.at; k < g.at + g.len; k++) {
        const [x, y] = along ? [k, g.side === 'top' ? 0 : H - 1] : [g.side === 'left' ? 0 : W - 1, k];
        tiles.setColorAt(y * W + x, col.set('#dcc38e').lerp(new THREE.Color(s.flag), 0.75));
      }
      tiles.instanceColor.needsUpdate = true;
    }
    // a gate that closes at bedtime has a wooden gate leaf hinged on one of its posts, just outside them: swung open, it lies
    // folded back flat along the outside of the frame; its worker swings it shut across the opening (camp.js). (Pointing
    // straight out, the open leaf ran into the campfire, 2026-10-24.) It hinges on the post with room beside it: not across
    // another gate on that side, and if it can be helped, not out past the board's corner.
    if (g.closeAt != null) {
      const len = g.len + 0.34, pivot = new THREE.Group(), leaf = new THREE.Group(), span = along ? W : H;
      const others = L.gates.filter((o) => o !== g && o.side === g.side).map((o) => [o.at - 0.4, o.at + o.len + 0.4]);
      const cost = (a, b) => (others.some(([c, d]) => a < d && c < b) ? 2 : 0) + (a < -0.3 || b > span + 0.3 ? 1 : 0);
      const lo = g.at - 0.17, hi = g.at + g.len + 0.17, high = cost(hi, hi + len) < cost(lo - len, lo);
      const at = high ? hi : lo, OFF = 0.37;
      const hinge = along ? [ox + at + out[0] * OFF, mid[1] + out[1] * OFF] : [mid[0] + out[0] * OFF, oz + at + out[1] * OFF];
      pivot.position.set(hinge[0], GROUND, hinge[1]);
      // a picket gate, taller than a crate: upright pickets in dark wood on two rails, a top rail in the gate's colour (Oleg
      // dropped the cross brace and asked for the pickets in the darker tone)
      const dark = woodMaterial('#5a3a22', 16), band = new THREE.MeshStandardMaterial({ color: s.flag, roughness: 0.6 });
      const n = Math.max(3, Math.round(len / 0.17));
      for (let k = 0; k < n; k++) {
        const picket = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.86, 0.05, 1, 0.02), dark);
        picket.position.set((k + 0.5) * (len / n), 0.45 + (k % 2) * 0.03, 0);
        leaf.add(picket);
      }
      for (const y of [0.22, 0.62]) {
        const rail = new THREE.Mesh(new RoundedBoxGeometry(len, 0.08, 0.06, 1, 0.02), dark);
        rail.position.set(len / 2, y, 0.05);
        leaf.add(rail);
      }
      const cap = new THREE.Mesh(new RoundedBoxGeometry(len + 0.06, 0.09, 0.09, 1, 0.025), band);
      cap.position.set(len / 2, 0.92, 0);
      leaf.add(cap);
      leaf.traverse((m) => m.isMesh && (m.castShadow = m.receiveShadow = true));
      pivot.add(leaf);
      group.add(pivot);
      // its turn about the hinge: shut, along the opening; open, folded back the other way, swinging through pointing out of
      // the board (never across it)
      const outward = { top: Math.PI / 2, bottom: -Math.PI / 2, left: -Math.PI, right: 0 }[g.side];
      const shut = (along ? 0 : -Math.PI / 2) + (high ? Math.PI : 0), open = 2 * outward - shut;
      const door = { pivot, shut, open, k: 0, len, out, hinge: new THREE.Vector3(hinge[0], GROUND, hinge[1]) };
      // where a worker stands to push it: by its free end, outside the board
      door.handle = (k) => {
        const a = open + (shut - open) * k;
        return door.hinge.clone().add(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(len * 0.85)).add(new THREE.Vector3(out[0], 0, out[1]).multiplyScalar(0.35));
      };
      // its top rail takes the gate's colour only as it shuts: folded open along the frame, a coloured rail read as part of
      // the gate's opening (playtest 2026-10-24, Ruth)
      const railOpen = new THREE.Color('#5a3a22'), railShut = new THREE.Color(s.flag);
      door.set = (k) => {
        door.k = k;
        pivot.rotation.y = open + (shut - open) * k;
        band.color.copy(railOpen).lerp(railShut, k);
      };
      door.set(0);
      doors[g.color] = door;
    }
    // the gate's mat is where its crates land and its worker waits (the camp itself is built round the board: camp.js)
    if (!spots[g.color]) spots[g.color] = { pos: spotPos, gateMid: new THREE.Vector3(mid[0], 0, mid[1]), out: new THREE.Vector3(out[0], 0, out[1]), side: new THREE.Vector3(-out[1], 0, out[0]), total: 0, got: 0 };
  }
  for (const b of L.blocks) if (spots[b.color]) spots[b.color].total++;

  // while a crate is held, its gate's lane lights up: a band across the board exactly the gate's width, brightest at the
  // gate, its edges drawn, over the crates in it, so which rows (or columns) lead out reads at a glance (playtest
  // 2026-10-24: all four players misread which rows a gate covers; tinted cells alone were hidden under the crates)
  const fade = (() => {
    const cv = document.createElement('canvas');
    cv.width = 4;
    cv.height = 64;
    const g = cv.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.35, '#888');
    grad.addColorStop(1, '#222');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const lanes = {};
  for (const g of L.gates) {
    const along = g.side === 'top' || g.side === 'bottom', wide = g.len, long = along ? H : W;
    const color = SUPPLY[g.color].flag, lane = new THREE.Group();
    const fill = new THREE.MeshBasicMaterial({ color, alphaMap: fade, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    // laid out with the gate at local -z: the alpha map's bright end (v = 1) there
    const band = new THREE.Mesh(new THREE.PlaneGeometry(wide - 0.06, long).rotateX(-Math.PI / 2), fill);
    lane.add(band);
    for (const sx of [-1, 1]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, long).rotateX(-Math.PI / 2), edge);
      line.position.x = sx * (wide / 2 - 0.03);
      lane.add(line);
    }
    lane.rotation.y = { top: 0, bottom: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[g.side];
    lane.position.set(along ? ox + g.at + wide / 2 : 0, 0.03, along ? 0 : oz + g.at + wide / 2);
    lane.traverse((m) => m.isMesh && (m.renderOrder = 3));
    group.add(lane);
    (lanes[g.color] ||= []).push({ mats: [fill, edge], k: 0 });
  }
  // what stops a dragged crate flashes red for a moment: the cells of what blocks it, or the frame beside it
  const flashes = [], flashMat = () => new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  function flash(cells) {
    for (const [x, y] of cells) {
      let f = flashes.find((o) => o.t <= 0);
      if (!f) {
        f = { mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), flashMat()), t: 0 };
        f.mesh.renderOrder = 4;   // over the rock or crate it marks
        group.add(f.mesh);
        flashes.push(f);
      }
      const inside = x >= 0 && y >= 0 && x < W && y < H;
      if (inside) {
        f.mesh.scale.set(1, 1, 1);
        f.mesh.position.set(ox + x + 0.5, 0.03, oz + y + 0.5);
      } else {
        // the frame: a strip along the edge beside the crate
        const side = x < 0 || x >= W;
        f.mesh.scale.set(side ? 0.3 : 1, 1, side ? 1 : 0.3);
        f.mesh.position.set(side ? (x < 0 ? ox - 0.12 : ox + W + 0.12) : ox + x + 0.5, GROUND + 0.48, side ? oz + y + 0.5 : y < 0 ? oz - 0.12 : oz + H + 0.12);
      }
      f.t = 0.55;
    }
  }
  // each frame: the held crate's colour (or null) lights its gate's lane
  function tick(dt, t, lit) {
    for (const [color, list] of Object.entries(lanes)) {
      for (const lane of list) {
        lane.k += ((color === lit ? 1 : 0) - lane.k) * Math.min(1, dt * 10);
        const pulse = 0.85 + Math.sin(t * 6) * 0.15;
        lane.mats[0].opacity = lane.k * 0.7 * pulse;
        lane.mats[1].opacity = lane.k * 0.9;
      }
    }
    for (const f of flashes) {
      if (f.t <= 0) continue;
      f.t -= dt;
      f.mesh.material.opacity = Math.max(0, f.t / 0.55) * 0.6;
    }
  }

  return { group, spots, flags, arches, doors, ox, oz, W, H, flash, tick, center: (x, y, w, h) => new THREE.Vector3(ox + x + w / 2, 0, oz + y + h / 2) };
}

export function buildCrate(models, b) {
  const s = SUPPLY[b.color], g = new THREE.Group(), body = new THREE.Group();
  const w = b.w - 0.12, d = b.h - 0.12;
  const mat = crateMaterial(s.paint, b.w >= b.h);
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, CRATE_H, d, 3, 0.07), mat);
  box.position.y = CRATE_H / 2;
  body.add(box);
  // iron straps across the short way, near each end
  const strap = new THREE.MeshStandardMaterial({ color: 0x3c3a3a, roughness: 0.45, metalness: 0.7 });
  const long = Math.max(w, d), across = b.w >= b.h;
  for (const k of [-1, 1]) {
    const off = k * (long / 2 - Math.min(0.2, long * 0.18));
    const st = new THREE.Mesh(new RoundedBoxGeometry(across ? 0.07 : w + 0.03, CRATE_H + 0.03, across ? d + 0.03 : 0.07, 1, 0.015), strap);
    st.position.set(across ? off : 0, CRATE_H / 2, across ? 0 : off);
    body.add(st);
  }
  shadows(body);
  // what it carries, stencilled on the lid (a flame, a tent, a drop of water...)
  const size = Math.min(0.62, Math.min(w, d) * 0.72), decal = new THREE.Mesh(new THREE.PlaneGeometry(size, size), stencilMaterial(s.icon));
  decal.rotation.x = -Math.PI / 2;
  decal.position.y = CRATE_H + 0.004;
  body.add(decal);
  g.add(body);
  return { group: g, body };
}

// a pennant on a short spar: its tip waves (vertices moved each frame in wave())
function makeFlag(color) {
  const geo = new THREE.PlaneGeometry(0.6, 0.36, 8, 1);
  geo.translate(0.3, 0, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / 0.6;
    pos.setY(i, pos.getY(i) * (1 - u * 0.85));   // a pennant: narrowing to the tip
  }
  geo.userData.rest = Float32Array.from(pos.array);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.9 }));
  m.castShadow = true;
  m.userData.phase = Math.random() * 6;
  return m;
}

export function waveFlags(flags, t) {
  for (const f of flags) {
    const pos = f.geometry.attributes.position, rest = f.geometry.userData.rest;
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3], u = x / 0.6;
      pos.setZ(i, Math.sin(t * 5 + f.userData.phase - u * 4) * 0.06 * u);
      pos.setY(i, rest[i * 3 + 1] + Math.sin(t * 3.3 + f.userData.phase - u * 3) * 0.02 * u);
    }
    pos.needsUpdate = true;
    f.geometry.computeVertexNormals();
  }
}

// flames (three cones of glowing colour) and a warm light over the fire pit; size 0..1 grows as firewood arrives
export function makeFire(group, at) {
  const g = new THREE.Group();
  g.position.set(at.x, GROUND + 0.08, at.z);
  const cones = [['#ff6a1a', 0.2, 0.62], ['#ffa62b', 0.14, 0.48], ['#fff1a8', 0.07, 0.3]].map(([c, rad, h], k) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 10, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 - k * 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = h / 2;
    m.userData.h = h;
    g.add(m);
    return m;
  });
  const light = new THREE.PointLight(0xff9a40, 4, 9, 1.6);
  light.position.set(0, 0.6, 0);
  g.add(light);
  group.add(g);
  return { group: g, cones, light, size: 0.25 };
}

export function flickerFire(fire, t, dusk) {
  const s = 0.45 + fire.size * 0.75;
  fire.cones.forEach((c, k) => {
    const f = 1 + Math.sin(t * (11 + k * 3) + k) * 0.12 + Math.sin(t * 23 + k * 2) * 0.06;
    c.scale.set(s * (1 + Math.sin(t * 7 + k) * 0.05), s * f, s * (1 + Math.cos(t * 6 + k) * 0.05));
    c.position.y = (c.userData.h * s * f) / 2;
    c.rotation.y = t * (0.6 + k * 0.4);
  });
  fire.light.intensity = (1.5 + fire.size * 3.5) * (0.35 + dusk * 1.4) * (1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 29) * 0.05);
  fire.light.distance = 5 + fire.size * 6;
}

export function canvasTex(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// a stencil in cream paint, a little worn: what the crate carries (also drawn on the how-to card's legend)
const stencils = {};
function stencilMaterial(icon) {
  if (stencils[icon]) return stencils[icon];
  const cv = stencilCanvas(icon), map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return (stencils[icon] = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
}

export function stencilCanvas(icon, worn = true) {
  const r = rng(icon.length * 17), cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  ((g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,246,226,0.92)';
    g.strokeStyle = 'rgba(255,246,226,0.92)';
    g.lineCap = g.lineJoin = 'round';
    g.save();
    g.translate(s / 2, s / 2);
    g.beginPath();
    if (icon === 'flame') {
      g.moveTo(0, -96);
      g.bezierCurveTo(30, -50, 78, -20, 70, 30);
      g.bezierCurveTo(64, 78, 28, 96, 0, 96);
      g.bezierCurveTo(-28, 96, -64, 78, -70, 30);
      g.bezierCurveTo(-74, -6, -40, -20, -36, -54);
      g.bezierCurveTo(-14, -34, -6, -60, 0, -96);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.moveTo(0, 6);
      g.bezierCurveTo(22, 30, 34, 50, 26, 70);
      g.bezierCurveTo(18, 86, -18, 86, -26, 70);
      g.bezierCurveTo(-34, 50, -14, 34, 0, 6);
      g.fill();
    } else if (icon === 'tent') {
      g.moveTo(0, -84);
      g.lineTo(96, 80);
      g.lineTo(-96, 80);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(30, 80);
      g.lineTo(-30, 80);
      g.closePath();
      g.fill();
    } else if (icon === 'drop') {
      g.moveTo(0, -100);
      g.bezierCurveTo(30, -50, 76, -4, 76, 34);
      g.arc(0, 34, 76, 0, Math.PI);
      g.bezierCurveTo(-76, -4, -30, -50, 0, -100);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(0, 34, 46, Math.PI * 0.95, Math.PI * 1.35);
      g.stroke();
    } else if (icon === 'hammer') {
      g.rotate(-0.6);
      g.fillRect(-14, -50, 28, 150);
      g.beginPath();
      g.moveTo(-74, -96);
      g.lineTo(60, -96);
      g.lineTo(78, -76);
      g.lineTo(60, -42);
      g.lineTo(-74, -42);
      g.closePath();
      g.fill();
    } else if (icon === 'gem') {
      g.moveTo(-90, -30);
      g.lineTo(-48, -84);
      g.lineTo(48, -84);
      g.lineTo(90, -30);
      g.lineTo(0, 96);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(-90, -30);
      g.lineTo(90, -30);
      g.moveTo(-26, -84);
      g.lineTo(-44, -30);
      g.lineTo(0, 92);
      g.lineTo(44, -30);
      g.lineTo(26, -84);
      g.stroke();
    } else if (icon === 'moon') {
      g.arc(0, 0, 92, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(44, -30, 80, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // wear: paint missing in specks
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; worn && k < 260; k++) {
      g.fillStyle = `rgba(0,0,0,${0.3 + r.next() * 0.7})`;
      g.beginPath();
      g.arc(r.next() * s, r.next() * s, 0.8 + r.next() * 2.6, 0, Math.PI * 2);
      g.fill();
    }
  })(cv.getContext('2d'), 256);
  return cv;
}

// plain wood with grain streaks
export function woodMaterial(base, seed) {
  const r = rng(seed);
  const map = canvasTex(256, (g, s) => {
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);
    for (let k = 0; k < 70; k++) {
      g.strokeStyle = r.next() < 0.5 ? 'rgba(60,35,15,0.18)' : 'rgba(255,230,190,0.12)';
      g.lineWidth = 1 + r.next() * 2;
      const y = r.next() * s;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + k) * 3);
      g.stroke();
    }
  });
  return new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
}

// a painted plank crate: four planks with dark grooves, worn paint showing the wood at the edges
const crateMats = {};
function crateMaterial(paint, alongX) {
  const key = paint + alongX;
  if (crateMats[key]) return crateMats[key];
  const r = rng(paint.length * 31 + (alongX ? 1 : 2));
  const map = canvasTex(256, (g, s) => {
    g.fillStyle = paint;
    g.fillRect(0, 0, s, s);
    const planks = 4, ph = s / planks;
    for (let p = 0; p < planks; p++) {
      const shade = (r.next() - 0.5) * 0.18;
      g.fillStyle = shade > 0 ? `rgba(255,240,210,${shade})` : `rgba(40,20,10,${-shade})`;
      g.fillRect(0, p * ph, s, ph);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = r.next() < 0.5 ? 'rgba(50,25,10,0.16)' : 'rgba(255,235,200,0.12)';
        g.lineWidth = 1 + r.next() * 1.5;
        const y = p * ph + 4 + r.next() * (ph - 8);
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.04 + k + p) * 1.5);
        g.stroke();
      }
      g.fillStyle = 'rgba(35,18,8,0.4)';
      g.fillRect(0, p * ph - 2, s, 4);
    }
    // worn edges
    const edge = g.createLinearGradient(0, 0, s, 0);
    edge.addColorStop(0, 'rgba(60,35,15,0.35)');
    edge.addColorStop(0.08, 'rgba(60,35,15,0)');
    edge.addColorStop(0.92, 'rgba(60,35,15,0)');
    edge.addColorStop(1, 'rgba(60,35,15,0.35)');
    g.fillStyle = edge;
    g.fillRect(0, 0, s, s);
  });
  if (!alongX) {
    map.center.set(0.5, 0.5);
    map.rotation = Math.PI / 2;
  }
  return (crateMats[key] = new THREE.MeshStandardMaterial({ map, roughness: 0.7 }));
}

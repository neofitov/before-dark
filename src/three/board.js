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

// which model stands on a wall cell (the same for every level): a rock or a stump; main.js names it when it stops a crate
const WALL_MODELS = ['Rock_Medium_1', 'stump_round', 'Rock_Medium_3', 'Rock_Medium_2', 'stump_old'];
export const wallModel = (x, y) => WALL_MODELS[(x * 7 + y * 3) % WALL_MODELS.length];

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
      // a rock's or stump's cell is bare dark earth, so blocked cells read at a glance on a big board (benchmark 2026-10-28);
      // the pond's cells have water instead of a tile
      const wall = L.walls.some(([wx, wy]) => wx === x && wy === y), wet = (L.pond || []).some(([px, py]) => px === x && py === y);
      if (wet) m4.makeScale(0.001, 0.001, 0.001).setPosition(ox + x + 0.5, -0.2, oz + y + 0.5);
      tiles.setMatrixAt(k, m4);
      col.set(wall ? '#7a5c3a' : '#dcc38e').offsetHSL((r.next() - 0.5) * 0.02, (r.next() - 0.5) * 0.06, (r.next() - 0.5) * 0.07);
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

  // a pond in a corner (2026-10-28, odd boards): water where its tiles would be, lily pads, reeds along its edges
  if (L.pond) addPond(group, L.pond, ox, oz, r);

  // walls: rocks and stumps fitted to their cell (stumps bigger since the playtest of 2026-11-07: hard to see in the dirt)
  for (const [x, y] of L.walls) {
    if ((L.pond || []).some(([px, py]) => px === x && py === y)) continue;
    const name = wallModel(x, y), m = models.get(name);
    if (!m) continue;
    const f = fitted(m, name.startsWith('stump') ? 0.82 : 0.92);
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
    // a gate on the far side has taller poles: its banner hangs under the flags (below)
    const far = g.side === 'top', poleLen = far ? 1.35 : 0.9;
    for (const [ex, ez] of ends) {
      // gate posts in dark wood, a pennant on each: the gate's colour marks only the opening itself (playtest 2026-10-29:
      // posts painted in it, outside the opening, made a gate look a cell wider than it is)
      const post = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.8, 0.32, 2, 0.07), woodDark);
      post.position.set(ex + out[0] * 0.12, GROUND + 0.4, ez + out[1] * 0.12);
      post.castShadow = post.receiveShadow = true;
      group.add(post);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, poleLen, 8), woodDark);
      pole.position.set(post.position.x, GROUND + 0.75 + poleLen / 2, post.position.z);
      pole.castShadow = true;
      group.add(pole);
      const flag = makeFlag(s.flag);
      flag.position.set(pole.position.x, GROUND + 0.58 + poleLen, pole.position.z);
      flag.rotation.y = -0.35;   // one wind for all, blowing to the right and a little towards the viewer: every flag shows its face
      group.add(flag);
      flags.push(flag);
    }
    // a gate on the far side carries a banner (playtest 2026-10-29: a crate on the top row hid the threshold and the paint of
    // the gate behind it, and three of five players planned on a gate they could not see): the supply's sign on a board exactly
    // the opening's width, standing on a rod between the poles higher than a crate and leaning back, away from the board, to
    // face the camera. From the camera it shows over the crates in front of it; behind them, it never covers one.
    if (far) {
      const h = 0.55, cv = document.createElement('canvas'), px = 128;
      cv.width = Math.round(px * g.len);
      cv.height = Math.round(px * h);
      const c2 = cv.getContext('2d'), hem = 8, ic = (cv.height - hem) * 0.8;
      c2.fillStyle = s.flag;
      c2.fillRect(0, 0, cv.width, cv.height);
      c2.fillStyle = 'rgba(0, 0, 0, 0.22)';
      c2.fillRect(0, cv.height - hem, cv.width, hem);
      c2.strokeStyle = 'rgba(255, 246, 226, 0.6)';
      c2.lineWidth = 4;
      c2.strokeRect(7, 6, cv.width - 14, cv.height - hem - 12);
      c2.drawImage(stencilCanvas(s.icon, false), (cv.width - ic) / 2, (cv.height - hem - ic) / 2, ic, ic);
      const map = new THREE.CanvasTexture(cv);
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
      const rodY = GROUND + 1.17, banner = new THREE.Group();
      banner.position.set(mid[0], rodY, mid[1] - 0.12);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(g.len - 0.04, h).translate(0, h / 2, 0), new THREE.MeshStandardMaterial({ map, roughness: 0.85, side: THREE.DoubleSide, emissive: s.flag, emissiveIntensity: 0.15 }));
      cloth.rotation.x = -0.9;   // its top leaning back, away from the board: it faces up to the camera
      cloth.castShadow = true;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, g.len + 0.34, 8).rotateZ(Math.PI / 2), woodDark);
      rod.castShadow = true;
      banner.add(cloth, rod);
      group.add(banner);
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
    // A crew back late (2026-10-28) has the same leaf, shut until its worker comes back and swings it open.
    if (g.closeAt != null || g.openAt != null) {
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
      // (the half turn the short way: unwrapped, a bottom or left gate hinged on its far post swung 540 degrees, spinning a
      // full turn through the board as it shut, Oleg 2026-11-07)
      const shut = (along ? 0 : -Math.PI / 2) + (high ? Math.PI : 0), turnOut = Math.atan2(Math.sin(outward - shut), Math.cos(outward - shut)), open = shut + 2 * turnOut;
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
      door.set(g.openAt != null ? 1 : 0);
      doors[g.color] = door;
    }
    // the gate's mat is where its crates land and its worker waits (the camp itself is built round the board: camp.js)
    if (!spots[g.color]) spots[g.color] = { pos: spotPos, gateMid: new THREE.Vector3(mid[0], 0, mid[1]), out: new THREE.Vector3(out[0], 0, out[1]), side: new THREE.Vector3(-out[1], 0, out[0]), len: g.len, total: 0, got: 0 };
  }
  for (const b of L.blocks) if (spots[b.color]) spots[b.color].total++;

  // while a crate is held, its gate's lane lights up: a band across the board exactly the gate's width, brightest at the
  // gate, its edges drawn, so which rows (or columns) lead out reads at a glance (playtest 2026-10-24: all four players
  // misread which rows a gate covers). It lies on the floor, under the crates in it: gate marks never hide a crate (Oleg,
  // 2026-10-29)
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
    const fill = new THREE.MeshBasicMaterial({ color, alphaMap: fade, transparent: true, opacity: 0, depthWrite: false });
    const edge = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35), transparent: true, opacity: 0, depthWrite: false });
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
      f.t = 0.9;
    }
  }
  // the held crate's footprint where it would land if let go now (playtest 2026-11-07: in perspective a crate behind another
  // read a cell narrower, a 2-wide red as 1-wide; Ruth, Maya): a soft shadow on the tiles, the crate's own size, as if it were
  // held over the spot (2026-11-09, Oleg: a drop shadow, not the white outline it was)
  const markMat = new THREE.MeshBasicMaterial({ map: footShadow(1, 1), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), markMat);
  marker.renderOrder = 5;
  marker.visible = false;
  group.add(marker);
  let markK = 0, markOn = false;
  function mark(at) {
    markOn = !!at;
    if (!at) return;
    const [x, y, w, h] = at;
    markMat.map = footShadow(w, h);
    marker.scale.set(w + SHADOW_M * 2, 1, h + SHADOW_M * 2);
    marker.position.set(ox + x + w / 2, 0.004, oz + y + h / 2);
  }
  // a heavy crate picked up (or pulled across its skids): arrows on the ground beyond both its ends, the way the skids let it
  // slide, blinking a few times and chasing outwards, then gone (2026-11-09, Oleg: the arrows fixed on the lid looked dull;
  // shown on the ground when it is picked up instead). way({ x, z, w, h, axis, age }) each frame, x and z the crate's middle.
  const chevron = (L0, A, T) => new THREE.ShapeGeometry(new THREE.Shape([[L0, 0], [L0 - A, A], [L0 - A - T, A], [L0 - T, 0], [L0 - A - T, -A], [L0 - A, -A]].map(([x, y]) => new THREE.Vector2(x, y)))).rotateX(-Math.PI / 2);
  const fillGeo = chevron(0.13, 0.2, 0.13), rimGeo = chevron(0.18, 0.25, 0.22);
  const wayMats = [0, 1].map(() => ({
    fill: new THREE.MeshBasicMaterial({ color: 0xfff4dc, transparent: true, opacity: 0, depthWrite: false }),
    rim: new THREE.MeshBasicMaterial({ color: 0x2a1a0e, transparent: true, opacity: 0, depthWrite: false }),
  }));
  const ways = [-1, 1].map(() => {
    const side = new THREE.Group();
    side.userData.chev = wayMats.map((m) => {
      const c = new THREE.Group(), rim = new THREE.Mesh(rimGeo, m.rim), fill = new THREE.Mesh(fillGeo, m.fill);
      rim.position.y = 0.012;
      fill.position.y = 0.016;
      rim.renderOrder = 7;
      fill.renderOrder = 8;
      c.add(rim, fill);
      side.add(c);
      return c;
    });
    side.visible = false;
    group.add(side);
    return side;
  });
  const WAY_T = 1.9;
  function way(at) {
    const on = !!at && at.age < WAY_T;
    for (const s of ways) s.visible = on;
    if (!on) return;
    const { x, z, w, h, axis, age } = at, ax = axis === 'x', half = (ax ? w : h) / 2;
    const env = Math.min(1, age / 0.12) * Math.min(1, (WAY_T - age) / 0.45);
    ways.forEach((s, n) => {
      const e = n ? 1 : -1;
      s.position.set(x + (ax ? e * (half + 0.42) : 0), 0, z + (ax ? 0 : e * (half + 0.42)));
      s.rotation.y = ax ? (e > 0 ? 0 : Math.PI) : e > 0 ? -Math.PI / 2 : Math.PI / 2;
      s.userData.chev.forEach((c, k) => {
        // three blinks; the outer chevron a beat after the inner, so they run outwards
        const p = Math.max(0, Math.sin((age * 1.65 - k * 0.17) * Math.PI * 2));
        c.position.x = k * 0.32 + p * 0.06;
        // only on the tiles or out through a gate (not over the frame's planks)
        const reach = e * (half + 0.42 + k * 0.32), cx = x + (ax ? reach : 0), cz = z + (ax ? 0 : reach);
        const inX = cx > ox && cx < ox + W, inZ = cz > oz && cz < oz + H;
        c.visible = inX && inZ ? true
          : inX ? inGate(cz < oz ? 'top' : 'bottom', Math.floor(cx - ox))
          : inZ ? inGate(cx < ox ? 'left' : 'right', Math.floor(cz - oz)) : false;
      });
    });
    wayMats.forEach((m, k) => {
      const p = Math.max(0, Math.sin((age * 1.65 - k * 0.17) * Math.PI * 2));
      m.fill.opacity = env * (0.3 + 0.7 * p);
      m.rim.opacity = env * (0.15 + 0.4 * p);
    });
  }
  // each frame: the held crate's colour (or null) lights its gate's lane
  function tick(dt, t, lit) {
    markK += ((markOn ? 1 : 0) - markK) * Math.min(1, dt * 14);
    marker.visible = markK > 0.02;
    markMat.opacity = markK * 0.85;
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
      f.mesh.material.opacity = Math.max(0, f.t / 0.9) * 0.75;
    }
  }

  return { group, spots, flags, arches, doors, ox, oz, W, H, flash, tick, mark, way, center: (x, y, w, h) => new THREE.Vector3(ox + x + w / 2, 0, oz + y + h / 2) };
}

// a soft shadow the shape of a w x h crate's footprint (in cells; a crate stands 0.06 in from its cells' edges), fading out
// over its edge, on a texture SHADOW_M wider each side than the cells; one per size, made once
const SHADOW_M = 0.25, shadowTex = new Map();
function footShadow(w, h) {
  const key = `${w}x${h}`;
  if (shadowTex.has(key)) return shadowTex.get(key);
  const px = 40, cw = Math.round((w + SHADOW_M * 2) * px), ch = Math.round((h + SHADOW_M * 2) * px);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(cw, ch);
  const hw = w / 2 - 0.08, hh = h / 2 - 0.08, r = 0.12, soft = 0.24;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const x = Math.abs((i + 0.5) / px - cw / px / 2), y = Math.abs((j + 0.5) / px - ch / px / 2);
      // the distance to the rounded rectangle's edge (negative inside), then a smooth fall from 1 well inside to 0 outside
      const qx = x - (hw - r), qy = y - (hh - r);
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      const u = Math.min(1, Math.max(0, (soft * 0.4 - d) / soft)), k = (j * cw + i) * 4;
      img.data[k] = 22;
      img.data[k + 1] = 14;
      img.data[k + 2] = 8;
      img.data[k + 3] = Math.round(u * u * (3 - 2 * u) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  shadowTex.set(key, tex);
  return tex;
}

// opts: key (this crate holds the key to a padlocked one), lockColor (padlocked: the colour of the crate with its key), mark
// (a level with two padlocks or more: the number a lock and its key both carry)
export function buildCrate(models, b, opts = {}) {
  const s = SUPPLY[b.color], g = new THREE.Group(), body = new THREE.Group();
  const w = b.w - 0.12, d = b.h - 0.12;
  const mat = crateMaterial(s.paint, b.w >= b.h);
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, CRATE_H, d, 3, 0.07), mat);
  box.position.y = CRATE_H / 2;
  body.add(box);
  // iron straps across the short way, near each end (not on a heavy crate: a plain crate's dark end straps read as a heavy
  // one's arrows, playtest 2026-11-09, Leo; a heavy crate is told by its skids)
  const strap = new THREE.MeshStandardMaterial({ color: 0x3c3a3a, roughness: 0.45, metalness: 0.7 });
  const long = Math.max(w, d), across = b.w >= b.h;
  for (const k of b.axis ? [] : [-1, 1]) {
    const off = k * (long / 2 - Math.min(0.2, long * 0.18));
    const st = new THREE.Mesh(new RoundedBoxGeometry(across ? 0.07 : w + 0.03, CRATE_H + 0.03, across ? d + 0.03 : 0.07, 1, 0.015), strap);
    st.position.set(across ? off : 0, CRATE_H / 2, across ? 0 : off);
    body.add(st);
  }
  shadows(body);
  // what it carries, stencilled on the lid (a flame, a tent, a drop of water...); a long load at both ends
  // (a key crate two cells or more long: the stencil at one end, the key's badge at the other)
  const size = Math.min(0.62, Math.min(w, d) * 0.72);
  const ends = long >= 3.5 ? [-0.95, 0.95] : opts.key && long >= 1.5 ? [-(long / 2 - size / 2 - 0.1)] : [0];
  for (const e of ends) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(size, size), stencilMaterial(s.icon));
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(across ? e : 0, CRATE_H + 0.004, across ? 0 : e);
    body.add(decal);
  }
  const out = { group: g, body };
  // heavy, on runners (2026-10-28): two iron-shod skids along the way it slides, turned up at the ends. Since 2026-11-09
  // (Oleg: "make the rails slightly bigger") chunkier, standing out along its sides with their turned-up ends past its ends.
  // The arrows that were on its lid are gone (Oleg, the same day): arrows on the ground blink when it is picked up (board.way)
  if (b.axis) {
    const ax = b.axis === 'x', runLen = (ax ? w : d) + 0.42, spread = (ax ? d : w) / 2 - 0.01;
    const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a2a, roughness: 0.38, metalness: 0.85 });
    for (const k of [-1, 1]) {
      const skid = new THREE.Mesh(new RoundedBoxGeometry(ax ? runLen : 0.14, 0.12, ax ? 0.14 : runLen, 2, 0.035), iron);
      skid.position.set(ax ? 0 : k * spread, 0.06, ax ? k * spread : 0);
      body.add(skid);
      for (const e of [-1, 1]) {
        const tip = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.36, 0.14, 2, 0.035), iron);
        tip.position.set(ax ? e * (runLen / 2 + 0.03) : k * spread, 0.17, ax ? k * spread : e * (runLen / 2 + 0.03));
        tip.rotation[ax ? 'z' : 'x'] = (ax ? -e : e) * 0.6;
        body.add(tip);
      }
    }
    shadows(body);
  }
  // padlocked: chains crossing the lid and down the sides, a padlock on the front in the colour of the crate with its key
  if (opts.lockColor) {
    const lock = new THREE.Group(), chain = new THREE.MeshStandardMaterial({ color: 0x8a8c90, roughness: 0.35, metalness: 0.85 });
    // (thin, and the padlock at the lid's front edge: the chains and a padlock in the lid's middle hid the crate's own colour,
    // playtest 2026-11-09, Maya and Dan, levels 14 and 19)
    for (const [lw, ld] of [[w + 0.05, 0.07], [0.07, d + 0.05]]) {
      const band = new THREE.Mesh(new RoundedBoxGeometry(lw, CRATE_H + 0.05, ld, 1, 0.03), chain);
      band.position.y = CRATE_H / 2 + 0.01;
      lock.add(band);
    }
    const tint = new THREE.MeshStandardMaterial({ color: SUPPLY[opts.lockColor].paint, roughness: 0.35, metalness: 0.5 });
    const padlock = new THREE.Group();
    const lockBody = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.22, 0.09, 2, 0.03), tint);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 16, Math.PI), chain);
    shackle.position.y = 0.11;
    // its keyhole, or (more than one padlock) its number in the keyhole's place
    const hole = opts.mark ? new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), digitMaterial(opts.mark)) : new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: 0x1a1414 }));
    hole.position.set(0, opts.mark ? -0.005 : -0.02, 0.047);
    padlock.add(lockBody, shackle, hole);
    // hanging on the chain at the lid's front edge, tipped to face the camera, big enough to read from it
    padlock.position.set(0, CRATE_H + 0.12, d / 2 - 0.08);
    padlock.rotation.x = -0.45;
    padlock.scale.setScalar(1.9);
    lock.add(padlock);
    lock.traverse((m) => m.isMesh && (m.castShadow = true));
    body.add(lock);
    out.lock = lock;
  }
  // the key to a padlocked crate, lying gold on the lid
  if (opts.key) {
    // a chunky gold key, tipped up towards the camera like the padlock, that glints now and then (main.js updateCrate): big
    // enough to find (playtest 2026-11-09, Jonas, Dan, Ruth), and solid metal rather than on a cream badge (Oleg, 2026-11-09:
    // the badge looked apart from the game's look)
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c440, roughness: 0.22, metalness: 0.9, emissive: 0x7a5200, emissiveIntensity: 0.3 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a2a, roughness: 0.4, metalness: 0.8 });
    const key = new THREE.Group(), bow = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.038, 12, 24), gold);
    bow.rotation.x = Math.PI / 2;
    bow.position.x = -0.17;
    // a little iron ring through the bow: a dark line that keeps the key apart from a yellow lid
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 18), iron);
    loop.position.set(-0.26, 0, 0);
    loop.rotation.y = Math.PI / 2;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14).rotateZ(Math.PI / 2), gold);
    collar.position.x = -0.06;
    const shaft = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.065, 0.065, 2, 0.02), gold);
    shaft.position.x = 0.07;
    key.add(bow, loop, collar, shaft);
    for (const [x, l] of [[0.12, 0.11], [0.17, 0.08]]) {
      const tooth = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.055, l, 2, 0.015), gold);
      tooth.position.set(x, 0, 0.03 + l / 2);
      key.add(tooth);
    }
    const small = Math.max(w, d) < 1.2;
    key.scale.setScalar(small ? 1.7 : 1.95);
    key.rotation.set(-0.55, 0.5, 0);
    const off = long >= 1.5 ? long / 2 - 0.46 : 0;
    key.position.set(across ? off : 0, CRATE_H + 0.1, across ? 0 : off);
    key.traverse((m) => m.isMesh && (m.castShadow = true));
    body.add(key);
    out.key = key;
    out.keyGold = gold;
    // a tag with its lock's number at the key's front right (its bow is front left, its teeth back right)
    if (opts.mark) {
      const tag = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20).rotateX(-Math.PI / 2), digitMaterial(opts.mark));
      tag.position.set(THREE.MathUtils.clamp(key.position.x + 0.28, -w / 2 + 0.17, w / 2 - 0.17), CRATE_H + 0.045, THREE.MathUtils.clamp(key.position.z + 0.26, -d / 2 + 0.17, d / 2 - 0.17));
      body.add(tag);
      out.keyTag = tag;
    }
  }
  g.add(body);
  return out;
}

// the pond: water over its cells (a little below the tiles), lily pads, a flower, reeds along the frame
function addPond(group, cells, ox, oz, r) {
  const water = new THREE.MeshStandardMaterial({ color: 0x3f8fc8, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.9 });
  const mud = new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 1 });
  for (const [x, y] of cells) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1, 0.06, 1), mud);
    bed.position.set(ox + x + 0.5, -0.17, oz + y + 0.5);
    bed.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), water);
    top.position.set(ox + x + 0.5, -0.07, oz + y + 0.5);
    top.receiveShadow = true;
    group.add(bed, top);
  }
  const pad = new THREE.MeshStandardMaterial({ color: 0x4f9a3a, roughness: 0.7, side: THREE.DoubleSide });
  const padGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 18, 1, false, 0.35, Math.PI * 2 - 0.7);
  cells.slice(0, 3).forEach(([x, y], k) => {
    const p = new THREE.Mesh(padGeo, pad);
    p.position.set(ox + x + 0.3 + r.next() * 0.4, -0.055, oz + y + 0.3 + r.next() * 0.4);
    p.rotation.y = r.next() * 6.28;
    p.scale.setScalar(0.8 + r.next() * 0.5);
    group.add(p);
    if (k === 0) {
      const flower = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0xf6a8c8, roughness: 0.7 }));
      flower.position.copy(p.position).add(new THREE.Vector3(0, 0.05, 0));
      flower.rotation.x = Math.PI;
      group.add(flower);
    }
  });
  // reeds: thin green stalks with brown heads, in clumps on the pond's cells by the frame
  const stalk = new THREE.MeshStandardMaterial({ color: 0x6a9a3a, roughness: 0.9 }), head = new THREE.MeshStandardMaterial({ color: 0x6a4428, roughness: 1 });
  const W = Math.round(-ox * 2), H = Math.round(-oz * 2);
  for (const [x, y] of cells) {
    const edgeX = x === 0 ? -0.38 : x === W - 1 ? 0.38 : null, edgeY = y === 0 ? -0.38 : y === H - 1 ? 0.38 : null;
    if (edgeX == null && edgeY == null) continue;
    for (let k = 0; k < 3; k++) {
      const h = 0.45 + r.next() * 0.3, reed = new THREE.Group();
      reed.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, h, 4), stalk));
      const cat = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), head);
      cat.position.y = h / 2 - 0.05;
      reed.add(cat);
      reed.position.set(ox + x + 0.5 + (edgeX ?? (r.next() - 0.5) * 0.7) + (r.next() - 0.5) * 0.12, -0.07 + h / 2, oz + y + 0.5 + (edgeY ?? (r.next() - 0.5) * 0.7) + (r.next() - 0.5) * 0.12);
      reed.rotation.set((r.next() - 0.5) * 0.2, 0, (r.next() - 0.5) * 0.2);
      reed.traverse((m) => m.isMesh && (m.castShadow = true));
      group.add(reed);
    }
  }
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

// a number on a cream disc: a padlock and its key's tag, when a level has more than one
const digits = {};
function digitMaterial(n) {
  if (digits[n]) return digits[n];
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  cv.width = cv.height = 64;
  g.fillStyle = '#fff6e2';
  g.beginPath();
  g.arc(32, 32, 30, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#2a2238';
  g.stroke();
  g.fillStyle = '#2a2238';
  g.font = '800 44px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 32, 35);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  return (digits[n] = new THREE.MeshBasicMaterial({ map, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// a stencil in cream paint, a little worn: what the crate carries (also drawn on the how-to card's legend)
const stencils = {};
function stencilMaterial(icon) {
  if (stencils[icon]) return stencils[icon];
  const cv = stencilCanvas(icon), map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  return (stencils[icon] = new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0, transparent: true, depthWrite: false, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }));
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
  return (crateMats[key] = new THREE.MeshStandardMaterial({ map, roughness: 0.7, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0 }));
}

// the crates keep their colours as the light goes (benchmark 2026-11-07: at night and in the rain they lost contrast): their
// paint and stencils glow a little, by k (0 by day)
export function setCrateGlow(k) {
  for (const m of [...Object.values(crateMats), ...Object.values(stencils)]) m.emissiveIntensity = k;
}

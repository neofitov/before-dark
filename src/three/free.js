// Giving the graphics card its memory back when a level is set up anew (main.js load: a new level, Restart, Try again, Show
// me). The old board, crates and camp leave the scene, but their geometries and textures stay on the card until they are
// disposed of. Measured 2026-11-11, for as long as the tab stayed open: every set-up left about 6 geometries and 2 textures
// behind on an empty camp, and 520 geometries and 58 textures on a full one (10 restarts of level 31: 580 geometries became
// 5,780, the page's memory 89 MB became 132).
// Only what nothing on show still uses goes, and never what the loaded models own (their clones share it). Materials stay:
// they hold no buffers, and freeing one could cost a shader compile when its kind comes back.

// skeletons go in with the textures: each animated mesh's skeleton keeps its bones in a texture of its own (41 at a full
// camp, made anew with the campers, deer and foxes at every set-up)
function collect(root, geos, texs) {
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (o.isSkinnedMesh && o.skeleton) texs.add(o.skeleton);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) texs.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) texs.add(u.value);
    }
  });
}

// what the models own (a set of geometries and textures, built once after loading)
export function owned(roots) {
  const keep = new Set();
  for (const r of roots) collect(r, keep, keep);
  return keep;
}

// removed: the objects just taken out of the scene; keep: owned(); returns how many geometries and textures (with
// skeletons) went
export function freeUnused(scene, removed, keep) {
  const usedG = new Set(), usedT = new Set(), oldG = new Set(), oldT = new Set();
  collect(scene, usedG, usedT);
  for (const r of removed) if (r) collect(r, oldG, oldT);
  let g = 0, t = 0;
  for (const x of oldG) if (!usedG.has(x) && !keep.has(x)) (x.dispose(), g++);
  for (const x of oldT) if (!usedT.has(x) && !keep.has(x)) (x.dispose(), t++);
  return { geometries: g, textures: t };
}

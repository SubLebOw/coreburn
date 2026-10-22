// hero-models.js (Phase 3B): the six heroes, built procedurally from layered primitives.
// Each hero has the same rig as before (root > body > head / legL / legR / armL / armR, pivots at the
// hip, shoulder and neck) so every existing animation, cosmetic slot and ability visual keeps working.
// Static parts are MERGED per (rig group, material) into one mesh, and the merged geometry is CACHED
// per hero, so a hero costs ~25-35 draw calls and switching heroes never allocates new geometry.
// Only materials are per instance (co-op tints, skins, hit flash). Model.anchors = cosmetic sockets.
import * as THREE from 'three';

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const G = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
const TINT_KEYS = ['coat', 'coatDark', 'plate', 'plateDark', 'cloth', 'clothDark', 'pants', 'orange', 'accent', 'mask'];

// ---- geometry kit: every primitive is baked (position/rotation/scale) into the group's merged mesh ----
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function bake(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  return g;
}
function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const oct = (r) => new THREE.OctahedronGeometry(r);
const tor = (r, t, rs = 6, ts = 16) => new THREE.TorusGeometry(r, t, rs, ts);
// a flat polygon extruded to `depth` (blades, fins, shuriken); pts in the XY plane
function slab(pts, depth) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}
// unit-height blade (y from -0.5 to 0.5, tip at -0.5 = away from the hand), scaled on Y by the tier code
const bladeGeo = (w, d, curve = 0) => slab([[-w / 2, 0.5], [w / 2, 0.5], [w * 0.35 + curve, -0.2], [curve * 1.6, -0.5], [-w * 0.45 + curve * 0.6, -0.15]], d);

// Designer: collects baked primitives per group + material key, then caches the merged result
class Design {
  constructor() { this.parts = {}; this.extra = {}; }
  add(group, mat, geo, ...t) { ((this.parts[group] ||= {})[mat] ||= []).push(bake(geo, ...t)); return this; }
  // a standalone geometry (animated part), cached with the design
  keep(name, geo) { this.extra[name] = geo; geo.userData.cached = true; return geo; }
  done() { for (const g of Object.values(this.parts)) for (const k of Object.keys(g)) { g[k] = merge(g[k]); g[k].userData.cached = true; } for (const g of Object.values(this.extra)) g.userData.cached = true; return this; }
}
const CACHE = {};
function design(id, fn) { return CACHE[id] || (CACHE[id] = (() => { const d = new Design(); fn(d); return d.done(); })()); }

// shared instancer: rig groups at the hero's pivots, one mesh per (group, material)
function assemble(d, mats, rig) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const groups = { body };
  for (const [name, at] of Object.entries(rig)) { const g = new THREE.Group(); g.position.set(...at); body.add(g); groups[name] = g; }
  for (const [gname, byMat] of Object.entries(d.parts)) {
    const parentName = gname.replace(/:.*/, ''); // 'legL:shin' style sub-groups are not used; plain names
    for (const [mk, geo] of Object.entries(byMat)) {
      const mesh = new THREE.Mesh(geo, mats[mk]);
      mesh.castShadow = !(mats[mk] && mats[mk].isMeshBasicMaterial);
      groups[parentName].add(mesh);
    }
  }
  return { root, ...groups };
}
function tint(mats, t) {
  if (!t) return mats;
  const c = new THREE.Color(t);
  for (const k of TINT_KEYS) if (mats[k]) mats[k].color.lerp(c, 0.4);
  return mats;
}
// glowing core + talons + their soft halos (the tier code scales blades on Y)
function addCore(m, geo, mat, x, y, z, rz = 0) { const c = new THREE.Mesh(geo, mat); c.position.set(x, y, z); c.rotation.z = rz; c.scale.set(0.16, 0.16, 0.06); m.body.add(c); return c; }
function addBlades(m, geo, mat, haloColor, list, base) {
  const blades = [], halos = [];
  for (const arm of [m.armL, m.armR]) for (const [x, z, rx = 0, rz = 0] of list) {
    const b = new THREE.Mesh(geo, mat); b.position.set(x, base, z); b.rotation.set(rx, 0, rz); arm.add(b); blades.push(b);
    const h = new THREE.Mesh(UNIT, G(haloColor, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    h.position.copy(b.position); h.rotation.copy(b.rotation); h.visible = false; arm.add(h); halos.push(h);
  }
  return { blades, halos };
}
const sym = (fn) => { fn(1); fn(-1); };
const UNIT = new THREE.BoxGeometry(1, 1, 1); // talon halos: Player sizes them absolutely (as before)
UNIT.userData.cached = true;

// Free a dropped hero model (hero/skin/showcase/preview switch): per-instance materials and any
// uncached geometry (cosmetics, skin attachments) are disposed; cached hero geometry and anything
// tagged userData.keep (the Player's arcs/rings/bubbles, pooled FX) are left alone.
export function disposeModel(model) {
  const root = model && (model.root || model); if (!root) return;
  root.parent?.remove(root);
  const mats = new Set(), geos = new Set();
  (function walk(o) {
    if (o.userData.keep) { o.parent?.remove(o); return; }
    if (o.geometry && !o.geometry.userData.cached && !o.geometry.userData.shared) geos.add(o.geometry);
    if (o.material) for (const m of [].concat(o.material)) if (!m.userData.shared) mats.add(m);
    for (const c of [...o.children]) walk(c);
  })(root);
  for (const g of geos) g.dispose();
  for (const m of mats) { m.map?.dispose?.(); m.dispose(); }
}

// =====================================================================================================
// SARROW: lean blade duelist. Peaked hood, one heavy asymmetric pauldron (left), split coat tails, a
// bleed-red scarf tail, sharp forearm blade-guards and two long curved teal talon-blades per arm.
export function buildSarrow(t) {
  const mats = tint({
    coat: L(0x4d5a66), coatDark: L(0x2a3038), pants: L(0x5a5246), leather: L(0x8a5e3a), orange: L(0xe0702a),
    metal: L(0x7a8089), red: L(0x9a1e24), face: G(0x06080a), glow: G(0x3ff6e0), blade: G(0x8afff4, { transparent: true, opacity: 0.92 }),
  }, t);
  const d = design('sarrow', (d) => {
    sym((s) => { const g = s > 0 ? 'legL' : 'legR';
      d.add(g, 'pants', cyl(0.12, 0.1, 0.44, 6), 0, -0.22, 0);
      d.add(g, 'metal', box(0.17, 0.13, 0.08), 0, -0.45, 0.11, 0.3);          // knee guard
      d.add(g, 'coatDark', cyl(0.1, 0.085, 0.36, 6), 0, -0.63, 0);
      d.add(g, 'leather', box(0.22, 0.16, 0.36), 0, -0.79, 0.05);              // boot
      d.add(g, 'metal', box(0.2, 0.07, 0.12), 0, -0.84, 0.24, 0.25);          // toe cap
      d.add(g, 'orange', box(0.23, 0.035, 0.37), 0, -0.71, 0.05);
    });
    d.add('body', 'pants', box(0.4, 0.2, 0.26), 0, 0.98, 0);
    d.add('body', 'coat', cyl(0.31, 0.24, 0.58, 6), 0, 1.38, 0, 0, Math.PI / 6, 0, 1, 1, 0.66); // V-shaped chest
    d.add('body', 'metal', box(0.26, 0.16, 0.06), 0, 1.15, 0.15, -0.15);       // ab plate
    d.add('body', 'leather', box(0.46, 0.07, 0.3), 0, 1.07, 0);                // belt
    d.add('body', 'metal', box(0.08, 0.07, 0.05), 0.12, 1.07, 0.16);           // buckle
    sym((s) => d.add('body', 'coatDark', box(0.2, 0.72, 0.045), s * 0.12, 0.78, -0.17, -0.22, 0, s * 0.1)); // split coat tails
    sym((s) => d.add('body', 'coat', box(0.05, 0.56, 0.24), s * 0.25, 0.86, 0.02, 0, 0, s * 0.14));        // hip flaps
    d.add('body', 'orange', box(0.07, 0.78, 0.32), 0, 1.38, 0.02, 0, 0, 0.66);  // bandolier
    d.add('body', 'orange', tor(0.2, 0.06, 5, 10), 0, 1.72, 0, Math.PI / 2, 0, 0, 1, 1, 0.8); // scarf ring
    d.add('body', 'red', box(0.11, 0.62, 0.035), -0.14, 1.42, -0.2, -0.32, 0, 0.12); // bleed-red scarf tail
    // the asymmetric heavy left pauldron (layered, with a spike)
    d.add('body', 'metal', box(0.36, 0.1, 0.4), 0.4, 1.76, 0, 0, 0, -0.38);
    d.add('body', 'orange', box(0.32, 0.05, 0.36), 0.43, 1.68, 0, 0, 0, -0.5);
    d.add('body', 'coatDark', box(0.28, 0.07, 0.32), 0.46, 1.62, 0, 0, 0, -0.62);
    d.add('body', 'metal', cone(0.045, 0.2, 4), 0.5, 1.88, -0.04, 0, 0, -0.75);
    d.add('body', 'leather', box(0.18, 0.08, 0.26), -0.36, 1.72, 0, 0, 0, 0.3);  // light right strap pad
    d.add('body', 'metal', tor(0.1, 0.025, 4, 12), 0, 1.42, 0.16);               // core housing
    // HEAD: deep peaked hood, cyber-eye (right bigger) and a forward hood point
    d.add('head', 'coat', cyl(0.2, 0.25, 0.46, 7), 0, 0, -0.01);
    d.add('head', 'coat', cone(0.15, 0.3, 4), 0, 0.27, -0.09, -0.55, Math.PI / 4);
    d.add('head', 'coatDark', box(0.4, 0.1, 0.16), 0, 0.17, 0.14, 0.35);         // hood brim
    d.add('head', 'coatDark', box(0.34, 0.34, 0.1), 0, 0.1, -0.24, 0.6);         // folds down the back
    d.add('head', 'face', box(0.3, 0.24, 0.05), 0, -0.05, 0.21);
    d.add('head', 'glow', box(0.09, 0.035, 0.02), -0.08, -0.02, 0.24);
    d.add('head', 'glow', box(0.05, 0.03, 0.02), 0.08, -0.02, 0.24);
    d.add('head', 'metal', box(0.04, 0.12, 0.06), -0.15, -0.03, 0.2);            // eye implant rim
    sym((s) => { const g = s > 0 ? 'armL' : 'armR';
      d.add(g, 'coat', cyl(0.1, 0.085, 0.42, 6), 0, -0.2, 0);
      d.add(g, 'metal', sph(0.085, 6, 4), 0, -0.42, 0);                       // elbow
      d.add(g, 'metal', cyl(0.11, 0.135, 0.32, 6), 0, -0.62, 0);              // gauntlet
      d.add(g, 'orange', cyl(0.14, 0.14, 0.04, 6), 0, -0.52, 0);
      d.add(g, 'metal', slab([[0, 0], [0.05, 0.34], [-0.05, 0.3]], 0.03), s * 0.13, -0.78, -0.02, 0, 0, s * 0.2); // blade guard fin
    });
  });
  const m = assemble(d, mats, { legL: [0.17, 0.86, 0], legR: [-0.17, 0.86, 0], head: [0, 1.98, 0], armL: [0.42, 1.62, 0], armR: [-0.42, 1.62, 0] });
  const core = addCore(m, d.extra.core || d.keep('core', oct(0.5)), mats.glow, 0, 1.42, 0.17);
  const bg = d.extra.blade || d.keep('blade', bladeGeo(0.07, 0.03, 0.02));
  const { blades, halos } = addBlades(m, bg, mats.blade, 0x8afff4, [[-0.06, 0.04], [0.06, 0.04]], -1.13);
  return { ...m, core, flashMats: [mats.coat, mats.coatDark, mats.pants, mats.leather, mats.orange, mats.metal, mats.red], blade: mats.blade, blades, halos, bladeBase: -0.77, bladeLen: 0.72,
    anchors: { headTop: 0.32, back: -0.22, shoulder: 0.46, scale: 1, headW: 0.25, faceZ: 0.24 }, style: 'duelist' };
}

// ZALEKS: the juggernaut. Wide stacked pauldrons, a reactor backpack with glowing exhausts, a heavy
// helm hunched between the shoulders, huge knuckled gauntlets with an integrated shield plate (left).
export function buildZaleks(t) {
  const mats = tint({
    plate: L(0x5a5e63), plateDark: L(0x2c2e31), cloth: L(0x6b4a2e), accent: L(0x9c3a1c), metal: L(0x8e939a),
    face: G(0x0a0806), glow: G(0xffa030), blade: G(0xffc060, { transparent: true, opacity: 0.94 }),
  }, t);
  const d = design('zaleks', (d) => {
    sym((s) => { const g = s > 0 ? 'legL' : 'legR';
      d.add(g, 'cloth', cyl(0.17, 0.15, 0.4, 6), 0, -0.2, 0);
      d.add(g, 'plate', box(0.34, 0.22, 0.14), 0, -0.4, 0.15, 0.2);           // knee cop
      d.add(g, 'plate', box(0.32, 0.3, 0.36), 0, -0.56, 0.02);                // greave
      d.add(g, 'plateDark', box(0.42, 0.2, 0.54), 0, -0.71, 0.07);            // heavy boot
      d.add(g, 'metal', box(0.4, 0.08, 0.14), 0, -0.76, 0.33, 0.3);
      d.add(g, 'accent', box(0.35, 0.04, 0.37), 0, -0.44, 0.03);
    });
    d.add('body', 'cloth', box(0.8, 0.38, 0.5), 0, 1.0, 0);
    d.add('body', 'plate', box(1.0, 0.56, 0.6), 0, 1.42, 0);                  // chest
    d.add('body', 'plate', box(0.84, 0.18, 0.5), 0, 1.72, -0.02, -0.2);        // upper chest slope
    d.add('body', 'plateDark', box(0.56, 0.12, 0.46), 0, 1.8, -0.04);        // collar
    for (const y of [1.18, 1.27]) d.add('body', 'accent', box(0.62, 0.05, 0.04), 0, y, 0.3);
    d.add('body', 'accent', box(1.02, 0.06, 0.62), 0, 1.15, 0);
    d.add('body', 'metal', tor(0.15, 0.04, 4, 4), 0, 1.45, 0.3, 0, 0, Math.PI / 4); // square core housing
    d.add('body', 'plateDark', box(0.66, 0.6, 0.26), 0, 1.46, -0.42);         // reactor pack
    for (const x of [-0.24, 0.24]) { d.add('body', 'metal', cyl(0.07, 0.08, 0.3, 6), x, 1.8, -0.48); d.add('body', 'glow', cyl(0.05, 0.05, 0.04, 6), x, 1.96, -0.48); }
    d.add('body', 'glow', box(0.4, 0.06, 0.02), 0, 1.36, -0.56);              // pack vent glow
    sym((s) => { // stacked pauldrons with rivets
      d.add('body', 'plate', box(0.46, 0.22, 0.64), s * 0.7, 1.74, 0, 0, 0, -s * 0.32);
      d.add('body', 'plateDark', box(0.4, 0.14, 0.58), s * 0.78, 1.58, 0, 0, 0, -s * 0.45);
      d.add('body', 'accent', box(0.48, 0.05, 0.66), s * 0.7, 1.63, 0, 0, 0, -s * 0.32);
      for (const z of [-0.2, 0, 0.2]) d.add('body', 'metal', sph(0.04, 5, 3), s * 0.64, 1.86, z);
    });
    // HEAD: hunched, a heavy helm with a T-visor, cheek guards and a grille
    d.add('head', 'plateDark', box(0.46, 0.42, 0.48), 0, 0, 0);
    d.add('head', 'plate', box(0.52, 0.12, 0.52), 0, 0.2, 0.01);
    d.add('head', 'plate', box(0.1, 0.12, 0.46), 0, 0.27, 0);                   // crest ridge
    sym((s) => d.add('head', 'plate', box(0.08, 0.3, 0.3), s * 0.25, -0.04, 0.1));
    d.add('head', 'face', box(0.36, 0.07, 0.04), 0, 0.03, 0.245);
    d.add('head', 'glow', box(0.32, 0.035, 0.02), 0, 0.03, 0.27);
    d.add('head', 'glow', box(0.035, 0.12, 0.02), 0, -0.04, 0.27);
    for (const x of [-0.12, 0, 0.12]) d.add('head', 'metal', box(0.05, 0.12, 0.03), x, -0.14, 0.25);
    sym((s) => { const g = s > 0 ? 'armL' : 'armR';
      d.add(g, 'cloth', cyl(0.15, 0.13, 0.4, 6), 0, -0.2, 0);
      d.add(g, 'metal', sph(0.15, 6, 4), 0, -0.42, 0);
      d.add(g, 'plate', box(0.44, 0.42, 0.44), 0, -0.68, 0);                  // big fist gauntlet
      d.add(g, 'metal', box(0.46, 0.1, 0.22), 0, -0.88, 0.13);                // knuckle bar
      d.add(g, 'accent', box(0.45, 0.06, 0.45), 0, -0.52, 0);
      d.add(g, 'glow', box(0.03, 0.2, 0.02), s * 0.12, -0.68, 0.23);
      if (s > 0) { d.add(g, 'plateDark', box(0.07, 0.42, 0.46), 0.26, -0.74, 0.02); d.add(g, 'glow', box(0.02, 0.32, 0.04), 0.3, -0.74, 0.02); } // integrated shield plate
    });
  });
  const m = assemble(d, mats, { legL: [0.25, 0.8, 0], legR: [-0.25, 0.8, 0], head: [0, 2.08, 0.12], armL: [0.64, 1.62, 0], armR: [-0.64, 1.62, 0] });
  const core = addCore(m, d.extra.core || d.keep('core', box(1, 1, 1)), mats.glow, 0, 1.45, 0.31);
  const bg = d.extra.blade || d.keep('blade', bladeGeo(0.11, 0.07));
  const { blades, halos } = addBlades(m, bg, mats.blade, 0xffc060, [[-0.12, 0.05], [0, 0.05], [0.12, 0.05]], -1.1);
  return { ...m, core, flashMats: [mats.plate, mats.plateDark, mats.cloth, mats.accent, mats.metal], blade: mats.blade, blades, halos, bladeBase: -0.85, bladeLen: 0.5,
    anchors: { headTop: 0.32, back: -0.56, shoulder: 0.7, scale: 1.3, headW: 0.28, faceZ: 0.27, shoulderLift: 0.17, shoulderOut: 0.08 }, style: 'heavy' };
}

// ISKRA: compact agile ranged skirmisher. Slim tactical suit, a chest rig, a needle launcher on the right
// forearm, mine canisters on the belt, glowing ammo vials on a back rack and a split scarf.
export function buildIskra(t) {
  const mats = tint({
    cloth: L(0xc9c4bc), clothDark: L(0x433d58), accent: L(0x8a3ad0), metal: L(0x9aa0aa),
    face: G(0x0b0710), glow: G(0xe060ff), blade: G(0xeeaaff, { transparent: true, opacity: 0.92 }),
  }, t);
  const d = design('iskra', (d) => {
    sym((s) => { const g = s > 0 ? 'legL' : 'legR';
      d.add(g, 'clothDark', cyl(0.095, 0.08, 0.44, 6), 0, -0.22, 0);
      d.add(g, 'metal', box(0.13, 0.1, 0.07), 0, -0.45, 0.09, 0.3);
      d.add(g, 'cloth', cyl(0.085, 0.075, 0.34, 6), 0, -0.64, 0);
      d.add(g, 'metal', box(0.16, 0.12, 0.32), 0, -0.84, 0.05);               // sleek boot
      d.add(g, 'accent', box(0.17, 0.03, 0.33), 0, -0.77, 0.05);
    });
    d.add('body', 'clothDark', box(0.34, 0.26, 0.24), 0, 1.02, 0);
    d.add('body', 'cloth', cyl(0.23, 0.18, 0.52, 6), 0, 1.4, 0, 0, Math.PI / 6, 0, 1, 1, 0.68);
    d.add('body', 'metal', box(0.3, 0.24, 0.05), 0, 1.47, 0.13, -0.08);        // chest rig plate
    d.add('body', 'accent', box(0.44, 0.08, 0.3), 0, 1.13, 0);                  // sash
    sym((s) => { d.add('body', 'metal', cyl(0.055, 0.055, 0.1, 8), s * 0.21, 1.03, 0.08, Math.PI / 2); d.add('body', 'glow', box(0.03, 0.03, 0.02), s * 0.21, 1.03, 0.14); }); // mine canisters
    d.add('body', 'metal', box(0.24, 0.3, 0.06), 0, 1.42, -0.15);              // back ammo rack
    for (const x of [-0.07, 0, 0.07]) d.add('body', 'glow', cyl(0.025, 0.025, 0.22, 6), x, 1.44, -0.19);
    for (const sx of [-0.08, 0.08]) d.add('body', 'accent', box(0.1, 0.035, 0.7), sx, 1.5, -0.3, -1.05); // split scarf
    d.add('body', 'accent', box(0.36, 0.1, 0.3), 0, 1.72, 0);
    d.add('body', 'metal', box(0.18, 0.06, 0.2), -0.29, 1.73, 0, 0, 0, 0.35);    // small right shoulder pad
    d.add('body', 'metal', tor(0.08, 0.02, 4, 10), 0, 1.47, 0.16);
    // HEAD: sleek helm, swept crest fin, visor line and a side antenna
    d.add('head', 'cloth', box(0.32, 0.36, 0.36), 0, 0, 0);
    d.add('head', 'cloth', box(0.28, 0.12, 0.3), 0, 0.19, -0.02);
    d.add('head', 'accent', slab([[0, 0], [0.12, 0], [-0.18, 0.2], [-0.24, 0.18]], 0.05), 0, 0.2, 0.08, 0, Math.PI / 2);
    d.add('head', 'face', box(0.28, 0.1, 0.04), 0, 0, 0.18);
    d.add('head', 'glow', box(0.25, 0.03, 0.02), 0, 0, 0.2);
    d.add('head', 'metal', cyl(0.012, 0.012, 0.3, 4), 0.17, 0.14, -0.04, -0.3);
    d.add('head', 'glow', sph(0.025, 5, 3), 0.17, 0.29, -0.08);
    sym((s) => { const g = s > 0 ? 'armL' : 'armR';
      d.add(g, 'cloth', cyl(0.075, 0.065, 0.42, 6), 0, -0.21, 0);
      d.add(g, 'metal', box(0.17, 0.24, 0.19), 0, -0.62, 0);
      d.add(g, 'accent', box(0.18, 0.04, 0.2), 0, -0.53, 0);
      if (s < 0) { d.add(g, 'metal', cyl(0.04, 0.05, 0.42, 6), 0, -0.64, 0.12); d.add(g, 'glow', cyl(0.025, 0.025, 0.03, 6), 0, -0.86, 0.12); } // needle launcher
    });
  });
  const m = assemble(d, mats, { legL: [0.12, 0.92, 0], legR: [-0.12, 0.92, 0], head: [0, 2.02, 0], armL: [0.31, 1.63, 0], armR: [-0.31, 1.63, 0] });
  const core = addCore(m, d.extra.core || d.keep('core', oct(0.45)), mats.glow, 0, 1.47, 0.18);
  const bg = d.extra.blade || d.keep('blade', bladeGeo(0.035, 0.03));
  const { blades, halos } = addBlades(m, bg, mats.blade, 0xeeaaff, [[0, 0.04]], -1.2);
  return { ...m, core, flashMats: [mats.cloth, mats.clothDark, mats.accent, mats.metal], blade: mats.blade, blades, halos, bladeBase: -0.75, bladeLen: 0.9,
    anchors: { headTop: 0.26, back: -0.2, shoulder: 0.32, scale: 0.88, headW: 0.18, faceZ: 0.2 }, style: 'agile' };
}

// ORIN: gravity controller. A layered robe over iron, a bell mask, a gravity halo + organ pipes on the
// back, a brass gravity ring round the core, wide bell sleeves, hooked sickles and three orbiting motes.
export function buildOrin(t) {
  const mats = tint({
    plate: L(0x6a2a22), plateDark: L(0x2a2220), cloth: L(0x3a3430), accent: L(0xb08a4a), metal: L(0x8a8580), mask: L(0xd2c8b2),
    face: G(0x0a0606), glow: G(0xff4a5a), eye: G(0x3ff6e0), blade: G(0xffa090, { transparent: true, opacity: 0.92 }),
  }, t);
  const d = design('orin', (d) => {
    sym((s) => { const g = s > 0 ? 'legL' : 'legR';
      d.add(g, 'cloth', cyl(0.14, 0.13, 0.44, 6), 0, -0.22, 0);
      d.add(g, 'plate', cyl(0.16, 0.2, 0.36, 7), 0, -0.64, 0.02);             // heavy iron greave-boot
      d.add(g, 'accent', cyl(0.17, 0.17, 0.05, 7), 0, -0.47, 0.02);
      d.add(g, 'metal', box(0.2, 0.12, 0.08), 0, -0.56, 0.17, 0.2);           // shin plate
      d.add(g, 'plateDark', box(0.3, 0.11, 0.4), 0, -0.86, 0.06);
    });
    d.add('body', 'cloth', cyl(0.3, 0.46, 0.68, 8), 0, 0.8, 0);                 // long robe skirt (to the shins)
    d.add('body', 'accent', cyl(0.465, 0.465, 0.04, 8), 0, 0.48, 0);            // brass hem
    d.add('body', 'plateDark', box(0.2, 0.6, 0.04), 0, 0.82, 0.3, 0.2);           // front tabard
    d.add('body', 'plateDark', cyl(0.26, 0.3, 0.12, 8), 0, 1.1, 0);
    d.add('body', 'plate', cyl(0.3, 0.25, 0.56, 6), 0, 1.4, 0, 0, Math.PI / 6, 0, 1, 1, 0.7);
    d.add('body', 'accent', tor(0.16, 0.025, 4, 16), 0, 1.42, 0.17);           // gravity ring
    for (const y of [1.28, 1.56]) d.add('body', 'plateDark', box(0.44, 0.03, 0.03), 0, y, 0.18);
    sym((s) => { d.add('body', 'plateDark', box(0.26, 0.18, 0.42), s * 0.36, 1.68, 0, 0, 0, -s * 0.2); d.add('body', 'mask', box(0.22, 0.05, 0.38), s * 0.38, 1.79, 0, 0, 0, -s * 0.2); });
    d.add('body', 'metal', tor(0.42, 0.028, 4, 24), 0, 1.6, -0.3);              // gravity halo on the back
    for (const [x, h] of [[-0.14, 0.62], [0, 0.82], [0.14, 0.54]]) { d.add('body', 'accent', cyl(0.045, 0.05, h, 6), x, 1.46 + h / 2 - 0.1, -0.26); d.add('body', 'plateDark', cyl(0.06, 0.06, 0.04, 6), x, 1.46 + h - 0.1, -0.26); }
    d.add('body', 'cloth', box(0.5, 0.4, 0.06), 0, 1.6, -0.2, -0.1);            // hood drape
    // HEAD: a bell mask with a flared rim, the crack, one teal eye and a crown bolt, under a cowl
    d.add('head', 'cloth', box(0.46, 0.42, 0.3), 0, 0.02, -0.1);
    d.add('head', 'mask', cyl(0.18, 0.23, 0.42, 10), 0, 0, 0.02);
    d.add('head', 'mask', cyl(0.26, 0.26, 0.05, 10), 0, -0.22, 0.02);
    d.add('head', 'face', box(0.05, 0.18, 0.04), -0.08, -0.03, 0.21);
    d.add('head', 'face', box(0.02, 0.24, 0.02), 0.12, 0.02, 0.2, 0, 0, 0.2);
    d.add('head', 'eye', box(0.08, 0.06, 0.03), 0.06, 0.08, 0.21);
    d.add('head', 'accent', cyl(0.05, 0.07, 0.08, 6), 0, 0.25, 0.02);
    sym((s) => { const g = s > 0 ? 'armL' : 'armR';
      d.add(g, 'cloth', cyl(0.09, 0.17, 0.46, 7), 0, -0.24, 0);               // bell sleeve
      d.add(g, 'plate', cyl(0.12, 0.13, 0.26, 6), 0, -0.64, 0);
      d.add(g, 'accent', tor(0.12, 0.022, 4, 10), 0, -0.53, 0, Math.PI / 2);
      d.add(g, 'eye', sph(0.03, 5, 3), 0, -0.76, 0.12);                        // tether emitter
    });
  });
  const m = assemble(d, mats, { legL: [0.15, 0.92, 0], legR: [-0.15, 0.92, 0], head: [0, 2.06, 0], armL: [0.44, 1.64, 0], armR: [-0.44, 1.64, 0] });
  const core = addCore(m, d.extra.core || d.keep('core', oct(0.5)), mats.glow, 0, 1.42, 0.2);
  const bg = d.extra.blade || d.keep('blade', bladeGeo(0.06, 0.03, 0.05));
  const { blades, halos } = addBlades(m, bg, mats.blade, 0xffa090, [[0, -0.06, 0.12], [0, 0.1, -0.18]], -1.08);
  // three gravity motes orbiting the body (animated in Player.animate via model.idle)
  const orbit = new THREE.Group(); orbit.position.y = 1.45; m.body.add(orbit);
  const mg = d.extra.mote || d.keep('mote', oct(0.06));
  for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(mg, mats.eye); const a = i / 3 * Math.PI * 2; o.position.set(Math.cos(a) * 0.62, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.62); orbit.add(o); }
  return { ...m, core, flashMats: [mats.plate, mats.plateDark, mats.cloth, mats.accent, mats.metal, mats.mask], blade: mats.blade, blades, halos, bladeBase: -0.8, bladeLen: 0.62,
    anchors: { headTop: 0.3, back: -0.34, shoulder: 0.4, scale: 1.1, headW: 0.26, faceZ: 0.24 }, style: 'control', orbit,
    idle(t, mv = 0) { orbit.rotation.y = t * (1.1 + mv * 1.4); orbit.rotation.z = Math.sin(t * 0.5) * 0.12; orbit.position.y = 1.45 + Math.sin(t * 1.6) * 0.06;
      for (const [i, o] of orbit.children.entries()) { o.rotation.x = t * 2 + i; o.rotation.y = t * 3 + i; } } };
}

// KAGERO: shadow ninja. Unmistakable at a distance: a hachigane forehead plate and long headband tails,
// a face mask with a thin violet slit, layered samurai-style sode shoulders, lamellar chest bands,
// wide hakama legs, a katana slung diagonally across the back and four-point shuriken.
export function buildNinja(t) {
  const mats = tint({
    cloth: L(0x262634), clothDark: L(0x14141b), accent: L(0x5a3ad0), metal: L(0x8a909a), mask: L(0x3a3a48), steel: L(0x30333b),
    face: G(0x07070b), glow: G(0xa08cff), blade: G(0xd0c8ff, { transparent: true, opacity: 0.94 }),
  }, t);
  const star = (r, d) => slab([[0, r], [r * 0.22, r * 0.22], [r, 0], [r * 0.22, -r * 0.22], [0, -r], [-r * 0.22, -r * 0.22], [-r, 0], [-r * 0.22, r * 0.22]], d);
  const dz = design('ninja', (d) => {
    sym((s) => { const g = s > 0 ? 'legL' : 'legR';
      d.add(g, 'cloth', cyl(0.12, 0.16, 0.5, 6), 0, -0.26, 0);                // hakama
      for (const y of [-0.58, -0.66]) d.add(g, 'accent', cyl(0.085, 0.085, 0.03, 6), 0, y, 0); // shin wraps
      d.add(g, 'clothDark', cyl(0.08, 0.07, 0.24, 6), 0, -0.62, 0);
      d.add(g, 'clothDark', box(0.18, 0.1, 0.3), 0, -0.83, 0.05);             // tabi
    });
    d.add('body', 'clothDark', box(0.4, 0.24, 0.26), 0, 1.0, 0);
    d.add('body', 'cloth', cyl(0.26, 0.2, 0.52, 6), 0, 1.38, 0, 0, Math.PI / 6, 0, 1, 1, 0.64);
    for (const [i, y] of [1.26, 1.36, 1.46].entries()) d.add('body', 'steel', box(0.38 - i * 0.03, 0.07, 0.05), 0, y, 0.14 + i * 0.005, -0.12); // lamellar bands
    d.add('body', 'accent', box(0.48, 0.09, 0.3), 0, 1.11, 0);                 // obi
    d.add('body', 'accent', box(0.1, 0.22, 0.04), 0.14, 1.0, 0.15, 0, 0, 0.2); // obi knot tail
    sym((s) => { for (let i = 0; i < 3; i++) d.add('body', i % 2 ? 'accent' : 'steel', box(0.24, 0.035, 0.28), s * (0.33 + i * 0.03), 1.72 - i * 0.07, 0, 0, 0, -s * 0.5); }); // sode
    d.add('body', 'clothDark', cyl(0.035, 0.035, 1.0, 6), 0.02, 1.5, -0.2, 0, 0, -0.75);  // katana sheath
    d.add('body', 'metal', cyl(0.05, 0.05, 0.02, 8), -0.3, 1.78, -0.2, 0, 0, -0.75 + Math.PI / 2); // tsuba
    d.add('body', 'accent', cyl(0.025, 0.025, 0.26, 6), -0.4, 1.88, -0.2, 0, 0, -0.75); // hilt
    d.add('body', 'metal', box(0.06, 0.74, 0.3), 0, 1.38, 0.01, 0, 0, 0.7);     // bandolier
    for (const k of [-1, 0, 1]) d.add('body', 'metal', star(0.07, 0.02), k * 0.16, 1.38 + k * 0.14, 0.17, 0, 0, 0.4);
    d.add('body', 'accent', box(0.4, 0.11, 0.32), 0, 1.72, 0);
    for (const sx of [-0.07, 0.08]) d.add('body', 'accent', box(0.09, 0.035, 0.9), sx, 1.4, -0.36, -1.15); // long scarf
    // HEAD: hood, face mask, slit, hachigane plate + headband tails, small hood point (ninja silhouette)
    d.add('head', 'cloth', box(0.36, 0.38, 0.38), 0, 0, 0);
    d.add('head', 'mask', box(0.38, 0.2, 0.08), 0, -0.08, 0.17);
    d.add('head', 'face', box(0.3, 0.07, 0.04), 0, 0.06, 0.19);
    d.add('head', 'glow', box(0.26, 0.025, 0.02), 0, 0.06, 0.205);
    d.add('head', 'accent', box(0.39, 0.06, 0.4), 0, 0.13, 0);
    d.add('head', 'metal', box(0.2, 0.07, 0.03), 0, 0.13, 0.205);              // hachigane
    for (const s2 of [-1, 1]) d.add('head', 'accent', box(0.045, 0.035, 0.5), s2 * 0.08, -0.02, -0.38, -0.75, s2 * 0.25);
    d.add('head', 'cloth', box(0.2, 0.06, 0.2), 0, 0.21, -0.02);
    sym((s) => { const g = s > 0 ? 'armL' : 'armR';
      d.add(g, 'clothDark', cyl(0.075, 0.065, 0.42, 6), 0, -0.21, 0);
      d.add(g, 'steel', box(0.17, 0.24, 0.19), 0, -0.62, 0);                  // kote bracer
      d.add(g, 'metal', slab([[0, 0], [0.04, 0.26], [-0.03, 0.22]], 0.025), s * 0.1, -0.76, 0, 0, 0, s * 0.15);
      d.add(g, 'accent', box(0.18, 0.04, 0.2), 0, -0.52, 0);
    });
  });
  const m = assemble(dz, mats, { legL: [0.14, 0.88, 0], legR: [-0.14, 0.88, 0], head: [0, 2.0, 0.03], armL: [0.33, 1.63, 0], armR: [-0.33, 1.63, 0] });
  const core = addCore(m, dz.extra.core || dz.keep('core', oct(0.42)), mats.glow, 0, 1.53, 0.16);
  // the "blade" is a shuriken in each hand (normalized to unit height for the tier code)
  const bg = dz.extra.blade || dz.keep('blade', star(0.5, 0.05));
  const blades = [], halos = [];
  for (const arm of [m.armL, m.armR]) {
    const b = new THREE.Mesh(bg, mats.blade); b.scale.set(0.22, 1, 1); b.position.set(0, -0.84, 0.06); arm.add(b); blades.push(b);
    const h = new THREE.Mesh(UNIT, G(0xd0c8ff, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); h.rotation.z = Math.PI / 4; h.position.copy(b.position); h.visible = false; arm.add(h); halos.push(h);
  }
  return { ...m, core, flashMats: [mats.cloth, mats.clothDark, mats.accent, mats.metal, mats.mask, mats.steel], blade: mats.blade, blades, halos, bladeBase: -0.84, bladeLen: 0.2,
    anchors: { headTop: 0.26, back: -0.22, shoulder: 0.36, scale: 0.92, headW: 0.2, faceZ: 0.21 }, style: 'ninja' };
}

// AXIOM: robotic swarm commander. Not human: a sensor head sunk between servo shoulders, a tapered armoured
// chassis with a split reactor (doors open in Ascension), piston arms with clawed emitters, digitigrade
// legs on three-toed feet, and a drone-control mast with a dish and two antennas on the back.
export function buildAxiom(t) {
  const mats = tint({
    plate: L(0x2c2e37), dark: L(0x15161b), metal: L(0x5e6270), accent: L(0x8a1a22),
    glow: G(0xff2a3a), blade: G(0xff6a6a, { transparent: true, opacity: 0.92 }),
  }, t);
  const d = design('axiom', (d) => {
    sym((s) => { const g = s > 0 ? 'legL' : 'legR';
      d.add(g, 'plate', box(0.2, 0.36, 0.24), 0, -0.18, 0.03, 0.25);         // thigh armour (angled forward)
      d.add(g, 'metal', sph(0.085, 6, 4), 0, -0.38, 0.09);                     // knee servo
      d.add(g, 'metal', cyl(0.045, 0.045, 0.36, 6), 0, -0.56, 0.04, -0.3);    // piston shin
      d.add(g, 'dark', box(0.14, 0.3, 0.12), 0, -0.6, -0.04, -0.3);
      d.add(g, 'glow', box(0.03, 0.14, 0.02), 0, -0.56, 0.1, -0.3);
      for (const a of [-0.4, 0, 0.4]) d.add(g, 'dark', box(0.06, 0.06, 0.26), Math.sin(a) * 0.08, -0.86, 0.08, 0, a); // three toes
      d.add(g, 'dark', box(0.08, 0.06, 0.12), 0, -0.86, -0.1);                // heel spur
    });
    d.add('body', 'dark', box(0.4, 0.26, 0.26), 0, 1.02, 0);
    d.add('body', 'metal', cyl(0.12, 0.14, 0.18, 6), 0, 1.15, 0);            // spine joint
    d.add('body', 'plate', cyl(0.42, 0.27, 0.62, 4), 0, 1.44, 0, 0, Math.PI / 4, 0, 1, 1, 0.62); // tapered chassis
    d.add('body', 'accent', tor(0.12, 0.025, 4, 12), 0, 1.44, 0.19);
    for (const y of [1.22, 1.3]) d.add('body', 'metal', box(0.3, 0.025, 0.04), 0, y, 0.15);
    sym((s) => { // servo shoulders + blade fins
      d.add('body', 'metal', sph(0.12, 6, 4), s * 0.42, 1.72, 0);
      d.add('body', 'plate', box(0.3, 0.18, 0.36), s * 0.44, 1.82, 0, 0, 0, -s * 0.15);
      d.add('body', 'accent', box(0.07, 0.46, 0.28), s * 0.5, 2.0, -0.08, 0, 0, s * -0.45);
      d.add('body', 'glow', box(0.02, 0.2, 0.03), s * 0.36, 1.82, 0.19);
    });
    d.add('body', 'dark', box(0.3, 0.4, 0.16), 0, 1.52, -0.26);               // drone-control mast
    d.add('body', 'metal', cyl(0.14, 0.04, 0.05, 10), 0, 1.86, -0.34, -0.5);   // dish
    sym((s) => { d.add('body', 'metal', cyl(0.012, 0.012, 0.56, 4), s * 0.12, 2.0, -0.3); d.add('body', 'glow', sph(0.028, 5, 3), s * 0.12, 2.29, -0.3); });
    // HEAD: a low, faceless sensor wedge with one visor line and side receivers
    d.add('head', 'plate', box(0.34, 0.22, 0.36), 0, 0, 0);
    d.add('head', 'plate', cyl(0.0, 0.2, 0.16, 4), 0, 0.14, 0, 0, Math.PI / 4, 0, 1, 1, 1.1);
    d.add('head', 'dark', box(0.3, 0.12, 0.05), 0, 0.0, 0.17);
    d.add('head', 'glow', box(0.26, 0.03, 0.02), 0, 0.01, 0.2);
    sym((s) => d.add('head', 'metal', cyl(0.05, 0.05, 0.06, 8), s * 0.19, 0.0, 0, 0, 0, Math.PI / 2));
    d.add('head', 'accent', box(0.05, 0.08, 0.36), 0, 0.2, -0.03, -0.1);
    sym((s) => { const g = s > 0 ? 'armL' : 'armR';
      d.add(g, 'metal', cyl(0.05, 0.05, 0.4, 6), 0, -0.22, 0);                // piston upper arm
      d.add(g, 'plate', box(0.13, 0.32, 0.15), s * 0.03, -0.24, 0);
      d.add(g, 'metal', sph(0.075, 6, 4), 0, -0.44, 0);
      d.add(g, 'dark', box(0.2, 0.28, 0.22), 0, -0.64, 0);                    // forearm block
      for (const y of [-0.58, -0.66]) d.add(g, 'glow', box(0.21, 0.02, 0.04), 0, y, 0.1);
      for (const a of [-1, 0, 1]) d.add(g, 'metal', box(0.03, 0.12, 0.03), a * 0.06, -0.86, 0.06, 0.3, 0, a * 0.3); // emitter claws
    });
  });
  const m = assemble(d, mats, { legL: [0.16, 0.94, 0], legR: [-0.16, 0.94, 0], head: [0, 1.98, 0.04], armL: [0.46, 1.68, 0], armR: [-0.46, 1.68, 0] });
  const core = addCore(m, d.extra.core || d.keep('core', box(0.9, 1.1, 1)), mats.glow, 0, 1.44, 0.17);
  const pg = d.extra.door || d.keep('door', box(0.15, 0.3, 0.05));
  const plateL = new THREE.Mesh(pg, mats.metal); plateL.position.set(0.1, 1.44, 0.2); m.body.add(plateL);
  const plateR = new THREE.Mesh(pg, mats.metal); plateR.position.set(-0.1, 1.44, 0.2); m.body.add(plateR);
  const bg = d.extra.blade || d.keep('blade', oct(0.5));
  const blades = [], halos = [];
  for (const arm of [m.armL, m.armR]) {
    const b = new THREE.Mesh(bg, mats.blade); b.scale.set(0.12, 1, 0.12); b.position.set(0, -0.84, 0.04); arm.add(b); blades.push(b);
    const h = new THREE.Mesh(UNIT, G(0xff6a6a, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); h.position.copy(b.position); h.visible = false; arm.add(h); halos.push(h);
  }
  return { ...m, core, flashMats: [mats.plate, mats.dark, mats.metal, mats.accent], blade: mats.blade, blades, halos, bladeBase: -0.84, bladeLen: 0.16, plateL, plateR,
    anchors: { headTop: 0.26, back: -0.36, shoulder: 0.46, scale: 1.05, headW: 0.19, faceZ: 0.2 }, style: 'machine',
    idle(t, mv = 0) { // stepped servo head scan (snaps between angles)
      const step = Math.floor(t * 0.8) % 4, target = [0.35, 0, -0.35, 0][step] * (1 - mv);
      m.head.rotation.y += (target - m.head.rotation.y) * 0.18;
      } };
}

// geometry/material counts (for the leak checks in the dev harness)
export const modelCacheSize = () => Object.keys(CACHE).length;

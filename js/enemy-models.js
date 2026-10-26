// enemy-models.js (Phase 5C): the Grindchoir's regular enemies, rebuilt as scrap-born machines.
// VISUALS ONLY. Nothing here touches stats, radii, AI or timing (enemy.js owns those); the root is still
// scaled by Enemy.scale exactly as before, and collision stays the plain circle radius = 0.5 * scale.
// Same approach as the Phase 3B heroes (hero-models.js): primitives are baked and MERGED per
// (rig group, material) and the result is CACHED per enemy type (+ elite form), so a whole wave of
// one type shares the same geometry. Each enemy only owns 4 small Lambert materials (for its own hit
// flash); every glow material is shared. Small rivets/cables/vents are a separate "detail" mesh per
// group that enemy.js hides in big crowds (gameplay LOD) - zero draw calls when hidden.
import * as THREE from 'three';

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
  out.computeBoundingSphere(); out.userData.cached = true;
  return out;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
const oct = (r) => new THREE.OctahedronGeometry(r);
const ico = (r) => new THREE.IcosahedronGeometry(r, 0);
const tor = (r, t, rs = 4, ts = 12) => new THREE.TorusGeometry(r, t, rs, ts);
function slab(pts, depth) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}
const sym = (fn) => { fn(1); fn(-1); };
const PI = Math.PI;

// ---- shared glow materials (never flashed, never disposed) ----
const G = (c, o) => { const m = new THREE.MeshBasicMaterial({ color: c, ...o }); m.userData.shared = true; return m; };
export const GLOW = {
  visor: G(0xc8ff3a), eliteVisor: G(0xffb020), hot: G(0xff7a1a), ember: G(0xff4a14), red: G(0xff3a3a),
  cyan: G(0x3ff6e0), spit: G(0xff8a1e), mend: G(0x6aff7a), bomb: G(0xffb020), amber: G(0xffc23a), censer: G(0xff9a2a),
  warn: G(0xff2a10), pod: G(0xffd23a), white: G(0xfff2d0),
};

// Designer: parts per group + material key; keys ending in '~' are LOD detail
class Design {
  constructor() { this.parts = {}; this.keep = {}; }
  add(group, mat, geo, ...t) { ((this.parts[group] ||= {})[mat] ||= []).push(bake(geo, ...t)); return this; }
  det(group, mat, geo, ...t) { return this.add(group, mat + '~', geo, ...t); }
  // a standalone animated piece: { geo, mat, group, at }
  piece(name, group, mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { geo.userData.cached = true; this.keep[name] = { geo, mat, group, at: [x, y, z, rx, ry, rz] }; return this; }
  done() { for (const g of Object.values(this.parts)) for (const k of Object.keys(g)) g[k] = merge(g[k]); return this; }
}
const CACHE = {};

// ===================================================================================================
// Per-type builders. d = Design, E = elite form. Units are model units (root is scaled by Enemy.scale).
// rig = pivot positions of the animated groups (all children of `body`).
const BUILD = {};

// ---- shared humanoid pieces ----
function leg(d, g, s, { th = 0.11, sh = 0.09, len = 0.8, foot = [0.2, 0.12, 0.34], digi = 0.0 }) {
  d.add(g, 'dark', cyl(th, th * 0.8, len * 0.5), 0, -len * 0.25, digi * 0.5, digi);
  d.add(g, 'metal', box(th * 1.7, 0.13, 0.12), 0, -len * 0.5, 0.06 + digi * 0.5, 0.35);     // knee cap
  d.add(g, 'metal', cyl(sh, sh * 0.75, len * 0.48), 0, -len * 0.74, -digi * 0.2, -digi * 0.6);
  d.add(g, 'dark', box(...foot), 0, -len + foot[1] / 2, foot[2] * 0.2);
  d.det(g, 'dark', cyl(0.025, 0.025, len * 0.45, 4), s * th * 0.9, -len * 0.45, -0.06, 0.2);  // hydraulic line
}

// ACOLYTE - expendable scrap infantry: lean, hunched forward, cracked chest plate over an exposed core,
// uneven arms (a three-claw hand and a heavier scrap cleaver).
BUILD.acolyte = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.1, sh: 0.08, len: 0.82, digi: 0.25 }));
  d.add('body', 'dark', box(0.42, 0.2, 0.28), 0, 0.92, 0);                                 // pelvis
  d.add('body', 'main', cyl(0.28, 0.19, 0.62, 6), 0, 1.33, 0.06, 0.38, PI / 6, 0, 1, 1, 0.72); // hunched torso
  d.add('body', 'metal', box(0.3, 0.3, 0.06), 0.07, 1.44, 0.27, 0.38, 0.12, 0.12);          // cracked chest plate (right)
  d.add('body', 'main', box(0.14, 0.18, 0.05), -0.13, 1.5, 0.27, 0.42, -0.2, -0.3);          // broken plate shard (left)
  d.add('body', 'dark', box(0.22, 0.5, 0.12), 0, 1.38, -0.16, 0.38);                        // spine housing
  for (let i = 0; i < 3; i++) d.add('body', 'metal', box(0.12, 0.07, 0.1), 0, 1.18 + i * 0.16, -0.24 - i * 0.06, 0.38);
  d.add('body', 'core', oct(0.085), -0.07, 1.31, 0.24);                                     // exposed core
  d.add('body', 'core', box(0.03, 0.22, 0.03), -0.07, 1.2, 0.2, 0.4);                       // glowing conduit
  d.det('body', 'dark', tor(0.12, 0.022, 3, 8), -0.07, 1.31, 0.24, 0.3);                     // core housing ring
  d.det('body', 'dark', cyl(0.02, 0.02, 0.5, 4), 0.14, 1.35, -0.1, 0.9, 0, 0.3);             // loose cable
  d.add('body', 'metal', cyl(0.06, 0.08, 0.22, 5), 0, 1.66, 0.14, 0.7);                      // neck
  // head (bone mask, jutting jaw, choir pipes)
  d.add('head', 'mask', box(0.28, 0.26, 0.3), 0, 0.06, 0.04);
  d.add('head', 'mask', box(0.22, 0.1, 0.18), 0, -0.1, 0.12, 0.25);                        // jaw
  d.add('head', E ? 'eye2' : 'eye', box(0.22, 0.045, 0.03), 0, 0.09, 0.2);
  d.add('head', 'dark', box(0.32, 0.06, 0.34), 0, 0.2, 0.0);                               // hood rim
  d.add('head', 'main', cyl(0.025, 0.03, 0.34, 4), 0.09, 0.36, -0.08, -0.3);                // choir pipes
  d.add('head', 'main', cyl(0.025, 0.03, 0.44, 4), -0.07, 0.4, -0.12, -0.45);
  // left arm: lean, three-claw hand
  d.add('armL', 'dark', cyl(0.07, 0.06, 0.4), 0, -0.2, 0);
  d.add('armL', 'metal', box(0.13, 0.36, 0.13), 0, -0.52, 0.02);
  for (const [x, rz] of [[0.05, -0.2], [0, 0], [-0.05, 0.2]]) d.add('armL', 'mask', cone(0.03, 0.26, 4), x, -0.8, 0.08, 0.3, 0, rz + PI);
  // right arm: heavier, ends in a scrap cleaver
  d.add('armR', 'main', box(0.2, 0.16, 0.22), 0, -0.02, 0);                                  // shoulder lump
  d.add('armR', 'dark', cyl(0.08, 0.07, 0.42), 0, -0.24, 0);
  d.add('armR', 'metal', box(0.16, 0.34, 0.16), 0, -0.56, 0.0);
  d.add('armR', 'metal', slab([[-0.05, 0.12], [0.07, 0.1], [0.11, -0.36], [-0.02, -0.46], [-0.07, -0.1]], 0.035), 0, -0.74, 0.1, 0, PI / 2);
  d.add('armR', 'core', box(0.02, 0.4, 0.04), 0, -0.86, 0.2);                               // hot edge
  if (E) {
    sym((s) => { d.add('body', 'metal', box(0.34, 0.09, 0.32), s * 0.36, 1.66, 0.02, 0, 0, -s * 0.35); d.add('body', 'main', box(0.3, 0.06, 0.28), s * 0.38, 1.6, 0.02, 0, 0, -s * 0.5); d.add('body', 'eye2', cone(0.04, 0.22, 4), s * 0.44, 1.78, -0.04, 0, 0, -s * 0.5); });
    d.add('body', 'metal', box(0.36, 0.32, 0.07), -0.02, 1.4, 0.29, 0.38);                  // full war-plate
    d.add('body', 'eye2', oct(0.11), 0, 1.4, 0.34);                                          // amber war-core
    d.add('body', 'dark', cyl(0.1, 0.1, 0.34, 6), 0, 1.5, -0.3, 0.38);                      // back canister
    d.add('body', 'eye2', cyl(0.06, 0.06, 0.24, 6), 0, 1.5, -0.37, 0.38);
    d.add('head', 'eye2', slab([[0, 0.3], [0.1, 0], [0.04, 0.02], [0, 0.12], [-0.04, 0.02], [-0.1, 0]], 0.04), 0, 0.22, -0.02); // rank crest
    d.add('armR', 'metal', slab([[-0.06, 0.1], [0.12, 0.1], [0.2, -0.5], [-0.02, -0.66], [-0.08, -0.1]], 0.04), 0, -0.74, 0.12, 0, PI / 2); // bigger cleaver
  }
  return { legL: [0.17, 0.86, 0], legR: [-0.17, 0.86, 0], armL: [0.36, 1.58, 0.1], armR: [-0.38, 1.58, 0.1], head: [0, 1.8, 0.24] };
};

// BULWARK - heavy bruiser: wide, overlapping plates, sunken head, a slab shield and a piston hammer fist.
BUILD.bulwark = (d, E) => {
  sym((s) => { const g = s > 0 ? 'legL' : 'legR';
    d.add(g, 'dark', cyl(0.17, 0.14, 0.44), 0, -0.2, 0);
    d.add(g, 'metal', box(0.3, 0.24, 0.16), 0, -0.4, 0.1, 0.25);                            // knee guard
    d.add(g, 'main', cyl(0.15, 0.17, 0.36), 0, -0.6, 0);
    d.add(g, 'dark', box(0.34, 0.16, 0.44), 0, -0.73, 0.06);                                // heavy foot
    d.add(g, 'metal', box(0.36, 0.06, 0.12), 0, -0.68, 0.26);
    d.det(g, 'metal', cyl(0.05, 0.05, 0.12, 5), s * 0.16, -0.4, 0, 0, 0, PI / 2);            // knee bolt
  });
  d.add('body', 'dark', box(0.74, 0.28, 0.46), 0, 0.92, 0);                                 // hips
  d.add('body', 'main', box(1.0, 0.7, 0.62), 0, 1.36, 0);                                   // barrel torso
  for (let i = 0; i < 3; i++) d.add('body', i % 2 ? 'metal' : 'main', box(0.86 - i * 0.1, 0.2, 0.1), 0, 1.58 - i * 0.2, 0.32 + i * 0.015, -0.14); // overlapping chest plates
  d.add('body', 'core', box(0.34, 0.06, 0.05), 0, 1.12, 0.35);                               // furnace slot
  d.det('body', 'dark', box(0.4, 0.02, 0.04), 0, 1.17, 0.36);
  d.add('body', 'dark', box(0.8, 0.5, 0.18), 0, 1.4, -0.36);                                // back frame
  sym((s) => { d.add('body', 'dark', cyl(0.07, 0.08, 0.5, 6), s * 0.24, 1.86, -0.38, -0.2); d.add('body', 'core', cyl(0.06, 0.06, 0.05, 6), s * 0.24, 2.11, -0.43, -0.2); }); // exhaust stacks
  // pauldrons: 3 stacked plates each side, asymmetric (left bigger: shield side)
  sym((s) => { const k = s > 0 ? 1.0 : 0.85; for (let i = 0; i < 3; i++) d.add('body', i === 1 ? 'metal' : 'main', box(0.4 * k, 0.1, 0.56 * k), s * (0.5 + i * 0.04), 1.78 - i * 0.12, 0, 0, 0, -s * (0.3 + i * 0.18)); });
  d.add('body', 'dark', box(0.5, 0.26, 0.4), 0, 1.66, 0.12);                                // collar
  d.add('head', 'mask', box(0.34, 0.3, 0.34), 0, 0.05, 0.02);
  d.add('head', 'metal', box(0.4, 0.12, 0.38), 0, 0.2, 0.0);                               // helm brow
  d.add('head', E ? 'eye2' : 'eye', box(0.26, 0.04, 0.03), 0, 0.06, 0.2);
  d.add('head', 'metal', box(0.06, 0.2, 0.06), 0, -0.04, 0.2);                               // face bar
  // left arm: slab shield
  d.add('armL', 'dark', cyl(0.13, 0.11, 0.42), 0, -0.22, 0);
  d.add('armL', 'metal', box(0.3, 0.46, 0.3), 0, -0.62, 0);
  d.add('armL', 'main', slab([[-0.4, 0.55], [0.4, 0.55], [0.46, -0.3], [0.2, -0.6], [-0.3, -0.55], [-0.45, 0.1]], 0.1), 0.18, -0.56, 0.1, 0, PI / 2);
  d.add('armL', 'metal', box(0.06, 0.9, 0.12), 0.24, -0.56, 0.1);
  d.add('armL', 'core', box(0.04, 0.5, 0.05), 0.24, -0.56, 0.48);                             // hot stripe
  for (const [y, z] of [[-0.2, -0.24], [-0.2, 0.42], [-0.92, -0.18], [-0.86, 0.38]]) d.det('armL', 'dark', cyl(0.04, 0.04, 0.06, 5), 0.24, y, z, 0, 0, PI / 2); // rivets
  // right arm: piston hammer fist
  d.add('armR', 'dark', cyl(0.14, 0.12, 0.42), 0, -0.22, 0);
  d.add('armR', 'metal', box(0.32, 0.4, 0.32), 0, -0.6, 0);
  d.add('armR', 'dark', cyl(0.05, 0.05, 0.4, 6), 0.12, -0.52, -0.14);                       // piston
  d.add('armR', 'main', box(0.48, 0.42, 0.48), 0, -0.98, 0);                                // hammer head
  d.add('armR', 'metal', box(0.52, 0.08, 0.52), 0, -0.84, 0);
  d.add('armR', 'metal', box(0.52, 0.08, 0.52), 0, -1.12, 0);
  if (E) {
    sym((s) => { for (const z of [-0.18, 0.06, 0.28]) d.add('body', 'metal', cone(0.07, 0.3, 4), s * 0.78, 1.9, z, 0, 0, -s * 0.5); });
    d.add('body', 'eye2', oct(0.16), 0, 1.36, 0.36);                                         // furnace war-core
    d.add('body', 'metal', box(1.06, 0.12, 0.66), 0, 1.06, 0);                               // armour belt
    d.add('head', 'eye2', slab([[0, 0.34], [0.14, 0], [0.05, 0.03], [0, 0.14], [-0.05, 0.03], [-0.14, 0]], 0.05), 0, 0.24, -0.04);
    d.add('armL', 'metal', box(0.08, 1.0, 0.9), 0.34, -0.56, 0.08);                          // second shield layer
    d.add('armL', 'eye2', box(0.05, 0.7, 0.06), 0.39, -0.56, 0.08);
    d.add('armR', 'metal', cone(0.07, 0.22, 4), 0, -1.26, 0, PI);                            // spiked hammer
    sym((s) => d.add('armR', 'metal', cone(0.06, 0.2, 4), s * 0.28, -0.98, 0, 0, 0, -s * PI / 2));
  }
  return { legL: [0.26, 0.8, 0], legR: [-0.26, 0.8, 0], armL: [0.62, 1.6, 0], armR: [-0.62, 1.6, 0], head: [0, 1.76, 0.16] };
};

// CANTOR LANCER - precision sniper/charger: angular, a tall mantle, and a long integrated lance with
// glowing channels and coil rings (the charge mechanism) that light up during the aim.
BUILD.lancer = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.09, sh: 0.075, len: 0.86, foot: [0.14, 0.1, 0.32] }));
  d.add('body', 'dark', box(0.36, 0.2, 0.26), 0, 0.96, 0);
  d.add('body', 'main', oct(0.4), 0, 1.4, 0, 0, PI / 4, 0, 0.8, 1.0, 0.5);                  // angular chest
  d.add('body', 'metal', box(0.24, 0.36, 0.05), 0.05, 1.42, 0.17, -0.12, 0.2);               // offset plate
  d.add('body', 'core', box(0.03, 0.3, 0.03), -0.1, 1.42, 0.19);                             // energy channel
  sym((s) => d.add('body', 'metal', slab([[0, 0], [0.32, 0.08], [0.36, -0.06], [0.1, -0.12]], 0.3), s * 0.18, 1.72, 0, 0, 0, s > 0 ? 0 : PI)); // blade shoulders
  d.add('body', 'dark', slab([[-0.34, 0.2], [0.34, 0.2], [0.4, -0.9], [0.1, -1.05], [-0.18, -0.95], [-0.4, -0.85]], 0.05), 0, 1.66, -0.26, 0.1); // cantor's mantle
  d.det('body', 'core', box(0.02, 0.8, 0.02), 0.2, 1.26, -0.29, 0.1);
  d.add('body', 'metal', cyl(0.05, 0.07, 0.2, 5), 0, 1.84, 0);
  d.add('head', 'mask', cone(0.17, 0.42, 4), 0, 0.08, 0.02, -0.15, PI / 4);                  // narrow helm
  d.add('head', 'red', box(0.2, 0.04, 0.03), 0, 0.04, 0.14);                                // red sensor
  d.add('head', E ? 'eye2' : 'eye', box(0.06, 0.06, 0.03), 0, -0.04, 0.15);
  d.add('head', 'dark', box(0.04, 0.3, 0.2), 0, 0.28, -0.08, -0.5);                          // sensor fin
  d.add('armL', 'dark', cyl(0.06, 0.05, 0.44), 0, -0.22, 0);
  d.add('armL', 'metal', box(0.12, 0.36, 0.12), 0, -0.6, 0);
  // right arm = the lance (it points forward along +z from the hand)
  d.add('armR', 'dark', cyl(0.07, 0.06, 0.4), 0, -0.2, 0);
  d.add('armR', 'metal', box(0.18, 0.4, 0.18), 0, -0.6, 0);
  d.add('armR', 'dark', cyl(0.08, 0.06, 1.6, 6), 0, -0.75, 0.5, PI / 2);                    // lance shaft
  d.add('armR', 'metal', cone(0.09, 0.5, 4), 0, -0.75, 1.5, PI / 2);                        // tip
  for (const z of [0.0, 0.18, 0.36]) d.add('armR', 'metal', tor(0.12, 0.03, 4, 10), 0, -0.75, z);   // coil rings
  sym((s) => d.add('armR', 'core', box(0.02, 0.02, 1.2), s * 0.07, -0.75, 0.7));            // channels
  d.det('armR', 'dark', box(0.04, 0.16, 0.5), 0, -0.62, 0.2);                               // capacitor
  d.piece('charge', 'armR', 'red', sph(0.11, 6, 4), 0, -0.75, 1.3);                          // charge glow (scaled by the aim)
  if (E) {
    sym((s) => d.add('armR', 'metal', cone(0.05, 0.6, 4), s * 0.14, -0.75, 1.35, PI / 2, 0, 0)); // twin prongs
    sym((s) => d.add('body', 'metal', slab([[0, 0], [0.12, 0.5], [0.04, 0.5]], 0.04), s * 0.14, 1.7, -0.3, -0.5, 0, s * 0.3)); // back fins
    d.add('body', 'eye2', oct(0.08), 0.05, 1.42, 0.22);
    d.add('head', 'eye2', slab([[0, 0.3], [0.08, 0], [0, 0.08], [-0.08, 0]], 0.04), 0, 0.3, 0.06);
    d.add('armL', 'metal', box(0.2, 0.5, 0.06), 0.06, -0.55, 0.1);                           // bracer
  }
  return { legL: [0.15, 0.88, 0], legR: [-0.15, 0.88, 0], armL: [0.38, 1.66, 0], armR: [-0.4, 1.66, 0], head: [0, 1.96, 0.02] };
};

// SLAG SPITTER - ranged: tall and narrow on stilt legs, a caged molten reservoir on its back feeding a
// long emitter snout; the throat chamber swells and glows while it charges a bolt.
BUILD.spitter = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.075, sh: 0.06, len: 0.98, foot: [0.16, 0.08, 0.3], digi: 0.4 }));
  d.add('body', 'dark', box(0.32, 0.18, 0.24), 0, 1.06, 0);
  d.add('body', 'main', cyl(0.2, 0.15, 0.5, 6), 0, 1.36, 0.02, 0.25, 0, 0, 1, 1, 0.8);
  d.add('body', 'metal', box(0.22, 0.26, 0.05), 0, 1.38, 0.16, 0.25);
  // reservoir: glowing tank inside a dark cage
  const tanks = E ? [0.14, -0.14] : [0];
  for (const x of tanks) {
    d.add('body', 'spit', cyl(0.15, 0.15, 0.5, 7), x, 1.5, -0.3, 0.3);
    for (const y of [-0.2, 0, 0.2]) d.add('body', 'dark', tor(0.17, 0.03, 3, 8), x, 1.5 + y * 0.95, -0.3 + y * 0.3, PI / 2 + 0.3);
    d.add('body', 'dark', cyl(0.12, 0.16, 0.08, 7), x, 1.76, -0.38, 0.3);
  }
  d.add('body', 'dark', cyl(0.035, 0.035, 0.5, 4), 0, 1.7, -0.06, 1.1);                     // feed hose
  d.det('body', 'spit', box(0.03, 0.03, 0.28), 0.05, 1.42, 0.17);                            // gauge
  d.add('body', 'metal', cyl(0.05, 0.06, 0.18, 5), 0, 1.66, 0.12, 0.6);
  // head: bone mask + long emitter snout (bolts leave from here, y = 1.6)
  d.add('head', 'mask', box(0.24, 0.22, 0.26), 0, 0.04, -0.02);
  d.add('head', E ? 'eye2' : 'eye', box(0.03, 0.03, 0.03), 0.07, 0.1, 0.11);
  d.add('head', E ? 'eye2' : 'eye', box(0.03, 0.03, 0.03), -0.07, 0.1, 0.11);
  d.add('head', E ? 'eye2' : 'eye', box(0.025, 0.025, 0.03), 0.04, 0.15, 0.1);
  d.add('head', 'dark', cyl(0.07, 0.1, 0.34, 7), 0, -0.04, 0.24, PI / 2);                  // emitter
  d.add('head', 'metal', tor(0.1, 0.028, 4, 10), 0, -0.04, 0.42);                            // muzzle ring
  if (E) d.add('head', 'metal', cyl(0.16, 0.1, 0.1, 7), 0, -0.04, 0.46, PI / 2);            // flared muzzle
  d.piece('chamber', 'head', 'spit', sph(0.09, 8, 6), 0, -0.04, 0.3);                        // charging chamber
  sym((s) => { const g = s > 0 ? 'armL' : 'armR';
    d.add(g, 'dark', cyl(0.05, 0.04, 0.38), 0, -0.19, 0);
    d.add(g, 'metal', box(0.09, 0.32, 0.09), 0, -0.52, 0.02);
    d.add(g, 'mask', cone(0.04, 0.18, 4), 0, -0.76, 0.04, 0, 0, PI);
  });
  if (E) {
    d.add('body', 'metal', box(0.5, 0.08, 0.3), 0, 1.62, 0.02, 0, 0, 0);                    // mantle plate
    d.add('head', 'eye2', slab([[0, 0.26], [0.08, 0], [0, 0.07], [-0.08, 0]], 0.04), 0, 0.16, -0.06);
  }
  return { legL: [0.13, 1.02, 0], legR: [-0.13, 1.02, 0], armL: [0.26, 1.58, 0.04], armR: [-0.26, 1.58, 0.04], head: [0, 1.66, 0.12] };
};

// RIPPER HOUND - low mechanical predator: long chassis with a spine ridge, reverse-jointed hind legs,
// blade-claw forelegs, a sensor-array head with a hinged jaw.
BUILD.hound = (d, E) => {
  d.add('body', 'main', cyl(0.24, 0.2, 1.1, 6), 0, 0.8, -0.05, PI / 2, 0, 0, 1.1, 1, 0.85); // chassis
  d.add('body', 'dark', box(0.34, 0.26, 0.62), 0, 0.72, 0.05);                              // rib cage
  for (let i = 0; i < 5; i++) d.add('body', 'metal', box(0.14, 0.12, 0.2), 0, 1.0 - i * 0.015, 0.36 - i * 0.2, -0.2);  // spine ridge
  d.add('body', 'core', box(0.18, 0.04, 0.3), 0, 0.58, 0.08);                                // belly vent glow
  sym((s) => d.add('body', 'main', box(0.06, 0.24, 0.5), s * 0.24, 0.8, -0.1, 0, 0, s * 0.15)); // flank plates
  d.det('body', 'dark', cyl(0.025, 0.025, 0.7, 4), 0.14, 0.92, -0.1, PI / 2);
  d.add('body', 'metal', cyl(0.09, 0.11, 0.3, 6), 0, 0.92, 0.5, 1.0);                         // neck
  d.add('head', 'mask', box(0.3, 0.2, 0.34), 0, 0.02, 0.06);                                // skull
  d.add('head', 'metal', box(0.22, 0.12, 0.3), 0, 0.02, 0.32, 0.1);                         // snout
  for (const [x, y] of [[0.08, 0.08], [-0.08, 0.08], [0.05, 0.13], [-0.05, 0.13]]) d.add('head', E ? 'eye2' : 'eye', box(0.04, 0.03, 0.03), x, y, 0.24);
  sym((s) => d.add('head', 'dark', cone(0.04, 0.18, 4), s * 0.11, 0.16, -0.08, -0.7));     // ear antennae
  d.add('jaw', 'dark', box(0.2, 0.06, 0.34), 0, 0, 0.17);
  for (const x of [0.07, 0, -0.07]) d.add('jaw', 'mask', cone(0.02, 0.07, 4), x, 0.05, 0.3);
  d.add('tail', 'dark', cyl(0.03, 0.02, 0.5, 4), 0, 0.08, -0.22, -1.0);
  d.add('tail', 'core', box(0.04, 0.04, 0.04), 0, 0.27, -0.38);
  // legs: front two blade-claw legs, hind two reverse-jointed
  for (const [g, s, front] of [['leg0', 1, true], ['leg1', -1, true], ['leg2', 1, false], ['leg3', -1, false]]) {
    if (front) {
      d.add(g, 'dark', cyl(0.06, 0.05, 0.36, 5), 0, -0.18, 0.02);
      d.add(g, 'metal', box(0.08, 0.32, 0.08), 0, -0.48, 0.06);
      d.add(g, 'metal', slab([[0, 0], [0.04, 0.02], [0.02, -0.2], [-0.03, -0.24]], 0.03), 0, -0.6, 0.16, 0, PI / 2, -1.2); // blade claw
      d.add(g, 'mask', cone(0.025, 0.12, 4), 0, -0.64, 0.14, 1.4);
    } else {
      d.add(g, 'main', box(0.12, 0.34, 0.16), 0, -0.14, -0.08, 0.5);                        // thigh (angled back)
      d.add(g, 'metal', cyl(0.045, 0.04, 0.34, 5), 0, -0.4, -0.12, -0.45);                  // shin forward
      d.add(g, 'dark', box(0.1, 0.06, 0.2), 0, -0.57, 0.0);
      d.det(g, 'dark', cyl(0.02, 0.02, 0.3, 4), s * 0.06, -0.24, -0.05, 0.2);              // tendon piston
    }
  }
  if (E) {
    d.add('body', 'metal', box(0.44, 0.08, 0.6), 0, 1.02, -0.05);                           // armour saddle
    for (let i = 0; i < 4; i++) d.add('body', 'eye2', cone(0.045, 0.22, 4), 0, 1.14, 0.3 - i * 0.2, -0.3);  // back spikes
    d.add('head', 'eye2', slab([[0, 0.22], [0.08, 0], [0, 0.06], [-0.08, 0]], 0.04), 0, 0.12, -0.02, -0.3);
    sym((s) => d.add('jaw', 'metal', cone(0.03, 0.14, 4), s * 0.1, 0.06, 0.32));
  }
  return { leg0: [0.2, 0.62, 0.38], leg1: [-0.2, 0.62, 0.38], leg2: [0.2, 0.66, -0.42], leg3: [-0.2, 0.66, -0.42], head: [0, 0.98, 0.66], jaw: [0, 0.94, 0.62], tail: [0, 0.9, -0.62] };
};

// MITE - tiny skittering drone: round shell, one big eye, splayed spider legs.
BUILD.mite = (d, E) => {
  d.add('body', 'main', sph(0.42, 8, 5), 0, 0.62, -0.05, 0, 0, 0, 1, 0.7, 1.05);
  d.add('body', 'metal', box(0.5, 0.08, 0.6), 0, 0.88, -0.05, -0.08);                       // shell ridge
  d.add('body', 'mask', box(0.44, 0.26, 0.12), 0, 0.62, 0.38);
  d.add('body', E ? 'eye2' : 'eye', box(0.16, 0.12, 0.04), 0, 0.64, 0.45);                  // single big eye
  d.add('body', 'core', box(0.1, 0.06, 0.12), 0, 0.42, -0.36);                               // thruster glow
  sym((s) => d.add('body', 'dark', cone(0.03, 0.22, 4), s * 0.12, 0.5, 0.48, 1.6));         // mandibles
  d.det('body', 'dark', cyl(0.02, 0.02, 0.3, 4), 0.15, 1.0, -0.1, -0.4);                    // antenna
  for (const g of ['leg0', 'leg1', 'leg2', 'leg3']) {
    const s = g === 'leg0' || g === 'leg2' ? 1 : -1;
    d.add(g, 'dark', cyl(0.05, 0.04, 0.32, 4), s * 0.12, 0.04, 0, 0, 0, -s * 1.1);
    d.add(g, 'metal', cyl(0.04, 0.02, 0.4, 4), s * 0.26, -0.2, 0, 0, 0, s * 0.35);
  }
  if (E) d.add('body', 'eye2', cone(0.06, 0.2, 4), 0, 1.0, -0.05);
  return { leg0: [0.34, 0.56, 0.26], leg1: [-0.34, 0.56, 0.26], leg2: [0.34, 0.56, -0.3], leg3: [-0.34, 0.56, -0.3] };
};

// HIVE SPLITTER - a hunched carrier with a caged brood sac of glowing mite pods on its back.
BUILD.splitter = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.12, sh: 0.1, len: 0.78, foot: [0.22, 0.12, 0.32] }));
  d.add('body', 'dark', box(0.5, 0.22, 0.32), 0, 0.88, 0);
  d.add('body', 'main', cyl(0.36, 0.28, 0.6, 7), 0, 1.3, 0.06, 0.25, 0, 0, 1, 1, 0.8);
  d.add('body', 'metal', box(0.4, 0.22, 0.06), 0, 1.42, 0.3, 0.3);
  d.add('body', 'mask', box(0.3, 0.06, 0.06), 0, 1.24, 0.31, 0.25);
  // brood frame + sac
  d.add('body', 'dark', box(0.62, 0.08, 0.08), 0, 1.78, -0.36);
  d.add('body', 'dark', box(0.62, 0.08, 0.08), 0, 1.0, -0.4);
  sym((s) => d.add('body', 'dark', box(0.06, 0.86, 0.08), s * 0.3, 1.39, -0.4));
  d.add('body', 'main', sph(0.3, 7, 5), 0, 1.38, -0.32, 0, 0, 0, 1, 1.15, 0.7);              // sac
  d.det('body', 'dark', tor(0.3, 0.02, 3, 10), 0, 1.38, -0.33, 0, 0, 0);
  d.piece('pods', 'body', 'pod', oct(0.13), 0, 0, 0);                                         // pods (instanced 3x by enemy.js)
  d.add('body', 'metal', cyl(0.07, 0.09, 0.2, 5), 0, 1.66, 0.16, 0.6);
  d.add('head', 'mask', box(0.32, 0.28, 0.3), 0, 0.04, 0.04);
  d.add('head', E ? 'eye2' : 'eye', box(0.24, 0.05, 0.03), 0, 0.07, 0.2);
  d.add('head', 'dark', box(0.36, 0.06, 0.34), 0, 0.2, 0.02);
  sym((s) => { const g = s > 0 ? 'armL' : 'armR';
    d.add(g, 'dark', cyl(0.08, 0.07, 0.36), 0, -0.18, 0);
    d.add(g, 'metal', box(0.15, 0.3, 0.15), 0, -0.48, 0.02);
    d.add(g, 'mask', slab([[0, 0], [0.06, -0.04], [0.02, -0.3], [-0.06, -0.26]], 0.04), 0, -0.6, 0.06, 0, PI / 2); // hook
  });
  if (E) {
    sym((s) => d.add('body', 'metal', box(0.32, 0.1, 0.34), s * 0.4, 1.62, 0.04, 0, 0, -s * 0.4));
    d.add('body', 'eye2', oct(0.1), 0, 1.38, 0.34);
    d.add('head', 'eye2', slab([[0, 0.28], [0.1, 0], [0, 0.08], [-0.1, 0]], 0.04), 0, 0.22, -0.02);
  }
  return { legL: [0.2, 0.82, 0], legR: [-0.2, 0.82, 0], armL: [0.46, 1.52, 0.08], armR: [-0.46, 1.52, 0.08], head: [0, 1.8, 0.22] };
};

// THURIBLE MONK - a robed brute swinging a caged burning censer on a chain (the orbit is built by enemy.js
// from the pieces here because its length depends on the real censer radius).
BUILD.thurible = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.12, sh: 0.1, len: 0.72, foot: [0.22, 0.12, 0.34] }));
  d.add('body', 'dark', cone(0.52, 1.0, 7), 0, 0.86, -0.02);                                // robe skirt
  d.add('body', 'main', cyl(0.34, 0.4, 0.6, 7), 0, 1.38, 0);                                // torso
  d.add('body', 'dark', cyl(0.5, 0.42, 0.24, 7), 0, 1.66, 0, 0.1);                          // shoulder cowl
  d.add('body', 'metal', box(0.5, 0.06, 0.5), 0, 1.06, 0);                                  // belt of chain
  d.add('body', 'core', box(0.12, 0.12, 0.05), 0, 1.06, 0.26);                              // ember buckle
  for (let i = 0; i < 3; i++) d.det('body', 'metal', cone(0.03, 0.12, 4), -0.2 + i * 0.2, 1.0, 0.27, PI);   // hanging hooks
  d.add('head', 'dark', cone(0.3, 0.55, 6), 0, 0.12, -0.04);                                // hood
  d.add('head', 'mask', box(0.24, 0.24, 0.12), 0, 0.0, 0.14);
  d.add('head', E ? 'eye2' : 'eye', box(0.16, 0.035, 0.03), 0, 0.03, 0.21);
  d.add('head', 'censer', box(0.05, 0.08, 0.02), 0, -0.07, 0.21);                           // smouldering mouth slit
  sym((s) => { const g = s > 0 ? 'armL' : 'armR';
    d.add(g, 'dark', cyl(0.1, 0.12, 0.44, 6), 0, -0.22, 0);                                 // sleeve
    d.add(g, 'metal', box(0.18, 0.18, 0.18), 0, -0.52, 0.02);
  });
  // censer pieces (orbit)
  d.piece('censer', 'orbit', 'censer', ico(0.26), 0, 0, 0);
  d.add('cage', 'dark', tor(0.3, 0.035, 3, 8), 0, 0, 0, PI / 2);
  d.add('cage', 'dark', tor(0.3, 0.035, 3, 8), 0, 0, 0, 0, 0, 0);
  d.add('cage', 'metal', cone(0.24, 0.18, 6), 0, 0.3, 0);                                   // lid
  d.add('cage', 'metal', cyl(0.12, 0.18, 0.1, 6), 0, -0.3, 0);
  if (E) {
    for (const [x, z] of [[0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]]) d.add('cage', 'metal', cone(0.06, 0.2, 4), x, 0, z, z ? (z > 0 ? PI / 2 : -PI / 2) : 0, 0, x ? (x > 0 ? -PI / 2 : PI / 2) : 0);
    d.add('body', 'metal', box(0.9, 0.1, 0.56), 0, 1.78, 0);                                 // mantle armour
    sym((s) => d.add('body', 'metal', cone(0.06, 0.26, 4), s * 0.44, 1.92, 0, 0, 0, -s * 0.4));
    d.add('head', 'eye2', slab([[0, 0.3], [0.1, 0], [0, 0.08], [-0.1, 0]], 0.04), 0, 0.42, -0.02);
  }
  d.add('chain', 'dark', box(0.05, 0.05, 1), 0, 0, 0.5);                                    // unit-length chain (scaled on z)
  return { legL: [0.2, 0.76, 0], legR: [-0.2, 0.76, 0], armL: [0.5, 1.6, 0], armR: [-0.5, 1.6, 0], head: [0, 1.86, 0.06] };
};

// OIL MENDER - stays back and heals: a hunched field medic with twin oil tanks, injector arms and a halo.
BUILD.mender = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.1, sh: 0.08, len: 0.8, digi: 0.2 }));
  d.add('body', 'dark', box(0.4, 0.2, 0.28), 0, 0.92, 0);
  d.add('body', 'main', cyl(0.28, 0.22, 0.6, 6), 0, 1.34, 0.04, 0.3, 0, 0, 1, 1, 0.75);
  d.add('body', 'metal', box(0.3, 0.3, 0.05), 0, 1.4, 0.24, 0.3);
  d.add('body', 'mend', box(0.08, 0.2, 0.03), 0, 1.4, 0.27, 0.3);                           // green cross
  d.add('body', 'mend', box(0.2, 0.07, 0.03), 0, 1.42, 0.27, 0.3);
  for (const x of E ? [-0.24, 0, 0.24] : [-0.14, 0.14]) {
    d.add('body', 'mend', cyl(0.12, 0.12, 0.56, 7), x, 1.36, -0.32, 0.25);
    d.add('body', 'dark', cyl(0.14, 0.14, 0.06, 7), x, 1.64, -0.39, 0.25);
    d.add('body', 'dark', cyl(0.14, 0.14, 0.06, 7), x, 1.1, -0.26, 0.25);
  }
  d.det('body', 'dark', cyl(0.025, 0.025, 0.6, 4), 0.2, 1.5, -0.05, 1.2, 0, 0.3);
  d.add('body', 'metal', cyl(0.06, 0.07, 0.2, 5), 0, 1.66, 0.12, 0.6);
  d.add('head', 'mask', box(0.28, 0.26, 0.28), 0, 0.04, 0.02);
  sym((s) => { d.add('head', 'metal', cyl(0.06, 0.06, 0.06, 7), s * 0.07, 0.07, 0.17, PI / 2); d.add('head', 'mend', box(0.06, 0.06, 0.02), s * 0.07, 0.07, 0.2); }); // goggles
  d.add('head', 'dark', box(0.14, 0.08, 0.1), 0, -0.07, 0.17);                               // respirator
  sym((s) => { const g = s > 0 ? 'armL' : 'armR';
    d.add(g, 'dark', cyl(0.06, 0.05, 0.4), 0, -0.2, 0);
    d.add(g, 'metal', box(0.11, 0.34, 0.11), 0, -0.54, 0.02);
    d.add(g, 'metal', cyl(0.02, 0.01, 0.26, 4), 0, -0.82, 0.04);                            // injector needle
    d.add(g, 'mend', box(0.05, 0.1, 0.05), 0, -0.68, 0.06);
  });
  d.piece('halo', 'body', 'mend', tor(0.3, 0.035, 4, 16), 0, 2.4, 0, PI / 2);
  if (E) {
    sym((s) => d.add('body', 'metal', box(0.3, 0.08, 0.3), s * 0.34, 1.62, 0.02, 0, 0, -s * 0.4));
    d.add('head', 'eye2', slab([[0, 0.26], [0.09, 0], [0, 0.07], [-0.09, 0]], 0.04), 0, 0.2, -0.02);
  }
  return { legL: [0.16, 0.84, 0], legR: [-0.16, 0.84, 0], armL: [0.36, 1.56, 0.08], armR: [-0.36, 1.56, 0.08], head: [0, 1.8, 0.18] };
};

// GRAVEL GRUB - a segmented burrower: armoured ring segments with glowing gaps, a drill-ring mouth and
// two heavy excavator claws that splay open as it erupts.
BUILD.grub = (d, E) => {
  const segs = ['seg0', 'seg1', 'seg2', 'seg3'];
  segs.forEach((g, i) => {
    const r = 0.38 - i * 0.05;
    d.add(g, i % 2 ? 'dark' : 'main', cyl(r, r * 0.92, 0.36, 7), 0, 0, 0, PI / 2);
    d.add(g, 'metal', cyl(r + 0.04, r + 0.02, 0.16, 7), 0, 0.06, 0.02, PI / 2, 0, 0, 1, 1, 0.75); // top armour band
    d.add(g, 'core', cyl(r * 0.96, r * 0.96, 0.04, 7), 0, 0, -0.19, PI / 2);                   // glowing gap
    d.add(g, 'mask', cone(0.07, 0.2, 4), 0, r + 0.08, 0);                                     // spine stone
    d.det(g, 'dark', box(0.05, 0.05, 0.14), r * 0.9, -r * 0.5, 0);
    d.det(g, 'dark', box(0.05, 0.05, 0.14), -r * 0.9, -r * 0.5, 0);
  });
  // head: drill-ring mouth
  d.add('body', 'mask', cyl(0.36, 0.42, 0.3, 8), 0, 0.42, 0.34, PI / 2);
  d.add('body', 'dark', cyl(0.24, 0.24, 0.06, 8), 0, 0.42, 0.5, PI / 2);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; d.add('body', 'metal', cone(0.05, 0.16, 4), Math.cos(a) * 0.22, 0.42 + Math.sin(a) * 0.22, 0.54, PI / 2 - 0.0, 0, 0); }
  for (const x of [0.13, -0.13]) d.add('body', E ? 'eye2' : 'eye', box(0.06, 0.04, 0.03), x, 0.66, 0.44);
  // excavator claws (jawL / jawR pivot at the head's sides)
  sym((s) => { const g = s > 0 ? 'jawL' : 'jawR';
    d.add(g, 'metal', box(0.1, 0.12, 0.4), 0, 0, 0.2, 0, s * -0.1);
    d.add(g, 'mask', slab([[0, 0], [0.12, 0.02], [0.02, -0.36], [-0.06, -0.3]], 0.08), s * -0.02, 0, 0.42, -PI / 2, 0, 0);
    d.add(g, 'dark', cyl(0.06, 0.06, 0.14, 6), 0, 0, 0, 0, 0, PI / 2);
  });
  if (E) {
    segs.forEach((g, i) => d.add(g, 'eye2', cone(0.06, 0.24, 4), 0.14, 0.4 - i * 0.04, 0, 0, 0, -0.3));
    d.add('body', 'metal', cyl(0.46, 0.46, 0.08, 8), 0, 0.42, 0.24, PI / 2);
    d.add('body', 'eye2', slab([[0, 0.24], [0.1, 0], [0, 0.07], [-0.1, 0]], 0.04), 0, 0.84, 0.3);
  }
  return { seg0: [0, 0.4, 0.02], seg1: [0, 0.37, -0.36], seg2: [0, 0.34, -0.7], seg3: [0, 0.3, -1.02], jawL: [0.34, 0.38, 0.4], jawR: [-0.34, 0.38, 0.4] };
};

// HYMN BOMBER - sprinting explosive: a squat body carrying an unstable core in a banded containment cage,
// two warning lamps and a sparking fuse mast. Everything flickers harder as the fuse burns.
BUILD.bomber = (d, E) => {
  sym((s) => leg(d, s > 0 ? 'legL' : 'legR', s, { th: 0.1, sh: 0.085, len: 0.72, foot: [0.18, 0.1, 0.3], digi: 0.3 }));
  d.add('body', 'dark', box(0.42, 0.2, 0.3), 0, 0.84, 0);
  d.add('body', 'main', box(0.56, 0.4, 0.4), 0, 1.12, -0.12, 0.2);                           // hunched back plate
  d.piece('bomb', 'body', 'bomb', ico(0.36), 0, 1.24, 0.2);                                  // unstable core
  for (const y of [-0.22, 0, 0.22]) d.add('body', 'metal', tor(0.38, 0.04, 3, 10), 0, 1.24 + y, 0.2, PI / 2);  // containment bands
  sym((s) => d.add('body', 'dark', box(0.05, 0.62, 0.05), s * 0.33, 1.24, 0.42));
  d.add('body', 'metal', box(0.46, 0.06, 0.3), 0, 1.56, 0.18);                              // cage lid
  d.add('body', 'dark', cyl(0.025, 0.025, 0.44, 4), 0.1, 1.8, 0.1, -0.2);                    // fuse mast
  d.piece('fuse', 'body', 'bomb', box(0.08, 0.14, 0.08), 0.13, 2.02, 0.06);
  d.piece('lamps', 'body', 'warn', box(0.1, 0.08, 0.1), 0, 0, 0);                             // warning lamps (2x)
  d.det('body', 'dark', tor(0.1, 0.02, 3, 8), 0, 1.0, 0.36, 0);                             // hazard stencil ring
  d.add('head', 'mask', box(0.24, 0.22, 0.24), 0, 0.02, 0.02);
  d.add('head', E ? 'eye2' : 'eye', box(0.18, 0.04, 0.03), 0, 0.05, 0.15);
  d.add('head', 'dark', cone(0.18, 0.18, 5), 0, 0.2, 0);
  sym((s) => { const g = s > 0 ? 'armL' : 'armR';
    d.add(g, 'dark', cyl(0.06, 0.05, 0.36), 0, -0.18, 0);
    d.add(g, 'metal', box(0.11, 0.26, 0.11), 0, -0.46, 0.02);
  });
  if (E) {
    d.add('body', 'metal', tor(0.44, 0.05, 3, 10), 0, 1.24, 0.2, 0, 0, 0);                   // reinforced ring
    sym((s) => d.add('body', 'metal', cone(0.05, 0.2, 4), s * 0.46, 1.24, 0.2, 0, 0, -s * PI / 2));
    d.add('head', 'eye2', slab([[0, 0.24], [0.08, 0], [0, 0.06], [-0.08, 0]], 0.04), 0, 0.28, -0.02);
  }
  return { legL: [0.16, 0.76, 0], legR: [-0.16, 0.76, 0], armL: [0.36, 1.34, 0.18], armR: [-0.36, 1.34, 0.18], head: [0, 1.46, -0.04] };
};

// ===================================================================================================
function design(type, elite) {
  const id = type + (elite ? ':e' : '');
  if (CACHE[id]) return CACHE[id];
  const d = new Design();
  d.rig = BUILD[type](d, elite);
  return (CACHE[id] = d.done());
}

// Phase 5C perf pass: every rig group is drawn with at most TWO meshes - one lit mesh (all armour,
// joints and detail parts merged, colour baked into vertex colours, drawn with the enemy's single
// flashable Lambert material) and one unlit glow mesh (eyes, cores, channels; vertex colours, one material
// shared by every enemy). Merged geometry is cached per type + elite form + palette.
const GLOW_VC = new THREE.MeshBasicMaterial({ vertexColors: true }); GLOW_VC.userData.shared = true;
const _c = new THREE.Color();
function paint(list, hexOf) { // list of [key, geometry] -> one merged geometry with a colour attribute
  let n = 0; for (const [, g] of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [k, g] of list) {
    const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    _c.setHex(hexOf(k)); for (let i = 0; i < c; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; }
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.computeBoundingSphere(); out.userData.cached = true;
  return out;
}
const BAKED = {};
// Build one enemy's model. lit = the enemy's own (flashable) vertex-colour Lambert material;
// palette = { main, dark, metal, mask } hex colours; core = the type's glow material.
export function buildEnemyModel(type, elite, lit, palette, core) {
  const d = design(type, elite);
  const glowHex = { core: core.color.getHex(), eye: GLOW.visor.color.getHex(), eye2: GLOW.eliteVisor.color.getHex(), red: GLOW.red.color.getHex(), spit: GLOW.spit.color.getHex(), mend: GLOW.mend.color.getHex(), bomb: GLOW.bomb.color.getHex(), censer: GLOW.censer.color.getHex(), pod: GLOW.pod.color.getHex(), warn: GLOW.warn.color.getHex() };
  const id = type + (elite ? ':e:' : ':') + Object.values(palette).join(',');
  const baked = BAKED[id] || (BAKED[id] = Object.fromEntries(Object.entries(d.parts).map(([gname, byMat]) => {
    const lits = [], glows = [];
    for (const [mk0, geo] of Object.entries(byMat)) { const key = mk0.replace('~', ''); (key in palette ? lits : glows).push([key, geo]); }
    return [gname, { lit: lits.length ? paint(lits, (k) => palette[k]) : null, glow: glows.length ? paint(glows, (k) => glowHex[k]) : null }];
  })));
  const allMats = { core, eye: GLOW.visor, eye2: GLOW.eliteVisor, red: GLOW.red, spit: GLOW.spit, mend: GLOW.mend, bomb: GLOW.bomb, censer: GLOW.censer, pod: GLOW.pod, warn: GLOW.warn };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const groups = { body };
  for (const [name, at] of Object.entries(d.rig)) { const g = new THREE.Group(); g.position.set(...at); body.add(g); groups[name] = g; }
  const mk = (gname) => groups[gname] || (groups[gname] = new THREE.Group()); // cage / chain / orbit are placed by enemy.js
  let caster = null;
  for (const [gname, b] of Object.entries(baked)) {
    if (b.lit) { const m = new THREE.Mesh(b.lit, lit); if (gname === 'body') { m.castShadow = true; caster = m; } mk(gname).add(m); } // one shadow caster per enemy
    if (b.glow) mk(gname).add(new THREE.Mesh(b.glow, GLOW_VC));
  }
  const pieces = {};
  for (const [name, p] of Object.entries(d.keep)) {
    const mesh = new THREE.Mesh(p.geo, allMats[p.mat]);
    mesh.position.set(p.at[0], p.at[1], p.at[2]); mesh.rotation.set(p.at[3], p.at[4], p.at[5]);
    pieces[name] = mesh;
    if (p.group !== 'orbit') mk(p.group).add(mesh);
  }
  return { root, body, groups, pieces, caster, detail: [] };
}
// glow colour of each type's internal energy system (shared material per colour)
const CORE_COL = { acolyte: 0xff6a1a, bulwark: 0xff4a14, lancer: 0xff3a3a, spitter: 0xff8a1e, hound: 0xff7a1a, mite: 0x3ff6e0, splitter: 0xffd23a, thurible: 0xff9a2a, mender: 0x6aff7a, grub: 0x3ff6e0, bomber: 0xffb020 };
const CORE_MATS = {};
export function coreMat(type) { const c = CORE_COL[type] ?? 0xff7a1a; return CORE_MATS[c] || (CORE_MATS[c] = G(c)); }

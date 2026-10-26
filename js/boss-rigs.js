// boss-rigs.js (Phase 5C stage 3): the twelve Grindchoir leaders, REMODELLED from scratch.
// Stage 2 only dressed the original v1.33 primitive bodies; this replaces every visible primitive of the
// old build with a new, much denser body in the same style as the Phase 5C standard enemies
// (enemy-models.js): primitives baked + merged per (animated handle, material), worn / heat-damaged /
// corroded vertex colours, one flashable Lambert per boss + one shared glow material.
// The OLD build still runs first (Boss.buildModel): it creates every animated handle the boss's pose()
// drives (arms, jaw, horn, lungs, drum, heads, segments...). rebuildBoss() then strips the old meshes and
// hangs the new geometry on those same handles, so every existing pose / wind-up drives the new model.
// Everything is authored in BODY space: each handle gets a holder whose matrix undoes the handle's build
// transform, so a piece moves exactly as its handle moves away from its rest pose.
// VISUALS ONLY: never touches position, radius, hp, timers or any synced state; no Math.random.
import * as THREE from 'three';

const PI = Math.PI;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function bake(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv2) g.deleteAttribute('uv2');
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
  g.applyMatrix4(_m);
  return g;
}
// geometry primitives (low-poly, faceted like the standard enemies)
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
export const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
export const sph = (r, w = 9, h = 6) => new THREE.SphereGeometry(r, w, h);
export const oct = (r) => new THREE.OctahedronGeometry(r);
export const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const dod = (r) => new THREE.DodecahedronGeometry(r);
export const tor = (r, t, rs = 4, ts = 14, arc = PI * 2) => new THREE.TorusGeometry(r, t, rs, ts, arc);
// a closed lathe shell: outer profile then the inner one back (so it reads from both sides)
export function shell(outer, thick = 0.04, segs = 12) {
  const pts = outer.map(([r, y]) => new THREE.Vector2(r, y));
  for (let i = outer.length - 1; i >= 0; i--) pts.push(new THREE.Vector2(Math.max(0.001, outer[i][0] - thick), outer[i][1]));
  pts.push(pts[0].clone());
  return new THREE.LatheGeometry(pts, segs);
}
export const lathe = (pts, segs = 10) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);
export function slab(pts, depth) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}
export function tube(pts, r = 0.03, seg = 8, rs = 4) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(c, seg, r, rs, false);
}

// ---- colour: worn / corroded / heat-damaged, per triangle, deterministic ----
const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
const _c = new THREE.Color(), _r = new THREE.Color(), _h = new THREE.Color();
const RUST = new THREE.Color(0x7a3e1c), SOOT = new THREE.Color(0x141210), HEAT = new THREE.Color(0xb0501a);
function paint(g, hex, wear) {
  const pos = g.attributes.position.array, n = pos.length / 3, col = new Float32Array(n * 3);
  _c.set(hex);
  const { rust = 0.25, soot = 0.0, heat = 0.0, var: vr = 0.22 } = wear;
  for (let t = 0; t < n; t += 3) {
    const cx = (pos[t * 3] + pos[t * 3 + 3] + pos[t * 3 + 6]) / 3, cy = (pos[t * 3 + 1] + pos[t * 3 + 4] + pos[t * 3 + 7]) / 3, cz = (pos[t * 3 + 2] + pos[t * 3 + 5] + pos[t * 3 + 8]) / 3;
    const h1 = hash(cx * 7, cy * 7, cz * 7), h2 = hash(cz * 5 + 3, cx * 5, cy * 5);
    _h.copy(_c).multiplyScalar(1 - vr / 2 + vr * h1);
    if (h2 < rust) _h.lerp(RUST, 0.45 * (1 - h2 / Math.max(rust, 1e-3)));
    if (soot > 0 && cy > 0) _h.lerp(SOOT, Math.min(0.6, soot * h1));
    if (heat > 0 && h2 > 1 - heat) _h.lerp(HEAT, 0.5);
    for (let v = 0; v < 3; v++) { const i = (t + v) * 3; col[i] = _h.r; col[i + 1] = _h.g; col[i + 2] = _h.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function glowPaint(g, hex) {
  const n = g.attributes.position.count, col = new Float32Array(n * 3); _c.set(hex);
  for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// one shared glow material for every boss (never flashed, never disposed)
export const GLOW_VC = new THREE.MeshBasicMaterial({ vertexColors: true });
const EMPTY = new THREE.BufferGeometry();

// Rig designer. Group keys: a handle name on the boss ('body', 'armL', 'jaw', 'heads2', 'segments0', 'root'...)
// or a moving part declared with sub(). Coordinates are BODY space at the rest pose.
class Rig {
  constructor(wear) { this.parts = {}; this.subs = []; this.wear = wear; this.weak = []; this.vents = []; }
  h(group, hex, geo, ...t) { return this._add(group, 'h', paint(bake(geo, ...t), hex, this.wear)); }
  hw(group, hex, wear, geo, ...t) { return this._add(group, 'h', paint(bake(geo, ...t), hex, { ...this.wear, ...wear })); }
  e(group, hex, geo, ...t) { return this._add(group, 'e', glowPaint(bake(geo, ...t), hex)); }
  _add(group, kind, g) { ((this.parts[group] ||= { h: [], e: [] })[kind]).push(g); return this; }
  // a moving part with its own pivot (body-space point), parented to handle/sub `parent`
  sub(name, parent, x, y, z) { this.subs.push({ name, parent, at: [x, y, z] }); return name; }
  sym(fn) { fn(1); fn(-1); return this; }
  rivets(group, hex, pts, s = 0.045) { for (const [x, y, z] of pts) this.h(group, hex, box(s, s, s), x, y, z, 0.4, 0.4, 0); return this; }
}

function handlesOf(b) {
  const out = {};
  const add = (k, v) => { if (v && v.isObject3D && !out[k]) out[k] = v; };
  for (const [key, v] of Object.entries(b)) {
    if (key === 'scene' || key === 'world' || key === 'mats' || key === 'partner' || key === 'dress' || key === 'rig') continue;
    if (v && v.isObject3D) add(key, v);
    else if (Array.isArray(v)) v.forEach((x, i) => { if (x && x.isObject3D) add(key + i, x); else if (x && x.obj?.isObject3D) add(key + i, x.obj); });
  }
  return out;
}

// called from dressBoss() right after Boss.buildModel() (root still unscaled at the origin)
export function rebuildBoss(b, design) {
  const H = handlesOf(b); H.root = b.root; H.body = b.body;
  const inRoot = new Set(); b.root.traverse((o) => inRoot.add(o));
  for (const k of Object.keys(H)) if (!inRoot.has(H[k])) delete H[k];
  const keep = new Set(Object.values(H));
  // 1) strip every old mesh that isn't an animated handle; empty the handle meshes
  const all = []; b.root.traverse((o) => all.push(o));
  for (const o of all) {
    if (!o.isMesh) continue;
    if (keep.has(o)) { o.geometry = EMPTY; o.castShadow = false; continue; }
    o.parent.remove(o);
  }
  // 2) design the new body
  const r = new Rig(design.wear || {});
  const P = {};
  design.build(r, b, H);
  b.root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(b.root.matrixWorld).invert();
  const holder = {};
  const holderOf = (key) => {
    if (holder[key]) return holder[key];
    const hd = H[key]; if (!hd) return null;
    const o = new THREE.Object3D(); o.matrixAutoUpdate = false;
    o.matrix.copy(hd.matrixWorld).invert().multiply(b.root.matrixWorld); // child of handle -> body space
    o.matrix.premultiply(new THREE.Matrix4()); // (identity: kept explicit for clarity)
    hd.add(o); o.updateMatrixWorld(true); holder[key] = o; return o;
  };
  void rootInv;
  for (const s of r.subs) {
    const par = holderOf(s.parent) || P[s.parent]?.pivot; if (!par) continue;
    const pivot = new THREE.Group(); pivot.position.set(...s.at);
    const inner = new THREE.Group(); inner.position.set(-s.at[0], -s.at[1], -s.at[2]);
    pivot.add(inner); par.add(pivot);
    P[s.name] = { pivot, inner };
  }
  const hull = b.mats.hull = new THREE.MeshLambertMaterial({ vertexColors: true });
  const geos = [];
  let tris = 0;
  for (const [key, g] of Object.entries(r.parts)) {
    const par = P[key]?.inner || holderOf(key); if (!par) { console.warn('boss rig: no handle', key); continue; }
    if (g.h.length) { const geo = merge(g.h); const m = new THREE.Mesh(geo, hull); m.castShadow = true; m.receiveShadow = false; par.add(m); geos.push(geo); tris += geo.attributes.position.count / 3; }
    if (g.e.length) { const geo = merge(g.e); const m = new THREE.Mesh(geo, GLOW_VC); par.add(m); geos.push(geo); tris += geo.attributes.position.count / 3; }
  }
  b.rig = { id: b.def.id, P, geos, tris: Math.round(tris), anim: design.anim || null, s: {} };
  // weak points / vents for the existing presentation layer (tickDress)
  for (const [key, x, y, z] of r.weak) { const o = new THREE.Object3D(); o.position.set(x, y, z); (P[key]?.inner || holderOf(key) || b.body).add(o); b.dress.weak.push({ o }); }
  for (const v of r.vents) b.dress.vents.push(new THREE.Vector3(...v));
}
export function unrig(b) { for (const g of b.rig?.geos || []) g.dispose(); b.mats?.hull?.dispose?.(); }

// per-frame model-specific motion (called from tickDress)
export function tickRig(b, dt, t) {
  const R = b.rig; if (!R?.anim) return;
  const st = b.state, k = st === 'telegraph' ? Math.min(1, b.stateTime / (b.telegraphTime || 1)) : 0;
  R.anim(b, R.P, t, dt, st, k, R.s);
}

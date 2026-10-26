// cosmetics.js
// Puts the equipped level-up cosmetics (progress.js) on the local hero's blocky model and animates
// them: hats + masks on the head, capes + banners on the back, an aura at the feet and a talon trail.
// Also ARENA SKINS (a themed colour wash + core glow per arena), applied through Player.reskin().
import * as THREE from 'three';
import { COSMETICS } from './progress.js?v=1.33.0-p5c3';

import { disposeModel } from './hero-models.js?v=1.33.0-p5c3';
const BOX = new THREE.BoxGeometry(1, 1, 1); BOX.userData.cached = true;
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const glowMat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
function box(parent, mat, w, h, d, x, y, z, rx = 0, rz = 0) {
  const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; m.castShadow = true; parent.add(m); return m;
}

// one builder per slot; the hero picks the shape so each item is its own thing
const BUILD = {
  hat(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    switch (item.hero) {
      case 'sarrow': { // wide drifter's brim
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 16), m); brim.position.y = 0.25; g.add(brim);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.24, 12), m); crown.position.y = 0.38; g.add(crown);
        box(g, gl, 0.53, 0.04, 0.53, 0, 0.29, 0).scale.set(0.5, 0.04, 0.5); break;
      }
      case 'zaleks': // rivet crown
        box(g, m, 0.5, 0.1, 0.5, 0, 0.3, 0);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(g, i % 2 ? gl : m, 0.09, 0.2, 0.09, Math.sin(a) * 0.22, 0.42, Math.cos(a) * 0.22); }
        break;
      case 'iskra': // needle tiara
        for (let i = -2; i <= 2; i++) box(g, gl, 0.03, 0.18 + (2 - Math.abs(i)) * 0.1, 0.03, i * 0.08, 0.36 + (2 - Math.abs(i)) * 0.05, 0.12, 0, -i * 0.15);
        box(g, m, 0.42, 0.04, 0.06, 0, 0.27, 0.12);
        break;
      case 'ninja': { // ronin kasa: a wide flat cone hat
        const k = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.26, 12), m); k.position.y = 0.36; g.add(k);
        box(g, gl, 0.06, 0.06, 0.06, 0, 0.5, 0); break;
      }
      default: // orin: choir horns
        for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 8), m); c.position.set(s * 0.2, 0.42, -0.02); c.rotation.z = -s * 0.5; g.add(c); box(g, gl, 0.05, 0.05, 0.05, s * 0.3, 0.6, -0.02); }
    }
    return 'head';
  },
  mask(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    switch (item.hero) {
      case 'sarrow': box(g, m, 0.36, 0.16, 0.04, 0, -0.1, 0.27); box(g, m, 0.3, 0.1, 0.04, 0, -0.2, 0.25); break; // ash veil
      case 'zaleks': box(g, m, 0.4, 0.3, 0.05, 0, -0.02, 0.24); for (const y of [-0.1, 0, 0.1]) box(g, gl, 0.34, 0.03, 0.02, 0, y, 0.27); break; // grille
      case 'iskra': box(g, gl, 0.42, 0.07, 0.04, 0, 0.04, 0.26); box(g, m, 0.46, 0.03, 0.05, 0, 0.09, 0.25); break; // lace visor
      case 'ninja': box(g, lam(0xb02a2a), 0.4, 0.2, 0.05, 0, -0.08, 0.24); for (const sx of [-1, 1]) box(g, gl, 0.05, 0.12, 0.05, sx * 0.15, -0.16, 0.27); break; // oni half-mask with fangs
      default: box(g, m, 0.26, 0.2, 0.14, 0, -0.12, 0.3); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), gl); c.rotation.x = Math.PI / 2; c.position.set(0, -0.12, 0.4); g.add(c); // hymn muzzle
    }
    return 'head';
  },
  cape(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    g.position.set(0, 1.72, -0.24);
    const len = item.hero === 'zaleks' ? 1.1 : item.hero === 'ninja' ? 1.4 : 1.25;
    box(g, m, item.hero === 'zaleks' ? 0.85 : 0.6, len, 0.04, 0, -len / 2, 0);
    box(g, gl, item.hero === 'iskra' ? 0.08 : 0.6, 0.05, 0.05, 0, -len + 0.05, 0.005);
    if (item.hero === 'orin') for (const x of [-0.2, 0, 0.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), gl); p.position.set(x, -0.3, -0.04); g.add(p); }
    if (item.hero === 'zaleks') box(g, lam(0x5a4a3a), 0.9, 0.12, 0.1, 0, -0.04, 0.02); // fur collar
    return 'cape';
  },
  aura(item, g) {
    const gl = glowMat(item.glow, 0.55);
    gl.blending = THREE.AdditiveBlending;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.88, 32), gl); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
    const n = item.hero === 'orin' ? 3 : item.hero === 'iskra' ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const b = box(g, glowMat(item.color, 0.85), 0.1, 0.1, 0.1, Math.cos(a) * 0.95, item.hero === 'iskra' ? 1.2 : 0.3, Math.sin(a) * 0.95); b.castShadow = false; }
    return 'aura';
  },
  banner(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    g.position.set(0.2, 1.4, -0.3);
    box(g, lam(0x3a3530), 0.04, 1.4, 0.04, 0, 0.5, 0);
    const flag = box(g, m, 0.04, 0.3, 0.42, 0, 1.05, -0.22);
    box(g, gl, 0.05, 0.06, 0.42, 0, 0.88, -0.22);
    g.userData.flag = flag;
    return 'body';
  },
};


// ---------- Phase 3B GEAR: geometry-changing pieces fitted with the hero's anchors ----------
// a = model.anchors: headTop (head-local top), headW (half width), faceZ (front of the face), back (z of the
// back plate), scale (overall build). Shoulder pieces sit on the real shoulder pivots, so they fit each hero.
const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
function mesh(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = !mat.isMeshBasicMaterial; parent.add(m); return m; }
function slab(pts, depth) { const sh = new THREE.Shape(); sh.moveTo(...pts[0]); for (const q of pts.slice(1)) sh.lineTo(...q); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; }
// weapon geometries (unit height, tip at -0.5, like the hero blades) are shared + cached
const WEAPONS = {};
function weaponGeo(shape) {
  if (WEAPONS[shape]) return WEAPONS[shape];
  let g;
  if (shape === 'serrated') { const pts = [[-0.05, 0.5], [0.05, 0.5]]; for (let i = 0; i < 5; i++) { const y = 0.35 - i * 0.17; pts.push([0.07, y], [0.035, y - 0.08]); } pts.push([0.0, -0.5], [-0.045, 0.1]); g = slab(pts, 0.03); }
  else if (shape === 'prism') { g = new THREE.OctahedronGeometry(0.5, 0); g.scale(0.16, 1, 0.16); }
  else { const r = 0.5, k = 0.18, pts = []; for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2, b = a + Math.PI / 3; pts.push([Math.cos(a) * r, Math.sin(a) * r], [Math.cos(b) * r * k * 2, Math.sin(b) * r * k * 2]); } g = slab(pts, 0.06); }
  g.userData.cached = true; return (WEAPONS[shape] = g);
}
const GEAR = {
  // ---- helmets / hats (head group) ----
  warhelm(it, g, a, m, gl) { const w = a.headW; mesh(g, cyl(w * 0.95, w * 1.1, 0.18, 8), m, 0, a.headTop - 0.08, 0); mesh(g, new THREE.BoxGeometry(0.05, 0.2, w * 2.2), m, 0, a.headTop + 0.06, -0.02); mesh(g, new THREE.BoxGeometry(0.035, 0.12, w * 2.1), gl, 0, a.headTop + 0.12, -0.02); for (const s of [-1, 1]) mesh(g, new THREE.BoxGeometry(0.05, 0.22, w * 0.9), m, s * w * 1.05, a.headTop - 0.2, 0.04); return 'head'; },
  visorhelm(it, g, a, m, gl) { const w = a.headW; mesh(g, new THREE.SphereGeometry(w * 1.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, a.headTop - 0.14, -0.01); mesh(g, new THREE.BoxGeometry(w * 2.1, 0.06, 0.05), gl, 0, a.headTop - 0.17, a.faceZ - 0.01); mesh(g, new THREE.BoxGeometry(0.03, 0.3, 0.03), m, w * 0.9, a.headTop + 0.02, -0.06, -0.4); mesh(g, new THREE.SphereGeometry(0.03, 6, 4), gl, w * 0.9, a.headTop + 0.15, -0.12); return 'head'; },
  crown(it, g, a, m, gl) { const w = a.headW; const ring = mesh(g, new THREE.TorusGeometry(w * 1.05, 0.03, 4, 20), m, 0, a.headTop + 0.12, 0, Math.PI / 2); g.userData.spin = ring; for (let i = 0; i < 5; i++) { const ang = i / 5 * Math.PI * 2; mesh(ring, new THREE.ConeGeometry(0.035, 0.16, 4), gl, Math.cos(ang) * w * 1.05, Math.sin(ang) * w * 1.05, -0.07, -Math.PI / 2); } return 'head'; },
  sensor(it, g, a, m, gl) { const w = a.headW; mesh(g, cyl(0.16, 0.03, 0.05, 10), m, 0, a.headTop + 0.06, -0.04, -0.4); for (const s of [-1, 1]) { mesh(g, cyl(0.012, 0.012, 0.42, 4), m, s * w * 0.8, a.headTop + 0.16, -0.02, 0, 0, -s * 0.2); mesh(g, new THREE.SphereGeometry(0.03, 6, 4), gl, s * (w * 0.8 + 0.04), a.headTop + 0.36, -0.02); } mesh(g, new THREE.BoxGeometry(w * 1.6, 0.04, 0.04), gl, 0, a.headTop - 0.02, 0.06); return 'head'; },
  // ---- masks (head group, on the face) ----
  respirator(it, g, a, m, gl) { const w = a.headW; mesh(g, new THREE.BoxGeometry(w * 1.5, 0.16, 0.08), m, 0, -0.1, a.faceZ + 0.02); for (const s of [-1, 1]) { mesh(g, cyl(0.055, 0.055, 0.1, 8), m, s * w * 0.6, -0.14, a.faceZ + 0.07, Math.PI / 2); mesh(g, cyl(0.035, 0.035, 0.02, 8), gl, s * w * 0.6, -0.14, a.faceZ + 0.125, Math.PI / 2); } return 'head'; },
  kitsune(it, g, a, m, gl) { const w = a.headW; mesh(g, new THREE.BoxGeometry(w * 1.8, 0.24, 0.06), m, 0, -0.03, a.faceZ + 0.02); mesh(g, new THREE.ConeGeometry(0.07, 0.16, 4), m, 0, -0.1, a.faceZ + 0.1, Math.PI / 2); for (const s of [-1, 1]) { mesh(g, new THREE.ConeGeometry(0.06, 0.16, 4), m, s * w * 0.7, 0.16, a.faceZ - 0.02); mesh(g, new THREE.BoxGeometry(0.08, 0.02, 0.02), gl, s * w * 0.42, 0.03, a.faceZ + 0.055, 0, 0, s * 0.3); } return 'head'; },
  // ---- shoulders (body group, on the real shoulder pivots) ----
  pauldron(it, g, a, m, gl, md) { return shoulders(g, md, (p, s, k) => { mesh(p, new THREE.BoxGeometry(0.3 * k, 0.09, 0.36 * k), m, 0, 0.12, 0, 0, 0, -s * 0.35); mesh(p, new THREE.BoxGeometry(0.26 * k, 0.07, 0.32 * k), m, s * 0.05, 0.04, 0, 0, 0, -s * 0.55); mesh(p, new THREE.BoxGeometry(0.31 * k, 0.025, 0.37 * k), gl, 0, 0.09, 0, 0, 0, -s * 0.35); }); },
  spiked(it, g, a, m, gl, md) { return shoulders(g, md, (p, s, k) => { mesh(p, new THREE.BoxGeometry(0.32 * k, 0.12, 0.4 * k), m, 0, 0.12, 0, 0, 0, -s * 0.3); for (const z of [-0.1, 0.1]) mesh(p, new THREE.ConeGeometry(0.045 * k, 0.24 * k, 5), m, s * 0.04, 0.27, z * k, 0, 0, -s * 0.5); mesh(p, new THREE.BoxGeometry(0.33 * k, 0.03, 0.41 * k), gl, 0, 0.07, 0, 0, 0, -s * 0.3); }); },
  pads(it, g, a, m, gl, md) { return shoulders(g, md, (p, s, k) => { mesh(p, new THREE.BoxGeometry(0.2 * k, 0.06, 0.24 * k), m, 0, 0.09, 0, 0, 0, -s * 0.4); mesh(p, new THREE.BoxGeometry(0.03, 0.03, 0.2 * k), gl, s * 0.06, 0.12, 0, 0, 0, -s * 0.4); }); },
  coil(it, g, a, m, gl, md) { return shoulders(g, md, (p, s, k) => { for (const [i, y] of [0.02, 0.1].entries()) mesh(p, new THREE.TorusGeometry(0.13 * k, 0.025, 4, 12), i ? gl : m, 0, y + 0.02, 0, Math.PI / 2); mesh(p, new THREE.SphereGeometry(0.06, 6, 4), gl, 0, 0.2, 0); }); },
  sode(it, g, a, m, gl, md) { return shoulders(g, md, (p, s, k) => { for (let i = 0; i < 3; i++) mesh(p, new THREE.BoxGeometry(0.26 * k, 0.04, 0.3 * k), i === 1 ? gl : m, s * (0.02 + i * 0.035), 0.1 - i * 0.08, 0, 0, 0, -s * 0.75); }); },
  pylon(it, g, a, m, gl, md) { return shoulders(g, md, (p, s, k) => { mesh(p, new THREE.BoxGeometry(0.18 * k, 0.1, 0.22 * k), m, 0, 0.1, 0); mesh(p, cyl(0.03, 0.05, 0.36 * k, 6), m, s * 0.02, 0.32, -0.04); const tip = mesh(p, new THREE.OctahedronGeometry(0.05), gl, s * 0.02, 0.54, -0.04); (g.userData.bob ||= []).push(tip); }); },
  // ---- back pieces (body group) ----
  wings(it, g, a, m, gl, md) { const y = md.armL.position.y - 0.05, k = a.scale; for (const s of [-1, 1]) { const f = mesh(g, slab([[0, 0], [0.62, 0.42], [0.66, 0.3], [0.08, -0.08]], 0.03), m, s * 0.06, y, a.back - 0.04, 0, s > 0 ? 0.35 : Math.PI - 0.35, 0); f.scale.setScalar(k); const e = mesh(g, slab([[0.08, 0.02], [0.64, 0.44], [0.66, 0.4], [0.1, -0.01]], 0.035), gl, s * 0.06, y, a.back - 0.04, 0, s > 0 ? 0.35 : Math.PI - 0.35, 0); e.scale.setScalar(k); } mesh(g, new THREE.BoxGeometry(0.2 * k, 0.24 * k, 0.08), m, 0, y - 0.05, a.back - 0.02); return 'body'; },
  stacks(it, g, a, m, gl, md) { const y = md.armL.position.y + 0.02, k = a.scale; for (const s of [-1, 1]) { mesh(g, cyl(0.07, 0.09, 0.5 * k, 8), m, s * 0.14 * k, y, a.back - 0.08); mesh(g, cyl(0.055, 0.055, 0.04, 8), gl, s * 0.14 * k, y + 0.26 * k, a.back - 0.08); } return 'body'; },
  quiver(it, g, a, m, gl, md) { const y = md.armL.position.y - 0.25, k = a.scale; const q = new THREE.Group(); q.position.set(0.04, y, a.back - 0.07); q.rotation.z = -0.4; g.add(q); mesh(q, cyl(0.08, 0.07, 0.5 * k, 8), m, 0, 0, 0); for (const x of [-0.035, 0, 0.035]) mesh(q, cyl(0.012, 0.012, 0.28, 4), gl, x, 0.36 * k, 0); return 'body'; },
  ring(it, g, a, m, gl, md) { const y = md.armL.position.y + 0.05, k = a.scale; const r = mesh(g, new THREE.TorusGeometry(0.5 * k, 0.035, 4, 28), m, 0, y, a.back - 0.1); const r2 = mesh(g, new THREE.TorusGeometry(0.4 * k, 0.018, 4, 24), gl, 0, y, a.back - 0.1); g.userData.spin2 = r2; for (let i = 0; i < 4; i++) { const ang = i / 4 * Math.PI * 2; mesh(r, new THREE.BoxGeometry(0.06, 0.06, 0.06), gl, Math.cos(ang) * 0.5 * k, Math.sin(ang) * 0.5 * k, 0); } return 'body'; },
  katanas(it, g, a, m, gl, md) { const y = md.armL.position.y - 0.2, k = a.scale; for (const s of [-1, 1]) { const sw = new THREE.Group(); sw.position.set(0, y, a.back - 0.06); sw.rotation.z = s * 0.6; g.add(sw); mesh(sw, cyl(0.03, 0.03, 0.9 * k, 6), m, 0, 0, 0); mesh(sw, cyl(0.05, 0.05, 0.02, 8), gl, 0, 0.46 * k, 0); mesh(sw, cyl(0.022, 0.022, 0.22, 6), lam(0x3a2a5a), 0, 0.58 * k, 0); } return 'body'; },
};
function shoulders(g, md, make) {
  const k = md.anchors?.scale || 1;
  for (const [s, arm] of [[1, md.armL], [-1, md.armR]]) { const p = new THREE.Group(); p.position.copy(arm.position); p.position.y += md.anchors?.shoulderLift || 0; p.position.x += s * (md.anchors?.shoulderOut || 0); g.add(p); make(p, s, Math.max(0.9, k)); }
  return 'body';
}
// swap / restore the weapon shape on the model's blades (the tier code only ever touches scale.y/position.y)
function setWeapon(model, item) {
  for (const b of model.blades || []) {
    if (!b.userData.baseGeo) b.userData.baseGeo = { geo: b.geometry, sx: b.scale.x, sz: b.scale.z };
    const base = b.userData.baseGeo;
    if (!item) { b.geometry = base.geo; b.scale.x = base.sx; b.scale.z = base.sz; continue; }
    b.geometry = weaponGeo(item.shape);
    const flat = item.shape === 'tristar'; b.scale.x = flat ? Math.max(base.sx, 0.22) : 1; b.scale.z = 1;
  }
  if (item && model.blade) model.blade.userData.weaponTint = item.glow;
}

export class Wardrobe {
  constructor(scene, progress) {
    this.scene = scene; this.progress = progress;
    this.parts = []; this.cape = null; this.aura = null; this.banner = null; this.trailColor = null;
    this.trail = [];
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(BOX, glowMat(0xffffff, 0.6)); m.visible = false; m.scale.setScalar(0.14); scene.add(m); this.trail.push({ m, life: 0 }); }
    this.tick = 0; this.last = null;
  }
  // (Re)dress the hero with what's equipped for their character
  // eq = { slot: id } from a co-op friend (already cleaned); omit for your own equipped + owned items
  dress(player, eq = null) {
    this.player = player; this.remote = !!eq;
    for (const p of this.parts) disposeModel(p);
    this.parts = []; this.cape = this.aura = this.banner = null; this.trailColor = null;
    const mine = !eq;
    eq = eq || this.progress.equipped(player.char.id);
    this.spin = [];
    setWeapon(player.model, null);
    for (const slot of Object.keys(eq)) {
      const item = COSMETICS.find((c) => c.id === eq[slot]);
      if (!item || item.hero !== player.char.id || item.slot !== slot || (mine && !this.progress.owns(item))) continue;
      if (slot === 'trail') { this.trailColor = item.glow; continue; }
      const model = player.model;
      if (slot === 'weapon') { if (item.shape) setWeapon(model, item); continue; }
      const g = new THREE.Group();
      const a = model.anchors || { headTop: 0.3, headW: 0.22, faceZ: 0.22, back: -0.24, scale: 1 };
      const where = item.shape && GEAR[item.shape] ? GEAR[item.shape](item, g, a, lam(item.color), glowMat(item.glow), model) : BUILD[slot](item, g);
      if (g.userData.spin || g.userData.spin2 || g.userData.bob) this.spin.push(g);
      if (where === 'head') model.head.add(g);
      else if (where === 'aura') { model.root.add(g); this.aura = g; }
      else { model.body.add(g); if (where === 'cape') this.cape = g; if (slot === 'banner') this.banner = g; }
      this.parts.push(g);
    }
  }
  update(dt) {
    const p = this.player; if (!p) return;
    const t = performance.now() / 1000;
    animateSkin(p.model, t);
    const moving = this.last ? this.last.distanceToSquared(p.position) > 1e-5 : false;
    if (this.cape) this.cape.rotation.x = 0.12 + (moving ? 0.35 + Math.sin(t * 9) * 0.08 : Math.sin(t * 2) * 0.04);
    if (this.aura) this.aura.rotation.y += dt * 1.2;
    for (const g of this.spin || []) { if (g.userData.spin) g.userData.spin.rotation.z = t * 0.8; if (g.userData.spin2) g.userData.spin2.rotation.z = -t * 1.3; for (const b of g.userData.bob || []) b.position.y = 0.54 + Math.sin(t * 3 + b.parent.position.x * 9) * 0.04; }
    if (this.banner?.userData.flag) this.banner.userData.flag.rotation.y = Math.sin(t * 5) * 0.25;
    // talon trail: little glowing chips left behind while you move or fight
    if (this.trailColor !== null && !p.dead) {
      this.tick -= dt;
      if (this.tick <= 0 && (moving || p.state !== 'normal')) {
        this.tick = 0.05;
        const s = this.trail.find((x) => x.life <= 0) || this.trail[0];
        s.life = 0.45; s.m.visible = true; s.m.material.color.setHex(this.trailColor);
        s.m.position.set(p.position.x + (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, p.position.z + (Math.random() - 0.5) * 0.4);
      }
    }
    for (const s of this.trail) if (s.life > 0) { s.life -= dt; s.m.material.opacity = Math.max(0, s.life / 0.45) * 0.7; s.m.scale.setScalar(0.06 + 0.2 * s.life); if (s.life <= 0) s.m.visible = false; }
    this.last = (this.last || new THREE.Vector3()).copy(p.position);
  }
  dispose() { this.clearTrail(); for (const s of this.trail) this.scene.remove(s.m); for (const p of this.parts) disposeModel(p); this.parts = []; this.player = null; }
  clearTrail() { for (const s of this.trail) { s.life = 0; s.m.visible = false; } }
}

// a little turntable preview for the Cosmetics screen
export function previewColor(item) { return '#' + item.color.toString(16).padStart(6, '0'); }

// ---------- ARENA SKINS: body colours + materials + small themed attachments ----------
// A handful of extra boxes and material tweaks per skin (no lights, no textures) so it stays cheap on phones.
const SIZE = { sarrow: 1, zaleks: 1.3, iskra: 0.88, orin: 1.1, ninja: 0.92, axiom: 1.05 };
const THEME = {
  slag:      { emissive: 0x000000, ei: 0,    rough: true },
  foundry:   { emissive: 0xff4a10, ei: 0.22 },
  tundra:    { emissive: 0x6ab8ff, ei: 0.16 },
  cathedral: { emissive: 0x9a2aff, ei: 0.12 },
  rooftop:   { emissive: 0x30405a, ei: 0.1 },
};
export function decorateSkin(model, skin, hero) {
  if (!skin) return;
  const th = THEME[skin.arena] || THEME.slag;
  const tint = new THREE.Color(skin.tint);
  // materials: stronger colour wash on the armour + a themed inner glow
  model.root.traverse((o) => {
    const m = o.material;
    if (!m || !m.isMeshLambertMaterial || m.userData.skinned) return;
    m.userData.skinned = true;
    m.color.lerp(tint, 0.25);
    if (th.ei) { m.emissive = new THREE.Color(th.emissive); m.emissiveIntensity = th.ei; }
    if (th.rough) m.color.multiplyScalar(0.85);
  });
  const k = SIZE[hero] || 1;
  const g = new THREE.Group(); g.name = 'skinfx'; model.body.add(g);
  const acc = glowMat(skin.glow), dark = lam(new THREE.Color(skin.tint).multiplyScalar(0.55));
  const fx = { kind: skin.arena, bits: [] };
  switch (skin.arena) {
    case 'slag': { // bolted scrap plates on the shoulders and chest, rivets in the accent colour
      const rust = lam(0x6a4a2e), steel = lam(0x7a7f86);
      for (const s of [-1, 1]) {
        box(g, s < 0 ? rust : steel, 0.34 * k, 0.1, 0.4 * k, s * 0.44 * k, 1.78 * k, 0, 0, s * 0.35);
        box(g, acc, 0.05, 0.05, 0.05, s * 0.44 * k, 1.85 * k, 0.12 * k).castShadow = false;
      }
      box(g, steel, 0.26 * k, 0.22 * k, 0.05, -0.17 * k, 1.2 * k, 0.22 * k, 0, 0.12);
      box(g, rust, 0.2 * k, 0.16 * k, 0.05, 0.18 * k, 0.95 * k, 0.22 * k, 0, -0.2);
      for (const x of [-0.25, -0.09]) box(g, acc, 0.04, 0.04, 0.03, x * k, 1.28 * k, 0.25 * k).castShadow = false;
      break;
    }
    case 'foundry': { // molten seams and a glowing back vent
      const lava = glowMat(0xff7a1a);
      for (const y of [0.95, 1.2, 1.5]) box(g, lava, 0.7 * k, 0.035, 0.44 * k, 0, y * k, 0).castShadow = false;
      for (const s of [-1, 1]) box(g, lava, 0.05, 0.4 * k, 0.05, s * 0.3 * k, 1.35 * k, 0.21 * k).castShadow = false;
      const vent = box(g, glowMat(skin.glow, 0.85), 0.3 * k, 0.3 * k, 0.06, 0, 1.4 * k, -0.24 * k); vent.castShadow = false;
      fx.bits.push(vent);
      break;
    }
    case 'tundra': { // ice shards sprouting from the shoulders and the back
      const ice = new THREE.MeshLambertMaterial({ color: 0xd8f4ff, emissive: 0x4aa0ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 });
      const geo = new THREE.ConeGeometry(0.1, 0.55, 5);
      const put = (x, y, z, rz, rx, sc = 1) => { const c = new THREE.Mesh(geo, ice); c.position.set(x * k, y * k, z * k); c.rotation.set(rx, 0, rz); c.scale.setScalar(sc * k); g.add(c); };
      for (const s of [-1, 1]) { put(s * 0.42, 1.86, 0, -s * 0.5, 0); put(s * 0.5, 1.8, -0.08, -s * 0.9, -0.2, 0.7); }
      put(-0.1, 1.55, -0.26, 0.3, -0.9, 0.9); put(0.12, 1.3, -0.26, -0.25, -1.0, 0.7);
      box(g, glowMat(0xbff4ff, 0.5), 0.72 * k, 0.05, 0.46 * k, 0, 1.06 * k, 0).castShadow = false; // frosted belt
      break;
    }
    case 'cathedral': { // neon trim along the armour edges
      const neon = glowMat(skin.glow), neon2 = glowMat(skin.tint);
      for (const s of [-1, 1]) {
        box(g, neon, 0.03, 0.66 * k, 0.03, s * 0.34 * k, 1.36 * k, 0.21 * k).castShadow = false;
        box(g, neon2, 0.03, 0.66 * k, 0.03, s * 0.34 * k, 1.36 * k, -0.21 * k).castShadow = false;
      }
      box(g, neon, 0.7 * k, 0.03, 0.03, 0, 1.7 * k, 0.21 * k).castShadow = false;
      box(g, neon2, 0.7 * k, 0.03, 0.03, 0, 1.02 * k, 0.21 * k).castShadow = false;
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 4, 20), neon); halo.position.set(0, 2.5 * k, -0.05); halo.rotation.x = Math.PI / 2; model.body.add(halo); g.add(halo);
      fx.bits.push(halo);
      break;
    }
    case 'rooftop': { // a lightning rod on the back and sparks that crackle round the body
      box(g, lam(0x8a8f96), 0.04, 0.9 * k, 0.04, 0.18 * k, 2.0 * k, -0.22 * k);
      box(g, glowMat(skin.glow), 0.08, 0.08, 0.08, 0.18 * k, 2.48 * k, -0.22 * k).castShadow = false;
      const spark = glowMat(skin.glow);
      for (let i = 0; i < 5; i++) { const b = box(g, spark, 0.07, 0.18, 0.04, 0, 1.3 * k, 0); b.castShadow = false; b.userData.ph = i * 1.256; fx.bits.push(b); }
      fx.k = k;
      break;
    }
  }
  g.userData.fx = fx;
  model.skinFx = fx;
}
// per-frame flicker for skins that move (sparks, vents, halos)
export function animateSkin(model, t) {
  const fx = model && model.skinFx; if (!fx) return;
  if (fx.kind === 'rooftop') {
    for (const b of fx.bits) {
      const a = t * 3 + b.userData.ph, on = Math.sin(t * 23 + b.userData.ph * 7) > -0.2;
      b.visible = on;
      b.position.set(Math.cos(a) * 0.55 * fx.k, (1.0 + ((t * 0.9 + b.userData.ph) % 1.2)) * fx.k, Math.sin(a) * 0.55 * fx.k);
      b.rotation.z = Math.sin(t * 31 + b.userData.ph) * 1.2;
    }
  } else if (fx.kind === 'foundry') {
    for (const b of fx.bits) b.material.opacity = 0.6 + 0.35 * Math.sin(t * 4);
  } else if (fx.kind === 'cathedral') {
    for (const b of fx.bits) b.rotation.z = t * 1.5;
  }
}

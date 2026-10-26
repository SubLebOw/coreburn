// boss-models.js
// Phase 5C stage 2: the boss model overhaul. Every boss keeps its own build (so every animated handle
// its pose() uses still exists), then dressBoss() adds armour, mechanical detail, weak points and
// energy systems on top, and merges every static piece per (group, material) so a far more detailed
// boss costs FEWER draw calls than before. tickDress() runs the animated components and the
// presentation (wind-up glow, vents, impact feedback, death sequence).
// Purely visual: never touches position, radius, hp, timers or anything the host syncs, never calls
// Math.random on the boss build/update path, and only uses the unrecorded local effects + local sound.
import * as THREE from 'three';
import { sound } from './audio.js?v=1.33.0';

const PI = Math.PI;
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const GEO = {};
const g = (k, f) => GEO[k] || (GEO[k] = f());
const cylG = (rt, rb, h, s) => g(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const coneG = (r, h, s) => g(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const sphG = g('s', () => new THREE.SphereGeometry(1, 10, 7));
const octG = g('o', () => new THREE.OctahedronGeometry(1));
const icoG = g('i', () => new THREE.IcosahedronGeometry(1, 0));
const torG = (R, t, ts) => g(`t${R},${t},${ts}`, () => new THREE.TorusGeometry(R, t, 5, ts));
const GLOWS = {};
const glowMat = (hex) => GLOWS[hex] || (GLOWS[hex] = new THREE.MeshBasicMaterial({ color: hex }));

// per-boss palette for the two extra (flashable, gold-able) materials
const PAL = {
  deacon: [0x3a3634, 0xb07a3a], choirmother: [0x2e2a34, 0xc89a3a], rivetjaw: [0x3c3a36, 0x9a6a2a],
  vell: [0x2a2430, 0xd8d0e8], worm: [0x34362e, 0x8a7a4a], klaxon: [0x3a3226, 0xd8b050], bellows: [0x302620, 0xb08048],
  gravel: [0x55524a, 0x8a7a5a], brand: [0x2e2a26, 0xc0702a], temper: [0x2a3036, 0x8ab0c8], tithe: [0x24242c, 0xe0b84a],
  hymnworks: [0x34302c, 0xc8a050], nail: [0x2c2e34, 0x9aa0b0],
};
// each boss's energy colour (weak points, wind-up glow, death)
export const BOSS_ENERGY = {
  deacon: 0xff7a1a, choirmother: 0xffb020, rivetjaw: 0xff5a20, vell: 0xff4fd8, worm: 0xc8ff3a, klaxon: 0xffd23a,
  bellows: 0xff7a3a, gravel: 0xffe08a, brand: 0xff8a3a, temper: 0x5ad8ff, tithe: 0xffc23a, hymnworks: 0xff3a4a, nail: 0x9ad8ff,
};

class Kit {
  constructor(b) { this.b = b; this.d = b.dress; }
  mat(m) { return typeof m === 'number' ? glowMat(m) : (typeof m === 'string' ? this.b.mats[m] : m); }
  mesh(par, m, geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const mat = this.mat(m), o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz);
    o.castShadow = mat.isMeshLambertMaterial === true; par.add(o); return o;
  }
  box(par, m, w, h, d, x, y, z, rx, ry, rz) { return this.mesh(par, m, UNIT, x, y, z, rx, ry, rz, w, h, d); }
  cyl(par, m, rt, rb, h, s, x, y, z, rx, ry, rz) { return this.mesh(par, m, cylG(rt, rb, h, s), x, y, z, rx, ry, rz); }
  cone(par, m, r, h, s, x, y, z, rx, ry, rz) { return this.mesh(par, m, coneG(r, h, s), x, y, z, rx, ry, rz); }
  sph(par, m, sx, sy, sz, x, y, z) { return this.mesh(par, m, sphG, x, y, z, 0, 0, 0, sx, sy, sz); }
  oct(par, m, s, x, y, z, rx = 0, ry = 0, rz = 0, sy = s) { return this.mesh(par, m, octG, x, y, z, rx, ry, rz, s, sy, s); }
  ico(par, m, s, x, y, z, rx = 0, ry = 0) { return this.mesh(par, m, icoG, x, y, z, rx, ry, 0, s, s * 0.8, s); }
  tor(par, m, R, t, x, y, z, rx = 0, ry = 0, rz = 0, ts = 16) { return this.mesh(par, m, torG(R, t, ts), x, y, z, rx, ry, rz); }
  grp(par, x = 0, y = 0, z = 0) { const o = new THREE.Group(); o.position.set(x, y, z); par.add(o); return o; }
  rivets(par, m, pts, s = 0.05) { for (const [x, y, z] of pts) this.box(par, m, s, s, s, x, y, z); }
  // animated components (kept as their own meshes, never merged)
  spin(o, axis, speed, boost = 3) { this.d.spin.push({ o, axis, speed, boost }); return o; }
  pulse(o, amp, speed) { this.d.pulse.push({ o, base: o.scale.clone(), amp, speed }); return o; }
  vent(x, y, z) { this.d.vents.push(new THREE.Vector3(x, y, z)); }
  weak(o) { this.d.weak.push({ o, base: o.scale.clone() }); return this.pulse(o, 0.12, 4); }
  weakOnly(o) { this.d.weak.push({ o }); return o; } // a handle its own pose() already scales
}

// ======================= the twelve (13 with both twins) =======================
const DRESS = {
  deacon(k, b) { // armoured furnace-priest: grated belly, chimney stacks, spiked hammer fists, censer belt
    const B = b.body;
    k.box(B, 'metal', 1.25, 0.14, 0.85, 0, 0.86, 0);                       // iron belt
    k.box(B, 'trim', 1.2, 0.08, 0.8, 0, 1.78, 0);                          // collar band
    k.box(B, 'metal', 0.72, 0.5, 0.06, 0, 1.2, 0.395);                     // furnace frame
    for (const s of [1, -1]) {
      k.box(B, 'metal', 0.08, 0.5, 0.09, s * 0.34, 1.2, 0.4);
      k.box(B, 'dark', 0.42, 0.52, 0.2, s * 0.32, 0.6, 0.12);              // thigh plates
      k.box(B, 'metal', 0.44, 0.28, 0.5, s * 0.3, 0.12, 0.05);             // boots
      k.box(B, 'trim', 0.46, 0.06, 0.52, s * 0.3, 0.3, 0.05);
      k.cyl(B, 'trim', 0.17, 0.17, 0.06, 8, s * 0.45, 2.3, -0.15);         // chimney lips
      k.box(B, 'main', 0.26, 0.6, 0.62, s * 0.62, 1.32, 0, 0, 0, s * 0.12); // side armour
      k.cone(B, 'metal', 0.06, 0.24, 5, s * 0.6, 1.95, 0.25, 0, 0, -s * 0.5);
    }
    k.rivets(B, 'trim', [[-0.5, 1.7, 0.38], [0.5, 1.7, 0.38], [-0.5, 0.95, 0.43], [0.5, 0.95, 0.43], [0, 0.95, 0.44]]);
    for (let i = 0; i < 5; i++) k.box(B, 'metal', 0.06, 0.26, 0.12, -0.5 + i * 0.25, 0.7, 0.42, 0.15); // tassets
    k.box(B, 'metal', 0.9, 0.8, 0.3, 0, 1.35, -0.45);                       // back boiler
    for (const y of [1.1, 1.35, 1.6]) k.box(B, 'trim', 0.94, 0.05, 0.32, 0, y, -0.45);
    const gauge = k.cyl(B, 0xff7a1a, 0.12, 0.12, 0.04, 10, 0, 1.75, -0.61, PI / 2);
    k.weak(gauge);
    // mitred helm over the mask
    k.box(B, 'metal', 0.56, 0.14, 0.56, 0, 2.28, 0.05);
    k.cone(B, 'trim', 0.3, 0.5, 4, 0, 2.6, 0.05, 0, PI / 4);
    k.box(B, 'dark', 0.54, 0.12, 0.08, 0, 1.85, 0.3);                       // jaw guard
    const core = k.box(B, 0xffb050, 0.32, 0.2, 0.03, 0, 1.2, 0.43); k.weak(core);
    for (const s of [1, -1]) { const e = k.box(B, 0xff5a10, 0.12, 0.12, 0.12, s * 0.45, 2.36, -0.15); k.pulse(e, 0.5, 9); }
    k.vent(0.45, 2.4, -0.15); k.vent(-0.45, 2.4, -0.15);
    for (const a of [b.armL, b.armR]) {
      k.box(a, 'main', 0.46, 0.3, 0.46, 0, 0.02, 0);                        // pauldron
      k.box(a, 'trim', 0.48, 0.05, 0.48, 0, -0.12, 0);
      k.box(a, 'metal', 0.56, 0.12, 0.56, 0, -0.66, 0);                     // fist cuff
      for (const [x, z] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]]) k.cone(a, 'metal', 0.07, 0.2, 4, x, -1.18, z, PI);
      k.box(a, 0xff7a1a, 0.3, 0.06, 0.02, 0, -0.9, 0.26);
    }
  },
  choirmother(k, b) { // tiered robes, organ-pipe spine, bone collar, a second counter-ring of bells
    const B = b.body;
    k.cone(B, 'main', 0.95, 0.6, 10, 0, 0.3, 0);
    k.tor(B, 'trim', 0.66, 0.035, 0, 1.0, 0, PI / 2, 0, 0, 20);
    k.tor(B, 'trim', 0.88, 0.035, 0, 0.35, 0, PI / 2, 0, 0, 20);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; k.box(B, 'dark', 0.12, 0.9, 0.05, Math.sin(a) * 0.62, 0.6, Math.cos(a) * 0.62, -0.25 * Math.cos(a), a, 0); }
    k.box(B, 'mask', 0.7, 0.14, 0.5, 0, 2.15, 0);                          // bone collar
    for (let i = -2; i <= 2; i++) k.box(B, 'mask', 0.05, 0.4, 0.05, i * 0.12, 1.85, 0.22); // ribcage
    for (let i = 0; i < 5; i++) k.cyl(B, 'trim', 0.05, 0.05, 0.7 + (2 - Math.abs(i - 2)) * 0.3, 6, -0.32 + i * 0.16, 2.2 + (2 - Math.abs(i - 2)) * 0.15, -0.28);
    k.tor(B, 'trim', 0.28, 0.03, 0, 2.66, 0, PI / 2, 0, 0, 14);            // bell crown
    for (let i = 0; i < 5; i++) { const a = -0.8 + i * 0.4; k.cone(B, 'trim', 0.04, 0.2, 4, Math.sin(a) * 0.24, 2.78, Math.cos(a) * 0.24 - 0.02); }
    const heart = k.oct(B, 0xffd070, 0.12, 0, 1.75, 0.24); k.weak(heart);
    const ring2 = k.grp(B, 0, 2.45, -0.3); k.spin(ring2, 'z', -1.2, 4);
    k.tor(ring2, 0xffd070, 0.82, 0.025, 0, 0, 0, 0, 0, 0, 32);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; k.cone(ring2, 0xffb020, 0.07, 0.14, 6, Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0); }
    for (const a of [b.armL, b.armR]) {
      k.box(a, 'mask', 0.2, 0.16, 0.2, 0, 0, 0);
      k.cyl(a, 'dark', 0.1, 0.18, 0.5, 6, 0, -0.55, 0);                    // bell sleeve
      for (const x of [-0.05, 0.05]) k.box(a, 'mask', 0.03, 0.35, 0.03, x, -1.2, 0.1);
    }
    k.vent(0, 2.7, 0);
  },
  rivetjaw(k, b) { // scrap crab: plated shell, smokestacks, spinning back saw, claws, eye cluster
    const B = b.body;
    for (let i = 0; i < 4; i++) k.box(B, 'metal', 1.5 - i * 0.2, 0.1, 0.32, 0, 1.38 + i * 0.07, -0.4 + i * 0.22, -0.25); // shell plates
    for (const s of [1, -1]) {
      k.box(B, 'metal', 0.12, 0.6, 1.0, s * 0.84, 0.95, 0);               // side skirts
      k.rivets(B, 'trim', [[s * 0.91, 1.15, 0.35], [s * 0.91, 1.15, -0.35], [s * 0.91, 0.75, 0], [s * 0.91, 0.75, 0.35], [s * 0.91, 0.75, -0.35]]);
      k.cyl(B, 'metal', 0.09, 0.12, 0.55, 7, s * 0.55, 1.85, -0.45);
      const t = k.box(B, 0xff5a20, 0.12, 0.05, 0.12, s * 0.55, 2.14, -0.45); k.pulse(t, 0.4, 7);
      k.vent(s * 0.55, 2.2, -0.45);
      const claw = k.grp(B, s * 0.85, 0.75, 0.75);
      k.box(claw, 'dark', 0.22, 0.22, 0.5, 0, 0, 0, 0.3, s * 0.4);
      k.cone(claw, 'mask', 0.1, 0.4, 4, s * 0.12, -0.05, 0.35, PI / 2);
      k.cone(claw, 'mask', 0.08, 0.3, 4, -s * 0.05, -0.15, 0.3, PI / 2 + 0.4);
    }
    for (const [x, z] of [[0.6, 0.45], [-0.6, 0.45], [0.6, -0.45], [-0.6, -0.45]]) { k.box(B, 'metal', 0.36, 0.16, 0.36, x, 0.55, z); k.cone(B, 'metal', 0.16, 0.22, 4, x, 0.06, z, PI); }
    for (const [x, y] of [[0.15, 1.5], [-0.15, 1.5], [0.55, 1.32], [-0.55, 1.32]]) k.box(B, 0xc8ff3a, 0.1, 0.08, 0.1, x, y, 0.62);
    const furnace = k.box(B, 0xff7a1a, 0.9, 0.08, 0.05, 0, 1.02, 0.92); k.weak(furnace);
    const saw = k.grp(B, 0, 1.55, -0.7); saw.rotation.y = PI / 2; k.spin(saw, 'x', 4, 4);
    k.cyl(saw, 'metal', 0.5, 0.5, 0.06, 12, 0, 0, 0, 0, 0, PI / 2);
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; k.cone(saw, 'trim', 0.06, 0.16, 3, 0, Math.cos(a) * 0.55, Math.sin(a) * 0.55, a, 0, 0); }
    k.cyl(B, 'trim', 0.08, 0.08, 0.3, 6, 0, 1.55, -0.6, PI / 2);
    for (let i = -2; i <= 2; i++) k.cone(b.jaw, 'mask', 0.06, 0.2, 4, i * 0.25, 0.25, 0.48);
    k.box(b.jaw, 'metal', 1.24, 0.06, 0.58, 0, -0.18, 0.25);
  },
  vell(k, b) { // the duelist: pauldron, fauld plates, layered cape, crescent halo, blade guard
    const B = b.body;
    k.box(B, 'metal', 0.56, 0.16, 0.36, 0, 1.12, 0);                        // waist
    for (let i = 0; i < 4; i++) { const x = -0.21 + i * 0.14; k.box(B, 'main', 0.13, 0.34, 0.05, x, 0.9, 0.17, 0.12); k.box(B, 'main', 0.13, 0.3, 0.05, x, 0.92, -0.17, -0.12); }
    k.box(B, 'trim', 0.52, 0.05, 0.34, 0, 1.92, 0);
    k.box(B, 'metal', 0.2, 0.3, 0.2, 0, 1.6, 0.12, 0.3);                    // breastplate ridge
    for (const s of [1, -1]) {
      k.box(B, 'metal', 0.18, 0.36, 0.22, s * 0.17, 0.4, 0.02);            // greaves
      k.box(B, 'trim', 0.2, 0.06, 0.26, s * 0.17, 0.62, 0.04);
      k.box(B, 'dark', 0.2, 0.08, 0.32, s * 0.17, 0.04, 0.06);
    }
    for (let i = 0; i < 3; i++) k.box(B, 'dark', 0.22, 1.5 - i * 0.2, 0.04, -0.28 + i * 0.28, 1.05 + i * 0.1, -0.28 - i * 0.02, 0.18, 0, (i - 1) * 0.08); // cape tails
    k.box(B, 'trim', 0.7, 0.06, 0.08, 0, 1.95, -0.22);
    k.box(B, 'metal', 0.34, 0.12, 0.34, 0, 2.26, 0);                        // helm brow
    k.box(B, 'metal', 0.06, 0.2, 0.3, 0.16, 2.08, 0.02); k.box(B, 'metal', 0.06, 0.2, 0.3, -0.16, 2.08, 0.02);
    const crest = k.box(B, 0xff4fd8, 0.02, 0.5, 0.06, 0, 2.5, 0.1, -0.35); k.pulse(crest, 0.15, 3);
    const halo = k.grp(B, 0, 2.3, -0.3); k.spin(halo, 'z', 0.6, 6);
    k.tor(halo, 0xff4fd8, 0.42, 0.02, 0, 0, 0, 0, 0, 0, 28);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2; k.oct(halo, 0xffa0f0, 0.06, Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0); }
    const eye = k.box(B, 0xffd0ff, 0.16, 0.03, 0.03, 0, 2.12, 0.165); k.weak(eye);
    // sword arm: pauldron + guard; off arm: small buckler
    k.box(b.armR, 'main', 0.26, 0.2, 0.26, 0, 0.02, 0); k.box(b.armR, 'trim', 0.28, 0.04, 0.28, 0, -0.08, 0);
    k.box(b.armR, 'trim', 0.34, 0.06, 0.06, 0, -0.72, 0.0); k.box(b.armR, 'dark', 0.06, 0.06, 0.22, 0, -0.72, -0.12);
    k.box(b.armR, 'metal', 0.02, 0.1, 1.72, 0, -0.69, 0.8);                // blade spine
    k.box(b.armL, 'main', 0.24, 0.18, 0.24, 0, 0.02, 0);
    k.cyl(b.armL, 'metal', 0.18, 0.18, 0.05, 8, 0.08, -0.55, 0.04, 0, 0, PI / 2);
    k.vent(0, 2.6, -0.3);
  },
  worm(k, b) { // plated segments with dorsal spikes, mandible tusks, glowing gill vents, scrap mound
    b.segments.forEach((s, i) => {
      const r = 0.62 - i * 0.03;
      for (let j = 0; j < 4; j++) { const a = j / 4 * PI * 2 + i * 0.4; k.box(s, 'metal', 0.36, 0.42, 0.08, Math.sin(a) * (r + 0.04), 0.32, Math.cos(a) * (r + 0.04), 0, a, 0); }
      k.cone(s, 'mask', 0.08, 0.32, 4, 0, 0.36, -r - 0.08, -PI / 2 - 0.4);
      for (const sx of [1, -1]) k.box(s, 0xc8ff3a, 0.04, 0.2, 0.04, sx * (r + 0.02), 0.3, r * 0.35);
    });
    const H = b.head;
    k.tor(H, 'metal', 0.66, 0.06, 0, 0.24, 0.3, -0.5 + PI / 2, 0, 0, 14);   // maw rim
    for (const s of [1, -1]) {
      k.cone(H, 'mask', 0.1, 0.6, 4, s * 0.55, -0.1, 0.55, PI / 2 + 0.2, 0, s * 0.4);   // tusks
      k.box(H, 'metal', 0.2, 0.5, 0.6, s * 0.62, 0.15, -0.05, -0.3, 0, s * 0.15);         // cheek plates
    }
    for (let i = 0; i < 3; i++) k.cone(H, 'metal', 0.1, 0.4, 4, 0, 0.62 - i * 0.05, -0.1 - i * 0.25, -0.6);
    const throat = k.mesh(H, 0xc8ff3a, coneG(0.3, 0.3, 8), 0, 0.2, 0.32, -0.5 - PI / 2); k.weak(throat);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + 0.3; const c = k.box(b.root, 'metal', 0.4, 0.5, 0.3, Math.cos(a) * 1.25, 0.1, Math.sin(a) * 1.25, 0.6, a, 0.3); c.castShadow = false; }
    k.vent(0, 3.6, 0.4);
  },
  klaxon(k, b) { // the Siren Engine: horn rim + struts, shoulder sirens, capacitor coils, beacon lamp
    const B = b.body;
    k.tor(b.horn, 'trim', 0.75, 0.05, 0, -0.65, 0, PI / 2, 0, 0, 22);      // bell rim (horn-local)
    k.mesh(b.horn, 'trim', g('hornIn', () => new THREE.ConeGeometry(0.74, 1.28, 14, 1, true)), 0, -0.01, 0, 0, 0, 0, -1, 1, 1); // inner bell (mirrored so the inside renders)
    for (const [y, r] of [[0, 0.39], [0.33, 0.2]]) k.tor(b.horn, 'metal', r, 0.035, 0, y, 0, PI / 2, 0, 0, 16); // riveted horn bands
    k.box(B, 'metal', 0.8, 0.12, 0.56, 0, 0.88, 0);
    k.box(B, 'trim', 0.76, 0.06, 0.54, 0, 1.76, 0);
    for (const s of [1, -1]) {
      const h = k.cone(B, 'trim', 0.16, 0.34, 10, s * 0.5, 1.95, 0.05, -PI / 2);   // shoulder sirens
      k.cyl(B, 'metal', 0.06, 0.06, 0.2, 6, s * 0.5, 1.95, -0.2, PI / 2);
      k.cyl(B, 'metal', 0.1, 0.1, 0.62, 8, s * 0.22, 1.35, -0.38);                // capacitor coils
      for (const y of [1.15, 1.3, 1.45]) { const c = k.tor(B, 0xffd23a, 0.11, 0.02, s * 0.22, y, -0.38, PI / 2, 0, 0, 10); k.pulse(c, 0.2, 10); }
      k.vent(s * 0.5, 1.95, 0.25);
      void h;
    }
    for (const a of [0, 2.1, 4.2]) k.box(B, 'metal', 0.26, 0.08, 0.3, Math.sin(a) * 0.48, 0.04, Math.cos(a) * 0.48, 0, a, 0); // tripod feet
    k.cyl(B, 'metal', 0.06, 0.06, 0.3, 6, 0, 2.62, -0.25);
    const beacon = k.grp(B, 0, 2.82, -0.25); k.spin(beacon, 'y', 3, 4);
    k.box(beacon, 0xff4a1a, 0.18, 0.12, 0.08, 0.08, 0, 0); k.box(beacon, 'dark', 0.16, 0.13, 0.09, -0.08, 0, 0);
    k.weakOnly(b.throat);
    const voice = k.cyl(b.horn, 0xffd23a, 0.34, 0.34, 0.02, 16, 0, -0.12, 0); k.pulse(voice, 0.08, 14); // the siren's glowing voice-coil, deep in the bell
    k.cyl(b.horn, 'metal', 0.13, 0.13, 0.04, 10, 0, -0.14, 0);
    for (const a of [b.armL, b.armR]) { k.box(a, 'trim', 0.22, 0.16, 0.22, 0, 0, 0); k.cone(a, 'trim', 0.12, 0.2, 8, 0, -0.98, 0.0, PI); }
  },
  bellows(k, b) { // the Lungs: brass frame, pipes to the hood, pressure gauge, censers, ribbed cowl
    const B = b.body, L = b.lungs;
    for (const s of [1, -1]) {
      k.box(L, 'trim', 0.08, 1.08, 1.08, s * 0.72, 0, 0);
      k.box(L, 'metal', 0.3, 0.12, 0.12, s * 0.85, 0.45, 0.4); k.box(L, 'metal', 0.3, 0.12, 0.12, s * 0.85, -0.45, 0.4);
      k.cyl(B, 'metal', 0.07, 0.07, 0.9, 7, s * 0.4, 1.9, -0.45, 0.5);     // breathing pipes
      k.tor(B, 'trim', 0.08, 0.02, s * 0.4, 1.6, -0.6, PI / 2 - 0.5, 0, 0, 8);
      k.box(B, 'dark', 0.4, 0.3, 0.46, s * 0.35, 0.1, 0.04);
      k.vent(s * 0.45, 2.45, -0.3);
    }
    const gauge = k.cyl(L, 'trim', 0.2, 0.2, 0.06, 12, 0, 0.36, 0.53, PI / 2);
    const needle = k.box(L, 0xff3a1a, 0.025, 0.16, 0.02, 0, 0.36, 0.57); b.dress.needle = needle;
    k.weak(L.children.find((c) => c.material?.isMeshBasicMaterial && c !== needle) || needle);
    void gauge;
    k.cone(B, 'main', 0.48, 0.5, 8, 0, 2.38, -0.08, -0.25);                // cowl
    for (let i = 0; i < 4; i++) k.tor(B, 'dark', 0.36 - i * 0.04, 0.025, 0, 2.15 + i * 0.07, -0.05, PI / 2 + 0.2, 0, 0, 10);
    k.box(B, 'metal', 1.1, 0.12, 0.8, 0, 0.78, 0);
    for (const a of [b.armL, b.armR]) {
      k.box(a, 'main', 0.36, 0.22, 0.36, 0, 0, 0);
      k.cyl(a, 'metal', 0.02, 0.02, 0.3, 4, 0, -1.08, 0.0);
      const c = k.sph(a, 'trim', 0.14, 0.17, 0.14, 0, -1.28, 0);
      k.sph(a, 0xff7a3a, 0.07, 0.07, 0.07, 0, -1.28, 0.1);
      void c;
    }
  },
  gravel(k, b) { // carved stone saint: fissured plates, glowing runes, rosary, orbiting litany stones
    const B = b.body;
    for (const s of [1, -1]) {
      k.ico(B, 'main', 0.42, s * 0.82, 1.62, 0, 0.3 * s, 0.4);              // boulder shoulders
      k.box(B, 'mask', 0.08, 0.9, 0.1, s * 0.48, 1.2, 0.56);                // stole drop
      k.box(B, 0xffe08a, 0.04, 0.5, 0.02, s * 0.25, 1.0, 0.56);              // rune fissures
      k.ico(B, 'dark', 0.24, s * 0.4, 0.05, 0.1);
    }
    for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; k.ico(B, 'dark', 0.06, Math.sin(a) * 0.62, 1.56 - Math.cos(a) * 0.28, 0.5 + Math.cos(a) * 0.04); } // rosary
    k.box(B, 'main', 1.56, 0.16, 1.16, 0, 0.62, 0); k.box(B, 'dark', 1.6, 0.05, 1.2, 0, 1.72, 0);
    k.ico(B, 'main', 0.5, 0, 1.3, -0.6, 0.4, 0.2);                          // hunched back rock
    k.box(B, 'trim', 0.58, 0.06, 0.32, 0, 2.38, 0);
    k.box(B, 0xffe08a, 0.04, 0.3, 0.02, 0, 2.75, 0.16, 0, 0, 0);           // mitre glyph
    k.box(B, 0xffe08a, 0.18, 0.04, 0.02, 0, 2.8, 0.16);
    k.weakOnly(b.maw);
    const orbit = k.grp(B, 0, 2.3, 0); k.spin(orbit, 'y', 0.9, 4);
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; k.ico(orbit, 'main', 0.16, Math.cos(a) * 1.15, Math.sin(a * 2) * 0.1, Math.sin(a) * 1.15, a, a); k.box(orbit, 0xffe08a, 0.05, 0.05, 0.05, Math.cos(a) * 1.15, 0.18, Math.sin(a) * 1.15); }
    for (let i = -1; i <= 1; i++) k.cone(b.jaw, 'mask', 0.05, 0.14, 4, i * 0.22, 0.1, 0.3);
    for (const a of [b.armL, b.armR]) { k.ico(a, 'dark', 0.3, 0, -0.85, 0, 0.5, 0.3); k.box(a, 0xffe08a, 0.03, 0.2, 0.02, 0, -0.85, 0.25); }
    k.vent(0, 2.05, 0.5);
  },
  brand(k, b) { // the hammer twin: anvil pauldrons, big horns, riveted apron, chest forge core
    const B = b.body;
    for (const s of [1, -1]) {
      k.box(B, 'metal', 0.6, 0.16, 0.7, s * 0.75, 1.8, 0); k.box(B, 'trim', 0.3, 0.12, 0.7, s * 0.75, 1.92, 0);
      k.cone(B, 'mask', 0.09, 0.55, 5, s * 0.4, 2.35, 0, 0, 0, -s * 0.9);
      k.box(B, 'metal', 0.44, 0.3, 0.5, s * 0.3, 0.1, 0.03);
      k.vent(s * 0.75, 2.0, -0.2);
    }
    k.rivets(B, 'trim', [[-0.35, 1.2, 0.47], [0.35, 1.2, 0.47], [-0.35, 0.7, 0.47], [0.35, 0.7, 0.47]]);
    k.box(B, 'metal', 1.34, 0.14, 0.9, 0, 0.75, 0);
    const core = k.oct(B, 0xff8a3a, 0.16, 0, 1.38, 0.45); k.weak(core);
    k.box(B, 'metal', 0.62, 0.1, 0.54, 0, 2.05, 0.05);
    k.box(B, 'metal', 0.9, 0.7, 0.3, 0, 1.2, -0.52); k.cyl(B, 'trim', 0.08, 0.08, 0.5, 6, 0, 1.75, -0.55);
    k.box(b.armL, 'main', 0.4, 0.16, 0.4, 0, -0.72, 0); k.box(b.armR, 'main', 0.4, 0.16, 0.4, 0, -0.6, 0);
    k.box(b.armR, 'trim', 0.5, 0.5, 0.04, 0, -0.65, 1.42);
  },
  temper(k, b) { // the quench twin: tank cradle with bubbling rings, frost vents, armoured coat panels
    const B = b.body;
    for (const s of [1, -1]) {
      k.box(B, 'metal', 0.06, 0.95, 0.12, s * 0.3, 1.5, -0.45);
      k.cyl(B, 'metal', 0.05, 0.05, 0.6, 6, s * 0.22, 1.6, -0.12, 0.8);
      k.box(B, 'main', 0.26, 0.6, 0.06, s * 0.28, 0.75, 0.32, 0.35, 0, 0);
      k.box(B, 'metal', 0.24, 0.22, 0.3, s * 0.2, 0.08, 0.05);
      k.vent(s * 0.3, 2.0, -0.45);
    }
    for (let i = 0; i < 3; i++) { const r = k.tor(B, 0xbaf0ff, 0.29, 0.02, 0, 1.25 + i * 0.25, -0.45, PI / 2, 0, 0, 12); k.pulse(r, 0.08, 6 + i); }
    k.box(B, 'trim', 0.8, 0.06, 0.54, 0, 1.95, 0);
    k.box(B, 'metal', 0.44, 0.14, 0.44, 0, 2.5, 0); k.cone(B, 'metal', 0.25, 0.3, 4, 0, 2.7, 0, 0, PI / 4);
    const visor = k.box(B, 0xbaf0ff, 0.03, 0.2, 0.02, 0, 2.2, 0.205); k.weak(visor);
    for (const a of [b.armL, b.armR]) { k.box(a, 'main', 0.26, 0.2, 0.26, 0, 0, 0); k.box(a, 'metal', 0.2, 0.14, 0.2, 0, -0.7, 0); }
  },
  tithe(k, b) { // the weigher: coin-stacked pans, ledger tome, high collar, cloak tails, spinning coin halo
    const B = b.body;
    k.box(B, 'mask', 0.56, 0.18, 0.4, 0, 2.18, 0);                          // collar
    for (const s of [1, -1]) { k.box(B, 'dark', 0.14, 0.7, 0.04, s * 0.22, 0.9, -0.42, 0.25, 0, s * 0.15); k.box(B, 'metal', 0.18, 0.12, 0.26, s * 0.16, 0.06, 0.04); }
    k.cone(B, 'dark', 0.6, 0.5, 6, 0, 0.75, 0);
    k.tor(B, 'trim', 0.32, 0.03, 0, 1.65, 0, PI / 2, 0, 0, 12);
    k.box(B, 'main', 0.3, 0.38, 0.12, 0.42, 1.25, 0.05, 0, 0, 0.1);         // ledger tome
    k.box(B, 'mask', 0.26, 0.34, 0.13, 0.43, 1.25, 0.05, 0, 0, 0.1);
    k.cyl(B, 'trim', 0.06, 0.06, 0.6, 6, 0, 2.66, -0.1);                    // beam post
    const eye = k.box(B, 0xffc23a, 0.16, 0.025, 0.02, 0, 2.42, 0.19); k.weak(eye);
    b.pans.forEach((p) => { for (let i = 0; i < 3; i++) k.cyl(p, 'trim', 0.1, 0.1, 0.05, 8, (i - 1) * 0.12, -0.44 + (i === 1 ? 0.05 : 0), 0); k.tor(p, 'trim', 0.3, 0.02, 0, -0.5, 0, PI / 2, 0, 0, 12); });
    const halo = k.grp(B, 0, 2.55, -0.25); k.spin(halo, 'z', 1.4, 3);
    for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; k.cyl(halo, 0xffc23a, 0.07, 0.07, 0.02, 8, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, PI / 2); }
    for (const a of [b.armL, b.armR]) k.box(a, 'mask', 0.16, 0.12, 0.16, 0, 0, 0);
    k.vent(0, 2.7, 0);
  },
  hymnworks(k, b) { // the fortress: stained-glow windows, flame-tipped pipes, bells, toothed gear ring, drum rims
    const B = b.body;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2 + PI / 8;
      k.box(B, i % 2 ? 0xff3a4a : 0xffb04a, 0.3, 0.32, 0.02, Math.sin(a) * 1.5, 0.32, Math.cos(a) * 1.5, -0.08, a, 0);
      k.box(B, 'trim', 0.08, 0.5, 0.06, Math.sin(a + PI / 8) * 1.52, 0.32, Math.cos(a + PI / 8) * 1.52, 0, a, 0);
    }
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; k.cone(B, 'metal', 0.12, 0.5, 4, Math.sin(a) * 1.4, 1.1, Math.cos(a) * 1.4); k.cone(B, 'trim', 0.18, 0.3, 8, Math.sin(a) * 1.75, 0.55, Math.cos(a) * 1.75, PI); }
    for (let i = 0; i < 9; i += 2) { const a = PI * 0.15 + (i / 8) * PI * 0.7 + PI, h = 1.6 + (1 - Math.abs(i - 4) / 4) * 1.8; const f = k.cone(B, 0xff7a3a, 0.07, 0.22, 5, Math.sin(a) * 1.0, 1.0 + h, Math.cos(a) * 1.0); k.pulse(f, 0.35, 8 + i); k.vent(Math.sin(a) * 1.0, 1.0 + h, Math.cos(a) * 1.0); }
    const gear = k.grp(B, 0, 0.86, 0); k.spin(gear, 'y', 0.3, 6);
    k.tor(gear, 'trim', 1.32, 0.05, 0, 0, 0, PI / 2, 0, 0, 24);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; k.box(gear, 'metal', 0.12, 0.1, 0.14, Math.sin(a) * 1.4, 0, Math.cos(a) * 1.4, 0, a, 0); }
    const D = b.drum;
    for (const y of [-0.3, 0.3]) k.tor(D, 'trim', 0.76, 0.04, 0, y, 0, PI / 2, 0, 0, 20);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2; k.tor(D, 'trim', 0.12, 0.03, Math.sin(a) * 1.08, 0, Math.cos(a) * 1.08, 0, a, 0, 10); }
    const eye = D.children.find((c) => c.material?.isMeshBasicMaterial); if (eye) k.weak(eye);
  },
  nail(k, b) { // the 12th unique leader: a nail-crowned iron reliquary, cage-ribs round a twin-shelled core,
    //            glowing throats, a floating ring of nails and a great spiked halo-wheel behind it
    const B = b.body;
    for (let i = 0; i < 22; i++) { const a = i * 2.4 + 0.7, y = 0.9 + (i % 6) * 0.16; k.box(B, 'metal', 0.04, 0.04, 0.38 + (i % 3) * 0.12, Math.sin(a) * 0.56, y, Math.cos(a) * 0.48, (i % 4 - 1.5) * 0.15, a, 0); }
    for (let i = -2; i <= 2; i++) k.box(B, 'dark', 0.06, 1.05, 0.06, i * 0.12, 1.3, 0.47);   // cage bars over the core
    k.box(B, 'trim', 0.7, 0.06, 0.08, 0, 1.8, 0.47); k.box(B, 'trim', 0.7, 0.06, 0.08, 0, 0.8, 0.47);
    k.box(B, 'metal', 1.2, 0.14, 1.0, 0, 0.78, 0); k.box(B, 'metal', 1.16, 0.12, 0.96, 0, 1.84, 0);
    const shell = k.oct(B, 0x5aa8ff, 0.24, 0, 1.3, 0.3); k.spin(shell, 'y', 2, 5);
    k.weakOnly(b.core);
    for (const s of [1, -1]) {
      k.box(B, 'metal', 0.34, 0.5, 0.42, s * 0.3, 0.32, 0.03); k.cone(B, 'metal', 0.06, 0.3, 4, s * 0.3, 0.6, 0.26, PI / 2);
      k.cyl(B, 'metal', 0.03, 0.03, 0.8, 4, s * 0.6, 1.0, 0.3, 0, 0, s * 0.1);                     // hanging chains
      k.cone(B, 'mask', 0.05, 0.3, 4, s * 0.62, 0.52, 0.3, PI);
    }
    for (let i = 0; i < 7; i++) k.cone(B, 'mask', 0.06, 0.5 + (3 - Math.abs(i - 3)) * 0.1, 4, (i - 3) * 0.16, 1.95 + (3 - Math.abs(i - 3)) * 0.05, -0.42, -0.5); // spine nails
    b.heads.forEach((h, i) => {
      k.box(h, 'metal', 0.28, 0.06, 0.26, 0, 0.16, 0);
      k.cone(h, 'mask', 0.03, 0.22 + (i % 2) * 0.1, 4, 0, 0.3, -0.02);
      const m = k.box(h, 0x9ad8ff, 0.1, 0.05, 0.02, 0, -0.06, 0.125); k.pulse(m, 0.5, 11 + i);
      k.box(h, 0xd8f0ff, 0.04, 0.03, 0.02, 0.06, 0.05, 0.115); k.box(h, 0xd8f0ff, 0.04, 0.03, 0.02, -0.06, 0.05, 0.115);
    });
    const wheel = k.grp(B, 0, 2.55, -0.55); k.spin(wheel, 'z', 0.5, 7);
    k.tor(wheel, 'metal', 0.95, 0.05, 0, 0, 0, 0, 0, 0, 28);
    k.tor(wheel, 0x9ad8ff, 0.8, 0.02, 0, 0, 0, 0, 0, 0, 28);
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, l = i % 2 ? 0.35 : 0.6; k.cone(wheel, 'mask', 0.04, l, 4, Math.cos(a) * (0.95 + l / 2), Math.sin(a) * (0.95 + l / 2), 0, 0, 0, a - PI / 2); }
    const orbit = k.grp(B, 0, 1.3, 0); k.spin(orbit, 'y', 1.2, 5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; k.cone(orbit, 'mask', 0.035, 0.36, 4, Math.cos(a) * 1.0, Math.sin(a * 3) * 0.12, Math.sin(a) * 1.0, PI / 2, -a, 0); k.box(orbit, 0x9ad8ff, 0.04, 0.04, 0.04, Math.cos(a) * 1.0, Math.sin(a * 3) * 0.12 + 0.02, Math.sin(a) * 1.0); }
    for (const a of [b.armL, b.armR]) { k.box(a, 'metal', 0.22, 0.18, 0.22, 0, 0, 0); for (let i = 0; i < 3; i++) k.cone(a, 'mask', 0.025, 0.4, 4, (i - 1) * 0.06, -1.25, 0.05, PI); }
    k.vent(0, 3.0, -0.55);
  },
};

// ---------- merge every static mesh per (parent, material) ----------
function protectedSet(b) {
  const set = new Set();
  const visit = (v, depth) => {
    if (!v || typeof v !== 'object' || depth > 2) return;
    if (v.isObject3D) { set.add(v); return; }
    if (Array.isArray(v)) { for (const x of v) visit(x, depth + 1); return; }
    if (v.constructor === Object) for (const x of Object.values(v)) visit(x, depth + 1);
  };
  for (const [key, v] of Object.entries(b)) if (key !== 'scene' && key !== 'world' && key !== 'mats') visit(v, 0);
  for (const s of b.dress.spin) set.add(s.o);
  for (const p of b.dress.pulse) set.add(p.o);
  return set;
}
const _mx = new THREE.Matrix4();
function mergeStatic(b) {
  const keep = protectedSet(b), made = [];
  const nodes = []; b.root.traverse((o) => nodes.push(o));
  for (const node of nodes) {
    const byMat = new Map();
    for (const c of node.children) {
      if (!c.isMesh || keep.has(c) || c.children.length || Array.isArray(c.material) || Object.keys(c.userData).length) continue;
      (byMat.get(c.material) || byMat.set(c.material, []).get(c.material)).push(c);
    }
    for (const [mat, list] of byMat) {
      if (list.length < 2) continue;
      let n = 0; const geos = [];
      for (const c of list) {
        c.updateMatrix(); _mx.copy(c.matrix);
        const src = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        src.applyMatrix4(_mx); geos.push(src); n += src.attributes.position.count;
      }
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
      for (const q of geos) { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; q.dispose(); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = list.some((c) => c.castShadow);
      for (const c of list) node.remove(c);
      node.add(m); made.push(geo);
    }
  }
  b.dress.geos = made;
}

// called from Boss.build() right after buildModel()
export function dressBoss(b) {
  const id = b.def.id, [metal, trim] = PAL[id] || [0x333333, 0xaa8844];
  b.mats.metal = new THREE.MeshLambertMaterial({ color: metal });
  b.mats.trim = new THREE.MeshLambertMaterial({ color: trim });
  b.dress = { spin: [], pulse: [], vents: [], weak: [], energy: BOSS_ENERGY[id] ?? 0xff7a1a, last: '', ventT: 0, deathStep: 0, t0: 0 };
  try { DRESS[id]?.(new Kit(b), b); } catch (e) { console.warn('boss dress', id, e); }
  mergeStatic(b);
}

export function undressBoss(b) { for (const q of b.dress?.geos || []) q.dispose(); }

// ---------- animated components + presentation (every machine, from the boss's own state) ----------
const _v = new THREE.Vector3();
const DEATH_COLORS = [0x3a3634, 0x6a5a48, 0x2a2623];
export function tickDress(b, dt, t) {
  const d = b.dress; if (!d) return;
  const st = b.state, tele = st === 'telegraph', k = tele ? Math.min(1, b.stateTime / (b.telegraphTime || 1)) : 0;
  const busy = tele || st === 'charging' || st === 'beaming' || st === 'spiraling' || st === 'ledgering' || st === 'mirroring' || st === 'linking';
  const dead = st === 'dead';
  const fade = dead ? Math.max(0, 1 - b.stateTime / 1.8) : 1;
  for (const s of d.spin) s.o.rotation[s.axis] = (s.o.rotation[s.axis] + dt * s.speed * (busy ? s.boost : dead ? 0.2 : 1)) % (PI * 2);
  for (const p of d.pulse) {
    const w = 1 + p.amp * Math.sin(t * p.speed * (tele ? 2 : 1)) + (tele ? 0.6 * k : 0);
    p.o.scale.copy(p.base).multiplyScalar(Math.max(0.01, w * fade));
  }
  if (d.needle) d.needle.rotation.z = tele ? -2.2 * k : -0.4 + Math.sin(t * 1.3) * 0.3;
  const fx = b.world?.effects; if (!fx?.localSparks) { d.last = st; return; } // headless harness / no renderer
  const S = b.scale, R = b.root, ry = b.facing;
  const at = (v) => _v.set(b.position.x + (v.x * Math.cos(ry) + v.z * Math.sin(ry)) * S, (R.position.y || 0) + v.y * S, b.position.z + (-v.x * Math.sin(ry) + v.z * Math.cos(ry)) * S);
  // wind-up: vents spit the boss's energy colour, faster as the attack comes due
  d.ventT -= dt;
  if (tele && d.vents.length && d.ventT <= 0) {
    d.ventT = 0.22 - 0.15 * k;
    for (const v of d.vents) fx.localSparks(at(v).clone(), d.energy, 1 + Math.round(k * 2), 2 + 3 * k);
  } else if (st === 'recover' && d.vents.length && d.ventT <= 0) { // spent: grey steam
    d.ventT = 0.3; fx.localSparks(at(d.vents[0]).clone(), 0x9a948a, 2, 1.5);
  }
  if (st !== d.last) {
    const was = d.last; d.last = st;
    const foot = _v.set(b.position.x, 0.05, b.position.z).clone();
    if (st === 'telegraph' && was !== 'telegraph') { fx.localRing(foot, d.energy, Math.max(1.2, b.radius * 1.15), 0.3); sound.play('charge'); }
    if ((was === 'telegraph' || was === 'charging' || was === 'spiraling' || was === 'beaming') && st === 'recover') { // the hit landed: impact + recovery
      fx.localRing(foot, 0xffe2b0, b.radius * 1.6, 0.25);
      fx.scrap(foot, 4, DEATH_COLORS, 0.6, 0.8); sound.play('stomp');
    }
    if (st === 'charging') sound.play('clank');
    if (st === 'dead') { d.deathStep = 0; fx.localRing(foot, d.energy, b.radius * 2, 0.5); sound.play('fuse'); }
  }
  if (dead) { // staged death: weak points flare and pop, armour sheds, then the core blows
    const steps = [0.35, 0.8, 1.3, 1.9];
    while (d.deathStep < steps.length && b.stateTime >= steps[d.deathStep]) {
      const i = d.deathStep++;
      const w = d.weak[i % Math.max(1, d.weak.length)];
      const p = w ? w.o.getWorldPosition(new THREE.Vector3()) : at(_v.set(0, 1.5, 0)).clone();
      fx.localSparks(p, d.energy, 8, 7); fx.scrap(p, i === 3 ? 10 : 5, DEATH_COLORS, p.y, i === 3 ? 1.4 : 1);
      sound.play(i === 3 ? 'scrap' : 'clank');
      if (i === 3) fx.localRing(_v.set(b.position.x, 0.05, b.position.z).clone(), d.energy, b.radius * 3, 0.6);
    }
  }
}

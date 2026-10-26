// boss-designs.js (Phase 5C stage 3): the new bodies for all twelve bosses (see boss-rigs.js).
// Body space, model units (the root is scaled by def.scale; collision radius stays 0.6 * scale).
// Each design: build(r, b, H) declares geometry per animated handle; anim() adds model-specific motion
// on top of the boss's own pose() (rotors, pistons, bellows, pendulums...). Visual only.
import { box, cyl, cone, sph, oct, ico, dod, tor, shell, lathe, slab, tube } from './boss-rigs.js?v=1.33.0';

const PI = Math.PI;
const busy = (st) => st === 'telegraph' || st === 'charging' || st === 'beaming' || st === 'spiraling' || st === 'ledgering' || st === 'mirroring' || st === 'linking' || st === 'inhaling';

// ---- shared parts ----
// a heavy armoured leg standing on the ground under hip (x, z)
function heavyLeg(r, g, x, z, { hip = 0.85, w = 0.34, c1, c2, c3, toes = 3, flare = 0 }) {
  r.h(g, c1, box(w * 1.1, hip * 0.5, w), x + flare * 0.3, hip * 0.72, z, 0, 0, flare * 0.4);           // thigh armour
  r.h(g, c2, cyl(w * 0.32, w * 0.32, hip * 0.5, 6), x + flare * 0.15, hip * 0.5, z, 0, 0, flare);      // knee piston
  r.h(g, c1, box(w * 1.25, w * 0.5, w * 1.05), x, hip * 0.42, z + 0.04, 0.2, 0, 0);                    // knee cap
  r.h(g, c3, cyl(w * 0.45, w * 0.6, hip * 0.38, 6), x, hip * 0.2, z);                                  // shin
  r.h(g, c1, box(w * 1.5, 0.14, w * 1.8), x, 0.07, z + w * 0.25);                                     // foot
  for (let i = 0; i < toes; i++) r.h(g, c2, cone(0.06, 0.22, 4), x + (i - (toes - 1) / 2) * w * 0.45, 0.06, z + w * 1.2, PI / 2, 0, 0);
}
// a cable hanging between two points
const cable = (r, g, hex, a, bb, sag = 0.15, rad = 0.025) => r.h(g, hex, tube([a, [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 - sag, (a[2] + bb[2]) / 2], bb], rad, 6, 4));
// a riveted band ring around a vertical cylinder
function band(r, g, hex, y, rad, n = 8, rivet) {
  r.h(g, hex, cyl(rad, rad, 0.07, 10), 0, y, 0);
  if (rivet) for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; r.h(g, rivet, box(0.045, 0.045, 0.045), Math.sin(a) * (rad + 0.02), y, Math.cos(a) * (rad + 0.02)); }
}

export const DESIGNS = {};

// =====================================================================================================
// THE NAIL CHORUS - final boss. An iron reliquary-cathedral on four splayed spike legs: an open
// iron-maiden cage chest around a blue core, a yoke carrying five screaming choir-masks on cabled
// necks, a great crown-fan of nails behind that spins up for the SPIRAL, a nail ring at the waist and
// two lance-arms of bundled nails (raised for NAIL RAIN).
DESIGNS.nail = {
  wear: { rust: 0.3, var: 0.25 },
  build(r, b) {
    const I = 0x3a3e48, D = 0x1c1e24, B = 0x5c606c, BONE = 0xd8d2c0, RUSTY = 0x5a3a2a, EN = 0x9ad8ff, EN2 = 0xe8f6ff;
    // four splayed spider legs
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const hx = sx * 0.32, hz = sz * 0.22, kx = sx * 0.95, kz = sz * 0.7, fx = sx * 1.05, fz = sz * 0.85;
      r.h('body', D, box(0.3, 0.3, 0.3), hx, 0.95, hz, 0.3, 0.3, 0);
      r.h('body', I, tube([[hx, 0.95, hz], [(hx + kx) / 2, 1.2, (hz + kz) / 2], [kx, 1.05, kz]], 0.1, 5, 6));
      r.h('body', B, box(0.22, 0.12, 0.42), (hx + kx) / 2, 1.24, (hz + kz) / 2, 0, Math.atan2(sx, sz), 0);          // thigh plate
      r.h('body', D, sph(0.12, 7, 5), kx, 1.05, kz);
      r.h('body', I, tube([[kx, 1.05, kz], [fx, 0.5, fz], [fx * 0.98, 0.05, fz * 0.98]], 0.07, 4, 5));
      r.h('body', BONE, cone(0.07, 0.3, 4), fx * 0.98, 0.08, fz * 0.98, PI, 0, 0);                                  // nail-tip foot
      r.h('body', BONE, cone(0.035, 0.32, 4), kx, 1.25, kz, -sz * 0.4, 0, sx * 0.4);                                // knee spike
    }
    // pelvis + waist hub
    r.h('body', D, cyl(0.42, 0.34, 0.3, 8), 0, 0.95, 0);
    r.h('body', I, cyl(0.5, 0.46, 0.1, 8), 0, 1.08, 0);
    // iron-maiden cage torso
    r.h('body', I, shell([[0.38, 1.1], [0.58, 1.35], [0.62, 1.7], [0.5, 2.0], [0.3, 2.12]], 0.06, 8));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + PI / 8; if (Math.abs(Math.sin(a)) < 0.5 && Math.cos(a) > 0) continue;
      r.h('body', B, box(0.06, 0.95, 0.05), Math.sin(a) * 0.62, 1.6, Math.cos(a) * 0.62, -Math.cos(a) * 0.08, a, Math.sin(a) * 0.08); }
    // open chest doors with inner nails
    r.sym((s) => { r.h('body', B, slab([[0, 0.45], [0.3, 0.38], [0.32, -0.4], [0, -0.45]], 0.05), s * 0.5, 1.55, 0.5, 0, s * 2.1, 0);
      for (const y of [1.3, 1.55, 1.8]) r.h('body', BONE, cone(0.025, 0.2, 4), s * 0.42, y, 0.72, 0, 0, s * PI / 2); });
    for (const y of [1.25, 1.85]) r.h('body', D, box(0.7, 0.06, 0.08), 0, y, 0.56);
    for (const x of [-0.14, 0, 0.14]) r.h('body', D, box(0.04, 0.7, 0.04), x, 1.55, 0.52);                       // cage bars over the core
    r.h('body', RUSTY, tor(0.24, 0.04, 4, 10), 0, 1.3, 0.38);
    r.e('body', EN, cyl(0.17, 0.17, 0.05, 8), 0, 1.3, 0.33, PI / 2, 0, 0);
    // the core itself (pose() scales the old core handle -> pulses while singing)
    r.e('core', EN2, ico(0.15, 0), 0, 1.3, 0.3);
    r.e('core', EN, oct(0.22), 0, 1.3, 0.28);
    // nails driven through the body
    for (let i = 0; i < 18; i++) { const a = i * 2.39 + 0.3, y = 1.2 + (i % 6) * 0.15; if (Math.cos(a) > 0.6) continue;
      r.h('body', BONE, cone(0.035, 0.55, 4), Math.sin(a) * 0.62, y, Math.cos(a) * 0.62, Math.cos(a) * PI / 2 * 0.95, 0, -Math.sin(a) * PI / 2 * 0.95); }
    // shoulder yoke
    r.h('body', I, box(1.5, 0.2, 0.42), 0, 2.08, -0.02);
    r.h('body', D, box(1.6, 0.08, 0.46), 0, 2.2, -0.02);
    r.sym((s) => { r.h('body', B, slab([[0, 0.14], [0.4, 0.06], [0.44, -0.12], [0, -0.16]], 0.36), s * 0.55, 2.06, 0, 0, s > 0 ? 0 : PI, s * 0.25);
      r.h('body', BONE, cone(0.05, 0.45, 4), s * 0.92, 2.25, 0, 0, 0, -s * 0.9); r.h('body', BONE, cone(0.04, 0.35, 4), s * 0.8, 2.35, -0.15, -0.3, 0, -s * 0.5); });
    r.rivets('body', BONE, [[-0.6, 2.08, 0.22], [-0.3, 2.08, 0.22], [0, 2.08, 0.22], [0.3, 2.08, 0.22], [0.6, 2.08, 0.22]]);
    // necks (cabled) + five choir masks
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45, x = Math.sin(a) * 0.55, z = Math.cos(a) * 0.15, hy = 1.85 + 0.5 + (i % 2) * 0.2;
      r.h('body', D, tube([[x * 0.8, 2.15, z - 0.05], [x * 1.05, hy - 0.35, z - 0.08], [x, hy - 0.12, z]], 0.06, 5, 5));
      r.h('body', I, cyl(0.08, 0.08, 0.05, 6), x * 0.95, hy - 0.3, z - 0.07); r.h('body', I, cyl(0.07, 0.07, 0.05, 6), x * 1.0, hy - 0.2, z - 0.04);
      const g = 'heads' + i, M = i === 2 ? 0xe8e2d0 : BONE;
      r.h(g, M, box(0.24, 0.3, 0.18), x, hy + 0.04, z + 0.02);                                     // long mask
      r.h(g, M, box(0.2, 0.12, 0.16), x, hy - 0.15, z + 0.06, 0.35, 0, 0);                          // dropped jaw
      r.h(g, D, box(0.26, 0.05, 0.2), x, hy + 0.2, z);                                              // brow band
      r.e(g, EN, box(0.05, 0.03, 0.02), x - 0.06, hy + 0.08, z + 0.115); r.e(g, EN, box(0.05, 0.03, 0.02), x + 0.06, hy + 0.08, z + 0.115);
      r.e(g, EN2, box(0.09, 0.1, 0.02), x, hy - 0.07, z + 0.12);                                    // singing mouth
      for (let j = -1; j <= 1; j++) r.h(g, I, cone(0.03, 0.18 + (j === 0 ? 0.1 : 0) + (i === 2 ? 0.12 : 0), 4), x + j * 0.08, hy + 0.3 + (j === 0 ? 0.05 : 0), z, 0, 0, -j * 0.3); // iron crown
      r.h(g, BONE, cone(0.02, 0.36, 4), x, hy + 0.04, z + 0.05, PI / 2 + 0.3, 0, 0.4);             // nail through the mask
    }
    // back: crown-fan of great nails (spins up for the SPIRAL)
    r.sub('fan', 'body', 0, 2.0, -0.5);
    r.h('fan', I, tor(0.42, 0.06, 4, 14), 0, 2.0, -0.5);
    r.h('fan', D, cyl(0.16, 0.16, 0.18, 8), 0, 2.0, -0.5, PI / 2, 0, 0);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2, L = i % 2 ? 0.75 : 1.1;
      r.h('fan', BONE, cone(0.05, L, 4), Math.sin(a) * (0.42 + L / 2), 2.0 + Math.cos(a) * (0.42 + L / 2), -0.5, 0, 0, -a);
      r.h('fan', I, box(0.11, 0.11, 0.08), Math.sin(a) * 0.48, 2.0 + Math.cos(a) * 0.48, -0.5, 0, 0, -a); }
    r.e('fan', EN, tor(0.3, 0.025, 3, 12), 0, 2.0, -0.44);
    // waist nail ring (spins with the spiral)
    r.sub('ring', 'body', 0, 1.12, 0);
    r.h('ring', D, tor(0.68, 0.045, 4, 16), 0, 1.12, 0, PI / 2, 0, 0);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; r.h('ring', BONE, cone(0.035, 0.3, 4), Math.sin(a) * 0.82, 1.12, Math.cos(a) * 0.82, PI / 2, a, 0); }
    // lance arms: bundled nails
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.65;
      r.h(g, I, sph(0.2, 7, 5), x, 1.6, 0);
      r.h(g, B, slab([[0, 0.22], [0.3, 0.05], [0.25, -0.25], [-0.05, -0.2]], 0.36), x + s * 0.02, 1.68, 0, 0, s > 0 ? 0 : PI, -s * 0.3);
      r.h(g, D, cyl(0.08, 0.07, 0.6, 6), x, 1.3, 0);
      r.h(g, I, box(0.2, 0.3, 0.2), x, 0.98, 0.02);
      r.h(g, RUSTY, tor(0.12, 0.03, 3, 8), x, 0.85, 0.04, PI / 2, 0, 0);
      for (const [dx, dz, L] of [[0, 0, 0.95], [0.06, 0.05, 0.75], [-0.06, 0.05, 0.7], [0, -0.06, 0.6]]) r.h(g, BONE, cone(0.045, L, 4), x + dx, 0.8 - L / 2, 0.04 + dz, PI, 0, 0);
    });
    r.vents.push([0, 2.2, -0.55], [0.6, 2.25, -0.1], [-0.6, 2.25, -0.1]);
    r.weak.push(['core', 0, 1.3, 0.3], ['heads0', -0.43, 2.35, 0.1], ['heads4', 0.43, 2.35, 0.1], ['heads2', 0, 2.35, 0.15]);
  },
  anim(b, P, t, dt, st) {
    const fast = st === 'spiraling' ? 7 : busy(st) ? 2.5 : 0.5;
    P.fan.pivot.rotation.z += dt * fast;
    P.ring.pivot.rotation.y -= dt * fast * 0.8;
  },
};

// =====================================================================================================
// SISTER KLAXON - the Siren Engine. A spindly three-legged siren tower: a speaker cabinet torso,
// a rotating siren beacon, a GIANT flared brass horn for a head (the shriek comes out of it; its
// throat-diaphragm flares on the wind-up), a ring of bolt emitters at the waist for the GAP RING,
// a back compressor fan, and two long tuning-fork arms.
DESIGNS.klaxon = {
  wear: { rust: 0.22, var: 0.2 },
  build(r) {
    const BR = 0xb88a3a, BR2 = 0x8a6428, D = 0x2a2018, I = 0x4a4038, BONE = 0xe8d8a8, EN = 0xffd23a, EN2 = 0xfff0b0;
    // tripod of long insect legs (knees high)
    for (const a of [0, 2.1, 4.2]) {
      const hx = Math.sin(a) * 0.25, hz = Math.cos(a) * 0.25, kx = Math.sin(a) * 0.75, kz = Math.cos(a) * 0.75, fx = Math.sin(a) * 0.9, fz = Math.cos(a) * 0.9;
      r.h('body', I, tube([[hx, 0.95, hz], [kx * 0.8, 1.25, kz * 0.8], [kx, 1.15, kz]], 0.07, 5, 5));
      r.h('body', BR2, sph(0.1, 6, 4), kx, 1.15, kz);
      r.h('body', D, tube([[kx, 1.15, kz], [fx, 0.55, fz], [fx * 0.96, 0.04, fz * 0.96]], 0.055, 4, 5));
      r.h('body', BR, cyl(0.03, 0.03, 0.5, 4), (kx + fx) / 2 + Math.sin(a) * 0.06, 0.75, (kz + fz) / 2 + Math.cos(a) * 0.06, -Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); // hydraulic
      r.h('body', D, cyl(0.12, 0.16, 0.08, 6), fx * 0.96, 0.04, fz * 0.96);
    }
    // speaker cabinet torso
    r.h('body', D, cyl(0.3, 0.38, 0.25, 8), 0, 0.98, 0);
    r.h('body', BR2, cyl(0.45, 0.38, 0.75, 10), 0, 1.45, 0);
    band(r, 'body', BR, 1.12, 0.41, 10, BONE); band(r, 'body', BR, 1.78, 0.46, 10, BONE);
    r.h('body', D, cyl(0.36, 0.36, 0.06, 10), 0, 1.45, 0.25, PI / 2, 0, 0); // front speaker
    r.h('body', I, shell([[0.33, 0], [0.22, 0.12], [0.1, 0.14]], 0.03, 10), 0, 1.45, 0.28, PI / 2, 0, 0);
    r.e('body', EN, cyl(0.08, 0.08, 0.03, 8), 0, 1.45, 0.42, PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) r.h('body', BR, box(0.04, 0.6, 0.04), Math.sin(i * 1.05) * 0.46, 1.45, Math.cos(i * 1.05) * 0.46 * 0.5 - 0.15);
    // bolt-emitter ring at the waist (spins up on the GAP RING)
    r.sub('ring', 'body', 0, 1.12, 0);
    r.h('ring', D, tor(0.58, 0.05, 4, 18), 0, 1.12, 0, PI / 2, 0, 0);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * PI * 2; r.h('ring', BR, cyl(0.06, 0.08, 0.14, 6), Math.sin(a) * 0.62, 1.12, Math.cos(a) * 0.62, PI / 2, a, 0); r.e('ring', EN, box(0.06, 0.06, 0.03), Math.sin(a) * 0.7, 1.12, Math.cos(a) * 0.7, 0, a, 0); }
    // neck pipes up to the horn
    r.h('body', I, cyl(0.16, 0.22, 0.4, 8), 0, 2.0, -0.2);
    for (const s of [1, -1]) r.h('body', BR, tube([[s * 0.3, 1.8, -0.1], [s * 0.4, 2.1, -0.3], [s * 0.2, 2.3, -0.5]], 0.045, 5, 4));
    // back compressor + fan
    r.h('body', I, cyl(0.28, 0.28, 0.4, 10), 0, 1.5, -0.5, PI / 2, 0, 0);
    r.sub('fan', 'body', 0, 1.5, -0.72);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; r.h('fan', BR2, box(0.08, 0.24, 0.02), Math.sin(a) * 0.14, 1.5 + Math.cos(a) * 0.14, -0.72, 0.3, 0, -a); }
    r.h('fan', D, tor(0.27, 0.025, 3, 12), 0, 1.5, -0.72);
    // the GREAT HORN (old horn handle: pose() swells it on the wind-up). Authored round (0, 2.1, 0.35).
    const hz = 0.35;
    r.h('horn', BR, shell([[0.13, 0], [0.16, 0.4], [0.26, 0.75], [0.45, 1.0], [0.7, 1.12]], 0.05, 14), 0, 2.1, hz - 0.55, PI / 2, 0, 0);
    r.h('horn', BR2, tor(0.68, 0.05, 4, 18), 0, 2.1, hz + 0.57);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; r.h('horn', BONE, box(0.05, 0.05, 0.05), Math.sin(a) * 0.72, 2.1 + Math.cos(a) * 0.72, hz + 0.58); }
    for (const zz of [-0.25, 0.1]) r.h('horn', D, tor(0.22 + (zz + 0.25) * 0.5, 0.035, 3, 12), 0, 2.1, hz + zz);
    r.h('horn', I, box(0.1, 0.5, 0.1), 0, 2.6, hz - 0.2, -0.5, 0, 0);                                   // horn bracket
    // throat diaphragm (old throat handle: flares on the wind-up)
    r.e('throat', EN, cyl(0.2, 0.2, 0.04, 12), 0, 2.1, -0.18, PI / 2, 0, 0);
    r.e('throat', EN2, cyl(0.09, 0.09, 0.05, 8), 0, 2.1, -0.15, PI / 2, 0, 0);
    // siren beacon on top
    r.h('body', D, cyl(0.12, 0.15, 0.2, 8), 0, 2.72, -0.35);
    r.sub('beacon', 'body', 0, 2.88, -0.35);
    r.h('beacon', BR2, cyl(0.14, 0.14, 0.12, 8), 0, 2.88, -0.35);
    r.e('beacon', EN, box(0.08, 0.1, 0.2), 0.16, 2.88, -0.35); r.e('beacon', 0xff6a20, box(0.08, 0.1, 0.2), -0.16, 2.88, -0.35);
    r.h('beacon', BONE, cone(0.06, 0.18, 6), 0, 3.02, -0.35);
    // tuning-fork arms
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.45;
      r.h(g, BR, sph(0.16, 7, 5), x, 1.7, 0);
      r.h(g, BR2, shell([[0.2, 0.1], [0.16, -0.1], [0.06, -0.15]], 0.03, 8), x + s * 0.05, 1.8, 0, 0, 0, -s * 0.3);  // small siren cone pauldron
      r.h(g, D, cyl(0.06, 0.05, 0.55, 6), x, 1.38, 0);
      r.h(g, BR2, cyl(0.09, 0.09, 0.14, 6), x, 1.1, 0);
      r.h(g, I, cyl(0.05, 0.04, 0.3, 6), x, 0.92, 0.02);
      r.h(g, BR, box(0.26, 0.06, 0.08), x, 0.78, 0.04);
      for (const d of [-0.1, 0.1]) r.h(g, BR, box(0.04, 0.42, 0.06), x + d, 0.55, 0.04);
      r.e(g, EN, box(0.03, 0.3, 0.03), x, 0.6, 0.05);
    });
    r.vents.push([0, 2.95, -0.35], [0, 1.5, -0.75]);
    r.weak.push(['throat', 0, 2.1, -0.18], ['body', 0, 1.45, 0.42], ['ring', 0.6, 1.12, 0], ['ring', -0.6, 1.12, 0]);
  },
  anim(b, P, t, dt, st, k) {
    const shriek = b.attack === 'shriek' && st === 'telegraph', gap = b.attack === 'gapring' && (st === 'telegraph');
    P.beacon.pivot.rotation.y += dt * (busy(st) ? 14 : 3);
    P.ring.pivot.rotation.y += dt * (gap ? 9 : 0.8);
    P.fan.pivot.rotation.z += dt * (shriek ? 30 : 6);
  },
};

// =====================================================================================================
// THE FURNACE DEACON - a hunched cast-iron furnace-priest: a pot-bellied boiler torso with a roaring
// grated firebox, twin smokestacks on the shoulders, a small hooded skull-mask sunk between them,
// gorilla arms ending in anvil-headed hammer fists (raised for the SLAM), stubby armoured legs, a censer
// chain belt and a back bellows that pumps on the wind-up.
DESIGNS.deacon = {
  wear: { rust: 0.2, var: 0.24, soot: 0.25, heat: 0.08 },
  build(r) {
    const IR = 0x3a3634, IR2 = 0x56504a, BR = 0x7a3418, CU = 0xb07a3a, BONE = 0xd8cfb8, EN = 0xff7a1a, EN2 = 0xffd070;
    r.sym((s) => heavyLeg(r, 'body', s * 0.32, 0, { hip: 0.85, w: 0.36, c1: IR2, c2: CU, c3: IR, flare: s * 0.1 }));
    r.h('body', IR, box(0.9, 0.3, 0.6), 0, 0.88, 0);
    // boiler-belly torso
    r.h('body', BR, lathe([[0.001, 0.9], [0.55, 0.95], [0.72, 1.2], [0.75, 1.5], [0.66, 1.8], [0.45, 2.0], [0.001, 2.05]], 10), 0, 0, 0.02, 0, 0, 0, 1.05, 1, 0.82);
    band(r, 'body', IR2, 1.05, 0.66, 10, CU); r.h('body', IR2, cyl(0.76, 0.76, 0.08, 10), 0, 1.5, 0.02, 0, 0, 0); r.h('body', IR2, cyl(0.62, 0.62, 0.07, 10), 0, 1.85, 0.02);
    // firebox door + grate
    r.h('body', IR, box(0.62, 0.5, 0.1), 0, 1.3, 0.6);
    r.e('body', EN, box(0.5, 0.38, 0.03), 0, 1.3, 0.66);
    for (const y of [1.16, 1.25, 1.34, 1.43]) r.h('body', IR2, box(0.56, 0.04, 0.06), 0, y, 0.67);
    r.h('body', CU, box(0.7, 0.07, 0.1), 0, 1.58, 0.6); r.h('body', CU, box(0.7, 0.07, 0.1), 0, 1.02, 0.6);
    r.rivets('body', BONE, [[-0.3, 1.58, 0.66], [0.3, 1.58, 0.66], [-0.3, 1.02, 0.66], [0.3, 1.02, 0.66]], 0.05);
    r.sub('fire', 'body', 0, 1.3, 0.68);
    r.e('fire', EN2, box(0.3, 0.2, 0.02), 0, 1.24, 0.68);
    // shoulder slabs + smokestacks
    r.sym((s) => {
      r.h('body', IR2, slab([[0, 0.25], [0.45, 0.15], [0.5, -0.2], [0, -0.25]], 0.7), s * 0.5, 1.86, 0, 0, s > 0 ? 0 : PI, s * 0.15);
      r.h('body', IR, cyl(0.13, 0.17, 0.9, 8), s * 0.45, 2.35, -0.25, -0.12, 0, -s * 0.12);
      r.h('body', CU, cyl(0.19, 0.15, 0.1, 8), s * 0.5, 2.78, -0.3, -0.12, 0, -s * 0.12);
      r.e('body', EN, cyl(0.1, 0.1, 0.02, 8), s * 0.5, 2.84, -0.31, -0.12, 0, -s * 0.12);
      for (const y of [0.15, 0.4]) r.rivets('body', BONE, [[s * 0.45 + s * 0.15, 2.0 + y, -0.25]]);
    });
    // hooded skull-mask sunk low between the stacks
    r.h('body', IR, lathe([[0.001, 1.95], [0.3, 1.98], [0.33, 2.2], [0.22, 2.45], [0.06, 2.55], [0.001, 2.56]], 8), 0, 0, 0.12, 0, 0, 0, 0.9, 0.85, 0.85);
    r.h('body', BONE, box(0.34, 0.3, 0.2), 0, 2.13, 0.34, 0.15, 0, 0);
    r.h('body', BONE, box(0.24, 0.1, 0.16), 0, 1.97, 0.38, 0.3, 0, 0);
    r.e('body', 0xc8ff3a, box(0.1, 0.04, 0.02), -0.08, 2.17, 0.45); r.e('body', 0xc8ff3a, box(0.1, 0.04, 0.02), 0.08, 2.17, 0.45);
    r.h('body', CU, cone(0.05, 0.22, 4), 0, 2.58, 0.25, 0.2, 0, 0);
    // censer chain belt
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; r.h('body', CU, tor(0.05, 0.015, 3, 6), Math.sin(a) * 0.72, 0.98 - Math.abs(Math.sin(a * 0.5)) * 0.04, Math.cos(a) * 0.6, 0, a, 0); }
    r.h('body', CU, lathe([[0.001, -0.1], [0.1, -0.05], [0.12, 0.05], [0.04, 0.12]], 6), 0.55, 0.75, 0.35); r.e('body', EN, sph(0.05, 5, 4), 0.55, 0.78, 0.35);
    // back bellows (pumps on the wind-up)
    r.sub('bellows', 'body', 0, 1.4, -0.62);
    for (let i = 0; i < 4; i++) r.h('bellows', i % 2 ? IR : 0x5a4030, box(0.5 - i * 0.04, 0.6 - i * 0.05, 0.1), 0, 1.4, -0.62 - i * 0.08);
    r.h('bellows', CU, cyl(0.05, 0.08, 0.3, 6), 0, 1.4, -1.0, PI / 2, 0, 0);
    // gorilla arms + anvil hammer fists
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.72;
      r.h(g, IR2, sph(0.26, 8, 6), x, 1.65, 0);
      r.h(g, IR, cyl(0.15, 0.12, 0.55, 7), x, 1.3, 0);
      r.h(g, CU, cyl(0.17, 0.17, 0.1, 7), x, 1.05, 0);
      r.h(g, IR2, box(0.3, 0.4, 0.3), x, 0.86, 0.02);
      r.h(g, IR, box(0.62, 0.3, 0.42), x, 0.6, 0.02);                    // anvil hammer head
      r.h(g, IR2, box(0.72, 0.08, 0.5), x, 0.48, 0.02);
      r.h(g, IR, slab([[0, 0.1], [0.28, 0.0], [0, -0.1]], 0.36), x + s * 0.3, 0.62, 0.02, 0, s > 0 ? 0 : PI, 0); // anvil horn
      r.e(g, EN, box(0.5, 0.05, 0.02), x, 0.62, 0.235);
      r.h(g, CU, cone(0.06, 0.2, 4), x, 0.82, 0.25, PI / 2, 0, 0);
    });
    r.vents.push([0.5, 2.86, -0.31], [-0.5, 2.86, -0.31], [0, 1.3, 0.7]);
    r.weak.push(['body', 0, 1.3, 0.66], ['body', 0.5, 2.8, -0.3], ['body', -0.5, 2.8, -0.3], ['body', 0, 2.15, 0.4]);
  },
  anim(b, P, t, dt, st, k) {
    const pump = st === 'telegraph' ? 1 + 0.6 * Math.abs(Math.sin(t * 14)) : 1 + 0.15 * Math.sin(t * 2.5);
    P.bellows.pivot.scale.set(1, 1, pump);
    P.fire.pivot.scale.set(1, 1 + (st === 'telegraph' ? 0.8 * k : 0.2 * Math.sin(t * 9)), 1);
  },
};

// =====================================================================================================
// GULLETWORM - a burrowing scrap-annelid: five armoured ring segments of overlapping plates with
// clawed side-legs and cable bundles, rising from a mound of torn girders, topped by a lamprey drill-
// head: three mandible petals that peel open on the wind-up around a glowing toothed gullet (the
// VOLLEY / CHAIN come out of it), sensor eyes and a rotating tooth ring inside the throat.
DESIGNS.worm = {
  wear: { rust: 0.32, var: 0.25 },
  build(r) {
    const A = 0x4a4c40, A2 = 0x34362e, BR = 0x8a7a4a, D = 0x1e1f1a, BONE = 0xd8d0b0, EN = 0xc8ff3a, EN2 = 0xeaffa0;
    // mound of torn girders + slag
    for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2 + 0.2, rr = 1.0 + (i % 3) * 0.12;
      r.h('root', i % 2 ? A2 : D, box(0.75, 0.32, 0.42), Math.cos(a) * rr, 0.14, Math.sin(a) * rr, 0.3 * ((i % 3) - 1), -a, 0.25);
      if (i % 3 === 0) r.h('root', BR, box(0.12, 0.12, 1.1), Math.cos(a) * 1.15, 0.35, Math.sin(a) * 1.15, 0.6, -a + 0.8, 0.3); }
    r.h('root', D, cyl(1.0, 1.25, 0.18, 10), 0, 0.09, 0);
    r.e('root', EN, tor(0.85, 0.04, 3, 16), 0, 0.17, 0, PI / 2, 0, 0);
    // the segments (each sways on its own handle)
    for (let i = 0; i < 5; i++) {
      const g = 'segments' + i, y0 = 0.62 * i, rad = 0.66 - i * 0.04;
      r.h(g, D, cyl(rad * 0.8, rad * 0.85, 0.62, 8), 0, y0 + 0.3, 0);
      for (let j = 0; j < 8; j++) { const a = (j / 8) * PI * 2 + (i % 2) * 0.39;
        r.h(g, j % 2 ? A : A2, box(rad * 0.75, 0.46, 0.1), Math.sin(a) * rad, y0 + 0.34, Math.cos(a) * rad, -0.18, a, 0); }
      r.h(g, BR, cyl(rad + 0.04, rad + 0.04, 0.07, 10), 0, y0 + 0.6, 0);
      r.rivets(g, BONE, [0, 1, 2, 3, 4, 5].map((j) => [Math.sin(j * 1.05) * (rad + 0.06), y0 + 0.6, Math.cos(j * 1.05) * (rad + 0.06)]), 0.05);
      if (i < 4) r.sym((s) => { // clawed side legs
        r.h(g, A2, box(0.14, 0.14, 0.4), s * (rad + 0.15), y0 + 0.32, 0.08, 0.3, s * 0.6, 0);
        r.h(g, BONE, cone(0.05, 0.32, 4), s * (rad + 0.3), y0 + 0.18, 0.28, 0.8, 0, s * 0.3); });
      r.e(g, EN, box(0.1, 0.22, 0.04), 0, y0 + 0.32, -rad - 0.02);
      r.h(g, D, tube([[0.25, y0 + 0.05, -rad + 0.05], [0.32, y0 + 0.35, -rad - 0.12], [0.25, y0 + 0.66, -rad + 0.05]], 0.04, 5, 4));
    }
    // drill head
    const H = 'head', hy = 3.23;
    r.h(H, A2, cyl(0.62, 0.5, 0.5, 9), 0, hy + 0.1, 0);
    r.h(H, A, lathe([[0.001, -0.1], [0.6, -0.05], [0.72, 0.25], [0.62, 0.6], [0.3, 0.85], [0.001, 0.9]], 9), 0, hy + 0.1, -0.1, -0.5, 0, 0);
    r.h(H, BR, tor(0.6, 0.06, 4, 14), 0, hy + 0.3, 0.42, -0.5 + PI / 2, 0, 0);
    // gullet + teeth (rotating tooth ring)
    r.e(H, 0x6aff2a, cyl(0.42, 0.42, 0.04, 12), 0, hy + 0.26, 0.4, -0.5 + PI / 2, 0, 0);
    r.e(H, EN2, cyl(0.16, 0.16, 0.05, 8), 0, hy + 0.27, 0.42, -0.5 + PI / 2, 0, 0);
    r.sub('teeth', H, 0, hy + 0.26, 0.44);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; r.h('teeth', BONE, cone(0.06, 0.26, 4), Math.cos(a) * 0.38, hy + 0.26 + Math.sin(a) * 0.38 * Math.cos(0.5), 0.44 + Math.sin(a) * 0.38 * Math.sin(0.5), 0, 0, a + PI / 2); }
    // three mandible petals (peel open on the wind-up)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2 + PI / 2, px = Math.cos(a) * 0.55, py = hy + 0.26 + Math.sin(a) * 0.5, pz = 0.4;
      const g = r.sub('petal' + i, H, px, py, pz);
      r.h(g, A, slab([[-0.24, 0], [0.24, 0], [0.08, 0.6], [0, 0.7], [-0.08, 0.6]], 0.07), px, py, pz + 0.05, -0.6, 0, a - PI / 2);
      r.h(g, BONE, cone(0.05, 0.22, 4), px * 0.8, py - (py - hy - 0.26) * 0.2, pz + 0.3, PI / 2, 0, 0);
    }
    r.sym((s) => { r.e(H, EN, sph(0.08, 6, 4), s * 0.45, hy + 0.65, 0.15); r.h(H, D, cyl(0.1, 0.1, 0.08, 6), s * 0.45, hy + 0.65, 0.1, PI / 2, 0, 0); });
    r.h(H, BONE, cone(0.08, 0.5, 5), 0, hy + 1.05, -0.3, -0.7, 0, 0);
    r.vents.push([0, 3.8, -0.3], [0.5, 1.5, 0], [-0.5, 2.1, 0]);
    r.weak.push(['head', 0, 3.5, 0.42], ['segments1', 0, 0.95, -0.6], ['segments3', 0, 2.2, -0.55], ['head', 0.45, 3.9, 0.15]);
  },
  anim(b, P, t, dt, st, k) {
    const open = st === 'telegraph' ? k : st === 'recover' ? 0.2 : 0.15 + 0.08 * Math.sin(t * 3);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2 + PI / 2; P['petal' + i].pivot.rotation.set(-open * 0.8 * Math.sin(a), open * 0.8 * Math.cos(a), 0); }
    P.teeth.pivot.rotation.z += dt * (busy(st) ? 8 : 1.2);
  },
};

// =====================================================================================================
// THE HYMNWORKS - a stationary cathedral-engine fortress: a stepped octagonal plinth braced by four
// flying-buttress legs, a towering fan of mouthed organ pipes behind, a bell-spire, piston-driven
// bellows on the flanks that pump while it plays, and the rotating turret drum whose four bell-mouthed
// beam emitters line up with the real BEAMS (same positions as before) under a red cyclops eye.
DESIGNS.hymnworks = {
  wear: { rust: 0.25, var: 0.22, soot: 0.15 },
  build(r) {
    const I = 0x34302c, I2 = 0x4a4440, BR = 0xc8a050, BR2 = 0x8a6a30, D = 0x1c1a18, BONE = 0xd8cfb8, EN = 0xff3a4a, EN2 = 0xffb0a0;
    // stepped plinth
    r.h('body', D, cyl(1.5, 1.65, 0.35, 8), 0, 0.17, 0, 0, PI / 8, 0);
    r.h('body', I, cyl(1.35, 1.45, 0.3, 8), 0, 0.5, 0, 0, PI / 8, 0);
    r.h('body', BR2, cyl(1.28, 1.3, 0.08, 8), 0, 0.68, 0, 0, PI / 8, 0);
    r.h('body', I2, cyl(1.15, 1.25, 0.2, 8), 0, 0.8, 0, 0, PI / 8, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; r.h('body', BONE, box(0.06, 0.06, 0.06), Math.sin(a) * 1.42, 0.62, Math.cos(a) * 1.42); }
    // four flying-buttress legs
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4, sx = Math.sin(a), sz = Math.cos(a);
      r.h('body', I, slab([[0, 0], [0.75, 0], [0.75, 0.25], [0.1, 1.4], [0, 1.4]], 0.24), sx * 1.05, 0, sz * 1.05, 0, a - PI / 2, 0);
      r.h('body', D, box(0.5, 0.2, 0.5), sx * 1.75, 0.1, sz * 1.75, 0, a, 0);
      r.h('body', BR2, cone(0.12, 0.45, 4), sx * 1.15, 1.6, sz * 1.15, 0, a, 0); }
    // organ pipe fan behind (mouthed pipes, tallest centre)
    for (let i = 0; i < 11; i++) {
      const a = PI + PI * 0.12 + (i / 10) * PI * 0.76, c = 1 - Math.abs(i - 5) / 5, h = 1.4 + c * 2.3, rr = 0.11 + c * 0.06;
      const x = Math.sin(a) * 1.05, z = Math.cos(a) * 1.05;
      r.h('body', i % 2 ? BR : BR2, cyl(rr, rr, h, 8), x, 0.9 + h / 2, z);
      r.h('body', BR, cone(rr * 1.35, 0.3, 8), x, 0.9 + h + 0.12, z, PI, 0, 0);
      r.h('body', D, box(rr * 1.1, 0.12, 0.04), x - Math.sin(a) * rr, 1.25 + c * 0.3, z - Math.cos(a) * rr, 0, a, 0);       // pipe mouth
      r.e('body', EN, box(rr * 0.8, 0.04, 0.02), x - Math.sin(a) * (rr + 0.02), 1.22 + c * 0.3, z - Math.cos(a) * (rr + 0.02), 0, a, 0);
      for (const y of [1.0, 0.9 + h * 0.6]) r.h('body', I, cyl(rr + 0.02, rr + 0.02, 0.05, 8), x, y, z);
    }
    // bell spire on the back
    r.h('body', I2, box(0.5, 1.2, 0.5), 0, 4.2, -1.0); r.h('body', D, cone(0.42, 1.0, 4), 0, 5.3, -1.0, 0, PI / 4, 0);
    r.h('body', BR, lathe([[0.001, 0], [0.18, 0.02], [0.2, 0.2], [0.12, 0.4], [0.001, 0.42]], 8), 0, 3.8, -1.0);
    // flank bellows on pistons (pump while playing)
    r.sym((s) => {
      r.h('body', D, box(0.3, 0.5, 0.9), s * 1.2, 1.05, -0.1);
      const g = r.sub('bel' + (s > 0 ? 'L' : 'R'), 'body', s * 1.25, 1.35, -0.1);
      for (let i = 0; i < 3; i++) r.h(g, i % 2 ? I : 0x5a3a2a, box(0.32 - i * 0.04, 0.12, 0.85 - i * 0.08), s * 1.25, 1.38 + i * 0.12, -0.1);
      r.h(g, BR, cyl(0.04, 0.04, 0.5, 6), s * 1.25, 1.55, 0.35);
    });
    // the turret drum (old drum handle: spins in world space; emitters at the same 4 angles, r ~1.08)
    const dy = 1.25;
    r.h('drum', I2, cyl(0.78, 0.82, 0.7, 12), 0, dy, 0);
    r.h('drum', BR2, cyl(0.85, 0.85, 0.08, 12), 0, dy - 0.3, 0); r.h('drum', BR2, cyl(0.85, 0.85, 0.08, 12), 0, dy + 0.3, 0);
    r.h('drum', D, lathe([[0.82, 0], [0.7, 0.2], [0.4, 0.45], [0.001, 0.5]], 12), 0, dy + 0.34, 0);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2, sx = Math.sin(a), sz = Math.cos(a);
      r.h('drum', D, box(0.34, 0.34, 0.4), sx * 0.85, dy, sz * 0.85, 0, a, 0);
      r.h('drum', BR, shell([[0.1, 0], [0.12, 0.15], [0.22, 0.28]], 0.03, 8), sx * 0.95, dy, sz * 0.95, PI / 2, a, 0, 1, 1, 1);
      r.e('drum', EN, cyl(0.12, 0.12, 0.03, 8), sx * 1.1, dy, sz * 1.1, PI / 2, 0, 0, 1, 1, 1);
      r.h('drum', BONE, box(0.05, 0.05, 0.05), sx * 0.86, dy + 0.22, sz * 0.86); }
    // fix: orient the emitter discs/bells along their radial axis
    // red cyclops eye on top
    r.h('drum', BR2, tor(0.24, 0.05, 4, 12), 0, dy + 0.85, 0, PI / 2, 0, 0);
    r.e('drum', EN, sph(0.2, 8, 6), 0, dy + 0.85, 0); r.e('drum', EN2, sph(0.09, 6, 4), 0, dy + 0.9, 0.12);
    r.vents.push([0, 4.3, -1.05], [0.6, 3.6, -0.9], [-0.6, 3.6, -0.9]);
    r.weak.push(['drum', 0, 2.1, 0], ['body', 0.9, 1.2, 0.0], ['body', -0.9, 1.2, 0.0], ['body', 0, 3.5, -1.0]);
  },
  anim(b, P, t, dt, st) {
    const playing = st === 'beaming' || st === 'telegraph';
    const f = playing ? 9 : 2.2, amp = playing ? 0.12 : 0.04;
    P.belL.pivot.position.y = 1.35 + Math.sin(t * f) * amp; P.belR.pivot.position.y = 1.35 + Math.sin(t * f + PI) * amp;
  },
};

// =====================================================================================================
// BRAND - the short, wide forge-twin: a squat dwarf-smith with a hearth-mouth chest, a stiff leather
// apron of riveted plates, massive stepped pauldrons, a horned furnace helm with a slot visor, a bellows
// gauntlet on the left and the great BRANDING IRON (glowing glyph-head) in the right for the charge/slam.
DESIGNS.brand = {
  wear: { rust: 0.18, var: 0.22, soot: 0.3, heat: 0.12 },
  build(r) {
    const I = 0x2e2a26, I2 = 0x4a423a, L = 0x5a3a24, CU = 0xc0702a, BONE = 0xd8c8a8, EN = 0xff8a3a, EN2 = 0xffd090;
    r.sym((s) => heavyLeg(r, 'body', s * 0.3, 0, { hip: 0.72, w: 0.38, c1: I2, c2: CU, c3: I, flare: s * 0.15 }));
    r.h('body', I, box(0.95, 0.28, 0.62), 0, 0.8, 0);
    // barrel chest with hearth mouth
    r.h('body', I2, lathe([[0.001, 0.82], [0.6, 0.86], [0.7, 1.15], [0.68, 1.45], [0.5, 1.68], [0.001, 1.7]], 9), 0, 0, 0, 0, 0, 0, 1.08, 1, 0.85);
    r.h('body', I, box(0.56, 0.38, 0.12), 0, 1.22, 0.55);
    r.e('body', EN, box(0.44, 0.24, 0.03), 0, 1.22, 0.61); r.e('body', EN2, box(0.24, 0.1, 0.02), 0, 1.18, 0.625);
    for (const x of [-0.12, 0, 0.12]) r.h('body', CU, box(0.03, 0.3, 0.05), x, 1.22, 0.63);
    // apron of riveted leather plates
    for (let i = 0; i < 3; i++) for (const s of [-1, 0, 1]) r.h('body', L, box(0.28, 0.28, 0.04), s * 0.27, 0.9 - i * 0.2, 0.5 + i * 0.03, 0.12, s * 0.15, 0);
    r.rivets('body', CU, [[-0.27, 1.0, 0.53], [0.27, 1.0, 0.53], [0, 1.0, 0.53], [-0.27, 0.6, 0.58], [0.27, 0.6, 0.58]]);
    // stepped pauldrons
    r.sym((s) => { for (let i = 0; i < 3; i++) r.h('body', i === 1 ? CU : I2, box(0.62 - i * 0.1, 0.16, 0.7 - i * 0.08), s * (0.72 + i * 0.05), 1.66 - i * 0.14, 0, 0, 0, -s * (0.25 + i * 0.1));
      r.h('body', BONE, cone(0.06, 0.3, 4), s * 0.85, 1.85, -0.1, 0, 0, -s * 0.6); });
    // horned furnace helm
    r.h('body', I, cyl(0.28, 0.32, 0.42, 8), 0, 1.86, 0.06);
    r.h('body', I2, cyl(0.33, 0.33, 0.06, 8), 0, 2.07, 0.06);
    r.h('body', I, box(0.4, 0.14, 0.12), 0, 1.84, 0.33);
    r.e('body', EN, box(0.32, 0.04, 0.02), 0, 1.86, 0.4);
    r.sym((s) => { r.h('body', BONE, tube([[s * 0.28, 1.95, 0.05], [s * 0.6, 2.1, 0.0], [s * 0.66, 2.45, -0.1]], 0.06, 6, 5)); r.h('body', BONE, cone(0.06, 0.2, 4), s * 0.66, 2.55, -0.1); });
    r.h('body', D_(I), cyl(0.08, 0.1, 0.35, 6), 0, 2.25, -0.08);
    r.e('body', EN, cyl(0.05, 0.05, 0.02, 6), 0, 2.43, -0.08);
    // left: bellows gauntlet
    r.h('armL', I2, sph(0.24, 8, 6), 0.78, 1.4, 0);
    r.h('armL', I, cyl(0.14, 0.12, 0.5, 7), 0.78, 1.08, 0);
    r.h('armL', L, box(0.36, 0.3, 0.34), 0.78, 0.75, 0.02); r.h('armL', I, box(0.4, 0.06, 0.38), 0.78, 0.88, 0.02); r.h('armL', I, box(0.4, 0.06, 0.38), 0.78, 0.62, 0.02);
    for (let i = 0; i < 4; i++) r.h('armL', I2, box(0.07, 0.18, 0.07), 0.66 + i * 0.08, 0.5, 0.12);
    // right: the branding iron
    r.h('armR', I2, sph(0.24, 8, 6), -0.78, 1.4, 0);
    r.h('armR', I, cyl(0.14, 0.12, 0.5, 7), -0.78, 1.1, 0);
    r.h('armR', I2, box(0.3, 0.28, 0.3), -0.78, 0.8, 0.05);
    r.h('armR', I, cyl(0.05, 0.05, 1.6, 6), -0.78, 0.75, 0.65, PI / 2, 0, 0);
    r.h('armR', CU, cyl(0.07, 0.07, 0.3, 6), -0.78, 0.75, 0.2, PI / 2, 0, 0);
    r.h('armR', I, box(0.55, 0.55, 0.12), -0.78, 0.75, 1.42);
    r.e('armR', EN, slab([[0, 0.22], [0.08, 0.05], [0.22, 0], [0.08, -0.05], [0, -0.22], [-0.08, -0.05], [-0.22, 0], [-0.08, 0.05]], 0.05), -0.78, 0.75, 1.5);
    r.e('armR', EN2, box(0.06, 0.06, 0.04), -0.78, 0.75, 1.53);
    r.vents.push([0, 2.45, -0.08], [0, 1.22, 0.62]);
    r.weak.push(['body', 0, 1.22, 0.6], ['armR', -0.78, 0.75, 1.45], ['body', 0, 1.86, 0.4], ['body', 0, 2.4, -0.08]);
  },
};
function D_(x) { return x; }

// =====================================================================================================
// TEMPER - the tall, lean forge-twin: a gaunt quench-knight in a long segmented coat, a tall stacked
// helm with a vertical slit visor and a crest fin, a glowing quench tank on its back with coolant hoses to
// both arms and a spinning cooling fan, long serrated TONGS on the left and a sprayer nozzle on the
// right (the VOLLEY / BURST).
DESIGNS.temper = {
  wear: { rust: 0.15, var: 0.2 },
  build(r) {
    const S = 0x3a4450, S2 = 0x56606c, D = 0x1c2026, CU = 0x8ab0c8, BONE = 0xd8dce0, EN = 0x5ad8ff, EN2 = 0xc8f4ff;
    // stilted legs
    r.sym((s) => {
      r.h('body', S2, box(0.22, 0.5, 0.26), s * 0.2, 0.8, 0);
      r.h('body', D, cyl(0.06, 0.06, 0.4, 6), s * 0.2, 0.5, 0.05, 0.25, 0, 0);
      r.h('body', S, box(0.18, 0.45, 0.2), s * 0.2, 0.25, -0.02, -0.1, 0, 0);
      r.h('body', D, box(0.26, 0.1, 0.44), s * 0.2, 0.05, 0.08);
      r.h('body', CU, box(0.2, 0.14, 0.12), s * 0.2, 0.55, 0.15);
    });
    // long segmented coat
    r.h('body', S, lathe([[0.001, 0.4], [0.52, 0.42], [0.42, 0.8], [0.34, 1.1], [0.001, 1.12]], 8), 0, 0, 0, 0, PI / 8, 0, 1, 1, 0.8);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + PI / 6; r.h('body', i % 2 ? S2 : S, box(0.26, 0.55, 0.04), Math.sin(a) * 0.42, 0.72, Math.cos(a) * 0.34, -0.2 * Math.cos(a), a, 0); }
    // torso cuirass
    r.h('body', S2, lathe([[0.001, 1.05], [0.32, 1.08], [0.42, 1.45], [0.4, 1.8], [0.25, 1.95], [0.001, 1.96]], 8), 0, 0, 0, 0, 0, 0, 1, 1, 0.72);
    for (const y of [1.25, 1.45, 1.65]) r.h('body', S, box(0.62, 0.05, 0.08), 0, y, 0.28);
    r.e('body', EN, box(0.08, 0.5, 0.02), 0, 1.45, 0.32);
    r.sym((s) => r.h('body', S, slab([[0, 0.14], [0.36, 0.04], [0.32, -0.14], [0, -0.16]], 0.42), s * 0.4, 1.9, 0, 0, s > 0 ? 0 : PI, -s * 0.35));
    // tall stacked helm
    r.h('body', S, box(0.36, 0.42, 0.36), 0, 2.15, 0);
    r.h('body', S2, box(0.3, 0.32, 0.3), 0, 2.48, -0.02);
    r.h('body', D, box(0.04, 0.5, 0.5), 0, 2.6, -0.06);
    r.h('body', CU, box(0.4, 0.06, 0.4), 0, 2.35, 0);
    r.e('body', EN, box(0.05, 0.34, 0.02), 0, 2.2, 0.185);
    // quench tank + fan
    r.h('body', D, cyl(0.3, 0.3, 1.0, 10), 0, 1.5, -0.45);
    r.e('body', EN, cyl(0.24, 0.24, 0.8, 10), 0, 1.5, -0.47);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2 + PI / 4; r.h('body', S2, box(0.05, 0.9, 0.05), Math.sin(a) * 0.27, 1.5, -0.45 + Math.cos(a) * 0.27); }
    for (const y of [1.0, 2.0]) r.h('body', CU, cyl(0.33, 0.33, 0.07, 10), 0, y, -0.45);
    r.e('body', EN2, sph(0.05, 5, 4), 0.08, 1.3, -0.2); r.e('body', EN2, sph(0.04, 5, 4), -0.06, 1.6, -0.2); r.e('body', EN2, sph(0.035, 5, 4), 0.04, 1.85, -0.2);
    r.sub('fan', 'body', 0, 2.1, -0.45);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * PI * 2; r.h('fan', S2, box(0.06, 0.03, 0.3), Math.sin(a) * 0.15, 2.1, -0.45 + Math.cos(a) * 0.15, 0.4, a, 0); }
    r.h('fan', CU, cyl(0.06, 0.06, 0.08, 6), 0, 2.1, -0.45);
    r.sym((s) => r.h('body', D, tube([[s * 0.2, 1.9, -0.6], [s * 0.55, 2.0, -0.4], [s * 0.5, 1.85, 0]], 0.035, 6, 4)));
    // left: long serrated tongs
    r.h('armL', S2, sph(0.15, 7, 5), 0.5, 1.85, 0);
    r.h('armL', S, cyl(0.08, 0.06, 0.8, 6), 0.5, 1.45, 0);
    r.h('armL', CU, box(0.16, 0.16, 0.16), 0.5, 1.02, 0.02);
    for (const d of [0.06, -0.06]) { r.h('armL', D, box(0.04, 0.05, 1.15), 0.5 + d, 1.0, 0.6); for (let i = 0; i < 4; i++) r.h('armL', BONE, cone(0.02, 0.07, 3), 0.5 + d * 0.6, 1.0, 0.75 + i * 0.12, 0, 0, d > 0 ? PI / 2 : -PI / 2); }
    r.e('armL', EN, box(0.12, 0.08, 0.08), 0.5, 1.0, 1.18);
    // right: sprayer nozzle
    r.h('armR', S2, sph(0.15, 7, 5), -0.5, 1.85, 0);
    r.h('armR', S, cyl(0.08, 0.06, 0.8, 6), -0.5, 1.45, 0);
    r.h('armR', D, cyl(0.12, 0.08, 0.35, 8), -0.5, 1.0, 0.05);
    r.h('armR', CU, shell([[0.05, 0], [0.07, 0.15], [0.14, 0.25]], 0.025, 8), -0.5, 0.82, 0.05, PI, 0, 0);
    r.e('armR', EN, cyl(0.08, 0.08, 0.03, 8), -0.5, 0.58, 0.05);
    r.vents.push([0, 2.15, -0.45], [0, 2.85, -0.06]);
    r.weak.push(['body', 0, 1.5, -0.7], ['body', 0, 2.2, 0.2], ['armL', 0.5, 1.0, 1.18], ['body', 0, 1.45, 0.32]);
  },
  anim(b, P, t, dt, st) { P.fan.pivot.rotation.y += dt * (busy(st) ? 18 : 5); },
};

// =====================================================================================================
// CANTOR VELL - the duelist: a tall, wasp-waisted fencer on long reverse-jointed legs, a high collar and
// a crescent-moon crest helm, a tattered split tailcoat that flutters, a long glowing magenta RAPIER in
// the sword arm (the BLINKSTRIKE) and a fan of three throwing blades in the off hand (the FAN).
DESIGNS.vell = {
  wear: { rust: 0.1, var: 0.18 },
  build(r) {
    const IV = 0xd8d0e8, IV2 = 0xa89cb8, V = 0x3a2a48, D = 0x1c1824, GO = 0xc8a050, EN = 0xff4fd8, EN2 = 0xffc0f0;
    r.sym((s) => {
      const x = s * 0.17;
      r.h('body', IV2, box(0.18, 0.5, 0.2), x, 0.85, 0.02, 0.35, 0, 0);
      r.h('body', D, sph(0.08, 6, 4), x, 0.62, 0.12);
      r.h('body', V, box(0.12, 0.45, 0.14), x, 0.42, 0.02, -0.4, 0, 0);
      r.h('body', IV2, box(0.13, 0.08, 0.36), x, 0.05, 0.1);
      r.h('body', GO, cone(0.03, 0.14, 4), x, 0.15, -0.12, -PI / 2, 0, 0);
    });
    r.h('body', D, box(0.38, 0.18, 0.24), 0, 1.06, 0);
    r.h('body', IV, lathe([[0.001, 1.1], [0.14, 1.12], [0.3, 1.5], [0.34, 1.8], [0.18, 1.95], [0.001, 1.96]], 8), 0, 0, 0, 0, 0, 0, 1, 1, 0.7);
    r.h('body', V, box(0.08, 0.86, 0.3), 0, 1.5, 0.02, 0, 0, -0.55);                         // sash
    r.h('body', GO, oct(0.07), 0.08, 1.55, 0.2);
    r.e('body', EN, box(0.04, 0.3, 0.02), 0, 1.6, 0.235);
    // high collar + crest helm
    r.h('body', IV2, shell([[0.14, 1.88], [0.22, 2.1], [0.26, 2.2]], 0.03, 8), 0, 0, -0.02);
    r.h('body', IV, box(0.24, 0.32, 0.26), 0, 2.12, 0.02);
    r.h('body', D, box(0.26, 0.06, 0.28), 0, 2.08, 0.02);
    r.e('body', EN, box(0.2, 0.035, 0.02), 0, 2.13, 0.155);
    r.h('body', IV, slab([[0, 0], [0.12, 0.25], [0.12, 0.55], [-0.05, 0.8], [0.02, 0.5], [-0.04, 0.2]], 0.05), 0, 2.26, -0.05, 0, PI / 2, 0); // crescent crest
    r.e('body', EN, slab([[0, 0], [0.05, 0.3], [-0.02, 0.6], [0.0, 0.3]], 0.06), 0, 2.3, -0.1, 0, PI / 2, 0);
    r.sym((s) => r.h('body', IV2, cone(0.03, 0.4, 4), s * 0.13, 2.35, -0.06, -0.4, 0, -s * 0.5));
    r.h('body', GO, cone(0.03, 0.2, 4), 0, 2.78, -0.1);
    // split tailcoat (flutters)
    r.sub('cape', 'body', 0, 1.9, -0.18);
    r.sym((s) => { r.h('cape', V, slab([[0, 0], [s * 0.32, -0.1], [s * 0.42, -1.3], [s * 0.22, -1.15], [s * 0.1, -1.5], [0, -1.2]], 0.04), 0, 1.9, -0.2, 0.15, 0, 0);
      r.h('cape', IV2, box(0.3, 0.12, 0.05), s * 0.18, 1.88, -0.19); });
    r.sym((s) => r.h('body', IV2, slab([[0, 0.1], [0.26, 0.04], [0.24, -0.1], [0, -0.12]], 0.3), s * 0.24, 1.88, 0, 0, s > 0 ? 0 : PI, -s * 0.3));
    // sword arm + the rapier (old blade handle)
    r.h('armR', IV2, sph(0.1, 6, 5), -0.33, 1.82, 0);
    r.h('armR', V, cyl(0.06, 0.05, 0.62, 6), -0.33, 1.5, 0);
    r.h('armR', IV, box(0.12, 0.14, 0.14), -0.33, 1.15, 0.02);
    r.h('blade', GO, tor(0.09, 0.025, 3, 10), -0.33, 1.1, 0.05);
    r.h('blade', GO, box(0.3, 0.04, 0.05), -0.33, 1.1, 0.1);
    r.e('blade', EN, box(0.04, 0.05, 1.6), -0.33, 1.1, 0.92);
    r.e('blade', EN2, box(0.015, 0.02, 1.4), -0.33, 1.13, 0.9);
    r.e('blade', EN, cone(0.03, 0.18, 4), -0.33, 1.1, 1.8, PI / 2, 0, 0);
    // off arm with a fan of throwing blades
    r.h('armL', IV2, sph(0.1, 6, 5), 0.33, 1.82, 0);
    r.h('armL', V, cyl(0.06, 0.05, 0.58, 6), 0.33, 1.52, 0);
    r.h('armL', IV, box(0.12, 0.14, 0.14), 0.33, 1.18, 0.02);
    for (const a of [-0.45, 0, 0.45]) r.e('armL', EN, slab([[0, 0], [0.04, 0.32], [0, 0.4], [-0.04, 0.32]], 0.02), 0.33 + Math.sin(a) * 0.04, 1.08, 0.08, -PI / 2 + 0.5, 0, a);
    r.vents.push([0, 2.5, -0.1]);
    r.weak.push(['body', 0, 1.6, 0.24], ['blade', -0.33, 1.1, 1.0], ['body', 0, 2.13, 0.16], ['armL', 0.33, 1.1, 0.1]);
  },
  anim(b, P, t, dt, st) {
    const fast = st === 'charging' || st === 'mirroring' || st === 'telegraph';
    P.cape.pivot.rotation.x = 0.15 + (fast ? 0.55 + Math.sin(t * 18) * 0.12 : 0.08 + Math.sin(t * 3) * 0.06);
  },
};

// =====================================================================================================
// CHOIRMOTHER - a floating bell-matriarch: no legs, a vast flared bronze bell-skirt hung with chains and
// a swinging glowing clapper underneath, a ribbed reliquary bodice, a tall cowled bell-mask with organ-pipe
// throats rising behind it, a spiked halo of little bells that spins faster for the BURST, and long
// many-jointed arms ending in five bone fingers (they rise for the MARK SLAM).
DESIGNS.choirmother = {
  wear: { rust: 0.22, var: 0.22 },
  build(r) {
    const BZ = 0x8a5a2a, BZ2 = 0x6a4420, D = 0x2e2a34, M = 0xd8cfb8, GO = 0xc89a3a, EN = 0xffb020, EN2 = 0xfff0b0;
    // bell skirt (floats; old body rides up and down)
    r.h('body', BZ, shell([[0.32, 1.55], [0.4, 1.3], [0.52, 0.9], [0.78, 0.45], [0.95, 0.2], [1.0, 0.12]], 0.05, 14));
    r.h('body', GO, tor(0.97, 0.05, 4, 18), 0, 0.15, 0, PI / 2, 0, 0);
    for (const y of [0.55, 1.0]) r.h('body', BZ2, tor(y === 0.55 ? 0.73 : 0.5, 0.035, 3, 16), 0, y, 0, PI / 2, 0, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; r.h('body', D, box(0.04, 0.9, 0.04), Math.sin(a) * 0.68, 0.7, Math.cos(a) * 0.68, -Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
      r.h('body', M, cone(0.04, 0.12, 4), Math.sin(a) * 1.0, 0.05, Math.cos(a) * 1.0, PI, 0, 0); }
    // swinging clapper under the bell
    r.sub('clap', 'body', 0, 1.3, 0);
    r.h('clap', D, cyl(0.03, 0.03, 0.9, 5), 0, 0.85, 0);
    r.e('clap', EN, sph(0.16, 8, 6), 0, 0.35, 0);
    // bodice + ribs
    r.h('body', D, lathe([[0.001, 1.5], [0.34, 1.55], [0.4, 1.85], [0.3, 2.1], [0.001, 2.12]], 8), 0, 0, 0, 0, 0, 0, 1, 1, 0.75);
    for (const y of [1.65, 1.8, 1.95]) r.h('body', M, tor(0.34 - (y - 1.65) * 0.3, 0.025, 3, 10, PI), 0, y, 0.02, PI / 2, 0, 0);
    r.e('body', EN, oct(0.09), 0, 1.8, 0.27);
    // cowled bell-mask head
    r.h('body', D, shell([[0.32, 2.05], [0.36, 2.4], [0.25, 2.75], [0.05, 2.9]], 0.05, 10), 0, 0, -0.04);
    r.h('body', M, lathe([[0.001, 2.08], [0.2, 2.1], [0.24, 2.3], [0.18, 2.55], [0.001, 2.6]], 8), 0, 0, 0.1, 0, 0, 0, 1, 1, 0.8);
    r.e('body', EN, box(0.22, 0.04, 0.02), 0, 2.36, 0.29); r.e('body', EN2, box(0.06, 0.12, 0.02), 0, 2.2, 0.28);
    // organ-pipe throats behind the head
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.13, h = 0.6 + (2 - Math.abs(i - 2)) * 0.22; r.h('body', GO, cyl(0.045, 0.05, h, 6), x, 2.25 + h / 2, -0.35); r.h('body', GO, cone(0.07, 0.1, 6), x, 2.25 + h + 0.04, -0.35, PI, 0, 0); }
    // halo of little bells (old halo handle spins; authored round (0, 2.45, -0.3))
    r.h('halo', GO, tor(0.62, 0.04, 4, 24), 0, 2.45, -0.3);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2, x = Math.sin(a) * 0.62, y = 2.45 + Math.cos(a) * 0.62;
      r.h('halo', BZ, lathe([[0.001, 0], [0.06, 0.02], [0.08, -0.12], [0.001, -0.12]], 6), x, y, -0.3, 0, 0, -a + PI);
      r.h('halo', M, cone(0.03, 0.18, 4), Math.sin(a) * 0.8, 2.45 + Math.cos(a) * 0.8, -0.3, 0, 0, -a); }
    r.e('halo', EN, tor(0.5, 0.02, 3, 20), 0, 2.45, -0.28);
    // long jointed arms + five bone fingers
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.42;
      r.h(g, BZ, sph(0.12, 7, 5), x, 2.0, 0);
      r.h(g, D, cyl(0.05, 0.045, 0.45, 6), x, 1.75, 0);
      r.h(g, GO, sph(0.06, 6, 4), x, 1.52, 0);
      r.h(g, D, cyl(0.045, 0.04, 0.4, 6), x, 1.32, 0.02);
      r.h(g, M, box(0.12, 0.1, 0.1), x, 1.1, 0.03);
      for (let f = 0; f < 5; f++) r.h(g, M, cone(0.02, 0.36, 4), x + (f - 2) * 0.03, 0.88, 0.05 + Math.abs(f - 2) * -0.02, -0.1, 0, (f - 2) * 0.12 + PI);
    });
    r.vents.push([0, 3.1, -0.35], [0, 0.3, 0]);
    r.weak.push(['body', 0, 1.8, 0.27], ['clap', 0, 0.35, 0], ['body', 0, 2.3, 0.28], ['halo', 0, 3.07, -0.3]);
  },
  anim(b, P, t, dt, st, k) {
    const swing = st === 'telegraph' ? 0.5 * k : st === 'charging' ? 0.6 : 0.18;
    P.clap.pivot.rotation.x = Math.sin(t * (st === 'telegraph' ? 9 : 2.4)) * swing; P.clap.pivot.rotation.z = Math.cos(t * 1.9) * swing * 0.5;
  },
};

// =====================================================================================================
// THE BELLOWS ABBOT - a corpulent forge-abbot whose torso IS a giant pleated leather bellows held in iron
// ribs (it really swells on the INHALE), a heavy monk's robe skirt over stumpy legs, a sunken hood with a
// respirator mask and a flared intake trumpet for a mouth (the GUST blows out of it), twin exhaust stacks
// with flapping caps, and huge riveted gauntlet fists for the SLAM.
DESIGNS.bellows = {
  wear: { rust: 0.2, var: 0.24, soot: 0.3 },
  build(r) {
    const L = 0x6a3a22, L2 = 0x4a2a18, D = 0x231a16, I = 0x3a3430, I2 = 0x585048, M = 0xc9b89a, CU = 0xb08048, EN = 0xff7a3a, EN2 = 0xffc890;
    // robe skirt + stumpy legs
    r.h('body', D, lathe([[0.001, 0.15], [0.7, 0.12], [0.62, 0.5], [0.5, 0.82], [0.001, 0.85]], 9));
    for (let i = 0; i < 9; i++) { const a = (i / 9) * PI * 2; r.h('body', L2, box(0.22, 0.6, 0.04), Math.sin(a) * 0.6, 0.45, Math.cos(a) * 0.6, -0.15 * Math.cos(a), a, 0.15 * Math.sin(a)); }
    r.sym((s) => r.h('body', I, box(0.3, 0.16, 0.42), s * 0.3, 0.08, 0.12));
    // the BELLOWS torso (old lungs handle: pose() swells it on the inhale)
    const ly = 1.35;
    for (let i = 0; i < 7; i++) { const y = ly - 0.45 + i * 0.15; r.h('lungs', i % 2 ? L : L2, cyl(0.62 + (i % 2) * 0.08 - Math.abs(i - 3) * 0.04, 0.62 + (i % 2) * 0.08 - Math.abs(i - 3) * 0.04, 0.15, 10), 0, y, 0); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + PI / 6; r.h('lungs', I, box(0.06, 1.05, 0.06), Math.sin(a) * 0.76, ly, Math.cos(a) * 0.76); }
    r.h('lungs', I2, cyl(0.7, 0.7, 0.08, 10), 0, ly - 0.52, 0); r.h('lungs', I2, cyl(0.7, 0.7, 0.08, 10), 0, ly + 0.52, 0);
    r.h('lungs', I, box(0.5, 0.36, 0.12), 0, ly, 0.68);
    r.e('lungs', EN, box(0.4, 0.26, 0.03), 0, ly, 0.745);
    for (const x of [-0.12, 0, 0.12]) r.h('lungs', I2, box(0.03, 0.3, 0.05), x, ly, 0.76);
    r.rivets('lungs', CU, [[-0.22, ly + 0.15, 0.75], [0.22, ly + 0.15, 0.75], [-0.22, ly - 0.15, 0.75], [0.22, ly - 0.15, 0.75]]);
    // yoke + exhaust stacks
    r.h('body', I, box(1.3, 0.22, 0.6), 0, 1.98, -0.02);
    r.sym((s) => {
      r.h('body', I2, cyl(0.12, 0.18, 0.75, 8), s * 0.45, 2.35, -0.25, -0.25, 0, -s * 0.1);
      r.h('body', CU, cyl(0.2, 0.2, 0.07, 8), s * 0.48, 2.72, -0.35, -0.25, 0, -s * 0.1);
      const g = r.sub('cap' + (s > 0 ? 'L' : 'R'), 'body', s * 0.48, 2.76, -0.45);
      r.h(g, I, cyl(0.2, 0.2, 0.04, 8), s * 0.48, 2.77, -0.35, -0.25, 0, 0);
    });
    // sunken hood, respirator + intake trumpet mouth
    r.h('body', D, shell([[0.3, 1.95], [0.34, 2.2], [0.24, 2.48], [0.05, 2.56]], 0.05, 9), 0, 0, 0.05);
    r.h('body', M, box(0.3, 0.26, 0.2), 0, 2.1, 0.2);
    r.e('body', EN, box(0.08, 0.04, 0.02), -0.08, 2.16, 0.305); r.e('body', EN, box(0.08, 0.04, 0.02), 0.08, 2.16, 0.305);
    r.sym((s) => r.h('body', I2, cyl(0.06, 0.06, 0.14, 6), s * 0.16, 2.0, 0.28, PI / 2, 0, 0));
    r.h('mouth', CU, shell([[0.06, 0], [0.08, 0.12], [0.18, 0.22]], 0.025, 10), 0, 2.0, 0.26, PI / 2, 0, 0);
    r.e('mouth', EN2, cyl(0.07, 0.07, 0.02, 8), 0, 2.0, 0.3, PI / 2, 0, 0);
    // huge gauntlets
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.85;
      r.h(g, I2, sph(0.24, 8, 6), x, 1.7, 0);
      r.h(g, L2, cyl(0.13, 0.11, 0.5, 7), x, 1.38, 0);
      r.h(g, I, box(0.46, 0.4, 0.46), x, 0.95, 0.02);
      r.h(g, I2, box(0.5, 0.1, 0.5), x, 1.14, 0.02);
      for (let f = 0; f < 4; f++) r.h(g, M, box(0.08, 0.14, 0.1), x + (f - 1.5) * 0.1, 0.72, 0.18);
      r.rivets(g, CU, [[x + s * 0.24, 0.95, 0.1], [x + s * 0.24, 0.95, -0.1]]);
    });
    r.vents.push([0.48, 2.8, -0.35], [-0.48, 2.8, -0.35], [0, 2.0, 0.4]);
    r.weak.push(['lungs', 0, 1.35, 0.75], ['mouth', 0, 2.0, 0.3], ['body', 0.48, 2.75, -0.35], ['body', -0.48, 2.75, -0.35]);
  },
  anim(b, P, t, dt, st) {
    const blow = st === 'telegraph' || st === 'inhaling' || st === 'charging';
    const a = blow ? 0.6 + Math.sin(t * 20) * 0.4 : 0.1 + Math.sin(t * 3) * 0.08;
    P.capL.pivot.rotation.x = -a; P.capR.pivot.rotation.x = -a * (blow ? 0.8 : 1.2);
  },
};

// =====================================================================================================
// RIVETJAW - the Scrap Engine: a low, wide six-legged crab-engine. A riveted armoured carapace, a huge
// toothed upper jaw and a massive hinged lower jaw (opens on every wind-up), crusher gears on the jaw
// hinges that grind while it charges, two periscope eyes on stalks and twin exhaust pipes behind.
DESIGNS.rivetjaw = {
  wear: { rust: 0.4, var: 0.26 },
  build(r) {
    const C = 0x7a3a1a, C2 = 0x9a5a2a, D = 0x2a2622, I = 0x3c3a36, I2 = 0x5a5650, T = 0xe0d8c0, EN = 0xff5a20, EN2 = 0xc8ff3a;
    // six crab legs
    for (const [sx, sz, k] of [[1, 0.45, 0], [1, 0, 1], [1, -0.45, 2], [-1, 0.45, 0], [-1, 0, 1], [-1, -0.45, 2]]) {
      const hx = sx * 0.7, kx = sx * 1.25, fx = sx * 1.35, kz = sz * 1.3 + (k - 1) * 0.1;
      r.h('body', I, tube([[hx, 0.85, sz], [kx * 0.9, 1.15, kz * 0.95], [kx, 1.0, kz]], 0.08, 5, 5));
      r.h('body', C2, box(0.16, 0.12, 0.34), (hx + kx) / 2, 1.12, (sz + kz) / 2, 0, Math.atan2(kx - hx, kz - sz), 0);
      r.h('body', D, tube([[kx, 1.0, kz], [fx, 0.5, kz * 1.05], [fx * 0.98, 0.04, kz * 1.05]], 0.06, 4, 5));
      r.h('body', T, cone(0.06, 0.18, 4), fx * 0.98, 0.06, kz * 1.05, PI, 0, 0);
    }
    // carapace
    r.h('body', C, lathe([[0.001, 0.6], [0.78, 0.62], [0.92, 0.85], [0.85, 1.15], [0.6, 1.4], [0.001, 1.45]], 10), 0, 0, -0.05, 0, PI / 10, 0, 1.0, 1, 0.82);
    for (let i = 0; i < 5; i++) r.h('body', i % 2 ? C2 : I2, box(1.3 - Math.abs(i - 2) * 0.22, 0.08, 0.25), 0, 1.35 - Math.abs(i - 2) * 0.08, -0.5 + i * 0.22, 0.15 * (i - 2), 0, 0);
    r.rivets('body', T, [[-0.6, 1.2, 0.3], [0.6, 1.2, 0.3], [-0.6, 1.2, -0.3], [0.6, 1.2, -0.3], [-0.3, 1.42, 0], [0.3, 1.42, 0], [0, 1.45, -0.3], [0, 1.45, 0.3]], 0.06);
    r.sym((s) => r.h('body', I2, slab([[0, 0.2], [0.4, 0.1], [0.45, -0.2], [0, -0.25]], 0.9), s * 0.72, 0.95, 0, 0, s > 0 ? 0 : PI, -s * 0.35));
    // upper jaw + teeth
    r.h('body', I2, box(1.4, 0.32, 0.6), 0, 1.15, 0.72);
    r.h('body', C, box(1.48, 0.1, 0.66), 0, 1.33, 0.72);
    for (let i = -3; i <= 3; i++) r.h('body', T, cone(0.08, 0.26, 4), i * 0.19, 0.9, 1.0, PI, 0, 0);
    r.e('body', EN, box(1.0, 0.06, 0.04), 0, 1.02, 1.0);
    // periscope eyes + exhaust
    r.sym((s) => {
      r.h('body', D, cyl(0.05, 0.05, 0.45, 6), s * 0.35, 1.6, 0.5, -0.2, 0, 0);
      r.h('body', I, cyl(0.12, 0.12, 0.18, 8), s * 0.35, 1.85, 0.56, PI / 2, 0, 0);
      r.e('body', EN2, cyl(0.08, 0.08, 0.03, 8), s * 0.35, 1.85, 0.66, PI / 2, 0, 0);
      r.h('body', I, cyl(0.1, 0.12, 0.7, 8), s * 0.42, 1.65, -0.55, -0.45, 0, 0);
      r.h('body', D, cyl(0.13, 0.13, 0.06, 8), s * 0.42, 1.98, -0.72, -0.45, 0, 0);
    });
    // lower jaw (old jaw handle, hinge at (0, 0.9, 0.55))
    r.h('jaw', I, box(1.3, 0.24, 0.66), 0, 0.84, 0.86);
    r.h('jaw', C2, box(1.36, 0.08, 0.7), 0, 0.71, 0.86);
    for (let i = -3; i <= 3; i++) r.h('jaw', T, cone(0.07, 0.24, 4), i * 0.19, 1.04, 1.12);
    r.e('jaw', EN, box(1.0, 0.05, 0.04), 0, 0.96, 1.17);
    r.rivets('jaw', T, [[-0.55, 0.84, 1.2], [0.55, 0.84, 1.2], [0, 0.84, 1.2]], 0.06);
    // crusher gears at the hinges
    r.sym((s) => { const g = r.sub('gear' + (s > 0 ? 'L' : 'R'), 'body', s * 0.72, 0.95, 0.58);
      r.h(g, I2, cyl(0.2, 0.2, 0.1, 10), s * 0.72, 0.95, 0.58, 0, 0, PI / 2);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; r.h(g, D, box(0.12, 0.08, 0.08), s * 0.72, 0.95 + Math.sin(a) * 0.22, 0.58 + Math.cos(a) * 0.22, a, 0, 0); } });
    r.vents.push([0.42, 2.0, -0.75], [-0.42, 2.0, -0.75]);
    r.weak.push(['body', 0, 1.02, 1.0], ['body', 0.35, 1.85, 0.66], ['body', -0.35, 1.85, 0.66], ['jaw', 0, 0.96, 1.17]);
  },
  anim(b, P, t, dt, st) {
    const v = st === 'charging' ? 16 : busy(st) ? 6 : 1.2;
    P.gearL.pivot.rotation.x += dt * v; P.gearR.pivot.rotation.x -= dt * v;
  },
};

// =====================================================================================================
// SAINT GRAVELMOUTH - the Stone Litany: a squat boulder-saint built from cracked, stacked stones with
// glowing fault lines, a stone mitre, a huge millstone mouth that chews (spins) while it SPITS gravel, a
// stole of chained prayer-boulders, and rock-pillar arms ending in millstone fists.
DESIGNS.gravel = {
  wear: { rust: 0.05, var: 0.32 },
  build(r) {
    const S = 0x6a665c, S2 = 0x55524a, S3 = 0x8a8576, D = 0x2e2c28, M = 0xc8c0a0, CH = 0x4a4238, EN = 0xffe08a, EN2 = 0xfff4c8;
    r.sym((s) => { r.h('body', S2, dod(0.32), s * 0.4, 0.3, 0.02, 0.3, s * 0.4, 0); r.h('body', S, box(0.46, 0.14, 0.54), s * 0.42, 0.07, 0.08); });
    // stacked boulder body
    r.h('body', S, dod(0.78), 0, 1.15, 0, 0.2, 0.3, 0.1, 1.05, 0.82, 0.85);
    r.h('body', S2, dod(0.45), 0.42, 1.45, -0.25, 0.5, 0.2, 0);
    r.h('body', S3, dod(0.38), -0.45, 1.5, -0.2, 0.1, 0.9, 0.2);
    r.h('body', S2, ico(0.32), 0, 1.5, -0.55);
    // glowing fault lines
    for (const [x, y, z, rz] of [[0.25, 1.0, 0.66, 0.7], [-0.3, 1.25, 0.62, -0.4], [0.05, 0.85, 0.7, 0.1]]) r.e('body', EN, box(0.04, 0.38, 0.03), x, y, z, 0.2, 0, rz);
    // stole of chained prayer-boulders
    for (let i = 0; i < 9; i++) { const a = -1.3 + (i / 8) * 2.6, x = Math.sin(a) * 0.72, z = Math.cos(a) * 0.58 + 0.05, y = 1.62 - Math.cos(a) * 0.45;
      r.h('body', i % 2 ? M : S3, ico(0.09), x, y, z); r.h('body', CH, tor(0.05, 0.015, 3, 6), x, y + 0.08, z); }
    // head block: brow + mitre
    r.h('body', S, box(0.95, 0.5, 0.75), 0, 2.08, 0.05, 0.05, 0, 0);
    r.h('body', S3, box(1.0, 0.14, 0.7), 0, 2.34, 0.08, 0.15, 0, 0);
    r.e('body', EN2, box(0.14, 0.06, 0.02), -0.2, 2.2, 0.44); r.e('body', EN2, box(0.14, 0.06, 0.02), 0.2, 2.2, 0.44);
    r.h('body', M, slab([[-0.34, 0], [0.34, 0], [0.3, 0.45], [0, 0.72], [-0.3, 0.45]], 0.36), 0, 2.4, 0);
    r.h('body', S2, box(0.08, 0.5, 0.38), 0, 2.72, 0);
    r.e('body', EN, slab([[0, 0.14], [0.04, 0.04], [0.14, 0], [0.04, -0.04], [0, -0.14], [-0.04, -0.04], [-0.14, 0], [-0.04, 0.04]], 0.02), 0, 2.72, 0.19);
    // millstone mouth (maw handle glows; millstone upper + jaw lower)
    r.e('maw', EN, box(0.62, 0.16, 0.03), 0, 1.85, 0.45);
    r.sub('mill', 'body', 0, 1.92, 0.42);
    r.h('mill', S3, cyl(0.3, 0.3, 0.12, 9), 0, 1.92, 0.42, PI / 2, 0, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; r.h('mill', D, box(0.04, 0.24, 0.02), Math.sin(a) * 0.16, 1.92 + Math.cos(a) * 0.16, 0.49, 0, 0, -a); }
    r.h('jaw', S2, box(0.85, 0.24, 0.55), 0, 1.68, 0.38);
    for (let i = -2; i <= 2; i++) r.h('jaw', M, box(0.1, 0.1, 0.08), i * 0.15, 1.82, 0.62);
    // rock-pillar arms with millstone fists
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.85;
      r.h(g, S3, dod(0.26), x, 1.55, 0, 0.3, 0.2, 0);
      r.h(g, S2, cyl(0.15, 0.18, 0.45, 6), x, 1.22, 0);
      r.h(g, CH, tor(0.18, 0.03, 3, 8), x, 1.05, 0, PI / 2, 0, 0);
      r.h(g, S, cyl(0.3, 0.3, 0.26, 9), x, 0.82, 0, 0, 0, PI / 2);
      r.h(g, D, cyl(0.1, 0.1, 0.28, 6), x, 0.82, 0, 0, 0, PI / 2);
      r.e(g, EN, box(0.28, 0.03, 0.03), x, 0.82, 0.3);
    });
    r.vents.push([0, 2.9, 0], [0, 1.85, 0.5]);
    r.weak.push(['maw', 0, 1.85, 0.46], ['body', 0, 2.72, 0.2], ['body', 0.25, 1.0, 0.68], ['body', -0.3, 1.25, 0.64]);
  },
  anim(b, P, t, dt, st) { P.mill.pivot.rotation.z += dt * (b.attack === 'gravelspit' && st === 'telegraph' ? 18 : st === 'charging' ? 9 : 0.6); },
};

// =====================================================================================================
// THE TITHE-WARDEN - the Weigher of Scrap: a gaunt, spire-tall tax-collector in a stiff stepped robe, a
// coin-gold slot-mask under a wide tricorne, a ledger chained to its belt, and a great ornate balance
// beam yoked across its back like a cross (the SCALES): heavy chained pans heaped with glowing coins that
// tip with the old beam/pan handles, plus a coin-counter wheel that spins as it LEDGERS.
DESIGNS.tithe = {
  wear: { rust: 0.12, var: 0.2 },
  build(r) {
    const R = 0x2a2a34, R2 = 0x3a3a48, D = 0x18181e, G = 0xe0b84a, G2 = 0xa8842a, P = 0xd8d0b8, EN = 0xffc23a, EN2 = 0xfff0b0;
    r.sym((s) => { r.h('body', D, box(0.12, 0.8, 0.14), s * 0.14, 0.4, 0); r.h('body', G2, box(0.16, 0.08, 0.3), s * 0.14, 0.04, 0.06); });
    // stepped robe
    for (let i = 0; i < 4; i++) r.h('body', i % 2 ? R2 : R, cyl(0.34 - i * 0.05, 0.6 - i * 0.07, 0.42, 6), 0, 0.55 + i * 0.36, 0, 0, PI / 6, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; r.h('body', G2, box(0.04, 1.4, 0.03), Math.sin(a) * 0.46, 1.05, Math.cos(a) * 0.46, -0.18 * Math.cos(a), a, 0.18 * Math.sin(a)); }
    r.h('body', G, box(0.5, 0.06, 0.4), 0, 1.25, 0);
    // ledger chained to the belt
    r.h('body', P, box(0.4, 0.5, 0.12), 0.5, 0.95, 0.3, 0.2, -0.4, 0.1); r.h('body', D, box(0.42, 0.52, 0.05), 0.5, 0.95, 0.25, 0.2, -0.4, 0.1); r.e('body', EN, box(0.12, 0.12, 0.02), 0.52, 0.98, 0.37, 0.2, -0.4, 0.1);
    r.h('body', G2, tube([[0.22, 1.25, 0.2], [0.35, 1.1, 0.3], [0.42, 1.1, 0.28]], 0.015, 5, 3));
    // chest + collar
    r.h('body', R2, box(0.5, 0.55, 0.34), 0, 1.9, 0);
    r.h('body', G, box(0.56, 0.08, 0.38), 0, 2.15, 0);
    r.e('body', EN, cyl(0.08, 0.08, 0.03, 10), 0, 1.9, 0.18, PI / 2, 0, 0);
    // coin-gold slot mask + tricorne
    r.h('body', G, box(0.34, 0.42, 0.32), 0, 2.42, 0);
    r.h('body', D, box(0.2, 0.04, 0.02), 0, 2.44, 0.165);
    r.e('body', EN, box(0.06, 0.03, 0.02), -0.08, 2.52, 0.165); r.e('body', EN, box(0.06, 0.03, 0.02), 0.08, 2.52, 0.165);
    r.h('body', R, cyl(0.42, 0.46, 0.06, 3), 0, 2.66, 0, 0, PI / 6, 0);
    r.h('body', R2, cyl(0.17, 0.2, 0.55, 6), 0, 2.95, 0); r.h('body', G, cyl(0.21, 0.21, 0.06, 6), 0, 2.75, 0);
    r.h('body', R, shell([[0.2, 2.3], [0.45, 2.15], [0.72, 1.85], [0.78, 1.75]], 0.04, 8), 0, 0, 0, 0, PI / 8, 0);   // stiff mantle
    r.sym((s) => r.h('body', G2, cone(0.08, 0.5, 4), s * 0.68, 2.05, 0, 0, 0, -s * 1.1));                            // pointed epaulettes
    r.h('body', R, cyl(0.62, 0.82, 0.22, 6), 0, 0.2, 0, 0, PI / 6, 0);                                                // wide hem
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2 + 0.5; r.h('body', G2, tube([[Math.sin(a) * 0.7, 1.78, Math.cos(a) * 0.7], [Math.sin(a) * 0.72, 1.45, Math.cos(a) * 0.72]], 0.012, 3, 3)); r.e('body', EN, cyl(0.05, 0.05, 0.02, 6), Math.sin(a) * 0.72, 1.42, Math.cos(a) * 0.72, PI / 2, a, 0); }
    // back mast holding the beam
    r.h('body', D, box(0.1, 1.0, 0.1), 0, 2.45, -0.2);
    // coin-counter wheel on the mast
    r.sub('wheel', 'body', 0, 2.2, -0.3);
    r.h('wheel', G2, tor(0.18, 0.03, 3, 12), 0, 2.2, -0.3);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; r.e('wheel', EN, cyl(0.04, 0.04, 0.02, 6), Math.sin(a) * 0.18, 2.2 + Math.cos(a) * 0.18, -0.3, PI / 2, 0, 0); }
    // balance beam (old beam handle at (0, 2.95, -0.15))
    r.h('beam', G, box(1.9, 0.07, 0.08), 0, 2.95, -0.15);
    r.h('beam', G2, oct(0.12), 0, 2.95, -0.15);
    r.h('beam', G, cone(0.06, 0.4, 4), 0, 3.22, -0.15);
    r.sym((s) => { r.h('beam', G2, oct(0.07), s * 0.95, 2.95, -0.15); r.h('beam', G, slab([[0, 0.08], [0.2, 0], [0, -0.08]], 0.03), s * 0.98, 2.95, -0.15, 0, s > 0 ? 0 : PI, 0); });
    // pans (old pans handles at (+-0.85, 2.95, -0.15))
    for (const [k, x] of [['pans0', 0.85], ['pans1', -0.85]]) {
      for (const a of [0, 2.1, 4.2]) r.h(k, G2, cyl(0.01, 0.01, 0.5, 3), x + Math.sin(a) * 0.12, 2.7, -0.15 + Math.cos(a) * 0.12, Math.cos(a) * 0.24, 0, -Math.sin(a) * 0.24);
      r.h(k, G, lathe([[0.001, -0.06], [0.24, -0.04], [0.34, 0.06], [0.32, 0.08], [0.001, 0.0]], 10), x, 2.38, -0.15);
      for (let i = 0; i < 5; i++) r.e(k, i % 2 ? EN : EN2, cyl(0.07, 0.07, 0.025, 7), x + Math.sin(i * 1.3) * 0.12, 2.42 + i * 0.02, -0.15 + Math.cos(i * 1.3) * 0.1, 0.2 * i, 0, 0.1);
    }
    // long gaunt arms
    r.sym((s) => {
      const g = s > 0 ? 'armL' : 'armR', x = s * 0.32;
      r.h(g, G2, sph(0.1, 6, 5), x, 2.1, 0);
      r.h(g, R, cyl(0.06, 0.05, 0.8, 6), x, 1.68, 0);
      r.h(g, G, box(0.12, 0.08, 0.12), x, 1.28, 0.02);
      for (let f = 0; f < 3; f++) r.h(g, P, cone(0.015, 0.2, 3), x + (f - 1) * 0.035, 1.14, 0.04, 0, 0, PI);
    });
    r.vents.push([0, 3.0, -0.15]);
    r.weak.push(['body', 0, 1.9, 0.19], ['pans0', 0.85, 2.45, -0.15], ['pans1', -0.85, 2.45, -0.15], ['body', 0, 2.45, 0.17]);
  },
  anim(b, P, t, dt, st) { P.wheel.pivot.rotation.z += dt * (st === 'ledgering' ? 12 : busy(st) ? 5 : 0.8); },
};

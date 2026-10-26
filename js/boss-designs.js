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

// characters.js
// The three playable heroes. They share the same controls and upgrade cards, but each one
// trades power, toughness and mobility differently. They're balanced on ONE shared budget:
//
//     budget = DPS x effective HP x mobility        (Sarrow = 1.00 x 100 x 1.00 = 100)
//
//   DPS       = damage x attack speed (single target, talon combo)
//   eff. HP   = max health
//   mobility  = 0.7 x move speed + 0.3 x blink distance per cooldown (both relative to Sarrow)
//
// scripts/sim-ttk.mjs prints each hero's time-to-kill and survival time per wave from these
// numbers. They stay within ~10% of each other at every wave.
import * as THREE from 'three';

import { HERO_STATS, CHARACTER_ORDER, characterBudget } from './hero-stats.js';
export { CHARACTER_ORDER, characterBudget };
const BUILDERS = { sarrow: (t) => buildSarrow(t), zaleks: (t) => buildZaleks(t), iskra: (t) => buildIskra(t), orin: (t) => buildOrin(t) };
export const CHARACTERS = Object.fromEntries(Object.entries(HERO_STATS).map(([id, c]) => [id, { ...c, build: BUILDERS[id] }]));

// Co-op duplicates get a colour tint so you can tell them apart
export const DUPLICATE_TINTS = [null, 0x4a9bff, 0x7aff5a, 0xff4ad0];
export function displayName(c, dupIndex = 0) {
  const name = c.name.charAt(0) + c.name.slice(1).toLowerCase();
  return dupIndex ? `${name} ${'I'.repeat(dupIndex + 1)}` : name;
}

function tintMats(tint, mats) {
  if (!tint) return mats;
  const t = new THREE.Color(tint);
  for (const k of ['coat', 'coatDark', 'plate', 'plateDark', 'cloth', 'clothDark', 'pants', 'orange', 'accent', 'mask']) {
    if (mats[k]) mats[k].color.lerp(t, 0.4);
  }
  return mats;
}

function boxMaker(unitBox) {
  return function box(parent, mat, w, h, d, x, y, z, shadow = true) {
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    parent.add(mesh);
    return mesh;
  };
}

// ---------- SARROW (the original hero)'s blocky model ----------
// Everything is made of boxes. The model faces +Z (forward) when rotation is 0.
// Look: charcoal hooded long coat, orange scarf/strap accents, a glowing teal
// reactor core in his chest, and two teal energy talons on each gauntlet.
function buildSarrow(tint) {
  const mats = tintMats(tint, {
    coat: new THREE.MeshLambertMaterial({ color: 0x2c3036 }),     // charcoal coat
    coatDark: new THREE.MeshLambertMaterial({ color: 0x1c1f23 }),
    pants: new THREE.MeshLambertMaterial({ color: 0x3d3b35 }),
    leather: new THREE.MeshLambertMaterial({ color: 0x5a3d2a }),
    orange: new THREE.MeshLambertMaterial({ color: 0xe0702a }),   // accent colour
    metal: new THREE.MeshLambertMaterial({ color: 0x70757d }),
    face: new THREE.MeshBasicMaterial({ color: 0x07090b }),       // shadowed face inside the hood
    glow: new THREE.MeshBasicMaterial({ color: 0x3ff6e0 }),       // teal energy
    blade: new THREE.MeshBasicMaterial({ color: 0x7ffff2, transparent: true, opacity: 0.9 }),
  });
  const unitBox = new THREE.BoxGeometry(1, 1, 1); // one shared box, scaled into each body part

  const root = new THREE.Group(); // moves + turns with the player
  const body = new THREE.Group(); // used for leaning / spinning animations
  root.add(body);

  function box(parent, mat, w, h, d, x, y, z, shadow = true) {
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    parent.add(mesh);
    return mesh;
  }

  // Legs (the group's origin is the hip joint, so rotating it swings the leg)
  function leg(x) {
    const g = new THREE.Group();
    g.position.set(x, 0.85, 0);
    body.add(g);
    box(g, mats.pants, 0.28, 0.6, 0.3, 0, -0.3, 0);        // trousers
    box(g, mats.leather, 0.32, 0.3, 0.4, 0, -0.7, 0.04);   // boot
    box(g, mats.orange, 0.33, 0.05, 0.41, 0, -0.56, 0.04, false); // boot trim
    return g;
  }
  const legL = leg(0.18);
  const legR = leg(-0.18);

  // Torso and the long coat
  box(body, mats.coat, 0.66, 0.66, 0.4, 0, 1.36, 0);                 // coat body
  const back = box(body, mats.coatDark, 0.7, 0.75, 0.07, 0, 0.78, -0.2); // coat tail at the back
  back.rotation.x = -0.18;
  for (const side of [-1, 1]) {
    const flap = box(body, mats.coat, 0.07, 0.7, 0.38, side * 0.36, 0.8, -0.01); // side panels
    flap.rotation.z = side * 0.12;
    const front = box(body, mats.coatDark, 0.24, 0.62, 0.06, side * 0.22, 0.83, 0.2); // open front
    front.rotation.z = side * 0.1;
  }
  box(body, mats.leather, 0.68, 0.08, 0.42, 0, 1.06, 0);              // belt
  const strap = box(body, mats.orange, 0.08, 0.8, 0.43, 0, 1.36, 0, false); // bandolier strap
  strap.rotation.z = 0.65;
  box(body, mats.orange, 0.52, 0.13, 0.46, 0, 1.72, 0);               // scarf
  box(body, mats.leather, 0.3, 0.2, 0.42, 0.42, 1.66, 0);             // one leather pauldron

  // The reactor core, glowing in the middle of his chest
  const coreRing = box(body, mats.metal, 0.26, 0.26, 0.05, 0, 1.42, 0.2, false);
  coreRing.rotation.z = Math.PI / 4;
  const core = box(body, mats.glow, 0.16, 0.16, 0.06, 0, 1.42, 0.22, false);
  core.rotation.z = Math.PI / 4;

  // Head: a deep hood with two teal eye glints
  const head = new THREE.Group();
  head.position.set(0, 1.98, 0);
  body.add(head);
  box(head, mats.coat, 0.48, 0.46, 0.5, 0, 0, 0);
  box(head, mats.face, 0.32, 0.26, 0.04, 0, -0.04, 0.24, false);
  box(head, mats.glow, 0.07, 0.04, 0.02, 0.08, -0.01, 0.265, false);
  box(head, mats.glow, 0.07, 0.04, 0.02, -0.08, -0.01, 0.265, false);
  const drape = box(head, mats.coatDark, 0.36, 0.12, 0.4, 0, 0.17, -0.2); // hood folds down the back
  drape.rotation.x = 0.55;

  // Arms with metal gauntlets and two glowing energy talons each (group origin = shoulder)
  const blades = [], halos = [];
  function arm(x) {
    const g = new THREE.Group();
    g.position.set(x, 1.62, 0);
    body.add(g);
    box(g, mats.coat, 0.24, 0.55, 0.26, 0, -0.27, 0);      // sleeve
    box(g, mats.metal, 0.28, 0.3, 0.3, 0, -0.66, 0);       // gauntlet
    box(g, mats.orange, 0.29, 0.06, 0.31, 0, -0.55, 0, false); // gauntlet stripe
    for (const cx of [-0.07, 0.07]) {
      blades.push(box(g, mats.blade, 0.04, 0.72, 0.1, cx, -1.13, 0.03, false)); // energy talon
      // soft glow around the talon (grows with the weapon tier)
      const halo = box(g, new THREE.MeshBasicMaterial({ color: 0x7ffff2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0.12, 0.8, 0.18, cx, -1.13, 0.03, false);
      halo.visible = false;
      halos.push(halo);
    }
    return g;
  }
  const armL = arm(0.46);
  const armR = arm(-0.46);

  const flashMats = [mats.coat, mats.coatDark, mats.pants, mats.leather, mats.orange, mats.metal];
  return { root, body, head, core, legL, legR, armL, armR, flashMats, blade: mats.blade, blades, halos, bladeBase: -0.77, bladeLen: 0.72 };
}

// ---------- ZALEKS: bulky plated scav ----------
// Wide armoured shoulders, a riveted heavy mask with a single amber visor slit, a glowing amber
// core, rust-and-gunmetal plates and short, thick amber talons. A broad, low silhouette.
function buildZaleks(tint) {
  const mats = tintMats(tint, {
    plate: new THREE.MeshLambertMaterial({ color: 0x55585c }),     // gunmetal plates
    plateDark: new THREE.MeshLambertMaterial({ color: 0x2e3033 }),
    cloth: new THREE.MeshLambertMaterial({ color: 0x6b4a2e }),     // rust-brown under-suit
    accent: new THREE.MeshLambertMaterial({ color: 0x9c3a1c }),    // oxide red trim
    metal: new THREE.MeshLambertMaterial({ color: 0x8a8f96 }),
    face: new THREE.MeshBasicMaterial({ color: 0x0a0806 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffa030 }),        // amber energy
    blade: new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.92 }),
  });
  const box = boxMaker(new THREE.BoxGeometry(1, 1, 1));
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  function leg(x) {
    const g = new THREE.Group(); g.position.set(x, 0.8, 0); body.add(g);
    box(g, mats.cloth, 0.36, 0.55, 0.38, 0, -0.27, 0);
    box(g, mats.plate, 0.4, 0.22, 0.42, 0, -0.18, 0.04);           // knee plate
    box(g, mats.plateDark, 0.44, 0.32, 0.5, 0, -0.66, 0.05);       // heavy boot
    return g;
  }
  const legL = leg(0.24), legR = leg(-0.24);
  box(body, mats.cloth, 0.86, 0.5, 0.5, 0, 1.0, 0);                // belly
  box(body, mats.plate, 0.96, 0.62, 0.56, 0, 1.42, 0);             // chest plate
  box(body, mats.accent, 0.98, 0.07, 0.58, 0, 1.2, 0, false);      // trim
  box(body, mats.plateDark, 0.6, 0.5, 0.2, 0, 1.4, -0.36);         // back reactor pack
  for (const sx of [-0.18, 0.18]) box(body, mats.metal, 0.08, 0.34, 0.08, sx, 1.75, -0.4); // exhaust stacks
  for (const side of [-1, 1]) {                                     // huge shoulder plates
    const s = box(body, mats.plate, 0.44, 0.24, 0.62, side * 0.62, 1.78, 0);
    s.rotation.z = -side * 0.22;
    box(body, mats.accent, 0.46, 0.05, 0.64, side * 0.62, 1.67, 0, false).rotation.z = -side * 0.22;
  }
  const coreRing = box(body, mats.metal, 0.32, 0.32, 0.05, 0, 1.44, 0.28, false);
  const core = box(body, mats.glow, 0.2, 0.2, 0.06, 0, 1.44, 0.3, false);
  coreRing.rotation.z = 0;  // square amber core (Sarrow's is a diamond)
  const head = new THREE.Group(); head.position.set(0, 1.98, 0.04); body.add(head);
  box(head, mats.plateDark, 0.5, 0.44, 0.5, 0, 0, 0);               // heavy mask
  box(head, mats.plate, 0.54, 0.12, 0.54, 0, 0.2, 0);               // brow ridge
  box(head, mats.face, 0.38, 0.06, 0.04, 0, 0.02, 0.255, false);    // visor slit
  box(head, mats.glow, 0.32, 0.035, 0.02, 0, 0.02, 0.27, false);    // amber visor glow
  for (const sx of [-0.15, 0, 0.15]) box(head, mats.metal, 0.06, 0.14, 0.03, sx, -0.13, 0.26, false); // grille
  const blades = [], halos = [];
  function arm(x) {
    const g = new THREE.Group(); g.position.set(x, 1.62, 0); body.add(g);
    box(g, mats.cloth, 0.3, 0.5, 0.32, 0, -0.25, 0);
    box(g, mats.plate, 0.42, 0.38, 0.42, 0, -0.66, 0);               // big fist gauntlet
    box(g, mats.accent, 0.43, 0.06, 0.43, 0, -0.5, 0, false);
    for (const cx of [-0.11, 0, 0.11]) {                               // three short thick talons
      blades.push(box(g, mats.blade, 0.07, 0.5, 0.12, cx, -1.1, 0.04, false));
      const halo = box(g, new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0.14, 0.56, 0.2, cx, -1.1, 0.04, false);
      halo.visible = false; halos.push(halo);
    }
    return g;
  }
  const armL = arm(0.62), armR = arm(-0.62);
  const flashMats = [mats.plate, mats.plateDark, mats.cloth, mats.accent, mats.metal];
  return { root, body, head, core, legL, legR, armL, armR, flashMats, blade: mats.blade, blades, halos, bladeBase: -0.85, bladeLen: 0.5 };
}

// ---------- ISKRA: swift skirmisher ----------
// Slim and tall, pale ash-white wraps with a violet sash, a long split scarf trailing behind,
// a narrow crested helm with a magenta eye line, a violet core and long, thin needle-talons.
function buildIskra(tint) {
  const mats = tintMats(tint, {
    cloth: new THREE.MeshLambertMaterial({ color: 0xc9c4bc }),     // ash-white wraps
    clothDark: new THREE.MeshLambertMaterial({ color: 0x46405a }), // slate-violet underlayer
    accent: new THREE.MeshLambertMaterial({ color: 0x8a3ad0 }),    // violet sash
    metal: new THREE.MeshLambertMaterial({ color: 0x9aa0aa }),
    face: new THREE.MeshBasicMaterial({ color: 0x0b0710 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xe060ff }),        // magenta-violet energy
    blade: new THREE.MeshBasicMaterial({ color: 0xe8a0ff, transparent: true, opacity: 0.9 }),
  });
  const box = boxMaker(new THREE.BoxGeometry(1, 1, 1));
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  function leg(x) {
    const g = new THREE.Group(); g.position.set(x, 0.92, 0); body.add(g);
    box(g, mats.clothDark, 0.2, 0.66, 0.22, 0, -0.33, 0);
    box(g, mats.cloth, 0.22, 0.28, 0.3, 0, -0.78, 0.04);            // wrapped shin/boot
    box(g, mats.accent, 0.23, 0.04, 0.31, 0, -0.66, 0.04, false);
    return g;
  }
  const legL = leg(0.13), legR = leg(-0.13);
  box(body, mats.cloth, 0.46, 0.66, 0.3, 0, 1.38, 0);              // narrow torso
  box(body, mats.clothDark, 0.4, 0.3, 0.28, 0, 1.0, 0);            // waist
  box(body, mats.accent, 0.5, 0.1, 0.34, 0, 1.12, 0, false);        // sash
  const tail = box(body, mats.accent, 0.12, 0.6, 0.05, 0.12, 0.85, -0.18); tail.rotation.x = -0.3; // sash tail
  for (const sx of [-0.09, 0.09]) {                                 // long split scarf
    const sc = box(body, mats.accent, 0.12, 0.05, 0.9, sx, 1.74, -0.48); sc.rotation.x = 0.35;
  }
  box(body, mats.accent, 0.4, 0.12, 0.34, 0, 1.74, 0);              // scarf collar
  const coreRing = box(body, mats.metal, 0.18, 0.18, 0.05, 0, 1.46, 0.15, false); coreRing.rotation.z = Math.PI / 4;
  const core = box(body, mats.glow, 0.11, 0.11, 0.06, 0, 1.46, 0.17, false); core.rotation.z = Math.PI / 4;
  const head = new THREE.Group(); head.position.set(0, 2.04, 0); body.add(head);
  box(head, mats.cloth, 0.34, 0.4, 0.4, 0, 0, 0);                   // slim helm
  box(head, mats.accent, 0.06, 0.2, 0.46, 0, 0.27, -0.03);          // crest fin
  box(head, mats.face, 0.28, 0.1, 0.04, 0, 0, 0.2, false);
  box(head, mats.glow, 0.24, 0.03, 0.02, 0, 0, 0.215, false);       // eye line
  const blades = [], halos = [];
  function arm(x) {
    const g = new THREE.Group(); g.position.set(x, 1.64, 0); body.add(g);
    box(g, mats.cloth, 0.16, 0.55, 0.18, 0, -0.27, 0);
    box(g, mats.metal, 0.2, 0.24, 0.22, 0, -0.64, 0);               // light bracer
    box(g, mats.accent, 0.21, 0.05, 0.23, 0, -0.55, 0, false);
    blades.push(box(g, mats.blade, 0.03, 0.9, 0.06, 0, -1.2, 0.04, false)); // one long needle talon
    const halo = box(g, new THREE.MeshBasicMaterial({ color: 0xe8a0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0.1, 0.95, 0.14, 0, -1.2, 0.04, false);
    halo.visible = false; halos.push(halo);
    return g;
  }
  const armL = arm(0.33), armR = arm(-0.33);
  const flashMats = [mats.cloth, mats.clothDark, mats.accent, mats.metal];
  return { root, body, head, core, legL, legR, armL, armR, flashMats, blade: mats.blade, blades, halos, bladeBase: -0.75, bladeLen: 0.9 };
}

// ---------- ORIN: the secret 4th hero (unlocks at wave 50) ----------
// A Grindchoir machine that broke from the hymn: rust-red iron plates, a cracked bell-mask with one
// reclaimed teal eye, three silent organ pipes on his back, a stolen crimson core, and hooked
// sickle-talons (two per arm, curved inward) that suit his pulling Overdrive.
function buildOrin(tint) {
  const mats = tintMats(tint, {
    plate: new THREE.MeshLambertMaterial({ color: 0x6a2a22 }),     // rust-red iron
    plateDark: new THREE.MeshLambertMaterial({ color: 0x2a2220 }),
    cloth: new THREE.MeshLambertMaterial({ color: 0x3a3430 }),     // soot-black cabling
    accent: new THREE.MeshLambertMaterial({ color: 0xb08a4a }),    // tarnished brass
    metal: new THREE.MeshLambertMaterial({ color: 0x8a8580 }),
    mask: new THREE.MeshLambertMaterial({ color: 0xcfc4ae }),      // bone-white bell mask
    face: new THREE.MeshBasicMaterial({ color: 0x0a0606 }),
    glow: new THREE.MeshBasicMaterial({ color: 0xff4a5a }),        // crimson core
    eye: new THREE.MeshBasicMaterial({ color: 0x3ff6e0 }),         // the one reclaimed eye
    blade: new THREE.MeshBasicMaterial({ color: 0xff9a8a, transparent: true, opacity: 0.9 }),
  });
  const box = boxMaker(new THREE.BoxGeometry(1, 1, 1));
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  function leg(x) {
    const g = new THREE.Group(); g.position.set(x, 0.92, 0); body.add(g);
    box(g, mats.cloth, 0.24, 0.6, 0.26, 0, -0.3, 0);
    box(g, mats.plate, 0.3, 0.34, 0.36, 0, -0.76, 0.03);           // iron boot
    box(g, mats.accent, 0.31, 0.05, 0.37, 0, -0.6, 0.03, false);
    return g;
  }
  const legL = leg(0.16), legR = leg(-0.16);
  box(body, mats.plate, 0.62, 0.62, 0.4, 0, 1.38, 0);              // chest plate
  box(body, mats.plateDark, 0.5, 0.3, 0.34, 0, 1.0, 0);            // waist
  box(body, mats.accent, 0.66, 0.08, 0.44, 0, 1.12, 0, false);      // brass band
  for (const sx of [-0.36, 0.36]) box(body, mats.plateDark, 0.22, 0.2, 0.42, sx, 1.66, 0); // pauldrons
  for (const [x, h] of [[-0.16, 0.7], [0, 0.9], [0.16, 0.6]]) {    // silent organ pipes on the back
    box(body, mats.accent, 0.1, h, 0.1, x, 1.5 + h / 2 - 0.1, -0.28);
    box(body, mats.plateDark, 0.12, 0.05, 0.12, x, 1.5 + h - 0.1, -0.28, false);
  }
  const coreRing = box(body, mats.accent, 0.22, 0.22, 0.05, 0, 1.42, 0.2, false); coreRing.rotation.z = Math.PI / 4;
  const core = box(body, mats.glow, 0.13, 0.13, 0.06, 0, 1.42, 0.22, false); core.rotation.z = Math.PI / 4;
  for (const y of [1.3, 1.54]) box(body, mats.plateDark, 0.5, 0.03, 0.03, 0, y, 0.21, false); // cracked grill
  const head = new THREE.Group(); head.position.set(0, 2.06, 0); body.add(head);
  box(head, mats.mask, 0.42, 0.44, 0.42, 0, 0, 0);                  // bell mask
  box(head, mats.mask, 0.5, 0.08, 0.5, 0, -0.22, 0);                // flared rim
  box(head, mats.face, 0.06, 0.2, 0.04, -0.09, -0.02, 0.215, false); // mouth slot
  box(head, mats.face, 0.03, 0.26, 0.02, 0.12, 0.02, 0.215, false);  // the crack
  box(head, mats.eye, 0.09, 0.07, 0.03, 0.06, 0.08, 0.22, false);    // one teal eye
  box(head, mats.accent, 0.12, 0.08, 0.12, 0, 0.26, 0);             // crown bolt
  const blades = [], halos = [];
  function arm(x) {
    const g = new THREE.Group(); g.position.set(x, 1.64, 0); body.add(g);
    box(g, mats.cloth, 0.18, 0.55, 0.2, 0, -0.27, 0);
    box(g, mats.plate, 0.26, 0.3, 0.28, 0, -0.66, 0);               // gauntlet
    box(g, mats.accent, 0.27, 0.05, 0.29, 0, -0.55, 0, false);
    for (const dz of [-0.06, 0.1]) {                                 // two hooked sickle-talons
      const b = box(g, mats.blade, 0.04, 0.62, 0.07, 0, -1.08, dz, false); b.rotation.x = dz > 0 ? -0.18 : 0.12;
      blades.push(b);
      const halo = box(g, new THREE.MeshBasicMaterial({ color: 0xff9a8a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0.12, 0.7, 0.16, 0, -1.08, dz, false);
      halo.rotation.x = b.rotation.x; halo.visible = false; halos.push(halo);
    }
    return g;
  }
  const armL = arm(0.44), armR = arm(-0.44);
  const flashMats = [mats.plate, mats.plateDark, mats.cloth, mats.accent, mats.metal, mats.mask];
  return { root, body, head, core, legL, legR, armL, armR, flashMats, blade: mats.blade, blades, halos, bladeBase: -0.8, bladeLen: 0.62 };
}

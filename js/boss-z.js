// boss-z.js
// COREBURNZ: five more leaders of the Grindchoir (only in the CoreBurnZ rule set, see bosses.js).
//   SISTER KLAXON    "The Siren Engine"  - rings of bolts with a GAP you must find, and a sonic shriek cone
//   THE BELLOWS ABBOT "Lungs of the Forge" - INHALES (drags you in) then EXHALES a blast; slow gust lanes
//   SAINT GRAVELMOUTH "The Stone Litany"  - ROCKFALL circles rain on you in waves, gravel spit, rolling charges
//   THE TITHE-WARDEN  "Weigher of Scrap"  - LEDGER: a chain of marks that follows your steps and detonates;
//                                           SCALES: two pans slam you and your mirror spot at once
//   THE NAIL CHORUS   "Many Throats"     - a 3-armed SPIRAL of nails, then NAIL RAIN lines across the arena
// Every attack is telegraphed like the others (red circles / strips / a glow first).
// Co-op: the host runs the attacks; friends see the same warnings (effects are mirrored), bolts come
// through the snapshot, and the Abbot's inhale pulls each player on their own screen (pose()).
import * as THREE from 'three';
import { Boss } from './boss.js?v=1.30.3';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const GLOW = (c) => new THREE.MeshBasicMaterial({ color: c });

// shared helpers
function hurtNear(boss, player, pos, r, dmg) {
  for (const h of boss.world.teamOf(player)) if (!h.dead && pos.distanceTo(h.position) < r + h.radius) h.takeDamage(dmg * boss.dmgMult, boss);
}
function shove(boss, h, v, dist) { // knock a hero away (skipped mid-dash)
  if (h.dead || h.state === 'dash' || v.lengthSq() < 1e-4) return;
  h.position.addScaledVector(v.clone().normalize(), dist);
  boss.world.arena.resolve(h.position, h.radius);
}
function ring(boss, n, speed, dmg, color, offset = 0, gap = null, size = 1.2) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + offset;
    if (gap) { const d = Math.atan2(Math.sin(a - gap.at), Math.cos(a - gap.at)); if (Math.abs(d) < gap.width) continue; }
    boss.world.projectiles.fire(boss.position.clone().setY(1.5), V3(Math.cos(a), 0, Math.sin(a)), speed, dmg * boss.dmgMult, color, size, boss);
  }
}

// ======================= SISTER KLAXON =======================
export const KLAXON_DEF = {
  id: 'klaxon', name: 'SISTER KLAXON', killerName: 'Sister Klaxon', subtitle: 'The Siren Engine',
  hp: 640, speed: 3.2, scale: 1.9,
  pattern: ['gapring', 'shriek', 'charge', 'gapring', 'summon', 'shriek'],
  summon: ['mite', 'mite', 'spitter', 'spitter'],
  boltColor: 0xffd23a,
  colors: { main: 0xb08a3a, dark: 0x2a2018, mask: 0xe8d8a8 },
};
export class SisterKlaxon extends Boss {
  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    for (const a of [0, 2.1, 4.2]) { const l = part(this.body, dark, 0.14, 1.0, 0.14, Math.sin(a) * 0.3, 0.45, Math.cos(a) * 0.3); l.rotation.z = Math.sin(a) * 0.25; l.rotation.x = -Math.cos(a) * 0.25; } // tripod
    part(this.body, dark, 0.7, 0.9, 0.5, 0, 1.3, 0);
    const grille = part(this.body, main, 0.5, 0.5, 0.06, 0, 1.35, 0.27, false);
    for (const y of [1.18, 1.3, 1.42, 1.54]) part(this.body, dark, 0.46, 0.04, 0.07, 0, y, 0.29, false);
    grille.userData.k = 1;
    // the great brass horn for a head
    this.horn = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 14, 1, true), main);
    this.horn.rotation.x = -Math.PI / 2; this.horn.position.set(0, 2.1, 0.35); this.horn.castShadow = true; this.body.add(this.horn);
    this.throat = part(this.body, GLOW(0xffd23a), 0.22, 0.22, 0.05, 0, 2.1, -0.25, false);
    part(this.body, mask, 0.35, 0.3, 0.3, 0, 2.1, -0.35);
    this.armL = group(this.body, 0.45, 1.7, 0); this.armR = group(this.body, -0.45, 1.7, 0);
    for (const a of [this.armL, this.armR]) { part(a, dark, 0.13, 0.75, 0.13, 0, -0.37, 0); part(a, main, 0.28, 0.2, 0.28, 0, -0.8, 0); }
  }
  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    if (name === 'gapring') {
      this.burstsLeft = 3 + Math.min(1, this.tier);
      this.gapAt = Math.atan2(toPlayer.z, toPlayer.x) + Math.PI; // first gap is behind her: run round!
      this.telegraphTime = 0.9 * this.pace;
      fx.spawnRing(this.position, 0xffd23a, 3, this.telegraphTime);
      return;
    }
    if (name === 'shriek') {
      this.shriekDir = toPlayer.clone();
      this.telegraphTime = 1.0 * this.pace;
      for (const d of [-0.38, 0, 0.38]) {
        const a = Math.atan2(toPlayer.z, toPlayer.x) + d;
        fx.spawnLine(this.position, V3(Math.cos(a), 0, Math.sin(a)), 11, 1.6, this.telegraphTime);
      }
      return;
    }
    super.setupAttack(name, player, toPlayer);
  }
  doAttack(player, toPlayer, dist) {
    if (this.attack === 'gapring') {
      ring(this, 26 + this.tier * 4, 7.5, 11, 0xffd23a, 0, { at: this.gapAt, width: 0.42 });
      this.world.sfx('shot');
      this.gapAt += 1.3 + Math.random() * 0.8; // the gap moves every ring
      if (--this.burstsLeft > 0) { this.stateTime = 0; this.telegraphTime = 0.75 * this.pace; }
      else this.recover(0.8);
      return;
    }
    if (this.attack === 'shriek') {
      const base = Math.atan2(this.shriekDir.z, this.shriekDir.x);
      for (const h of this.world.teamOf(player)) {
        if (h.dead) continue;
        const v = h.position.clone().sub(this.position).setY(0), d = v.length();
        const off = Math.abs(Math.atan2(Math.sin(Math.atan2(v.z, v.x) - base), Math.cos(Math.atan2(v.z, v.x) - base)));
        if (d < 11.5 && off < 0.5) { h.takeDamage(24 * this.dmgMult, this); shove(this, h, v, 2.6); }
      }
      for (let i = 1; i <= 5; i++) this.world.effects.spawnRing(this.position.clone().addScaledVector(this.shriekDir, i * 2), 0xffe27a, 1 + i * 0.35, 0.35);
      this.world.shake(0.45); this.world.sfx('bossWarning');
      this.recover(0.9);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }
  pose(dt, t) {
    const glow = super.pose(dt, t);
    const k = this.state === 'telegraph' ? Math.min(1, this.stateTime / this.telegraphTime) : 0;
    this.horn.scale.setScalar(1 + 0.25 * k + (this.state === 'recover' ? 0.1 : 0));
    this.throat.scale.setScalar(1 + 2 * k);
    return glow;
  }
}

// ======================= THE BELLOWS ABBOT =======================
export const BELLOWS_DEF = {
  id: 'bellows', name: 'THE BELLOWS ABBOT', killerName: 'the Bellows Abbot', subtitle: 'Lungs of the Forge',
  hp: 760, speed: 2.4, scale: 2.0,
  pattern: ['inhale', 'gust', 'slam', 'inhale', 'summon'],
  summon: ['acolyte', 'hound', 'hound'],
  boltColor: 0xff7a3a,
  colors: { main: 0x6a3a22, dark: 0x231a16, mask: 0xc9b89a },
};
export class BellowsAbbot extends Boss {
  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    for (const x of [0.35, -0.35]) part(this.body, dark, 0.35, 0.7, 0.4, x, 0.35, 0);
    this.lungs = group(this.body, 0, 1.35, 0);
    part(this.lungs, main, 1.4, 1.0, 1.0, 0, 0, 0);
    for (const y of [-0.3, -0.1, 0.1, 0.3]) part(this.lungs, dark, 1.45, 0.06, 1.05, 0, y, 0, false); // accordion pleats
    part(this.lungs, GLOW(0xff7a3a), 0.5, 0.25, 0.04, 0, 0, 0.52, false);
    for (const x of [0.45, -0.45]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 0.7, 8), dark); n.position.set(x, 2.1, -0.2); n.rotation.x = -0.3; this.body.add(n); }
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 8), dark); hood.position.set(0, 2.25, 0.05); this.body.add(hood);
    part(this.body, mask, 0.3, 0.26, 0.22, 0, 2.05, 0.18);
    this.mouth = part(this.body, GLOW(0xffb070), 0.14, 0.14, 0.03, 0, 2.0, 0.3, false);
    this.armL = group(this.body, 0.85, 1.7, 0); this.armR = group(this.body, -0.85, 1.7, 0);
    for (const a of [this.armL, this.armR]) { part(a, dark, 0.22, 0.7, 0.22, 0, -0.35, 0); part(a, mask, 0.3, 0.25, 0.3, 0, -0.8, 0); }
  }
  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    if (name === 'inhale') {
      this.telegraphTime = 1.9 * this.pace;
      this.blastR = 4.6 + this.tier * 0.4;
      fx.spawnWarning(this.position, this.blastR, this.telegraphTime);
      return;
    }
    if (name === 'gust') {
      this.shotsLeft = 3;
      this.telegraphTime = 0.7 * this.pace;
      return;
    }
    super.setupAttack(name, player, toPlayer);
  }
  doAttack(player, toPlayer, dist) {
    if (this.attack === 'inhale') { // EXHALE
      hurtNear(this, player, this.position, this.blastR, 28);
      for (const h of this.world.teamOf(player)) { const v = h.position.clone().sub(this.position).setY(0); if (v.length() < this.blastR + 3) shove(this, h, v, 3.2); }
      ring(this, 12 + this.tier * 2, 6, 9, 0xff7a3a, Math.random(), null, 1.5);
      this.world.effects.spawnRing(this.position, 0xffb070, this.blastR, 0.5);
      this.world.shake(0.6); this.world.sfx('enemyDeath');
      this.recover(1.1); // winded: free hits
      return;
    }
    if (this.attack === 'gust') {
      const base = Math.atan2(toPlayer.z, toPlayer.x);
      for (const d of [-0.35, 0, 0.35]) this.world.projectiles.fire(this.position.clone().setY(1.4), V3(Math.cos(base + d), 0, Math.sin(base + d)), 5, 14 * this.dmgMult, 0xff9a5a, 2.2, this);
      this.world.sfx('shot');
      if (--this.shotsLeft > 0) { this.stateTime = 0; this.telegraphTime = 0.5 * this.pace; } else this.recover(0.7);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }
  pose(dt, t) {
    const glow = super.pose(dt, t);
    const inhaling = this.state === 'telegraph' && this.attack === 'inhale';
    const k = inhaling ? Math.min(1, this.stateTime / this.telegraphTime) : 0;
    this.lungs.scale.set(1 + 0.35 * k, 1 + 0.25 * k, 1 + 0.35 * k);
    this.mouth.scale.setScalar(1 + 3 * k);
    // INHALE: drags the local hero in (each co-op player is pulled on their own screen)
    const me = this.world.player;
    if (inhaling && me && !me.dead && me.state !== 'dash') {
      const v = this.position.clone().sub(me.position).setY(0), d = v.length();
      if (d > this.radius + 1 && d < 16) {
        me.position.addScaledVector(v.normalize(), Math.min(d, (2.2 + 3.5 * k) * dt));
        this.world.arena.resolve(me.position, me.radius);
      }
      if (Math.random() < 0.25) this.world.effects.spawnSparks?.(me.position.clone().setY(0.5), 0xffd0a0, 1, 2);
    }
    return glow;
  }
}

// ======================= SAINT GRAVELMOUTH =======================
export const GRAVEL_DEF = {
  id: 'gravel', name: 'SAINT GRAVELMOUTH', killerName: 'Saint Gravelmouth', subtitle: 'The Stone Litany',
  hp: 820, speed: 2.6, scale: 1.95,
  chargeSpeed: 15, chargeTime: 1.0, chargeDamage: 22,
  pattern: ['rockfall', 'gravelspit', 'triplecharge', 'rockfall', 'summon'],
  summon: ['bulwark', 'acolyte', 'mite', 'mite'],
  boltColor: 0xb0a48a,
  colors: { main: 0x8a8070, dark: 0x3a3630, mask: 0xc8bea8 },
};
export class SaintGravelmouth extends Boss {
  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    for (const x of [0.4, -0.4]) part(this.body, dark, 0.45, 0.6, 0.5, x, 0.3, 0);
    part(this.body, main, 1.5, 1.1, 1.1, 0, 1.15, 0);              // squat stone body
    part(this.body, mask, 1.1, 0.12, 0.2, 0, 1.6, 0.5, false);       // stole
    for (const x of [-0.5, 0, 0.5]) part(this.body, dark, 0.16, 0.16, 0.06, x, 1.3, 0.56, false);
    part(this.body, main, 0.9, 0.7, 0.8, 0, 2.0, 0.05);             // head block
    this.jaw = group(this.body, 0, 1.75, 0.3);
    part(this.jaw, dark, 0.8, 0.25, 0.5, 0, -0.05, 0.1);
    this.maw = part(this.body, GLOW(0xd8c070), 0.6, 0.18, 0.04, 0, 1.85, 0.46, false); // gravel-glow mouth
    const mitre = part(this.body, mask, 0.55, 0.65, 0.3, 0, 2.65, 0); mitre.rotation.z = Math.PI / 4; // stone mitre
    for (const x of [0.2, -0.2]) part(this.body, GLOW(0xfff0a0), 0.12, 0.07, 0.03, x, 2.12, 0.46, false);
    this.armL = group(this.body, 0.85, 1.55, 0); this.armR = group(this.body, -0.85, 1.55, 0);
    for (const a of [this.armL, this.armR]) { part(a, dark, 0.3, 0.7, 0.3, 0, -0.35, 0); part(a, main, 0.42, 0.42, 0.42, 0, -0.85, 0); }
  }
  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    if (name === 'rockfall') {
      this.telegraphTime = 1.15 * this.pace;
      this.rocks = [];
      for (const h of this.world.teamOf(player)) {
        if (h.dead) continue;
        this.rocks.push(h.position.clone().setY(0));
        for (let i = 0; i < 3 + this.tier; i++) { const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 3; this.rocks.push(h.position.clone().add(V3(Math.cos(a) * r, 0, Math.sin(a) * r))); }
      }
      for (const r of this.rocks) fx.spawnWarning(r, 1.9, this.telegraphTime);
      this.wavesLeft = 2;
      return;
    }
    if (name === 'gravelspit') {
      this.shotsLeft = 12 + this.tier * 2;
      this.telegraphTime = 0.7 * this.pace;
      return;
    }
    super.setupAttack(name, player, toPlayer);
  }
  doAttack(player, toPlayer, dist) {
    const fx = this.world.effects;
    if (this.attack === 'rockfall') {
      for (const r of this.rocks) { hurtNear(this, player, r, 1.9, 20); fx.spawnRing(r, 0xb0a48a, 1.9, 0.35); fx.spawnSparks(r.clone().setY(0.5), 0xc8bea8, 6, 6); }
      this.world.shake(0.4); this.world.sfx('enemyDeath');
      if (--this.wavesLeft > 0) { // a second wave lands where you ran to
        this.stateTime = 0; this.telegraphTime = 0.9 * this.pace; this.rocks = [];
        for (const h of this.world.teamOf(player)) if (!h.dead) { this.rocks.push(h.position.clone().setY(0)); const a = Math.random() * 6.28; this.rocks.push(h.position.clone().add(V3(Math.cos(a) * 3, 0, Math.sin(a) * 3))); }
        for (const r of this.rocks) fx.spawnWarning(r, 1.9, this.telegraphTime);
      } else this.recover(0.8);
      return;
    }
    if (this.attack === 'gravelspit') {
      const a = Math.atan2(toPlayer.z, toPlayer.x) + (Math.random() - 0.5) * 0.35;
      this.world.projectiles.fire(this.position.clone().setY(1.8), V3(Math.cos(a), 0, Math.sin(a)), 11, 8 * this.dmgMult, 0xb0a48a, 1.0, this);
      if (this.shotsLeft % 3 === 0) this.world.sfx('shot');
      if (--this.shotsLeft > 0) { this.stateTime = 0; this.telegraphTime = 0.09; } else this.recover(0.7);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }
  pose(dt, t) {
    const glow = super.pose(dt, t);
    const spitting = this.attack === 'gravelspit' && this.state === 'telegraph';
    this.jaw.rotation.x = spitting ? 0.6 : this.state === 'telegraph' ? 0.3 : 0.05;
    this.maw.scale.y = spitting ? 2.5 : 1;
    if (this.state === 'charging') this.body.rotation.x = 0.5 + Math.sin(t * 25) * 0.1; // tucks and rolls
    return glow;
  }
}

// ======================= THE TITHE-WARDEN =======================
export const TITHE_DEF = {
  id: 'tithe', name: 'THE TITHE-WARDEN', killerName: 'the Tithe-Warden', subtitle: 'Weigher of Scrap',
  hp: 680, speed: 3.4, scale: 1.85,
  pattern: ['ledger', 'scales', 'charge', 'ledger', 'summon', 'scales'],
  summon: ['bulwark', 'acolyte', 'acolyte'],
  boltColor: 0xffc23a,
  colors: { main: 0x3a3a46, dark: 0x16161c, mask: 0xd8b44a },
};
export class TitheWarden extends Boss {
  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    for (const x of [0.16, -0.16]) part(this.body, dark, 0.16, 1.2, 0.16, x, 0.6, 0);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 6), main); robe.position.y = 1.2; this.body.add(robe);
    part(this.body, main, 0.5, 0.6, 0.35, 0, 1.9, 0);
    part(this.body, mask, 0.36, 0.42, 0.34, 0, 2.4, 0);             // coin-gold mask
    part(this.body, dark, 0.2, 0.04, 0.02, 0, 2.42, 0.18, false);    // the coin slot
    part(this.body, mask, 0.5, 0.06, 0.5, 0, 2.66, 0, false);        // flat tricorne-ish brim
    // the scales: a beam on the back with two hanging pans
    this.beam = group(this.body, 0, 2.95, -0.15);
    part(this.beam, mask, 1.8, 0.06, 0.06, 0, 0, 0);
    this.pans = [];
    for (const x of [0.85, -0.85]) {
      const p = group(this.beam, x, 0, 0);
      part(p, dark, 0.02, 0.5, 0.02, 0, -0.25, 0, false);
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.08, 10), mask); pan.position.y = -0.52; p.add(pan);
      this.pans.push(p);
    }
    this.armL = group(this.body, 0.32, 2.1, 0); this.armR = group(this.body, -0.32, 2.1, 0);
    for (const a of [this.armL, this.armR]) { part(a, dark, 0.1, 0.8, 0.1, 0, -0.4, 0); part(a, mask, 0.14, 0.14, 0.14, 0, -0.85, 0); }
  }
  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    if (name === 'ledger') { // short wind-up, then marks follow your steps (see update)
      this.telegraphTime = 0.5 * this.pace;
      this.ledgerTarget = player;
      return;
    }
    if (name === 'scales') {
      this.telegraphTime = 1.2 * this.pace;
      const p = player.position.clone().setY(0);
      const mirror = this.position.clone().multiplyScalar(2).sub(p).setY(0);
      this.world.arena.resolve(mirror, 0.5);
      this.pansAt = [p, mirror];
      for (const m of this.pansAt) fx.spawnWarning(m, 3.0, this.telegraphTime);
      return;
    }
    super.setupAttack(name, player, toPlayer);
  }
  doAttack(player, toPlayer, dist) {
    if (this.attack === 'ledger') {
      this.state = 'ledgering'; this.stateTime = 0;
      this.marks = []; this.markClock = 0; this.marksLeft = 5 + this.tier;
      return;
    }
    if (this.attack === 'scales') {
      for (const m of this.pansAt) { hurtNear(this, player, m, 3.0, 24); this.world.effects.spawnRing(m, 0xffc23a, 3, 0.45); this.world.effects.spawnSparks(m.clone().setY(0.4), 0xffd870, 8, 7); }
      this.world.shake(0.5); this.world.sfx('enemyDeath');
      this.recover(0.8);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }
  update(dt, player) {
    if (this.state === 'ledgering' && !this.dead) {
      this.markClock -= dt;
      const tgt = (this.ledgerTarget && !this.ledgerTarget.dead) ? this.ledgerTarget : player;
      if (this.marksLeft > 0 && this.markClock <= 0) { // drop a mark where you stand right now
        this.markClock = 0.33;
        this.marksLeft--;
        const pos = tgt.position.clone().setY(0);
        this.world.effects.spawnWarning(pos, 1.7, 0.85);
        this.marks.push({ pos, t: 0.85 });
        this.world.sfx('bossWarning');
      }
      for (const m of this.marks) {
        if (m.t <= 0) continue;
        m.t -= dt;
        if (m.t <= 0) { hurtNear(this, player, m.pos, 1.7, 16); this.world.effects.spawnRing(m.pos, 0xffc23a, 1.7, 0.3); }
      }
      if (this.marksLeft <= 0 && this.marks.every((m) => m.t <= 0)) this.recover(0.9);
    }
    super.update(dt, player);
  }
  pose(dt, t) {
    const glow = super.pose(dt, t);
    const tilt = this.state === 'ledgering' ? Math.sin(t * 8) * 0.35 : this.state === 'telegraph' && this.attack === 'scales' ? 0.4 * Math.min(1, this.stateTime / this.telegraphTime) : Math.sin(t * 1.5) * 0.1;
    this.beam.rotation.z = tilt;
    for (const p of this.pans) p.rotation.z = -tilt;
    return glow;
  }
}

// ======================= THE NAIL CHORUS =======================
export const NAIL_DEF = {
  id: 'nail', name: 'THE NAIL CHORUS', killerName: 'the Nail Chorus', subtitle: 'Many Throats',
  hp: 700, speed: 2.9, scale: 1.9,
  pattern: ['spiral', 'nailrain', 'burst', 'spiral', 'summon'],
  summon: ['spitter', 'mite', 'mite', 'hound'],
  boltColor: 0xc8d0e0,
  colors: { main: 0x4a4e58, dark: 0x1a1c22, mask: 0xe0dccc },
};
export class NailChorus extends Boss {
  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    for (const x of [0.3, -0.3]) part(this.body, dark, 0.3, 0.8, 0.35, x, 0.4, 0);
    // an iron cage of a body, bristling with nails
    part(this.body, main, 1.1, 1.0, 0.9, 0, 1.3, 0);
    for (let i = 0; i < 14; i++) { const a = i * 2.4, y = 0.95 + (i % 5) * 0.17; const n = part(this.body, mask, 0.05, 0.05, 0.45, Math.sin(a) * 0.55, y, Math.cos(a) * 0.48, false); n.rotation.y = a; }
    this.core = part(this.body, GLOW(0x9ad8ff), 0.3, 0.3, 0.3, 0, 1.3, 0.3, false);
    // five masked heads on stalks: the many throats
    this.heads = [];
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      const s = group(this.body, Math.sin(a) * 0.55, 1.85, Math.cos(a) * 0.15);
      part(s, dark, 0.08, 0.4 + (i % 2) * 0.2, 0.08, 0, 0.2, 0, false);
      const h = group(s, 0, 0.5 + (i % 2) * 0.2, 0);
      part(h, mask, 0.24, 0.28, 0.22, 0, 0, 0);
      part(h, dark, 0.1, 0.06, 0.02, 0, -0.06, 0.12, false);
      this.heads.push(h);
    }
    this.armL = group(this.body, 0.65, 1.6, 0); this.armR = group(this.body, -0.65, 1.6, 0);
    for (const a of [this.armL, this.armR]) { part(a, dark, 0.14, 0.7, 0.14, 0, -0.35, 0); part(a, mask, 0.06, 0.5, 0.06, 0, -0.9, 0.05); }
  }
  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    if (name === 'spiral') {
      this.telegraphTime = 0.8 * this.pace;
      fx.spawnRing(this.position, 0x9ad8ff, 3.5, this.telegraphTime);
      return;
    }
    if (name === 'nailrain') {
      this.telegraphTime = 1.1 * this.pace;
      this.lines = [];
      const p = player.position.clone().setY(0);
      const base = Math.random() * Math.PI;
      for (let i = 0; i < 3 + Math.min(2, this.tier); i++) {
        const a = base + i * (Math.PI / (3 + Math.min(2, this.tier)));
        const dir = V3(Math.cos(a), 0, Math.sin(a));
        const start = p.clone().addScaledVector(dir, -11);
        this.lines.push({ start, dir });
        fx.spawnLine(start, dir, 22, 1.3, this.telegraphTime);
      }
      return;
    }
    super.setupAttack(name, player, toPlayer);
  }
  doAttack(player, toPlayer, dist) {
    if (this.attack === 'spiral') { this.state = 'spiraling'; this.stateTime = 0; this.spinAngle = Math.random() * 6.28; this.spiralClock = 0; return; }
    if (this.attack === 'nailrain') {
      for (const l of this.lines) {
        for (const h of this.world.teamOf(player)) {
          if (h.dead) continue;
          const v = h.position.clone().sub(l.start).setY(0), along = v.dot(l.dir);
          if (along > 0 && along < 22 && v.addScaledVector(l.dir, -along).length() < 0.75 + h.radius) h.takeDamage(20 * this.dmgMult, this);
        }
        for (let s = 0; s <= 22; s += 2.5) this.world.effects.spawnSparks(l.start.clone().addScaledVector(l.dir, s).setY(0.3), 0xe0e8ff, 2, 5);
      }
      this.world.shake(0.4); this.world.sfx('slash', 3);
      this.recover(0.8);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }
  update(dt, player) {
    if (this.state === 'spiraling' && !this.dead) {
      this.spiralClock -= dt;
      this.spinAngle += dt * 1.9;
      if (this.spiralClock <= 0) {
        this.spiralClock = 0.13;
        for (let k = 0; k < 3; k++) {
          const a = this.spinAngle + k * (Math.PI * 2 / 3);
          this.world.projectiles.fire(this.position.clone().setY(1.6), V3(Math.cos(a), 0, Math.sin(a)), 6.5, 9 * this.dmgMult, 0xc8d0e0, 1.0, this);
        }
      }
      if (this.stateTime > 2.6 + 0.3 * this.tier) this.recover(0.9);
    }
    super.update(dt, player);
  }
  pose(dt, t) {
    const glow = super.pose(dt, t);
    const singing = this.state === 'spiraling' || this.state === 'telegraph';
    this.heads.forEach((h, i) => { h.rotation.x = singing ? -0.5 + Math.sin(t * 14 + i) * 0.2 : Math.sin(t * 2 + i) * 0.15; });
    if (this.state === 'spiraling') this.body.rotation.y = (t * 3) % (Math.PI * 2);
    this.core.scale.setScalar(singing ? 1.4 + Math.sin(t * 20) * 0.2 : 1);
    return glow;
  }
}

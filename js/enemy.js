// enemy.js
// The Grindchoir: a machine cult of scrap-built drones with bone-white masks and
// acid-green visors. This file defines every regular enemy type, how they look,
// and how they behave. (Bosses live in boss.js, waves in waves.js.)
import * as THREE from 'three';
import { affixDamage } from './affixes.js?v=1.33.0';
import { buildEnemyModel, coreMat, GLOW } from './enemy-models.js?v=1.33.0';
import { sound } from './audio.js?v=1.33.0';

// Every enemy type. Numbers here are for wave 1; waves.js multiplies them as waves climb.
//   ai: 'melee'  = walk up, raise fists, swing
//       'lunge'  = crouch, then leap at you
//       'ranged' = keep distance and spit dodgeable molten bolts
// Names used on the game over screen / share text ("died to an elite Ripper Hound")
const DISPLAY_NAMES = { acolyte: 'Acolyte', hound: 'Ripper Hound', spitter: 'Slag Spitter', bulwark: 'Bulwark', splitter: 'Hive Splitter', mite: 'Mite',
  thurible: 'Thurible Monk', lancer: 'Cantor Lancer', mender: 'Oil Mender', grub: 'Gravel Grub', bomber: 'Hymn Bomber' };
// Phase 5C visuals: metal tint per type, gait personality, anchor heights (model units), gameplay LOD
const METAL = { acolyte: 0x6a625a, bulwark: 0x5a5c60, lancer: 0x707684, spitter: 0x5e6248, hound: 0x666058, mite: 0x6a6458,
  splitter: 0x6a5e48, thurible: 0x5e5258, mender: 0x56645a, grub: 0x6e6658, bomber: 0x625a52 };
//   f = stride speed, stride/arm = swing, bob/sway/twist = body motion, lean = resting forward hunch, step = footfall cue
const GAIT = {
  acolyte: { f: 12, stride: 0.75, arm: 0.7, bob: 0.06, sway: 0.05, twist: 0.12, lean: 0.12 },
  bulwark: { f: 6.5, stride: 0.45, arm: 0.3, bob: 0.09, sway: 0.09, twist: 0.06, lean: 0.04, step: 'stomp' },
  lancer: { f: 9, stride: 0.55, arm: 0.25, bob: 0.03, sway: 0.02, twist: 0.05, lean: 0.0 },
  spitter: { f: 8, stride: 0.5, arm: 0.35, bob: 0.05, sway: 0.04, twist: 0.04, lean: 0.06 },
  splitter: { f: 8, stride: 0.55, arm: 0.45, bob: 0.07, sway: 0.08, twist: 0.05, lean: 0.1 },
  thurible: { f: 7, stride: 0.42, arm: 0.2, bob: 0.05, sway: 0.06, twist: 0.0, lean: 0.06 },
  mender: { f: 9, stride: 0.55, arm: 0.3, bob: 0.04, sway: 0.03, twist: 0.04, lean: 0.14 },
  bomber: { f: 17, stride: 0.95, arm: 0.3, bob: 0.08, sway: 0.03, twist: 0.1, lean: 0.3 },
  hound: { f: 17 }, mite: { f: 24 }, grub: { f: 9 },
};
for (const g of Object.values(GAIT)) for (const k of ['stride', 'arm', 'bob', 'sway', 'twist', 'lean']) g[k] ??= 0;
const ANCHOR = { acolyte: 1.35, bulwark: 1.4, lancer: 1.4, spitter: 1.45, hound: 0.8, mite: 0.6, splitter: 1.35, thurible: 1.4, mender: 1.4, grub: 0.5, bomber: 1.2 };
export const TOP = { acolyte: 2.3, bulwark: 2.2, lancer: 2.4, spitter: 2.0, hound: 1.3, mite: 1.0, splitter: 2.2, thurible: 2.4, mender: 2.6, grub: 0.95, bomber: 2.2 };
// readability: subtle self-light + lifted palette for the darkest bodies (acolyte, spitter) so they don't sink into the floor
const RIM = { acolyte: 0x2a1408, spitter: 0x1c2008, lancer: 0x0c0c16 };
const LIFT = { acolyte: 1.3, spitter: 1.3 };
const tint = (hex, k) => k === 1 ? hex : new THREE.Color(hex).multiplyScalar(k).getHex();
const HEAVY = new Set(['bulwark', 'thurible']);
const LOD = { mode: 'auto', on: true, t: -1 }; // auto: crowd LOD above 8 live enemies (light enemies stop casting shadows)
export function setEnemyLOD(mode) { LOD.mode = mode; LOD.t = -1; }
const HVT_GEO = new THREE.OctahedronGeometry(0.22); HVT_GEO.userData.cached = true;

export const ENEMY_TYPES = {
  acolyte:  { hp: 30,  speed: 3.4, damage: 8,  scale: 1.0,  windup: 0.45, reach: 1.5, armored: false, points: 10, ai: 'melee',  main: 0x8a3b1e, dark: 0x3a3430 },
  hound:    { hp: 22,  speed: 5.4, damage: 9,  scale: 0.9,  windup: 0.45, reach: 5.5, armored: false, points: 15, ai: 'lunge',  main: 0xa4521f, dark: 0x2e2a27 },
  spitter:  { hp: 26,  speed: 2.8, damage: 9,  scale: 0.95, windup: 0.6,  reach: 10,  armored: false, points: 20, ai: 'ranged', main: 0x5f6b2a, dark: 0x2c2a22 },
  bulwark:  { hp: 100, speed: 2.4, damage: 16, scale: 1.45, windup: 0.75, reach: 2.0, armored: true,  points: 40, ai: 'melee',  main: 0x5a2a16, dark: 0x24201d },
  splitter: { hp: 40,  speed: 3.0, damage: 8,  scale: 1.1,  windup: 0.5,  reach: 1.6, armored: false, points: 20, ai: 'melee',  main: 0x9b6a1c, dark: 0x33291c, splits: 3 },
  mite:     { hp: 8,   speed: 5.2, damage: 4,  scale: 0.5,  windup: 0.3,  reach: 1.1, armored: false, points: 3,  ai: 'melee',  main: 0xc08a2a, dark: 0x33291c },
  // ---- COREBURNZ: later-stage Grindchoir (waves.js Z_UNLOCKS) ----
  // THURIBLE MONK: a slow brute swinging a burning censer round itself on a chain (a moving ring of danger)
  thurible: { hp: 70,  speed: 2.6, damage: 10, scale: 1.1,  windup: 0.5,  reach: 1.6, armored: false, points: 30, ai: 'melee',  main: 0x6a3a5a, dark: 0x2a2026, censer: 2.3 },
  // CANTOR LANCER: keeps its distance, paints a red line at you, then fires a fast lance down it
  lancer:   { hp: 34,  speed: 2.6, damage: 16, scale: 1.0,  windup: 1.0,  reach: 14,  armored: false, points: 30, ai: 'sniper', main: 0x4a4a5e, dark: 0x1e1e26 },
  // OIL MENDER: stays back and pulses green oil that heals the choir around it (kill it first)
  mender:   { hp: 45,  speed: 3.0, damage: 0,  scale: 1.0,  windup: 0.6,  reach: 6,   armored: false, points: 35, ai: 'mender', main: 0x3a5a3a, dark: 0x1e2a1e, heal: 0.15 },
  // GRAVEL GRUB: tunnels under the floor (can't be hit), erupts under you after a warning, then sits exposed
  grub:     { hp: 55,  speed: 4.4, damage: 18, scale: 0.9,  windup: 0.75, reach: 1.9, armored: false, points: 30, ai: 'burrow', main: 0x8a7a5a, dark: 0x3a3226 },
  // HYMN BOMBER: sprints at you and lights its fuse; kill it early and it blows up its own side instead
  bomber:   { hp: 26,  speed: 5.6, damage: 26, scale: 0.85, windup: 0.9,  reach: 2.6, armored: false, points: 25, ai: 'bomber', main: 0x7a3a1a, dark: 0x2a1a12 },
};
const Z_AI = new Set(['sniper', 'mender', 'burrow', 'bomber']);

export class Enemy {
  // stats = { hpMult, dmgMult, speedMult, elite } from waves.js
  constructor(scene, typeName, position, stats, world) {
    const type = ENEMY_TYPES[typeName];
    this.scene = scene;
    this.world = world;
    this.type = type;
    this.typeName = typeName;
    this.elite = !!stats.elite;
    const eliteHp = this.elite ? 2.2 : 1, eliteDmg = this.elite ? 1.35 : 1;
    this.maxHp = type.hp * stats.hpMult * eliteHp;
    this.hp = this.maxHp;
    this.speed = type.speed * stats.speedMult * (0.9 + Math.random() * 0.2);
    this.damage = type.damage * stats.dmgMult * eliteDmg;
    this.scale = type.scale * (this.elite ? 1.3 : 1);
    this.radius = 0.5 * this.scale;
    this.points = type.points * (this.elite ? 3 : 1);
    this.position = position.clone();
    this.knockback = new THREE.Vector3();
    this.lungeDir = new THREE.Vector3();
    this.facing = 0;
    this.state = 'spawn'; // 'spawn' | 'chase' | 'windup' | 'lunge' | 'recover' | 'dead'
    this.stateTime = 0;
    this.attackCooldown = 0.6 + Math.random() * 0.8;
    this.flashTimer = 0;
    this.stun = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.walkPhase = Math.random() * 10;
    this.dead = false;
    this.remove = false; // the wave manager deletes us when this becomes true
    this.isBoss = false;

    this.buildModel();
  }

  // Can the player hit this enemy right now?
  get canBeHit() { return !this.dead && this.state !== 'spawn' && this.state !== 'burrowed'; }
  get hidden() { return this.state === 'burrowed'; }

  buildModel() {
    // Each enemy gets its own (4) Lambert materials so it can flash white on its own; geometry is
    // merged + cached per type in enemy-models.js and every glow material is shared.
    // ONE flashable Lambert material per enemy: armour colours are baked into vertex colours (enemy-models.js)
    const lift = LIFT[this.typeName] || 1; // dark-palette types are lifted a touch so they read on every arena floor
    const palette = { main: tint(this.type.main, lift), dark: tint(this.type.dark, lift), metal: METAL[this.typeName] ?? 0x666058, mask: 0xd8cfb8 };
    this.baseEmissive = RIM[this.typeName] || 0;
    this.mats = { lit: new THREE.MeshLambertMaterial({ vertexColors: true, emissive: this.baseEmissive }) };
    const m = buildEnemyModel(this.typeName, this.elite, this.mats.lit, palette, coreMat(this.typeName));
    this.root = m.root; this.body = m.body; this.rig = m.groups; this.detail = m.detail; this.caster = m.caster;
    const g = m.groups, P = m.pieces;
    this.legL = g.legL; this.legR = g.legR; this.armL = g.armL; this.armR = g.armR; this.head = g.head;
    if (g.leg0) this.legs = [g.leg0, g.leg1, g.leg2, g.leg3];
    this.charge = P.charge; this.chamber = P.chamber; this.halo = P.halo;
    if (this.charge) this.charge.scale.setScalar(0.01);
    if (this.typeName === 'thurible') {
      // the censer swings at the REAL hit radius (elites reach 15% further, see censerUpdate)
      this.orbit = new THREE.Group(); this.root.add(this.orbit);
      const r = this.type.censer * (this.elite ? 1.15 : 1) / this.scale;
      g.chain.position.set(0, 1.25, 0.3); g.chain.scale.set(1, 1, r - 0.6); g.chain.rotation.x = 0.06; this.orbit.add(g.chain);
      g.cage.position.set(0, 1.05, r); this.orbit.add(g.cage);
      this.ball = P.censer; this.ball.position.set(0, 1.05, r); this.orbit.add(this.ball);
    }
    if (P.pods) {
      this.pods = [[0.15, 1.52, -0.5], [-0.15, 1.46, -0.52], [0.02, 1.22, -0.54]].map(([x, y, z], i) => {
        const pm = i ? new THREE.Mesh(P.pods.geometry, P.pods.material) : P.pods; pm.position.set(x, y, z); this.body.add(pm); return pm;
      });
    }
    if (P.bomb) {
      this.bomb = P.bomb; this.fuse = P.fuse;
      this.lamps = [[0.24, 1.62, 0.3], [-0.24, 1.62, 0.3]].map(([x, y, z], i) => {
        const lm = i ? new THREE.Mesh(P.lamps.geometry, P.lamps.material) : P.lamps; lm.position.set(x, y, z); this.body.add(lm); return lm;
      });
    }
    this.topY = TOP[this.typeName] ?? 2.2;
    this.root.scale.setScalar(this.scale);
    this.root.position.set(this.position.x, -2.5, this.position.z); // start underground
    this.scene.add(this.root);
  }

  // Called by the player's attacks
  hit(damage, knockX, knockZ, heavy) {
    if (!this.canBeHit) return;
    if (this.affixMask) damage = affixDamage(this, damage); // CoreBurnZ: shield bubble / ward aura
    else if (this.wardMult) damage *= this.wardMult;
    this.hp -= damage;
    this.flashTimer = 0.1;
    this.hitDir = Math.atan2(knockX, knockZ); // Phase 5C: visual recoil direction only
    const resist = this.type.armored ? 0.4 : (this.elite ? 0.7 : 1);
    this.knockback.x += knockX * resist;
    this.knockback.z += knockZ * resist;
    // Light hits interrupt most enemies; armoured ones only flinch from heavy hits
    if (!this.type.armored || heavy) {
      this.stun = Math.max(this.stun, 0.3); // (keeps a longer stun from a charge or slam)
      if (this.state === 'windup') { this.state = 'chase'; this.stateTime = 0; }
    }
    if (this.hp <= 0) this.die();
  }

  // e.g. "an elite Bulwark" or "a Slag Spitter"
  get killerName() {
    const name = DISPLAY_NAMES[this.typeName] || 'Grindchoir drone';
    if (this.elite) return `an elite ${name}`;
    return (/^[AEIOU]/.test(name) ? 'an ' : 'a ') + name;
  }

  die() {
    if (this.dead) return;
    if (this.type.ai === 'bomber' && !this.exploded) this.blowUp(false);
    this.dead = true;
    this.state = 'dead';
    this.stateTime = 0;
    this.world.onEnemyKilled(this);
  }

  update(dt, player, others) {
    // CoreBurnZ slows (Iskra's Tar Mines, Orin's Gravity Well on bosses)
    if (this.slowT > 0) { this.slowT -= dt; if (!this.slowBase) { this.slowBase = this.speed; this.speed *= this.slowMul || 0.6; } }
    else if (this.slowBase) { this.speed = this.slowBase; this.slowBase = 0; }
    this.stateTime += dt;
    this.flashTimer -= dt;
    this.stun -= dt;
    this.attackCooldown -= dt;

    if (this.state === 'dead') { this.animateDeath(); return; }

    if (this.state === 'spawn') {
      // rise out of the floor
      const t = Math.min(1, this.stateTime / 0.6);
      this.root.position.y = -2.5 * (1 - t);
      if (t >= 1) { this.state = 'chase'; this.stateTime = 0; }
      return;
    }

    // knockback slides us backwards and slows down
    this.position.addScaledVector(this.knockback, dt);
    this.knockback.multiplyScalar(Math.exp(-7 * dt));

    const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > 0.001) toPlayer.divideScalar(dist);

    // turn to face the player (slower while winding up, so you can dodge round them)
    if (!player.dead && this.stun <= 0 && this.state !== 'lunge') {
      const target = Math.atan2(toPlayer.x, toPlayer.z);
      const diff = Math.atan2(Math.sin(target - this.facing), Math.cos(target - this.facing));
      this.facing += diff * Math.min(1, dt * (this.state === 'windup' ? 3 : 10));
    }

    // v1.33: walk round barrels/rocks instead of grinding into them (facing above still uses the true direction)
    const nav = this.nav || (this.nav = { side: 0, t: 0, ck: 0, lx: this.position.x, lz: this.position.z });
    if (dist > 1.6 && !this.isBoss && this.state !== 'lunge') {
      this.world.arena.steer(this.position, toPlayer, this.radius, dist, nav);
      if ((nav.ck += dt) > 0.7) { // no progress for 0.7 s while steering: try the other side
        if (nav.side && Math.hypot(this.position.x - nav.lx, this.position.z - nav.lz) < 0.35 * this.speed) nav.side = -nav.side;
        nav.ck = 0; nav.lx = this.position.x; nav.lz = this.position.z;
      }
    }
    // PHASE 4 HIGH-VALUE TARGET: keeps its distance (runs when you close in), with short sprints to reposition
    if (this.hvt && !player.dead) {
      this.hvtT = (this.hvtT || 0) + dt;
      const burst = this.hvtT % 4 < 0.8; // a sprint every 4 s
      if (dist < 6.5 || burst) { toPlayer.negate(); if (burst) this.position.addScaledVector(toPlayer, this.speed * 0.6 * dt); }
    }
    let moving = false;
    const ai = this.type.ai;
    if (Z_AI.has(ai)) moving = this.zUpdate(dt, player, dist, toPlayer);
    else switch (this.state) {
      case 'chase':
        if (player.dead || this.stun > 0) break;
        if (ai === 'ranged') {
          // keep a comfortable distance and circle around
          if (dist > 8) this.position.addScaledVector(toPlayer, this.speed * dt);
          else if (dist < 5) this.position.addScaledVector(toPlayer, -this.speed * dt);
          else this.position.add(new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.strafe * this.speed * 0.5 * dt));
          moving = true;
          if (this.attackCooldown <= 0 && dist < this.type.reach) { this.state = 'windup'; this.stateTime = 0; }
        } else if (dist > this.type.reach * 0.85 || (ai === 'lunge' && this.attackCooldown > 0)) {
          if (!(ai === 'lunge' && dist < 1.4)) {
            this.position.addScaledVector(toPlayer, this.speed * dt);
            moving = true;
          }
        } else if (this.attackCooldown <= 0) {
          this.state = 'windup';
          this.stateTime = 0;
        }
        break;

      case 'windup':
        if (this.stateTime >= this.type.windup) this.attack(player, dist, toPlayer);
        break;

      case 'lunge':
        // hound leaping through the air
        this.position.addScaledVector(this.lungeDir, 15 * dt);
        if (!this.lungeHit && this.position.distanceTo(player.position) < this.radius + player.radius + 0.35) {
          this.lungeHit = true;
          player.takeDamage(this.damage, this);
        }
        if (this.stateTime > 0.32) { this.state = 'recover'; this.stateTime = 0; }
        break;

      case 'recover':
        if (this.stateTime > (ai === 'lunge' ? 0.7 : 0.45)) { this.state = 'chase'; this.stateTime = 0; }
        break;
    }

    if (this.type.censer && !player.dead) this.censerUpdate(dt);

    // Don't stand inside other enemies: gently push apart
    for (const o of others) {
      if (o === this || o.dead || o.state === 'spawn' || o.hidden) continue;
      const dx = this.position.x - o.position.x, dz = this.position.z - o.position.z;
      const d = Math.hypot(dx, dz);
      const min = this.radius + o.radius;
      if (d < min && d > 0.0001) {
        const push = ((min - d) / d) * (o.isBoss ? 1 : 0.5); // bosses shove us all the way out
        this.position.x += dx * push;
        this.position.z += dz * push;
      }
    }
    // ...and don't stand inside the player either
    const pd = this.position.distanceTo(player.position);
    if (!player.dead && pd < this.radius + player.radius && this.state !== 'lunge' && this.state !== 'burrowed') {
      this.position.addScaledVector(toPlayer, -(this.radius + player.radius - pd));
    }
    this.world.arena.resolve(this.position, this.radius);

    this.animate(dt, moving);
  }

  // ---------- COREBURNZ enemies ----------
  heroes() { return (this.world.heroes || [this.world.player]).filter((h) => h && !h.dead); }
  zUpdate(dt, player, dist, toPlayer) {
    const ai = this.type.ai, fx = this.world.effects;
    let moving = false;
    if (this.stun > 0 && this.state !== 'burrowed') return false;
    if (ai === 'sniper') {
      if (this.state === 'chase') {
        if (dist > 11) { this.position.addScaledVector(toPlayer, this.speed * dt); moving = true; }
        else if (dist < 7) { this.position.addScaledVector(toPlayer, -this.speed * dt); moving = true; }
        else { this.position.add(new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(this.strafe * this.speed * 0.5 * dt)); moving = true; }
        if (this.attackCooldown <= 0 && dist < this.type.reach && !player.dead) {
          this.state = 'windup'; this.stateTime = 0;
          this.aim = toPlayer.clone();
          fx.spawnLine(this.position.clone().setY(0), this.aim, 16, 0.7, this.type.windup);
        }
      } else if (this.state === 'windup') {
        this.facing = Math.atan2(this.aim.x, this.aim.z); // locked on the painted line
        if (this.stateTime >= this.type.windup) {
          this.world.projectiles.fire(this.position.clone().setY(1.5 * this.scale), this.aim, 24, this.damage, 0xff3a3a, this.elite ? 1.3 : 1, this);
          this.world.sfx('shot');
          this.state = 'recover'; this.stateTime = 0; this.attackCooldown = 2.6 + Math.random();
        }
      } else if (this.state === 'recover' && this.stateTime > 0.6) { this.state = 'chase'; this.stateTime = 0; }
    } else if (ai === 'mender') {
      this.healCd = (this.healCd ?? 2) - dt;
      if (this.state === 'chase') {
        if (dist < 8) { this.position.addScaledVector(toPlayer, -this.speed * dt); moving = true; } // keep away
        else if (dist > 12) { this.position.addScaledVector(toPlayer, this.speed * 0.6 * dt); moving = true; }
        if (this.healCd <= 0) { this.state = 'windup'; this.stateTime = 0; fx.spawnRing(this.position, 0x6aff7a, 1.2, this.type.windup); }
      } else if (this.state === 'windup' && this.stateTime >= this.type.windup) {
        let healed = 0;
        for (const o of this.world.enemies.list) {
          if (o === this || o.dead || o.isBoss || o.position.distanceTo(this.position) > 6) continue;
          if (o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * this.type.heal); healed++; fx.spawnSparks(o.position.clone().setY(1.4), 0x6aff7a, 4, 3); }
        }
        fx.spawnRing(this.position, 0x6aff7a, 6, 0.5);
        if (healed) this.world.sfx('powerup');
        this.healCd = 3.5; this.state = 'recover'; this.stateTime = 0;
      } else if (this.state === 'recover' && this.stateTime > 0.5) { this.state = 'chase'; this.stateTime = 0; }
    } else if (ai === 'burrow') {
      if (this.state === 'chase') { this.state = 'burrowed'; this.stateTime = 0; fx.spawnSparks(this.position.clone().setY(0.3), 0xb0a48a, 8, 5); }
      else if (this.state === 'burrowed') {
        if (!player.dead) { this.position.addScaledVector(toPlayer, this.speed * 1.15 * dt); moving = true; }
        this.dust = (this.dust || 0) - dt;
        if (this.dust <= 0) { this.dust = 0.25; fx.spawnSparks(this.position.clone().setY(0.15), 0x8a7a5a, 3, 3); }
        if ((dist < 1.3 || this.stateTime > 7) && !player.dead && this.stateTime > 0.8) {
          this.state = 'windup'; this.stateTime = 0;
          fx.spawnWarning(this.position.clone().setY(0), this.type.reach, this.type.windup);
        }
      } else if (this.state === 'windup' && this.stateTime >= this.type.windup) {
        for (const h of this.heroes()) if (h.position.distanceTo(this.position) < this.type.reach + h.radius) h.takeDamage(this.damage, this);
        fx.spawnRing(this.position, 0xb0a48a, this.type.reach + 0.4, 0.4);
        fx.spawnSparks(this.position.clone().setY(0.6), 0xc8bea8, 10, 7);
        this.world.shake(0.25); this.world.sfx('enemyDeath');
        this.state = 'recover'; this.stateTime = 0;
      } else if (this.state === 'recover' && this.stateTime > 1.8) { this.state = 'burrowed'; this.stateTime = 0; }
    } else if (ai === 'bomber') {
      if (this.state === 'chase') {
        if (!player.dead) { this.position.addScaledVector(toPlayer, this.speed * dt); moving = true; }
        if (dist < 1.9 && !player.dead) {
          this.state = 'windup'; this.stateTime = 0;
          fx.spawnWarning(this.position.clone().setY(0), this.type.reach, this.type.windup);
          this.world.sfx('zap');
        }
      } else if (this.state === 'windup' && this.stateTime >= this.type.windup) {
        this.blowUp(true);
      }
    }
    return moving;
  }
  // THURIBLE MONK: the censer swings round; touching it burns
  censerUpdate(dt) {
    this.censerCd = (this.censerCd || 0) - dt;
    if (this.censerCd > 0 || this.stun > 0) return;
    const a = this.censerAngle, r = this.type.censer * (this.elite ? 1.15 : 1);
    const bx = this.position.x + Math.sin(a) * r, bz = this.position.z + Math.cos(a) * r;
    for (const h of this.heroes()) {
      if (Math.hypot(h.position.x - bx, h.position.z - bz) < 0.75 + h.radius) {
        if (h.takeDamage(this.damage * 0.8, this)) this.world.effects.spawnSparks(new THREE.Vector3(bx, 1, bz), 0xff9a2a, 6);
        this.censerCd = 0.8;
      }
    }
  }
  get censerAngle() { return performance.now() / 1000 * 3.2 + (this.walkPhase0 || 0); }
  // HYMN BOMBER: self = it reached you (hurts heroes); killed early = it hurts the choir around it
  blowUp(self) {
    if (this.exploded) return;
    this.exploded = true;
    const R = this.type.reach * (this.elite ? 1.2 : 1), fx = this.world.effects;
    if (self) for (const h of this.heroes()) if (h.position.distanceTo(this.position) < R + h.radius) h.takeDamage(this.damage, this);
    for (const o of this.world.enemies.list) {
      if (o === this || o.dead || !o.canBeHit || o.position.distanceTo(this.position) > R + o.radius) continue;
      o.hit((self ? 0.25 : 0.6) * this.damage * 3, 0, 0, true);
    }
    fx.spawnRing(this.position, 0xffb020, R + 0.5, 0.45);
    fx.spawnSparks(this.position.clone().setY(1), 0xffd040, 14, 9);
    this.world.shake(0.35); this.world.sfx('enemyDeath');
    if (self) { this.points = 0; this.selfDestruct = true; this.hp = 0; this.die(); }
  }

  // The moment the wind-up finishes
  attack(player, dist, toPlayer) {
    const ai = this.type.ai;
    if (ai === 'lunge') {
      this.state = 'lunge';
      this.lungeDir.copy(toPlayer);
      this.lungeHit = false;
      this.attackCooldown = 1.8 + Math.random() * 0.8;
    } else if (ai === 'ranged') {
      // spit a slow molten bolt: blink through it or step aside
      const from = this.position.clone().setY(1.6 * this.scale);
      this.world.projectiles.fire(from, toPlayer, 8.5, this.damage, 0xff8a1e, this.elite ? 1.4 : 1, this);
      this.world.sfx('shot');
      this.state = 'recover';
      this.attackCooldown = 2.0 + Math.random() * 0.8;
    } else {
      // melee swing: hits if the player is still close and in front of us
      const forward = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      if (dist < this.type.reach * (this.elite ? 1.2 : 1) + 0.6 && forward.dot(toPlayer) > 0.3) {
        if (player.takeDamage(this.damage, this)) {
          this.world.effects.spawnSparks(player.position.clone().setY(1.2), 0xff3030, 6);
        }
      }
      this.state = 'recover';
      this.attackCooldown = 1.0 + Math.random() * 0.6;
    }
    this.stateTime = 0;
  }

  // ---------- Phase 5C animation (visual only: reads state/stateTime, never changes them) ----------
  // Melee damage lands on the windup -> recover transition, so every swing peaks at the end of the
  // windup and the strike/follow-through plays in the first ~0.12 s of 'recover'.
  animate(dt, moving) {
    const T = this.typeName, ai = this.type.ai, st = this.state, B = this.body;
    const gait = GAIT[T] || GAIT.acolyte;
    this.walkPhase += dt * (moving ? gait.f : 0);
    this.idleT = (this.idleT || 0) + dt;
    const ph = this.walkPhase, s = moving ? Math.sin(ph) : 0, c = moving ? Math.cos(ph) : 1;
    const wt = st === 'windup' ? Math.min(1, this.stateTime / this.type.windup) : 0;
    const rt = st === 'recover' ? this.stateTime : -1;
    const strike = rt >= 0 ? Math.min(1, rt / 0.12) : 0;            // 0 -> 1 during the follow-through
    const settle = rt >= 0 ? Math.max(0, 1 - (rt - 0.12) / 0.33) : 0; // then eases back
    const br = Math.sin(this.idleT * (this.elite ? 2.6 : 2.1)) * 0.5 + 0.5; // idle breathing
    B.position.set(0, 0, 0); B.rotation.set(gait.lean + (this.elite ? 0.05 : 0), 0, 0);
    this.lodTick();

    // hit reaction: short directional recoil (light enemies), a stiff jolt + sparks for armour
    if (this.flashTimer > 0 && !this._flashSeen) { this._flashSeen = true; this.recoilT = 0.18; this.onHitVisual(); }
    if (this.flashTimer <= 0) this._flashSeen = false;
    const rc = this.recoilT > 0 ? (this.recoilT -= dt) / 0.18 : 0;

    if (this.legs) this.animQuad(dt, moving, s, c, wt, st, br);
    else if (T === 'grub') this.animGrub(dt, moving, ph, wt, strike, settle, st, br);
    else this.animHumanoid(dt, moving, s, c, wt, strike, settle, st, br, gait);

    if (rc > 0) {
      const rel = (this.hitDir ?? this.facing + Math.PI) - this.facing, k = (this.type.armored ? 0.35 : 1) * Math.sin(rc * Math.PI);
      B.rotation.x += 0.28 * k * Math.cos(rel); B.rotation.z -= 0.2 * k * Math.sin(rel);
      if (this.head) this.head.rotation.x -= 0.3 * k;
    }
    if (this.stun > 0 && !this.type.armored) { B.rotation.x -= 0.18; B.rotation.z += Math.sin(this.idleT * 40) * 0.05; } // a real stagger

    // COREBURNZ extras
    if (this.orbit) { this.orbit.rotation.y = this.censerAngle - this.facing; this.ball.rotation.y += dt * 4; }
    if (this.halo) { this.halo.rotation.z += dt * (st === 'windup' ? 9 : 2.5); this.halo.scale.setScalar(1 + (st === 'windup' ? 0.5 * wt : 0.05 * br)); }
    if (this.pods) this.pods.forEach((p, i) => p.scale.setScalar(1 + 0.15 * Math.sin(this.idleT * 5 + i * 2)));
    if (this.bomb) {
      const lit = st === 'windup', f = lit ? 10 + 40 * wt : 3;
      this.bomb.scale.setScalar(lit ? 1 + 0.12 * wt + 0.22 * Math.abs(Math.sin(this.stateTime * f)) : 1 + 0.04 * br);
      this.bomb.rotation.y += dt * (lit ? 12 : 1.5);
      const blink = Math.sin(this.idleT * f) > 0;
      this.lamps[0].visible = blink; this.lamps[1].visible = !blink || lit && wt > 0.6;
      this.fuse.visible = !lit || Math.sin(this.stateTime * 30) > 0;
      if (lit) { B.position.x += Math.sin(this.idleT * 60) * 0.03 * wt; this.cue('fuse', 0.16 - 0.1 * wt); }
    }
    if (this.charge) { // Lancer's charge glow builds through the whole aim (fires at the end of the windup)
      const k = ai === 'sniper' && st === 'windup' ? 0.3 + 1.4 * wt * wt + (wt > 0.85 ? 0.3 * Math.sin(this.idleT * 50) : 0) : rt >= 0 && rt < 0.1 ? 1.6 * (1 - rt / 0.1) : 0.01;
      this.charge.scale.setScalar(Math.max(0.01, k));
      if (st === 'windup' && this.stateTime < 0.05) this.cue('charge', 0.5);
    }
    if (this.chamber) { // Spitter's throat chamber swells, then empties when the bolt leaves
      const k = st === 'windup' ? 1 + 1.3 * wt : rt >= 0 ? 0.5 + 0.5 * Math.min(1, rt / 0.4) : 1 + 0.1 * br; // empties at the shot
      this.chamber.scale.setScalar(k);
      if (st === 'windup' && this.stateTime < 0.05) this.cue('spitCharge', 0.4);
    }
    if (this.hvt) this.hvtMarker(dt); else if (this.hvtM) this.hvtM.visible = false;

    // white flash when hit, red glow while winding up an attack
    let emissive = this.hvt ? (Math.sin(this.stateTime * 8) > 0 ? 0x664400 : 0x332200) : this.elite ? 0x2a1500 : this.world.blackout ? 0x3a0e04 : 0x000000; // blackout: enemies glow
    if (this.flashTimer > 0) emissive = 0xffffff;
    else if (this.state === 'windup') emissive = 0x661100;
    this.setEmissive(emissive);

    this.root.position.set(this.position.x, this.typeName === 'grub' ? (this.state === 'burrowed' ? -1.1 : this.state === 'windup' ? -0.8 + 0.3 * Math.min(1, this.stateTime / this.type.windup) : 0) : 0, this.position.z);
    this.root.rotation.y = this.facing;
  }

  animHumanoid(dt, moving, s, c, wt, strike, settle, st, br, gait) {
    const B = this.body, ai = this.type.ai, T = this.typeName;
    const A = gait.stride;
    this.legL.rotation.set(s * A, 0, 0); this.legR.rotation.set(-s * A, 0, 0);
    B.position.y = moving ? -Math.abs(c) * gait.bob : -0.015 * br;
    if (moving) { B.rotation.z = s * gait.sway; B.rotation.y = s * gait.twist; }
    if (moving && gait.step && Math.sign(s) !== this._lastStep) { this._lastStep = Math.sign(s); this.cue(gait.step, 0.25); }
    if (this.head) this.head.rotation.set(-gait.lean * 0.6 + 0.04 * br, moving ? 0 : Math.sin(this.idleT * 0.7) * 0.25, 0);
    let aL = moving ? -s * gait.arm : -0.1 - 0.05 * br, aR = moving ? s * gait.arm : -0.1 - 0.05 * br;
    let zL = 0.08, zR = -0.08;
    const melee = ai === 'melee';
    if (st === 'windup') {
      if (melee) {
        const up = T === 'bulwark' ? 2.9 : T === 'thurible' ? 1.4 : 2.6;
        aR = -wt * up; aL = T === 'bulwark' ? -wt * 0.6 : -wt * up * 0.75; zR = -0.08 - wt * 0.2;
        B.rotation.x -= wt * (T === 'bulwark' ? 0.32 : 0.25); B.rotation.y = -wt * (T === 'bulwark' ? 0.35 : 0.2);
        B.position.y -= wt * 0.06;
        if (wt > 0.8) B.position.x = Math.sin(this.idleT * 70) * 0.02; // tremble right before the hit
      } else if (ai === 'ranged') { aL = aR = -wt * 0.9; zL = 0.3 * wt; zR = -0.3 * wt; B.rotation.x -= wt * 0.3; if (this.head) this.head.rotation.x -= wt * 0.35; }
      else if (ai === 'sniper') { aR = -0.25 - 0.1 * wt; aL = -1.1 * wt; zL = -0.4 * wt; B.rotation.x += 0.22 * wt; B.position.y -= 0.12 * wt; this.legL.rotation.x = -0.35 * wt; this.legR.rotation.x = 0.3 * wt; } // braced
      else if (ai === 'mender') { aL = aR = -2.6 * wt; zL = 0.4 * wt; zR = -0.4 * wt; B.rotation.x -= 0.2 * wt; }
      else if (ai === 'bomber') { aL = aR = 0.6; zL = 0.5; zR = -0.5; B.rotation.x += 0.25; B.position.y -= 0.1; }
    } else if (st === 'recover') {
      if (melee) { // the strike: swing down past horizontal, then settle back
        const swing = strike < 1 ? -2.6 + 3.1 * strike : 0.5 * settle - 0.1 * (1 - settle);
        aR = T === 'bulwark' ? -2.9 + 3.3 * strike - (strike >= 1 ? 0.4 * (1 - settle) : 0) : swing; aL = T === 'bulwark' ? -0.3 : swing * 0.75;
        B.rotation.x += (strike < 1 ? 0.35 * strike : 0.35 * settle);
        B.rotation.y = (strike < 1 ? 0.25 * strike : 0.25 * settle);
        if (T === 'bulwark' && strike >= 1 && settle > 0.95) this.cue('stomp', 0.4);
      } else if (ai === 'ranged') { const k = Math.max(0, 1 - this.stateTime / 0.25); B.rotation.x += 0.3 * k; if (this.head) this.head.rotation.x += 0.4 * k; }
      else if (ai === 'sniper') { const k = Math.max(0, 1 - this.stateTime / 0.3); aR = -0.25 + 0.9 * k; B.rotation.x -= 0.25 * k; } // recoil
    }
    if (ai === 'bomber' && st === 'chase') { aL = aR = 0.7 + s * 0.3; zL = 0.25; zR = -0.25; } // arms swept back, sprinting
    if (T === 'thurible' && st !== 'windup' && st !== 'recover') { aR = -1.0 + 0.1 * Math.sin(this.idleT * 3.2); zR = -0.5; B.rotation.y = 0.15 * Math.sin(this.censerAngle); }
    this.armL.rotation.set(aL, 0, zL); this.armR.rotation.set(aR, 0, zR);
  }

  // hounds and mites: trotting gait (diagonal pairs), crouch -> airborne lunge -> skid
  animQuad(dt, moving, s, c, wt, st, br) {
    const B = this.body, L = this.legs, hound = this.typeName === 'hound';
    const A = hound ? 0.85 : 1.1;
    L[0].rotation.x = L[3].rotation.x = s * A; L[1].rotation.x = L[2].rotation.x = -s * A;
    for (const l of L) l.rotation.z = 0;
    B.position.y = moving ? Math.abs(c) * (hound ? 0.07 : 0.05) : 0.01 * br;
    B.rotation.x = moving ? 0.04 * s : 0;
    if (!hound && moving) B.rotation.z = Math.sin(this.idleT * 30) * 0.06; // mites skitter
    const H = this.head, J = this.rig.jaw, Tl = this.rig.tail;
    if (H) H.rotation.set(moving ? 0.1 * c : 0.06 * br, moving ? 0 : Math.sin(this.idleT * 1.3) * 0.35, 0); // sensor sweep when idle
    if (J) J.rotation.x = 0.1 + (moving ? 0.1 * Math.abs(s) : 0);
    if (Tl) Tl.rotation.set(-0.2, Math.sin(this.idleT * (moving ? 12 : 3)) * 0.35, 0);
    if (st === 'windup') {
      B.position.y = -0.18 * wt; B.rotation.x = -0.2 * wt;
      L[2].rotation.x = L[3].rotation.x = 0.5 * wt; L[0].rotation.x = L[1].rotation.x = -0.25 * wt;
      if (J) J.rotation.x = 0.1 + 0.5 * wt;
      if (H) H.rotation.x = -0.15 * wt;
      if (wt > 0.7) B.position.x = Math.sin(this.idleT * 60) * 0.015;
    } else if (st === 'lunge') {
      const k = Math.min(1, this.stateTime / 0.32);
      B.position.y = Math.sin(k * Math.PI) * 0.45; B.rotation.x = 0.3 - 0.5 * k;
      L[0].rotation.x = L[1].rotation.x = -1.1; L[2].rotation.x = L[3].rotation.x = 1.0;
      if (J) J.rotation.x = 0.7 * (1 - k * k);
    } else if (st === 'recover' && hound) { // skid and shake it off
      const k = Math.max(0, 1 - this.stateTime / 0.35);
      B.rotation.x = 0.15 * k; B.position.y = -0.06 * k; if (H) H.rotation.z = Math.sin(this.stateTime * 30) * 0.2 * k;
    }
  }

  // GRUB: undulating segments under the floor, nose-up eruption with claws flung open, then a snap shut
  animGrub(dt, moving, ph, wt, strike, settle, st, br) {
    const R = this.rig, B = this.body;
    const wave = moving ? ph : this.idleT * 2;
    ['seg0', 'seg1', 'seg2', 'seg3'].forEach((n, i) => { const g = R[n]; g.rotation.set(0, Math.sin(wave - i * 0.9) * (moving ? 0.22 : 0.08), 0); g.position.x = Math.sin(wave - i * 0.9) * 0.06 * i; });
    let open = 0.15 + 0.08 * br;
    if (st === 'windup') { B.rotation.x = -0.5 * wt; B.position.y = 0.1 * wt; open = 0.2 + 0.7 * wt; B.rotation.z = Math.sin(this.idleT * 50) * 0.04 * wt; }
    else if (st === 'recover') { open = strike < 1 ? 0.9 * (1 - strike) : 0.12; B.rotation.x = strike < 1 ? -0.5 + 0.7 * strike : 0.2 * settle; }
    else if (st === 'burrowed') { B.rotation.x = 0.15; open = 0.05; }
    R.jawL.rotation.y = open; R.jawR.rotation.y = -open;
  }

  // gameplay LOD: hide rivets/cables/vents in big crowds (one check per 0.25 s, shared by every enemy)
  lodTick() {
    const now = performance.now();
    if (now - LOD.t > 250 || LOD.t < 0) {
      LOD.t = now;
      LOD.on = LOD.mode === 'hi' ? true : LOD.mode === 'lo' ? false : (this.world.enemies?.list?.length ?? 0) <= 8;
    }
    if (this.detailOn !== LOD.on) { this.detailOn = LOD.on; for (const m of this.detail) m.visible = LOD.on; if (this.caster) this.caster.castShadow = LOD.on || HEAVY.has(this.typeName) || this.elite; }
  }

  // local-only (never sent over the network: visual rising edge of the hit flash on host AND clients)
  onHitVisual() {
    const fx = this.world.effects, now = this.idleT;
    if (now - (this._lastSpark || -1) < 0.12) return;
    this._lastSpark = now;
    const y = (ANCHOR[this.typeName] || 1.3) * this.scale;
    if (this.type.armored) { fx?.localSparks?.(this.position.clone().setY(y), 0xffc070, 3, 4); this.cue('clank', 0.08); }
    else if (this.elite) fx?.localSparks?.(this.position.clone().setY(y), 0xffb020, 2, 3);
  }

  // sounds that come from the model itself (local on every machine, existing sound engine + settings)
  cue(name, gap) {
    if (this.idleT - (this._cue?.[name] ?? -9) < gap) return;
    (this._cue ||= {})[name] = this.idleT;
    sound.play(name);
  }

  // Phase 4 HIGH-VALUE TARGET: keep the gold pulse, plus a bobbing gold diamond beacon over its head
  hvtMarker(dt) {
    if (!this.hvtM) { this.hvtM = new THREE.Mesh(HVT_GEO, GLOW.amber); this.root.add(this.hvtM); }
    this.hvtM.visible = !this.dead;
    this.hvtM.position.y = (TOP[this.typeName] || 2.6) + 0.35 + Math.sin(this.idleT * 4) * 0.12;
    this.hvtM.rotation.y += dt * 3;
  }

  animateDeath() {
    // mechanical collapse: knees buckle / core shuts down, topple away from the killing blow, sink
    const t = this.stateTime, T = this.typeName, B = this.body;
    this.setEmissive(t < 0.1 ? 0xffffff : 0x000000);
    if (!this._deathFx) {
      this._deathFx = true;
      const fx = this.world.effects, heavy = HEAVY.has(T) || (this.elite && T !== 'mite');
      const y = (ANCHOR[T] || 1.2) * this.scale;
      if (!this.crumble || (this.nid || 0) % 2) { // boss-death crumble waves: half the debris
        fx?.scrap?.(this.position, T === 'mite' ? 2 : heavy ? 7 : 4, [this.type.main, METAL[T] ?? 0x666058, this.type.dark], y, heavy ? 1.3 : 1);
        fx?.localSparks?.(this.position.clone().setY(y), coreMat(T).color.getHex(), heavy ? 6 : 3, heavy ? 6 : 4);
        if (heavy) fx?.localRing?.(this.position, coreMat(T).color.getHex(), 2.2 * this.scale, 0.35);
      }
      this.cue(heavy ? 'stomp' : 'scrap', 0.05);
      this.fallDir = Math.cos((this.hitDir ?? this.facing + Math.PI) - this.facing) > 0 ? 1 : -1; // forward if hit from behind
      if (this.charge) this.charge.scale.setScalar(0.01);
      if (this.chamber) this.chamber.scale.setScalar(0.4);
      if (this.bomb) this.bomb.scale.setScalar(0.6);
      if (this.hvtM) this.hvtM.visible = false;
    }
    const k = Math.min(1, t / (HEAVY.has(T) ? 0.45 : 0.32)), e = k * k;
    if (this.legs) { // quadrupeds roll onto their side, legs splay
      B.rotation.set(0, 0, e * Math.PI / 2 * 0.9); B.position.y = -0.1 * e;
      this.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? 0.6 : -0.6) * e; });
    } else if (T === 'grub') {
      B.rotation.set(0.3 * e, 0, e * 1.2); ['seg1', 'seg2', 'seg3'].forEach((n, i) => { this.rig[n].rotation.y = e * (0.4 + i * 0.2); });
    } else {
      const buckle = Math.min(1, t / 0.15);
      B.position.y = -0.25 * buckle;
      this.legL.rotation.x = -0.9 * buckle; this.legR.rotation.x = -0.6 * buckle;
      B.rotation.set(this.fallDir * e * Math.PI / 2 * 0.95, 0, 0.15 * e);
      this.armL.rotation.set(-0.6 * e, 0, 0.5 * e); this.armR.rotation.set(-1.2 * e, 0, -0.4 * e);
      if (this.head) this.head.rotation.x = 0.5 * e;
    }
    this.root.position.y = t > 0.5 ? -(t - 0.5) * 3 : 0;
    if (t > 1.1) this.remove = true;
  }

  setEmissive(hex) {
    if (this.currentEmissive === hex) return;
    this.currentEmissive = hex;
    for (const m of Object.values(this.mats)) m.emissive.setHex(hex || this.baseEmissive);
  }

  dispose() {
    this.scene.remove(this.root);
    for (const m of Object.values(this.mats)) m.dispose();
    // affix rings/accents/tags use shared, cached geometry + materials (js/affixes.js): nothing to dispose
  }
}

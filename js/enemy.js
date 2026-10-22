// enemy.js
// The Grindchoir: a machine cult of scrap-built drones with bone-white masks and
// acid-green visors. This file defines every regular enemy type, how they look,
// and how they behave. (Bosses live in boss.js, waves in waves.js.)
import * as THREE from 'three';
import { affixDamage } from './affixes.js?v=1.32.0';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1); // shared by every enemy body part
const VISOR_MAT = new THREE.MeshBasicMaterial({ color: 0xc8ff3a });  // acid-green glow
const ELITE_VISOR_MAT = new THREE.MeshBasicMaterial({ color: 0xffb020 }); // elites glow amber
const SPIT_MAT = new THREE.MeshBasicMaterial({ color: 0xff8a1e });   // spitter's molten tank

// Every enemy type. Numbers here are for wave 1; waves.js multiplies them as waves climb.
//   ai: 'melee'  = walk up, raise fists, swing
//       'lunge'  = crouch, then leap at you
//       'ranged' = keep distance and spit dodgeable molten bolts
// Names used on the game over screen / share text ("died to an elite Ripper Hound")
const DISPLAY_NAMES = { acolyte: 'Acolyte', hound: 'Ripper Hound', spitter: 'Slag Spitter', bulwark: 'Bulwark', splitter: 'Hive Splitter', mite: 'Mite',
  thurible: 'Thurible Monk', lancer: 'Cantor Lancer', mender: 'Oil Mender', grub: 'Gravel Grub', bomber: 'Hymn Bomber' };
const GLOW = (c) => new THREE.MeshBasicMaterial({ color: c });
const CENSER_MAT = GLOW(0xff9a2a), LANCE_MAT = GLOW(0xff3a3a), MEND_MAT = GLOW(0x6aff7a), BOMB_MAT = GLOW(0xffb020);

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
    // Each enemy gets its own materials so it can flash white on its own
    this.mats = {
      main: new THREE.MeshLambertMaterial({ color: this.type.main }),
      dark: new THREE.MeshLambertMaterial({ color: this.type.dark }),
      mask: new THREE.MeshLambertMaterial({ color: 0xd8cfb8 }), // bone-white mask
    };
    const visor = this.elite ? ELITE_VISOR_MAT : VISOR_MAT;
    const { main, dark, mask } = this.mats;
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const part = (parent, mat, w, h, d, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(UNIT_BOX, mat);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      parent.add(m);
      return m;
    };
    const limb = (x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); this.body.add(g); return g; };

    if (this.typeName === 'hound') {
      // Four-legged scrap hound with a long snout
      part(this.body, main, 0.6, 0.45, 1.2, 0, 0.75, 0);
      part(this.body, dark, 0.5, 0.15, 0.9, 0, 1.02, -0.05);           // spine plates
      part(this.body, mask, 0.4, 0.35, 0.5, 0, 0.9, 0.75);             // masked head
      part(this.body, visor, 0.32, 0.06, 0.03, 0, 0.95, 1.01, false);
      part(this.body, dark, 0.06, 0.06, 0.5, 0, 1.05, -0.8).rotation.x = -0.6; // tail antenna
      this.legs = [];
      for (const [x, z] of [[0.22, 0.4], [-0.22, 0.4], [0.22, -0.4], [-0.22, -0.4]]) {
        const g = limb(x, 0.6, z);
        part(g, dark, 0.14, 0.6, 0.14, 0, -0.3, 0);
        this.legs.push(g);
      }
    } else if (this.typeName === 'grub') {
      // segmented gravel grub with a bone mask and mandibles
      this.legs = [];
      for (let i = 0; i < 4; i++) part(this.body, i % 2 ? dark : main, 0.75 - i * 0.1, 0.55 - i * 0.06, 0.45, 0, 0.42 - i * 0.03, -i * 0.42);
      part(this.body, mask, 0.6, 0.45, 0.25, 0, 0.5, 0.32);
      part(this.body, visor, 0.4, 0.06, 0.03, 0, 0.55, 0.45, false);
      for (const x of [-0.22, 0.22]) part(this.body, dark, 0.08, 0.08, 0.35, x, 0.32, 0.55).rotation.y = -x;
      for (let i = 0; i < 3; i++) part(this.body, mask, 0.16, 0.18, 0.16, (i - 1) * 0.18, 0.78, -0.4 - i * 0.2, false); // spine stones
    } else if (this.typeName === 'mite') {
      // Tiny skittering drone
      part(this.body, main, 0.8, 0.5, 0.8, 0, 0.6, 0);
      part(this.body, mask, 0.5, 0.3, 0.1, 0, 0.65, 0.42, false);
      part(this.body, visor, 0.4, 0.08, 0.03, 0, 0.67, 0.48, false);
      this.legs = [];
      for (const [x, z] of [[0.45, 0.3], [-0.45, 0.3], [0.45, -0.3], [-0.45, -0.3]]) {
        const g = limb(x, 0.5, z);
        part(g, dark, 0.12, 0.5, 0.12, 0, -0.25, 0);
        this.legs.push(g);
      }
    } else {
      // Humanoid cultists: acolyte, spitter, bulwark, splitter
      this.legL = limb(0.2, 0.8, 0);
      this.legR = limb(-0.2, 0.8, 0);
      part(this.legL, dark, 0.3, 0.8, 0.32, 0, -0.4, 0);
      part(this.legR, dark, 0.3, 0.8, 0.32, 0, -0.4, 0);
      part(this.body, main, 0.78, 0.75, 0.48, 0, 1.2, 0);           // rusty torso
      part(this.body, dark, 0.84, 0.12, 0.52, 0, 1.0, 0);            // waist band
      part(this.body, mask, 0.42, 0.44, 0.4, 0, 1.92, 0);            // bone mask head
      part(this.body, visor, 0.3, 0.07, 0.03, 0, 1.95, 0.21, false); // glowing visor
      part(this.body, dark, 0.5, 0.06, 0.5, 0, 2.17, 0);             // hood rim
      part(this.body, main, 0.06, 0.3, 0.06, 0.14, 2.32, 0);         // antenna "choir pipes"
      part(this.body, main, 0.06, 0.4, 0.06, -0.12, 2.37, -0.04);
      this.armL = limb(0.52, 1.52, 0);
      this.armR = limb(-0.52, 1.52, 0);
      for (const a of [this.armL, this.armR]) {
        part(a, dark, 0.22, 0.6, 0.24, 0, -0.32, 0);
        part(a, main, 0.3, 0.28, 0.3, 0, -0.72, 0); // scrap fist
      }
      if (this.typeName === 'bulwark') {
        part(this.body, dark, 1.2, 0.3, 0.62, 0, 1.6, 0);          // huge shoulder plate
        part(this.armL, dark, 0.12, 0.9, 0.7, 0.18, -0.55, 0.05);   // scrap shield
      } else if (this.typeName === 'spitter') {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8), SPIT_MAT);
        tank.position.set(0, 1.45, -0.38);
        tank.rotation.x = 0.3;
        this.body.add(tank);
        part(this.body, dark, 0.12, 0.12, 0.3, 0, 1.75, 0.3);       // nozzle by the mouth
      } else if (this.typeName === 'thurible') {
        part(this.body, dark, 1.0, 0.35, 0.6, 0, 1.62, 0);           // monk's shoulder cowl
        this.orbit = new THREE.Group(); this.root.add(this.orbit);
        const r = this.type.censer / this.scale;
        const chain = part(this.orbit, dark, 0.05, 0.05, r, 0, 1.2, r / 2, false);
        chain.castShadow = false;
        this.ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), CENSER_MAT);
        this.ball.position.set(0, 1.0, r); this.orbit.add(this.ball);
        part(this.orbit, dark, 0.5, 0.12, 0.5, 0, 1.3, r);          // censer lid
      } else if (this.typeName === 'lancer') {
        part(this.armR, dark, 0.12, 0.12, 1.4, 0, -0.75, 0.55);       // the long lance-pipe
        part(this.armR, LANCE_MAT, 0.14, 0.14, 0.1, 0, -0.75, 1.25, false);
        part(this.body, LANCE_MAT, 0.32, 0.07, 0.03, 0, 1.95, 0.22, false); // red visor over the green
        part(this.body, dark, 0.7, 0.9, 0.08, 0, 1.25, -0.3);       // long cantor's mantle
      } else if (this.typeName === 'mender') {
        for (const x of [-0.2, 0.2]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), MEND_MAT); t.position.set(x, 1.35, -0.35); this.body.add(t); }
        this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 4, 18), MEND_MAT);
        this.halo.rotation.x = Math.PI / 2; this.halo.position.set(0, 2.55, 0); this.body.add(this.halo);
      } else if (this.typeName === 'bomber') {
        const bomb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), BOMB_MAT); bomb.position.set(0, 1.25, 0.22); this.body.add(bomb);
        this.bomb = bomb;
        this.fuse = part(this.body, BOMB_MAT, 0.08, 0.3, 0.08, 0.1, 2.4, 0, false);
      } else if (this.typeName === 'splitter') {
        for (const [x, y] of [[0.25, 1.45], [-0.25, 1.45], [0, 1.15]]) {
          part(this.body, main, 0.3, 0.3, 0.3, x, y, -0.36);        // pods that become mites
        }
      }
    }

    if (this.elite) {
      // spiky amber crown so elites are easy to spot
      const crownY = this.typeName === 'hound' ? 1.15 : this.typeName === 'mite' ? 0.9 : 2.25;
      const crownZ = this.typeName === 'hound' ? 0.7 : 0;
      for (const x of [-0.18, 0, 0.18]) part(this.body, ELITE_VISOR_MAT, 0.08, 0.25, 0.08, x, crownY, crownZ, false);
    }

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

  animate(dt, moving) {
    this.walkPhase += dt * (moving ? 11 : 0);
    const s = Math.sin(this.walkPhase) * (moving ? 0.6 : 0);
    this.body.rotation.x = 0;
    this.body.position.y = 0;

    if (this.legs) {
      // hounds and mites: four legs
      this.legs.forEach((l, i) => { l.rotation.x = (i % 2 === 0 ? s : -s) * 1.2; });
      if (this.state === 'windup') { this.body.position.y = -0.2; this.body.rotation.x = -0.25; } // crouch
      if (this.state === 'lunge') { this.body.position.y = 0.4; this.body.rotation.x = 0.3; }     // airborne
    } else {
      this.legL.rotation.x = s;
      this.legR.rotation.x = -s;
      if (this.state === 'windup') {
        // raise fists overhead (or rear back to spit) - your warning to dodge!
        const t = Math.min(1, this.stateTime / this.type.windup);
        this.armL.rotation.x = this.armR.rotation.x = -t * (this.type.ai === 'ranged' ? 1.2 : 2.8);
        this.body.rotation.x = -t * 0.25;
      } else if (this.state === 'recover') {
        this.armL.rotation.x = this.armR.rotation.x = -0.9;
        this.body.rotation.x = 0.25;
      } else {
        this.armL.rotation.x = -s * 0.8;
        this.armR.rotation.x = s * 0.8;
      }
    }
    if (this.stun > 0) this.body.rotation.x = -0.3; // reel back when hit
    // COREBURNZ extras
    if (this.orbit) this.orbit.rotation.y = this.censerAngle - this.facing;
    if (this.halo) this.halo.rotation.z += dt * 3;
    if (this.bomb) { const lit = this.state === 'windup'; const k = lit ? 1 + 0.25 * Math.abs(Math.sin(this.stateTime * 18)) : 1; this.bomb.scale.setScalar(k); this.fuse.visible = !lit || Math.sin(this.stateTime * 30) > 0; }
    if (this.type.ai === 'sniper' && this.state === 'windup') { this.armR.rotation.x = -1.5; this.armL.rotation.x = -1.2; }
    if (this.type.ai === 'mender' && this.state === 'windup') { this.armL.rotation.x = this.armR.rotation.x = -2.6; }

    // white flash when hit, red glow while winding up an attack
    let emissive = this.elite ? 0x2a1500 : 0x000000;
    if (this.flashTimer > 0) emissive = 0xffffff;
    else if (this.state === 'windup') emissive = 0x661100;
    this.setEmissive(emissive);

    this.root.position.set(this.position.x, this.typeName === 'grub' ? (this.state === 'burrowed' ? -1.1 : this.state === 'windup' ? -0.8 + 0.3 * Math.min(1, this.stateTime / this.type.windup) : 0) : 0, this.position.z);
    this.root.rotation.y = this.facing;
  }

  animateDeath() {
    // topple over, then sink into the floor
    const t = this.stateTime;
    this.setEmissive(t < 0.1 ? 0xffffff : 0x000000);
    this.body.rotation.x = -Math.min(1, t / 0.35) * Math.PI / 2;
    this.root.position.y = t > 0.5 ? -(t - 0.5) * 3 : 0;
    if (t > 1.1) this.remove = true;
  }

  setEmissive(hex) {
    if (this.currentEmissive === hex) return;
    this.currentEmissive = hex;
    for (const m of Object.values(this.mats)) m.emissive.setHex(hex);
  }

  dispose() {
    this.scene.remove(this.root);
    for (const m of Object.values(this.mats)) m.dispose();
  }
}

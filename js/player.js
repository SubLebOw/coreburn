// player.js
// Sarrow, our hero! Builds his blocky 3D model, moves him around, and handles his attacks:
//   - 3-hit talon combo (J / click / SLASH)
//   - blink dash: untouchable, and hurts enemies you pass through (K / Space / BLINK)
//   - overdrive spin attack with a cooldown (L / OVERDRIVE)
//   - core recharge: health slowly comes back by itself
//   - weapon tier + upgrade cards picked after each boss (see upgrades.js)
//   - power-ups (see powerups.js) can double his damage, shield him or electrify his talons
import * as THREE from 'three';
import { Loadout, tierColor } from './upgrades.js';
import { CHARACTERS } from './characters.js';

// The camera looks at the arena from the +X/+Z corner. These are the floor directions
// that match "up the screen" and "right on the screen", so W always moves up the screen.
const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

// The three hits of the talon combo. Tweak these numbers to change how it feels!
const COMBO = [
  { damage: 12, knockback: 6, range: 2.4, duration: 0.24 }, // hit 1: one arm
  { damage: 12, knockback: 6, range: 2.4, duration: 0.24 }, // hit 2: other arm
  { damage: 28, knockback: 14, range: 2.9, duration: 0.40 }, // hit 3: big double-talon finisher
];

// Speeds, blink and overdrive numbers are per character (see characters.js)
const SPIN_TIME = 1.6;
const SPIN_COOLDOWN = 8;

export class Player {
  constructor(scene, world, charId = 'sarrow', tint = null) {
    this.world = world; // gives access to enemies, effects, the arena, etc.
    this.scene = scene;
    this.char = CHARACTERS[charId] || CHARACTERS.sarrow;
    this.tint = tint;
    this.maxHp = this.char.hp;
    this.radius = 0.5;
    this.dashCooldownMax = this.char.dashCd;
    this.spinCooldownMax = SPIN_COOLDOWN;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();

    this.model = this.char.build(tint);
    scene.add(this.model.root);

    // Glowing arc that shows the talon swipe
    this.slashArc = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 2.5, 20, 1, -Math.PI / 2 - Math.PI * 0.45, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({ color: 0x7ffff2, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    this.slashArc.rotation.x = -Math.PI / 2;
    this.slashArc.position.y = 1.1;

    // Energy ring that spins around Sarrow during the overdrive attack
    this.spinRing = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 3.2, 24, 1, 0, Math.PI * 1.5),
      new THREE.MeshBasicMaterial({ color: 0x3ff6e0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
    );
    this.spinRing.rotation.x = -Math.PI / 2;
    this.spinRing.position.y = 0.9;
    this.spinRing.visible = false;

    // Teal ring on the floor under Sarrow so you can always spot him in a crowd
    const marker = this.marker = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.78, 28),
      new THREE.MeshBasicMaterial({ color: 0x3ff6e0, transparent: true, opacity: 0.6, depthWrite: false })
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.03;

    // SHIELD power-up bubble
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.22, depthWrite: false })
    );
    this.bubble.position.y = 1.1;
    this.bubble.visible = false;
    this.attachExtras();

    // Blink Trail upgrade: glowing patches left behind by a blink (pooled)
    this.trail = [];
    const trailMat = new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.6, depthWrite: false });
    const trailGeo = new THREE.CircleGeometry(0.75, 12);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(trailGeo, trailMat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.trail.push({ mesh: m, life: 0 });
    }
    this.trailMat = trailMat;

    this.loadout = new Loadout();
    this.reset();
  }

  // The arcs, rings and bubble ride on whichever hero model is in use
  attachExtras() {
    this.model.root.add(this.slashArc, this.spinRing, this.marker, this.bubble);
    this.marker.material.color.setHex(this.tint || this.char.color);
  }

  // Switch hero (character select). tint = co-op duplicate colour, or null.
  setCharacter(id, tint = null) {
    const c = CHARACTERS[id] || CHARACTERS.sarrow;
    if (c === this.char && tint === this.tint) return;
    this.scene.remove(this.model.root);
    this.char = c;
    this.tint = tint;
    this.model = c.build(tint);
    this.scene.add(this.model.root);
    this.attachExtras();
    this.bladeColor = null;
    this.currentFlash = null;
    this.reset();
  }

  get name() { return this.char.name; }

  // Put the hero back to full health in the middle of the arena
  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.facing = Math.PI / 4; // angle he faces (radians). PI/4 = towards the camera
    this.hp = this.maxHp;
    this.state = 'normal';     // 'normal' | 'attack' | 'dash' | 'spin' | 'dead'
    this.stateTime = 0;
    this.comboStep = 0;
    this.comboGrace = 0;       // short window after a hit where the next press continues the combo
    this.attackBuffer = 0;     // remembers an attack press for a moment so combos feel responsive
    this.dashCooldown = 0;
    this.spinCooldown = 0;
    this.hurtTimer = 0;
    this.invulnTimer = 0;
    this.timeSinceHit = 99;
    this.walkPhase = 0;
    this.dead = false;
    this.lastHitBy = null;
    this.killedBy = null;
    this.damageMult = 1;              // 2 while FURY is active
    this.powers = {};                 // active power-ups (type -> { time, max, hits })
    this.loadout.reset();
    if (this.startCard) { this.loadout.levels[this.startCard] = 1; this.loadout.version++; this.loadout.recompute(); } // shop starting perk
    this.applyLoadout();
    this.hp = this.maxHp;
    this.dashCharges = this.maxCharges;
    this.trailTick = 0;
    this.leechBudget = 0;
    for (const t of this.trail) { t.life = 0; t.mesh.visible = false; }
    this.slide = new THREE.Vector3(); // momentum on ice
    this.bubble.visible = false;
    this.setBladeColor(this.tierColor);
    this.model.body.rotation.set(0, 0, 0);
    this.model.body.position.set(0, 0, 0);
    this.spinRing.visible = false;
    this.slashArc.material.opacity = 0;
    this.setFlash(0x000000);
    this.model.core.visible = true;
    this.syncModel();
  }

  get facingDir() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }

  update(dt, input) {
    if (this.dead) { this.animateDeath(dt); return; }

    // ----- Timers -----
    // blink charges refill one at a time
    if (this.dashCharges < this.maxCharges) {
      this.dashCooldown -= dt;
      if (this.dashCooldown <= 0) { this.dashCharges++; this.dashCooldown = this.dashCharges < this.maxCharges ? this.dashCooldownMax : 0; }
    } else this.dashCooldown = 0;
    this.leechBudget = Math.max(0, this.leechBudget - dt * 6); // Core Leech: at most ~6 hp per second
    this.spinCooldown = Math.max(0, this.spinCooldown - dt);
    this.comboGrace -= dt;
    this.attackBuffer -= dt;
    this.hurtTimer -= dt;
    this.invulnTimer -= dt;
    this.timeSinceHit += dt;

    // ----- Core recharge: slow regen, faster if you avoid getting hit for 3 seconds -----
    const regen = (this.timeSinceHit > 3 ? 5 : 1.5) * this.stats.regen;
    this.hp = Math.min(this.maxHp, this.hp + regen * dt);

    // ----- Turn joystick/keys into a direction on the floor -----
    const move = input.getMove();
    const dir = new THREE.Vector3()
      .addScaledVector(SCREEN_RIGHT, move.x)
      .addScaledVector(SCREEN_UP, move.y);
    const moving = dir.lengthSq() > 0.0001;

    if (input.wasPressed('attack')) this.attackBuffer = 0.3;
    if (input.attackHeld) this.attackBuffer = Math.max(this.attackBuffer, 0.05);

    // Dash and spin can interrupt normal movement or attacks
    if (input.wasPressed('dash') && this.dashCharges > 0 && (this.state === 'normal' || this.state === 'attack')) {
      this.startDash(moving ? dir.clone().normalize() : this.facingDir);
    }
    if (input.wasPressed('spin') && this.spinCooldown <= 0 && this.state !== 'dash' && this.state !== 'spin') {
      this.startSpin();
    }

    this.stateTime += dt;
    this.velocity.set(0, 0, 0);

    switch (this.state) {
      case 'normal':
        if (moving) {
          this.velocity.copy(dir).multiplyScalar(this.char.speed * this.stats.speed);
          this.turnTowards(Math.atan2(dir.x, dir.z), dt, 20);
        }
        if (this.attackBuffer > 0) {
          this.startAttack(this.comboGrace > 0 && this.comboStep < 3 ? this.comboStep + 1 : 1, moving ? dir : null);
        }
        break;

      case 'attack': {
        const hit = COMBO[this.comboStep - 1];
        const t = this.stateTime / (hit.duration / this.char.atkSpeed);
        // small step forward at the start of each swing, and slow steering
        if (t < 0.4) this.velocity.copy(this.facingDir).multiplyScalar(this.comboStep === 3 ? 6 : 4);
        if (moving) this.velocity.addScaledVector(dir, this.char.speed * 0.25);
        if (!this.hasHit && t >= 0.45) { this.hasHit = true; this.doSlashHit(hit); }
        if (this.attackBuffer > 0 && this.comboStep < 3 && t >= 0.6) {
          this.startAttack(this.comboStep + 1, moving ? dir : null);
        } else if (t >= 1) {
          this.state = 'normal';
          this.comboGrace = 0.35;
          if (this.comboStep >= 3) this.comboStep = 0; // after the finisher, start over at hit 1
        }
        break;
      }

      case 'dash':
        this.velocity.copy(this.dashDir).multiplyScalar(this.char.dashSpeed);
        this.dashHits();
        if (this.stats.trail > 0) this.dropTrail();
        if (this.stateTime >= this.char.dashTime * this.stats.dashTime) this.state = 'normal';
        break;

      case 'spin':
        if (moving) this.velocity.copy(dir).multiplyScalar(this.char.speed * 0.75 * this.stats.speed);
        this.spinTick -= dt;
        if (this.spinTick <= 0) { this.spinTick = this.char.spinTick; this.spinHits(); }
        if (this.stateTime >= SPIN_TIME + this.stats.spinTime) {
          this.state = 'normal';
          this.spinRing.visible = false;
          this.model.body.rotation.y = 0;
        }
        break;
    }

    this.updateTrail(dt);

    // ----- Ice: you keep sliding and turn slowly (not while blinking) -----
    if (this.state !== 'dash' && this.world.arena.surfaceAt(this.position.x, this.position.z) === 'ice') {
      this.slide.lerp(this.velocity, 1 - Math.exp(-2.2 * dt));
      this.velocity.copy(this.slide);
    } else {
      this.slide.copy(this.velocity);
    }

    // ----- Move and collide -----
    this.position.addScaledVector(this.velocity, dt);
    this.world.arena.resolve(this.position, this.radius);

    this.animate(dt);
    this.syncModel();
  }

  // Smoothly rotate to face an angle
  turnTowards(target, dt, speed) {
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    this.facing += diff * Math.min(1, speed * dt);
  }

  // ---------- Attacks ----------

  startAttack(step, moveDir) {
    this.state = 'attack';
    this.comboStep = step;
    this.world.sfx('slash', step);
    this.stateTime = 0;
    this.hasHit = false;
    this.attackBuffer = 0;
    // Aim assist: face the movement direction, but snap onto a nearby enemy if there is one
    if (moveDir) this.facing = Math.atan2(moveDir.x, moveDir.z);
    const target = this.findNearestEnemy(moveDir ? 3.5 : 4.5);
    if (target) {
      const angle = Math.atan2(target.position.x - this.position.x, target.position.z - this.position.z);
      const off = Math.abs(Math.atan2(Math.sin(angle - this.facing), Math.cos(angle - this.facing)));
      if (!moveDir || off < Math.PI / 3) this.facing = angle;
    }
  }

  doSlashHit(hit) {
    const forward = this.facingDir;
    const s = this.stats;
    const range = hit.range * s.range;
    const arcDot = 0.35 - 0.05 * s.arcLevel; // Wide Arc swings wider
    let hitSomething = false;
    const struck = new Set();
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const to = new THREE.Vector3().subVectors(e.position, this.position);
      to.y = 0;
      const dist = to.length();
      if (dist > range + e.radius) continue;
      to.normalize();
      // only hit enemies in front of us (about 140 degree arc, wider with Wide Arc), or really close ones
      if (forward.dot(to) < arcDot && dist > 1) continue;
      this.strike(e, hit.damage, to.x * hit.knockback, to.z * hit.knockback, this.comboStep === 3, 'slash');
      this.world.effects.spawnSparks(e.position.clone().setY(1.1), this.comboStep === 3 ? 0xffa040 : 0x9ffff5, this.comboStep === 3 ? 12 : 6);
      struck.add(e);
      hitSomething = true;
    }
    // Shockwave Finisher: the 3rd hit sends out a ring that hits everything around you
    if (this.comboStep === 3 && s.shock > 0) {
      const radius = 2.8 + 0.3 * s.shock, pct = 0.3 + 0.09 * s.shock;
      this.world.effects.spawnRing(this.position, 0xffd040, radius, 0.35);
      for (const e of this.world.enemies.list) {
        if (!e.canBeHit || struck.has(e)) continue;
        const to = new THREE.Vector3().subVectors(e.position, this.position).setY(0);
        const d = to.length();
        if (d > radius + e.radius) continue;
        to.normalize();
        this.strike(e, hit.damage * pct, to.x * 8, to.z * 8, false, 'shock');
        hitSomething = true;
      }
    }
    if (hitSomething) {
      this.world.sfx('hit');
      this.world.shake(this.comboStep === 3 ? 0.35 : 0.15);
      this.world.hitstop(this.comboStep === 3 ? 0.08 : 0.03);
    }
  }

  startDash(direction) {
    this.state = 'dash';
    this.stateTime = 0;
    this.dashDir = direction.clone();
    this.facing = Math.atan2(direction.x, direction.z);
    this.dashCharges--;
    if (this.dashCooldown <= 0) this.dashCooldown = this.dashCooldownMax;
    this.dashHitSet = new Set();
    this.world.effects.spawnRing(this.position, 0x3ff6e0, 1.5, 0.3);
    this.world.sfx('blink');
  }

  dashHits() {
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit || this.dashHitSet.has(e)) continue;
      if (e.position.distanceTo(this.position) < this.char.dashWidth + e.radius) {
        this.dashHitSet.add(e);
        // knock enemies off to the side of the dash path
        const side = new THREE.Vector3(-this.dashDir.z, 0, this.dashDir.x);
        if (side.dot(new THREE.Vector3().subVectors(e.position, this.position)) < 0) side.negate();
        const k = this.char.dashKnock; // Zaleks' shoulder-charge shoves hard
        this.strike(e, this.char.dashDmg * this.stats.dashDmg, side.x * k, side.z * k, k > 10, 'dash');
        this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0x9ffff5, 6);
        this.world.shake(0.12);
        this.world.sfx('hit');
      }
    }
  }

  startSpin() {
    this.state = 'spin';
    this.stateTime = 0;
    this.spinTick = 0;
    this.spinCooldown = this.spinCooldownMax;
    this.spinRing.scale.setScalar(this.stats.spinRadius * this.char.spinRadius);
    this.spinRing.visible = true;
    const slam = this.char.id === 'zaleks'; // Zaleks slams the ground first
    this.world.effects.spawnRing(this.position, slam ? 0xffa030 : 0xe0702a, 4 * this.char.spinRadius, slam ? 0.7 : 0.5);
    this.world.shake(slam ? 0.5 : 0.25);
    this.world.sfx('overdrive');
  }

  spinHits() {
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const to = new THREE.Vector3().subVectors(e.position, this.position);
      to.y = 0;
      const dist = to.length();
      if (dist < 3.2 * this.stats.spinRadius * this.char.spinRadius + e.radius) {
        to.normalize();
        const k = this.char.spinKnock;
        this.strike(e, 8 * this.stats.spinDmg * this.char.spinDmg, to.x * k, to.z * k, true, 'spin');
        this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0xff8040, 4);
        this.world.sfx('hit');
      }
    }
  }

  // Every hit Sarrow lands goes through here: weapon tier, perks, FURY, crits, double hits, leech, chains.
  // kind: 'slash' | 'dash' | 'spin' | 'shock' | 'trail' | 'chain'
  strike(e, base, kx, kz, heavy, kind) {
    if (this.world.netClient) return; // co-op client: the host decides all damage
    const s = this.stats;
    let dmg = base * s.dmg * this.char.dmg * this.damageMult;
    const crit = kind !== 'trail' && Math.random() < s.crit;
    if (crit) {
      dmg *= 1.8;
      this.world.effects.spawnSparks(e.position.clone().setY(1.4), 0xfff27a, 5, 8);
    }
    e.hit(dmg, kx, kz, heavy);
    this.world.onComboHit?.(); // COMBO +1 per hit
    if (kind === 'slash' && Math.random() < s.twin) {
      e.hit(dmg, 0, 0, false); // Twin Strike
      this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0x9ab8ff, 4);
    }
    // healing (capped per second so it can't make you unkillable)
    if ((kind === 'slash' || kind === 'dash') && s.leech > 0) this.leechHeal(s.leech, 6);
    if (kind === 'spin' && s.spinLeech > 0) this.leechHeal(s.spinLeech, 10);
    if (kind === 'slash' || kind === 'dash') {
      this.world.onTalonHit?.(e, dmg, this); // ARC TALONS power-up
      if (Math.random() < s.storm) this.stormChain(e, dmg * 0.35);
    }
  }

  leechHeal(amount, perSecond) {
    const room = perSecond - this.leechBudget;
    if (room <= 0) return;
    const h = Math.min(amount, room);
    this.leechBudget += h;
    this.heal(h);
  }

  // Storm Talons: a small chain of lightning to the 2 nearest other enemies
  stormChain(from, dmg) {
    let src = from;
    const done = new Set([from]);
    for (let i = 0; i < 2; i++) {
      let best = null, bestD = 5;
      for (const e of this.world.enemies.list) {
        if (!e.canBeHit || done.has(e)) continue;
        const d = e.position.distanceTo(src.position);
        if (d < bestD) { best = e; bestD = d; }
      }
      if (!best) break;
      done.add(best);
      this.world.effects.spawnZap(src.position, best.position, 0x8ab4ff);
      best.hit(dmg, 0, 0, false);
      src = best;
    }
    if (done.size > 1) this.world.sfx('zap');
  }

  // Blink Trail: drop a burning patch every few centimetres while blinking
  dropTrail() {
    const last = this.lastTrailPos;
    if (last && last.distanceTo(this.position) < 0.9) return;
    const t = this.trail.find((x) => x.life <= 0) || this.trail[0];
    t.life = 1.6;
    t.mesh.position.set(this.position.x, 0.06, this.position.z);
    t.mesh.visible = true;
    this.lastTrailPos = this.position.clone();
  }

  updateTrail(dt) {
    let any = false;
    for (const t of this.trail) {
      if (t.life <= 0) continue;
      t.life -= dt;
      any = true;
      if (t.life <= 0) t.mesh.visible = false;
    }
    if (!any) { this.lastTrailPos = null; return; }
    this.trailMat.opacity = 0.45 + 0.15 * Math.sin(performance.now() / 60);
    this.trailTick -= dt;
    if (this.trailTick > 0) return;
    this.trailTick = 0.3;
    const dmg = 4 + 3 * this.stats.trail; // per tick, before weapon tier
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      if (this.trail.some((t) => t.life > 0 && Math.hypot(t.mesh.position.x - e.position.x, t.mesh.position.z - e.position.z) < 0.75 + e.radius)) {
        this.strike(e, dmg, 0, 0, false, 'trail');
      }
    }
  }

  // Called after an upgrade is picked (and on reset): apply stats + update the talons' look
  applyLoadout() {
    const s = this.stats = this.loadout.stats;
    const oldMax = this.maxHp || this.char.hp;
    this.maxHp = Math.round(this.char.hp * (1 + s.maxHpPct)) + s.maxHpFlat;
    const charges = s.dashCharges + this.char.dashCharges - 1;
    if (this.hp !== undefined) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
    this.dashCooldownMax = this.char.dashCd * s.dashCd;
    this.spinCooldownMax = SPIN_COOLDOWN * s.spinCd;
    if (this.dashCharges !== undefined) this.dashCharges = Math.min(charges, this.dashCharges + (charges > this.prevCharges ? 1 : 0));
    this.prevCharges = this.maxCharges = charges;
    // talons: longer, glowier, and colour-cycle with the tier
    const tier = this.loadout.tier;
    this.tierColor = tierColor(tier, this.talonBase || this.char.blade); // starts at the hero's own talon colour
    const len = 1 + Math.min(24, tier) * 0.025, m = this.model;
    for (const b of m.blades) { b.scale.y = m.bladeLen * len; b.position.y = m.bladeBase - m.bladeLen / 2 * len; }
    for (const g of this.model.halos) {
      g.visible = tier > 0;
      const w = Math.min(20, tier) * 0.004;
      g.scale.set(0.12 + w, (m.bladeLen + 0.08) * len, 0.18 + w);
      g.position.y = m.bladeBase - (m.bladeLen + 0.08) / 2 * len;
      g.material.color.setHex(this.tierColor);
      g.material.opacity = Math.min(0.55, 0.12 + tier * 0.0175);
    }
    this.spinRing.material.color.setHex(tier > 0 ? this.tierColor : (this.char.id === 'sarrow' ? 0x3ff6e0 : this.char.color)); // overdrive ring matches the talons
    this.world.powerups ? this.world.powerups.refreshBlade(this) : this.setBladeColor(this.tierColor);
  }

  // What the HUD shows on the BLINK button: ready while you have a charge
  get dashCooldownShown() { return this.dashCharges > 0 ? 0 : this.dashCooldown; }

  findNearestEnemy(maxDist) {
    let best = null, bestDist = maxDist;
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const d = e.position.distanceTo(this.position);
      if (d < bestDist) { best = e; bestDist = d; }
    }
    return best;
  }

  // ---------- Getting hurt ----------

  // `source` = the enemy, boss or bolt owner that hit us (remembered so the game over
  // screen and the share text can say what killed Sarrow)
  // opts.hazard = lava / lightning (the SHIELD blocks those without using up a charge)
  takeDamage(amount, source = null, opts = {}) {
    if (this.dead || this.state === 'dash') return false; // blinking = untouchable
    if (this.invulnTimer > 0) return false;              // just revived
    if (this.world.powerups && this.world.powerups.absorb(opts, this)) return false; // SHIELD
    if (this.state === 'spin') amount *= 0.5;             // overdrive = tougher
    amount *= this.stats.hurtMult || 1;                   // cursed cards (Greed Engine, Glass Heart)
    this.hp -= amount;
    this.hurtTimer = 0.15;
    this.timeSinceHit = 0;
    if (source) this.lastHitBy = source;
    this.world.onPlayerHurt(this);
    this.world.sfx('hurt');
    if (this.hp <= 0) {
      this.killedBy = source || this.lastHitBy || null;
      this.goDown();
    }
    return true;
  }

  // Out of health (solo: game over; co-op: downed until a teammate revives you)
  goDown() {
    this.hp = 0;
    this.dead = true;
    this.state = 'dead';
    this.stateTime = 0;
    this.spinRing.visible = false;
    this.slashArc.material.opacity = 0;
    this.bubble.visible = false;
  }

  heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  // Back on your feet (from the rewarded "Revive" ad): half health and 2.5s of invincibility
  revive() {
    this.dead = false;
    this.killedBy = null;
    this.state = 'normal';
    this.stateTime = 0;
    this.hp = this.maxHp * 0.5;
    this.invulnTimer = 2.5;
    this.dashCharges = this.maxCharges;
    this.timeSinceHit = 0;
    this.model.body.rotation.set(0, 0, 0);
    this.model.body.position.set(0, 0, 0);
    this.model.core.visible = true;
    this.model.root.position.y = 0;
  }

  // ---------- Animation ----------

  animate(dt) {
    const m = this.model;
    const speedRatio = Math.min(1, this.velocity.length() / this.char.speed);
    this.walkPhase += dt * 13 * speedRatio;
    const swing = Math.sin(this.walkPhase);

    // legs + body bob
    m.legL.rotation.x = swing * 0.7 * speedRatio;
    m.legR.rotation.x = -swing * 0.7 * speedRatio;
    m.body.position.y = Math.abs(swing) * 0.08 * speedRatio;
    m.body.rotation.x = 0;

    // default "ready" arm pose: talons out in front
    m.armL.rotation.set(-0.6 - swing * 0.4 * speedRatio, 0, 0.15);
    m.armR.rotation.set(-0.6 + swing * 0.4 * speedRatio, 0, -0.15);
    this.slashArc.material.opacity = Math.max(0, this.slashArc.material.opacity - dt * 6);

    if (this.state === 'attack') {
      const hit = COMBO[this.comboStep - 1];
      const t = Math.min(1, this.stateTime / (hit.duration / this.char.atkSpeed));
      const e = 1 - Math.pow(1 - t, 3); // ease out
      if (this.comboStep === 1) {
        // left arm sweeps from the outside across the body
        m.armL.rotation.set(-1.5, 0, THREE.MathUtils.lerp(1.3, -0.9, e));
      } else if (this.comboStep === 2) {
        m.armR.rotation.set(-1.5, 0, THREE.MathUtils.lerp(-1.3, 0.9, e));
      } else {
        // both arms come down from overhead
        const x = THREE.MathUtils.lerp(-2.9, -0.8, e);
        m.armL.rotation.set(x, 0, 0.2);
        m.armR.rotation.set(x, 0, -0.2);
        m.body.rotation.x = e * 0.25;
      }
      if (t > 0.3 && t < 0.6) {
        this.slashArc.material.opacity = this.comboStep === 3 ? 0.75 : 0.55;
        // finisher is orange at first; from weapon tier 3 every swing glows in the talons' tier colour
        this.slashArc.material.color.setHex(this.damageMult > 1 ? 0xff3a2a : (this.comboStep === 3 && this.loadout.tier < 3 ? 0xffa040 : this.bladeColor));
        this.slashArc.scale.set(this.comboStep === 2 ? -1 : 1, 1, 1).multiplyScalar((this.comboStep === 3 ? 1.2 : 1) * this.stats.range);
      }
    } else if (this.state === 'dash') {
      m.body.rotation.x = 0.5; // lean forward
      m.armL.rotation.set(0.9, 0, 0.2);
      m.armR.rotation.set(0.9, 0, -0.2);
    } else if (this.state === 'spin') {
      m.body.rotation.y += dt * 24; // overdrive whirlwind!
      m.armL.rotation.set(-0.2, 0, 1.5);
      m.armR.rotation.set(-0.2, 0, -1.5);
      this.spinRing.rotation.z -= dt * 18;
    }

    // flash red when hurt
    const reviveGlow = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 8) % 2 === 0;
    this.setFlash(this.hurtTimer > 0 ? 0x990000 : (this.state === 'spin' || reviveGlow ? 0x0a3a36 : 0x000000));
    // the chest core pulses (faster while in overdrive)
    const pulse = 0.16 * (1 + 0.25 * Math.sin(performance.now() / (this.state === 'spin' ? 60 : 250)));
    m.core.scale.set(pulse, pulse, 0.06);
  }

  animateDeath(dt) {
    this.stateTime += dt;
    const t = Math.min(1, this.stateTime / 0.6);
    this.model.body.rotation.x = -t * Math.PI / 2 * 0.95; // fall on his back
    this.model.core.visible = false; // core goes dark
    this.model.body.rotation.y = 0;
    this.model.body.position.y = t * 0.25;
    this.setFlash(0x000000);
  }

  // Talon colour: teal normally, red with FURY, electric blue with ARC TALONS
  setBladeColor(hex) {
    if (this.bladeColor === hex) return;
    this.bladeColor = hex;
    this.model.blade.color.setHex(hex);
  }

  setFlash(hex) {
    if (this.currentFlash === hex) return;
    this.currentFlash = hex;
    for (const mat of this.model.flashMats) mat.emissive.setHex(hex);
  }

  syncModel() {
    this.model.root.position.copy(this.position);
    this.model.root.rotation.y = this.facing;
  }
}


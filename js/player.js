// player.js
// A hero: model, movement and the three ability slots. Every hero has the same slots and keys
// (ATTACK J/click, MOBILITY K/Space, ULTIMATE L) but a different kit (numbers in hero-stats.js):
//   SARROW  talon combo        / Blink (untouchable dash)     / Overdrive (spin, half damage taken)
//   ZALEKS  shield bash+hammer / Shoulder Charge (stuns)      / Seismic Slam (AoE, taunt, shield)
//   ISKRA   auto-aimed needles / Phase Hop (2 charges, decoy) / Needle Storm (fan barrage)
//   ORIN    chaining arc tether/ Magnet Grapple (yank / pull) / Hymn Engine (vortex + drones)
// Also: core recharge (regen), weapon tier + upgrade cards (upgrades.js), power-ups (powerups.js).
import * as THREE from 'three';
import { decorateSkin } from './cosmetics.js';
import { RULES, zHero } from './rules.js';
import { Loadout, tierColor } from './upgrades.js';
import { CHARACTERS } from './characters.js';
import { KIT } from './allies.js';

// The camera looks at the arena from the +X/+Z corner. These are the floor directions
// that match "up the screen" and "right on the screen", so W always moves up the screen.
const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize();
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();

// attack kinds that count as "attacks" for leech, twin strike, storm and ARC TALONS
const ATTACK_KINDS = new Set(['slash', 'dash', 'needle', 'beam']);
const COMBO_OF = (c) => c.combo || [];
// CoreBurnZ v1.24 kit spice (classic untouched)
const ZK = {
  waveDmg: 0.7, waveSpeed: 20, waveRange: 11,     // SARROW: 3rd talon hit throws a piercing blade wave (x finisher damage)
  blinkResetCd: 0.5,                              // SARROW: Overdrive kills give a Blink back, at most once per 0.5s
  rageMax: 100, rageHurt: 1.6, rageHit: 0.7,      // ZALEKS: Rage per 1 damage taken / per hit landed
  quakeRadius: 1.6, quakeDmg: 1.6, quakeStun: 1.2, // ZALEKS: full-Rage Seismic Slam
  dragMax: 6, dragSlam: 0.8, dragStun: 0.9,       // ZALEKS: charge carries up to 6 enemies, slams them at the end
};

export class Player {
  constructor(scene, world, charId = 'sarrow', tint = null) {
    this.world = world; // gives access to enemies, effects, the arena, etc.
    this.scene = scene;
    this.char = CHARACTERS[charId] || CHARACTERS.sarrow;
    this.tint = tint;
    this.maxHp = this.char.hp;
    this.radius = 0.5;
    this.dashCooldownMax = this.char.dashCd;
    this.spinCooldownMax = this.char.ultCd;
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
    // ZALEKS' Seismic Slam shield (orange shell)
    this.guard = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.2, depthWrite: false })
    );
    this.guard.position.y = 1.1;
    this.guard.visible = false;
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

    this.loadout = new Loadout(this.char.id);
    this.reset();
  }

  // The arcs, rings and bubble ride on whichever hero model is in use
  attachExtras() {
    this.model.root.add(this.slashArc, this.spinRing, this.marker, this.bubble, this.guard);
    this.marker.material.color.setHex(this.idColor || this.tint || this.char.color);
    // co-op: a second hero of the same kind gets a bright coloured ring of its own (not a body recolour)
    if (this.idColor) {
      if (!this.idRing) {
        this.idRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.02, 32), new THREE.MeshBasicMaterial({ color: this.idColor, transparent: true, opacity: 0.85, depthWrite: false }));
        this.idRing.rotation.x = -Math.PI / 2; this.idRing.position.y = 0.035;
      }
      this.idRing.material.color.setHex(this.idColor);
      this.model.root.add(this.idRing);
    } else if (this.idRing) this.idRing.parent?.remove(this.idRing);
  }
  setIdColor(c) { this.idColor = c || null; this.attachExtras(); }

  // Switch hero (character select). tint = co-op duplicate colour, or null.
  setCharacter(id, tint = null) {
    const c = CHARACTERS[id] || CHARACTERS.sarrow;
    if (c === this.char && tint === this.tint) return;
    this.scene.remove(this.model.root);
    this.char = c;
    this.tint = tint;
    this.skinGlow = null;
    this.skinId = null;
    this.model = c.build(tint);
    this.scene.add(this.model.root);
    this.attachExtras();
    this.loadout.hero = c.id;
    this.bladeColor = null;
    this.currentFlash = null;
    this.reset();
  }

  // Swap the look without touching health/position (ARENA SKINS between arenas). glow = core colour
  reskin(tint = null, glow = null, skin = null) {
    const sid = skin ? skin.id : null;
    if (tint === this.tint && glow === this.skinGlow && sid === (this.skinId ?? null)) return false;
    this.skinId = sid;
    const pos = this.model.root.position.clone(), rot = this.model.root.rotation.y;
    this.scene.remove(this.model.root);
    this.tint = tint; this.skinGlow = glow;
    this.model = this.char.build(tint);
    if (glow !== null && this.model.core) this.model.core.material.color.setHex(glow);
    decorateSkin(this.model, skin, this.char.id); // ARENA SKINS: materials + themed attachments
    this.model.root.position.copy(pos); this.model.root.rotation.y = rot;
    this.scene.add(this.model.root);
    this.attachExtras();
    this.bladeColor = null;
    this.currentFlash = null;
    this.applyLoadout?.();
    return true;
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
    this.loadout.mastery = RULES.z ? (this.masteryNodes || []) : []; // CoreBurnZ hero mastery
    this.mJobs = [];
    this.loadout.reset();
    if (this.startCard) { this.loadout.levels[this.startCard] = 1; this.loadout.version++; this.loadout.recompute(); } // shop starting perk
    this.applyLoadout();
    this.hp = this.maxHp;
    this.dashCharges = this.maxCharges;
    this.trailTick = 0;
    this.leechBudget = 0;
    this.mobBuffer = this.ultBuffer = 0;
    this.fireCd = 0;           // ISKRA needle / ORIN tether tick timer
    this.phaseTimer = 0;       // ISKRA: untouchable for a moment after a hop
    this.tauntTimer = 0;       // ZALEKS: enemies come for him
    this.tauntRadius = 0;
    this.shieldHp = 0;         // ZALEKS: slam shield
    this.rage = 0; this.dragged = null; this.flow = 0; // CoreBurnZ: Zaleks' Rage + carried enemies
    this.shieldTimer = 0;
    this.tether = null;        // ORIN: who the beam is locked on
    this.guard.visible = false;
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
    if (this.mJobs?.length) for (let i = this.mJobs.length - 1; i >= 0; i--) { const j = this.mJobs[i]; if ((j.t -= dt) <= 0) { this.mJobs.splice(i, 1); j.run(); } } // mastery delays

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
    this.fireCd -= dt;
    this.phaseTimer -= dt;
    this.tauntTimer -= dt;
    if (this.shieldTimer > 0) { this.shieldTimer -= dt; if (this.shieldTimer <= 0) this.shieldHp = 0; }
    this.guard.visible = this.shieldHp > 0 || !!this.netShield;

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

    // Mobility and ultimate can interrupt normal movement or attacks
    const aim = moving ? dir.clone().normalize() : this.facingDir;
    // (presses are remembered for a moment, so an ultimate pressed mid-dash still comes out)
    // CoreBurnZ: pressing the ultimate again, or any attack / ability, cancels a running ultimate
    if (RULES.z && this.state === 'spin' && this.stateTime > 0.12 &&
        (input.wasPressed('spin') || input.wasPressed('attack') || input.wasPressed('dash'))) {
      this.endUlt();
      this.ultCancelled = true;
      if (!input.wasPressed('attack')) this.attackBuffer = 0; // a held attack doesn't fire on its own
    }
    if (input.wasPressed('dash')) this.mobBuffer = 0.2;
    if (input.wasPressed('spin') && !this.ultCancelled) this.ultBuffer = 0.35;
    this.ultCancelled = false;
    this.mobBuffer -= dt; this.ultBuffer -= dt;
    if (this.mobBuffer > 0 && this.dashCharges > 0 && (this.state === 'normal' || this.state === 'attack')) {
      this.mobBuffer = 0;
      this.useMobility(aim);
    }
    if (this.ultBuffer > 0 && this.spinCooldown <= 0 && this.state !== 'dash' && this.state !== 'spin') {
      this.ultBuffer = 0;
      this.useUltimate();
    }

    this.stateTime += dt;
    this.velocity.set(0, 0, 0);
    const walk = this.char.speed * (zHero(this.char.id).speed || 1) * this.stats.speed * (1 + 0.03 * (this.flow || 0)); // CoreBurnZ Flow

    switch (this.state) {
      case 'normal':
        if (moving) {
          this.velocity.copy(dir).multiplyScalar(walk);
          this.turnTowards(Math.atan2(dir.x, dir.z), dt, 20);
        }
        if (this.attackBuffer > 0) this.attackStart(moving ? dir : null);
        break;
      case 'attack': this.attackUpdate(dt, dir, moving, walk); break;
      case 'dash': this.dashUpdate(dt); break;
      case 'spin': this.ultUpdate(dt, dir, moving, walk); break;
    }

    this.updateTrail(dt);

    // ----- Ice: you keep sliding and turn slowly (not while blinking) -----
    const before = this.position.clone();
    if (this.state !== 'dash' && this.world.arena.surfaceAt(this.position.x, this.position.z) === 'ice') {
      this.slide.lerp(this.velocity, 1 - Math.exp(-2.2 * dt));
      this.velocity.copy(this.slide);
    } else {
      this.slide.copy(this.velocity);
    }

    // ----- Move and collide -----
    this.position.addScaledVector(this.velocity, dt);
    this.world.arena.resolve(this.position, this.radius);
    // ZALEKS' charge (and ORIN's reel) stop dead at walls and pillars
    if (this.state === 'dash' && this.stateTime > 0.06 && this.velocity.lengthSq() > 1 &&
        this.position.distanceTo(before) < this.velocity.length() * dt * 0.35) this.hitWall();
    if (this.dragged && this.state !== 'dash') this.dragSlam(); // CoreBurnZ: charge over, slam the carried enemies

    this.animate(dt);
    this.syncModel();
  }

  // Smoothly rotate to face an angle
  turnTowards(target, dt, speed) {
    let diff = target - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
    this.facing += diff * Math.min(1, speed * dt);
  }

    // ======================= KITS =======================
  // The three slots dispatch on the hero. States stay 'normal' | 'attack' | 'dash' | 'spin' for
  // every hero (co-op sends the state name, and puppets pose from it), 'dash' = mobility, 'spin' = ultimate.
  get kit() { return this.char.id; }
  get combo() { return COMBO_OF(this.char); }

  attackStart(moveDir) {
    switch (this.kit) {
      case 'iskra': case 'ninja': this.state = 'attack'; this.stateTime = 0; break;
      case 'orin': this.state = 'attack'; this.stateTime = 0; this.tether = null; break;
      default: {
        const n = this.combo.length;
        this.startAttack(this.comboGrace > 0 && this.comboStep < n ? this.comboStep + 1 : 1, moveDir);
      }
    }
  }

  attackUpdate(dt, dir, moving, walk) {
    const k = this.kit;
    if (k === 'iskra' || k === 'orin' || k === 'ninja') {
      // ranged / channelled: keep moving (a bit slower) while the button is held
      const slow = k !== 'orin' ? this.char.needle.moveWhileFiring : this.char.beam.moveWhileFiring;
      if (moving) this.velocity.copy(dir).multiplyScalar(walk * slow);
      if (k !== 'orin') this.needleUpdate(dir, moving);
      else this.tetherUpdate(dir, moving, dt);
      if (this.attackBuffer <= 0 && this.fireCd <= 0) { this.state = 'normal'; this.tether = null; }
      else if (moving && !this.aimLock) this.turnTowards(Math.atan2(dir.x, dir.z), dt, 14);
      return;
    }
    // melee combos (SARROW 3 hits, ZALEKS 2 heavy hits)
    const combo = this.combo, n = combo.length;
    const hit = combo[this.comboStep - 1];
    const t = this.stateTime / (hit.duration / (this.char.atkSpeed * (1 + 0.05 * (this.flow || 0)))); // CoreBurnZ Flow
    const fin = this.comboStep === n;
    if (t < 0.4) this.velocity.copy(this.facingDir).multiplyScalar(k === 'zaleks' ? (fin ? 3 : 4.5) : (fin ? 6 : 4));
    if (moving) this.velocity.addScaledVector(dir, this.char.speed * 0.25);
    if (!this.hasHit && t >= 0.45) { this.hasHit = true; this.doSlashHit(hit); }
    if (this.attackBuffer > 0 && this.comboStep < n && t >= 0.6) {
      this.startAttack(this.comboStep + 1, moving ? dir : null);
    } else if (t >= 1) {
      this.state = 'normal';
      this.comboGrace = 0.35;
      if (this.comboStep >= n) this.comboStep = 0; // after the finisher, start over at hit 1
    }
  }

  useMobility(aim) {
    switch (this.kit) {
      case 'zaleks': return this.startCharge(aim);
      case 'iskra': return this.phaseHop(aim);
      case 'ninja': return this.shadowStep(aim);
      case 'orin': return RULES.z ? this.gravityWell(aim) : this.grapple(aim); // CoreBurnZ: Gravity Well replaces the grapple
      default: return this.startDash(aim);
    }
  }

  spendCharge() {
    this.dashCharges--;
    if (this.dashCooldown <= 0) this.dashCooldown = this.dashCooldownMax;
  }

  dashUpdate() {
    switch (this.kit) {
      case 'iskra': case 'ninja': // the hop / step already happened; this is just the short blink-in pose
        if (this.stateTime >= 0.14) this.state = 'normal';
        return;
      case 'orin':
        this.velocity.copy(this.dashDir).multiplyScalar(this.char.grappleSpeed);
        if (this.stateTime >= this.dashLen) this.state = 'normal';
        return;
      case 'zaleks':
        this.velocity.copy(this.dashDir).multiplyScalar(this.char.dashSpeed);
        this.dashHits();
        this.dragUpdate();
        if (this.stateTime >= this.char.dashTime * this.stats.chargeDist) this.state = 'normal';
        return;
      default:
        this.velocity.copy(this.dashDir).multiplyScalar(this.char.dashSpeed);
        this.dashHits();
        if (this.stats.trail > 0) this.dropTrail();
        if (this.stateTime >= this.char.dashTime * this.stats.dashTime) this.state = 'normal';
    }
  }

  // ran into a wall or pillar mid-dash
  hitWall() {
    if (this.kit === 'zaleks') {
      this.world.shake(0.3);
      this.world.effects.spawnRing(this.position, 0xffa030, 1.6, 0.3);
      this.world.sfx('hit');
    }
    if (this.kit !== 'sarrow') this.state = 'normal';
  }

  useUltimate() {
    this.state = 'spin';
    this.stateTime = 0;
    this.spinTick = 0;
    this.spinCooldown = this.spinCooldownMax;
    this.ultDone = false;
    switch (this.kit) {
      case 'zaleks':
        this.world.effects.spawnRing(this.position, 0xffd090, 1.6, 0.35);
        this.world.sfx('blink');
        break;
      case 'iskra':
        this.spinRing.scale.setScalar(0.6);
        this.spinRing.visible = true;
        this.world.effects.spawnRing(this.position, 0xe060ff, 3, 0.4);
        this.world.sfx('overdrive');
        if (RULES.z) this.world.allies?.detonateMines(this, KIT.mineStorm * (this.stats.lattice ? 2 : 1)); // CoreBurnZ: Storm sets off every mine
        break;
      case 'orin': this.hymnEngine(); break;
      case 'ninja': // SHADOW CLONE
        this.world.allies?.addClone(this, this.char.cloneTime + this.stats.cloneTime);
        this.world.effects.spawnRing(this.position, 0x8a7aff, 3, 0.45);
        this.world.effects.spawnSparks(this.position.clone().setY(1.2), 0x3a2a6a, 14, 6);
        this.world.sfx('teleport');
        break;
      default: this.startSpin(); if (this.stats.m?.sHeal) this.heal(this.maxHp * 0.15); // MASTERY Overdrive Mend
    }
  }

  // the ultimate is over (or cancelled in CoreBurnZ): back to normal, tidy the visuals
  endUlt() {
    this.state = 'normal'; this.stateTime = 0; this.spinRing.visible = false;
    this.model.body.rotation.y = 0; this.model.root.position.y = 0; this.model.body.position.y = 0;
  }

  ultUpdate(dt, dir, moving, walk) {
    const c = this.char, s = this.stats;
    const end = () => this.endUlt();
    switch (this.kit) {
      case 'zaleks': // a short hop, then the slam lands
        if (!this.ultDone && this.stateTime >= 0.4) { this.ultDone = true; this.seismicSlam(); }
        if (this.stateTime >= 0.75) end();
        return;
      case 'iskra': { // Needle Storm: move freely, a fan of needles every volley
        if (moving) { this.velocity.copy(dir).multiplyScalar(walk); this.turnTowards(Math.atan2(dir.x, dir.z), dt, 14); }
        this.spinTick -= dt;
        if (this.spinTick <= 0) { this.spinTick = c.stormRate; this.stormVolley(); }
        if (this.stateTime >= c.stormTime + s.stormTime) end();
        return;
      }
      case 'orin':
        if (moving) this.velocity.copy(dir).multiplyScalar(walk * 0.5);
        if (this.stateTime >= 0.6) end();
        return;
      case 'ninja': // a quick hand-sign, then back to work while the clone fights
        if (moving) this.velocity.copy(dir).multiplyScalar(walk * 0.7);
        if (this.stateTime >= 0.35) end();
        return;
      default:
        if (moving) this.velocity.copy(dir).multiplyScalar(c.speed * 0.75 * s.speed);
        this.spinTick -= dt;
        if (this.spinTick <= 0) { this.spinTick = c.spinTick; this.spinHits(); }
        if (this.stateTime >= c.spinTime + s.spinTime) end();
    }
  }

  // ---------- melee combo (SARROW, ZALEKS) ----------

  startAttack(step, moveDir) {
    this.state = 'attack';
    this.comboStep = step;
    this.world.sfx('slash', this.kit === 'zaleks' ? step + 1 : step);
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
    const zal = this.kit === 'zaleks';
    const fin = this.comboStep === this.combo.length;
    const range = hit.range * (zal ? s.bash : s.range);
    const knock = hit.knockback * (zal ? s.bashKnock : 1);
    const arcDot = hit.arc ?? (0.35 - 0.05 * s.arcLevel); // Wide Arc swings wider; Zaleks' bash is wide anyway
    let hitSomething = false;
    const struck = new Set();
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const to = new THREE.Vector3().subVectors(e.position, this.position);
      to.y = 0;
      const dist = to.length();
      if (dist > range + e.radius) continue;
      to.normalize();
      // only hit enemies in front of us, or really close ones
      if (forward.dot(to) < arcDot && dist > 1) continue;
      this.strike(e, hit.damage * (zal ? s.bashDmg : s.arcDmg), to.x * knock, to.z * knock, fin, 'slash');
      this.world.effects.spawnSparks(e.position.clone().setY(1.1), fin ? 0xffa040 : (zal ? 0xffd090 : 0x9ffff5), fin ? 12 : 6);
      struck.add(e);
      hitSomething = true;
      if (RULES.z && !zal && this.kit === 'sarrow') this.world.allies?.addBleed(this, e, fin ? 2 : 1); // CoreBurnZ BLEED
    }
    if (zal && fin) this.world.effects.spawnRing(this.position.clone().addScaledVector(forward, 1.8), 0xffa030, 1.6, 0.3);
    // Shockwave Finisher (Sarrow): the 3rd hit sends out a ring that hits everything around you
    if (fin && s.shock > 0) {
      const radius = 2.8 + 0.3 * s.shock, pct = 0.24 + 0.07 * s.shock;
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
    if (RULES.z && hitSomething && !zal && this.kit === 'sarrow') { // CoreBurnZ FLOW: +1 per swing that lands
      const was = this.flow || 0; this.flow = Math.min(5, was + 1);
      if (was < 5 && this.flow === 5) { this.world.effects.spawnRing(this.position, 0x3ff6e0, 2, 0.3); this.flowFull = true; }
    }
    if (RULES.z && fin && !zal && this.kit === 'sarrow') { // CoreBurnZ: BLADE WAVE
      this.world.allies?.fireWave(this, this.position, forward, hit.damage * s.arcDmg * ZK.waveDmg, { speed: ZK.waveSpeed, range: ZK.waveRange * s.range, color: this.damageMult > 1 ? 0xff3a2a : 0x9ffff5 });
    }
    if (hitSomething) {
      this.world.sfx('hit');
      this.world.shake(fin ? (zal ? 0.45 : 0.35) : 0.15);
      this.world.hitstop(fin ? 0.08 : 0.03);
    }
  }

  // ---------- SARROW: Blink + Overdrive ----------

  startDash(direction) {
    this.state = 'dash';
    this.stateTime = 0;
    this.dashDir = direction.clone();
    this.facing = Math.atan2(direction.x, direction.z);
    this.spendCharge();
    this.dashHitSet = new Set();
    this.world.effects.spawnRing(this.position, 0x3ff6e0, 1.5, 0.3);
    this.world.sfx('blink');
    if (this.stats.m?.sAfter) { // MASTERY Afterimage: explodes where you started
      const p = this.position.clone(), fx = this.world.effects;
      fx.spawnWarning(p, 2.6, 0.6); fx.spawnSparks(p.clone().setY(1), 0x3ff6e0, 8, 2);
      this.mJobs.push({ t: 0.6, run: () => {
        fx.spawnRing(p, 0x3ff6e0, 2.6, 0.4); fx.spawnSparks(p.clone().setY(1), 0x9ffff5, 12, 6);
        for (const e of this.world.enemies.list) if (e.canBeHit && e.position.distanceTo(p) < 2.6 + e.radius) this.strike(e, this.char.dashDmg * this.stats.dashDmg * 1.2, 0, 0, true, 'dash');
        this.world.sfx('hit');
      } });
    }
  }

  dashHits() {
    const zal = this.kit === 'zaleks';
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit || this.dashHitSet.has(e)) continue;
      if (e.position.distanceTo(this.position) < this.char.dashWidth + e.radius) {
        this.dashHitSet.add(e);
        const k = this.char.dashKnock;
        let kx, kz;
        if (zal) { // the charge shoves them ahead and to the side
          kx = this.dashDir.x * k; kz = this.dashDir.z * k;
        } else { // the blink knocks enemies off to the side of the path
          const side = new THREE.Vector3(-this.dashDir.z, 0, this.dashDir.x);
          if (side.dot(new THREE.Vector3().subVectors(e.position, this.position)) < 0) side.negate();
          kx = side.x * k; kz = side.z * k;
        }
        this.strike(e, this.char.dashDmg * (zal ? this.stats.chargeDmg : this.stats.dashDmg), kx, kz, zal, 'dash');
        if (!zal && RULES.z && this.kit === 'sarrow') this.world.allies?.burstBleed(this, e); // CoreBurnZ: Blink bursts BLEED
        if (zal) this.stun(e, this.char.chargeStun + this.stats.chargeStun); // after the hit (a hit resets the flinch timer)
        if (zal && RULES.z && !e.isBoss && !e.dead && (this.dragged ||= []).length < ZK.dragMax) this.dragged.push(e); // CoreBurnZ: carried along
        this.world.effects.spawnSparks(e.position.clone().setY(1.1), zal ? 0xffd090 : 0x9ffff5, zal ? 10 : 6);
        this.world.shake(zal ? 0.2 : 0.12);
        this.world.sfx('hit');
      }
    }
  }

  startSpin() {
    this.spinRing.scale.setScalar(this.stats.spinRadius * this.char.spinRadius);
    this.spinRing.visible = true;
    this.world.effects.spawnRing(this.position, 0xe0702a, 4 * this.char.spinRadius, 0.5);
    this.world.shake(0.25);
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
        const k = this.char.spinKnock * (this.stats.m?.sPull ? -0.5 : 1); // MASTERY Overdrive Pull
        this.strike(e, this.char.spinHit * this.stats.spinDmg * this.char.spinDmg, to.x * k, to.z * k, true, 'spin');
        this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0xff8040, 4);
        this.world.sfx('hit');
      }
    }
  }

  // Stun a regular enemy (bosses shrug it off)
  stun(e, secs) {
    if (e.isBoss || this.world.netClient) return;
    e.stun = Math.max(e.stun || 0, secs);
  }

  // ---------- ZALEKS: Shoulder Charge + Seismic Slam ----------

  // CoreBurnZ: enemies the charge hits are pinned in front of Zaleks, then slammed when it ends
  dragUpdate() {
    if (!this.dragged?.length) return;
    const d = this.dashDir, side = new THREE.Vector3(-d.z, 0, d.x);
    this.dragged = this.dragged.filter((e) => !e.dead);
    this.dragged.forEach((e, i) => {
      const off = (i - (this.dragged.length - 1) / 2) * 0.9;
      e.position.set(this.position.x + d.x * (1.3 + e.radius) + side.x * off, e.position.y, this.position.z + d.z * (1.3 + e.radius) + side.z * off);
      e.knockback?.set?.(0, 0, 0);
      e.stun = Math.max(e.stun || 0, 0.25);
    });
  }
  dragSlam() {
    const list = (this.dragged || []).filter((e) => !e.dead);
    this.dragged = null;
    if (!list.length) return;
    const fx = this.world.effects, k = this.char.dashKnock * 0.6;
    fx.spawnRing(this.position.clone().addScaledVector(this.dashDir, 1.6), 0xffa030, 2.4, 0.35);
    for (const e of list) {
      this.world.arena.resolve(e.position, e.radius);
      this.strike(e, this.char.dashDmg * this.stats.chargeDmg * ZK.dragSlam, this.dashDir.x * k, this.dashDir.z * k, true, 'dash');
      this.stun(e, ZK.dragStun);
      fx.spawnSparks(e.position.clone().setY(1), 0xffd090, 8);
    }
    this.world.shake(0.4); this.world.hitstop(0.05); this.world.sfx('hit');
  }

  startCharge(direction) {
    this.state = 'dash';
    this.stateTime = 0;
    this.dashDir = direction.clone();
    this.facing = Math.atan2(direction.x, direction.z);
    this.spendCharge();
    this.dashHitSet = new Set();
    this.world.effects.spawnRing(this.position, 0xffa030, 1.8, 0.3);
    this.world.sfx('blink');
    this.world.shake(0.15);
  }

  seismicSlam(echo = 0) {
    const c = this.char, s = this.stats;
    const quake = !echo && RULES.z && (this.rage || 0) >= ZK.rageMax; // CoreBurnZ: full Rage = QUAKE
    if (quake) {
      this.rage = 0;
      this.world.effects.spawnRing(this.position, 0xff3a1a, c.slamRadius * s.slamRadius * ZK.quakeRadius * 1.1, 0.8);
      this.world.effects.spawnSparks(this.position.clone().setY(0.6), 0xff5a20, 24, 9);
      this.world.shake(1);
    }
    const radius = c.slamRadius * s.slamRadius * (quake ? ZK.quakeRadius : 1);
    if (!echo && s.m?.zAfter) this.mJobs.push({ t: 0.7, run: () => { if (!this.dead) this.seismicSlam(0.6); } }); // MASTERY Aftershock
    this.world.effects.spawnRing(this.position, 0xffa030, radius, 0.6);
    this.world.effects.spawnRing(this.position, 0xff5a20, radius * 0.6, 0.45);
    this.world.shake(0.6);
    this.world.hitstop(0.08);
    this.world.sfx('overdrive');
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const to = new THREE.Vector3().subVectors(e.position, this.position).setY(0);
      const d = to.length();
      if (d > radius + e.radius) continue;
      to.normalize();
      this.strike(e, c.slamDmg * s.spinDmg * s.slamDmg * (echo || 1) * (quake ? ZK.quakeDmg : 1), to.x * c.slamKnock, to.z * c.slamKnock, true, 'spin');
      this.stun(e, quake ? Math.max(c.slamStun, ZK.quakeStun) : c.slamStun);
      this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0xffa030, 6);
    }
    if (echo) return; // the aftershock is just damage
    // TAUNT: everything nearby (and any boss) comes for Zaleks; the shield soaks it
    this.tauntTimer = c.tauntTime + s.taunt;
    this.tauntRadius = c.tauntRadius;
    this.shieldHp = this.maxHp * c.shieldPct * s.shield;
    this.shieldTimer = c.shieldTime + s.taunt;
    this.guard.visible = true;
  }

  // ---------- ISKRA: Needles, Phase Hop, Needle Storm ----------

  // Nearest enemy in the move direction (a 120 degree cone), or the nearest at all when standing still
  aimTarget(dir, moving, range) {
    let best = null, bd = range;
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const dx = e.position.x - this.position.x, dz = e.position.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d >= bd) continue;
      if (moving && d > 1.5 && (dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z)) < 0.5) continue;
      best = e; bd = d;
    }
    return best;
  }

  needleUpdate(dir, moving) {
    if (this.fireCd > 0) return;
    const nd = this.char.needle, s = this.stats;
    this.fireCd = nd.rate / this.char.atkSpeed;
    const t = this.aimTarget(dir, moving, nd.aimRange);
    let aim;
    if (t) aim = new THREE.Vector3(t.position.x - this.position.x, 0, t.position.z - this.position.z).normalize();
    else aim = moving ? dir.clone().normalize() : this.facingDir;
    this.facing = Math.atan2(aim.x, aim.z);
    this.aimLock = !!t;
    const color = this.damageMult > 1 ? 0xff3a2a : this.bladeColor;
    const star = this.kit === 'ninja';
    const opts = { pierce: nd.pierce + (star ? 0 : s.pierce), speed: nd.speed, range: nd.range, color, star, bounce: star ? nd.bounce + s.starPierce : 0 };
    if (star) {
      // KAGERO: every 4th throw is a FINISHER (a wide gold fan that ricochets once more)
      this.throwN = (this.throwN || 0) + 1;
      const fin = this.throwN % this.char.finisherEvery === 0;
      this.world.allies?.throwStars(this, this.position, this.facing, nd.damage, opts, s.starFan, fin);
      this.world.allies?.cloneThrow(this, t, fin); // the shadow clone copies the throw
      if (fin) { this.world.effects.spawnRing(this.position, 0xffd27a, 2.2, 0.25); this.world.sfx('zap'); }
      else if (this.throwN % this.char.finisherEvery === this.char.finisherEvery - 1) { // TELL: the next throw is the finisher
        this.world.effects.spawnRing(this.position, 0xffd27a, 1.1, 0.4);
        this.world.effects.spawnSparks(this.position.clone().setY(1.3), 0xffd27a, 6, 3);
      }
    } else this.world.allies?.fireNeedle(this, this.position, aim, nd.damage, opts);
    for (let i = 1; i <= (star ? 0 : s.split); i++) {
      for (const sgn of [-1, 1]) {
        const a = this.facing + sgn * 0.16 * i;
        this.world.allies?.fireNeedle(this, this.position, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), nd.damage * 0.2, opts);
      }
    }
    this.armFlip = !this.armFlip;
    this.world.sfx('slash', 1);
  }

  phaseHop(direction) {
    const c = this.char, s = this.stats;
    const from = this.position.clone();
    this.spendCharge();
    // teleport (stops short of the arena wall; resolve() pushes us out of any pillar we land in)
    const to = from.clone().addScaledVector(direction, c.hopDist * s.hopDist);
    this.position.copy(to);
    this.world.arena.resolve(this.position, this.radius);
    this.slide.set(0, 0, 0);
    this.facing = Math.atan2(direction.x, direction.z);
    this.phaseTimer = c.hopGuard * (s.m?.iGuard ? 2 : 1); // MASTERY Phase Guard
    this.state = 'dash';
    this.stateTime = 0;
    this.world.allies?.addDecoy(this, from, c.decoyTime + s.decoy, c.decoyHits + 2 * s.decoy);
    if (RULES.z) { const n = 2 + (s.mines || 0); for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n + this.facing; this.world.allies?.addMine(this, from.clone().add(new THREE.Vector3(Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1))); } } // CoreBurnZ NEEDLE MINES
    if (s.m?.iTwin) this.world.allies?.addDecoy(this, from.clone().add(new THREE.Vector3(-direction.z * 1.6, 0, direction.x * 1.6)), c.decoyTime + s.decoy, c.decoyHits + 2 * s.decoy); // MASTERY Twin Decoy
    this.world.effects.spawnRing(from, 0xc070ff, 1.4, 0.3);
    this.world.effects.spawnRing(this.position, 0xe8a0ff, 1.8, 0.3);
    this.world.effects.spawnSparks(this.position.clone().setY(1), 0xe8a0ff, 8);
    this.world.sfx('teleport');
  }

  // KAGERO: teleport just behind the nearest enemy ahead (or a short step), cutting everything on the way
  shadowStep(direction) {
    const c = this.char, s = this.stats, fx = this.world.effects;
    const from = this.position.clone();
    this.spendCharge();
    if (s.m?.nDecoy) this.world.allies?.addDecoy(this, from, 2.5, 3); // MASTERY Shadow Decoy
    const range = c.stepRange * s.stepRange, now = this.world.allies?.now ?? 0;
    let t = null, bd = range;
    for (const e of this.world.enemies.list) { // 1) the nearest MARKED enemy in range (any direction)
      if (!e.canBeHit || !(e.markT > now)) continue;
      const d = Math.hypot(e.position.x - from.x, e.position.z - from.z);
      if (d < bd && d > 0.01) { bd = d; t = e; }
    }
    const marked = !!t;
    if (!t) for (const e of this.world.enemies.list) { // 2) else the nearest enemy ahead (old rule, now longer reach)
      if (!e.canBeHit) continue;
      const dx = e.position.x - from.x, dz = e.position.z - from.z, d = Math.hypot(dx, dz);
      if (d > bd || d < 0.01 || (dx * direction.x + dz * direction.z) / d < 0.35) continue;
      bd = d; t = e;
    }
    let to;
    if (t) {
      const v = new THREE.Vector3(t.position.x - from.x, 0, t.position.z - from.z).normalize();
      to = new THREE.Vector3(t.position.x, 0, t.position.z).addScaledVector(v, t.radius + 0.9);
    } else to = from.clone().addScaledVector(direction, c.stepDist * s.stepRange);
    this.position.copy(to);
    this.world.arena.resolve(this.position, this.radius);
    this.slide.set(0, 0, 0);
    const seg = this.position.clone().sub(from).setY(0), len = seg.length() || 1;
    seg.divideScalar(len);
    this.facing = t ? Math.atan2(from.x - this.position.x, from.z - this.position.z) : Math.atan2(direction.x, direction.z); // face back at the target
    this.stepCut(from, seg, len, c.stepDmg * s.stepDmg);
    if (marked) { // consume the mark: bonus hit + part of the cooldown back (once per 1.2s)
      t.markT = 0;
      if (t.canBeHit) this.strike(t, c.stepDmg * s.stepDmg * c.markBonus, 0, 0, true, 'dash');
      fx.spawnRing(t.position, 0xff4ad8, 1.6, 0.3);
      if (now - (this.markRefundAt ?? -9) >= c.markRefundCd && this.dashCooldown > 0) { this.markRefundAt = now; this.dashCooldown *= 1 - c.markRefund; }
    }
    this.phaseTimer = c.stepGuard;
    this.state = 'dash';
    this.stateTime = 0;
    fx.spawnRing(from, 0x3a2a6a, 1.4, 0.3);
    fx.spawnRing(this.position, 0x8a7aff, 1.8, 0.3);
    for (let i = 1; i < 4; i++) fx.spawnSparks(from.clone().addScaledVector(seg, len * i / 4).setY(1), 0x5a4aa0, 3, 3); // shadow wake
    fx.spawnSparks(this.position.clone().setY(1), 0xc8c0ff, 8);
    this.world.sfx('teleport');
    this.world.allies?.cloneStep(this, direction);
  }
  // damage everything along a step (used by Kagero and his clone)
  stepCut(from, seg, len, dmg) {
    const hits = [];
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const dx = e.position.x - from.x, dz = e.position.z - from.z;
      const along = dx * seg.x + dz * seg.z;
      if (along < -0.5 || along > len + 1.2) continue;
      if (Math.abs(dx * seg.z - dz * seg.x) > 1.1 + e.radius) continue;
      this.strike(e, dmg, seg.x * 6, seg.z * 6, true, 'dash');
      this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0xc8c0ff, 4);
      hits.push(e);
    }
    // RETURNING EDGE: stars stay in what you cut, then fly back to you
    if (this.stats.ret && hits.length) this.world.allies?.embedStars(this, hits, dmg * 0.5 * (1 + 0.15 * this.stats.retMore), 1 + this.stats.retMore);
    return hits;
  }

  stormVolley() {
    const c = this.char, s = this.stats;
    const n = c.stormCount + s.stormCount;
    const t = this.aimTarget(null, false, 14);
    const base = t ? Math.atan2(t.position.x - this.position.x, t.position.z - this.position.z) : this.facing;
    const color = this.damageMult > 1 ? 0xff3a2a : 0xff80ff;
    const wobble = Math.sin(this.stateTime * 9) * 0.15;
    for (let i = 0; i < n; i++) {
      const a = base + wobble + (n > 1 ? (i / (n - 1) - 0.5) * 2 * c.stormSpread : 0);
      this.world.allies?.fireNeedle(this, this.position, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), c.stormDmg * s.spinDmg,
        { pierce: 1, speed: 28, range: 14, color, kind: 'spin' });
    }
    this.world.sfx('slash', 2);
  }

  // ---------- ORIN: Arc Tether, Magnet Grapple, Hymn Engine ----------

  tetherUpdate(dir, moving) {
    const b = this.char.beam, s = this.stats;
    const range = b.range * s.reach;
    let t = this.tether;
    if (!t || !t.canBeHit || t.position.distanceTo(this.position) > range * 1.25) t = this.tether = this.aimTarget(dir, moving, range) || this.findNearestEnemy(range);
    this.aimLock = !!t;
    if (t) this.facing = Math.atan2(t.position.x - this.position.x, t.position.z - this.position.z);
    if (this.fireCd > 0) return;
    this.fireCd = b.tick / this.char.atkSpeed;
    if (!t) return;
    const col = this.damageMult > 1 ? 0xff3a2a : this.bladeColor;
    const hand = this.position.clone().addScaledVector(this.facingDir, 0.6);
    this.world.effects.spawnZap(hand, t.position, col);
    this.strike(t, b.damage, 0, 0, false, 'beam');
    this.stun(t, b.lock); // locked on: the tethered enemy can't move or swing
    // chain to the next nearest enemies
    const done = new Set([t]);
    let src = t;
    for (let i = 0; i < b.chains + s.chains; i++) {
      let best = null, bd = b.chainRange;
      for (const e of this.world.enemies.list) {
        if (!e.canBeHit || done.has(e)) continue;
        const d = e.position.distanceTo(src.position);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      done.add(best);
      this.world.effects.spawnZap(src.position, best.position, col);
      this.strike(best, b.damage * b.chainPct, 0, 0, false, 'beam');
      src = best;
    }
    if (Math.random() < 0.35) this.world.sfx('zap');
  }

  grapple(direction) {
    const c = this.char, s = this.stats;
    this.spendCharge();
    this.dashHitSet = new Set();
    const range = c.grappleRange;
    // 1) an enemy in front of us (60 degree cone)
    let best = null, bd = range;
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const dx = e.position.x - this.position.x, dz = e.position.z - this.position.z, d = Math.hypot(dx, dz);
      if (d < bd && d > 0.5 && (dx * direction.x + dz * direction.z) / d > 0.85) { best = e; bd = d; }
    }
    const hand = this.position.clone().setY(1.1);
    if (best) {
      this.facing = Math.atan2(best.position.x - this.position.x, best.position.z - this.position.z);
      this.world.effects.spawnZap(hand, best.position, 0xff4a5a);
      this.world.sfx('zap');
      if (best.isBoss || best.type?.armored) { // too heavy: Orin reels himself in instead
        this.pullTo(best.position, best.radius + 0.9);
      } else { // yank it right up to Orin, stunned
        if (!this.world.netClient) {
          best.position.copy(this.position).addScaledVector(this.facingDir, 1.4 + best.radius);
          this.world.arena.resolve(best.position, best.radius);
        }
        this.strike(best, c.grappleDmg * (1 + 0.25 * s.grapple), 0, 0, true, 'dash');
        this.stun(best, c.grappleStun + 0.3 * s.grapple);
        if (s.m?.oChainG && !this.world.netClient) this.stormChain(best, c.grappleDmg * 0.6 * s.dmg); // MASTERY Chain Grapple
        this.world.effects.spawnSparks(best.position.clone().setY(1.1), 0xff4a5a, 10);
        this.state = 'dash'; this.stateTime = 0; this.dashDir = new THREE.Vector3(); this.dashLen = 0.12;
        this.world.shake(0.2);
      }
      return;
    }
    // 2) a pillar in front of us
    let pil = null, pd = range;
    for (const o of this.world.arena.obstacles) {
      const dx = o.x - this.position.x, dz = o.z - this.position.z, d = Math.hypot(dx, dz);
      if (d - o.r < pd && d > o.r + 0.6 && (dx * direction.x + dz * direction.z) / d > 0.85) { pil = o; pd = d - o.r; }
    }
    if (pil) {
      const p = new THREE.Vector3(pil.x, 0, pil.z);
      this.world.effects.spawnZap(hand, p, 0xff4a5a);
      this.world.sfx('zap');
      this.pullTo(p, pil.r + this.radius + 0.1);
      return;
    }
    // 3) nothing to grab: a short magnetic reel in the move direction
    this.dashDir = direction.clone();
    this.facing = Math.atan2(direction.x, direction.z);
    this.state = 'dash'; this.stateTime = 0;
    this.dashLen = c.reelDist / c.grappleSpeed;
    this.world.effects.spawnRing(this.position, 0xff4a5a, 1.4, 0.3);
    this.world.sfx('blink');
  }

  // CoreBurnZ ORIN: throw a Gravity Well at the biggest cluster ahead (or the nearest enemy, or 7 m ahead)
  gravityWell(direction) {
    this.spendCharge();
    let best = null, bn = 0;
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const dx = e.position.x - this.position.x, dz = e.position.z - this.position.z, d = Math.hypot(dx, dz);
      if (d > 12 || (d > 2 && (dx * direction.x + dz * direction.z) / d < 0.3)) continue;
      let n = 0; for (const o of this.world.enemies.list) if (o.canBeHit && o.position.distanceTo(e.position) < 4) n++;
      if (n > bn) { bn = n; best = e; }
    }
    const at = best ? best.position.clone() : this.position.clone().addScaledVector(direction, 7);
    this.world.arena.resolve(at, 0.5);
    this.facing = Math.atan2(at.x - this.position.x, at.z - this.position.z);
    this.world.effects.spawnZap(this.position.clone().setY(1.1), at.clone().setY(1), 0x5a8aff);
    this.world.allies?.addWell(this, at);
    this.state = 'dash'; this.stateTime = 0; this.dashDir = new THREE.Vector3(); this.dashLen = 0.15;
    this.world.sfx('zap');
  }

  pullTo(point, stopAt) {
    const to = new THREE.Vector3(point.x - this.position.x, 0, point.z - this.position.z);
    const d = Math.max(0, to.length() - stopAt);
    this.dashDir = to.normalize();
    this.facing = Math.atan2(to.x, to.z);
    this.dashLen = d / this.char.grappleSpeed;
    this.state = 'dash'; this.stateTime = 0;
    this.world.sfx('blink');
  }

  hymnEngine() {
    const c = this.char, s = this.stats;
    const at = this.position.clone().addScaledVector(this.facingDir, 2.5);
    this.world.arena.resolve(at, 0.5);
    this.world.allies?.addVortex(this, at, c.vortexTime, c.vortexRadius * s.vortex, c.vortexDmg * s.spinDmg, c.vortexTick);
    this.world.allies?.addDrones(this, c.drones + s.drones, c.droneTime + s.droneTime, c.droneDmg * s.droneDmg * s.spinDmg);
    this.spinRing.scale.setScalar(0.8);
    this.spinRing.visible = true;
    this.world.effects.spawnRing(at, 0xff4a5a, c.vortexRadius * s.vortex, 0.6);
    this.world.shake(0.3);
    this.world.sfx('overdrive');
  }

  // Every hit a hero lands goes through here: weapon tier, perks, FURY, crits, double hits, leech, chains.
  // kind: 'slash' | 'dash' | 'needle' | 'beam' (attacks) | 'spin' (ultimates) | 'drone' | 'shock' | 'trail'
  strike(e, base, kx, kz, heavy, kind) {
    if (this.world.netClient) return; // co-op client: the host decides all damage
    const s = this.stats;
    let dmg = base * s.dmg * this.char.dmg * zHero(this.char.id).dmg * this.damageMult;
    if (e.isBoss && s.bossDmg > 1) dmg *= s.bossDmg; // CoreBurnZ: Bossfang relic
    if (kind === 'beam' && RULES.z && e.wellUntil > performance.now() / 1000) dmg *= 1 + 0.3 + (s.wellAmp || 0); // CoreBurnZ: tether +30% inside a Gravity Well
    const crit = kind !== 'trail' && Math.random() < s.crit;
    if (crit) {
      dmg *= s.critMult || 1.8;
      this.world.effects.spawnSparks(e.position.clone().setY(1.4), 0xfff27a, 5, 8);
    }
    const wasDead = e.dead;
    e.hit(dmg, kx, kz, heavy);
    if (RULES.z) this.zOnStrike(e, kind, !wasDead && e.dead);
    this.world.onComboHit?.(); // COMBO +1 per hit
    const attack = ATTACK_KINDS.has(kind);
    if (attack && kind !== 'dash' && Math.random() < s.twin) {
      e.hit(dmg, 0, 0, false); // Twin Strike
      this.world.effects.spawnSparks(e.position.clone().setY(1.1), 0x9ab8ff, 4);
    }
    // healing (capped per second so it can't make you unkillable)
    if (attack && s.leech > 0 && !this.cloneHit) this.leechHeal(s.leech, s.leechCap || 6); // the clone's hits don't heal you
    if (kind === 'spin' && s.spinLeech > 0) this.leechHeal(s.spinLeech, 10);
    if (attack) {
      this.world.onTalonHit?.(e, dmg, this); // ARC TALONS power-up
      if (Math.random() < s.storm) this.stormChain(e, dmg * 0.35);
    }
  }

  // CoreBurnZ: Sarrow's Overdrive kills refund Blink; Zaleks' hits build a little Rage
  zOnStrike(e, kind, killed) {
    if (this.kit === 'sarrow' && killed && this.state === 'spin' && this.dashCharges < this.maxCharges) {
      const now = performance.now() / 1000;
      if (now - (this.blinkResetAt ?? -9) >= ZK.blinkResetCd) {
        this.blinkResetAt = now;
        this.dashCharges++;
        this.dashCooldown = this.dashCharges < this.maxCharges ? this.dashCooldownMax : 0;
        this.world.effects.spawnRing(this.position, 0x3ff6e0, 1.4, 0.25);
      }
    } else if (this.kit === 'zaleks' && kind !== 'spin') this.addRage(ZK.rageHit);
  }
  addRage(n) {
    if (!RULES.z || this.kit !== 'zaleks' || this.dead) return;
    const was = this.rage || 0;
    this.rage = Math.min(ZK.rageMax, was + n);
    if (was < ZK.rageMax && this.rage >= ZK.rageMax) { this.world.effects.spawnRing(this.position, 0xff3a1a, 2.2, 0.4); this.world.sfx('powerup'); }
  }
  get rageFrac() { return (this.rage || 0) / ZK.rageMax; }

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
    this.maxHp = Math.round(this.char.hp * zHero(this.char.id).hp * (1 + s.maxHpPct)) + s.maxHpFlat;
    const charges = s.dashCharges + this.char.dashCharges - 1; // Extra Blink / Extra Hop
    if (this.hp !== undefined) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
    this.dashCooldownMax = this.char.dashCd * s.dashCd;
    this.spinCooldownMax = this.char.ultCd * s.spinCd;
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
    if (this.dead) return false;
    if (this.state === 'dash' && (this.kit === 'sarrow' || this.kit === 'orin')) return false; // blinking / grappling = untouchable
    if (this.phaseTimer > 0) return false;               // ISKRA: just phased
    if (this.invulnTimer > 0) return false;              // just revived
    if (this.world.powerups && this.world.powerups.absorb(opts, this)) return false; // SHIELD
    const c = this.char;
    if (this.state === 'spin' && c.spinGuard) amount *= 1 - c.spinGuard; // overdrive = tougher
    amount *= 1 - (c.armor || 0);                         // ZALEKS' plating
    if (this.kit === 'zaleks') {
      if (this.state === 'dash') amount *= 1 - c.chargeGuard;
      // frontal block while swinging
      if (this.state === 'attack' && source && source.position) {
        const dx = source.position.x - this.position.x, dz = source.position.z - this.position.z, d = Math.hypot(dx, dz) || 1;
        if ((dx * Math.sin(this.facing) + dz * Math.cos(this.facing)) / d > 0.3) {
          amount *= 1 - (c.block + this.stats.block);
          this.world.effects.spawnSparks(this.position.clone().addScaledVector(this.facingDir, 0.8).setY(1.2), 0xffd090, 4);
        }
      }
    }
    if (this.stats.shell && this.world.allies?.drones.some((d) => d.owner === this && d.life > 0)) amount *= 1 - this.stats.shell; // ORIN: Hymn Shell
    amount *= this.stats.hurtMult || 1;                   // cursed cards (Greed Engine, Glass Heart)
    if (this.shieldHp > 0) {                              // ZALEKS' slam shield soaks it first
      const soak = Math.min(this.shieldHp, amount);
      this.shieldHp -= soak;
      amount -= soak;
      if (this.shieldHp <= 0) { this.shieldTimer = 0; this.world.effects.spawnRing(this.position, 0xffa030, 1.8, 0.3); }
      if (amount <= 0) { this.world.sfx('shieldBlock'); return true; }
    }
    if (this.kit === 'sarrow' && RULES.z && amount > 0 && this.flow) this.flow = this.stats.unbroken ? Math.floor(this.flow / 2) : 0; // FLOW drops
    if (this.kit === 'zaleks' && RULES.z && amount > 0) {
      this.addRage(amount * ZK.rageHurt);
    }
    this.hp -= amount;
    source?.onHurtHero?.(amount);                       // CoreBurnZ: Vampiric affix heals off you
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
    this.guard.visible = false;
    this.shieldHp = 0; this.tauntTimer = 0;
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

    const kit = this.kit;
    if (this.state === 'attack' && (kit === 'iskra' || kit === 'orin' || kit === 'ninja')) {
      // ranged: aim the arm at the target, the other arm flicks (needles) or stays raised (tether)
      const flick = kit !== 'orin' ? Math.max(0, this.fireCd) / (kit === 'ninja' ? 0.2 : 0.14) : 0.3 + 0.1 * Math.sin(performance.now() / 40);
      if (kit !== 'orin' && this.armFlip) { m.armL.rotation.set(-1.5 + flick * 0.4, 0, 0.1); m.armR.rotation.set(-0.9, 0, -0.2); }
      else { m.armR.rotation.set(-1.5 + flick * 0.4, 0, -0.1); m.armL.rotation.set(kit === 'orin' ? -1.3 : -0.9, 0, 0.2); }
    } else if (this.state === 'attack') {
      const hit = this.combo[Math.max(0, this.comboStep - 1)] || this.combo[0];
      const t = Math.min(1, this.stateTime / (hit.duration / this.char.atkSpeed));
      const n = this.combo.length;
      const e = 1 - Math.pow(1 - t, 3); // ease out
      if (kit === 'zaleks' && this.comboStep === 1) {
        // shield-bash: the left arm punches straight out
        m.armL.rotation.set(THREE.MathUtils.lerp(-0.4, -1.7, e), 0, 0.1);
        m.body.rotation.x = e * 0.15;
      } else if (this.comboStep === 1) {
        // left arm sweeps from the outside across the body
        m.armL.rotation.set(-1.5, 0, THREE.MathUtils.lerp(1.3, -0.9, e));
      } else if (this.comboStep === 2 && n > 2) {
        m.armR.rotation.set(-1.5, 0, THREE.MathUtils.lerp(-1.3, 0.9, e));
      } else {
        // both arms come down from overhead
        const x = THREE.MathUtils.lerp(-2.9, -0.8, e);
        m.armL.rotation.set(x, 0, 0.2);
        m.armR.rotation.set(x, 0, -0.2);
        m.body.rotation.x = e * 0.25;
      }
      const fin = this.comboStep === n;
      if (t > 0.3 && t < 0.6) {
        this.slashArc.material.opacity = fin ? 0.75 : 0.55;
        // finisher is orange at first; from weapon tier 3 every swing glows in the talons' tier colour
        this.slashArc.material.color.setHex(this.damageMult > 1 ? 0xff3a2a : (fin && this.loadout.tier < 3 ? 0xffa040 : this.bladeColor));
        this.slashArc.scale.set(this.comboStep === 2 && !fin ? -1 : 1, 1, 1).multiplyScalar((fin ? 1.2 : 1) * (kit === 'zaleks' ? this.stats.bash * 1.05 : this.stats.range));
      }
    } else if (this.state === 'dash') {
      if (kit === 'zaleks') { // shoulder first
        m.body.rotation.x = 0.35; m.body.rotation.y = 0.5;
        m.armL.rotation.set(-0.3, 0, 0.6); m.armR.rotation.set(0.6, 0, -0.2);
      } else if (kit === 'iskra' || kit === 'ninja') { // blink-in: crouched, arms spread
        m.body.rotation.x = 0.3;
        m.armL.rotation.set(0.4, 0, 1.2); m.armR.rotation.set(0.4, 0, -1.2);
      } else if (kit === 'orin') { // reeling in on the magnet line
        m.body.rotation.x = 0.4;
        m.armR.rotation.set(-1.7, 0, -0.1); m.armL.rotation.set(0.8, 0, 0.2);
      } else {
        m.body.rotation.x = 0.5; // lean forward
        m.armL.rotation.set(0.9, 0, 0.2);
        m.armR.rotation.set(0.9, 0, -0.2);
      }
    } else if (this.state === 'spin') {
      if (kit === 'zaleks') { // hop up, then smash both fists down
        const t = this.stateTime;
        m.body.position.y = t < 0.4 ? Math.sin((t / 0.4) * Math.PI * 0.5) * 1.1 * (1 - Math.max(0, t - 0.3) / 0.1) : 0;
        const x = t < 0.3 ? -2.9 : THREE.MathUtils.lerp(-2.9, -0.5, Math.min(1, (t - 0.3) / 0.1));
        m.armL.rotation.set(x, 0, 0.3); m.armR.rotation.set(x, 0, -0.3);
        m.body.rotation.x = t > 0.4 ? 0.35 : -0.1;
      } else if (kit === 'iskra') { // arms wide, needles everywhere
        m.armL.rotation.set(-1.3, 0, 0.9 + Math.sin(this.stateTime * 30) * 0.3);
        m.armR.rotation.set(-1.3, 0, -0.9 - Math.sin(this.stateTime * 30) * 0.3);
        this.spinRing.rotation.z -= dt * 10;
      } else if (kit === 'ninja') { // hand-sign: both hands together in front of the mask
        m.armL.rotation.set(-1.9, 0, -0.5); m.armR.rotation.set(-1.9, 0, 0.5);
      } else if (kit === 'orin') { // conducting the hymn: arms raised
        m.armL.rotation.set(-2.7, 0, 0.5); m.armR.rotation.set(-2.7, 0, -0.5);
        m.body.rotation.x = -0.15;
        this.spinRing.rotation.z += dt * 12;
      } else {
        m.body.rotation.y += dt * 24; // overdrive whirlwind!
        m.armL.rotation.set(-0.2, 0, 1.5);
        m.armR.rotation.set(-0.2, 0, -1.5);
        this.spinRing.rotation.z -= dt * 18;
      }
    }
    if (this.guard.visible) this.guard.material.opacity = 0.14 + 0.08 * Math.sin(performance.now() / 120);

    // flash red when hurt
    const reviveGlow = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 8) % 2 === 0;
    this.setFlash(this.hurtTimer > 0 ? 0x990000 : ((this.state === 'spin' && kit === 'sarrow') || reviveGlow ? 0x0a3a36 : (this.tauntTimer > 0 ? 0x3a1a00 : 0x000000)));
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


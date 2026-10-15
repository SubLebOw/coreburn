// waves.js
// Endless mode: the waves never stop, they just keep getting harder.
//
// Scaling rules for wave n (tweak these to change the difficulty curve):
//   enemies per wave  = 4 + 2n           (no limit)
//   max on screen     = min(6 + n, 14)   (capped so phones stay smooth; harder waves get
//                                          tougher enemies instead of more of them)
//   enemy health      x (1 + 0.14 * (n-1))   - grows forever
//   enemy damage      x (1 + 0.07 * (n-1))   - grows forever
//   enemy speed       x (1 + min(0.5, 0.025 * (n-1)))  - tops out at +50% so it stays fair
//   elite chance      = min(50%, 4% per wave after wave 5)
//   new enemy types unlock: hounds (wave 2), spitters (3), bulwarks (4), splitters (6)
//   every 5th wave is a BOSS round instead (7 bosses take turns, see bosses.js;
//   each time round the rotation they get faster and nastier)
import * as THREE from 'three';
import { Enemy } from './enemy.js';
import { bossForNumber } from './bosses.js';
import { RULES, Z_TUNING } from './rules.js';
import { tickBossPhase } from './boss-phases.js';
import { makeGolden } from './golden.js';

const SCREEN_CAP = 14;        // regular enemies alive at once (not counting mites/summons)
const HARD_CAP = 24;          // (co-op: 30)          // absolute limit including splitter mites and boss summons

// Which enemy types can appear from which wave, and how common they are
const UNLOCKS = [
  { type: 'acolyte', wave: 1, weight: 5 },
  { type: 'hound', wave: 2, weight: 3 },
  { type: 'spitter', wave: 3, weight: 2 },
  { type: 'bulwark', wave: 4, weight: 1.3 },
  { type: 'splitter', wave: 6, weight: 1.6 },
];
// COREBURNZ ONLY: five later-stage Grindchoir types join the mix (classic never sees them)
const Z_UNLOCKS = [
  { type: 'thurible', wave: 12, weight: 1.1 },
  { type: 'lancer', wave: 15, weight: 1.0 },
  { type: 'mender', wave: 18, weight: 0.6 },
  { type: 'grub', wave: 22, weight: 1.0 },
  { type: 'bomber', wave: 26, weight: 1.0 },
];

export function waveStats(n) {
  return {
    hpMult: 1 + 0.14 * (n - 1),
    dmgMult: 1 + 0.07 * (n - 1),
    speedMult: 1 + Math.min(0.5, 0.025 * (n - 1)),
    eliteChance: Math.min(0.5, Math.max(0, (n - 5) * 0.04)),
  };
}

export const isBossWave = (n) => n % 5 === 0;

export class WaveManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = []; // every enemy + boss currently in the arena
    this.reset();
  }

  reset() {
    for (const e of this.list) e.dispose();
    this.list = [];
    this.wave = 0;
    this.queue = [];
    this.eliteQueue = [];
    this.waveActive = false;
    this.breakTimer = 0;
    this.bosses = [];   // usually one boss, two for the Forge Twins
    this.golden = false;
    this.mutator = null;
    this.bossTimer = 0;
    this.nextNid = this.nextNid || 0;
  }

  // The boss for the HUD (first one still standing)
  get boss() { return this.bosses.find((b) => !b.dead) || null; }

  // What the boss health bar shows: twins share one bar
  get bossBar() {
    const alive = this.bosses.filter((b) => !b.dead);
    if (!alive.length || alive.every((b) => b.state === 'intro')) return null;
    let hp = 0, maxHp = 0;
    for (const b of this.bosses) { hp += Math.max(0, b.hp); maxHp += b.maxHp; }
    return { name: this.golden ? this.bossDef.name.replace(/^(THE )?/, (m) => m + 'GOLDEN ') : this.bossDef.name, hp, maxHp, golden: this.golden };
  }

  // Called by a boss when it dies. The fight is won when every part is down.
  bossDown(boss) {
    if (this.bosses.every((b) => b.dead)) this.world.onBossKilled(boss, this.bosses);
    else this.world.onTwinDown?.(boss, this.boss);
  }

  get aliveCount() { return this.list.filter((e) => !e.dead).length; }

  startWave(n) {
    this.wave = n;
    this.stats = waveStats(n);
    this.stats.hpMult *= this.world.coopHp || 1; // co-op: tougher enemies
    // MUTATOR wave? (see mutators.js; main.js decides which one)
    const mut = this.mutator = isBossWave(n) ? null : (this.world.mutatorFor?.(n) || null);
    if (mut) {
      this.stats.hpMult *= mut.hp || 1;
      this.stats.dmgMult *= mut.dmg || 1;
      this.stats.speedMult *= mut.speed || 1;
      this.stats.eliteChance = Math.min(0.85, this.stats.eliteChance + (mut.elite || 0));
    }
    this.queue = [];
    this.waveActive = true;
    this.spawnTimer = 0.8;
    this.world.onWaveBegin?.(n); // lets main.js switch arenas before anything spawns

    if (isBossWave(n)) {
      // Boss round: just the boss (plus whatever it summons)
      const bossNumber = n / 5;
      const { entry, tier } = this.world.rushEntry?.(bossNumber) || bossForNumber(bossNumber); // boss rush: weekly order
      this.bossEntry = entry;
      this.bossDef = entry.def;
      this.bossTier = tier;
      this.bossNumber = bossNumber;
      this.bossTimer = 1.8; // short pause so the banner can show first
      this.world.onBossWave(n, entry.def);
      return;
    }

    const total = Math.round((4 + 2 * n) * (this.world.coopCount || 1) * (mut?.count || 1)); // co-op / SWARM: more enemies
    const pool = (RULES.z ? UNLOCKS.concat(Z_UNLOCKS) : UNLOCKS).filter((u) => n >= u.wave);
    const totalWeight = pool.reduce((s, u) => s + u.weight, 0);
    const rng = this.world.waveRng?.(n) || Math.random; // daily challenge: the same mix + elites for everyone
    this.eliteQueue = [];
    for (let i = 0; i < total; i++) {
      let r = rng() * totalWeight;
      const pick = pool.find((u) => (r -= u.weight) <= 0) || pool[0];
      this.queue.push(pick.type);
      this.eliteQueue.push(rng() < this.stats.eliteChance);
    }
    this.maxAlive = Math.min(Math.round((6 + n) * Math.min(1.5, this.world.coopCount || 1)), this.world.coopCount > 1 ? 20 : SCREEN_CAP);
    this.world.onWaveStart(n);
  }

  update(dt) {
    const player = this.world.player;

    if (this.waveActive) {
      if (this.bossTimer > 0) {
        this.bossTimer -= dt;
        if (this.bossTimer <= 0) this.spawnBoss();
      }
      this.spawnTimer -= dt;
      const regularAlive = this.list.filter((e) => !e.dead && !e.summoned && !e.isBoss).length;
      if (this.queue.length > 0 && this.spawnTimer <= 0 && regularAlive < this.maxAlive) {
        const pos = this.world.arena.randomSpawnPoint(player.position, 9);
        this.spawnAt(this.queue.shift(), pos, false, this.eliteQueue.shift());
        this.spawnTimer = Math.max(0.2, 0.7 - this.wave * 0.02) + Math.random() * 0.3;
      }
      if (this.queue.length === 0 && this.bossTimer <= 0 && this.aliveCount === 0) {
        this.waveActive = false;
        this.breakTimer = 3;
        this.world.onWaveCleared(this.wave);
      }
    } else if (this.wave > 0 && !player.dead) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0 && !this.world.runOver) this.startWave(this.wave + (this.world.waveStep || 1)); // boss rush: 5, 10, 15...
    }

    // co-op: each enemy goes for its own target (see main.js targetFor); solo: always the player
    for (const e of this.list) {
      let t = this.world.targetFor ? this.world.targetFor(e) : player;
      if (this.world.aggro && !this.world.netClient) t = this.world.aggro(e, t); // ZALEKS' taunt, ISKRA's decoys
      e.update(dt, t, this.list);
      if (e.isBoss && RULES.z && !this.world.netClient) tickBossPhase(e, dt); // CoreBurnZ: phase 2 + enrage
    }

    // remove anything whose death animation has finished
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].remove) {
        this.list[i].dispose();
        this.list.splice(i, 1);
      }
    }
  }

  // Spawn one regular enemy. `summoned` = created by a boss or a splitter (doesn't use the wave cap)
  spawnAt(typeName, pos, summoned = true, eliteRoll = null) {
    if (this.aliveCount >= (this.world.coopCount > 1 ? 30 : HARD_CAP)) return null;
    const p = pos.clone();
    this.world.arena.resolve(p, 0.6);
    const elite = typeName !== 'mite' && (eliteRoll ?? Math.random() < this.stats.eliteChance);
    const e = new Enemy(this.scene, typeName, p, { ...this.stats, elite }, this.world);
    e.summoned = summoned;
    e.nid = ++this.nextNid; // network id (co-op)
    this.list.push(e);
    this.world.effects.spawnRing(p, elite ? 0xffb020 : 0xc8ff3a, 2.2, 0.7);
    return e;
  }

  spawnBoss() {
    // appear on the far side of the arena from the player, on clear ground
    const p = this.world.player.position;
    const sx = -Math.sign(p.x || 1), sz = -Math.sign(p.z || 1);
    const arena = this.world.arena;
    // spot(x, z): z = how far out on the far side, x = sideways offset (used by the twins)
    const spot = (x, z) => arena.findClearSpot(new THREE.Vector3(sx * z + x * 0.7, 0, sz * z - x * 0.7 * sx * sz), 2.4);
    this.bosses = this.bossEntry.spawn({
      scene: this.scene, world: this.world, bossNumber: this.bossNumber, tier: this.bossTier, stats: this.stats, spot,
    });
    // GOLDEN boss (about 1 in 20): gold look, 1.5x health, 3x points, a scrap jackpot and maybe a rare skin
    this.golden = !!this.world.goldenRoll?.(this.bossNumber);
    this.bosses.forEach((b, i) => {
      b.nid = ++this.nextNid; b.part = i;
      b.maxHp *= (this.world.coopBossHp || 1) * (this.golden ? 1.5 : 1) * (RULES.z ? Z_TUNING.bossHp : 1); b.hp = b.maxHp; // CoreBurnZ: +10%
      if (this.golden) makeGolden(b);
    });
    for (const b of this.bosses) {
      this.list.push(b);
      this.world.effects.spawnRing(b.position, 0xff5a20, 5, 1.2);
    }
    this.world.shake(0.3);
  }

  // When the boss dies, every add it summoned crumbles too
  killAllAdds() {
    for (const e of this.list) if (!e.dead && !e.isBoss) { e.crumble = true; e.die(); }
  }
}

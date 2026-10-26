// powerups.js
// Glowing pickups that sometimes drop when you kill things:
//   normal enemies 3% (mites 1%), elites 15%, bosses always (plus some heal orbs).
// Walk over one to grab it. They vanish after 10 seconds (they blink first).
//
//   SLOW-MO     5s   everything except Sarrow moves at 35% speed
//   FURY        8s   double damage (red talons)
//   SHIELD     10s   blocks the next 3 hits (lava and lightning don't use up a charge)
//   MAGNET     10s   pulls pickups in from far away, and every kill drops a +5 heal orb
//   ARC TALONS 10s   your slashes and blinks chain lightning to 3 nearby enemies
import * as THREE from 'three';
import { RULES, Z_TUNING } from './rules.js?v=1.34.0';
const Z_SHIELD_TIME = 1e6;

export const POWERUPS = {
  slowmo: { label: 'SLOW', name: 'SLOW-MO', color: 0x3cf0e0, duration: 5, weight: 1.2, hint: 'Time slows down!' },
  fury:   { label: 'FURY', name: 'FURY', color: 0xff3a2a, duration: 8, weight: 1, hint: 'Double damage' },
  shield: { label: 'SHIELD', name: 'SHIELD', color: 0x7fd8ff, duration: 10, weight: 1, hint: 'Blocks 3 hits', hits: 3 },
  magnet: { label: 'MAGNET', name: 'MAGNET', color: 0xb8ff4a, duration: 10, weight: 0.8, hint: 'Kills drop heal orbs' },
  arc:    { label: 'ARC', name: 'ARC TALONS', color: 0x8ab4ff, duration: 10, weight: 1, hint: 'Hits chain lightning' },
};
const TYPES = Object.keys(POWERUPS);
const PICKUP_LIFE = 10;
const ORB_LIFE = 8;
const MAX_PICKUPS = 3;
const SLOW_SCALE = 0.35;

export class PowerUps {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pickups = [];
    this.orbs = [];
    this.nextId = 0;
    // one shape per power-up so they're easy to tell apart
    this.geos = {
      slowmo: new THREE.OctahedronGeometry(0.42),
      fury: new THREE.TetrahedronGeometry(0.5),
      shield: new THREE.IcosahedronGeometry(0.4),
      magnet: new THREE.TorusGeometry(0.3, 0.11, 6, 14),
      arc: new THREE.OctahedronGeometry(0.34),
    };
    this.ringGeo = new THREE.RingGeometry(0.55, 0.75, 24);
    this.orbGeo = new THREE.SphereGeometry(0.2, 8, 6);
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0x6aff7a });
  }

  reset() {
    this.clearFloor();
    for (const h of this.heroes) { for (const t of Object.keys(h.powers || {})) this.end(t, true, h); h.powers = {}; }
  }

  // Arena change: remove everything lying on the floor (active power-ups keep running)
  clearFloor() {
    while (this.pickups.length) this.removePickup(this.pickups[0]);
    for (const o of this.orbs) this.scene.remove(o.obj);
    this.orbs = [];
  }

  // Power-ups belong to whoever grabbed them (co-op: each hero has their own). SLOW-MO slows the
  // whole world, so it counts if anyone has it.
  get heroes() { return this.world.heroes || [this.world.player]; }
  get active() { return this.world.player.powers; } // the local hero's (HUD)
  has(type, hero = this.world.player) { return !!(hero.powers && hero.powers[type]); }

  // How fast the world runs (main.js eases towards this)
  get timeScale() { return this.heroes.some((h) => this.has('slowmo', h)) ? SLOW_SCALE : 1; }

  // ---------- Drops ----------
  onKill(e) {
    if (!e.isBoss && e.crumble) return; // minions crumbling after a boss: no drops
    if (this.heroes.some((h) => this.has('magnet', h)) && !e.isBoss) this.dropOrb(e.position);
    let chance = e.isBoss ? 1 : e.elite ? 0.15 : e.typeName === 'mite' ? 0.01 : 0.03;
    if (Math.random() >= chance) return;
    this.drop(e.position, e.isBoss);
    if (e.isBoss) for (let i = 0; i < 4; i++) this.dropOrb(e.position.clone().add(new THREE.Vector3(Math.cos(i * 1.6) * 1.8, 0, Math.sin(i * 1.6) * 1.8)));
  }

  drop(at, force = false, type = null) {
    if (this.pickups.length >= MAX_PICKUPS) {
      if (!force) return null;
      this.removePickup(this.pickups[0]); // make room: bosses always drop
    }
    if (!type) {
      const total = TYPES.reduce((s, t) => s + POWERUPS[t].weight, 0);
      let r = Math.random() * total;
      type = TYPES.find((t) => (r -= POWERUPS[t].weight) <= 0) || TYPES[0];
    }
    const def = POWERUPS[type];
    const pos = this.world.arena.findClearSpot(at, 0.6);
    const obj = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 1 });
    const gem = new THREE.Mesh(this.geos[type], mat);
    gem.position.y = 0.9;
    const core = new THREE.Mesh(this.geos[type], new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.scale.setScalar(0.45);
    gem.add(core);
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    obj.add(gem, ring);
    obj.position.copy(pos);
    this.scene.add(obj);
    const p = { id: ++this.nextId, type, obj, gem, ring, mat, pos, life: PICKUP_LIFE, t: Math.random() * 6 };
    this.pickups.push(p);
    this.world.effects.spawnRing(pos, def.color, 1.6, 0.5);
    return p;
  }

  dropOrb(at) {
    if (this.orbs.length > 16) return;
    const obj = new THREE.Mesh(this.orbGeo, this.orbMat);
    obj.position.set(at.x + (Math.random() - 0.5), 0.5, at.z + (Math.random() - 0.5));
    this.scene.add(obj);
    this.orbs.push({ obj, life: ORB_LIFE, t: Math.random() * 6 });
  }

  removePickup(p) {
    this.scene.remove(p.obj);
    p.mat.dispose();
    p.ring.material.dispose();
    p.gem.children[0].material.dispose();
    this.pickups.splice(this.pickups.indexOf(p), 1);
  }

  // ---------- Grabbing and running out ----------
  activate(type, player = this.world.player) {
    const def = POWERUPS[type];
    player.powers = player.powers || {};
    if (type === 'shield' && RULES.z) {
      // COREBURNZ: a SHIELD CHARGE that blocks the next hit (stacks to 2, no timer)
      const had = player.powers.shield ? player.powers.shield.hits : 0;
      player.powers.shield = { time: Z_SHIELD_TIME, max: Z_SHIELD_TIME, hits: Math.min(Z_TUNING.shieldMax, had + 1), charges: true };
      player.bubble.visible = true;
      this.world.onPowerup?.(type, { ...def, hint: `Shield charge ${player.powers.shield.hits}/${Z_TUNING.shieldMax}: blocks the next hit` }, player);
      return;
    }
    player.powers[type] = { time: def.duration, max: def.duration, hits: def.hits || 0 };
    if (type === 'fury') player.damageMult = 2;
    if (type === 'shield') player.bubble.visible = true;
    this.refreshBlade(player);
    this.world.onPowerup?.(type, def, player);
  }

  end(type, silent = false, player = this.world.player) {
    if (!player.powers || !player.powers[type]) return;
    delete player.powers[type];
    if (type === 'fury') player.damageMult = 1;
    if (type === 'shield') player.bubble.visible = false;
    this.refreshBlade(player);
    if (!silent) this.world.onPowerupEnd?.(type, player);
  }

  refreshBlade(player = this.world.player) {
    player.setBladeColor(this.has('fury', player) ? 0xff4a3a : this.has('arc', player) ? 0x9ac4ff : player.tierColor);
  }

  // SHIELD: returns true if the hit was blocked
  absorb(opts = {}, player = this.world.player) {
    const s = player.powers && player.powers.shield;
    if (!s) return false;
    this.world.effects.spawnRing(player.position, 0x7fd8ff, 2, 0.3);
    this.world.sfx('shieldBlock');
    if (s.charges) { // COREBURNZ: every hit (hazards too) uses one charge
      s.hits--;
      this.world.effects.spawnSparks(player.position.clone().setY(1.2), 0x7fd8ff, 10, 6);
      if (s.hits <= 0) this.end('shield', false, player);
      return true;
    }
    if (!opts.hazard) {
      s.hits--;
      if (s.hits <= 0) this.end('shield', false, player);
    }
    return true;
  }

  // ARC TALONS: lightning jumps from the enemy you hit to up to 3 more nearby
  onTalonHit(target, damage, hero = this.world.player) {
    if (!this.has('arc', hero)) return;
    const fx = this.world.effects;
    const hit = new Set([target]);
    let from = target;
    for (let i = 0; i < 3; i++) {
      let best = null, bestD = 6 * (RULES.z ? Z_TUNING.arcRange : 1); // CoreBurnZ: +50% chain range
      for (const e of this.world.enemies.list) {
        if (!e.canBeHit || hit.has(e)) continue;
        const d = e.position.distanceTo(from.position);
        if (d < bestD) { best = e; bestD = d; }
      }
      if (!best) break;
      hit.add(best);
      fx.spawnZap(from.position, best.position, 0x9ac4ff);
      best.hit(damage * 0.6, 0, 0, false);
      fx.spawnSparks(best.position.clone().setY(1.1), 0xcfe0ff, 4);
      from = best;
    }
    if (hit.size > 1) this.world.sfx('zap');
  }

  // ---------- Every frame (realDt: pickups and timers run on real time, not slow-mo) ----------
  // visualOnly = co-op client: just spin/bob the pickups (the host decides who grabs what)
  update(realDt, visualOnly = false) {
    const heroes = this.heroes.filter((h) => !h.dead);
    // the closest living hero to obj (and the distance)
    const nearest = (obj) => {
      let best = null, bd = Infinity;
      for (const h of heroes) { const d = obj.position.distanceTo(h.position); if (d < bd) { bd = d; best = h; } }
      return [best, bd];
    };
    const pull = (obj, range, speed) => {
      const [h, d] = nearest(obj);
      if (h && this.has('magnet', h) && d < range && d > 0.01) {
        const k = Math.min(1, (speed * realDt) / d);
        obj.position.x += (h.position.x - obj.position.x) * k;
        obj.position.z += (h.position.z - obj.position.z) * k;
      }
      return nearest(obj);
    };

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= realDt;
      p.t += realDt;
      p.gem.rotation.y += realDt * 2.5;
      p.gem.position.y = 0.9 + Math.sin(p.t * 3) * 0.15;
      p.ring.scale.setScalar(1 + Math.sin(p.t * 4) * 0.1);
      // blink during the last 3 seconds
      p.obj.visible = p.life > 3 || Math.floor(p.life * 8) % 2 === 0;
      if (visualOnly) continue;
      const [h, d] = pull(p.obj, 10, 14);
      if (h && d < 1.2) {
        this.world.effects.spawnRing(p.obj.position, POWERUPS[p.type].color, 2.4, 0.4);
        this.removePickup(p);
        this.activate(p.type, h); // whoever grabs it gets it
        continue;
      }
      if (p.life <= 0) this.removePickup(p);
    }
    if (visualOnly) return;

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= realDt;
      o.t += realDt;
      o.obj.position.y = 0.5 + Math.sin(o.t * 5) * 0.1;
      o.obj.visible = o.life > 2 || Math.floor(o.life * 8) % 2 === 0;
      const [h, d] = pull(o.obj, 10, 16);
      if (h && d < 1.0) {
        if (!h.stats?.noOrbHeal) h.heal(5); // MYTHIC Glass Cannon: orbs don't heal
        this.world.sfx('heal');
        this.scene.remove(o.obj);
        this.orbs.splice(i, 1);
        continue;
      }
      if (o.life <= 0) { this.scene.remove(o.obj); this.orbs.splice(i, 1); }
    }

    for (const h of this.heroes) {
      if (h.dead || !h.powers) continue;
      for (const type of Object.keys(h.powers)) {
        const a = h.powers[type];
        if (!a.charges) a.time -= realDt; // COREBURNZ shield charges don't run out
        if (a.time <= 0) this.end(type, false, h);
      }
      if (h.powers.shield) h.bubble.material.opacity = 0.16 + 0.08 * Math.sin(performance.now() / 120);
    }
  }

  // For the HUD: [{ type, label, color, left (0-1), seconds, hits }]
  get hudList() { return this.listFor(this.world.player); }
  listFor(hero) {
    return Object.entries(hero.powers || {}).map(([type, a]) => ({
      type, label: POWERUPS[type].label, color: POWERUPS[type].color,
      left: a.charges ? a.hits / Z_TUNING.shieldMax : Math.max(0, a.time / a.max), seconds: a.charges ? 99 : Math.ceil(a.time), hits: a.hits, charges: !!a.charges,
    }));
  }
}

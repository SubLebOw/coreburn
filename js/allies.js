// allies.js
// Things the heroes' kits put into the arena (pooled meshes, cheap on phones):
//   - needles   (ISKRA's attack and Needle Storm)
//   - decoys    (ISKRA's Phase Hop leaves one; nearby enemies chase it instead of her)
//   - drones    (ORIN's Hymn Engine: little scrap drones that zap enemies)
//   - vortexes  (ORIN's Hymn Engine: drags enemies to its centre)
// Solo and co-op host: simulated here and every hit goes through the owner hero's strike().
// Co-op friends: never simulate; they draw what the host's snapshot says (serialize / applySnapshot).
import * as THREE from 'three';
import { CHARACTERS } from './characters.js';

// Returning Edge: stuck 2s, fly home, orbit 2s (hit each enemy at most every 0.45s for 30% of the return hit)
const RET_TIME = 2.0, ORBIT_TIME = 2.0, ORBIT_R = 1.7, ORBIT_HIT_CD = 0.45, ORBIT_DMG = 0.3, REFUND_CAP = 0.5;
const NEEDLES = 80, STARS = 100, DECOYS = 6, DRONES = 12, VORTEXES = 3, CLONES = 4;

export class Allies {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    const r2 = (x) => Math.round(x * 100) / 100;
    this.r2 = r2;
    this.mats = new Map();
    // needles: thin glowing spikes
    const ng = new THREE.BoxGeometry(0.09, 0.09, 0.75);
    this.needles = [];
    for (let i = 0; i < NEEDLES; i++) {
      const mesh = new THREE.Mesh(ng, this.mat(0xe8a0ff));
      mesh.visible = false;
      scene.add(mesh);
      this.needles.push({ mesh, vel: new THREE.Vector3(), life: 0, owner: null, dmg: 0, pierce: 0, hitSet: new Set(), color: 0xe8a0ff, target: new THREE.Vector3() });
    }
    // KAGERO's shurikens: flat 4-point stars that spin (same flight code as needles)
    const sg = new THREE.BoxGeometry(0.42, 0.05, 0.12), sg2 = new THREE.BoxGeometry(0.12, 0.05, 0.42);
    this.stars = [];
    for (let i = 0; i < STARS; i++) {
      const mesh = new THREE.Group();
      const a = new THREE.Mesh(sg, this.mat(0xc8c0ff)), b = new THREE.Mesh(sg2, a.material);
      const hub = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.16), this.mat(0x2a2440)); hub.rotation.y = Math.PI / 4;
      mesh.add(a, b, hub);
      mesh.visible = false; scene.add(mesh);
      this.stars.push({ mesh, parts: [a, b], vel: new THREE.Vector3(), life: 0, owner: null, dmg: 0, pierce: 0, hitSet: new Set(), color: 0xc8c0ff, target: new THREE.Vector3(), star: true });
    }
    // KAGERO's Shadow Clone: a translucent dark copy of his model
    this.clones = [];
    this.marks = [];
    for (let i = 0; i < CLONES; i++) {
      const m = CHARACTERS.ninja.build(null);
      const shade = new THREE.MeshBasicMaterial({ color: 0x2a2048, transparent: true, opacity: 0.72, depthWrite: true });
      const glow = new THREE.MeshBasicMaterial({ color: 0xa898ff, transparent: true, opacity: 0.9 });
      m.root.traverse((o) => { if (o.isMesh) { o.material = o.material.isMeshBasicMaterial ? glow : shade; o.castShadow = false; } });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0x8a7aff, transparent: true, opacity: 0.6, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; m.root.add(ring);
      m.root.visible = false; scene.add(m.root);
      this.clones.push({ m, life: 0, max: 1, owner: null, pct: 0.7, facing: 0, idle: 0, cd: 0, flick: 0, target: new THREE.Vector3(), position: new THREE.Vector3() });
    }
    // decoys: a translucent hologram pillar with a ring
    this.decoys = [];
    const dg = new THREE.CylinderGeometry(0.42, 0.5, 1.9, 8);
    const rg = new THREE.RingGeometry(0.6, 0.8, 24);
    for (let i = 0; i < DECOYS; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xc070ff, transparent: true, opacity: 0.4, depthWrite: false });
      const body = new THREE.Mesh(dg, mat); body.position.y = 0.95;
      const ring = new THREE.Mesh(rg, mat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      g.add(body, ring); g.visible = false; scene.add(g);
      this.decoys.push(this.makeDecoy(g, mat));
    }
    // drones: a small boxy hover-drone with a glowing eye
    this.drones = [];
    const bg = new THREE.BoxGeometry(0.5, 0.22, 0.5), eg = new THREE.BoxGeometry(0.16, 0.1, 0.1);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5a5560 });
    for (let i = 0; i < DRONES; i++) {
      const g = new THREE.Group();
      const eye = new THREE.Mesh(eg, this.mat(0xff4a5a)); eye.position.set(0, 0, 0.27);
      const wl = new THREE.Mesh(eg, this.mat(0xff9a8a)); wl.position.set(-0.33, 0.05, 0); wl.scale.set(1, 1, 3);
      const wr = wl.clone(); wr.position.x = 0.33;
      g.add(new THREE.Mesh(bg, bodyMat), eye, wl, wr); g.visible = false; scene.add(g);
      this.drones.push({ obj: g, eye, life: 0, owner: null, angle: 0, cd: 0, dmg: 0, target: new THREE.Vector3() });
    }
    // vortexes: two counter-rotating rings on the floor
    this.vortexes = [];
    const vg = new THREE.RingGeometry(0.82, 1, 40, 1, 0, Math.PI * 1.3); // thin swirling arcs
    for (let i = 0; i < VORTEXES; i++) {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
      const a = new THREE.Mesh(vg, mat), b = new THREE.Mesh(vg, mat);
      a.rotation.x = b.rotation.x = -Math.PI / 2; a.position.y = 0.06; b.position.y = 0.08; b.scale.setScalar(0.55);
      const c = new THREE.Mesh(vg, mat); c.scale.setScalar(0.45); c.rotation.z = Math.PI; b.add(c); // inner swirl spins with b
      g.add(a, b); g.visible = false; scene.add(g);
      this.vortexes.push({ obj: g, a, b, life: 0, owner: null, radius: 1, dmg: 0, tick: 0, tickLeft: 0 });
    }
  }

  mat(color) {
    if (!this.mats.has(color)) this.mats.set(color, new THREE.MeshBasicMaterial({ color }));
    return this.mats.get(color);
  }

  // A decoy looks like a hero to enemies: position, radius, dead, takeDamage (enemy melee calls it)
  makeDecoy(obj, mat) {
    const d = { obj, mat, life: 0, hits: 0, owner: null, position: new THREE.Vector3(), radius: 0.5, isDecoy: true, velocity: new THREE.Vector3(), state: 'normal' };
    Object.defineProperty(d, 'dead', { get: () => d.life <= 0 });
    d.takeDamage = () => {
      if (d.life <= 0) return false;
      d.hits--;
      this.world.effects.spawnSparks(d.position.clone().setY(1), 0xc070ff, 5);
      if (d.hits <= 0) this.popDecoy(d);
      return true;
    };
    d.heal = () => {};
    return d;
  }

  get host() { return !this.world.netClient; }

  // ---------- spawning (solo / host only) ----------
  fireNeedle(owner, from, dir, dmg, { pierce = 0, speed = 30, range = 15, color = 0xe8a0ff, kind = 'needle', star = false, clone = false, bounce = 0 } = {}) {
    if (!this.host) return;
    const n = (star ? this.stars : this.needles).find((x) => x.life <= 0);
    if (!n) return;
    n.owner = owner; n.dmg = dmg; n.pierce = pierce; n.kind = kind; n.hitSet.clear(); n.ret = null; n.clone = clone; n.bounce = bounce; n.speed = speed; n.range = range;
    n.vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
    n.life = range / speed;
    n.color = color;
    if (n.star) for (const p of n.parts) p.material = this.mat(color); else n.mesh.material = this.mat(color);
    n.mesh.position.set(from.x, 1.1, from.z).addScaledVector(n.vel, 0.02);
    n.mesh.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
    n.mesh.visible = true;
  }

  // ---------- KAGERO's Shadow Clone ----------
  addClone(owner, time) {
    if (!this.host) return;
    for (const c of this.clones) if (c.owner === owner) c.life = 0; // a new clone replaces the old one
    const c = this.clones.find((x) => x.life <= 0); if (!c) return;
    c.owner = owner; c.life = c.max = time; c.idle = 0; c.cd = 0.3;
    c.pct = (owner.char.clonePct || 0.7) + (owner.stats.cloneDmg || 0);
    const off = this.cloneSpot(owner);
    c.position.copy(off); c.facing = owner.facing;
    c.m.root.visible = true;
    this.world.effects.spawnRing(c.position, 0x8a7aff, 1.8, 0.35);
  }
  cloneSpot(o) { // stands just behind-left of its owner
    const a = o.facing + Math.PI * 0.75;
    return new THREE.Vector3(o.position.x + Math.sin(a) * 1.6, 0, o.position.z + Math.cos(a) * 1.6);
  }
  cloneOf(owner) { return this.clones.find((c) => c.owner === owner && c.life > 0); }
  // copies a throw: same target if it has one, else the owner's facing
  cloneThrow(owner, target, fin = false) {
    const c = this.cloneOf(owner); if (!c) return;
    c.idle = 0; this.cloneFire(c, target, fin);
  }
  cloneFire(c, target, fin = false) {
    const o = c.owner, nd = o.char.needle;
    const aim = target ? new THREE.Vector3(target.position.x - c.position.x, 0, target.position.z - c.position.z) : new THREE.Vector3(Math.sin(o.facing), 0, Math.cos(o.facing));
    if (aim.lengthSq() < 1e-4) return;
    aim.normalize(); c.facing = Math.atan2(aim.x, aim.z); c.flick = 0.15;
    const opts = { pierce: nd.pierce, bounce: (nd.bounce || 0) + (o.stats.starPierce || 0), speed: nd.speed, range: nd.range, color: 0xa898ff, star: true, clone: true };
    this.throwStars(o, c.position, c.facing, nd.damage * c.pct, opts, o.stats.starFan || 0, fin); // ricochet, marks, fan, finisher: all copied
  }
  // HOMECOMING: return + orbit hits shave the Step cooldown, but at most REFUND_CAP s per second (no abuse)
  retRefund(o) {
    const per = o.stats?.retCd; if (!per || !(o.dashCooldown > 0)) return;
    const now = performance.now() / 1000;
    o.retBudget = Math.min(REFUND_CAP, (o.retBudget ?? REFUND_CAP) + (now - (o.retBudgetT ?? now)) * REFUND_CAP);
    o.retBudgetT = now;
    const take = Math.min(per, o.retBudget); if (take <= 0) return;
    o.retBudget -= take; o.dashCooldown = Math.max(0.01, o.dashCooldown - take);
  }
  // RETURNING EDGE: `per` stars stick in each enemy cut, then fly back to the owner
  embedStars(owner, hits, dmg, per) {
    if (!this.host) return;
    for (const e of hits) for (let i = 0; i < per; i++) {
      const n = this.stars.find((x) => x.life <= 0); if (!n) return;
      const a = Math.random() * Math.PI * 2, r = (e.radius || 0.5) * 0.7;
      this.fireNeedle(owner, e.position, new THREE.Vector3(1, 0, 0), dmg, { star: true, color: 0x9a7aff, kind: 'needle', clone: !!owner.cloneHit });
      n.ret = { enemy: e, t: 0, phase: 'embed', ox: Math.sin(a) * r, oz: Math.cos(a) * r, dmg };
      n.vel.set(0, 0, 0);
    }
  }
  // copies a Shadow Step from where it stands
  cloneStep(owner, dir) {
    const c = this.cloneOf(owner); if (!c) return;
    const from = c.position.clone(), to = this.cloneSpot(owner);
    const seg = to.clone().sub(from), len = seg.length();
    if (len > 0.5) { owner.cloneHit = true; owner.stepCut(from, seg.divideScalar(len), len, owner.char.stepDmg * owner.stats.stepDmg * c.pct); owner.cloneHit = false; }
    c.position.copy(to);
    this.world.effects.spawnRing(to, 0x8a7aff, 1.4, 0.25);
  }

  addDecoy(owner, pos, time, hits) {
    if (!this.host) return;
    const d = this.decoys.find((x) => x.life <= 0) || this.decoys[0];
    d.owner = owner; d.life = time; d.hits = hits;
    d.position.set(pos.x, 0, pos.z);
    d.mat.color.setHex(owner.tint || owner.char.color);
    d.obj.position.copy(d.position); d.obj.visible = true;
    this.world.effects.spawnRing(d.position, 0xc070ff, 1.6, 0.35);
  }

  popDecoy(d) {
    d.life = 0; d.obj.visible = false;
    this.world.effects.spawnRing(d.position, 0xc070ff, 2.2, 0.4);
    this.world.sfx('zap');
  }

  addDrones(owner, count, time, dmg) {
    if (!this.host) return;
    // a new Hymn Engine replaces this hero's old drones
    for (const d of this.drones) if (d.owner === owner) { d.life = 0; d.obj.visible = false; }
    for (let i = 0; i < count; i++) {
      const d = this.drones.find((x) => x.life <= 0);
      if (!d) break;
      d.owner = owner; d.life = time; d.dmg = dmg; d.cd = 0.3 + i * 0.15;
      d.angle = (i / count) * Math.PI * 2;
      d.obj.position.set(owner.position.x, 1.8, owner.position.z);
      d.obj.visible = true;
    }
  }

  addVortex(owner, pos, time, radius, dmg, tick) {
    if (!this.host) return;
    const v = this.vortexes.find((x) => x.life <= 0) || this.vortexes[0];
    v.owner = owner; v.life = time; v.radius = radius; v.dmg = dmg; v.tick = tick; v.tickLeft = 0;
    v.obj.position.set(pos.x, 0, pos.z);
    v.obj.scale.setScalar(radius);
    v.obj.visible = true;
  }

  // Who an enemy goes for, given its normal target: a taunting hero beats everything, then decoys
  aggro(e, target) {
    const heroes = this.world.heroes || [this.world.player];
    for (const h of heroes) {
      if (h && !h.dead && h.tauntTimer > 0 && (e.isBoss || h.position.distanceTo(e.position) < h.tauntRadius)) return h;
    }
    if (e.isBoss) return target;
    let best = null, bd = Infinity;
    for (const d of this.decoys) {
      if (d.life <= 0) continue;
      const dist = d.position.distanceTo(e.position);
      if (dist < (d.owner?.char.decoyRadius || 10) && dist < bd) { bd = dist; best = d; }
    }
    return best || target;
  }

  // ---------- update (solo / host) ----------
  get now() { return performance.now() / 1000; }
  // KAGERO's MARKS: a spinning pink diamond over each marked enemy
  drawMarks(list) {
    let i = 0;
    for (const [x, z, y] of list) {
      let m = this.marks[i];
      if (!m) { m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0xff4ad8, transparent: true, opacity: 0.9 })); this.scene.add(m); this.marks.push(m); }
      m.visible = true; m.position.set(x, y, z); m.rotation.y = this.now * 4; m.scale.set(1, 1.6, 1);
      i++;
    }
    for (; i < this.marks.length; i++) this.marks[i].visible = false;
  }
  markList() {
    const out = [], now = this.now;
    for (const e of this.world.enemies.list) if (!e.dead && e.markT > now) out.push([e.position.x, e.position.z, 2.4 * (e.scale || 1) + 0.4]);
    return out;
  }
  // a throw: main star + Star Fan, or the FINISHER (7-star gold fan, each ricochets once more)
  throwStars(owner, from, facing, dmg, opts, fan, fin) {
    const dir = (a) => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    if (fin) {
      const fo = { ...opts, color: 0xffd27a, bounce: (opts.bounce || 0) + 1 };
      for (let i = -3; i <= 3; i++) this.fireNeedle(owner, from, dir(facing + i * 0.2), dmg * (i === 0 ? 1.2 : 0.4), fo);
      return;
    }
    this.fireNeedle(owner, from, dir(facing), dmg, opts);
    for (let i = 1; i <= fan; i++) for (const sgn of [-1, 1]) this.fireNeedle(owner, from, dir(facing + sgn * 0.22 * i), dmg * 0.3, opts);
  }
  update(dt) {
    if (!this.host) return this.clientUpdate(dt);
    this.drawMarks(this.markList());
    const enemies = this.world.enemies.list, arena = this.world.arena;
    // STAR HALO evolution: keep a permanent ring of shurikens round each owner who has it
    for (const o of (this.world.heroes || [this.world.player])) {
      if (!o || o.dead || !(o.stats?.halo > 0)) continue;
      const have = this.stars.filter((n) => n.life > 0 && n.ret && n.ret.perm && n.owner === o).length;
      for (let i = have; i < o.stats.halo; i++) {
        const n = this.stars.find((x) => x.life <= 0); if (!n) break;
        this.fireNeedle(o, o.position, new THREE.Vector3(1, 0, 0), 0, { star: true, color: 0xffd27a });
        n.ret = { phase: 'orbit', perm: true, t: 0, cd: new Map(), ang: 0, odmg: 0 }; n.vel.set(0, 0, 0);
      }
    }
    const rings = new Map(); // orbiting stars per owner, evenly spaced round him
    for (const n of this.stars) if (n.life > 0 && n.ret && n.ret.phase === 'orbit') { if (!rings.has(n.owner)) rings.set(n.owner, []); rings.get(n.owner).push(n); }
    const spin = performance.now() / 1000 * 5.5;
    for (const n of this.needles.concat(this.stars)) {
      if (n.life <= 0) continue;
      n.life -= dt;
      if (n.star) n.mesh.rotation.y += dt * 22;
      if (n.ret && n.ret.phase === 'embed') { // stuck in an enemy, waiting to fly home
        n.life = 9; n.ret.t += dt;
        const e = n.ret.enemy;
        if (e && !e.dead) n.mesh.position.set(e.position.x + n.ret.ox, 1.2, e.position.z + n.ret.oz);
        if (n.ret.t >= RET_TIME || !e || e.dead || !n.owner || n.owner.dead) {
          n.ret.phase = 'back'; n.hitSet.clear(); n.pierce = 99;
          n.dmg = n.ret.dmg * (1 + 0.6 * Math.min(1, n.ret.t / RET_TIME)); // longer stuck = harder return
        }
        continue;
      }
      if (n.ret && n.ret.phase === 'back') {
        const o = n.owner, d = new THREE.Vector3(o.position.x - n.mesh.position.x, 0, o.position.z - n.mesh.position.z);
        if (o.dead) n.life = 0.0001;
        else if (d.length() < 1.7) { // home: join the ring round Kagero
          n.ret.phase = 'orbit'; n.ret.t = 0; n.ret.cd = new Map(); n.vel.set(0, 0, 0);
          n.ret.ang = Math.atan2(n.mesh.position.x - o.position.x, n.mesh.position.z - o.position.z);
          n.ret.odmg = n.ret.dmg * ORBIT_DMG;
        } else n.vel.copy(d.normalize().multiplyScalar(26));
      }
      if (n.ret && n.ret.phase === 'orbit') { // ORBIT: a spinning ring of stars for 2s, then gone
        const o = n.owner, r = n.ret;
        r.t += dt; n.life = 9;
        if (r.perm) { r.odmg = (o.char?.needle?.damage || 9) * 0.6; if (!(o.stats?.halo > 0)) r.t = ORBIT_TIME; else if (r.t > 1e4) r.t = 0; r.cd.forEach((v, k) => { if (k.dead) r.cd.delete(k); }); }
        if (!o || o.dead || (!r.perm || !(o.stats?.halo > 0)) && r.t >= ORBIT_TIME) { n.life = 0; n.mesh.visible = false; n.ret = null; n.clone = false; continue; }
        const ring = rings.get(o) || [n], k = Math.max(0, ring.indexOf(n));
        r.ang = spin + k * Math.PI * 2 / ring.length;
        n.mesh.position.set(o.position.x + Math.sin(r.ang) * ORBIT_R, 1.1 + 0.12 * Math.sin(r.ang * 2), o.position.z + Math.cos(r.ang) * ORBIT_R);
        n.mesh.rotation.y += dt * 18;
        if (n.mesh.scale.x !== 1.6) n.mesh.scale.setScalar(1.6);
        for (const e of enemies) {
          if (!e.canBeHit || (r.cd.get(e) || 0) > r.t) continue;
          if (Math.hypot(n.mesh.position.x - e.position.x, n.mesh.position.z - e.position.z) < e.radius + 0.5) {
            r.cd.set(e, r.t + ORBIT_HIT_CD);
            o.cloneHit = !!n.clone; o.strike(e, r.odmg, 0, 0, false, 'needle'); o.cloneHit = false;
            this.retRefund(o);
            this.world.effects.spawnSparks(n.mesh.position.clone(), n.color, 3, 4);
          }
        }
        continue;
      }
      const pos = n.mesh.position;
      pos.addScaledVector(n.vel, dt);
      let done = n.life <= 0 || Math.abs(pos.x) > 19 || Math.abs(pos.z) > 19;
      if (!n.ret) for (const o of arena.obstacles) if (Math.hypot(pos.x - o.x, pos.z - o.z) < o.r) { done = true; break; }
      if (!done) {
        for (const e of enemies) {
          if (!e.canBeHit || n.hitSet.has(e)) continue;
          if (Math.hypot(pos.x - e.position.x, pos.z - e.position.z) < e.radius + 0.35) {
            n.hitSet.add(e);
            const k = n.vel.clone().normalize().multiplyScalar(2);
            if (n.star && !n.ret && n.owner?.char?.markTime) { e.markT = this.now + n.owner.char.markTime; } // KAGERO: MARK
            if (n.owner) { n.owner.cloneHit = !!n.clone; n.owner.strike(e, n.dmg, k.x, k.z, false, n.kind); n.owner.cloneHit = false; if (n.ret) this.retRefund(n.owner); }
            this.world.effects.spawnSparks(pos.clone(), n.color, 3, 4);
            if (n.bounce > 0 && !n.ret) { // RICOCHET to the nearest enemy not hit yet (-20% per bounce)
              let nx = null, nd2 = 7;
              for (const o of enemies) { if (!o.canBeHit || n.hitSet.has(o)) continue; const d = o.position.distanceTo(e.position); if (d < nd2) { nd2 = d; nx = o; } }
              if (nx) {
                n.bounce--; n.dmg *= n.owner?.char?.needle?.bounceFall ?? 0.8;
                n.vel.set(nx.position.x - pos.x, 0, nx.position.z - pos.z).normalize().multiplyScalar(n.speed || 26);
                n.life = Math.max(n.life, 9 / (n.speed || 26));
                this.world.effects.spawnSparks(pos.clone(), 0xffffff, 2, 3);
                break;
              }
            }
            if (n.pierce-- <= 0) { done = true; break; }
          }
        }
      }
      if (done) { n.life = 0; n.mesh.visible = false; n.ret = null; n.clone = false; n.mesh.scale.setScalar(1); }
    }
    for (const c of this.clones) {
      if (c.life <= 0) continue;
      c.life -= dt;
      const o = c.owner;
      if (!o || o.dead || c.life <= 0) { c.life = 0; c.m.root.visible = false; this.world.effects.spawnSparks(c.position.clone().setY(1), 0x3a2a6a, 8); continue; }
      const to = this.cloneSpot(o);
      c.position.lerp(to, Math.min(1, dt * 7));
      arena.resolve?.(c.position, 0.4);
      // on its own when you're not throwing: a slower throw at the nearest enemy
      c.idle += dt; c.cd -= dt;
      if (c.idle > 0.6 && c.cd <= 0) {
        let best = null, bd = 12;
        for (const e of enemies) { if (!e.canBeHit) continue; const d = e.position.distanceTo(c.position); if (d < bd) { bd = d; best = e; } }
        if (best) { c.cd = 0.45; this.cloneFire(c, best); }
      }
      if (c.idle > 0.6 && c.cd > 0.2) c.facing += Math.atan2(Math.sin(o.facing - c.facing), Math.cos(o.facing - c.facing)) * Math.min(1, dt * 6);
      this.poseClone(c, dt);
    }
    for (const d of this.decoys) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.obj.rotation.y += dt * 3;
      d.mat.opacity = 0.3 + 0.15 * Math.sin(performance.now() / 90);
      if (d.life <= 0) this.popDecoy(d);
    }
    for (const d of this.drones) {
      if (d.life <= 0) continue;
      d.life -= dt;
      const o = d.owner;
      if (!o || o.dead || d.life <= 0) { d.life = 0; d.obj.visible = false; continue; }
      d.angle += dt * 2.2;
      const tx = o.position.x + Math.cos(d.angle) * 1.7, tz = o.position.z + Math.sin(d.angle) * 1.7;
      d.obj.position.x += (tx - d.obj.position.x) * Math.min(1, dt * 6);
      d.obj.position.z += (tz - d.obj.position.z) * Math.min(1, dt * 6);
      d.obj.position.y = 1.8 + Math.sin(performance.now() / 200 + d.angle) * 0.15;
      d.cd -= dt;
      let best = null, bd = o.char.droneRange || 9;
      for (const e of enemies) {
        if (!e.canBeHit) continue;
        const dist = Math.hypot(e.position.x - d.obj.position.x, e.position.z - d.obj.position.z);
        if (dist < bd) { bd = dist; best = e; }
      }
      if (best) d.obj.rotation.y = Math.atan2(best.position.x - d.obj.position.x, best.position.z - d.obj.position.z);
      if (best && d.cd <= 0) {
        d.cd = o.char.droneRate || 0.5;
        this.world.effects.spawnZap(d.obj.position.clone(), best.position, 0xff6a5a);
        o.strike(best, d.dmg, 0, 0, false, 'drone');
      }
    }
    for (const v of this.vortexes) {
      if (v.life <= 0) continue;
      v.life -= dt;
      v.a.rotation.z -= dt * 6; v.b.rotation.z += dt * 9;
      if (v.life <= 0 || !v.owner) { v.life = 0; v.obj.visible = false; continue; }
      const c = v.obj.position;
      v.tickLeft -= dt;
      const tick = v.tickLeft <= 0;
      if (tick) v.tickLeft = v.tick;
      for (const e of enemies) {
        if (!e.canBeHit) continue;
        const to = new THREE.Vector3(c.x - e.position.x, 0, c.z - e.position.z);
        const dist = to.length();
        if (dist > v.radius + e.radius) continue;
        if (!e.isBoss && dist > 0.8) {
          const pull = Math.min(dist - 0.8, dt * 7 * (e.type?.armored ? 0.5 : 1));
          e.position.addScaledVector(to.normalize(), pull);
          arena.resolve?.(e.position, e.radius);
        }
        if (tick) v.owner.strike(e, v.dmg, 0, 0, false, 'spin');
      }
    }
  }

  poseClone(c, dt) {
    const m = c.m;
    c.flick = Math.max(0, c.flick - dt);
    m.root.position.set(c.position.x, 0.05 + Math.sin(performance.now() / 180) * 0.05, c.position.z);
    m.root.rotation.y = c.facing;
    m.armR.rotation.set(c.flick > 0 ? -1.6 : -0.6, 0, -0.15);
    m.armL.rotation.set(-0.6, 0, 0.15);
    const fade = Math.min(1, c.life / 0.6);
    m.root.scale.setScalar(0.92 * (0.6 + 0.4 * fade));
  }

  // ---------- co-op: what friends see ----------
  serialize() {
    const r2 = this.r2, out = [];
    for (const n of this.needles) if (n.life > 0) out.push(['n', r2(n.mesh.position.x), r2(n.mesh.position.z), r2(n.mesh.rotation.y), n.color]);
    for (const n of this.stars) if (n.life > 0) out.push(['s', r2(n.mesh.position.x), r2(n.mesh.position.z), 0, n.color]);
    for (const c of this.clones) if (c.life > 0) out.push(['c', r2(c.position.x), r2(c.position.z), r2(c.facing), r2(c.life), c.flick > 0 ? 1 : 0]);
    for (const m of this.markList()) out.push(['m', r2(m[0]), r2(m[1]), r2(m[2])]);
    for (const d of this.decoys) if (d.life > 0) out.push(['d', r2(d.position.x), r2(d.position.z), d.mat.color.getHex()]);
    for (const d of this.drones) if (d.life > 0) out.push(['r', r2(d.obj.position.x), r2(d.obj.position.z), r2(d.obj.rotation.y)]);
    for (const v of this.vortexes) if (v.life > 0) out.push(['v', r2(v.obj.position.x), r2(v.obj.position.z), r2(v.radius)]);
    return out;
  }

  applySnapshot(list) {
    const used = { n: 0, s: 0, c: 0, d: 0, r: 0, v: 0 };
    const marks = [];
    for (const s of list || []) {
      const [k, x, z, a, b] = s;
      if (k === 'm') { marks.push([x, z, a]); continue; }
      if (k === 's') {
        const n = this.stars[used.s++]; if (!n) continue;
        if (!n.mesh.visible) n.mesh.position.set(x, 1.1, z);
        n.target.set(x, 1.1, z); for (const p of n.parts) p.material = this.mat(b); n.mesh.visible = true; n.life = 1;
        continue;
      }
      if (k === 'c') {
        const c = this.clones[used.c++]; if (!c) continue;
        if (!c.m.root.visible) c.position.set(x, 0, z);
        c.target.set(x, 0, z); c.facing = a; c.life = b; c.flick = s[5] ? 0.15 : c.flick; c.m.root.visible = true;
        continue;
      }
      if (k === 'n') {
        const n = this.needles[used.n++]; if (!n) continue;
        if (!n.mesh.visible) n.mesh.position.set(x, 1.1, z);
        n.target.set(x, 1.1, z); n.mesh.rotation.y = a; n.mesh.material = this.mat(b); n.mesh.visible = true; n.life = 1;
      } else if (k === 'd') {
        const d = this.decoys[used.d++]; if (!d) continue;
        d.position.set(x, 0, z); d.obj.position.copy(d.position); d.mat.color.setHex(a); d.obj.visible = true; d.life = 1;
      } else if (k === 'r') {
        const d = this.drones[used.r++]; if (!d) continue;
        if (!d.obj.visible) d.obj.position.set(x, 1.8, z);
        d.target.set(x, 1.8, z); d.obj.rotation.y = a; d.obj.visible = true; d.life = 1;
      } else if (k === 'v') {
        const v = this.vortexes[used.v++]; if (!v) continue;
        v.obj.position.set(x, 0, z); v.obj.scale.setScalar(a); v.obj.visible = true; v.life = 1;
      }
    }
    this.drawMarks(marks);
    this.needles.slice(used.n).forEach((n) => { n.life = 0; n.mesh.visible = false; });
    this.stars.slice(used.s).forEach((n) => { n.life = 0; n.mesh.visible = false; });
    this.clones.slice(used.c).forEach((c) => { c.life = 0; c.m.root.visible = false; });
    this.decoys.slice(used.d).forEach((d) => { d.life = 0; d.obj.visible = false; });
    this.drones.slice(used.r).forEach((d) => { d.life = 0; d.obj.visible = false; });
    this.vortexes.slice(used.v).forEach((v) => { v.life = 0; v.obj.visible = false; });
  }

  clientUpdate(dt) {
    const k = 1 - Math.exp(-14 * dt);
    for (const n of this.needles) if (n.mesh.visible) n.mesh.position.lerp(n.target, k);
    for (const n of this.stars) if (n.mesh.visible) { n.mesh.position.lerp(n.target, k); n.mesh.rotation.y += dt * 22; }
    for (const c of this.clones) if (c.m.root.visible) { c.position.lerp(c.target, k); this.poseClone(c, dt); }
    for (const d of this.drones) if (d.obj.visible) d.obj.position.lerp(d.target, k);
    for (const d of this.decoys) if (d.obj.visible) { d.obj.rotation.y += dt * 3; d.mat.opacity = 0.3 + 0.15 * Math.sin(performance.now() / 90); }
    for (const v of this.vortexes) if (v.obj.visible) { v.a.rotation.z -= dt * 6; v.b.rotation.z += dt * 9; }
  }

  reset() {
    for (const n of this.needles) { n.life = 0; n.mesh.visible = false; }
    for (const n of this.stars) { n.life = 0; n.mesh.visible = false; }
    for (const c of this.clones) { c.life = 0; c.m.root.visible = false; c.owner = null; }
    for (const m of this.marks) m.visible = false;
    for (const d of this.decoys) { d.life = 0; d.obj.visible = false; }
    for (const d of this.drones) { d.life = 0; d.obj.visible = false; d.owner = null; }
    for (const v of this.vortexes) { v.life = 0; v.obj.visible = false; v.owner = null; }
  }
}

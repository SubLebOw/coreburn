// axiom.js: AXIOM's drone army (CoreBurnZ v1.28). Pooled meshes, cheap distance checks.
// Solo / co-op host simulate and fire; friends just draw the host's snapshot ('x' entries).
// Drones: permanent (count against capacity), 'asc' (Ascension extras, explode at the end) or
// 'evo' (Extinction Protocol, 12s). Elites and bosses that touch a drone wear it down fast; normal enemies chip them slowly (v1.28.1).
import * as THREE from 'three';
import { p5Focus } from './phase5.js?v=1.34.0';

const POOL = 48;
export const AX = { hp: 2.5, eliteTouch: 1, bossTouch: 2.2, normTouch: 0.15, ringR: 1.6, wingR: 2.6, ascBoom: 2.5, evoLife: 12, evoMax: 4, eliteEvery: 20, eliteMax: 3 };

export class AxiomSwarm {
  constructor(scene, world, allies) {
    this.world = world; this.allies = allies;
    const bodyG = new THREE.OctahedronGeometry(0.26, 0), finG = new THREE.BoxGeometry(0.62, 0.05, 0.16), podG = new THREE.BoxGeometry(0.1, 0.1, 0.3), eyeG = new THREE.BoxGeometry(0.1, 0.06, 0.06);
    const bodyM = new THREE.MeshLambertMaterial({ color: 0x2a2c34 }), finM = new THREE.MeshLambertMaterial({ color: 0x8a1a22 }), eyeM = new THREE.MeshBasicMaterial({ color: 0xff2a3a }), tempM = new THREE.MeshBasicMaterial({ color: 0xff8a3a });
    this.tempM = tempM; this.eyeM = eyeM;
    this.list = [];
    for (let i = 0; i < POOL; i++) {
      const obj = new THREE.Group();
      const b = new THREE.Mesh(bodyG, bodyM); b.scale.set(1, 0.7, 1.3); obj.add(b);
      obj.add(new THREE.Mesh(finG, finM));
      const eye = new THREE.Mesh(eyeG, eyeM); eye.position.set(0, 0, 0.3); obj.add(eye);
      const pods = new THREE.Group(); for (const s of [-1, 1]) { const p = new THREE.Mesh(podG, finM); p.position.set(s * 0.34, -0.08, 0.05); pods.add(p); } pods.visible = false; obj.add(pods);
      obj.visible = false; scene.add(obj);
      this.list.push({ obj, eye, pods, owner: null, live: false, temp: null, life: 0, hp: AX.hp, elite: false, target: new THREE.Vector3() });
    }
    // Reforge barrier: a red hex shell (one per hero is plenty, pooled 4)
    this.shells = [];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.25, wireframe: true, depthWrite: false }));
      m.visible = false; scene.add(m); this.shells.push({ m, owner: null, t: 0 });
    }
  }
  get host() { return !this.world.netClient; }
  mine(o, kind) { return this.list.filter((d) => d.live && d.owner === o && (kind === undefined || d.temp === kind)); }
  perm(o) { return this.mine(o, null).length; }
  // Upload counts elites as 2
  weight(o) { let n = 0; for (const d of this.list) if (d.live && d.owner === o) n += d.elite ? 2 : 1; return n; }
  add(o, temp = null, life = 0) {
    const d = this.list.find((x) => !x.live); if (!d) return null;
    Object.assign(d, { owner: o, live: true, temp, life, hp: AX.hp, elite: false });
    d.obj.position.set(o.position.x, 1.9, o.position.z); d.obj.visible = true; d.obj.scale.setScalar(1);
    d.eye.material = temp ? this.tempM : this.eyeM;
    this.world.effects.spawnSparks(d.obj.position.clone(), 0xff5a3a, 8, 5);
    return d;
  }
  kill(d, boom = true) {
    if (boom) { this.world.effects.spawnSparks(d.obj.position.clone(), 0xff7a3a, 10, 6); this.world.effects.spawnRing(d.obj.position.clone().setY(0.1), 0xff5a3a, 1, 0.25); }
    d.live = false; d.obj.visible = false; d.owner = null; d.elite = false;
  }
  // lose n drones (temps first, then permanent)
  lose(o, n) {
    const ds = this.mine(o).sort((a, b) => (b.temp ? 1 : 0) - (a.temp ? 1 : 0) || (a.elite ? 1 : 0) - (b.elite ? 1 : 0));
    let w = 0; for (const d of ds) { if (w >= n) break; w += d.elite ? 2 : 1; this.kill(d); }
  }
  clearOwner(o) { for (const d of this.list) if (d.owner === o) this.kill(d, false); }
  explodeAsc(o) {
    for (const d of this.mine(o, 'asc')) {
      const p = d.obj.position.clone().setY(0);
      this.world.effects.spawnRing(p, 0xff6a2a, AX.ascBoom, 0.4); this.world.effects.spawnSparks(p.clone().setY(1), 0xffaa3a, 14, 8);
      for (const e of this.world.enemies.list) if (e.canBeHit && Math.hypot(e.position.x - p.x, e.position.z - p.z) < AX.ascBoom + e.radius) o.strike(e, o.char.needle.damage * 3 * o.stats.spinDmg, 0, 0, true, 'spin');
      this.kill(d, false);
    }
    this.world.sfx('hit');
  }
  shield(o, t) {
    const s = this.shells.find((x) => x.owner === o) || this.shells.find((x) => x.t <= 0); if (!s) return;
    s.owner = o; s.t = t; s.m.visible = true;
  }
  shielded(o) { return this.shells.some((s) => s.owner === o && s.t > 0); }

  update(dt) {
    for (const s of this.shells) if (s.t > 0) { s.t -= dt; s.m.position.set(s.owner.position.x, 1.1, s.owner.position.z); s.m.rotation.y += dt * 4; s.m.material.opacity = 0.15 + 0.2 * Math.min(1, s.t * 4); if (s.t <= 0) { s.m.visible = false; s.owner = null; } }
    if (!this.host) return this.clientUpdate(dt);
    const now = performance.now() / 1000, enemies = this.world.enemies.list;
    const byOwner = new Map();
    for (const d of this.list) {
      if (!d.live) continue;
      const o = d.owner;
      if (!o || o.dead && !o.uploading || o.kit !== 'axiom') { this.kill(d, false); continue; }
      if (d.temp === 'evo' && (d.life -= dt) <= 0) { this.kill(d); continue; }
      // v1.28.1: normal enemies chip drones slowly on contact; elites / bosses wear them down fast
      let chip = false; // normal enemies: one chip rate per drone, however many are touching it
      for (const e of enemies) {
        if (!e.canBeHit) continue;
        if (Math.abs(e.position.x - d.obj.position.x) > 3 || Math.abs(e.position.z - d.obj.position.z) > 3) continue;
        if (Math.hypot(e.position.x - d.obj.position.x, e.position.z - d.obj.position.z) < (e.radius || 0.6) + 0.5) { if (e.isBoss || e.elite) d.hp -= dt * (e.isBoss ? AX.bossTouch : AX.eliteTouch); else chip = true; }
      }
      if (chip) d.hp -= dt * AX.normTouch;
      if (d.hp <= 0) { this.kill(d); this.world.sfx('hit'); continue; }
      (byOwner.get(o) || byOwner.set(o, []).get(o)).push(d);
    }
    for (const [o, ds] of byOwner) this.ownerUpdate(o, ds, dt, now);
  }

  ownerUpdate(o, ds, dt, now) {
    const c = o.char, s = o.stats, asc = o.ascendT > 0;
    // formation: a ring round him, wings behind him during Ascension
    const n = ds.length, R = AX.ringR + n * 0.08;
    o.axSpin = (o.axSpin || 0) + dt * (asc ? 0.6 : 1.4);
    ds.forEach((d, i) => {
      let x, z, y = 1.9 + 0.15 * Math.sin(now * 3 + i);
      if (asc) { // two wings fanned out behind
        const side = i % 2 ? 1 : -1, k = Math.floor(i / 2), back = o.facing + Math.PI;
        const a = back + side * (0.9 + k * 0.28);
        x = o.position.x + Math.sin(a) * (AX.wingR + k * 0.35); z = o.position.z + Math.cos(a) * (AX.wingR + k * 0.35); y = 2.4 + k * 0.25;
      } else { const a = o.axSpin + i / n * Math.PI * 2; x = o.position.x + Math.sin(a) * R; z = o.position.z + Math.cos(a) * R; }
      d.target.set(x, y, z); d.obj.position.lerp(d.target, 1 - Math.exp(-10 * dt));
      d.obj.scale.setScalar(d.elite ? 1.6 : 1); d.pods.visible = !!s.axPayload;
    });
    // MYTHIC Singularity Intelligence: a permanent drone turns elite every 20s (max 3)
    if (s.myAxSing) {
      o.axEliteT = (o.axEliteT || 0) + dt;
      if (o.axEliteT >= AX.eliteEvery) { o.axEliteT = 0; const d = ds.find((x) => !x.temp && !x.elite); if (d && ds.filter((x) => x.elite).length < AX.eliteMax) { d.elite = true; this.world.effects.spawnRing(d.obj.position.clone().setY(0.1), 0xffd84a, 1.6, 0.4); } }
    }
    // v1.28.1: volleys are linked to his attack. Drones only fire while he's firing Pulse Command
    // (the window covers one bolt interval); Overclock / Ascension / Servos still speed them up.
    o.axAtkT = (o.axAtkT || 0) - dt;
    if (o.axAtkT <= 0) { o.axCd = Math.max(0, (o.axCd ?? 0) - dt); return; }
    const rate = (1 + s.axServo + (o.axClockT > 0 ? c.overclockRate : 0) + (asc ? c.ascendRate : 0)) * c.atkSpeed;
    o.axCd = (o.axCd ?? 0.2) - dt;
    if (o.axCd > 0) return;
    o.axCd = c.droneRate / rate;
    const range = c.droneRange * (s.m?.aRange ? 1.2 : 1);
    const shots = [];
    const f = p5Focus(o); // Phase 5 SWARM DIRECTIVE: the swarm focuses its priority target while it is in range
    for (const d of ds) {
      const t = (f && Math.hypot(f.position.x - d.obj.position.x, f.position.z - d.obj.position.z) < range) ? f : this.nearest(d.obj.position, range); if (!t) continue;
      const k = (d.elite ? 2 : 1);
      for (let j = 0; j < k; j++) shots.push([d, t, d.elite && asc ? 1.5 : 1]);
    }
    if (!shots.length) return;
    // graceful merge under load: fewer, heavier bolts when the projectile pool runs low
    const free = this.allies.needles.reduce((a, x) => a + (x.life <= 0 ? 1 : 0), 0);
    const cap = Math.max(1, Math.min(shots.length, free - 6));
    const merge = shots.length / cap;
    const base = c.needle.damage * c.droneDmg * merge;
    for (let i = 0; i < cap; i++) {
      const [d, t, m] = shots[Math.floor(i * merge)];
      o.axShots = (o.axShots || 0) + 1;
      const heavy = s.axPayload && o.axShots % 4 === 0;
      const dir = new THREE.Vector3(t.position.x - d.obj.position.x, 0, t.position.z - d.obj.position.z);
      d.obj.rotation.y = Math.atan2(dir.x, dir.z);
      this.allies.fireNeedle(o, d.obj.position, dir, base * m, { pierce: (asc ? 1 : 0), speed: 32, range: range + 2, color: heavy ? 0xffa02a : (d.temp ? 0xff8a3a : 0xff3a4a), kind: heavy ? 'adroneH' : 'adrone' });
    }
  }
  nearest(p, range) {
    let best = null, bd = range * range;
    for (const e of this.world.enemies.list) {
      if (!e.canBeHit) continue;
      const dx = e.position.x - p.x, dz = e.position.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = e; }
    }
    return best;
  }
  serialize(out) { const r2 = this.allies.r2; for (const d of this.list) if (d.live) out.push(['x', r2(d.obj.position.x), r2(d.obj.position.z), r2(d.obj.position.y), (d.elite ? 1 : 0) | (d.temp ? 2 : 0) | (d.pods.visible ? 4 : 0), r2(d.obj.rotation.y)]); for (const s of this.shells) if (s.t > 0) out.push(['X', r2(s.m.position.x), r2(s.m.position.z), r2(s.t)]); }
  applySnapshot(entries) {
    let i = 0, j = 0;
    for (const s of entries) {
      if (s[0] === 'X') { const sh = this.shells[j++]; if (sh) { sh.m.position.set(s[1], 1.1, s[2]); sh.m.visible = true; sh.t = 0; } continue; }
      const d = this.list[i++]; if (!d) continue;
      if (!d.obj.visible) d.obj.position.set(s[1], s[3], s[2]);
      d.target.set(s[1], s[3], s[2]); d.obj.visible = true; d.live = true; d.obj.scale.setScalar(s[4] & 1 ? 1.6 : 1); d.pods.visible = !!(s[4] & 4); d.eye.material = s[4] & 2 ? this.tempM : this.eyeM; d.obj.rotation.y = s[5];
    }
    for (; i < this.list.length; i++) { const d = this.list[i]; d.live = false; d.obj.visible = false; }
    for (; j < this.shells.length; j++) this.shells[j].m.visible = false;
  }
  clientUpdate(dt) { const k = 1 - Math.exp(-14 * dt); for (const d of this.list) if (d.obj.visible) d.obj.position.lerp(d.target, k); }
  reset() { for (const d of this.list) this.kill(d, false); for (const s of this.shells) { s.t = 0; s.m.visible = false; s.owner = null; } }
}

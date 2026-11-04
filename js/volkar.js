// volkar.js: VOLKAR (hero id 'thane'), CoreBurnZ Phase 6 TEST BUILD kit.
//   ATTACK   Conduit Maul: 3 swings, each hit builds CHARGE (x2 on Shocked foes, max +4 per swing) and sends a
//            small static shockwave (25% to 4 others). At full Charge the next swing is a GROUND DISCHARGE slam.
//   MOBILITY Skyfall: 3 m Static Lunge (no i-frames) + telegraphed lightning strikes on the 3 best targets.
//   ULTIMATE Tempest Surge: needs a full STORM METER. Wind-up (rooted), 8 s storm, finisher, 3 s empowered swings.
//   SHOCKED  e.vShockUntil (seconds). Only Volkar applies it and only Volkar's own Conductor procs see it
//            (phase5 statuses() checks p.kit), so no other hero's balance changes.
// Every proc uses a non-attack kind ('shock' passive, 'skyfall' ability, 'spin' ultimate), flat bases (x REF 12),
// the normal strike() pipeline (host only), a hard 6-jump chain cap and a 4% boss max-HP cap per Surge.
// VFX: Volkar's OWN pool (bolt columns, chain arcs, ground telegraph rings), opaque MeshBasic, no lights, made once.
import * as THREE from 'three';

const REF = 12;
const now = () => performance.now() / 1000;
const isShocked = (e) => (e.vShockUntil || 0) > now();

// ---------------- pooled VFX (one per scene) ----------------
const BOLTS = 8, ARCS = 18, TELES = 10, CRACKS = 4, PTRS = 6;
class VolkarFX {
  constructor(scene) {
    this.scene = scene;
    const seg = new THREE.BoxGeometry(1, 1, 1);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff });
    this.arcMat = new THREE.MeshBasicMaterial({ color: 0x6ae4ff });
    this.teleMat = new THREE.MeshBasicMaterial({ color: 0x2aa8e0 });
    this.fillMat = new THREE.MeshBasicMaterial({ color: 0x0c3c58 });
    const mk = (mat) => { const m = new THREE.Mesh(seg, mat); m.visible = false; m.frustumCulled = false; m.matrixAutoUpdate = true; scene.add(m); return m; };
    this.bolts = Array.from({ length: BOLTS }, () => ({ segs: [0, 1, 2, 3].map(() => mk(this.boltMat)), life: 0 }));
    this.arcs = Array.from({ length: ARCS }, () => ({ segs: [0, 1, 2].map(() => mk(this.arcMat)), life: 0 }));
    const ringGeo = new THREE.RingGeometry(0.9, 1, 28); ringGeo.rotateX(-Math.PI / 2);
    const discGeo = new THREE.CircleGeometry(1, 24); discGeo.rotateX(-Math.PI / 2);
    this.teles = Array.from({ length: TELES }, () => {
      const ring = new THREE.Mesh(ringGeo, this.teleMat), fill = new THREE.Mesh(discGeo, this.fillMat);
      ring.visible = fill.visible = false; scene.add(ring); scene.add(fill); return { ring, fill, life: 0, max: 1, r: 1 };
    });
    // v2: maul-slam ground cracks (3 flat dark shards each) and Skyfall direction pointers (flat chevrons at the hero's feet
    // that point at far / off-screen marked targets for the telegraph's whole duration). Opaque, pooled, made once.
    this.crackMat = new THREE.MeshBasicMaterial({ color: 0x0a0d12 });
    this.cracks = Array.from({ length: CRACKS }, () => ({ segs: [0, 1, 2, 3].map(() => mk(this.crackMat)), life: 0 }));
    const chev = new THREE.ConeGeometry(0.32, 0.9, 3); chev.rotateX(Math.PI / 2); chev.scale(1, 0.15, 1);
    this.ptrMat = new THREE.MeshBasicMaterial({ color: 0x6ae4ff });
    this.ptrs = Array.from({ length: PTRS }, () => { const m = new THREE.Mesh(chev, this.ptrMat); m.visible = false; m.frustumCulled = false; scene.add(m); return { m, life: 0 }; });
  }
  crack(pos, dir, size) { // radiating dark shards on the floor at a slam impact
    const c = this.cracks.find((x) => x.life <= 0) || this.cracks[0];
    c.life = 0.6; const base = Math.atan2(dir.x, dir.z);
    c.segs.forEach((m, i) => { const a = base + (i - 1.5) * 0.9 + (Math.random() - 0.5) * 0.4, L = size * (0.7 + Math.random() * 0.5);
      m.position.set(pos.x + Math.sin(a) * L * 0.5, 0.03, pos.z + Math.cos(a) * L * 0.5); m.rotation.set(0, a, 0); m.quaternion.setFromEuler(m.rotation); m.scale.set(0.09, 0.02, L); m.visible = true; });
  }
  ptr(life) { const q = this.ptrs.find((x) => x.life <= 0) || this.ptrs[0]; q.life = life; q.m.visible = true; return q; }
  aimPtr(q, from, to) { const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1; q.m.position.set(from.x + dx / d * 1.9, 0.12, from.z + dz / d * 1.9); q.m.rotation.set(0, Math.atan2(dx, dz), 0); }
  _jag(segs, pts) {
    const up = _up;
    segs.forEach((m, i) => {
      const p0 = pts[i], p1 = pts[i + 1];
      if (!p1) { m.visible = false; return; }
      m.position.copy(p0).add(p1).multiplyScalar(0.5);
      m.scale.set(m.material === this.boltMat ? 0.14 : 0.07, p0.distanceTo(p1), m.material === this.boltMat ? 0.14 : 0.07);
      m.quaternion.setFromUnitVectors(up, _v.copy(p1).sub(p0).normalize());
      m.visible = true;
    });
  }
  bolt(pos) { // a jagged column from the sky
    const b = this.bolts.find((x) => x.life <= 0) || this.bolts[0];
    b.life = 0.16;
    const pts = [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(pos.x + (i && i < 4 ? (Math.random() - 0.5) * 0.9 : 0), 9 - i * 2.25, pos.z + (i && i < 4 ? (Math.random() - 0.5) * 0.9 : 0)));
    pts[4].y = 0.05;
    this._jag(b.segs, pts);
  }
  arc(a, bp) {
    const z = this.arcs.find((x) => x.life <= 0) || this.arcs[0];
    z.life = 0.14;
    const pts = [0, 1, 2, 3].map((i) => { const p = a.clone().lerp(bp, i / 3).setY(1.1); if (i && i < 3) { p.x += (Math.random() - 0.5) * 0.7; p.y += (Math.random() - 0.5) * 0.5; p.z += (Math.random() - 0.5) * 0.7; } return p; });
    this._jag(z.segs, pts);
  }
  tele(pos, r, dur) {
    const t = this.teles.find((x) => x.life <= 0) || this.teles[0];
    t.life = t.max = dur; t.r = r; t.ring.position.set(pos.x, 0.05, pos.z); t.fill.position.set(pos.x, 0.04, pos.z);
    t.ring.scale.setScalar(r); t.fill.scale.setScalar(0.01); t.ring.visible = t.fill.visible = true; return t;
  }
  update(dt) {
    for (const b of this.bolts) if (b.life > 0 && (b.life -= dt) <= 0) for (const s of b.segs) s.visible = false;
    for (const z of this.arcs) if (z.life > 0 && (z.life -= dt) <= 0) for (const s of z.segs) s.visible = false;
    for (const c of this.cracks) if (c.life > 0 && (c.life -= dt) <= 0) for (const s of c.segs) s.visible = false;
    for (const q of this.ptrs) if (q.life > 0 && (q.life -= dt) <= 0) q.m.visible = false;
    for (const t of this.teles) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.ring.visible = t.fill.visible = false; continue; }
      t.fill.scale.setScalar(Math.max(0.01, t.r * (1 - t.life / t.max)));
    }
  }
  clear() { for (const b of [...this.bolts, ...this.arcs]) { b.life = 0; for (const s of b.segs) s.visible = false; } for (const t of this.teles) { t.life = 0; t.ring.visible = t.fill.visible = false; } for (const c of this.cracks) { c.life = 0; for (const s of c.segs) s.visible = false; } for (const q of this.ptrs) { q.life = 0; q.m.visible = false; } }
  get live() { return this.bolts.filter((b) => b.life > 0).length + this.arcs.filter((b) => b.life > 0).length + this.teles.filter((t) => t.life > 0).length; }
}
const _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3();
const FX = new WeakMap();
export function vfx(p) { let f = FX.get(p.scene); if (!f) { f = new VolkarFX(p.scene); FX.set(p.scene, f); } return f; }

// ---------------- state ----------------
export function vReset(p) {
  p.vk = { charge: 0, meter: 0, lockT: 0, combatT: 99, decayT: 0, strikes: [], surge: null, empowerT: 0, bossDealt: new Map(), discharge: false, swingGain: 0 };
  if (p.char.id === 'thane' && p.stats?.m?.tPre) p.vk.charge = 3;
  FX.get(p.scene)?.clear();
}
const S = (p) => p.stats;
export const chargeMax = (p) => p.char.charge.max - (S(p).tCharge || 0);
const meterMul = (p) => (1 + 0.1 * (S(p).tMeter || 0)) * (1 + Math.max(0, 1 - (S(p).spinCd ?? 1))); // Static Build-up; Ultimate Coolant fills it faster
export function addMeter(p, n) {
  const v = p.vk; if (!v || v.surge || v.lockT > 0) return;
  const max = p.char.meter.max, was = v.meter;
  v.meter = Math.min(max, v.meter + n * meterMul(p));
  if (was < max && v.meter >= max) { p.world.effects.localRing(p.position, 0x4ad8ff, 2.4, 0.4); p.world.sfx('vMark'); }
}
export const meterFull = (p) => !!p.vk && !p.vk.surge && p.vk.meter >= p.char.meter.max;
function shock(p, e) { e.vShockUntil = now() + p.char.charge.shockT + (S(p).m?.tConduct ? 0.5 : 0); }

// one damage hit on behalf of Volkar; bosses obey the Surge 4% cap while a Surge is running (or its finisher)
function hit(p, e, base, kx, kz, heavy, kind, surge = false) {
  if (!e.canBeHit) return false;
  if (surge && e.isBoss) {
    const cap = (e.maxHp || 0) * p.char.surge.bossCapPct, dealt = p.vk.bossDealt.get(e) || 0;
    if (dealt >= cap) { p.world.effects.localSparks?.(e.position.clone().setY(1.4), 0x4ad8ff, 2, 3); return false; }
    const before = e.hp; p.strike(e, base, kx, kz, heavy, kind);
    let d = Math.max(0, before - e.hp);
    if (dealt + d > cap && !e.dead) { e.hp += dealt + d - cap; d = cap - dealt; } // clamp the overshoot (Bossfang/crits applied first)
    p.vk.bossDealt.set(e, dealt + d);
    return true;
  }
  p.strike(e, base, kx, kz, heavy, kind);
  return true;
}
const enemies = (p) => p.world.enemies.list;
function near(p, pos, r, skip) {
  const out = [];
  for (const e of enemies(p)) { if (!e.canBeHit || skip?.has(e)) continue; const dx = e.position.x - pos.x, dz = e.position.z - pos.z; if (dx * dx + dz * dz <= (r + e.radius) ** 2) out.push(e); }
  return out;
}
// chain from `from`: `jumps` jumps, each x0.8 more; Shocked enemies don't use a jump (hard cap 6 total)
function chainFrom(p, from, base, jumps, { range = 4.5, shockedOnly = false, surge = false, done = new Set([from]) } = {}) {
  let src = from, b = base, left = jumps, total = 0;
  const cap = p.char.skyfall.maxJumps;
  while (left > 0 && total < cap) {
    let best = null, bd = range * range;
    for (const e of enemies(p)) { if (!e.canBeHit || done.has(e) || (shockedOnly && !isShocked(e))) continue; const dx = e.position.x - src.position.x, dz = e.position.z - src.position.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    done.add(best); total++;
    vfx(p).arc(src.position, best.position);
    const conduct = isShocked(best);
    hit(p, best, b * (best.elite || best.isBoss ? 1 + p.char.skyfall.eliteChainBonus : 1), 0, 0, false, 'shock', surge);
    shock(p, best);
    if (!conduct || shockedOnly) left--;
    src = best; b *= 0.8;
  }
  return total;
}

// ---------------- maul ----------------
// called from doSlashHit for every enemy the swing struck
export function onMaulHit(p, e, swingDmg, struck) {
  const v = p.vk, c = p.char.charge;
  const shocked = isShocked(e) || v.empowerT > 0;
  const gain = Math.min(c.capPerSwing - v.swingGain, shocked ? c.perShocked : c.perHit);
  if (gain > 0 && !v.discharge) { v.swingGain += gain; v.charge = Math.min(chargeMax(p), v.charge + gain); p.world.sfx('vCharge', v.charge); }
  addMeter(p, shocked ? p.char.meter.shockedHit : p.char.meter.hit);
  v.combatT = 0;
  // mini static shockwave at the impact point (kind 'shock': not an attack, no Twin/Storm/leech)
  const w = c.wave, r = w.r * (1 + 0.12 * (S(p).tWave || 0));
  let n = 0;
  for (const o of near(p, e.position, r, struck)) { if (o === e) continue; if (n >= w.max) break; n++; hit(p, o, swingDmg * w.pct * (1 + 0.1 * (S(p).tWave || 0)), 0, 0, false, 'shock'); }
  if (n) p.world.effects.localRing(e.position, 0x6ae4ff, r, 0.18);
}
// swing start: is this swing the Ground Discharge?
export function onSwingStart(p) { p.vk.swingGain = 0; p.vk.discharge = p.vk.charge >= chargeMax(p); if (p.vk.discharge) p.world.sfx('vMark'); }
export const swingMult = (p) => (p.vk?.empowerT > 0 ? 1 + p.char.surge.empowerPct : 1);
// after the swing's own hits: the Ground Discharge
// v2: every maul hit is an overhead SLAM; this is the visual ground impact (no damage, purely cosmetic).
// Hits 1-2 are quick slams, the 3rd a heavier one; a Ground Discharge is the same slam, bigger again.
function slamImpact(p, forward, heavy, discharge) {
  const at = p.position.clone().addScaledVector(forward, 1.6), fx = p.world.effects, f = vfx(p);
  const big = discharge ? 1.9 : heavy ? 1.35 : 1;
  fx.spawnRing(at, discharge ? 0x4ad8ff : 0x9adfff, 1.3 * big, 0.25);
  fx.localSparks(at.clone().setY(0.2), 0x7a6a58, heavy || discharge ? 10 : 6, 4); // dust
  fx.localSparks(at.clone().setY(0.3), 0xe8fbff, heavy || discharge ? 8 : 4, 5); // static flash
  f.crack(at, forward, 1.1 * big);
  f.arc(at, at.clone().add(new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar(1.2 * big)));
  f.arc(at, at.clone().add(new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(1.2 * big)));
  if (heavy && !discharge) f.bolt(at);
  if (!discharge) p.world.shake(heavy ? 0.28 : 0.14);
  return at;
}
export function afterSwing(p, forward, struck) {
  const v = p.vk, heavy = p.comboStep >= p.combo.length;
  if (!v.discharge) { slamImpact(p, forward, heavy, false); return; }
  v.discharge = false; v.charge = 0;
  const d = p.char.charge.discharge, at = p.position.clone().addScaledVector(forward, 1.2), fx = p.world.effects;
  slamImpact(p, forward, true, true);
  fx.spawnRing(at, 0x4ad8ff, d.r, 0.35); fx.spawnRing(at, 0xe8fbff, d.r * 0.55, 0.22);
  fx.spawnSparks(at.clone().setY(0.5), 0x9ae8ff, 16, 8);
  vfx(p).bolt(at); vfx(p).bolt(at.clone().addScaledVector(forward, 0.6));
  p.world.sfx('vDischarge'); p.world.shake(0.6); p.world.hitstop(0.06);
  const hitSet = new Set();
  for (const e of near(p, at, d.r)) {
    const dx = e.position.x - at.x, dz = e.position.z - at.z, dd = Math.hypot(dx, dz) || 1;
    hit(p, e, REF * d.dmg, dx / dd * 10, dz / dd * 10, true, 'shock');
    if (!e.isBoss) p.stun(e, d.stun);
    shock(p, e); hitSet.add(e);
  }
  // arcs to the nearest enemies outside the ring
  const arcs = d.arcs + (S(p).tArc || 0), outside = enemies(p).filter((e) => e.canBeHit && !hitSet.has(e) && e.position.distanceTo(at) <= d.r + d.arcRange)
    .sort((a, b) => a.position.distanceTo(at) - b.position.distanceTo(at)).slice(0, arcs);
  for (const e of outside) { vfx(p).arc(at, e.position); hit(p, e, REF * d.dmg * d.arcPct, 0, 0, false, 'shock'); shock(p, e); }
}

// ---------------- Skyfall ----------------
function pickTargets(p, n, range, from = p.position) {
  const list = enemies(p).filter((e) => e.canBeHit && e.position.distanceTo(from) <= range);
  list.sort((a, b) => ((b.isBoss ? 2 : b.elite ? 1 : 0) - (a.isBoss ? 2 : a.elite ? 1 : 0)) || a.position.distanceTo(from) - b.position.distanceTo(from));
  return list.slice(0, n);
}
export function skyfall(p, aim) {
  const k = p.char.skyfall, s = S(p);
  p.spendCharge();
  p.state = 'dash'; p.stateTime = 0; p.dashDir = aim.clone().setY(0).normalize();
  p.facing = Math.atan2(p.dashDir.x, p.dashDir.z);
  const lungeEnd = p.position.clone().addScaledVector(p.dashDir, k.lunge);
  const n = k.targets + (s.tSkyCount || 0), delay = Math.max(0.35, k.delay - 0.1 * (s.tSkyQuick || 0));
  const targets = pickTargets(p, n, k.range * (s.m?.tLong ? 1.15 : 1), lungeEnd);
  const jumps = s.tSkyChain || 0;
  if (!targets.length) p.vk.strikes.push({ pos: lungeEnd.clone(), t: delay, target: null, r: k.radius, dmg: REF * k.dmg, jumps, kind: 'skyfall', meter: true, tele: vfx(p).tele(lungeEnd, k.radius, delay) });
  for (const [i, e] of targets.entries()) {
    const t = delay + i * 0.08;
    const far = e.position.distanceTo(p.position) > 9; // v2 unlimited range: far / off-screen marks get a chevron at your feet
    p.vk.strikes.push({ pos: e.position.clone(), t, target: e, r: k.radius, dmg: REF * k.dmg, jumps, kind: 'skyfall', meter: true, tele: vfx(p).tele(e.position, k.radius, t), ptr: far ? vfx(p).ptr(t) : null });
  }
  p.world.sfx('vMark');
  p.world.effects.localRing(p.position, 0x4ad8ff, 1.6, 0.25);
}
export function skyfallDash(p) { // the 0.18 s Static Lunge (no i-frames: takeDamage has no thane exception)
  const k = p.char.skyfall;
  if (p.stateTime < 0.18) p.velocity.copy(p.dashDir).multiplyScalar(k.lunge / 0.18);
  else p.state = 'normal';
}

function landStrike(p, st) {
  const fx = vfx(p); fx.bolt(st.pos);
  p.world.effects.localRing(st.pos, 0x9ae8ff, st.r * 1.1, 0.25);
  p.world.effects.localSparks?.(st.pos.clone().setY(0.4), 0xbfe8ff, 8, 6);
  p.world.sfx(st.big ? 'vFinisher' : 'vStrike');
  if (st.big) p.world.shake(0.6);
  let any = false;
  for (const e of near(p, st.pos, st.r)) {
    const dx = e.position.x - st.pos.x, dz = e.position.z - st.pos.z, d = Math.hypot(dx, dz) || 1, kn = st.big ? 12 : 5;
    if (hit(p, e, st.dmg, dx / d * kn, dz / d * kn, !!st.big, st.kind, st.surge)) any = true;
    if (st.stun && !e.isBoss) p.stun(e, st.stun);
    shock(p, e);
  }
  if (any && st.meter) addMeter(p, p.char.meter.skyStrike);
  // chain: Skyfall from cards (Shocked conducts, cap 6); Surge strikes only to Shocked enemies (max 2, 50%)
  const first = near(p, st.pos, st.r)[0];
  if (first && st.jumps > 0) chainFrom(p, first, st.dmg * (st.surge ? 0.5 : p.char.skyfall.chainPct), st.jumps, { shockedOnly: !!st.surge, surge: !!st.surge, done: new Set(near(p, st.pos, st.r)) });
}

// ---------------- Tempest Surge ----------------
export function surgeStart(p, echo) {
  const v = p.vk;
  if (echo) { // Echo Core on Volkar: only the finisher recasts (at 50%: strike() halves 'spin' during the echo window)
    queueFinisher(p, 0.6); return;
  }
  v.meter = 0; v.bossDealt = new Map();
  v.surge = { phase: 'wind', t: 0, tick: 0, end: p.char.surge.time + 0.5 * (S(p).tSurge || 0) + (S(p).m?.tLongStorm ? 1 : 0) };
  p.world.sfx('vWindup');
  p.world.effects.spawnRing(p.position, 0x4ad8ff, 2.4, 0.6);
}
function queueFinisher(p, delay) {
  const c = p.char.surge;
  let best = null, bs = -1;
  for (const e of enemies(p)) { if (!e.canBeHit || e.position.distanceTo(p.position) > 16) continue; const sc = (e.isBoss ? 1e9 : e.elite ? 1e6 : 0) + e.hp; if (sc > bs) { bs = sc; best = e; } }
  const pos = best ? best.position.clone() : p.position.clone().addScaledVector(p.facingDir, 3);
  p.vk.strikes.push({ pos, t: delay, target: best, r: c.finisherR, dmg: REF * c.finisherDmg * (1 + 0.05 * (S(p).tSurge || 0)) * (S(p).spinDmg || 1), jumps: 0, kind: 'spin', surge: true, big: true, stun: 0.6, tele: vfx(p).tele(pos, c.finisherR, delay) });
}
// true while Volkar is rooted in the wind-up (player.ultUpdate keeps state 'spin' for that second only)
export function surgeWindup(p, dt) {
  const v = p.vk; if (!v.surge) return false;
  return v.surge.phase === 'wind';
}
function surgeTick(p, dt) {
  const v = p.vk, sg = v.surge, c = p.char.surge;
  sg.t += dt;
  if (sg.phase === 'wind') {
    if (sg.t >= c.windup) { sg.phase = 'storm'; sg.t = 0; p.world.sfx('thunder'); if (p.state === 'spin') p.endUlt(); }
    return;
  }
  if (sg.phase === 'storm') {
    sg.tick -= dt;
    if (sg.tick <= 0) {
      sg.tick = c.interval;
      const ts = pickTargets(p, c.targets, 14);
      for (const e of ts) v.strikes.push({ pos: e.position.clone(), t: 0.5, target: e, r: c.radius, dmg: REF * c.dmg * (1 + 0.05 * (S(p).tSurge || 0)) * (S(p).spinDmg || 1), jumps: 2, kind: 'spin', surge: true, tele: vfx(p).tele(e.position, c.radius, 0.5) });
    }
    if (sg.t >= sg.end) { sg.phase = 'fin'; sg.t = 0; queueFinisher(p, 0.8); }
    return;
  }
  if (sg.phase === 'fin' && sg.t >= 0.85) { v.surge = null; v.lockT = p.char.meter.lockAfter; v.empowerT = c.empowerT; p.world.effects.spawnRing(p.position, 0xe8fbff, 2, 0.4); }
}

// ---------------- per-frame ----------------
export function vTick(p, dt) {
  const v = p.vk; if (!v) return;
  vfx(p).update(dt);
  v.combatT += dt; v.lockT -= dt; v.empowerT -= dt;
  if (v.combatT < 3) addMeter(p, p.char.meter.passive * dt);
  else if (v.charge > 0 && (v.decayT += dt) >= 1.5) { v.decayT = 0; v.charge--; }
  if (v.combatT < 3) v.decayT = 0;
  if (v.surge) surgeTick(p, dt);
  // strike scheduler: telegraphs follow their target until 0.2 s before impact, then lock
  for (let i = v.strikes.length - 1; i >= 0; i--) {
    const st = v.strikes[i]; st.t -= dt;
    if (st.target && st.t > 0.2 && st.target.canBeHit) { st.pos.copy(st.target.position).setY(0); st.tele?.ring.position.set(st.pos.x, 0.05, st.pos.z); st.tele?.fill.position.set(st.pos.x, 0.04, st.pos.z); }
    if (st.ptr) vfx(p).aimPtr(st.ptr, p.position, st.pos);
    if (st.t <= 0) { v.strikes.splice(i, 1); if (st.ptr) { st.ptr.life = 0; st.ptr.m.visible = false; } landStrike(p, st); }
  }
  // Shocked read: a few pooled cyan sparks on up to 4 Shocked enemies (no per-enemy meshes)
  if ((v.sparkT = (v.sparkT || 0) - dt) <= 0) { v.sparkT = 0.22; let k = 0; for (const e of enemies(p)) { if (k >= 4) break; if (e.canBeHit && isShocked(e)) { k++; p.world.effects.localSparks(e.position.clone().setY(1.2), 0x6ae4ff, 2, 3); } } }
  // the ultimate is meter-gated: no timer, just "full or not"
  p.spinCooldown = meterFull(p) ? 0 : p.spinCooldownMax;
  // the maul reacts: coils spin faster / arcs crackle with Charge and during the Surge
  p.model.setCharge?.(v.surge ? 1 : Math.min(1, v.charge / chargeMax(p)));
}
export function vInCombat(p) { if (p.vk) p.vk.combatT = 0; }
// HUD helpers
export const hudCharge = (p) => (p.vk ? [p.vk.charge, chargeMax(p)] : [0, 10]);
export const hudMeter = (p) => (p.vk ? (p.vk.surge ? -1 : p.vk.meter / p.char.meter.max) : 0);

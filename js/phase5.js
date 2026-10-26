// phase5.js: COREBURNZ PHASE 5A + 5B. Hero ability interactions, Axiom co-op links, six new cards,
// three evolutions and three Mythics. Everything is host-side (strike() never runs on co-op clients),
// effects go through world.effects (the co-op fx recorder replays them for friends), so no new net traffic.
// Safety rules for every effect here:
//   - procs deal damage with kind 'p5' / 'p5w', which is NOT an attack kind (no leech, Twin, Storm,
//     Talons) and is ignored by onStrike(), so nothing here can trigger itself (no recursion);
//   - every proc has an internal cooldown and a target cap; bases are flat (x hero damage pipeline),
//     never "x the hit that triggered it", so crits / multi-hits can't multiply into each other;
//   - all state lives in hero.p5 (reset with the hero) and team links re-check that the Axiom
//     giving them is still alive and still in the team, so nothing outlives death or a disconnect.
import * as THREE from 'three';

const REF = 12; // flat proc base (= Sarrow's first talon hit), multiplied by the hero's normal damage pipeline
export const P5 = {
  // ---- Axiom co-op (Priority 1) ----
  guard:    { radius: 7, time: 1.5, cut: 0.15 },                      // REFORGE GUARDIAN LINK: allies take 15% less for 1.5s (never stacks)
  swarmLink:{ icd: 1.2, icdAsc: 0.8, pct: 0.3, cap: REF * 3, jumps: 2, range: 5 }, // SWARM TARGET LINK (per teammate cooldown)
  uplink:   { radius: 9, every: 1, give: 0.3, perAlly: 2, pool: 4 },   // ASCENSION UPLINK: -0.3s mobility cd per second, 2s per ally, 4s team pool per Ascension
  // ---- hero interactions (Priority 2) ----
  focus:    { time: 4, ascTime: 6, range: 14 },                        // AXIOM SWARM DIRECTIVE: drones focus one priority target
  bloodstep:{ icd: 1.5, stacks: 2, radius: 2.2, dmg: 0.6, maxHits: 4 },  // SARROW (x REF)
  counter:  { window: 4, icd: 3, radius: 3.4, dmg: 0.9, stun: 0.7, knock: 16 }, // ZALEKS (x REF)
  relay:    { window: 2.5, pierce: 1, mineR: 3.5 },                    // ISKRA
  conduct:  { icd: 0.4, perTarget: 1.2, dmg: 0.5, pull: 0.7, maxJumps: 2 }, // ORIN (x beam damage)
  execute:  { icd: 2.5, dmg: 0.8 },                                    // KAGERO (x Shadow Step damage x clone %)
  // ---- cards (Priority 3) ----
  momentum: { window: 3, radius: 1.8, dmg: [0, 0.8, 1.1, 1.4] },        // x REF
  plating:  { hitPct: 0.08, delay: 0.5, icd: [0, 7, 6, 5], radius: 3, dmg: 1.2, knock: 14 },
  conductor:{ icd: 0.35, perTarget: 1.5, range: 4.5, jumps: [0, 2, 2, 3], dmg: [0, 0.45, 0.6, 0.75] },
  overload: { need: [0, 4, 3], switchGap: 0.4, icd: 4, radius: 2.6, dmg: [0, 2.2, 3] },
  vents:    { hpPct: 0.35, cd: [0, 25, 20], time: 2.5, speed: 0.3, radius: 4, slow: 0.5, slowT: 2 },
  echo:     { need: 5, gainGap: 0.2, dmg: [0, 1, 1.4, 1.8], radius: 3.5 },
  // ---- evolutions (Priority 4) ----
  overdrive:{ stacks: 5, stackGap: 0.3, time: 3, cd: 10, speed: 0.2, pulseIcd: 0.5, radius: 2.2, dmg: 1 },
  aegis:    { radius: 4.2, dmg: 1.8, stun: 0.6, recover: 2, recoverDmg: 1.2 },
  cascade:  { jumps: 5, falloff: 0.8, slowT: 1, icd: 0.6 },
  // ---- Mythics (Priority 5) ----
  rift:     { hits: 25, hitGap: 0.12, icd: 10, time: 2.5, radius: 5, pull: 5, tick: 0.5, dmg: 1.2, maxTargets: 12, boom: 3 },
  paradox:  { pips: 6, switchGap: 0.35, time: 5, cd: 15, burstIcd: 0.4, radius: 2.4, dmg: 1.6, finale: 4 },
  warforge: { every: 12, shots: 5, dupes: 2, dmg: 0.9, icd: 0.15, minFree: 12 },
};
const ATTACK = new Set(['slash', 'needle', 'beam']);   // ordinary attacks (dash = a mobility ability)
const ABILITY = new Set(['dash', 'spin']);             // mobility + ultimate hits
const now = () => performance.now() / 1000;
const flat = (p, x) => new THREE.Vector3(x.x, 0, x.z);
const dist2 = (a, b) => { const dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; };

export function p5Reset(p) { p.p5 = { busy: 0, speedT: 0, speedK: 0 }; }
const st = (p) => p.p5 || (p.p5 = { busy: 0 });
const team = (p) => (p.world.heroes || [p.world.player]).filter((h) => h && !h.dead);
const enemies = (p) => p.world.enemies?.list || [];

// a proc hit: kind 'p5' so it never re-enters onStrike or the attack-only perks
function proc(p, e, base, kx = 0, kz = 0, heavy = false, kind = 'p5') {
  if (!e.canBeHit) return;
  const s = st(p); s.busy++;
  try { p.strike(e, base, kx, kz, heavy, kind); } finally { s.busy--; }
}
function burst(p, at, r, base, { knock = 6, stun = 0, max = 12, color = 0x6af0ff } = {}) {
  const fx = p.world.effects; fx.spawnRing(at, color, r, 0.35); fx.spawnSparks(flat(p, at).setY(1), color, 10, 6);
  let n = 0;
  for (const e of enemies(p)) {
    if (n >= max) break;
    if (!e.canBeHit || dist2(e.position, at) > (r + e.radius) ** 2) continue;
    const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 1;
    proc(p, e, base, dx / d * knock, dz / d * knock, knock > 8);
    if (stun) p.stun(e, stun);
    n++;
  }
  return n;
}
function statuses(p, e) { // existing statuses this enemy carries right now
  const t = now(); let n = 0;
  if (e.bleed?.stacks) n++;
  if (e.markT > t) n++;
  if (e.stun > 0) n++;
  if (e.wellUntil > t) n++;
  if (e.slowT > 0) n++;
  return n;
}
function chain(p, from, base, jumps, range, { falloff = 1, color = 0x7ae8ff, slowT = 0 } = {}) {
  const done = new Set([from]); let src = from, b = base;
  for (let i = 0; i < jumps; i++) {
    let best = null, bd = range * range;
    for (const e of enemies(p)) { if (!e.canBeHit || done.has(e)) continue; const d = dist2(e.position, src.position); if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    done.add(best); p.world.effects.spawnZap(src.position, best.position, color);
    proc(p, best, b); if (slowT && !best.isBoss) { best.slowT = Math.max(best.slowT || 0, slowT); best.slowMul = 0.6; }
    src = best; b *= falloff;
  }
  if (done.size > 1) p.world.sfx('zap');
  return done.size - 1;
}

// ======================= hooks called from player.js =======================

// every hit the hero lands (host only, after the damage). dmg = final damage dealt.
export function p5OnStrike(p, e, dmg, kind) {
  const s = st(p); if (s.busy || kind === 'p5' || kind === 'p5w' || p.cloneHit) return;
  const S = p.stats.p5 || {}, t = now(), attack = ATTACK.has(kind), ability = ABILITY.has(kind);
  if (!attack && !ability) return; // passive sources (bleed ticks, trails, drones, mines) never charge anything
  if (attack) {
    actionSwitch(p, 'atk', t);
    swarmLink(p, e, dmg, t);
    // ISKRA Needle Relay: the relay needle sets off a nearby mine
    if (s.relayShot > t && kind === 'needle') { s.relayShot = 0; relayMine(p, e); }
    // Momentum Capacitor
    if (S.momentum && s.momUntil > t && !(s.odT > t)) { s.momUntil = 0; burst(p, e.position, P5.momentum.radius, REF * P5.momentum.dmg[S.momentum], { color: 0x6af0ff }); }
    // Overdrive Engine: attacks after movement build stacks; at 5 a 3s burst of momentum
    if (S.overdrive) overdriveHit(p, e, t);
    // Conductor Matrix / Resonance Cascade
    if (S.conductor) conductor(p, e, t, S);
    // Overload Circuit burst
    if (S.overload && s.olReady && t >= (s.olAt || 0)) { s.olReady = false; s.ol = 0; s.olAt = t + P5.overload.icd; burst(p, e.position, P5.overload.radius, REF * P5.overload.dmg[S.overload], { color: 0xffd040, knock: 9 }); p.world.sfx('hit'); }
    // Echo Chamber: release the echo
    if (S.echo && (s.echo || 0) >= P5.echo.need) { s.echo = 0; echoRelease(p, e, S.echo); }
    // MYTHICS
    if (S.rift && !s.rift && t - (s.riftHitAt || 0) >= P5.rift.hitGap) { s.riftHitAt = t; s.riftN = Math.min(P5.rift.hits, (s.riftN || 0) + 1); if (s.riftN >= P5.rift.hits && t >= (s.riftCd || 0)) riftOpen(p, e); }
    if (S.paradox && s.pxT > t && t >= (s.pxBurst || 0)) { s.pxBurst = t + P5.paradox.burstIcd; burst(p, e.position, P5.paradox.radius, REF * P5.paradox.dmg, { color: 0xd070ff, knock: 7 }); }
    if (S.warforge && s.wfShots > 0 && t >= (s.wfAt || 0)) warforge(p, e, t);
  } else { // ability hit
    if (S.echo && t - (s.echoAt || 0) >= P5.echo.gainGap) { s.echoAt = t; s.echo = Math.min(P5.echo.need, (s.echo || 0) + 1); }
  }
}

// mobility / ultimate pressed (and it happened)
export function p5OnAbility(p, slot) {
  const s = st(p), S = p.stats.p5 || {}, t = now();
  if (slot === 'mob') {
    if (S.momentum) { s.momUntil = t + P5.momentum.window; p.world.effects.spawnRing(p.position, 0x6af0ff, 1.2, 0.25); }
    if (S.overdrive) s.odMoveAt = t;
    if (p.kit === 'iskra') { s.relay = t + P5.relay.window; } // ISKRA Needle Relay armed by Phase Hop
  }
  if (S.echo && p.kit === 'axiom') s.echo = Math.min(P5.echo.need, (s.echo || 0) + 1); // Axiom's abilities don't hit directly: using one counts
  actionSwitch(p, 'abl', t);
  if (S.paradox && s.pxT > t && slot === 'mob' && !s.pxFree) { s.pxFree = true; if (p.dashCharges < p.maxCharges) { p.dashCharges++; p.world.effects.spawnRing(p.position, 0xd070ff, 1.6, 0.3); } } // one free mobility per Paradox
}

// alternating attack <-> ability feeds Overload Circuit and Paradox Engine (never passive damage)
function actionSwitch(p, kind, t) {
  const s = st(p), S = p.stats.p5 || {};
  if (s.lastAct === kind) return;
  const gapOk = t - (s.switchAt || 0) >= Math.min(P5.overload.switchGap, P5.paradox.switchGap);
  s.lastAct = kind; if (!gapOk) return; s.switchAt = t;
  if (S.overload && !s.olReady && t >= (s.olAt || 0) - P5.overload.icd + 0.5) { s.ol = (s.ol || 0) + 1; if (s.ol >= P5.overload.need[S.overload]) { s.olReady = true; p.world.effects.spawnRing(p.position, 0xffd040, 1.5, 0.3); } }
  if (S.paradox && !(s.pxT > t) && t >= (s.pxCd || 0)) {
    s.px = (s.px || 0) + 1;
    p.world.effects.spawnSparks(p.position.clone().setY(1.6), 0xd070ff, 2 + s.px, 3);
    if (s.px >= P5.paradox.pips) { s.px = 0; s.pxT = t + P5.paradox.time; s.pxFree = false; s.pxCd = t + P5.paradox.time + P5.paradox.cd; s.pxFin = true;
      p.world.effects.spawnRing(p.position, 0xd070ff, 3.2, 0.5); p.world.effects.spawnSparks(p.position.clone().setY(1.2), 0xffffff, 16, 8); p.world.sfx('powerup'); }
  }
}

// a hit the hero took (after all mitigation, when hp actually dropped)
export function p5OnHurt(p, amount) {
  const s = st(p), S = p.stats.p5 || {}, t = now();
  if (S.plating && amount >= p.maxHp * P5.plating.hitPct && t >= (s.plAt || 0)) { s.plAt = t + P5.plating.icd[S.plating]; s.plFire = t + P5.plating.delay; p.world.effects.spawnRing(p.position, 0xffb060, 1.2, P5.plating.delay); }
  if (s.aegisWait) s.aegisWait = 0; // hit again before recovering: no Aegis recovery pulse
  if (S.vents && p.hp > 0 && p.hp < p.maxHp * P5.vents.hpPct && t >= (s.vAt || 0)) {
    const V = P5.vents; s.vAt = t + V.cd[S.vents]; s.speedT = t + V.time; s.speedK = V.speed;
    p.world.effects.spawnRing(p.position, 0xc8f0ff, V.radius, 0.45); p.world.effects.spawnSparks(p.position.clone().setY(0.6), 0xffffff, 14, 7); p.world.sfx('blink');
    for (const e of enemies(p)) if (e.canBeHit && !e.isBoss && dist2(e.position, p.position) < (V.radius + e.radius) ** 2) { e.slowT = Math.max(e.slowT || 0, V.slowT); e.slowMul = V.slow; }
  }
}
// ZALEKS: a frontal block happened (takeDamage's block branch)
export function p5OnBlock(p) { const s = st(p), t = now(); if (t >= (s.ctrAt || 0) && !(s.ctr > t)) { s.ctr = t + P5.counter.window; p.world.effects.spawnRing(p.position, 0xffd090, 1.6, 0.3); } }
// incoming damage multiplier from team links (Reforge Guardian Link). Never stacks: one 15% at most.
export function p5DamageTaken(p) {
  const g = p.p5?.guard; if (!g || g.until <= now()) return 1;
  if (!g.by || g.by.dead || !team(p).includes(g.by)) { p.p5.guard = null; return 1; }
  return 1 - P5.guard.cut;
}
export function p5Speed(p) { const s = p.p5; if (!s) return 1; const t = now(); return 1 + (s.speedT > t ? s.speedK : 0) + (s.odT > t ? P5.overdrive.speed : 0); }

// per-frame (host / solo), cheap timers only
export function p5Tick(p, dt) {
  const s = st(p), S = p.stats.p5 || {}, t = now(), fx = p.world.effects;
  if (p.world.netClient) return;
  if (s.plFire && t >= s.plFire) { // Kinetic Plating / Reactive Aegis retaliation
    s.plFire = 0;
    if (S.aegis) { burst(p, p.position, P5.aegis.radius, REF * P5.aegis.dmg, { knock: P5.plating.knock, stun: P5.aegis.stun, color: 0xffd84a }); s.aegisWait = t + P5.aegis.recover; }
    else burst(p, p.position, P5.plating.radius, REF * P5.plating.dmg, { knock: P5.plating.knock, color: 0xffb060 });
    p.world.shake?.(0.2); p.world.sfx('hit');
  }
  if (s.aegisWait && t >= s.aegisWait) { s.aegisWait = 0; burst(p, p.position, P5.aegis.radius * 0.8, REF * P5.aegis.recoverDmg, { knock: 8, color: 0xfff0a0 }); } // recovered without being hit
  if (S.warforge && !(s.wfShots > 0) && (s.wfT = (s.wfT || 0) + dt) >= P5.warforge.every) { s.wfT = 0; s.wfShots = P5.warforge.shots; fx.spawnRing(p.position, 0xffa040, 2, 0.4); fx.spawnSparks(p.position.clone().setY(1.5), 0xffd84a, 10, 5); }
  if (s.rift) riftUpdate(p, dt, t);
  if (S.paradox && s.pxFin && !(s.pxT > t)) { s.pxFin = false; burst(p, p.position, P5.paradox.finale, REF * P5.paradox.dmg * 1.5, { knock: 10, color: 0xd070ff, max: 14 }); p.world.shake?.(0.3); }
  if (p.kit === 'axiom') axiomTick(p, t);
  // lightweight "ready" tells: a few sparks twice a second
  if ((s.tell = (s.tell || 0) - dt) <= 0) {
    s.tell = 0.5;
    const at = p.position.clone().setY(1.7);
    if (s.ctr > t) fx.spawnSparks(p.position.clone().addScaledVector(p.facingDir, 0.7).setY(1.2), 0xffd090, 3, 2);
    else if (s.relay > t) fx.spawnSparks(at, 0xfff0ff, 2, 2);
    if (s.momUntil > t) fx.spawnSparks(at, 0x6af0ff, 2, 2);
    if (s.olReady) fx.spawnSparks(at, 0xffd040, 2, 2);
    if (S.echo && s.echo >= P5.echo.need) fx.spawnSparks(at, 0x9affc8, 2, 2);
    if (s.pxT > t) fx.spawnSparks(at, 0xd070ff, 3, 3);
    if (s.odT > t) fx.spawnSparks(p.position.clone().setY(0.4), 0x6af0ff, 3, 3);
    if (s.wfShots > 0) fx.spawnSparks(at, 0xffa040, 2, 2);
  }
}

// ======================= hero interactions =======================
// SARROW: Blink through an enemy that was already bleeding = BLOODSTEP (re-bleed + a cross-slash pulse)
export function p5Bloodstep(p, e, hadBleed) {
  const s = st(p), t = now(), B = P5.bloodstep; if (!hadBleed || t < (s.bsAt || 0)) return;
  s.bsAt = t + B.icd;
  const fx = p.world.effects, at = e.position.clone();
  const d = p.dashDir || p.facingDir, side = new THREE.Vector3(-d.z, 0, d.x);
  fx.spawnLine(at.clone().addScaledVector(side.clone().add(d).normalize(), -1.6), side.clone().add(d).normalize(), 3.2, 0.35, 0.3);
  fx.spawnLine(at.clone().addScaledVector(side.clone().sub(d).normalize(), -1.6), side.clone().sub(d).normalize(), 3.2, 0.35, 0.3);
  fx.spawnRing(at, 0xff2a4a, B.radius, 0.3); fx.spawnSparks(at.clone().setY(1.1), 0x3ff6e0, 10, 7);
  let n = 0;
  for (const o of enemies(p)) {
    if (n >= B.maxHits || !o.canBeHit || dist2(o.position, at) > (B.radius + o.radius) ** 2) continue;
    proc(p, o, REF * B.dmg); p.world.allies?.addBleed(p, o, B.stacks); n++;
  }
  p.world.sfx('hit');
}
// ZALEKS: the bash right after a block = JUGGERNAUT COUNTER
export function p5ZalBash(p, forward) {
  const s = st(p), t = now(), C = P5.counter; if (!(s.ctr > t)) return;
  s.ctr = 0; s.ctrAt = t + C.icd;
  const at = p.position.clone().addScaledVector(forward, 1.6);
  burst(p, at, C.radius, REF * C.dmg, { knock: C.knock, stun: C.stun, color: 0xffd090 });
  p.mJobs.push({ t: 0.18, run: () => { if (!p.dead) burst(p, at, C.radius * 1.4, REF * C.dmg * 0.5, { knock: 8, color: 0xffa030 }); } }); // secondary shockwave
  p.world.shake?.(0.35);
}
// ISKRA: first Needle after Phase Hop = NEEDLE RELAY (+1 pierce, energy trail, sets off a mine)
export function p5RelayOpts(p, opts, aim) {
  const s = st(p), t = now(); if (!(s.relay > t)) return opts;
  s.relay = 0; s.relayShot = t + 1;
  p.world.effects.spawnLine(p.position, aim, 9, 0.18, 0.3); p.world.effects.spawnSparks(p.position.clone().setY(1.2), 0xfff0ff, 6, 5);
  return { ...opts, pierce: opts.pierce + P5.relay.pierce, color: 0xfff0ff };
}
function relayMine(p, e) {
  const al = p.world.allies; if (!al?.mines) return;
  let best = null, bd = P5.relay.mineR ** 2;
  for (const m of al.mines) if (m.life > 0 && m.owner === p && m.arm <= 0) { const d = dist2(m.mesh.position, e.position); if (d < bd) { bd = d; best = m; } }
  if (best) { p.world.effects.spawnZap(e.position, best.mesh.position, 0xfff0ff); al.boomMine(best, 1); }
}
// ORIN: tethered target inside a Gravity Well = GRAVITY CONDUCTOR (a pulse jumps to well-caught foes and tugs them in)
export function p5OrinTether(p, tgt) {
  const s = st(p), t = now(), C = P5.conduct;
  if (!(tgt.wellUntil > t) || t < (s.gcAt || 0) || (tgt.p5gc || 0) > t) return;
  s.gcAt = t + C.icd; tgt.p5gc = t + C.perTarget;
  let n = 0; const from = tgt.position;
  for (const e of enemies(p)) {
    if (n >= C.maxJumps || e === tgt || !e.canBeHit || !(e.wellUntil > t)) continue;
    p.world.effects.spawnZap(from.clone().setY(1), e.position.clone().setY(1), 0x9ab0ff);
    proc(p, e, p.char.beam.damage * C.dmg);
    if (!e.isBoss) { const dx = from.x - e.position.x, dz = from.z - e.position.z, d = Math.hypot(dx, dz) || 1; const k = Math.min(C.pull, Math.max(0, d - 1)); e.position.x += dx / d * k; e.position.z += dz / d * k; }
    n++;
  }
  if (n) p.world.effects.spawnRing(from, 0x9ab0ff, 1.4, 0.25);
}
// KAGERO: Shadow Step consumed a mark = SHADOW EXECUTION (the clone flashes in for a coordinated cut)
export function p5KageroExec(p, tgt) {
  const s = st(p), t = now(), al = p.world.allies, c = al?.cloneOf?.(p);
  if (!c || !tgt.canBeHit || t < (s.exAt || 0)) return;
  s.exAt = t + P5.execute.icd;
  const fx = p.world.effects, from = c.position.clone();
  const v = new THREE.Vector3(tgt.position.x - from.x, 0, tgt.position.z - from.z); const len = v.length() || 1; v.divideScalar(len);
  fx.spawnLine(from, v, len + 1, 0.25, 0.25); fx.spawnZap(from.clone().setY(1.1), tgt.position.clone().setY(1.1), 0xb090ff);
  c.position.set(tgt.position.x - v.x * (tgt.radius + 0.8), 0, tgt.position.z - v.z * (tgt.radius + 0.8)); c.facing = Math.atan2(v.x, v.z); c.flick = 0.2;
  p.cloneHit = true; try { proc(p, tgt, p.char.stepDmg * p.stats.stepDmg * c.pct * P5.execute.dmg, v.x * 5, v.z * 5, true); } finally { p.cloneHit = false; }
  fx.spawnRing(tgt.position, 0xb090ff, 1.8, 0.3); fx.spawnSparks(tgt.position.clone().setY(1.2), 0xff4ad8, 10, 6);
}
// KAGERO: the clone's own throws prefer a marked enemy (allies.js idle throw)
export function p5CloneTarget(c, list, range = 12) {
  const t = now(); let best = null, bd = range * range;
  for (const e of list) if (e.canBeHit && e.markT > t) { const d = dist2(e.position, c.position); if (d < bd) { bd = d; best = e; } }
  return best;
}
// AXIOM: SWARM DIRECTIVE. Reforge / Overclock / Ascension pick a priority target for the swarm.
export function p5AxiomCommand(p, longer = false) {
  const s = st(p), t = now();
  let best = null, score = -1;
  for (const e of enemies(p)) {
    if (!e.canBeHit) continue; const d2 = dist2(e.position, p.position); if (d2 > P5.focus.range ** 2) continue;
    const sc = (e.isBoss ? 3 : e.elite ? 2 : 1) * 1000 + (e.hp || 0) / (1 + Math.sqrt(d2) * 0.2); // bosses > elites > toughest nearby
    if (sc > score) { score = sc; best = e; }
  }
  s.focus = best; s.focusUntil = t + (longer ? P5.focus.ascTime : P5.focus.time);
  const fx = p.world.effects; fx.spawnRing(p.position, 0x5af0ff, 3, 0.35);
  if (best) { fx.spawnZap(p.position.clone().setY(1.8), best.position.clone().setY(1.4), 0x5af0ff); fx.spawnRing(best.position, 0x5af0ff, 1.6, 0.4); }
  return best;
}
export function p5Focus(p) { const s = p.p5; if (!s?.focus || !(s.focusUntil > now()) || !s.focus.canBeHit) return null; return s.focus; }
function axiomTick(p, t) {
  const s = st(p), f = p5Focus(p), fx = p.world.effects;
  if (f && (s.fTell = (s.fTell || 0) - 1 / 60) <= 0) { s.fTell = 0.4; fx.spawnSparks(f.position.clone().setY(2.4), 0x5af0ff, 2, 1.5); }
  // ASCENSION UPLINK: modest mobility-recharge help for nearby teammates, capped per ally and per Ascension
  if (p.ascendT > 0 && t >= (s.uplAt || 0)) {
    s.uplAt = t + P5.uplink.every; const U = P5.uplink;
    for (const h of team(p)) {
      if (h === p || (s.uplPool ?? U.pool) <= 0 || dist2(h.position, p.position) > U.radius ** 2) continue;
      const hs = st(h); if (t < (hs.uplGot || 0)) continue; // another Axiom already uplinked them this second
      const given = s.uplGiven?.get(h) || 0; if (given >= U.perAlly) continue;
      const g = Math.min(U.give, U.perAlly - given, s.uplPool ?? U.pool);
      if (h.dashCharges < h.maxCharges && h.dashCooldown > 0) { h.dashCooldown = Math.max(0.01, h.dashCooldown - g); s.uplPool = (s.uplPool ?? U.pool) - g; (s.uplGiven ||= new Map()).set(h, given + g); }
      hs.uplGot = t + U.every * 0.95;
      fx.spawnZap(p.position.clone().setY(2), h.position.clone().setY(1.4), 0x5af0ff);
    }
  }
}
export function p5OnAscend(p) { const s = st(p); s.uplPool = P5.uplink.pool; s.uplGiven = new Map(); s.uplAt = 0; p5AxiomCommand(p, true); }
// REFORGE GUARDIAN LINK: nearby allies get a short 15% damage cut (not Axiom himself: his barrier already does that)
export function p5OnReforge(p) {
  p5AxiomCommand(p);
  const t = now(), G = P5.guard;
  for (const h of team(p)) {
    if (h === p || dist2(h.position, p.position) > G.radius ** 2) continue;
    st(h).guard = { until: t + G.time, by: p };
    p.world.effects.spawnRing(h.position, 0x5af0ff, 1.5, 0.35); p.world.effects.spawnSparks(h.position.clone().setY(1.2), 0x9affff, 5, 3);
  }
}
// SWARM TARGET LINK: a TEAMMATE's attack on an Axiom's priority target arcs to 2 more enemies (per-teammate cooldown)
function swarmLink(p, e, dmg, t) {
  const hs = st(p); if (t < (hs.slAt || 0)) return;
  for (const ax of team(p)) {
    if (ax === p || ax.kit !== 'axiom' || p5Focus(ax) !== e) continue;
    const L = P5.swarmLink; hs.slAt = t + (ax.ascendT > 0 ? L.icdAsc : L.icd);
    const amt = Math.min(dmg * L.pct, L.cap * (p.stats.weapon || 1));
    const fx = p.world.effects; fx.spawnRing(e.position, 0x5af0ff, 1.2, 0.25);
    const done = new Set([e]); let src = e;
    for (let i = 0; i < L.jumps; i++) {
      let best = null, bd = L.range ** 2;
      for (const o of enemies(p)) { if (!o.canBeHit || done.has(o)) continue; const d = dist2(o.position, src.position); if (d < bd) { bd = d; best = o; } }
      if (!best) break; done.add(best); fx.spawnZap(src.position, best.position, 0x5af0ff); best.hit(amt, 0, 0, false); src = best;
    }
    hs.slN = (hs.slN || 0) + 1;
    return;
  }
}

// ======================= card helpers =======================
function conductor(p, e, t, S) {
  const s = st(p), C = P5.conductor; if (t < (s.cmAt || 0) || (e.p5cm || 0) > t) return;
  const n = statuses(p, e); if (!n) return;
  const cascade = S.cascade && n >= 2;
  s.cmAt = t + (cascade ? P5.cascade.icd : C.icd); e.p5cm = t + C.perTarget;
  if (cascade) { p.world.effects.spawnRing(e.position, 0xb0ffff, 1.6, 0.3); chain(p, e, REF * C.dmg[S.conductor] * 1.2, P5.cascade.jumps, C.range, { falloff: P5.cascade.falloff, color: 0xb0ffff, slowT: P5.cascade.slowT }); }
  else chain(p, e, REF * C.dmg[S.conductor], C.jumps[S.conductor], C.range);
}
function echoRelease(p, e, lvl) {
  const E = P5.echo, fx = p.world.effects; fx.spawnRing(e.position, 0x9affc8, 1.4, 0.3);
  proc(p, e, REF * E.dmg[lvl]);
  let best = null, bd = E.radius ** 2;
  for (const o of enemies(p)) { if (o === e || !o.canBeHit) continue; const d = dist2(o.position, e.position); if (d < bd) { bd = d; best = o; } }
  if (best) { fx.spawnZap(e.position, best.position, 0x9affc8); proc(p, best, REF * E.dmg[lvl] * 0.6); }
}
function overdriveHit(p, e, t) {
  const s = st(p), O = P5.overdrive;
  if (s.odT > t) { if (t >= (s.odPulse || 0)) { s.odPulse = t + O.pulseIcd; burst(p, e.position, O.radius, REF * O.dmg, { color: 0x6af0ff, knock: 8 }); } return; }
  if (t < (s.odCd || 0) || !(t - (s.odMoveAt || -9) < 2) || t - (s.odStackAt || 0) < O.stackGap) return;
  s.odStackAt = t; s.od = (s.od || 0) + 1;
  if (s.od >= O.stacks) { s.od = 0; s.odT = t + O.time; s.odCd = t + O.time + O.cd; p.world.effects.spawnRing(p.position, 0x6af0ff, 2.6, 0.4); p.world.sfx('powerup'); }
}
function riftOpen(p, e) {
  const s = st(p), t = now(); s.riftN = 0; s.riftCd = t + P5.rift.icd;
  s.rift = { pos: flat(p, e.position), t: P5.rift.time, tick: 0, fx: 0 };
  p.world.effects.spawnRing(s.rift.pos, 0x8a5aff, P5.rift.radius, 0.5); p.world.sfx('overdrive'); p.world.shake?.(0.25);
}
function riftUpdate(p, dt, t) {
  const s = st(p), R = P5.rift, r = s.rift, fx = p.world.effects;
  r.t -= dt;
  if ((r.fx -= dt) <= 0) { r.fx = 0.25; fx.spawnRing(r.pos, 0x8a5aff, R.radius * (0.5 + 0.5 * Math.random()), 0.3); fx.spawnSparks(r.pos.clone().setY(0.8), 0x2a1050, 4, 4); }
  for (const e of enemies(p)) { // pull (bosses only slowed)
    if (!e.canBeHit) continue; const dx = r.pos.x - e.position.x, dz = r.pos.z - e.position.z, d = Math.hypot(dx, dz);
    if (d > R.radius + e.radius) continue;
    if (e.isBoss) { e.slowT = Math.max(e.slowT || 0, 0.25); e.slowMul = 0.7; continue; }
    if (d > 0.7) { const k = Math.min(d - 0.6, R.pull * dt); e.position.x += dx / d * k; e.position.z += dz / d * k; }
  }
  if ((r.tick -= dt) <= 0) {
    r.tick = R.tick; let n = 0; let last = null;
    for (const e of enemies(p)) { if (n >= R.maxTargets) break; if (!e.canBeHit || dist2(e.position, r.pos) > (R.radius + e.radius) ** 2) continue; proc(p, e, REF * R.dmg); if (n < 4) fx.spawnZap(r.pos.clone().setY(1), e.position.clone().setY(1), 0xa07aff); n++; }
  }
  if (r.t <= 0) { s.rift = null; burst(p, r.pos, R.radius * 0.8, REF * R.boom, { knock: 10, color: 0xa07aff, max: R.maxTargets }); p.world.shake?.(0.3); }
}
function warforge(p, e, t) {
  const s = st(p), W = P5.warforge, al = p.world.allies; if (!al?.needles) return;
  s.wfAt = t + W.icd; s.wfShots--;
  const free = al.needles.reduce((a, x) => a + (x.life <= 0 ? 1 : 0), 0); if (free < W.minFree) return; // pool guard: skip when busy
  const side = new THREE.Vector3(-Math.cos(p.facing), 0, Math.sin(p.facing));
  for (let i = 0; i < W.dupes; i++) {
    const from = p.position.clone().addScaledVector(side, i ? 1.2 : -1.2).setY(1.6);
    const dir = new THREE.Vector3(e.position.x - from.x, 0, e.position.z - from.z);
    if (dir.lengthSq() < 0.01) continue;
    p.world.effects.spawnSparks(from, 0xffa040, 3, 2);
    al.fireNeedle(p, from, dir.normalize(), REF * W.dmg, { speed: 36, range: 14, color: 0xffb040, kind: 'p5w', pierce: 0 });
  }
}

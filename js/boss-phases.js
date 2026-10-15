// boss-phases.js (CoreBurnZ only)
// Every boss gets a PHASE 2 at 50% health: a short "transition" (it shrugs off most damage for
// 1.5s, the arena shakes, a banner names the new move) and then a NEW signature attack themed to
// that boss, on top of its normal pattern. Under 20% health it ENRAGES: faster wind-ups, faster
// feet, red sparks, and the signature attack comes round sooner. Host-side only (co-op friends see
// the warnings through the normal effect sync).
import * as THREE from 'three';

const V = (x, z) => new THREE.Vector3(x, 0, z);
const dirTo = (a, b) => { const d = V(b.x - a.x, b.z - a.z); return d.lengthSq() > 1e-4 ? d.normalize() : V(0, 1); };

// ---------- small helpers (warning, then damage) ----------
function heroes(w) { return (w.heroes || [w.player]).filter((h) => h && !h.dead); }
function later(b, t, fn) { b.ph.jobs.push({ t, fn }); }
function circle(b, pos, r, delay, dmg) {
  const w = b.world, p = pos.clone();
  w.effects.spawnWarning(p, r, delay);
  later(b, delay, () => {
    for (const h of heroes(w)) if (Math.hypot(h.position.x - p.x, h.position.z - p.z) < r + h.radius) h.takeDamage(dmg * b.dmgMult, b);
    w.effects.spawnRing(p, b.ph.color, r + 0.3, 0.35); w.effects.spawnSparks(p.clone().setY(0.8), b.ph.color, 6, 6);
  });
}
function ring(b, pos, r0, r1, delay, dmg) { // a ring-shaped hit (safe inside and outside)
  const w = b.world, p = pos.clone();
  w.effects.spawnWarning(p, r1, delay);
  later(b, delay, () => {
    for (const h of heroes(w)) { const d = Math.hypot(h.position.x - p.x, h.position.z - p.z); if (d > r0 - h.radius && d < r1 + h.radius) h.takeDamage(dmg * b.dmgMult, b); }
    w.effects.spawnRing(p, b.ph.color, r1, 0.4);
  });
}
function line(b, from, dir, len, width, delay, dmg) {
  const w = b.world, p = from.clone(), d = dir.clone().normalize();
  w.effects.spawnLine(p, d, len, width, delay);
  later(b, delay, () => {
    for (const h of heroes(w)) {
      const dx = h.position.x - p.x, dz = h.position.z - p.z, along = dx * d.x + dz * d.z;
      if (along > -0.5 && along < len + 0.5 && Math.abs(dx * d.z - dz * d.x) < width / 2 + h.radius) h.takeDamage(dmg * b.dmgMult, b);
    }
    for (let i = 1; i <= 4; i++) w.effects.spawnSparks(p.clone().addScaledVector(d, len * i / 5).setY(0.6), b.ph.color, 3, 4);
  });
}
function shots(b, from, angles, speed, dmg, color, size = 1) {
  for (const a of angles) b.world.projectiles.fire(from.clone().setY(1.4), V(Math.sin(a), Math.cos(a)), speed, dmg * b.dmgMult, color, size, b);
}
const aim = (b) => { const h = heroes(b.world); let best = h[0]; for (const x of h) if (x.position.distanceTo(b.position) < best.position.distanceTo(b.position)) best = x; return best; };

// ---------- the 12 signature phase-2 attacks ----------
export const PHASE_ATTACKS = {
  deacon: { name: 'MOLTEN TITHE', color: 0xff7a1a, run(b) { // slag rains in a staggered spiral round every hero
    for (const h of heroes(b.world)) for (let i = 0; i < 5; i++) { const a = i * 1.26, r = 1 + i * 0.7; circle(b, V(h.position.x + Math.sin(a) * r, h.position.z + Math.cos(a) * r), 1.6, 1.0 + i * 0.25, 18); }
  } },
  vell: { name: 'REQUIEM LATTICE', color: 0xc8ff3a, run(b) { // three crossing hymn-beams locked over your position
    const h = aim(b); if (!h) return;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + Math.random() * 0.3, d = V(Math.sin(a), Math.cos(a)); line(b, h.position.clone().addScaledVector(d, -14), d, 28, 1.6, 1.1 + i * 0.35, 20); }
  } },
  choirmother: { name: 'LULLABY OF MITES', color: 0xe08aff, run(b) { // two offset rings of notes + a brood of mites
    const n = 10; shots(b, b.position, Array.from({ length: n }, (_, i) => i * Math.PI * 2 / n), 8, 12, 0xe08aff);
    later(b, 0.6, () => shots(b, b.position, Array.from({ length: n }, (_, i) => (i + 0.5) * Math.PI * 2 / n), 8, 12, 0xe08aff));
    later(b, 0.3, () => { for (let i = 0; i < 3; i++) b.world.enemies.spawnAt('mite', b.position.clone().add(V(Math.sin(i * 2.1) * 2, Math.cos(i * 2.1) * 2))); });
  } },
  worm: { name: 'UNDERTOW', color: 0xc89a5a, run(b) { // a trail of eruptions tunnelling straight at you
    const h = aim(b); if (!h) return; const d = dirTo(b.position, h.position);
    for (let i = 0; i < 7; i++) circle(b, b.position.clone().addScaledVector(d, 2 + i * 2.2), 1.7, 0.8 + i * 0.18, 20);
  } },
  rivetjaw: { name: 'RIVET STORM', color: 0xffd040, run(b) { // three fast fans of hot rivets
    for (let k = 0; k < 3; k++) later(b, 0.5 + k * 0.45, () => { const h = aim(b); if (!h) return; const d = dirTo(b.position, h.position), a0 = Math.atan2(d.x, d.z);
      shots(b, b.position, Array.from({ length: 7 }, (_, i) => a0 + (i - 3) * 0.13), 17, 11, 0xffd040, 0.8); });
    b.world.effects.spawnRing(b.position, 0xffd040, 2.5, 0.5);
  } },
  brand: { name: 'BRANDING IRONS', color: 0xff4a20, run(b) { // three parallel searing lines swept towards you
    const h = aim(b); if (!h) return; const d = dirTo(b.position, h.position), side = V(d.z, -d.x);
    for (let i = -1; i <= 1; i++) line(b, b.position.clone().addScaledVector(side, i * 3), d, 20, 1.8, 1.0 + Math.abs(i) * 0.3, 20);
  } },
  temper: { name: 'QUENCH', color: 0x6ad0ff, run(b) { // a steam burst on four sides of you; step to a gap
    const h = aim(b); if (!h) return; const o = Math.random() * Math.PI;
    for (let i = 0; i < 4; i++) { const a = o + i * Math.PI / 2; circle(b, V(h.position.x + Math.sin(a) * 2.3, h.position.z + Math.cos(a) * 2.3), 1.9, 1.15, 18); }
    circle(b, h.position, 1.2, 1.6, 14);
  } },
  hymnworks: { name: 'ORGAN CRESCENDO', color: 0xffb020, run(b) { // three expanding chord rings; stand between them
    for (let i = 0; i < 3; i++) ring(b, b.position, 2.5 + i * 3.5, 4.2 + i * 3.5, 1.0 + i * 0.55, 18);
  } },
  klaxon: { name: 'SIREN WAIL', color: 0xff3a3a, run(b) { // a cross of sound, then the same cross turned 45 degrees
    for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + k * Math.PI / 4; line(b, b.position, V(Math.sin(a), Math.cos(a)), 18, 1.6, 1.0 + k * 0.9, 18); }
  } },
  bellows: { name: 'FURNACE GUST', color: 0xffa060, run(b) { // a wide cone of embers that also shoves you back
    const h = aim(b); if (!h) return; const d = dirTo(b.position, h.position), a0 = Math.atan2(d.x, d.z);
    b.world.effects.spawnLine(b.position, d, 10, 6, 0.9);
    later(b, 0.9, () => {
      shots(b, b.position, Array.from({ length: 11 }, (_, i) => a0 + (i - 5) * 0.09), 11, 10, 0xffa060);
      for (const x of heroes(b.world)) { const dd = x.position.distanceTo(b.position); if (dd < 11) { x.position.addScaledVector(dirTo(b.position, x.position), 3 * (1 - dd / 11)); b.world.arena.resolve(x.position, x.radius); } }
    });
  } },
  gravel: { name: 'AVALANCHE', color: 0xb0a48a, run(b) { // big boulders crash down near every hero, plus random ones
    for (const h of heroes(b.world)) for (let i = 0; i < 3; i++) circle(b, V(h.position.x + (Math.random() - 0.5) * 6, h.position.z + (Math.random() - 0.5) * 6), 2.2, 1.1 + i * 0.4, 22);
    for (let i = 0; i < 3; i++) circle(b, V((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22), 2.2, 1.3 + i * 0.3, 22);
  } },
  tithe: { name: 'COLLECTION PLATE', color: 0x6aff7a, run(b) { // a plate under each hero: get caught and it heals the Warden
    for (const h of heroes(b.world)) {
      const p = h.position.clone(); b.world.effects.spawnWarning(p, 2.2, 1.3);
      later(b, 1.3, () => { for (const x of heroes(b.world)) if (x.position.distanceTo(p) < 2.2 + x.radius) { x.takeDamage(16 * b.dmgMult, b); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.02); b.world.effects.spawnSparks(b.position.clone().setY(2), 0x6aff7a, 8); } b.world.effects.spawnRing(p, 0x6aff7a, 2.4, 0.35); });
    }
  } },
  nail: { name: 'CRUCIFIX GRID', color: 0xd8d8e8, run(b) { // nails hammered across the arena in a grid, rows then columns
    const h = aim(b); if (!h) return; const cx = h.position.x, cz = h.position.z;
    for (let i = -1; i <= 1; i++) line(b, V(-16, cz + i * 4), V(1, 0), 32, 1.3, 1.0, 16);
    for (let i = -1; i <= 1; i++) line(b, V(cx + i * 4 + 2, -16), V(0, 1), 32, 1.3, 1.8, 16);
  } },
};

// called every frame for each living boss (host / solo, CoreBurnZ only)
export function tickBossPhase(b, dt) {
  if (b.dead || !b.canBeHit && b.state === 'intro') return;
  const id = b.def.id, atk = PHASE_ATTACKS[id];
  if (!atk) return;
  const ph = b.ph || (b.ph = { phase: 1, timer: 0, jobs: [], color: atk.color, enraged: false, guard: 0 });
  // queued hits
  for (let i = ph.jobs.length - 1; i >= 0; i--) { const j = ph.jobs[i]; j.t -= dt; if (j.t <= 0) { ph.jobs.splice(i, 1); if (!b.dead) j.fn(); } }
  const frac = b.hp / b.maxHp, w = b.world;
  if (ph.phase === 1 && frac <= 0.5) { // ---- PHASE TRANSITION ----
    ph.phase = 2; ph.guard = 1.5; ph.timer = 1.8; ph.oldTaken = b.damageTakenMult;
    b.damageTakenMult *= 0.2;
    w.shake(0.6); w.sfx('bossWarning');
    w.effects.spawnRing(b.position, atk.color, 7, 0.9); w.effects.spawnRing(b.position, 0xffffff, 4, 0.5);
    w.effects.spawnSparks(b.position.clone().setY(2), atk.color, 20, 10);
    w.onBossPhase?.(b, 'PHASE 2', `${b.def.partName || b.def.name} · ${atk.name}`, atk.color);
  }
  if (ph.guard > 0) { ph.guard -= dt; if (ph.guard <= 0) b.damageTakenMult = ph.oldTaken ?? 1; }
  if (!ph.enraged && frac <= 0.2) { // ---- ENRAGE ----
    ph.enraged = true; b.tempoBoost = Math.min(b.tempoBoost, 0.75); b.speed *= 1.15;
    if (b.root) b.root.scale.multiplyScalar(1.08);
    w.shake(0.4); w.sfx('bossWarning');
    w.onBossPhase?.(b, 'ENRAGED', `${b.def.partName || b.def.name} is out of patience`, 0xff3a3a);
  }
  if (ph.enraged) { ph.spark = (ph.spark || 0) - dt; if (ph.spark <= 0) { ph.spark = 0.35; w.effects.spawnSparks(b.position.clone().setY(1.5 * (b.scale || 1)), 0xff3a3a, 2, 3); } }
  if (ph.phase === 2 && heroes(w).length) {
    ph.timer -= dt;
    if (ph.timer <= 0) { ph.timer = ph.enraged ? 5.5 : 8; w.sfx('bossWarning'); atk.run(b); }
  }
}

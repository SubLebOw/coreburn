// affixes.js: COREBURNZ ELITE AFFIXES (wave 50+). Normal enemies can roll special powers.
//   Chance per spawned enemy: 0 before wave 50, then 1% at wave 50, +0.2% per wave, capped at 15% (wave 120+).
//   A second affix is only possible from wave 100: chance of a double = 0.5% per wave after 100, capped at 25%.
//   (Bosses and tiny mites never roll affixes. Classic never has them.)
// Each affix has a coloured aura ring plus a floating name tag over the enemy.
// The host runs all the logic; clients only get the bitmask (for the visuals).
import * as THREE from 'three';

export const AFFIXES = [
  { id: 'shielded', name: 'SHIELDED', color: 0x4ab8ff }, // bubble soaks 40% of its max health first
  { id: 'splitting', name: 'SPLITTING', color: 0xffd23a }, // bursts into 3 mites on death
  { id: 'hasted', name: 'HASTED', color: 0x5aff8a },    // +40% speed
  { id: 'vampiric', name: 'VAMPIRIC', color: 0xff2a4a }, // heals 3x what it hits you for (and slowly regenerates)
  { id: 'volatile', name: 'VOLATILE', color: 0xff7a1a }, // explodes 0.9s after death (dodge the warning circle)
  { id: 'warded', name: 'WARDED', color: 0xb070ff },    // allies within 5m take 35% less damage (not itself)
];

export function affixChance(wave) {
  if (wave < 50) return 0;
  return Math.min(0.15, 0.01 + (wave - 50) * 0.002);
}
export function doubleChance(wave) {
  if (wave < 100) return 0;
  return Math.min(0.25, (wave - 100) * 0.005);
}

export function rollAffixes(wave, rng = Math.random) {
  if (rng() >= affixChance(wave)) return 0;
  const pick = () => 1 << Math.floor(rng() * AFFIXES.length);
  let mask = pick();
  if (rng() < doubleChance(wave)) { let m2 = pick(); while (m2 === mask) m2 = pick(); mask |= m2; }
  return mask;
}

const has = (e, id) => !!(e.affixMask & (1 << AFFIXES.findIndex((a) => a.id === id)));

// visuals (host and clients): aura ring(s) at the feet + name tag sprite above the head
function tagSprite(names, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = '#000c'; g.strokeText(names, 256, 34);
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillText(names, 256, 34);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(4, 0.5, 1); s.renderOrder = 999;
  return s;
}

// Phase 5C: every affix visual is built from SHARED geometry + opaque materials (nothing created per enemy
// except the meshes themselves), and the name tag texture is cached per affix combination.
const RING_GEO = [0, 1, 2].map((i) => new THREE.RingGeometry(0.85 + i * 0.22, 1.0 + i * 0.22, 24));
const BUBBLE_GEO = new THREE.SphereGeometry(1.25, 14, 10);
const BUBBLE_MAT = new THREE.MeshBasicMaterial({ color: 0x4ab8ff, transparent: true, opacity: 0.2, depthWrite: false }); // the only see-through affix part
const MAT = {}; const mat = (c) => (MAT[c] ??= new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
// one small accent per affix, concise and readable from the gameplay camera
const ACCENT = {
  volatile: { geo: new THREE.OctahedronGeometry(0.2), y: 1.0, z: 0.42 },          // unstable core on the chest, flickers
  vampiric: { geo: new THREE.OctahedronGeometry(0.16), y: 1.25, z: 0.42 },        // red heart core, pulses like a heartbeat
  warded: { geo: new THREE.TorusGeometry(0.34, 0.045, 4, 6), top: 0.45 },          // violet hex sigil above the head
  hasted: { geo: new THREE.ConeGeometry(0.12, 0.5, 4), y: 1.2, z: -0.5 },         // green exhaust fin on the back
  splitting: { geo: new THREE.TetrahedronGeometry(0.14), top: 0.2, orbit: 0.45 },  // yellow pod circling the head
};
const TAG_CACHE = new Map();
export function applyAffixVisuals(e, mask) {
  e.affixMask = mask;
  if (!mask) return;
  const list = AFFIXES.filter((a, i) => mask & (1 << i));
  e.affixFx = []; e.affixAcc = [];
  list.forEach((a, i) => {
    const ring = new THREE.Mesh(RING_GEO[Math.min(i, 2)], mat(a.color));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06 + i * 0.01;
    e.root.add(ring); e.affixFx.push(ring);
    const A = ACCENT[a.id];
    if (A) {
      const m = new THREE.Mesh(A.geo, mat(a.color));
      m.position.set(0, A.top !== undefined ? (e.topY || 2.2) + A.top : A.y * (e.topY || 2.3) / 2.3, A.z || 0); // chest height scales with the body
      if (a.id === 'warded') m.rotation.x = Math.PI / 2;
      if (a.id === 'hasted') m.rotation.x = -Math.PI / 2 - 0.5;
      m.userData.affix = a.id; m.userData.y0 = m.position.y; m.userData.orbit = A.orbit || 0;
      e.root.add(m); e.affixAcc.push(m);
    }
  });
  if (has(e, 'shielded')) { e.bubble = new THREE.Mesh(BUBBLE_GEO, BUBBLE_MAT); e.bubble.position.y = 1.1; e.root.add(e.bubble); }
  const text = list.map((a) => a.name).join(' · ');
  if (!TAG_CACHE.has(text)) TAG_CACHE.set(text, tagSprite(text, list[0].color));
  const proto = TAG_CACHE.get(text);
  e.affixTag = new THREE.Sprite(proto.material); e.affixTag.scale.copy(proto.scale); e.affixTag.renderOrder = 999;
  const k = 1 / (e.scale || 1); e.affixTag.scale.multiplyScalar(k); e.affixTag.position.y = (e.topY || 2.2) + 0.9 * k; e.root.add(e.affixTag);
}

// host only: stats when it spawns
export function applyAffixStats(e, mask) {
  applyAffixVisuals(e, mask);
  if (!mask) return;
  e.maxHp *= 1.25; e.hp = e.maxHp; e.points = Math.round(e.points * (1 + 0.5 * list(mask)));
  if (has(e, 'shielded')) e.shieldHp = e.maxHp * 0.4;
  if (has(e, 'hasted')) e.speed *= 1.4;
  if (has(e, 'vampiric')) e.onHurtHero = (amt) => { e.hp = Math.min(e.maxHp, e.hp + amt * 3); e.world.effects.spawnSparks(e.position.clone().setY(1.4), 0xff2a4a, 5, 3); };
}
const list = (mask) => AFFIXES.filter((a, i) => mask & (1 << i)).length;

// incoming damage on an affixed enemy (called from Enemy.hit)
export function affixDamage(e, dmg) {
  dmg *= e.wardMult || 1;
  if (e.shieldHp > 0) {
    const soak = Math.min(e.shieldHp, dmg); e.shieldHp -= soak; dmg -= soak;
    if (e.shieldHp <= 0 && e.bubble) { e.bubble.visible = false; e.world.effects.spawnRing(e.position, 0x4ab8ff, 2, 0.35); }
  }
  return dmg;
}

// once per frame, host only
export function tickAffixes(list, dt, world) {
  for (const e of list) e.wardMult = 1;
  for (const e of list) {
    if (!e.affixMask || e.dead) continue;
    if (has(e, 'vampiric')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
    if (has(e, 'warded')) for (const o of list) if (o !== e && !o.dead && !o.isBoss && o.position.distanceToSquared(e.position) < 25) o.wardMult = 0.65;
  }
}

let affT = 0;
export function tickAffixVisuals(list, dt) {
  affT += dt;
  for (const e of list) {
    if (!e.affixFx) continue;
    e.affixFx.forEach((r, i) => { r.rotation.z += dt * (i ? -1.5 : 1.5); });
    for (const m of e.affixAcc) {
      const id = m.userData.affix, ph = affT + (e.nid || 0) * 0.7;
      if (id === 'volatile') m.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(ph * 9) * Math.sin(ph * 23)));
      else if (id === 'vampiric') { const b = ph % 0.9; m.scale.setScalar(1 + 0.35 * Math.max(0, Math.sin(b * 14)) * (b < 0.45 ? 1 : 0)); }
      else if (id === 'warded') { m.rotation.z = ph * 1.2; m.position.y = m.userData.y0 + Math.sin(ph * 2) * 0.06; }
      else if (id === 'hasted') m.scale.set(1, 1 + 0.3 * Math.sin(ph * 30), 1);
      else if (id === 'splitting') { const o = m.userData.orbit; m.position.set(Math.cos(ph * 3) * o, m.userData.y0, Math.sin(ph * 3) * o); m.rotation.y = ph * 5; }
    }
  }
}

// host only: on death
export function affixDeath(e, waves) {
  if (!e.affixMask) return;
  const fx = waves.world.effects;
  if (has(e, 'splitting')) for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    waves.spawnAt('mite', e.position.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))), true, false);
  }
  if (has(e, 'volatile')) {
    const p = e.position.clone(), R = 3.2, dmg = e.damage * 1.3 + 8;
    fx.spawnWarning(p, R, 0.9);
    waves.affixJobs.push({ t: 0.9, run() {
      fx.spawnRing(p, 0xff7a1a, R, 0.45); fx.spawnSparks(p.clone().setY(1), 0xffa040, 14, 7); waves.world.shake?.(0.3);
      for (const h of (waves.world.heroes || [waves.world.player])) if (h && !h.dead && h.position.distanceTo(p) < R + (h.radius || 0.5)) h.takeDamage(dmg, e, { telegraphed: true });
    } });
  }
}

export function tickAffixJobs(waves, dt) {
  for (let i = waves.affixJobs.length - 1; i >= 0; i--) {
    const j = waves.affixJobs[i]; j.t -= dt;
    if (j.t <= 0) { waves.affixJobs.splice(i, 1); j.run(); }
  }
}

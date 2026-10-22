// unlocks.js (v1.31): hero unlock rules + a safe, one-time migration for existing profiles.
//   Sarrow, Zaleks: starters. Axiom: unchanged (free; his expert rule is not decided yet).
//   Iskra:  reach wave 15 with Sarrow or Zaleks (CoreBurnZ survival).
//   Orin:   reach wave 50 (the existing 'wave50' milestone; unchanged).
//   Kagero: defeat all 12 unique CoreBurnZ bosses, cumulative across runs (meta.data.stats.zBosses = boss names).
// EXISTING PROFILES are grandfathered: before v1.31 Iskra and Kagero were free for everyone, so any profile that
// has played (runs, kills, scrap, purchases, milestones, account level > 1 or a best score) keeps them.
// The migration only ever ADDS unlock flags, runs once (meta.data.unlockV) and never resets anything.
import { meta } from './meta.js?v=1.31.0';
import { Z_ROTATION } from './bosses.js?v=1.31.0';
import { HERO_STATS } from './hero-stats.js?v=1.31.0';

export const Z_BOSS_NAMES = [...new Set(Z_ROTATION.map((e) => e.def.name))];
export const zBossCount = () => Z_BOSS_NAMES.filter((n) => (meta.data.stats.zBosses || []).includes(n)).length;
const GATED = ['iskra', 'orin', 'ninja'];
export const isLocked = (id) => GATED.includes(id) && !meta.data.unlocked[id];
export function lockHint(id) {
  if (id === 'iskra') return 'Reach wave 15 with Sarrow or Zaleks';
  if (id === 'orin') return 'Reach wave 50';
  if (id === 'ninja') return `Defeat all ${Z_BOSS_NAMES.length} unique bosses (${zBossCount()}/${Z_BOSS_NAMES.length})`;
  return '';
}

export function migrateUnlocks(accountLevel = 1) {
  const d = meta.data, s = d.stats;
  if (d.unlockV >= 1) return false;
  let hadBest = false;
  try { hadBest = Object.keys(localStorage).some((k) => k.startsWith('coreburn-best') || k.startsWith('coreburn-run')); } catch { /* blocked storage */ }
  const existing = s.runs > 0 || s.kills > 0 || d.totalScrap > 0 || d.owned.length > 0 || Object.keys(d.ach).length > 0 || accountLevel > 1 || hadBest;
  if (existing) { d.unlocked.iskra = true; d.unlocked.ninja = true; } // grandfathered: they were free under the old rules
  if ((s.bestWave || 0) >= 50) d.unlocked.orin = true;                   // proven by the saved best wave
  d.unlockV = 1; d.grandfathered = existing;
  meta.save();
  return existing;
}

// returns the hero ids that just unlocked (each only once: the flag is permanent)
function unlock(id) { if (meta.data.unlocked[id]) return []; meta.data.unlocked[id] = true; meta.save(); return [id]; }
export function onWaveReached(n, heroId, z, survival) {
  const s = meta.data.stats;
  if (z && survival) { s.heroBest = s.heroBest || {}; if (n > (s.heroBest[heroId] || 0)) s.heroBest[heroId] = n; } // reusable per-hero best wave
  return z && survival && n >= 15 && (heroId === 'sarrow' || heroId === 'zaleks') ? unlock('iskra') : [];
}
export function onBossDefeated(def, z) {
  if (!z || !def || !Z_BOSS_NAMES.includes(def.name)) return [];
  const s = meta.data.stats; s.zBosses = s.zBosses || [];
  if (!s.zBosses.includes(def.name)) { s.zBosses.push(def.name); meta.save(); } // repeats (and co-op echoes) count once
  return zBossCount() >= Z_BOSS_NAMES.length ? unlock('ninja') : [];
}
export const heroName = (id) => HERO_STATS[id]?.name || id;

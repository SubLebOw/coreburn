// saves.js (v1.30.0): one saved solo run per hero, per rule set (Classic / CoreBurnZ).
// A save is a snapshot taken at the START of a wave; continuing restarts that wave.
// Upgrades are restored as card levels and re-applied through Loadout.recompute + applyLoadout.
export const SAVE_V = 1;
const key = (z, hero) => `coreburn-save-${z ? 'z' : 'c'}-${hero}`;

export function readSave(z, hero, validCard) {
  let s = null;
  const raw = localStorage.getItem(key(z, hero)); if (!raw) return null;
  try { s = JSON.parse(raw); } catch { s = null; }
  if (!s || typeof s !== 'object') { deleteSave(z, hero); return null; }
  if (!s) return null;
  const ok = s.v === SAVE_V && s.hero === hero && !!s.z === !!z && Number.isInteger(s.wave) && s.wave >= 1 && s.wave < 100000
    && s.levels && typeof s.levels === 'object' && Number.isFinite(s.score) && Number.isFinite(s.hp) && s.hp > 0;
  if (!ok || Object.keys(s.levels).some((id) => !validCard(id))) { deleteSave(z, hero); return null; } // old / corrupt: discard
  return s;
}
export function writeSave(z, hero, snap) {
  try { localStorage.setItem(key(z, hero), JSON.stringify({ ...snap, v: SAVE_V, z: !!z, hero, at: Date.now() })); return true; } catch { return false; }
}
export function deleteSave(z, hero) { try { localStorage.removeItem(key(z, hero)); } catch { /* ignore */ } }

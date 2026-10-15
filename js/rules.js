// rules.js
// Which rule set the current run uses. CLASSIC (default) = the original game, untouched.
// COREBURNZ = the remix: cancelable ultimates, owned-card weighting, stronger ult coolant, longer
// ARC TALONS chains, a gold boss upgrade after every boss, +10% boss health and 5 extra bosses.
// The host's choice is sent to friends at the start of a co-op run. No Three.js here.
export const RULES = { z: false };
export const Z_TUNING = {
  ownedWeight: 1.5,  // cards you already have are 1.5x as likely to be offered
  ultCoolStep: 0.10, // Ultimate Coolant: -10% per pick (classic -5%)
  arcRange: 1.5,     // ARC TALONS chain range x1.5 (6 m -> 9 m)
  bossHp: 1.1 * 1.05, // bosses +10% health, then +5% more in v1.14 (x1.155 total)
  shieldMax: 2,      // SHIELD pick-ups give a charge that blocks the next hit (max 2)
};
// CoreBurnZ per-hero tuning (v1.14, from the bot autoplayer + kit sim). Classic is untouched.
export const Z_HERO = {
  sarrow: { hp: 1.15, dmg: 1.15 },
  zaleks: { hp: 1.4, dmg: 1.6, speed: 1.15 },
  iskra: { hp: 1.1, dmg: 1 },
  orin: { hp: 1, dmg: 0.88 },
  ninja: { hp: 1, dmg: 1 },
};
// Classic per-hero tuning (v1.14 bot pass): weak heroes buffed up towards ORIN, nobody nerfed.
export const C_HERO = {}; // classic stays exactly as v1.13 (balance pass comes later)
const NO_TUNE = { hp: 1, dmg: 1 };
export const zHero = (id) => (RULES.z ? Z_HERO[id] : C_HERO[id]) || NO_TUNE;
export function setRules(z) { RULES.z = !!z; if (typeof document !== 'undefined') document.body.classList.toggle('zmode', RULES.z); }

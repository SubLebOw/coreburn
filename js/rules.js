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
  bossHp: 1.1,       // bosses +10% health
};
export function setRules(z) { RULES.z = !!z; if (typeof document !== 'undefined') document.body.classList.toggle('zmode', RULES.z); }

// hero-stats.js
// The three heroes' numbers (no Three.js here, so the time-to-kill simulator can use them).
// See characters.js for how they're balanced on one shared budget, and for their models.
export const HERO_STATS = {
  sarrow: {
    id: 'sarrow', name: 'SARROW', title: 'Balanced all-rounder', color: 0x3ff6e0, blade: 0x7ffff2,
    blurb: 'Fast combos, a clean blink and a whirlwind Overdrive.',
    hp: 100, speed: 7, dmg: 1, atkSpeed: 1,
    dashSpeed: 24, dashTime: 0.2, dashCd: 0.9, dashCharges: 1, dashDmg: 10, dashKnock: 7, dashWidth: 1.3,
    spinRadius: 1, spinDmg: 1, spinKnock: 7, spinTick: 0.15,
  },
  zaleks: {
    id: 'zaleks', name: 'ZALEKS', title: 'Plated bruiser', color: 0xffa030, blade: 0xffc060,
    blurb: 'Tanky and heavy-hitting but slower. Blink is a shoulder-charge; Overdrive is a ground-slam spin.',
    hp: 120, speed: 6.1, dmg: 1.16, atkSpeed: 0.9,
    dashSpeed: 21, dashTime: 0.17, dashCd: 1.05, dashCharges: 1, dashDmg: 17, dashKnock: 16, dashWidth: 1.6,
    spinRadius: 1.3, spinDmg: 0.95, spinKnock: 11, spinTick: 0.2,
  },
  iskra: {
    id: 'iskra', name: 'ISKRA', title: 'Swift skirmisher', color: 0xc070ff, blade: 0xe8a0ff,
    blurb: 'Fragile but lightning quick: rapid needle-talons and a long blink with 2 charges.',
    hp: 78, speed: 7.9, dmg: 0.84, atkSpeed: 1.26,
    dashSpeed: 26, dashTime: 0.24, dashCd: 0.95, dashCharges: 2, dashDmg: 8, dashKnock: 6, dashWidth: 1.2,
    spinRadius: 0.9, spinDmg: 1.05, spinKnock: 6, spinTick: 0.12,
  },
};
export const CHARACTER_ORDER = ['sarrow', 'zaleks', 'iskra'];

// The balance numbers (also used by the simulator)
export function characterBudget(c) {
  const S = HERO_STATS.sarrow;
  const dps = c.dmg * c.atkSpeed;
  // blink: distance per cooldown, extra charges help but with diminishing value (x1.15 per extra)
  const blink = ((c.dashSpeed * c.dashTime) / c.dashCd) / ((S.dashSpeed * S.dashTime) / S.dashCd) * (1 + 0.15 * (c.dashCharges - 1));
  const mobility = 0.7 * (c.speed / S.speed) + 0.3 * blink;
  return { dps, hp: c.hp, mobility, budget: dps * c.hp * mobility };
}


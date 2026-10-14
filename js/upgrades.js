// upgrades.js
// After every boss you CHOOSE one of 3 upgrade cards. Every pick does two things:
//
//  1. WEAPON TIER +1 (the even scaling). Sarrow's base damage multiplier is
//         weaponMult(tier) = 1 + 0.70 * tier
//     Why 0.70? Enemy health grows by 0.14 per wave (waves.js: hpMult = 1 + 0.14(n-1)) and a boss
//     comes every 5 waves, so 5 x 0.14 = 0.70. After the boss at wave 5t you have tier t, and the
//     next wave (5t+1) has hpMult = 1 + 0.70t: exactly the same as your weaponMult. So hits-to-kill
//     at the start of every 5-wave stretch is the SAME as at wave 1, whatever cards you picked.
//     (Within a stretch enemies get up to 4 x 0.14 tougher before the next boss, then you catch up.)
//
//  2. The card itself: a small, capped perk on top. Perks are the "extra edge". Caps keep any one
//     build from running away: all damage perks together top out at about 2x single-target damage,
//     while enemy damage keeps growing every wave (+7%), so late waves stay dangerous.
//
// Once a card is maxed it stops appearing; if fewer than 3 cards are left, REACTOR PATCH fills in.
// This file has no Three.js in it, so tools (like the time-to-kill simulator) can import it too.

export const WEAPON_TIER_STEP = 0.70; // = 0.14 enemy health per wave x 5 waves per boss

export function weaponMult(tier) { return 1 + WEAPON_TIER_STEP * tier; }

// Talon colour by tier: teal -> cyan -> white-gold -> violet -> crimson (every 3 tiers, blended)
const TIER_COLOURS = [0x7ffff2, 0x3fc8ff, 0xffe6a0, 0xb070ff, 0xff3048];
export function tierColor(tier) {
  const k = Math.min(TIER_COLOURS.length - 1, tier / 3);
  const i = Math.floor(k), f = k - i;
  const a = TIER_COLOURS[i], b = TIER_COLOURS[Math.min(TIER_COLOURS.length - 1, i + 1)];
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// group: talons / overdrive / blink / core. desc(level) = what the NEXT level gives.
export const UPGRADES = {
  // ---- talons ----
  edge:     { name: 'Talon Edge', group: 'talons', icon: '✦', color: 0xff8a3a, max: 5, desc: () => '+7% talon damage' },
  arc:      { name: 'Wide Arc', group: 'talons', icon: '◠', color: 0x7ffff2, max: 3, desc: () => '+12% slash reach, wider swing' },
  shock:    { name: 'Shockwave Finisher', group: 'talons', icon: '◎', color: 0xffd040, max: 3, desc: (l) => l === 0 ? 'Combo finisher sends out a shockwave' : 'Bigger, stronger finisher shockwave' },
  crit:     { name: 'Crit Spark', group: 'talons', icon: '✸', color: 0xfff27a, max: 4, desc: () => '+7% chance for 1.8x critical hits' },
  twin:     { name: 'Twin Strike', group: 'talons', icon: '⫽', color: 0x9ab8ff, max: 3, desc: () => '+8% chance to hit twice' },
  storm:    { name: 'Storm Talons', group: 'talons', icon: 'ϟ', color: 0x8ab4ff, max: 3, desc: () => '+15% chance hits chain lightning to 2 foes' },
  leech:    { name: 'Core Leech', group: 'talons', icon: '♥', color: 0x6aff7a, max: 3, desc: () => 'Heal +0.5 per talon hit (max 6/s)' },
  // ---- overdrive (spin) ----
  odTime:   { name: 'Long Overdrive', group: 'overdrive', icon: '⟲', color: 0xff8a3a, max: 3, desc: () => '+0.4s overdrive duration' },
  odRadius: { name: 'Overdrive Reach', group: 'overdrive', icon: '⭘', color: 0xffb060, max: 3, desc: () => '+12% overdrive radius' },
  odDamage: { name: 'Overdrive Fury', group: 'overdrive', icon: '✺', color: 0xff5a2a, max: 3, desc: () => '+25% overdrive damage' },
  odLeech:  { name: 'Overdrive Siphon', group: 'overdrive', icon: '❥', color: 0xff6aa0, max: 3, desc: () => 'Heal +1 per overdrive hit (max 10/s)' },
  odCool:   { name: 'Overdrive Coolant', group: 'overdrive', icon: '❄', color: 0x9ae4ff, max: 3, desc: () => '-10% overdrive cooldown' },
  // ---- blink (dash) ----
  bkDamage: { name: 'Blink Edge', group: 'blink', icon: '➹', color: 0x3ff6e0, max: 3, desc: () => '+50% blink damage' },
  bkRange:  { name: 'Long Blink', group: 'blink', icon: '⇢', color: 0x6ad8ff, max: 3, desc: () => '+15% blink distance' },
  bkCharge: { name: 'Double Blink', group: 'blink', icon: '⇉', color: 0xc8a0ff, max: 1, desc: () => '+1 blink charge (blink twice in a row)' },
  bkCool:   { name: 'Quick Blink', group: 'blink', icon: '⟳', color: 0x7affc8, max: 3, desc: () => '-12% blink cooldown' },
  bkTrail:  { name: 'Blink Trail', group: 'blink', icon: '≋', color: 0x3fd0ff, max: 3, desc: (l) => l === 0 ? 'Blink leaves a burning trail' : 'Trail burns hotter' },
  // ---- core (Sarrow himself) ----
  speed:    { name: 'Swift Step', group: 'core', icon: '»', color: 0xd0ff6a, max: 3, desc: () => '+6% move speed' },
  maxHp:    { name: 'Reinforced Core', group: 'core', icon: '⬢', color: 0x6aff9a, max: 4, desc: () => '+15 max health' },
  regen:    { name: 'Core Recharge', group: 'core', icon: '✚', color: 0x3ff6a0, max: 3, desc: () => '+35% health regen' },
};
export const FALLBACK = { id: 'patch', name: 'Reactor Patch', group: 'core', icon: '⛨', color: 0xc8c8c8, max: Infinity, desc: () => '+5 max health and heal 35%' };
export const GROUP_LABELS = { talons: 'TALONS', overdrive: 'OVERDRIVE', blink: 'BLINK', core: 'CORE' };

export class Loadout {
  constructor() { this.reset(); }

  reset() {
    this.tier = 0;
    this.levels = {};
    this.patches = 0;
    this.version = 0; // bumps on every change (the HUD redraws when it changes)
    this.recompute();
  }

  level(id) { return id === 'patch' ? this.patches : (this.levels[id] || 0); }
  def(id) { return id === 'patch' ? FALLBACK : UPGRADES[id]; }

  // 3 different random cards that aren't maxed yet (Reactor Patch fills any gaps)
  roll(count = 3, rng = Math.random) {
    const open = Object.keys(UPGRADES).filter((id) => this.level(id) < UPGRADES[id].max);
    const hand = [];
    while (hand.length < count && open.length) hand.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
    if (hand.length < count) hand.push('patch');
    return hand;
  }

  apply(id) {
    this.tier++;
    if (id === 'patch') this.patches++;
    else this.levels[id] = Math.min(UPGRADES[id].max, this.level(id) + 1);
    this.version++;
    this.recompute();
  }

  // Everything the player needs, as plain multipliers/numbers
  recompute() {
    const L = (id) => this.level(id);
    this.stats = {
      weapon: weaponMult(this.tier),
      dmg: weaponMult(this.tier) * (1 + 0.07 * L('edge')),
      range: 1 + 0.12 * L('arc'),
      arcLevel: L('arc'),
      shock: L('shock'),                          // radius 2.8 + 0.5L, 30% + 15%L of the finisher
      crit: 0.07 * L('crit'),
      twin: 0.08 * L('twin'),
      storm: 0.15 * L('storm'),
      leech: 0.5 * L('leech'),
      spinTime: 0.4 * L('odTime'),
      spinRadius: 1 + 0.12 * L('odRadius'),
      spinDmg: 1 + 0.25 * L('odDamage'),
      spinLeech: 1 * L('odLeech'),
      spinCd: 1 - 0.10 * L('odCool'),
      dashDmg: 1 + 0.5 * L('bkDamage'),
      dashTime: 1 + 0.15 * L('bkRange'),
      dashCharges: 1 + L('bkCharge'),
      dashCd: 1 - 0.12 * L('bkCool'),
      trail: L('bkTrail'),
      speed: 1 + 0.06 * L('speed'),
      maxHpBonus: 15 * L('maxHp') + 5 * this.patches,
      regen: 1 + 0.35 * L('regen'),
    };
  }

  // Expected single-target damage multiplier from perks alone (for balancing / the simulator)
  get perkDamageMult() {
    const s = this.stats;
    return (s.dmg / s.weapon) * (1 + 0.8 * s.crit) * (1 + s.twin);
  }

  // e.g. [{ id, name, icon, color, level }]
  get picked() {
    const list = Object.keys(UPGRADES).filter((id) => this.level(id) > 0).map((id) => ({ id, ...UPGRADES[id], level: this.level(id) }));
    if (this.patches) list.push({ ...FALLBACK, level: this.patches });
    return list;
  }
}

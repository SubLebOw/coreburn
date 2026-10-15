// upgrades.js
// After every 2nd wave (2, 4, 6, ...) you CHOOSE one of 3 upgrade cards. Same rate in solo and co-op.
// Every pick does two things:
//
//  1. WEAPON TIER +1 (the even scaling). The hero's base damage multiplier is
//         weaponMult(tier) = 1 + 0.28 * tier
//     Why 0.28? Enemy health grows by 0.14 per wave (waves.js: hpMult = 1 + 0.14(n-1)) and you
//     pick every 2 waves, so 2 x 0.14 = 0.28. After wave 2t you have tier t, and the next wave
//     (2t+1) has hpMult = 1 + 0.28t: exactly your weaponMult. So hits-to-kill at the start of every
//     2-wave stretch is the SAME as at wave 1, whatever cards you picked or hero you play.
//
//  2. The card itself: a small, capped perk on top (the "extra edge"). Perk steps are small and
//     caps are high, so the perks grow slowly over ~50 picks by wave 100. All damage perks together
//     top out at about 2x single-target damage, while enemy damage keeps growing every wave (+7%),
//     so late waves stay dangerous.
//
// Once a card is maxed it stops appearing; if fewer than 3 cards are left, REACTOR PATCH fills in.
// Universal cards work for every hero; hero cards only show up for that hero (Loadout.hero).
// This file has no Three.js in it, so tools (like the time-to-kill simulator) can import it too.

import { RULES, Z_TUNING } from './rules.js';

export const WEAPON_TIER_STEP = 0.28; // = 0.14 enemy health per wave x 2 waves per pick
export const PICK_EVERY = 2;          // waves between upgrade picks
export const isPickWave = (n) => n > 0 && n % PICK_EVERY === 0;

export function weaponMult(tier) { return 1 + WEAPON_TIER_STEP * tier; }

// Talon colour by tier: teal -> cyan -> white-gold -> violet -> crimson (every 6 tiers, blended)
const TIER_COLOURS = [0x7ffff2, 0x3fc8ff, 0xffe6a0, 0xb070ff, 0xff3048];
export function tierColor(tier, base = TIER_COLOURS[0]) {
  const k = Math.min(TIER_COLOURS.length - 1, tier / 6);
  const i = Math.floor(k), f = k - i;
  const col = (j) => (j === 0 ? base : TIER_COLOURS[j]);
  const a = col(i), b = col(Math.min(TIER_COLOURS.length - 1, i + 1));
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// group: attack / mobility / ultimate / core. desc(level) = what the NEXT level gives.
// heroes: only offered to those heroes (no `heroes` = a universal card every hero can roll).
const S = ['sarrow'], Z = ['zaleks'], I = ['iskra'], O = ['orin'], N = ['ninja'];
export const UPGRADES = {
  // ---- universal (every hero) ----
  edge:     { name: 'Core Edge', group: 'attack', icon: '✦', color: 0xff8a3a, max: 10, desc: () => '+3.5% damage (everything)' },
  crit:     { name: 'Crit Spark', group: 'attack', icon: '✸', color: 0xfff27a, max: 8, desc: () => '+3.5% chance for 1.8x critical hits' },
  twin:     { name: 'Twin Strike', group: 'attack', icon: '⫽', color: 0x9ab8ff, max: 6, desc: () => '+4% chance an attack hits twice' },
  storm:    { name: 'Storm Core', group: 'attack', icon: 'ϟ', color: 0x8ab4ff, max: 6, desc: () => '+7.5% chance attacks chain lightning to 2 foes' },
  leech:    { name: 'Core Leech', group: 'attack', icon: '♥', color: 0x6aff7a, max: 6, desc: () => 'Heal +0.25 per attack hit (max 6/s)' },
  odDamage: { name: 'Ultimate Fury', group: 'ultimate', icon: '✺', color: 0xff5a2a, max: 6, desc: () => '+12.5% ultimate damage' },
  odCool:   { name: 'Ultimate Coolant', group: 'ultimate', icon: '❄', color: 0x9ae4ff, max: 6, desc: () => `-${RULES.z ? 10 : 5}% ultimate cooldown` },
  bkCool:   { name: 'Quick Recovery', group: 'mobility', icon: '⟳', color: 0x7affc8, max: 6, desc: () => '-6% mobility cooldown' },
  speed:    { name: 'Swift Step', group: 'core', icon: '»', color: 0xd0ff6a, max: 6, desc: () => '+3% move speed' },
  maxHp:    { name: 'Reinforced Core', group: 'core', icon: '⬢', color: 0x6aff9a, max: 8, desc: () => '+7.5% max health' },
  regen:    { name: 'Core Recharge', group: 'core', icon: '✚', color: 0x3ff6a0, max: 6, desc: () => '+17.5% health regen' },
  // ---- SARROW ----
  arc:      { name: 'Wide Arc', heroes: S, group: 'attack', icon: '◠', color: 0x7ffff2, max: 6, desc: () => '+6% slash reach and +5% slash damage, wider swing' },
  shock:    { name: 'Shockwave Finisher', heroes: S, group: 'attack', icon: '◎', color: 0xffd040, max: 5, desc: (l) => l === 0 ? 'Combo finisher sends out a shockwave' : 'Bigger, stronger finisher shockwave' },
  bkDamage: { name: 'Blink Edge', heroes: S, group: 'mobility', icon: '➹', color: 0x3ff6e0, max: 6, desc: () => '+25% blink damage' },
  bkRange:  { name: 'Long Blink', heroes: S, group: 'mobility', icon: '⇢', color: 0x6ad8ff, max: 6, desc: () => '+7.5% blink distance' },
  bkCharge: { name: 'Extra Blink', heroes: S, group: 'mobility', icon: '⇉', color: 0xc8a0ff, max: 1, desc: () => '+1 blink charge' },
  bkTrail:  { name: 'Blink Trail', heroes: S, group: 'mobility', icon: '≋', color: 0x3fd0ff, max: 5, desc: (l) => l === 0 ? 'Blink leaves a burning trail' : 'Trail burns hotter' },
  odTime:   { name: 'Long Overdrive', heroes: S, group: 'ultimate', icon: '⟲', color: 0xff8a3a, max: 6, desc: () => '+0.2s overdrive duration' },
  odRadius: { name: 'Overdrive Reach', heroes: S, group: 'ultimate', icon: '⭘', color: 0xffb060, max: 6, desc: () => '+6% overdrive radius' },
  odLeech:  { name: 'Overdrive Siphon', heroes: S, group: 'ultimate', icon: '❥', color: 0xff6aa0, max: 6, desc: () => 'Heal +0.5 per overdrive hit (max 10/s)' },
  // ---- ZALEKS ----
  zGuard:   { name: 'Tower Guard', heroes: Z, group: 'attack', icon: '⛊', color: 0xffc060, max: 2, desc: () => 'Frontal block +6% while attacking' },
  zHammer:  { name: 'Heavy Hammer', heroes: Z, group: 'attack', icon: '⚒', color: 0xff9a40, max: 6, desc: () => '+9% bash damage, +6% reach, +10% knockback' },
  zStun:    { name: 'Concussive Charge', heroes: Z, group: 'mobility', icon: '✱', color: 0xffe080, max: 3, desc: () => 'Charge stun +0.5s' },
  zCharge:  { name: 'Long Charge', heroes: Z, group: 'mobility', icon: '⇛', color: 0xffb860, max: 5, desc: () => '+12% charge distance, +20% charge damage' },
  zQuake:   { name: 'Aftershock', heroes: Z, group: 'ultimate', icon: '◎', color: 0xffa030, max: 5, desc: () => '+8% slam radius, +10% slam damage' },
  zShield:  { name: 'Bulwark Shield', heroes: Z, group: 'ultimate', icon: '⬡', color: 0xffd090, max: 5, desc: () => 'Slam shield +10% stronger' },
  zTaunt:   { name: 'War Cry', heroes: Z, group: 'ultimate', icon: '!', color: 0xff7040, max: 3, desc: () => 'Taunt lasts +1s' },
  // ---- ISKRA ----
  iPierce:  { name: 'Piercing Needles', heroes: I, group: 'attack', icon: '➶', color: 0xe8a0ff, max: 1, desc: () => 'Needles pierce +1 enemy' },
  iSplit:   { name: 'Split Needles', heroes: I, group: 'attack', icon: '⋔', color: 0xd090ff, max: 1, desc: () => '+1 side needle each side per shot (20% damage)' },
  iHop:     { name: 'Extra Hop', heroes: I, group: 'mobility', icon: '⇉', color: 0xc070ff, max: 1, desc: () => 'Phase Hop +1 charge' },
  iHopRange:{ name: 'Long Hop', heroes: I, group: 'mobility', icon: '⇢', color: 0xb0a0ff, max: 4, desc: () => '+12% hop distance' },
  iDecoy:   { name: 'Stubborn Decoy', heroes: I, group: 'mobility', icon: '◈', color: 0xa070ff, max: 4, desc: () => 'Decoy lasts +1s and takes +2 hits' },
  iStorm:   { name: 'Long Storm', heroes: I, group: 'ultimate', icon: '⁂', color: 0xff80ff, max: 5, desc: () => 'Needle Storm +0.5s' },
  iVolley:  { name: 'Dense Storm', heroes: I, group: 'ultimate', icon: '⁘', color: 0xe060ff, max: 2, desc: () => '+1 needle per storm volley' },
  // ---- ORIN ----
  oChain:   { name: 'Choir Chain', heroes: O, group: 'attack', icon: 'ϟ', color: 0xff9a8a, max: 3, desc: () => 'Tether chains to +1 enemy' },
  oReach:   { name: 'Long Tether', heroes: O, group: 'attack', icon: '⟿', color: 0xff8070, max: 4, desc: () => '+10% tether range' },
  oGrapple: { name: 'Magnet Shock', heroes: O, group: 'mobility', icon: '⊸', color: 0xff6a5a, max: 4, desc: () => 'Grapple stun +0.3s, +25% grapple damage' },
  oDrone:   { name: 'Extra Drone', heroes: O, group: 'ultimate', icon: '❂', color: 0xff4a5a, max: 1, desc: () => 'Drone count +1' },
  oDroneDmg:{ name: 'Drone Armament', heroes: O, group: 'ultimate', icon: '✜', color: 0xff7a6a, max: 5, desc: () => '+10% drone damage' },
  oDroneTime:{ name: 'Drone Lifespan', heroes: O, group: 'ultimate', icon: '⧗', color: 0xffaa9a, max: 3, desc: () => 'Drones last +1s' },
  oShell:   { name: 'Hymn Shell', heroes: O, group: 'ultimate', icon: '⬣', color: 0xff8a9a, max: 4, desc: () => 'Take -6% damage while your drones fly' },
  // ---- KAGERO (CoreBurnZ) ----
  nPierce:  { name: 'Razor Stars', heroes: N, group: 'attack', icon: '✴', color: 0xc8c0ff, max: 2, desc: () => 'Shurikens pierce +1 enemy' },
  nFan:     { name: 'Star Fan', heroes: N, group: 'attack', icon: '⋔', color: 0xa898ff, max: 2, desc: () => '+1 side shuriken each side per throw (30% damage)' },
  nEdge:    { name: 'Shadow Edge', heroes: N, group: 'mobility', icon: '◐', color: 0x8a7aff, max: 5, desc: () => '+25% Shadow Step damage, +8% step reach' },
  nTwin:    { name: 'Twin Shadows', heroes: N, group: 'mobility', icon: '⇉', color: 0x9a8aff, max: 1, desc: () => 'Shadow Step +1 charge' },
  nShade:   { name: 'Lingering Shade', heroes: N, group: 'ultimate', icon: '♊', color: 0x6a5aff, max: 4, desc: () => 'Shadow Clone lasts +1s' },
  nMirror:  { name: 'Perfect Mirror', heroes: N, group: 'ultimate', icon: '⧉', color: 0xb0a0ff, max: 4, desc: () => 'Clone copies with +10% of your damage' },
  oVortex:  { name: 'Deep Vortex', heroes: O, group: 'ultimate', icon: '◉', color: 0xff5070, max: 5, desc: () => '+10% vortex radius and pull' },
};
// COREBURNZ BOSS CARDS: one gold pick after every boss kill (never in the normal pool). Rarer and
// stronger; they don't raise the weapon tier (the normal picks keep the even scaling).
export const BOSS_CARDS = {
  bHeart:  { name: 'Titan Heart', icon: '❤', max: 2, desc: () => '+20% max health and a full heal' },
  bCrown:  { name: 'Cinder Crown', icon: '♛', max: 2, desc: () => '+12% damage (everything)' },
  bFang:   { name: 'Bossfang', icon: '⚔', max: 2, desc: () => '+25% damage to bosses' },
  bEcho:   { name: 'Echo Engine', icon: '✺', max: 2, desc: () => '-12% ultimate cooldown, +15% ultimate damage' },
  bAegis:  { name: 'Grind Aegis', icon: '⛉', max: 2, desc: () => 'Take 10% less damage' },
  bTempest:{ name: 'Tempest Heart', icon: 'ϟ', max: 2, desc: () => '+12% chance attacks chain lightning' },
  bSoles:  { name: 'Choirless Soles', icon: '»', max: 2, desc: () => '+6% move speed, -15% mobility cooldown' },
  bTithe:  { name: "Deacon's Tithe", icon: '♥', max: 2, desc: () => 'Heal +0.5 per attack hit, +40% core recharge' },
};
for (const c of Object.values(BOSS_CARDS)) Object.assign(c, { group: 'boss', boss: true, color: 0xffc23a });

export const FALLBACK = { id: 'patch', name: 'Reactor Patch', group: 'core', icon: '⛨', color: 0xc8c8c8, max: Infinity, desc: () => '+3 max health and heal 35%' };
export const GROUP_LABELS = { attack: 'ATTACK', mobility: 'MOBILITY', ultimate: 'ULTIMATE', core: 'CORE', cursed: 'CURSED', boss: 'BOSS RELIC' };
export const cardForHero = (id, hero) => { const u = UPGRADES[id]; return !!u && (!u.heroes || !hero || u.heroes.includes(hero)); };
// The card's group label, using the hero's own ability names (e.g. "PHASE HOP" for Iskra)
export function groupLabel(group, kit) {
  const a = kit && kit[group];
  return a ? a.name.toUpperCase() : GROUP_LABELS[group];
}

// CURSED CARDS: from wave 10, about 1 pick in 3 swaps one card for a cursed one. A big boon WITH a
// real drawback. Each curse can only be taken once. They still give the weapon tier like any card.
export const CURSES = {
  bloodPact: { name: 'Blood Pact', group: 'cursed', icon: '☠', color: 0xd02a5a, max: 1, boon: '+25% damage', bane: '-20% max health' },
  overclock: { name: 'Overclocked Core', group: 'cursed', icon: '⚡', color: 0xa040ff, max: 1, boon: '-30% mobility & ultimate cooldowns', bane: 'Core recharge (regen) stops' },
  greed:     { name: 'Greed Engine', group: 'cursed', icon: '¤', color: 0xe0b020, max: 1, boon: '+50% score and scrap', bane: 'Enemies deal +15% damage to you' },
  heavy:     { name: 'Leaden Core', group: 'cursed', icon: '⚒', color: 0x8a4a2a, max: 1, boon: '+35% damage', bane: '-12% move speed' },
  glass:     { name: 'Glass Heart', group: 'cursed', icon: '◇', color: 0x6ad0ff, max: 1, boon: '+20% crit chance', bane: 'Take +20% damage' },
};
for (const c of Object.values(CURSES)) c.desc = () => c.boon;
export const CURSE_FROM_WAVE = 10;
export const CURSE_CHANCE = 0.35;

export class Loadout {
  constructor(hero = null) { this.hero = hero; this.reset(); }

  reset() {
    this.tier = 0;
    this.levels = {};
    this.patches = 0;
    this.version = 0; // bumps on every change (the HUD redraws when it changes)
    this.recompute();
  }

  level(id) { return id === 'patch' ? this.patches : (this.levels[id] || 0); }
  def(id) { return id === 'patch' ? FALLBACK : (UPGRADES[id] || CURSES[id] || BOSS_CARDS[id]); }
  static isCurse(id) { return !!CURSES[id]; }

  // 3 different random cards that aren't maxed yet (Reactor Patch fills any gaps)
  roll(count = 3, rng = Math.random) {
    const open = Object.keys(UPGRADES).filter((id) => cardForHero(id, this.hero) && this.level(id) < UPGRADES[id].max);
    const hand = [];
    // CoreBurnZ: cards you already own are a bit more likely (weighted draw); classic = plain random
    const w = (id) => (RULES.z && this.level(id) > 0 ? Z_TUNING.ownedWeight : 1);
    while (hand.length < count && open.length) {
      if (!RULES.z) { hand.push(open.splice(Math.floor(rng() * open.length), 1)[0]); continue; } // classic, unchanged
      let r = rng() * open.reduce((t, id) => t + w(id), 0), i = 0;
      while (i < open.length - 1 && (r -= w(open[i])) >= 0) i++;
      hand.push(open.splice(i, 1)[0]);
    }
    if (hand.length < count) hand.push('patch');
    return hand;
  }

  // CoreBurnZ: the gold boss pick (3 different boss relics you haven't maxed)
  rollBoss(count = 3, rng = Math.random) {
    const open = Object.keys(BOSS_CARDS).filter((id) => this.level(id) < BOSS_CARDS[id].max);
    const hand = [];
    while (hand.length < count && open.length) hand.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
    if (!hand.length) hand.push('patch');
    return hand;
  }

  // Maybe swap the last card for a cursed one (wave >= 10, ~35% of picks, curses you don't have yet)
  maybeCurse(hand, wave, rng = Math.random) {
    if (wave < CURSE_FROM_WAVE || rng() >= CURSE_CHANCE) return hand;
    const open = Object.keys(CURSES).filter((id) => !this.level(id));
    if (!open.length) return hand;
    hand[hand.length - 1] = open[Math.floor(rng() * open.length)];
    return hand;
  }

  apply(id) {
    if (!BOSS_CARDS[id]) this.tier++; // boss relics don't raise the weapon tier
    if (id === 'patch') this.patches++;
    else this.levels[id] = Math.min(this.def(id).max, this.level(id) + 1);
    this.version++;
    this.recompute();
  }

  // Everything the player needs, as plain multipliers/numbers
  recompute() {
    const L = (id) => this.level(id);
    this.stats = {
      weapon: weaponMult(this.tier),
      dmg: weaponMult(this.tier) * (1 + 0.035 * L('edge')),
      range: 1 + 0.06 * L('arc'),
      arcLevel: L('arc'), arcDmg: 1 + 0.05 * L('arc'),
      shock: L('shock'),                          // radius 2.8 + 0.3L, 30% + 9%L of the finisher
      crit: 0.035 * L('crit'),
      twin: 0.04 * L('twin'),
      storm: 0.075 * L('storm'),
      leech: 0.25 * L('leech'),
      spinTime: 0.2 * L('odTime'),
      spinRadius: 1 + 0.06 * L('odRadius'),
      spinDmg: 1 + 0.125 * L('odDamage'),
      spinLeech: 0.5 * L('odLeech'),
      spinCd: 1 - (RULES.z ? Z_TUNING.ultCoolStep : 0.05) * L('odCool'),
      dashDmg: 1 + 0.25 * L('bkDamage'),
      dashTime: 1 + 0.075 * L('bkRange'),
      dashCharges: 1 + L('bkCharge') + L('iHop') + L('nTwin'),
      dashCd: 1 - 0.06 * L('bkCool'),
      trail: L('bkTrail') * 0.6,                  // trail tick = (4 + 3 x this) x damage
      speed: 1 + 0.03 * L('speed'),
      maxHpPct: 0.075 * L('maxHp'),
      maxHpFlat: 3 * this.patches,
      regen: (1 + 0.175 * L('regen')) * (L('overclock') ? 0 : 1),
      scoreMult: L('greed') ? 1.5 : 1,
      // Zaleks
      block: 0.06 * L('zGuard'),
      bash: 1 + 0.06 * L('zHammer'), bashDmg: 1 + 0.09 * L('zHammer'), slamDmg: 1 + 0.1 * L('zQuake'), bashKnock: 1 + 0.1 * L('zHammer'),
      chargeStun: 0.5 * L('zStun'), chargeDist: 1 + 0.12 * L('zCharge'), chargeDmg: 1 + 0.2 * L('zCharge'),
      slamRadius: 1 + 0.08 * L('zQuake'), shield: 1 + 0.1 * L('zShield'), taunt: L('zTaunt'),
      // Iskra
      pierce: L('iPierce'), split: L('iSplit'), hopCharges: L('iHop'), hopDist: 1 + 0.12 * L('iHopRange'),
      decoy: L('iDecoy'), stormTime: 0.5 * L('iStorm'), stormCount: L('iVolley'),
      // Orin
      chains: L('oChain'), reach: 1 + 0.1 * L('oReach'), grapple: L('oGrapple'), drones: L('oDrone'),
      droneDmg: 1 + 0.1 * L('oDroneDmg'), droneTime: 1 * L('oDroneTime'), vortex: 1 + 0.1 * L('oVortex'), shell: 0.06 * L('oShell'),
      // Kagero
      starPierce: L('nPierce'), starFan: L('nFan'), stepDmg: 1 + 0.25 * L('nEdge'), stepRange: 1 + 0.08 * L('nEdge'),
      cloneTime: L('nShade'), cloneDmg: 0.1 * L('nMirror'),
      hurtMult: (L('greed') ? 1.15 : 1) * (L('glass') ? 1.2 : 1),
    };
    // cursed cards
    const s = this.stats;
    if (L('bloodPact')) { s.dmg *= 1.25; s.maxHpPct -= 0.2; }
    if (L('heavy')) { s.dmg *= 1.35; s.speed *= 0.88; }
    if (L('glass')) s.crit += 0.2;
    if (L('overclock')) { s.dashCd *= 0.7; s.spinCd *= 0.7; }
    // CoreBurnZ boss relics
    s.bossDmg = 1 + 0.25 * L('bFang');
    if (L('bHeart')) s.maxHpPct += 0.2 * L('bHeart');
    if (L('bCrown')) s.dmg *= 1 + 0.12 * L('bCrown');
    if (L('bEcho')) { s.spinCd *= 1 - 0.12 * L('bEcho'); s.spinDmg *= 1 + 0.15 * L('bEcho'); }
    if (L('bAegis')) s.hurtMult *= 1 - 0.1 * L('bAegis');
    s.storm += 0.12 * L('bTempest');
    if (L('bSoles')) { s.speed *= 1 + 0.06 * L('bSoles'); s.dashCd *= 1 - 0.15 * L('bSoles'); }
    s.leech += 0.5 * L('bTithe'); s.regen += 0.4 * L('bTithe');
  }

  // Expected single-target damage multiplier from perks alone (for balancing / the simulator)
  get perkDamageMult() {
    const s = this.stats;
    return (s.dmg / s.weapon) * (1 + 0.8 * s.crit) * (1 + s.twin);
  }

  // e.g. [{ id, name, icon, color, level }]
  get picked() {
    const list = Object.keys(UPGRADES).filter((id) => this.level(id) > 0).map((id) => ({ id, ...UPGRADES[id], level: this.level(id) }));
    for (const id of Object.keys(CURSES)) if (this.level(id)) list.push({ id, ...CURSES[id], level: 1 });
    for (const id of Object.keys(BOSS_CARDS)) if (this.level(id)) list.push({ id, ...BOSS_CARDS[id], level: this.level(id) });
    if (this.patches) list.push({ ...FALLBACK, level: this.patches });
    return list;
  }
}

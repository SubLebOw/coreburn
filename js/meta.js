// meta.js
// Everything that carries over BETWEEN runs, saved on this device (localStorage, no account):
//   * SCRAP: earned every run (kills, waves, bosses, mutator waves, golden-boss jackpots)
//   * the UNLOCK SHOP: hero skins, talon colours and small starting perks
//   * rare drops (golden bosses) and later achievements / unlocks
// Nothing here is needed to play: the shop is purely optional extras.

import { defaultStats } from './achievements.js?v=1.30.3';

const KEY = 'coreburn-save';

// ---- Shop catalogue ----
// Skins recolour the hero (any hero). Talon colours change the base colour your talons start
// from (tier colours still blend in as you upgrade). Perks are deliberately SMALL: each is about
// one upgrade card's worth, and only ONE can be equipped at a time.
export const SHOP = {
  skin: [
    { id: 'ember', name: 'Ember', color: 0xff5a2a, cost: 150 },
    { id: 'frost', name: 'Frost', color: 0x7ad8ff, cost: 150 },
    { id: 'verdigris', name: 'Verdigris', color: 0x4fd09a, cost: 200 },
    { id: 'obsidian', name: 'Obsidian', color: 0x3a3550, cost: 250 },
    { id: 'rose', name: 'Rosequartz', color: 0xff8ac8, cost: 250 },
    { id: 'gilded', name: 'Gilded', color: 0xffc23a, cost: 0, rare: 'Golden boss drop' },
    { id: 'veteran', name: 'Veteran', color: 0x8a9a6a, cost: 0, rare: 'Milestone: reach wave 25' },
    { id: 'inferno', name: 'Inferno', color: 0xff2a10, cost: 0, rare: 'Milestone: 400 combo' },
  ],
  talon: [
    { id: 'crimson', name: 'Crimson', color: 0xff3a4a, cost: 100 },
    { id: 'toxic', name: 'Toxic', color: 0x9aff3a, cost: 100 },
    { id: 'solar', name: 'Solar', color: 0xffd23a, cost: 120 },
    { id: 'void', name: 'Void', color: 0x8a5aff, cost: 150 },
    { id: 'aurum', name: 'Aurum', color: 0xfff0a0, cost: 0, rare: 'Golden boss drop' },
    { id: 'hymn', name: 'Hymnbreaker', color: 0x5affd0, cost: 0, rare: 'Milestone: beat all 7 bosses' },
    { id: 'hex', name: 'Hex', color: 0xd02a8a, cost: 0, rare: 'Milestone: 3 curses in one run' },
  ],
  // perk.card = the upgrade card you start the run with at Lv 1 (no weapon tier)
  perk: [
    { id: 'whetted', name: 'Whetted Core', desc: 'Start with Core Edge Lv 1', card: 'edge', cost: 300 },
    { id: 'plating', name: 'Spare Plating', desc: 'Start with Reinforced Core Lv 1', card: 'maxHp', cost: 300 },
    { id: 'fuse', name: 'Quick Fuse', desc: 'Start with Quick Recovery Lv 1', card: 'bkCool', cost: 300 },
    { id: 'boots', name: 'Light Boots', desc: 'Start with Swift Step Lv 1', card: 'speed', cost: 300 },
  ],
};
export const RARE_DROPS = ['gilded', 'aurum'];

function load() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { s = {}; }
  return {
    scrap: Math.max(0, Math.floor(s.scrap || 0)),
    totalScrap: s.totalScrap || 0,
    owned: Array.isArray(s.owned) ? s.owned : [],
    equip: { skin: null, talon: null, perk: null, ...(s.equip || {}) },
    stats: { ...defaultStats(), ...(s.stats || {}) },
    ach: s.ach || {},
    unlocked: s.unlocked || {},
    unlockV: s.unlockV || 0, grandfathered: !!s.grandfathered, // v1.31 hero-unlock migration (unlocks.js)
  };
}

export const meta = {
  data: load(),
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full/blocked: fine */ } },
  get scrap() { return this.data.scrap; },
  item(kind, id) { return SHOP[kind].find((x) => x.id === id) || null; },
  owns(id) { return this.data.owned.includes(id); },
  addScrap(n) {
    n = Math.max(0, Math.round(n));
    this.data.scrap += n; this.data.totalScrap += n; this.save();
    return n;
  },
  buy(kind, id) {
    const it = this.item(kind, id);
    if (!it || it.rare || this.owns(id) || this.data.scrap < it.cost) return false;
    this.data.scrap -= it.cost;
    this.data.owned.push(id);
    this.data.equip[kind] = id;
    this.save();
    return true;
  },
  grant(id) { if (!this.owns(id)) { this.data.owned.push(id); this.save(); return true; } return false; },
  equip(kind, id) {
    if (id && !this.owns(id)) return;
    this.data.equip[kind] = this.data.equip[kind] === id ? null : id; // tap again = unequip
    this.save();
  },
  get skinColor() { const it = this.item('skin', this.data.equip.skin); return it && this.owns(it.id) ? it.color : null; },
  get talonColor() { const it = this.item('talon', this.data.equip.talon); return it && this.owns(it.id) ? it.color : null; },
  get perkCard() { const it = this.item('perk', this.data.equip.perk); return it && this.owns(it.id) ? it.card : null; },
};

// Scrap for a finished run. Roughly: a wave-20 run ~ 150-200 scrap.
//   1 per 4 kills + 3 per wave reached + 15 per boss + 10 per mutator wave cleared + jackpots
export function scrapForRun(r) {
  return Math.floor((r.kills || 0) / 4) + 3 * (r.wave || 0) + 15 * (r.bosses || 0) + 10 * (r.mutators || 0) + (r.jackpot || 0);
}

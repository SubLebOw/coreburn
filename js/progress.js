// progress.js
// ACCOUNT LEVEL + COSMETICS (saved on this device). Every run in ANY mode (classic, CoreBurnZ,
// daily, rush, co-op) earns XP. Each level-up unlocks one cosmetic for a specific hero (hats, masks,
// capes, auras, talon trails, back banners), in a fixed order so everyone unlocks the same things.
// Plus ARENA SKINS: every hero has a themed look for each of the 5 arenas (auto in CoreBurnZ, or on
// everywhere / off from the Cosmetics screen). No Three.js here.

const KEY = 'coreburn-progress';
export const HERO_IDS = ['sarrow', 'zaleks', 'iskra', 'orin'];
export const SLOTS = ['hat', 'mask', 'cape', 'aura', 'trail', 'banner'];
export const SLOT_LABEL = { hat: 'HAT', mask: 'MASK', cape: 'CAPE', aura: 'AURA', trail: 'TALON TRAIL', banner: 'BANNER' };

const NAMES = {
  sarrow: { hat: "Drifter's Brim", mask: 'Ash Veil', cape: 'Ember Mantle', aura: 'Cinder Halo', trail: 'Talon Wake', banner: "Duelist's Pennant" },
  zaleks: { hat: 'Rivet Crown', mask: 'Furnace Grille', cape: 'Bulwark Pelt', aura: 'Quake Ring', trail: 'Slag Footprints', banner: 'Siege Standard' },
  iskra:  { hat: 'Needle Tiara', mask: 'Lace Visor', cape: 'Phase Ribbon', aura: 'Static Motes', trail: 'Violet Streak', banner: 'Kite Tail' },
  orin:   { hat: 'Choir Horns', mask: 'Hymn Muzzle', cape: 'Organ-Pipe Mantle', aura: 'Drone Orbit', trail: 'Magnet Filings', banner: 'Tether Spire' },
};
const COLORS = { sarrow: [0xe0702a, 0x3ff6e0], zaleks: [0xffa030, 0xd8cfb8], iskra: [0xe060ff, 0x9ffcff], orin: [0xff5a6a, 0xffd0a0] };

// level 2 unlocks the first item, then one per level: every hero's hat, then every hero's mask...
export const COSMETICS = [];
SLOTS.forEach((slot, si) => HERO_IDS.forEach((hero, hi) => COSMETICS.push({
  id: `${hero}-${slot}`, hero, slot, name: NAMES[hero][slot], level: 2 + si * 4 + hi,
  color: COLORS[hero][si % 2], glow: COLORS[hero][(si + 1) % 2],
})));
export const MAX_COSMETIC_LEVEL = 2 + COSMETICS.length - 1; // 25

// ARENA SKINS: 4 heroes x 5 arenas. tint = body colour wash, glow = core/eye colour
const ARENA = [
  { id: 'slag', label: 'Slag Yard' }, { id: 'foundry', label: 'Molten Foundry' }, { id: 'tundra', label: 'Frozen Scrap Tundra' },
  { id: 'cathedral', label: 'Neon Rust Cathedral' }, { id: 'rooftop', label: 'Storm Rooftop' },
];
const SKIN_DATA = {
  sarrow: [['Slagwalker', 0x7a5a32, 0xc8ff3a], ['Forgeborn', 0xd2401a, 0xffd23a], ['Frostcoat', 0xbfe0ff, 0x7ffff2], ['Neon Pilgrim', 0xc23aff, 0x3affd0], ['Stormchaser', 0x5a6a7a, 0xffe85a]],
  zaleks: [['Scrapheap Bulwark', 0x6a5a3a, 0xc8ff3a], ['Crucible Plate', 0xb83010, 0xffb030], ['Glacier Ram', 0xd8f0ff, 0x6ad0ff], ['Stained-Glass Knight', 0xff3a9a, 0x9a7aff], ['Thunder Anvil', 0x485868, 0xfff05a]],
  iskra:  [['Rustlace', 0x8a6a40, 0xd8ff6a], ['Ember Needle', 0xff5a2a, 0xffe07a], ['Rime Dancer', 0xe0f4ff, 0x8affff], ['Midnight Choir', 0x8a2aff, 0xff4ad8], ['Lightning Kite', 0x3a4a6a, 0xfff27a]],
  orin:   [['Yard Hermit', 0x6a6a3a, 0xc8ff3a], ['Bellows Monk', 0xc04020, 0xffa040], ['Icebound Cantor', 0xcfe6ff, 0x7ad8ff], ['Neon Organist', 0xff2ac8, 0x3ad8ff], ['Storm Bellringer', 0x4a5a6a, 0xffe04a]],
};
export const ARENA_SKINS = Object.fromEntries(HERO_IDS.map((h) => [h, ARENA.map((a, i) => ({
  id: `${h}-${a.id}`, hero: h, arena: a.id, arenaLabel: a.label, name: SKIN_DATA[h][i][0], tint: SKIN_DATA[h][i][1], glow: SKIN_DATA[h][i][2],
}))]));

export const xpNeeded = (level) => 150 + 75 * (level - 1); // XP from this level to the next
// XP for a run: waves reached, kills, bosses beaten (a little extra in CoreBurnZ)
export function xpForRun({ wave = 1, kills = 0, bosses = 0, z = false, coop = false }) {
  const base = 10 * wave + 0.5 * kills + 60 * bosses;
  return Math.max(10, Math.round(base * (z ? 1.1 : 1) * (coop ? 1.1 : 1)));
}

export class Progress {
  constructor() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { d = {}; }
    this.data = { xp: 0, level: 1, equipped: {}, arenaSkins: 'z', ...d };
    for (const h of HERO_IDS) this.data.equipped[h] = this.data.equipped[h] || {};
  }
  save() { localStorage.setItem(KEY, JSON.stringify(this.data)); }
  get level() { return this.data.level; }
  get xp() { return this.data.xp; }
  owns(item) { return this.data.level >= item.level; }
  itemsFor(hero) { return COSMETICS.filter((c) => c.hero === hero); }
  equipped(hero) { return this.data.equipped[hero] || {}; }
  equip(hero, slot, id) { // id null = take it off
    const item = COSMETICS.find((c) => c.id === id);
    if (id && (!item || !this.owns(item) || item.hero !== hero)) return false;
    this.data.equipped[hero][slot] = id || null;
    this.save();
    return true;
  }
  // 'z' = arena skins in CoreBurnZ only (default), 'all' = every mode, 'off'
  setArenaSkins(v) { this.data.arenaSkins = v; this.save(); }
  arenaSkinFor(hero, arenaIndex, z) {
    const m = this.data.arenaSkins;
    if (m === 'off' || (m === 'z' && !z)) return null;
    return (ARENA_SKINS[hero] || [])[arenaIndex] || null;
  }
  // Add XP; returns { gained, levels: [new levels], unlocks: [items], scrap }
  addXp(amount) {
    const out = { gained: amount, levels: [], unlocks: [], scrap: 0, before: this.data.level };
    this.data.xp += amount;
    while (this.data.xp >= xpNeeded(this.data.level)) {
      this.data.xp -= xpNeeded(this.data.level);
      this.data.level++;
      out.levels.push(this.data.level);
      const item = COSMETICS.find((c) => c.level === this.data.level);
      if (item) {
        out.unlocks.push(item);
        if (!this.data.equipped[item.hero][item.slot]) this.data.equipped[item.hero][item.slot] = item.id; // auto-wear new stuff
      } else out.scrap += 50; // past the last cosmetic: a bit of scrap per level
    }
    this.save();
    return out;
  }
}
export const progress = typeof localStorage !== 'undefined' ? new Progress() : null;

// progress.js
// ACCOUNT LEVEL + COSMETICS (saved on this device). Every run in ANY mode (classic, CoreBurnZ,
// daily, rush, co-op) earns XP. Each level-up unlocks one cosmetic for a specific hero (hats, masks,
// capes, auras, talon trails, back banners), in a fixed order so everyone unlocks the same things.
// Plus ARENA SKINS: every hero has a themed look for each of the 5 arenas (auto in CoreBurnZ, or on
// everywhere / off from the Cosmetics screen). No Three.js here.
//
// v1.14: the account level goes to 100 (gently rising curve, existing progress kept) with titles,
// name-plate banners, KAGERO's cosmetics and scrap past 25. HERO LEVELS (CoreBurnZ runs): each hero
// earns its own XP up to level 30 for skin variants, hero titles and mastery cosmetics.

const KEY = 'coreburn-progress';
const BASE_HEROES = ['sarrow', 'zaleks', 'iskra', 'orin'];
export const HERO_IDS = [...BASE_HEROES, 'ninja', 'axiom'];
const BASE_SLOTS = ['hat', 'mask', 'cape', 'aura', 'trail', 'banner']; // the level-up sets (order = unlock order: never change)
// Phase 3B: two geometry slots on top (shoulder armour, weapon shape). Saved per hero in equipped[hero][slot].
export const SLOTS = [...BASE_SLOTS, 'shoulder', 'weapon'];
export const SLOT_LABEL = { hat: 'HELMET / HAT', mask: 'MASK', cape: 'BACK', aura: 'AURA', trail: 'TALON TRAIL', banner: 'BANNER', shoulder: 'SHOULDERS', weapon: 'WEAPON' };

const NAMES = {
  sarrow: { hat: "Drifter's Brim", mask: 'Ash Veil', cape: 'Ember Mantle', aura: 'Cinder Halo', trail: 'Talon Wake', banner: "Duelist's Pennant" },
  zaleks: { hat: 'Rivet Crown', mask: 'Furnace Grille', cape: 'Bulwark Pelt', aura: 'Quake Ring', trail: 'Slag Footprints', banner: 'Siege Standard' },
  iskra:  { hat: 'Needle Tiara', mask: 'Lace Visor', cape: 'Phase Ribbon', aura: 'Static Motes', trail: 'Violet Streak', banner: 'Kite Tail' },
  orin:   { hat: 'Choir Horns', mask: 'Hymn Muzzle', cape: 'Organ-Pipe Mantle', aura: 'Drone Orbit', trail: 'Magnet Filings', banner: 'Tether Spire' },
  axiom:  { hat: 'Antenna Crown', mask: 'Null Visor', cape: 'Cable Mantle', aura: 'Drone Halo', trail: 'Red Scanline', banner: 'Network Pylon' },
  ninja:  { hat: 'Ronin Kasa', mask: 'Oni Half-Mask', cape: 'Night Shroud', aura: 'Smoke Ring', trail: 'Shadow Wake', banner: 'Clan Sashimono' },
};
const COLORS = { sarrow: [0xe0702a, 0x3ff6e0], zaleks: [0xffa030, 0xd8cfb8], iskra: [0xe060ff, 0x9ffcff], orin: [0xff5a6a, 0xffd0a0], ninja: [0x5a3ad0, 0xc8c0ff], axiom: [0x8a1a22, 0xff3a4a] };

// level 2 unlocks the first item, then one per level: every hero's hat, then every hero's mask...
export const COSMETICS = [];
BASE_SLOTS.forEach((slot, si) => BASE_HEROES.forEach((hero, hi) => COSMETICS.push({
  id: `${hero}-${slot}`, hero, slot, name: NAMES[hero][slot], level: 2 + si * 4 + hi,
  color: COLORS[hero][si % 2], glow: COLORS[hero][(si + 1) % 2],
})));
export const MAX_COSMETIC_LEVEL = 25;
// KAGERO's set: account levels 27, 30, 33, 36, 39, 42
BASE_SLOTS.forEach((slot, si) => COSMETICS.push({ id: `ninja-${slot}`, hero: 'ninja', slot, name: NAMES.ninja[slot], level: 27 + si * 3, color: COLORS.ninja[si % 2], glow: COLORS.ninja[(si + 1) % 2] }));
// AXIOM's set: account levels 45..60
BASE_SLOTS.forEach((slot, si) => COSMETICS.push({ id: `axiom-${slot}`, hero: 'axiom', slot, name: NAMES.axiom[slot], level: 45 + si * 3, color: COLORS.axiom[si % 2], glow: COLORS.axiom[(si + 1) % 2] }));
// MASTERY cosmetics (hero level): gold versions of the hero's own shapes
const MASTERY = [['aura', 7, 'Mastery Halo'], ['banner', 13, 'Mastery Standard'], ['cape', 18, 'Veteran Mantle'], ['hat', 24, 'Grand Crown']];
for (const h of HERO_IDS) for (const [slot, hl, name] of MASTERY) COSMETICS.push({ id: `${h}-m-${slot}`, hero: h, slot, name, heroLevel: hl, color: 0xd8a83a, glow: 0xfff0a0, mastery: true });


// ---- Phase 3B GEAR: geometry-changing cosmetics built on each hero's anchor points (cosmetics.js GEAR) ----
// Bought with scrap in the Shop (cost; owned ids live in the scrap save's `owned` list, like shop skins)
// or EARNED from real progress (earn). Prices sit next to the old shop (100-300) and a wave-20 run (~150-200
// scrap): commons ~1-2 runs, rares ~3, epics ~4-5. No new save fields: equipping uses equipped[hero][slot].
export const RARITY = { common: { label: 'COMMON', c: 0x9aa6b0 }, rare: { label: 'RARE', c: 0x3ab0ff }, epic: { label: 'EPIC', c: 0xb05aff }, legendary: { label: 'LEGENDARY', c: 0xffb02a }, earned: { label: 'EARNED', c: 0xffe27a } };
const GEAR = {
  sarrow: [['shoulder', 'pauldron', 'Riveted Pauldrons', 'common', 250, 0x6a737d, 0xe0702a], ['hat', 'warhelm', 'Duelist Warhelm', 'rare', 450, 0x4d5a66, 0x3ff6e0], ['weapon', 'serrated', 'Serrated Talons', 'rare', 400, 0, 0x7affe8], ['cape', 'wings', 'Exhaust Wings', 'epic', 700, 0x2a3038, 0x3ff6e0]],
  zaleks: [['mask', 'respirator', 'Siege Respirator', 'common', 250, 0x3a3c40, 0xffa030], ['shoulder', 'spiked', 'Bastion Spikes', 'rare', 400, 0x5a5e63, 0xffa030], ['weapon', 'serrated', 'Breaker Teeth', 'rare', 400, 0, 0xffc060], ['cape', 'stacks', 'Reactor Stacks', 'epic', 650, 0x2c2e31, 0xff7a20]],
  iskra:  [['shoulder', 'pads', 'Strike Pads', 'common', 250, 0x9aa0aa, 0xe060ff], ['hat', 'visorhelm', 'Recon Visor', 'rare', 400, 0xc9c4bc, 0xe060ff], ['weapon', 'prism', 'Prism Needles', 'rare', 450, 0, 0xffb0ff], ['cape', 'quiver', 'Needle Quiver', 'epic', 600, 0x433d58, 0xe060ff]],
  orin:   [['shoulder', 'coil', 'Tether Coils', 'common', 300, 0xb08a4a, 0x3ff6e0], ['hat', 'crown', 'Gravity Crown', 'rare', 500, 0xb08a4a, 0x3ff6e0], ['weapon', 'serrated', 'Hooked Sickles', 'rare', 400, 0, 0xff9080], ['cape', 'ring', 'Graviton Ring', 'epic', 700, 0x8a8580, 0xff4a5a]],
  ninja:  [['shoulder', 'sode', 'Lacquer Sode', 'common', 300, 0x7a1a22, 0xa08cff], ['mask', 'kitsune', 'Kitsune Mask', 'rare', 400, 0xe8e4dc, 0xff3a4a], ['weapon', 'tristar', 'Tri-Star', 'rare', 400, 0, 0xd0c8ff], ['cape', 'katanas', 'Twin Katana Rig', 'epic', 650, 0x14141b, 0xa08cff]],
  axiom:  [['shoulder', 'pylon', 'Drone Pylons', 'common', 350, 0x2c2e37, 0xff2a3a], ['hat', 'sensor', 'Sensor Array', 'rare', 450, 0x5e6270, 0xff2a3a], ['weapon', 'prism', 'Prism Emitters', 'rare', 450, 0, 0xff6a6a], ['cape', 'wings', 'Uplink Wings', 'epic', 750, 0x15161b, 0xff2a3a]],
};
const WEAPON_SHAPE = { sarrow: 'serrated', zaleks: 'serrated', iskra: 'prism', orin: 'serrated', ninja: 'tristar', axiom: 'prism' };
for (const h of HERO_IDS) {
  for (const [slot, shape, name, rarity, cost, color, glow] of GEAR[h]) COSMETICS.push({ id: `${h}-g-${shape}`, hero: h, slot, shape, name, rarity, cost, color: color || glow, glow, gear: true });
  // EARNED (never sold): this hero's best CoreBurnZ wave, every boss beaten, hero mastery level
  COSMETICS.push({ id: `${h}-e-crown`, hero: h, slot: 'hat', shape: 'crown', name: 'Ascendant Crown', rarity: 'earned', color: 0xd8a83a, glow: 0xfff0a0, gear: true, earn: { kind: 'heroWave', n: 40 } });
  COSMETICS.push({ id: `${h}-e-plates`, hero: h, slot: 'shoulder', shape: 'spiked', name: 'Bossbreaker Plates', rarity: 'earned', color: 0xd8a83a, glow: 0xff5a2a, gear: true, earn: { kind: 'bosses', n: 7 } });
  COSMETICS.push({ id: `${h}-e-edge`, hero: h, slot: 'weapon', shape: WEAPON_SHAPE[h], name: 'Masterwork Edge', rarity: 'earned', color: 0xffe27a, glow: 0xffe27a, gear: true, earn: { kind: 'heroLevel', n: 20 } });
}
// prestige pieces for the hard-unlock heroes
COSMETICS.push({ id: 'ninja-e-wings', hero: 'ninja', slot: 'cape', shape: 'wings', name: 'Shadow Lord Wings', rarity: 'earned', color: 0x0c0a14, glow: 0xa08cff, gear: true, earn: { kind: 'heroWave', n: 50 } });
COSMETICS.push({ id: 'axiom-e-halo', hero: 'axiom', slot: 'cape', shape: 'ring', name: 'Overmind Halo', rarity: 'earned', color: 0x5e6270, glow: 0xff2a3a, gear: true, earn: { kind: 'heroWave', n: 60 } });
const EARN_LABEL = { heroWave: (n, h) => `Reach wave ${n} with this hero (CoreBurnZ)`, bosses: (n) => `Beat all ${n} bosses`, heroLevel: (n) => `Hero level ${n}` };

// Hooks the game fills in (main.js): scrap-shop ownership + lifetime stats, so this file stays save-only
export const progressHooks = { shopOwns: () => false, stats: () => ({}) };

export const ACCOUNT_MAX = 100, HERO_MAX = 30;
// TITLES: account titles (shown on the menu, game over and your co-op tag) + per-hero titles
const ACCOUNT_TITLES = [[5, 'Scrap Rookie'], [10, 'Choir Breaker'], [20, 'Core Keeper'], [30, 'Grind Walker'], [40, 'Hymn Silencer'], [50, 'Slag Saint'], [60, 'Forge Heretic'], [70, 'Storm Herald'], [80, 'Grindchoir Bane'], [90, 'The Last Note'], [100, 'The Unsung']];
const HERO_TITLES = {
  sarrow: ['Talon Adept', 'Blinkblade', 'Duelist of Ash', 'Overdrive Saint', 'The Last Talon'],
  zaleks: ['Plated Recruit', 'Wall of Rivets', 'Quakebringer', 'Unbreakable', 'The Iron Choir'],
  iskra:  ['Needle Novice', 'Phase Dancer', 'Storm Weaver', 'Untouchable', 'The Thousand Needles'],
  orin:   ['Silent Unit', 'Tether Cantor', 'Drone Shepherd', 'Hymn Breaker', 'The Rogue Choir'],
  axiom:  ['Boot Sequence', 'Drone Foreman', 'Hive Mind', 'War Network', 'The Machine Mind'],
  ninja:  ['Shadow Initiate', 'Star Thrower', 'Stepless', 'Twin Shade', 'The Unseen Blade'],
};
const HERO_TITLE_LEVELS = [5, 10, 20, 25, 30];
export const TITLES = [
  ...ACCOUNT_TITLES.map(([lv, name]) => ({ id: `t-${lv}`, name, level: lv })),
  ...HERO_IDS.flatMap((h) => HERO_TITLES[h].map((name, i) => ({ id: `t-${h}-${i}`, name, hero: h, heroLevel: HERO_TITLE_LEVELS[i] }))),
];
// NAME-PLATE BANNERS (the level badge on the menu)
export const PLATES = [[35, 'rust', 'Rust Plate'], [50, 'ember', 'Ember Plate'], [65, 'frost', 'Frost Plate'], [80, 'neon', 'Neon Plate'], [100, 'gold', 'Gold Plate']]
  .map(([level, id, name]) => ({ id, name, level }));
// SKIN VARIANTS (hero level 3 / 9 / 15 / 21): a full recolour of the hero
const VARIANTS = [[3, 'ashen', 'Ashen', 0x9a9a9a, 0xffffff], [9, 'gilded', 'Gilded', 0xd8a83a, 0xfff0a0], [15, 'void', 'Voidtouched', 0x3a1a5a, 0xb07aff], [21, 'prism', 'Prismatic', 0x3affd0, 0xff5ad8]];
export const SKIN_VARIANTS = Object.fromEntries(HERO_IDS.map((h) => [h, VARIANTS.map(([hl, id, name, tint, glow]) => ({ id: `${h}-v-${id}`, hero: h, name, heroLevel: hl, tint, glow }))]));
// what a hero level gives (for the game-over list / hero select)
export function heroReward(hero, lv) {
  const out = [];
  for (const v of SKIN_VARIANTS[hero]) if (v.heroLevel === lv) out.push(`${v.name} skin`);
  for (const c of COSMETICS) if (c.hero === hero && c.heroLevel === lv) out.push(c.name);
  for (const t of TITLES) if (t.hero === hero && t.heroLevel === lv) out.push(`title "${t.name}"`);
  return out.length ? out : ['+30 scrap'];
}

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
  axiom:  [['Rustframe', 0x5a4a3a, 0xc8ff3a], ['Furnace Core', 0x6a1a10, 0xffb030], ['Coldboot', 0xc8dcf0, 0x6ad0ff], ['Neon Override', 0x3a1a6a, 0xff3ad8], ['Storm Relay', 0x3a4a5a, 0xfff05a]],
  ninja:  [['Ashfoot Shade', 0x5a4a3a, 0xc8ff3a], ['Ember Shinobi', 0xc0381a, 0xffb030], ['Snowveil', 0xd8ecff, 0x9ae0ff], ['Neon Ronin', 0x7a2aff, 0x3affd0], ['Stormstep', 0x3a4a5a, 0xfff05a]],
};
export const ARENA_SKINS = Object.fromEntries(HERO_IDS.map((h) => [h, ARENA.map((a, i) => ({
  id: `${h}-${a.id}`, hero: h, arena: a.id, arenaLabel: a.label, name: SKIN_DATA[h][i][0], tint: SKIN_DATA[h][i][1], glow: SKIN_DATA[h][i][2],
}))]));

// XP from this level to the next: the old curve up to 25 (so nobody loses progress), then a gentle +30 per level
export const xpNeeded = (level) => (level < 25 ? 150 + 75 * (level - 1) : 1950 + 30 * (level - 25));
export const heroXpNeeded = (level) => 100 + 40 * (level - 1); // per-hero levels (1-30)
// what an account level gives
export function accountReward(lv) {
  const out = [];
  for (const c of COSMETICS) if (c.level === lv) out.push(c.name);
  for (const t of TITLES) if (!t.hero && t.level === lv) out.push(`title "${t.name}"`);
  for (const p of PLATES) if (p.level === lv) out.push(p.name);
  return out;
}
export const levelScrap = (lv) => 50 + 2 * lv;
// XP for a run: waves reached, kills, bosses beaten (a little extra in CoreBurnZ)
export function xpForRun({ wave = 1, kills = 0, bosses = 0, z = false, coop = false }) {
  const base = 10 * wave + 0.5 * kills + 60 * bosses;
  return Math.max(10, Math.round(base * (z ? 1.1 : 1) * (coop ? 1.1 : 1)));
}

export class Progress {
  constructor() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { d = {}; }
    this.data = { xp: 0, level: 1, equipped: {}, arenaSkins: 'z', heroXp: {}, heroLevel: {}, variant: {}, title: null, plate: null, ...d };
    for (const h of HERO_IDS) {
      this.data.equipped[h] = this.data.equipped[h] || {};
      this.data.heroXp[h] = this.data.heroXp[h] || 0;
      this.data.heroLevel[h] = this.data.heroLevel[h] || 1;
    }
  }
  save() { localStorage.setItem(KEY, JSON.stringify(this.data)); }
  get level() { return this.data.level; }
  get xp() { return this.data.xp; }
  heroLevel(h) { return this.data.heroLevel[h] || 1; }
  heroInfo(h) { const lv = this.heroLevel(h); return { level: lv, xp: this.data.heroXp[h] || 0, need: lv >= HERO_MAX ? 0 : heroXpNeeded(lv), max: lv >= HERO_MAX }; }
  owns(item) {
    if (item.cost) return !!progressHooks.shopOwns(item.id);
    if (item.earn) { const [c, t] = this.earnProgress(item); return c >= t; }
    return item.heroLevel ? this.heroLevel(item.hero) >= item.heroLevel : this.data.level >= item.level;
  }
  // [current, target, text] for an EARNED item, read from the real stats (never stored)
  earnProgress(item) {
    const e = item.earn, s = progressHooks.stats() || {};
    const cur = e.kind === 'heroWave' ? ((s.heroBest || {})[item.hero] || 0) : e.kind === 'bosses' ? (Array.isArray(s.bosses) ? s.bosses.length : 0) : this.heroLevel(item.hero);
    return [Math.min(cur, e.n), e.n, EARN_LABEL[e.kind](e.n, item.hero)];
  }
  lockText(item) {
    if (item.cost) return `${item.cost.toLocaleString()} SCRAP · SHOP`;
    if (item.earn) { const [c, t] = this.earnProgress(item); return `${c}/${t} · ${EARN_LABEL[item.earn.kind](t)}`; }
    return item.heroLevel ? `HERO LV ${item.heroLevel}` : `LEVEL ${item.level}`;
  }
  itemsFor(hero) { return COSMETICS.filter((c) => c.hero === hero); }
  equipped(hero) { return this.data.equipped[hero] || {}; }
  equip(hero, slot, id) { // id null = take it off
    const item = COSMETICS.find((c) => c.id === id);
    if (id && (!item || !this.owns(item) || item.hero !== hero)) return false;
    this.data.equipped[hero][slot] = id || null;
    this.save();
    return true;
  }
  // hero skin variants / titles / name plates
  variantOf(h) { const v = (SKIN_VARIANTS[h] || []).find((x) => x.id === this.data.variant[h]); return v && this.owns(v) ? v : null; }
  setVariant(h, id) { const v = (SKIN_VARIANTS[h] || []).find((x) => x.id === id); if (id && (!v || !this.owns(v))) return false; this.data.variant[h] = id || null; this.save(); return true; }
  get title() { const t = TITLES.find((x) => x.id === this.data.title); return t && this.owns(t) ? t : null; }
  setTitle(id) { const t = TITLES.find((x) => x.id === id); if (id && (!t || !this.owns(t))) return false; this.data.title = id || null; this.save(); return true; }
  get plate() { const p = PLATES.find((x) => x.id === this.data.plate); return p && this.owns(p) ? p : null; }
  setPlate(id) { const p = PLATES.find((x) => x.id === id); if (id && (!p || !this.owns(p))) return false; this.data.plate = id || null; this.save(); return true; }
  // 'z' = arena skins in CoreBurnZ only (default), 'all' = every mode, 'off'
  setArenaSkins(v) { this.data.arenaSkins = v; this.save(); }
  arenaSkinFor(hero, arenaIndex, z) { return skinFor(hero, arenaIndex, z, this.data.arenaSkins); }
  // What co-op friends need to draw you: owned + equipped items for every hero, skin setting, variants, title
  look(scrapTint = null) {
    const eq = {}, vr = {};
    for (const h of HERO_IDS) {
      eq[h] = {};
      for (const [slot, id] of Object.entries(this.equipped(h))) { const it = COSMETICS.find((c) => c.id === id); if (it && this.owns(it)) eq[h][slot] = id; }
      const v = this.variantOf(h); if (v) vr[h] = v.id;
    }
    return { eq, vr, sm: this.data.arenaSkins, sc: scrapTint, t: this.title ? this.title.name : null };
  }
  // Add account XP; returns { gained, levels: [new levels], unlocks: [names], scrap }
  addXp(amount) {
    const out = { gained: amount, levels: [], unlocks: [], scrap: 0, before: this.data.level };
    if (this.data.level >= ACCOUNT_MAX) { out.scrap = Math.round(amount / 40); this.save(); return out; } // maxed: XP turns into a little scrap
    this.data.xp += amount;
    while (this.data.level < ACCOUNT_MAX && this.data.xp >= xpNeeded(this.data.level)) {
      this.data.xp -= xpNeeded(this.data.level);
      this.data.level++;
      const lv = this.data.level;
      out.levels.push(lv);
      const items = COSMETICS.filter((c) => c.level === lv);
      for (const item of items) if (!this.data.equipped[item.hero][item.slot]) this.data.equipped[item.hero][item.slot] = item.id; // auto-wear new stuff
      const got = accountReward(lv);
      out.unlocks.push(...got);
      if (!got.length || lv > 25) { out.scrap += levelScrap(lv); if (!got.length) out.unlocks.push(`+${levelScrap(lv)} scrap`); }
    }
    if (this.data.level >= ACCOUNT_MAX) this.data.xp = 0;
    this.save();
    return out;
  }
  // Add hero XP (CoreBurnZ runs); returns { hero, gained, levels, unlocks, scrap }
  addHeroXp(hero, amount) {
    const out = { hero, gained: amount, levels: [], unlocks: [], scrap: 0, before: this.heroLevel(hero) };
    if (!HERO_IDS.includes(hero)) return out;
    if (this.heroLevel(hero) >= HERO_MAX) { this.save(); return out; }
    this.data.heroXp[hero] += amount;
    while (this.data.heroLevel[hero] < HERO_MAX && this.data.heroXp[hero] >= heroXpNeeded(this.data.heroLevel[hero])) {
      this.data.heroXp[hero] -= heroXpNeeded(this.data.heroLevel[hero]);
      const lv = ++this.data.heroLevel[hero];
      out.levels.push(lv);
      const r = heroReward(hero, lv);
      out.unlocks.push(...r);
      if (r[0] === '+30 scrap') out.scrap += 30;
      for (const c of COSMETICS) if (c.hero === hero && c.heroLevel === lv && !this.data.equipped[hero][c.slot]) this.data.equipped[hero][c.slot] = c.id;
    }
    if (this.data.heroLevel[hero] >= HERO_MAX) this.data.heroXp[hero] = 0;
    this.save();
    return out;
  }
}
export const progress = typeof localStorage !== 'undefined' ? new Progress() : null;

// Arena skin for a hero in an arena under a skin setting ('z' | 'all' | 'off')
export const variantById = (id) => Object.values(SKIN_VARIANTS).flat().find((v) => v.id === id) || null;
export function skinFor(hero, arenaIndex, z, mode = 'z') {
  if (mode === 'off' || (mode !== 'all' && !z)) return null;
  return (ARENA_SKINS[hero] || [])[arenaIndex] || null;
}
// A look that came over the network: keep only known items for the right hero/slot
export function cleanLook(l) {
  const out = { eq: {}, vr: {}, sm: 'z', sc: null, t: null };
  if (!l || typeof l !== 'object') return out;
  if (typeof l.t === 'string' && TITLES.some((x) => x.name === l.t)) out.t = l.t;
  for (const h of HERO_IDS) { const id = l.vr && l.vr[h]; if ((SKIN_VARIANTS[h] || []).some((v) => v.id === id)) out.vr[h] = id; }
  if (['z', 'all', 'off'].includes(l.sm)) out.sm = l.sm;
  if (Number.isInteger(l.sc) && l.sc >= 0 && l.sc <= 0xffffff) out.sc = l.sc;
  for (const h of HERO_IDS) {
    out.eq[h] = {};
    const src = l.eq && typeof l.eq[h] === 'object' ? l.eq[h] : {};
    for (const slot of SLOTS) { const it = COSMETICS.find((c) => c.id === src[slot]); if (it && it.hero === h && it.slot === slot) out.eq[h][slot] = it.id; }
  }
  return out;
}

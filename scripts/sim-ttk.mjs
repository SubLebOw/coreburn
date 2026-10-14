// scripts/sim-ttk.mjs
// Time-to-kill + survival simulator for the heroes and the weapon tier scaling (node scripts/sim-ttk.mjs).
//
// Model (single target): the talon combo does 12 + 12 + 28 = 52 damage per ~0.95 s cycle, i.e. ~54.7 dps
// for Sarrow at tier 0, x the hero's damage x attack speed. One upgrade pick every 2 waves = weapon tier +1.
// Enemy health at wave n = base x (1 + 0.14(n-1)); elites x2.2. Standard = Acolyte (30 hp).
// Survival = how long the hero lasts under steady pressure: eff. HP x mobility / incoming dps, where
// incoming dps = 10 x (1 + 0.07(n-1)) (x1.6 for elites) and mobility (0.7 x move speed + 0.3 x blink)
// stands for how much damage you avoid. Absolute seconds are illustrative; compare heroes and waves.
import { Loadout, weaponMult, PICK_EVERY } from '../js/upgrades.js';
import { HERO_STATS, CHARACTER_ORDER, characterBudget } from '../js/hero-stats.js';

const BASE_DPS = 52 / 0.95;
const hpMult = (n) => 1 + 0.14 * (n - 1);
const dmgMult = (n) => 1 + 0.07 * (n - 1);
const WAVES = [1, 10, 30, 60, 100];
// A "typical" build: a mix of damage, defence and mobility picks, as a player might choose
const TYPICAL = ['edge', 'crit', 'maxHp', 'twin', 'bkCharge', 'shock', 'odDamage', 'speed', 'regen', 'arc',
  'storm', 'odTime', 'bkCool', 'leech', 'odRadius', 'bkDamage'];
const MAXDMG = ['edge', 'crit', 'twin'];

function build(order, picks) {
  const l = new Loadout();
  for (let i = 0; i < picks; i++) {
    const rotated = order.slice(i % order.length).concat(order);
    l.apply(rotated.find((x) => l.level(x) < l.def(x).max) || 'patch');
  }
  return l;
}
const picksBefore = (n) => Math.floor((n - 1) / PICK_EVERY);
const f = (x) => x.toFixed(2) + 's';

console.log('\nHero budget (DPS x HP x mobility, Sarrow = 100):');
console.table(CHARACTER_ORDER.map((id) => { const b = characterBudget(HERO_STATS[id]); return { hero: id, dps: b.dps.toFixed(2), hp: b.hp, mobility: b.mobility.toFixed(2), budget: b.budget.toFixed(1) }; }));

console.log('\nWeapon scaling (one pick every 2 waves):');
console.table(WAVES.map((n) => {
  const t = picksBefore(n), typ = build(TYPICAL, t), max = build(MAXDMG, t);
  const std = 30 * hpMult(n), el = std * 2.2, base = BASE_DPS * weaponMult(t);
  return { wave: n, picks: t, 'enemy hp x': hpMult(n).toFixed(2), 'weapon x': weaponMult(t).toFixed(2),
    'base std': f(std / base), 'base elite': f(el / base),
    'typical perk x': typ.perkDamageMult.toFixed(2), 'typical std': f(std / base / typ.perkDamageMult), 'typical elite': f(el / base / typ.perkDamageMult),
    'max-dmg perk x': max.perkDamageMult.toFixed(2), 'max-dmg elite': f(el / base / max.perkDamageMult) };
}));

console.log('\nPer hero, typical build: time-to-kill (std / elite) and survival time (vs std / elite pressure):');
const rows = [];
for (const n of WAVES) {
  const t = picksBefore(n), typ = build(TYPICAL, t);
  const std = 30 * hpMult(n), el = std * 2.2;
  const row = { wave: n };
  const vals = [];
  for (const id of CHARACTER_ORDER) {
    const c = HERO_STATS[id], b = characterBudget(c);
    const dps = BASE_DPS * c.dmg * c.atkSpeed * weaponMult(t) * typ.perkDamageMult;
    const hp = Math.round(c.hp * (1 + typ.stats.maxHpPct)) + typ.stats.maxHpFlat;
    const surv = hp * b.mobility / (10 * dmgMult(n));
    row[`${id} ttk`] = `${f(std / dps)} / ${f(el / dps)}`;
    row[`${id} survive`] = `${surv.toFixed(1)}s / ${(surv / 1.6).toFixed(1)}s`;
    vals.push((dps / (BASE_DPS * weaponMult(t) * typ.perkDamageMult)) * hp * b.mobility);
  }
  row['spread'] = ((Math.max(...vals) / Math.min(...vals) - 1) * 100).toFixed(1) + '%';
  rows.push(row);
}
console.table(rows);

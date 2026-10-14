// scripts/sim-ttk.mjs
// Time-to-kill simulator for the weapon tier scaling (run: node scripts/sim-ttk.mjs).
// Model: Sarrow's talon combo does 12 + 12 + 28 = 52 damage per ~0.95 s cycle (single target),
// i.e. ~54.7 damage/second at tier 0. Every boss beaten = 1 pick = weapon tier +1.
// Enemy health at wave n = base x (1 + 0.14(n-1)); elites x2.2. Standard = Acolyte (30 hp).
import { Loadout, weaponMult } from '../js/upgrades.js';

const BASE_DPS = 52 / 0.95;
const hpMult = (n) => 1 + 0.14 * (n - 1);
// A "typical" build: a mix of damage, defence and mobility picks, as a player might choose
const TYPICAL = ['edge', 'crit', 'maxHp', 'twin', 'bkCharge', 'shock', 'edge', 'odDamage', 'crit', 'speed', 'twin',
  'edge', 'regen', 'crit', 'arc', 'storm', 'edge', 'odTime', 'twin', 'crit', 'maxHp', 'bkCool', 'leech', 'shock'];
const MAXDMG = ['edge', 'crit', 'twin', 'edge', 'crit', 'twin', 'edge', 'crit', 'twin', 'edge', 'crit', 'edge'];

// Pick i takes list[i] (or the next one after it that isn't maxed; Reactor Patch when nothing is left)
function build(order, picks) {
  const l = new Loadout();
  for (let i = 0; i < picks; i++) {
    const rotated = order.slice(i % order.length).concat(order);
    l.apply(rotated.find((x) => l.level(x) < l.def(x).max) || 'patch');
  }
  return l;
}

const rows = [];
for (const n of [1, 10, 30, 60, 100]) {
  const tier = Math.floor((n - 1) / 5);          // bosses beaten before wave n
  const std = 30 * hpMult(n), elite = std * 2.2;
  const base = BASE_DPS * weaponMult(tier);
  const typ = build(TYPICAL, tier), max = build(MAXDMG, tier);
  const t = (hp, mult) => (hp / (base * mult)).toFixed(2) + 's';
  rows.push({ wave: n, tier, 'std hp': std.toFixed(0), 'elite hp': elite.toFixed(0), 'weapon x': weaponMult(tier).toFixed(2),
    'base std': t(std, 1), 'base elite': t(elite, 1),
    'typical perk x': typ.perkDamageMult.toFixed(2), 'typical std': t(std, typ.perkDamageMult), 'typical elite': t(elite, typ.perkDamageMult),
    'max-dmg perk x': max.perkDamageMult.toFixed(2), 'max-dmg elite': t(elite, max.perkDamageMult) });
}
console.table(rows);

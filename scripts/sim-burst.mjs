// scripts/sim-burst.mjs (dev only, v1.31 sim): SYNTHETIC burst-damage model for CoreBurnZ.
// node scripts/sim-burst.mjs [--json]
// Question: how fast do overlapping enemy hits kill each hero, and what would a short
// "damage-protection window" after a hit change? Nothing here touches the game.
//
// MODEL ("caught out"): the hero stands in the crowd and uses no abilities. No Blink / grapple / hop /
// step i-frames, no Zaleks block, Orin Hymn Shell, Axiom Reforge barrier or shields; those AVOID bursts
// in play, and here we measure the burst once you are caught. Kept: base HP x Z tuning, max-HP cards,
// hurtMult cards and armour from a typical build (same pick order as sim-ttk.mjs), and core regen at 1.5/s x regen
// (the "hit recently" rate). Enemy numbers come from js/enemy.js ENEMY_TYPES and js/waves.js + Z_TUNING.waves.
// Attack timing (js/enemy.js attack): melee = windup + cooldown 1.0-1.6 s + 0.45 s recover; hound lunge cd
// 1.8-2.6 s; spitter bolt cd 2.0-2.8 s; lancer 1.0 s painted line (telegraphed).
import { Loadout } from '../js/upgrades.js';
import { HERO_STATS } from '../js/hero-stats.js';
import { RULES, Z_TUNING, zHero } from '../js/rules.js';
import { readFileSync } from 'node:fs';
// enemy.js imports three (browser only), so read ENEMY_TYPES damage numbers straight from its source
const ENEMY_TYPES = Object.fromEntries([...readFileSync(new URL('../js/enemy.js', import.meta.url), 'utf8').matchAll(/^\s+(\w+):\s+\{ hp: (\d+),.*?damage: (\d+)/gm)].map((m) => [m[1], { hp: +m[2], damage: +m[3] }]));
RULES.z = true;
const ZW = Z_TUNING.waves;
const dmgMult = (n) => (1 + 0.07 * (n - 1)) * ZW.dmg;
const HEROES = ['sarrow', 'zaleks', 'iskra', 'orin', 'ninja', 'axiom'];
const NAME = { sarrow: 'Sarrow', zaleks: 'Zaleks', iskra: 'Iskra', orin: 'Orin', ninja: 'Kagero', axiom: 'Axiom' };
const WAVES = [25, 35, 50, 60];

// typical build (copied from sim-ttk.mjs build())
const UNIVERSAL = ['edge', 'maxHp', 'crit', 'odDamage', 'speed', 'bkCool', 'regen', 'twin', 'odCool', 'leech', 'storm'];
const HERO_CARDS = {
  sarrow: ['shock', 'bkCharge', 'arc', 'odTime', 'odRadius', 'bkDamage', 'bkTrail', 'odLeech', 'bkRange'],
  zaleks: ['zStun', 'zShield', 'zGuard', 'zQuake', 'zHammer', 'zTaunt', 'zCharge'],
  iskra: ['iPierce', 'iHop', 'iSplit', 'iStorm', 'iDecoy', 'iVolley', 'iHopRange'],
  ninja: ['nEdge', 'nPierce', 'nMirror', 'nFan', 'nShade', 'nTwin'],
  orin: ['oDrone', 'oShell', 'oChain', 'oDroneDmg', 'oGrapple', 'oVortex', 'oShell', 'oReach', 'oDroneTime'],
  axiom: ['axCap', 'axServo', 'axPayload', 'axPlating', 'axFactory', 'axFeedback'],
};
function build(hero, picks) {
  const l = new Loadout(hero); const order = []; const H = HERO_CARDS[hero];
  for (let i = 0; i < 30; i++) { order.push(UNIVERSAL[i % UNIVERSAL.length]); if (i % 2 === 1) order.push(H[(i >> 1) % H.length]); }
  for (let i = 0; i < picks; i++) { const r = order.slice(i % order.length).concat(order); l.apply(r.find((x) => l.def(x) && l.level(x) < l.def(x).max) || 'patch'); }
  return l;
}
function hero(id, n) {
  const c = HERO_STATS[id], s = build(id, Math.floor((n - 1) / 2)).stats;
  const maxHp = Math.round(c.hp * zHero(id).hp * (1 + s.maxHpPct)) + s.maxHpFlat;
  return { id, maxHp, base: Math.round(c.hp * zHero(id).hp), taken: (1 - (c.armor || 0)) * (s.hurtMult || 1), regen: 1.5 * s.regen };
}

// attackers: type, elite, first swing time, ordinary (false = telegraphed: stays full damage in B/C/D)
const T = (type, t0, opt = {}) => ({ type, t0, elite: !!opt.elite, tele: !!opt.tele });
const SCENARIOS = {
  grunts: { label: '3 acolytes swing together', att: [T('acolyte', 0), T('acolyte', 0.05), T('acolyte', 0.12)] },
  elite: { label: 'elite bulwark + 2 acolytes + hound', att: [T('bulwark', 0.1, { elite: true }), T('acolyte', 0), T('acolyte', 0.2), T('hound', 0.15)] },
  mixed: { label: '2 spitter bolts + 2 acolytes + lancer (telegraphed)', att: [T('spitter', 0), T('spitter', 0.25), T('acolyte', 0.1), T('acolyte', 0.3), T('lancer', 0.2, { tele: true })] },
  swarm: { label: '4 acolytes + 2 hounds (worst ordinary crowd)', att: [T('acolyte', 0), T('acolyte', 0.05), T('acolyte', 0.1), T('acolyte', 0.2), T('hound', 0.15), T('hound', 0.3)] },
};
const PERIOD = { acolyte: [1.9, 2.5], bulwark: [2.2, 2.8], splitter: [1.95, 2.55], hound: [3.3, 4.1], spitter: [2.6, 3.4], lancer: [3.5, 4.5] }; // windup+cooldown+recover

// protection variants. A = none. B/C = spec. D = alternative: opens only on a hit >= 8% max HP,
// and only reduces later ordinary hits that are no bigger than the hit that opened it.
const VARIANTS = {
  A: null,
  B: { win: 0.3, mult: 0.65 },
  C: { win: 0.4, mult: 0.5 },
  D: { win: 0.4, mult: 0.5, minPct: 0.08, capToFirst: true },
  E: { win: 0.4, mult: 0.5, capToFirst: true }, // C, but only hits no bigger than the opener are reduced
};

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
// one fight: returns { ttd, hits, d05, d1 } (ttd = Infinity if alive after 20 s)
function fight(h, n, scen, v, seed) {
  const r = rng(seed), ev = [];
  for (const a of scen.att) {
    const ty = ENEMY_TYPES[a.type], dmg = ty.damage * dmgMult(n) * (a.elite ? 1.35 : 1);
    let t = a.t0 + r() * 0.08; const [p0, p1] = PERIOD[a.type];
    while (t < 20) { ev.push({ t, dmg, tele: a.tele }); t += p0 + r() * (p1 - p0); }
  }
  ev.sort((x, y) => x.t - y.t);
  let hp = h.maxHp, last = 0, winEnd = -1, winFirst = 0, hits = 0, d05 = 0, d1 = 0;
  for (const e of ev) {
    hp = Math.min(h.maxHp, hp + h.regen * (e.t - last)); last = e.t;
    let amt = e.dmg * h.taken;
    const inWin = v && e.t <= winEnd;
    if (inWin && !e.tele && (!v.capToFirst || amt <= winFirst + 1e-9)) amt *= v.mult;
    else if (v && !inWin && (!v.minPct || amt >= v.minPct * h.maxHp)) { winEnd = e.t + v.win; winFirst = amt; } // full hit opens; never refreshed by reduced hits
    hp -= amt; hits++;
    if (e.t <= ev[0].t + 0.5) d05 += amt;
    if (e.t <= ev[0].t + 1) d1 += amt;
    if (hp <= 0) return { ttd: e.t - ev[0].t, hits, d05, d1 };
  }
  return { ttd: Infinity, hits, d05, d1 };
}
const TRIALS = 200;
export function run() {
  const out = [];
  for (const n of WAVES) for (const id of HEROES) {
    const h = hero(id, n);
    for (const [sk, scen] of Object.entries(SCENARIOS)) for (const [vk, v] of Object.entries(VARIANTS)) {
      let ttd = 0, hits = 0, d05 = 0, d1 = 0, alive = 0, fastDeaths = 0;
      for (let i = 0; i < TRIALS; i++) { const f = fight(h, n, scen, v, 1000 * i + 7); if (f.ttd === Infinity) alive++; else { ttd += f.ttd; if (f.ttd < 1) fastDeaths++; } hits += f.hits; d05 += f.d05; d1 += f.d1; }
      const dead = TRIALS - alive;
      out.push({ wave: n, hero: NAME[id], maxHp: h.maxHp, scen: sk, v: vk, fast: fastDeaths / TRIALS, ttd: dead ? ttd / dead : null, survive20: alive / TRIALS, hits: hits / TRIALS, d05: d05 / TRIALS, d1: d1 / TRIALS, d05pct: d05 / TRIALS / h.maxHp, d1pct: d1 / TRIALS / h.maxHp });
    }
  }
  return out;
}
// EXPLOIT: a weak ordinary hit (mite, 4 base) opens the window, then one big ordinary hit (elite bulwark) lands inside it
export function exploit() {
  return WAVES.map((n) => {
    const big = 16 * 1.35 * dmgMult(n), mite = 4 * dmgMult(n), hp = hero('sarrow', n).maxHp;
    // D: a mite hit is under 8% max HP so it opens nothing, and the cap-to-first rule would block it anyway
    return { wave: n, opener: +mite.toFixed(1), bigHit: +big.toFixed(1), A: +(mite + big).toFixed(1), B: +(mite + big * 0.65).toFixed(1), C: +(mite + big * 0.5).toFixed(1), D: +(mite + big).toFixed(1), 'saved C % Sarrow hp': +((big * 0.5) / hp * 100).toFixed(0) };
  });
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const res = run();
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ res, exploit: exploit(), scen: Object.fromEntries(Object.entries(SCENARIOS).map(([k, s]) => [k, s.label])) })); process.exit(0); }
  console.log('SYNTHETIC burst model (see header). ttd = seconds from first hit to death, caught out, no abilities.');
  for (const sk of Object.keys(SCENARIOS)) {
    console.log(`\n${SCENARIOS[sk].label}`);
    console.table(res.filter((r) => r.scen === sk && r.v === 'A').map((a) => {
      const g = (v) => res.find((r) => r.scen === sk && r.v === v && r.wave === a.wave && r.hero === a.hero);
      const f = (r) => r.ttd == null ? '>20s' : r.ttd.toFixed(2);
      return { wave: a.wave, hero: a.hero, hp: a.maxHp, 'dmg 0.5s %': (a.d05pct * 100).toFixed(0), 'dmg 1s %': (a.d1pct * 100).toFixed(0), 'hits A': g('A').hits.toFixed(1), 'ttd A': f(a), 'ttd B': f(g('B')), 'ttd C': f(g('C')), 'ttd D': f(g('D')), 'ttd E': f(g('E')) };
    }));
  }
  console.table(exploit());
}

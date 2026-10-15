// scripts/sim-ttk.mjs
// Kit balance simulator (node scripts/sim-ttk.mjs). Reads every number straight from
// js/hero-stats.js (the kits) and js/upgrades.js (cards + weapon tier), so it's the same data the game uses.
//
// For each hero it works out four things, then tests them in 4 scenarios at waves 10/30/60/100:
//   1. SINGLE-TARGET DPS: attack rotation + the ultimate and mobility damage averaged over their cooldowns,
//      times "uptime" (how much of the fight you can actually keep hitting: melee loses time closing in
//      after knockback, ranged heroes fire while they move).
//   2. AoE / CROWD CLEAR: how many enemies each hit lands on in a crowd (cones, chains, pierce, rings).
//   3. EFFECTIVE HP: health / (1 - armour) with blocks, Zaleks' slam shield (as hp per second), regen.
//   4. MOBILITY / ESCAPE: how much incoming damage you avoid: range (kiting), i-frames, decoys, stuns, taunt.
// Scenarios: STANDARD wave (mixed crowd), ELITE-heavy wave (fewer, much tougher bodies), BOSS (one big
// target that hits hard), each at that wave's enemy health/damage scaling and the weapon tier you'd have.
//   wave-clear time = total enemy hp / (single-target dps x crowd factor)
//   survival time   = (effective hp + 10 s of regen/shield) / (incoming dps x exposure x (1 - avoided))
// Absolute seconds are a model; what matters is that every hero lands within ~10% of Iskra (the reference kit).
import { Loadout, weaponMult, PICK_EVERY } from '../js/upgrades.js';
import { HERO_STATS, CHARACTER_ORDER as BASE_ORDER, ALL_HEROES } from '../js/hero-stats.js';
import { RULES, Z_TUNING, zHero } from '../js/rules.js';
// --z: CoreBurnZ rules (adds KAGERO, the Z per-hero tuning and the Z boss health)
const ZMODE = process.argv.includes('--z');
if (ZMODE) RULES.z = true;
const CHARACTER_ORDER = ZMODE ? ALL_HEROES : BASE_ORDER;

const hpMult = (n) => 1 + 0.14 * (n - 1);
const dmgMult = (n) => 1 + 0.07 * (n - 1);
const WAVES = [10, 30, 60, 100];
const picksBefore = (n) => Math.floor((n - 1) / PICK_EVERY);

// A typical build: universal cards first, with the hero's own cards mixed in (like a player picks)
const UNIVERSAL = ['edge', 'maxHp', 'crit', 'odDamage', 'speed', 'bkCool', 'regen', 'twin', 'odCool', 'leech', 'storm'];
const HERO_CARDS = {
  sarrow: ['shock', 'bkCharge', 'arc', 'odTime', 'odRadius', 'bkDamage', 'bkTrail', 'odLeech', 'bkRange'],
  zaleks: ['zStun', 'zShield', 'zGuard', 'zQuake', 'zHammer', 'zTaunt', 'zCharge'],
  iskra: ['iPierce', 'iHop', 'iSplit', 'iStorm', 'iDecoy', 'iVolley', 'iHopRange'],
  ninja: ['nEdge', 'nPierce', 'nMirror', 'nFan', 'nShade', 'nTwin'],
  orin: ['oDrone', 'oShell', 'oChain', 'oDroneDmg', 'oGrapple', 'oVortex', 'oShell', 'oReach', 'oDroneTime'],
};
function build(hero, picks) {
  const l = new Loadout(hero);
  const order = [];
  const H = HERO_CARDS[hero];
  for (let i = 0; i < 30; i++) { order.push(UNIVERSAL[i % UNIVERSAL.length]); if (i % 2 === 1) order.push(H[(i >> 1) % H.length]); }
  for (let i = 0; i < picks; i++) {
    const rotated = order.slice(i % order.length).concat(order);
    l.apply(rotated.find((x) => l.def(x) && l.level(x) < l.def(x).max) || 'patch');
  }
  return l;
}

// Scenario crowd sizes: how many enemies are near your hits (standard crowd, elite-heavy, boss)
const SCEN = {
  standard: { crowd: 1, incoming: 10, label: 'standard' },
  elite: { crowd: 0.55, incoming: 15, label: 'elite-heavy' },
  boss: { crowd: 0, incoming: 13, label: 'boss' },
};

// ---------- the kit model ----------
function kit(id, l, scen) {
  const c = HERO_STATS[id], s = l.stats;
  const crowd = SCEN[scen].crowd;
  const aoe = (n) => 1 + (n - 1) * crowd; // n targets in a full crowd -> 1 against a boss
  let heal = 0, st = 0, clear = 0, ult = 0, ultClear = 0, mob = 0, uptime = 1, exposure = 1, ehpMult = 1, shieldPs = 0, avoid = 0;
  const ultCd = c.ultCd * s.spinCd, mobCd = (c.dashCd || 1) * s.dashCd;
  const charges = c.dashCharges + s.dashCharges - 1;
  switch (id) {
    case 'sarrow': {
      const cb = c.combo, cycle = 0.6 * (cb[0].duration + cb[1].duration) + cb[2].duration;
      st = (cb[0].damage + cb[1].damage + cb[2].damage) / cycle * s.arcDmg;
      const shock = s.shock ? (0.24 + 0.07 * s.shock) * cb[2].damage / cycle * 3 * crowd : 0;
      clear = st * aoe(1.9 + 0.08 * s.arcLevel) + shock;
      const spin = (c.spinTime + s.spinTime) / c.spinTick * c.spinHit * s.spinDmg;
      ult = spin / ultCd; ultClear = ult * aoe(3.2 * s.spinRadius);
      mob = c.dashDmg * s.dashDmg / mobCd * 0.25 + (s.trail ? (4 + 3 * s.trail) / 0.3 * 0.15 : 0);
      heal = Math.min(10, s.spinLeech / c.spinTick * aoe(3.2)) * (c.spinTime + s.spinTime) / ultCd; // Overdrive Siphon
      uptime = 0.74;
      exposure = 1;
      avoid = 0.1 * crowd + // knockback (finisher, overdrive) keeps the crowd off you
         0.2 * (c.dashTime * s.dashTime) / mobCd * charges * 2.6 + 0.5 * (c.spinTime + s.spinTime) / ultCd; // blink i-frames + overdrive half damage
      break;
    }
    case 'zaleks': {
      const cb = c.combo, cycle = 0.6 * cb[0].duration + cb[1].duration;
      st = (cb[0].damage + cb[1].damage) / cycle * s.bashDmg;
      clear = st * aoe(2.3 * s.bash);
      ult = c.slamDmg * s.spinDmg * s.slamDmg / ultCd; ultClear = ult * aoe(5.5 * s.slamRadius);
      mob = c.dashDmg * s.chargeDmg / mobCd * 0.6;
      uptime = 0.66; // slow walker, knocks things far away
      exposure = 1;
      ehpMult = 1 / (1 - c.armor) / (1 - (c.block + s.block) * 0.45); // blocks frontal hits while swinging (~45% of incoming)
      shieldPs = c.shieldPct * s.shield / ultCd; // x max hp per second
      const stunned = ((c.chargeStun + s.chargeStun) * 2 / mobCd + c.slamStun * 4 / ultCd) * (scen === 'boss' ? 0 : 0.25);
      avoid = stunned;
      break;
    }
    case 'iskra': {
      const nd = c.needle;
      st = nd.damage / nd.rate * 0.88; // most needles land
      const pierce = 1 + 0.55 * (nd.pierce + s.pierce) * crowd; // each extra body a needle passes through
      const split = 2 * s.split * 0.2 * (0.35 + 0.45 * crowd);
      clear = nd.damage / nd.rate * 0.88 * (pierce + split);
      st *= 1 + split * (scen === 'boss' ? 1 : 0);
      const vol = (c.stormTime + s.stormTime) / c.stormRate, per = c.stormCount + s.stormCount;
      ult = vol * c.stormDmg * s.spinDmg * Math.min(per, 2.2) / ultCd;
      ultClear = vol * c.stormDmg * s.spinDmg * per * 0.6 * (1 + crowd) / ultCd;
      uptime = 0.97;   // v1.11 recalibrated from playtests: she fires on the move almost all the time
      exposure = 0.5;  // ...and kiting keeps most of the crowd off her (was 0.62, under-rated her)
      const decoy = Math.min(0.5, (c.decoyTime + s.decoy) * charges / (mobCd * charges + 1) * 0.35) * (scen === 'boss' ? 0 : 1); // bosses ignore decoys
      avoid = decoy + c.hopGuard / mobCd * charges;
      break;
    }
    case 'orin': {
      const b = c.beam;
      st = b.damage / b.tick;
      const chains = (b.chains + s.chains) * b.chainPct * 0.85 * crowd;
      clear = st * (1 + chains) * s.reach ** 0.3;
      const drones = (c.drones + s.drones) * (c.droneTime + s.droneTime) / c.droneRate * c.droneDmg * s.droneDmg * s.spinDmg * 0.8;
      const vort = c.vortexTime / c.vortexTick * c.vortexDmg * s.spinDmg;
      ult = (drones + vort) / ultCd; ultClear = (drones + vort * aoe(5 * s.vortex)) / ultCd;
      mob = c.grappleDmg * (1 + 0.25 * s.grapple) / mobCd * 0.5;
      uptime = 0.84;
      exposure = 0.85;
      ehpMult = 1 / (1 - s.shell * Math.min(1, (c.droneTime + s.droneTime) / ultCd));
      avoid = (scen === 'boss' ? 0.05 : 0.1 + 0.03 * s.grapple + 0.56 * Math.min(0.5, c.beam.lock) * (0.4 + 0.6 * crowd)) + 0.06; // pinned (tether) / yanked enemies, grapple escapes
      break;
    }
    case 'ninja': {
      const nd = c.needle;
      st = nd.damage / nd.rate * 0.85;
      const pierce = 1 + 0.55 * (nd.pierce + s.starPierce) * crowd;
      const fan = 2 * s.starFan * 0.3 * (0.3 + 0.5 * crowd);
      clear = st * (pierce + fan);
      st *= 1 + fan * (scen === 'boss' ? 0.5 : 0);
      const cloneUp = Math.min(1, (c.cloneTime + s.cloneTime) / ultCd);
      ult = st * (c.clonePct + s.cloneDmg) * cloneUp * s.spinDmg; ultClear = clear * (c.clonePct + s.cloneDmg) * cloneUp * s.spinDmg;
      mob = c.stepDmg * s.stepDmg / mobCd * charges * aoe(2.2);
      uptime = 0.9;
      exposure = 0.62;
      avoid = (c.stepGuard + 0.15) / mobCd * charges + 0.1 * cloneUp * (scen === 'boss' ? 0.3 : 1); // step i-frames, the clone draws some aggro
      break;
    }
  }
  const tierDmg = s.dmg * this_perk(s) * c.dmg * zHero(id).dmg;
  const dpsST = (st * uptime + ult + mob) * tierDmg;
  const dpsClear = (clear * uptime + ultClear + mob) * tierDmg;
  const maxHp = Math.round(c.hp * zHero(id).hp * (1 + s.maxHpPct)) + s.maxHpFlat;
  const regen = 3.2 * s.regen + Math.min(6, s.leech * 4) * 0.5 + heal;
  const mobility = (c.speed * (zHero(id).speed || 1) * s.speed) / HERO_STATS.sarrow.speed;
  return { dpsST, dpsClear, maxHp, ehp: maxHp * ehpMult, shieldPs: shieldPs * maxHp, regen, exposure, avoid: 0.55 * (1 - Math.exp(-avoid / 0.55)), mobility }; // dodges have diminishing returns
}
function this_perk(s) { return (1 + 0.8 * s.crit) * (1 + s.twin * 0.8); }

// --z: CoreBurnZ bosses have +15.5% hp (x1.1 x1.05), and 5 of the 12 rotation slots are the Grindchoir bosses
// (avg base hp 720 vs the 650 classic yardstick). Applies equally to every hero.
const Z_BOSS = ZMODE ? Z_TUNING.bossHp * (7 / 12 + (5 / 12) * (720 / 650)) : 1;
function scenario(id, n, scen) {
  const l = build(id, picksBefore(n));
  const k = kit(id, l, scen);
  const hm = hpMult(n);
  // enemy hp: standard wave = (4 + 2n) bodies, capped crowd of 14 alive; elite-heavy = 45% elites (x2.2 hp);
  const bodies = Math.min(4 + 2 * n, 60);
  const hp = scen === 'boss' ? 650 * (1 + 0.45 * (Math.floor(n / 10) - 1 + 1)) * hm / (1 + 0.14 * 9) * Z_BOSS
    : bodies * 32 * hm * (scen === 'elite' ? (0.55 + 0.45 * 2.2) * 0.75 : 1);
  const clearTime = hp / (scen === 'boss' ? k.dpsST : k.dpsClear);
  const incoming = SCEN[scen].incoming * dmgMult(n) * k.exposure * (1 - k.avoid) / (k.mobility ** 0.5);
  // regen and Zaleks' shield count as extra health over a 10 s window of pressure
  const survive = (k.ehp + (k.regen + k.shieldPs) * 10) / incoming;
  return { clearTime, survive, k };
}

console.log('\nCOREBURN kit balance: wave-clear time (lower = faster) and survival time (higher = tankier)');
console.log('Typical build per hero at that wave (universal + hero cards), weapon tier = picks so far.\n');
const pct = (v, avg) => ((v / avg - 1) * 100).toFixed(1).padStart(5) + '%';
let worst = 0;
const REF = process.argv.includes('--avg') ? null : 'iskra'; // --avg: compare against the 4-hero average instead
const summary = [];
const dev = Object.fromEntries(CHARACTER_ORDER.map((id) => [id, { c: [], s: [] }]));
for (const scen of Object.keys(SCEN)) {
  for (const n of WAVES) {
    const r = Object.fromEntries(CHARACTER_ORDER.map((id) => [id, scenario(id, n, scen)]));
    // v1.11: the yardstick is Iskra (the strongest kit in play); everyone is tuned up to her level
    const avgC = REF ? r[REF].clearTime : CHARACTER_ORDER.reduce((a, id) => a + r[id].clearTime, 0) / CHARACTER_ORDER.length;
    const avgS = REF ? r[REF].survive : CHARACTER_ORDER.reduce((a, id) => a + r[id].survive, 0) / CHARACTER_ORDER.length;
    const row = { scenario: `${SCEN[scen].label} w${n}` };
    for (const id of CHARACTER_ORDER) {
      row[`${id} clear`] = `${r[id].clearTime.toFixed(1)}s (${pct(r[id].clearTime, avgC)})`;
      row[`${id} survive`] = `${r[id].survive.toFixed(1)}s (${pct(r[id].survive, avgS)})`;
      dev[id].c.push(r[id].clearTime / avgC - 1); dev[id].s.push(r[id].survive / avgS - 1);
      worst = Math.max(worst, Math.abs(r[id].clearTime / avgC - 1), Math.abs(r[id].survive / avgS - 1));
    }
    summary.push(row);
  }
}
if (process.argv.includes('--brief')) {
  for (const id of CHARACTER_ORDER) console.log(id.padEnd(7), 'clear', dev[id].c.map((x) => (x * 100).toFixed(0)).join(' '), ' | surv', dev[id].s.map((x) => (x * 100).toFixed(0)).join(' '));
  console.log('worst', (worst * 100).toFixed(1));
  process.exit(0);
}
console.table(summary);

console.log('\nKit profile at wave 30 (typical build, standard crowd):');
console.table(CHARACTER_ORDER.map((id) => {
  const { k } = scenario(id, 30, 'standard');
  const kb = scenario(id, 30, 'boss').k;
  return { hero: id, 'single-target dps': kb.dpsST.toFixed(0), 'crowd dps': k.dpsClear.toFixed(0), 'max hp': k.maxHp, 'effective hp': k.ehp.toFixed(0),
    'exposure': k.exposure.toFixed(2), 'avoided': (k.avoid * 100).toFixed(0) + '%', 'move x': k.mobility.toFixed(2) };
}));
console.log(`\nWorst deviation from the average, any hero / scenario / wave: ${(worst * 100).toFixed(1)}% (target <= 10%) vs ${REF || 'the average'}`);
if (process.argv.includes('--check') && worst > 0.1) process.exit(1);

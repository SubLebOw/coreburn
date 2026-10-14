// hero-stats.js
// The heroes' numbers and kits (no Three.js here, so the balance simulator can use them).
// All 4 heroes share the same 3 input slots: ATTACK (J / click / left button),
// MOBILITY (K / Space / middle button) and ULTIMATE (L / top button), but each hero's kit is
// different. Every number the game uses for a kit lives here; scripts/sim-ttk.mjs balances them.
// `abilities` = what the select screen, the HUD buttons and the upgrade cards call each slot.
export const HERO_STATS = {
  // SARROW: melee duelist. Talon combo, untouchable Blink, Overdrive spin (half damage taken).
  sarrow: {
    id: 'sarrow', name: 'SARROW', title: 'Talon fighter', tag: 'DUELIST', color: 0x3ff6e0, blade: 0x7ffff2,
    blurb: 'Gets in close, chains a 3-hit talon combo and blinks out of trouble.',
    hp: 135, speed: 7, dmg: 0.8, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Talon Combo', short: 'SLASH', icon: '✦', desc: '3-hit combo, the 3rd hit is a heavy finisher' },
      mobility: { name: 'Blink', short: 'BLINK', icon: '➹', desc: 'Untouchable dash that cuts through enemies' },
      ultimate: { name: 'Overdrive', short: 'OVER<br>DRIVE', icon: '⟲', desc: 'Whirlwind spin, half damage taken' },
    },
    combo: [
      { damage: 12, knockback: 6, range: 2.4, duration: 0.24 },
      { damage: 12, knockback: 6, range: 2.4, duration: 0.24 },
      { damage: 28, knockback: 14, range: 2.9, duration: 0.40 },
    ],
    dashSpeed: 24, dashTime: 0.2, dashCd: 0.9, dashCharges: 1, dashDmg: 10, dashKnock: 7, dashWidth: 1.3,
    ultCd: 8, spinTime: 1.6, spinRadius: 1, spinDmg: 1, spinKnock: 7, spinTick: 0.15, spinHit: 9.5, spinGuard: 0.5,
  },
  // ZALEKS: tank. Slow shield-bash/hammer combo that blocks from the front, a stunning Shoulder
  // Charge, and a Seismic Slam that taunts everything nearby and gives him a temporary shield.
  zaleks: {
    id: 'zaleks', name: 'ZALEKS', title: 'Plated bruiser', tag: 'TANK', color: 0xffa030, blade: 0xffc060,
    blurb: 'Soaks the hits: blocks from the front while swinging, stuns with charges and pulls aggro.',
    hp: 145, speed: 5.9, dmg: 1.16, atkSpeed: 1, armor: 0, // (armor = flat % damage reduction; his toughness comes from block + shield instead)
    abilities: {
      attack: { name: 'Shield Bash', short: 'BASH', icon: '⛊', desc: 'Bash + hammer-fist, huge knockback, blocks 40% from the front' },
      mobility: { name: 'Shoulder Charge', short: 'CHARGE', icon: '⇛', desc: 'Charge that stuns what it hits (stops at walls)' },
      ultimate: { name: 'Seismic Slam', short: 'SEISMIC<br>SLAM', icon: '✺', desc: 'Big AoE slam, taunts enemies to you, gives a shield' },
    },
    combo: [
      { damage: 24, knockback: 11, range: 2.6, duration: 0.45, arc: 0.1 },
      { damage: 32, knockback: 18, range: 2.9, duration: 0.62, arc: 0.2 },
    ],
    block: 0.4,
    dashSpeed: 17, dashTime: 0.36, dashCd: 4.5, dashCharges: 1, dashDmg: 16, dashKnock: 9, dashWidth: 1.5, chargeStun: 1, chargeGuard: 0.5,
    ultCd: 12, slamRadius: 5.5, slamDmg: 55, slamKnock: 14, slamStun: 0.8, tauntTime: 5, tauntRadius: 13, shieldPct: 0.2, shieldTime: 5,
  },
  // ISKRA: ranged kiter. Auto-aimed needles while she moves, Phase Hop (2 charges, leaves a
  // decoy enemies chase), and Needle Storm. Fragile but very mobile.
  iskra: {
    id: 'iskra', name: 'ISKRA', title: 'Needle skirmisher', tag: 'KITER', color: 0xc070ff, blade: 0xe8a0ff,
    blurb: 'Keep moving: needles auto-aim at whatever you run towards. Fragile, very fast.',
    hp: 70, speed: 7.9, dmg: 0.88, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Needles', short: 'NEEDLE', icon: '➶', desc: 'Rapid needles that aim at the nearest enemy you move towards' },
      mobility: { name: 'Phase Hop', short: 'PHASE<br>HOP', icon: '⇉', desc: 'Short teleport, 2 charges, leaves a decoy that enemies chase' },
      ultimate: { name: 'Needle Storm', short: 'NEEDLE<br>STORM', icon: '⁂', desc: 'Fan barrage of needles for a few seconds' },
    },
    needle: { damage: 7.5, rate: 0.14, speed: 30, range: 15, pierce: 1, aimRange: 13, moveWhileFiring: 0.85 },
    dashCd: 3.2, dashCharges: 2, hopDist: 5.5, hopGuard: 0.15, decoyTime: 3, decoyHits: 4, decoyRadius: 10,
    ultCd: 11, stormTime: 3.5, stormRate: 0.22, stormCount: 5, stormDmg: 5, stormSpread: 0.5,
  },
  // ORIN (secret, wave 50): control / summoner. A chaining arc tether, a Magnet Grapple that yanks
  // enemies in (or pulls him to a pillar / big target), and the Hymn Engine: a vortex + 2 scrap drones.
  orin: {
    id: 'orin', name: 'ORIN', title: 'Rogue choir-unit', tag: 'CONTROL', color: 0xff4a5a, blade: 0xff9a8a, secret: true,
    blurb: 'Controls the fight: a chaining arc beam, a magnet grapple, and drones that fight for him.',
    unlockHint: 'Reach wave 50 to unlock',
    hp: 125, speed: 6.6, dmg: 1.08, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Arc Tether', short: 'TETHER', icon: 'ϟ', desc: 'Short beam that pins an enemy in place and chains to 2 more' },
      mobility: { name: 'Magnet Grapple', short: 'GRAPPLE', icon: '⊸', desc: 'Yank an enemy in (stunned), or pull yourself to a pillar or boss' },
      ultimate: { name: 'Hymn Engine', short: 'HYMN<br>ENGINE', icon: '❂', desc: 'Vortex that drags enemies in + 2 scrap drones for 10s' },
    },
    beam: { damage: 8, tick: 0.2, lock: 0.5, range: 5.5, chains: 2, chainRange: 4, chainPct: 0.65, moveWhileFiring: 0.7 },
    dashCd: 3.5, dashCharges: 1, grappleRange: 9, grappleDmg: 14, grappleStun: 0.7, grappleSpeed: 26, reelDist: 5,
    ultCd: 14, vortexTime: 3, vortexRadius: 6, vortexDmg: 4, vortexTick: 0.25, drones: 2, droneTime: 10, droneDmg: 6, droneRate: 0.6, droneRange: 9,
  },
};
export const CHARACTER_ORDER = ['sarrow', 'zaleks', 'iskra', 'orin'];

// The old one-line budget (DPS x HP x mobility) is replaced by the kit simulator:
// scripts/sim-ttk.mjs (wave-clear time + survival time per hero, per scenario).
export function characterBudget(c) {
  return { dps: c.dmg * c.atkSpeed, hp: c.hp, mobility: c.speed / HERO_STATS.sarrow.speed, budget: c.dmg * c.hp * c.speed };
}

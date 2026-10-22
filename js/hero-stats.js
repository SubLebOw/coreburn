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
    hp: 180, speed: 7, dmg: 0.8, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Talon Combo', short: 'SLASH', icon: '✦', desc: '3-hit combo, the 3rd hit is a heavy finisher', zdesc: '3-hit combo that stacks BLEED; landed swings build FLOW (faster attacks + moves, lost when hit). The 3rd hit throws a piercing BLADE WAVE' },
      mobility: { name: 'Blink', short: 'BLINK', icon: '➹', desc: 'Untouchable dash that cuts through enemies', zdesc: 'Untouchable dash: cutting through a bleeding enemy BURSTS its bleed' },
      ultimate: { name: 'Overdrive', short: 'OVER<br>DRIVE', icon: '⟲', desc: 'Whirlwind spin, half damage taken', zdesc: 'Whirlwind spin, half damage taken. Kills during it give you a Blink back' },
    },
    combo: [
      { damage: 12, knockback: 6, range: 2.4, duration: 0.24 },
      { damage: 12, knockback: 6, range: 2.4, duration: 0.24 },
      { damage: 28, knockback: 14, range: 2.9, duration: 0.40 },
    ],
    dashSpeed: 24, dashTime: 0.2, dashCd: 0.9, dashCharges: 1, dashDmg: 10, dashKnock: 7, dashWidth: 1.3,
    ultCd: 8, spinTime: 1.6, spinRadius: 1, spinDmg: 1, spinKnock: 7, spinTick: 0.15, spinHit: 11, spinGuard: 0.5,
  },
  // ZALEKS: tank. Slow shield-bash/hammer combo that blocks from the front, a stunning Shoulder
  // Charge, and a Seismic Slam that taunts everything nearby and gives him a temporary shield.
  zaleks: {
    id: 'zaleks', name: 'ZALEKS', title: 'Plated bruiser', tag: 'TANK', color: 0xffa030, blade: 0xffc060,
    blurb: 'Soaks the hits: blocks from the front while swinging, stuns with charges and pulls aggro.',
    hp: 219, speed: 6.2, dmg: 1.18, atkSpeed: 1, armor: 0, // v1.15: +15% hp, +5% speed (both modes). (armor = flat % damage reduction; his toughness comes from block + shield instead)
    abilities: {
      attack: { name: 'Shield Bash', short: 'BASH', icon: '⛊', desc: 'Bash + hammer-fist, huge knockback, blocks 40% from the front' },
      mobility: { name: 'Shoulder Charge', short: 'CHARGE', icon: '⇛', desc: 'Charge that stuns what it hits (stops at walls)', zdesc: 'Charge that CARRIES enemies with you, then slams them down stunned' },
      ultimate: { name: 'Seismic Slam', short: 'SEISMIC<br>SLAM', icon: '✺', desc: 'Big AoE slam, taunts enemies to you, gives a shield', zdesc: 'Big AoE slam, taunt + shield. Taking hits fills RAGE: at full Rage it becomes a huge stunning QUAKE' },
    },
    combo: [
      { damage: 24, knockback: 11, range: 2.6, duration: 0.45, arc: 0.1 },
      { damage: 32, knockback: 18, range: 2.9, duration: 0.62, arc: 0.2 },
    ],
    block: 0.4,
    dashSpeed: 17, dashTime: 0.36, dashCd: 4.5, dashCharges: 1, dashDmg: 16, dashKnock: 9, dashWidth: 1.5, chargeStun: 1, chargeGuard: 0.5,
    ultCd: 12, slamRadius: 5.5, slamDmg: 60, slamKnock: 14, slamStun: 0.8, tauntTime: 5, tauntRadius: 13, shieldPct: 0.2, shieldTime: 5,
  },
  // ISKRA: ranged kiter. Auto-aimed needles while she moves, Phase Hop (2 charges, leaves a
  // decoy enemies chase), and Needle Storm. Fragile but very mobile.
  iskra: {
    id: 'iskra', name: 'ISKRA', title: 'Needle skirmisher', tag: 'KITER', color: 0xc070ff, blade: 0xe8a0ff,
    blurb: 'Keep moving: needles auto-aim at whatever you run towards. Fragile, very fast.',
    hp: 70, speed: 7.9, dmg: 0.88, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Needles', short: 'NEEDLE', icon: '➶', desc: 'Rapid needles that aim at the nearest enemy you move towards' },
      mobility: { name: 'Phase Hop', short: 'PHASE<br>HOP', icon: '⇉', desc: 'Short teleport, 2 charges, leaves a decoy that enemies chase', zdesc: 'Short teleport, 2 charges, leaves a decoy and 2 NEEDLE MINES (Needle Storm detonates them all)' },
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
    unlockHint: 'Reach wave 50',
    hp: 165, speed: 6.6, dmg: 1.08, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Arc Tether', short: 'TETHER', icon: 'ϟ', desc: 'Short beam that pins an enemy in place and chains to 2 more' },
      mobility: { name: 'Magnet Grapple', short: 'GRAPPLE', icon: '⊸', desc: 'Yank an enemy in (stunned), or pull yourself to a pillar or boss', z: { name: 'Gravity Well', short: 'GRAVITY<br>WELL', icon: '◎', desc: 'Throw a well at the biggest crowd: pulls enemies in for 2s (bosses slowed). Tether +30% to enemies inside' } },
      ultimate: { name: 'Hymn Engine', short: 'HYMN<br>ENGINE', icon: '❂', desc: 'Vortex that drags enemies in + 2 scrap drones for 10s' },
    },
    beam: { damage: 8, tick: 0.2, lock: 0.5, range: 5.5, chains: 2, chainRange: 4, chainPct: 0.8, moveWhileFiring: 0.7 },
    dashCd: 3.5, dashCharges: 1, grappleRange: 9, grappleDmg: 14, grappleStun: 0.7, grappleSpeed: 26, reelDist: 5,
    ultCd: 14, vortexTime: 3, vortexRadius: 6, vortexDmg: 4, vortexTick: 0.25, drones: 2, droneTime: 10, droneDmg: 6, droneRate: 0.6, droneRange: 9,
  },
  // KAGERO (CoreBurnZ only): ninja. Auto-aimed shurikens, Shadow Step (teleport behind / through
  // enemies, cutting everything on the way), and Shadow Clone: a shade that copies his throws and steps.
  ninja: {
    id: 'ninja', name: 'KAGERO', title: 'Shadow ninja', tag: 'NINJA', color: 0x8a7aff, blade: 0xc8c0ff, zOnly: true,
    blurb: 'Throws shurikens on the move, steps behind enemies, and fights beside his shadow clone.',
    hp: 120, speed: 7.5, dmg: 0.8, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Shurikens', short: 'STAR', icon: '✴', desc: 'Stars ricochet to 2 more enemies and MARK what they hit. Every 4th throw is a wide finisher fan' },
      mobility: { name: 'Shadow Step', short: 'SHADOW<br>STEP', icon: '◐', desc: 'Long-range teleport to the nearest MARKED enemy: consumes the mark for bonus damage and half your cooldown back' },
      ultimate: { name: 'Shadow Clone', short: 'SHADOW<br>CLONE', icon: '♊', desc: 'A 5s shadow clone copies all your moves and upgrades at 45% damage' },
    },
    needle: { damage: 9, rate: 0.2, speed: 26, range: 14, pierce: 0, bounce: 2, bounceFall: 0.8, aimRange: 13, moveWhileFiring: 0.9 },
    finisherEvery: 4, markTime: 4, markBonus: 0.8, markRefund: 0.5, markRefundCd: 1.2,
    dashCd: 2.6, dashCharges: 1, stepRange: 11.2, stepDist: 5, stepDmg: 22, stepGuard: 0.3,
    ultCd: 13, cloneTime: 5, clonePct: 0.45, // v1.15: 5s clone that copies every upgrade at 45% damage
  },
  // AXIOM (CoreBurnZ only, v1.28): swarm commander. Red pulse bolts + a growing army of drones that fire with him.
  axiom: {
    id: 'axiom', name: 'AXIOM', title: 'The Machine Mind', tag: 'SWARM', color: 0xff2a3a, blade: 0xff5a5a, zOnly: true,
    blurb: 'A machine overlord: every bolt he fires, his growing drone army fires too.',
    hp: 140, speed: 6.9, dmg: 1, atkSpeed: 1, armor: 0,
    abilities: {
      attack: { name: 'Pulse Command', short: 'PULSE', icon: '◉', desc: 'A red bolt every 0.55s, and every drone fires a 25% bolt with it' },
      mobility: { name: 'Reforge', short: 'REFORGE', icon: '⚙', desc: 'Drones shield you (-60% damage) for 0.75s while you build a drone (or overclock them +35% for 5s at max). Kills cut the cooldown' },
      ultimate: { name: 'Ascension Protocol', short: 'ASCEND', icon: '⟁', desc: '10s: levitate, drones spread into wings, +75% drone fire rate, +1 pierce, up to 2 extra drones that explode at the end' },
    },
    needle: { damage: 16, rate: 0.55, speed: 30, range: 14, pierce: 0, aimRange: 13, moveWhileFiring: 0.85 },
    droneDmg: 0.25, droneRate: 0.55, droneRange: 11, startDrones: 1, droneCap: 6, // v1.28.1: 1 drone to start (2 with Network Efficiency)
    dashCd: 12, dashCharges: 1, barrier: 0.75, barrierCut: 0.6, overclock: 5, overclockRate: 0.35, killRefund: 0.3, refundCap: 3, refundEarly: 1,
    ultCd: 22, ascendTime: 10, ascendRate: 0.75, ascendTemp: 2,
  },
};
export const CHARACTER_ORDER = ['sarrow', 'zaleks', 'iskra', 'orin'];
// CoreBurnZ adds the ninja; classic keeps the original 4
export const Z_HEROES = ['ninja', 'axiom'];
export const ALL_HEROES = [...CHARACTER_ORDER, ...Z_HEROES];
export const heroOrder = (z) => (z ? ALL_HEROES : CHARACTER_ORDER);

// The old one-line budget (DPS x HP x mobility) is replaced by the kit simulator:
// scripts/sim-ttk.mjs (wave-clear time + survival time per hero, per scenario).
export function characterBudget(c) {
  return { dps: c.dmg * c.atkSpeed, hp: c.hp, mobility: c.speed / HERO_STATS.sarrow.speed, budget: c.dmg * c.hp * c.speed };
}

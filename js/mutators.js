// mutators.js
// MUTATOR WAVES: from wave 7, every 4th regular wave (7, 11, 19, 23, ...; never a boss wave) gets a
// random twist, announced with a big banner. Clearing one is worth +10 scrap.
// Each mutator only changes numbers the wave manager already uses, so they work in solo and co-op.

export const MUTATORS = {
  swift:    { name: 'OVERCLOCKED', desc: 'Enemies move 35% faster, but have 15% less health', color: '#7ad8ff', speed: 1.35, hp: 0.85 },
  swarm:    { name: 'SWARM', desc: '60% more enemies, each one weaker', color: '#c8ff3a', count: 1.6, hp: 0.65 },
  glass:    { name: 'GLASS ARENA', desc: 'Enemies hit 50% harder but have 40% less health', color: '#ff6a8a', hp: 0.6, dmg: 1.5 },
  elite:    { name: 'GILDED HOST', desc: 'Far more elites (amber crowns)', color: '#ffb020', elite: 0.35 },
  volatile: { name: 'VOLATILE', desc: 'Enemies burst when they die: blink away!', color: '#ff8a1e', burst: true },
  bounty:   { name: 'BOUNTY', desc: 'Double score this wave', color: '#ffe04a', score: 2 },
};
export const MUTATOR_IDS = Object.keys(MUTATORS);

export const isMutatorWave = (n) => n >= 7 && n % 4 === 3 && n % 5 !== 0;

// rng lets the daily challenge use a seeded pick; normal runs use Math.random
export function rollMutator(rng = Math.random) {
  return MUTATOR_IDS[Math.floor(rng() * MUTATOR_IDS.length)];
}

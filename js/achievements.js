// achievements.js
// MILESTONES: long-term goals that unlock rewards (scrap, milestone-only cosmetics, and the secret hero).
// Progress is saved on this device in the meta save (meta.js). Checked at natural moments: wave start,
// boss kills, combo callouts, close calls and game over. Each one pays out once.
//
// stats used (meta.data.stats): kills, bestWave, bestCombo, bosses[] (boss ids beaten), goldens,
// closeCalls, mutators, heroWave10[] (heroes that reached wave 10), coopRuns, revives, dailies, rushes
import { HERO_STATS } from './hero-stats.js?v=1.33.0';
export const ACHIEVEMENTS = [
  { id: 'kills100', name: 'Scrapper', desc: 'Defeat 100 enemies (total)', goal: (s) => [s.kills, 100], reward: { scrap: 50 } },
  { id: 'kills2500', name: 'Choir Breaker', desc: 'Defeat 2,500 enemies (total)', goal: (s) => [s.kills, 2500], reward: { scrap: 250 } },
  { id: 'wave10', name: 'Warmed Up', desc: 'Reach wave 10', goal: (s) => [s.bestWave, 10], reward: { scrap: 50 } },
  { id: 'wave25', name: 'Veteran', desc: 'Reach wave 25', goal: (s) => [s.bestWave, 25], reward: { item: ['skin', 'veteran'] } },
  { id: 'wave50', name: 'The Silent Unit', desc: 'Reach wave 50', goal: (s) => [s.bestWave, 50], reward: { hero: 'orin' } },
  { id: 'boss1', name: 'Bell Ringer', desc: 'Defeat a boss', goal: (s) => [s.bosses.length, 1], reward: { scrap: 40 } },
  { id: 'allBosses', name: 'Hymnbreaker', desc: 'Defeat all 7 different bosses', goal: (s) => [s.bosses.length, 7], reward: { item: ['talon', 'hymn'] } },
  { id: 'combo100', name: 'Unstoppable', desc: 'Reach a 100 combo', goal: (s) => [s.bestCombo, 100], reward: { scrap: 75 } },
  { id: 'combo400', name: 'COREBURN!', desc: 'Reach a 400 combo', goal: (s) => [s.bestCombo, 400], reward: { item: ['skin', 'inferno'] } },
  { id: 'golden', name: 'Midas Touch', desc: 'Defeat a golden boss', goal: (s) => [s.goldens, 1], reward: { scrap: 100 } },
  { id: 'closeCalls', name: 'Hair\'s Breadth', desc: 'Get 10 CLOSE CALLs (total)', goal: (s) => [s.closeCalls, 10], reward: { scrap: 60 } },
  { id: 'mutators', name: 'Adaptable', desc: 'Clear 5 mutator waves (total)', goal: (s) => [s.mutators, 5], reward: { scrap: 60 } },
  { id: 'cursed', name: 'Bad Deal', desc: 'Take 3 cursed cards in one run', goal: (s, live) => [live.cursed || 0, 3], live: true, reward: { item: ['talon', 'hex'] } },
  { id: 'heroes', name: 'Polymath', desc: 'Reach wave 10 with 3 different heroes (each plays differently!)', goal: (s) => [new Set(s.heroWave10).size, 3], reward: { scrap: 120 } },
  { id: 'coop', name: 'Squad Up', desc: 'Finish a co-op run', goal: (s) => [s.coopRuns, 1], reward: { scrap: 50 } },
  { id: 'revive', name: 'Medic', desc: 'Revive a teammate in co-op', goal: (s) => [s.revives, 1], reward: { scrap: 50 } },
  { id: 'daily', name: 'Daily Grind', desc: 'Play a daily challenge', goal: (s) => [s.dailies, 1], reward: { scrap: 40 } },
  { id: 'rush', name: 'Rush Hour', desc: 'Clear the weekly boss rush (all 7)', goal: (s) => [s.rushClears || 0, 1], reward: { scrap: 150 } },
];

export function defaultStats() {
  return { zBosses: [], heroBest: {}, zKills: 0, runs: 0, kills: 0, bestWave: 0, bestCombo: 0, bosses: [], goldens: 0, closeCalls: 0, mutators: 0, heroWave10: [], coopRuns: 0, revives: 0, dailies: 0, rushes: 0, rushClears: 0 };
}

// Returns the milestones that were just completed (and pays their rewards)
export function checkAchievements(meta, live = {}) {
  const s = meta.data.stats, done = [];
  for (const a of ACHIEVEMENTS) {
    if (meta.data.ach[a.id]) continue;
    const [cur, target] = a.goal(s, live);
    if (cur < target) continue;
    meta.data.ach[a.id] = Date.now();
    const r = a.reward;
    if (r.scrap) meta.addScrap(r.scrap);
    if (r.item) meta.grant(r.item[1]);
    if (r.hero) meta.data.unlocked[r.hero] = true;
    done.push(a);
  }
  if (done.length) meta.save();
  return done;
}

export function rewardText(a, meta) {
  const r = a.reward;
  if (r.scrap) return `+${r.scrap} scrap`;
  if (r.hero === 'axiom') return 'EXPERT HERO UNLOCKED';
  if (r.hero) return `${r.hero === 'orin' ? 'SECRET ' : ''}HERO UNLOCKED: ${HERO_STATS[r.hero]?.name || r.hero}`;
  const it = meta.item(r.item[0], r.item[1]);
  return `${it ? it.name : r.item[1]} ${r.item[0] === 'skin' ? 'skin' : 'talons'} unlocked`;
}

// modes.js
// Run modes besides the normal endless run:
//   * DAILY CHALLENGE: everyone in the world gets the same seeded run each UTC day: same enemy mix
//     every wave, same elites, same mutator waves, same upgrade cards offered, and the same starting
//     card. No shop perks and no golden bosses, so it's fair. Its own daily leaderboard.
//   * WEEKLY BOSS RUSH: all 7 bosses back to back (in a seeded order that changes every week), an
//     upgrade pick after each one (weapon tiers matched to where you'd be in a normal run).
//     Ranked by bosses beaten, then fastest time. Its own weekly leaderboard.
// No Three.js here (pure logic, easy to test).

// Small, fast seeded random generator (mulberry32) from a text seed
export function rngFor(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// '2026-10-14' (UTC, so the whole world shares one daily)
export function dailyKey(d = new Date()) { return d.toISOString().slice(0, 10); }

// ISO week, e.g. '2026-W42' (UTC; a new boss rush every Monday 00:00 UTC)
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const week = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

// The weekly boss order: a seeded shuffle of the 7 bosses (rotation indexes 0..6)
// (CoreBurnZ: pool = 12, a different seed, and the first 7 of the shuffle are this week's bosses)
export function rushOrder(week = weekKey(), pool = 7) {
  const rng = rngFor(pool === 7 ? 'rush:' + week : `rush:z:${week}`);
  const order = Array.from({ length: pool }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order.slice(0, 7);
}
export const RUSH_BOSSES = 7;
// Weapon tier you'd normally have going into boss k (wave 5k): picks at waves 2,4,... before it
export const rushTierBefore = (k) => Math.floor((5 * k - 1) / 2);

// Boss rush score: one sortable number (more bosses first, then faster). time in seconds.
export const rushScore = (bosses, time) => bosses * 1e6 - Math.min(999999, Math.round(time * 10));
export function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
export function rushLabel(score) {
  const bosses = Math.floor((score + 999999) / 1e6);
  const time = (bosses * 1e6 - score) / 10;
  return `${bosses}/7 · ${formatTime(time)}`;
}

// The daily's starting card (everyone gets the same one)
export function dailyStartCard(day, ids) { return ids[Math.floor(rngFor('start:' + day)() * ids.length)]; }

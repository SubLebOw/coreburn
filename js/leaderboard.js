// leaderboard.js
// Leaderboards: GLOBAL (best score, any hero), per HERO, DAILY challenge (per UTC day) and the
// WEEKLY BOSS RUSH. Boards are named 'global', 'hero:sarrow', 'daily:2026-10-14', 'rush:2026-W42'
// (CoreBurnZ: the same names with a 'z:' prefix, e.g. 'z:global').
//
//  * Always: a local board on this device (your own best runs).
//  * When LEADERBOARD_CONFIG is filled in: online boards on a free Supabase project. Scores go
//    through the submit_score() database function, which re-checks everything (see supabase/).
//  * Anti-cheat: sanity checks here AND on the server (score can't exceed what the kills/waves/time
//    could earn, waves need a minimum time, rush times need a minimum per boss, daily/weekly boards
//    only accept today's / this week's runs, one submission per 15 s per player). Runs where a
//    local test helper was used never submit online.
import { LEADERBOARD_CONFIG as CFG } from './leaderboard-config.js?v=1.31.0';
import { checkName } from './names.js?v=1.31.0';
import { GAME_VERSION } from './version.js?v=1.31.0';

const LOCAL_KEY = 'coreburn-boards';
const ID_KEY = 'coreburn-player-id';
const NAME_KEY = 'coreburn-name';
const HEROES = ['sarrow', 'zaleks', 'iskra', 'orin', 'ninja', 'axiom']; // ninja = CoreBurnZ boards only

export const online = !!(CFG.enabled && CFG.supabaseUrl && CFG.supabaseAnonKey);

// The same rules the server uses (kept in step with supabase/leaderboard.sql)
export function plausible(e) {
  e = { ...e, board: e.board.replace(/^z:/, '') }; // CoreBurnZ boards follow the same rules
  if (e.board.startsWith('rush:')) {
    const bosses = Math.floor((e.score + 999999) / 1e6);
    return bosses >= 0 && bosses <= 7 && e.seconds >= bosses * 12;
  }
  const { wave, kills, score, seconds } = e;
  if (!(wave >= 1 && wave <= 1000 && kills >= 0 && kills <= 20 * wave * wave + 200)) return false;
  if (seconds < (wave - 1) * 5) return false;
  const b = Math.floor(wave / 5);
  const max = kills * 1000 + 18000 * b * (b + 1) / 2 + 300 * wave * (wave + 1) / 2 + seconds * 400;
  return score >= 0 && score <= max;
}

export class Leaderboard {
  constructor() {
    this.online = online;
    let id = localStorage.getItem(ID_KEY);
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)); localStorage.setItem(ID_KEY, id); }
    this.playerId = id;
    this.name = localStorage.getItem(NAME_KEY) || '';
    try { this.local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {}; } catch { this.local = {}; }
  }

  setName(raw) {
    const r = checkName(raw);
    if (r.ok) { this.name = r.name; localStorage.setItem(NAME_KEY, r.name); }
    return r;
  }

  // run = { mode: 'endless'|'daily'|'rush', hero, score, wave, kills, seconds, day, week, tainted }
  boardsFor(run) {
    const z = run.z ? 'z:' : ''; // CoreBurnZ runs have their own boards ('z:global', 'z:daily:...')
    if (run.mode === 'daily') return [z + 'daily:' + run.day];
    if (run.mode === 'rush') return [z + 'rush:' + run.week];
    return [z + 'global', z + 'hero:' + run.hero];
  }

  // Save locally, then (if set up) online. Returns { local: [{ board, rank }], online: 'ok'|'off'|error }
  async submit(run) {
    const boards = this.boardsFor(run);
    const entry = { name: this.name || 'You', hero: run.hero, score: Math.round(run.score), wave: run.wave | 0, kills: run.kills | 0, seconds: Math.round(run.seconds || 0), date: Date.now() };
    const sane = boards.every((board) => plausible({ ...entry, board }));
    const local = sane ? boards.map((board) => ({ board, rank: this.addLocal(board, entry) })) : [];
    let status = 'off';
    if (!sane) status = 'rejected (failed sanity check)';
    else if (this.online) {
      if (run.tainted) status = 'skipped (test helpers used)';
      else if (!this.name) status = 'needs a name';
      else status = await this.post(boards, entry);
    }
    return { local, online: status };
  }

  addLocal(board, entry) {
    const list = this.local[board] || (this.local[board] = []);
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    list.length = Math.min(list.length, 10);
    // keep only recent daily/rush boards (last 14) so storage stays tiny
    const dated = Object.keys(this.local).filter((k) => /^(z:)?(daily|rush):/.test(k)).sort();
    while (dated.length > 14) delete this.local[dated.shift()];
    localStorage.setItem(LOCAL_KEY, JSON.stringify(this.local));
    const rank = list.indexOf(entry);
    return rank >= 0 ? rank + 1 : null;
  }

  localTop(board) { return (this.local[board] || []).slice(0, 10); }

  headers() { return { apikey: CFG.supabaseAnonKey, Authorization: `Bearer ${CFG.supabaseAnonKey}`, 'Content-Type': 'application/json' }; }

  async post(boards, e) {
    try {
      const res = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/submit_score`, {
        method: 'POST', headers: this.headers(),
        body: JSON.stringify({ p_boards: boards, p_player: this.playerId, p_name: this.name, p_hero: e.hero, p_score: e.score, p_wave: e.wave, p_kills: e.kills, p_seconds: e.seconds, p_version: GAME_VERSION }),
      });
      if (!res.ok) return `error ${res.status}`;
      return String(await res.json());
    } catch { return 'offline'; }
  }

  // Top 20 online (or local when not set up). Returns { rows, source }
  async top(board) {
    if (!this.online) return { rows: this.localTop(board), source: 'local' };
    try {
      const q = `board=eq.${encodeURIComponent(board)}&select=name,hero,score,wave,player_id&order=score.desc&limit=20`;
      const res = await fetch(`${CFG.supabaseUrl}/rest/v1/coreburn_scores?${q}`, { headers: this.headers() });
      if (!res.ok) throw new Error(res.status);
      const rows = (await res.json()).map((r) => ({ ...r, me: r.player_id === this.playerId }));
      return { rows, source: 'online' };
    } catch {
      return { rows: this.localTop(board), source: 'local (offline)' };
    }
  }
}
export { HEROES };

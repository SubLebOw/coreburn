// dev-tools.js - DEVELOPMENT ONLY test panel for the preview (?dev=1). Not part of the production build
// (scripts/build-web.mjs skips dev-*.js) and only imported by main.js when js/dev-boot.js ran, which
// sandboxes localStorage, so nothing done here touches the real profile. Console API: window.cbDev.
// Cards come from the game's own registry (upgrades.js) at runtime, so new cards show up automatically.
import { RULES } from './rules.js?v=1.33.0-p5c3';
import { isBossWave } from './waves.js?v=1.33.0-p5c3';
import { arenaForWave } from './arena.js?v=1.33.0-p5c3';
import { UPGRADES, CURSES, BOSS_CARDS, EVOLUTIONS, MYTHICS, PICK_EVERY, cardForHero } from './upgrades.js?v=1.33.0-p5c3';
import { MASTERIES } from './mastery.js?v=1.33.0-p5c3';

const HEROES = [['sarrow', 'Sarrow'], ['zaleks', 'Zaleks'], ['iskra', 'Iskra'], ['orin', 'Orin'], ['ninja', 'Kagero'], ['axiom', 'Axiom']];
const ARENAS = [['slag', 'Slag Yard', 0, true], ['foundry', 'Foundry (lava)', 1, false], ['tundra', 'Tundra (ice)', 2, false], ['cathedral', 'Cathedral', 3, true], ['rooftop', 'Rooftop', 4, true]]; // [id, label, index, Containment Shift layout]
const EVENTS = [['blackout', 'Blackout'], ['hvt', 'High-Value Target'], ['shift', 'Containment Shift']];
const P5IDS = new Set(['p5Momentum', 'p5Plating', 'p5Conductor', 'p5Overload', 'p5Vents', 'p5Echo', 'eOverdrive', 'eAegis', 'eCascade', 'myRift', 'myParadox', 'myWarforge']);
const DEFENSIVE = ['maxHp', 'regen', 'leech', 'armor', 'guard', 'p5Plating', 'p5Vents', 'speed']; // preferred early by the realistic preset (ids that do not exist are skipped)

// ---- the card registry, flattened: one entry per card with its category ----
export function registry() {
  const out = [];
  const add = (src, cat) => { for (const [id, d] of Object.entries(src)) out.push({ id, name: d.name, icon: d.icon || '', max: d.max, group: d.group, heroes: d.heroes || null, needs: d.needs || null, zonly: !!d.zonly, cat: d.heroes ? 'hero' : cat, p5: P5IDS.has(id), d }); };
  add(UPGRADES, 'upgrade'); add(CURSES, 'cursed'); add(BOSS_CARDS, 'relic'); add(EVOLUTIONS, 'evolution'); add(MYTHICS, 'mythic');
  for (const e of out) { if (CURSES[e.id]) e.cat = 'cursed'; if (BOSS_CARDS[e.id]) e.cat = 'relic'; if (EVOLUTIONS[e.id]) e.cat = 'evolution'; if (MYTHICS[e.id]) e.cat = 'mythic'; }
  return out;
}
const TABS = [['all', 'All'], ['hero', 'This hero'], ['attack', 'Attack'], ['mobility', 'Mobility'], ['ultimate', 'Ultimate'], ['core', 'Core'], ['p5', 'New P5'], ['evolution', 'Evolution'], ['mythic', 'Mythic'], ['relic', 'Relic'], ['cursed', 'Cursed'], ['owned', 'Owned']];

export function install(c) {
  let god = false;
  const REG = registry();
  const say = (t, col = '#ff4af0') => { try { c.hud.showToast('DEV', t, col); } catch { /* hud busy */ } return t; };
  const need = () => { const s = c.getState(); if (s === 'title' || s === 'select' || s === 'gameover') throw new Error('start a run first (START RUN buttons)'); };
  const L = () => c.player.loadout;
  const refresh = () => { const l = L(); l.version++; l.recompute(); c.player.applyLoadout(); };
  const hero = () => c.player.char?.id;
  const setLv = (id, lv) => {
    const l = L(), d = l.def(id); if (!d) throw new Error('unknown card ' + id);
    lv = Math.max(0, Math.min(d.max, lv | 0));
    if (lv > 0) for (const n of [].concat(d.needs || [])) { const nd = l.def(n); if (nd) l.levels[n] = Math.max(l.levels[n] || 0, EVOLUTIONS[id] ? nd.max : 1); } // evolutions: both parts maxed; follow-up cards: base card
    if (lv) l.levels[id] = lv; else delete l.levels[id];
    return lv;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitTransition = async () => { for (let i = 0; i < 300 && c.getTransition?.(); i++) await sleep(100); };

  // realistic late-game build: what a genuine run has by wave n, from the game's own offer rate
  function realistic(n, h = hero()) {
    const picks = Math.floor((n - 1) / PICK_EVERY), relics = Math.floor((n - 1) / 5);
    const elig = REG.filter((e) => (e.cat === 'upgrade' || (e.cat === 'hero' && cardForHero(e.id, h))) && (!e.heroes || e.heroes.includes(h)));
    const evos = REG.filter((e) => e.cat === 'evolution' && (!e.heroes || e.heroes.includes(h)) && [].concat(e.needs).every((x) => elig.some((g) => g.id === x)));
    const want = n >= 60 ? 3 : n >= 45 ? 2 : 1; // a few evolutions, not all
    const order = ['eJugg', 'eUndying'].concat(evos.filter((e) => e.heroes).map((e) => e.id), evos.map((e) => e.id));
    const lv = {}; let left = picks;
    const pick = (id) => { const d = L().def(id); if (!d || left <= 0 || (lv[id] || 0) >= d.max) return false; lv[id] = (lv[id] || 0) + 1; left--; return true; };
    const chosen = [];
    for (const id of order) { if (chosen.length >= want) break; const e = evos.find((x) => x.id === id); if (!e || chosen.includes(id)) continue; chosen.push(id); }
    for (const id of chosen) { for (const p of [].concat(EVOLUTIONS[id].needs)) while (pick(p)); pick(id); }
    const rest = elig.map((e) => e.id).filter((id) => !lv[id]).sort((a, b) => (DEFENSIVE.includes(b) - DEFENSIVE.includes(a)) || (a < b ? -1 : 1));
    let i = 0, guard = 0; while (left > 0 && guard++ < 2000) { const id = rest[i++ % rest.length]; if (lv[id] >= 3) continue; pick(id); } // spread, at most level 3 each
    const rel = Object.keys(BOSS_CARDS); const rl = {}; for (let k = 0; k < relics; k++) { const id = rel[k % rel.length]; if ((rl[id] || 0) < BOSS_CARDS[id].max) rl[id] = (rl[id] || 0) + 1; }
    return { picks, relics, tier: picks, levels: { ...lv, ...rl }, evolutions: chosen, mastery: (MASTERIES[h] || []).map((m) => m.id) };
  }

  const api = {
    registry: () => REG,
    start(h = 'sarrow') { if (!RULES.z) throw new Error('switch to CoreBurnZ rules first'); c.setMode('endless'); c.startGame(h); return h; }, // bypasses locks; unlock flags only reach the sandbox
    grant(id, lv) { need(); const d = L().def(id); const r = setLv(id, lv ?? d?.max); refresh(); say(`${d.name} → L${r}`); return r; },
    remove(id) { need(); delete L().levels[id]; refresh(); return 0; },
    clearCards() { need(); L().levels = {}; refresh(); say('all cards removed'); },
    maxAll() { need(); const h = hero(); let n = 0; for (const e of REG) { if (e.cat === 'cursed' || e.cat === 'relic') continue; if (e.heroes && !e.heroes.includes(h)) continue; setLv(e.id, e.max); n++; } refresh(); return say(`max-upgrades: ${n} cards at max`); },
    level: (id) => L().levels[id] || 0,
    wave(n) {
      need(); n = Math.max(1, Math.floor(n)); const l = L();
      l.tier = Math.max(l.tier, Math.floor((n - 1) / PICK_EVERY)); refresh(); // the weapon tier a run has by then (1 tier per normal pick)
      c.events.reset(); c.enemies.reset(); c.projectiles.reset();
      const r = c.getRun(); if (r.ev) r.ev.last = -99;
      c.enemies.startWave(n); return n;
    },
    boss(n) { need(); return api.wave(n || (Math.floor(Math.max(1, c.enemies.wave) / 5) + 1) * 5); },
    arena(id) { // jump to the next ordinary wave (not a boss wave) in that arena
      need(); const a = ARENAS.find((x) => x[0] === id); let n = Math.max(2, c.enemies.wave + 1);
      while (arenaForWave(n).index !== a[2] || isBossWave(n)) n++;
      api.wave(n); return say(`${a[1]}: wave ${n}` + (a[3] ? '' : ' (no Containment Shift here)'));
    },
    async event(k) {
      need();
      const cur = c.arena.current; let n = Math.max(c.enemies.wave, 2);
      const ok = (w) => !isBossWave(w) && (k !== 'shift' || ARENAS.find((a) => a[2] === arenaForWave(w).index)[3]);
      if (!ok(n) || c.events.cur || c.getTransition?.()) { while (!ok(n)) n++; }
      if (k === 'shift' && !ARENAS.find((a) => a[0] === cur.id)?.[3]) say(`${cur.name} has no Containment Shift layout (lava/ice by design): moving to wave ${n}`, '#ffc23a');
      api.wave(n); await waitTransition(); // the arena fade must finish, or the event would use the old arena
      if (c.events.cur?.kind === k) return say(EVENTS.find((e) => e[0] === k)[1] + ' started');
      c.events.reset(); c.enemies.mutator = null; c.world.forceEvent = k;
      c.events.roll(n, c.getRun(), true, c.arena.current.id); c.world.forceEvent = null;
      const got = c.events.cur?.kind;
      if (got !== k) throw new Error(say(`could not start ${k} in ${c.arena.current.name} (wave ${n})`, '#ff5a5a'));
      return say(EVENTS.find((e) => e[0] === k)[1] + ` started (${c.arena.current.name}, wave ${n})`);
    },
    realistic(n) { // apply the realistic preset for wave n and jump there
      need(); const R = realistic(n), l = L();
      l.levels = { ...R.levels }; l.tier = R.tier; c.player.masteryNodes = R.mastery; l.mastery = R.mastery; refresh();
      c.player.hp = c.player.maxHp; api.wave(n);
      say(`realistic W${n}: ${R.picks} picks, ${R.relics} relics, ${R.evolutions.length} evolutions`); return R;
    },
    plan: realistic,
    god(on = !god) { god = on; return god; },
    heal() { need(); c.player.hp = c.player.maxHp; },
    pick() { need(); c.openPicker(); },
    resetSandbox() { window.__CB_DEV.resetSandbox(); },
    ctx: c, // raw game objects for console poking
  };
  setInterval(() => { if (god && c.player && !c.player.dead) { c.player.invulnTimer = Math.max(c.player.invulnTimer || 0, 0.5); c.player.hp = Math.max(c.player.hp, c.player.maxHp * 0.5); } }, 100);
  window.cbDev = api;

  // ---- panel ----
  const css = document.createElement('style');
  css.textContent = `#cbdev-badge{position:fixed;left:50%;top:2px;transform:translateX(-50%);z-index:2147483600;background:#ff2bd6;color:#000;font:700 11px monospace;padding:2px 8px;border-radius:0 0 6px 6px;pointer-events:none}
#cbdev-btn{position:fixed;left:6px;bottom:6px;z-index:2147483601;width:44px;height:44px;border-radius:50%;border:2px solid #ff2bd6;background:#000c;color:#ff2bd6;font:700 12px monospace;touch-action:manipulation}
#cbdev{position:fixed;left:56px;bottom:6px;z-index:2147483601;width:min(440px,calc(100vw - 64px));max-height:calc(100vh - 30px);max-height:calc(100dvh - 30px);overflow-y:auto;overscroll-behavior:contain;background:#0b0710f0;border:2px solid #ff2bd6;border-radius:8px;color:#eee;font:12px monospace;padding:6px;touch-action:pan-y;-webkit-overflow-scrolling:touch}
#cbdev.hidden{display:none}#cbdev h4{margin:8px 0 3px;color:#ff8af0;font-size:11px}#cbdev button{margin:2px;padding:4px 8px;min-height:40px;min-width:40px;background:#2a1830;color:#fff;border:1px solid #ff2bd655;border-radius:4px;font:12px monospace;touch-action:manipulation}
#cbdev .row{display:flex;flex-wrap:wrap;align-items:center}#cbdev .msg{color:#7ff;min-height:14px;padding:2px 0}#cbdev .on{background:#ff2bd6;color:#000}
#cbdev .hd{position:sticky;top:-6px;z-index:2;background:#0b0710;display:flex;align-items:center;justify-content:space-between;margin:-6px -6px 0;padding:4px 6px;border-bottom:1px solid #ff2bd655}
#cbdev .tabs{display:flex;flex-wrap:wrap}#cbdev .tabs button{min-height:40px;padding:2px 6px;font-size:11px}
#cbdev input{width:100%;box-sizing:border-box;min-height:40px;margin:3px 0;background:#1a1020;color:#fff;border:1px solid #ff2bd6;border-radius:4px;font:14px monospace;padding:0 8px}
#cbdev .card{display:flex;align-items:center;border-bottom:1px solid #ffffff14;min-height:44px}#cbdev .card .nm{flex:1;overflow:hidden;line-height:1.2}#cbdev .card .nm small{color:#a9a;display:block;font-size:10px}
#cbdev .card .lv{width:52px;text-align:center;font-weight:700}#cbdev .card.own .lv{color:#5f5}#cbdev .card button{margin:1px;padding:0}#cbdev .cnt{color:#a9a;font-size:10px}`;
  document.head.appendChild(css);
  const badge = el('div', { id: 'cbdev-badge' }, 'DEV TOOLS — not saved');
  const btn = el('button', { id: 'cbdev-btn' }, 'DEV');
  const pan = el('div', { id: 'cbdev', class: 'hidden' });
  const msg = el('div', { class: 'msg' });
  const run = (f) => async () => { try { const r = await f(); msg.textContent = '✓ ' + (typeof r === 'object' ? JSON.stringify(r).slice(0, 120) : r ?? 'ok'); } catch (e) { msg.textContent = '✗ ' + e.message; say(e.message, '#ff5a5a'); } draw(); };
  const row = (btns) => { const r = el('div', { class: 'row' }); for (const [t, f, id] of btns) { const b = el('button', id ? { 'data-dev': id } : {}, t); b.onclick = run(f); r.appendChild(b); } return r; };
  const hd = el('div', { class: 'hd' }); const x = el('button', { id: 'cbdev-close' }, '✕ CLOSE'); x.onclick = () => pan.classList.add('hidden');
  hd.append(el('span', {}, 'DEV TOOLS — sandboxed, not saved'), x); pan.append(hd, msg);
  pan.append(el('h4', {}, 'START RUN (CoreBurnZ, locks bypassed)'), row(HEROES.map(([id, n]) => [n, () => api.start(id)])));
  pan.append(el('h4', {}, 'BUILD PRESETS'), row([['MAX all cards (this hero)', () => api.maxAll()], ['Remove all cards', () => api.clearCards()], ['Open card pick', () => api.pick()]]));
  pan.append(el('div', { class: 'cnt' }, 'Realistic late-game build (picks/relics/tier/masteries a real run has by then) + jump:'), row([35, 50, 60, 75].map((w) => ['Real W' + w, () => api.realistic(w), 'real' + w])));
  pan.append(el('h4', {}, 'JUMP TO WAVE (keeps your cards)'), row([1, 10, 20, 35, 50, 60, 75].map((w) => ['W' + w, () => 'wave ' + api.wave(w)]).concat([['Next boss', () => 'wave ' + api.boss()], ['Nail Chorus (60)', () => 'wave ' + api.boss(60)]])));
  pan.append(el('h4', {}, 'ARENA (★ = Containment Shift supported)'), row(ARENAS.map(([id, n, , ok]) => [(ok ? '★ ' : '') + n, () => api.arena(id)])));
  pan.append(el('h4', {}, 'PHASE 4 EVENTS'), row(EVENTS.map(([k, n]) => [n, () => api.event(k), 'ev-' + k])));
  const godB = el('button', {}, 'God mode: OFF'); godB.onclick = () => { const on = api.god(); godB.textContent = 'God mode: ' + (on ? 'ON' : 'OFF'); godB.classList.toggle('on', on); };
  const r2 = row([['Full heal', () => api.heal()], ['Reset sandbox', () => api.resetSandbox()]]); r2.prepend(godB); pan.append(el('h4', {}, 'PLAYER'), r2);
  // card browser
  let tab = 'hero', q = '';
  pan.append(el('h4', {}, `CARDS (${REG.length} in the game's registry)`));
  const tabs = el('div', { class: 'tabs' }); const tabBtns = {};
  for (const [k, n] of TABS) { const b = el('button', {}, n); b.onclick = () => { tab = k; draw(); }; tabBtns[k] = b; tabs.appendChild(b); }
  const search = el('input', { type: 'search', placeholder: 'search cards…', id: 'cbdev-search' }); search.oninput = () => { q = search.value.toLowerCase(); draw(); };
  const cnt = el('div', { class: 'cnt' }); const list = el('div', { id: 'cbdev-cards' });
  pan.append(tabs, search, cnt, list);
  function shown() {
    const h = hero(), lv = (id) => (c.player?.loadout?.levels || {})[id] || 0;
    return REG.filter((e) => {
      if (q && !(e.name + ' ' + e.id).toLowerCase().includes(q)) return false;
      if (tab === 'all') return true; if (tab === 'owned') return lv(e.id) > 0; if (tab === 'p5') return e.p5;
      if (tab === 'hero') return !!e.heroes && (!h || e.heroes.includes(h));
      if (['attack', 'mobility', 'ultimate', 'core'].includes(tab)) return (e.cat === 'upgrade' || e.cat === 'hero') && e.group === tab;
      return e.cat === tab;
    });
  }
  function draw() {
    for (const [k, b] of Object.entries(tabBtns)) b.classList.toggle('on', k === tab);
    if (pan.classList.contains('hidden')) return;
    const items = shown(), lv = (id) => (c.player?.loadout?.levels || {})[id] || 0;
    cnt.textContent = `${items.length} shown`; list.textContent = '';
    for (const e of items) {
      const l = lv(e.id), r = el('div', { class: 'card' + (l ? ' own' : ''), 'data-id': e.id });
      const nm = el('div', { class: 'nm' }, `${e.icon} ${e.name}`); nm.appendChild(el('small', {}, `${e.cat}${e.group && e.cat !== e.group ? '/' + e.group : ''}${e.heroes ? ' · ' + e.heroes.join(',') : ''}${e.needs ? ' · needs ' + [].concat(e.needs).join('+') : ''}${e.p5 ? ' · P5' : ''}`));
      const set = (v) => run(() => api.grant(e.id, v));
      const b = (t, f) => { const x = el('button', {}, t); x.onclick = f; return x; };
      r.append(nm, b('−', set(Math.max(0, l - 1))), el('span', { class: 'lv' }, `${l}/${e.max}`), b('+', set(l + 1)), b('MAX', set(e.max)), b('✕', run(() => api.remove(e.id))));
      list.appendChild(r);
    }
  }
  btn.onclick = () => { pan.classList.toggle('hidden'); draw(); };
  for (const n of [btn, pan]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'wheel', 'keydown', 'keyup']) n.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // keep taps/keys out of the game's input
  document.body.append(badge, btn, pan);
}
function el(tag, attrs = {}, text) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }

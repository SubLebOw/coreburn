// dev-tools.js - DEVELOPMENT ONLY test panel for the preview (?dev=1). Not part of the production build
// (scripts/build-web.mjs skips dev-*.js) and only imported by main.js when js/dev-boot.js ran, which
// sandboxes localStorage, so nothing done here touches the real profile. Console API: window.cbDev.
import { RULES } from './rules.js?v=1.33.0';
import { isBossWave } from './waves.js?v=1.33.0';

const HEROES = [['sarrow', 'Sarrow'], ['zaleks', 'Zaleks'], ['iskra', 'Iskra'], ['orin', 'Orin'], ['ninja', 'Kagero'], ['axiom', 'Axiom']];
const CARDS = [['p5Momentum', 'Momentum Capacitor'], ['p5Plating', 'Kinetic Plating'], ['p5Conductor', 'Conductor Matrix'], ['p5Overload', 'Overload Circuit'], ['p5Vents', 'Emergency Vents'], ['p5Echo', 'Echo Chamber']];
const EVOS = [['eOverdrive', 'Overdrive Engine'], ['eAegis', 'Reactive Aegis'], ['eCascade', 'Resonance Cascade']];
const MYTHS = [['myRift', 'Graviton Rift'], ['myParadox', 'Paradox Engine'], ['myWarforge', 'Warforge Array']];
const EVENTS = [['blackout', 'Blackout'], ['hvt', 'High-Value Target'], ['shift', 'Containment Shift']];

export function install(c) {
  let god = false;
  const need = () => { if (c.getState() === 'title' || c.getState() === 'select' || c.getState() === 'gameover') throw new Error('start a run first'); };
  const L = () => c.player.loadout;
  const refresh = () => { const l = L(); l.version++; l.recompute(); c.player.applyLoadout(); };
  const api = {
    heroes: HEROES.map((h) => h[0]), cards: CARDS.map((x) => x[0]), evolutions: EVOS.map((x) => x[0]), mythics: MYTHS.map((x) => x[0]),
    start(hero = 'sarrow') { if (!RULES.z) throw new Error('switch to CoreBurnZ rules first'); c.setMode('endless'); c.startGame(hero); return hero; }, // bypasses locks; unlock flags only reach the sandbox
    grant(id, lv) {
      need(); const l = L(), d = l.def(id); if (!d) throw new Error('unknown card ' + id);
      for (const n of [].concat(d.needs || [])) l.levels[n] = l.def(n).max; // evolutions: their two parts, maxed
      l.levels[id] = Math.max(0, Math.min(d.max, lv ?? d.max)); if (!l.levels[id]) delete l.levels[id];
      refresh(); c.hud.showToast('DEV: ' + d.name, 'level ' + (l.levels[id] || 0), '#ff4af0'); return l.levels[id] || 0;
    },
    clearCards() { need(); L().levels = {}; refresh(); },
    wave(n) {
      need(); n = Math.max(1, Math.floor(n)); const l = L();
      l.tier = Math.max(l.tier, Math.floor((n - 1) / 2)); refresh(); // the weapon tier a run would have by then
      c.events.reset(); c.enemies.reset(); c.projectiles.reset();
      const r = c.getRun(); if (r.ev) r.ev.last = -99;
      c.enemies.startWave(n); return n;
    },
    boss(n) { need(); const w = n || (Math.floor(Math.max(1, c.enemies.wave) / 5) + 1) * 5; return api.wave(w); },
    event(k) {
      need(); let n = Math.max(c.enemies.wave, 12); while (isBossWave(n)) n++;
      c.world.forceEvent = k; api.wave(n);
      if (!c.events.cur) { c.enemies.mutator = null; c.world.forceEvent = k; c.events.roll(n, c.getRun(), true, c.arena.current.id); }
      return c.events.cur?.kind || 'none (Containment Shift needs an arena with a layout; try another wave)';
    },
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
#cbdev{position:fixed;left:56px;bottom:6px;z-index:2147483601;width:min(420px,calc(100vw - 64px));max-height:calc(100vh - 30px);max-height:calc(100dvh - 30px);overflow-y:auto;overscroll-behavior:contain;background:#0b0710f0;border:2px solid #ff2bd6;border-radius:8px;color:#eee;font:12px monospace;padding:6px;touch-action:pan-y;-webkit-overflow-scrolling:touch}
#cbdev.hidden{display:none}#cbdev h4{margin:6px 0 3px;color:#ff8af0;font-size:11px}#cbdev button{margin:2px;padding:6px 7px;min-height:30px;background:#2a1830;color:#fff;border:1px solid #ff2bd655;border-radius:4px;font:11px monospace}
#cbdev .row{display:flex;flex-wrap:wrap;align-items:center}#cbdev .nm{width:150px}#cbdev .msg{color:#7ff;min-height:14px}#cbdev .on{background:#ff2bd6;color:#000}#cbdev .hd{position:sticky;top:-6px;z-index:1;background:#0b0710;display:flex;align-items:center;justify-content:space-between;margin:-6px -6px 0;padding:4px 6px;border-bottom:1px solid #ff2bd655}#cbdev .hd button{min-width:40px}`;
  document.head.appendChild(css);
  const badge = el('div', { id: 'cbdev-badge' }, 'DEV TOOLS — not saved');
  const btn = el('button', { id: 'cbdev-btn' }, 'DEV');
  const pan = el('div', { id: 'cbdev', class: 'hidden' });
  const msg = el('div', { class: 'msg' });
  const run = (f) => () => { try { const r = f(); msg.textContent = '✓ ' + (r ?? 'ok'); } catch (e) { msg.textContent = '✗ ' + e.message; } };
  const row = (label, btns) => { const r = el('div', { class: 'row' }); if (label) r.appendChild(el('span', { class: 'nm' }, label)); for (const [t, f] of btns) { const b = el('button', {}, t); b.onclick = run(f); r.appendChild(b); } return r; };
  const hd = el('div', { class: 'hd' }); const x = el('button', { id: 'cbdev-close' }, '✕ CLOSE'); x.onclick = () => pan.classList.add('hidden');
  hd.append(el('span', {}, 'DEV TOOLS — sandboxed, not saved'), x); pan.append(hd, msg);
  pan.append(el('h4', {}, 'START RUN (CoreBurnZ, locks bypassed)'), row('', HEROES.map(([id, n]) => [n, () => api.start(id)])));
  pan.append(el('h4', {}, 'NEW CARDS'));
  for (const [id, n] of CARDS) pan.append(row(n, [0, 1, 2, 3].map((lv) => ['L' + lv, () => api.grant(id, lv)])));
  pan.append(el('h4', {}, 'EVOLUTIONS (+ prerequisites)'), row('', EVOS.map(([id, n]) => [n, () => api.grant(id, 1)])));
  pan.append(el('h4', {}, 'MYTHICS'), row('', MYTHS.map(([id, n]) => [n, () => api.grant(id, 1)])));
  pan.append(row('', [['Clear cards', () => api.clearCards()], ['Open card pick', () => api.pick()]]));
  pan.append(el('h4', {}, 'JUMP TO WAVE'), row('', [1, 10, 20, 50, 60, 75].map((w) => ['W' + w, () => 'wave ' + api.wave(w)]).concat([['Next boss', () => 'wave ' + api.boss()], ['Nail Chorus (60)', () => 'wave ' + api.boss(60)]])));
  pan.append(el('h4', {}, 'PHASE 4 EVENTS'), row('', EVENTS.map(([k, n]) => [n, () => api.event(k)])));
  const godB = el('button', {}, 'God mode: OFF'); godB.onclick = () => { const on = api.god(); godB.textContent = 'God mode: ' + (on ? 'ON' : 'OFF'); godB.classList.toggle('on', on); };
  const r2 = row('', [['Full heal', () => api.heal()], ['Reset sandbox', () => api.resetSandbox()]]); r2.prepend(godB); pan.append(el('h4', {}, 'PLAYER'), r2);
  btn.onclick = () => pan.classList.toggle('hidden');
  for (const n of [btn, pan]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'wheel', 'keydown']) n.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); // keep taps out of the game's input
  document.body.append(badge, btn, pan);
}
function el(tag, attrs = {}, text) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }

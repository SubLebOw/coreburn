// ranks-ui.js
// The RANKS panel (title screen): GLOBAL, per HERO, DAILY (today) and BOSS RUSH (this week).
// Shows the online top 20 when online leaderboards are set up, otherwise your best runs on this device.
import { CHARACTERS, heroOrder } from './characters.js?v=1.30.3';
import { dailyKey, weekKey } from './modes.js?v=1.30.3';
import { RULES } from './rules.js?v=1.30.3';
const $ = (id) => document.getElementById(id);
const TABS = [['global', 'GLOBAL'], ['hero', 'HEROES'], ['daily', 'DAILY'], ['rush', 'BOSS RUSH']];

export class RanksUI {
  constructor(lb, { rushLabel }) {
    this.lb = lb; this.rushLabel = rushLabel;
    this.tab = 'global'; this.hero = 'sarrow';
    this.isOpen = false;
    this.panel = $('ranks-panel');
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('rk-name').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.saveName(); });
    $('rk-name-save').addEventListener('click', (e) => { e.stopPropagation(); this.saveName(); });
    $('rk-close').addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.code === 'Escape') this.close(); });
  }

  open() { this.isOpen = true; this.panel.classList.remove('hidden'); $('rk-name').value = this.lb.name; $('rk-name-msg').textContent = ''; this.render(); }
  close() { this.isOpen = false; this.panel.classList.add('hidden'); }

  saveName() {
    const r = this.lb.setName($('rk-name').value);
    $('rk-name-msg').textContent = r.ok ? 'Saved! New scores use this name.' : r.error;
    if (r.ok) $('rk-name').value = r.name;
  }

  // shows the boards of the rule set picked on the title screen (CLASSIC or COREBURNZ)
  board() {
    const z = RULES.z ? 'z:' : '';
    if (this.tab === 'hero') return z + 'hero:' + this.hero;
    if (this.tab === 'daily') return z + 'daily:' + dailyKey();
    if (this.tab === 'rush') return z + 'rush:' + weekKey();
    return z + 'global';
  }

  tabs(el, list, cur, onPick) {
    el.innerHTML = '';
    for (const [id, label] of list) {
      const b = document.createElement('button');
      b.className = 'sp-tab' + (id === cur ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(id); this.render(); });
      el.appendChild(b);
    }
  }

  async render() {
    this.tabs($('rk-tabs'), TABS, this.tab, (id) => { this.tab = id; });
    const sub = $('rk-sub');
    sub.classList.toggle('hidden', this.tab !== 'hero');
    if (this.tab === 'hero') this.tabs(sub, heroOrder(RULES.z).map((id) => [id, CHARACTERS[id].name]), this.hero, (id) => { this.hero = id; });
    const board = this.board();
    const list = $('rk-list');
    list.innerHTML = '<div class="rk-empty">Loading…</div>';
    const { rows, source } = await this.lb.top(board);
    if (this.board() !== board) return; // tab changed while loading
    $('rk-source').textContent = (RULES.z ? 'COREBURNZ · ' : 'CLASSIC · ') + (source === 'online' ? 'ONLINE' : 'ON THIS DEVICE');
    const label = this.tab === 'daily' ? `Daily challenge ${dailyKey()} (UTC)` : this.tab === 'rush' ? `Weekly boss rush ${weekKey()} · new bosses order every Monday (UTC)` : '';
    list.innerHTML = label ? `<div class="rk-label">${label}</div>` : '';
    if (!rows.length) list.innerHTML += `<div class="rk-empty">No runs yet${this.tab === 'daily' ? ' today' : this.tab === 'rush' ? ' this week' : ''}. Go set one!</div>`;
    rows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rk-row' + (r.me ? ' me' : '');
      const c = CHARACTERS[r.hero];
      row.style.setProperty('--c', c ? '#' + c.color.toString(16).padStart(6, '0') : '#ccc');
      const val = this.tab === 'rush' ? this.rushLabel(r.score) : `${Number(r.score).toLocaleString()} pts`;
      row.innerHTML = `<b>${i + 1}</b><span class="nm"></span><span class="hr">${c ? c.name : ''}</span><span class="sc">${val}</span>${this.tab === 'rush' ? '' : `<span class="wv">w${r.wave}</span>`}`;
      row.querySelector('.nm').textContent = r.name;
      list.appendChild(row);
    });
    if (source !== 'online') list.innerHTML += '<div class="rk-note">Online leaderboards aren\'t switched on yet, so these are your best runs on this device.</div>';
  }
}

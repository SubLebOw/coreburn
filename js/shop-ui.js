// shop-ui.js
// The unlock shop panel on the title screen. Tabs: SKINS / TALONS / PERKS. Tap an item to buy it
// (if you have the scrap) or to equip / unequip it. Rare items can't be bought: golden bosses drop them.
const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
import { ACHIEVEMENTS, rewardText } from './achievements.js?v=1.30.1';
const TABS = [['skin', 'SKINS'], ['talon', 'TALONS'], ['perk', 'PERKS'], ['ach', 'MILESTONES']];
const NOTES = {
  skin: 'Skins recolour whichever hero you pick. Solo runs only (co-op keeps everyone easy to tell apart).',
  talon: 'Your talons start in this colour; upgrade tiers still blend in as they grow.',
  perk: 'Equip ONE small head start for solo runs. Each is worth about one upgrade card.',
  ach: 'Milestones pay out once. Progress is saved on this device.',
};

export class ShopUI {
  constructor(meta, shop, { onClose } = {}) {
    this.meta = meta; this.shop = shop; this.onClose = onClose;
    this.tab = 'skin';
    this.isOpen = false;
    this.panel = $('shop-panel');
    $('sp-close').addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    for (const el of [this.panel]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.code === 'Escape') this.close(); });
    this.refreshTitle();
  }

  refreshTitle() { $('shop-scrap').textContent = `${this.meta.scrap.toLocaleString()} scrap`; }

  // fromGameOver: show PLAY AGAIN in the shop and come back to the results on BACK
  open(fromGameOver = false) {
    this.fromGameOver = fromGameOver;
    $('sp-play').classList.toggle('hidden', !fromGameOver);
    $('sp-close').textContent = fromGameOver ? 'BACK' : 'DONE';
    this.isOpen = true; this.panel.classList.remove('hidden'); this.render(); }
  close(silent = false) { this.isOpen = false; this.panel.classList.add('hidden'); this.refreshTitle(); if (!silent) this.onClose?.(this.fromGameOver); }

  renderMilestones(box) {
    const { meta } = this, s = meta.data.stats;
    const doneCount = ACHIEVEMENTS.filter((a) => meta.data.ach[a.id]).length;
    $('sp-scrap').innerHTML = `<b>${doneCount}/${ACHIEVEMENTS.length}</b> DONE · <b>${meta.scrap.toLocaleString()}</b> SCRAP`;
    for (const a of ACHIEVEMENTS) {
      const done = !!meta.data.ach[a.id];
      const [cur, target] = a.goal(s, {});
      const el = document.createElement('div');
      el.className = 'sp-ach' + (done ? ' done' : '');
      const secret = a.reward.hero && !done;
      el.innerHTML = `<div class="ah"><b></b><span class="rw"></span></div><div class="ad"></div>` +
        (done ? '<div class="ap done">✔ DONE</div>' : `<div class="ap"><i style="width:${a.live ? 0 : Math.min(100, (cur / target) * 100)}%"></i><span>${a.live ? 'in one run' : `${Math.min(cur, target).toLocaleString()} / ${target.toLocaleString()}`}</span></div>`);
      el.querySelector('b').textContent = a.name;
      el.querySelector('.rw').textContent = secret ? '🔒 ???' : rewardText(a, meta);
      el.querySelector('.ad').textContent = a.desc;
      box.appendChild(el);
    }
  }

  render() {
    const { meta } = this;
    $('sp-scrap').innerHTML = `<b>${meta.scrap.toLocaleString()}</b> SCRAP`;
    const tabs = $('sp-tabs');
    tabs.innerHTML = '';
    for (const [id, label] of TABS) {
      const b = document.createElement('button');
      b.className = 'sp-tab' + (id === this.tab ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.tab = id; this.render(); });
      tabs.appendChild(b);
    }
    const box = $('sp-items');
    box.innerHTML = '';
    box.classList.toggle('ach', this.tab === 'ach');
    if (this.tab === 'ach') { this.renderMilestones(box); $('sp-note').textContent = NOTES.ach; return; }
    for (const it of this.shop[this.tab]) {
      const owned = meta.owns(it.id), on = meta.data.equip[this.tab] === it.id && owned;
      const b = document.createElement('button');
      b.className = 'sp-item' + (owned ? ' owned' : '') + (on ? ' on' : '') + (it.rare ? ' rare' : '');
      const color = it.color != null ? hex(it.color) : '#ffb060';
      b.style.setProperty('--c', color);
      const status = on ? 'EQUIPPED' : owned ? 'TAP TO EQUIP' : it.rare ? it.rare.toUpperCase() : `${it.cost} SCRAP`;
      b.innerHTML = `<div class="sw">${this.tab === 'perk' ? '✚' : ''}</div><div class="nm"></div><div class="ds"></div><div class="st">${status}</div>`;
      b.querySelector('.nm').textContent = it.name;
      b.querySelector('.ds').textContent = it.desc || '';
      if (!owned && !it.rare && meta.scrap < it.cost) b.classList.add('poor');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (owned) meta.equip(this.tab, it.id);
        else if (!meta.buy(this.tab, it.id)) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
        this.render();
      });
      box.appendChild(b);
    }
    $('sp-note').textContent = NOTES[this.tab];
  }
}

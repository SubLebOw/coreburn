// shop-ui.js
// The unlock shop panel on the title screen. Tabs: SKINS / TALONS / PERKS. Tap an item to buy it
// (if you have the scrap) or to equip / unequip it. Rare items can't be bought: golden bosses drop them.
const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
import { ACHIEVEMENTS, rewardText } from './achievements.js?v=1.34.0';
import { COSMETICS, HERO_IDS, SLOT_LABEL, RARITY } from './progress.js?v=1.34.0';
import { CHARACTERS } from './characters.js?v=1.34.0';
import { itemClass, itemHTML } from './cosmetics-ui.js?v=1.34.0';
const TABS = [['gear', 'GEAR'], ['skin', 'SKINS'], ['talon', 'TALONS'], ['perk', 'PERKS'], ['ach', 'MILESTONES']];
const NOTES = {
  gear: 'Armour, helmets, back pieces and weapon shapes for each hero. Tap to try it on, tap again to buy or equip. Gold EARNED pieces come from real milestones and are never sold. Drag the hero to turn.',
  skin: 'Skins recolour whichever hero you pick. Solo runs only (co-op keeps everyone easy to tell apart).',
  talon: 'Your talons start in this colour; upgrade tiers still blend in as they grow.',
  perk: 'Equip ONE small head start for solo runs. Each is worth about one upgrade card.',
  ach: 'Milestones pay out once. Progress is saved on this device.',
};

export class ShopUI {
  constructor(meta, shop, { onClose, progress, preview, onChange } = {}) {
    this.meta = meta; this.shop = shop; this.onClose = onClose; this.progress = progress; this.pv = preview; this.onChange = onChange;
    this.tab = 'gear'; this.hero = 'sarrow'; this.trying = null;
    this.isOpen = false;
    this.panel = $('shop-panel');
    $('sp-close').addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    $('sp-back').addEventListener('click', (e) => { e.stopPropagation(); $('sp-close').click(); }); // top-left BACK = same as DONE
    for (const el of [this.panel]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.code === 'Escape') this.close(); });
    this.refreshTitle();
  }

  refreshTitle() { $('shop-scrap').textContent = `${this.meta.scrap.toLocaleString()} scrap`; $('mp-scrap').textContent = this.meta.scrap.toLocaleString(); }

  // fromGameOver: show PLAY AGAIN in the shop and come back to the results on BACK
  open(fromGameOver = false) {
    this.fromGameOver = fromGameOver;
    $('sp-play').classList.toggle('hidden', !fromGameOver);
    $('sp-close').textContent = fromGameOver ? 'BACK' : 'DONE';
    this.isOpen = true; this.panel.classList.remove('hidden'); this.render(); }
  close(silent = false) { this.isOpen = false; this.trying = null; this.pv?.unmount(this); this.panel.classList.add('hidden'); this.refreshTitle(); if (!silent) this.onClose?.(this.fromGameOver); }

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

  // GEAR: hero tabs, the shared 3D preview with an action bar, then the hero's pieces
  renderGear(box) {
    const { meta } = this, p = this.progress;
    const heroes = document.createElement('div'); heroes.className = 'sp-tabs-row sp-heroes';
    for (const h of HERO_IDS) {
      const b = document.createElement('button'); b.className = 'sp-tab' + (h === this.hero ? ' on' : ''); b.textContent = CHARACTERS[h].name;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.hero = h; this.trying = null; this.render(); });
      heroes.appendChild(b);
    }
    box.appendChild(heroes);
    const stage = document.createElement('div'); stage.className = 'sp-stage';
    const wrap = document.createElement('div'); wrap.className = 'sp-pv'; stage.appendChild(wrap);
    const bar = document.createElement('div'); bar.className = 'sp-bar'; stage.appendChild(bar);
    box.appendChild(stage);
    const grid = document.createElement('div'); grid.className = 'sp-grid'; box.appendChild(grid);
    const eq = p.equipped(this.hero);
    const items = COSMETICS.filter((c) => c.hero === this.hero && c.gear);
    const it = this.trying;
    // action bar for the item being previewed
    if (it) {
      const own = p.owns(it), on = eq[it.slot] === it.id;
      const r = RARITY[it.rarity];
      bar.innerHTML = `<div class="sb-name" style="color:${hex(r.c)}"></div><div class="sb-sub">${r.label} · ${SLOT_LABEL[it.slot]}${own ? (on ? ' · EQUIPPED' : ' · OWNED') : ' · PREVIEWING'}</div>`;
      bar.querySelector('.sb-name').textContent = it.name;
      const act = document.createElement('button'); act.className = 'big-btn sb-act';
      if (own) act.textContent = on ? 'UNEQUIP' : 'EQUIP';
      else if (it.earn) { act.textContent = '🔒 ' + p.lockText(it); act.disabled = true; act.classList.add('locked'); }
      else { act.textContent = `BUY · ${it.cost.toLocaleString()} SCRAP`; if (meta.scrap < it.cost) { act.disabled = true; act.classList.add('poor'); act.textContent = `NEED ${(it.cost - meta.scrap).toLocaleString()} MORE SCRAP`; } }
      act.addEventListener('click', (e) => { e.stopPropagation(); this.act(it); });
      bar.appendChild(act);
    } else bar.innerHTML = '<div class="sb-sub">Tap a piece to try it on. Nothing is bought or equipped until you press the button.</div>';
    for (const item of items) {
      const own = p.owns(item), on = eq[item.slot] === item.id, trying = it?.id === item.id;
      const b = document.createElement('button');
      b.className = itemClass(item, own, on, trying) + (!own && item.cost && meta.scrap < item.cost ? ' poor' : '');
      b.style.setProperty('--c', hex(item.glow));
      const st = trying && !own ? 'PREVIEWING' : on ? 'EQUIPPED' : own ? 'OWNED' : item.earn ? `🔒 ${p.lockText(item)}` : `⛁ ${item.cost.toLocaleString()}`;
      b.innerHTML = itemHTML(item, SLOT_LABEL[item.slot], st);
      b.querySelector('.nm').textContent = item.name;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.trying = trying ? null : item; this.render(); });
      grid.appendChild(b);
    }
    this.pv.mount(wrap, this);
    this.pv.set(this.hero, { tryOn: this.trying, skin: null });
  }
  act(it) {
    const p = this.progress, meta = this.meta;
    if (p.owns(it)) { const on = p.equipped(this.hero)[it.slot] === it.id; p.equip(this.hero, it.slot, on ? null : it.id); }
    else if (meta.buyCosmetic(it)) { p.equip(this.hero, it.slot, it.id); this.flash(`${it.name} — BOUGHT & EQUIPPED`); }
    else return;
    this.onChange?.(); this.refreshTitle(); this.render();
  }
  flash(text) {
    const t = document.createElement('div'); t.className = 'sp-bought'; t.textContent = text;
    this.panel.querySelector('.sp-box').appendChild(t); setTimeout(() => t.remove(), 1600);
    const sc = $('sp-scrap'); sc.classList.remove('pulse'); void sc.offsetWidth; sc.classList.add('pulse');
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
    box.classList.toggle('gear', this.tab === 'gear');
    if (this.tab !== 'gear') { this.trying = null; this.pv?.unmount(this); } // leaving GEAR drops any try-on
    if (this.tab === 'gear') { this.renderGear(box); $('sp-note').textContent = NOTES.gear; return; }
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

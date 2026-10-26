// cosmetics-ui.js
// The COSMETICS screen (title menu and hero select): pick a hero, equip/remove the hats, masks,
// capes, auras, talon trails and banners you've unlocked by levelling up, and see that hero's five
// ARENA SKINS (with a spinning 3D preview). Arena skins: AUTO (CoreBurnZ only) / ALWAYS / OFF.
import { COSMETICS, ARENA_SKINS, SLOTS, SLOT_LABEL, HERO_IDS, xpNeeded, SKIN_VARIANTS, TITLES, PLATES, ACCOUNT_MAX, RARITY } from './progress.js?v=1.34.0';
import { CHARACTERS } from './characters.js?v=1.34.0';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
export const SLOT_ICON = { hat: '⛑', mask: '🎭', cape: '🧣', aura: '◎', trail: '✧', banner: '⚑', shoulder: '◭', weapon: '⚔' };
const CATS = [['all', 'ALL'], ['hat', 'HELMETS'], ['mask', 'MASKS'], ['shoulder', 'SHOULDERS'], ['cape', 'BACK'], ['weapon', 'WEAPONS'], ['aura', 'AURAS'], ['trail', 'TRAILS'], ['banner', 'BANNERS']];

export class CosmeticsUI {
  constructor(progress, { onClose, onChange, preview } = {}) {
    this.p = progress; this.onClose = onClose; this.onChange = onChange; this.pv = preview; this.cat = 'all'; this.trying = null;
    this.panel = $('cos-panel');
    this.hero = 'sarrow';
    this.previewSkin = null;
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('cos-close').addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
    $('cos-back').addEventListener('click', (e) => { e.stopPropagation(); $('cos-close').click(); }); // top-left BACK = same as DONE
    window.addEventListener('keydown', (e) => { if (this.isOpen && e.code === 'Escape') { e.stopImmediatePropagation(); this.close(); } }, true);
    this.refreshBadge();
  }

  refreshBadge() {
    const lv = this.p.level, need = xpNeeded(lv);
    $('cos-sub').textContent = `level ${lv} · ${COSMETICS.filter((c) => this.p.owns(c)).length}/${COSMETICS.length} unlocked`;
    $('lvl-text').textContent = `LEVEL ${lv}`;
    $('lvl-fill').style.width = lv >= ACCOUNT_MAX ? '100%' : `${Math.round(100 * this.p.xp / need)}%`;
    $('lvl-title').textContent = this.p.title ? this.p.title.name : '';
    const bar = $('lvl-bar');
    for (const pl of PLATES) bar.classList.toggle('plate-' + pl.id, this.p.plate?.id === pl.id);
  }

  open(hero) {
    if (hero && HERO_IDS.includes(hero)) this.hero = hero;
    this.isOpen = true;
    this.previewSkin = null;
    this.panel.classList.remove('hidden');
    this.render();
    this.startPreview();
  }
  close() {
    this.isOpen = false; this.trying = null; this.pv.unmount(this); // unbought / locked try-ons never stick
    this.panel.classList.add('hidden');
    this.refreshBadge();
    this.onClose?.();
  }

  render() {
    const p = this.p;
    const hi = p.heroInfo(this.hero);
    $('cos-level').innerHTML = `LEVEL <b>${p.level}</b>${p.level >= ACCOUNT_MAX ? ' · MAX' : ` · ${p.xp}/${xpNeeded(p.level)} XP`}<br><small>${CHARACTERS[this.hero].name} HERO LV <b>${hi.level}</b>${hi.max ? ' · MAX' : ` · ${hi.xp}/${hi.need}`}</small>`;
    const tabs = $('cos-tabs'); tabs.innerHTML = '';
    for (const h of HERO_IDS) {
      const b = document.createElement('button');
      b.className = 'sp-tab' + (h === this.hero ? ' on' : '');
      b.textContent = CHARACTERS[h].name;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.hero = h; this.previewSkin = null; this.trying = null; this.render(); this.buildPreview(); });
      tabs.appendChild(b);
    }
    const list = $('cos-items'); list.innerHTML = '';
    if (!this.canvasWrap) { this.canvasWrap = document.createElement('div'); this.canvasWrap.id = 'cos-preview'; }
    const eq = p.equipped(this.hero);
    // category chips (slot filter); owned items equip instantly, locked ones can be TRIED ON (preview only)
    const cats = document.createElement('div'); cats.className = 'cos-cats';
    const have = new Set(p.itemsFor(this.hero).map((i) => i.slot));
    for (const [id, label] of CATS) {
      if (id !== 'all' && !have.has(id)) continue;
      const c = document.createElement('button'); c.className = 'cos-cat' + (this.cat === id ? ' on' : ''); c.textContent = label;
      c.addEventListener('click', (e) => { e.stopPropagation(); this.cat = id; this.render(); });
      cats.appendChild(c);
    }
    list.appendChild(cats);
    list.appendChild(this.canvasWrap);
    const items = p.itemsFor(this.hero).filter((i) => this.cat === 'all' || i.slot === this.cat)
      .sort((a, b) => (p.owns(b) - p.owns(a)) || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot));
    for (const item of items) {
      const own = p.owns(item), on = eq[item.slot] === item.id, trying = this.trying?.id === item.id;
      const b = document.createElement('button');
      b.className = itemClass(item, own, on, trying) + ' cos-item';
      b.style.setProperty('--c', hex(item.gear ? item.glow : item.color));
      b.innerHTML = itemHTML(item, `${SLOT_LABEL[item.slot]}`, trying ? (own ? 'PREVIEWING · tap to equip' : `PREVIEWING · 🔒 ${p.lockText(item)}`) : on ? 'EQUIPPED · tap to remove' : own ? 'TAP TO EQUIP' : `🔒 ${p.lockText(item)}`);
      b.querySelector('.nm').textContent = item.name;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!own) { this.trying = trying ? null : item; this.render(); this.buildPreview(); return; } // try it on
        this.trying = null;
        p.equip(this.hero, item.slot, on ? null : item.id);
        this.render(); this.buildPreview(); this.onChange?.();
      });
      list.appendChild(b);
    }
    // arena skins
    const sk = $('cos-skins'); sk.innerHTML = '';
    for (const s of ARENA_SKINS[this.hero]) {
      const b = document.createElement('button');
      b.className = 'sp-item cos-skin owned' + (this.previewSkin === s ? ' on' : '');
      b.style.setProperty('--c', hex(s.glow));
      b.innerHTML = `<div class="sw" style="background:${hex(s.tint)};box-shadow:0 0 14px ${hex(s.glow)}"></div><div class="nm"></div><div class="ds">${s.arenaLabel}</div><div class="st">${this.previewSkin === s ? 'PREVIEWING' : 'TAP TO PREVIEW'}</div>`;
      b.querySelector('.nm').textContent = s.name;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.previewSkin = this.previewSkin === s ? null : s; this.render(); this.buildPreview(); });
      sk.appendChild(b);
    }
    const mode = $('cos-skinmode'); mode.innerHTML = '';
    for (const [v, label] of [['z', 'AUTO IN COREBURNZ'], ['all', 'ALWAYS'], ['off', 'OFF']]) {
      const b = document.createElement('button');
      b.className = 'sp-tab' + (p.data.arenaSkins === v ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); p.setArenaSkins(v); this.render(); this.onChange?.(); });
      mode.appendChild(b);
    }
    // hero skin variants, titles, name plates
    const chip = (box, label, own, on, lockText, color, click) => {
      const b = document.createElement('button');
      b.className = 'cos-chip' + (own ? '' : ' locked') + (on ? ' on' : '');
      b.innerHTML = (color != null ? `<i style="background:${hex(color)}"></i>` : '') + '<span></span>';
      b.querySelector('span').textContent = own ? label : `🔒 ${label} · ${lockText}`;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (own) click(); });
      box.appendChild(b);
    };
    const vb = $('cos-variants'); vb.innerHTML = '';
    const curV = p.variantOf(this.hero);
    chip(vb, 'DEFAULT', true, !curV, '', null, () => { p.setVariant(this.hero, null); this.previewVariant = null; this.render(); this.buildPreview(); this.onChange?.(); });
    for (const v of SKIN_VARIANTS[this.hero]) chip(vb, v.name.toUpperCase(), p.owns(v), curV?.id === v.id, `HERO LV ${v.heroLevel}`, v.tint, () => { p.setVariant(this.hero, v.id); this.render(); this.buildPreview(); this.onChange?.(); });
    const tb = $('cos-titles'); tb.innerHTML = '';
    chip(tb, 'NO TITLE', true, !p.title, '', null, () => { p.setTitle(null); this.render(); this.refreshBadge(); this.onChange?.(); });
    for (const t of TITLES.filter((x) => !x.hero || x.hero === this.hero)) chip(tb, t.name, p.owns(t), p.title?.id === t.id, t.hero ? `HERO LV ${t.heroLevel}` : `LV ${t.level}`, null, () => { p.setTitle(t.id); this.render(); this.refreshBadge(); this.onChange?.(); });
    const pb = $('cos-plates'); pb.innerHTML = '';
    chip(pb, 'PLAIN', true, !p.plate, '', null, () => { p.setPlate(null); this.render(); this.refreshBadge(); });
    for (const pl of PLATES) chip(pb, pl.name.toUpperCase(), p.owns(pl), p.plate?.id === pl.id, `LV ${pl.level}`, null, () => { p.setPlate(pl.id); this.render(); this.refreshBadge(); });
  }

  // ---- the shared 3D hero preview (hero-preview.js, same one as the Shop) ----
  startPreview() { this.pv.mount(this.canvasWrap, this); this.buildPreview(); }
  buildPreview() { if (this.isOpen) this.pv.set(this.hero, { tryOn: this.trying, skin: this.previewSkin }); }
}

// card helpers shared with the Shop: rarity frame + states (previewing / owned / equipped / locked)
export function itemClass(item, own, on, trying) {
  return 'sp-item' + (own ? ' owned' : ' locked') + (on ? ' on' : '') + (trying ? ' trying' : '') + (item.rarity ? ` r-${item.rarity}` : item.mastery ? ' r-earned' : '');
}
export function itemHTML(item, desc, status) {
  const r = item.rarity ? RARITY[item.rarity] : item.mastery ? RARITY.earned : null;
  return `<div class="sw">${SLOT_ICON[item.slot] || ''}</div>${r ? `<div class="rar" style="--r:${hex(r.c)}">${r.label}</div>` : ''}<div class="nm"></div><div class="ds">${desc}</div><div class="st">${status}</div>`;
}

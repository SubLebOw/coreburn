// cosmetics-ui.js
// The COSMETICS screen (title menu and hero select): pick a hero, equip/remove the hats, masks,
// capes, auras, talon trails and banners you've unlocked by levelling up, and see that hero's five
// ARENA SKINS (with a spinning 3D preview). Arena skins: AUTO (CoreBurnZ only) / ALWAYS / OFF.
import * as THREE from 'three';
import { COSMETICS, ARENA_SKINS, SLOTS, SLOT_LABEL, HERO_IDS, xpNeeded, SKIN_VARIANTS, TITLES, PLATES, ACCOUNT_MAX } from './progress.js?v=1.30.3';
import { CHARACTERS } from './characters.js?v=1.30.3';
import { Wardrobe } from './cosmetics.js?v=1.30.3';

const $ = (id) => document.getElementById(id);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const SLOT_ICON = { hat: '🎩', mask: '🎭', cape: '🧣', aura: '◎', trail: '✧', banner: '⚑' };

export class CosmeticsUI {
  constructor(progress, { onClose, onChange } = {}) {
    this.p = progress; this.onClose = onClose; this.onChange = onChange;
    this.panel = $('cos-panel');
    this.hero = 'sarrow';
    this.previewSkin = null;
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    $('cos-close').addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
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
    this.isOpen = false;
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
      b.addEventListener('click', (e) => { e.stopPropagation(); this.hero = h; this.previewSkin = null; this.render(); this.buildPreview(); });
      tabs.appendChild(b);
    }
    const list = $('cos-items'); list.innerHTML = '';
    if (!this.canvasWrap) { this.canvasWrap = document.createElement('div'); this.canvasWrap.id = 'cos-preview'; }
    list.appendChild(this.canvasWrap);
    const eq = p.equipped(this.hero);
    for (const item of p.itemsFor(this.hero)) {
      const own = p.owns(item), on = eq[item.slot] === item.id;
      const b = document.createElement('button');
      b.className = 'sp-item cos-item' + (own ? ' owned' : ' locked') + (on ? ' on' : '');
      b.style.setProperty('--c', hex(item.color));
      b.innerHTML = `<div class="sw">${SLOT_ICON[item.slot]}</div><div class="nm"></div><div class="ds">${SLOT_LABEL[item.slot]}</div><div class="st">${on ? 'EQUIPPED · tap to remove' : own ? 'TAP TO EQUIP' : item.heroLevel ? `🔒 HERO LV ${item.heroLevel}` : `🔒 LEVEL ${item.level}`}</div>`;
      b.querySelector('.nm').textContent = item.name;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!own) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
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

  // ---- a small spinning 3D preview of the hero wearing their stuff ----
  startPreview() {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.setSize(200, 220);
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a3426, 2.2));
      const sun = new THREE.DirectionalLight(0xffe0c0, 2.2); sun.position.set(3, 5, 4); this.scene.add(sun);
      this.cam = new THREE.PerspectiveCamera(30, 200 / 220, 0.1, 50);
      this.cam.position.set(0, 2.2, 7.2); this.cam.lookAt(0, 1.25, 0);
      this.wardrobe = new Wardrobe(this.scene, this.p);
      for (const s of this.wardrobe.trail) this.scene.remove(s.m);
    }
    this.canvasWrap.appendChild(this.renderer.domElement);
    this.buildPreview();
    const loop = () => {
      if (!this.isOpen) return;
      requestAnimationFrame(loop);
      if (this.model) this.model.root.rotation.y += 0.015;
      this.wardrobe.update(1 / 60);
      this.renderer.render(this.scene, this.cam);
    };
    loop();
  }
  buildPreview() {
    if (!this.scene) return;
    if (this.model) this.scene.remove(this.model.root);
    const c = CHARACTERS[this.hero];
    const s = this.previewSkin || this.p.variantOf(this.hero);
    this.model = c.build(s ? s.tint : null);
    if (s && this.model.core) this.model.core.material.color.setHex(s.glow);
    this.scene.add(this.model.root);
    this.wardrobe.dress({ model: this.model, char: c, position: this.model.root.position, state: 'normal' });
  }
}

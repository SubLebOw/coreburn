// hud.js
// Updates the on-screen HTML: health bar, score/wave/kill counters, cooldowns,
// the boss health bar, banners like "WAVE 2", the red damage flash, the active
// power-ups (with timers), and the title / game over screens.

import { UPGRADES, FALLBACK, GROUP_LABELS, weaponMult, tierColor } from './upgrades.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.healthFill = $('health-fill');
    this.healthText = $('health-text');
    this.scoreEl = $('score');
    this.waveEl = $('wave');
    this.killsEl = $('kills');
    this.dashEls = [$('ab-dash'), $('btn-dash')];  // keyboard icon + touch button
    this.spinEls = [$('ab-spin'), $('btn-spin')];
    this.bossBar = $('boss-bar');
    this.bossName = $('boss-name');
    this.bossFill = $('boss-fill');
    this.banner = $('banner');
    this.bannerText = $('banner-text');
    this.bannerSub = $('banner-sub');
    this.damage = $('damage-flash');
    this.overlay = $('overlay');
    this.titlePanel = $('title-panel');
    this.gameoverPanel = $('gameover-panel');
    this.powerTray = $('powerups');
    this.toast = $('toast');
    this.badges = new Map();
    this.weaponLine = $('weapon-line');
    this.upgradeOverlay = $('upgrade-overlay'); // power-up type -> its badge element
    this.last = {}; // remember last values so we only touch the page when something changes
  }

  // bossBar = { name, hp, maxHp } or null; powers = list from PowerUps.hudList
  update(player, wave, kills, score, bossBar, powers = []) {
    const hp = Math.ceil(player.hp);
    if (this.last.hp !== hp) {
      this.last.hp = hp;
      const frac = player.hp / player.maxHp;
      this.healthFill.style.width = `${frac * 100}%`;
      this.healthFill.classList.toggle('low', frac < 0.3);
      this.healthText.textContent = `${hp} / ${player.maxHp}`;
    }
    if (this.last.wave !== wave) { this.last.wave = wave; this.waveEl.textContent = wave; }
    if (this.last.kills !== kills) { this.last.kills = kills; this.killsEl.textContent = kills; }
    if (this.last.score !== score) { this.last.score = score; this.scoreEl.textContent = score.toLocaleString(); }
    this.setCooldown('dash', this.dashEls, player.dashCooldownShown, player.dashCooldownMax);
    this.setCooldown('spin', this.spinEls, player.spinCooldown, player.spinCooldownMax);

    // boss health bar (twin bosses share one)
    const showBoss = !!bossBar;
    if (this.last.showBoss !== showBoss || (showBoss && this.last.bossName !== bossBar.name)) {
      this.last.showBoss = showBoss;
      this.bossBar.classList.toggle('hidden', !showBoss);
      if (showBoss) { this.bossName.textContent = bossBar.name; this.last.bossName = bossBar.name; }
    }
    if (showBoss) {
      const pct = Math.max(0, Math.round((bossBar.hp / bossBar.maxHp) * 200) / 2);
      if (this.last.bossPct !== pct) { this.last.bossPct = pct; this.bossFill.style.width = `${pct}%`; }
    }
    this.updatePowers(powers);
    this.updateWeapon(player.loadout);
  }

  // "T3" + a little chip per picked upgrade (with its level)
  updateWeapon(loadout) {
    if (this.last.loadoutV === loadout.version && this.last.tier === loadout.tier) return;
    this.last.loadoutV = loadout.version; this.last.tier = loadout.tier;
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const picked = loadout.picked;
    const max = window.innerWidth < 600 ? 7 : 10;
    let html = loadout.tier > 0 ? `<span class="wt" style="--c:${hex(tierColor(loadout.tier))}">TIER ${loadout.tier}</span>` : '';
    for (const p of picked.slice(0, max)) html += `<span class="chip" style="--c:${hex(p.color)}" title="${p.name}">${p.icon}<i>${p.level}</i></span>`;
    if (picked.length > max) html += `<span class="more">+${picked.length - max}</span>`;
    this.weaponLine.innerHTML = html;
  }

  // The upgrade picker. cards = ids from Loadout.roll(); onPick(id) is called once.
  showPicker(cards, loadout, onPick) {
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const tc = hex(tierColor(loadout.tier + 1));
    $('upgrade-sub').innerHTML = `Weapon <b style="--c:${tc}">Tier ${loadout.tier} → ${loadout.tier + 1}</b> · base damage x${weaponMult(loadout.tier + 1).toFixed(2)} · plus your pick:`;
    const box = $('upgrade-cards');
    box.innerHTML = '';
    cards.forEach((id, i) => {
      const def = id === 'patch' ? FALLBACK : UPGRADES[id];
      const lv = loadout.level(id);
      const b = document.createElement('button');
      b.className = 'ucard';
      b.style.setProperty('--c', hex(def.color));
      const lvl = id === 'patch' ? `Taken ${lv}x` : (lv === 0 ? `<b>NEW</b> · Lv 1/${def.max}` : `Lv ${lv} → <b>${lv + 1}</b>/${def.max}`);
      b.innerHTML = `<span class="key">${i + 1}</span><div class="icon"></div><div class="ubody"><div class="group">${GROUP_LABELS[def.group]}</div><div class="uname"></div><div class="effect"></div><div class="lvl">${lvl}</div></div>`;
      b.querySelector('.icon').textContent = def.icon;
      b.querySelector('.uname').textContent = def.name;
      b.querySelector('.effect').textContent = def.desc(lv);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); pick(id); });
      box.appendChild(b);
    });
    let done = false;
    const pick = (id) => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      this.upgradeOverlay.classList.add('hidden');
      onPick(id);
    };
    const onKey = (e) => {
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
      if (n !== undefined && cards[n]) { e.preventDefault(); e.stopPropagation(); pick(cards[n]); }
    };
    // small delay so a key/tap you were mashing during the boss fight doesn't pick by accident
    setTimeout(() => { if (!done) window.addEventListener('keydown', onKey, true); }, 350);
    box.style.pointerEvents = 'none';
    setTimeout(() => { box.style.pointerEvents = ''; }, 350);
    this.upgradeOverlay.classList.remove('hidden');
  }

  hidePicker() { this.upgradeOverlay.classList.add('hidden'); }

  // Little round badges under the health bar; the coloured ring drains as time runs out
  updatePowers(powers) {
    const seen = new Set();
    for (const p of powers) {
      seen.add(p.type);
      let b = this.badges.get(p.type);
      if (!b) {
        b = document.createElement('div');
        b.className = 'pw';
        b.style.setProperty('--c', '#' + p.color.toString(16).padStart(6, '0'));
        b.innerHTML = `<div class="pw-ring"><span class="pw-sec"></span></div><div class="pw-label">${p.label}</div>`;
        this.powerTray.appendChild(b);
        b._sec = b.querySelector('.pw-sec');
        this.badges.set(p.type, b);
      }
      const left = Math.round(p.left * 100) / 100;
      if (b._left !== left) { b._left = left; b.style.setProperty('--left', left); }
      const text = p.type === 'shield' ? `${p.hits}` : `${p.seconds}`;
      if (b._text !== text) { b._text = text; b._sec.textContent = text; }
      b.classList.toggle('ending', p.seconds <= 2);
    }
    for (const [type, b] of this.badges) {
      if (!seen.has(type)) { b.remove(); this.badges.delete(type); }
    }
  }

  // Short message in the middle of the screen, e.g. "SLOW-MO!"
  showToast(text, sub, color = '#3ff6e0') {
    this.toast.innerHTML = `<b></b><span></span>`;
    this.toast.querySelector('b').textContent = text;
    this.toast.querySelector('span').textContent = sub || '';
    this.toast.style.setProperty('--c', color);
    this.toast.classList.remove('show');
    void this.toast.offsetWidth;
    this.toast.classList.add('show');
  }

  // Draws the dark "pie" over an ability while it recharges, plus seconds left
  setCooldown(key, els, remaining, max) {
    const shown = remaining > 0 ? Math.ceil(remaining * 10) : 0; // only redraw every 0.1s
    if (this.last[key] === shown) return;
    this.last[key] = shown;
    for (const el of els) {
      el.style.setProperty('--cd', remaining / max);
      el.classList.toggle('ready', remaining <= 0);
      el.querySelector('.cd-text').textContent = remaining > 0 ? (remaining >= 1 ? Math.ceil(remaining) : remaining.toFixed(1)) : '';
    }
  }

  showBanner(text, sub = '') {
    this.bannerText.textContent = text;
    this.bannerSub.textContent = sub;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // trick to restart the CSS animation
    this.banner.classList.add('show');
  }

  flashDamage() {
    this.damage.classList.add('on');
    clearTimeout(this.damageTimeout);
    this.damageTimeout = setTimeout(() => this.damage.classList.remove('on'), 60);
  }

  showTitle(best) {
    $('best-text').textContent = best.score > 0 ? `Best: ${best.score.toLocaleString()} pts (wave ${best.wave})` : '';
    this.overlay.classList.remove('hidden');
    this.titlePanel.classList.remove('hidden');
    this.gameoverPanel.classList.add('hidden');
  }

  showGameOver(score, wave, kills, best, newBest, killer = null, place = null, loadout = null) {
    const build = loadout && loadout.tier > 0
      ? `<span class="build">Tier ${loadout.tier} talons · ${loadout.picked.map((p) => `${p.name} ${p.level}`).join(', ')}</span><br>` : '';
    $('gameover-score').textContent = `${score.toLocaleString()} pts`;
    $('gameover-stats').innerHTML =
      `Reached <b>wave ${wave}</b>${place ? ` in ${place}` : ''} · <b>${kills}</b> kills<br>` +
      (killer ? `<span class="killer">Killed by ${killer}</span><br>` : '') + build +
      (newBest ? '<b style="color:#3ff6e0">NEW BEST SCORE!</b>' : `Best: ${best.score.toLocaleString()} pts (wave ${best.wave})`);
    this.overlay.classList.remove('hidden');
    this.titlePanel.classList.add('hidden');
    this.gameoverPanel.classList.remove('hidden');
    this.bossBar.classList.add('hidden');
    this.last.showBoss = false;
  }

  hideOverlay() { this.overlay.classList.add('hidden'); }
}

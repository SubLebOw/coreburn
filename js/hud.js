// hud.js
// Updates the on-screen HTML: health bar, score/wave/kill counters, cooldowns,
// the boss health bar, banners like "WAVE 2", the red damage flash, the active
// power-ups (with timers), and the title / game over screens.

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
    this.badges = new Map(); // power-up type -> its badge element
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
    this.setCooldown('dash', this.dashEls, player.dashCooldown, player.dashCooldownMax);
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
  }

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

  showGameOver(score, wave, kills, best, newBest, killer = null, place = null) {
    $('gameover-score').textContent = `${score.toLocaleString()} pts`;
    $('gameover-stats').innerHTML =
      `Reached <b>wave ${wave}</b>${place ? ` in ${place}` : ''} · <b>${kills}</b> kills<br>` +
      (killer ? `<span class="killer">Killed by ${killer}</span><br>` : '') +
      (newBest ? '<b style="color:#3ff6e0">NEW BEST SCORE!</b>' : `Best: ${best.score.toLocaleString()} pts (wave ${best.wave})`);
    this.overlay.classList.remove('hidden');
    this.titlePanel.classList.add('hidden');
    this.gameoverPanel.classList.remove('hidden');
    this.bossBar.classList.add('hidden');
    this.last.showBoss = false;
  }

  hideOverlay() { this.overlay.classList.add('hidden'); }
}

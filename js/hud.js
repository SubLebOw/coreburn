// hud.js
// Updates the on-screen HTML: health bar, score/wave/kill counters, cooldowns,
// the boss health bar, banners like "WAVE 2", the red damage flash, the active
// power-ups (with timers), and the title / game over screens.

import { MASTERIES, masteryPoints, spentOn, getMastery, openMasteryPanel } from './mastery.js?v=1.31.0';
import { UPGRADES, FALLBACK, GROUP_LABELS, groupLabel, weaponMult, tierColor } from './upgrades.js?v=1.31.0';
import { HERO_STATS } from './hero-stats.js?v=1.31.0';
import { sound } from './audio.js?v=1.31.0';
import { RULES, Z_TUNING } from './rules.js?v=1.31.0';
const zab = (x) => (RULES.z && x.z ? { ...x, ...x.z } : x); // CoreBurnZ ability overrides (Orin's Gravity Well)
import { xpNeeded, heroReward } from './progress.js?v=1.31.0';

const $ = (id) => document.getElementById(id);
const formatSecs = (sec) => { const m = Math.floor(sec / 60), s = sec - m * 60; return `${m}:${s.toFixed(1).padStart(4, '0')}`; };
// the locked secret hero's silhouette (a hooded machine with hooked talons and pipes)
const SILHOUETTE = '<svg viewBox="0 0 60 60" width="46" height="46"><g fill="#000"><rect x="19" y="4" width="22" height="18" rx="3"/><rect x="15" y="18" width="30" height="4"/><rect x="17" y="23" width="26" height="20" rx="2"/><rect x="12" y="23" width="6" height="16"/><rect x="42" y="23" width="6" height="16"/><path d="M11 39 q-5 8 2 14 l1-3 q-4-5 0-10z"/><path d="M49 39 q5 8 -2 14 l-1-3 q4-5 0-10z"/><rect x="20" y="43" width="8" height="14"/><rect x="32" y="43" width="8" height="14"/><rect x="22" y="0" width="3" height="10"/><rect x="28" y="0" width="3" height="8"/><rect x="34" y="1" width="3" height="9"/></g><rect x="31" y="10" width="4" height="3" fill="#ff4a5a"/></svg>';

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
    if (this.last.kit !== player.char.id) { this.last.kit = player.char.id; this.setKit(player.char); }
    const ch = player.maxCharges > 1 ? player.dashCharges : -1;
    if (this.last.charges !== ch) {
      this.last.charges = ch;
      for (const el of this.dashEls) el.querySelector('.pips').textContent = ch >= 0 ? '●'.repeat(ch) + '○'.repeat(Math.max(0, player.maxCharges - ch)) : '';
    }
    this.setCooldown('dash', this.dashEls, player.dashCooldownShown, player.dashCooldownMax);
    this.setCooldown('spin', this.spinEls, player.spinCooldown, player.spinCooldownMax);
    // CoreBurnZ: Zaleks' RAGE bar on the Seismic Slam button
    const flow = RULES.z && player.kit === 'sarrow';
    const rage = RULES.z && player.kit === 'zaleks' ? Math.round(player.rageFrac * 50) : flow ? (player.flow || 0) * 10 : -1; // Zaleks RAGE / Sarrow FLOW
    if (this.last.rage !== rage) {
      this.last.rage = rage;
      for (const el of this.spinEls) {
        let bar = el.querySelector('.rage');
        if (!bar) { bar = document.createElement('span'); bar.className = 'rage'; bar.innerHTML = '<i></i><b>RAGE</b>'; el.appendChild(bar); }
        bar.querySelector('b').textContent = flow ? 'FLOW ' + '●'.repeat(player.flow || 0) + '○'.repeat(5 - (player.flow || 0)) : 'RAGE';
        bar.classList.toggle('flow', flow);
        bar.style.display = rage < 0 ? 'none' : '';
        bar.querySelector('i').style.width = `${Math.max(0, rage) * 2}%`;
        bar.classList.toggle('full', rage >= 50);
        el.classList.toggle('quake', rage >= 50 && !flow);
      }
    }

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
  showPicker(cards, loadout, onPick, boss = false, handle = {}) {
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const tc = hex(tierColor(loadout.tier + 1));
    $('upgrade-title').textContent = boss ? 'BOSS RELIC' : 'CHOOSE AN UPGRADE';
    $('upgrade-hint').textContent = 'Press 1, 2 or 3 · or click a card';
    this.upgradeOverlay.classList.remove('select');
    this.upgradeOverlay.classList.toggle('boss', boss); // CoreBurnZ: gold boss relic pick
    $('upgrade-sub').innerHTML = boss ? 'A rare relic torn from the fallen boss. One per boss kill (no weapon tier).'
      : `Weapon <b style="--c:${tc}">Tier ${loadout.tier} → ${loadout.tier + 1}</b> · base damage x${weaponMult(loadout.tier + 1).toFixed(2)} · plus your pick:`;
    const box = $('upgrade-cards');
    box.innerHTML = '';
    cards.forEach((id, i) => {
      const def = loadout.def(id);
      const cursed = def.group === 'cursed';
      const lv = loadout.level(id);
      const b = document.createElement('button');
      b.className = 'ucard' + (cursed ? ' cursed' : '') + (def.group === 'boss' ? ' relic' : '') + (def.group === 'evolved' ? ' evolved' : '') + (def.group === 'mythic' ? ' mythic' : '');
      b.style.setProperty('--c', hex(def.color));
      const lvl = def.group === 'mythic' ? `<b>MYTHIC</b> · ${Object.keys(loadout.levels).filter((k) => loadout.def(k)?.group === 'mythic').length}/3 held` : def.group === 'evolved' ? `<b>EVOLUTION</b> · ${def.needs.map((n) => loadout.def(n).name).join(' + ')}` : def.group === 'boss' ? (lv ? `Relic ${lv} → <b>${lv + 1}</b>/${def.max}` : '<b>RARE</b> · boss relic') : cursed ? `<b>CURSED</b> · ${def.bane}` : id === 'patch' ? `Taken ${lv}x` : (lv === 0 ? `<b>NEW</b> · Lv 1/${def.max}` : `Lv ${lv} → <b>${lv + 1}</b>/${def.max}`);
      b.innerHTML = `<span class="key">${i + 1}</span><div class="icon"></div><div class="ubody"><div class="group">${def.group === 'cursed' || def.group === 'boss' || def.group === 'evolved' || def.group === 'mythic' ? GROUP_LABELS[def.group] : groupLabel(def.group, HERO_STATS[loadout.hero]?.abilities)}</div><div class="uname"></div><div class="effect"></div><div class="lvl">${lvl}</div></div>`;
      b.querySelector('.icon').textContent = def.icon;
      b.querySelector('.uname').textContent = def.name;
      b.querySelector('.effect').textContent = def.desc(lv);
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); pick(id); });
      b.addEventListener('animationend', (e) => { if (e.target === b && e.animationName === 'cardin') b.classList.add('in'); });
      setTimeout(() => b.classList.add('in'), 700); // safety net if animationend never fires
      box.appendChild(b);
    });
    void box.offsetWidth; // force layout now so every card (incl. the first) gets painted
    if (cards.some((id) => loadout.def(id)?.group === 'mythic')) sound.play('mythic'); // distinct Mythic chime
    // COREBURNZ REROLL: swap all 3 cards (2 per run, each player their own)
    const rr = this.rerollHook;
    document.querySelectorAll('.reroll-btn').forEach((x) => x.remove());
    if (RULES.z && rr && loadout.rerolls > 0) {
      const b = document.createElement('button');
      b.className = 'big-btn reroll-btn';
      b.innerHTML = `⟳ REROLL <small>${loadout.rerolls} left</small>`;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); if (done) return; done = true; window.removeEventListener('keydown', onKey, true); rr(boss, handle); });
      box.after(b);
    }
    let done = false;
    const pick = (id) => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      this.upgradeOverlay.classList.add('hidden');
      document.querySelectorAll('.reroll-btn').forEach((x) => x.remove());
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
    handle.pickIndex = (i) => cards[i] && pick(cards[i]); // Streamer Mode: chat's winning card
    handle.cards = cards;
    return handle;
  }

  // Character select (before every run). Same overlay + card style as the upgrade picker.
  // onBack (optional): the BACK button / Escape return to the main menu.
  showSelect(chars, current, onPick, onBack) {
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    $('upgrade-title').textContent = 'CHOOSE YOUR HERO';
    this.upgradeOverlay.classList.remove('boss');
    $('upgrade-sub').textContent = `Same 3 buttons, ${chars.length} different kits. Pick one for this run:`;
    $('upgrade-hint').textContent = `Press 1-${chars.length} · ← → and Enter · or click a hero`;
    const box = $('upgrade-cards');
    box.innerHTML = '';
    const info = $('sc-info'); info.innerHTML = ''; // showcase info panel: the selected hero's details live here
    let sel = Math.max(0, chars.findIndex((c) => c.id === current));
    const bar = (label, v) => `<div class="sbar"><span>${label}</span><i><b style="width:${Math.round(Math.min(1, v) * 100)}%"></b></i></div>`;
    const els = chars.map((c, i) => {
      const b = document.createElement('button');
      if (c.locked) { // the secret hero: a dark silhouette until it's unlocked
        b.className = 'ucard hero locked';
        b.innerHTML = `<span class="key">${i + 1}</span><div class="icon sil">${SILHOUETTE}</div><div class="tname">${c.secret ? '???' : c.name}</div><div class="ubody"><div class="group">${c.secret ? 'SECRET HERO' : 'LOCKED HERO'}</div><div class="uname">${c.secret ? '???' : c.name}</div><div class="effect">🔒 ${c.unlockHint}</div></div>`;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); });
        box.appendChild(b);
        return b;
      }
      b.className = 'ucard hero';
      b.style.setProperty('--c', hex(c.color));
      const range = { sarrow: 0.3, zaleks: 0.25, iskra: 1, orin: 0.6, ninja: 0.85, axiom: 0.9 }[c.id] ?? 0.5;
      const kit = c.abilities ? ['attack', 'mobility', 'ultimate'].map((k, j) =>
        `<div class="kslot"><b>${zab(c.abilities[k]).icon} ${zab(c.abilities[k]).name}</b> <span>${['J', 'K', 'L'][j]}</span><i>${(RULES.z && c.abilities[k].zdesc) || zab(c.abilities[k]).desc}</i></div>`).join('') : '';
      b.innerHTML = `<span class="key">${i + 1}</span><div class="icon">⬢</div><div class="tname">${c.name}</div><div class="ubody"><div class="group"></div><div class="uname"></div><div class="effect"></div>` +
        `<div class="kit">${kit}</div><div class="stats">${bar('HEALTH', c.hp / 200)}${bar('SPEED', c.speed / 8.3)}${bar('RANGE', range)}</div></div>`;
      b.querySelector('.group').innerHTML = `<span class="ptag">${c.tag}</span> ${c.title.toUpperCase()}`;
      b.querySelector('.uname').textContent = c.name;
      b.querySelector('.effect').textContent = c.blurb;
      if (c.save) { const sb = document.createElement('div'); sb.className = 'save-badge'; sb.textContent = `SAVED · WAVE ${c.save.wave}`; b.appendChild(sb); b.classList.add('has-save'); }
      if (c.hlv) { // CoreBurnZ: this hero's own level + the next reward
        const h = c.hlv, d = document.createElement('div');
        d.className = 'hlvl';
        const next = h.max ? 'MAX LEVEL' : `next: ${heroReward(c.id, h.level + 1).join(', ')}`;
        d.innerHTML = `<span>HERO LV <b>${h.level}</b></span><i><b style="width:${h.max ? 100 : Math.round(100 * h.xp / h.need)}%"></b></i><small></small>`;
        d.querySelector('small').textContent = next;
        const mb = document.createElement('button'); // CoreBurnZ: open this hero's mastery tree
        mb.className = 'mbtn'; mb.dataset.hero = c.id;
        const pts = masteryPoints(h.level), used = spentOn(c.id, getMastery(c.id, h.level));
        mb.innerHTML = `✦ MASTERY <em>${pts - used > 0 ? pts - used + ' pt' + (pts - used > 1 ? 's' : '') + ' free' : used + '/' + pts}</em>`;
        mb.addEventListener('pointerdown', (e) => e.stopPropagation());
        mb.addEventListener('click', (e) => { e.stopPropagation(); openMasteryPanel(c.id, c.name, hex(c.color), h.level, () => this.showSelect(chars, chars[sel]?.id || current, onPick, onBack)); window.removeEventListener('keydown', onKey, true); });
        d.appendChild(mb);
        b.querySelector('.ubody').insertBefore(d, b.querySelector('.kit'));
      }
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); if (i === sel) { if (performance.now() - selAt > 450) pick(i); } else { sel = i; selAt = performance.now(); mark(); } }); // tap = preview, tap again (or SELECT) = go; a quick double-tap on a new hero only previews
      box.appendChild(b);
      return b;
    });
    let selAt = 0;
    const bodies = els.map((b) => b.querySelector('.ubody'));
    const mark = () => {
      els.forEach((b, i) => b.classList.toggle('sel', i === sel));
      bodies.forEach((u, i) => { if (i !== sel && u.parentNode !== els[i]) els[i].appendChild(u); });
      if (chars[sel] && !chars[sel].locked) {
        info.style.setProperty('--c', hex(chars[sel].color));
        info.appendChild(bodies[sel]);
        this.onSelectHero?.(chars[sel]);
      }
    };
    $('sc-go').onpointerdown = (e) => e.stopPropagation();
    $('sc-go').onclick = (e) => { e.stopPropagation(); pick(sel); };
    mark();
    let done = false;
    const pick = (i) => {
      if (done || !chars[i] || chars[i].locked) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      this.upgradeOverlay.classList.add('hidden');
      backBtn.onclick = null;
      onPick(chars[i].id);
    };
    const backBtn = $('sel-back-btn');
    backBtn.classList.toggle('on', !!onBack);
    const back = () => {
      if (done || !onBack) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      backBtn.onclick = null;
      this.upgradeOverlay.classList.add('hidden');
      this.upgradeOverlay.classList.remove('select');
      onBack();
    };
    backBtn.onpointerdown = (e) => e.stopPropagation();
    backBtn.onclick = (e) => { e.stopPropagation(); back(); };
    const onKey = (e) => {
      if (document.body.classList.contains('mastery-open')) return;
      if (e.repeat) return; // a key held down from the last run must not pick a hero
      if (e.code === 'Escape' && onBack) { e.preventDefault(); e.stopPropagation(); back(); return; }
      const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4 }[e.code];
      if (n !== undefined) { e.preventDefault(); e.stopPropagation(); pick(n); return; }
      const open = chars.map((c, i) => i).filter((i) => !chars[i].locked);
      const step = (d) => { sel = open[(open.indexOf(sel) + d + open.length) % open.length]; mark(); };
      if (['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(e.code)) step(-1);
      else if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(e.code)) step(1);
      else if (['Enter', 'Space', 'KeyJ', 'NumpadEnter'].includes(e.code)) { pick(sel); }
      else return;
      e.preventDefault(); e.stopPropagation();
    };
    setTimeout(() => { if (!done) window.addEventListener('keydown', onKey, true); }, 250);
    box.style.pointerEvents = 'none';
    setTimeout(() => { box.style.pointerEvents = ''; }, 250);
    this.upgradeOverlay.classList.add('select');
    this.upgradeOverlay.classList.remove('hidden');
  }

  // SAVED RUN prompt (v1.30.0): CONTINUE wave N, or NEW RUN (two taps: it overwrites the save)
  showContinue(c, sv, onContinue, onNew, onBack) {
    let ov = document.getElementById('continue-overlay');
    if (!ov) { ov = document.createElement('div'); ov.id = 'continue-overlay'; document.body.appendChild(ov); for (const ev of ['pointerdown', 'click']) ov.addEventListener(ev, (e) => e.stopPropagation()); }
    const hex = '#' + c.color.toString(16).padStart(6, '0');
    const mins = Math.floor((sv.runClock || 0) / 60), secs = String(Math.floor((sv.runClock || 0) % 60)).padStart(2, '0');
    const cards = Object.values(sv.levels || {}).filter((v) => v > 0).length;
    ov.innerHTML = `<div class="pause-panel cont-panel" style="--c:${hex}"><h2>${c.name}</h2><div class="pause-sub">Saved run · ${RULES.z ? 'CoreBurnZ' : 'Classic'}</div>
      <div class="cont-stats"><span><b>${sv.wave}</b>WAVE</span><span><b>${Math.round(sv.score).toLocaleString()}</b>SCORE</span><span><b>${cards}</b>CARDS</span><span><b>${mins}:${secs}</b>TIME</span></div>
      <button class="big-btn cont-go">&#9654; CONTINUE <small>wave ${sv.wave}</small></button>
      <button class="big-btn cont-new">&#8635; NEW RUN <small>overwrites this save</small></button>
      <button class="big-btn cont-back">&#8592; BACK</button></div>`;
    ov.classList.remove('hidden');
    let armed = false, done = false;
    const close = (fn) => { if (done) return; done = true; ov.classList.add('hidden'); window.removeEventListener('keydown', onKey, true); fn(); };
    const newBtn = ov.querySelector('.cont-new');
    ov.querySelector('.cont-go').addEventListener('click', () => close(onContinue));
    ov.querySelector('.cont-back').addEventListener('click', () => close(onBack));
    newBtn.addEventListener('click', () => {
      if (!armed) { armed = true; newBtn.classList.add('armed'); newBtn.innerHTML = `&#9888; TAP AGAIN TO CONFIRM <small>wave ${sv.wave} save will be lost</small>`; return; }
      close(onNew);
    });
    const onKey = (e) => {
      if (e.repeat) return;
      if (['Enter', 'NumpadEnter', 'Space', 'KeyJ'].includes(e.code)) { e.preventDefault(); e.stopPropagation(); close(onContinue); }
      else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(onBack); }
    };
    setTimeout(() => { if (!done) window.addEventListener('keydown', onKey, true); }, 250);
  }

  // MILESTONE popup (bottom centre). big = the secret hero unlock
  showMilestone(name, reward, big = false) {
    const el = $('milestone');
    el.innerHTML = '<small>MILESTONE</small><b></b><span></span>';
    el.querySelector('b').textContent = name;
    el.querySelector('span').textContent = reward;
    el.classList.toggle('big', big);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  setHeroName(name, color) {
    document.querySelector('#hud-top-left .name').textContent = name;
    document.querySelector('.emblem-core').setAttribute('fill', '#' + color.toString(16).padStart(6, '0'));
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
      const charges = p.type === 'shield' && RULES.z; // COREBURNZ: shield charges (max 2)
      const text = charges ? '◆'.repeat(p.hits) + '◇'.repeat(Math.max(0, Z_TUNING.shieldMax - p.hits)) : p.type === 'shield' ? `${p.hits}` : `${p.seconds}`;
      if (b._text !== text) { b._text = text; b._sec.textContent = text; b.classList.toggle('charges', charges); if (charges) b.querySelector('.pw-label').textContent = 'SHIELD x' + p.hits; }
      b.classList.toggle('ending', !charges && p.seconds <= 2);
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

  // Each hero names (and draws) the 3 ability slots differently
  setKit(c) {
    let a = c.abilities;
    if (!a) return;
    const flat = (t) => t.replace(/<br>/g, ' ');
    const Z = (x) => (RULES.z && x.z ? { ...x, ...x.z } : x);
    a = { attack: Z(a.attack), mobility: Z(a.mobility), ultimate: Z(a.ultimate) };
    for (const [id, slot] of [['ab-dash', a.mobility], ['ab-spin', a.ultimate]]) {
      const el = $(id);
      el.querySelector('.label').textContent = flat(slot.short);
      el.querySelector('.aicon').textContent = slot.icon;
      el.title = `${slot.name}: ${(RULES.z && slot.zdesc) || slot.desc}`;
    }
    const icon = (t) => `<span class="ticon">${t}</span>`;
    $('btn-slash').innerHTML = icon(a.attack.icon) + flat(a.attack.short);
    $('btn-dash').querySelector('.lbl').innerHTML = icon(a.mobility.icon) + a.mobility.short;
    $('btn-spin').querySelector('.lbl').innerHTML = icon(a.ultimate.icon) + a.ultimate.short;
    this.last.dash = this.last.spin = undefined;
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

  showBanner(text, sub = '', color = null) {
    this.banner.style.setProperty('--bc', color || '');
    this.banner.classList.toggle('tinted', !!color);
    this.bannerText.textContent = text;
    this.bannerSub.textContent = sub;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // trick to restart the CSS animation
    this.banner.classList.add('show');
  }

  // MUTATOR tag under the score (null = clear it; undefined = leave it alone)
  setMutator(mut) {
    if (mut === undefined) return;
    const el = $('mutator-tag');
    el.classList.toggle('hidden', !mut);
    if (mut) { el.textContent = mut.name; el.style.setProperty('--c', mut.color); }
  }

  // Game over: "+123 SCRAP" (and any rare drops)
  showScrap(gain, total, drops = [], doubled = false) {
    const el = $('gameover-scrap');
    el.innerHTML = `<b>+${gain} SCRAP</b>${doubled ? ' <i>DOUBLED!</i>' : ''} <span>· you have ${total.toLocaleString()}</span>` +
      (drops.length ? `<div class="rare">Rare drop: ${drops.map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')}! (equip it in the shop)</div>` : '');
    el.classList.remove('hidden');
  }

  // Ranked mode tag under the wave counter ('' = hide)
  setModeTag(text) {
    const el = $('mode-tag');
    el.textContent = text;
    el.classList.toggle('hidden', !text);
  }

  showRushResult(won, bosses, seconds, week) {
    $('gameover-stats').innerHTML = $('gameover-stats').innerHTML.replace(/(<br>)?(<b[^>]*>NEW BEST SCORE!<\/b>|Best: [^<]*)$/, ''); // endless best isn't relevant here
    $('gameover-score').textContent = won ? `CLEARED in ${formatSecs(seconds)}` : `${bosses}/7 bosses · ${formatSecs(seconds)}`;
    document.querySelector('#gameover-panel h1').textContent = won ? 'RUSH CLEARED!' : 'CORE OFFLINE';
    $('gameover-mode').textContent = `WEEKLY BOSS RUSH · ${week}`;
    $('gameover-mode').classList.remove('hidden');
  }

  showDailyResult(day) {
    $('gameover-stats').innerHTML = $('gameover-stats').innerHTML.replace(/(<br>)?(<b[^>]*>NEW BEST SCORE!<\/b>|Best: [^<]*)$/, ''); // endless best isn't relevant here
    $('gameover-mode').textContent = `DAILY CHALLENGE · ${day}`;
    $('gameover-mode').classList.remove('hidden');
  }

  // Leaderboard result on the game over screen (+ name entry until you have a name)
  showRanks(res, run, name, rushLabel) {
    const board = { daily: 'today\'s daily', rush: 'this week\'s boss rush' }[run.mode] || 'all heroes';
    const main = res.local[0];
    let text = main && main.rank ? `#${main.rank} on this device (${board})` : '';
    if (res.local[1] && res.local[1].rank) text += ` · #${res.local[1].rank} with this hero`;
    const on = res.online === 'ok' ? ' · sent to the online leaderboard' : res.online === 'off' ? ''
      : /^rejected/.test(res.online) ? 'Not ranked: this run failed the sanity check' : ` · online: ${res.online}`;
    $('lb-result').textContent = text + on;
    $('lb-result').classList.toggle('hidden', !text && !on);
    $('lb-name-row').classList.toggle('hidden', !!name);
  }

  // CLOSE CALL: its own callout, low and centred so it never fights the wave banner
  closeCall(sub) {
    const el = $('closecall');
    el.querySelector('span').textContent = sub;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  flashDamage() {
    this.damage.classList.add('on');
    clearTimeout(this.damageTimeout);
    this.damageTimeout = setTimeout(() => this.damage.classList.remove('on'), 60);
  }

  showTitle(best) {
    $('best-text').textContent = best.score > 0 ? `Best: ${best.score.toLocaleString()} pts (wave ${best.wave})` : '';
    this.refreshScrap?.();
    this.overlay.classList.remove('hidden');
    this.titlePanel.classList.remove('hidden');
    this.gameoverPanel.classList.add('hidden');
  }

  // ACCOUNT XP on the game over screen: +XP, the level bar, and anything that just unlocked
  showXp(res, progress, heroRes = null) {
    const el = $('gameover-xp');
    const need = xpNeeded(progress.level);
    const pct = need ? Math.round(100 * progress.xp / need) : 100;
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let html = `<div class="xp-line"><b>+${res.gained} XP</b> · LEVEL ${progress.level}${res.levels.length ? ' <em>LEVEL UP!</em>' : ''}<i><b style="width:${pct}%"></b></i></div>`;
    html += res.unlocks.map((u) => `<div class="xp-unlock">UNLOCKED · <b>${esc(u)}</b></div>`).join('');
    if (heroRes) {
      const hi = progress.heroInfo(heroRes.hero);
      html += `<div class="xp-line hero"><b>${esc(HERO_STATS[heroRes.hero]?.name || heroRes.hero)}</b> HERO LEVEL ${hi.level}${heroRes.levels.length ? ' <em>LEVEL UP!</em>' : ''}<i><b style="width:${hi.max ? 100 : Math.round(100 * hi.xp / hi.need)}%"></b></i></div>`;
      html += heroRes.unlocks.map((u) => `<div class="xp-unlock hero">HERO REWARD · <b>${esc(u)}</b></div>`).join('');
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  // RUN TIMER (mm:ss, top right)
  setTimer(sec) {
    this.timerValue = sec;
    const s = Math.floor(sec);
    if (this.last.timer === s) return;
    this.last.timer = s;
    const el = this.timerEl || (this.timerEl = $('run-timer'));
    if (el) el.textContent = fmtTime(s);
  }

  showGameOver(score, wave, kills, best, newBest, killer = null, place = null, loadout = null, bestCombo = 0, hero = 'Sarrow') {
    const build = loadout && loadout.tier > 0
      ? `<span class="build">Weapon tier ${loadout.tier} · ${loadout.picked.map((p) => `${p.name} ${p.level}`).join(', ')}</span><br>` : '';
    $('gameover-score').textContent = `${score.toLocaleString()} pts`;
    $('gameover-stats').innerHTML =
      `<b>${hero}</b> reached <b>wave ${wave}</b>${place ? ` in ${place}` : ''} · <b>${kills}</b> kills · best combo <b>${bestCombo}</b><br>` +
      `<span class="runtime">Time <b>${fmtTime(this.timerValue || 0)}</b></span><br>` +
      (killer ? `<span class="killer">Killed by ${killer}</span><br>` : '') + build +
      (newBest ? '<b style="color:#3ff6e0">NEW BEST SCORE!</b>' : `Best: ${best.score.toLocaleString()} pts (wave ${best.wave})`);
    $('gameover-scrap').classList.add('hidden');
    $('gameover-xp').classList.add('hidden');
    $('gameover-mode').classList.add('hidden');
    $('lb-result').classList.add('hidden');
    $('lb-name-row').classList.add('hidden');
    document.querySelector('#gameover-panel h1').textContent = 'CORE OFFLINE';
    this.setMutator(null);
    this.overlay.classList.remove('hidden');
    this.titlePanel.classList.add('hidden');
    this.gameoverPanel.classList.remove('hidden');
    this.bossBar.classList.add('hidden');
    this.last.showBoss = false;
  }

  // COMBO counter: big number + multiplier, a draining timer bar, a pop on tier-up, colour per tier
  updateCombo(combo, playing) {
    if (!this.combo) {
      this.combo = $('combo'); this.comboCount = $('combo-count'); this.comboMult = $('combo-mult');
      this.comboFill = $('combo-fill'); this.comboCall = $('combo-callout'); this.comboLast = {};
    }
    const L = this.comboLast;
    for (const ev of combo.events) {
      if (ev.type === 'tierUp') { this.combo.classList.remove('pop'); void this.combo.offsetWidth; this.combo.classList.add('pop'); }
      if (ev.type === 'callout') {
        this.comboCall.textContent = ev.text;
        this.comboCall.classList.remove('show'); void this.comboCall.offsetWidth; this.comboCall.classList.add('show');
      }
    }
    combo.events.length = 0;
    const show = playing && combo.count > 0;
    if (L.show !== show) { L.show = show; this.combo.classList.toggle('visible', show); }
    if (L.count !== combo.count) { L.count = combo.count; this.comboCount.textContent = combo.count; }
    if (L.mult !== combo.mult) {
      L.mult = combo.mult;
      this.comboMult.textContent = 'x' + combo.mult;
      this.combo.style.setProperty('--combo-hue', String([175, 190, 50, 30, 300, 350, 0, 0][combo.mult - 1] ?? 0));
      this.combo.dataset.mult = combo.mult;
    }
    this.comboFill.style.transform = `scaleX(${combo.fraction.toFixed(3)})`;
  }

  hideOverlay() { this.overlay.classList.add('hidden'); }
}

export function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); }

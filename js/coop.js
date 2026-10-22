// coop.js
// Online co-op for 2-4 players (see net.js for the connection itself).
//
// HOST-AUTHORITATIVE: the host's game is the real one. It runs every enemy, boss, bolt, hazard and
// power-up, and every hero's damage. Each friend's device:
//   - runs its OWN hero's movement and animations locally (so it feels instant), and sends its
//     stick/buttons + position to the host ~20 times a second;
//   - receives ~15 snapshots a second (heroes, enemies, bosses, bolts, pickups, score, combo) and
//     smoothly moves "puppet" copies towards them (interpolation), plus a list of effects/sounds/
//     banners to replay so it looks and sounds the same.
//
// Rules: enemies get more numerous and tougher per player, bosses switch targets every few seconds,
// a downed hero is revived by a teammate standing next to them for 3 seconds, and the run ends when
// everyone is down. Score and combo are shared; upgrade picks and power-ups are per player.
import { disposeModel } from './hero-models.js?v=1.31.1';
import { applyAffixVisuals } from './affixes.js?v=1.31.1';
import { cleanMastery } from './mastery.js?v=1.31.1';
import { synergiesFor, showSynergyPopup } from './synergy.js?v=1.31.1';
import * as THREE from 'three';
import { NetHost, NetClient, normalizeCode, MAX_PLAYERS } from './net.js?v=1.31.1';
import { Player } from './player.js?v=1.31.1';
import { Enemy } from './enemy.js?v=1.31.1';
import { bossForNumber } from './bosses.js?v=1.31.1';
import { RULES, setRules } from './rules.js?v=1.31.1';
import { makeGolden } from './golden.js?v=1.31.1';
import { meta } from './meta.js?v=1.31.1';
import { waveStats } from './waves.js?v=1.31.1';
import { CHARACTERS, ALL_HEROES, DUPLICATE_TINTS, displayName } from './characters.js?v=1.31.1';
import { GAME_VERSION } from './version.js?v=1.31.1';
import { cleanLook } from './progress.js?v=1.31.1';

const SNAP_RATE = 15;   // host -> friends, per second
const INPUT_RATE = 20;  // friend -> host, per second
const REVIVE_TIME = 3;  // seconds standing next to a downed teammate
const REVIVE_RANGE = 2.4;
const PICK_TIMEOUT = 30;
const $ = (id) => document.getElementById(id);
const r2 = (v) => Math.round(v * 100) / 100;

// Co-op difficulty: more enemies and more health per extra player
export function coopScaling(n) {
  return { count: 1 + 0.5 * (n - 1), hp: 1 + 0.4 * (n - 1), bossHp: 1 + 0.6 * (n - 1) };
}

// Tint + display name for each roster slot (duplicates of the same hero get a colour tint)
function assignLooks(roster) {
  const seen = {};
  for (const r of roster) {
    const k = seen[r.char] = (seen[r.char] || 0) + 1;
    r.dup = k - 1;
    r.tint = DUPLICATE_TINTS[r.dup] || null;
    r.name = displayName(CHARACTERS[r.char], r.dup);
  }
  return roster;
}

// What a friend's buttons look like to the host's copy of their hero (same API as input.js)
class RemoteInput {
  constructor() { this.move = { x: 0, y: 0 }; this.pressed = {}; this.attackHeld = false; }
  getMove() { return this.move; }
  wasPressed(name) { return !!this.pressed[name]; }
  endFrame() { this.pressed = {}; }
}

const ser = (a) => (a && a.isVector3 ? { v: [r2(a.x), r2(a.y), r2(a.z)] } : a);
const deser = (a) => (a && a.v ? new THREE.Vector3(a.v[0], a.v[1], a.v[2]) : a);

export class Coop {
  constructor(ctx) {
    this.ctx = ctx;      // main.js pieces: scene, camera, world, hud, sound, input, ...
    this.mode = null;    // null (solo) | 'host' | 'client'
    this.roster = [];
    this.myChar = localStorage.getItem('coreburn-hero') || 'sarrow';
    this.tags = new Map();
    this.buildUi();
  }

  get active() { return !!this.mode; }
  get world() { return this.ctx.world; }

  // ======================= MENU + LOBBY UI =======================
  buildUi() {
    this.panel = $('coop-panel');
    $('coop-btn').addEventListener('click', (e) => { e.stopPropagation(); this.openMenu(); });
    $('cp-back').addEventListener('click', () => this.closeMenu());
    $('cp-host').addEventListener('click', () => this.host());
    $('cp-join').addEventListener('click', () => this.join($('cp-code').value));
    $('cp-code').addEventListener('input', (e) => { e.target.value = normalizeCode(e.target.value); });
    $('cp-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') this.join(e.target.value); });
    $('cp-start').addEventListener('click', () => this.hostStart());
    // RULES: the host picks CLASSIC or COREBURNZ for the room; friends see it in the lobby
    for (const b of document.querySelectorAll('#cp-rules button')) b.addEventListener('click', () => {
      if (this.mode !== 'host') return;
      setRules(b.dataset.z === '1'); this.ctx.onRulesChanged?.();
      if (!RULES.z) for (const r of this.roster) if (CHARACTERS[r.char]?.zOnly) r.char = 'sarrow';
      this.rosterChanged();
    });
    $('cp-leave').addEventListener('click', () => this.leave());
    for (const el of [this.panel]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    const heroes = $('cp-heroes');
    for (const id of ALL_HEROES) {
      const c = CHARACTERS[id];
      const b = document.createElement('button');
      b.className = 'cp-hero';
      b.dataset.id = id;
      b.style.setProperty('--c', '#' + c.color.toString(16).padStart(6, '0'));
      b.innerHTML = `<b>⬢</b><span>${c.name}</span><small>${c.title}</small>`;
      b.addEventListener('click', () => this.chooseHero(id));
      if (c.secret || id === 'iskra' || id === 'ninja' || id === 'axiom') b.classList.add('secret-hero'); // locked heroes: shown once unlocked (unlocks.js)
      heroes.appendChild(b);
    }
  }

  status(text, error = false) {
    const s = $('cp-status');
    s.textContent = text || '';
    s.classList.toggle('error', !!error);
  }

  openMenu() {
    this.ctx.hud.hideOverlay();
    this.ctx.setState('lobby');
    document.querySelectorAll('.secret-hero').forEach((b) => b.classList.toggle('hidden', !meta.data.unlocked[b.dataset.id])); // secret hero: only once unlocked
    this.panel.classList.remove('hidden');
    $('cp-menu').classList.remove('hidden');
    $('cp-lobby').classList.add('hidden');
    this.status('');
  }

  closeMenu() {
    this.panel.classList.add('hidden');
    this.ctx.showTitle();
  }

  showLobby() {
    this.panel.classList.remove('hidden');
    $('cp-menu').classList.add('hidden');
    $('cp-lobby').classList.remove('hidden');
    $('cp-roomcode').textContent = this.code || '----';
    $('cp-start').classList.toggle('hidden', this.mode !== 'host');
    $('cp-wait').classList.toggle('hidden', this.mode === 'host');
    this.renderRoster();
  }

  renderRoster() {
    for (const b of document.querySelectorAll('#cp-rules button')) { b.classList.toggle('on', (b.dataset.z === '1') === RULES.z); b.disabled = this.mode !== 'host'; }
    const list = $('cp-roster');
    list.innerHTML = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const r = this.roster[i];
      const row = document.createElement('div');
      row.className = 'cp-row' + (r ? '' : ' empty');
      if (r) {
        const c = CHARACTERS[r.char];
        row.style.setProperty('--c', '#' + (r.tint || c.color).toString(16).padStart(6, '0'));
        row.innerHTML = `<b>P${i + 1}</b><span></span><small>${i === 0 ? 'HOST' : ''}${r.slot === this.mySlot ? (i === 0 ? ' · ' : '') + 'YOU' : ''}</small>`;
        row.querySelector('span').textContent = r.name + (r.look && r.look.t ? ` · ${r.look.t}` : ''); // their title
      } else row.innerHTML = `<b>P${i + 1}</b><span>waiting…</span>`;
      list.appendChild(row);
    }
    // KAGERO is CoreBurnZ only: hide him in classic (and swap anyone who had him back to Sarrow)
    if (!RULES.z && CHARACTERS[this.myChar]?.zOnly && this.mode) { this.chooseHero('sarrow'); return; }
    for (const b of document.querySelectorAll('.cp-hero')) { b.classList.toggle('sel', b.dataset.id === this.myChar); b.classList.toggle('hidden', !!CHARACTERS[b.dataset.id].zOnly && !RULES.z); }
    const n = this.roster.length;
    const start = $('cp-start');
    start.disabled = n < 2;
    start.textContent = n < 2 ? 'WAITING FOR PLAYERS…' : `START (${n} PLAYERS)`;
  }

  chooseHero(id) {
    this.myChar = id;
    localStorage.setItem('coreburn-hero', id);
    if (this.mode === 'host') { this.roster[0].char = id; this.rosterChanged(); }
    else if (this.mode === 'client') this.net.send({ t: 'sel', char: id, look: this.ctx.myLook(), mastery: this.ctx.myMastery?.(id) });
    this.renderRoster();
  }

  // ======================= HOSTING =======================
  async host() {
    this.status('Creating room…');
    $('cp-host').disabled = $('cp-join').disabled = true;
    try {
      const net = new NetHost();
      this.code = await net.open();
      this.net = net;
      this.mode = 'host';
      this.mySlot = 0;
      this.nextSlot = 1;
      this.roster = assignLooks([{ slot: 0, char: this.myChar }]);
      net.onJoin = (conn) => this.status('A player is joining…');
      net.onMessage = (conn, msg) => this.hostMessage(conn, msg);
      net.onLeave = (conn) => this.hostLeave(conn);
      net.onError = (m) => this.status(m, true);
      this.status('');
      this.showLobby();
    } catch (e) {
      this.status(e.message, true);
    } finally {
      $('cp-host').disabled = $('cp-join').disabled = false;
    }
  }

  // roster as sent over the wire: hero + each player's cosmetics/skin look
  rosterOut() {
    if (this.roster[0] && this.mode === 'host') this.roster[0].look = this.ctx.myLook();
    return this.roster.map(({ slot, char, look }) => ({ slot, char, look }));
  }
  lookOf(slot) { const r = this.roster.find((x) => x.slot === slot); return r ? r.look : null; }
  // (re)dress every friend's hero from their look (arena changes, look updates)
  dressOthers() {
    if (this.mode === 'host') { for (const h of this.heroes || []) if (h !== this.ctx.player) this.ctx.dressHero(h, cleanLook(this.lookOf(h.slot))); }
    else for (const h of this.puppets ? this.puppets.values() : []) this.ctx.dressHero(h, cleanLook(this.lookOf(h.slot)));
  }
  updateWardrobes(dt) {
    const list = this.mode === 'host' ? this.heroes : (this.puppets ? [...this.puppets.values()] : null);
    for (const h of list || []) if (h !== this.ctx.player && h.wardrobe) h.wardrobe.update(dt);
  }
  // you changed your cosmetics / skin setting: tell everyone
  sendLook() {
    if (!this.net) return;
    const look = this.ctx.myLook();
    if (this.mode === 'host') {
      if (this.roster[0]) this.roster[0].look = look;
      if (this.inGame) this.net.broadcast({ t: 'look', slot: 0, look }); else this.rosterChanged();
    } else if (this.mode === 'client') this.net.send({ t: 'look', look });
  }
  gotLook(slot, look) {
    const r = this.roster.find((x) => x.slot === slot); if (!r) return;
    r.look = cleanLook(look);
    const h = this.mode === 'host' ? this.heroBySlot(slot) : this.puppets && this.puppets.get(slot);
    if (h && h !== this.ctx.player) this.ctx.dressHero(h, r.look);
  }

  rosterChanged() {
    assignLooks(this.roster);
    this.net.broadcast({ t: 'lobby', code: this.code, z: RULES.z, roster: this.rosterOut() });
    this.renderRoster();
  }

  hostMessage(conn, msg) {
    switch (msg.t) {
      case 'hello': {
        if (msg.v !== GAME_VERSION) { this.net.send(conn, { t: 'bye', reason: `Version mismatch: host has v${GAME_VERSION}, you have v${msg.v}. Update the game.` }); return; }
        if (this.inGame || this.roster.length >= MAX_PLAYERS) { this.net.send(conn, { t: 'bye', reason: this.inGame ? 'That game has already started.' : 'That room is full.' }); return; }
        const slot = this.nextSlot++;
        conn.slot = slot;
        this.roster.push({ slot, char: CHARACTERS[msg.char] && (RULES.z || !CHARACTERS[msg.char].zOnly) ? msg.char : 'sarrow', conn, look: cleanLook(msg.look), mastery: msg.mastery });
        this.net.send(conn, { t: 'welcome', slot });
        this.rosterChanged();
        this.status('');
        this.ctx.sound.play('powerup');
        break;
      }
      case 'sel': {
        const r = this.roster.find((x) => x.slot === conn.slot);
        if (r && CHARACTERS[msg.char] && !this.inGame && (RULES.z || !CHARACTERS[msg.char].zOnly)) { r.char = msg.char; r.mastery = msg.mastery; if (msg.look) r.look = cleanLook(msg.look); this.rosterChanged(); }
        break;
      }
      case 'look': { // a friend changed cosmetics: keep it, redraw them, pass it on
        this.gotLook(conn.slot, msg.look);
        if (this.inGame) this.net.broadcast({ t: 'look', slot: conn.slot, look: this.lookOf(conn.slot) }); else this.rosterChanged();
        break;
      }
      case 'in': {
        const h = this.heroBySlot(conn.slot);
        if (!h) return;
        const ri = h.netInput;
        ri.move = { x: THREE.MathUtils.clamp(+msg.mx || 0, -1, 1), y: THREE.MathUtils.clamp(+msg.my || 0, -1, 1) };
        ri.attackHeld = !!msg.ah;
        if (msg.a) ri.pressed.attack = true;
        if (msg.d) ri.pressed.dash = true;
        if (msg.s) ri.pressed.spin = true;
        if (msg.ep === this.epoch && Number.isFinite(msg.x) && Number.isFinite(msg.z)) { h.reported.set(msg.x, 0, msg.z); h.reportedFacing = msg.f; h.hasReport = true; }
        break;
      }
      case 'reroll': { // CoreBurnZ: a friend rerolls their own cards (2 per run, counted here too)
        const h = this.heroBySlot(conn.slot);
        if (!RULES.z || !h || !h.pendingPick || !(h.loadout.rerolls > 0)) break;
        h.loadout.rerolls--;
        const boss = h.loadout.def(h.pendingPick[0])?.group === 'boss';
        h.pendingPick = boss ? h.loadout.rollBoss(3) : h.loadout.maybeMythic(h.loadout.roll(3), this.ctx.enemies?.wave || 0);
        this.net.send(conn, { t: 'pick', cards: h.pendingPick, boss });
        break;
      }
      case 'pick': {
        const h = this.heroBySlot(conn.slot);
        if (h && h.pendingPick && h.pendingPick.includes(msg.id)) this.applyRemotePick(h, msg.id);
        break;
      }
    }
  }

  hostLeave(conn) {
    const r = this.roster.find((x) => x.slot === conn.slot);
    if (!r) return;
    this.roster = this.roster.filter((x) => x !== r);
    const h = this.heroBySlot(conn.slot);
    if (h) {
      this.ctx.hud.showBanner(`${h.netName} LEFT`, 'They dropped out of the room');
      this.removeHero(h);
      this.world.heroes = this.heroes;
      this.checkPicksDone();
    }
    if (!this.inGame) this.rosterChanged();
    else this.net.broadcast({ t: 'left', slot: conn.slot });
  }

  heroBySlot(slot) { return (this.heroes || []).find((h) => h.slot === slot); }

  removeHero(h) {
    h.wardrobe?.dispose(); disposeModel(h.model);
    for (const t of h.trail) this.ctx.scene.remove(t.mesh);
    h.wardrobe?.dispose();
    this.heroes = this.heroes.filter((x) => x !== h);
    this.dropTag(h);
  }

  hostStart() {
    if (this.mode !== 'host' || this.roster.length < 2) return;
    this.panel.classList.add('hidden');
    this.ctx.startGame(this.myChar); // main.js resets everything, then calls setupHostGame()
  }

  // Called by main.js startGame() when hosting: build the friends' heroes and wire up the world
  setupHostGame() {
    const { scene, world, player } = this.ctx;
    this.inGame = true;
    this.net.locked = true;
    if (this.heroes) for (const h of this.heroes) if (h !== player) { scene.remove(h.model.root); for (const t of h.trail) scene.remove(t.mesh); h.wardrobe?.dispose(); }
    assignLooks(this.roster);
    const me = this.roster[0];
    player.setCharacter(me.char, null);
    player.setIdColor(me.tint); // duplicates: coloured ring + tag, bodies keep their own skin
    player.slot = 0;
    player.netName = me.name;
    this.heroes = [player];
    this.roster.slice(1).forEach((r, i) => {
      const h = new Player(scene, world, r.char, null);
      h.setIdColor(r.tint);
      h.slot = r.slot;
      h.netName = r.name;
      h.netInput = new RemoteInput();
      h.masteryNodes = RULES.z ? cleanMastery(r.char, r.mastery) : []; h.reset(); // a friend's hero mastery (checked by the host)
      h.reported = new THREE.Vector3();
      const a = (i + 1) * (Math.PI * 2 / this.roster.length);
      h.position.set(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6);
      h.reported.copy(h.position);
      h.syncModel();
      this.heroes.push(h);
    });
    player.reviveProgress = 0;
    const n = this.heroes.length, sc = coopScaling(n);
    world.heroes = this.heroes;
    world.coopCount = sc.count;
    world.coopHp = sc.hp;
    world.coopBossHp = sc.bossHp;
    world.targetFor = (e) => this.targetFor(e);
    this.epoch = 1;
    this.snapTimer = 0;
    this.fx = [];
    this.installRecorders();
    // CoreBurnZ SYNERGIES: the host works out the team bonuses, applies them to everyone and tells friends
    const syn = RULES.z ? synergiesFor(this.heroes.map((h) => h.char.id)) : [];
    for (const h of this.heroes) { h.loadout.synergy = syn; if (h !== player) { h.loadout.recompute(); h.applyLoadout(); h.hp = h.maxHp; } }
    this.synergy = syn;
    if (syn.length) setTimeout(() => { if (this.mode !== 'host' || !this.inGame) return; showSynergyPopup(syn); this.ctx.sound.play('powerup'); this.net.broadcast({ t: 'syn', names: syn }); }, 2200);
    this.net.broadcast({ t: 'start', z: RULES.z, roster: this.rosterOut(), pos: this.heroes.map((h) => [h.slot, r2(h.position.x), r2(h.position.z)]) });
    // the enemies scale was read by startWave(1) already in startGame? No: startGame calls this first.
  }

  // Record effects, sounds, banners and shakes on the host so friends can replay them
  installRecorders() {
    if (this.recording) return;
    this.recording = true;
    const { effects, world, hud, arena } = this.ctx;
    const rec = (e) => { if (this.mode === 'host' && this.fx.length < 120) this.fx.push(e); };
    for (const name of ['spawnRing', 'spawnSparks', 'spawnZap', 'spawnWarning', 'spawnLine']) {
      const orig = effects[name].bind(effects);
      effects[name] = (...args) => { if (name !== 'spawnSparks' || this.fx.length < 80) rec(['fx', name, ...args.map(ser)]); return orig(...args); };
    }
    const sfx = world.sfx;
    world.sfx = (n, o) => { rec(['snd', n, o]); sfx(n, o); };
    const shake = world.shake;
    world.shake = (a) => { if (a >= 0.25) rec(['shk', a]); shake(a); };
    const banner = hud.showBanner.bind(hud);
    hud.showBanner = (t, s, c) => { rec(['ban', t, s, c]); banner(t, s, c); };
    world.onArenaStrike = (pos) => rec(['bolt', ser(pos)]);
    this.origBanner = banner;
    this.arena = arena;
  }

  // Who each enemy goes for: the nearest living hero; bosses pick a random one every few seconds
  targetFor(e) {
    const alive = this.heroes.filter((h) => !h.dead);
    if (!alive.length) return this.ctx.player;
    const now = performance.now();
    if (e.isBoss) {
      if (!e.coopTarget || e.coopTarget.dead || !this.heroes.includes(e.coopTarget) || now > e.coopSwitch) {
        e.coopTarget = alive[Math.floor(Math.random() * alive.length)];
        e.coopSwitch = now + 5000 + Math.random() * 3000;
      }
      return e.coopTarget;
    }
    if (!e.coopTarget || e.coopTarget.dead || !this.heroes.includes(e.coopTarget) || now > (e.coopSwitch || 0)) {
      let best = alive[0], bd = Infinity;
      for (const h of alive) { const d = h.position.distanceToSquared(e.position); if (d < bd) { bd = d; best = h; } }
      e.coopTarget = best;
      e.coopSwitch = now + 500;
    }
    return e.coopTarget;
  }

  allDown() { return this.heroes.every((h) => h.dead); }

  // Host, every playing frame: run the friends' heroes and the revive rules
  hostSim(dt) {
    for (const h of this.heroes) {
      if (h === this.ctx.player) continue;
      h.update(dt, h.netInput);
      h.netInput.endFrame();
      // friends move on their own screens: pull our copy towards where they say they are
      if (h.hasReport && !h.dead) {
        const d = h.position.distanceTo(h.reported);
        if (d > 4) h.position.copy(h.reported);
        else h.position.lerp(h.reported, 1 - Math.exp(-12 * dt));
        if (h.state === 'normal' && Number.isFinite(h.reportedFacing)) h.facing = h.reportedFacing;
        h.syncModel();
      }
    }
    // downed heroes: a living teammate standing close for 3 seconds brings them back
    for (const h of this.heroes) {
      if (!h.dead) { if (h.wasDown) h.wasDown = false; continue; }
      if (!h.wasDown) {
        h.wasDown = true;
        h.reviveProgress = 0;
        if (!this.allDown()) this.ctx.hud.showBanner(`${h.netName.toUpperCase()} IS DOWN!`, 'Stand next to them to revive');
      }
      const helper = this.heroes.find((o) => !o.dead && o.position.distanceTo(h.position) < REVIVE_RANGE);
      h.reviveProgress = THREE.MathUtils.clamp(h.reviveProgress + (helper ? dt / REVIVE_TIME : -dt * 0.5), 0, 1);
      if (helper && Math.random() < dt * 8) this.ctx.effects.spawnRing(h.position, 0x6aff9a, 1.4, 0.3);
      if (h.reviveProgress >= 1) {
        h.revive();
        h.wasDown = false;
        h.reviveProgress = 0;
        this.ctx.world.sfx('revive');
        this.ctx.effects.spawnRing(h.position, 0x6aff9a, 3, 0.6);
        this.ctx.hud.showBanner(`${helper.netName.toUpperCase()} REVIVED ${h.netName.toUpperCase()}`, '');
        if (helper === this.ctx.player) this.ctx.world.onMilestoneStat?.('revives');
      }
    }
  }

  // Host, every frame: snapshots + timeouts
  hostNet(dt, state) {
    if (this.mode !== 'host') return;
    this.net.checkTimeouts();
    if (!this.inGame) return;
    if (state === 'upgrade') this.pickTimer = (this.pickTimer || 0) + dt;
    if (state === 'upgrade' && this.pickTimer > PICK_TIMEOUT) {
      for (const h of this.heroes) if (h.pendingPick) { this.applyRemotePick(h, h.pendingPick[0]); this.net.send(this.connOf(h), { t: 'picked', id: h.lastPick }); }
    }
    this.snapTimer -= dt;
    if (this.snapTimer > 0) return;
    this.snapTimer = 1 / SNAP_RATE;
    // combo callouts happen on the host; friends replay them
    if (this.ctx.combo.events.length) this.fx.push(['cmb', this.ctx.combo.events.slice()]);
    this.net.broadcast(this.snapshot(state));
    this.fx = [];
  }

  connOf(h) { const r = this.roster.find((x) => x.slot === h.slot); return r && r.conn; }

  snapshot(state) {
    const { enemies, projectiles, powerups, combo, arena } = this.ctx;
    const s = this.ctx.getRun();
    const bb = state === 'playing' ? enemies.bossBar : null;
    return {
      t: 's', st: state, w: s.wave, sc: s.score, k: s.kills,
      cb: [combo.count, combo.mult, r2(combo.fraction)],
      bb: bb ? [bb.name, Math.round(bb.hp), Math.round(bb.maxHp)] : 0,
      ar: [arena.current.index, arena.current.loop],
      h: this.heroes.map((h) => [h.slot, r2(h.position.x), r2(h.position.z), r2(h.facing), h.state, h.comboStep, Math.ceil(h.hp), h.maxHp, h.dead ? 1 : 0, r2(h.reviveProgress || 0), h.loadout.tier,
        powerups.listFor(h).map((p) => [p.type, r2(p.left), p.seconds, p.hits]), (h.shieldHp > 0 ? 1 : 0) | (h.tauntTimer > 0 ? 2 : 0), Math.round(h.rage || 0), h.flow || 0]),
      sh: this.ctx.world.shrine?.snapshot(), // CoreBurnZ risk shrine
      a: this.ctx.allies.serialize(), // needles, decoys, drones, vortexes
      e: enemies.list.filter((e) => e.nid).map((e) => e.isBoss
        ? [e.nid, 'B', r2(e.position.x), r2(e.position.z), r2(e.facing), e.state, (e.flashTimer > 0 ? 2 : 0) | (e.dead ? 4 : 0) | (e.golden ? 8 : 0), e.bossNumber, e.part, r2(e.stateTime), e.attack || '', e.hidden ? 1 : 0, r2(e.telegraphTime || 1), r2(e.rootY || 0)]
        : [e.nid, e.typeName, r2(e.position.x), r2(e.position.z), r2(e.facing), e.state, (e.elite ? 1 : 0) | (e.flashTimer > 0 ? 2 : 0) | (e.dead ? 4 : 0) | (e.stun > 0 ? 8 : 0), r2(e.stateTime), e.affixMask || 0]),
      p: projectiles.list.filter((p) => p.life > 0).map((p) => [r2(p.mesh.position.x), r2(p.mesh.position.z), p.mesh.material.color.getHex(), p.size]),
      pu: powerups.pickups.map((p) => [p.id, p.type, r2(p.obj.position.x), r2(p.obj.position.z)]),
      o: powerups.orbs.map((o) => [r2(o.obj.position.x), r2(o.obj.position.z)]),
      fx: this.fx,
    };
  }

  // Arena change: everyone to the middle (friends get told, and ignore their old positions)
  teleportAll() {
    this.epoch++;
    this.heroes.forEach((h, i) => {
      const a = i * (Math.PI * 2 / this.heroes.length);
      const r = i === 0 ? 0 : 1.6;
      h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      if (h.reported) h.reported.copy(h.position);
      h.slide.set(0, 0, 0);
      h.syncModel();
    });
    this.net.broadcast({ t: 'tp', ep: this.epoch, pos: this.heroes.map((h) => [h.slot, r2(h.position.x), r2(h.position.z)]) });
  }

  // ---------- Upgrade picks (every 2 waves, each player picks their own) ----------
  beginPicks(boss = false) {
    this.pickTimer = 0;
    for (const h of this.heroes) {
      if (h === this.ctx.player) continue;
      h.pendingPick = boss ? h.loadout.rollBoss(3) : h.loadout.maybeMythic(h.loadout.roll(3), this.ctx.enemies?.wave || 0); // CoreBurnZ boss relic pick
      this.net.send(this.connOf(h), { t: 'pick', cards: h.pendingPick, boss });
    }
  }

  applyRemotePick(h, id) {
    h.loadout.apply(id);
    h.applyLoadout();
    if (id === 'patch') h.heal(h.maxHp * 0.35);
    if (id === 'bHeart') h.heal(h.maxHp);
    h.pendingPick = null;
    h.lastPick = id;
    this.ctx.effects.spawnRing(h.position, h.tierColor, 3, 0.5);
    this.checkPicksDone();
  }

  get picksPending() { return (this.heroes || []).some((h) => h.pendingPick); }

  // main.js calls this after the host's own pick (and we call it after each friend's)
  checkPicksDone() {
    if (this.mode !== 'host' || this.ctx.getState() !== 'upgrade' || this.ctx.hostPicking()) return;
    if (this.picksPending) { this.ctx.hud.showBanner('WAITING FOR TEAMMATES', 'They\'re choosing their upgrades'); return; }
    this.ctx.setState('playing');
    this.net.broadcast({ t: 'resume' });
  }

  onRemotePowerup(hero, type, def) {
    const conn = this.connOf(hero);
    if (conn) this.net.send(conn, { t: 'toast', text: def.name + '!', sub: def.hint, color: '#' + def.color.toString(16).padStart(6, '0') });
  }

  // main.js: the run is over (everyone is down)
  onGameOver(run) {
    if (this.mode === 'host') this.net.broadcast({ t: 'over', run });
  }

  // Tap on the game over screen: the host takes everyone back to the lobby
  onRestartTap() {
    if (this.mode === 'host') this.backToLobby();
  }

  backToLobby() {
    this.inGame = false;
    this.net.locked = false;
    this.cleanupGame();
    this.ctx.hud.hideOverlay();
    this.ctx.setState('lobby');
    this.net.broadcast({ t: 'tolobby' });
    this.rosterChanged();
    this.showLobby();
  }

  cleanupGame() {
    const { world, player, scene } = this.ctx;
    for (const h of this.heroes || []) if (h !== player) { scene.remove(h.model.root); for (const t of h.trail) scene.remove(t.mesh); h.wardrobe?.dispose(); }
    for (const p of this.puppets ? this.puppets.values() : []) { scene.remove(p.model.root); for (const t of p.trail) scene.remove(t.mesh); p.wardrobe?.dispose(); }
    for (const t of this.tags.values()) t.remove();
    this.tags.clear();
    this.puppets = null;
    this.heroes = null;
    world.heroes = null;
    world.coopCount = world.coopHp = world.coopBossHp = undefined;
    world.targetFor = null;
    world.netClient = false;
    this.ctx.resetWorld();
  }

  leave() {
    if (this.mode === 'host') this.net.close();
    if (this.mode === 'client') { this.leaving = true; this.net.close('left'); }
    this.endSession();
  }

  endSession(message) {
    this.cleanupGame();
    this.mode = null;
    this.net = null;
    this.inGame = false;
    this.roster = [];
    this.panel.classList.add('hidden');
    this.ctx.hud.hidePicker();
    this.ctx.showTitle();
    if (message) this.ctx.hud.showToast('CO-OP ENDED', message, '#ff6a4a');
  }

  // ======================= JOINING =======================
  async join(code) {
    code = normalizeCode(code);
    if (code.length !== 4) { this.status('Enter the 4-letter room code', true); return; }
    this.status('Joining room ' + code + '…');
    $('cp-host').disabled = $('cp-join').disabled = true;
    try {
      const net = new NetClient();
      net.onMessage = (m) => this.clientMessage(m);
      net.onClose = (reason) => { if (this.mode === 'client' && !this.leaving) this.endSession(reason); this.leaving = false; };
      await net.join(code);
      this.net = net;
      this.mode = 'client';
      this.code = code;
      net.send({ t: 'hello', v: GAME_VERSION, char: this.myChar, look: this.ctx.myLook(), mastery: this.ctx.myMastery?.(this.myChar) });
      this.status('Connected! Waiting for the host…');
    } catch (e) {
      this.status(e.message, true);
    } finally {
      $('cp-host').disabled = $('cp-join').disabled = false;
    }
  }

  clientMessage(m) {
    switch (m.t) {
      case 'welcome': this.mySlot = m.slot; break;
      case 'lobby':
        this.roster = assignLooks(m.roster);
        this.code = m.code;
        if (setRules(!!m.z) !== false) this.ctx.onRulesChanged?.();
        if (this.ctx.getState() === 'lobby' || !this.inGame) this.showLobby();
        this.status('');
        break;
      case 'start': this.clientStart(m); break;
      case 'look': if (m.slot !== this.mySlot) this.gotLook(m.slot, m.look); break;
      case 's': this.latest = m; this.applySnapshot(m); break;
      case 'tp': {
        this.epoch = m.ep;
        const me = m.pos.find((p) => p[0] === this.mySlot);
        if (me) { this.ctx.player.position.set(me[1], 0, me[2]); this.ctx.player.slide.set(0, 0, 0); this.ctx.snapCamera(); }
        break;
      }
      case 'pick': this.clientPick(m.cards, m.boss); break;
      case 'picked': this.ctx.hud.hidePicker(); this.clientApplyPick(m.id); break;
      case 'resume': this.ctx.hud.hidePicker(); if (this.ctx.getState() === 'upgrade') this.ctx.setState('playing'); break;
      case 'syn': this.synergy = m.names; showSynergyPopup(m.names); this.ctx.sound.play('powerup'); break; // CoreBurnZ synergy popup
      case 'toast': this.ctx.sound.play('powerup'); this.ctx.hud.showToast(m.text, m.sub, m.color); break;
      case 'left': { const p = this.puppets && this.puppets.get(m.slot); if (p) { this.ctx.hud.showBanner(`${p.netName} LEFT`, ''); this.ctx.scene.remove(p.model.root); p.wardrobe?.dispose(); this.dropTag(p); this.puppets.delete(m.slot); } break; }
      case 'over': this.clientGameOver(m.run); break;
      case 'tolobby':
        this.inGame = false;
        this.cleanupGame();
        this.ctx.hud.hideOverlay();
        this.ctx.setState('lobby');
        this.showLobby();
        break;
    }
  }

  clientStart(m) {
    const { scene, world } = this.ctx;
    setRules(!!m.z); this.ctx.onRulesChanged?.(); // the host's rule set (CLASSIC / COREBURNZ)
    this.roster = assignLooks(m.roster);
    this.inGame = true;
    this.panel.classList.add('hidden');
    this.cleanupGame();
    world.netClient = true;
    const me = this.roster.find((r) => r.slot === this.mySlot);
    this.ctx.startClientGame(me.char, me.tint, me.name);
    const player = this.ctx.player;
    player.slot = this.mySlot;
    player.netName = me.name;
    const pos = m.pos.find((p) => p[0] === this.mySlot);
    if (pos) player.position.set(pos[1], 0, pos[2]);
    this.ctx.snapCamera();
    this.puppets = new Map();
    for (const r of this.roster) {
      if (r.slot === this.mySlot) continue;
      const h = new Player(scene, world, r.char, null);
      h.setIdColor(r.tint);
      h.slot = r.slot;
      h.netName = r.name;
      h.target = new THREE.Vector3();
      const p = m.pos.find((x) => x[0] === r.slot);
      if (p) { h.position.set(p[1], 0, p[2]); h.target.copy(h.position); }
      h.syncModel();
      this.puppets.set(r.slot, h);
    }
    this.ctx.applyLook(); // everyone's cosmetics + arena skins
    this.epoch = 1;
    this.inputTimer = 0;
    this.pending = { a: false, d: false, s: false };
    this.enemyMap = new Map();
    this.pickupMap = new Map();
    this.orbMeshes = [];
    this.view = { wave: 1, kills: 0, score: 0, bossBar: null, powers: [] };
    this.comboView = { count: 0, mult: 1, fraction: 0, events: [] };
    this.lastHp = player.hp;
  }

  clientPick(cards, boss = false) {
    this.ctx.setState('upgrade');
    const loadout = this.ctx.player.loadout;
    this.ctx.hud.rerollHook = () => { loadout.rerolls--; this.net.send({ t: 'reroll' }); }; // the host sends 3 new cards
    this.ctx.hud.showPicker(cards, loadout, (id) => {
      this.net.send({ t: 'pick', id });
      this.clientApplyPick(id);
      this.ctx.hud.showBanner('WAITING FOR TEAMMATES', 'The fight resumes when everyone has picked');
    }, boss);
  }

  clientApplyPick(id) {
    const player = this.ctx.player;
    player.loadout.apply(id);
    player.applyLoadout();
    const def = player.loadout.def(id);
    if (id === 'bHeart') player.heal?.(player.maxHp);
    this.ctx.hud.showToast(def.group === 'boss' ? 'BOSS RELIC' : `TIER ${player.loadout.tier} TALONS`, def.name, '#' + def.color.toString(16).padStart(6, '0'));
    this.ctx.effects.spawnRing(player.position, player.tierColor, 3, 0.5);
    this.ctx.sound.play('powerup');
  }

  clientGameOver(run) {
    const { hud, player } = this.ctx;
    this.ctx.setState('gameover');
    hud.showGameOver(run.score, run.wave, run.kills, { score: 0, wave: 0 }, false, run.killer, run.place, player.loadout, run.combo, run.hero);
    this.ctx.setLastRun(run); // scrap + XP (shown on the game over screen)
    $('restart-hint').classList.remove('hidden');
    $('restart-hint').innerHTML = 'Waiting for the host to start the next run…';
    $('restart-btn').classList.add('hidden');
    $('go-shop-btn').classList.add('hidden');
    $('go-menu-btn').innerHTML = '&#10006; LEAVE';
  }

  // ---------- Client: apply a snapshot (targets for smoothing; things that appear/vanish) ----------
  applySnapshot(m) {
    if (!this.inGame) return;
    const { scene, world, enemies, projectiles, powerups, arena, effects, hud, sound, player } = this.ctx;
    this.view.wave = m.w; this.view.score = m.sc; this.view.kills = m.k;
    this.view.bossBar = m.bb ? { name: m.bb[0], hp: m.bb[1], maxHp: m.bb[2] } : null;
    this.comboView.count = m.cb[0]; this.comboView.mult = m.cb[1]; this.comboView.fraction = m.cb[2];
    if (m.st === 'playing' && this.ctx.getState() === 'upgrade') { hud.hidePicker(); this.ctx.setState('playing'); }
    // arena changes
    if (arena.current.index !== m.ar[0] || arena.current.loop !== m.ar[1]) {
      arena.setTheme(m.ar[0], m.ar[1]);
      effects.reset();
      projectiles.reset();
      this.ctx.allies.reset();
      this.ctx.flashFade();
    }
    // heroes
    for (const hs of m.h) {
      const [slot, x, z, f, st, cs, hp, mhp, dead, rv, tier, pw, kf = 0, rage = 0, flow = 0] = hs;
      const h = slot === this.mySlot ? player : this.puppets.get(slot);
      if (!h) continue;
      h.reviveProgress = rv;
      h.rage = rage; h.flow = flow; // CoreBurnZ: Zaleks' Rage (host-authoritative)
      h.netShield = !!(kf & 1);
      h.guard.visible = h.netShield && !dead;
      h.tauntTimer = kf & 2 ? 0.2 : 0;
      h.netDead = !!dead;
      if (h.loadout.tier !== tier && h !== player) { h.loadout.tier = tier; h.applyLoadout(); }
      h.powers = Object.fromEntries(pw.map(([type, left, secs, hits]) => [type, { time: secs, max: secs / Math.max(0.01, left), hits }]));
      h.damageMult = h.powers.fury ? 2 : 1;
      h.bubble.visible = !!h.powers.shield;
      powerups.refreshBlade(h);
      if (h === player) {
        if (hp < this.lastHp - 0.5 && !dead) { hud.flashDamage(); world.shake(0.2); sound.play('hurt'); }
        this.lastHp = hp;
        player.maxHp = mhp;
        player.hp = hp;
        if (dead && !player.dead) player.goDown();
        if (!dead && player.dead) { player.revive(); player.hp = hp; }
        this.view.powers = powerups.listFor(player);
        continue;
      }
      h.target.set(x, 0, z);
      h.targetFacing = f;
      h.maxHp = mhp; h.hp = hp;
      if (dead && !h.dead) h.goDown();
      if (!dead && h.dead) h.revive();
      if (st !== h.state && !h.dead) {
        h.state = st;
        h.stateTime = 0;
        h.comboStep = cs;
        h.spinRing.visible = st === 'spin' && h.kit !== 'zaleks';
        if (st === 'spin') h.spinRing.scale.setScalar(h.kit === 'sarrow' ? h.stats.spinRadius * h.char.spinRadius : (h.kit === 'iskra' ? 0.6 : 0.8));
        if (st !== 'spin') h.model.body.rotation.y = 0;
      } else if (st === 'attack' && cs !== h.comboStep) { h.comboStep = cs; h.stateTime = 0; }
    }
    // enemies + bosses
    const seen = new Set();
    for (const es of m.e) {
      const nid = es[0];
      seen.add(nid);
      let e = this.enemyMap.get(nid);
      if (!e) e = this.spawnPuppetEnemy(es, m.w);
      if (!e) continue;
      e.target.set(es[2], 0, es[3]);
      e.targetFacing = es[4];
      const flags = es[6];
      if (flags & 2) e.flashTimer = 0.1;
      if (e.isBoss) {
        if (es[5] !== e.state) { e.state = es[5]; e.stateTime = es[9]; }
        e.attack = es[10] || e.attack;
        e.hidden = !!es[11];
        e.telegraphTime = es[12];
        e.rootY = es[13];
      } else {
        if (es[5] !== e.state) { e.state = es[5]; e.stateTime = es[7]; }
        e.stun = flags & 8 ? 0.1 : 0;
      }
      if (flags & 4 && !e.dead) { e.dead = true; e.state = 'dead'; e.stateTime = 0; }
    }
    for (const [nid, e] of this.enemyMap) {
      if (seen.has(nid)) continue;
      if (e.dead && !e.remove) continue; // let the death animation finish
      this.dropEnemy(nid, e);
    }
    // bolts
    const list = projectiles.list;
    list.forEach((p, i) => {
      const s = m.p[i];
      if (!s) { p.mesh.visible = false; p.life = 0; return; }
      if (!p.mesh.visible) p.mesh.position.set(s[0], 1, s[1]);
      p.target = p.target || new THREE.Vector3();
      p.target.set(s[0], p.mesh.position.y || 1, s[1]);
      p.mesh.material = projectiles.material(s[2]);
      p.mesh.scale.setScalar(s[3]);
      p.mesh.visible = true;
      p.life = 1;
    });
    this.ctx.allies.applySnapshot(m.a);
    this.ctx.world.shrine?.applySnapshot(m.sh);
    // pickups + heal orbs
    const pseen = new Set();
    for (const [id, type, x, z] of m.pu) {
      pseen.add(id);
      let p = this.pickupMap.get(id);
      if (!p) { p = powerups.drop(new THREE.Vector3(x, 0, z), true, type); if (p) this.pickupMap.set(id, p); }
      if (p) p.obj.position.set(x, 0, z);
    }
    for (const [id, p] of this.pickupMap) if (!pseen.has(id)) { if (powerups.pickups.includes(p)) powerups.removePickup(p); this.pickupMap.delete(id); }
    while (this.orbMeshes.length < m.o.length) { const o = new THREE.Mesh(powerups.orbGeo, powerups.orbMat); scene.add(o); this.orbMeshes.push(o); }
    this.orbMeshes.forEach((o, i) => { const s = m.o[i]; o.visible = !!s; if (s) o.position.set(s[0], 0.5 + Math.sin(performance.now() / 200 + i) * 0.1, s[1]); });
    // effects, sounds, banners
    for (const ev of m.fx) this.replay(ev);
  }

  replay(ev) {
    const { effects, sound, world, hud } = this.ctx;
    try {
      switch (ev[0]) {
        case 'fx': effects[ev[1]](...ev.slice(2).map(deser)); break;
        case 'snd': sound.play(ev[1], ev[2]); break;
        case 'shk': world.shake(ev[1] * 0.7); break;
        case 'ban': hud.showBanner(ev[1], ev[2], ev[3]); hud.setMutator(/^MUTATOR/.test(ev[1]) ? { name: ev[1].slice(9), color: ev[3] } : (/CLEARED|BOSS/.test(ev[1]) ? null : undefined)); break;
        case 'bolt': this.ctx.arena.strikeVisual(deser(ev[1])); break;
        case 'cmb': this.comboView.events.push(...ev[1]); break;
      }
    } catch { /* a missing effect is never worth crashing over */ }
  }

  spawnPuppetEnemy(es, wave) {
    const { scene, world, enemies } = this.ctx;
    const pos = new THREE.Vector3(es[2], 0, es[3]);
    if (es[1] === 'B') {
      const bossNumber = es[7];
      const { entry, tier } = bossForNumber(bossNumber);
      const parts = entry.spawn({ scene, world, bossNumber, tier, stats: waveStats(wave), spot: () => pos.clone() });
      const part = parts[es[8]] || parts[0];
      parts.forEach((p) => { if (p !== part) p.dispose(); });
      if (es[6] & 8) makeGolden(part);
      return this.registerPuppet(es[0], part, pos);
    }
    const e = new Enemy(scene, es[1], pos, { hpMult: 1, dmgMult: 1, speedMult: 1, elite: !!(es[6] & 1) }, world);
    if (es[8]) applyAffixVisuals(e, es[8]); // CoreBurnZ affixes: aura + name tag
    return this.registerPuppet(es[0], e, pos);
  }

  registerPuppet(nid, e, pos) {
    e.nid = nid;
    e.puppet = true;
    e.target = pos.clone();
    e.targetFacing = 0;
    this.enemyMap.set(nid, e);
    this.ctx.enemies.list.push(e);
    return e;
  }

  dropEnemy(nid, e) {
    e.dispose();
    this.enemyMap.delete(nid);
    const list = this.ctx.enemies.list;
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
  }

  // ---------- Client: every frame ----------
  clientFrame(dt, state) {
    const { player, input, arena, world, powerups } = this.ctx;
    this.net.checkTimeout();
    if (!this.inGame) { arena.update(dt, player, world, false); return; }
    if (state === 'playing') {
      player.update(dt, input); // my hero moves right away (the host follows); downed = lying animation
      if (input.wasPressed('attack')) this.pending.a = true;
      if (input.wasPressed('dash')) this.pending.d = true;
      if (input.wasPressed('spin')) this.pending.s = true;
    }
    // send my stick/buttons + where I am
    this.inputTimer -= dt;
    if (this.inputTimer <= 0 || this.pending.a || this.pending.d || this.pending.s) {
      this.inputTimer = 1 / INPUT_RATE;
      const mv = state === 'playing' ? input.getMove() : { x: 0, y: 0 };
      this.net.send({ t: 'in', mx: r2(mv.x), my: r2(mv.y), ah: state === 'playing' && input.attackHeld ? 1 : 0, a: this.pending.a ? 1 : 0, d: this.pending.d ? 1 : 0, s: this.pending.s ? 1 : 0,
        x: r2(player.position.x), z: r2(player.position.z), f: r2(player.facing), ep: this.epoch });
      this.pending = { a: false, d: false, s: false };
    }
    const k = 1 - Math.exp(-14 * dt); // smoothing towards the latest snapshot
    // teammates
    for (const h of this.puppets.values()) {
      const before = h.position.clone();
      h.position.lerp(h.target, k);
      h.velocity.copy(h.position).sub(before).divideScalar(Math.max(dt, 1e-4));
      let df = (h.targetFacing ?? h.facing) - h.facing;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      if (h.state !== 'spin') h.facing += df * k;
      h.stateTime += dt;
      if (h.dead) h.animateDeath(dt);
      else h.animate(dt);
      h.syncModel();
    }
    // enemies + bosses
    for (const e of this.ctx.enemies.list) {
      if (!e.puppet) continue;
      e.stateTime += dt;
      e.flashTimer -= dt;
      const before = e.position.clone();
      e.position.lerp(e.target, k);
      let df = e.targetFacing - e.facing;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      e.facing += df * k;
      try {
        if (e.dead) { e.animateDeath(dt); continue; }
        if (e.isBoss) {
          if (e.state === 'intro') {
            const t = Math.min(1, e.stateTime / 1.5);
            e.root.position.set(e.position.x, -(e.def.introDepth || 4) * (1 - t), e.position.z);
            e.root.rotation.y = e.facing;
          } else e.animate(dt);
          e.root.visible = !e.hidden;
        } else {
          if (e.state === 'spawn') { e.root.position.set(e.position.x, -1.6 * Math.max(0, 1 - e.stateTime / 0.6), e.position.z); e.root.rotation.y = e.facing; }
          else e.animate(dt, before.distanceToSquared(e.position) > 1e-5);
        }
      } catch { /* boss-specific poses can need fields only the host has */ }
    }
    for (const [nid, e] of this.enemyMap) if (e.remove) this.dropEnemy(nid, e);
    // bolts glide between snapshots
    for (const p of this.ctx.projectiles.list) if (p.mesh.visible && p.target) p.mesh.position.lerp(p.target, k);
    powerups.update(dt, true);
    this.ctx.world.shrine?.animate(dt);
    this.ctx.allies.update(dt); // friends: just glide what the host sent
    arena.update(dt, player, world, false);
  }

  // ---------- Name tags (both host and friends) ----------
  updateTags(camera) {
    if (!this.inGame) return;
    const list = this.mode === 'host' ? this.heroes : [this.ctx.player, ...this.puppets.values()];
    const w = window.innerWidth, hgt = window.innerHeight;
    const v = new THREE.Vector3();
    for (const h of list) {
      let tag = this.tags.get(h);
      if (!tag) {
        tag = document.createElement('div');
        tag.className = 'ntag';
        $('hud').appendChild(tag);
        this.tags.set(h, tag);
        tag.style.setProperty('--c', '#' + (h.idColor || h.char.color).toString(16).padStart(6, '0'));
      }
      const down = this.mode === 'host' ? h.dead : (h === this.ctx.player ? h.dead : h.netDead);
      const rv = h.reviveProgress || 0;
      const text = (h === this.ctx.player ? 'YOU' : h.netName.toUpperCase()) + (down ? (rv > 0 ? ` · REVIVING ${Math.round(rv * 100)}%` : ' · DOWN') : '');
      if (tag.textContent !== text) tag.textContent = text;
      tag.classList.toggle('down', !!down);
      v.set(h.position.x, 2.75, h.position.z).project(camera);
      tag.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * hgt}px) translate(-50%, -100%)`;
    }
  }

  dropTag(h) { const t = this.tags.get(h); if (t) { t.remove(); this.tags.delete(h); } }
}

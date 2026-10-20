// main.js
// The starting point of COREBURN. It:
//   1. sets up Three.js (renderer, scene, camera, lights)
//   2. creates the arena, Sarrow, the waves, power-ups, the HUD and the controls
//   3. runs the game loop ~60 times a second: update everything, then draw
//   4. handles SLOW-MO (everything but Sarrow runs slower) and the fade between arenas
import './fullscreen.js';
import { Allies } from './allies.js';
import * as THREE from 'three';
import { Input } from './input.js';
import { isTouchDevice, setupTouchControls } from './touch.js';
import { createArena, arenaForWave } from './arena.js';
import { Player } from './player.js';
import { WaveManager, isBossWave } from './waves.js';
import { Projectiles } from './projectiles.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { PowerUps } from './powerups.js';
import { sound } from './audio.js';
import { ads } from './ads.js';
import { checkForUpdates } from './updater.js';
import { GAME_VERSION } from './version.js';
import { shareScore, copyScore } from './share.js';
import { IS_NATIVE } from './native.js';
import { Combo } from './combo.js';
import { CHARACTERS, CHARACTER_ORDER, heroOrder, displayName } from './characters.js';
import { isPickWave } from './upgrades.js';
import { Coop } from './coop.js';
import { meta, scrapForRun, RARE_DROPS, SHOP } from './meta.js';
import { MUTATORS, isMutatorWave, rollMutator } from './mutators.js';
import { GOLD_TIME } from './golden.js';
import { ShopUI } from './shop-ui.js';
import { Twitch } from './twitch.js';
import { checkAchievements, rewardText } from './achievements.js';
import { rngFor, dailyKey, weekKey, rushOrder, RUSH_BOSSES, rushTierBefore, rushScore, rushLabel, formatTime, dailyStartCard } from './modes.js';
import { BOSS_ROTATION } from './bosses.js';
import { Leaderboard } from './leaderboard.js';
import { UPGRADES } from './upgrades.js';
import { RanksUI } from './ranks-ui.js';
import { RULES, setRules, Z_TUNING } from './rules.js';
import { rotation } from './bosses.js';
import { progress, xpForRun, ARENA_SKINS, skinFor, variantById } from './progress.js';
import { Wardrobe } from './cosmetics.js';
import { CosmeticsUI } from './cosmetics-ui.js';
import { Shrine } from './shrine.js';
import { getMastery } from './mastery.js';
import { readSave, writeSave, deleteSave } from './saves.js';

const IS_TOUCH = isTouchDevice();
if (IS_TOUCH) document.body.classList.add('touch'); // shows the touch controls (see style.css)

// ---------- Renderer (draws the 3D scene onto a <canvas>) ----------
const renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // cap at 2x so phones stay smooth
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = IS_TOUCH ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

// ---------- Scene (the arena sets the sky colour, fog and light colours) ----------
const scene = new THREE.Scene();

// ---------- Camera: isometric-style, looking down at about 45 degrees ----------
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200); // low field-of-view = flatter, more 'isometric' look
const CAMERA_DIR = new THREE.Vector3(1, 1.35, 1).normalize(); // direction from the hero to the camera
let cameraDistance = 28;
const cameraTarget = new THREE.Vector3();
let shakeAmount = 0;

// ---------- Lights ----------
const hemi = new THREE.HemisphereLight(0xbfd8e0, 0x4a3426, 1.2); // sky colour + ground bounce
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd2a0, 2.5);           // low sun with shadows
sun.castShadow = true;
sun.shadow.mapSize.set(IS_TOUCH ? 512 : 1024, IS_TOUCH ? 512 : 1024);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
sun.shadow.bias = -0.0015;
scene.add(sun, sun.target);

// ---------- Game objects ----------
const input = new Input(renderer.domElement);
setupTouchControls(input);
const hud = new Hud();
const effects = new Effects(scene);
const projectiles = new Projectiles(scene);
const env = { hemi, sun, baseHemi: 1.2 };
const arena = createArena(scene, env);

let state = 'title'; // 'title' | 'select' (character select) | 'playing' | 'upgrade' (picker open, game paused) | 'gameover'
let kills = 0;
let score = 0;
let hitstopTimer = 0;
let deathTimer = 0;
let gameOverTime = 0;
let revivedThisRun = false; // the rewarded-ad revive can be used once per run
let reviveOffered = false;
let restarting = false;
let timeScale = 1;          // 0.35 during SLOW-MO (eases in and out)
let slowmoOn = false;
let transition = null;      // arena change in progress { t, index, loop, wave, swapped }
const TRANSITION_TIME = 0.9;
const combo = new Combo();  // hit streak -> score multiplier (see combo.js)
let upgradeTimer = 0;       // counts down after a boss dies, then the upgrade picker opens
const fadeEl = document.getElementById('fade');
// per-run extras (Part C): scrap sources, near-miss slow-mo, volatile bursts
let run = { bosses: 0, mutators: 0, jackpot: 0, awarded: 0, drops: [] };
// run mode: 'endless' | 'daily' (seeded, daily board) | 'rush' (weekly boss rush). Solo only.
let mode = 'endless', modeKey = '', runTime = 0, runClock = 0; // runClock = the HUD run timer (pauses during picks)
const leaderboard = new Leaderboard();
let closeCall = 0, closeCallCd = 0; // CLOSE CALL slow-mo (real seconds) and its cooldown
const bursts = [];                  // VOLATILE mutator: { pos, t }
// best score: classic and CoreBurnZ are kept apart
const bestKey = () => (RULES.z ? 'coreburn-best-z' : 'coreburn-best');
let best = JSON.parse(localStorage.getItem(bestKey()) || '{"score":0,"wave":0}');
const reloadBest = () => { best = JSON.parse(localStorage.getItem(bestKey()) || '{"score":0,"wave":0}'); };
const seed = () => (RULES.z ? 'z:' : '') + modeKey; // daily seeds differ per rule set

// "world" is a shared object that the player and enemies use to reach each other
// and to trigger effects, without needing to know about main.js.
const world = {
  arena,
  env,
  effects,
  projectiles,
  player: null,
  enemies: null,
  powerups: null,
  heroes: null,      // co-op: every hero (null in solo)
  teamOf(p) { return world.heroes || [p]; },
  shake(amount) { shakeAmount = Math.max(shakeAmount, amount); },
  sfx(name, option) { sound.play(name, option); },
  hitstop(seconds) { hitstopTimer = Math.max(hitstopTimer, seconds); }, // tiny freeze = punchy hits
  onPlayerHurt(hero = player) { if (hero === player) { hud.flashDamage(); world.shake(0.2); } combo.hurt(); },
  onComboHit() { combo.add(1); },
  onEnemyKilled(e) {
    kills++;
    meta.data.stats.kills++;
    sound.play('enemyDeath');
    combo.add(1);
    score += Math.round(e.points * combo.mult * (enemies.mutator?.score || 1) * player.stats.scoreMult);
    powerups.onKill(e);
    if (enemies.mutator?.burst && !e.crumble && !e.isBoss) { // VOLATILE: a short fuse, then a burst
      bursts.push({ pos: e.position.clone(), t: 0.6 });
      effects.spawnRing(e.position, 0xff8a1e, 2.2, 0.6);
    }
    // Hive splitters burst into mites (unless they're crumbling because the boss died)
    if (e.type.splits && !e.crumble) {
      for (let i = 0; i < e.type.splits; i++) {
        const a = (i / e.type.splits) * Math.PI * 2;
        const m = enemies.spawnAt('mite', e.position.clone().add(new THREE.Vector3(Math.cos(a), 0, Math.sin(a))));
        if (m) m.stateTime = 0.4; // mites pop out quickly
      }
    }
  },
  // A new wave is about to start: every 10 waves we move to the next arena
  onWaveBegin(n) {
    const st = meta.data.stats;
    if (mode !== 'rush') st.bestWave = Math.max(st.bestWave, n); // rush waves jump by 5: they don't count
    if (n >= 10 && mode !== 'rush' && !coop.mode && !st.heroWave10.includes(player.char.id)) st.heroWave10.push(player.char.id);
    milestones();
    autosave(n);
    const next = arenaForWave(n), cur = arena.current;
    if (next.index !== cur.index || next.loop !== cur.loop) {
      transition = { t: 0, index: next.index, loop: next.loop, wave: n, swapped: false };
      sound.play('arenaChange');
    }
  },
  onWaveStart(n) {
    const mut = enemies.mutator;
    if (RULES.z && mode === 'endless' && shrine.onWaveStart(n, !mut && !isBossWave(n))) { // CoreBurnZ: a RISK SHRINE rises
      setTimeout(() => { if (shrine.visible) { hud.showToast('RISK SHRINE', 'Stand on the red altar: curse 3 waves, win a boss relic', '#ff3a4a'); if (coop.mode === 'host') coop.net.broadcast({ t: 'toast', text: 'RISK SHRINE', sub: 'Stand on the red altar: curse 3 waves, win a boss relic', color: '#ff3a4a' }); } }, 1800);
    }
    if (mut) { // MUTATOR wave: its own banner (and a tag under the score while it lasts)
      hud.showBanner(`MUTATOR: ${mut.name}`, `Wave ${n} · ${mut.desc}`, mut.color);
      hud.setMutator(mut);
      sound.play('bossWarning');
      sound.setIntensity(1);
      return;
    }
    hud.setMutator(null);
    if (transition) { sound.play('waveStart'); sound.setIntensity(1); return; } // the arena banner shows instead
    const msgs = { 1: 'The Grindchoir is coming', 2: 'Ripper hounds: they lunge!', 3: 'Slag spitters: dodge the bolts', 4: 'Bulwarks: only heavy hits stagger them', 6: 'Hive splitters burst into mites', 7: 'Elites (amber crowns) incoming' };
    hud.showBanner(`WAVE ${n}`, msgs[n] || '');
    sound.play('waveStart');
    sound.setIntensity(1);
  },
  onBossWave(n, def) {
    hud.showBanner(def.name, mode === 'rush' ? `Boss ${n / 5} of ${RUSH_BOSSES} · ${def.subtitle}` : `Wave ${n} · ${def.subtitle}`);
    sound.play('bossWarning');
    sound.setIntensity(2); // boss music: faster and busier
  },
  onBossKilled(boss, parts = [boss]) {
    // Reward: big heal + score bonus, a power-up, and its minions crumble
    score += Math.round(boss.points * combo.mult * player.stats.scoreMult);
    kills += parts.length;
    run.bosses++;
    const st = meta.data.stats;
    if (!st.bosses.includes(enemies.bossDef.name)) st.bosses.push(enemies.bossDef.name);
    milestones();
    if (enemies.golden) goldenReward(boss);
    world.player.heal(60);
    enemies.killAllAdds();
    world.shake(0.6);
    if (!enemies.golden) hud.showBanner('BOSS DOWN!', `+${Math.round(boss.points * combo.mult * player.stats.scoreMult)} pts · +60 health`);
    sound.play('bossDefeated');
    sound.setIntensity(1);
    powerups.onKill(boss);
    if (RULES.z) { bossPicks++; if (upgradeTimer <= 0) upgradeTimer = 1.6; } // CoreBurnZ: a gold boss relic pick
  },
  // One of the Forge Twins fell; the other one gets angry
  onTwinDown(fallen, survivor) {
    hud.showBanner(`${fallen.def.partName} DOWN!`, survivor ? `${survivor.def.partName} is enraged!` : '');
    world.shake(0.5);
    sound.play('bossDefeated');
  },
  onTalonHit(e, damage, hero) { powerups.onTalonHit(e, damage, hero); },
  onPowerup(type, def, hero = player) {
    if (hero !== player) { world.coop?.onRemotePowerup(hero, type, def); return; }
    sound.play('powerup');
    hud.showToast(def.name + '!', def.hint, '#' + def.color.toString(16).padStart(6, '0'));
  },
  onWaveCleared(n) {
    if (mode === 'rush') { // BOSS RUSH: a pick after every boss; after the 7th, you've won
      if (n / 5 >= RUSH_BOSSES) { world.runOver = true; rushWon = true; deathTimer = 0; setTimeout(() => { if (state === 'playing') gameOver(); }, 1600); }
      else { upgradeTimer = Math.max(upgradeTimer, 1.3); normalPick = true; }
      return;
    }
    if (enemies.mutator) { run.mutators++; meta.data.stats.mutators++; hud.setMutator(null); }
    milestones();
    if (isPickWave(n)) { upgradeTimer = Math.max(upgradeTimer, 1.3); normalPick = true; } // every 2nd wave: pause for the upgrade picker (after the banner lands)
    const bonus = 25 * n * combo.mult;
    score += bonus;
    if (!isBossWave(n)) {
      const wh = RULES.z ? Z_TUNING.waveHeal : 25;
      world.player.heal(wh);
      hud.showBanner(`WAVE ${n} CLEARED`, `+${bonus} pts · +${wh} health`);
    }
    if (RULES.z && shrine.onWaveCleared(n)) { // CoreBurnZ: survived the shrine's 3 cursed waves
      bossPicks++; upgradeTimer = Math.max(upgradeTimer, 1.3);
      hud.showBanner('CURSE SURVIVED', 'The shrine pays out: a guaranteed boss relic', '#ffc23a');
      sound.play('bossDefeated');
    }
  },
  mutatorFor(n) {
    if (!isMutatorWave(n)) return null;
    const id = world.forceMutator || rollMutator(mode === 'daily' ? rngFor(`daily:${seed()}:mut:${n}`) : Math.random);
    return { id, ...MUTATORS[id] };
  },
  onMilestoneStat(key) { meta.data.stats[key]++; milestones(); },
  goldenRoll() { return mode === 'endless' && (world.forceGolden || Math.random() < 1 / 20); }, // never in ranked modes
  waveRng(n) { return mode === 'daily' ? rngFor(`daily:${seed()}:wave:${n}`) : null; },
  rushEntry(k) { return mode === 'rush' ? { entry: rotation()[rushOrder(modeKey, RULES.z ? 12 : 7)[k - 1]], tier: 0 } : null; },
  waveStep: 1,
  runOver: false,
  // a bolt just whizzed past (projectiles.js): CLOSE CALL slow-mo, solo only, with a cooldown
  onNearMiss(hero) {
    if (coop.mode || hero !== player || closeCallCd > 0 || player.dead || state !== 'playing') return;
    closeCall = 0.4;
    closeCallCd = 7;
    combo.add(2);
    score += 50 * combo.mult;
    hud.closeCall(`+${50 * combo.mult} pts`);
    document.body.classList.add('closecall');
    meta.data.stats.closeCalls++;
    milestones();
    sound.play('slowmoIn');
  },
};
const player = new Player(scene, world);
// COSMETICS (level-up unlocks) + ARENA SKINS on the local hero
const wardrobe = new Wardrobe(scene, progress);
// What co-op friends need to draw you (equipped items, skin setting, scrap-shop colour)
const myLook = () => progress.look(meta.skinColor ?? null);
// Dress any hero from a look (yours or a friend's): arena skin, else their shop colour, then cosmetics
function dressHero(h, look) {
  if (!h) return;
  const mine = h === player;
  look = look || (mine ? myLook() : null);
  if (!look) return;
  const skin = skinFor(h.char.id, arena.current.index, RULES.z, look.sm);
  const vr = !skin && look.vr ? variantById(look.vr[h.char.id]) : null; // hero-level skin variant
  h.reskin(skin ? skin.tint : vr ? vr.tint : (look.sc ?? null), skin ? skin.glow : vr ? vr.glow : null, skin);
  if (mine) wardrobe.dress(player);
  else { h.wardrobe = h.wardrobe || new Wardrobe(scene, progress); h.wardrobe.dress(h, (look.eq && look.eq[h.char.id]) || {}); }
}
let lookArena = -1;
function applyLook() {
  lookArena = arena.current.index;
  dressHero(player, myLook());
  if (coop.mode) coop.dressOthers();
}
world.applyLook = () => applyLook();
projectiles.onNearMiss = (h) => world.onNearMiss(h);
const enemies = new WaveManager(scene, world);
const powerups = new PowerUps(scene, world);
world.player = player;
world.enemies = enemies;
const shrine = new Shrine(scene, world); // CoreBurnZ risk shrines
world.shrine = shrine;
world.powerups = powerups;
const allies = new Allies(scene, world); // ISKRA's needles + decoys, ORIN's drones + vortex
world.allies = allies;
world.aggro = (e, t) => allies.aggro(e, t);

// SLOW-MO look and sound on/off
function setSlowmo(on) {
  if (slowmoOn === on) return;
  slowmoOn = on;
  document.body.classList.toggle('slowmo', on);
  sound.setSlowmo(on);
  if (state === 'playing') sound.play(on ? 'slowmoIn' : 'slowmoOut');
}

// CoreBurnZ RISK SHRINE activated: the next 3 waves are cursed
function shrineActivated() {
  const p = shrine.group.position;
  effects.spawnRing(p, 0xff2a3a, 4, 0.7); effects.spawnSparks(p.clone().setY(2.3), 0xff2a3a, 20, 8);
  world.shake(0.5); sound.play('bossWarning');
  hud.showBanner('SHRINE ACTIVATED', 'The next 3 waves are cursed · survive them for a boss relic', '#ff3a4a');
  if (coop.mode === 'host') coop.net.broadcast({ t: 'toast', text: 'SHRINE ACTIVATED', sub: 'The next 3 waves are cursed · survive them for a boss relic', color: '#ff3a4a' });
}

// Upgrade picker: pause, show 3 cards, apply the pick (weapon tier +1 and the card's perk)
let hostPicking = false;
let bossPicks = 0, normalPick = false; // CoreBurnZ: boss relic picks waiting (they come first)
function openUpgradePicker() {
  const boss = bossPicks > 0;
  if (!boss && !normalPick && RULES.z) return; // nothing left to pick
  if (boss) bossPicks--; else normalPick = false;
  state = 'upgrade';
  const loadout = player.loadout;
  if (coop.mode === 'host') coop.beginPicks(boss); // every friend picks their own card too
  hostPicking = true;
  const cardRng = mode === 'daily' ? rngFor(`daily:${seed()}:${boss ? 'boss' : 'cards'}:${loadout.tier}:${bossPicks}`) : Math.random;
  const hand = boss ? loadout.rollBoss(3, cardRng) : loadout.maybeMythic(loadout.maybeCurse(loadout.roll(3, cardRng), enemies.wave, cardRng), enemies.wave, cardRng);
  hud.rerollHook = (b, handle) => { // CoreBurnZ reroll (yours only; friends reroll their own)
    loadout.rerolls--;
    const h2 = b ? loadout.rollBoss(3) : loadout.maybeMythic(loadout.maybeCurse(loadout.roll(3), enemies.wave), enemies.wave);
    hud.showPicker(h2, loadout, onPickCard, b, handle);
    sound.play('powerup');
  };
  const onPickCard = (id) => {
    twitch.endVote();
    hostPicking = false;
    loadout.apply(id);
    if (mode === 'rush') { loadout.tier = Math.max(loadout.tier, rushTierBefore(enemies.wave / 5 + 1)); loadout.recompute(); } // matched to a normal run
    player.applyLoadout();
    if (id === 'patch') player.heal(player.maxHp * 0.35);
    if (id === 'bHeart') player.heal(player.maxHp);
    const def = loadout.def(id);
    hud.showToast(boss ? 'BOSS RELIC' : `TIER ${loadout.tier} TALONS`, def.group === 'cursed' ? `CURSED: ${def.name}` : `${def.name}${id === 'patch' ? '' : ' Lv ' + loadout.level(id)}`, '#' + def.color.toString(16).padStart(6, '0'));
    world.effects.spawnRing(player.position, player.tierColor, 3, 0.5);
    sound.play('powerup');
    state = 'playing';
    milestones();
    if (coop.mode === 'host' && coop.picksPending) { state = 'upgrade'; coop.checkPicksDone(); }
    if (bossPicks > 0 || normalPick) upgradeTimer = 0.45; // the next pick (boss relic, then the normal one)
  };
  const picker = hud.showPicker(hand, loadout, onPickCard, boss);
  twitch.startVote(hand.length, (i) => picker.pickIndex(i)); // Streamer Mode: chat votes !1 !2 !3
}

// Arena change: fade to black, swap the arena while it's dark, fade back in
function updateTransition(dt) {
  transition.t += dt;
  const half = TRANSITION_TIME / 2;
  if (!transition.swapped && transition.t >= half) {
    transition.swapped = true;
    arena.setTheme(transition.index, transition.loop);
    applyLook(); // ARENA SKINS follow the arena
    player.position.set(0, 0, 0); // the middle of every arena is clear
    player.slide.set(0, 0, 0);
    if (coop.mode === 'host') coop.teleportAll();
    projectiles.reset();
  allies.reset();
    effects.reset();
    powerups.clearFloor();
    updateCamera(0, true);
    const a = arena.current;
    hud.showBanner(a.name, a.loop > 0 ? `Wave ${transition.wave} · Loop ${a.loop + 1}: everything hits harder` : `Wave ${transition.wave} · ${a.sub}`);
  }
  const t = transition.t;
  fadeEl.style.opacity = t < half ? t / half : Math.max(0, 1 - (t - half) / half);
  if (t >= TRANSITION_TIME) { transition = null; fadeEl.style.opacity = 0; }
}

// ---------- Starting / ending a run ----------
// Character select comes before EVERY run (the last pick is highlighted)
let heroId = CHARACTERS[localStorage.getItem('coreburn-hero')] && (!CHARACTERS[localStorage.getItem('coreburn-hero')].secret || meta.data.unlocked[localStorage.getItem('coreburn-hero')]) ? localStorage.getItem('coreburn-hero') : 'sarrow';
function showCharacterSelect() {
  state = 'select';
  hud.hideOverlay();
  const canSave = mode === 'endless' && !coop.mode;
  const chars = heroOrder(RULES.z).map((id) => ({ ...CHARACTERS[id], locked: CHARACTERS[id].secret && !meta.data.unlocked[id], hlv: RULES.z ? progress.heroInfo(id) : null, save: canSave ? getSave(id) : null }));
  if (!chars.find((c) => c.id === heroId) || chars.find((c) => c.id === heroId)?.locked) heroId = 'sarrow';
  hud.showSelect(chars, heroId, (id) => {
    heroId = id;
    localStorage.setItem('coreburn-hero', id);
    const sv = canSave && getSave(id);
    if (!sv) { startGame(id); return; }
    hud.showContinue(CHARACTERS[id], sv, () => startGame(id, sv), () => { deleteSave(RULES.z, id); startGame(id); }, () => showCharacterSelect());
  });
}

// ---------- SAVED RUNS (v1.30.0): one per hero per rule set, solo endless only ----------
const getSave = (id) => readSave(RULES.z, id, (c) => !!player.loadout.def(c) && c !== 'patch');
const savable = () => mode === 'endless' && !coop.mode && state !== 'title';
let waveSnap = null; // the snapshot taken as the current wave began
function snapshot(n) {
  const L = player.loadout, ax = allies.axiom;
  return { wave: n, score, kills, runClock, runTime, hp: Math.round(player.hp * 10) / 10, maxHp: player.maxHp,
    levels: { ...L.levels }, tier: L.tier, patches: L.patches, rerolls: L.rerolls, mythicAt: L.mythicAt, comboBest: combo.best,
    curse: shrine.curse ? { ...shrine.curse } : null, shrineLast: shrine.lastWave, mutator: enemies.mutator?.id || null,
    drones: player.char.id === 'axiom' && ax ? ax.perm(player) : null, uploadUsed: !!player.uploadUsed, revived: revivedThisRun,
    run: { bosses: run.bosses, mutators: run.mutators, jackpot: run.jackpot } };
}
function autosave(n) {
  if (!savable() || restoring) return;
  waveSnap = snapshot(n);
  if (n >= 2) writeSave(RULES.z, player.char.id, waveSnap); // wave 1 only saves on SAVE & QUIT
}
let restoring = false;
function restoreRun(sv) {
  const L = player.loadout;
  L.levels = { ...sv.levels }; L.tier = sv.tier | 0; L.patches = sv.patches | 0; L.rerolls = sv.rerolls | 0; L.mythicAt = sv.mythicAt ?? -99;
  L.version++; L.recompute(); player.applyLoadout(); // same code path as picking the cards
  player.hp = Math.max(1, Math.min(player.maxHp, sv.hp));
  score = sv.score; kills = sv.kills | 0; runClock = sv.runClock || 0; runTime = sv.runTime || 0;
  combo.best = sv.comboBest || 0;
  if (sv.curse) { shrine.curse = { ...sv.curse }; shrine.showCurse(sv.curse.left); }
  shrine.lastWave = sv.shrineLast ?? -99;
  if (sv.drones != null) player.axSavedDrones = sv.drones;
  player.uploadUsed = !!sv.uploadUsed; revivedThisRun = !!sv.revived;
  Object.assign(run, sv.run || {});
}

let rushWon = false;
function startGame(id = heroId, sv = null) {
  if (typeof id !== 'string') id = heroId;
  if (!sv || !sv.wave) sv = null;
  waveSnap = null;
  if (coop.mode) mode = 'endless'; // ranked modes are solo
  modeKey = mode === 'daily' ? dailyKey() : mode === 'rush' ? weekKey() : '';
  world.waveStep = mode === 'rush' ? 5 : 1;
  world.runOver = false;
  rushWon = false;
  runTime = 0; runClock = 0;
  // shop unlocks: skin, talon colour, starting perk (solo runs; co-op keeps everyone's looks even)
  const solo = !coop.mode;
  player.talonBase = solo ? meta.talonColor : null;
  player.startCard = solo && mode === 'endless' ? meta.perkCard : null; // shop perks: normal runs only (fair boards)
  if (mode === 'daily') player.startCard = dailyStartCard(seed(), Object.keys(UPGRADES).filter((u) => UPGRADES[u].max > 1 && !UPGRADES[u].heroes)); // same for everyone
  player.setCharacter(id, solo ? meta.skinColor : null);
  player.setIdColor(null);
  if (coop.mode === 'host') coop.setupHostGame(); // friends' heroes + co-op scaling (before wave 1)
  hud.setHeroName(player.netName ? player.netName.toUpperCase() : player.char.name, player.idColor || player.tint || player.char.color);
  kills = 0;
  score = 0;
  combo.reset();
  deathTimer = 0;
  effects.reset();
  projectiles.reset();
  allies.reset();
  enemies.reset();
  shrine.reset();
  player.masteryNodes = RULES.z ? getMastery(id, progress.heroLevel(id)) : []; // CoreBurnZ hero mastery
  player.reset();
  powerups.reset();
  hud.hidePicker();
  upgradeTimer = 0; bossPicks = 0; normalPick = false;
  transition = null;
  fadeEl.style.opacity = 0;
  timeScale = 1;
  setSlowmo(false);
  const cur = arena.current;
  if (cur.index !== 0 || cur.loop !== 0) arena.setTheme(0, 0); // back to the Slag Yard
  applyLook();
  hud.hideOverlay();
  state = 'playing';
  revivedThisRun = false;
  hostPicking = false;
  run = { bosses: 0, mutators: 0, jackpot: 0, awarded: 0, drops: [] };
  closeCall = 0; closeCallCd = 0; bursts.length = 0;
  document.body.classList.remove('closecall');
  hud.setMutator(null);
  hud.setModeTag((RULES.z ? 'COREBURNZ ' : '') + (mode === 'daily' ? `DAILY ${modeKey}` : mode === 'rush' ? `BOSS RUSH ${modeKey}` : ''));
  if (mode === 'rush') { player.loadout.tier = rushTierBefore(1); player.loadout.version++; player.loadout.recompute(); player.applyLoadout(); player.hp = player.maxHp; }
  if (sv) {
    restoring = true;
    try { restoreRun(sv); if (sv.mutator) world.forceMutator = sv.mutator; enemies.startWave(sv.wave); }
    finally { restoring = false; world.forceMutator = null; }
    waveSnap = sv;
    hud.showToast('RUN CONTINUED', `Wave ${sv.wave} · ${player.loadout.picked.length} cards`, '#3ff6e0');
    return;
  }
  enemies.startWave(mode === 'rush' ? 5 : 1);
}

// ---------- Co-op hooks (see coop.js) ----------
function resetWorld() {
  effects.reset();
  projectiles.reset();
  allies.reset();
  enemies.reset();
  shrine.reset();
  powerups.reset();
  hud.hidePicker();
  upgradeTimer = 0;
  transition = null;
  fadeEl.style.opacity = 0;
  timeScale = 1;
  setSlowmo(false);
  const cur = arena.current;
  if (cur.index !== 0 || cur.loop !== 0) arena.setTheme(0, 0);
  bossPicks = 0; normalPick = false;
  if (player.dead) player.revive();
  player.position.set(0, 0, 0);
}
function startClientGame(char, tint, name = char) {
  runClock = 0;
  mode = 'endless'; world.waveStep = 1; world.runOver = false; hud.setModeTag(RULES.z ? 'COREBURNZ' : '');
  resetWorld();
  kills = 0;
  score = 0;
  combo.reset();
  deathTimer = 0;
  player.talonBase = null;
  player.startCard = null;
  run = { bosses: 0, mutators: 0, jackpot: 0, awarded: 0, drops: [] };
  player.setCharacter(char, null);
  player.setIdColor(tint); // co-op duplicates: coloured ring + name tag instead of a body recolour
  hud.setHeroName(name.toUpperCase(), tint || player.char.color);
  hud.hideOverlay();
  state = 'playing';
}
const RESTART_HINT = document.getElementById('restart-hint').innerHTML;
function showTitle() {
  state = 'title';
  if (!coop.mode) { setRules(localStorage.getItem('coreburn-rules') === 'z'); onRulesChanged(); } // back to your own pick after co-op
  cosmeticsUI.refreshBadge();
  hud.showTitle(best);
  document.getElementById('restart-btn').classList.remove('hidden');
  document.getElementById('restart-hint').innerHTML = RESTART_HINT;
  document.getElementById('restart-hint').classList.remove('hidden');
}
const coop = new Coop({
  THREE, scene, camera, world, input, hud, sound, combo, effects, projectiles, powerups, enemies, arena, allies,
  get player() { return player; },
  getState: () => state,
  setState: (s) => { state = s; },
  hostPicking: () => hostPicking,
  myMastery: (id) => (RULES.z ? getMastery(id, progress.heroLevel(id)) : []), // CoreBurnZ hero mastery (sent to the host)
  startGame,
  startClientGame,
  resetWorld,
  showTitle,
  snapCamera: () => updateCamera(0, true),
  flashFade: () => { fadeEl.style.transition = 'none'; fadeEl.style.opacity = 0.8; requestAnimationFrame(() => { fadeEl.style.transition = 'opacity .5s'; fadeEl.style.opacity = 0; }); },
  getRun: () => ({ wave: Math.max(1, enemies.wave), score, kills }),
  setLastRun: (r) => { lastRun = r; if (coop.mode === 'client') { run.awarded = 0; awardScrap({ ...r, greed: false }); awardXp({ wave: r.wave, kills: r.kills || 0, bosses: r.bosses || 0 }); } },
  onRulesChanged: () => world.onRulesChanged?.(),
  myLook: () => myLook(),
  dressHero: (h, look) => dressHero(h, look),
  applyLook: () => applyLook(),
});
world.coop = coop;

let lastRun = { wave: 1, score: 0, killer: null, place: null, tier: 0 }; // what the share buttons talk about

// GOLDEN boss: scrap jackpot and a 40% chance at a rare cosmetic you don't own yet
function goldenReward(boss) {
  const jackpot = 150 + 50 * Math.min(10, boss.bossNumber || 1);
  run.jackpot += jackpot;
  let drop = null;
  const missing = RARE_DROPS.filter((id) => !meta.owns(id));
  if (missing.length && Math.random() < 0.4) {
    drop = missing[Math.floor(Math.random() * missing.length)];
    meta.grant(drop);
    run.drops.push(drop);
  }
  meta.data.stats.goldens++; meta.save();
  const item = drop && (meta.item('skin', drop) || meta.item('talon', drop));
  hud.showBanner('GOLDEN JACKPOT!', `+${jackpot} scrap` + (item ? ` · RARE: ${item.name} ${meta.item('skin', drop) ? 'skin' : 'talons'} unlocked!` : ''), '#ffc23a');
  effects.spawnRing(boss.position, 0xffc23a, 7, 1.4);
}

// MILESTONES: check progress now (stats are updated as things happen); pop a toast for each new one
const milestoneQueue = [];
function milestones() {
  meta.data.stats.bestCombo = Math.max(meta.data.stats.bestCombo, combo.best);
  const live = { cursed: player.loadout.picked.filter((p) => p.group === 'cursed').length };
  for (const a of checkAchievements(meta, live)) milestoneQueue.push(a);
  if (milestoneQueue.length && !milestoneQueue.showing) showNextMilestone();
}
function showNextMilestone() {
  const a = milestoneQueue.shift();
  if (!a) { milestoneQueue.showing = false; return; }
  milestoneQueue.showing = true;
  hud.showMilestone(a.name, rewardText(a, meta), !!a.reward.hero);
  sound.play('powerup');
  shop.refreshTitle();
  setTimeout(showNextMilestone, 2600);
}

// ACCOUNT XP: every run in any mode; level-ups unlock cosmetics (shown on the game over screen)
function awardXp(r = { wave: enemies.wave, kills, bosses: run.bosses }) {
  if (run.xpDone) return;
  run.xpDone = true;
  const xp = xpForRun({ ...r, z: RULES.z, coop: !!coop.mode });
  const res = progress.addXp(xp);
  const heroRes = RULES.z ? progress.addHeroXp(player.char.id, xp) : null; // HERO LEVELS: CoreBurnZ runs
  if (res.scrap) meta.addScrap(res.scrap);
  if (heroRes?.scrap) meta.addScrap(heroRes.scrap);
  hud.showXp(res, progress, heroRes);
  cosmeticsUI.refreshBadge();
}
world.awardXp = awardXp;
// CoreBurnZ boss PHASE 2 / ENRAGE banners (the host tells co-op friends too)
world.onBossPhase = (boss, title, sub, color) => {
  const c = '#' + color.toString(16).padStart(6, '0');
  hud.showBanner(title, sub, c);
  if (coop.mode === 'host') coop.net?.broadcast?.({ t: 'toast', text: title, sub, color: c });
};

// Leaderboards: local always, online once set up (see leaderboard-config.js)
async function submitRun() {
  const r = mode === 'rush'
    ? { mode, hero: player.char.id, score: rushScore(run.bosses, runTime), wave: enemies.wave, kills, seconds: runTime, week: modeKey }
    : { mode, hero: player.char.id, score, wave: enemies.wave, kills, seconds: runTime, day: modeKey };
  r.tainted = LOCAL_DEV;
  r.z = RULES.z; // CoreBurnZ boards are separate // never submit online from a local test build
  if (mode === 'daily') { meta.data.stats.dailies++; } else if (mode === 'rush') { meta.data.stats.rushes++; if (rushWon) meta.data.stats.rushClears = (meta.data.stats.rushClears || 0) + 1; }
  milestones();
  pendingRun = r;
  const res = await leaderboard.submit(r);
  hud.showRanks(res, r, leaderboard.name, mode === 'rush' ? rushLabel : null);
  hud.showXpAgain?.();
}
let pendingRun = null;

// Scrap for this run so far (only the part not yet paid out, so an ad revive doesn't pay twice)
function awardScrap(r) {
  const total = Math.round(scrapForRun(r) * (r.greed ? 1.5 : 1));
  const gain = Math.max(0, total - run.awarded);
  run.awarded = total;
  meta.addScrap(gain);
  if (!run.counted) { meta.data.stats.runs++; if (coop.mode) meta.data.stats.coopRuns++; run.counted = true; }
  if (coop.mode === 'client') { meta.data.stats.kills += r.kills || 0; meta.data.stats.bestWave = Math.max(meta.data.stats.bestWave, r.wave || 0); }
  milestones();
  meta.data.stats.bestWave = Math.max(meta.data.stats.bestWave, r.wave || 0);
  meta.save();
  run.lastGain = gain;
  hud.showScrap(gain, meta.scrap, run.drops);
  return gain;
}

function gameOver() {
  if (!coop.mode && mode === 'endless') { deleteSave(RULES.z, player.char.id); waveSnap = null; } // death ends the saved run
  state = 'gameover';
  gameOverTime = performance.now();
  const newBest = mode === 'endless' && score > best.score; // ranked modes have their own boards
  if (newBest) {
    best.score = score;
    best.wave = enemies.wave;
    localStorage.setItem(bestKey(), JSON.stringify(best));
  }
  const lastDown = coop.mode === 'host' ? coop.heroes.reduce((a, h) => (h.killedBy ? h : a), player) : player;
  const killer = lastDown.killedBy ? lastDown.killedBy.killerName : null; // e.g. "the Furnace Deacon"
  lastRun = { wave: enemies.wave, score, killer, place: arena.current.place, tier: player.loadout.tier, combo: combo.best, hero: player.netName || displayName(player.char), tag: player.char.tag, kills,
    team: coop.mode === 'host' ? coop.heroes.filter((h) => h !== player).map((h) => h.netName) : null,
    bosses: run.bosses, mutators: run.mutators, jackpot: run.jackpot, greed: player.stats.scoreMult > 1 };
  upgradeTimer = 0;
  powerups.reset();
  setSlowmo(false);
  timeScale = 1;
  hud.showGameOver(score, enemies.wave, kills, best, newBest, killer, lastRun.place, player.loadout, combo.best, displayName(player.char));
  if (mode === 'rush') hud.showRushResult(rushWon, run.bosses, runTime, modeKey);
  if (mode === 'daily') hud.showDailyResult(modeKey);
  copyBtn.textContent = 'COPY';
  sound.play('gameOver');
  sound.setIntensity(0);
  ads.onGameOver();
  // Offer the optional rewarded-ad revive (Android app only, once per run)
  reviveOffered = !coop.mode && !revivedThisRun && ads.canRevive; // no ad revive in co-op (teammates revive you)
  if (coop.mode === 'host') coop.onGameOver(lastRun);
  reviveBtn.classList.toggle('hidden', !reviveOffered);
  awardScrap(lastRun);
  awardXp();
  if (!coop.mode) submitRun();
  doubleBtn.classList.toggle('hidden', !(ads.canRevive && run.lastGain > 0)); // rewarded ad: double it (app only)
  document.getElementById('restart-hint').classList.toggle('hidden', reviveOffered);
  setGameOverButtons();
  keysAtDeath = new Set(keysDown); // keys held while dying (attack mashing) never restart
}

// Game over buttons: PLAY AGAIN (hero select, last hero highlighted) · SHOP · MENU.
// Co-op host: PLAY AGAIN = back to the lobby, MENU = leave. (Clients: see coop.clientGameOver.)
function setGameOverButtons() {
  const $ = (id) => document.getElementById(id);
  $('restart-btn').classList.remove('hidden');
  $('restart-sub').textContent = coop.mode === 'host' ? 'back to the lobby · everyone re-picks'
    : mode === 'daily' ? 'same Daily Challenge · pick your hero'
    : mode === 'rush' ? 'same Boss Rush · pick your hero' : 'pick your hero, then go';
  $('go-menu-btn').innerHTML = coop.mode ? '&#10006; LEAVE' : '&#9776; MENU';
  // the shop shows once this run's scrap is banked (and not while a double-scrap ad is playing)
  $('go-shop-btn').classList.toggle('hidden', !!coop.mode || restarting);
}
const keysDown = new Set();
let keysAtDeath = new Set();
window.addEventListener('keydown', (e) => keysDown.add(e.code), true);
window.addEventListener('keyup', (e) => { keysDown.delete(e.code); keysAtDeath.delete(e.code); }, true);
window.addEventListener('blur', () => { keysDown.clear(); keysAtDeath.clear(); });

// PLAY AGAIN: the button, or a fresh Enter / R press (not a key held from the fight, not auto-repeat).
// It always goes through hero select (last hero highlighted: one more tap or Enter starts) in the same mode.
// Every few deaths an interstitial ad may show first (Android app only, see ads.js).
function onGameOverKey(e) {
  if (state !== 'gameover' || shop.isOpen || e.repeat || keysAtDeath.has(e.code)) return;
  if (!['Enter', 'NumpadEnter', 'KeyR'].includes(e.code)) return;
  if (reviveOffered) return; // with a revive on offer, use the buttons
  e.preventDefault();
  tryRestart();
}
async function tryRestart(e) {
  e?.stopPropagation?.();
  if (state !== 'gameover' || restarting || performance.now() - gameOverTime < 600) return;
  if (coop.mode) { coop.onRestartTap(); return; } // co-op: the host takes everyone back to the lobby
  restarting = true;
  try { await ads.maybeShowInterstitial(); } finally { restarting = false; }
  showCharacterSelect();
}

// Rewarded ad -> come back with half health, once per run
const reviveBtn = document.getElementById('revive-btn');
reviveBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
reviveBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (state !== 'gameover' || restarting) return;
  restarting = true;
  const rewarded = await ads.showRewarded();
  restarting = false;
  if (!rewarded) return;
  revivedThisRun = true;
  reviveOffered = false;
  reviveBtn.classList.add('hidden');
  // push nearby enemies away so the player gets a fair restart
  for (const en of enemies.list) {
    if (en.dead || en.isBoss) continue;
    const away = en.position.clone().sub(player.position).setY(0);
    if (away.length() < 8) { en.knockback.add(away.normalize().multiplyScalar(14)); en.stun = 1; }
  }
  projectiles.reset();
  allies.reset();
  player.revive();
  deathTimer = 0;
  hud.hideOverlay();
  state = 'playing';
  sound.play('revive');
  sound.setIntensity(enemies.boss && !enemies.boss.dead ? 2 : 1);
});

// Rewarded ad on game over: double this run's scrap (Android app only; hidden on the website)
const doubleBtn = document.getElementById('double-btn');
doubleBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
doubleBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (state !== 'gameover' || restarting || !run.lastGain) return;
  restarting = true;
  document.getElementById('go-shop-btn').classList.add('hidden');
  const rewarded = await ads.showRewarded().finally(() => { restarting = false; });
  doubleBtn.classList.add('hidden');
  if (state === 'gameover') setGameOverButtons();
  if (!rewarded) return;
  meta.addScrap(run.lastGain);
  hud.showScrap(run.lastGain * 2, meta.scrap, run.drops, true);
  run.lastGain = 0;
});

// Streamer Mode panel (title screen)
const twitch = new Twitch();
world.twitch = twitch;
const twPanel = document.getElementById('tw-panel');
const twRender = () => {
  document.getElementById('tw-toggle').textContent = twitch.enabled ? 'TURN OFF' : 'TURN ON';
  document.getElementById('tw-status').textContent = !twitch.enabled ? 'Off' : { live: 'Connected: chat votes are on', connecting: 'Connecting…', error: 'Could not reach Twitch chat (check the channel name / connection)' }[twitch.status] || '';
};
twPanel.addEventListener('pointerdown', (e) => e.stopPropagation());
document.getElementById('tw-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('tw-channel').value = twitch.channel;
  twPanel.classList.remove('hidden'); twRender();
});
document.getElementById('tw-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  twitch.setEnabled(!twitch.enabled, document.getElementById('tw-channel').value);
  twRender();
});
const twTimer = setInterval(() => { if (!twPanel.classList.contains('hidden')) twRender(); }, 500);
document.getElementById('tw-close').addEventListener('click', (e) => { e.stopPropagation(); twPanel.classList.add('hidden'); });

// Ranked modes + leaderboards (title screen)
const ranks = new RanksUI(leaderboard, { rushLabel });
for (const [btn, m] of [['daily-btn', 'daily'], ['rush-btn', 'rush']]) {
  const el = document.getElementById(btn);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); if (state === 'title' || state === 'gameover') { mode = m; showCharacterSelect(); } });
}
document.getElementById('start-btn').addEventListener('click', () => { mode = 'endless'; }, true);
document.getElementById('ranks-btn').addEventListener('pointerdown', (e) => e.stopPropagation());
document.getElementById('ranks-btn').addEventListener('click', (e) => { e.stopPropagation(); if (state === 'title') ranks.open(); });
// game over: name entry (only shown until you've picked one)
const nameInput = document.getElementById('lb-name');
for (const ev of ['pointerdown', 'keydown']) nameInput.addEventListener(ev, (e) => e.stopPropagation());
document.getElementById('lb-name-save').addEventListener('pointerdown', (e) => e.stopPropagation());
const saveName = async (e) => {
  e?.stopPropagation();
  const r = leaderboard.setName(nameInput.value);
  document.getElementById('lb-name-msg').textContent = r.ok ? 'Saved!' : r.error;
  if (r.ok && pendingRun && leaderboard.online) { const res = await leaderboard.submit(pendingRun); hud.showRanks(res, pendingRun, leaderboard.name, pendingRun.mode === 'rush' ? rushLabel : null); }
};
document.getElementById('lb-name-save').addEventListener('click', saveName);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(e); });

// COSMETICS screen (title + hero select)
const cosmeticsUI = new CosmeticsUI(progress, {
  onClose: () => { if (state === 'select') showCharacterSelect(); },
  onChange: () => { if (state !== 'playing') applyLook(); coop.sendLook?.(); },
});
for (const id of ['cos-btn', 'sel-cos-btn', 'cp-cos']) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); if (state === 'title' || state === 'select' || state === 'lobby') cosmeticsUI.open(state === 'select' ? heroId : state === 'lobby' ? (coop.myChar || player.char.id) : player.char.id); });
}

// RULES: CLASSIC (the original game, the default) or COREBURNZ (the remix). Saved; leaderboards,
// best score and the daily are kept apart per rule set.
const RULES_DESC = {
  0: 'The original COREBURN, unchanged.',
  1: 'Cancel your ultimate any time · owned cards come up more · Ultimate Coolant -10% · longer ARC chains · a gold BOSS RELIC after every boss · bosses +10% health · 5 new bosses',
};
function onRulesChanged() {
  reloadBest();
  for (const b of document.querySelectorAll('#rules-row button')) b.classList.toggle('on', (b.dataset.z === '1') === RULES.z);
  document.getElementById('rules-desc').textContent = RULES_DESC[RULES.z ? 1 : 0];
  document.querySelector('#title-panel .small:not(#rules-desc)')?.replaceChildren(document.createTextNode(RULES.z
    ? 'CoreBurnZ: endless waves · 12 bosses · boss relics · a new arena every 10 waves · how far can you go?'
    : 'Endless waves · 7 bosses · power-ups · a new arena every 10 waves · how far can you go?'));
  if (state === 'title') hud.showTitle(best);
  ranks.isOpen && ranks.render?.();
}
world.onRulesChanged = onRulesChanged;
for (const b of document.querySelectorAll('#rules-row button')) {
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state !== 'title') return;
    setRules(b.dataset.z === '1');
    localStorage.setItem('coreburn-rules', RULES.z ? 'z' : 'classic');
    onRulesChanged();
  });
}

// The unlock shop (title screen)
const shop = new ShopUI(meta, SHOP, { onClose: (fromGameOver) => { if (!fromGameOver) hud.showTitle(best); } });
hud.refreshScrap = () => shop.refreshTitle();
document.getElementById('shop-btn').addEventListener('click', (e) => { e.stopPropagation(); if (state === 'title') shop.open(); });
document.getElementById('shop-btn').addEventListener('pointerdown', (e) => e.stopPropagation());

// Share my score / copy it (game over screen). These must not count as "tap to restart".
const shareBtn = document.getElementById('share-btn');
const copyBtn = document.getElementById('copy-btn');
for (const b of [shareBtn, copyBtn]) b.addEventListener('pointerdown', (e) => e.stopPropagation());
shareBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  shareBtn.blur();
  shareScore(lastRun);
});
copyBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  copyBtn.blur();
  const ok = await copyScore(lastRun);
  copyBtn.textContent = ok ? 'COPIED!' : 'COPY FAILED';
  setTimeout(() => { copyBtn.textContent = 'COPY'; }, 2000);
});

window.addEventListener('keydown', onGameOverKey);
for (const id of ['restart-btn', 'go-shop-btn', 'go-menu-btn', 'sp-play']) document.getElementById(id).addEventListener('pointerdown', (e) => e.stopPropagation());
document.getElementById('go-shop-btn').addEventListener('click', (e) => { e.stopPropagation(); if (state === 'gameover' && !restarting) shop.open(true); });
document.getElementById('sp-play').addEventListener('click', (e) => { e.stopPropagation(); shop.close(true); tryRestart(); });
document.getElementById('go-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (state !== 'gameover' || restarting) return;
  if (coop.mode) coop.leave(); else showTitle();
});
const $p = (id) => document.getElementById(id);
// ---------- PAUSE (both modes). Solo: everything freezes, timer too. Co-op: a menu just for you,
// the shared game keeps going (nobody else gets frozen). ----------
const pauseBtn = $p('pause-btn'), pauseOv = $p('pause-overlay');
let coopMenu = false;
function openPause() {
  if (state !== 'playing' || world.runOver) return;
  if (coop.mode) { coopMenu = true; $p('pause-sub').textContent = 'Co-op keeps running while this menu is open'; $p('pause-restart').classList.add('hidden'); $p('pause-save').classList.add('hidden'); $p('pause-menu').innerHTML = '&#10006; LEAVE GAME'; }
  else { state = 'paused'; $p('pause-sub').textContent = 'Wave ' + Math.max(1, enemies.wave) + ' · ' + document.getElementById('run-timer').textContent; $p('pause-restart').classList.remove('hidden'); $p('pause-menu').innerHTML = '&#9776; MENU'; $p('pause-save').classList.toggle('hidden', mode !== 'endless'); sound.setSlowmo?.(false); }
  pauseOv.classList.remove('hidden');
}
function closePause() { pauseOv.classList.add('hidden'); coopMenu = false; if (state === 'paused') state = 'playing'; }
world.isPaused = () => state === 'paused';
for (const el of [pauseBtn, pauseOv]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); pauseBtn.blur(); openPause(); });
$p('pause-resume').addEventListener('click', (e) => { e.stopPropagation(); closePause(); });
$p('pause-restart').addEventListener('click', (e) => { e.stopPropagation(); closePause(); world.runOver = true; showCharacterSelect(); });
$p('pause-save').addEventListener('click', (e) => {
  e.stopPropagation();
  if (state !== 'paused' || coop.mode || mode !== 'endless') return;
  const snap = waveSnap || snapshot(Math.max(1, enemies.wave));
  const ok = writeSave(RULES.z, player.char.id, snap);
  closePause(); world.runOver = true; resetWorld(); showTitle();
  hud.showToast(ok ? 'RUN SAVED' : 'SAVE FAILED', ok ? `${displayName(player.char)} · continue from wave ${snap.wave} on hero select` : 'Storage is full or blocked', ok ? '#3ff6e0' : '#ff3a4a');
});
$p('pause-menu').addEventListener('click', (e) => { e.stopPropagation(); closePause(); world.runOver = true; if (coop.mode) coop.leave(); else { resetWorld(); showTitle(); } });
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Escape' && e.code !== 'KeyP') return;
  if (state === 'paused' || coopMenu) { e.preventDefault(); closePause(); }
  else if (state === 'playing') { e.preventDefault(); openPause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing' && !coop.mode) openPause(); }); // phone: switching apps pauses
document.getElementById('start-btn').addEventListener('click', showCharacterSelect);
{ const mb = document.getElementById('menu-more-btn'), mm = document.getElementById('menu-more'); // MORE: help + links, collapsed by default
  mb.addEventListener('pointerdown', (e) => e.stopPropagation()); mm.addEventListener('pointerdown', (e) => e.stopPropagation());
  mb.addEventListener('click', (e) => { e.stopPropagation(); const open = mm.classList.toggle('hidden') === false; mb.setAttribute('aria-expanded', String(open)); mb.classList.toggle('on', open); }); }
document.getElementById('restart-btn').addEventListener('click', tryRestart);
setRules(localStorage.getItem('coreburn-rules') === 'z');
onRulesChanged();
hud.showTitle(best);
document.getElementById('version-text').textContent = `v${GAME_VERSION}`;

// ---------- Sound ----------
// Browsers only allow audio after a tap/click/key press, so start it on the first one.
const unlockAudio = () => sound.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlockAudio, { capture: true });
const muteBtn = document.getElementById('mute-btn');
const showMute = () => muteBtn.classList.toggle('muted', sound.muted);
muteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
muteBtn.addEventListener('click', (e) => { e.stopPropagation(); sound.unlock(); sound.toggleMute(); showMute(); });
window.addEventListener('keydown', (e) => { if (e.code === 'KeyM') { sound.toggleMute(); showMute(); } });
showMute();

// ---------- Android-only extras (do nothing on the website) ----------
checkForUpdates();
ads.init().then(() => {
  const btn = document.getElementById('privacy-options-btn');
  if (ads.privacyOptionsRequired) {
    btn.classList.remove('hidden');
    btn.addEventListener('click', () => ads.showPrivacyOptions());
  }
});

// ---------- Resizing (also handles phones rotating between portrait and landscape) ----------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // Pull the camera back on narrow (portrait) screens so you can still see
  // about 9 metres to the left and right of the hero.
  const halfV = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
  cameraDistance = THREE.MathUtils.clamp(9 / Math.tan(halfH), 28, 42);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
onResize();

// ---------- Camera follow ----------
function updateCamera(dt, snap = false) {
  // smoothly follow the hero
  const follow = snap ? 1 : 1 - Math.exp(-6 * dt);
  cameraTarget.lerp(player.position, follow);
  camera.position.copy(cameraTarget).addScaledVector(CAMERA_DIR, cameraDistance);
  // screen shake
  if (shakeAmount > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeAmount;
    camera.position.y += (Math.random() - 0.5) * shakeAmount;
    camera.position.z += (Math.random() - 0.5) * shakeAmount;
    shakeAmount = Math.max(0, shakeAmount - dt * 1.5);
  }
  camera.lookAt(cameraTarget.x, cameraTarget.y + 0.8, cameraTarget.z);
  // keep the shadow-casting light centred on the action
  sun.position.set(cameraTarget.x + 10, 18, cameraTarget.z + 3);
  sun.target.position.copy(cameraTarget);
}

// VOLATILE mutator: dead enemies burst after a short fuse (a ring shows where; blink through it)
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.t -= dt;
    if (b.t > 0) continue;
    bursts.splice(i, 1);
    effects.spawnRing(b.pos, 0xffb040, 2.4, 0.35);
    effects.spawnSparks(b.pos.clone().setY(0.8), 0xff8a1e, 8, 7);
    world.shake(0.12);
    const dmg = 9 * (1 + 0.07 * (enemies.wave - 1));
    for (const h of world.teamOf(player)) {
      if (!h.dead && Math.hypot(h.position.x - b.pos.x, h.position.z - b.pos.z) < 2.1) h.takeDamage(dmg, { killerName: 'a volatile burst' }, { hazard: true });
    }
  }
}

// ---------- The game loop ----------
const clock = new THREE.Clock();
updateCamera(0, true);

function frame() {
  requestAnimationFrame(frame);
  wardrobe.update(Math.min(0.05, 1 / 60));
  if (coop.mode) coop.updateWardrobes(Math.min(0.05, 1 / 60));
  if (state === 'playing' && arena.current && arena.current.index !== lookArena) applyLook(); // arena changed (incl. co-op clients)
  let dt = Math.min(clock.getDelta(), 1 / 20); // avoid huge jumps if the tab was in the background

  // hitstop: freeze the action for a split second on big hits
  if (hitstopTimer > 0) {
    hitstopTimer -= dt;
    dt *= 0.05;
  }

  // SLOW-MO: ease the world's speed towards 35% (Sarrow always uses the real dt)
  timeScale += (powerups.timeScale - timeScale) * (1 - Math.exp(-10 * dt));
  if (Math.abs(timeScale - powerups.timeScale) < 0.01) timeScale = powerups.timeScale;
  GOLD_TIME.value += dt;
  closeCallCd = Math.max(0, closeCallCd - dt);
  if (closeCall > 0) { closeCall -= dt; if (closeCall <= 0) { document.body.classList.remove('closecall'); sound.play('slowmoOut'); } }
  const worldDt = dt * timeScale * (closeCall > 0 ? 0.3 : 1); // CLOSE CALL: the world drops to 30% for 0.4s
  if (state === 'playing') setSlowmo(powerups.timeScale < 1);

  if (coop.mode === 'client') {
    coop.clientFrame(dt, state); // a friend's game: puppets driven by the host's snapshots
  } else if (state === 'playing') {
    if (transition) {
      updateTransition(dt); // everything waits while the screen fades
    } else {
      player.update(dt, input);
      enemies.update(worldDt);
      if (RULES.z && shrine.update(worldDt, world.heroes || [player])) shrineActivated();
      allies.update(worldDt);
      projectiles.update(worldDt, world.heroes || player, arena, effects);
      arena.update(worldDt, player, world, true);
      powerups.update(dt);
      updateBursts(worldDt);
      if (!coop.mode && !world.runOver) runTime += dt;
      if (coop.mode === 'host') coop.hostSim(dt);
      combo.update(worldDt);
      if (upgradeTimer > 0) {
        upgradeTimer -= dt;
        if (upgradeTimer <= 0 && (!player.dead || coop.mode === 'host')) openUpgradePicker();
      }
    }
    if (coop.mode === 'host' ? coop.allDown() : player.dead) {
      deathTimer += dt;
      if (deathTimer > 1.6) gameOver();
    }
  } else if (state === 'upgrade') {
    // paused while the player picks an upgrade (nothing moves)
    twitch.update(dt);
  } else {
    // title screen: Enter or J also starts a run
    if (state === 'title' && !shop.isOpen && !ranks.isOpen && twPanel.classList.contains('hidden') && (input.wasPressed('start') || input.wasPressed('attack'))) { mode = 'endless'; showCharacterSelect(); }
    if (state === 'gameover') { enemies.update(dt); projectiles.update(dt, player, arena, effects); } // let things settle
    arena.update(dt, player, world, false);
  }

  pauseBtn.classList.toggle('hidden', !(state === 'playing' || state === 'paused') || world.runOver);
  if (state === 'playing' && !world.runOver && !(player.dead && !coop.mode)) runClock += dt; // RUN TIMER
  hud.setTimer(runClock);
  if (coop.mode === 'host') coop.hostNet(dt, state); // snapshots to friends
  if (state !== 'upgrade' && state !== 'paused') effects.update(worldDt);
  updateCamera(dt);
  if (coop.mode === 'client' && coop.view) {
    const v = coop.view;
    hud.updateCombo(coop.comboView, state === 'playing');
    hud.update(player, v.wave, v.kills, v.score, state === 'playing' ? v.bossBar : null, v.powers);
  } else {
    hud.updateCombo(combo, state === 'playing');
    hud.update(player, Math.max(1, enemies.wave), kills, score, state === 'playing' ? enemies.bossBar : null, powerups.hudList);
  }
  coop.updateTags(camera);
  input.endFrame();
  renderer.render(scene, camera);
}
frame();

// Testing helpers for the browser console live in js/dev.local.js, which is NOT part of the
// game: it's git-ignored and left out of the build, so it never reaches the website or the
// Android app. It only loads when you run the game on your own computer (http://localhost...).
const LOCAL_DEV = !IS_NATIVE && ['localhost', '127.0.0.1'].includes(location.hostname);
if (LOCAL_DEV) {
  import('./dev.local.js')
    .then((m) => m.install({ player, enemies, world, progress, allies, arena, powerups, projectiles, effects, hud, sound, ads, startGame, snapCamera: () => updateCamera(0, true), getScore: () => score, combo, meta, twitch, input, getState: () => state, getLastRun: () => lastRun, getMode: () => mode, bursts, openPicker: () => { normalPick = true; openUpgradePicker(); } }))
    .catch(() => {}); // no dev file = no helpers, that's fine
}

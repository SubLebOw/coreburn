// events.js: COREBURNZ PHASE 4 special events (survival, CoreBurnZ rules), run by one small director that
// sits next to Gold Rush in main.js's onWaveStart (Gold Rush rolls first and keeps its own 12% / max 2).
//   BLACKOUT PROTOCOL  - the lights fail for 20 s; stand on both emergency relays to restore power early (+scrap)
//   HIGH-VALUE TARGET  - a marked, evasive elite carrying scrap; kill it within 25 s (+scrap) or it escapes
//   CONTAINMENT SHIFT  - energy partitions (real collision, with openings) lock the arena down for 15 s
// Rules: CoreBurnZ endless only, never boss / mutator / shrine / arena-change / Gold Rush waves, one event at a
// time, never on two waves in a row, per-run caps (saved with the run). Host-authoritative: friends get the
// state in the normal co-op snapshot (field `ev`) and toasts via the existing 'toast' message. Events never
// persist in a save: a resumed run restarts the wave without one (lighting/barriers always reset cleanly).
import * as THREE from 'three';

export const EVENTS = { // every probability / cap / reward in one place
  gap: 2, // waves between two events (2 = never on consecutive waves)
  blackout: { from: 12, chance: 0.08, max: 2, dur: 20, relays: 2, hold: 1.0, radius: 1.7, light: 0.34, bonus: [15, 1, 60] },
  hvt: { from: 10, chance: 0.10, max: 2, dur: 25, hp: 1.5, speed: 1.15, flee: 6.5, types: ['acolyte', 'splitter', 'thurible'], bonus: [25, 2, 100] },
  shift: { from: 18, chance: 0.08, max: 2, warn: 3, dur: 15, bonus: [0, 0, 0] },
};
export const eventBonus = (k, n) => { const [a, b, cap] = EVENTS[k].bonus; return Math.min(cap, a + b * n); }; // [base, per wave, cap]

// CONTAINMENT layouts per arena: wall segments [x1, z1, x2, z2]; always several openings. Only arenas where it is
// safe: no lava (foundry) or ice sliding (tundra) next to the walls.
const H = 17.6;
const LAYOUTS = {
  slag: [[0, 7, 0, H], [0, -7, 0, -H], [7, 0, H, 0], [-7, 0, -H, 0]],                 // a cross: quadrants meet in the middle
  cathedral: [[-10, -10, -2, -10], [2, -10, 10, -10], [-10, 10, -2, 10], [2, 10, 10, 10], // a broken box round the nave
    [-10, -8, -10, -2], [-10, 2, -10, 8], [10, -8, 10, -2], [10, 2, 10, 8]],
  rooftop: [[-11, -6, -2, -6], [2, -6, 11, -6], [-11, 6, -2, 6], [2, 6, 11, 6]],      // two broken lanes: centre gaps + open ends
};
const COL = { blackout: '#ff7a2a', hvt: '#ffc23a', shift: '#3ff6e0' };

function label(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = '#000c'; g.strokeText(text, 256, 34); g.fillStyle = color; g.fillText(text, 256, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(5, 0.62, 1); s.renderOrder = 999; return s;
}
const flat = (geo, mat, y = 0.05) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; };

export class EventDirector {
  // hooks: { banner(t, s, c), toast(t, s, c), tag(text|null, color), award(bonus), sfx(name), enemies, client() }
  constructor(scene, world, hooks) {
    this.world = world; this.hooks = hooks; this.cur = null; this.t = 0; this.tagT = 0;
    // relays: built once, reused (no lights, a handful of meshes)
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.6, metalness: 0.6 });
    const ringG = new THREE.RingGeometry(EVENTS.blackout.radius - 0.14, EVENTS.blackout.radius, 40), discG = new THREE.CircleGeometry(EVENTS.blackout.radius, 40);
    this.relays = [0, 1].map(() => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.9), metal); base.position.y = 0.75;
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.95), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); core.position.y = 1.05;
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xffc23a })); lamp.position.y = 1.85;
      const ring = flat(ringG, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      const fill = flat(discG, new THREE.MeshBasicMaterial({ color: 0x3ff6e0, transparent: true, opacity: 0.4, depthWrite: false }), 0.04);
      const tag = label('POWER RELAY · stand here', '#ffb070'); tag.position.y = 2.7;
      g.add(base, core, lamp, ring, fill, tag); g.visible = false; scene.add(g);
      return { g, core, lamp, ring, fill, prog: 0, done: false };
    });
    // barrier pool: shared box geometry, two shared materials (warning stripe / energy wall)
    const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1);
    this.wallMat = new THREE.MeshBasicMaterial({ color: 0x3ff6e0, transparent: true, opacity: 0.55, depthWrite: false });
    this.postMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.5, metalness: 0.7, emissive: 0xff5a1a, emissiveIntensity: 0.4 });
    this.warnMat = new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.5, depthWrite: false });
    this.walls = Array.from({ length: 8 }, () => {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(box, this.wallMat), p1 = new THREE.Mesh(box, this.postMat), p2 = new THREE.Mesh(box, this.postMat), warn = flat(plane, this.warnMat, 0.03);
      g.add(wall, p1, p2, warn); g.visible = false; scene.add(g);
      return { g, wall, p1, p2, warn };
    });
    // high-value target marker (follows the target; not parented, so the enemy's dispose never touches it)
    this.mark = new THREE.Group();
    this.markRing = flat(new THREE.RingGeometry(1.0, 1.25, 32), new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.markTag = label('◆ HIGH-VALUE TARGET ◆', '#ffd24a'); this.markTag.position.y = 3.2;
    this.mark.add(this.markRing, this.markTag); this.mark.visible = false; scene.add(this.mark);
    this.light0 = null;
  }

  get active() { return !!this.cur; }

  // HOST: maybe start one event on wave n. `ok` = the caller's own eligibility (no boss/mutator/shrine/transition/rush)
  roll(n, run, ok, arenaId) {
    if (!ok || this.cur) return false;
    const ev = run.ev || (run.ev = { blackout: 0, hvt: 0, shift: 0, last: -99 });
    if (n - ev.last < EVENTS.gap) return false;
    const force = this.world.forceEvent; this.world.forceEvent = null;
    const pool = ['blackout', 'hvt', 'shift'].filter((k) => (force ? k === force : n >= EVENTS[k].from && ev[k] < EVENTS[k].max) && (k !== 'shift' || LAYOUTS[arenaId]));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    for (const k of pool) {
      if (!force && Math.random() >= EVENTS[k].chance) continue;
      ev[k]++; ev.last = n;
      this.start(k, n, arenaId);
      return !!this.cur;
    }
    return false;
  }

  start(kind, n, arenaId) {
    const w = this.world, h = this.hooks;
    this.cur = { kind, n, t: EVENTS[kind].dur, phase: 'on', done: false };
    if (kind === 'blackout') {
      const a = Math.random() * Math.PI * 2;
      this.relays.forEach((r, i) => {
        const want = new THREE.Vector3(Math.cos(a + i * Math.PI) * 11, 0, Math.sin(a + i * Math.PI) * 11); // opposite sides: you have to move
        const s = w.arena.findClearSpot ? w.arena.findClearSpot(want, 2) : want;
        r.g.position.set(s.x, 0, s.z); r.prog = 0; r.done = false;
      });
      this.showRelays(true);
      h.banner('BLACKOUT PROTOCOL', 'Emergency power failure. Hold both relays to restore power early.', COL.blackout);
    } else if (kind === 'hvt') {
      const E = h.enemies, B = EVENTS.hvt;
      const pos = w.arena.randomSpawnPoint(w.player.position, 10);
      const e = E.spawnAt(B.types[Math.floor(Math.random() * B.types.length)], pos, false, true); // an elite, counts toward the wave
      if (!e) { this.cur = null; return; }
      e.hvt = true; e.maxHp *= B.hp; e.hp = e.maxHp; e.speed *= B.speed; e.points *= 3;
      this.cur.e = e; this.cur.nid = e.nid;
      h.banner('HIGH-VALUE TARGET', 'Priority target detected. Kill it before it escapes!', COL.hvt);
    } else {
      this.cur.phase = 'warn'; this.cur.t = EVENTS.shift.warn; this.cur.layout = arenaId;
      this.showWalls(arenaId, 0);
      h.banner('CONTAINMENT SHIFT', 'Arena lockdown initiated. Barriers rising!', COL.shift);
    }
    h.sfx(kind === 'hvt' ? 'waveStart' : 'bossWarning');
    this.toTag(true);
  }

  // end: won = objective done (bonus), false = timed out / wave ended
  end(won) {
    const c = this.cur; if (!c || c.done) return; c.done = true;
    const h = this.hooks, n = c.n;
    if (c.kind === 'blackout') {
      this.showRelays(false);
      if (won) this.result('POWER RESTORED', eventBonus('blackout', n));
      else h.toast('POWER RESTORED', 'Emergency power is back', '#93a4ae');
      this.cur = { kind: 'restore', t: 1.2, done: true }; // smooth fade back to full light
      h.tag(null); return;
    }
    if (c.kind === 'hvt') {
      this.mark.visible = false;
      if (won) this.result('TARGET ELIMINATED', eventBonus('hvt', n));
      else {
        const e = c.e;
        if (e && !e.dead) { this.world.effects.spawnRing(e.position, 0xffc23a, 3, 0.8); e.dead = true; e.state = 'dead'; e.remove = true; } // escaped (no kill credit)
        h.toast('TARGET ESCAPED', 'No bonus this time', '#93a4ae');
      }
    }
    if (c.kind === 'shift') { this.clearWalls(); if (c.phase !== 'warn') h.toast('CONTAINMENT RELEASED', 'Barriers retracted', COL.shift); }
    this.cur = null; h.tag(null);
  }

  result(text, bonus) {
    if (bonus > 0) this.hooks.award(bonus);
    this.hooks.toast(text, bonus > 0 ? `+${bonus} scrap (paid at the end of the run)` : '', '#ffc23a');
    this.hooks.sfx('powerup');
  }

  // a clean stop (new run, menu, death, resume): no bonus, no toasts, lights and colliders back to normal
  reset() {
    this.showRelays(false); this.clearWalls(); this.mark.visible = false;
    this.cur = null; this.setLight(1); this.light0 = null; this.world.blackout = false;
    this.hooks.tag?.(null);
  }

  onWaveCleared() { if (this.cur && !this.cur.done && this.cur.kind !== 'hvt') this.end(false); } // the HVT holds the wave open itself
  onKill(e) { if (e.hvt && this.cur?.kind === 'hvt' && this.cur.e === e && !this.cur.done) this.end(true); }

  // HOST (and solo) per frame
  update(dt, heroes) {
    const c = this.cur; if (!c) return;
    c.t -= dt;
    if (c.kind === 'restore') { if (c.t <= 0) this.cur = null; this.animate(dt); return; }
    if (c.kind === 'blackout') {
      for (const r of this.relays) {
        if (r.done) continue;
        const on = heroes.some((h) => !h.dead && Math.hypot(h.position.x - r.g.position.x, h.position.z - r.g.position.z) < EVENTS.blackout.radius);
        r.prog = Math.max(0, r.prog + (on ? dt : -dt * 0.5) / EVENTS.blackout.hold);
        if (r.prog >= 1) { r.done = true; r.prog = 1; this.hooks.sfx('powerup'); this.world.effects.spawnRing(r.g.position, 0x3ff6e0, 2.6, 0.6); }
      }
      if (this.relays.every((r) => r.done)) this.end(true);
      else if (c.t <= 0) this.end(false);
    } else if (c.kind === 'hvt') {
      if (!c.e || c.e.dead) { if (!c.done) this.end(!!c.e?.dead && !c.e.remove); }
      else if (c.t <= 0) this.end(false);
    } else if (c.kind === 'shift') {
      if (c.phase === 'warn' && c.t <= 0) { c.phase = 'on'; c.t = EVENTS.shift.dur; this.raiseWalls(); this.hooks.sfx('arenaChange'); }
      else if (c.phase === 'on' && c.t <= 0) this.end(true);
    }
    this.animate(dt);
    this.toTag(false, dt);
  }

  toTag(now, dt = 0) {
    const c = this.cur; if (!c || c.done) return;
    if (!now && (this.tagT -= dt) > 0) return; this.tagT = 0.25;
    const s = Math.max(0, Math.ceil(c.t));
    const e = c.e || this.hooks.byNid?.(c.nid);
    const txt = c.kind === 'blackout' ? `BLACKOUT · RELAYS ${this.relays.filter((r) => r.done).length}/2 ONLINE · ${s}s`
      : c.kind === 'hvt' ? `TARGET ${e && !e.dead && e.maxHp ? Math.ceil(100 * e.hp / e.maxHp) + '%' : 'LOCKED'} · ESCAPES ${s}s`
      : c.phase === 'warn' ? `LOCKDOWN IN ${s}s` : `LOCKDOWN · ${s}s`;
    this.hooks.tag(txt, COL[c.kind]);
  }

  // visuals (host + friends)
  animate(dt) {
    this.t += dt; const c = this.cur;
    // lighting: blackout dims the lit world (unlit telegraphs, lava, rings and UI keep full brightness)
    let k = 1;
    if (c?.kind === 'blackout' && !c.done) {
      const B = EVENTS.blackout, el = B.dur - c.t; // flicker hard for the first 1.5 s, then the odd stutter
      k = el < 1.5 ? (Math.random() < 0.5 ? 0.15 : 0.9) : B.light * (Math.sin(this.t * 23) > 0.97 ? 0.6 : 1);
    } else if (c?.kind === 'restore') k = 1 - (1 - EVENTS.blackout.light) * Math.max(0, c.t / 1.2);
    this.setLight(k);
    for (const r of this.relays) if (r.g.visible) {
      r.fill.scale.setScalar(Math.max(0.02, r.prog));
      r.core.material.color.setHex(r.done ? 0x3ff6e0 : 0xff6a1a);
      r.lamp.rotation.y += dt * 3; r.lamp.material.color.setHex(r.done ? 0x3ff6e0 : (Math.sin(this.t * 10) > 0 ? 0xffc23a : 0xff3a1a));
      r.ring.material.opacity = r.done ? 0.3 : 0.6 + 0.35 * Math.sin(this.t * 6);
    }
    if (c?.kind === 'hvt') {
      const e = c.e || this.hooks.byNid?.(c.nid);
      if (e && !e.dead) { this.mark.visible = true; this.mark.position.set(e.position.x, 0, e.position.z); this.markRing.rotation.z += dt * 2; this.markRing.scale.setScalar(1 + 0.12 * Math.sin(this.t * 8)); }
      else this.mark.visible = false;
    }
    if (c?.kind === 'shift') {
      const on = c.phase === 'on', rise = on ? Math.min(1, (EVENTS.shift.dur - c.t) / 0.6) : 0;
      this.warnMat.opacity = on ? 0.25 : 0.35 + 0.3 * Math.sin(this.t * 12);
      for (const w of this.walls) if (w.g.visible) { w.wall.visible = on; w.wall.scale.y = 2.2 * rise + 0.01; w.wall.position.y = w.wall.scale.y / 2; }
      this.wallMat.opacity = 0.45 + 0.15 * Math.sin(this.t * 9);
    }
  }

  setLight(k) {
    const env = this.world.env; if (!env) return;
    if (k >= 1 && !this.light0) return;
    if (!this.light0) this.light0 = { base: env.baseHemi, sun: env.sun.intensity, col: env.hemi.color.clone(), gnd: env.hemi.groundColor.clone() };
    const L = this.light0, red = new THREE.Color(0xff6a3a);
    env.baseHemi = L.base * Math.max(0.55, k); // the sky light stays fairly high (enemies readable), the sun drops harder
    env.hemi.intensity = env.baseHemi;
    env.sun.intensity = L.sun * k;
    env.hemi.color.copy(L.col).lerp(red, (1 - k) * 0.75);
    this.world.blackout = k < 0.95; // enemies glow (enemy.js)
    if (k >= 1) { env.baseHemi = L.base; env.hemi.intensity = L.base; env.sun.intensity = L.sun; env.hemi.color.copy(L.col); this.light0 = null; this.world.blackout = false; }
    document.body.classList.toggle('blackout', k < 0.95);
  }

  showRelays(v) { for (const r of this.relays) r.g.visible = v; }

  showWalls(id, phase) {
    const segs = LAYOUTS[id] || [];
    this.walls.forEach((w, i) => {
      const s = segs[i]; w.g.visible = !!s; if (!s) return;
      const [x1, z1, x2, z2] = s, len = Math.hypot(x2 - x1, z2 - z1);
      w.g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); w.g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      w.wall.scale.set(len, 0.01, 0.25); w.wall.visible = false;
      w.warn.scale.set(len, 1.4, 1);
      w.p1.scale.set(0.5, 2.6, 0.5); w.p1.position.set(-len / 2, 1.3, 0); w.p2.scale.set(0.5, 2.6, 0.5); w.p2.position.set(len / 2, 1.3, 0);
    });
  }

  // real colliders: a chain of small circles per wall in arena.obstacles (player, enemies and steering all use them)
  raiseWalls() {
    const c = this.cur, obs = this.world.arena.obstacles; this.wallObs = [];
    for (const [x1, z1, x2, z2] of LAYOUTS[c.layout] || []) {
      const len = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(len / 0.7);
      for (let i = 0; i <= n; i++) { const o = { x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r: 0.45, ev: 1 }; obs.push(o); this.wallObs.push(o); }
    }
    // nobody stays inside a wall: push heroes and enemies out now
    for (const h of this.world.teamOf(this.world.player)) this.world.arena.resolve(h.position, h.radius || 0.5);
    for (const e of this.hooks.enemies.list) if (!e.dead) this.world.arena.resolve(e.position, e.radius);
  }

  clearWalls() {
    const obs = this.world.arena.obstacles;
    for (let i = obs.length - 1; i >= 0; i--) if (obs[i].ev) obs.splice(i, 1);
    this.wallObs = null;
    for (const w of this.walls) w.g.visible = false;
  }

  // ---- co-op ----
  snapshot() {
    const c = this.cur; if (!c) return 0;
    if (c.kind === 'restore') return ['restore', Math.round(c.t * 10) / 10];
    return [c.kind, Math.round(c.t * 10) / 10, c.phase, c.done ? 1 : 0, c.nid || 0, c.layout || '',
      this.relays.map((r) => [Math.round(r.g.position.x * 10) / 10, Math.round(r.g.position.z * 10) / 10, Math.round(r.prog * 20) / 20, r.done ? 1 : 0])];
  }

  applySnapshot(s) {
    if (!s) { if (this.cur) this.reset(); return; }
    const [kind, t] = s;
    if (kind === 'restore') { if (this.cur?.kind !== 'restore') { this.showRelays(false); this.hooks.tag(null); } this.cur = { kind, t, done: true }; return; }
    const [, , phase, done, nid, layout, relays] = s;
    if (!this.cur || this.cur.kind !== kind) { this.reset(); this.cur = { kind, n: 0, done: false }; if (kind === 'blackout') this.showRelays(true); if (kind === 'shift') this.showWalls(layout, 0); }
    const c = this.cur; c.t = t; c.nid = nid; c.done = !!done;
    if (kind === 'shift') { c.layout = layout; if (phase === 'on' && c.phase !== 'on') { c.layout = layout; this.raiseWalls(); } }
    c.phase = phase;
    if (kind === 'blackout') relays.forEach(([x, z, p, d], i) => { const r = this.relays[i]; r.g.position.set(x, 0, z); r.prog = p; r.done = !!d; });
    this.toTag(true);
  }

  animateClient(dt) { if (this.cur) { if (this.cur.kind === 'restore') this.cur.t -= dt; else this.cur.t -= dt; this.animate(dt); } }
}

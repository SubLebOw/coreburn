// volkar.js: VOLKAR (hero id 'thane'), CoreBurnZ Phase 6 TEST BUILD kit.
//   ATTACK   Conduit Maul: 3 swings, each hit builds CHARGE (x2 on Shocked foes, max +4 per swing) and sends a
//            small static shockwave (25% to 4 others). At full Charge the next swing is a GROUND DISCHARGE slam.
//   MOBILITY Skyfall: 3 m Static Lunge (no i-frames) + telegraphed lightning strikes on the 3 best targets.
//   ULTIMATE Tempest Surge: needs a full STORM METER. Wind-up (rooted), 8 s storm, finisher, 3 s empowered swings.
//   SHOCKED  e.vShockUntil (seconds). Only Volkar applies it and only Volkar's own Conductor procs see it
//            (phase5 statuses() checks p.kit), so no other hero's balance changes.
// Every proc uses a non-attack kind ('shock' passive, 'skyfall' ability, 'spin' ultimate), flat bases (x REF 12),
// the normal strike() pipeline (host only), a hard 6-jump chain cap and a 4% boss max-HP cap per Surge.
// VFX: Volkar's OWN pool (bolt columns, chain arcs, ground telegraph rings), opaque MeshBasic, no lights, made once.
import * as THREE from 'three';

const REF = 12;
const now = () => performance.now() / 1000;
const isShocked = (e) => (e.vShockUntil || 0) > now();

// ---------------- pooled VFX (one per scene) ----------------
const BOLTS = 8, ARCS = 18, TELES = 10, CRACKS = 8, PTRS = 6; // v5: +4 cracks for kill-shatter
class VolkarFX {
  constructor(scene) {
    this.scene = scene;
    const seg = new THREE.BoxGeometry(1, 1, 1);
    this.boltMat = new THREE.MeshBasicMaterial({ color: 0xe8fbff });
    this.arcMat = new THREE.MeshBasicMaterial({ color: 0x6ae4ff });
    this.teleMat = new THREE.MeshBasicMaterial({ color: 0x2aa8e0 });
    this.fillMat = new THREE.MeshBasicMaterial({ color: 0x0c3c58 });
    // v4: every bolt / arc / crack segment is one instance of 3 InstancedMeshes (3 draw calls instead of up to ~100)
    this.inst = [];
    const pool = (mat, n) => { const im = new THREE.InstancedMesh(seg, mat, n); im.frustumCulled = false; im.visible = false; scene.add(im); const g = { im, p: [], dirty: true }; this.inst.push(g); return g; };
    const bG = pool(this.boltMat, (BOLTS + 4) * 4), aG = pool(this.arcMat, ARCS * 3);
    const mk = (g) => { const o = new THREE.Object3D(); o.visible = false; o.g = g; g.p.push(o); return o; };
    this.bolts = Array.from({ length: BOLTS + 4 }, () => ({ segs: [0, 1, 2, 3].map(() => mk(bG)), life: 0 }));
    this.arcs = Array.from({ length: ARCS }, () => ({ segs: [0, 1, 2].map(() => mk(aG)), life: 0 }));
    this._mk = mk; this._pool = pool;
    const ringGeo = new THREE.RingGeometry(0.9, 1, 28); ringGeo.rotateX(-Math.PI / 2);
    const discGeo = new THREE.CircleGeometry(1, 24); discGeo.rotateX(-Math.PI / 2);
    this.teles = Array.from({ length: TELES }, () => {
      const ring = new THREE.Mesh(ringGeo, this.teleMat), fill = new THREE.Mesh(discGeo, this.fillMat);
      ring.visible = fill.visible = false; scene.add(ring); scene.add(fill); return { ring, fill, life: 0, max: 1, r: 1 };
    });
    // v2: maul-slam ground cracks (3 flat dark shards each) and Skyfall direction pointers (flat chevrons at the hero's feet
    // that point at far / off-screen marked targets for the telegraph's whole duration). Opaque, pooled, made once.
    this.crackMat = new THREE.MeshBasicMaterial({ color: 0x0a0d12 });
    const cG = pool(this.crackMat, CRACKS * 4);
    this.cracks = Array.from({ length: CRACKS }, () => ({ segs: [0, 1, 2, 3].map(() => mk(cG)), life: 0 }));
    // v4 Mythic: one storm cloud (dark flattened blob + rim ring), made once
    this.cloudG = new THREE.Group();
    const cm = new THREE.MeshBasicMaterial({ color: 0x1c2733 }), cm2 = new THREE.MeshBasicMaterial({ color: 0x2c3e52 });
    const blob = new THREE.IcosahedronGeometry(1, 0);
    [[0, 0, 0, 1.5], [1.2, 0.1, 0.3, 1.1], [-1.1, 0.05, -0.2, 1.15], [0.2, 0.25, -1, 1], [-0.3, 0.2, 1, 1]].forEach(([x, y, z, r], i) => { const m = new THREE.Mesh(blob, i % 2 ? cm2 : cm); m.position.set(x, y, z); m.scale.set(r, r * 0.45, r); this.cloudG.add(m); });
    this.cloudG.visible = false; scene.add(this.cloudG); this.cloudLife = 0;
    const chev = new THREE.ConeGeometry(0.32, 0.9, 3); chev.rotateX(Math.PI / 2); chev.scale(1, 0.15, 1);
    this.ptrMat = new THREE.MeshBasicMaterial({ color: 0x6ae4ff });
    this.ptrs = Array.from({ length: PTRS }, () => { const m = new THREE.Mesh(chev, this.ptrMat); m.visible = false; m.frustumCulled = false; scene.add(m); return { m, life: 0 }; });
    // v7: thrown maul = same scale as the hand model; tight electric streak (not ribbons); softer storm FX
    this.throwG = new THREE.Group(); this.throwG.visible = false; scene.add(this.throwG);
    const mkM = (mat, sx, sy, sz, y = 0) => { const m = new THREE.Mesh(seg, mat); m.scale.set(sx, sy, sz); m.position.y = y; this.throwG.add(m); return m; };
    const mPlate = new THREE.MeshBasicMaterial({ color: 0x5a6068 }), mDark = new THREE.MeshBasicMaterial({ color: 0x3a3e46 });
    const mOrange = new THREE.MeshBasicMaterial({ color: 0xe0702a }), mGlow = new THREE.MeshBasicMaterial({ color: 0x6ae4ff });
    // match hand maul: shaft cyl ~0.08×1.0, head 0.3×0.3×0.5 — oriented with head along +Y (points along travel)
    mkM(mDark, 0.08, 1.0, 0.08, -0.55); // shaft behind the head
    mkM(mPlate, 0.3, 0.3, 0.5, 0); mkM(mOrange, 0.34, 0.08, 0.54, 0);
    // electric tip + thin corona (readability from top-down without upsizing the metal)
    mkM(mGlow, 0.22, 0.06, 0.22, 0.2);
    const tip = new THREE.Mesh(seg, new THREE.MeshBasicMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.85, depthWrite: false }));
    tip.scale.set(0.45, 0.08, 0.45); tip.position.y = 0.28; this.throwG.add(tip);
    // 6 short afterimage streaks (thin electric, quick fade)
    this.trailMat = new THREE.MeshBasicMaterial({ color: 0x9ae8ff, transparent: true, opacity: 0.55, depthWrite: false });
    this.trails = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(seg, this.trailMat.clone()); m.visible = false; scene.add(m); return m; });
    this.throw = null; this.shatterN = 0;
    // Surge: softer storm disc + brief sheet flash + light vignette
    const stormGeo = new THREE.CircleGeometry(26, 20); stormGeo.rotateX(-Math.PI / 2);
    this.stormDisc = new THREE.Mesh(stormGeo, new THREE.MeshBasicMaterial({ color: 0x1a2438, transparent: true, opacity: 0.0, depthWrite: false }));
    this.stormDisc.position.y = 15; this.stormDisc.visible = false; scene.add(this.stormDisc);
    const sheetGeo = new THREE.PlaneGeometry(70, 36); this.sheet = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ color: 0xc8dcff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.sheet.position.set(0, 13, -18); this.sheet.visible = false; scene.add(this.sheet); this.flashT = 0;
  }
  crack(pos, dir, size) { // radiating dark shards on the floor at a slam impact
    rec('crack', pos, dir, size);
    const c = this.cracks.find((x) => x.life <= 0) || this.cracks[0];
    c.life = 0.6; const base = Math.atan2(dir.x, dir.z);
    c.segs.forEach((m, i) => { const a = base + (i - 1.5) * 0.9 + (Math.random() - 0.5) * 0.4, L = size * (0.7 + Math.random() * 0.5);
      m.position.set(pos.x + Math.sin(a) * L * 0.5, 0.03, pos.z + Math.cos(a) * L * 0.5); m.rotation.set(0, a, 0); m.quaternion.setFromEuler(m.rotation); m.scale.set(0.09, 0.02, L); m.visible = true; m.g.dirty = true; });
  }
  ptr(life) { const q = this.ptrs.find((x) => x.life <= 0) || this.ptrs[0]; q.life = life; q.m.visible = true; return q; }
  aimPtr(q, from, to) { const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 1; q.m.position.set(from.x + dx / d * 1.9, 0.12, from.z + dz / d * 1.9); q.m.rotation.set(0, Math.atan2(dx, dz), 0); }
  _jag(segs, pts, w) {
    const up = _up;
    segs.forEach((m, i) => {
      const p0 = pts[i], p1 = pts[i + 1]; m.g.dirty = true;
      if (!p1) { m.visible = false; return; }
      m.position.copy(p0).add(p1).multiplyScalar(0.5);
      m.scale.set(w, p0.distanceTo(p1), w);
      m.quaternion.setFromUnitVectors(up, _v.copy(p1).sub(p0).normalize());
      m.visible = true;
    });
  }
  bolt(pos, top = 9) { // a jagged column from the sky
    rec('bolt', pos, top);
    const b = this.bolts.find((x) => x.life <= 0) || this.bolts[0];
    b.life = 0.16;
    const pts = [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(pos.x + (i && i < 4 ? (Math.random() - 0.5) * 0.9 : 0), top - i * (top / 4), pos.z + (i && i < 4 ? (Math.random() - 0.5) * 0.9 : 0)));
    pts[4].y = 0.05;
    this._jag(b.segs, pts, 0.14);
  }
  arc(a, bp) {
    rec('arc', a, bp);
    const z = this.arcs.find((x) => x.life <= 0) || this.arcs[0];
    z.life = 0.14;
    const pts = [0, 1, 2, 3].map((i) => { const p = a.clone().lerp(bp, i / 3).setY(1.1); if (i && i < 3) { p.x += (Math.random() - 0.5) * 0.7; p.y += (Math.random() - 0.5) * 0.5; p.z += (Math.random() - 0.5) * 0.7; } return p; });
    this._jag(z.segs, pts, 0.07);
  }
  tele(pos, r, dur) {
    rec('tele', pos, r, dur);
    const t = this.teles.find((x) => x.life <= 0) || this.teles[0];
    t.life = t.max = dur; t.r = r; t.ring.position.set(pos.x, 0.05, pos.z); t.fill.position.set(pos.x, 0.04, pos.z);
    t.ring.scale.setScalar(r); t.fill.scale.setScalar(0.01); t.ring.visible = t.fill.visible = true; return t;
  }
  cloud(pos, life) { rec('cloud', pos, life); this.cloudG.position.set(pos.x, 6.5, pos.z); this.cloudLife = life; this.cloudG.visible = life > 0; }
  // v7 Skyfall hammer throw: short side-arm wind → fast head-first flight → snap return (Mjolnir, not a lob)
  throwMaul(from, to, out, back = 0.18) {
    rec('throwMaul', from, to, out, back);
    this.throw = { from: from.clone(), to: to.clone().setY(1.15), out: Math.max(0.18, Math.min(0.4, out)), back: Math.min(0.22, back), t: 0, phase: 'wind', home: from.clone(), trail: [], spin: 0 };
    this.throwG.visible = false;
  }
  // v5 kill shatter: glowing cracks + cyan sparks; hard cap 3 new ones per frame (shatterN reset in update)
  shatter(pos, y = 1.2) {
    if (this.shatterN >= 3) return;
    this.shatterN++;
    rec('shatter', pos, y);
    const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, 0, pos.z);
    const was = REPLAY; REPLAY = true; // play crack/arc without a second co-op record (shatter itself is the event)
    try {
      this.crack(p, new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), 1.4);
      this.arc(p.clone().setY(y), p.clone().setY(y).add(new THREE.Vector3(1.2, 0, 0)));
      this.arc(p.clone().setY(y), p.clone().setY(y).add(new THREE.Vector3(-0.8, 0, 1)));
    } finally { REPLAY = was; }
    if (this._world?.effects) { this._world.effects.localSparks?.(p.clone().setY(y), 0xe8fbff, 10, 7); this._world.effects.localRing?.(p, 0x4ad8ff, 1.6, 0.25); }
  }
  // v7 Surge darkening: moody storm (halfway v5/v6). Floor, enemies, hazards stay clearly visible.
  _vignette() {
    if (this._vig) return this._vig;
    const el = document.createElement('div'); el.id = 'vk-storm-vig';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:20;opacity:0;transition:opacity .12s linear;background:radial-gradient(ellipse at center,transparent 42%,rgba(8,14,28,.28) 72%,rgba(4,8,18,.5) 100%)';
    document.body.appendChild(el); return (this._vig = el);
  }
  dark(k, cam = 2.5, flash = 0) {
    if (this._darkK === undefined || Math.abs(this._darkK - k) > 0.06 || ((k <= 0) !== (this._darkK <= 0)) || flash) rec('dark', k, cam, flash);
    this._darkK = k;
    const sc = this.scene, w = this._world;
    if (!w) return;
    const vig = this._vignette();
    if (k <= 0) {
      const snap = w._vStormSnap; vig.style.opacity = '0'; this.stormDisc.visible = false; this.stormDisc.material.opacity = 0; this.sheet.visible = false; this.sheet.material.opacity = 0; this.flashT = 0;
      if (w._vEnemyGlow) { for (const [e, c] of w._vEnemyGlow) { if (e) e.baseEmissive = c; } w._vEnemyGlow = null; }
      if (!snap) { w.vCamExtra = 0; w._vStormSnap = null; return; }
      sc.background?.copy?.(snap.bg); if (sc.fog) { sc.fog.color.copy(snap.fogC); sc.fog.near = snap.near; sc.fog.far = snap.far; }
      w.env.hemi.color.copy(snap.hemiC); w.env.hemi.intensity = snap.hemi; w.env.baseHemi = snap.base; w.env.sun.intensity = snap.sun; w.env.sun.color.copy(snap.sunC);
      w.vCamExtra = 0; w._vStormSnap = null; return;
    }
    if (!w._vStormSnap) {
      w._vStormSnap = { bg: sc.background?.clone?.() || new THREE.Color(0x14191d), fogC: sc.fog?.color.clone() || new THREE.Color(0x14191d),
        near: sc.fog?.near ?? 45, far: sc.fog?.far ?? 95, hemi: w.env.hemi.intensity, base: w.env.baseHemi, sun: w.env.sun.intensity,
        hemiC: w.env.hemi.color.clone(), sunC: w.env.sun.color.clone() };
    }
    const snap = w._vStormSnap, cool = new THREE.Color(0x4a6080);
    // storm target: blue-grey on bright arenas; stay darker than the snap on already-dark arenas (never brighten)
    const storm = new THREE.Color(0x2a3548);
    const snapL = snap.bg.r * 0.2126 + snap.bg.g * 0.7152 + snap.bg.b * 0.0722;
    if (snapL < 0.18) storm.setHex(0x101820); // dark arenas: deepen, don't lift
    // readable storm: hemi ~-50%, sun ~-60%, partial bg/fog lerp (not blackout)
    if (sc.background) sc.background.copy(snap.bg).lerp(storm, 0.5 * k);
    if (sc.fog) { sc.fog.color.copy(snap.fogC).lerp(storm, 0.45 * k); sc.fog.near = snap.near * (1 - 0.25 * k); sc.fog.far = snap.far * (1 - 0.12 * k); }
    w.env.baseHemi = snap.base * (1 - 0.52 * k); w.env.hemi.intensity = w.env.baseHemi + flash * 1.8;
    w.env.hemi.color.copy(snap.hemiC).lerp(cool, 0.35 * k);
    w.env.sun.intensity = snap.sun * (1 - 0.6 * k) + flash * 1.2; w.env.sun.color.copy(snap.sunC).lerp(new THREE.Color(0xb0c4e0), 0.3 * k);
    w.vCamExtra = cam * k;
    vig.style.opacity = String(0.5 * k);
    this.stormDisc.visible = k > 0.05; this.stormDisc.material.opacity = 0.28 * k; this.stormDisc.scale.setScalar(0.85 + 0.2 * k);
    if (flash > 0) { this.flashT = 0.07; this.sheet.visible = true; this.sheet.material.opacity = 0.22 * flash; }
    // faint cool rim: bump baseEmissive so setEmissive keeps a cool glow while storming
    if (!w._vEnemyGlow && w.enemies?.list) {
      w._vEnemyGlow = new Map();
      for (const e of w.enemies.list) {
        if (e.dead || e.baseEmissive === undefined) continue;
        w._vEnemyGlow.set(e, e.baseEmissive);
        e.baseEmissive = 0x1a3048; // cool storm rim; animate() / setEmissive will pick it up
      }
    }
  }
  update(dt) {
    this.shatterN = 0;
    if (this.flashT > 0) { this.flashT -= dt; this.sheet.material.opacity = Math.max(0, this.flashT * 2.5); if (this.flashT <= 0) this.sheet.visible = false; }
    if (this.stormDisc.visible) { this.stormDisc.rotation.y += dt * 0.15; const o = this._throwOwner || this._world?.player; if (o?.position) this.stormDisc.position.set(o.position.x, 16, o.position.z); }
    if (this.throw) { // v7 Mjolnir flight: head-first, low, fast, slight axial spin
      const th = this.throw, g = this.throwG, owner = this._throwOwner; th.t += dt;
      const setPose = (p) => { if (owner?.vk) owner.vk.throwPose = p; };
      const hideTrail = () => { for (const t of this.trails) t.visible = false; };
      const aimQuat = (from, to) => { // head (+Y) points along travel
        _v.copy(to).sub(from).normalize(); if (_v.lengthSq() < 1e-6) _v.set(0, 0, 1);
        g.quaternion.setFromUnitVectors(_up, _v);
        g.rotateY(th.spin); // slight spin around travel axis
      };
      const pushTrail = () => {
        th.trail.push(g.position.clone()); if (th.trail.length > 7) th.trail.shift();
        for (let i = 0; i < this.trails.length; i++) {
          const a = th.trail[i], b = th.trail[i + 1], m = this.trails[i];
          if (!a || !b) { m.visible = false; continue; }
          const d = a.distanceTo(b); if (d < 0.04) { m.visible = false; continue; }
          m.position.copy(a).add(b).multiplyScalar(0.5);
          // thin bright streak — slightly wider near the head so top-down still reads a line
          const w = 0.05 + 0.04 * (i / this.trails.length);
          m.scale.set(w, d, w);
          m.quaternion.setFromUnitVectors(_up, _v.copy(b).sub(a).normalize());
          m.material.opacity = 0.18 + 0.5 * (i / this.trails.length); m.visible = true;
        }
        // occasional crackle arc along the path (local only — don't flood co-op fx)
        if (th.trail.length >= 2 && Math.random() < 0.25) {
          const a = th.trail[th.trail.length - 2], b = th.trail[th.trail.length - 1];
          const was = REPLAY; REPLAY = true; try { this.arc(a, b); } finally { REPLAY = was; }
        }
      };
      if (th.phase === 'wind') {
        setPose('wind');
        if (owner) th.from.copy(owner.position).setY(1.35);
        if (th.t >= 0.1) { // short, strong release
          th.phase = 'out'; th.t = 0; setPose('release');
          owner?.model?.setMaulVisible?.(false); g.visible = true; g.position.copy(th.from);
          aimQuat(th.from, th.to); this._world?.sfx?.('vSwing', 3);
        }
      } else if (th.phase === 'out') {
        setPose('out');
        const u = Math.min(1, th.t / Math.max(0.05, th.out)), e = u; // linear = reads as fast and heavy
        g.position.lerpVectors(th.from, th.to, e);
        g.position.y = 1.15 + Math.sin(u * Math.PI) * 0.35; // low tight path, not a lob
        th.spin += dt * 10; aimQuat(th.from, th.to); pushTrail();
        if (u >= 1) { th.phase = 'hold'; th.t = 0; }
      } else if (th.phase === 'hold') {
        setPose('out');
        if (th.t >= 0.08) { th.phase = 'back'; th.t = 0; th.from.copy(g.position); if (owner) th.home.copy(owner.position).setY(1.35); }
      } else if (th.phase === 'back') {
        setPose('out');
        const u = Math.min(1, th.t / Math.max(0.05, th.back)), e = u * u; // accelerate home
        g.position.lerpVectors(th.from, th.home, e);
        g.position.y = 1.15 + Math.sin(u * Math.PI) * 0.25;
        th.spin += dt * 14; aimQuat(g.position, th.home); pushTrail();
        if (u >= 1) {
          th.phase = 'catch'; th.t = 0; hideTrail(); g.visible = false;
          owner?.model?.setMaulVisible?.(true); setPose('catch');
          this._world?.sfx?.('vCrackle');
          this._world?.effects?.localSparks?.(th.home.clone().setY(1.3), 0xbfe8ff, 5, 4);
        }
      } else { // catch: short arm recoil
        setPose('catch');
        if (th.t >= 0.12) { this.throw = null; setPose(null); hideTrail(); this._throwOwner = null; }
      }
    }
    const off = (x) => { for (const s of x.segs) { s.visible = false; s.g.dirty = true; } };
    for (const b of this.bolts) if (b.life > 0 && (b.life -= dt) <= 0) off(b);
    for (const z of this.arcs) if (z.life > 0 && (z.life -= dt) <= 0) off(z);
    for (const c of this.cracks) if (c.life > 0 && (c.life -= dt) <= 0) off(c);
    if (this.cloudLife > 0) { this.cloudLife -= dt; this.cloudG.rotation.y += dt * 0.4; const k = Math.min(1, this.cloudLife * 2); this.cloudG.scale.setScalar(0.4 + 0.6 * k); if (this.cloudLife <= 0) this.cloudG.visible = false; }
    for (const g of this.inst) {
      if (!g.dirty) continue; g.dirty = false; let any = false;
      g.p.forEach((o, i) => { if (o.visible) { any = true; o.updateMatrix(); g.im.setMatrixAt(i, o.matrix); } else g.im.setMatrixAt(i, _zero); });
      g.im.instanceMatrix.needsUpdate = true; g.im.visible = any;
    }
    for (const q of this.ptrs) if (q.life > 0 && (q.life -= dt) <= 0) q.m.visible = false;
    for (const t of this.teles) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) { t.ring.visible = t.fill.visible = false; continue; }
      t.fill.scale.setScalar(Math.max(0.01, t.r * (1 - t.life / t.max)));
    }
  }
  clear() { this.cloudLife = 0; this.cloudG.visible = false; this.throw = null; this.throwG.visible = false; for (const t of this.trails) t.visible = false; if (this._throwOwner) { this._throwOwner.model?.setMaulVisible?.(true); if (this._throwOwner.vk) this._throwOwner.vk.throwPose = null; this._throwOwner = null; } this.dark(0); for (const g of this.inst) g.dirty = true; for (const b of [...this.bolts, ...this.arcs]) { b.life = 0; for (const s of b.segs) s.visible = false; } for (const t of this.teles) { t.life = 0; t.ring.visible = t.fill.visible = false; } for (const c of this.cracks) { c.life = 0; for (const s of c.segs) s.visible = false; } for (const q of this.ptrs) { q.life = 0; q.m.visible = false; } }
  get live() { return this.bolts.filter((b) => b.life > 0).length + this.arcs.filter((b) => b.life > 0).length + this.teles.filter((t) => t.life > 0).length; }
}
const _up = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const FX = new WeakMap();
const fxFor = (scene) => { let f = FX.get(scene); if (!f) { f = new VolkarFX(scene); FX.set(scene, f); } return f; };
export function vfx(p) { const f = fxFor(p.scene); if (p.world) { f._world = p.world; p.world.volkarShatter = (pos, y) => f.shatter(pos, y); } return f; }
// v4 CO-OP: the host records every pooled Volkar effect (coop.installRecorders sets REC); friends replay them into
// their own pool (vfxReplay). Telegraphs replay where they were placed (they don't follow the target on friends).
let REC = null, REPLAY = false;
function rec(op, ...a) { if (REC && !REPLAY) REC(op, a); }
export function setVolkarRecorder(f) { REC = f; }
export function vfxReplay(scene, op, args, world) { const f = fxFor(scene); if (world) f._world = world; if (typeof f[op] !== 'function') return; REPLAY = true; try { f[op](...args); } finally { REPLAY = false; } }
// one tick per frame for the shared scene pool (main loop; host and friends), however many Volkars are in the run
export function tickVolkarFX(scene, dt) { FX.get(scene)?.update(dt); }

// ---------------- state ----------------
export function stormClear(p) { // restore Surge sky / camera (death, reset, surge end)
  const f = FX.get(p?.scene); if (f) f.dark(0); else if (p?.world) { p.world.vCamExtra = 0; p.world._vStormSnap = null; }
}
export function vReset(p) {
  stormClear(p);
  p.vk = { charge: 0, meter: 0, lockT: 0, combatT: 99, decayT: 0, strikes: [], surge: null, empowerT: 0, bossDealt: new Map(), discharge: false, swingGain: 0, dischargeN: 0, cloud: null, stillT: 0, grounded: false, groundedSwing: false, throwPose: null };
  if (p.char.id === 'thane' && p.stats?.m?.tPre) p.vk.charge = 3;
  FX.get(p.scene)?.clear();
}
const S = (p) => p.stats;
export const chargeMax = (p) => Math.max(p.char.charge.minMax || 1, p.char.charge.max - (S(p).tCharge || 0));
const meterMul = (p) => (1 + 0.1 * (S(p).tMeter || 0)) * (1 + Math.max(0, 1 - (S(p).spinCd ?? 1))); // Static Build-up; Ultimate Coolant fills it faster
export function addMeter(p, n) {
  const v = p.vk; if (!v || v.surge || v.lockT > 0) return;
  const max = p.char.meter.max, was = v.meter;
  v.meter = Math.min(max, v.meter + n * meterMul(p));
  if (was < max && v.meter >= max) { p.world.effects.localRing(p.position, 0x4ad8ff, 2.4, 0.4); p.world.sfx('vMark'); }
}
export const meterFull = (p) => !!p.vk && !p.vk.surge && p.vk.meter >= p.char.meter.max;
function shock(p, e) { e.vShockUntil = now() + p.char.charge.shockT + (S(p).m?.tConduct ? 0.5 : 0); }

// one damage hit on behalf of Volkar; bosses obey the Surge 4% cap while a Surge is running (or its finisher)
// v4: `surge` may also be a cap object { map, pct } (evolution volley / Mythic cloud: their own boss max-HP budgets)
function hit(p, e, base, kx, kz, heavy, kind, surge = false) {
  if (!e.canBeHit) return false;
  if (surge && e.isBoss) {
    const cm = surge === true ? p.vk.bossDealt : surge.map, cap = (e.maxHp || 0) * (surge === true ? p.char.surge.bossCapPct : surge.pct), dealt = cm.get(e) || 0;
    if (dealt >= cap) { p.world.effects.localSparks?.(e.position.clone().setY(1.4), 0x4ad8ff, 2, 3); return false; }
    const before = e.hp; p.strike(e, base, kx, kz, heavy, kind); killMeter(p, e);
    let d = Math.max(0, before - e.hp);
    if (dealt + d > cap && !e.dead) { e.hp += dealt + d - cap; d = cap - dealt; } // clamp the overshoot (Bossfang/crits applied first)
    cm.set(e, dealt + d);
    return true;
  }
  p.strike(e, base, kx, kz, heavy, kind);
  killMeter(p, e);
  if (arguments[8] && (e.dead || e.hp <= 0)) e.vShatter = true; // v5: optional shatter tag (Discharge)
  return true;
}
export function tagShatter(e) { if (e && (e.dead || e.hp <= 0)) e.vShatter = true; }
// v3: every kill by Volkar's own hits adds Storm meter (counted once per enemy)
export function killMeter(p, e) { if (p.vk && !e.vKillMeter && (e.dead || e.hp <= 0)) { e.vKillMeter = true; addMeter(p, p.char.meter.kill || 0); } }
const enemies = (p) => p.world.enemies.list;
function near(p, pos, r, skip) {
  const out = [];
  for (const e of enemies(p)) { if (!e.canBeHit || skip?.has(e)) continue; const dx = e.position.x - pos.x, dz = e.position.z - pos.z; if (dx * dx + dz * dz <= (r + e.radius) ** 2) out.push(e); }
  return out;
}
// chain from `from`: `jumps` jumps, each x0.8 more; Shocked enemies don't use a jump (hard cap 6 total)
// v4 evolution: `budget` ({ n }) is a jump pool shared by a whole volley, and `split` lets the chain fork ONCE at a Shocked foe
function chainFrom(p, from, base, jumps, { range = 4.5, shockedOnly = false, surge = false, done = new Set([from]), budget = null, split = null } = {}) {
  let src = from, b = base, left = jumps, total = 0;
  const cap = p.char.skyfall.maxJumps;
  while (left > 0 && total < cap && (!budget || budget.n > 0)) {
    let best = null, bd = range * range;
    for (const e of enemies(p)) { if (!e.canBeHit || done.has(e) || (shockedOnly && !isShocked(e))) continue; const dx = e.position.x - src.position.x, dz = e.position.z - src.position.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    done.add(best); total++; if (budget) budget.n--;
    vfx(p).arc(src.position, best.position);
    const conduct = isShocked(best);
    hit(p, best, b * (best.elite || best.isBoss ? 1 + p.char.skyfall.eliteChainBonus : 1), 0, 0, false, 'shock', surge);
    shock(p, best);
    if (conduct && split && !split.used) { split.used = true; total += chainFrom(p, best, b * 0.8, left, { range, shockedOnly, surge, done, budget }); }
    if (!conduct || shockedOnly) left--;
    src = best; b *= 0.8;
  }
  return total;
}

// ---------------- maul ----------------
// called from doSlashHit for every enemy the swing struck
export function onMaulHit(p, e, swingDmg, struck) {
  const v = p.vk, c = p.char.charge;
  const shocked = isShocked(e) || v.empowerT > 0;
  const gain = Math.min(c.capPerSwing - v.swingGain, shocked ? c.perShocked : c.perHit);
  if (gain > 0 && !v.discharge) { v.swingGain += gain; v.charge = Math.min(chargeMax(p), v.charge + gain); p.world.sfx('vCharge', v.charge); }
  addMeter(p, shocked ? p.char.meter.shockedHit : p.char.meter.hit);
  v.combatT = 0;
  // mini static shockwave at the impact point (kind 'shock': not an attack, no Twin/Storm/leech)
  const w = c.wave, r = w.r * (1 + 0.12 * (S(p).tWave || 0));
  let n = 0;
  for (const o of near(p, e.position, r, struck)) { if (o === e) continue; if (n >= w.max) break; n++; hit(p, o, swingDmg * w.pct * (1 + 0.1 * (S(p).tWave || 0)), 0, 0, false, 'shock'); }
  if (n) p.world.effects.localRing(e.position, 0x6ae4ff, r, 0.18);
}
// swing start: is this swing the Ground Discharge?
export function onSwingStart(p) {
  const v = p.vk; v.swingGain = 0; v.discharge = v.charge >= chargeMax(p); if (v.discharge) p.world.sfx('vMark');
  // v5 Grounded: the built static empowers THIS slam, then clears
  v.groundedSwing = !!v.grounded; v.grounded = false; v.stillT = 0;
}
// v3: the maul head's own small area at the impact point; same swing damage, skips anything the swing already struck
export function slamTargets(p, forward, struck) {
  const a = p.char.charge.slamAoE, at = p.position.clone().addScaledVector(forward, a.at);
  return near(p, at, a.r, struck);
}
export const burstMult = (p) => (p.vk?.burstT > 0 ? 1 + p.char.charge.burst.pct : 1);
export const swingMult = (p) => { let m = 1; if (p.vk?.empowerT > 0) m *= 1 + p.char.surge.empowerPct; if (p.vk?.groundedSwing) m *= 1.18; return m; }; // v5 Grounded: +18% on the charged slam
// after the swing's own hits: the Ground Discharge
// v2: every maul hit is an overhead SLAM; this is the visual ground impact (no damage, purely cosmetic).
// Hits 1-2 are quick slams, the 3rd a heavier one; a Ground Discharge is the same slam, bigger again.
function slamImpact(p, forward, heavy, discharge) {
  const at = p.position.clone().addScaledVector(forward, p.char.charge.slamAoE.at), fx = p.world.effects, f = vfx(p);
  const big = discharge ? 1.9 : heavy ? 1.35 : 1;
  fx.spawnRing(at, discharge ? 0x4ad8ff : 0x9adfff, 1.3 * big, 0.25);
  fx.localSparks(at.clone().setY(0.2), 0x7a6a58, heavy || discharge ? 10 : 6, 4); // dust
  fx.localSparks(at.clone().setY(0.3), 0xe8fbff, heavy || discharge ? 8 : 4, 5); // static flash
  f.crack(at, forward, 1.1 * big);
  f.arc(at, at.clone().add(new THREE.Vector3(forward.z, 0, -forward.x).multiplyScalar(1.2 * big)));
  f.arc(at, at.clone().add(new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(1.2 * big)));
  if (heavy && !discharge) f.bolt(at);
  if (!discharge) p.world.shake(heavy ? 0.28 : 0.14);
  return at;
}
export function afterSwing(p, forward, struck) {
  const v = p.vk, heavy = p.comboStep >= p.combo.length;
  v.burstT = p.char.charge.burst.t;
  const groundedHit = v.groundedSwing; v.groundedSwing = false; // consume after the damage frame has used swingMult
  if (!v.discharge) { slamImpact(p, forward, heavy, false); if (groundedHit) vfx(p).arc(p.position.clone().setY(0.4), p.position.clone().addScaledVector(forward, 1.5).setY(0.1)); return; }
  v.discharge = false; v.charge = 0;
  if (S(p).myVk && ++v.dischargeN % p.char.mythic.every === 0) { // v4 MYTHIC (Brewing Squall): every 4th Ground Discharge
    const my = p.char.mythic; v.cloud = { pos: p.position.clone().addScaledVector(forward, 1.2).setY(0), t: my.time, tick: 0.3, cap: { map: new Map(), pct: my.bossCapPct } };
    vfx(p).cloud(v.cloud.pos, my.time); p.world.sfx('vWindup');
  }
  const d = p.char.charge.discharge, at = p.position.clone().addScaledVector(forward, 1.2), fx = p.world.effects;
  slamImpact(p, forward, true, true);
  fx.spawnRing(at, 0x4ad8ff, d.r, 0.35); fx.spawnRing(at, 0xe8fbff, d.r * 0.55, 0.22);
  fx.spawnSparks(at.clone().setY(0.5), 0x9ae8ff, 16, 8);
  vfx(p).bolt(at); vfx(p).bolt(at.clone().addScaledVector(forward, 0.6));
  p.world.sfx('vDischarge'); p.world.shake(0.6); p.world.hitstop(0.06);
  const hitSet = new Set();
  for (const e of near(p, at, d.r)) {
    const dx = e.position.x - at.x, dz = e.position.z - at.z, dd = Math.hypot(dx, dz) || 1;
    hit(p, e, REF * d.dmg, dx / dd * 10, dz / dd * 10, true, 'shock', false, true);
    if (!e.isBoss) p.stun(e, d.stun);
    shock(p, e); hitSet.add(e);
  }
  // arcs to the nearest enemies outside the ring
  const arcs = d.arcs + (S(p).tArc || 0), outside = enemies(p).filter((e) => e.canBeHit && !hitSet.has(e) && e.position.distanceTo(at) <= d.r + d.arcRange)
    .sort((a, b) => a.position.distanceTo(at) - b.position.distanceTo(at)).slice(0, arcs);
  for (const e of outside) { vfx(p).arc(at, e.position); hit(p, e, REF * d.dmg * d.arcPct, 0, 0, false, 'shock'); shock(p, e); }
}

// ---------------- Skyfall ----------------
function pickTargets(p, n, range, from = p.position) {
  const list = enemies(p).filter((e) => e.canBeHit && e.position.distanceTo(from) <= range);
  list.sort((a, b) => ((b.isBoss ? 2 : b.elite ? 1 : 0) - (a.isBoss ? 2 : a.elite ? 1 : 0)) || a.position.distanceTo(from) - b.position.distanceTo(from));
  return list.slice(0, n);
}
export function skyfall(p, aim) {
  const k = p.char.skyfall, s = S(p);
  p.spendCharge();
  p.state = 'dash'; p.stateTime = 0; p.dashDir = aim.clone().setY(0).normalize();
  p.facing = Math.atan2(p.dashDir.x, p.dashDir.z);
  const lungeEnd = p.position.clone().addScaledVector(p.dashDir, k.lunge);
  const n = k.targets + (s.tSkyCount || 0), delay = Math.max(0.35, k.delay - 0.1 * (s.tSkyQuick || 0));
  const targets = pickTargets(p, n, k.range * (s.m?.tLong ? 1.15 : 1), lungeEnd);
  const jumps = s.tSkyChain || 0;
  if (!targets.length) p.vk.strikes.push({ pos: lungeEnd.clone(), t: delay, target: null, r: k.radius, dmg: REF * k.dmg, jumps, kind: 'skyfall', meter: true, tele: vfx(p).tele(lungeEnd, k.radius, delay) });
  const evo = s.tEvo ? { n: k.evo.maxJumps, split: { used: false }, cap: { map: new Map(), pct: k.evo.bossCapPct } } : null;
  for (const [i, e] of targets.entries()) {
    const t = delay + i * 0.08;
    const far = e.position.distanceTo(p.position) > 9; // v2 unlimited range: far / off-screen marks get a chevron at your feet
    p.vk.strikes.push({ pos: e.position.clone(), t, target: e, r: k.radius, dmg: REF * k.dmg, jumps, kind: 'skyfall', meter: true, tele: vfx(p).tele(e.position, k.radius, t), ptr: far ? vfx(p).ptr(t) : null, evo, walk: evo ? p.dashDir.clone() : null });
  }
  p.world.sfx('vMark');
  p.world.effects.localRing(p.position, 0x4ad8ff, 1.6, 0.25);
  // v6: wind-up then hurl; flight timed so the maul plants as the first strike lands
  const dest = (targets[0]?.position || lungeEnd).clone().setY(1.3), f = vfx(p);
  f._throwOwner = p; p.vk.throwPose = 'wind';
  // short wind (0.1s in update); flight is the rest of the telegraph — plants with the bolt
  f.throwMaul(p.position.clone().setY(1.35), dest, Math.max(0.2, delay - 0.12), 0.18);
}
export function skyfallDash(p) { // the 0.18 s Static Lunge (no i-frames: takeDamage has no thane exception)
  const k = p.char.skyfall;
  if (p.stateTime < 0.18) p.velocity.copy(p.dashDir).multiplyScalar(k.lunge / 0.18);
  else p.state = 'normal';
}

function landStrike(p, st) {
  const fx = vfx(p); fx.bolt(st.pos);
  if (st.kind === 'skyfall' && fx.throw && fx.throw.phase === 'out') {
    // v7 impact: bolt hits the planted maul — sharp flash, ground crack, light shake
    fx.throw.phase = 'hold'; fx.throw.t = 0; fx.throw.to.copy(st.pos).setY(1.15); fx.throwG.position.copy(st.pos).setY(1.15); fx.throwG.visible = true;
    p.world.effects.spawnRing(st.pos, 0xe8fbff, st.r * 0.9, 0.18);
    fx.crack(st.pos, p.facingDir || new THREE.Vector3(0, 0, 1), 1.2);
    p.world.shake(0.22);
  }
  p.world.effects.spawnRing(st.pos, 0x9ae8ff, st.r * 1.1, 0.25); // v4: recorded, friends see the impact ring
  p.world.effects.localSparks?.(st.pos.clone().setY(0.4), 0xbfe8ff, 8, 6);
  p.world.sfx(st.big ? 'vFinisher' : 'vStrike');
  if (st.big) p.world.shake(0.6);
  let any = false;
  for (const e of near(p, st.pos, st.r)) {
    const dx = e.position.x - st.pos.x, dz = e.position.z - st.pos.z, d = Math.hypot(dx, dz) || 1, kn = st.big ? 12 : 5;
    if (hit(p, e, st.dmg, dx / d * kn, dz / d * kn, !!st.big, st.kind, st.surge)) any = true;
    if (st.stun && !e.isBoss) p.stun(e, st.stun);
    shock(p, e);
  }
  if (any && st.meter) addMeter(p, p.char.meter.skyStrike);
  // chain: Skyfall from cards (Shocked conducts, cap 6); Surge strikes only to Shocked enemies (max 2, 50%)
  const first = near(p, st.pos, st.r)[0];
  if (first && st.jumps > 0) chainFrom(p, first, st.dmg * (st.surge ? 0.5 : p.char.skyfall.chainPct), st.jumps, { shockedOnly: !!st.surge, surge: st.surge || (st.evo ? st.evo.cap : false), done: new Set(near(p, st.pos, st.r)), budget: st.evo, split: st.evo?.split });
  // v4 EVOLUTION (Skysunder Volley): each mark is the first of 3 strikes that walk forward along the lunge direction
  if (st.walk && !st.follow) {
    const ev = p.char.skyfall.evo;
    for (let j = 1; j < ev.strikes; j++) {
      const pos = st.pos.clone().addScaledVector(st.walk, ev.step * j);
      p.vk.strikes.push({ pos, t: ev.gap * j, target: null, r: st.r, dmg: st.dmg * ev.followPct, jumps: st.jumps, kind: 'skyfall', meter: false, follow: true, evo: st.evo, surge: st.evo.cap, tele: vfx(p).tele(pos, st.r, ev.gap * j) });
    }
  }
}

// ---------------- Tempest Surge ----------------
export function surgeStart(p, echo) {
  const v = p.vk;
  if (echo) { // Echo Core on Volkar: only the finisher recasts (at 50%: strike() halves 'spin' during the echo window)
    queueFinisher(p, 0.6); return;
  }
  v.meter = 0; v.bossDealt = new Map();
  v.surge = { phase: 'wind', t: 0, tick: 0, end: p.char.surge.time + 0.5 * (S(p).tSurge || 0) + (S(p).m?.tLongStorm ? 1 : 0), rumble: 0 };
  p.world.sfx('vWindup');
  p.world.effects.spawnRing(p.position, 0x4ad8ff, 2.4, 0.6);
  vfx(p).dark(0.35, 1.5); // v7: gentle storm build
}
function queueFinisher(p, delay) {
  const c = p.char.surge;
  let best = null, bs = -1;
  for (const e of enemies(p)) { if (!e.canBeHit || e.position.distanceTo(p.position) > 16) continue; const sc = (e.isBoss ? 1e9 : e.elite ? 1e6 : 0) + e.hp; if (sc > bs) { bs = sc; best = e; } }
  const pos = best ? best.position.clone() : p.position.clone().addScaledVector(p.facingDir, 3);
  p.vk.strikes.push({ pos, t: delay, target: best, r: c.finisherR, dmg: REF * c.finisherDmg * (1 + 0.05 * (S(p).tSurge || 0)) * (S(p).spinDmg || 1), jumps: 0, kind: 'spin', surge: true, big: true, stun: 0.6, tele: vfx(p).tele(pos, c.finisherR, delay) });
}
// true while Volkar is rooted in the wind-up (player.ultUpdate keeps state 'spin' for that second only)
export function surgeWindup(p, dt) {
  const v = p.vk; if (!v.surge) return false;
  return v.surge.phase === 'wind';
}
function surgeTick(p, dt) {
  const v = p.vk, sg = v.surge, c = p.char.surge;
  sg.t += dt;
  if (sg.phase === 'wind') {
    vfx(p).dark(0.35 + 0.65 * Math.min(1, sg.t / c.windup), 1.5 + 1 * Math.min(1, sg.t / c.windup));
    if (sg.t >= c.windup) { sg.phase = 'storm'; sg.t = 0; p.world.sfx('thunder'); vfx(p).dark(1, 2.5, 0.45); if (p.state === 'spin') p.endUlt(); }
    return;
  }
  if (sg.phase === 'storm') {
    // brief, non-blinding sheet flashes
    if ((sg.rumble = (sg.rumble || 0) - dt) <= 0) { sg.rumble = 1.6 + Math.random() * 0.9; p.world.sfx('thunder'); vfx(p).dark(1, 2.5, 0.35 + Math.random() * 0.2); }
    else vfx(p).dark(1, 2.5);
    sg.tick -= dt;
    if (sg.tick <= 0) {
      sg.tick = c.interval;
      const ts = pickTargets(p, c.targets, 14);
      for (const e of ts) v.strikes.push({ pos: e.position.clone(), t: 0.5, target: e, r: c.radius, dmg: REF * c.dmg * (1 + 0.05 * (S(p).tSurge || 0)) * (S(p).spinDmg || 1), jumps: 2, kind: 'spin', surge: true, tele: vfx(p).tele(e.position, c.radius, 0.5) });
    }
    if (sg.t >= sg.end) { sg.phase = 'fin'; sg.t = 0; queueFinisher(p, 0.8); }
    return;
  }
  if (sg.phase === 'fin') {
    vfx(p).dark(Math.max(0, 1 - sg.t / 0.85), 2.5 * Math.max(0, 1 - sg.t / 0.85));
    if (sg.t >= 0.85) { v.surge = null; v.lockT = p.char.meter.lockAfter; v.empowerT = c.empowerT; p.world.effects.spawnRing(p.position, 0xe8fbff, 2, 0.4); stormClear(p); }
  }
}

// ---------------- per-frame ----------------
export function vTick(p, dt) {
  const v = p.vk; if (!v) return;
  if (p.dead) { if (v.surge) { v.surge = null; stormClear(p); } return; }
  v.combatT += dt; v.lockT -= dt; v.empowerT -= dt;
  if (v.combatT < 3) addMeter(p, p.char.meter.passive * dt);
  else if (v.charge > 0 && (v.decayT += dt) >= 1.5) { v.decayT = 0; v.charge--; }
  if (v.combatT < 3) v.decayT = 0;
  if (v.surge) surgeTick(p, dt);
  else if (p.world?._vStormSnap) stormClear(p); // safety: restore if Surge was cleared elsewhere
  if (v.cloud) cloudTick(p, dt);
  if (v.burstT > 0) v.burstT -= dt;
  // v5 Grounded passive: stand still ~1s (normal state) to charge the next slam (+18%, no DR)
  const still = p.state === 'normal' && p.velocity.lengthSq() < 0.04;
  if (still) {
    v.stillT += dt;
    if (!v.grounded && v.stillT >= 1) { v.grounded = true; p.world.sfx('vMark'); p.world.effects.localRing(p.position, 0x6ae4ff, 1.2, 0.3); }
    if (v.grounded && (v.crackleT = (v.crackleT || 0) - dt) <= 0) {
      v.crackleT = 0.28; p.world.sfx('vCrackle');
      const f = vfx(p), at = p.position; f.arc(at.clone().setY(0.2), at.clone().add(new THREE.Vector3(0.7, 0, 0.2)).setY(0.05));
      p.world.effects.localSparks(at.clone().setY(0.3), 0xbfe8ff, 2, 2);
    }
  } else { v.stillT = 0; if (p.state !== 'attack') v.grounded = false; }
  // strike scheduler: telegraphs follow their target until 0.2 s before impact, then lock
  for (let i = v.strikes.length - 1; i >= 0; i--) {
    const st = v.strikes[i]; st.t -= dt;
    if (st.target && st.t > 0.2 && st.target.canBeHit) { st.pos.copy(st.target.position).setY(0); st.tele?.ring.position.set(st.pos.x, 0.05, st.pos.z); st.tele?.fill.position.set(st.pos.x, 0.04, st.pos.z); }
    if (st.ptr) vfx(p).aimPtr(st.ptr, p.position, st.pos);
    if (st.t <= 0) { v.strikes.splice(i, 1); if (st.ptr) { st.ptr.life = 0; st.ptr.m.visible = false; } landStrike(p, st); }
  }
  // Shocked read: a few pooled cyan sparks on up to 4 Shocked enemies (no per-enemy meshes)
  if ((v.sparkT = (v.sparkT || 0) - dt) <= 0) { v.sparkT = 0.22; let k = 0; for (const e of enemies(p)) { if (k >= 4) break; if (e.canBeHit && isShocked(e)) { k++; p.world.effects.localSparks(e.position.clone().setY(1.2), 0x6ae4ff, 2, 3); } } }
  // the ultimate is meter-gated: no timer, just "full or not"
  p.spinCooldown = meterFull(p) ? 0 : p.spinCooldownMax;
  // the maul reacts: coils spin faster / arcs crackle with Charge and during the Surge
  p.model.setCharge?.(v.surge ? 1 : Math.min(1, (v.charge / chargeMax(p)) * 0.7 + (v.grounded || v.groundedSwing ? 0.45 : 0)));
}
// v4 MYTHIC cloud: max 1, strikes ONE Shocked enemy within range every 0.6 s (2.0 x base, area 1.2 m), own 3% boss cap
function cloudTick(p, dt) {
  const c = p.vk.cloud, my = p.char.mythic;
  if ((c.t -= dt) <= 0) { p.vk.cloud = null; return; }
  if ((c.tick -= dt) > 0) return;
  c.tick = my.interval;
  let best = null, bd = my.range * my.range;
  for (const e of enemies(p)) { if (!e.canBeHit || !isShocked(e)) continue; const dx = e.position.x - c.pos.x, dz = e.position.z - c.pos.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = e; } }
  if (!best) return;
  const at = best.position.clone().setY(0);
  vfx(p).bolt(at, 6.5); p.world.effects.spawnRing(at, 0x9ae8ff, my.radius, 0.2); p.world.sfx('vStrike');
  for (const e of near(p, at, my.radius)) { hit(p, e, REF * my.dmg, 0, 0, false, 'shock', c.cap); shock(p, e); }
}
export function vInCombat(p) { if (p.vk) p.vk.combatT = 0; }
// HUD helpers
export const hudCharge = (p) => (p.vk ? [p.vk.charge, chargeMax(p)] : [0, 10]);
export const hudMeter = (p) => (p.vk ? (p.vk.surge ? -1 : p.vk.meter / p.char.meter.max) : 0);

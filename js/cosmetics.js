// cosmetics.js
// Puts the equipped level-up cosmetics (progress.js) on the local hero's blocky model and animates
// them: hats + masks on the head, capes + banners on the back, an aura at the feet and a talon trail.
// Also ARENA SKINS (a themed colour wash + core glow per arena), applied through Player.reskin().
import * as THREE from 'three';
import { COSMETICS } from './progress.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const glowMat = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: o < 1, opacity: o, depthWrite: o >= 1 });
function box(parent, mat, w, h, d, x, y, z, rx = 0, rz = 0) {
  const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; m.castShadow = true; parent.add(m); return m;
}

// one builder per slot; the hero picks the shape so each item is its own thing
const BUILD = {
  hat(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    switch (item.hero) {
      case 'sarrow': { // wide drifter's brim
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 16), m); brim.position.y = 0.25; g.add(brim);
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.24, 12), m); crown.position.y = 0.38; g.add(crown);
        box(g, gl, 0.53, 0.04, 0.53, 0, 0.29, 0).scale.set(0.5, 0.04, 0.5); break;
      }
      case 'zaleks': // rivet crown
        box(g, m, 0.5, 0.1, 0.5, 0, 0.3, 0);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(g, i % 2 ? gl : m, 0.09, 0.2, 0.09, Math.sin(a) * 0.22, 0.42, Math.cos(a) * 0.22); }
        break;
      case 'iskra': // needle tiara
        for (let i = -2; i <= 2; i++) box(g, gl, 0.03, 0.18 + (2 - Math.abs(i)) * 0.1, 0.03, i * 0.08, 0.36 + (2 - Math.abs(i)) * 0.05, 0.12, 0, -i * 0.15);
        box(g, m, 0.42, 0.04, 0.06, 0, 0.27, 0.12);
        break;
      default: // orin: choir horns
        for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 8), m); c.position.set(s * 0.2, 0.42, -0.02); c.rotation.z = -s * 0.5; g.add(c); box(g, gl, 0.05, 0.05, 0.05, s * 0.3, 0.6, -0.02); }
    }
    return 'head';
  },
  mask(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    switch (item.hero) {
      case 'sarrow': box(g, m, 0.36, 0.16, 0.04, 0, -0.1, 0.27); box(g, m, 0.3, 0.1, 0.04, 0, -0.2, 0.25); break; // ash veil
      case 'zaleks': box(g, m, 0.4, 0.3, 0.05, 0, -0.02, 0.24); for (const y of [-0.1, 0, 0.1]) box(g, gl, 0.34, 0.03, 0.02, 0, y, 0.27); break; // grille
      case 'iskra': box(g, gl, 0.42, 0.07, 0.04, 0, 0.04, 0.26); box(g, m, 0.46, 0.03, 0.05, 0, 0.09, 0.25); break; // lace visor
      default: box(g, m, 0.26, 0.2, 0.14, 0, -0.12, 0.3); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), gl); c.rotation.x = Math.PI / 2; c.position.set(0, -0.12, 0.4); g.add(c); // hymn muzzle
    }
    return 'head';
  },
  cape(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    g.position.set(0, 1.72, -0.24);
    const len = item.hero === 'zaleks' ? 1.1 : 1.25;
    box(g, m, item.hero === 'zaleks' ? 0.85 : 0.6, len, 0.04, 0, -len / 2, 0);
    box(g, gl, item.hero === 'iskra' ? 0.08 : 0.6, 0.05, 0.05, 0, -len + 0.05, 0.005);
    if (item.hero === 'orin') for (const x of [-0.2, 0, 0.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), gl); p.position.set(x, -0.3, -0.04); g.add(p); }
    if (item.hero === 'zaleks') box(g, lam(0x5a4a3a), 0.9, 0.12, 0.1, 0, -0.04, 0.02); // fur collar
    return 'cape';
  },
  aura(item, g) {
    const gl = glowMat(item.glow, 0.55);
    gl.blending = THREE.AdditiveBlending;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.88, 32), gl); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
    const n = item.hero === 'orin' ? 3 : item.hero === 'iskra' ? 6 : 4;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const b = box(g, glowMat(item.color, 0.85), 0.1, 0.1, 0.1, Math.cos(a) * 0.95, item.hero === 'iskra' ? 1.2 : 0.3, Math.sin(a) * 0.95); b.castShadow = false; }
    return 'aura';
  },
  banner(item, g) {
    const m = lam(item.color), gl = glowMat(item.glow);
    g.position.set(0.2, 1.4, -0.3);
    box(g, lam(0x3a3530), 0.04, 1.4, 0.04, 0, 0.5, 0);
    const flag = box(g, m, 0.04, 0.3, 0.42, 0, 1.05, -0.22);
    box(g, gl, 0.05, 0.06, 0.42, 0, 0.88, -0.22);
    g.userData.flag = flag;
    return 'body';
  },
};

export class Wardrobe {
  constructor(scene, progress) {
    this.scene = scene; this.progress = progress;
    this.parts = []; this.cape = null; this.aura = null; this.banner = null; this.trailColor = null;
    this.trail = [];
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(BOX, glowMat(0xffffff, 0.6)); m.visible = false; m.scale.setScalar(0.14); scene.add(m); this.trail.push({ m, life: 0 }); }
    this.tick = 0; this.last = null;
  }
  // (Re)dress the hero with what's equipped for their character
  dress(player) {
    this.player = player;
    for (const p of this.parts) p.parent?.remove(p);
    this.parts = []; this.cape = this.aura = this.banner = null; this.trailColor = null;
    const eq = this.progress.equipped(player.char.id);
    for (const slot of Object.keys(eq)) {
      const item = COSMETICS.find((c) => c.id === eq[slot]);
      if (!item || !this.progress.owns(item)) continue;
      if (slot === 'trail') { this.trailColor = item.glow; continue; }
      const g = new THREE.Group();
      const where = BUILD[slot](item, g);
      const model = player.model;
      if (where === 'head') model.head.add(g);
      else if (where === 'aura') { model.root.add(g); this.aura = g; }
      else { model.body.add(g); if (where === 'cape') this.cape = g; if (slot === 'banner') this.banner = g; }
      this.parts.push(g);
    }
  }
  update(dt) {
    const p = this.player; if (!p) return;
    const t = performance.now() / 1000;
    const moving = this.last ? this.last.distanceToSquared(p.position) > 1e-5 : false;
    if (this.cape) this.cape.rotation.x = 0.12 + (moving ? 0.35 + Math.sin(t * 9) * 0.08 : Math.sin(t * 2) * 0.04);
    if (this.aura) this.aura.rotation.y += dt * 1.2;
    if (this.banner?.userData.flag) this.banner.userData.flag.rotation.y = Math.sin(t * 5) * 0.25;
    // talon trail: little glowing chips left behind while you move or fight
    if (this.trailColor !== null && !p.dead) {
      this.tick -= dt;
      if (this.tick <= 0 && (moving || p.state !== 'normal')) {
        this.tick = 0.05;
        const s = this.trail.find((x) => x.life <= 0) || this.trail[0];
        s.life = 0.45; s.m.visible = true; s.m.material.color.setHex(this.trailColor);
        s.m.position.set(p.position.x + (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, p.position.z + (Math.random() - 0.5) * 0.4);
      }
    }
    for (const s of this.trail) if (s.life > 0) { s.life -= dt; s.m.material.opacity = Math.max(0, s.life / 0.45) * 0.7; s.m.scale.setScalar(0.06 + 0.2 * s.life); if (s.life <= 0) s.m.visible = false; }
    this.last = (this.last || new THREE.Vector3()).copy(p.position);
  }
  clearTrail() { for (const s of this.trail) { s.life = 0; s.m.visible = false; } }
}

// a little turntable preview for the Cosmetics screen
export function previewColor(item) { return '#' + item.color.toString(16).padStart(6, '0'); }

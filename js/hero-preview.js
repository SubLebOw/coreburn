// hero-preview.js (Phase 3B): ONE shared 3D preview of the actual hero for the Shop and Looks screens.
// A single small WebGL canvas that moves between the two panels (no second context), the exact hero
// model + Wardrobe the game uses, drag / touch rotation, and TRY-ON: preview an item without equipping it.
// Nothing here writes to a save; dropping a try-on simply redresses with what's really equipped.
import * as THREE from 'three';
import { CHARACTERS } from './characters.js?v=1.34.0';
import { Wardrobe } from './cosmetics.js?v=1.34.0';
import { disposeModel } from './hero-models.js?v=1.34.0';
import { COSMETICS } from './progress.js?v=1.34.0';

export class HeroPreview {
  constructor(progress, meta) {
    this.p = progress; this.meta = meta;
    this.hero = 'sarrow'; this.tryOn = null; this.skin = null; this.model = null; this.owner = null;
    this.yaw = 0.6; this.drag = null; this.t = 0;
  }
  ensure() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(220, 260);
    const el = this.renderer.domElement; el.className = 'hp-canvas'; el.style.touchAction = 'none';
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x4a2c18, 2.3));
    const key = new THREE.DirectionalLight(0xffe2c4, 2.2); key.position.set(2.5, 4, 5); this.scene.add(key);
    this.rim = new THREE.PointLight(0x3ff6e0, 30, 10, 2); this.rim.position.set(-1.6, 2.6, -2.2); this.scene.add(this.rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.1, 32), new THREE.MeshLambertMaterial({ color: 0x161b20 })); disc.position.y = -0.05; this.scene.add(disc);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.1, 40), new THREE.MeshBasicMaterial({ color: 0xffc23a, side: THREE.DoubleSide })); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.006; this.scene.add(this.ring);
    this.cam = new THREE.PerspectiveCamera(30, 220 / 260, 0.1, 50);
    this.cam.position.set(0, 2.0, 6.4); this.cam.lookAt(0, 1.18, 0);
    this.wardrobe = new Wardrobe(this.scene, this.p);
    for (const s of this.wardrobe.trail) this.scene.remove(s.m);
    // drag / touch to turn the hero (pointer events cover mouse + touch)
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.drag = { x: e.clientX, yaw: this.yaw }; el.setPointerCapture?.(e.pointerId); });
    el.addEventListener('pointermove', (e) => { if (this.drag) this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012; });
    const up = () => { this.drag = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  // mount the canvas into a panel's container and start drawing; owner = who's showing it now
  mount(wrap, owner) {
    this.ensure(); this.owner = owner;
    wrap.appendChild(this.renderer.domElement);
    if (!this.running) { this.running = true; const loop = () => { if (!this.owner) { this.running = false; return; } requestAnimationFrame(loop); this.frame(1 / 60); }; loop(); }
  }
  unmount(owner) { if (this.owner !== owner) return; this.owner = null; this.tryOn = null; this.renderer?.domElement.remove(); if (this.model) { disposeModel(this.model); this.model = null; } }
  frame(dt) {
    if (!this.model) return;
    this.t += dt;
    this.model.root.rotation.y = this.yaw + (this.drag ? 0 : Math.sin(this.t * 0.6) * 0.15);
    this.model.idle?.(this.t);
    this.wardrobe.update(dt);
    this.renderer.render(this.scene, this.cam);
  }
  // what the hero would wear: really equipped (+ owned) items, with the try-on item swapped into its slot
  look() {
    const eq = {};
    for (const [slot, id] of Object.entries(this.p.equipped(this.hero))) { const it = COSMETICS.find((c) => c.id === id); if (it && this.p.owns(it)) eq[slot] = id; }
    if (this.tryOn) { if (this.tryOn.remove) delete eq[this.tryOn.slot]; else eq[this.tryOn.slot] = this.tryOn.id; }
    return eq;
  }
  set(hero, { tryOn = null, skin } = {}) {
    this.ensure();
    this.hero = hero; this.tryOn = tryOn;
    if (skin !== undefined) this.skin = skin;
    if (this.model) disposeModel(this.model);
    const c = CHARACTERS[hero];
    const s = this.skin || this.p.variantOf(hero);
    const tint = s ? s.tint : (this.meta?.skinColor ?? null);
    this.model = c.build(tint);
    if (s && this.model.core) this.model.core.material.color.setHex(s.glow);
    this.model.root.traverse((o) => { o.castShadow = false; });
    this.scene.add(this.model.root);
    this.wardrobe.dress({ model: this.model, char: c, position: this.model.root.position, state: 'normal' }, this.look());
    this.rim.color.setHex(c.color); this.ring.material.color.setHex(tryOn ? 0x3ff6e0 : 0xffc23a);
  }
}

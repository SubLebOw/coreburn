// HERO SHOWCASE (hero select only): the picked hero, large and slowly turning on a glowing platform.
// Drawn with the game's own renderer into the rectangle of a placeholder element (#sc-stage),
// as a second pass over the arena. Its tiny scene has no shadow-casting lights.
// Nothing here runs or stays in memory-heavy form outside hero select: hide() drops the model.
import * as THREE from 'three';
import { disposeModel } from './hero-models.js?v=1.33.0';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,.9)'); grd.addColorStop(.45, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class Showcase {
  constructor(renderer) {
    this.r = renderer;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
    this.cam.position.set(0, 2.3, 8.2); this.cam.lookAt(0, 1.15, 0);
    this.scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x4a2c18, 2.4));
    const key = new THREE.DirectionalLight(0xffe2c4, 2.2); key.position.set(2.5, 4, 5); this.scene.add(key);
    this.rim = new THREE.PointLight(0x3ff6e0, 60, 12, 2); this.rim.position.set(-1.6, 2.6, -2.2); this.scene.add(this.rim);
    this.under = new THREE.PointLight(0x3ff6e0, 8, 5, 2); this.under.position.set(0, 0.35, 1.2); this.scene.add(this.under);
    // platform: dark disc + emissive ring + soft additive glow under it
    this.stand = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.7, 0.16, 48), new THREE.MeshStandardMaterial({ color: 0x161b20, roughness: .6, metalness: .4 }));
    disc.position.y = -0.08;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x3ff6e0, transparent: true, opacity: .9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.56, 64), this.ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005;
    this.glowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x3ff6e0, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), this.glowMat); glow.rotation.x = -Math.PI / 2; glow.position.y = -0.17;
    this.stand.add(glow, disc, ring);
    this.scene.add(this.stand);
    this.model = null; this.heroId = null; this.t = 0; this.el = null;
    this.size = new THREE.Vector2();
  }
  // build(id) -> a model ({ root }) from the game's existing hero builders
  setHero(id, color, build) {
    if (id === this.heroId && this.model) return;
    if (this.model) disposeModel(this.model);
    this.heroId = id;
    this.model = build();
    this.model.root.position.set(0, 0, 0);
    this.model.root.rotation.y = 0.6; this.drag = 0;
    this.model.root.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    this.scene.add(this.model.root);
    for (const m of [this.ringMat, this.glowMat]) m.color.setHex(color);
    this.rim.color.setHex(color); this.under.color.setHex(color);
  }
  hide() {
    if (this.model) disposeModel(this.model);
    this.model = null; this.heroId = null; this.el = null;
  }
  // called once per frame after the main render, only while hero select is open
  render(dt, el) {
    if (!el || !this.model) return;
    const rc = el.getBoundingClientRect();
    if (rc.width < 20 || rc.height < 20) return;
    const reduce = Showcase.reduced;
    this.t += dt;
    // a 3/4 view that sways gently (plus any drag), never a side-on profile
    this.model.root.rotation.y = 0.6 + (this.drag || 0) + (reduce ? 0 : Math.sin(this.t * 0.6) * 0.3);
    this.model.idle?.(this.t);
    this.ringMat.opacity = reduce ? .85 : .7 + .25 * Math.sin(this.t * 2);
    this.cam.aspect = rc.width / rc.height;
    // narrow stage (phones): pull back a bit so the whole hero fits
    this.cam.position.z = this.cam.aspect < 0.75 ? 9.6 : 8.2;
    this.cam.updateProjectionMatrix();
    const r = this.r; r.getSize(this.size);
    const y = this.size.y - rc.bottom;
    r.autoClear = false; r.clearDepth();
    r.setScissorTest(true); r.setScissor(rc.left, y, rc.width, rc.height); r.setViewport(rc.left, y, rc.width, rc.height);
    r.render(this.scene, this.cam);
    r.setScissorTest(false); r.setViewport(0, 0, this.size.x, this.size.y); r.autoClear = true;
  }
}
Showcase.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

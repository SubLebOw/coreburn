// shrine.js: COREBURNZ RISK SHRINES. Sometimes a blood-red altar rises at the start of a wave.
// It's optional: stand on it for 1.5s to activate it. Then the NEXT 3 waves are cursed
// (+35% enemy health, +20% damage, +8% speed, +25% more enemies, +15% elite chance), and
// surviving all three guarantees a gold boss relic pick. Ignore it and it sinks when the wave ends.
// Spawn: from wave 6, 18% chance per normal wave (never on boss / mutator waves, never while a curse
// is running, and at least 6 waves between shrines). Host-authoritative; friends get it in snapshots.
import * as THREE from 'three';

export const SHRINE = { from: 6, chance: 0.18, gap: 6, hold: 1.5, radius: 1.8, waves: 3,
  hp: 1.35, dmg: 1.2, speed: 1.08, count: 1.25, elite: 0.15 };

function label(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 7; g.strokeStyle = '#000c'; g.strokeText(text, 256, 34);
  g.fillStyle = color; g.fillText(text, 256, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(5, 0.62, 1); s.renderOrder = 999; return s;
}

export class Shrine {
  constructor(scene, world) {
    this.world = world; this.visible = false; this.prog = 0; this.curse = null; this.lastWave = -99; this.t = 0;
    const g = this.group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x2a1f22, roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 0.5, 8), stone); base.position.y = 0.25;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.3, 6), stone); pillar.position.y = 1.1;
    this.crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    this.crystal.position.y = 2.35;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(SHRINE.radius - 0.12, SHRINE.radius, 48), ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.05;
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(SHRINE.radius, 48), new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0.35, depthWrite: false }));
    this.fill.rotation.x = -Math.PI / 2; this.fill.position.y = 0.04;
    this.light = new THREE.PointLight(0xff2a3a, 2, 7); this.light.position.y = 2.4;
    this.tag = label('RISK SHRINE · stand here', '#ff5a66'); this.tag.position.y = 3.4;
    g.add(base, pillar, this.crystal, this.ring, this.fill, this.light, this.tag);
    g.visible = false; scene.add(g);
  }

  reset() { this.hide(); this.curse = null; this.lastWave = -99; this.showCurse(0); }
  hide() { this.visible = false; this.group.visible = false; this.prog = 0; }

  // host: maybe raise a shrine at the start of wave n
  onWaveStart(n, normalWave) {
    this.hide();
    if (!normalWave || this.curse || n < SHRINE.from || n - this.lastWave < SHRINE.gap) return false;
    if ((this.world.forceShrine ? 0 : Math.random()) >= SHRINE.chance) return false;
    this.world.forceShrine = false;
    const p = this.world.player.position, a = Math.random() * Math.PI * 2;
    const want = new THREE.Vector3(p.x + Math.cos(a) * 7, 0, p.z + Math.sin(a) * 7);
    const spot = this.world.arena.findClearSpot ? this.world.arena.findClearSpot(want, 2.2) : want;
    this.group.position.set(spot.x, 0, spot.z);
    this.visible = true; this.group.visible = true; this.lastWave = n; this.wave = n;
    return true;
  }

  // host: standing on it fills the circle; returns true the moment it activates
  update(dt, heroes) {
    this.animate(dt);
    if (!this.visible) return false;
    const on = heroes.some((h) => h && !h.dead && Math.hypot(h.position.x - this.group.position.x, h.position.z - this.group.position.z) < SHRINE.radius);
    this.prog = Math.max(0, Math.min(1, this.prog + (on ? dt / SHRINE.hold : -dt / SHRINE.hold)));
    if (this.prog >= 1) { this.curse = { left: SHRINE.waves, from: this.wave + 1 }; this.hide(); this.showCurse(SHRINE.waves); return true; }
    return false;
  }

  animate(dt) {
    this.t += dt;
    if (!this.group.visible) return;
    this.crystal.rotation.y += dt * 1.6; this.crystal.position.y = 2.35 + Math.sin(this.t * 2.4) * 0.12;
    this.fill.scale.setScalar(Math.max(0.001, this.prog));
    this.ring.material.opacity = 0.55 + 0.3 * Math.sin(this.t * 5);
  }

  // host: true when this clear finishes the 3rd cursed wave (= relic earned)
  onWaveCleared(n) {
    if (this.visible && n === this.wave) this.hide(); // ignored: it sinks back
    if (!this.curse || n < this.curse.from) return false;
    this.curse.left--;
    if (this.curse.left > 0) { this.showCurse(this.curse.left); return false; }
    this.curse = null; this.showCurse(0); return true;
  }

  // the wave stats while cursed (waves.js)
  applyCurse(stats, n) {
    if (!this.curse || n < this.curse.from) return 1;
    stats.hpMult *= SHRINE.hp; stats.dmgMult *= SHRINE.dmg; stats.speedMult *= SHRINE.speed;
    stats.eliteChance = Math.min(0.85, stats.eliteChance + SHRINE.elite);
    return SHRINE.count;
  }

  // visible curse: red tag under the score + a red vignette
  showCurse(left) {
    const el = document.getElementById('shrine-tag');
    if (el) { el.classList.toggle('hidden', !left); el.textContent = `SHRINE CURSE · ${left} wave${left === 1 ? '' : 's'} left`; }
    document.body.classList.toggle('shrine-curse', !!left);
    this.shownLeft = left;
  }

  snapshot() { return [this.visible ? 1 : 0, Math.round(this.group.position.x * 10) / 10, Math.round(this.group.position.z * 10) / 10, Math.round(this.prog * 100) / 100, this.curse ? this.curse.left : 0]; }
  applySnapshot(s) {
    if (!s) return;
    this.visible = !!s[0]; this.group.visible = this.visible;
    this.group.position.set(s[1], 0, s[2]); this.prog = s[3];
    if (this.shownLeft !== s[4]) this.showCurse(s[4]);
  }
}

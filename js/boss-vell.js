// boss-vell.js
// CANTOR VELL, "The Afterblade": a tall, fast duelist who blinks around the arena.
//   blinkstrike - vanishes (leaving a fading afterimage), reappears beside you, shows a
//                 red strip, then lunges along it. Step sideways or blink through!
//   mirror      - splits into 3+ violet afterimages around you; each shows a strip,
//                 then they dash through you one after another
//   fan         - two sweeping fans of magenta blade-waves
//   summon      - calls in hounds
import * as THREE from 'three';
import { Boss } from './boss.js';

const BLADE_MAT = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
const EYE_MAT = new THREE.MeshBasicMaterial({ color: 0x9ffcff });

export const VELL_DEF = {
  id: 'vell', name: 'CANTOR VELL', killerName: 'Cantor Vell', subtitle: 'The Afterblade',
  hp: 560, speed: 4.4, scale: 1.75,
  chargeSpeed: 26, chargeTime: 0.5, chargeDamage: 18,
  pattern: ['blinkstrike', 'fan', 'blinkstrike', 'mirror', 'blinkstrike', 'summon'],
  summon: ['hound', 'hound', 'acolyte'],
  boltColor: 0xff4fd8,
  colors: { main: 0xe6dff0, dark: 0x2c1b40, mask: 0x8a3cc8 },
};

export class CantorVell extends Boss {
  constructor(...args) {
    super(...args);
    this.ghosts = [];  // afterimages that dash at you (mirror attack)
    this.fades = [];   // afterimages that just fade away (left behind by a blink)
  }

  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    // long thin legs
    for (const x of [0.17, -0.17]) part(this.body, dark, 0.16, 1.1, 0.18, x, 0.55, 0);
    // slim ivory torso with a violet sash
    part(this.body, main, 0.5, 0.8, 0.32, 0, 1.5, 0);
    const sash = part(this.body, mask, 0.08, 0.9, 0.34, 0, 1.5, 0, false); sash.rotation.z = -0.6;
    // tall cape behind
    const cape = part(this.body, dark, 0.7, 1.7, 0.06, 0, 1.15, -0.22); cape.rotation.x = 0.12;
    // crested helm: narrow head + tall crescent crest
    part(this.body, main, 0.3, 0.36, 0.3, 0, 2.1, 0);
    part(this.body, EYE_MAT, 0.22, 0.05, 0.02, 0, 2.12, 0.16, false);
    const crest = part(this.body, mask, 0.06, 0.6, 0.38, 0, 2.5, -0.05); crest.rotation.x = -0.35;
    // sword arm (right) holding a long magenta blade; off arm (left) tucked back
    this.armR = group(this.body, -0.33, 1.82, 0);
    part(this.armR, dark, 0.13, 0.7, 0.13, 0, -0.35, 0);
    this.blade = part(this.armR, BLADE_MAT, 0.06, 0.08, 1.7, 0, -0.72, 0.8, false);
    this.armL = group(this.body, 0.33, 1.82, 0);
    part(this.armL, dark, 0.13, 0.65, 0.13, 0, -0.32, 0);
  }

  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    switch (name) {
      case 'blinkstrike': {
        this.leaveAfterimage(0.5);
        // reappear 5.5 m from the player, somewhere clear
        const p = player.position;
        let spot = null;
        const start = Math.random() * Math.PI * 2;
        for (let i = 0; i < 8 && !spot; i++) {
          const a = start + i * Math.PI / 4;
          const c = new THREE.Vector3(p.x + Math.cos(a) * 5.5, 0, p.z + Math.sin(a) * 5.5);
          if (this.world.arena.isClear(c, this.radius)) spot = c;
        }
        if (spot) this.position.copy(spot);
        this.world.effects.spawnRing(this.position, 0xff4fd8, 2.2, 0.35);
        this.world.sfx('teleport');
        this.chargesLeft = 1;
        this.setupCharge(player, 0.65);
        return;
      }
      case 'mirror': {
        const n = Math.min(5, 3 + this.tier);
        const start = Math.random() * Math.PI * 2;
        const p = player.position;
        this.telegraphTime = 1.0 * this.pace;
        for (let i = 0; i < n; i++) {
          const a = start + (i / n) * Math.PI * 2;
          const pos = new THREE.Vector3(p.x + Math.cos(a) * 6.5, 0, p.z + Math.sin(a) * 6.5);
          this.world.arena.resolve(pos, 0.5);
          const dir = new THREE.Vector3().subVectors(p, pos).setY(0).normalize();
          const obj = this.makeGhost(0.45);
          obj.position.copy(pos);
          obj.rotation.y = Math.atan2(dir.x, dir.z);
          this.ghosts.push({ obj, pos, dir, delay: this.telegraphTime + i * 0.22, t: 0, hit: false, done: false });
          fx.spawnLine(pos, dir, 13, 1.0, this.telegraphTime + i * 0.22);
        }
        this.world.sfx('teleport');
        return;
      }
      case 'fan':
        this.shotsLeft = 2;
        this.telegraphTime = 0.6 * this.pace;
        return;
    }
    super.setupAttack(name, player, toPlayer);
  }

  doAttack(player, toPlayer, dist) {
    if (this.attack === 'mirror') {
      this.state = 'mirroring'; // the ghosts do the work (see update)
      this.stateTime = 0;
      return;
    }
    if (this.attack === 'fan') {
      const base = Math.atan2(toPlayer.z, toPlayer.x) + (this.shotsLeft % 2 ? 0.12 : -0.12);
      for (let i = -3; i <= 3; i++) {
        const a = base + i * 0.2;
        this.world.projectiles.fire(this.position.clone().setY(1.5), new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), 10, 10 * this.dmgMult, 0xff4fd8, 1.2, this);
      }
      this.world.sfx('slash', 3);
      this.shotsLeft--;
      if (this.shotsLeft > 0) { this.stateTime = 0; this.telegraphTime = 0.45 * this.pace; }
      else this.recover(0.6);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }

  update(dt, player) {
    // afterimages dashing through the arena
    for (const g of this.ghosts) {
      if (g.done) continue;
      g.t += dt;
      if (g.t < g.delay) continue;
      g.pos.addScaledVector(g.dir, 26 * dt);
      g.obj.position.copy(g.pos);
      if (!g.hit && !player.dead && g.pos.distanceTo(player.position) < 0.9 + player.radius) {
        g.hit = true;
        player.takeDamage(16 * this.dmgMult, this);
      }
      if (g.t > g.delay + 0.5) { g.done = true; this.fadeOut(g.obj, 0.3); }
    }
    if (this.ghosts.length && this.ghosts.every((g) => g.done)) {
      this.ghosts = [];
      if (this.state === 'mirroring') this.recover(0.7);
    }
    // fading afterimages
    for (const f of this.fades) {
      f.life -= dt;
      f.mat.opacity = Math.max(0, f.start * (f.life / f.max));
      if (f.life <= 0) { this.scene.remove(f.obj); f.mat.dispose(); }
    }
    this.fades = this.fades.filter((f) => f.life > 0);
    super.update(dt, player);
  }

  // A see-through violet copy of Vell's current pose
  makeGhost(opacity) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xc070ff, transparent: true, opacity, depthWrite: false });
    const obj = this.root.clone(true);
    obj.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = false; } });
    obj.userData.mat = mat;
    obj.position.y = 0;
    this.scene.add(obj);
    return obj;
  }

  leaveAfterimage(seconds) {
    const obj = this.makeGhost(0.5);
    obj.position.set(this.position.x, 0, this.position.z);
    this.fadeOut(obj, seconds);
  }

  fadeOut(obj, seconds) {
    const mat = obj.userData.mat;
    this.fades.push({ obj, mat, life: seconds, max: seconds, start: mat.opacity });
  }

  pose(dt, t) {
    let glow = 0x000000;
    const k = this.state === 'telegraph' ? Math.min(1, this.stateTime / this.telegraphTime) : 0;
    this.armL.rotation.set(0.3, 0, 0.2);
    if (this.state === 'telegraph') {
      glow = (Math.floor(k * 10) % 2 === 0) ? 0x3a0a40 : 0x1a0520;
      this.armR.rotation.set(-0.4 - 1.0 * k, 0, 0);   // blade drawn back
      this.body.rotation.x = 0.15 * k;
    } else if (this.state === 'charging') {
      this.armR.rotation.set(-1.4, 0, 0);              // blade thrust forward
      this.body.rotation.x = 0.35;
    } else if (this.state === 'mirroring') {
      this.armR.rotation.set(-0.2, 0, 0.6);
      this.body.rotation.y = Math.sin(t * 10) * 0.2;
    } else {
      this.armR.rotation.set(-0.6 + Math.sin(t * 4) * 0.15, 0, 0); // duelist's guard
      this.body.rotation.z = Math.sin(t * 6) * 0.04;
    }
    return glow;
  }

  onDeath() { this.clearGhosts(); }

  clearGhosts() {
    for (const g of this.ghosts) { this.scene.remove(g.obj); g.obj.userData.mat.dispose(); }
    for (const f of this.fades) { this.scene.remove(f.obj); f.mat.dispose(); }
    this.ghosts = [];
    this.fades = [];
  }

  dispose() { this.clearGhosts(); super.dispose(); }
}

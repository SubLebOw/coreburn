// boss-hymnworks.js
// THE HYMNWORKS, "Fortress of the Endless Hymn": a huge pipe-organ war machine that never moves.
//   beams  - thin red lines show where the laser beams will be, then 2-4 beams fire from the
//            turret drum and slowly ROTATE. Keep running round ahead of them (or dash through)!
//   sweep  - a single fast beam swings across the arena
//   mortar - shells drop out of the sky onto red circles around you
//   burst  - rings of bolts from the pipes
//   summon - calls spitters and acolytes
// It's big and slow: get in close and hit it between attacks.
import * as THREE from 'three';
import { Boss } from './boss.js';

const BEAM_LEN = 17;
const BEAM_GEO = new THREE.BoxGeometry(1, 1, 1);
const PIPE_MAT = new THREE.MeshLambertMaterial({ color: 0xd9b25a, emissive: 0x2a1c06 });
const CORE_MAT = new THREE.MeshBasicMaterial({ color: 0xff2a3a });
const BEAM_MAT = new THREE.MeshBasicMaterial({ color: 0xff1a2a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
const BEAM_CORE_MAT = new THREE.MeshBasicMaterial({ color: 0xffd8d8 });

export const HYMNWORKS_DEF = {
  id: 'hymnworks', name: 'THE HYMNWORKS', killerName: 'the Hymnworks', subtitle: 'Fortress of the Endless Hymn',
  hp: 1000, speed: 0, scale: 1.5, radius: 2.0, stationary: true, introDepth: 6,
  pattern: ['beams', 'mortar', 'burst', 'sweep', 'summon', 'beams', 'mortar'],
  summon: ['spitter', 'acolyte', 'acolyte'],
  boltColor: 0xff4a5a,
  colors: { main: 0x6a1a22, dark: 0x22201f, mask: 0x8c8070 },
};

export class Hymnworks extends Boss {
  constructor(...args) {
    super(...args);
    this.beams = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const glow = new THREE.Mesh(BEAM_GEO, BEAM_MAT);
      glow.scale.set(0.75, 0.75, BEAM_LEN); glow.position.z = BEAM_LEN / 2 + 1;
      const core = new THREE.Mesh(BEAM_GEO, BEAM_CORE_MAT);
      core.scale.set(0.14, 0.14, BEAM_LEN); core.position.z = BEAM_LEN / 2 + 1;
      g.add(glow, core);
      g.visible = false;
      this.scene.add(g);
      this.beams.push({ obj: g, angle: 0, on: false });
    }
    this.drumAngle = 0;
    this.hurtCooldown = 0;
  }

  buildModel({ main, dark, mask }) {
    // octagonal iron plinth
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.6, 8), dark);
    base.position.y = 0.3; base.castShadow = true; this.body.add(base);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.25, 8), mask);
    deck.position.y = 0.72; this.body.add(deck);
    // a half-ring of brass organ pipes, tallest in the middle
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7 + Math.PI;
      const h = 1.6 + (1 - Math.abs(i - 4) / 4) * 1.8;
      const r = 0.13 + (1 - Math.abs(i - 4) / 4) * 0.05;
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), PIPE_MAT);
      pipe.position.set(Math.sin(a) * 1.0, 0.85 + h / 2, Math.cos(a) * 1.0);
      pipe.castShadow = true;
      this.body.add(pipe);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.4, r, 0.18, 8), PIPE_MAT);
      lip.position.set(pipe.position.x, 0.85 + h, pipe.position.z);
      this.body.add(lip);
    }
    // the rotating turret drum in the middle, with four beam emitters
    this.drum = new THREE.Group();
    this.drum.position.y = 1.25;
    this.body.add(this.drum);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.75, 12), main);
    drum.castShadow = true; this.drum.add(drum);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 0.3, 12), dark);
    cap.position.y = 0.52; this.drum.add(cap);
    this.part(this.drum, CORE_MAT, 0.25, 0.25, 0.25, 0, 0.75, 0, false); // glowing red eye on top
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const em = this.part(this.drum, dark, 0.3, 0.3, 0.5, Math.sin(a) * 0.82, 0, Math.cos(a) * 0.82);
      em.rotation.y = a;
      this.part(this.drum, CORE_MAT, 0.16, 0.16, 0.05, Math.sin(a) * 1.08, 0, Math.cos(a) * 1.08, false).rotation.y = a;
    }
    // buttresses
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = this.part(this.body, dark, 0.3, 0.9, 0.7, Math.sin(a) * 1.4, 0.45, Math.cos(a) * 1.4);
      b.rotation.y = a;
    }
  }

  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    const toP = Math.atan2(toPlayer.x, toPlayer.z);
    switch (name) {
      case 'beams': {
        const n = Math.min(4, 2 + this.tier);
        this.beamSpin = (Math.random() < 0.5 ? 1 : -1) * 0.55;
        this.beamDuration = 4.2;
        const start = toP + Math.PI / n; // never start a beam right on top of the player
        this.telegraphTime = 1.1 * this.pace;
        this.planBeams(n, start, fx);
        return;
      }
      case 'sweep':
        this.beamSpin = (Math.random() < 0.5 ? 1 : -1) * 1.15;
        this.beamDuration = 2.4;
        this.telegraphTime = 0.9 * this.pace;
        this.planBeams(1, toP - Math.sign(this.beamSpin) * 0.9, fx);
        return;
      case 'mortar': {
        this.telegraphTime = 1.3 * this.pace;
        this.marks = [player.position.clone()];
        for (let i = 0; i < Math.min(7, 4 + this.tier); i++) {
          const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 4;
          const m = player.position.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
          this.world.arena.resolve(m, 1);
          this.marks.push(m);
        }
        for (const m of this.marks) fx.spawnWarning(m, 2.2, this.telegraphTime);
        this.world.sfx('shot');
        return;
      }
    }
    super.setupAttack(name, player, toPlayer);
  }

  planBeams(n, start, fx) {
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      b.on = i < n;
      if (!b.on) continue;
      b.angle = start + (i / n) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(b.angle), 0, Math.cos(b.angle));
      fx.spawnLine(this.position.clone().addScaledVector(dir, this.radius), dir, BEAM_LEN - 1, 0.5, this.telegraphTime);
    }
  }

  doAttack(player, toPlayer, dist) {
    if (this.attack === 'beams' || this.attack === 'sweep') {
      this.state = 'beaming';
      this.stateTime = 0;
      this.world.sfx('laser');
      this.world.shake(0.3);
      return;
    }
    if (this.attack === 'mortar') {
      let hit = false;
      for (const m of this.marks) {
        if (!hit && !player.dead && m.distanceTo(player.position) < 2.2 + player.radius) { player.takeDamage(18 * this.dmgMult, this); hit = true; }
        this.world.effects.spawnRing(m, 0xff6a3a, 2.4, 0.4);
        this.world.effects.spawnSparks(m.clone().setY(0.4), 0xffb060, 4, 7);
      }
      this.world.shake(0.35);
      this.world.sfx('enemyDeath');
      this.recover(0.7);
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }

  update(dt, player) {
    this.hurtCooldown -= dt;
    if (this.state === 'beaming') {
      this.stateTime += dt;
      this.flashTimer -= dt;
      const ox = this.position.x, oz = this.position.z;
      for (const b of this.beams) {
        if (!b.on) continue;
        b.angle += this.beamSpin * dt / this.pace;
        b.obj.visible = true;
        b.obj.position.set(ox, 1.25 * this.scale, oz);
        b.obj.rotation.y = b.angle;
        b.obj.children[0].scale.x = b.obj.children[0].scale.y = 0.8 + Math.sin(this.stateTime * 40) * 0.15;
        // is Sarrow standing in this beam?
        if (!player.dead && this.hurtCooldown <= 0) {
          const dx = player.position.x - ox, dz = player.position.z - oz;
          const along = dx * Math.sin(b.angle) + dz * Math.cos(b.angle);
          const side = Math.abs(dx * Math.cos(b.angle) - dz * Math.sin(b.angle));
          if (along > this.radius - 0.5 && along < BEAM_LEN + 1 && side < 0.45 + player.radius) {
            player.takeDamage(12 * this.dmgMult, this);
            this.hurtCooldown = 0.5;
          }
        }
      }
      this.drumAngle = this.beams[0].angle;
      if (this.stateTime >= this.beamDuration) { this.stopBeams(); this.recover(1.0); }
      this.animate(dt);
      return;
    }
    super.update(dt, player);
  }

  stopBeams() { for (const b of this.beams) { b.on = false; b.obj.visible = false; } }

  pose(dt, t) {
    let glow = 0x000000;
    if (this.state === 'telegraph') {
      const k = Math.min(1, this.stateTime / this.telegraphTime);
      glow = (Math.floor(k * 10) % 2 === 0) ? 0x501018 : 0x28080c;
      if (this.attack === 'beams' || this.attack === 'sweep') this.drumAngle = this.beams[0].angle;
    } else if (this.state !== 'beaming') {
      this.drumAngle += dt * 0.6;
    }
    // drum spins in world space (undo the body's facing)
    this.drum.rotation.y = this.drumAngle - this.facing;
    const p = this.world.player.position;
    if (this.state === 'chase') this.turnTowards(new THREE.Vector3(p.x - this.position.x, 0, p.z - this.position.z).normalize(), dt, 1);
    this.body.position.y = this.state === 'beaming' ? Math.sin(t * 50) * 0.02 : 0;
    return glow;
  }

  onDeath() { this.stopBeams(); }

  dispose() {
    for (const b of this.beams) this.scene.remove(b.obj);
    super.dispose();
  }
}

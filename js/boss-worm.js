// boss-worm.js
// THE GULLETWORM: a giant scrap-worm that lives under the arena floor.
//   burrow - dives underground (you can't hit it), then red circles open under you and
//            around you. It erupts from the main one: keep moving!
//            After surfacing it sits still for a moment: free hits.
//   chain  - a line of circles bursts open from the worm towards you, one after another
//   volley - spits fans of acid-green bolts
//   summon - coughs up a swarm of mites
import * as THREE from 'three';
import { Boss } from './boss.js';

const MAW_MAT = new THREE.MeshBasicMaterial({ color: 0x0c0f0c });
const GLOW_MAT = new THREE.MeshBasicMaterial({ color: 0xb8ff4a });

export const WORM_DEF = {
  id: 'worm', name: 'THE GULLETWORM', killerName: 'the Gulletworm', subtitle: 'It Hears Your Footsteps',
  hp: 780, speed: 0, scale: 1.55, stationary: true, introDepth: 7,
  pattern: ['volley', 'burrow', 'chain', 'burrow', 'summon', 'volley', 'chain', 'burrow'],
  summon: ['mite', 'mite', 'mite', 'mite', 'mite'],
  boltColor: 0x9cff3a,
  colors: { main: 0x3f7a5c, dark: 0x22302a, mask: 0xd9c98e },
};

export class Gulletworm extends Boss {
  constructor(...args) {
    super(...args);
    this.radius = 1.1;
    this.rootY = 0;
    this.chainMarks = [];
  }

  buildModel({ main, dark, mask }) {
    // a mound of scrap at the base
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const b = this.part(this.root, dark, 0.7, 0.35, 0.5, Math.cos(a) * 0.9, 0.15, Math.sin(a) * 0.9);
      b.rotation.set(0.3, a, 0.2);
    }
    // segmented body rising out of the ground (each segment sways a little, see pose)
    this.segments = [];
    let parent = this.body;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? 0 : 0.62;
      parent.add(seg);
      const r = 0.62 - i * 0.03;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.04, 0.6, 10), i % 2 ? main : dark);
      cyl.position.y = 0.3; cyl.castShadow = true; seg.add(cyl);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, 0.08, 10), mask);
      band.position.y = 0.58; seg.add(band);
      this.segments.push(seg);
      parent = seg;
    }
    // the head: a round maw ringed with teeth, facing forward
    this.head = new THREE.Group();
    this.head.position.y = 0.75;
    parent.add(this.head);
    const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.6, 0.9, 10), main);
    skull.rotation.x = Math.PI / 2 - 0.5; skull.castShadow = true; this.head.add(skull);
    const mawGroup = new THREE.Group();
    mawGroup.position.set(0, 0.24, 0.42); mawGroup.rotation.x = -0.5;
    this.head.add(mawGroup);
    mawGroup.add(new THREE.Mesh(new THREE.CircleGeometry(0.5, 12), MAW_MAT));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 4), mask);
      tooth.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.03);
      tooth.rotation.z = a + Math.PI / 2; // points in towards the throat
      mawGroup.add(tooth);
    }
    // glowing sensor pits
    for (const x of [-0.42, 0.42]) this.part(this.head, GLOW_MAT, 0.12, 0.12, 0.12, x, 0.5, 0.15, false);
  }

  canUseAttack(name) { return name !== 'burrow' || !this.hidden; }

  setupAttack(name, player, toPlayer) {
    const fx = this.world.effects;
    switch (name) {
      case 'burrow':
        this.telegraphTime = 0.55; // sinking
        this.world.sfx('burrow');
        return;
      case 'chain': {
        // a line of circles from the worm towards (and past) the player
        const dir = new THREE.Vector3().subVectors(player.position, this.position).setY(0);
        const len = Math.max(4, dir.length() + 4);
        dir.normalize();
        this.chainMarks = [];
        const count = Math.min(10, Math.ceil(len / 1.9));
        for (let i = 1; i <= count; i++) {
          const pos = this.position.clone().addScaledVector(dir, i * 1.9);
          const time = (0.9 + i * 0.16) * this.pace;
          this.chainMarks.push({ pos, time, popped: false });
          fx.spawnWarning(pos, 1.5, time);
        }
        this.telegraphTime = this.chainMarks[this.chainMarks.length - 1].time + 0.05;
        return;
      }
    }
    super.setupAttack(name, player, toPlayer);
  }

  doAttack(player, toPlayer, dist) {
    if (this.attack === 'burrow') {
      // now underground: open the eruption circles
      this.hidden = true;
      this.rootY = -7;
      this.state = 'underground';
      this.stateTime = 0;
      this.eruptTime = 1.25 * this.pace;
      const p = player.position.clone();
      this.erupts = [p];
      for (let i = 0; i < Math.min(3, 1 + this.tier); i++) {
        const a = Math.random() * Math.PI * 2;
        this.erupts.push(p.clone().add(new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4)));
      }
      for (const e of this.erupts) { this.world.arena.resolve(e, 1.2); this.world.effects.spawnWarning(e, 2.4, this.eruptTime); }
      this.world.shake(0.25);
      return;
    }
    if (this.attack === 'chain') { this.recover(0.8); return; }
    super.doAttack(player, toPlayer, dist);
  }

  update(dt, player) {
    // chain attack: circles burst one after another
    if (this.state === 'telegraph' && this.attack === 'chain') {
      for (const m of this.chainMarks) {
        if (m.popped || this.stateTime < m.time) continue;
        m.popped = true;
        if (!player.dead && m.pos.distanceTo(player.position) < 1.5 + player.radius) player.takeDamage(16 * this.dmgMult, this);
        this.world.effects.spawnRing(m.pos, 0x9cff3a, 1.8, 0.35);
        this.world.effects.spawnSparks(m.pos.clone().setY(0.3), 0xd9c98e, 5, 7);
        this.world.sfx('enemyDeath');
      }
    }
    if (this.state === 'underground') {
      this.stateTime += dt;
      this.world.shake(0.06);
      if (this.stateTime >= this.eruptTime) this.erupt(player);
      this.animate(dt);
      return;
    }
    if (this.state === 'emerging') {
      this.stateTime += dt;
      this.rootY = Math.min(0, -5 + this.stateTime * 16);
      this.pushPlayer(player); // shoved aside as it bursts out
      if (this.stateTime > 0.35) { this.rootY = 0; this.recover(1.3); } // dazed for a moment: hit it!
      this.animate(dt);
      return;
    }
    if (this.state === 'telegraph' && this.attack === 'burrow') {
      this.rootY = -7 * Math.min(1, this.stateTime / this.telegraphTime); // sinking
    }
    super.update(dt, player);
  }

  erupt(player) {
    const [main, ...others] = this.erupts;
    for (const e of this.erupts) {
      const big = e === main;
      const r = 2.4;
      if (!player.dead && e.distanceTo(player.position) < r + player.radius) player.takeDamage((big ? 28 : 18) * this.dmgMult, this);
      this.world.effects.spawnRing(e, 0x9cff3a, 3, 0.5);
      this.world.effects.spawnSparks(e.clone().setY(0.5), big ? 0xd9c98e : 0x7a6a4a, big ? 16 : 8, 9);
    }
    this.position.copy(main);
    this.hidden = false;
    this.state = 'emerging';
    this.stateTime = 0;
    this.world.shake(0.55);
    this.world.sfx('erupt');
  }

  pose(dt, t) {
    let glow = 0x000000;
    const sway = this.state === 'recover' ? 0.02 : 0.09;
    this.segments.forEach((s, i) => {
      s.rotation.x = Math.sin(t * 2.2 + i * 0.7) * sway;
      s.rotation.z = Math.cos(t * 1.7 + i * 0.9) * sway;
    });
    // the head turns to stare at Sarrow
    if (this.state === 'telegraph') {
      const k = Math.min(1, this.stateTime / this.telegraphTime);
      glow = (Math.floor(k * 10) % 2 === 0) ? 0x2a4a10 : 0x112205;
      this.head.rotation.x = -0.4 * k;
    } else if (this.state === 'recover') {
      this.head.rotation.x = 0.35; // drooping, dazed
    } else {
      this.head.rotation.x = Math.sin(t * 3) * 0.1;
    }
    const p = this.world.player.position;
    this.facing = Math.atan2(p.x - this.position.x, p.z - this.position.z);
    return glow;
  }
}

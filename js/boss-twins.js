// boss-twins.js
// BRAND & TEMPER, "The Forge Twins": two bosses at once that share one health bar.
//   BRAND  (red-hot, stocky, swings a glowing branding iron): charges and ground slams
//   TEMPER (steel-blue, tall, quench tank on its back): bolt volleys and target circles
//   link   - one twin stands still and fires a tether beam at the other. While the beam
//            holds, the other twin takes much less damage and attacks faster.
//            Hit the twin that's linking to snap the beam!
//   When one twin falls, the other one ENRAGES: faster and angrier.
import * as THREE from 'three';
import { Boss } from './boss.js';

const IRON_MAT = new THREE.MeshBasicMaterial({ color: 0xffa040 });
const QUENCH_MAT = new THREE.MeshBasicMaterial({ color: 0x5ad8ff });
const EYE_HOT = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const EYE_COLD = new THREE.MeshBasicMaterial({ color: 0xbff4ff });

const SHARED = { hp: 900, hpShare: 0.5, subtitle: 'The Forge Twins', name: 'BRAND & TEMPER' };
export const BRAND_DEF = {
  ...SHARED, id: 'brand', partName: 'BRAND', killerName: 'Brand of the Forge Twins',
  speed: 3.4, scale: 1.8, chargeSpeed: 20,
  pattern: ['charge', 'link', 'slam', 'charge', 'summon', 'slam'],
  summon: ['acolyte', 'hound'],
  colors: { main: 0xa8361a, dark: 0x2b1a14, mask: 0xffb070 },
};
export const TEMPER_DEF = {
  ...SHARED, id: 'temper', partName: 'TEMPER', killerName: 'Temper of the Forge Twins',
  speed: 2.6, scale: 1.9,
  pattern: ['volley', 'markslam', 'volley', 'link', 'burst'],
  summon: ['spitter'],
  boltColor: 0x5ad8ff,
  colors: { main: 0x4a6f8a, dark: 0x1c2630, mask: 0xc8dce8 },
};

const LINK_TIME = 4.5;

export class ForgeTwin extends Boss {
  constructor(...args) {
    super(...args);
    this.partner = null;
    this.linking = false;
    this.enraged = false;
    // tether beam + a shield aura shown on whoever is being buffed
    const beamColor = this.def.id === 'brand' ? 0xff8a3a : 0x5ad8ff;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: beamColor, transparent: true, opacity: 0.85, depthWrite: false }));
    this.beam.visible = false;
    this.scene.add(this.beam);
    this.aura = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 30),
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.8, depthWrite: false }));
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.visible = false;
    this.scene.add(this.aura);
  }

  buildModel({ main, dark, mask }) {
    const part = this.part.bind(this), group = this.group.bind(this);
    if (this.def.id === 'brand') {
      // short and wide: blacksmith apron, huge shoulders, horned furnace helm
      for (const x of [0.3, -0.3]) part(this.body, dark, 0.4, 0.7, 0.44, x, 0.35, 0);
      part(this.body, main, 1.3, 0.85, 0.85, 0, 1.12, 0);
      part(this.body, dark, 0.9, 0.7, 0.05, 0, 0.95, 0.44); // leather apron
      for (const x of [0.75, -0.75]) part(this.body, main, 0.5, 0.45, 0.6, x, 1.5, 0); // shoulder plates
      part(this.body, mask, 0.55, 0.45, 0.5, 0, 1.8, 0.05);
      part(this.body, EYE_HOT, 0.4, 0.07, 0.03, 0, 1.82, 0.31, false);
      for (const x of [0.3, -0.3]) { const h = part(this.body, dark, 0.1, 0.4, 0.1, x, 2.15, 0); h.rotation.z = x > 0 ? -0.5 : 0.5; }
      this.armL = group(this.body, 0.78, 1.4, 0);
      part(this.armL, dark, 0.32, 0.7, 0.32, 0, -0.35, 0);
      this.armR = group(this.body, -0.78, 1.4, 0);
      part(this.armR, dark, 0.32, 0.6, 0.32, 0, -0.3, 0);
      // the branding iron: long rod with a glowing glyph on the end
      part(this.armR, dark, 0.08, 0.08, 1.5, 0, -0.65, 0.6, false);
      part(this.armR, IRON_MAT, 0.45, 0.45, 0.1, 0, -0.65, 1.35, false);
      part(this.armR, IRON_MAT, 0.1, 0.6, 0.12, 0, -0.65, 1.38, false);
    } else {
      // tall and lean: armoured coat, a glowing tank of quench water on its back, long tongs
      for (const x of [0.2, -0.2]) part(this.body, dark, 0.2, 1.0, 0.24, x, 0.5, 0);
      part(this.body, main, 0.75, 1.0, 0.5, 0, 1.45, 0);
      const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.55, 0.8, 8), main);
      coat.position.y = 0.75; coat.castShadow = true; this.body.add(coat);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 10), QUENCH_MAT);
      tank.position.set(0, 1.5, -0.45); this.body.add(tank);
      for (const y of [1.1, 1.9]) part(this.body, dark, 0.62, 0.06, 0.62, 0, y, -0.45, false);
      part(this.body, mask, 0.38, 0.5, 0.38, 0, 2.2, 0);
      part(this.body, EYE_COLD, 0.06, 0.32, 0.03, 0, 2.2, 0.2, false); // slit visor
      this.armL = group(this.body, 0.5, 1.85, 0);
      this.armR = group(this.body, -0.5, 1.85, 0);
      for (const a of [this.armL, this.armR]) part(a, dark, 0.16, 0.85, 0.16, 0, -0.42, 0);
      // tongs
      for (const x of [0.06, -0.06]) part(this.armL, mask, 0.04, 0.04, 1.1, x, -0.85, 0.45, false);
    }
  }

  canUseAttack(name) {
    if (name !== 'link') return true;
    return this.partner && !this.partner.dead && !this.partner.linking && this.partner.state !== 'intro';
  }

  setupAttack(name, player, toPlayer) {
    if (name === 'link') { this.telegraphTime = 0.6 * this.pace; return; }
    super.setupAttack(name, player, toPlayer);
  }

  doAttack(player, toPlayer, dist) {
    if (this.attack === 'link') {
      if (!this.canUseAttack('link')) { this.recover(0.3); return; }
      this.linking = true;
      this.linkTime = 0;
      this.linkHpStart = this.hp;
      this.state = 'linking';
      this.stateTime = 0;
      this.partner.damageTakenMult = 0.4;
      this.partner.tempoBoost = this.partner.enraged ? 0.6 : 0.7;
      this.world.sfx('zap');
      return;
    }
    super.doAttack(player, toPlayer, dist);
  }

  update(dt, player) {
    if (this.state === 'linking') {
      this.stateTime += dt;
      this.flashTimer -= dt;
      this.linkTime += dt;
      const broken = this.linkHpStart - this.hp > this.maxHp * 0.1; // lose 10% of its health -> beam snaps
      if (this.partner.dead || broken || this.linkTime > LINK_TIME) {
        this.endLink();
        if (broken) {
          this.world.effects.spawnSparks(this.position.clone().setY(2), 0xfff0a0, 14, 9);
          this.world.sfx('shieldBlock');
          this.recover(1.4); // stunned by the feedback: punish it!
        } else this.recover(0.4);
      } else {
        // aim the beam from this twin's chest to the partner's
        const a = this.position.clone().setY(1.8 * this.scale * 0.6);
        const b = this.partner.position.clone().setY(1.8 * this.partner.scale * 0.6);
        const mid = a.clone().add(b).multiplyScalar(0.5);
        this.beam.position.copy(mid);
        this.beam.scale.set(1 + Math.sin(this.linkTime * 30) * 0.3, a.distanceTo(b), 1);
        this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        this.beam.visible = true;
        const p = this.partner;
        p.aura.visible = true;
        p.aura.position.set(p.position.x, 0.15, p.position.z);
        p.aura.scale.setScalar(p.radius * 1.4 * (1 + Math.sin(this.linkTime * 8) * 0.06));
        this.turnTowards(b.clone().sub(a).setY(0).normalize(), dt, 6);
      }
      this.world.arena.resolve(this.position, this.radius);
      this.animate(dt);
      return;
    }
    super.update(dt, player);
  }

  endLink() {
    if (!this.linking) return;
    this.linking = false;
    this.beam.visible = false;
    if (this.partner) {
      this.partner.aura.visible = false;
      this.partner.damageTakenMult = 1;
      this.partner.tempoBoost = this.partner.enraged ? 0.72 : 1;
    }
  }

  enrage() {
    if (this.dead || this.enraged) return;
    this.enraged = true;
    this.tempoBoost = 0.72;
    this.speed *= 1.3;
    this.chargeSpeed *= 1.15;
    this.world.effects.spawnRing(this.position, 0xff3a1a, 4, 0.7);
    this.world.shake(0.4);
  }

  onDeath() {
    this.endLink();
    if (this.partner) {
      if (this.partner.linking) this.partner.endLink();
      this.partner.enrage();
    }
    this.aura.visible = false;
  }

  pose(dt, t) {
    let glow = 0x000000;
    if (this.state === 'linking') {
      glow = Math.floor(t * 8) % 2 ? 0x332a00 : 0x1a1500;
      if (this.armL) { this.armL.rotation.x = -1.5; this.armR.rotation.x = -1.5; }
      this.body.rotation.x = -0.1;
    } else {
      glow = super.pose(dt, t);
    }
    if (this.enraged && glow === 0x000000) glow = Math.floor(t * 4) % 2 ? 0x3a0800 : 0x200400;
    return glow;
  }

  dispose() {
    this.scene.remove(this.beam, this.aura);
    this.beam.geometry.dispose(); this.beam.material.dispose();
    this.aura.geometry.dispose(); this.aura.material.dispose();
    super.dispose();
  }
}

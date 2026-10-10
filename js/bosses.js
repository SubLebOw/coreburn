// bosses.js
// The boss rotation. Every 5th wave the next boss in this list shows up:
//   wave 5 Furnace Deacon, 10 Cantor Vell, 15 Choirmother, 20 Gulletworm,
//   25 Rivetjaw, 30 Brand & Temper, 35 The Hymnworks, then round again (tougher) from wave 40.
// Each entry: def (name/subtitle for the banner) + spawn() that returns the Boss object(s).
import * as THREE from 'three';
import { Boss, CLASSIC_BOSSES } from './boss.js';
import { CantorVell, VELL_DEF } from './boss-vell.js';
import { Gulletworm, WORM_DEF } from './boss-worm.js';
import { ForgeTwin, BRAND_DEF, TEMPER_DEF } from './boss-twins.js';
import { Hymnworks, HYMNWORKS_DEF } from './boss-hymnworks.js';

const [DEACON, CHOIRMOTHER, RIVETJAW] = CLASSIC_BOSSES;

// spawn(ctx) gets { scene, bossNumber, tier, stats, world, spot(x, z) } where spot() finds a clear
// spot near (x, z) on the far side of the arena from the player.
const single = (Cls, def) => ({
  def,
  spawn: (c) => [new Cls(c.scene, def, c.bossNumber, c.tier, c.stats, c.spot(0, 7), c.world)],
});

export const BOSS_ROTATION = [
  single(Boss, DEACON),
  single(CantorVell, VELL_DEF),
  single(Boss, CHOIRMOTHER),
  single(Gulletworm, WORM_DEF),
  single(Boss, RIVETJAW),
  {
    def: { name: BRAND_DEF.name, subtitle: BRAND_DEF.subtitle },
    spawn: (c) => {
      const brand = new ForgeTwin(c.scene, BRAND_DEF, c.bossNumber, c.tier, c.stats, c.spot(-4, 7), c.world);
      const temper = new ForgeTwin(c.scene, TEMPER_DEF, c.bossNumber, c.tier, c.stats, c.spot(4, 7), c.world);
      brand.partner = temper;
      temper.partner = brand;
      temper.chaseTime = 2.6; // so they don't open with the same move
      return [brand, temper];
    },
  },
  single(Hymnworks, HYMNWORKS_DEF),
];

export function bossForNumber(bossNumber) {
  const idx = (bossNumber - 1) % BOSS_ROTATION.length;
  return { entry: BOSS_ROTATION[idx], tier: Math.floor((bossNumber - 1) / BOSS_ROTATION.length) };
}

// bosses.js
// The boss rotation. Every 5th wave the next boss in this list shows up:
//   wave 5 Furnace Deacon, 10 Cantor Vell, 15 Choirmother, 20 Gulletworm,
//   25 Rivetjaw, 30 Brand & Temper, 35 The Hymnworks, then round again (tougher) from wave 40.
// Each entry: def (name/subtitle for the banner) + spawn() that returns the Boss object(s).
import * as THREE from 'three';
import { Boss, CLASSIC_BOSSES } from './boss.js?v=1.33.0-p5c3';
import { CantorVell, VELL_DEF } from './boss-vell.js?v=1.33.0-p5c3';
import { Gulletworm, WORM_DEF } from './boss-worm.js?v=1.33.0-p5c3';
import { ForgeTwin, BRAND_DEF, TEMPER_DEF } from './boss-twins.js?v=1.33.0-p5c3';
import { Hymnworks, HYMNWORKS_DEF } from './boss-hymnworks.js?v=1.33.0-p5c3';
import { SisterKlaxon, KLAXON_DEF, BellowsAbbot, BELLOWS_DEF, SaintGravelmouth, GRAVEL_DEF, TitheWarden, TITHE_DEF, NailChorus, NAIL_DEF } from './boss-z.js?v=1.33.0-p5c3';
import { RULES } from './rules.js?v=1.33.0-p5c3';

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

// COREBURNZ: the 7 originals with 5 new leaders slotted in between (12 per trip round the rotation)
export const Z_BOSSES = [
  single(SisterKlaxon, KLAXON_DEF),
  single(BellowsAbbot, BELLOWS_DEF),
  single(SaintGravelmouth, GRAVEL_DEF),
  single(TitheWarden, TITHE_DEF),
  single(NailChorus, NAIL_DEF),
];
const [D, V, C, W, R, T, H] = BOSS_ROTATION;
const [K, B, G, TW, N] = Z_BOSSES;
export const Z_ROTATION = [D, V, K, C, W, B, R, G, T, TW, H, N];
export const rotation = (z = RULES.z) => (z ? Z_ROTATION : BOSS_ROTATION);

export function bossForNumber(bossNumber, z = RULES.z) {
  const rot = rotation(z);
  const idx = (bossNumber - 1) % rot.length;
  return { entry: rot[idx], tier: Math.floor((bossNumber - 1) / rot.length) };
}

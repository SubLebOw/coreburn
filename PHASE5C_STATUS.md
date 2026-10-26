# Phase 5C — enemy & boss overhaul: status

Branch `phase5c-enemies-bosses` (from main v1.33.0). Dev notes only: this file is not part of the
production build, which copies only index.html, style.css, privacy.html, js/ and vendor/.
No merge, version bump or deploy. PR #7 is not touched.

## Stage 1 (enemies)

### Done
- `js/enemy-models.js`: new kit-bashed models for all 11 standard enemies (acolyte, hound, spitter,
  bulwark, splitter, mite, thurible, lancer, mender, grub, bomber), each with an elite form
  (extra armour, weapon, core and rank crest). Geometry is baked, merged per rig group and material,
  and cached per type and form. Glow materials are shared; each enemy keeps 4 Lambert materials for its hit flash.
- Gameplay LOD: detail meshes are hidden when more than 14 enemies are alive (`setEnemyLOD('hi'|'lo'|'auto')`).
- `js/enemy.js`: new buildModel and animation set (idle breathing, per-type gait, a wind-up that lasts the real
  windup, follow-through on the real damage frame, directional hit recoil, armour sparks, death crumble with
  pooled scrap). All of it is local-only (unrecorded effects plus local `sound.play`), so co-op traffic is unchanged.
  The thurible censer is now drawn at the real elite hit radius. The affix tag texture is disposed with the enemy.
- `js/effects.js`: `localSparks`, `localRing` and a pooled `scrap` (36 meshes). The recorded wrappers are unchanged.
- `js/audio.js`: quiet, throttled cues: stomp, clank, charge, spitCharge, fuse, scrap.
- Timing fingerprint (`/workspace/pw/p5c-timing.mjs`, 22 sims) is identical to the baseline, so there are
  no stat, AI, timing or radius changes.

- Variant E: 24/24 pass. Desktop and mobile smoke runs (wave 3) show 0 JS errors.
- Perf (software render, 11 enemies, gallery scene, includes the shadow pass): draw calls 145 -> 236 and
  triangles about 1.9k -> 7.1k. The geometry cache holds about 238 entries per type set; this is a one-time cost
  that does not grow with enemy count.
  **TODO:** cut draw calls (merge detail meshes into the main groups when LOD is lo, or bake static groups).

- `js/affixes.js`: the 6 existing affixes now share ring and bubble geometry, use opaque shared materials
  (only the shield bubble is transparent), and cache the name tag per combination, which fixes the old
  per-enemy geometry and texture leak. Each affix gets one accent: volatile has a flickering chest core,
  vampiric a heartbeat core, warded a hex sigil above the head, hasted an exhaust fin and splitting an orbiting pod.

### Remaining
- Dev inspector (`js/dev-5c-inspector.js`, the ?dev=1 gate in index.html, and main.js hooks matching PR #7).
- Full screenshot set with before/after pairs, Variant E, arena smoke tests, Phase 4 events, perf, and the githack check.

### Next steps
1. Affix visuals, then commit and push.
2. Inspector, then commit and push.
3. Verification pass and screenshots.

## Stage 2 (bosses): not started

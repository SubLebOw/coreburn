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
- Draw-call pass: each rig group is now 1 lit mesh (vertex colours, the enemy's single flashable Lambert material)
  plus at most 1 glow mesh (one shared material). One shadow caster per enemy; above 8 live enemies, light
  non-elite enemies stop casting shadows. Death scrap uses 3 InstancedMeshes. The acolyte and spitter get a lifted
  palette and a subtle self-light.
  Draw calls (software render, includes the shadow pass), v1.33.0 -> 5C:
  11 types close-up 145 -> 103, gameplay camera 152 -> 109, elites 185 -> 110, 20-enemy mixed crowd 246 -> 185.
  Triangles are higher (gameplay 2.0k -> 7.4k; crowd 3.0k -> 12.3k). Merged geometry is cached per type and
  form, so it does not grow with enemy count.

- Dev inspector `js/dev-5c-inspector.js`. It loads only through PR #7's identical `?dev=1` gate (raw.githack.com or
  http://localhost/127.0.0.1, never in the Capacitor app, never on sublebow.github.io) and uses dev-boot's sessionStorage
  sandbox; dev runs are marked `tainted`. It can spawn any type, toggle elite, toggle each affix, spawn 10 mixed,
  clear adds, set LOD auto/hi/lo, and has a "spawn next boss" hook for stage 2. The panel scrolls and starts folded on phones.
  Tested: without the flag there is no panel, no `__CB_DEV` and no dev-*.js request. A build dry run in a temp
  dir leaves out js/dev-*.js.

### Remaining
- Full screenshot set with before/after pairs, Variant E, arena smoke tests, Phase 4 events, perf, and the githack check.

### Next steps
1. Affix visuals, then commit and push.
2. Inspector, then commit and push.
3. Verification pass and screenshots.

## Stage 2 (bosses): not started

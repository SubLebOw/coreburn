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

### Stage 1 verification (latest)
- Timing/radii fingerprint: 22/22 sims identical to v1.33.0.
- Variant E: UNIT PASS (24 checks). Desktop and mobile smoke runs show 0 JS errors.
- Mixed wave (all 11 types, normal and elite with affixes, 22 spawned) in all 5 arenas (slag, foundry, tundra, cathedral,
  rooftop), desktop and mobile: 0 errors. On desktop, one bulwark stays at its spawn point on rooftop; v1.33.0 does
  the same (pre-existing).
- Phase 4 events (blackout, relays, HVT kill and escape, containment shift in 3 arenas, client snapshot): same results
  as v1.33.0. The HVT keeps its amber marker and its kill is credited.
- Perf, in-game with 24 live enemies (software render, simulated mobile viewport, not a real device):
  draw calls 427 -> 333 (desktop) and 435 -> 333 (mobile); median frame 51 -> 54 ms (desktop) and 49 -> 49 ms (mobile,
  SwiftShader); triangles 6.6k -> 17.5k. Geometries after 3 kill/respawn waves: v1.33.0 134 -> 170,
  5C 277 -> 280 (shared caches, so no per-enemy growth).
- Without ?dev=1: no dev panel and no dev files requested. The build dry run leaves out js/dev-*.js.

## Remaining
- Stage 2 (bosses): not started, as instructed.

## Next steps (stage 2)
1. Boss models (12 bosses, a separate Boss class in boss*.js) reusing `enemy-models.js` (vertex-colour merge), keeping boss IDs.
2. A boss timing fingerprint like p5c-timing.mjs, run before changing anything.
3. A boss picker in the inspector's "BOSSES" section (it currently only has "spawn next boss").

## Stage 2 — Bosses (in progress, 2026-10-27)
- DONE models: js/boss-models.js dresses all 12 bosses (13 DRESS fns incl. twins), merged static geometry, telegraph/impact/recover/staged-death presentation (local-only fx, no RNG/network). Commit 7303bcf.
- DONE pose fix (pre-existing v1.33.0 bug): pose setScalar reset UNIT_BOX parts to 1 m glow cubes (Klaxon throat, Bellows mouth, Gravel maw, Nail core).
- PROOF: 24-sim boss timing fingerprint (12 bosses x lap 0/1, 70 s each) IDENTICAL vs v1.33.0 — shots/phase5c/baseline-boss-timing.json == new-boss-timing.json.
- DONE dev inspector boss picker (?dev=1): 12 buttons, jump-to-wave / spawn-here, remove bosses; mobile-sized buttons.
- DONE in-game fights (pw/p5c-boss-fight.mjs, desktop+mobile+baseline): all 12 spawn clear of obstacles, phase 2 fires, attacks seen, exactly 1 onBossKilled + 1 BOSS RELIC each, stats.zBosses reaches 12, all 5 arenas covered, 0 JS errors, no boss left in list / no scene growth. Baseline behaves identically.
- Perf (calls/tris all 12 in one scene): 257/4.5k -> 281/17.4k.

### Stage 2A — review-ready checks (2026-10-27, all vs v1.33.0 on :8011)
- Boss-fight harness (fixed relic-picker handling) — desktop, mobile AND v1.33.0 all clean: 12/12 spawn clear, phase 2, 1 kill + 1 BOSS RELIC each, zBosses 1..12, 5 arenas, 0 JS errors.
- Rivetjaw "lingering": NOT a bug and identical on v1.33.0. Every boss keeps its 2.2 s death animation; the boss relic picker pauses the game (state 'upgrade') so the dead boss stays in the list until the card is picked. Measured the same for Choirmother/Bellows/Rivetjaw/Tithe/Nail on both builds. No fix.
- Phase 4 events (pw/p5c-boss-events.mjs, desktop+mobile): boss waves 25/30 never start an event (main.js isBossWave gate), wave after a boss can; identical to v1.33.0, 0 errors.
- Variant E: UNIT PASS (24 checks), 0 errors.
- Save/resume (pw/p5c-boss-save.mjs): Save&Quit mid-boss (w25) resumes at w25 with the same boss, killing it = 1 onBossKilled, zBosses +1 once; save at w26 resumes with no boss, no extra kill. Identical to v1.33.0.
- Perf (pw/p5c-boss-perf.mjs, Nail Chorus + 24 mixed crowd, SwiftShader software GL, mobile = emulated viewport): v1.33.0 desktop 466 calls / 8.1k tris / median 61.5 ms, phase5c 395 calls / 20.6k tris / 69.1 ms; mobile 475/8.3k/65.3 ms -> 402/20.7k/62.8 ms. Frame times are CPU-rasterizer bound; not representative of real GPUs.
- Simulated co-op (pw/p5c-boss-coopsim.mjs — SIMULATED in one browser: host snapshot tuple replayed into a client-style puppet): 12/12 puppets show the same telegraphs as the host, play death, 0 exceptions, 0 kill callbacks and 0 relic toasts from the puppet, root removed. coop.js unchanged. Same on v1.33.0.
- Cleanup (pw/p5c-boss-clean.mjs: Vell, twins, Hymnworks, Nail, Klaxon): boss roots/beams gone from scene and list after death; remaining new scene children are arena/wave groups, same pattern on v1.33.0.
- Dev gate: no flag -> no dev requests/panel; ?dev=1 -> inspector; sublebow.github.io + https://localhost (Capacitor) with ?dev=1 -> no dev code; build-web dry run (temp copy) ships 0 dev-*/.local files. Mobile boss picker tap test (jump + spawn here + remove) OK: shots/phase5c/boss/dev-picker-mobile-*.png.
- Nail Chorus trim: head throats/eyes share one glow mat (no per-head pulse) 48 -> 43 calls; fingerprint still IDENTICAL.

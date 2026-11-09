# VOLKAR (thane) — Phase 6 TEST build status
Branch `phase6-volkar` (off v1.34.0 a99db7b). NOT merged, NOT deployed live. Dev site only.
Implemented: model (animated coils/arcs), Conduit Maul combo + Charge + Ground Discharge, Shocked + chain/conduct,
Skyfall (3 m lunge, telegraph, chains), Storm meter + Tempest Surge (wind-up/storm/finisher/empower, 4% boss cap per Surge),
8 Volkar cards + 6-node mastery, HUD (Storm bar, Charge pips), synth audio, pooled opaque VFX, touch 3 buttons, unlock rule (W40 Zaleks + 6 bosses) + dev unlock.
Stubbed: Discharge extra 0.12 s wind-up, Grounded passive, evolution/mythic, sky darkening/camera pull, co-op VFX sync, sim-ttk, resume keeps Charge/meter.
Tests: hp.mjs 24/24; enemy (22) + boss (24) timing fingerprints byte-identical to v1.34.0; desktop/mobile smokes 0 JS errors.

## v2 (Zac playtest, commit b9a8b29)
- Maul: every hit is an overhead SLAM (lift t 0-0.38, drive 0.38-0.45, damage frame unchanged at t 0.45 = impact, recover after 0.7).
  Hits 1-2 quick slams, hit 3 heavier (higher lift, deeper crouch, sky-bolt flash). Ground impact: ring + crack shards + dust + static sparks + 2 ground arcs.
  Ground Discharge = same slam, bigger (1.9x impact, 2 bolts) + the existing discharge ring/damage. Sweep arc hidden for Volkar only.
  Combo damage/range/arc/duration/knockback unchanged.
- Idle/run: maul held up over the right shoulder (armR x -3.65) instead of hanging by the leg.
- Skyfall range 12 -> 999 (map-wide), still 3 targets, elites/bosses first, same cd/damage/telegraph. Targets > 9 m get a pooled chevron at Volkar's feet pointing at them for the telegraph duration.
- speed 6.4 -> 7.4. Charge pips moved top 58px -> 80px (no overlap). Hero-select hint is generated from the card count (7 cards = "Press 1-7"), already correct.
- Tests: hp.mjs 24/24, enemy+boss fingerprints byte-identical to v1.34.0, smokes 0 JS errors.

## v3 power buff (Zac, commit e66d48b)
js/hero-stats.js (thane): combo dmg 30/30/44 -> 36/36/53; range 2.7/2.7/3.1 -> 3.4/3.4/3.9; duration 0.50/0.50/0.55 -> 0.35/0.35/0.40
(damage frame stays at 45% = impact; slam pose and impact VFX are fraction-based so they scale with it);
charge.max 10 -> 6 (minMax 3 with Capacitor Head); new charge.slamAoE {r 1.35, pct 1, at 1.8} and charge.burst {pct 0.2, t 0.6};
dashCd 7 -> 5; meter hit 2->4, shockedHit 3->6, skyStrike 4->8, passive 0.5->1, new kill 3; lockAfter 6 and surge.bossCapPct 0.04 unchanged; speed 7.4 unchanged.
js/volkar.js: chargeMax floor, killMeter (once per enemy), slamTargets, burstMult, burst timer; slam VFX at 1.8 m.
js/player.js: slam AoE pass (skips enemies already struck that swing), +20% walk for 0.6 s after each slam, no hit flinch mid-slam.
Note: the game has no player knockback (only boss body-collision push), so "knockback resistance" = no flinch during the slam.
Tests: hp 24/24, fingerprints byte-identical, smokes 0 errors. Time-to-full-Storm ~40 s -> ~11 s (bot, wave 8).

## v4 (volkar-test4): evolution, Mythic, co-op visuals
- **Evolution: Skysunder Volley** (`eSkysunder`, needs Chain Lightning + Thunderhead both maxed, gold card). Every Skyfall
  mark becomes a 3-strike volley walking forward along the lunge (1.8 m steps, 0.15 s apart). Follow-ups 60% of the
  Skyfall hit (3.0x base -> 1.8x), no meter. Chains fork once at a Shocked foe; 8 jumps max per volley (shared pool).
  The follow-ups + chains share a 3% boss max-HP budget per cast. Named "Skysunder" since Skybreaker is a Volkar rank title.
- **Mythic: Brewing Squall** (`myVkSquall`, Volkar only, normal Mythic rules: wave 75+). Every 4th Ground Discharge
  leaves a storm cloud for 4 s (max 1). Every 0.6 s it strikes the nearest Shocked enemy within 8 m (2.0x base, 1.2 m area,
  kind 'shock', re-Shocks). The cloud's own 3% boss max-HP cap. (The spec's "Living Storm" is a Volkar rank title.)
- **Co-op visuals**: every pooled Volkar effect (bolt, arc, telegraph, crack, cloud) records on the host as a `vk` fx event
  (`setVolkarRecorder` in coop.installRecorders) and is replayed by friends with `vfxReplay`. Skyfall impact rings now use the
  recorded spawnRing. Rough edge: replayed telegraphs stay where they were placed (the host's follow the target); the
  far-target chevrons are not sent.
- **Perf**: bolt/arc/crack segments are now 3 InstancedMeshes (was up to ~100 separate meshes). The pool ticks once per frame
  from main.js (`tickVolkarFX`), which also fixes the double-speed decay with 2 Volkars in one scene.
- Dev: cbDev.volkarEvo(), cbDev.volkarMythic() (+ panel buttons). volkarCards now maxes only normal cards.
- Tests: enemy (22) / boss (24) fingerprints byte-identical, hp.mjs 24/24, desktop + 844x390 smokes 0 errors,
  simulated co-op (host recorder -> JSON -> friend replay) 73 events, 0 errors.

## v5 (volkar-test5): Grounded, Surge sky, hammer throw, kill shatter, audio
- **Grounded passive:** stand still in `normal` for **1.0 s** → next slam deals **+18%** damage (`swingMult`). No DR / i-frames.
  Visual: cyan ring on ready, maul coils crackle harder, ground arcs + `vCrackle` every 0.28 s while held. Consumed on swing start.
- **Surge sky darkening:** during Tempest Surge the background/fog lerp toward night, hemi −45%, sun −65%, camera pulls back up to **+4** units.
  Thunder rumbles every 1.8 s in the storm phase. Restores on Surge end, death, `vReset`, and wave begin. Recorded as `vk dark` for friends (throttled).
- **Skyfall hammer throw (visual only):** on cast a pooled glowing maul flies to the first mark, lightning lands on it, then it returns in 0.35 s.
  Gameplay (lunge, damage, timing, marks) unchanged. Coils/blade hide; the shaft is baked into the arm mesh so a faint hand-maul remains (rough edge).
  Recorded as `vk throwMaul`.
- **Kill shatter (visual only):** enemies killed by Volkar slams or Ground Discharge set `e.vShatter` and skip normal scrap — instead pooled cracks + cyan arcs/sparks (cap **3 new / frame**).
  Drops / kill logic / fingerprints untouched. Recorded as `vk shatter`.
- **Audio:** 3rd slam gets a heavier thunder (`vSwing` step≥3); Charge ticks add bandpass crackle; Discharge is a bigger boom; new `vCrackle` / `vShatter` cues. All go through the existing synth + mute/volume bus.
- Tests: enemy/boss fingerprints byte-identical, hp 24/24, desktop + 844x390 smokes 0 errors.
  Draw calls during Surge ~256–387 avg (15 enemies); during shatter bursts ~310.

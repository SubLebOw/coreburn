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

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

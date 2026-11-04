# VOLKAR (thane) — Phase 6 TEST build status
Branch `phase6-volkar` (off v1.34.0 a99db7b). NOT merged, NOT deployed live. Dev site only.
Implemented: model (animated coils/arcs), Conduit Maul combo + Charge + Ground Discharge, Shocked + chain/conduct,
Skyfall (3 m lunge, telegraph, chains), Storm meter + Tempest Surge (wind-up/storm/finisher/empower, 4% boss cap per Surge),
8 Volkar cards + 6-node mastery, HUD (Storm bar, Charge pips), synth audio, pooled opaque VFX, touch 3 buttons, unlock rule (W40 Zaleks + 6 bosses) + dev unlock.
Stubbed: Discharge extra 0.12 s wind-up, Grounded passive, evolution/mythic, sky darkening/camera pull, co-op VFX sync, sim-ttk, resume keeps Charge/meter.
Tests: hp.mjs 24/24; enemy (22) + boss (24) timing fingerprints byte-identical to v1.34.0; desktop/mobile smokes 0 JS errors.

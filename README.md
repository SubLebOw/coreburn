# COREBURN — Endless Arena Brawler

> *The Grindchoir melts down anything with a pulse to feed its machine hymn. Sarrow, a scavenger with a stolen
> reactor core burning in his chest, has decided the song ends here.*

An original 3D isometric arena brawler that runs in any browser (PC or phone) with nothing to install.
Play as **Sarrow** and carve through endless waves of the **Grindchoir**, a machine cult of scrap-built drones,
with a boss fight every 5 waves, power-ups to grab, and a new arena every 10 waves. How far can you get?

**Play it:** https://sublebow.github.io/coreburn/

## Controls

| Action | Keyboard / mouse | Phone / tablet |
| --- | --- | --- |
| Move | WASD or arrow keys | Drag on the left half of the screen (virtual joystick) |
| **Attack** (each hero's own: talon combo / shield bash / needles / arc tether) | J or left-click (hold to keep going) | big button (hold) |
| **Mobility** (blink / shoulder charge / phase hop / magnet grapple) | K or Space | lower small button |
| **Ultimate** (overdrive / seismic slam / needle storm / hymn engine) | L | upper small button |
| Start | Enter / J / START | START button |
| Game over | **PLAY AGAIN** button, or a fresh Enter / R (opens hero select, last hero highlighted: Enter starts) · SHOP · MENU | tap PLAY AGAIN / SHOP / MENU |
| Mute / unmute sound | M or the speaker button | speaker button (top right) |
| Share your score | SHARE SCORE / COPY on the game over screen | same |

**Core recharge:** Sarrow's health slowly refills by itself, faster if he avoids hits for 3 seconds.
Clearing a wave heals 25; beating a boss heals 60.

## The Grindchoir

| Enemy | Unlocks | What it does |
| --- | --- | --- |
| Acolyte | wave 1 | Basic melee drone. Raises its fists (glows red) before swinging. |
| Ripper Hound | wave 2 | Fast four-legged scrap hound. Crouches, then lunges. |
| Slag Spitter | wave 3 | Keeps its distance and spits slow molten bolts. Sidestep or blink through them. |
| Bulwark | wave 4 | Big armoured brute with a shield. Only your combo finisher or overdrive staggers it. |
| Hive Splitter | wave 6 | Bursts into 3 skittering Mites when destroyed. |
| Elites | wave 6+ | Any type can spawn as an elite: amber crown and eyes, 30% bigger, 2.2x health, 1.35x damage, 3x points. |

### Bosses (every 5th wave, 7 take turns, tougher each time round)

Every boss has a name banner and a health bar, and every attack is telegraphed (red strips for charges and beams,
filling red circles for things that land on you).

1. **The Furnace Deacon** (waves 5, 40, 75...): a furnace-bellied brute. Telegraphed **charges** (red strip on the floor;
   if it smashes into the fence it's dazed), **ground slams** (red circle fills up, then boom), and **summons** acolytes and hounds.
2. **Cantor Vell, the Afterblade** (waves 10, 45, 80...): a tall, fast duelist with a magenta blade. **Blink strikes**
   (vanishes leaving an afterimage, reappears next to you, shows a strip, lunges), **mirror** (3-5 violet afterimages surround
   you and dash through one after another), sweeping **blade-wave fans**, and summons hounds.
3. **Choirmother** (waves 15, 50, 85...): a floating bell-masked priestess. **Bolt bursts** in every direction, **marked slams**
   (circles drop on and around you), summons **mites and spitters**, and the occasional charge.
4. **The Gulletworm** (waves 20, 55, 90...): a scrap-worm that lives under the floor. **Burrows** (can't be hit), then red
   circles open under and around you and it **erupts** from the main one; afterwards it's dazed for a moment. Also a **chain**
   of circles bursting towards you, acid **volleys**, and mite swarms.
5. **Rivetjaw** (waves 25, 60, 95...): a giant scrap crab that's mostly jaw. **Triple charges**, aimed **bolt volleys**,
   slams, and summons **bulwarks**.
6. **Brand & Temper, the Forge Twins** (waves 30, 65, 100...): two bosses sharing one health bar. Brand (red-hot, branding
   iron) charges and slams; Temper (steel-blue, quench tank) fires volleys and marked slams. Either can **link**: a tether
   beam that makes the other twin take 60% less damage and attack faster. Hit the one that's linking to snap the beam
   (it's stunned). Kill one and the other **enrages**.
7. **The Hymnworks** (waves 35, 70, 105...): a pipe-organ fortress that never moves. Fires 2-4 **rotating laser beams**
   (keep running ahead of them or blink through), a fast single **sweep**, **mortar** shells onto red circles, pipe bolt
   bursts, and summons spitters and acolytes.

Beating a boss: **+60 health, +500 x boss number points**, a guaranteed power-up + heal orbs, and every minion it summoned crumbles.

## Power-ups

Kills sometimes drop a glowing pickup: normal enemies 3% (mites 1%), elites 15%, bosses always.
Walk over it to grab it. Pickups vanish after 10 seconds (they blink for the last 3). Active power-ups show as
round badges with a draining timer ring under your health bar (on phones too).

| Power-up | Shape | Lasts | What it does |
| --- | --- | --- | --- |
| SLOW-MO | teal diamond | 5 s | Bullet time: enemies, bolts, boss attacks and hazards run at 35% speed while Sarrow moves at full speed. Colours wash out with a teal tint, the music drops in pitch. |
| FURY | red pyramid | 8 s | Double damage (red talons) |
| SHIELD | blue ball | 10 s or 3 hits | Blocks hits. Lava and lightning are blocked without using up a charge. |
| MAGNET | green ring | 10 s | Pulls pickups in from 10 m, and every kill drops a +5 heal orb that flies to you |
| ARC TALONS | blue crystal | 10 s | Slashes and blinks chain lightning to up to 3 nearby enemies (60% damage) |

## Combo multiplier

Every talon hit adds +1 to your **combo** and every kill adds +1 more. Land nothing for 3 seconds and the combo drops to 0. Getting hurt halves it. Your score multiplier steps up with the combo and applies to kill, boss and wave-clear points:

| combo | 0 | 10 | 25 | 50 | 100 | 175 | 275 | 400 |
|---|---|---|---|---|---|---|---|---|
| score | x1 | x2 | x3 | x4 | x5 | x6 | x7 | x8 |

Milestones pop a callout (NICE, SAVAGE, BRUTAL, UNSTOPPABLE, GODLIKE, MELTDOWN, COREBURN!). Your best combo shows on the game over screen and in the share text. The code is in `js/combo.js`.

## Heroes (v1.10.0: 4 different kits)

Pick a hero before every run (the last one you played is highlighted). Every hero uses the **same 3 buttons**
(attack / mobility / ultimate, same keys and touch buttons), but each one fights in a completely different way.
The HUD buttons, the select screen and the upgrade cards all use the hero's own ability names and icons.

| Hero | Playstyle | HP | Attack (J) | Mobility (K / Space) | Ultimate (L) |
|---|---|---|---|---|---|
| **Sarrow** | DUELIST (melee) | 180 | **Talon Combo**: 3-hit combo, heavy finisher | **Blink**: untouchable dash that cuts through enemies (0.9 s) | **Overdrive**: 1.6 s whirlwind (11 per hit), half damage taken (8 s) |
| **Zaleks** | TANK | 190 | **Shield Bash**: bash + hammer-fist, huge knockback, blocks 40% of frontal damage while swinging | **Shoulder Charge**: stuns everything it hits for 1 s, stops at walls (4.5 s) | **Seismic Slam**: 5.5 m AoE slam (60 dmg) + stun, **taunts** nearby enemies (and bosses) for 5 s, shield = 20% max HP (12 s) |
| **Iskra** | KITER (ranged) | 70 | **Needles**: rapid needles (pierce 1) auto-aimed at the nearest enemy in your move direction, fire while moving | **Phase Hop**: 5.5 m teleport, 2 charges, leaves a **decoy** enemies chase (3 s / 4 hits) (3.2 s) | **Needle Storm**: 3.5 s of 5-needle fan volleys, move freely (11 s) |
| **Orin** (secret) | CONTROL / summoner | 165 | **Arc Tether**: 5.5 m beam that pins its target and chains to 2 more (80% damage) | **Magnet Grapple**: yanks an enemy to you (stunned), or pulls you to a pillar / boss / heavy enemy, else a short reel (3.5 s) | **Hymn Engine**: 3 s vortex that drags enemies in + 2 scrap drones that fight for 10 s (14 s) |

All kit numbers live in `js/hero-stats.js`; the kits are in `js/player.js` (per-hero handlers on the same 3 slots)
and the needles, decoys, drones and vortex in `js/allies.js`. In co-op the host runs all of them and friends see
them through the snapshot (needles, decoys, drones, vortexes, Zaleks' shield and taunt).

### Balance (`node scripts/sim-ttk.mjs`)

The simulator reads the real kit and card numbers and models each hero's **single-target DPS** (attack rotation +
ultimate and mobility damage over their cooldowns, x uptime), **AoE / crowd clear** (cones, pierce, chains, rings),
**effective HP** (armour, frontal block, slam shield, regen, siphon) and **mobility / escape** (range kept, i-frames,
decoys, stuns, pins). It runs a standard wave, an elite-heavy wave and a boss at waves 10 / 30 / 60 / 100 with a typical
build for each hero (universal + that hero's cards). Since 1.11 the yardstick is **Iskra**: she felt strongest in play,
so the model now credits her kiting more (exposure 0.5, uptime 0.97) and the other three were **buffed up** to her level
(she was not nerfed). % = difference from Iskra (target about 10%; `--avg` compares with the 4-hero average instead):

| scenario | Sarrow clear | Sarrow survive | Zaleks clear | Zaleks survive | Iskra clear | Iskra survive | Orin clear | Orin survive |
|---|---|---|---|---|---|---|---|---|
| standard w10 | 5.2s (-16.6%) | 18.2s ( -4.9%) | 5.2s (-16.9%) | 21.9s ( 14.1%) | 6.3s (  0.0%) | 19.2s (  0.0%) | 6.2s ( -1.7%) | 21.0s (  9.5%) |
| standard w30 | 10.7s (-11.2%) | 11.5s ( -5.3%) | 11.2s ( -7.4%) | 13.0s (  6.9%) | 12.1s (  0.0%) | 12.2s (  0.0%) | 11.3s ( -6.0%) | 12.5s (  2.7%) |
| standard w60 | 8.9s ( -4.3%) | 8.4s ( -5.3%) | 8.7s ( -6.4%) | 9.1s (  2.3%) | 9.3s (  0.0%) | 8.9s (  0.0%) | 9.2s ( -0.4%) | 8.7s ( -1.7%) |
| standard w100 | 6.1s ( -3.2%) | 6.4s ( -9.5%) | 6.1s ( -3.4%) | 7.4s (  4.4%) | 6.3s (  0.0%) | 7.1s (  0.0%) | 6.4s (  0.3%) | 7.1s (  0.3%) |
| elite-heavy w10 | 8.3s (-12.3%) | 11.8s ( -8.1%) | 8.3s (-12.0%) | 14.6s ( 14.1%) | 9.4s (  0.0%) | 12.8s (  0.0%) | 9.3s ( -1.9%) | 13.3s (  4.1%) |
| elite-heavy w30 | 17.1s ( -6.0%) | 7.5s ( -8.0%) | 18.0s ( -0.9%) | 8.7s (  6.9%) | 18.2s (  0.0%) | 8.1s (  0.0%) | 17.7s ( -2.7%) | 7.9s ( -2.4%) |
| elite-heavy w60 | 14.1s (  1.5%) | 5.3s (-10.0%) | 14.1s (  1.4%) | 6.1s (  2.3%) | 13.9s (  0.0%) | 5.9s (  0.0%) | 14.3s (  2.4%) | 5.5s ( -6.4%) |
| elite-heavy w100 | 10.0s (  4.9%) | 4.1s (-13.9%) | 10.1s (  6.4%) | 5.0s (  4.4%) | 9.5s (  0.0%) | 4.7s (  0.0%) | 10.1s (  6.0%) | 4.5s ( -4.3%) |
| boss w10 | 7.1s ( -7.6%) | 13.0s ( 10.6%) | 7.3s ( -5.5%) | 13.6s ( 16.2%) | 7.7s (  0.0%) | 11.7s (  0.0%) | 6.9s (-10.6%) | 12.5s (  6.6%) |
| boss w30 | 9.7s ( -0.2%) | 8.3s ( 12.2%) | 10.7s (  9.2%) | 8.0s (  8.3%) | 9.8s (  0.0%) | 7.4s (  0.0%) | 9.4s ( -3.4%) | 7.5s (  0.6%) |
| boss w60 | 12.7s ( -0.9%) | 5.7s ( 14.9%) | 13.6s (  6.5%) | 5.3s (  6.0%) | 12.8s (  0.0%) | 5.0s (  0.0%) | 11.9s ( -7.2%) | 5.1s (  2.6%) |
| boss w100 | 14.3s ( -0.8%) | 4.4s ( 11.2%) | 15.4s (  6.7%) | 4.1s (  2.6%) | 14.4s (  0.0%) | 4.0s (  0.0%) | 13.5s ( -6.5%) | 4.1s (  3.7%) |

Worst cell: 16.9%. The cells over 10% are mostly the melee heroes clearing wave-10 crowds *faster* than Iskra
(their swings hit whole groups before her needles ramp up; not nerfed on purpose), Zaleks being a bit tankier early
(he's the tank), and Sarrow's Overdrive (half damage taken) against bosses. `--check` fails above 10%.

## Weapon upgrades (every 2 waves)

After every 2nd wave (2, 4, 6...) the game pauses and offers **3 random upgrade cards**. Tap a card, click it, or press **1 / 2 / 3**. Every pick also raises your **weapon tier by 1**, and the talons grow longer and brighter, cycling through cyan, white-gold, violet and crimson.

**Even scaling (js/upgrades.js).** Enemy health grows as `x(1 + 0.14·(wave-1))`, and you pick every 2 waves, so each pick adds 0.28:

```
weaponMult(tier) = 1 + 0.28 · tier        // tier = picks so far (one every 2 waves)
damage = base · hero damage · weaponMult(tier) · perks   // perks are capped, max ~2x single-target
```

The base tier alone keeps time-to-kill flat for the whole run. Perks are the extra edge. They come in small steps with high caps, so they build slowly over the ~50 picks you'd make by wave 100. A maxed card leaves the pool. When fewer than 3 cards are left, **Reactor Patch** (+3 max health and a heal) fills the gap.

The pool is **universal cards** (every hero) plus **hero cards** (only offered to that hero). The card's group label uses
your hero's ability name (e.g. PHASE HOP, SEISMIC SLAM).

| Who | Upgrades (max level) |
|---|---|
| Everyone | Core Edge +3.5% dmg (10), Crit Spark +3.5% (8), Twin Strike +4% (6), Storm Core +7.5% chain (6), Core Leech (6), Ultimate Fury +12.5% (6), Ultimate Coolant -5% (6), Quick Recovery -6% mobility cd (6), Swift Step +3% (6), Reinforced Core +7.5% HP (8), Core Recharge +17.5% (6) |
| Sarrow | Wide Arc +6% reach, +5% slash dmg (6), Shockwave Finisher (5), Blink Edge (6), Long Blink (6), Extra Blink +1 charge (1), Blink Trail (5), Long Overdrive (6), Overdrive Reach (6), Overdrive Siphon (6) |
| Zaleks | Tower Guard +6% block (2), Heavy Hammer +9% dmg, +6% reach (6), Concussive Charge stun +0.5 s (3), Long Charge (5), Aftershock +8% slam radius (5), Bulwark Shield +10% (5), War Cry taunt +1 s (3) |
| Iskra | Piercing Needles +1 (1), Split Needles (1), Extra Hop +1 charge (1), Long Hop +12% (4), Stubborn Decoy +1 s/+2 hits (4), Long Storm +0.5 s (5), Dense Storm +1 needle (2) |
| Orin | Choir Chain +1 (3), Long Tether +10% (4), Magnet Shock stun +0.3 s (4), Extra Drone +1 (1), Drone Armament +10% (5), Drone Lifespan +1 s (3), Hymn Shell -6% damage while drones fly (4), Deep Vortex +10% (5) |

Simulated time-to-kill, single target, typical mixed build (`node scripts/sim-ttk.mjs`):

| wave | picks | weapon x | base std | base elite | typical perk x | typical std | typical elite | max-damage elite |
|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 1.00 | 0.55s | 1.21s | 1.00 | 0.55s | 1.21s | 1.21s |
| 10 | 4 | 2.12 | 0.58s | 1.29s | 1.11 | 0.53s | 1.16s | 1.12s |
| 30 | 14 | 4.92 | 0.56s | 1.24s | 1.11 | 0.51s | 1.12s | 0.80s |
| 60 | 29 | 9.12 | 0.56s | 1.22s | 1.22 | 0.46s | 1.00s | 0.60s |
| 100 | 49 | 14.72 | 0.55s | 1.22s | 1.38 | 0.40s | 0.88s | 0.59s |

## Arenas (a new one every 10 waves)

| Waves | Arena | Hazard |
| --- | --- | --- |
| 1-10 | **The Slag Yard**: scrapyard foundry at dusk | none |
| 11-20 | **The Molten Foundry**: crucibles and anvils | glowing lava cracks burn you (4 damage every half second) |
| 21-30 | **Frozen Scrap Tundra**: snow, ice blocks, frozen wrecks | ice patches: you slide and turn slowly |
| 31-40 | **Neon Rust Cathedral**: a ruined cathedral at night, neon pillars | none |
| 41-50 | **The Storm Rooftop**: AC units, vents, water tanks, rain | lightning: a red circle appears near you, then the bolt lands (16 damage; it hurts enemies too) |

The screen fades to black and back, and the arena's name appears. After wave 50 the arenas loop with a red
"harder" tint and hazards that hit 25% harder each loop. The middle of every arena is clear (that's where you start),
obstacles are spaced so there's always room to dodge, and enemies never spawn inside anything.

### Endless scaling (wave n)

- Enemies per wave: `4 + 2n` (no limit). Max on screen at once: `min(6 + n, 14)`, capped so phones stay smooth.
  Later waves get harder through stats and elites instead of more bodies.
- Enemy health `x (1 + 0.14(n-1))`, damage `x (1 + 0.07(n-1))`: both grow forever.
- Enemy speed `x (1 + min(0.5, 0.025(n-1)))`: tops out at +50% so it stays dodgeable.
- Elite chance: `min(50%, 4% per wave after wave 5)`.
- Bosses: health `x (1 + 0.45 per previous boss)`; after each full loop of all 7 bosses their wind-ups get 12% faster
  (down to 60%), slams get bigger, and they fire, summon and split into more.

Score: points per kill (acolyte 10, hound 15, spitter 20, splitter 20, bulwark 40, mite 3, elites x3), plus `25 x wave`
per cleared wave, plus the boss bonus. Your best score is saved in the browser.

## Running it on your own computer

Browsers block ES modules from `file://`, so you need a tiny local web server. Pick one:

```bash
python3 -m http.server 8000   # Python
npx serve .                   # or Node.js
```

Then open http://localhost:8000. Edit a file, save, refresh the page. That's the whole workflow, with no build step.
Three.js is bundled in `vendor/` (MIT licence), so the game also works offline.

## File layout

Weapon upgrades: `js/upgrades.js` (upgrade list, caps, scaling formula). Heroes: `js/hero-stats.js` (numbers) and `js/characters.js` (models). Combo: `js/combo.js`. TTK simulator: `scripts/sim-ttk.mjs`.

```
index.html         Page layout: HUD, boss bar, touch buttons, title/game-over screens, Three.js import map
style.css          All the styling (HUD, buttons, joystick, cooldown pies, mobile tweaks)
js/main.js         Starting point: renderer, camera, lights, game loop, score, start/game over, resizing
js/player.js       heroes: movement + the 4 kits on the 3 ability slots, core recharge
js/allies.js       kit objects: Iskra's needles + decoys, Orin's drones + vortex (co-op synced)
js/enemy.js        Grindchoir enemy types (looks + AI), elites, hit flash, knockback, death
js/boss.js         The shared boss brain (telegraph -> attack -> recover) + the three original bosses
js/boss-vell.js    Cantor Vell (blink strikes, afterimages)
js/boss-worm.js    The Gulletworm (burrow + erupt)
js/boss-twins.js   Brand & Temper (twin bosses with a buff tether)
js/boss-hymnworks.js The Hymnworks (rotating laser beams)
js/bosses.js       The boss rotation order
js/powerups.js     Pickups, heal orbs, and the five power-ups
js/waves.js        Endless wave manager and all the difficulty scaling numbers
js/projectiles.js  Slow glowing bolts fired by spitters and bosses
js/arena.js        The five arenas (looks, obstacles, hazards, particles), arena order, collision
js/input.js        Keyboard + mouse input, turned into simple "move" and "action" signals
js/touch.js        Phone controls: floating virtual joystick and on-screen buttons
js/effects.js      Sparks, rings and red attack warnings (pooled so it stays fast on phones)
js/hud.js          Updates the health bar, score, cooldowns, boss bar and banners
js/audio.js        All sound: procedural sound effects + looping music (Web Audio, no sound files)
js/ads-config.js   THE ONE PLACE for AdMob IDs and ad frequency settings
js/ads.js          Interstitial + rewarded revive + consent (UMP). Does nothing on the website
js/updater.js      Android app: downloads new game versions from GitHub Pages (see below)
js/native.js       Tiny helper: "are we inside the Android app?"
js/share.js        Share-my-score (phone share sheet / post on X) and Copy on the game over screen
js/version.js      GAME_VERSION - bump it when you publish an update
privacy.html       Privacy policy (needed for Google Play + AdMob)
vendor/            Three.js (bundled so the app works offline)
android/           The Android Studio / Gradle project made by Capacitor
assets/            Source art for the app icon + splash (and a 512px Play Store icon)
scripts/           build-web.mjs (copies the game into dist/), make-update.mjs (builds an app update)
updates/           latest.json + the zipped game the Android app downloads updates from
```

### Easy things to tweak first
- `js/waves.js`: `waveStats()` and `UNLOCKS` set the whole difficulty curve
- `js/player.js`: `COMBO` damage/range, `MOVE_SPEED`, `DASH_COOLDOWN`, `SPIN_COOLDOWN`
- `js/enemy.js`: `ENEMY_TYPES`; `js/boss.js`: `CLASSIC_BOSSES`; `js/bosses.js`: `BOSS_ROTATION`
- `js/powerups.js`: `POWERUPS` (durations, drop weights); drop chances in `onKill()`
- `js/arena.js`: `THEMES` (colours, obstacle layouts, hazards), `WAVES_PER_ARENA`
- Testing helpers: put your own `js/dev.local.js` (exporting `install(ctx)`) next to main.js. It only loads on
  http://localhost, is git-ignored, and the build skips `*.local.js`, so it can never reach the website or the app.

## Android app (Google Play)

The Android app is the same web game wrapped with [Capacitor](https://capacitorjs.com).
App id `com.sublebow.coreburn`, name COREBURN, works in landscape and portrait, fullscreen.

### One-time setup (already done on the build box)
- Node.js 22+ (Capacitor's CLI needs it), JDK 21, Android SDK (platform 36, build-tools 36)
- `npm install`
- `android/local.properties` with `sdk.dir=/path/to/android-sdk` (not committed)
- Upload keystore in `/home/box/coreburn-keys/` (**never commit it**, back it up!)

### Build
```bash
npm run android:build      # -> android/app/build/outputs/bundle/release/app-release.aab  (upload this to Play)
                           #    android/app/build/outputs/apk/debug/app-debug.apk        (sideload to test)
npm run android:assets     # only if you change the icon/splash art in assets/
```
**Before each Play upload:** raise `versionCode` (and `versionName`) in `android/app/build.gradle`.

### How game updates reach app players (no Play Store review needed)

The app ships with the whole game inside it, so it **works offline** from the first launch.
On every launch it also checks `https://sublebow.github.io/coreburn/updates/latest.json`. If there's a newer
game version, it downloads the zip quietly in the background and switches to it **the next time the app starts**
(never in the middle of a run or an ad). If a new version fails to start, the app automatically rolls back to the
last good one. This uses [@capgo/capacitor-updater](https://github.com/Cap-go/capacitor-updater) in self-hosted
mode (no Capgo account, no tracking; everything comes from this GitHub Pages site).

To publish an update (website + app at once):
1. Change the game (JS/CSS/HTML).
2. Bump `GAME_VERSION` in `js/version.js` (e.g. `1.0.1`).
3. `npm run release:update` (builds `updates/coreburn-<version>.zip` + `updates/latest.json`)
4. Commit and push. Website players get it right away. App players download it the next time they open the app (with internet) and get it the time after that.

This is allowed by Google Play because it only changes the game's JavaScript/HTML/CSS running in the WebView,
not native code. **These still need a new Play Store build:** the AdMob App ID, adding/upgrading Capacitor plugins
or Capacitor itself, Android permissions, app name/icon/splash, target SDK bumps, anything in `android/`.
If an update needs a newer app build, set `minNativeBuild` in `scripts/make-update.mjs` to that `versionCode`
so older app installs skip it.

### Share my score
The game over screen has **SHARE SCORE** and **COPY** buttons. The text names what killed you, e.g.
*"I reached wave 12 in COREBURN (score 8,450) and died to an elite Ripper Hound. Can you beat it? 🔥"*
- Android app: the phone's share sheet via the `@capacitor/share` plugin. It's native code, so it's part of the
  app build (included from the first Play upload). An app build without it falls back to opening a post on X.
- Phone browsers: the phone's share sheet (`navigator.share`). Desktop: opens a ready-made post on X.
- COPY: puts the text + link on the clipboard.

### Ads (currently Google TEST ads)

All IDs live in `js/ads-config.js`. Right now they're Google's official test IDs, which is safe to click.
- **Interstitial:** only on the game over screen, when you choose to restart, at most every 3rd death and
  at least 2 minutes apart. Never during a fight.
- **Rewarded revive:** on the game over screen, "REVIVE (watch an ad)" brings you back with half health,
  once per run. Only if you watch the whole ad.
- **Consent:** Google's UMP consent form is shown where required (EEA/UK) once you set up a GDPR message
  in AdMob; an "Ad privacy choices" link appears on the title screen when needed.
- On the website, ads do nothing and the revive button never shows.

To go live: create your AdMob app, put your real App ID + ad unit IDs in `js/ads-config.js`, set
`testMode: false`, rebuild with `npm run android:build`, and upload the new `.aab`.
**Never click your own real ads.** Add your phone to `testDeviceIds` instead.

## License / credits

Original game design, characters and code. Built with [Three.js](https://threejs.org) (MIT).

## Online co-op (2–4 players)

Tap **CO-OP** → **HOST** to get a 4-letter room code; friends tap **JOIN** and enter it. Everyone picks a hero (duplicates get a tint and a "II/III" name), the host presses **START**.

- **Architecture:** peer-to-peer WebRTC via PeerJS (public signalling server `0.peerjs.com`, Google STUN). The host runs the whole simulation; clients send inputs at 20 Hz and receive ~20 Hz snapshots, interpolated. Your own movement is predicted locally.
- **Scaling:** enemy count ×(1+0.5·(n−1)), enemy HP ×(1+0.4·(n−1)), boss HP ×(1+0.6·(n−1)).
- **Downed & revive:** at 0 HP you're downed; a teammate standing near you for ~3 s revives you. The run ends when everyone is down.
- Upgrade picks and power-ups are per player; score and combo are shared. Bosses switch targets.
- **Limits:** max 4 players. No TURN relay, so some strict/symmetric NATs (some mobile carriers, corporate Wi-Fi) can't connect. Enemy reactions lag by your round-trip time. A custom PeerJS server can be set via `localStorage['coreburn-peer']`.

## Scrap, shop and run twists (v1.6.0)

- **Scrap** is earned every run (solo and co-op): 1 per 4 kills + 3 per wave + 15 per boss + 10 per mutator wave + golden jackpots. It's saved on this device (no account).
- **Shop** (title screen): skins (recolour any hero), talon colours and small starting perks. Each perk is about one upgrade card's worth, and you can equip one at a time. Cosmetics and perks apply to solo runs only.
- **Double scrap**: on the game over screen of the Android app you can watch an optional rewarded ad to double that run's scrap. The button never shows on the website.
- **Mutator waves**: from wave 7, every 4th regular wave (7, 11, 19, 23...) gets one twist, announced with a banner: Overclocked, Swarm, Glass Arena, Gilded Host, Volatile (enemies burst on death) or Bounty (double score).
- **Cursed cards**: from wave 10, about 1 pick in 3 offers a cursed card. Each gives a big boon with a real drawback (e.g. Blood Pact: +25% damage, -20% max health) and can only be taken once.
- **CLOSE CALL**: when a bolt only just misses you, the world slows to 30% for 0.4 s (+2 combo, bonus points). It has a 7 s cooldown and is solo only.
- **Golden bosses**: about 1 boss in 20 is golden, with a gold shader, 1.5x health and 3x points. It pays a scrap jackpot (150 + 50 per boss number) and has a 40% chance to drop a rare cosmetic (Gilded skin / Aurum talons) that can't be bought.

## Streamer Mode (v1.7.0)

Title screen → **Streamer mode** → channel (default **CalebGCameron**) → **TURN ON**. When the upgrade picker opens, chat votes with `!1`, `!2` or `!3`; tally bars fill on the cards and after 15 s the top card is picked (you can still pick yourself at any time; no votes = you pick). Chat is read **anonymously** with tmi.js (a read-only guest, no login or token), nothing is ever posted, and chat text is never shown on screen. The setting is saved on the device.

## Milestones and the secret hero (v1.8.0)

- **Milestones** (shop → MILESTONES tab): 16 long-term goals saved on this device, each paying out once. Rewards are scrap, milestone-only cosmetics (Veteran / Inferno skins, Hymnbreaker / Hex talons) and the secret hero. Examples: reach wave 10/25/50, beat all 7 bosses, hit a 100/400 combo, beat a golden boss, 10 close calls, 3 cursed cards in one run, wave 10 with 3 different heroes, finish a co-op run, revive a teammate.
- **ORIN, the secret 4th hero**: shown as a locked silhouette on the select screen until you reach **wave 50** (any hero, solo or co-op). He's a rogue Grindchoir unit and, since v1.10.0, the CONTROL hero (arc tether, magnet grapple, Hymn Engine drones; see Heroes). Once unlocked, he's also available in the co-op lobby.


## Daily challenge, weekly boss rush, leaderboards (v1.9.0)

- **DAILY** (title screen): one seeded run per UTC day, the same for everyone: the same enemy mix and elites every wave, the same mutator waves, the same upgrade cards offered and the same starting card. No shop perks and no golden bosses. Unlimited attempts; your best counts.
- **BOSS RUSH** (weekly): all 7 bosses back to back, in an order that reshuffles every Monday 00:00 UTC. An upgrade pick after each boss, with weapon tiers matched to a normal run. Ranked by bosses beaten, then fastest time.
- **RANKS**: GLOBAL, per HERO, DAILY and BOSS RUSH boards. Name entry has a profanity filter (also catches l33t and s.p.a.c.i.n.g). Anti-cheat sanity checks run in the game AND on the server: a score must fit what the kills/waves/time could earn, waves need a minimum time, rush bosses need at least 12 s each, daily/weekly boards only take today's / this week's runs, max one submission per 15 s, and builds run on localhost never submit.
- **Online leaderboards are OFF until a free Supabase project is connected** (until then, the boards show your best runs on this device). Setup (about 5 minutes, free tier, no card): create a project at supabase.com, run `supabase/leaderboard.sql` in its SQL Editor, then put the Project URL and the *anon public* key into `js/leaderboard-config.js` and set `enabled: true`. Free Supabase projects pause after a week with no traffic; un-pause them from the dashboard.

## CoreBurnZ mode (v1.12.0)
Classic is the default and is unchanged. Pick **COREBURNZ** under the title (the co-op host picks it in the lobby). In CoreBurnZ:
- **Ultimate cancel**: press the ultimate again, or any attack or ability, to end it early (same buttons on phone).
- Cards you already own come up about **1.5x** as often.
- Ultimate-cooldown cards give **-10%** per pick (classic: -5%).
- The ARC chain-lightning power-up reaches **50%** further.
- Every boss kill gives a gold **BOSS RELIC** pick from its own rarer pool: Titan Heart, Cinder Crown, Bossfang, Echo Engine, Grind Aegis, Tempest Heart, Choirless Soles, Deacon's Tithe.
- Bosses have **+10% HP**, and five new Grindchoir bosses join a 12-boss rotation:
  - **Sister Klaxon**: a ring of bolts with a moving gap, a shriek cone that knocks you back, charges and summons.
  - **The Bellows Abbot**: breathes in to pull you close, then blasts out a shockwave. Also slow gusts and slams.
  - **Saint Gravelmouth**: rockfall in two waves of warning circles, a gravel-spit stream and rolling triple charges.
  - **The Tithe-Warden**: marks follow your steps and explode, twin scale pans hit you and the mirrored spot, and it charges.
  - **The Nail Chorus**: a three-arm nail spiral, lines of falling nails and bursts.
- Leaderboards, best score, the daily seed and the weekly rush are kept separate for each mode (CoreBurnZ boards use a `z:` prefix).

## Account level, cosmetics, arena skins
- You earn XP in every mode: 10 per wave, 0.5 per kill and 60 per boss, with 10% extra in CoreBurnZ and in co-op. It is saved on the device (`coreburn-progress`). The game-over screen shows the XP you got and anything you unlocked.
- Each level from 2 to 25 unlocks one cosmetic for a hero (hat, mask, cape, aura, trail, banner). Open them from **COSMETICS** on the menu or from hero select.
- Arena skins: each of the 4 heroes has one skin per arena (20 in total). The setting has three options: on by default in CoreBurnZ, ALWAYS or OFF. Skins are solo-only, because co-op uses its own duplicate tints.
- Balance: `node scripts/sim-ttk.mjs --z` models the tougher Z bosses.

### Co-op looks (v1.13.0)
- Each player's equipped cosmetics, arena-skin setting and scrap-shop colour are sent when they join, when they change hero, and whenever they change them (also mid-game). Everyone sees everyone's look, including arena skins, which now work in co-op too.
- If two players pick the same hero, the second one gets a coloured ring on the floor and a matching name tag. Their body is no longer recoloured.
- Arena skins now change more than the colours: armour gets a tint and an inner glow, plus themed pieces for each arena (scrap plates, molten seams, ice shards, neon trim with a halo, a lightning rod with sparks). These are only a few extra boxes, with no lights or textures, so they stay cheap on phones.

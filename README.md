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
| Talon slash (3-hit combo) | J or left-click (hold to keep slashing) | SLASH button (hold to keep slashing) |
| Blink dash (untouchable, hurts enemies you pass, dodges bolts) | K or Space | BLINK button |
| Overdrive spin (8 s cooldown, half damage taken) | L | OVERDRIVE button |
| Start | Enter / J / START | START button |
| Restart after game over | any key or click | tap anywhere |
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

```
index.html         Page layout: HUD, boss bar, touch buttons, title/game-over screens, Three.js import map
style.css          All the styling (HUD, buttons, joystick, cooldown pies, mobile tweaks)
js/main.js         Starting point: renderer, camera, lights, game loop, score, start/game over, resizing
js/player.js       Sarrow: blocky model, movement, talon combo, blink, overdrive, core recharge
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

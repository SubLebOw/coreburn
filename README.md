# COREBURN — Endless Arena Brawler

> *The Grindchoir melts down anything with a pulse to feed its machine hymn. Sarrow, a scavenger with a stolen
> reactor core burning in his chest, has decided the song ends here.*

An original 3D isometric arena brawler that runs in any browser (PC or phone) with nothing to install.
Play as **Sarrow** and carve through endless waves of the **Grindchoir**, a machine cult of scrap-built drones,
with a boss fight every 5 waves. How far can you get?

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

### Bosses (every 5th wave, rotating, tougher each time)

1. **The Furnace Deacon** (waves 5, 20, 35...): a furnace-bellied brute. Telegraphed **charges** (red strip on the floor;
   if it smashes into the fence it's dazed), **ground slams** (red circle fills up, then boom), and **summons** acolytes and hounds.
2. **Choirmother** (waves 10, 25, 40...): a floating bell-masked priestess. **Bolt bursts** in every direction, **marked slams**
   (circles drop on and around you), summons **mites and spitters**, and the occasional charge.
3. **Rivetjaw** (waves 15, 30, 45...): a giant scrap crab that's mostly jaw. **Triple charges**, aimed **bolt volleys**,
   slams, and summons **bulwarks**.

Beating a boss: **+60 health, +500 x boss number points**, and every minion it summoned crumbles.

### Endless scaling (wave n)

- Enemies per wave: `4 + 2n` (no limit). Max on screen at once: `min(6 + n, 14)`, capped so phones stay smooth.
  Later waves get harder through stats and elites instead of more bodies.
- Enemy health `x (1 + 0.14(n-1))`, damage `x (1 + 0.07(n-1))`: both grow forever.
- Enemy speed `x (1 + min(0.5, 0.025(n-1)))`: tops out at +50% so it stays dodgeable.
- Elite chance: `min(50%, 4% per wave after wave 5)`.
- Bosses: health `x (1 + 0.45 per previous boss)`; after each full loop of all 3 bosses their wind-ups get 12% faster
  (down to 60%), slams get bigger, and they fire and summon more.

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
js/boss.js         The three bosses and their telegraphed attack patterns
js/waves.js        Endless wave manager and all the difficulty scaling numbers
js/projectiles.js  Slow glowing bolts fired by spitters and bosses
js/arena.js        The Slag Yard: floor, fence, smokestacks, scrap heaps, barrels, collision
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
- `js/enemy.js`: `ENEMY_TYPES`; `js/boss.js`: `BOSSES`
- Browser console (only when running locally on http://localhost, not on the live site or app): `game.player.hp = 1000` (god mode while testing), `game.skipTo(10)` (jump to a wave)

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

# Developer / testing build

**Bookmark:** https://fatalbananas7.github.io/coreburn-dev/ (no `?dev=1` needed; a pink `DEV BUILD <version>` tag shows bottom-left, the version reads `x.y.z-dev.<commit>`).

The public game (https://sublebow.github.io/coreburn/) and the Android app contain **no** dev code: no dev files and no dev loader. `?dev=1`, `#dev` and localStorage flags do nothing there.

## What's in it
The same game as the commit it was built from, plus the dev panel (DEV button, bottom-left): start any hero, card/evolution/Mythic grants, build presets, wave jump, arena jump, events incl. Containment Shift, enemy spawner, 12-boss picker, remove bosses, god/heal. There's also the 5C enemy/affix inspector (5C button, top-right), `window.cbDev` and `window.__dev` in the console. The panel scrolls on touch.

## Saves
- It's a different web origin, so it never sees or changes your real profile on the live site, and the live site never sees dev saves.
- Dev-boot also sandboxes storage per tab (sessionStorage), so each tab starts from the dev site's profile and the tab's changes are thrown away on close. "Reset sandbox" is in the panel.
- Dev runs never submit online scores.
- Co-op only joins other dev builds (the version is different).

## Republish (after changing the game)
```
cd coreburn            # this repo, on the commit you want to test (main or a branch)
node scripts/publish-dev.mjs            # clones/pulls ../coreburn-dev, rebuilds, commits, pushes
# Pages updates in ~1 minute. Test locally first:  node scripts/publish-dev.mjs --no-push
#   then  cd ../coreburn-dev && python3 -m http.server 8013  ->  http://localhost:8013/
```
Needs push access to `fatalbananas7/coreburn-dev` (gh / git credentials). The dev-only source files live **only** in that repo's `devtools/` folder; edit them there and commit, then republish. If a game refactor moves one of the hook points (`r.tainted = LOCAL_DEV;`, `window.__cbReady = true;`, `<script type="importmap">`), the script stops with a clear error.

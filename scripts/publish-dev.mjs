// scripts/publish-dev.mjs - builds and publishes the DEVELOPER BUILD (dev panel always on) to its own repo/site:
//   https://github.com/fatalbananas7/coreburn-dev  ->  https://fatalbananas7.github.io/coreburn-dev/
// The dev-only files (dev-boot, dev-tools, inspector, harness hooks) live ONLY in that repo's devtools/ folder,
// never in this repo, so the public game (sublebow.github.io/coreburn) and the Android app can't load them.
// Not part of the web build (build-web.mjs only ships index.html, style.css, privacy.html, js, vendor).
//
//   node scripts/publish-dev.mjs            build from the current checkout + push the dev site
//   node scripts/publish-dev.mjs --no-push  build only (into ../coreburn-dev) to test locally
// Env: DEV_REPO (default fatalbananas7/coreburn-dev), DEV_DIR (default ../coreburn-dev). See DEV_BUILD.md.
import { cpSync, rmSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO = process.env.DEV_REPO || 'fatalbananas7/coreburn-dev';
const DIR = resolve(process.env.DEV_DIR || '../coreburn-dev');
const push = !process.argv.includes('--no-push');
const sh = (c, cwd = DIR) => execSync(c, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const SRC = process.cwd();

if (!existsSync(`${DIR}/.git`)) execSync(`git clone https://github.com/${REPO}.git "${DIR}"`, { stdio: 'inherit' });
else if (push) sh('git pull -q --ff-only');
if (!existsSync(`${DIR}/devtools/dev-boot.js`)) throw new Error(`${DIR}/devtools/ is missing the dev-only files`);

// 1. fresh copy of the game (same file list + filters as scripts/build-web.mjs)
for (const f of readdirSync(DIR)) if (!['.git', 'devtools', 'README.md'].includes(f)) rmSync(`${DIR}/${f}`, { recursive: true, force: true });
for (const f of ['index.html', 'style.css', 'privacy.html', 'js', 'vendor'])
  cpSync(`${SRC}/${f}`, `${DIR}/${f}`, { recursive: true, filter: (s) => !s.endsWith('.local.js') && !/[\\/]dev-[^\\/]*\.js$/.test(s) });
for (const f of readdirSync(`${DIR}/devtools`)) if (f.endsWith('.js')) cpSync(`${DIR}/devtools/${f}`, `${DIR}/js/${f}`);

// 2. version: clearly a dev build (also keeps dev co-op sessions from joining live players)
const sha = sh('git rev-parse --short HEAD', SRC) + (sh('git status --porcelain -- js index.html style.css', SRC) ? '-dirty' : '');
const base = readFileSync(`${DIR}/js/version.js`, 'utf8').match(/GAME_VERSION\s*=\s*'([^']+)'/)[1];
const ver = `${base}-dev.${sha}`;
const must = (s, a, b, what) => { if (!s.includes(a)) throw new Error(`publish-dev: hook point not found (${what}) - update scripts/publish-dev.mjs`); return s.replace(a, b); };
writeFileSync(`${DIR}/js/version.js`, must(readFileSync(`${DIR}/js/version.js`, 'utf8'), `'${base}'`, `'${ver}'`, 'version'));

// 3. hooks: index.html loads dev-boot first (sandboxed storage + badge); main.js loads the panels
let html = readFileSync(`${DIR}/index.html`, 'utf8');
html = must(html, '<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <meta name="robots" content="noindex, nofollow">', 'meta charset');
html = must(html, '<script type="importmap">', `<script>window.__CB_DEV_BUILD = '${ver}';</script>\n  <script src="js/dev-boot.js?v=${ver}"></script>\n  <script type="importmap">`, 'importmap');
html = html.replace(/<title>([^<]*)<\/title>/, '<title>[DEV] $1</title>');
writeFileSync(`${DIR}/index.html`, html);
let main = readFileSync(`${DIR}/js/main.js`, 'utf8');
main = must(main, 'r.tainted = LOCAL_DEV;', 'r.tainted = LOCAL_DEV || !!window.__CB_DEV; // dev build: never submit', 'tainted');
main = must(main, 'window.__cbReady = true;', `// ---- DEVELOPER BUILD hooks (injected by scripts/publish-dev.mjs) ----
const __devCtx = { renderer, scene, showcase, player, enemies, world, progress, allies, arena, powerups, projectiles, effects, hud, sound, ads, events, startGame, snapCamera: () => updateCamera(0, true), getScore: () => score, combo, meta, twitch, input, getState: () => state, getLastRun: () => lastRun, getMode: () => mode, setMode: (m) => { mode = m; }, getRun: () => run, getTransition: () => transition, bursts, openPicker: () => { normalPick = true; openUpgradePicker(); } };
if (window.__CB_DEV && !IS_NATIVE) {
  import('./dev-harness.js').then((m) => m.install(__devCtx)).catch(() => {});
  import('./dev-5c-inspector.js').then((m) => m.install(__devCtx)).catch((e) => console.warn('dev inspector', e));
  import('./dev-tools.js').then((m) => m.install(__devCtx)).catch((e) => console.warn('dev tools', e));
}
window.__cbReady = true;`, 'cbReady');
writeFileSync(`${DIR}/js/main.js`, main);

// 4. cache-bust every module with the dev version, robots, no jekyll
execSync(`node "${SRC}/scripts/bust.mjs"`, { cwd: DIR, stdio: 'inherit', env: { ...process.env, BUST: ver } });
writeFileSync(`${DIR}/robots.txt`, 'User-agent: *\nDisallow: /\n');
writeFileSync(`${DIR}/.nojekyll`, '');
console.log(`dev build ${ver} written to ${DIR}`);

if (push) {
  sh('git add -A');
  if (sh('git status --porcelain')) { sh(`git commit -qm "Dev build ${ver}"`); sh('git push -q origin HEAD'); console.log('pushed; Pages updates in ~1 min: https://' + REPO.split('/')[0] + '.github.io/' + REPO.split('/')[1] + '/'); }
  else console.log('nothing changed');
}

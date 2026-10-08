// scripts/make-update.mjs
// Packages the current game as a live update for Android players.
//
//   1. Bump GAME_VERSION in js/version.js (e.g. 1.0.0 -> 1.0.1)
//   2. npm run release:update
//   3. Commit and push. GitHub Pages then serves updates/latest.json + the zip,
//      and Android players get the new version the next time they open the app.
//
// Set MIN_NATIVE_BUILD below if an update needs a newer Android app (for example after
// adding a plugin): older installs will then skip it until they update from the Play Store.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import AdmZip from 'adm-zip';

const MIN_NATIVE_BUILD = 1; // android versionCode required for this update
const SITE = 'https://sublebow.github.io/coreburn';

const version = readFileSync('js/version.js', 'utf8').match(/GAME_VERSION\s*=\s*'([^']+)'/)[1];
execSync('node scripts/build-web.mjs', { stdio: 'inherit' });

mkdirSync('updates', { recursive: true });
for (const f of readdirSync('updates')) if (f.endsWith('.zip')) rmSync(`updates/${f}`); // keep only the newest zip

const zip = new AdmZip();
zip.addLocalFolder('dist');
const name = `coreburn-${version}.zip`;
zip.writeZip(`updates/${name}`);
const checksum = createHash('sha256').update(readFileSync(`updates/${name}`)).digest('hex');

const latest = { version, url: `${SITE}/updates/${name}`, checksum, minNativeBuild: MIN_NATIVE_BUILD };
writeFileSync('updates/latest.json', JSON.stringify(latest, null, 2) + '\n');
console.log('Wrote updates/latest.json:', latest);

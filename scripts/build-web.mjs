// scripts/build-web.mjs
// Copies the game files into dist/ - the folder that gets bundled inside the Android app
// (and zipped for live updates). The website itself is served straight from the repo root
// by GitHub Pages, so you don't need to run this for the web version.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = ['index.html', 'style.css', 'privacy.html', 'js', 'vendor'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const f of FILES) cpSync(f, `dist/${f}`, { recursive: true });
console.log('Built dist/ with:', FILES.join(', '));

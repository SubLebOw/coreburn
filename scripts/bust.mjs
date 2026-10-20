// scripts/bust.mjs - appends ?v=<GAME_VERSION> to every relative JS import and to the
// main.js / style.css tags in index.html, so browsers never mix cached old modules with new ones.
// Runs automatically from release:update. Idempotent (replaces any existing ?v=).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const v = readFileSync('js/version.js', 'utf8').match(/GAME_VERSION\s*=\s*'([^']+)'/)[1];
const q = (p) => `${p.replace(/\?v=[^'"]*$/, '')}?v=${v}`;
let n = 0;
for (const f of readdirSync('js')) {
  if (!f.endsWith('.js')) continue;
  const path = `js/${f}`, src = readFileSync(path, 'utf8');
  const out = src
    .replace(/(\bfrom\s*)(['"])(\.\.?\/[^'"]+?\.js(?:\?v=[^'"]*)?)\2/g, (_, a, s, p) => `${a}${s}${q(p)}${s}`)
    .replace(/(\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+?\.js(?:\?v=[^'"]*)?)\2/g, (_, a, s, p) => `${a}${s}${q(p)}${s}`)
    .replace(/(^\s*import\s*)(['"])(\.\.?\/[^'"]+?\.js(?:\?v=[^'"]*)?)\2/gm, (_, a, s, p) => `${a}${s}${q(p)}${s}`);
  if (out !== src) { writeFileSync(path, out); n++; }
}
let html = readFileSync('index.html', 'utf8');
html = html.replace(/src="js\/main\.js(?:\?v=[^"]*)?"/, `src="js/main.js?v=${v}"`)
           .replace(/href="style\.css(?:\?v=[^"]*)?"/, `href="style.css?v=${v}"`);
writeFileSync('index.html', html);
console.log(`bust: v=${v}, ${n} js files updated`);

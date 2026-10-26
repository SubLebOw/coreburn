// dev-5c-inspector.js - DEVELOPMENT ONLY (Phase 5C enemy inspector). Loaded by main.js only when the
// index.html gate ran js/dev-boot.js (?dev=1 on raw.githack.com or http://localhost) and never in the
// Android app. Excluded from the production build (scripts/build-web.mjs skips js/dev-*.js); the game
// boots normally without it. Storage is the dev-boot sandbox, so nothing here can touch the real profile.
import * as THREE from 'three';
import { ENEMY_TYPES, setEnemyLOD } from './enemy.js?v=1.33.0-p5c3';
import { AFFIXES, applyAffixStats } from './affixes.js?v=1.33.0-p5c3';
import { rotation } from './bosses.js?v=1.33.0-p5c3';

export function install(ctx) {
  const { enemies, player, startGame, getState } = ctx;
  let elite = false, mask = 0;
  const css = `#p5c{position:fixed;right:6px;top:6px;z-index:99999;width:230px;max-height:calc(100vh - 12px);overflow-y:auto;-webkit-overflow-scrolling:touch;
    touch-action:pan-y;background:#101418ee;color:#dde;font:12px system-ui,sans-serif;border:1px solid #3ff6e0;border-radius:8px;padding:6px}
    #p5c.min{width:auto;max-height:none}#p5c.min .b{display:none}#p5c h4{margin:6px 0 3px;color:#3ff6e0;font-size:11px;letter-spacing:.05em}
    #p5c button{margin:2px;padding:7px 8px;min-height:32px;background:#222a30;color:#eee;border:1px solid #445;border-radius:5px;font:inherit}
    #p5c button.on{background:#3ff6e0;color:#000}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'p5c';
  el.innerHTML = `<button data-a="min">5C ▾</button><div class="b"><h4>SPAWN ENEMY (near hero)</h4><div id="p5cT"></div>
    <h4>FORM</h4><button data-a="elite">elite</button><h4>AFFIXES (wave 50+ only in real runs)</h4><div id="p5cA"></div>
    <h4>CROWD / LOD</h4><button data-a="x10">10 mixed</button><button data-a="clear">clear adds</button><br>
    <button data-a="lod" data-v="auto" class="on">LOD auto</button><button data-a="lod" data-v="hi">hi</button><button data-a="lod" data-v="lo">lo</button>
    <h4>BOSSES (tap one of the 12)</h4><button data-a="bmode" data-v="jump" class="on">jump to its wave</button><button data-a="bmode" data-v="here">spawn here</button><div id="p5cB"></div><button data-a="bclear">remove bosses</button><div style="opacity:.6">sandboxed storage · runs are never submitted</div></div>`;
  document.body.appendChild(el); if (innerHeight < 500) el.classList.add('min'); // phones: start folded so it doesn't cover the controls
  el.addEventListener('pointerdown', (ev) => ev.stopPropagation()); el.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: true });
  const T = el.querySelector('#p5cT'), A = el.querySelector('#p5cA');
  const B = el.querySelector('#p5cB'); let bmode = 'jump';
  rotation().forEach((r, i) => B.insertAdjacentHTML('beforeend', `<button data-a="bpick" data-v="${i}" title="wave ${(i + 1) * 5}">${(i + 1) * 5}·${(r.def.name || '').replace(/^THE /, '').split(' ')[0].toLowerCase()}</button>`));
  for (const t of Object.keys(ENEMY_TYPES)) T.insertAdjacentHTML('beforeend', `<button data-a="spawn" data-v="${t}">${t}</button>`);
  AFFIXES.forEach((a, i) => A.insertAdjacentHTML('beforeend', `<button data-a="affix" data-v="${i}">${a.id}</button>`));
  const ensure = () => { if (getState() === 'title' || getState() === 'select' || getState() === 'gameover') startGame(); };
  const spawn = (t, k = 0) => {
    ensure();
    const a = (k * 2.4 + Math.random()) , r = 4 + (k % 3);
    const p = player.position.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    const e = enemies.spawnAt(t, p, true, t !== 'mite' && elite);
    if (e && mask && t !== 'mite' && !e.affixMask) applyAffixStats(e, mask); // inspector-chosen affixes (skipped if the wave already rolled some)
    return e;
  };
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const a = b.dataset.a, v = b.dataset.v;
    if (a === 'min') el.classList.toggle('min');
    if (a === 'spawn') spawn(v);
    if (a === 'elite') { elite = !elite; b.classList.toggle('on', elite); }
    if (a === 'affix') { mask ^= 1 << +v; b.classList.toggle('on', !!(mask & (1 << +v))); }
    if (a === 'x10') { const ts = Object.keys(ENEMY_TYPES); for (let i = 0; i < 10; i++) spawn(ts[i % ts.length], i); }
    if (a === 'clear') enemies.killAllAdds?.();
    if (a === 'lod') { setEnemyLOD(v); el.querySelectorAll('[data-a=lod]').forEach((x) => x.classList.toggle('on', x === b)); }
    if (a === 'bmode') { bmode = v; el.querySelectorAll('[data-a=bmode]').forEach((x) => x.classList.toggle('on', x === b)); }
    if (a === 'bpick') pickBoss(+v, bmode);
    if (a === 'bclear') clearBosses();
  });
  // remove live bosses without a kill (no rewards, no tracking): dev only
  const clearBosses = () => { for (const e of enemies.list) if (e.isBoss && !e.dead) { e.onDeath?.(); e.dead = true; e.state = 'dead'; e.remove = true; } };
  const pickBoss = (i, mode) => {
    ensure();
    const rot = rotation(), lap = Math.floor(Math.max(0, (enemies.bossNumber || 1) - 1) / rot.length);
    clearBosses(); enemies.killAllAdds?.();
    if (mode === 'jump') { enemies.startWave((lap * rot.length + i + 1) * 5); return; } // the real boss wave: banner, timer, phases, rewards
    enemies.bossEntry = rot[i]; enemies.bossDef = rot[i].def; enemies.bossNumber = lap * rot.length + i + 1; enemies.bossTier = lap;
    enemies.spawnBoss();
  };
  window.__p5c = { spawn, pickBoss, clearBosses, setElite: (x) => { elite = x; }, setMask: (m) => { mask = m; } };
}

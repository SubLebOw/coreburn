// mastery.js: COREBURNZ HERO MASTERIES. A small skill tree per hero, paid for with hero levels.
//   Points: 2 for every 5 hero levels (rounded down), so 12 points at level 30 = every node.
//   3 rows of 2 nodes. Row 1 nodes cost 1, row 2 cost 2, row 3 cost 3, and a row opens once you own a node in the row above.
//   Respec is free (RESET button). Saved in this browser; in co-op each friend's tree is sent to the host.
export const MASTERY_COST = [1, 2, 3];
export const masteryPoints = (level) => Math.min(12, Math.floor(level * 0.4));

// row, name, desc. Effects live in upgrades.js recompute() (stats) and player.js (ability changes: flags on stats.m)
export const MASTERIES = {
  sarrow: [
    { id: 'sLong', row: 0, name: 'Long Blink', desc: 'Blink travels 20% further' },
    { id: 'sKeen', row: 0, name: 'Keen Talons', desc: '+6% damage' },
    { id: 'sAfter', row: 1, name: 'Afterimage', desc: 'Blink leaves an afterimage that explodes 0.6s later' },
    { id: 'sPull', row: 1, name: 'Overdrive Pull', desc: 'Overdrive drags enemies in instead of knocking them away' },
    { id: 'sDouble', row: 2, name: 'Double Blink', desc: '+1 Blink charge' },
    { id: 'sHeal', row: 2, name: 'Overdrive Mend', desc: 'Overdrive heals 15% of your max health' },
  ],
  zaleks: [
    { id: 'zPlate', row: 0, name: 'Iron Plating', desc: 'Take 6% less damage' },
    { id: 'zHeavy', row: 0, name: 'Heavy Hammer', desc: '+10% hammer damage' },
    { id: 'zDouble', row: 1, name: 'Double Charge', desc: '+1 Shoulder Charge charge' },
    { id: 'zAfter', row: 1, name: 'Aftershock', desc: 'Seismic Slam hits again 0.7s later for 60%' },
    { id: 'zBastion', row: 2, name: 'Bastion', desc: 'Slam shield is 40% stronger' },
    { id: 'zRampage', row: 2, name: 'Rampage', desc: 'Charge hits 30% harder and stuns 0.5s longer' },
  ],
  iskra: [
    { id: 'iSharp', row: 0, name: 'Sharp Needles', desc: '+6% damage' },
    { id: 'iFar', row: 0, name: 'Far Hop', desc: 'Phase Hop goes 20% further' },
    { id: 'iTwin', row: 1, name: 'Twin Decoy', desc: 'Phase Hop leaves two decoys' },
    { id: 'iLord', row: 1, name: 'Storm Lord', desc: '+2 needles per Needle Storm volley' },
    { id: 'iGuard', row: 2, name: 'Phase Guard', desc: 'Untouchable twice as long after a hop' },
    { id: 'iExtra', row: 2, name: 'Extra Phase', desc: '+1 Phase Hop charge' },
  ],
  orin: [
    { id: 'oLong', row: 0, name: 'Long Tether', desc: 'Arc Tether reaches 15% further' },
    { id: 'oOver', row: 0, name: 'Overcharge', desc: '+6% damage' },
    { id: 'oChainG', row: 1, name: 'Collapse', desc: 'Your Gravity Well detonates when it ends, stunning what it held' },
    { id: 'oBloom', row: 1, name: 'Vortex Bloom', desc: 'Hymn vortex 25% bigger' },
    { id: 'oChoir', row: 2, name: 'Drone Choir', desc: '+1 drone' },
    { id: 'oShell', row: 2, name: 'Magnet Shell', desc: 'Take 10% less damage while drones fly' },
  ],
  axiom: [
    { id: 'aNet', row: 0, name: 'Network Efficiency', desc: 'Start each run with 2 drones instead of 1' },
    { id: 'aBolt', row: 0, name: 'Focused Pulse', desc: '+6% damage' },
    { id: 'aRep', row: 1, name: 'Perfect Replication', desc: 'Reforge has a 20% chance to build an extra drone' },
    { id: 'aRange', row: 1, name: 'Long Optics', desc: 'Drones reach 20% further' },
    { id: 'aUpload', row: 2, name: 'Emergency Upload', desc: 'Once per run: lethal damage with 3+ drones blows up your body and rebuilds you from 3 drones at 20% health (not vs Sister Klaxon)' },
    { id: 'aAscend', row: 2, name: 'Prolonged Ascension', desc: 'Ascension Protocol lasts 2s longer' },
  ],
  ninja: [
    { id: 'nSharp', row: 0, name: 'Sharp Stars', desc: '+6% damage' },
    { id: 'nLong', row: 0, name: 'Long Shadow', desc: 'Shadow Step reaches 15% further' },
    { id: 'nDecoy', row: 1, name: 'Shadow Decoy', desc: 'Shadow Step leaves a decoy where you stood' },
    { id: 'nFanM', row: 1, name: 'Wide Fan', desc: '+1 star per throw' },
    { id: 'nDouble', row: 2, name: 'Double Step', desc: '+1 Shadow Step charge' },
    { id: 'nClone', row: 2, name: 'Clone Mastery', desc: 'Shadow Clone lasts 2s longer and hits 10% harder' },
  ],
};

const KEY = 'coreburnz-mastery';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

// keep only nodes that belong to this hero, respect row gating and the point budget
export function cleanMastery(hero, ids, points = 12) {
  const tree = MASTERIES[hero] || [];
  const out = []; let spent = 0;
  for (const row of [0, 1, 2]) for (const n of tree) {
    if (n.row !== row || !Array.isArray(ids) || !ids.includes(n.id)) continue;
    if (row > 0 && !out.some((o) => tree.find((t) => t.id === o).row === row - 1)) continue;
    if (spent + MASTERY_COST[row] > points) continue;
    spent += MASTERY_COST[row]; out.push(n.id);
  }
  return out;
}
export const spentOn = (hero, ids) => ids.reduce((s, id) => s + MASTERY_COST[(MASTERIES[hero] || []).find((n) => n.id === id)?.row ?? 0], 0);
export function getMastery(hero, level) { return cleanMastery(hero, load()[hero] || [], masteryPoints(level)); }
export function setMastery(hero, ids) { const d = load(); d[hero] = ids; localStorage.setItem(KEY, JSON.stringify(d)); }
export function allMastery(levelOf) { const o = {}; for (const h of Object.keys(MASTERIES)) o[h] = getMastery(h, levelOf(h)); return o; }

// the tree panel (opened from the hero cards)
export function openMasteryPanel(hero, heroName, color, level, onClose) {
  let ids = getMastery(hero, level);
  const pts = masteryPoints(level), tree = MASTERIES[hero];
  const el = document.createElement('div');
  el.id = 'mastery-panel';
  document.body.appendChild(el); document.body.classList.add('mastery-open');
  el.style.setProperty('--c', color);
  const close = () => { el.remove(); document.body.classList.remove('mastery-open'); window.removeEventListener('keydown', key, true); onClose?.(); };
  const key = (e) => { if (e.code === 'Escape') close(); e.stopPropagation(); };
  window.addEventListener('keydown', key, true);
  for (const t of ['pointerdown', 'click', 'touchstart']) el.addEventListener(t, (e) => e.stopPropagation());
  const draw = () => {
    const left = pts - spentOn(hero, ids);
    el.innerHTML = `<div class="mbox"><div class="mhead"><small>HERO MASTERY</small><b></b><span>HERO LV ${level} · <em>${left}</em> / ${pts} points left</span></div><div class="mrows"></div>
      <div class="mfoot"><button class="mreset">↺ RESET (free)</button><button class="mdone">DONE</button></div><p class="mhint">Points: 2 per 5 hero levels · rows cost 1 / 2 / 3 · a row opens when you own a node above it</p></div>`;
    el.querySelector('.mhead b').textContent = heroName;
    const rows = el.querySelector('.mrows');
    for (const row of [0, 1, 2]) {
      const r = document.createElement('div'); r.className = 'mrow';
      r.innerHTML = `<div class="mcost">${MASTERY_COST[row]}<small>pt${row ? 's' : ''}</small></div>`;
      for (const n of tree.filter((t) => t.row === row)) {
        const owned = ids.includes(n.id);
        const open = row === 0 || ids.some((id) => tree.find((t) => t.id === id).row === row - 1);
        const can = !owned && open && left >= MASTERY_COST[row];
        const b = document.createElement('button');
        b.className = 'mnode' + (owned ? ' owned' : can ? ' can' : ' locked');
        b.dataset.id = n.id;
        b.innerHTML = '<b></b><i></i>';
        b.querySelector('b').textContent = (owned ? '✓ ' : '') + n.name; b.querySelector('i').textContent = n.desc;
        b.addEventListener('click', () => {
          if (owned) ids = cleanMastery(hero, ids.filter((x) => x !== n.id), pts); // un-learn (and anything that depended on it)
          else if (can) ids = cleanMastery(hero, [...ids, n.id], pts);
          else return;
          setMastery(hero, ids); draw();
        });
        r.appendChild(b);
      }
      rows.appendChild(r);
    }
    el.querySelector('.mreset').addEventListener('click', () => { ids = []; setMastery(hero, ids); draw(); });
    el.querySelector('.mdone').addEventListener('click', close);
  };
  draw();
  return { close };
}

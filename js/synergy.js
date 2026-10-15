// synergy.js: COREBURNZ CO-OP HERO SYNERGIES. When certain heroes play together, EVERY hero on the team
// gets the pair's bonus (several pairs stack in 3-4 player games). The host decides and tells friends.
// Every hero pair is covered (10 mixed pairs) and two of the same hero get KINDRED.
export const SYNERGIES = [
  { pair: ['sarrow', 'zaleks'], name: 'Vanguard', desc: '+8% damage, take 8% less damage' },
  { pair: ['sarrow', 'iskra'], name: 'Blink Storm', desc: 'mobility cooldown -12%' },
  { pair: ['sarrow', 'orin'], name: 'Live Wire', desc: '+10% Storm chain chance' },
  { pair: ['sarrow', 'ninja'], name: 'Twin Shadows', desc: '+6% crit chance' },
  { pair: ['zaleks', 'iskra'], name: 'Bait & Bulwark', desc: '+10% max health' },
  { pair: ['zaleks', 'orin'], name: 'Iron Choir', desc: 'ultimate cooldown -12%' },
  { pair: ['zaleks', 'ninja'], name: 'Hammer & Star', desc: '+12% ultimate damage' },
  { pair: ['iskra', 'orin'], name: 'Arc Dancers', desc: '+8% move speed' },
  { pair: ['iskra', 'ninja'], name: 'Phantom Pair', desc: '+0.5 lifesteal per hit' },
  { pair: ['orin', 'ninja'], name: 'Hive Shadows', desc: '+10% damage' },
  { pair: 'same', name: 'Kindred', desc: '+5% damage and +5% max health' },
];

// the synergies a team of heroes (char ids) unlocks
export function synergiesFor(chars) {
  const out = [];
  for (const s of SYNERGIES) {
    if (s.pair === 'same') { if (chars.some((c, i) => chars.indexOf(c) !== i)) out.push(s.name); }
    else if (chars.includes(s.pair[0]) && chars.includes(s.pair[1])) out.push(s.name);
  }
  return out;
}

// applied in upgrades.js recompute()
export function applySynergies(s, names) {
  const H = (n) => names.includes(n);
  if (H('Vanguard')) { s.dmg *= 1.08; s.hurtMult *= 0.92; }
  if (H('Blink Storm')) s.dashCd *= 0.88;
  if (H('Live Wire')) s.storm += 0.1;
  if (H('Twin Shadows')) s.crit += 0.06;
  if (H('Bait & Bulwark')) s.maxHpPct += 0.1;
  if (H('Iron Choir')) s.spinCd *= 0.88;
  if (H('Hammer & Star')) s.spinDmg *= 1.12;
  if (H('Arc Dancers')) s.speed *= 1.08;
  if (H('Phantom Pair')) s.leech += 0.5;
  if (H('Hive Shadows')) s.dmg *= 1.1;
  if (H('Kindred')) { s.dmg *= 1.05; s.maxHpPct += 0.05; }
}

// the gold SYNERGY popup (host and friends)
export function showSynergyPopup(names) {
  if (!names?.length) return;
  document.getElementById('synergy-pop')?.remove();
  const el = document.createElement('div');
  el.id = 'synergy-pop';
  el.innerHTML = '<small>SYNERGY</small>';
  for (const n of names) {
    const s = SYNERGIES.find((x) => x.name === n); if (!s) continue;
    const r = document.createElement('div'); r.innerHTML = '<b></b><span></span>';
    r.querySelector('b').textContent = s.name; r.querySelector('span').textContent = s.desc;
    el.appendChild(r);
  }
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 4500);
  setTimeout(() => el.remove(), 5200);
}

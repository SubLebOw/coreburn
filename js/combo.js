// combo.js
// The COMBO multiplier. Every talon hit adds +1 and every kill adds +1 more.
// Land nothing for 3 seconds and the combo drops to 0. Getting hurt halves it.
// The score multiplier steps up as the combo grows, with each step further away than
// the last (diminishing returns). It applies to kill, boss and wave-clear points.
//
//   combo:  0   10   25   50   100   175   275   400
//   score:  x1  x2   x3   x4   x5    x6    x7    x8
export const COMBO_STEPS = [0, 10, 25, 50, 100, 175, 275, 400];
export const COMBO_CALLOUTS = { 10: 'NICE', 25: 'SAVAGE', 50: 'BRUTAL', 100: 'UNSTOPPABLE', 175: 'GODLIKE', 275: 'MELTDOWN', 400: 'COREBURN!' };
export const COMBO_WINDOW = 3; // seconds without a hit before the combo drops

export function comboMult(count) {
  let m = 1;
  for (let i = 1; i < COMBO_STEPS.length; i++) if (count >= COMBO_STEPS[i]) m = i + 1;
  return m;
}

export class Combo {
  constructor() { this.reset(); }
  reset() { this.count = 0; this.timer = 0; this.best = 0; this.mult = 1; this.events = []; }
  add(n = 1) {
    const before = this.count;
    this.count += n;
    this.timer = COMBO_WINDOW;
    this.best = Math.max(this.best, this.count);
    const m = comboMult(this.count);
    if (m > this.mult) this.events.push({ type: 'tierUp', mult: m });
    this.mult = m;
    for (const k of Object.keys(COMBO_CALLOUTS)) if (before < +k && this.count >= +k) this.events.push({ type: 'callout', text: COMBO_CALLOUTS[k] });
  }
  hurt() { // taking damage halves the combo (dropping it fully felt too harsh)
    if (this.count === 0) return;
    this.count = Math.floor(this.count / 2);
    this.mult = comboMult(this.count);
    this.events.push({ type: 'hurt' });
  }
  update(dt) {
    if (this.count === 0) return;
    this.timer -= dt;
    if (this.timer <= 0) { this.count = 0; this.mult = 1; this.events.push({ type: 'drop' }); }
  }
  get fraction() { return this.count ? Math.max(0, this.timer / COMBO_WINDOW) : 0; }
}

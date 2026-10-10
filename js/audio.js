// audio.js
// All of COREBURN's sound effects and music are generated live with the Web Audio API.
// There are no audio files at all: every sound is built from oscillators (beeps/buzzes)
// and filtered noise (whooshes/crunches). That means no licensing worries, and tiny downloads.
//
// Browsers (especially phones) only allow sound after the player taps or presses a key,
// so main.js calls sound.unlock() on the first tap/click/key press.
// If audio is blocked or unsupported, every function here quietly does nothing.

const MUTE_KEY = 'coreburn-muted';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
    this.lastPlayed = {};   // for throttling sounds that can fire many times per frame
    this.intensity = 0;     // music: 0 = menu, 1 = fighting, 2 = boss
    this.musicStarted = false;
    this.musicPitch = 1;    // < 1 during SLOW-MO: the music drops in pitch and slows down
    this.musicTempo = 1;
  }

  // ---------- Setup ----------

  // Create the audio system (must happen during a user gesture on mobile)
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const ctx = this.ctx;
        // master volume -> gentle compressor (stops loud moments from clipping) -> speakers
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        const comp = ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.7;
        this.sfxBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = 0.3;
        // music -> lowpass filter (closes during SLOW-MO for a muffled, underwater feel) -> master
        this.musicFilter = ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = 18000;
        this.musicBus.connect(this.musicFilter).connect(this.master);
        // one second of white noise we can reuse for every noisy sound
        this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        // pause audio when the app/tab is hidden (saves battery, required behaviour on Android)
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) this.ctx.suspend().catch(() => {});
          else this.ctx.resume().catch(() => {});
        });
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      if (!this.musicStarted) this.startMusic();
    } catch (err) {
      console.info('[sound] audio unavailable:', err && err.message);
      this.ctx = null;
    }
  }

  get ready() { return !!this.ctx && this.ctx.state === 'running'; }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  // SLOW-MO: drop the music's pitch and tempo and muffle it (and the reverse)
  setSlowmo(on) {
    this.musicPitch = on ? 0.7 : 1;
    this.musicTempo = on ? 0.7 : 1;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(on ? 1100 : 18000, this.ctx.currentTime, 0.15);
  }

  // Play a named sound effect, e.g. sound.play('slash', 2)
  play(name, option) {
    if (!this.ready || this.muted) return;
    const fn = SFX[name];
    if (!fn) return;
    // throttle: the same sound at most once every `gap` seconds
    const now = this.ctx.currentTime;
    const gap = THROTTLE[name] || 0.02;
    if (now - (this.lastPlayed[name] || -1) < gap) return;
    this.lastPlayed[name] = now;
    try { fn(this, now, option); } catch (err) { /* never let a sound crash the game */ }
  }

  // ---------- Building blocks ----------

  // A pitched tone that slides from f0 to f1 Hz
  tone(t, { type = 'sine', f0 = 440, f1 = f0, dur = 0.2, vol = 0.2, attack = 0.005, bus = this.sfxBus, lowpass = 0 }) {
    const ctx = this.ctx;
    if (bus === this.musicBus && this.musicPitch !== 1) { f0 *= this.musicPitch; f1 *= this.musicPitch; dur /= this.musicTempo; }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc.connect(gain);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = gain.connect(f);
    }
    node.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A burst of filtered noise; the filter sweeps from f0 to f1 Hz
  noise(t, { dur = 0.2, vol = 0.2, filter = 'bandpass', f0 = 1000, f1 = f0, q = 1, bus = this.sfxBus }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---------- Music ----------
  // A looping 4-bar track in A minor (Am - F - C - G), scheduled a little ahead of time.
  startMusic() {
    this.musicStarted = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  }

  setIntensity(level) { this.intensity = level; }

  scheduleMusic() {
    if (!this.ready) { if (this.ctx) this.nextStepTime = this.ctx.currentTime + 0.1; return; }
    const bpm = (this.intensity === 2 ? 132 : 116) * this.musicTempo;
    const stepLen = 60 / bpm / 4; // a 16th note
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      this.musicStep(this.step, this.nextStepTime, stepLen);
      this.step = (this.step + 1) % 64; // 4 bars x 16 steps
      this.nextStepTime += stepLen;
    }
  }

  musicStep(step, t, stepLen) {
    const bus = this.musicBus;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const CHORDS = [ // root (Hz) + chord tones for the arpeggio
      { root: 55.0, notes: [220.0, 261.6, 329.6] },  // A minor
      { root: 43.65, notes: [174.6, 220.0, 261.6] }, // F major
      { root: 65.41, notes: [261.6, 329.6, 392.0] }, // C major
      { root: 49.0, notes: [196.0, 246.9, 293.7] },  // G major
    ];
    const chord = CHORDS[bar];
    const level = this.intensity;

    // soft pad at the start of each bar
    if (s === 0) {
      for (const n of chord.notes) {
        this.tone(t, { type: 'sawtooth', f0: n / 2, dur: stepLen * 16, vol: level === 0 ? 0.03 : 0.022, attack: 0.4, bus, lowpass: 700 });
      }
    }
    if (level === 0) {
      // menu: just a slow, moody bass pulse
      if (s % 8 === 0) this.tone(t, { type: 'triangle', f0: chord.root * 2, dur: stepLen * 6, vol: 0.18, bus });
      return;
    }
    // bass on 8th notes, jumping up an octave on the off-beats
    if (s % 2 === 0) {
      const f = s % 4 === 2 ? chord.root * 2 : chord.root;
      this.tone(t, { type: 'sawtooth', f0: f, dur: stepLen * 1.8, vol: 0.16, bus, lowpass: level === 2 ? 900 : 500 });
    }
    // kick drum: four on the floor
    if (s % 4 === 0) this.tone(t, { type: 'sine', f0: 140, f1: 40, dur: 0.18, vol: 0.5, bus });
    // hi-hats: 8ths normally, 16ths during boss fights
    if (s % 2 === 0 || level === 2) this.noise(t, { dur: 0.04, vol: s % 4 === 2 ? 0.08 : 0.04, filter: 'highpass', f0: 7000, bus });
    // snare on beats 2 and 4
    if (s === 4 || s === 12) {
      this.noise(t, { dur: 0.14, vol: 0.18, filter: 'bandpass', f0: 1800, q: 0.8, bus });
      this.tone(t, { type: 'triangle', f0: 220, f1: 140, dur: 0.08, vol: 0.12, bus });
    }
    // arpeggio lead
    if (s % (level === 2 ? 1 : 2) === 0) {
      const n = chord.notes[(s / (level === 2 ? 1 : 2)) % 3 | 0] * (bar === 3 && s >= 8 ? 2 : 1);
      this.tone(t, { type: 'square', f0: n * 2, dur: stepLen * 0.9, vol: 0.035, bus, lowpass: 2500 });
    }
  }
}

// How often (seconds) each sound may repeat
const THROTTLE = { hit: 0.045, shot: 0.06, enemyDeath: 0.05, hurt: 0.12, bossWarning: 0.3, zap: 0.08, sizzle: 0.3, heal: 0.06, shieldBlock: 0.1 };

// ---------- The sound effects ----------
const SFX = {
  // talon swipe: a whoosh, pitched lower for the finisher
  slash(a, t, step = 1) {
    const big = step === 3;
    a.noise(t, { dur: big ? 0.2 : 0.12, vol: big ? 0.45 : 0.32, filter: 'bandpass', f0: big ? 2200 : 3200 + step * 300, f1: 700, q: 1.2 });
    a.tone(t, { type: 'sawtooth', f0: big ? 500 : 900 + step * 120, f1: big ? 120 : 300, dur: big ? 0.15 : 0.08, vol: 0.05, lowpass: 3000 });
  },
  // talons connecting
  hit(a, t) {
    a.tone(t, { type: 'sine', f0: 190, f1: 55, dur: 0.12, vol: 0.45 });
    a.noise(t, { dur: 0.05, vol: 0.25, filter: 'lowpass', f0: 3000 });
  },
  // blink dash: rising zip
  blink(a, t) {
    a.tone(t, { type: 'sine', f0: 300, f1: 1800, dur: 0.16, vol: 0.22 });
    a.noise(t, { dur: 0.2, vol: 0.14, filter: 'highpass', f0: 2000, f1: 6000 });
  },
  // overdrive: a revving energy whirl
  overdrive(a, t) {
    a.tone(t, { type: 'sawtooth', f0: 90, f1: 440, dur: 0.6, vol: 0.18, lowpass: 1600 });
    a.tone(t, { type: 'square', f0: 45, f1: 90, dur: 0.6, vol: 0.08, lowpass: 600 });
    a.noise(t, { dur: 0.7, vol: 0.12, filter: 'bandpass', f0: 600, f1: 3000, q: 2 });
  },
  // a Grindchoir drone breaking apart
  enemyDeath(a, t) {
    a.noise(t, { dur: 0.35, vol: 0.32, filter: 'lowpass', f0: 2500, f1: 200 });
    a.tone(t, { type: 'square', f0: 240, f1: 40, dur: 0.25, vol: 0.08, lowpass: 1200 });
  },
  // spitter / boss firing a bolt
  shot(a, t) {
    a.tone(t, { type: 'sine', f0: 620, f1: 200, dur: 0.12, vol: 0.08 });
  },
  // boss alarm: two-tone warning
  bossWarning(a, t) {
    for (let i = 0; i < 2; i++) {
      a.tone(t + i * 0.2, { type: 'square', f0: 520, dur: 0.09, vol: 0.12, lowpass: 2000 });
      a.tone(t + i * 0.2 + 0.1, { type: 'square', f0: 390, dur: 0.09, vol: 0.12, lowpass: 2000 });
    }
  },
  // boss defeated: big boom + victory arpeggio
  bossDefeated(a, t) {
    a.noise(t, { dur: 1.0, vol: 0.5, filter: 'lowpass', f0: 1500, f1: 60 });
    a.tone(t, { type: 'sine', f0: 90, f1: 30, dur: 0.9, vol: 0.5 });
    [440, 554.4, 659.3, 880].forEach((f, i) => a.tone(t + 0.25 + i * 0.11, { type: 'triangle', f0: f, dur: 0.35, vol: 0.18 }));
  },
  // Sarrow takes a hit
  hurt(a, t) {
    a.tone(t, { type: 'square', f0: 170, f1: 70, dur: 0.18, vol: 0.18, lowpass: 1400 });
    a.noise(t, { dur: 0.1, vol: 0.18, filter: 'bandpass', f0: 900 });
  },
  // core offline: slow falling notes
  gameOver(a, t) {
    [329.6, 261.6, 220, 164.8].forEach((f, i) => a.tone(t + i * 0.28, { type: 'triangle', f0: f, f1: f * 0.98, dur: i === 3 ? 1.2 : 0.3, vol: 0.2 }));
    a.tone(t, { type: 'sine', f0: 110, f1: 40, dur: 1.4, vol: 0.25 });
  },
  // new wave chime
  waveStart(a, t) {
    a.tone(t, { type: 'triangle', f0: 440, dur: 0.12, vol: 0.14 });
    a.tone(t + 0.12, { type: 'triangle', f0: 659.3, dur: 0.25, vol: 0.14 });
  },
  // ---- power-ups ----
  // grabbing a power-up: sparkly rising arpeggio
  powerup(a, t) {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => a.tone(t + i * 0.05, { type: 'triangle', f0: f, dur: 0.18, vol: 0.14 }));
  },
  // SLOW-MO starts: a deep "time stretching" downward sweep with a whoosh
  slowmoIn(a, t) {
    a.tone(t, { type: 'sawtooth', f0: 600, f1: 70, dur: 0.9, vol: 0.14, lowpass: 1400 });
    a.tone(t, { type: 'sine', f0: 300, f1: 40, dur: 1.1, vol: 0.25 });
    a.noise(t, { dur: 0.9, vol: 0.16, filter: 'bandpass', f0: 3000, f1: 200, q: 3 });
  },
  // SLOW-MO ends: time snaps back
  slowmoOut(a, t) {
    a.tone(t, { type: 'sawtooth', f0: 80, f1: 700, dur: 0.4, vol: 0.12, lowpass: 2000 });
    a.noise(t, { dur: 0.35, vol: 0.12, filter: 'bandpass', f0: 300, f1: 4000, q: 3 });
  },
  shieldBlock(a, t) {
    a.tone(t, { type: 'triangle', f0: 1200, f1: 900, dur: 0.15, vol: 0.18 });
    a.tone(t, { type: 'sine', f0: 600, dur: 0.2, vol: 0.1 });
  },
  zap(a, t) {
    a.noise(t, { dur: 0.08, vol: 0.18, filter: 'highpass', f0: 3000 });
    a.tone(t, { type: 'square', f0: 1400, f1: 300, dur: 0.07, vol: 0.06, lowpass: 5000 });
  },
  heal(a, t) { a.tone(t, { type: 'sine', f0: 880, f1: 1320, dur: 0.1, vol: 0.08 }); },
  // ---- arena hazards ----
  thunder(a, t) {
    a.noise(t, { dur: 0.08, vol: 0.5, filter: 'highpass', f0: 2000 });
    a.noise(t + 0.03, { dur: 1.4, vol: 0.45, filter: 'lowpass', f0: 900, f1: 60 });
    a.tone(t, { type: 'sine', f0: 70, f1: 30, dur: 1.0, vol: 0.35 });
  },
  sizzle(a, t) { a.noise(t, { dur: 0.25, vol: 0.16, filter: 'highpass', f0: 4000, f1: 2000 }); },
  // whoosh for the arena change
  arenaChange(a, t) {
    a.noise(t, { dur: 0.9, vol: 0.2, filter: 'bandpass', f0: 200, f1: 2500, q: 1.5 });
    a.tone(t + 0.4, { type: 'triangle', f0: 220, f1: 440, dur: 0.5, vol: 0.12 });
  },
  // ---- new bosses ----
  teleport(a, t) {
    a.tone(t, { type: 'sine', f0: 1800, f1: 200, dur: 0.18, vol: 0.18 });
    a.noise(t, { dur: 0.15, vol: 0.12, filter: 'highpass', f0: 5000 });
  },
  burrow(a, t) {
    a.noise(t, { dur: 0.7, vol: 0.35, filter: 'lowpass', f0: 600, f1: 80 });
    a.tone(t, { type: 'sawtooth', f0: 90, f1: 40, dur: 0.6, vol: 0.12, lowpass: 400 });
  },
  erupt(a, t) {
    a.noise(t, { dur: 0.6, vol: 0.5, filter: 'lowpass', f0: 2000, f1: 100 });
    a.tone(t, { type: 'square', f0: 120, f1: 35, dur: 0.5, vol: 0.18, lowpass: 900 });
  },
  laser(a, t) {
    a.tone(t, { type: 'sawtooth', f0: 220, f1: 110, dur: 1.2, vol: 0.12, lowpass: 1800 });
    a.tone(t, { type: 'square', f0: 440, f1: 430, dur: 1.2, vol: 0.05, lowpass: 2500 });
    a.noise(t, { dur: 0.3, vol: 0.2, filter: 'bandpass', f0: 1500, q: 2 });
  },
  // revived by the rewarded ad
  revive(a, t) {
    [220, 330, 440, 660, 880].forEach((f, i) => a.tone(t + i * 0.07, { type: 'sine', f0: f, dur: 0.3, vol: 0.15 }));
  },
};

export const sound = new SoundEngine();

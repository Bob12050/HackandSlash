class SoundEngine {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.master = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.master) this.master.gain.value = this.enabled ? 0.14 : 0;
  }

  unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.14 : 0;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  tone(frequency, duration = 0.08, options = {}) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = options.type || 'square';
    oscillator.frequency.setValueAtTime(frequency, now);
    if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), now + duration);
    gain.gain.setValueAtTime(options.volume || 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  play(name) {
    const sounds = {
      confirm: () => { this.tone(440, 0.05, { volume: 0.18 }); this.tone(660, 0.07, { volume: 0.12 }); },
      back: () => this.tone(240, 0.07, { to: 180, volume: 0.16 }),
      attack: () => this.tone(180, 0.1, { to: 70, type: 'sawtooth', volume: 0.24 }),
      hit: () => this.tone(90, 0.09, { to: 45, type: 'square', volume: 0.28 }),
      crit: () => { this.tone(520, 0.08, { to: 880, volume: 0.24 }); this.tone(110, 0.13, { to: 55, volume: 0.2 }); },
      guard: () => this.tone(280, 0.16, { to: 190, type: 'triangle', volume: 0.2 }),
      heal: () => { this.tone(330, 0.09, { to: 440, type: 'sine' }); setTimeout(() => this.tone(550, 0.12, { type: 'sine' }), 70); },
      break: () => { this.tone(130, 0.08, { to: 60, volume: 0.28 }); setTimeout(() => this.tone(80, 0.15, { to: 35 }), 45); },
      victory: () => [392, 494, 587, 784].forEach((note, index) => setTimeout(() => this.tone(note, 0.16, { type: 'triangle', volume: 0.16 }), index * 90)),
      loot: () => [523, 659, 784].forEach((note, index) => setTimeout(() => this.tone(note, 0.18, { type: 'sine', volume: 0.15 }), index * 80)),
      defeat: () => [220, 185, 147].forEach((note, index) => setTimeout(() => this.tone(note, 0.25, { to: note * 0.8, type: 'triangle' }), index * 150)),
    };
    sounds[name]?.();
  }
}

export const sound = new SoundEngine();

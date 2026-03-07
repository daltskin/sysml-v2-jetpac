// ── Audio: Web Audio API chiptune sound effects ──

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain) {
      this.masterGain.gain.value = m ? 0 : 0.3;
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Play a square wave beep */
  private beep(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.3) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  /** Noise burst (explosions) */
  private noise(duration: number, volume = 0.3) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(gain);
    gain.connect(this.masterGain!);
    source.start();
  }

  // ── Sound effects ──

  thrust() {
    this.beep(80, 0.05, 'sawtooth', 0.15);
  }

  fire() {
    this.beep(800, 0.08, 'square', 0.2);
    this.beep(400, 0.06, 'square', 0.15);
  }

  pickup() {
    this.beep(440, 0.1, 'square', 0.2);
    setTimeout(() => this.beep(660, 0.1, 'square', 0.2), 80);
    setTimeout(() => this.beep(880, 0.15, 'square', 0.2), 160);
  }

  drop() {
    this.beep(330, 0.1, 'square', 0.15);
    setTimeout(() => this.beep(220, 0.15, 'square', 0.15), 80);
  }

  alienDeath() {
    this.noise(0.15, 0.25);
    this.beep(200, 0.1, 'sawtooth', 0.2);
  }

  playerDeath() {
    this.noise(0.3, 0.3);
    this.beep(200, 0.2, 'sawtooth', 0.15);
    setTimeout(() => this.beep(100, 0.3, 'sawtooth', 0.15), 200);
    setTimeout(() => this.beep(50, 0.4, 'sawtooth', 0.1), 400);
  }

  launch() {
    // Rising tone
    if (this.muted) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 100;
    osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 2);
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + 2.5);

    this.noise(1.5, 0.15);
  }

  levelComplete() {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => this.beep(freq, 0.2, 'square', 0.2), i * 150);
    });
  }

  gameOver() {
    const notes = [400, 350, 300, 250, 200];
    notes.forEach((freq, i) => {
      setTimeout(() => this.beep(freq, 0.3, 'square', 0.15), i * 200);
    });
  }

  codeSuccess() {
    this.beep(880, 0.15, 'square', 0.2);
    setTimeout(() => this.beep(1100, 0.2, 'square', 0.2), 100);
  }

  codeError() {
    this.beep(200, 0.2, 'square', 0.2);
    setTimeout(() => this.beep(150, 0.3, 'square', 0.2), 150);
  }

  /** Call on first user interaction to unlock audio */
  unlock() {
    this.ensureContext();
  }
}

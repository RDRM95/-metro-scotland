/**
 * Procedural sound design on the Web Audio API. Nothing is sampled — every
 * ambience and effect is synthesised so the production carries no licensed
 * audio and loads instantly.
 *
 * Buses (continuous, slewed from the scene's AudioMix each frame):
 *   bunker, rain, wind, river, radio, drone, sub, alarm, emergency, static
 * One-shots: keyboard, alert beep, radio squelch, camera motor, thermal
 *   switch, power dip, monitor off, scrape, impact, glitch, relay click.
 */
import type { AudioMix } from './AudioMix';
import { SILENCE } from './AudioMix';

type BusName = keyof AudioMix;

interface Bus {
  gain: GainNode;
  /** Base level applied on top of mix value. */
  level: number;
  /** Optional per-frame modulator. */
  modulate?: (t: number) => number;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private buses = new Map<BusName, Bus>();
  private noise: { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer } | null = null;
  private volume = 0.8;
  private muted = false;
  private windFilter: BiquadFilterNode | null = null;
  private time = 0;
  private current: AudioMix = { ...SILENCE };
  private rainGain: GainNode | null = null;
  private staticGain: GainNode | null = null;

  get ready(): boolean {
    return this.ctx !== null;
  }

  /** Must be called from a user gesture (mobile autoplay policy). */
  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'playback' });
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 12;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.01;
    this.comp.release.value = 0.25;
    this.master.connect(this.comp).connect(ctx.destination);
    this.applyVolume();
    this.noise = {
      white: makeNoise(ctx, 'white'),
      pink: makeNoise(ctx, 'pink'),
      brown: makeNoise(ctx, 'brown'),
    };
    this.buildBuses();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async suspend(): Promise<void> {
    if (this.ctx && this.ctx.state === 'running') await this.ctx.suspend();
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolume();
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private applyVolume(): void {
    if (!this.master || !this.ctx) return;
    const target = this.muted ? 0 : this.volume * this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
  }

  private src(kind: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise![kind];
    s.loop = true;
    s.start();
    return s;
  }

  private bus(name: BusName, level: number, modulate?: (t: number) => number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = 0;
    g.connect(this.master!);
    this.buses.set(name, { gain: g, level, modulate });
    return g;
  }

  private buildBuses(): void {
    const ctx = this.ctx!;

    // --- Bunker: ventilation rumble + fan whine + mains hum
    {
      const g = this.bus('bunker', 0.55);
      const rumble = ctx.createBiquadFilter();
      rumble.type = 'lowpass';
      rumble.frequency.value = 140;
      this.src('brown').connect(rumble).connect(g);
      const fan = ctx.createBiquadFilter();
      fan.type = 'bandpass';
      fan.frequency.value = 520;
      fan.Q.value = 0.9;
      const fanG = ctx.createGain();
      fanG.gain.value = 0.12;
      this.src('pink').connect(fan).connect(fanG).connect(g);
      const hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 50;
      const hum2 = ctx.createOscillator();
      hum2.type = 'triangle';
      hum2.frequency.value = 100;
      const humG = ctx.createGain();
      humG.gain.value = 0.035;
      hum.connect(humG);
      hum2.connect(humG);
      humG.connect(g);
      hum.start();
      hum2.start();
    }

    // --- Rain: hissy broadband with slow gusting
    {
      const g = this.bus('rain', 0.5, (t) => 0.75 + 0.25 * Math.sin(t * 0.37) * Math.sin(t * 0.11 + 1));
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 6500;
      this.rainGain = ctx.createGain();
      this.rainGain.gain.value = 1;
      this.src('white').connect(hp).connect(lp).connect(this.rainGain).connect(g);
      // Drips: narrow band for close rain on the camera housing
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2800;
      bp.Q.value = 3;
      const bg = ctx.createGain();
      bg.gain.value = 0.25;
      this.src('pink').connect(bp).connect(bg).connect(g);
    }

    // --- Wind: swept bandpass over pink noise
    {
      const g = this.bus('wind', 0.5);
      this.windFilter = ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 320;
      this.windFilter.Q.value = 1.4;
      this.src('pink').connect(this.windFilter).connect(g);
    }

    // --- River: low wash
    {
      const g = this.bus('river', 0.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      this.src('brown').connect(lp).connect(g);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100;
      bp.Q.value = 1.0;
      const bg = ctx.createGain();
      bg.gain.value = 0.08;
      this.src('pink').connect(bp).connect(bg).connect(g);
    }

    // --- Radio channel hiss
    {
      const g = this.bus('radio', 0.14);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1900;
      bp.Q.value = 0.8;
      this.src('white').connect(bp).connect(g);
    }

    // --- Horror drone: detuned low saws + sine, gently filtered
    {
      const g = this.bus('drone', 0.22, (t) => 0.8 + 0.2 * Math.sin(t * 0.21));
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      lp.Q.value = 2;
      lp.connect(g);
      const freqs = [46, 46.6, 69.2];
      for (const f of freqs) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = 0.3;
        o.connect(og).connect(lp);
        o.start();
      }
      const s = ctx.createOscillator();
      s.type = 'sine';
      s.frequency.value = 34.5;
      const sg = ctx.createGain();
      sg.gain.value = 0.5;
      s.connect(sg).connect(g);
      s.start();
    }

    // --- Sub pressure: slow tremolo sine
    {
      const g = this.bus('sub', 0.5, (t) => 0.6 + 0.4 * Math.sin(t * 1.3));
      const s = ctx.createOscillator();
      s.type = 'sine';
      s.frequency.value = 28;
      s.connect(g);
      s.start();
    }

    // --- Alarm: pulsed tone
    {
      const g = this.bus('alarm', 0.09, (t) => ((t * 1.6) % 1 < 0.22 ? 1 : 0));
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = 760;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      o.connect(lp).connect(g);
      o.start();
    }

    // --- Emergency lighting ballast buzz
    {
      const g = this.bus('emergency', 0.05);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 120;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      o.connect(lp).connect(g);
      o.start();
    }

    // --- Static crackle
    {
      const g = this.bus('static', 0.35);
      this.staticGain = ctx.createGain();
      this.staticGain.gain.value = 1;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      this.src('white').connect(hp).connect(this.staticGain).connect(g);
    }
  }

  /** Called every frame with the scene's requested mix. */
  update(mix: AudioMix, dt: number, filmTime: number): void {
    if (!this.ctx) return;
    this.time = filmTime;
    this.current = mix;
    const now = this.ctx.currentTime;
    for (const [name, b] of this.buses) {
      const want = mix[name] * b.level * (b.modulate ? b.modulate(filmTime) : 1);
      b.gain.gain.setTargetAtTime(want, now, name === 'alarm' ? 0.01 : 0.12);
    }
    if (this.windFilter) {
      const f = 240 + 260 * (0.5 + 0.5 * Math.sin(filmTime * 0.23) * Math.sin(filmTime * 0.071 + 2));
      this.windFilter.frequency.setTargetAtTime(f, now, 0.3);
    }
    if (this.staticGain && mix.static > 0) {
      // crackle: random gating
      const g = Math.random() < 0.3 ? 1 : Math.random() < 0.5 ? 0.4 : 0.1;
      this.staticGain.gain.setTargetAtTime(g, now, 0.015);
    }
    void dt;
  }

  // ------------------------------------------------------------------
  // One-shots
  // ------------------------------------------------------------------

  private env(node: AudioNode, peak: number, attack: number, decay: number, when = 0): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g).connect(this.master!);
    return g;
  }

  private burst(kind: 'white' | 'pink' | 'brown', peak: number, attack: number, decay: number, filter?: (f: BiquadFilterNode) => void, when = 0): void {
    if (!this.ctx) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise![kind];
    let node: AudioNode = s;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      filter(f);
      s.connect(f);
      node = f;
    }
    this.env(node, peak, attack, decay, when);
    s.start(this.ctx.currentTime + when);
    s.stop(this.ctx.currentTime + when + attack + decay + 0.05);
  }

  private tone(type: OscillatorType, f0: number, f1: number, peak: number, attack: number, decay: number, when = 0): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t0 = this.ctx.currentTime + when;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + attack + decay);
    this.env(o, peak, attack, decay, when);
    o.start(t0);
    o.stop(t0 + attack + decay + 0.05);
  }

  keyClick(): void {
    this.burst('white', 0.06 + Math.random() * 0.04, 0.002, 0.03 + Math.random() * 0.03, (f) => {
      f.type = 'bandpass';
      f.frequency.value = 2200 + Math.random() * 1800;
      f.Q.value = 1.5;
    });
  }

  /** Detection alert: two short tones. */
  alertBeep(): void {
    this.tone('square', 1040, 1040, 0.07, 0.005, 0.09);
    this.tone('square', 1040, 1040, 0.07, 0.005, 0.09, 0.16);
  }

  /** Softer UI acknowledge. */
  uiBlip(): void {
    this.tone('triangle', 660, 660, 0.05, 0.004, 0.06);
  }

  /** Squelch when a radio channel opens/closes. */
  squelch(open: boolean): void {
    this.burst('white', open ? 0.12 : 0.08, 0.004, open ? 0.09 : 0.06, (f) => {
      f.type = 'bandpass';
      f.frequency.value = open ? 1800 : 1200;
      f.Q.value = 1;
    });
    if (open) this.tone('sine', 2400, 2400, 0.02, 0.002, 0.03);
  }

  /** Pan/tilt motor whine while the camera tracks. */
  cameraMotor(duration: number): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 85;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    o.connect(lp);
    this.env(lp, 0.05, 0.08, Math.max(0.1, duration));
    o.start();
    o.stop(this.ctx.currentTime + duration + 0.3);
    this.burst('pink', 0.03, 0.05, duration, (f) => {
      f.type = 'bandpass';
      f.frequency.value = 1400;
      f.Q.value = 2;
    });
  }

  /** Thermal sensor engaging: relay click + rising whine settle. */
  thermalSwitch(): void {
    this.relayClick();
    this.tone('sine', 400, 1900, 0.06, 0.25, 0.5, 0.05);
    this.burst('white', 0.05, 0.02, 0.4, (f) => {
      f.type = 'highpass';
      f.frequency.value = 4000;
    }, 0.05);
  }

  relayClick(): void {
    this.burst('white', 0.18, 0.001, 0.025, (f) => {
      f.type = 'bandpass';
      f.frequency.value = 3200;
      f.Q.value = 2;
    });
    this.tone('square', 180, 90, 0.08, 0.001, 0.03);
  }

  /** Power dips: everything sags. */
  powerDip(): void {
    this.tone('sawtooth', 110, 40, 0.14, 0.05, 0.9);
    this.burst('brown', 0.25, 0.02, 0.8);
  }

  /** CRT monitor losing power: thump + collapsing whine. */
  monitorOff(): void {
    this.tone('sine', 12000, 600, 0.05, 0.005, 0.18);
    this.tone('sine', 90, 35, 0.12, 0.004, 0.2);
  }

  /** Monitor waking: hum rise + static hit. */
  monitorOn(): void {
    this.tone('sine', 300, 15500, 0.03, 0.15, 0.25);
    this.burst('white', 0.09, 0.005, 0.12, (f) => {
      f.type = 'highpass';
      f.frequency.value = 2500;
    });
  }

  /** Metallic scrape somewhere in the structure. */
  scrape(duration = 1.6): void {
    if (!this.ctx) return;
    this.burst('pink', 0.11, 0.3, duration, (f) => {
      f.type = 'bandpass';
      f.frequency.value = 2600;
      f.Q.value = 9;
    });
    this.burst('pink', 0.08, 0.5, duration * 0.8, (f) => {
      f.type = 'bandpass';
      f.frequency.value = 1750;
      f.Q.value = 12;
    }, 0.2);
    this.tone('sawtooth', 160, 120, 0.03, 0.4, duration);
  }

  /** The final impact: sub thud, structural ring, debris. */
  impact(): void {
    if (!this.ctx) return;
    this.tone('sine', 140, 24, 0.9, 0.004, 1.8);
    this.tone('triangle', 70, 30, 0.5, 0.004, 1.2);
    this.burst('brown', 0.9, 0.003, 1.4);
    this.burst('white', 0.5, 0.002, 0.3, (f) => {
      f.type = 'lowpass';
      f.frequency.value = 3000;
    });
    // metallic ring: several resonant bands
    for (const [freq, peak, decay, when] of [[412, 0.12, 2.8, 0.01], [613, 0.09, 2.3, 0.01], [930, 0.06, 1.9, 0.02], [1490, 0.04, 1.4, 0.03]] as const) {
      this.burst('white', peak, 0.004, decay, (f) => {
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = 40;
      }, when);
    }
    // debris
    for (let i = 0; i < 6; i++) {
      this.burst('white', 0.05, 0.002, 0.06, (f) => {
        f.type = 'bandpass';
        f.frequency.value = 1200 + Math.random() * 3000;
        f.Q.value = 4;
      }, 0.25 + Math.random() * 0.9);
    }
  }

  /** Digital glitch / signal loss. */
  glitch(): void {
    this.burst('white', 0.14, 0.002, 0.08, (f) => {
      f.type = 'highpass';
      f.frequency.value = 3000;
    });
    this.tone('square', 2200, 300, 0.04, 0.002, 0.08);
  }

  /** Tracking lost: descending triple. */
  trackLost(): void {
    this.tone('square', 900, 900, 0.06, 0.004, 0.07);
    this.tone('square', 700, 700, 0.06, 0.004, 0.07, 0.1);
    this.tone('square', 500, 500, 0.06, 0.004, 0.12, 0.2);
  }

  /** Flat line for the final red banner. */
  connectionLost(): void {
    this.tone('sine', 440, 440, 0.05, 0.01, 1.4);
  }

  /** Distant thunder rolling over the city. */
  thunder(): void {
    this.burst('brown', 0.5, 0.15, 2.6, (f) => {
      f.type = 'lowpass';
      f.frequency.value = 160;
    }, 0.6 + Math.random() * 0.5);
    this.burst('brown', 0.25, 0.4, 2.0, (f) => {
      f.type = 'lowpass';
      f.frequency.value = 320;
    }, 1.2 + Math.random() * 0.5);
  }

  /** A single sub-bass pressure hit. */
  subHit(): void {
    this.tone('sine', 60, 26, 0.55, 0.01, 1.1);
    this.burst('brown', 0.2, 0.01, 0.5);
  }

  /** Low, close breath/heartbeat pressure used sparingly. */
  heartbeat(): void {
    this.tone('sine', 55, 40, 0.3, 0.01, 0.25);
    this.tone('sine', 50, 38, 0.22, 0.01, 0.22, 0.32);
  }

  /** A tiny click when a UI control is used. */
  uiClick(): void {
    this.burst('white', 0.03, 0.001, 0.02, (f) => {
      f.type = 'bandpass';
      f.frequency.value = 2800;
    });
  }

  get currentMix(): AudioMix {
    return this.current;
  }

  get filmTime(): number {
    return this.time;
  }
}

function makeNoise(ctx: AudioContext, kind: 'white' | 'pink' | 'brown'): AudioBuffer {
  const seconds = 3;
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  }
  // Seamless loop: crossfade the tail into the head.
  const fade = Math.floor(ctx.sampleRate * 0.05);
  for (let i = 0; i < fade; i++) {
    const u = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - u) + d[i] * u;
  }
  return buf;
}

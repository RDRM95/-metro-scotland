/**
 * The Film: scenes on a timeline, cues into the audio engine, subtitles,
 * seeking. Every scene renders deterministically from local time, so
 * seeking is simply "render at t".
 */
import type { Scene } from './scenes/Scene';
import { Timeline, cuesCrossed, type Cue } from './timeline/Timeline';
import { AudioEngine } from './audio/AudioEngine';
import { SCRIPT } from './dialogue/script';
import { drawSubtitles } from './dialogue/Subtitles';
import type { Ctx2D } from './engine/Surface';
import { SceneControl } from './scenes/SceneControl';
import { SceneSurface } from './scenes/SceneSurface';
import { SceneEntity } from './scenes/SceneEntity';
import { SceneNetwork } from './scenes/SceneNetwork';
import { SceneInside } from './scenes/SceneInside';
import { SceneEnd } from './scenes/SceneEnd';
import { SILENCE } from './audio/AudioMix';

interface GlobalCue extends Cue {
  sceneId: string;
}

export function buildScenes(): Scene[] {
  return [new SceneControl(), new SceneSurface(), new SceneEntity(), new SceneNetwork(), new SceneInside(), new SceneEnd()];
}

export class Film {
  readonly scenes: Scene[];
  readonly timeline: Timeline<Scene>;
  private cues: GlobalCue[] = [];
  private initialised = new Set<string>();
  time = 0;
  playing = false;
  subtitles = true;
  onEnd: (() => void) | null = null;
  private lastSceneIndex = -1;

  constructor(private audio: AudioEngine, scenes = buildScenes()) {
    this.scenes = scenes;
    this.timeline = new Timeline(scenes);
    // Global cue list: scene cues + radio squelches derived from the script.
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i];
      const start = this.timeline.starts[i];
      for (const c of s.cues) this.cues.push({ time: start + c.time, id: c.id, sceneId: s.id });
      for (const line of SCRIPT[s.id] ?? []) {
        if (line.radio) {
          this.cues.push({ time: start + line.time, id: 'squelch-open', sceneId: s.id });
          this.cues.push({ time: start + line.time + line.duration, id: 'squelch-close', sceneId: s.id });
        }
      }
    }
    this.cues.sort((a, b) => a.time - b.time);
  }

  get total(): number {
    return this.timeline.total;
  }

  get sceneIndex(): number {
    return this.timeline.locate(this.time).index;
  }

  play(): void {
    if (this.time >= this.total) this.time = 0;
    this.playing = true;
    void this.audio.resume();
  }

  pause(): void {
    this.playing = false;
  }

  seek(t: number): void {
    this.time = this.timeline.clamp(t);
  }

  seekScene(i: number): void {
    this.seek(this.timeline.startOf(i));
  }

  restart(): void {
    this.time = 0;
    this.playing = true;
  }

  /** Advances time, fires cues. */
  update(dt: number): void {
    if (!this.playing) return;
    const prev = this.time;
    this.time = Math.min(this.total, this.time + dt);
    for (const c of cuesCrossed(this.cues, prev, this.time)) this.fire(c.id);
    if (this.time >= this.total) {
      this.playing = false;
      this.onEnd?.();
    }
  }

  private ensureInit(scene: Scene): void {
    if (!this.initialised.has(scene.id)) {
      scene.init();
      this.initialised.add(scene.id);
    }
  }

  /** Renders the frame for the current time and updates the audio mix. */
  render(frame: Ctx2D, dt: number): void {
    const pos = this.timeline.locate(this.time);
    this.ensureInit(pos.segment);
    if (pos.index !== this.lastSceneIndex) {
      // Pre-initialise the next scene so the cut is not stalled by surface allocation.
      const next = this.scenes[pos.index + 1];
      if (next) this.ensureInit(next);
      this.lastSceneIndex = pos.index;
    }
    pos.segment.render(frame, pos.local, dt);
    drawSubtitles(frame, SCRIPT[pos.segment.id] ?? [], pos.local, { enabled: this.subtitles });
    this.audio.update(this.playing ? pos.segment.mix(pos.local) : SILENCE, dt, this.time);
  }

  /** Deterministic render at an absolute time (used by tests and frame export). */
  renderAt(frame: Ctx2D, t: number): void {
    this.time = this.timeline.clamp(t);
    const pos = this.timeline.locate(this.time);
    this.ensureInit(pos.segment);
    pos.segment.render(frame, pos.local, 1 / 60);
    drawSubtitles(frame, SCRIPT[pos.segment.id] ?? [], pos.local, { enabled: this.subtitles });
  }

  private fire(id: string): void {
    const a = this.audio;
    switch (id) {
      case 'key': a.keyClick(); break;
      case 'alert': a.alertBeep(); break;
      case 'alert-long': a.alertBeep(); setTimeout(() => a.alertBeep(), 450); setTimeout(() => a.alertBeep(), 900); break;
      case 'blip': a.uiBlip(); break;
      case 'motor': a.cameraMotor(1.4); break;
      case 'motor-long': a.cameraMotor(2.2); break;
      case 'lost': a.trackLost(); break;
      case 'thermal': a.thermalSwitch(); break;
      case 'thunder': a.thunder(); break;
      case 'heartbeat': a.heartbeat(); break;
      case 'sub-hit': a.subHit(); break;
      case 'glitch': a.glitch(); break;
      case 'monitor-off': a.monitorOff(); break;
      case 'monitor-on': a.monitorOn(); break;
      case 'squelch-open': a.squelch(true); break;
      case 'squelch-close': a.squelch(false); break;
      case 'power-dip': a.powerDip(); break;
      case 'power-down': a.powerDip(); a.monitorOff(); break;
      case 'relay': a.relayClick(); break;
      case 'scrape': a.scrape(1.8); break;
      case 'impact': a.impact(); break;
      case 'connection-lost': a.connectionLost(); break;
      default: break;
    }
  }
}

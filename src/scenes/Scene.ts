import type { Ctx2D } from '../engine/Surface';
import type { Cue } from '../timeline/Timeline';
import type { AudioMix } from '../audio/AudioMix';

/** A one-shot sound or event the scene wants at a local time. */
export interface SceneCue extends Cue {
  kind: 'sfx' | 'event';
}

export interface Scene {
  readonly id: string;
  readonly title: string;
  readonly duration: number;
  /** One-shot cues (sound effects) at local times. */
  readonly cues: readonly SceneCue[];
  /** Lazily build surfaces. Called once before first render. */
  init(): void;
  /** Draw the complete 480×270 frame for local time t. Must be deterministic in t. */
  render(frame: Ctx2D, t: number, dt: number): void;
  /** Continuous ambience levels for local time t. */
  mix(t: number): AudioMix;
}

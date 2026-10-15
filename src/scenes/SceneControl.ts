/**
 * SCENE ONE — SCOTLAND CONTROL (24 s)
 * Routine. A detection alert arrives from Glasgow West, camera twelve.
 */
import type { Ctx2D } from '../engine/Surface';
import { VIEW_H, VIEW_W } from '../engine/Surface';
import { keyframes, easeInOutCubic } from '../engine/Easing';
import { fluorescentFlicker, darken, fadeAmount } from '../lighting/Lighting';
import type { BunkerState } from '../environments/commandCentre';
import { mix, type AudioMix } from '../audio/AudioMix';
import type { Scene, SceneCue } from './Scene';
import { BunkerSet } from './bunkerShots';
import { cue, shotAt, typingCues } from './common';
import { span } from '../engine/Easing';

type Shot = 'wide' | 'op2' | 'op1' | 'ctl' | 'op1b' | 'ctl2' | 'op1c' | 'op2b' | 'wideIn';

const SHOTS: ReadonlyArray<readonly [number, Shot]> = [
  [0, 'wide'], [5.5, 'op2'], [8.0, 'op1'], [11.5, 'ctl'], [13.3, 'op1b'], [15.5, 'ctl2'], [17.2, 'op1c'], [18.8, 'op2b'], [21.4, 'wideIn'],
];

const ALERT_T = 7.0;

export class SceneControl implements Scene {
  readonly id = 'control';
  readonly title = '1. Scotland Control';
  readonly duration = 24;
  readonly cues: SceneCue[] = [
    cue(ALERT_T, 'alert'),
    cue(ALERT_T + 0.75, 'alert'),
    cue(21.4, 'motor'),
    ...typingCues([[0.6, 5.4], [8.2, 8.6], [13.4, 15.4]], 3),
  ];
  private set!: BunkerSet;

  init(): void {
    this.set = new BunkerSet();
  }

  private state(t: number): BunkerState {
    const alert = t >= ALERT_T;
    return {
      filmTime: t,
      alert: alert ? 'GLASGOW SECTOR - UNIDENTIFIED MOVEMENT' : undefined,
      alertStrong: false,
      mapOverrides: alert ? { gw: 'alert' } : undefined,
      dim: 0,
      emergency: 0,
      monitors: [true, true, true],
      wallDisplay: 'map',
      flicker: fluorescentFlicker(t, 1, 0.04),
    };
  }

  render(frame: Ctx2D, t: number): void {
    const s = this.state(t);
    const shot = shotAt(t, SHOTS);
    const red = t >= ALERT_T ? 1 : 0;
    switch (shot) {
      case 'wide': {
        const x = keyframes(t, [[0, 300], [5.5, 332]], easeInOutCubic);
        this.set.wideShot(frame, t, s, {
          op2: { typing: t < 3.0 || t > 4.6, headTurn: t > 3 && t < 4.6 ? -0.4 : 0 },
          op1: { typing: true },
          control: { typing: false, headTurn: 0.3, handToHeadset: true },
          tech: { visible: true, frantic: false },
        }, { x, y: 135, zoom: 1, shake: 0 });
        break;
      }
      case 'op2': {
        // studies the thermal imagery while drinking coffee
        const u = t - 5.5;
        const mug = u < 0.8 ? u / 0.8 : u < 1.9 ? 1 : Math.max(0, 1 - (u - 1.9) / 0.6);
        this.set.closeup(frame, t, s, 'op2', {
          expression: 'neutral', lookX: -1, lookY: 1, mug, headTilt: mug > 0.8 ? 1 : 0, typing: false,
        }, 1, 212,red * 0.6);
        break;
      }
      case 'op1': {
        const speaking = t >= 8.2;
        this.set.closeup(frame, t, s, 'op1', {
          expression: 'focused', lookX: 0, lookY: 1, typing: !speaking, headTurn: speaking ? 0.25 : 0, lean: 0.4,
        }, -1, 212,red);
        break;
      }
      case 'ctl': {
        this.set.closeup(frame, t, s, 'control', {
          expression: 'neutral', lookX: -1, lookY: 0, handToHeadset: true, headTurn: -0.4,
        }, 1, 212,red * 0.4);
        break;
      }
      case 'op1b': {
        this.set.closeup(frame, t, s, 'op1', {
          expression: 'focused', lookX: 0, lookY: 1, typing: t > 14.2, headTurn: t < 14.2 ? 0.25 : 0,
        }, -1, 212,red);
        break;
      }
      case 'ctl2': {
        this.set.closeup(frame, t, s, 'control', {
          expression: 'neutral', lookX: -1, lookY: 0, handToHeadset: false, headTurn: -0.3, eyesClosed: t > 16.6 && t < 16.8,
        }, 1, 212,red * 0.4);
        break;
      }
      case 'op1c': {
        // a small shrug: lean back then settle
        const u = span(t, 17.2, 17.8);
        this.set.closeup(frame, t, s, 'op1', {
          expression: 'concerned', lookX: 1, lookY: 0, lean: -0.8 * Math.sin(u * Math.PI), headTurn: 0.3, headTilt: -1,
        }, -1, 212,red);
        break;
      }
      case 'op2b': {
        const turn = span(t, 18.8, 19.5);
        this.set.closeup(frame, t, s, 'op2', {
          expression: 'concerned', lookX: 1, lookY: 0, headTurn: 0.9 * turn, typing: false, headTilt: -1,
        }, 1, 212,red * 0.6);
        break;
      }
      case 'wideIn': {
        const u = span(t, 21.4, 24, easeInOutCubic);
        const zoom = 1 + u; // 1 → 2
        const y = 135 + (96 - 135) * u;
        this.set.wideShot(frame, t, s, {
          op2: { typing: false, headTurn: 0.6 },
          op1: { typing: false },
          control: { typing: false, headTurn: 0.2, handToHeadset: true },
          tech: { visible: true, frantic: false },
        }, { x: 320, y, zoom, shake: 0 });
        break;
      }
    }
    const fade = fadeAmount(t, this.duration, 1.6, 0);
    if (fade > 0) darken(frame, 0, 0, VIEW_W, VIEW_H, fade);
  }

  mix(t: number): AudioMix {
    return mix({
      bunker: 1,
      radio: 0.35,
      alarm: t >= ALERT_T && t < ALERT_T + 1.6 ? 0.5 : 0,
    });
  }
}

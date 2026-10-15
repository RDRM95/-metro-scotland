/**
 * SCENE FIVE — SOMETHING IS INSIDE (38 s)
 * Power sags. Feeds die. One monitor returns: Corridor B-17. Ours.
 */
import type { Ctx2D } from '../engine/Surface';
import { createSurface, rect, VIEW_H, VIEW_W, type Surface } from '../engine/Surface';
import { easeInOutCubic, span } from '../engine/Easing';
import { hash1, noise1 } from '../engine/Rng';
import { CORRIDOR_H, CORRIDOR_W, drawCorridor, type CorridorState } from '../environments/corridor';
import { drawHud, drawBanner, type HudInfo } from '../surveillance/Overlay';
import { mix, type AudioMix } from '../audio/AudioMix';
import type { Scene, SceneCue } from './Scene';
import { cue, feedTreatment, shotAt } from './common';
import { BunkerSet } from './bunkerShots';
import { fluorescentFlicker, darken } from '../lighting/Lighting';
import type { BunkerState } from '../environments/commandCentre';
import { drawText, FONT_3x5, FONT_5x7 } from '../engine/Font';
import { P } from '../engine/Palette';

type Shot = 'wide' | 'ctl' | 'op2' | 'ctl2' | 'wideOff' | 'wideMon' | 'op1' | 'ctl3' | 'op1b' | 'push' | 'feed' | 'room' | 'black';
const SHOTS: ReadonlyArray<readonly [number, Shot]> = [
  [0, 'wide'], [1.5, 'ctl'], [3.3, 'op2'], [4.8, 'ctl2'], [6.5, 'wideOff'], [10.4, 'wideMon'], [12.0, 'op1'], [13.9, 'ctl3'], [15.6, 'op1b'],
  [17.0, 'push'], [19.5, 'feed'], [27.5, 'room'], [28.1, 'black'],
];

const MON_OFF = [6.8, 7.6, 8.4];
const WALL_OFF = 9.0;
const LIGHTS_OFF = 9.2;
const EMERG_ON = 9.4;
const MON_ON = 10.5;
const FRAME_T = 26.3;
const FRAME_LEN = 0.09;
const IMPACT_T = 28.0;
const BANNER_T = 35.0;

export class SceneInside implements Scene {
  readonly id = 'inside';
  readonly title = '5. Something Is Inside';
  readonly duration = 38;
  readonly cues: SceneCue[] = [
    cue(0.25, 'power-dip'),
    cue(0.9, 'relay'),
    ...MON_OFF.map((t) => cue(t, 'monitor-off')),
    cue(WALL_OFF, 'monitor-off'),
    cue(LIGHTS_OFF, 'power-down'),
    cue(EMERG_ON, 'relay'),
    cue(MON_ON, 'monitor-on'),
    cue(17.0, 'motor'),
    cue(18.2, 'scrape'),
    cue(23.6, 'scrape'),
    cue(25.0, 'sub-hit'),
    cue(FRAME_T, 'glitch'),
    cue(FRAME_T + 0.02, 'sub-hit'),
    cue(27.5, 'power-down'),
    cue(IMPACT_T, 'impact'),
    cue(29.6, 'squelch-open'),
    cue(32.4, 'squelch-close'),
    cue(32.8, 'squelch-open'),
    cue(34.7, 'squelch-close'),
    cue(BANNER_T, 'connection-lost'),
  ];
  private set!: BunkerSet;
  private corridor!: Surface;
  private monitorRoom!: Surface;

  init(): void {
    this.set = new BunkerSet();
    this.corridor = createSurface(CORRIDOR_W, CORRIDOR_H);
    this.monitorRoom = createSurface(480, 270);
  }

  private state(t: number): BunkerState {
    // power fluctuation 0.2–1.3 s
    const sag = t < 1.5 ? Math.max(0, Math.sin((t - 0.2) / 1.1 * Math.PI)) * 0.55 * (0.6 + 0.4 * noise1(t * 20, 3)) : 0;
    const lightsOut = t >= LIGHTS_OFF;
    const monitors: [boolean, boolean, boolean] = [t < MON_OFF[0], t < MON_OFF[1] || t >= MON_ON, t < MON_OFF[2]];
    return {
      filmTime: 119 + t,
      alert: t < WALL_OFF ? 'UNAUTHORISED VIDEO SOURCE DETECTED' : undefined,
      alertStrong: true,
      alert2: t < WALL_OFF ? 'ISOLATING EXTERNAL FEEDS...' : undefined,
      mapOverrides: { gw: 'alert', gc: 'alert', m8: 'alert', cb: 'alert', ed: 'alert', li: 'alert', fk: 'alert', mw: 'alert', fa: 'compromised', co: 'compromised', pa: 'alert', gk: 'alert' },
      dim: lightsOut ? 0.88 : sag + (t > 1.5 && t < LIGHTS_OFF ? 0.18 : 0),
      emergency: t >= EMERG_ON ? Math.min(1, (t - EMERG_ON) / 0.4) : 0,
      monitors,
      wallDisplay: t >= WALL_OFF ? 'off' : 'map',
      flicker: lightsOut ? 0 : fluorescentFlicker(t, 3, t < 1.5 ? 0.5 : 0.12),
    };
  }

  private corridorState(t: number): CorridorState {
    const dark = t >= 27.5 ? 1 : 0;
    const near = t >= FRAME_T && t < FRAME_T + FRAME_LEN;
    const f0 = near ? 0.05 : fluorescentFlicker(t, 7, 0.3);
    return {
      flicker: [f0, 0.85, 0.8 * fluorescentFlicker(t, 8, 0.05), 0.7],
      entityFar: t >= 19.5 ? 1 : 0,
      headRaise: span(t, 25.0, 26.0, easeInOutCubic),
      entityNear: near,
      dark,
      doorLamp: true,
    };
  }

  render(frame: Ctx2D, t: number): void {
    const s = this.state(t);
    const shot = shotAt(t, SHOTS);
    const red = s.emergency;
    switch (shot) {
      case 'wide':
        this.set.wideShot(frame, t, s, {
          op2: { typing: true, lean: 0.6 }, op1: { typing: true, lean: 0.6 }, control: { typing: false, headTurn: -0.5, lean: 0.3 }, tech: { visible: true, frantic: true },
        }, { x: 322, y: 135, zoom: 1, shake: 0 });
        break;
      case 'ctl':
        this.set.closeup(frame, t, s, 'control', { expression: 'focused', lookX: -1, lookY: 0, headTurn: -0.4, lean: 0.6, handToHeadset: false }, 1, 212,0.6);
        break;
      case 'op2':
        this.set.closeup(frame, t, s, 'op2', { expression: 'focused', lookX: 0, lookY: 1, typing: true, lean: 1, headTilt: 1 }, 1, 212,0.6);
        break;
      case 'ctl2':
        this.set.closeup(frame, t, s, 'control', { expression: 'concerned', lookX: -1, lookY: 1, headTurn: -0.2, lean: 0.8 }, 1, 212,0.6);
        break;
      case 'wideOff':
      case 'wideMon':
        this.set.wideShot(frame, t, s, {
          op2: { typing: t < 7.0, lean: t < 8 ? 0.6 : -0.4, headTurn: t > 8 ? 0.6 : 0 },
          op1: { typing: t < 8.0, lean: t < 8.4 ? 0.6 : -0.3 },
          control: { typing: false, headTurn: t > 8.5 ? 0.0 : -0.3, lean: 0 },
          tech: { visible: true, frantic: t < 9.5 },
        }, { x: 320, y: 135 + span(t, 10.4, 12.0) * 10, zoom: 1, shake: 0 });
        break;
      case 'op1':
        this.set.closeup(frame, t, s, 'op1', { expression: 'focused', lookX: 0, lookY: 1, typing: false, lean: 1, headTilt: 1 }, -1, 212,red);
        break;
      case 'ctl3':
        this.set.closeup(frame, t, s, 'control', { expression: 'concerned', lookX: -1, lookY: 0, headTurn: -0.5, lean: 0.4 }, 1, 212,red);
        break;
      case 'op1b': {
        const realised = t >= 15.9;
        this.set.closeup(frame, t, s, 'op1', {
          expression: realised ? 'fear' : 'focused', lookX: 0, lookY: realised ? 0 : 1, typing: t < 15.6, lean: realised ? -0.6 : 0.8, headTilt: realised ? -1 : 1, headTurn: realised ? 0.35 : 0,
        }, -1, 212,red);
        break;
      }
      case 'push':
        this.renderPush(frame, t, s);
        break;
      case 'feed':
        this.renderFeed(frame, t);
        break;
      case 'room': {
        // the lights go out; emergency lamps still glow for half a second
        const dead: BunkerState = { ...s, dim: 1, emergency: 1, monitors: [false, false, false], wallDisplay: 'off', flicker: 0 };
        this.set.wideShot(frame, t, dead, {
          op2: { typing: false, lean: -1, headTurn: 0.8 }, op1: { typing: false, lean: -1 }, control: { typing: false, headTurn: 0.5 }, tech: { visible: true, frantic: false },
        }, { x: 320, y: 135, zoom: 1, shake: t >= IMPACT_T ? 3 : 0 });
        break;
      }
      case 'black':
        this.renderBlack(frame, t);
        break;
    }
    if (t < 0.3) darken(frame, 0, 0, VIEW_W, VIEW_H, 1 - t / 0.3);
  }

  private renderPush(frame: Ctx2D, t: number, s: BunkerState): void {
    // A dark room; one monitor alive. Camera pushes in until the monitor fills the frame.
    const u = span(t, 17.0, 19.5, easeInOutCubic);
    const ctx = this.monitorRoom.ctx;
    rect(ctx, 0, 0, 480, 270, '#030405');
    // emergency wash on the wall behind
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.1));
    ctx.fillStyle = `rgba(110,12,12,${(0.10 * pulse).toFixed(3)})`;
    ctx.fillRect(0, 0, 480, 270);
    // desk and keyboard edge (lit by the screen)
    rect(ctx, 80, 206, 320, 64, '#0b0c0e');
    rect(ctx, 80, 206, 320, 1, '#1c2124');
    rect(ctx, 180, 214, 120, 6, '#121518');
    // monitor: bezel 248×143 centred, screen 240×135 at (120,67)
    rect(ctx, 114, 61, 252, 147, '#15181b');
    rect(ctx, 114, 61, 252, 1, '#2a2f34');
    rect(ctx, 120, 67, 240, 135, '#000');
    drawCorridor(this.corridor.ctx, t, this.corridorState(t));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.corridor.canvas, 0, 0, CORRIDOR_W, CORRIDOR_H, 120, 67, 240, 135);
    // screen glow on the desk and the operator's hands at the keyboard
    ctx.fillStyle = 'rgba(190,200,190,0.06)';
    ctx.fillRect(100, 202, 280, 20);
    rect(ctx, 212,212, 6, 3, P.skinPale2);
    rect(ctx, 232, 213, 6, 3, P.skinPale2);
    // power LED
    rect(ctx, 356, 204, 2, 1, Math.floor(t * 2) % 2 === 0 ? '#2fbf4a' : '#1a3a1a');
    const zoom = 1 + u;
    frame.imageSmoothingEnabled = false;
    const srcW = 480 / zoom;
    const srcH = 270 / zoom;
    frame.drawImage(this.monitorRoom.canvas, 240 - srcW / 2, 134.5 - srcH / 2, srcW, srcH, 0, 0, VIEW_W, VIEW_H);
    void s;
  }

  private renderFeed(frame: Ctx2D, t: number): void {
    const cs = this.corridorState(t);
    drawCorridor(frame, t, cs);
    const near = cs.entityNear;
    feedTreatment(frame, t, { noise: near ? 0.25 : 0.03, tear: near ? 0.3 : 0.02, vignette: 0.55, scanlines: true, flicker: true, seed: 21, tint: 'rgba(40,60,70,0.10)' });
    const hud: HudInfo = {
      cam: 'INT-B17',
      sector: 'INTERNAL SECURITY - CORRIDOR B-17',
      station: 'SCOTLAND CONTROL - LEVEL 2',
      grid: 'CLASSIFIED',
      signal: 99,
      mode: 'INTERNAL',
      tracking: 'IDLE',
      recording: true,
      filmTime: 119 + t,
      channel: 'LOCAL LOOP',
      threat: t > 21 ? 'OCCUPANCY: 1' : undefined,
    };
    drawHud(frame, 0, 0, VIEW_W, VIEW_H, hud, t);
    if (cs.dark >= 1) {
      rect(frame, 0, 0, VIEW_W, VIEW_H, '#000');
      if (hash1(Math.floor(t * 30)) > 0.3) drawText(frame, 'NO SIGNAL', VIEW_W / 2, VIEW_H / 2 - 3, FONT_5x7, '#5a6a5a', { align: 'center' });
    }
  }

  private renderBlack(frame: Ctx2D, t: number): void {
    rect(frame, 0, 0, VIEW_W, VIEW_H, '#000');
    // the impact's afterglow for a fraction of a second
    const u = t - 28.1;
    if (u < 0.25) {
      frame.fillStyle = `rgba(120,20,20,${(0.25 * (1 - u / 0.25)).toFixed(3)})`;
      frame.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (t >= BANNER_T) {
      const a = span(t, BANNER_T, BANNER_T + 0.4);
      frame.globalAlpha = a;
      rect(frame, 60, 132, VIEW_W - 120, 1, '#7a1410');
      drawBanner(frame, 'JOINT SURVEILLANCE NETWORK - CONNECTION LOST', VIEW_W / 2, 136, '#ff4a3a', false, t);
      rect(frame, 60, 148, VIEW_W - 120, 1, '#7a1410');
      drawText(frame, 'SCOTLAND CONTROL  -  NO CARRIER', VIEW_W / 2, 154, FONT_3x5, '#7a1410', { align: 'center' });
      frame.globalAlpha = 1;
    } else if (t > 29.4 && t < 34.8) {
      // radio carrier indicator, faint
      const on = Math.floor(t * 4) % 2 === 0;
      drawText(frame, on ? 'RX  ...' : 'RX', 12, VIEW_H - 14, FONT_3x5, '#3a4a3a');
    }
    const fade = span(t, this.duration - 1.2, this.duration);
    if (fade > 0) darken(frame, 0, 0, VIEW_W, VIEW_H, fade);
    if (t >= 27.5 && t < 28.0 && Math.floor(t * 60) % 2 === 0) {
      // the last flicker of the emergency circuit before the impact
      frame.fillStyle = 'rgba(80,10,10,0.08)';
      frame.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  mix(t: number): AudioMix {
    if (t >= IMPACT_T) {
      const radio = (t > 29.4 && t < 32.6) || (t > 32.7 && t < 34.8);
      return mix({ radio: radio ? 0.9 : 0, static: radio ? 0.25 : 0, sub: t < 30 ? 0.3 * (1 - (t - IMPACT_T) / 2) : 0 });
    }
    const lightsOut = t >= LIGHTS_OFF;
    const feed = t >= 17.0;
    return mix({
      bunker: lightsOut ? 0.3 : 1,
      emergency: t >= EMERG_ON ? 0.7 : 0,
      radio: lightsOut ? 0.05 : 0.3,
      drone: feed ? 0.45 + span(t, 19.5, 26) * 0.45 : t > 9 ? 0.3 : 0.4,
      sub: t > 24 ? 0.5 : feed ? 0.2 : 0,
      static: feed ? 0.1 : t < 1.5 ? 0.3 : 0,
      alarm: t < 1.4 ? 0.4 : 0,
    });
  }
}

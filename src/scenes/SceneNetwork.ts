/**
 * SCENE FOUR — THE NETWORK (37 s)
 * Every camera on the river. Four feeds, one entity, identical timestamps.
 * Then the map: Edinburgh, the Central Belt, Faslane — all at once.
 */
import type { Ctx2D } from '../engine/Surface';
import { createSurface, rect, VIEW_H, VIEW_W, type Surface, hline, vline } from '../engine/Surface';
import { easeInOutCubic, span } from '../engine/Easing';
import { noise1 } from '../engine/Rng';
import { CLYDE_H, CLYDE_W, drawClydeWorld, type EntityPlacement } from '../environments/clyde';
import { drawCentralWorld, drawIndustrialWorld, drawM8World, FEED_H, FEED_W } from '../environments/feeds';
import { drawLoomingHead, headRaisePose, standPose, walkPose } from '../creatures/Entity';
import { drawRain } from '../particles/Rain';
import { drawBanner, drawHud, drawStatic, type HudInfo } from '../surveillance/Overlay';
import { mix, type AudioMix } from '../audio/AudioMix';
import type { Scene, SceneCue } from './Scene';
import { cue, feedTreatment, LOW_LIGHT_GAIN, LOW_LIGHT_TINT, shotAt } from './common';
import { BunkerSet } from './bunkerShots';
import { fluorescentFlicker, darken } from '../lighting/Lighting';
import type { BunkerState } from '../environments/commandCentre';
import type { StationStatus } from '../environments/scotlandMap';
import { drawText, FONT_3x5 } from '../engine/Font';

type Shot = 'ctl' | 'wide' | 'quad' | 'op2' | 'ctl2' | 'op1' | 'wide2' | 'mapIn' | 'ctl3' | 'tech' | 'wide3' | 'op1b';
const SHOTS: ReadonlyArray<readonly [number, Shot]> = [
  [0, 'ctl'], [4.8, 'wide'], [7.5, 'quad'], [13.5, 'op2'], [15.3, 'ctl2'], [17.3, 'op1'], [19.9, 'wide2'], [24.6, 'mapIn'],
  [28.6, 'ctl3'], [31.0, 'tech'], [32.8, 'wide3'], [34.2, 'op1b'],
];

const TILE_T = [7.5, 9.0, 10.5, 12.0];
const UNAUTH_T = 33.0;

export class SceneNetwork implements Scene {
  readonly id = 'network';
  readonly title = '4. The Network';
  readonly duration = 37;
  readonly cues: SceneCue[] = [
    cue(0.4, 'squelch-open'),
    cue(5.1, 'squelch-open'),
    cue(8.1, 'squelch-close'),
    ...TILE_T.map((t) => cue(t, 'monitor-on')),
    cue(19.9, 'squelch-open'),
    cue(23.3, 'squelch-close'),
    cue(24.7, 'squelch-open'),
    cue(28.3, 'squelch-close'),
    cue(25.4, 'alert'),
    cue(26.2, 'alert'),
    cue(27.0, 'alert'),
    cue(UNAUTH_T, 'alert-long'),
    cue(UNAUTH_T + 0.1, 'glitch'),
  ];
  private set!: BunkerSet;
  private clyde!: Surface;
  private central!: Surface;
  private m8!: Surface;
  private industrial!: Surface;

  init(): void {
    this.set = new BunkerSet();
    this.clyde = createSurface(CLYDE_W, CLYDE_H);
    this.central = createSurface(FEED_W, FEED_H);
    this.m8 = createSurface(FEED_W, FEED_H);
    this.industrial = createSurface(FEED_W, FEED_H);
  }

  private overrides(t: number): Partial<Record<string, StationStatus>> {
    const o: Partial<Record<string, StationStatus>> = { gw: 'alert' };
    if (t >= 7.5) o.gc = 'alert';
    if (t >= 9.0) o.m8 = 'alert';
    if (t >= 10.5) o.cb = 'alert';
    if (t >= 25.4) o.ed = 'alert';
    if (t >= 26.2) { o.li = 'alert'; o.fk = 'alert'; o.mw = 'alert'; }
    if (t >= 27.0) o.fa = 'alert';
    if (t >= 27.6) { o.pa = 'alert'; o.gk = 'alert'; }
    if (t >= UNAUTH_T) o.co = 'compromised';
    return o;
  }

  private state(t: number): BunkerState {
    return {
      filmTime: 82 + t,
      alert: t < 25.4 ? 'GLASGOW SECTOR - MULTIPLE DETECTIONS' : 'JOINT NETWORK - SIMULTANEOUS DETECTIONS',
      alertStrong: t >= 25.4,
      alert2: t >= UNAUTH_T ? 'UNAUTHORISED VIDEO SOURCE DETECTED' : undefined,
      mapOverrides: this.overrides(t),
      dim: 0,
      emergency: 0,
      monitors: [true, true, true],
      wallDisplay: 'map',
      flicker: fluorescentFlicker(t, 2, t > UNAUTH_T ? 0.2 : 0.04),
    };
  }

  render(frame: Ctx2D, t: number): void {
    const s = this.state(t);
    const shot = shotAt(t, SHOTS);
    const dial = (base: string) => base; // speaker lines handled by subtitles
    void dial;
    switch (shot) {
      case 'ctl':
        this.set.closeup(frame, t, s, 'control', { expression: 'focused', handToHeadset: true, headTurn: -0.2, lookX: -1, lookY: 1, lean: 0.6 }, 1, 212,0.5);
        break;
      case 'wide':
      case 'wide2':
      case 'wide3':
        this.set.wideShot(frame, t, s, {
          op2: { typing: shot === 'wide', headTurn: shot === 'wide' ? 0 : 0.5 },
          op1: { typing: shot !== 'wide3', lean: 0.5 },
          control: { typing: false, headTurn: shot === 'wide3' ? -0.6 : 0.2, handToHeadset: true },
          tech: { visible: true, frantic: shot !== 'wide' },
        }, { x: shot === 'wide3' ? 330 : 318, y: 135, zoom: 1, shake: 0 });
        break;
      case 'quad':
        this.renderQuad(frame, t);
        break;
      case 'op2':
        this.set.closeup(frame, t, s, 'op2', { expression: 'alarmed', lookX: 0, lookY: 1, lean: 0.8, typing: false, headTilt: 1 }, 1, 212,0.6);
        break;
      case 'ctl2':
        this.set.closeup(frame, t, s, 'control', { expression: 'concerned', lookX: -1, lookY: 0, headTurn: -0.5, handToHeadset: false, lean: 0.3 }, 1, 212,0.5);
        break;
      case 'op1':
        this.set.closeup(frame, t, s, 'op1', { expression: 'concerned', lookX: 0, lookY: 1, typing: t < 18.0, lean: 0.6 }, -1, 212,0.8);
        break;
      case 'mapIn': {
        const u = span(t, 24.6, 28.6, easeInOutCubic);
        this.set.wideShot(frame, t, s, {
          op2: { typing: false, headTurn: 0.4, lean: -0.3 },
          op1: { typing: false, lean: -0.5 },
          control: { typing: false, headTurn: 0.3, handToHeadset: true, lean: -0.5 },
          tech: { visible: true, frantic: true },
        }, { x: 262 + (300 - 262) * u, y: 135 + (94 - 135) * u, zoom: 1 + u, shake: 0 });
        break;
      }
      case 'ctl3':
        this.set.closeup(frame, t, s, 'control', { expression: 'concerned', lookX: 1, lookY: -1, headTurn: 0.6, handToHeadset: false, lean: -0.4, headTilt: -1 }, 1, 212,0.7);
        break;
      case 'tech':
        this.set.closeup(frame, t, s, 'tech', { expression: 'fear', lookX: Math.sin(t * 9) > 0 ? 1 : -1, lookY: 1, typing: true, lean: 1, headTilt: 1 }, -1, 212,0.7);
        break;
      case 'op1b':
        this.set.closeup(frame, t, s, 'op1', { expression: t > 35.5 ? 'fear' : 'alarmed', lookX: 0, lookY: 1, typing: false, lean: t > 35 ? -0.8 : 0.4, headTilt: t > 35 ? -1 : 1 }, -1, 212,1);
        break;
    }
    if (shot !== 'quad' && t >= UNAUTH_T && t < UNAUTH_T + 0.15) {
      // a hard glitch rips through the room's lighting as the network is breached
      frame.fillStyle = 'rgba(255,255,255,0.35)';
      frame.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (t < 0.4) darken(frame, 0, 0, VIEW_W, VIEW_H, 1 - t / 0.4);
  }

  private entityFor(cam: 'A' | 'B' | 'C' | 'D', t: number): EntityPlacement {
    const dark = { dark: '#07070b', mid: '#121018', rim: '#1d1923' };
    switch (cam) {
      case 'A': {
        // far under the railway bridge, walking slowly behind the columns
        const x = 262 - (t - 7.5) * 2.2;
        return { x: Math.round(x), y: 176, H: 15, pose: walkPose((x / 10) % 1, t), style: { mode: 'silhouette', yaw: Math.PI, dark: '#050507', stillHead: true } };
      }
      case 'B': {
        // crossing the carriageway
        const x = 310 - (t - 9.0) * 6.5;
        return { x: Math.round(x), y: 186, H: 24, pose: walkPose((x / 14) % 1, t), style: { mode: 'optical', yaw: Math.PI - 0.1, ...dark, stillHead: true } };
      }
      case 'C':
        // beneath the gantry; completely motionless
        return { x: 238, y: 204, H: 46, pose: standPose(t * 0.0001, 9), style: { mode: 'optical', yaw: Math.PI / 2, dark: '#07070b', mid: '#110f16', rim: '#19161f', face: 0.5 } };
      case 'D':
      default:
        // still standing beneath CAM-12
        return { x: 268, y: 330, H: 190, pose: headRaisePose(standPose(t, 6), 1), style: { mode: 'optical', yaw: Math.PI / 2, dark: '#08070c', mid: '#15121b', rim: '#221d2a', face: 1 }, looming: true };
    }
  }

  private renderQuad(frame: Ctx2D, t: number): void {
    rect(frame, 0, 0, VIEW_W, VIEW_H, '#05070a');
    const tiles: Array<{ cam: 'A' | 'B' | 'C' | 'D'; label: string; sector: string; x: number; y: number; world: Surface; draw: (e: EntityPlacement) => void; cx: number; cy: number; grid: string }> = [
      { cam: 'A', label: 'CAM-A', sector: 'GLASGOW CENTRAL', x: 0, y: 0, world: this.central, draw: (e) => drawCentralWorld(this.central.ctx, t, e), cx: 240, cy: 150, grid: 'NS 5874 6520' },
      { cam: 'B', label: 'CAM-B', sector: 'M8 - KINGSTON', x: 240, y: 0, world: this.m8, draw: (e) => drawM8World(this.m8.ctx, t, e), cx: 250, cy: 172, grid: 'NS 5802 6540' },
      { cam: 'C', label: 'CAM-C', sector: 'INDUSTRIAL - GOVAN', x: 0, y: 135, world: this.industrial, draw: (e) => drawIndustrialWorld(this.industrial.ctx, t, e), cx: 240, cy: 162, grid: 'NS 5540 6580' },
      { cam: 'D', label: 'CAM-12', sector: 'CLYDE WATERFRONT', x: 240, y: 135, world: this.clyde, draw: (e) => drawClydeWorld(this.clyde.ctx, t, { lightning: 0, entity: e }), cx: 268, cy: 202, grid: 'NS 5712 6541' },
    ];
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const on = t >= TILE_T[i];
      const tx = tile.x;
      const ty = tile.y;
      if (!on) {
        rect(frame, tx, ty, 240, 135, '#030405');
        drawText(frame, `${tile.label}  ACQUIRING...`, tx + 120, ty + 64, FONT_3x5, '#3a5a40', { align: 'center' });
        continue;
      }
      const age = t - TILE_T[i];
      const ent = this.entityFor(tile.cam, t);
      tile.draw(ent);
      // 1:1 crop centred on the subject
      const sx = Math.max(0, Math.min(tile.world.w - 240, Math.round(tile.cx - 120)));
      const sy = Math.max(0, Math.min(tile.world.h - 135, Math.round(tile.cy - 67)));
      frame.drawImage(tile.world.canvas, sx, sy, 240, 135, tx, ty, 240, 135);
      if (ent.looming) {
        frame.save();
        frame.beginPath();
        frame.rect(tx, ty, 240, 135);
        frame.clip();
        drawLoomingHead(frame, tx + 126, ty + 118, 0.5, t, { mode: 'optical', face: 1, light: -1 });
        frame.restore();
      }
      if (tile.cam !== 'C') {
        drawRain(frame, t, { x: tx, y: ty, w: 240, h: 135, count: 70, wind: -50, speed: 400, length: 6, colour: 'rgba(175,195,215,0.28)', seed: i + 3 });
      } else {
        drawRain(frame, t, { x: tx, y: ty, w: 240, h: 135, count: 40, wind: -30, speed: 360, length: 5, colour: 'rgba(175,195,215,0.2)', seed: i + 3 });
      }
      feedTreatment(frame, t, { noise: 0.2, tear: 0.04, tint: LOW_LIGHT_TINT, intensify: LOW_LIGHT_GAIN, vignette: 0.5, scanlines: true, flicker: true, seed: i + 11 }, tx, ty, 240, 135);
      const hud: HudInfo = {
        cam: tile.label,
        sector: tile.sector,
        station: '',
        grid: tile.grid,
        signal: 80 + Math.round(noise1(t + i, 4) * 10),
        mode: 'LOW-LIGHT',
        tracking: tile.cam === 'C' ? 'LOCK' : 'TRACK',
        recording: true,
        filmTime: 82 + t,
        compact: true,
      };
      drawHud(frame, tx, ty, 240, 135, hud, t);
      // the identical timestamp is the point — flag it on every tile
      drawText(frame, 'TGT 01  H 4.1m', tx + 6, ty + 135 - 24, FONT_3x5, '#e2b544', { shadow: '#000' });
      if (age < 0.35) drawStatic(frame, tx, ty, 240, 135, t, 1 - age / 0.35);
    }
    // bezel cross
    rect(frame, 239, 0, 2, VIEW_H, '#0d1012');
    rect(frame, 0, 134, VIEW_W, 2, '#0d1012');
    hline(frame, 0, VIEW_W, 0, '#0d1012');
    vline(frame, 0, 0, VIEW_H, '#0d1012');
    if (t >= 12.6) drawBanner(frame, 'SYNC: 4 FEEDS  T=IDENTICAL  SEP 3.1 km', VIEW_W / 2, VIEW_H - 16, '#ff5a4a', true, t);
  }

  mix(t: number): AudioMix {
    const quad = t >= 7.5 && t < 13.5;
    const radioLine = (t > 5.0 && t < 8.2) || (t > 19.8 && t < 23.4) || (t > 24.6 && t < 28.4);
    return mix({
      bunker: quad ? 0.4 : 1,
      rain: quad ? 0.7 : 0,
      wind: quad ? 0.4 : 0,
      radio: radioLine ? 0.9 : 0.3,
      drone: 0.3 + span(t, 20, 36) * 0.4,
      sub: t > 25 ? 0.3 : 0.1,
      alarm: t >= UNAUTH_T && t < UNAUTH_T + 2.6 ? 0.6 : 0,
      static: quad ? 0.15 : t >= UNAUTH_T ? 0.2 : 0,
    });
  }
}

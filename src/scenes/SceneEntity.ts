/**
 * SCENE THREE — THE ENTITY (30 s)
 * It walks wrong. It stops. It looks at the lens. It points. Then it is
 * somewhere else — three times — and the tracker dies.
 */
import type { Ctx2D } from '../engine/Surface';
import { createSurface, disc, line, VIEW_H, VIEW_W, type Surface } from '../engine/Surface';
import { easeInOutQuad, keyframes, span } from '../engine/Easing';
import { hash1, noise1 } from '../engine/Rng';
import { CLYDE_H, CLYDE_W, drawClydeWorld, type EntityPlacement } from '../environments/clyde';
import { blendPose, drawLoomingHead, headRaisePose, headTurnPose, pointPose, standPose, walkPose, type Pose } from '../creatures/Entity';
import { drawRain } from '../particles/Rain';
import { drawFog } from '../particles/Fog';
import { drawHud, drawReticle, drawStatic, type HudInfo } from '../surveillance/Overlay';
import { cameraWindow, worldToFrame, type CameraState } from '../camera/Camera';
import { mix, type AudioMix } from '../audio/AudioMix';
import type { Scene, SceneCue } from './Scene';
import { cue, feedTreatment, lightningAt, LOW_LIGHT_GAIN, LOW_LIGHT_TINT, shoot } from './common';
import { BunkerSet } from './bunkerShots';
import { fluorescentFlicker } from '../lighting/Lighting';

const STRIKES = [[8.5, 0.6], [16.2, 0.9]] as const;
const STOP_T = 11.0;
const TURN_T = 14.0;
const POINT_T = 19.5;
const JUMP_A = 22.5;
const JUMP_B = 23.3;
const JUMP_C = 24.1;
const FAIL_T = 25.3;
const STATIC_T = 25.9;
const CUT_T = 26.8;

export class SceneEntity implements Scene {
  readonly id = 'entity';
  readonly title = '3. The Entity';
  readonly duration = 30;
  readonly cues: SceneCue[] = [
    cue(0.2, 'blip'),
    cue(8.5, 'thunder'),
    cue(STOP_T, 'motor'),
    cue(TURN_T, 'sub-hit'),
    cue(16.2, 'thunder'),
    cue(POINT_T + 0.4, 'heartbeat'),
    cue(JUMP_A, 'glitch'),
    cue(JUMP_B, 'glitch'),
    cue(JUMP_C, 'glitch'),
    cue(JUMP_C + 0.05, 'sub-hit'),
    cue(FAIL_T, 'lost'),
    cue(STATIC_T, 'glitch'),
    cue(CUT_T, 'monitor-off'),
  ];
  private world!: Surface;
  private set!: BunkerSet;

  init(): void {
    this.world = createSurface(CLYDE_W, CLYDE_H);
    this.set = new BunkerSet();
  }

  entity(t: number): EntityPlacement | undefined {
    const dark = { dark: '#0a0910', mid: '#1e1826', rim: '#3a3044' };
    if (t < JUMP_A) {
      // Walking leftwards along the quay, stops, turns its head, points.
      const x = t < STOP_T ? 472 - t * 8.4 : 472 - STOP_T * 8.4;
      const phase = (x / 16) % 1;
      let pose: Pose;
      let bob = 0;
      if (t < STOP_T) {
        pose = walkPose(phase, t);
        bob = 0.012 * Math.abs(Math.sin(phase * Math.PI * 2));
        // settle into stillness over the last half second
        const settle = span(t, STOP_T - 0.5, STOP_T);
        if (settle > 0) pose = blendPose(pose, standPose(t, 3), settle);
      } else {
        pose = standPose(t, 3);
      }
      const turn = span(t, TURN_T, TURN_T + 1.4, easeInOutQuad);
      if (turn > 0) pose = headTurnPose(pose, turn);
      const point = span(t, POINT_T, POINT_T + 2.2, easeInOutQuad);
      if (point > 0) pose = pointPose(pose, point);
      // As it stops, the body twists part-way towards the lens; the head turn finishes the job.
      const twist = span(t, STOP_T - 0.4, STOP_T + 1.2, easeInOutQuad);
      const yaw = Math.PI - 0.12 - twist * 0.95 - turn * 0.25;
      return {
        x: Math.round(x), y: 246, H: 32, pose,
        style: { mode: 'optical', yaw, ...dark, rim: '#30283a', stillHead: true, bob, face: turn },
      };
    }
    if (t < JUMP_B) {
      // beneath the Kingston Bridge, in the dark under the deck
      if (t < JUMP_A + 0.08) return undefined; // a blank frame
      return { x: 478, y: 200, H: 22, pose: standPose(t, 4), style: { mode: 'optical', yaw: Math.PI / 2, ...dark, face: 0.6 } };
    }
    if (t < JUMP_C) {
      if (t < JUMP_B + 0.08) return undefined;
      // beside the river, standing in the flood water
      return { x: 150, y: 206, H: 22, pose: standPose(t, 5), style: { mode: 'optical', yaw: Math.PI / 2, ...dark, face: 0.8 } };
    }
    if (t < CUT_T) {
      if (t < JUMP_C + 0.08) return undefined;
      // directly beneath the observation post, looking up
      return { x: 268, y: 470, H: 310, pose: headRaisePose(standPose(t, 6), 1), style: { mode: 'optical', yaw: Math.PI / 2, dark: '#0b0a10', mid: '#18141f', rim: '#262030', face: 1 }, looming: true };
    }
    return undefined;
  }

  camera(t: number, e?: EntityPlacement): CameraState {
    if (t >= JUMP_A) {
      // tracker drops to wide on loss of lock
      return { x: 272, y: 150, zoom: 1, shake: t > FAIL_T ? 1 : 0 };
    }
    const x = e ? e.x - 4 : 380;
    // The operators magnify again as it stops: ×2 while it walks, ×3 once it is still.
    const zoom = t >= STOP_T + 0.6 ? 3 : 2;
    const yKey = keyframes(t, [[STOP_T, 212], [STOP_T + 0.6, 232], [POINT_T, 232], [POINT_T + 2, 228]], easeInOutQuad);
    return { x, y: yKey, zoom, shake: 0 };
  }

  render(frame: Ctx2D, t: number): void {
    if (t >= CUT_T) {
      this.renderRoom(frame, t);
      return;
    }
    const e = this.entity(t);
    const flash = lightningAt(t, STRIKES);
    drawClydeWorld(this.world.ctx, t, { lightning: flash, entity: e });
    const cam = this.camera(t, e);
    shoot(frame, this.world, cam, t);
    const win = cameraWindow(cam, CLYDE_W, CLYDE_H, t);
    if (e?.looming) {
      // directly beneath the observation post: the skull fills the lower frame, looking up
      const rise = span(t, JUMP_C + 0.08, CUT_T) * 6;
      drawLoomingHead(frame, 252, 236 - rise, 1.0, t, { mode: 'optical', face: 1, light: -1 });
    }

    // The pointing hand, foreshortened towards the lens
    const point = span(t, POINT_T + 0.6, POINT_T + 2.2, easeInOutQuad);
    if (point > 0 && e && t < JUMP_A) {
      // shoulder → hand, foreshortened: the arm thickens as it comes at the lens
      const sh = worldToFrame(cam, CLYDE_W, CLYDE_H, t, e.x - 2, e.y - e.H * 0.72);
      const hx = Math.round(sh.x - point * 14);
      const hy = Math.round(sh.y - point * 4);
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const u0 = i / steps;
        const u1 = (i + 1) / steps;
        line(frame, sh.x + (hx - sh.x) * u0, sh.y + (hy - sh.y) * u0, sh.x + (hx - sh.x) * u1, sh.y + (hy - sh.y) * u1, '#0a090e', 2 + Math.round(point * 5 * u1));
      }
      const r = Math.max(2, Math.round(2 + point * 7));
      disc(frame, hx, hy, r, '#0a090e');
      disc(frame, hx - 1, hy - 1, Math.max(1, r - 2), '#1e1826');
      // fingers splayed at the viewer; the index finger far too long, aimed at the lens centre
      const fl = Math.round(5 + point * 14);
      const angles = [-2.6, -1.9, -1.1, 2.4, 0.4];
      for (let k = 0; k < angles.length; k++) {
        const a = angles[k];
        const len = k === 2 ? fl * 1.9 : fl;
        line(frame, hx, hy, hx + Math.cos(a) * len, hy + Math.sin(a) * len, '#0a090e', k === 2 ? 3 : 2);
        line(frame, hx, hy, hx + Math.cos(a) * len, hy + Math.sin(a) * len, '#2a2232', 1);
      }
    }

    drawFog(frame, t, { x: 0, y: 70, w: VIEW_W, h: 110, colour: 'rgba(120,140,165,0.10)', density: 0.5, drift: 9, scale: 36, seed: 4, fadeTop: 0.5, step: 2 });
    drawRain(frame, t, {
      count: Math.round(230 / win.zoom), wind: -55 * win.zoom, speed: 430 * win.zoom, length: Math.round(7 * win.zoom), w: VIEW_W, h: VIEW_H,
      colour: 'rgba(175,195,215,0.30)', colourBright: 'rgba(210,225,240,0.55)', seed: 1,
    });

    // Signal degrades as it approaches
    const fail = span(t, FAIL_T, STATIC_T);
    const tear = t >= JUMP_A ? 0.25 + fail * 0.7 : t >= POINT_T ? 0.08 : 0.03;
    feedTreatment(frame, t, { noise: 0.2 + fail * 0.5, tear, tint: LOW_LIGHT_TINT, intensify: LOW_LIGHT_GAIN, vignette: 0.6, scanlines: true, flicker: true, seed: 5 });

    // Reticle & HUD
    let tracking: HudInfo['tracking'] = 'TRACK';
    if (t >= JUMP_A) tracking = Math.floor(t * 8) % 2 === 0 ? 'LOST' : 'TRACK';
    if (t >= FAIL_T) tracking = 'LOST';
    if (e && t < JUMP_A) {
      const p = worldToFrame(cam, CLYDE_W, CLYDE_H, t, e.x, e.y - e.H * 0.5);
      const boxH = e.H * win.zoom + 8;
      drawReticle(frame, p.x, p.y, Math.round(boxH * 0.6), Math.round(boxH), '#e2b544', t, `TGT 01  H 4.${t > 4 ? '3' : '1'}m`);
    } else if (e && t < FAIL_T) {
      const p = worldToFrame(cam, CLYDE_W, CLYDE_H, t, e.x, Math.min(VIEW_H - 20, e.y - e.H * 0.5));
      const boxH = Math.min(120, e.H * win.zoom + 8);
      drawReticle(frame, p.x, Math.min(VIEW_H - boxH / 2 - 10, p.y), Math.round(boxH * 0.6), Math.round(boxH), '#ff5a4a', t, 'TGT 01  ??');
    }
    const hud: HudInfo = {
      cam: 'CAM-12',
      sector: 'GLASGOW WEST - CLYDE CORRIDOR',
      station: 'REMOTE OPTICAL STATION',
      grid: 'NS 5712 6541',
      signal: Math.max(8, 90 - Math.round(fail * 70) + Math.round(noise1(t * 1.3, 8) * 4 - 2)),
      mode: 'LOW-LIGHT',
      tracking,
      recording: true,
      filmTime: 52 + t,
      radMicroSv: 1.84 + noise1(t * 0.8, 3) * 0.1 + (t > TURN_T ? span(t, TURN_T, FAIL_T) * 0.9 : 0),
      tempC: 7.2 - (t > TURN_T ? span(t, TURN_T, JUMP_A) * 3.1 : 0),
      channel: 'CH 12  JSRN-W',
      threat: t >= 9.0 ? 'CAT: BLACK - UNRESOLVED' : 'CAT: PENDING - NO MATCH',
      zoom: win.zoom,
    };
    drawHud(frame, 0, 0, VIEW_W, VIEW_H, hud, t);

    if (t >= STATIC_T) {
      const u = span(t, STATIC_T, STATIC_T + 0.3);
      drawStatic(frame, 0, 0, VIEW_W, VIEW_H, t, 0.6 + 0.4 * u);
      if (u >= 1 && hash1(Math.floor(t * 30)) > 0.5) drawHud(frame, 0, 0, VIEW_W, VIEW_H, { ...hud, signal: 0, tracking: 'LOST' }, t);
    }
  }

  private renderRoom(frame: Ctx2D, t: number): void {
    // Cut to the command centre. Nobody speaks.
    const u = t - CUT_T;
    this.set.wideShot(frame, t, {
      filmTime: 52 + t,
      alert: 'GLASGOW SECTOR - TRACK LOST',
      alertStrong: true,
      mapOverrides: { gw: 'alert' },
      dim: 0,
      emergency: 0,
      monitors: [true, false, true],
      wallDisplay: 'map',
      flicker: fluorescentFlicker(t, 1, 0.05),
    }, {
      op2: { typing: false, headTurn: 0.9, lean: -0.6 },
      op1: { typing: false, lean: -1 },
      control: { typing: false, headTurn: -0.5, handToHeadset: false, lean: 0.5 },
      tech: { visible: true, frantic: false },
    }, { x: 322, y: 140, zoom: 1, shake: 0 });
    // the room is a little darker than before; the moment lands in silence
    frame.fillStyle = `rgba(0,0,0,${(0.25 * Math.max(0, 1 - u)).toFixed(3)})`;
    frame.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  mix(t: number): AudioMix {
    if (t >= CUT_T) return mix({ bunker: 1, radio: 0.2, drone: 0.25, sub: 0.15 });
    const fail = span(t, FAIL_T, STATIC_T);
    return mix({
      rain: 1,
      wind: 0.8,
      river: 0.7,
      radio: 0.3,
      static: 0.08 + fail * 0.9 + (t >= JUMP_A ? 0.3 : 0),
      drone: t > TURN_T ? 0.5 : 0.22,
      sub: t > POINT_T ? 0.5 : t > TURN_T ? 0.25 : 0,
    });
  }
}

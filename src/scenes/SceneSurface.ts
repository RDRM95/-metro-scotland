/**
 * SCENE TWO — GLASGOW SURFACE (28 s)
 * CAM-12 on the Clyde. Rain. Something moves between the vehicles.
 */
import type { Ctx2D } from '../engine/Surface';
import { createSurface, VIEW_H, VIEW_W, type Surface } from '../engine/Surface';
import { keyframes, easeInOutQuad, span, easeOutCubic } from '../engine/Easing';
import { noise1 } from '../engine/Rng';
import { CLYDE_H, CLYDE_W, drawClydeWorld, type EntityPlacement } from '../environments/clyde';
import { standPose, walkPose, blendPose, type Pose } from '../creatures/Entity';
import { drawRain } from '../particles/Rain';
import { drawFog } from '../particles/Fog';
import { drawHud, drawReticle, drawStatic, type HudInfo } from '../surveillance/Overlay';
import { thermalise } from '../surveillance/Thermal';
import { cameraWindow, worldToFrame, type CameraState } from '../camera/Camera';
import { mix, type AudioMix } from '../audio/AudioMix';
import type { Scene, SceneCue } from './Scene';
import { cue, feedTreatment, lightningAt, LOW_LIGHT_GAIN, LOW_LIGHT_TINT, shoot } from './common';
import { P } from '../engine/Palette';

const STRIKES = [[3.2, 1], [18.4, 0.7]] as const;
const THERMAL_T = 21.5;

export class SceneSurface implements Scene {
  readonly id = 'surface';
  readonly title = '2. Glasgow Surface';
  readonly duration = 28;
  readonly cues: SceneCue[] = [
    cue(0.02, 'glitch'),
    cue(3.2, 'thunder'),
    cue(7.3, 'blip'),
    cue(7.4, 'motor'),
    cue(9.6, 'motor-long'),
    cue(12.6, 'blip'),
    cue(16.6, 'lost'),
    cue(18.4, 'thunder'),
    cue(THERMAL_T, 'thermal'),
    cue(22.5, 'blip'),
    cue(26.0, 'heartbeat'),
  ];
  private world!: Surface;

  init(): void {
    this.world = createSurface(CLYDE_W, CLYDE_H);
  }

  /** Entity position/pose for local time t, or undefined. */
  entity(t: number): EntityPlacement | undefined {
    const thermal = t >= THERMAL_T;
    if (t >= 7.3 && t < 16.6) {
      // Walks between the vehicles, pauses, then strides towards the pier.
      let x: number;
      let moving: boolean;
      if (t < 9.5) { x = 262 + (t - 7.3) * 17; moving = true; }
      else if (t < 11.5) { x = 300; moving = false; }
      else { x = 300 + (t - 11.5) * 27.5; moving = true; }
      const phase = (x / 15) % 1;
      const pose: Pose = moving ? walkPose(phase, t) : blendPose(standPose(t, 1), walkPose(phase, t), 0.1);
      return {
        x: Math.round(x), y: 234, H: 28, pose,
        style: { mode: 'optical', yaw: 0.15, dark: '#0a0910', mid: '#161320', rim: '#221d2c', alpha: 0.95, stillHead: true, bob: moving ? 0.015 * Math.abs(Math.sin(phase * Math.PI * 2)) : 0 },
      };
    }
    if (t >= 22.4) {
      const x = 452 + Math.min(1, (t - 22.4) / 3.0) * 26;
      const moving = t < 25.4;
      const phase = (x / 15) % 1;
      const turn = span(t, 25.4, 27.6, easeInOutQuad);
      const yaw = 0.15 + turn * (Math.PI / 2 - 0.15);
      const pose = moving ? walkPose(phase, t) : standPose(t, 2);
      return {
        x: Math.round(x), y: 250, H: 42, pose,
        style: thermal
          ? { mode: 'thermal', yaw, cold: 1, stillHead: true, face: turn > 0.7 ? (turn - 0.7) / 0.3 : 0 }
          : { mode: 'optical', yaw, dark: '#0a0910', mid: '#161320', rim: '#221d2c', stillHead: true },
      };
    }
    return undefined;
  }

  camera(t: number, e?: EntityPlacement): CameraState {
    let x = keyframes(t, [[0, 268], [7.3, 268], [7.6, 276], [9.4, 298]], easeInOutQuad);
    const zoom = keyframes(t, [[9.5, 1], [11.2, 2]], easeInOutQuad);
    if (t >= 11.5 && e && t < 16.6) x = e.x + 8;
    else if (t >= 16.6 && t < 22.4) x = 446;
    else if (t >= 22.4 && e) x = Math.min(440, e.x - 6);
    const y = t < 9.5 ? 150 : 212;
    return { x, y, zoom, shake: 0 };
  }

  render(frame: Ctx2D, t: number): void {
    const e = this.entity(t);
    const flash = lightningAt(t, STRIKES);
    const thermal = t >= THERMAL_T;
    drawClydeWorld(this.world.ctx, t, { lightning: flash, entity: e, thermal });

    const cam = this.camera(t, e);
    shoot(frame, this.world, cam, t);

    // Weather in frame space (between lens and world)
    const win = cameraWindow(cam, CLYDE_W, CLYDE_H, t);
    const rainScale = win.zoom;
    drawFog(frame, t, { x: 0, y: 70, w: VIEW_W, h: 110, colour: thermal ? 'rgba(40,40,40,0.5)' : 'rgba(120,140,165,0.10)', density: 0.55, drift: 9, scale: 36, seed: 4, fadeTop: 0.5, step: 2 });
    drawRain(frame, t, {
      count: Math.round(230 / rainScale), wind: -55 * rainScale, speed: 430 * rainScale, length: Math.round(7 * rainScale), w: VIEW_W, h: VIEW_H,
      colour: thermal ? 'rgba(20,20,30,0.5)' : 'rgba(175,195,215,0.30)', colourBright: thermal ? undefined : 'rgba(210,225,240,0.55)', seed: 1,
    });

    if (thermal) {
      const u = span(t, THERMAL_T, THERMAL_T + 0.5);
      thermalise(frame, 0, 0, VIEW_W, VIEW_H, t, { gain: 1.35, floor: 0.07 });
      if (u < 1) {
        // switching: a white wipe collapsing to the new image
        frame.fillStyle = `rgba(255,255,255,${(0.9 * (1 - u)).toFixed(3)})`;
        frame.fillRect(0, 0, VIEW_W, Math.round(VIEW_H * (1 - u)));
      }
      feedTreatment(frame, t, { noise: 0.35, tear: 0.03, vignette: 0.5, scanlines: true, flicker: false, seed: 2 });
    } else {
      const lostTear = t >= 16.4 && t < 17.2 ? 0.6 : 0.04;
      feedTreatment(frame, t, { noise: 0.2, tear: lostTear, tint: LOW_LIGHT_TINT, intensify: LOW_LIGHT_GAIN, vignette: 0.6, scanlines: true, flicker: true, seed: 2 });
    }

    // Tracking reticle
    const tracking = t >= 9.6 && t < 16.6 && e ? 'TRACK' : t >= 22.5 && e ? 'TRACK' : t >= 16.6 && t < 22.4 ? 'LOST' : t >= 7.3 ? 'MOTION' : 'IDLE';
    if (e && (tracking === 'TRACK' || tracking === 'MOTION')) {
      const p = worldToFrame(cam, CLYDE_W, CLYDE_H, t, e.x, e.y - e.H * 0.5);
      const boxH = e.H * win.zoom + 8;
      const col = thermal ? '#ffe9b0' : tracking === 'TRACK' ? '#e2b544' : '#b9d9b5';
      const label = tracking === 'TRACK' ? (thermal ? 'TGT 01  TH 4.1m' : `TGT 01  H ${(e.H / 7).toFixed(1)}m`) : 'MOTION';
      drawReticle(frame, p.x, p.y, Math.round(boxH * 0.6), Math.round(boxH), col, t, label);
    }

    const hud: HudInfo = {
      cam: 'CAM-12',
      sector: 'GLASGOW WEST - CLYDE CORRIDOR',
      station: 'REMOTE OPTICAL STATION',
      grid: 'NS 5712 6541',
      signal: 91 + Math.round(noise1(t * 1.3, 8) * 4 - 2) - (tracking === 'LOST' ? 6 : 0),
      mode: thermal ? 'THERMAL' : 'LOW-LIGHT',
      tracking,
      recording: true,
      filmTime: 24 + t,
      radMicroSv: 1.84 + noise1(t * 0.8, 3) * 0.1,
      tempC: 7.2,
      channel: 'CH 12  JSRN-W',
      threat: t >= 12.6 ? (thermal ? 'CAT: PENDING - BIO?' : 'CAT: PENDING') : undefined,
      zoom: win.zoom,
    };
    drawHud(frame, 0, 0, VIEW_W, VIEW_H, hud, t);

    // Feed coming up: static for the first fraction of a second
    if (t < 0.25) drawStatic(frame, 0, 0, VIEW_W, VIEW_H, t, 1 - span(t, 0, 0.25, easeOutCubic));
    void P;
  }

  mix(t: number): AudioMix {
    const thermal = t >= THERMAL_T;
    return mix({
      rain: 1,
      wind: 0.8,
      river: 0.7,
      radio: 0.3,
      static: t >= 16.4 && t < 17.2 ? 0.6 : 0.08,
      drone: thermal ? 0.45 : t > 12 ? 0.18 : 0,
      sub: thermal ? 0.3 : 0,
    });
  }
}

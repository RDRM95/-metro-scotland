/**
 * Shared scene plumbing: world surfaces, camera crops, the surveillance
 * "feed treatment" post-process, lightning timing and key-click cue lists.
 */
import { applyCamera, type CameraState } from '../camera/Camera';
import { createSurface, VIEW_H, VIEW_W, type Ctx2D, type Surface } from '../engine/Surface';
import { hash1 } from '../engine/Rng';
import { drawNoise, drawScanlines, drawTear, signalFlicker } from '../surveillance/Overlay';
import { darken, vignette } from '../lighting/Lighting';
import { lowLightBlend } from '../surveillance/Thermal';
import type { SceneCue } from './Scene';

export function world(w: number, h: number): Surface {
  return createSurface(w, h);
}

/** Draw a world through a camera into the frame. */
export function shoot(frame: Ctx2D, w: Surface, cam: CameraState, t: number): void {
  applyCamera(frame, w, cam, t);
}

export interface FeedTreatment {
  /** Sensor noise amount 0..1 */
  noise: number;
  /** Horizontal tearing 0..1 */
  tear: number;
  /** Colour cast overlay, e.g. 'rgba(20,70,35,0.16)' for low-light. */
  tint?: string;
  vignette: number;
  scanlines: boolean;
  /** Brightness flicker (analogue). */
  flicker: boolean;
  /** Extra darkening 0..1 */
  dark?: number;
  seed?: number;
  /** Image-intensifier gain (1 = none). Applied before the tint. */
  intensify?: number;
}

export function feedTreatment(ctx: Ctx2D, t: number, o: FeedTreatment, x = 0, y = 0, w = VIEW_W, h = VIEW_H): void {
  if (o.intensify && o.intensify > 1) lowLightBlend(ctx, x, y, w, h, o.intensify, 0.55);
  if (o.tint) {
    ctx.fillStyle = o.tint;
    ctx.fillRect(x, y, w, h);
  }
  if (o.flicker) {
    const f = signalFlicker(t, o.seed ?? 0);
    if (f < 1) darken(ctx, x, y, w, h, (1 - f) * 0.9);
  }
  if (o.dark) darken(ctx, x, y, w, h, o.dark);
  if (o.vignette > 0) vignette(ctx, x, y, w, h, o.vignette);
  if (o.noise > 0) drawNoise(ctx, x, y, w, h, o.noise, t, '#cfd8d0', o.seed ?? 0);
  if (o.scanlines) drawScanlines(ctx, x, y, w, h, 0.10, t);
  if (o.tear > 0) drawTear(ctx, x, y, w, h, o.tear, t);
}

/** Flash intensity from a list of strike times; sharp attack, exponential decay. */
export function lightningAt(t: number, strikes: ReadonlyArray<readonly [number, number]>): number {
  let v = 0;
  for (const [st, amp] of strikes) {
    const d = t - st;
    if (d < 0 || d > 1.2) continue;
    // double flash
    const a = Math.exp(-d * 9) + 0.6 * Math.exp(-Math.max(0, d - 0.12) * 12) * (d > 0.1 ? 1 : 0);
    v = Math.max(v, amp * Math.min(1, a));
  }
  return v;
}

/** Generates key-click cues within windows, pseudo-randomly spaced. */
export function typingCues(windows: ReadonlyArray<readonly [number, number]>, seed = 1): SceneCue[] {
  const out: SceneCue[] = [];
  let n = 0;
  for (const [a, b] of windows) {
    let t = a + hash1(seed + n) * 0.2;
    while (t < b) {
      out.push({ time: Math.round(t * 1000) / 1000, id: 'key', kind: 'sfx' });
      n++;
      t += 0.09 + hash1(seed * 7 + n) * 0.22;
    }
  }
  return out;
}

export const cue = (time: number, id: string, kind: SceneCue['kind'] = 'sfx'): SceneCue => ({ time, id, kind });

/** Returns which labelled interval contains t. */
export function shotAt<T extends string>(t: number, shots: ReadonlyArray<readonly [number, T]>): T {
  let cur = shots[0][1];
  for (const [start, id] of shots) if (t >= start) cur = id;
  return cur;
}

export const LOW_LIGHT_TINT = 'rgba(28,78,44,0.10)';
export const LOW_LIGHT_GAIN = 1.75;

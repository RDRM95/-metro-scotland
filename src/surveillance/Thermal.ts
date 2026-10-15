/**
 * Thermal imaging post-process. Converts a drawn region to luminance and
 * remaps it through the ironbow ramp, with optional contrast and a slow
 * sensor "breathing" so the picture never sits perfectly still.
 */
import { hexToRgb, THERMAL_RAMP } from '../engine/Palette';
import type { Ctx2D } from '../engine/Surface';

const RAMP_RGB = THERMAL_RAMP.map(hexToRgb);

export function thermalise(ctx: Ctx2D, x: number, y: number, w: number, h: number, t: number, opts: { gain?: number; floor?: number } = {}): void {
  const gain = opts.gain ?? 1.0;
  const floor = opts.floor ?? 0.05;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const n = RAMP_RGB.length - 1;
  const breathe = 1 + 0.03 * Math.sin(t * 0.7);
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    let v = floor + lum * gain * breathe;
    if (v > 1) v = 1;
    const idx = Math.round(v * n);
    const c = RAMP_RGB[idx];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  }
  ctx.putImageData(img, x, y);
}

/** Maps a 0..1 temperature to a thermal colour string (for direct drawing). */
export function thermalColour(v: number): string {
  const idx = Math.max(0, Math.min(THERMAL_RAMP.length - 1, Math.round(v * (THERMAL_RAMP.length - 1))));
  return THERMAL_RAMP[idx];
}

/**
 * Image-intensifier look that keeps some colour: brightens by `gain` and
 * pulls the result `blend` of the way towards phosphor green luminance.
 */
export function lowLightBlend(ctx: Ctx2D, x: number, y: number, w: number, h: number, gain = 1.7, blend = 0.6): void {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const k = 1 - blend;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let lum = ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * gain;
    if (lum > 1) lum = 1;
    const gr = lum * 120;
    const gg = 14 + lum * 215;
    const gb = lum * 125;
    d[i] = Math.min(255, r * gain * k + gr * blend);
    d[i + 1] = Math.min(255, g * gain * k + gg * blend);
    d[i + 2] = Math.min(255, b * gain * k + gb * blend);
  }
  ctx.putImageData(img, x, y);
}

/** Low-light / image-intensifier green treatment. */
export function lowLight(ctx: Ctx2D, x: number, y: number, w: number, h: number, gain = 1.6): void {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let lum = ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255) * gain;
    if (lum > 1) lum = 1;
    d[i] = Math.round(lum * 90);
    d[i + 1] = Math.round(20 + lum * 225);
    d[i + 2] = Math.round(lum * 110);
  }
  ctx.putImageData(img, x, y);
}

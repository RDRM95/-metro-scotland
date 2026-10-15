/**
 * Lighting helpers: vignettes, dithered light cones, flicker curves and
 * full-frame fades. Pixel-art lighting is done with ordered dither and
 * translucent fills, never smooth radial gradients.
 */
import { hash1, noise1 } from '../engine/Rng';
import { BAYER4, type Ctx2D } from '../engine/Surface';

/** Darkens edges of a region. */
export function vignette(ctx: Ctx2D, x: number, y: number, w: number, h: number, strength = 0.6): void {
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const inset = Math.round((i / steps) * Math.min(w, h) * 0.22);
    const a = strength * (1 - i / steps) * 0.33;
    ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    // frame ring
    ctx.fillRect(x + inset, y + inset, w - inset * 2, 1);
    ctx.fillRect(x + inset, y + h - inset - 1, w - inset * 2, 1);
    ctx.fillRect(x + inset, y + inset, 1, h - inset * 2);
    ctx.fillRect(x + w - inset - 1, y + inset, 1, h - inset * 2);
    // soft inner falloff via dithered bands
    const bandH = Math.max(1, Math.round(h * 0.08));
    ctx.fillStyle = `rgba(0,0,0,${(a * 0.6).toFixed(3)})`;
    ctx.fillRect(x, y + inset, w, bandH);
    ctx.fillRect(x, y + h - inset - bandH, w, bandH);
  }
}

/** Multiplies the whole region towards black by `amount` (0 = unchanged, 1 = black). */
export function darken(ctx: Ctx2D, x: number, y: number, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${Math.min(1, amount).toFixed(3)})`;
  ctx.fillRect(x, y, w, h);
}

/** Tints a region (e.g. emergency red wash). */
export function tint(ctx: Ctx2D, x: number, y: number, w: number, h: number, colour: string, amount: number): void {
  if (amount <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, amount);
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = prev;
}

/** Fluorescent tube flicker: mostly on, sporadic dropouts. 0..1 */
export function fluorescentFlicker(t: number, seed = 0, instability = 0.15): number {
  const base = 0.9 + 0.1 * noise1(t * 11, seed);
  const f = Math.floor(t * 24);
  const drop = hash1(f * 31 + seed) < instability ? hash1(f * 17 + seed + 1) * 0.8 : 0;
  return Math.max(0, base - drop);
}

/** Slow CRT monitor glow pulse. */
export function monitorPulse(t: number, seed = 0): number {
  return 0.85 + 0.15 * noise1(t * 2.3, seed);
}

/** Dithered cone of light from (x, y) downward with half-angle spread. */
export function lightCone(ctx: Ctx2D, x: number, y: number, height: number, topWidth: number, bottomWidth: number, colour: string, maxDensity = 0.5): void {
  ctx.fillStyle = colour;
  for (let yy = 0; yy < height; yy++) {
    const f = yy / height;
    const halfW = (topWidth + (bottomWidth - topWidth) * f) / 2;
    const density = maxDensity * (1 - f * 0.85);
    const x0 = Math.round(x - halfW);
    const x1 = Math.round(x + halfW);
    for (let xx = x0; xx <= x1; xx++) {
      const edge = 1 - Math.abs((xx - x) / Math.max(1, halfW));
      const d = density * Math.min(1, edge * 1.6);
      const bayer = BAYER4[(y + yy) & 3][xx & 3] / 16;
      if (bayer < d) ctx.fillRect(xx, y + yy, 1, 1);
    }
  }
}

/** Dithered glow blob (for lamps and indicators). */
export function glow(ctx: Ctx2D, cx: number, cy: number, r: number, colour: string, maxDensity = 0.6): void {
  ctx.fillStyle = colour;
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      const d2 = xx * xx + yy * yy;
      if (d2 > r * r) continue;
      const f = 1 - Math.sqrt(d2) / r;
      const d = f * f * maxDensity;
      const bayer = BAYER4[(cy + yy) & 3][(cx + xx) & 3] / 16;
      if (bayer < d) ctx.fillRect(cx + xx, cy + yy, 1, 1);
    }
  }
}

/** Letterbox fade in/out helper. Returns a darkness amount for the frame. */
export function fadeAmount(t: number, duration: number, fadeIn = 1.2, fadeOut = 1.2): number {
  let a = 0;
  if (fadeIn > 0 && t < fadeIn) a = Math.max(a, 1 - t / fadeIn);
  if (fadeOut > 0 && t > duration - fadeOut) a = Math.max(a, (t - (duration - fadeOut)) / fadeOut);
  return Math.min(1, Math.max(0, a));
}

/**
 * Drifting fog, mist off the Clyde and dust in bunker light. Drawn as
 * ordered-dithered bands sampled from fractal noise — pixel art has no
 * soft gradients, so the fog is made of dots.
 */
import { fbm2 } from '../engine/Rng';
import { BAYER4, type Ctx2D } from '../engine/Surface';

export interface FogOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  colour: string;
  /** Overall density 0..1 */
  density: number;
  /** Horizontal drift speed px/s */
  drift: number;
  /** Noise scale (bigger = larger clouds). */
  scale?: number;
  seed?: number;
  /** Fade towards the top of the region (0..1 fraction of height). */
  fadeTop?: number;
  /** Pixel step (2 = coarser, cheaper). */
  step?: number;
}

export function drawFog(ctx: Ctx2D, t: number, o: FogOpts): void {
  const scale = o.scale ?? 28;
  const seed = o.seed ?? 3;
  const step = o.step ?? 1;
  ctx.fillStyle = o.colour;
  for (let yy = 0; yy < o.h; yy += step) {
    const fy = o.fadeTop ? Math.min(1, yy / Math.max(1, o.h * o.fadeTop)) : 1;
    for (let xx = 0; xx < o.w; xx += step) {
      const n = fbm2((xx + t * o.drift) / scale, (yy + t * o.drift * 0.15) / (scale * 0.6), 2, seed);
      const d = (n - 0.35) * 1.6 * o.density * fy;
      if (d <= 0) continue;
      const bayer = BAYER4[(yy >> (step - 1)) & 3][(xx >> (step - 1)) & 3] / 16;
      if (bayer < d) ctx.fillRect(o.x + xx, o.y + yy, step, step);
    }
  }
}

/** Sparse drifting dust motes in a light beam. */
export function drawDust(ctx: Ctx2D, t: number, x: number, y: number, w: number, h: number, count: number, colour: string, seed = 5): void {
  ctx.fillStyle = colour;
  for (let i = 0; i < count; i++) {
    const a = fbm2(i * 0.37, t * 0.05, 1, seed);
    const b = fbm2(i * 0.91 + 10, t * 0.04, 1, seed + 1);
    const px = x + ((a * w * 1.7 + t * 3 * (0.3 + a)) % w);
    const py = y + ((b * h * 1.3 + t * 1.5) % h);
    ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
  }
}

/**
 * Heavy west-coast rain. Stateless: each streak's position is a function of
 * time and its index, so seeking and frame export are deterministic.
 */
import { hash1, hash2 } from '../engine/Rng';
import type { Ctx2D } from '../engine/Surface';

export interface RainOpts {
  count: number;
  /** Horizontal wind drift in px per second (negative = leftwards). */
  wind: number;
  speed: number;
  /** Streak length in px. */
  length: number;
  colour: string;
  colourBright?: string;
  /** Region */
  x?: number;
  y?: number;
  w: number;
  h: number;
  alpha?: number;
  seed?: number;
}

export function drawRain(ctx: Ctx2D, t: number, o: RainOpts): void {
  const x0 = o.x ?? 0;
  const y0 = o.y ?? 0;
  const seed = o.seed ?? 0;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * (o.alpha ?? 1);
  for (let i = 0; i < o.count; i++) {
    const h0 = hash2(i, seed);
    const h1 = hash2(i, seed + 1);
    const h2 = hash2(i, seed + 2);
    const depth = 0.55 + h2 * 0.45; // far streaks slower/shorter
    const speed = o.speed * depth;
    const len = Math.max(2, Math.round(o.length * depth));
    const y = (h1 * o.h + t * speed) % (o.h + len) - len;
    const x = ((h0 * o.w + t * o.wind * depth) % o.w + o.w) % o.w;
    const bright = o.colourBright && h2 > 0.85;
    ctx.fillStyle = bright ? o.colourBright! : o.colour;
    // slanted streak: 1px wide, drawn as a short vertical run with wind lean
    const lean = o.wind / Math.max(1, o.speed);
    for (let k = 0; k < len; k++) {
      const yy = y + k;
      if (yy < 0 || yy >= o.h) continue;
      ctx.fillRect(x0 + Math.round(x - lean * k), y0 + Math.round(yy), 1, 1);
    }
  }
  ctx.globalAlpha = prev;
}

/** Splash rings/ticks along a surface line (e.g. puddles or the river). */
export function drawSplashes(ctx: Ctx2D, t: number, x0: number, x1: number, y: number, count: number, colour: string, seed = 9): void {
  ctx.fillStyle = colour;
  for (let i = 0; i < count; i++) {
    const period = 0.35 + hash2(i, seed) * 0.5;
    const phase = ((t + hash2(i, seed + 1) * period) % period) / period;
    if (phase > 0.4) continue;
    const x = x0 + hash2(i, seed + 2 + Math.floor((t + hash2(i, seed + 1) * period) / period)) * (x1 - x0);
    const yy = y + Math.round(hash1(i) * 2);
    if (phase < 0.2) ctx.fillRect(Math.round(x), yy, 1, 1);
    else {
      ctx.fillRect(Math.round(x) - 1, yy, 1, 1);
      ctx.fillRect(Math.round(x) + 1, yy, 1, 1);
    }
  }
}

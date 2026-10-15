/**
 * Deterministic pseudo-random utilities.
 *
 * Most of the film's effects are *stateless functions of time*, so that
 * seeking, pausing and headless frame capture produce identical imagery.
 * These helpers provide repeatable noise for that purpose.
 */

/** mulberry32 — small, fast, good enough for art. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Integer hash → [0,1). Stable across runs. */
export function hash1(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function hash2(a: number, b: number): number {
  return hash1((a | 0) * 73856093 + (b | 0) * 19349663);
}

export function hash3(a: number, b: number, c: number): number {
  return hash1((a | 0) * 73856093 + (b | 0) * 19349663 + (c | 0) * 83492791);
}

/** Smooth 1-D value noise in [0,1). */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash2(i, seed);
  const b = hash2(i + 1, seed);
  return a + (b - a) * u;
}

/** Smooth 2-D value noise in [0,1). */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash3(xi, yi, seed);
  const b = hash3(xi + 1, yi, seed);
  const c = hash3(xi, yi + 1, seed);
  const d = hash3(xi + 1, yi + 1, seed);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uy;
}

/** Fractal (octave) 2-D noise, in [0,1). */
export function fbm2(x: number, y: number, octaves = 3, seed = 0): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x, y, seed + o * 17);
    norm += amp;
    x *= 2.03;
    y *= 1.97;
    amp *= 0.5;
  }
  return sum / norm;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

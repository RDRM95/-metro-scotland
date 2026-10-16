export type EaseFn = (t: number) => number;

export const linear: EaseFn = (t) => t;
export const easeInQuad: EaseFn = (t) => t * t;
export const easeOutQuad: EaseFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad: EaseFn = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeInOutCubic: EaseFn = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic: EaseFn = (t) => t * t * t;
export const easeInExpo: EaseFn = (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
export const easeOutExpo: EaseFn = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
/** Stepped easing — useful for mechanical camera motors. */
export const steps = (n: number): EaseFn => (t) => Math.floor(t * n) / n;

/** Normalised progress of `t` in [a, b], clamped. */
export function span(t: number, a: number, b: number, ease: EaseFn = linear): number {
  if (b <= a) return t >= b ? 1 : 0;
  const u = (t - a) / (b - a);
  return ease(u < 0 ? 0 : u > 1 ? 1 : u);
}

/** Linear interpolate through keyframes [[time, value], ...]. */
export function keyframes(t: number, keys: ReadonlyArray<readonly [number, number]>, ease: EaseFn = easeInOutQuad): number {
  if (keys.length === 0) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [ta, va] = keys[i - 1];
    const [tb, vb] = keys[i];
    if (t <= tb) {
      const u = tb > ta ? (t - ta) / (tb - ta) : 1;
      return va + (vb - va) * ease(u);
    }
  }
  return keys[keys.length - 1][1];
}

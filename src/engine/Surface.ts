/**
 * Offscreen pixel surfaces. Every environment layer, sprite and the final
 * 480×270 frame is a Surface; nearest-neighbour is enforced everywhere.
 */

export const VIEW_W = 480;
export const VIEW_H = 270;

export type Ctx2D = CanvasRenderingContext2D;

export interface Surface {
  canvas: HTMLCanvasElement;
  ctx: Ctx2D;
  w: number;
  h: number;
}

export function createSurface(w: number, h: number): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('2D canvas unsupported');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx, w, h };
}

/** Fill a 1px-aligned rectangle. */
export function px(ctx: Ctx2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, 1, 1);
}

export function rect(ctx: Ctx2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

export function hline(ctx: Ctx2D, x0: number, x1: number, y: number, color: string): void {
  const a = Math.min(x0, x1) | 0;
  const b = Math.max(x0, x1) | 0;
  ctx.fillStyle = color;
  ctx.fillRect(a, y | 0, b - a + 1, 1);
}

export function vline(ctx: Ctx2D, x: number, y0: number, y1: number, color: string): void {
  const a = Math.min(y0, y1) | 0;
  const b = Math.max(y0, y1) | 0;
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, a, 1, b - a + 1);
}

export function outline(ctx: Ctx2D, x: number, y: number, w: number, h: number, color: string): void {
  hline(ctx, x, x + w - 1, y, color);
  hline(ctx, x, x + w - 1, y + h - 1, color);
  vline(ctx, x, y, y + h - 1, color);
  vline(ctx, x + w - 1, y, y + h - 1, color);
}

/** Bresenham line with optional thickness (square brush). */
export function line(ctx: Ctx2D, x0: number, y0: number, x1: number, y1: number, color: string, thick = 1): void {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  const off = Math.floor(thick / 2);
  for (;;) {
    ctx.fillRect(x0 - off, y0 - off, thick, thick);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Filled circle (pixel-perfect midpoint). */
export function disc(ctx: Ctx2D, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  cx |= 0; cy |= 0;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** Filled ellipse. */
export function ellipse(ctx: Ctx2D, cx: number, cy: number, rx: number, ry: number, color: string): void {
  ctx.fillStyle = color;
  cx |= 0; cy |= 0;
  for (let y = -ry; y <= ry; y++) {
    const k = 1 - (y * y) / (ry * ry || 1);
    if (k < 0) continue;
    const half = Math.floor(rx * Math.sqrt(k));
    ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** Dithered rectangle: fills with `a`, checkerboarding `b` at the given density (0..1). */
export function dither(ctx: Ctx2D, x: number, y: number, w: number, h: number, a: string, b: string, density = 0.5, phase = 0): void {
  rect(ctx, x, y, w, h, a);
  ctx.fillStyle = b;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const bayer = BAYER4[(yy + phase) & 3][(xx + phase) & 3] / 16;
      if (bayer < density) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Vertical gradient using ordered dithering between palette stops — no smooth gradients in pixel art. */
export function ditherGradientV(ctx: Ctx2D, x: number, y: number, w: number, h: number, stops: string[]): void {
  const n = stops.length - 1;
  for (let yy = 0; yy < h; yy++) {
    const f = (yy / Math.max(1, h - 1)) * n;
    const i = Math.min(n - 1, Math.floor(f));
    const frac = f - i;
    for (let xx = 0; xx < w; xx++) {
      const bayer = BAYER4[yy & 3][xx & 3] / 16;
      ctx.fillStyle = bayer < frac ? stops[i + 1] : stops[i];
      ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

/** Draws a surface onto a context at integer coordinates. */
export function blit(ctx: Ctx2D, s: Surface, x: number, y: number, alpha = 1): void {
  if (alpha <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  ctx.drawImage(s.canvas, x | 0, y | 0);
  ctx.globalAlpha = prev;
}

/** Draw a horizontally flipped copy of a surface. */
export function blitFlipped(ctx: Ctx2D, s: Surface, x: number, y: number): void {
  ctx.save();
  ctx.translate((x | 0) + s.w, y | 0);
  ctx.scale(-1, 1);
  ctx.drawImage(s.canvas, 0, 0);
  ctx.restore();
}

/**
 * Build a sprite from an ASCII pixel map.
 * Each character maps to a colour; '.' or ' ' is transparent.
 */
export function spriteFromMap(rows: string[], legend: Record<string, string>): Surface {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const s = createSurface(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const col = legend[ch];
      if (!col) continue;
      s.ctx.fillStyle = col;
      s.ctx.fillRect(x, y, 1, 1);
    }
  }
  return s;
}

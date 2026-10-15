/**
 * Presents the 480×270 frame on the display canvas with nearest-neighbour
 * scaling. Integer scale factors are preferred (480×270 ×8 = 4K exactly);
 * on odd viewports we fall back to the largest fractional fit so phones and
 * TVs still fill the screen, and letterbox the rest in black.
 */
import { createSurface, VIEW_H, VIEW_W, type Surface } from './Surface';

export class Renderer {
  readonly frame: Surface;
  private displayCtx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  scale = 1;

  constructor(readonly display: HTMLCanvasElement, private readonly stage: HTMLElement) {
    this.frame = createSurface(VIEW_W, VIEW_H);
    const ctx = display.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas unsupported');
    this.displayCtx = ctx;
    this.resize();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(stage);
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 50));
  }

  resize(): void {
    const rect = this.stage.getBoundingClientRect();
    const availW = Math.max(1, Math.floor(rect.width));
    const availH = Math.max(1, Math.floor(rect.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 4);
    const pxW = availW * this.dpr;
    const pxH = availH * this.dpr;
    const fit = Math.min(pxW / VIEW_W, pxH / VIEW_H);
    // Prefer integer scaling when it loses less than ~12% of the available area.
    const intScale = Math.floor(fit);
    this.scale = intScale >= 1 && intScale / fit > 0.88 ? intScale : fit;
    const outW = Math.round(VIEW_W * this.scale);
    const outH = Math.round(VIEW_H * this.scale);
    this.display.width = outW;
    this.display.height = outH;
    this.cssW = outW / this.dpr;
    this.cssH = outH / this.dpr;
    this.display.style.width = `${this.cssW}px`;
    this.display.style.height = `${this.cssH}px`;
    this.displayCtx.imageSmoothingEnabled = false;
    this.present();
  }

  /** Copies the frame surface onto the display canvas. */
  present(): void {
    const ctx = this.displayCtx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.frame.canvas, 0, 0, VIEW_W, VIEW_H, 0, 0, this.display.width, this.display.height);
  }

  /** Converts a client coordinate into frame pixel space. */
  toFrame(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.display.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * VIEW_W,
      y: ((clientY - r.top) / r.height) * VIEW_H,
    };
  }
}

/**
 * Military CCTV presentation layer: on-screen data, bracket corners,
 * scanlines, sensor noise, horizontal tearing and total signal loss.
 * Styled after practical 2030s British kit — monochrome text, no holograms.
 */
import { drawText, FONT_3x5, FONT_5x7, measureText } from '../engine/Font';
import { hash1, hash2, noise1 } from '../engine/Rng';
import { hline, rect, vline, type Ctx2D } from '../engine/Surface';
import { surveillanceClock } from '../timeline/Timeline';

export interface HudInfo {
  cam: string; // "CAM-12"
  sector: string; // "GLASGOW WEST - CLYDE CORRIDOR"
  station: string; // "REMOTE OPTICAL STATION"
  grid: string; // "NS 5712 6534"
  signal: number; // 0..100
  mode: 'OPTICAL' | 'LOW-LIGHT' | 'THERMAL' | 'INTERNAL';
  tracking: 'IDLE' | 'MOTION' | 'TRACK' | 'LOST' | 'LOCK';
  recording: boolean;
  /** Film time for the clock. */
  filmTime: number;
  radMicroSv?: number; // µSv/h
  tempC?: number;
  channel?: string;
  threat?: string; // e.g. "CAT: UNRESOLVED"
  zoom?: number; // e.g. 2.0
  compact?: boolean; // for quad-split tiles
}

const HUD = '#b9d9b5';
const HUD_DIM = '#6f8a6c';
const HUD_RED = '#ff5a4a';
const HUD_AMBER = '#e2b544';

export function drawHud(ctx: Ctx2D, x: number, y: number, w: number, h: number, info: HudInfo, t: number): void {
  const f = info.compact ? FONT_3x5 : FONT_3x5;
  const pad = info.compact ? 3 : 6;
  const lineH = 6;
  const colour = info.mode === 'THERMAL' ? '#f5e6c8' : HUD;
  const dim = info.mode === 'THERMAL' ? '#b79d7a' : HUD_DIM;

  // Corner brackets
  const bl = info.compact ? 6 : 10;
  const bc = dim;
  hline(ctx, x + 2, x + 2 + bl, y + 2, bc); vline(ctx, x + 2, y + 2, y + 2 + bl, bc);
  hline(ctx, x + w - 3 - bl, x + w - 3, y + 2, bc); vline(ctx, x + w - 3, y + 2, y + 2 + bl, bc);
  hline(ctx, x + 2, x + 2 + bl, y + h - 3, bc); vline(ctx, x + 2, y + h - 3 - bl, y + h - 3, bc);
  hline(ctx, x + w - 3 - bl, x + w - 3, y + h - 3, bc); vline(ctx, x + w - 3, y + h - 3 - bl, y + h - 3, bc);

  // Top-left block
  let ty = y + pad;
  drawText(ctx, info.cam, x + pad, ty, f, colour, { shadow: '#000' });
  if (!info.compact) {
    ty += lineH;
    drawText(ctx, info.sector, x + pad, ty, f, colour, { shadow: '#000' });
    ty += lineH;
    drawText(ctx, info.station, x + pad, ty, f, dim, { shadow: '#000' });
    ty += lineH;
    drawText(ctx, `GRID ${info.grid}`, x + pad, ty, f, dim, { shadow: '#000' });
  } else {
    ty += lineH;
    drawText(ctx, info.sector, x + pad, ty, f, dim, { shadow: '#000' });
  }

  // Top-right: clock + date
  const clock = surveillanceClock(info.filmTime);
  drawText(ctx, clock, x + w - pad, y + pad, f, colour, { align: 'right', shadow: '#000' });
  if (!info.compact) {
    drawText(ctx, '11 OCT 2033', x + w - pad, y + pad + lineH, f, dim, { align: 'right', shadow: '#000' });
    drawText(ctx, `SIG ${Math.round(info.signal)}%`, x + w - pad, y + pad + lineH * 2, f, info.signal < 50 ? HUD_RED : dim, { align: 'right', shadow: '#000' });
    // Signal bars
    const bars = 5;
    const lit = Math.round((info.signal / 100) * bars);
    for (let i = 0; i < bars; i++) {
      const bx = x + w - pad - 20 + i * 4;
      const bh = 2 + i;
      rect(ctx, bx, y + pad + lineH * 3 + (5 - bh), 3, bh, i < lit ? colour : '#222');
    }
  }

  // REC indicator (blinks)
  if (info.recording) {
    const on = Math.floor(t * 1.5) % 2 === 0;
    const rx = x + w - pad - (info.compact ? 14 : 44);
    const ry = info.compact ? y + pad + lineH : y + pad + lineH * 4 + 2;
    if (on) rect(ctx, rx, ry, 3, 3, HUD_RED);
    drawText(ctx, 'REC', rx + 5, ry - 1, f, on ? HUD_RED : dim, { shadow: '#000' });
  }

  // Bottom-left: mode + tracking
  const by = y + h - pad - 5;
  drawText(ctx, info.mode, x + pad, by, f, colour, { shadow: '#000' });
  const trackCol = info.tracking === 'LOST' ? HUD_RED : info.tracking === 'LOCK' ? HUD_AMBER : info.tracking === 'TRACK' ? HUD_AMBER : dim;
  const trackLabel = info.tracking === 'IDLE' ? 'TRK: STANDBY' : `TRK: ${info.tracking}`;
  drawText(ctx, trackLabel, x + pad, by - lineH, f, trackCol, { shadow: '#000' });
  if (!info.compact) {
    if (info.threat) drawText(ctx, info.threat, x + pad, by - lineH * 2, f, HUD_RED, { shadow: '#000' });
    if (info.zoom && info.zoom > 1) drawText(ctx, `ZOOM x${info.zoom.toFixed(1)}`, x + pad, by - lineH * (info.threat ? 3 : 2), f, dim, { shadow: '#000' });
  }

  // Bottom-right: sensors
  if (!info.compact) {
    const rad = info.radMicroSv ?? 0;
    const tmp = info.tempC ?? 0;
    drawText(ctx, `RAD ${rad.toFixed(2)} uSv/h`, x + w - pad, by, f, rad > 2 ? HUD_AMBER : dim, { align: 'right', shadow: '#000' });
    drawText(ctx, `AMB ${tmp.toFixed(1)}C`, x + w - pad, by - lineH, f, dim, { align: 'right', shadow: '#000' });
    if (info.channel) drawText(ctx, info.channel, x + w - pad, by - lineH * 2, f, dim, { align: 'right', shadow: '#000' });
  }

  // Centre reticle when tracking
  if (info.tracking === 'TRACK' || info.tracking === 'LOCK') {
    // (reticle itself is drawn by the scene at the target position)
  }
}

/** Reticle / tracking box around a target. */
export function drawReticle(ctx: Ctx2D, cx: number, cy: number, w: number, h: number, colour: string, t: number, label?: string): void {
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h / 2);
  const g = 4;
  hline(ctx, x, x + g, y, colour); vline(ctx, x, y, y + g, colour);
  hline(ctx, x + w - g, x + w, y, colour); vline(ctx, x + w, y, y + g, colour);
  hline(ctx, x, x + g, y + h, colour); vline(ctx, x, y + h - g, y + h, colour);
  hline(ctx, x + w - g, x + w, y + h, colour); vline(ctx, x + w, y + h - g, y + h, colour);
  if (Math.floor(t * 4) % 2 === 0) {
    ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
  }
  if (label) drawText(ctx, label, x, y - 7, FONT_3x5, colour, { shadow: '#000' });
}

/** CRT/scanline treatment + per-frame sensor noise. */
export function drawScanlines(ctx: Ctx2D, x: number, y: number, w: number, h: number, alpha = 0.18, t = 0): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  const roll = Math.floor(t * 20) % 2;
  for (let yy = roll; yy < h; yy += 2) ctx.fillRect(x, y + yy, w, 1);
}

export function drawNoise(ctx: Ctx2D, x: number, y: number, w: number, h: number, amount: number, t: number, colour = '#ffffff', seed = 0): void {
  if (amount <= 0) return;
  const frame = Math.floor(t * 24);
  const n = Math.floor(w * h * amount * 0.08);
  ctx.fillStyle = colour;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * 0.5;
  for (let i = 0; i < n; i++) {
    const px = Math.floor(hash2(i * 3 + frame, seed) * w);
    const py = Math.floor(hash2(i * 3 + 1 + frame, seed + 1) * h);
    ctx.fillRect(x + px, y + py, 1 + (hash2(i, frame) > 0.8 ? 1 : 0), 1);
  }
  ctx.globalAlpha = prev;
}

/**
 * Horizontal tearing: shifts bands of the region sideways. Must be called
 * after the image is drawn. `strength` 0..1.
 */
export function drawTear(ctx: Ctx2D, x: number, y: number, w: number, h: number, strength: number, t: number): void {
  if (strength <= 0) return;
  const frame = Math.floor(t * 30);
  const bands = Math.round(1 + strength * 5);
  for (let i = 0; i < bands; i++) {
    const r = hash2(frame, i * 11);
    if (r > strength * 1.2) continue;
    const by = y + Math.floor(hash2(frame, i * 7 + 1) * h);
    const bh = 1 + Math.floor(hash2(frame, i * 5 + 2) * (3 + strength * 10));
    const shift = Math.round((hash2(frame, i * 3 + 3) - 0.5) * strength * 40);
    if (by + bh > y + h) continue;
    try {
      const img = ctx.getImageData(x, by, w, bh);
      ctx.putImageData(img, x + shift, by);
    } catch {
      /* ignore */
    }
  }
}

/** Static snow filling a region — total signal loss. */
export function drawStatic(ctx: Ctx2D, x: number, y: number, w: number, h: number, t: number, intensity = 1): void {
  const frame = Math.floor(t * 30);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const v = hash2(i, frame) < 0.5 ? 0 : 255;
    const shade = Math.floor(v * (0.35 + 0.65 * hash2(i + 77, frame)) * intensity);
    d[i * 4] = shade;
    d[i * 4 + 1] = shade;
    d[i * 4 + 2] = shade;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, x, y);
  // rolling bar
  const bar = y + ((frame * 3) % h);
  rect(ctx, x, bar, w, 3, 'rgba(0,0,0,0.35)');
}

/** Big centred warning text with a dark backing plate. */
export function drawBanner(ctx: Ctx2D, text: string, cx: number, cy: number, colour: string, blink = false, t = 0): void {
  if (blink && Math.floor(t * 2) % 2 === 1) return;
  const w = measureText(text, FONT_5x7) + 12;
  rect(ctx, Math.round(cx - w / 2), cy - 3, w, 13, 'rgba(0,0,0,0.85)');
  hline(ctx, Math.round(cx - w / 2), Math.round(cx + w / 2) - 1, cy - 3, colour);
  hline(ctx, Math.round(cx - w / 2), Math.round(cx + w / 2) - 1, cy + 9, colour);
  drawText(ctx, text, cx, cy, FONT_5x7, colour, { align: 'center' });
}

/** Subtle analogue drift: luminance flicker factor. */
export function signalFlicker(t: number, seed = 0): number {
  return 0.92 + 0.08 * noise1(t * 7, seed) + (hash1(Math.floor(t * 30) + seed) > 0.97 ? -0.15 : 0);
}

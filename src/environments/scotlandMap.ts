/**
 * A geographically honest map of Scotland for the surveillance displays.
 * Coastline points are real (lon, lat) pairs, simplified; stations sit at
 * plausible positions for surviving military/civil infrastructure.
 */
import { drawText, FONT_3x5 } from '../engine/Font';
import { hash1 } from '../engine/Rng';
import { type Ctx2D, rect } from '../engine/Surface';

type LonLat = readonly [number, number];

// Mainland, clockwise from the Mull of Galloway.
const MAINLAND: LonLat[] = [
  [-4.85, 54.63], [-5.05, 54.9], [-5.12, 55.0], [-4.85, 55.24], [-4.63, 55.46], [-4.68, 55.62], [-4.82, 55.64],
  [-4.87, 55.8], [-4.84, 55.96], [-4.57, 55.94], [-4.4, 55.9], [-4.57, 55.97], [-4.73, 56.0], [-4.8, 56.08],
  [-4.86, 56.0], [-4.98, 55.86], [-5.2, 55.9], [-5.3, 56.05], [-5.42, 55.87], [-5.6, 55.43], [-5.78, 55.3],
  [-5.7, 55.7], [-5.6, 55.95], [-5.55, 56.1], [-5.47, 56.41], [-5.6, 56.55], [-6.22, 56.73], [-5.83, 57.0],
  [-5.65, 57.1], [-5.72, 57.28], [-5.8, 57.43], [-5.68, 57.73], [-5.16, 57.9], [-5.24, 58.15], [-5.0, 58.63],
  [-4.75, 58.57], [-4.42, 58.5], [-3.52, 58.6], [-3.37, 58.67], [-3.07, 58.64], [-3.02, 58.64], [-3.08, 58.44],
  [-3.65, 58.12], [-4.03, 57.88], [-3.77, 57.86], [-4.03, 57.68], [-4.22, 57.48], [-3.87, 57.58], [-3.28, 57.72],
  [-2.96, 57.68], [-2.0, 57.69], [-1.78, 57.5], [-2.1, 57.15], [-2.21, 56.96], [-2.47, 56.71], [-2.58, 56.56],
  [-2.97, 56.46], [-2.8, 56.34], [-2.58, 56.28], [-3.0, 56.2], [-3.16, 56.11], [-3.4, 56.02], [-3.19, 55.95],
  [-2.51, 56.0], [-2.14, 55.9], [-2.0, 55.77], [-2.5, 55.35], [-3.07, 54.99], [-3.26, 54.98], [-3.6, 55.07],
  [-4.05, 54.83], [-4.4, 54.68],
];

const ISLANDS: LonLat[][] = [
  [[-6.3, 57.42], [-5.65, 57.5], [-5.9, 57.12], [-6.5, 57.22]], // Skye
  [[-6.3, 56.5], [-5.72, 56.56], [-5.7, 56.3], [-6.3, 56.3]], // Mull
  [[-6.5, 55.9], [-6.0, 55.95], [-6.1, 55.6], [-6.5, 55.6]], // Islay
  [[-5.4, 55.72], [-5.1, 55.72], [-5.1, 55.45], [-5.4, 55.45]], // Arran
  [[-7.1, 58.5], [-6.2, 58.5], [-6.3, 58.0], [-7.0, 57.75], [-7.3, 58.2]], // Lewis & Harris
  [[-7.4, 57.6], [-7.2, 57.65], [-7.1, 57.1], [-7.4, 57.1]], // Uists
  [[-3.4, 59.0], [-2.7, 59.1], [-2.8, 58.8], [-3.4, 58.8]], // Orkney
];

export type StationStatus = 'ok' | 'degraded' | 'offline' | 'alert' | 'compromised';

export interface Station {
  id: string;
  name: string;
  lon: number;
  lat: number;
  status: StationStatus;
}

export const STATIONS: Station[] = [
  { id: 'gw', name: 'GLASGOW W', lon: -4.3, lat: 55.86, status: 'ok' },
  { id: 'gc', name: 'GLASGOW C', lon: -4.25, lat: 55.86, status: 'ok' },
  { id: 'm8', name: 'M8', lon: -4.28, lat: 55.84, status: 'ok' },
  { id: 'cb', name: 'CLYDEBANK', lon: -4.4, lat: 55.9, status: 'ok' },
  { id: 'pa', name: 'PAISLEY', lon: -4.42, lat: 55.84, status: 'ok' },
  { id: 'gk', name: 'GREENOCK', lon: -4.76, lat: 55.95, status: 'ok' },
  { id: 'fa', name: 'FASLANE', lon: -4.82, lat: 56.06, status: 'ok' },
  { id: 'co', name: 'COULPORT', lon: -4.88, lat: 56.05, status: 'degraded' },
  { id: 'ed', name: 'EDINBURGH', lon: -3.19, lat: 55.95, status: 'ok' },
  { id: 'li', name: 'LIVINGSTON', lon: -3.5, lat: 55.88, status: 'ok' },
  { id: 'fk', name: 'FALKIRK', lon: -3.78, lat: 56.0, status: 'ok' },
  { id: 'mw', name: 'MOTHERWELL', lon: -3.99, lat: 55.79, status: 'ok' },
  { id: 'st', name: 'STIRLING', lon: -3.94, lat: 56.12, status: 'ok' },
  { id: 'pe', name: 'PERTH', lon: -3.43, lat: 56.4, status: 'ok' },
  { id: 'du', name: 'DUNDEE', lon: -2.97, lat: 56.46, status: 'degraded' },
  { id: 'le', name: 'LEUCHARS', lon: -2.87, lat: 56.37, status: 'offline' },
  { id: 'ab', name: 'ABERDEEN', lon: -2.1, lat: 57.15, status: 'offline' },
  { id: 'in', name: 'INVERNESS', lon: -4.22, lat: 57.48, status: 'degraded' },
  { id: 'kl', name: 'KINLOSS', lon: -3.56, lat: 57.64, status: 'offline' },
  { id: 'lo', name: 'LOSSIEMOUTH', lon: -3.33, lat: 57.71, status: 'offline' },
  { id: 'wi', name: 'WICK', lon: -3.08, lat: 58.44, status: 'offline' },
  { id: 'fw', name: 'FT WILLIAM', lon: -5.1, lat: 56.82, status: 'ok' },
  { id: 'ob', name: 'OBAN', lon: -5.47, lat: 56.41, status: 'degraded' },
  { id: 'ky', name: 'KYLE', lon: -5.72, lat: 57.28, status: 'degraded' },
  { id: 'sy', name: 'STORNOWAY', lon: -6.38, lat: 58.21, status: 'degraded' },
  { id: 'be', name: 'BENBECULA', lon: -7.37, lat: 57.47, status: 'offline' },
  { id: 'ct', name: 'CAMPBELTOWN', lon: -5.6, lat: 55.43, status: 'ok' },
  { id: 'ar', name: 'ARDROSSAN', lon: -4.82, lat: 55.64, status: 'ok' },
  { id: 'ay', name: 'AYR', lon: -4.63, lat: 55.46, status: 'degraded' },
  { id: 'sr', name: 'STRANRAER', lon: -5.03, lat: 54.9, status: 'ok' },
  { id: 'df', name: 'DUMFRIES', lon: -3.6, lat: 55.07, status: 'ok' },
  { id: 'ul', name: 'ULLAPOOL', lon: -5.16, lat: 57.9, status: 'offline' },
  { id: 'th', name: 'THURSO', lon: -3.52, lat: 58.6, status: 'offline' },
];

export const STATUS_COLOUR: Record<StationStatus, string> = {
  ok: '#5cbf6a',
  degraded: '#d6b534',
  offline: '#3a4044',
  alert: '#ff4a3a',
  compromised: '#ff2a1a',
};

export interface MapProjection {
  x0: number;
  y0: number;
  /** Pixels per degree of latitude. */
  k: number;
}

const LON0 = -7.6;
const LAT_TOP = 59.25;
const COS = 0.552;

export function project(p: MapProjection, lon: number, lat: number): [number, number] {
  return [Math.round(p.x0 + (lon - LON0) * COS * p.k), Math.round(p.y0 + (LAT_TOP - lat) * p.k)];
}

/** Returns projection filling a box of the given height. */
export function fitProjection(x: number, y: number, height: number): MapProjection {
  return { x0: x, y0: y, k: height / (LAT_TOP - 54.5) };
}

export function mapSize(p: MapProjection): { w: number; h: number } {
  return { w: Math.round((-1.6 - LON0) * COS * p.k), h: Math.round((LAT_TOP - 54.5) * p.k) };
}

/** Scanline polygon fill into pixel rects (crisp, no antialias). */
export function fillPolygon(ctx: Ctx2D, pts: Array<[number, number]>, colour: string): void {
  if (pts.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  ctx.fillStyle = colour;
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if (y1 === y2) continue;
      const ymin = Math.min(y1, y2);
      const ymax = Math.max(y1, y2);
      if (y < ymin || y >= ymax) continue;
      const x = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1);
      xs.push(x);
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]);
      const xb = Math.round(xs[i + 1]);
      ctx.fillRect(xa, y, Math.max(1, xb - xa + 1), 1);
    }
  }
}

export function strokePolygon(ctx: Ctx2D, pts: Array<[number, number]>, colour: string): void {
  ctx.fillStyle = colour;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const f = steps === 0 ? 0 : s / steps;
      ctx.fillRect(Math.round(x1 + (x2 - x1) * f), Math.round(y1 + (y2 - y1) * f), 1, 1);
    }
  }
}

export interface MapStyle {
  land: string;
  coast: string;
  sea?: string;
  grid?: string;
  labels?: boolean;
  /** Status overrides by station id. */
  overrides?: Partial<Record<string, StationStatus>>;
  /** Blink alert markers using time. */
  t?: number;
  /** Draw city labels for key sites. */
  cityLabels?: boolean;
}

export function drawScotland(ctx: Ctx2D, p: MapProjection, style: MapStyle): void {
  const { w, h } = mapSize(p);
  if (style.sea) rect(ctx, p.x0, p.y0, w, h, style.sea);
  if (style.grid) {
    ctx.fillStyle = style.grid;
    for (let lat = 55; lat <= 59; lat++) {
      const [, y] = project(p, LON0, lat);
      for (let x = p.x0; x < p.x0 + w; x += 2) ctx.fillRect(x, y, 1, 1);
    }
    for (let lon = -7; lon <= -2; lon++) {
      const [x] = project(p, lon, LAT_TOP);
      for (let y = p.y0; y < p.y0 + h; y += 2) ctx.fillRect(x, y, 1, 1);
    }
  }
  const main = MAINLAND.map(([lo, la]) => project(p, lo, la));
  fillPolygon(ctx, main, style.land);
  strokePolygon(ctx, main, style.coast);
  for (const isl of ISLANDS) {
    const pts = isl.map(([lo, la]) => project(p, lo, la));
    fillPolygon(ctx, pts, style.land);
    strokePolygon(ctx, pts, style.coast);
  }
  // The Clyde and Forth as hairline inlets (so Glasgow and Edinburgh read as river cities)
  const clyde = [project(p, -4.84, 55.96), project(p, -4.25, 55.86)];
  const forth = [project(p, -3.4, 56.03), project(p, -3.0, 56.05)];
  for (const [a, b] of [clyde, forth]) {
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    ctx.fillStyle = style.sea ?? style.coast;
    for (let s = 0; s <= steps; s++) {
      const f = s / Math.max(1, steps);
      ctx.fillRect(Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), 1, 1);
    }
  }

  if (style.cityLabels && p.k > 25) {
    const lab = (name: string, lon: number, lat: number, dx: number, dy: number) => {
      const [x, y] = project(p, lon, lat);
      drawText(ctx, name, x + dx, y + dy, FONT_3x5, style.coast);
    };
    lab('GLASGOW', -4.25, 55.86, 4, 3);
    lab('EDINBURGH', -3.19, 55.95, 4, -7);
    lab('FASLANE', -4.82, 56.06, -30, -4);
    lab('INVERNESS', -4.22, 57.48, 4, -2);
    lab('ABERDEEN', -2.1, 57.15, 3, 0);
    lab('DUNDEE', -2.97, 56.46, 3, -2);
  }
}

export function drawStations(ctx: Ctx2D, p: MapProjection, style: MapStyle): void {
  const t = style.t ?? 0;
  for (const s of STATIONS) {
    const status = style.overrides?.[s.id] ?? s.status;
    const [x, y] = project(p, s.lon, s.lat);
    let col = STATUS_COLOUR[status];
    const big = p.k > 25;
    if (status === 'alert' || status === 'compromised') {
      const on = Math.floor(t * 3 + hash1(s.id.length + s.lon * 10) * 2) % 2 === 0;
      if (!on) col = status === 'alert' ? '#7a1410' : '#5a0a0a';
      if (big) {
        // halo
        ctx.fillStyle = 'rgba(255,60,40,0.25)';
        ctx.fillRect(x - 2, y - 2, 5, 5);
      }
    }
    if (big) {
      rect(ctx, x - 1, y - 1, 3, 3, col);
      if (status === 'offline') {
        rect(ctx, x - 1, y - 1, 3, 3, '#1f2326');
        ctx.fillStyle = '#4c5358';
        ctx.fillRect(x - 1, y - 1, 1, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.fillRect(x - 1, y + 1, 1, 1);
        ctx.fillRect(x + 1, y - 1, 1, 1);
      }
      if (style.labels) drawText(ctx, s.name, x + 3, y - 2, FONT_3x5, '#6f8a6c');
    } else {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
      if (status === 'alert' || status === 'compromised') {
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x, y - 1, 1, 1);
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }
  }
}

export function countStatus(overrides?: Partial<Record<string, StationStatus>>): Record<StationStatus, number> {
  const out: Record<StationStatus, number> = { ok: 0, degraded: 0, offline: 0, alert: 0, compromised: 0 };
  for (const s of STATIONS) out[overrides?.[s.id] ?? s.status]++;
  return out;
}

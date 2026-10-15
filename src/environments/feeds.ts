/**
 * Secondary Glasgow feeds for the joint network:
 *   CAM-A  Glasgow Central — Argyle Street under the Hielanman's Umbrella
 *   CAM-B  M8 — the motorway in its concrete cutting near Charing Cross
 *   CAM-C  Industrial Glasgow — a dead shipyard with a Goliath gantry crane
 * Each is a 480×270 world. Static geometry is cached per feed.
 */
import { P, shade } from '../engine/Palette';
import { fbm2, hash1, hash2, noise1 } from '../engine/Rng';
import { hline, line, rect, vline, type Ctx2D } from '../engine/Surface';
import { drawText, FONT_3x5 } from '../engine/Font';
import { drawEntity } from '../creatures/Entity';
import type { EntityPlacement } from './clyde';
import { drawBarrier, drawCracks, drawLampPost, drawPuddle, drawRubble, drawVegetation, drawVehicle, drawWarehouse } from './props';
import { cached, cachedVersioned } from './cache';

export const FEED_W = 480;
export const FEED_H = 270;

function drawSky(ctx: Ctx2D, t: number, horizon: number, seed: number): void {
  rect(ctx, 0, 0, FEED_W, horizon, '#0a0e15');
  for (let y = 0; y < horizon; y += 1) {
    for (let x = 0; x < FEED_W; x += 2) {
      const n = fbm2((x + t * 3) / 80, y / 36, 3, seed);
      const v = n + (y / horizon) * 0.2;
      if (v > 0.63) rect(ctx, x, y, 2, 1, '#161e2a');
      else if (v > 0.52) rect(ctx, x, y, 2, 1, '#10161f');
    }
  }
}

function sky(ctx: Ctx2D, t: number, horizon: number, seed: number, key: string): void {
  const bucket = Math.floor(t * 2);
  const s = cachedVersioned(key, bucket, FEED_W, horizon, (c) => drawSky(c, bucket / 2, horizon, seed));
  ctx.drawImage(s.canvas, 0, 0);
}

// --------------------------------------------------------------------------
// CAM-A — Glasgow Central
// --------------------------------------------------------------------------

function centralStatic(ctx: Ctx2D): void {
  const vpX = 240;
  const vpY = 128;
  rect(ctx, 150, 100, 180, 60, '#06080c');
  const facade = (side: -1 | 1) => {
    for (let k = 0; k < 4; k++) {
      const depth = 1.05 - k * 0.2;
      const nearX = side < 0 ? 0 : FEED_W;
      const u0 = k / 4;
      const u1 = (k + 1) / 4;
      const x0 = Math.round(nearX + (vpX - nearX) * u0 * 0.72);
      const x1 = Math.round(nearX + (vpX - nearX) * u1 * 0.72);
      const groundY0 = Math.round(270 - (270 - vpY) * u0 * 0.72);
      const groundY1 = Math.round(270 - (270 - vpY) * u1 * 0.72);
      const topY0 = Math.round(0 + (vpY - 0) * u0 * 0.72);
      const topY1 = Math.round(0 + (vpY - 0) * u1 * 0.72);
      const w = Math.abs(x1 - x0);
      const left = Math.min(x0, x1);
      const stone = k % 2 === 0 ? '#44322a' : '#463d2e';
      for (let xx = 0; xx < w; xx++) {
        const u = xx / Math.max(1, w);
        const gy = Math.round(groundY0 + (groundY1 - groundY0) * u);
        const ty = Math.round(topY0 + (topY1 - topY0) * u);
        const X = side < 0 ? left + xx : left + w - 1 - xx;
        const col = shade(stone, depth * (0.8 + 0.2 * (hash2(X, k) > 0.5 ? 1 : 0.8)));
        vline(ctx, X, ty, gy, col);
        const colStep = Math.max(4, Math.round(9 * depth));
        if (xx % colStep < Math.max(2, Math.round(4 * depth))) {
          const floors = 4;
          for (let f = 0; f < floors; f++) {
            const fy0 = ty + Math.round(((gy - ty) * (f + 0.25)) / (floors + 0.5));
            const fh = Math.max(2, Math.round(((gy - ty) / (floors + 0.5)) * 0.5));
            const blown = hash2(X, f) > 0.6;
            rect(ctx, X, fy0, 1, fh, blown ? '#07080a' : shade('#0e131c', depth));
          }
        }
        const shopTop = gy - Math.round((gy - ty) * 0.16);
        rect(ctx, X, shopTop, 1, 1, shade('#6a5a48', depth));
        if (hash2(X >> 3, 99) > 0.5) rect(ctx, X, shopTop + 1, 1, gy - shopTop - 1, shade('#30343a', depth));
      }
      line(ctx, x0, topY0 + Math.round((groundY0 - topY0) * 0.08), x1, topY1 + Math.round((groundY1 - topY1) * 0.08), shade('#564638', depth), 1);
    }
  };
  facade(-1);
  facade(1);
  for (let y = vpY; y < FEED_H; y++) {
    const u = (y - vpY) / (FEED_H - vpY);
    const half = Math.round(u * 240);
    rect(ctx, vpX - half, y, half * 2, 1, u < 0.3 ? '#1b1f24' : u < 0.7 ? '#20252b' : '#252b32');
    rect(ctx, vpX - half, y, 1, 1, '#444a50');
    rect(ctx, vpX + half - 1, y, 1, 1, '#444a50');
  }
  for (let i = 1; i < 14; i++) {
    const u = i / 14;
    const y = Math.round(vpY + (FEED_H - vpY) * u * u);
    if (i % 2 === 0) rect(ctx, vpX, y, 1, Math.max(1, Math.round(u * 6)), '#474b51');
  }
  for (let x = 60; x < 420; x += 24) rect(ctx, x, 252, 12, 3, '#44484e');
  // Hielanman's Umbrella
  const bx0 = 92, bx1 = 388, by0 = 56, by1 = 150;
  rect(ctx, bx0, by0, bx1 - bx0, by1 - by0, '#1a1e23');
  rect(ctx, bx0, by0, bx1 - bx0, 6, '#2a2f35');
  rect(ctx, bx0, by0 + 6, bx1 - bx0, 2, '#363c43');
  for (let x = bx0 + 8; x < bx1 - 8; x += 12) {
    const panelOk = hash2(x, 3) > 0.45;
    rect(ctx, x, by0 + 12, 9, 56, panelOk ? '#14202c' : '#06070a');
    rect(ctx, x + 2, by0 + 10, 5, 2, panelOk ? '#14202c' : '#06070a');
    rect(ctx, x + 3, by0 + 9, 3, 1, panelOk ? '#14202c' : '#06070a');
    vline(ctx, x + 9, by0 + 9, by0 + 68, '#343a41');
    if (panelOk) {
      rect(ctx, x + 1, by0 + 14, 2, 10, '#203040');
      hline(ctx, x, x + 8, by0 + 36, '#262d34');
    } else if (hash2(x, 4) > 0.5) {
      rect(ctx, x, by0 + 12, 2, 7, '#14202c');
      rect(ctx, x + 6, by0 + 60, 3, 8, '#14202c');
    }
  }
  rect(ctx, bx0 + 4, by0 + 70, bx1 - bx0 - 8, 12, '#22262c');
  drawText(ctx, 'GLASGOW CENTRAL', 240, by0 + 73, FONT_3x5, '#7a7a68', { align: 'center' });
  rect(ctx, bx0, by0 + 84, bx1 - bx0, 10, '#14171b');
  for (let x = bx0; x < bx1; x += 10) rect(ctx, x, by0 + 84, 1, 10, '#22262c');
  for (const cx of [bx0 + 4, bx0 + 60, bx1 - 64, bx1 - 8]) {
    rect(ctx, cx, by1 - 4, 6, 60, '#2a2f35');
    rect(ctx, cx, by1 - 4, 1, 60, '#3b4147');
    rect(ctx, cx - 1, by1 + 52, 8, 4, '#30363c');
  }
  rect(ctx, bx0 + 10, by1 - 4, bx1 - bx0 - 20, 36, 'rgba(0,0,0,0.5)');
  line(ctx, 100, 150, 112, 215, '#262a30', 1);
  rect(ctx, 108, 212, 5, 12, '#1e2226');
  rect(ctx, 109, 214, 3, 2, '#3a1010');
  rect(ctx, 109, 218, 3, 2, '#2a2a10');
  drawCracks(ctx, 0, 200, FEED_W, 70, 1, 75);
  drawRubble(ctx, 20, 262, 60, 7, 1.1, 73);
}

export function drawCentralWorld(ctx: Ctx2D, t: number, entity?: EntityPlacement): void {
  sky(ctx, t, 120, 21, 'feed-sky-a');
  ctx.drawImage(cached('feed-central', FEED_W, FEED_H, centralStatic).canvas, 0, 0);
  const lampOn = noise1(t * 6, 9) > 0.35;
  if (lampOn) {
    rect(ctx, 300, 152, 3, 2, '#c57a2a');
    for (let k = 0; k < 20; k++) {
      ctx.fillStyle = `rgba(197,122,42,${(0.08 * (1 - k / 20)).toFixed(3)})`;
      ctx.fillRect(300 - k, 154 + k, 3 + k * 2, 1);
    }
  }
  if (entity) drawEntity(ctx, entity.x, entity.y, entity.H, entity.pose, entity.style, t);
  drawVehicle(ctx, { x: 150, y: 232, kind: 'car', colour: '#121214', depth: 1, seed: 12 });
  drawVehicle(ctx, { x: 290, y: 246, kind: 'bus', colour: '#3a1d1d', depth: 1.05, seed: 13, flipped: true });
  drawLampPost(ctx, 70, 250, 44, 1.05, false);
  drawLampPost(ctx, 410, 246, 44, 1.05, true);
  drawVegetation(ctx, 200, 262, 6, t, 1.1, 71);
  drawVegetation(ctx, 440, 258, 5, t, 1.1, 72);
  drawPuddle(ctx, 240, 266, 60, t, 1.1, 74);
}

// --------------------------------------------------------------------------
// CAM-B — M8 motorway
// --------------------------------------------------------------------------

function m8Static(ctx: Ctx2D): void {
  const vpX = 250;
  const vpY = 100;
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 68;
    const h = 18 + Math.round(hash1(i) * 26);
    rect(ctx, x, 96 - h, 20 + Math.round(hash1(i + 3) * 14), h, '#1a1f26');
  }
  for (let x = 0; x < FEED_W; x++) {
    const dx = x - vpX;
    if (Math.abs(dx) < 4) continue;
    const u = Math.abs(dx) / 262;
    if (u > 1) {
      rect(ctx, x, 96, 1, FEED_H - 96, '#2c3137');
      continue;
    }
    const y = Math.round(vpY + u * (FEED_H - vpY));
    const wallH = Math.round(14 + u * 60);
    vline(ctx, x, y - wallH, y, shade('#30353b', 0.55 + u * 0.45));
    if (x % 6 === 0) vline(ctx, x, y - wallH, y, shade('#24282d', 0.55 + u * 0.45));
    rect(ctx, x, y - wallH, 1, 1, shade('#454b52', 0.55 + u * 0.45));
  }
  for (let y = vpY; y < FEED_H; y++) {
    const u = (y - vpY) / (FEED_H - vpY);
    const half = Math.round(u * 262);
    rect(ctx, vpX - half, y, half * 2, 1, u < 0.25 ? '#181c21' : u < 0.6 ? '#1e2329' : '#23282f');
  }
  for (let i = 1; i < 40; i++) {
    const u = (i / 40) ** 2;
    const y = Math.round(vpY + (FEED_H - vpY) * u);
    const half = Math.round(u * 262);
    rect(ctx, vpX - 1, y, 2, 1, '#4f555c');
    if (i % 3 === 0) {
      for (const lane of [0.33, 0.66]) {
        rect(ctx, vpX - Math.round(half * lane), y, 1, Math.max(1, Math.round(u * 4)), '#444850');
        rect(ctx, vpX + Math.round(half * lane), y, 1, Math.max(1, Math.round(u * 4)), '#444850');
      }
    }
    rect(ctx, vpX - half + 2, y, 1, 1, '#53575d');
    rect(ctx, vpX + half - 3, y, 1, 1, '#53575d');
  }
  const gy = 112;
  rect(ctx, 150, gy, 200, 3, '#30363c');
  rect(ctx, 150, gy, 200, 1, '#40464d');
  rect(ctx, 150, gy - 20, 3, 60, '#30363c');
  rect(ctx, 347, gy - 20, 3, 60, '#30363c');
  rect(ctx, 168, gy - 18, 70, 17, '#1d3466');
  rect(ctx, 168, gy - 18, 70, 1, '#5a76b4');
  drawText(ctx, 'M8 (W)', 203, gy - 16, FONT_3x5, '#d8dde8', { align: 'center' });
  drawText(ctx, 'GREENOCK', 203, gy - 9, FONT_3x5, '#d8dde8', { align: 'center' });
  rect(ctx, 262, gy - 18, 70, 17, '#1d3466');
  rect(ctx, 262, gy - 18, 70, 1, '#5a76b4');
  drawText(ctx, 'KINGSTON', 297, gy - 16, FONT_3x5, '#d8dde8', { align: 'center' });
  drawText(ctx, 'BRIDGE', 297, gy - 9, FONT_3x5, '#d8dde8', { align: 'center' });
  for (let i = 0; i < 6; i++) rect(ctx, 170 + Math.floor(hash1(i) * 160), gy - 16 + Math.floor(hash1(i + 7) * 12), 1, 1, '#05070a');
  rect(ctx, 150, 88, 200, 10, '#22262c');
  rect(ctx, 150, 88, 200, 1, '#32373d');
  for (let x = 160; x < 350; x += 20) rect(ctx, x, 98, 4, 16, '#1e2226');
  drawVehicle(ctx, { x: 190, y: 190, kind: 'car', colour: '#6a2a2a', depth: 0.85, seed: 16, flipped: true });
  drawVehicle(ctx, { x: 258, y: 170, kind: 'car', colour: '#3a3a4a', depth: 0.75, seed: 17 });
  drawCracks(ctx, 0, 180, FEED_W, 90, 1, 84);
  rect(ctx, 20, 60, 3, 200, '#262a30');
}

export function drawM8World(ctx: Ctx2D, t: number, entity?: EntityPlacement): void {
  sky(ctx, t, 96, 31, 'feed-sky-b');
  ctx.drawImage(cached('feed-m8', FEED_W, FEED_H, m8Static).canvas, 0, 0);
  if (entity) drawEntity(ctx, entity.x, entity.y, entity.H, entity.pose, entity.style, t);
  drawVehicle(ctx, { x: 90, y: 236, kind: 'car', colour: '#5a5a62', depth: 1, seed: 14 });
  drawVehicle(ctx, { x: 300, y: 228, kind: 'van', colour: '#2a3a2a', depth: 1, seed: 15, burnt: true });
  drawVehicle(ctx, { x: 60, y: 258, kind: 'lorry', colour: '#4a4a3a', depth: 1.1, seed: 18 });
  drawVehicle(ctx, { x: 360, y: 258, kind: 'police', colour: '#c0c0c0', depth: 1.1, seed: 19, burnt: true });
  drawBarrier(ctx, 400, 250, 60, 1);
  drawRubble(ctx, 0, 268, 480, 5, 1, 81);
  drawVegetation(ctx, 30, 236, 5, t, 1, 82);
  drawVegetation(ctx, 450, 230, 4, t, 1, 83);
  drawPuddle(ctx, 200, 258, 70, t, 1, 85);
  void P;
}

// --------------------------------------------------------------------------
// CAM-C — Industrial Glasgow (dead shipyard)
// --------------------------------------------------------------------------

function industrialStatic(ctx: Ctx2D): void {
  const beamY = 30;
  rect(ctx, 40, beamY, 400, 10, '#1f242a');
  rect(ctx, 40, beamY, 400, 1, '#32383f');
  for (let x = 44; x < 440; x += 8) {
    rect(ctx, x, beamY + 2, 1, 6, '#2a2f35');
    line(ctx, x, beamY + 8, x + 8, beamY + 2, '#2a2f35', 1);
  }
  rect(ctx, 230, beamY + 10, 20, 6, '#262a2f');
  vline(ctx, 240, beamY + 16, beamY + 70, '#32383f');
  rect(ctx, 237, beamY + 70, 7, 4, '#32383f');
  for (const lx of [50, 420]) {
    rect(ctx, lx, beamY + 10, 10, 150, '#22262c');
    rect(ctx, lx, beamY + 10, 1, 150, '#353a41');
    for (let y = beamY + 14; y < 180; y += 10) hline(ctx, lx, lx + 9, y, '#2a2f35');
  }
  drawWarehouse(ctx, 70, 160, 110, 48, 51, 0.85, true);
  drawWarehouse(ctx, 190, 160, 90, 40, 52, 0.85, false);
  drawWarehouse(ctx, 290, 160, 120, 52, 53, 0.85, true);
  rect(ctx, 150, 60, 8, 100, '#262a30');
  rect(ctx, 150, 60, 1, 100, '#353a41');
  rect(ctx, 148, 60, 12, 3, '#30363c');
  const wy = 128;
  rect(ctx, 120, wy, 240, 6, '#2d3239');
  rect(ctx, 120, wy, 240, 1, '#434950');
  for (let x = 124; x < 360; x += 6) rect(ctx, x, wy - 8, 1, 8, '#353a41');
  hline(ctx, 120, 360, wy - 8, '#434950');
  rect(ctx, 130, wy + 6, 6, 60, '#2a2f35');
  rect(ctx, 344, wy + 6, 6, 60, '#2a2f35');
  rect(ctx, 0, 160, FEED_W, 110, '#1d2025');
  for (let y = 160; y < FEED_H; y += 7) hline(ctx, 0, FEED_W, y, '#21252a');
  for (const off of [-1, 1]) {
    for (let y = 160; y < FEED_H; y++) {
      const u = (y - 160) / 110;
      const x = 240 + off * Math.round(20 + u * 160);
      rect(ctx, x, y, 1, 1, '#444850');
      rect(ctx, x + off, y, 1, 1, '#30343a');
    }
  }
  for (let i = 0; i < 14; i++) {
    const u = (i / 14) ** 1.6;
    const y = Math.round(160 + u * 110);
    const half = Math.round(22 + u * 165);
    rect(ctx, 240 - half, y, half * 2, 1, '#2b2f34');
  }
  drawRubble(ctx, 20, 200, 80, 14, 0.9, 91);
  drawRubble(ctx, 380, 210, 90, 16, 0.95, 92);
  for (let i = 0; i < 5; i++) {
    const dx = 400 + i * 12;
    rect(ctx, dx, 232, 9, 12, i % 2 ? '#3a3020' : '#2a3a30');
    rect(ctx, dx, 232, 9, 1, '#4a4030');
  }
  for (let x = 0; x < 110; x++) {
    const u = x / 110;
    const h = Math.round(Math.sin(u * Math.PI) * 40);
    vline(ctx, x, 230 - h, 230, '#302a26');
    rect(ctx, x, 230 - h, 1, 1, '#463d35');
    if (x % 9 === 0) vline(ctx, x, 230 - h + 2, 230, P.rust1);
  }
  drawCracks(ctx, 0, 190, FEED_W, 80, 1, 97);
}

export function drawIndustrialWorld(ctx: Ctx2D, t: number, entity?: EntityPlacement): void {
  sky(ctx, t, 150, 41, 'feed-sky-c');
  ctx.drawImage(cached('feed-industrial', FEED_W, FEED_H, industrialStatic).canvas, 0, 0);
  const wy = 128;
  const lampOn = noise1(t * 5, 13) > 0.3;
  if (lampOn) {
    rect(ctx, 236, wy + 6, 8, 3, '#c57a2a');
    for (let k = 0; k < 60; k++) {
      ctx.fillStyle = `rgba(197,122,42,${(0.09 * (1 - k / 60)).toFixed(3)})`;
      ctx.fillRect(240 - 4 - Math.round(k * 0.7), wy + 9 + k, 8 + Math.round(k * 1.4), 1);
    }
  }
  if (entity) drawEntity(ctx, entity.x, entity.y, entity.H, entity.pose, entity.style, t);
  drawVehicle(ctx, { x: 300, y: 262, kind: 'lorry', colour: '#3a3a30', depth: 1.1, seed: 93, burnt: true });
  drawVegetation(ctx, 160, 258, 6, t, 1.05, 94);
  drawVegetation(ctx, 60, 262, 7, t, 1.1, 95);
  drawPuddle(ctx, 200, 250, 60, t, 1, 96);
}

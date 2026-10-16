/**
 * CAM-12 — Glasgow West, Clyde Corridor.
 *
 * A remote optical station on the south bank looks north-east across the
 * River Clyde. Left to right: the dark dome of the exhibition halls, the
 * Finnieston Crane with its jib out over the water, the Anderston
 * tenements, and the Kingston Bridge carrying the M8 across the river on
 * tall concrete piers — with a collapsed span. In the foreground the quay
 * road is flooding, choked with abandoned vehicles and buddleia.
 *
 * Static geometry is cached; only water, weather, vegetation, lights and
 * the entity are redrawn per frame.
 */
import { P, shade } from '../engine/Palette';
import { fbm2, hash1, hash2, noise1, Rng } from '../engine/Rng';
import { dither, hline, line, rect, vline, type Ctx2D } from '../engine/Surface';
import { drawEntity, type EntityStyle, type Pose } from '../creatures/Entity';
import {
  drawBarrier, drawCracks, drawFinniestonCrane, drawLampPost, drawNeedleTower, drawPuddle,
  drawRubble, drawTenement, drawVegetation, drawVehicle, drawWarehouse,
} from './props';
import { cached, cachedVersioned } from './cache';

export const CLYDE_W = 560;
export const CLYDE_H = 270;

export interface EntityPlacement {
  x: number;
  /** Ground y in world pixels. */
  y: number;
  H: number;
  pose: Pose;
  style: EntityStyle;
  /** Drawn by the scene as a looming head in frame space instead of a skeleton. */
  looming?: boolean;
}

export interface ClydeState {
  /** 0..1 lightning flash brightness. */
  lightning: number;
  entity?: EntityPlacement;
  thermal?: boolean;
}

const SKY0 = '#0a0e15';
const SKY1 = '#10161f';
const SKY2 = '#161e2a';

const RIVER_Y = 134;
const RIVER_BOTTOM = 190;
const QUAY_Y = 190;
const SKYBASE = 128;
const FAR = 0.62;

export function drawClydeWorld(ctx: Ctx2D, t: number, s: ClydeState): void {
  const flash = s.lightning;

  // --- Sky (cached in coarse time buckets; clouds drift slowly)
  const sky = cachedVersioned('clyde-sky', Math.floor(t * 2), CLYDE_W, RIVER_Y, (c) => drawSky(c, Math.floor(t * 2) / 2));
  ctx.drawImage(sky.canvas, 0, 0);
  if (flash > 0) drawLightning(ctx, t, flash);

  // --- Static far layer: skyline, crane, bridge, far quay wall
  const far = cached('clyde-far', CLYDE_W, RIVER_Y + 2, drawFarLayer);
  ctx.drawImage(far.canvas, 0, 0);
  if (flash > 0) {
    ctx.fillStyle = `rgba(160,180,210,${(0.18 * flash).toFixed(3)})`;
    ctx.fillRect(0, 0, CLYDE_W, RIVER_Y);
  }
  // aviation light on the crane — one of the last working lights in the city
  if (Math.floor(t * 1.0) % 2 === 0) {
    rect(ctx, 168, SKYBASE - 70, 1, 1, '#ff3b2f');
    rect(ctx, 167, SKYBASE - 71, 3, 3, 'rgba(255,60,40,0.25)');
  }

  // --- River with reflections (dynamic)
  drawRiver(ctx, t, flash, s.thermal ?? false);

  // Bridge piers standing in the water
  const piers = cached('clyde-piers', CLYDE_W, CLYDE_H, (c) => {
    for (const px of [372, 420, 468]) {
      const pierTop = 100 + Math.round((px - 372) * 0.12);
      rect(c, px, pierTop, 9, QUAY_Y + 8 - pierTop, shade('#2d3136', 0.8));
      rect(c, px, pierTop, 1, QUAY_Y + 8 - pierTop, shade('#3c4147', 0.8));
      rect(c, px + 8, pierTop, 1, QUAY_Y + 8 - pierTop, shade('#1e2125', 0.8));
      rect(c, px - 2, pierTop, 13, 4, shade('#33383d', 0.8));
      rect(c, px, QUAY_Y - 14, 9, 14, shade('#1f2226', 0.8));
    }
  });
  ctx.drawImage(piers.canvas, 0, 0);

  // --- Near bank: static quay and road
  const quay = cached('clyde-quay', CLYDE_W, CLYDE_H, drawQuayStatic);
  ctx.drawImage(quay.canvas, 0, 0);
  drawFlood(ctx, t);

  // --- Props sorted by ground y so the entity can walk between them
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  const add = (y: number, draw: () => void) => items.push({ y, draw });

  add(214, () => {
    drawVehicle(ctx, { x: 108, y: 216, kind: 'police', colour: '#c9c9c9', depth: 0.85, seed: 5 });
    rect(ctx, 100, 212, 44, 6, '#101822');
  });
  add(222, () => drawVehicle(ctx, { x: 40, y: 224, kind: 'car', colour: '#5a1e1e', depth: 0.9, seed: 6, burnt: true }));
  add(230, () => drawVehicle(ctx, { x: 236, y: 232, kind: 'car', colour: '#2c3f6a', depth: 1, seed: 7 }));
  add(233, () => drawVehicle(ctx, { x: 288, y: 235, kind: 'van', colour: '#8a8a82', depth: 1, seed: 8, flipped: true }));
  add(238, () => drawVehicle(ctx, { x: 96, y: 240, kind: 'bus', colour: '#3a1d1d', depth: 1, seed: 9 }));
  add(246, () => drawVehicle(ctx, { x: 190, y: 250, kind: 'ambulance', colour: '#c8c8b8', depth: 1.05, seed: 10, burnt: true }));
  add(252, () => {
    // Kingston Bridge land pier on our bank — the "concrete structure"
    rect(ctx, 442, 92, 26, 162, '#2e3237');
    rect(ctx, 442, 92, 2, 162, '#3d4248');
    rect(ctx, 466, 92, 2, 162, '#1e2125');
    for (let y = 100; y < 250; y += 18) hline(ctx, 444, 465, y, '#262a2e');
    rect(ctx, 447, 236, 14, 1, '#6a2a2a');
    rect(ctx, 449, 238, 9, 1, '#6a2a2a');
    rect(ctx, 446, 240, 6, 1, '#6a5a2a');
    drawRubble(ctx, 438, 254, 34, 6, 1, 44);
  });
  add(228, () => drawLampPost(ctx, 160, 228, 34, 0.9, true));
  add(236, () => drawLampPost(ctx, 330, 236, 36, 1, false));
  add(244, () => drawLampPost(ctx, 520, 244, 36, 1, true));
  add(226, () => drawVegetation(ctx, 272, 226, 4, t, 0.95, 61));
  add(240, () => drawVegetation(ctx, 350, 241, 5, t, 1, 62));
  add(254, () => drawVegetation(ctx, 420, 255, 6, t, 1.05, 63));
  add(258, () => drawVegetation(ctx, 160, 258, 7, t, 1.05, 64));
  add(262, () => drawVegetation(ctx, 300, 262, 5, t, 1.1, 65));
  add(248, () => drawBarrier(ctx, 500, 250, 40, 1));
  add(256, () => drawRubble(ctx, 220, 258, 40, 6, 1, 45));
  add(260, () => drawPuddle(ctx, 340, 262, 44, t, 1, 46));
  add(264, () => drawPuddle(ctx, 180, 266, 30, t, 1, 47));

  if (s.entity && !s.entity.looming) {
    const e = s.entity;
    add(e.y, () => drawEntity(ctx, e.x, e.y, e.H, e.pose, e.style, t));
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  // damp haze above the water line
  ctx.fillStyle = 'rgba(120,140,160,0.05)';
  ctx.fillRect(0, RIVER_Y + 20, CLYDE_W, 40);
}

function drawSky(ctx: Ctx2D, t: number): void {
  rect(ctx, 0, 0, CLYDE_W, RIVER_Y, SKY0);
  for (let y = 0; y < RIVER_Y; y += 1) {
    for (let x = 0; x < CLYDE_W; x += 2) {
      const n = fbm2((x + t * 4) / 90, y / 40, 3, 11);
      const v = n + (y / RIVER_Y) * 0.25;
      if (v > 0.62) rect(ctx, x, y, 2, 1, SKY2);
      else if (v > 0.5) rect(ctx, x, y, 2, 1, SKY1);
    }
  }
  // faint glow on the horizon from fires somewhere east
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(120,70,30,${(0.025 * (10 - i) / 10).toFixed(3)})`;
    ctx.fillRect(360, RIVER_Y - 40 + i * 4, 200, 4);
  }
}

function drawLightning(ctx: Ctx2D, t: number, flash: number): void {
  ctx.fillStyle = `rgba(190,200,230,${(0.28 * flash).toFixed(3)})`;
  ctx.fillRect(0, 0, CLYDE_W, RIVER_Y);
  if (flash > 0.6) {
    let bx = 470 + Math.round(hash1(Math.floor(t * 10)) * 40);
    let by = 6;
    for (let k = 0; k < 14; k++) {
      const nx = bx + Math.round((hash2(k, Math.floor(t * 10)) - 0.5) * 8);
      const ny = by + 5 + Math.round(hash2(k + 50, Math.floor(t * 10)) * 4);
      line(ctx, bx, by, nx, ny, '#e8ecff', 1);
      bx = nx;
      by = ny;
      if (by > 90) break;
    }
  }
}

function drawFarLayer(ctx: Ctx2D): void {
  const far = FAR;
  // exhibition hall dome (left)
  for (let x = 20; x < 140; x++) {
    const u = (x - 80) / 60;
    const hgt = Math.round(Math.max(0, 1 - u * u) * 26);
    vline(ctx, x, SKYBASE - hgt, SKYBASE, shade('#20252c', far));
    if (hgt > 0) rect(ctx, x, SKYBASE - hgt, 1, 1, shade('#2e343c', far));
  }
  // ribbed auditorium beside it
  for (let i = 0; i < 6; i++) {
    const rx = 130 + i * 9;
    for (let x = 0; x < 11; x++) {
      const u = (x - 5) / 5;
      const hgt = Math.round(Math.max(0, 1 - u * u) * (14 + i * 2));
      vline(ctx, rx + x, SKYBASE - hgt, SKYBASE, shade('#22272e', far));
    }
  }
  drawWarehouse(ctx, 200, SKYBASE, 46, 22, 21, far, true);
  drawTenement(ctx, { x: 250, y: SKYBASE, w: 44, floors: 4, stone: 'red', damage: 0.5, seed: 31, depth: far });
  drawTenement(ctx, { x: 296, y: SKYBASE, w: 40, floors: 4, stone: 'blonde', damage: 0.2, seed: 32, depth: far, litWindow: true });
  drawTenement(ctx, { x: 338, y: SKYBASE, w: 36, floors: 4, stone: 'red', damage: 0.8, seed: 33, depth: far });
  // ruined tower block (Anderston high flats)
  rect(ctx, 400, SKYBASE - 70, 22, 70, shade('#20252c', far));
  for (let yy = SKYBASE - 66; yy < SKYBASE; yy += 5) {
    for (let xx = 402; xx < 420; xx += 4) rect(ctx, xx, yy, 2, 2, hash2(xx, yy) > 0.7 ? shade('#0c0e12', far) : shade('#171b22', far));
  }
  for (let xx = 0; xx < 22; xx++) rect(ctx, 400 + xx, SKYBASE - 70, 1, Math.round(hash1(xx) * 9), SKY0);
  // church spire, gasholder frame
  line(ctx, 460, SKYBASE - 30, 460, SKYBASE, shade('#20252c', far), 3);
  line(ctx, 460, SKYBASE - 44, 460, SKYBASE - 30, shade('#20252c', far), 1);
  for (let i = 0; i < 5; i++) vline(ctx, 500 + i * 8, SKYBASE - 28, SKYBASE, shade('#252a31', far));
  for (let i = 0; i < 4; i++) hline(ctx, 500, 532, SKYBASE - 28 + i * 8, shade('#252a31', far));
  drawNeedleTower(ctx, 8, SKYBASE, 58, shade('#20252c', far));
  // Finnieston Crane: the dominant silhouette, jib over the river
  drawFinniestonCrane(ctx, 168, SKYBASE, 1.25, shade('#2a2f36', far + 0.25), true);
  // far quay wall
  rect(ctx, 0, SKYBASE, CLYDE_W, 6, shade('#2a2e33', far));
  hline(ctx, 0, CLYDE_W, SKYBASE, shade('#383e45', far));
  for (let x = 0; x < CLYDE_W; x += 13) rect(ctx, x, SKYBASE + 1, 1, 5, shade('#1e2125', far));
  drawKingstonBridge(ctx, far);
}

function drawKingstonBridge(ctx: Ctx2D, far: number): void {
  const d = far + 0.3;
  const deckCol = shade('#30353b', d);
  const deckHi = shade('#454b52', d);
  const deckLo = shade('#1e2125', d);
  for (let x = 372; x < CLYDE_W; x++) {
    const u = (x - 372) / (CLYDE_W - 372);
    const y = Math.round(96 - u * 36);
    const thick = 6 + Math.round(u * 8);
    if (x > 480 && x < 506) {
      if (x % 4 === 0) line(ctx, x, y + thick, x + 1, y + thick + 6 + (x % 3) * 2, shade(P.rust2, d), 1);
      continue;
    }
    rect(ctx, x, y, 1, thick, deckCol);
    rect(ctx, x, y, 1, 1, deckHi);
    rect(ctx, x, y + thick - 1, 1, 1, deckLo);
    if (x % 3 === 0) rect(ctx, x, y - 3, 1, 3, deckLo);
    if (x % 23 === 5) rect(ctx, x, y - 2, 4, 2, shade('#3a3a3a', d));
  }
  // twin deck slightly lower
  for (let x = 372; x < 470; x++) {
    const u = (x - 372) / (CLYDE_W - 372);
    const y = Math.round(104 - u * 36);
    rect(ctx, x, y, 1, 4, shade('#282c31', d));
    rect(ctx, x, y + 3, 1, 1, deckLo);
  }
}

function drawRiver(ctx: Ctx2D, t: number, flash: number, thermal: boolean): void {
  const h = RIVER_BOTTOM - RIVER_Y;
  for (let y = 0; y < h; y++) {
    const u = y / h;
    const base = u < 0.4 ? '#101a26' : u < 0.75 ? '#17242f' : '#1e2e3e';
    rect(ctx, 0, RIVER_Y + y, CLYDE_W, 1, thermal ? '#1a1a1a' : base);
  }
  // reflections of the skyline, broken by ripples
  for (let y = 0; y < h; y++) {
    const srcY = RIVER_Y - 1 - Math.round(y * 0.9);
    if (srcY < 60) break;
    const ripple = Math.round(Math.sin(y * 0.9 + t * 2.1) * 1.5 + noise1(y * 0.3 + t * 0.7, 3) * 2);
    const alpha = 0.26 * (1 - y / h);
    ctx.fillStyle = `rgba(0,0,0,${alpha.toFixed(3)})`;
    if (srcY > 78) ctx.fillRect(166 + ripple, RIVER_Y + y, 5, 1);
    if (srcY > 58 && srcY < 128) ctx.fillRect(400 + ripple, RIVER_Y + y, 22, 1);
    if (srcY > 72) ctx.fillRect(250 + ripple, RIVER_Y + y, 124, 1);
    if (srcY > 104) ctx.fillRect(30 + ripple, RIVER_Y + y, 100, 1);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(168, RIVER_Y + 40 + Math.round(Math.sin(t * 2) * 1), 70, 1);
  if (Math.floor(t * 1.0) % 2 === 0) rect(ctx, 168 + Math.round(Math.sin(t * 3) * 1), RIVER_Y + 46, 1, 1, '#8a1a14');
  // crests
  ctx.fillStyle = flash > 0 ? '#6a7b8f' : '#34465a';
  for (let i = 0; i < 90; i++) {
    const row = Math.floor(hash1(i) * h);
    const speed = 6 + hash1(i + 100) * 10;
    const x = ((hash1(i + 200) * CLYDE_W + t * speed) % CLYDE_W + CLYDE_W) % CLYDE_W;
    const len = 2 + Math.floor(hash1(i + 300) * 4) + Math.floor(row / 14);
    if (noise1(t * 2 + i, 7) > 0.35) ctx.fillRect(Math.round(x), RIVER_Y + row, len, 1);
  }
  // flotsam
  const fx = ((t * 3) % (CLYDE_W + 40)) - 20;
  rect(ctx, Math.round(fx), RIVER_Y + 36 + Math.round(Math.sin(t * 1.3)), 7, 2, '#2a2420');
  rect(ctx, Math.round(fx) + 2, RIVER_Y + 35 + Math.round(Math.sin(t * 1.3)), 2, 1, '#3a342c');
  if (flash > 0) {
    ctx.fillStyle = `rgba(160,180,210,${(0.15 * flash).toFixed(3)})`;
    ctx.fillRect(0, RIVER_Y, CLYDE_W, h);
  }
}

function drawQuayStatic(ctx: Ctx2D): void {
  rect(ctx, 0, QUAY_Y, CLYDE_W, 4, '#33383e');
  hline(ctx, 0, CLYDE_W, QUAY_Y, '#444a52');
  for (let y = QUAY_Y + 4; y < CLYDE_H; y++) {
    const u = (y - QUAY_Y) / (CLYDE_H - QUAY_Y);
    const col = u < 0.3 ? '#22262b' : u < 0.7 ? '#262b31' : '#2a3037';
    rect(ctx, 0, y, CLYDE_W, 1, col);
  }
  for (let x = 200; x < CLYDE_W; x += 22) rect(ctx, x, 230, 10, 1, '#474b51');
  hline(ctx, 200, CLYDE_W, QUAY_Y + 6, '#3f434a');
  for (let x = 200; x < CLYDE_W; x += 9) rect(ctx, x, QUAY_Y + 5, 1, 2, '#2d3136');
  drawCracks(ctx, 200, QUAY_Y + 8, CLYDE_W - 200, 60, 1, 71);
  for (let i = 0; i < 40; i++) {
    const x = 200 + Math.floor(hash1(i) * (CLYDE_W - 200));
    const y = QUAY_Y + 10 + Math.floor(hash1(i + 9) * 55);
    rect(ctx, x, y, 1 + Math.floor(hash1(i + 20) * 2), 1, hash1(i + 30) > 0.5 ? P.moss1 : '#30343a');
  }
  for (let x = 0; x < CLYDE_W; x += 12) {
    const bend = x > 380 && x < 440 ? 3 : 0;
    vline(ctx, x, QUAY_Y - 7 + bend, QUAY_Y, '#40464d');
  }
  for (let x = 0; x < CLYDE_W; x++) {
    const bend = x > 380 && x < 440 ? Math.round(Math.sin(((x - 380) / 60) * Math.PI) * 4) : 0;
    rect(ctx, x, QUAY_Y - 7 + bend, 1, 1, '#4c535b');
  }
  dither(ctx, 0, QUAY_Y + 4, CLYDE_W, 3, '#22262b', '#1a1d21', 0.5);
  void Rng;
}

function drawFlood(ctx: Ctx2D, t: number): void {
  for (let y = QUAY_Y + 4; y < 236; y++) {
    const edge = 200 - Math.round((y - QUAY_Y) * 3.2) + Math.round(Math.sin(y * 0.4 + t * 1.5) * 1.5);
    if (edge > 0) {
      rect(ctx, 0, y, edge, 1, y % 3 === 0 ? '#22334a' : '#1b2a3c');
      rect(ctx, edge, y, 1, 1, '#3a4e60');
    }
  }
  for (let x = 20; x < 160; x += 14) rect(ctx, x, 206, 6, 1, '#2f4258');
  for (let x = 0; x < 200; x++) {
    const wave = Math.round(Math.sin(x * 0.25 + t * 1.8) * 1.5 + 1);
    rect(ctx, x, QUAY_Y + 10 + wave + Math.round(x * 0.06), 1, 1, '#2d4458');
  }
}

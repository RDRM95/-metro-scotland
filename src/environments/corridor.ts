/**
 * INTERNAL SECURITY — CORRIDOR B-17.
 *
 * A ceiling-mounted camera, tilted down, looks along a concrete corridor
 * towards a sealed security door. A pinhole model gives honest perspective:
 * floor rows and wall columns are solved per pixel.
 */
import { drawText, FONT_3x5 } from '../engine/Font';
import { hash2, noise1 } from '../engine/Rng';
import { rect, type Ctx2D } from '../engine/Surface';
import { compressedPose, drawEntity, drawLoomingHead, headRaisePose } from '../creatures/Entity';

export const CORRIDOR_W = 480;
export const CORRIDOR_H = 270;

const F = 210; // focal length px
const CAM_H = 2.35; // camera height (m)
const HALF_W = 1.3; // corridor half width (m)
const CEIL = 2.6;
const VP_X = 240;
const VP_Y = 84; // tilted down: horizon sits high in frame
const Z_FAR = 10;
const TUBES = [2.4, 4.9, 7.4, 9.6];

export interface CorridorState {
  flicker: number[];
  entityFar: number;
  headRaise: number;
  entityNear: boolean;
  dark: number;
  doorLamp: boolean;
}

const projX = (xm: number, z: number): number => VP_X + (xm * F) / z;
const projY = (ym: number, z: number): number => VP_Y + ((CAM_H - ym) * F) / z;

function greyOf(base: number, l: number): string {
  const v = Math.round(base * (0.18 + 0.82 * l));
  return `rgb(${v},${v + 2},${v + 5})`;
}

export function drawCorridor(ctx: Ctx2D, t: number, s: CorridorState): void {
  rect(ctx, 0, 0, CORRIDOR_W, CORRIDOR_H, '#04050a');
  const lightAt = (z: number): number => {
    let l = 0.06;
    for (let i = 0; i < TUBES.length; i++) {
      const d = Math.abs(z - TUBES[i]);
      l += (s.flicker[i] ?? 1) * Math.max(0, 1 - d / 2.0) * 0.95;
    }
    return Math.min(1, l) * (1 - s.dark);
  };

  // --- Floor rows (below horizon)
  const farFloorY = Math.round(projY(0, Z_FAR));
  for (let sy = CORRIDOR_H - 1; sy >= farFloorY; sy--) {
    const z = (CAM_H * F) / (sy - VP_Y);
    const l = lightAt(z);
    const halfPx = (HALF_W * F) / z;
    const x0 = Math.max(0, Math.round(VP_X - halfPx));
    const x1 = Math.min(CORRIDOR_W, Math.round(VP_X + halfPx));
    const tile = Math.floor(z / 0.6) % 2 === 0;
    rect(ctx, x0, sy, x1 - x0, 1, greyOf(tile ? 78 : 70, l));
    const zNext = (CAM_H * F) / (sy - 1 - VP_Y);
    if (Math.floor(z / 0.6) !== Math.floor(zNext / 0.6)) rect(ctx, x0, sy, x1 - x0, 1, greyOf(44, l));
    const lw = Math.max(1, Math.round((0.08 * F) / z));
    rect(ctx, VP_X - Math.floor(lw / 2), sy, lw, 1, `rgba(150,130,40,${(0.4 * l).toFixed(3)})`);
    if (hash2(sy, 3) > 0.985) rect(ctx, x0 + Math.floor(hash2(sy, 4) * (x1 - x0)), sy, 1, 1, greyOf(36, l));
  }

  // --- Ceiling rows (above horizon)
  const farCeilY = Math.round(projY(CEIL, Z_FAR));
  for (let sy = 0; sy <= farCeilY; sy++) {
    const z = ((CAM_H - CEIL) * F) / (sy - VP_Y); // negative/negative → positive
    if (!(z > 0) || z > Z_FAR) continue;
    const l = lightAt(z);
    const halfPx = (HALF_W * F) / z;
    const x0 = Math.max(0, Math.round(VP_X - halfPx));
    const x1 = Math.min(CORRIDOR_W, Math.round(VP_X + halfPx));
    const panel = Math.floor(z / 1.2) % 2 === 0;
    rect(ctx, x0, sy, x1 - x0, 1, greyOf(panel ? 56 : 50, l));
    // cable tray along the ceiling, left of centre
    const tx = Math.round(projX(-0.5, z));
    rect(ctx, tx, sy, Math.max(1, Math.round((0.2 * F) / z)), 1, greyOf(34, l));
  }

  // --- Walls per column
  for (let x = 0; x < CORRIDOR_W; x++) {
    const dx = x - VP_X;
    if (dx === 0) continue;
    const z = (HALF_W * F) / Math.abs(dx);
    if (z > Z_FAR) continue; // the far end (door wall) is drawn separately
    const l = lightAt(z);
    const yCeil = Math.max(0, Math.round(projY(CEIL, z)));
    const yFloor = Math.min(CORRIDOR_H, Math.round(projY(0, z)));
    const panel = Math.floor(z / 1.2) % 2 === 0;
    rect(ctx, x, yCeil, 1, Math.max(1, yFloor - yCeil), greyOf(panel ? 92 : 84, l));
    // panel joints
    const zn = (HALF_W * F) / Math.max(1, Math.abs(dx) - 1);
    if (Math.floor(z / 1.2) !== Math.floor(zn / 1.2)) rect(ctx, x, yCeil, 1, Math.max(1, yFloor - yCeil), greyOf(48, l));
    // conduits at 1.7 m and 1.9 m
    for (const hm of [1.7, 1.9]) {
      const py = Math.round(projY(hm, z));
      rect(ctx, x, py, 1, 1, greyOf(120, l));
      rect(ctx, x, py + 1, 1, 1, greyOf(36, l));
    }
    // skirting hazard stripe
    const sk = Math.round(projY(0.15, z));
    rect(ctx, x, sk, 1, Math.max(1, yFloor - sk), Math.floor(z * 4) % 2 === 0 ? `rgba(150,130,40,${(0.7 * l).toFixed(2)})` : greyOf(26, l));
  }

  // --- Far end wall + security door
  const dl = lightAt(Z_FAR);
  const ex0 = Math.round(projX(-HALF_W, Z_FAR));
  const ex1 = Math.round(projX(HALF_W, Z_FAR));
  const ey0 = Math.round(projY(CEIL, Z_FAR));
  const ey1 = Math.round(projY(0, Z_FAR));
  rect(ctx, ex0, ey0, ex1 - ex0, ey1 - ey0, greyOf(64, dl));
  const dx0 = Math.round(projX(-0.55, Z_FAR));
  const dx1 = Math.round(projX(0.55, Z_FAR));
  const dy0 = Math.round(projY(2.1, Z_FAR));
  const dy1 = ey1;
  rect(ctx, dx0 - 2, dy0 - 2, dx1 - dx0 + 4, dy1 - dy0 + 2, greyOf(34, dl));
  const gv = Math.round(52 * (0.25 + 0.75 * dl));
  rect(ctx, dx0, dy0, dx1 - dx0, dy1 - dy0, `rgb(${gv - 8},${gv + 6},${gv - 2})`);
  rect(ctx, dx0, dy0, dx1 - dx0, 1, `rgb(${gv + 10},${gv + 22},${gv + 12})`);
  const wx = Math.round((dx0 + dx1) / 2);
  const wy = Math.round(projY(1.0, Z_FAR));
  rect(ctx, wx - 3, wy - 3, 7, 7, greyOf(90, dl));
  rect(ctx, wx - 1, wy - 1, 3, 3, greyOf(30, dl));
  rect(ctx, dx0 + 2, wy, dx1 - dx0 - 4, 1, greyOf(100, dl));
  if (dl > 0.15) drawText(ctx, 'B17', wx + 1, dy0 + 4, FONT_3x5, `rgba(190,200,180,${Math.min(1, dl + 0.2).toFixed(2)})`, { align: 'center' });
  rect(ctx, dx1 + 3, wy - 4, 3, 5, greyOf(70, dl));
  rect(ctx, dx1 + 4, wy - 3, 1, 1, s.doorLamp ? '#ff3b2f' : '#2fbf4a');
  rect(ctx, wx - 2, dy0 - 6, 5, 3, '#1b1f23');
  rect(ctx, wx - 1, dy0 - 5, 3, 1, s.doorLamp ? (Math.floor(t * 2) % 2 === 0 ? '#ff3b2f' : '#5a1010') : '#2fbf4a');

  // --- Fluorescent tubes (ceiling centre-line) and their glare
  for (let i = 0; i < TUBES.length; i++) {
    const z0 = TUBES[i] - 0.6;
    const z1 = TUBES[i] + 0.6;
    const y = Math.round(projY(CEIL - 0.04, TUBES[i]));
    const x0 = Math.round(projX(-0.07, z1));
    const x1 = Math.round(projX(0.07, z0));
    const f = (s.flicker[i] ?? 1) * (1 - s.dark);
    const w = Math.max(2, x1 - x0);
    const th = Math.max(1, Math.round((0.12 * F) / TUBES[i]));
    const tubeCol = f > 0.05 ? `rgb(${Math.round(110 + 145 * f)},${Math.round(120 + 135 * f)},${Math.round(120 + 120 * f)})` : '#1a1c1e';
    rect(ctx, x0 - 1, y - 1, w + 2, th + 2, '#15181c');
    rect(ctx, x0, y, w, th, tubeCol);
    if (f > 0.1) {
      ctx.fillStyle = `rgba(200,210,200,${(0.10 * f).toFixed(3)})`;
      ctx.fillRect(x0 - w, y - 3, w * 3, th + 6);
      const fy = Math.round(projY(0, TUBES[i]));
      const hw = (HALF_W * F) / TUBES[i];
      const ph = Math.max(2, Math.round((0.5 * F * CAM_H) / (TUBES[i] * TUBES[i])));
      ctx.fillStyle = `rgba(200,210,200,${(0.05 * f).toFixed(3)})`;
      ctx.fillRect(Math.round(VP_X - hw * 0.45), fy - ph, Math.round(hw * 0.9), ph * 2);
    }
  }

  // --- Signage on the walls
  const sz = 3.6;
  const sxl = Math.round(projX(-HALF_W, sz));
  const syl = Math.round(projY(1.8, sz));
  const sl = lightAt(sz);
  rect(ctx, sxl - 1, syl, 3, 12, `rgba(180,180,160,${(0.7 * sl).toFixed(2)})`);
  const sz2 = 2.9;
  const sxr = Math.round(projX(HALF_W, sz2));
  const syr = Math.round(projY(1.85, sz2));
  const sl2 = lightAt(sz2);
  rect(ctx, sxr - 14, syr, 14, 8, `rgba(160,150,40,${(0.8 * sl2).toFixed(2)})`);
  drawText(ctx, 'B17', sxr - 7, syr + 2, FONT_3x5, `rgba(20,20,20,${sl2.toFixed(2)})`, { align: 'center' });
  const ay = Math.round(projY(0, 7.5));
  rect(ctx, VP_X - 5, ay, 11, 1, `rgba(150,130,40,${(0.5 * lightAt(7.5)).toFixed(2)})`);

  // --- Entity at the far end, folded under the ceiling
  if (s.entityFar > 0) {
    const zE = 8.6;
    const gxE = Math.round(projX(0.1, zE));
    const gyE = Math.round(projY(0, zE));
    const H = Math.round((4 * F) / zE);
    let pose = compressedPose(t);
    if (s.headRaise > 0) pose = headRaisePose(pose, s.headRaise);
    const l = lightAt(zE);
    ctx.globalAlpha = s.entityFar;
    drawEntity(ctx, gxE, gyE, Math.round(H * 0.8), pose, {
      mode: 'optical',
      yaw: Math.PI * 0.5 + 0.3,
      dark: l > 0.3 ? '#0e0b12' : '#08070b',
      mid: l > 0.3 ? '#1d1724' : '#100d14',
      rim: l > 0.3 ? '#2e2636' : '#1a1522',
      face: s.headRaise,
    }, t);
    ctx.globalAlpha = 1;
    // its mass blocks the door light; a long shadow reaches towards the lens
    ctx.fillStyle = `rgba(0,0,0,${(0.4 * s.entityFar).toFixed(2)})`;
    ctx.fillRect(dx0 - 2, dy0 - 2, dx1 - dx0 + 4, dy1 - dy0 + 2);
    ctx.fillStyle = `rgba(0,0,0,${(0.22 * s.entityFar).toFixed(2)})`;
    for (let k = 0; k < 40; k++) ctx.fillRect(gxE - 4 - k, gyE + k * 2, 8 + k * 2, 2);
  }

  // --- Entity directly beneath the lens: one frame
  if (s.entityNear) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, CORRIDOR_W, CORRIDOR_H);
    drawLoomingHead(ctx, 250, 232, 1.05, t, { mode: 'optical', face: 1, light: 1, lit: true });
  }

  // --- Dust in the light
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash2(i, 11) * CORRIDOR_W);
    const y = 120 + Math.floor(((hash2(i, 12) * 150) + t * (3 + hash2(i, 13) * 5)) % 150);
    if (noise1(t * 2 + i, 5) > 0.55) rect(ctx, x, y, 1, 1, `rgba(200,200,190,${(0.25 * (1 - s.dark)).toFixed(2)})`);
  }

  if (s.dark > 0) {
    ctx.fillStyle = `rgba(0,0,0,${(s.dark * 0.95).toFixed(3)})`;
    ctx.fillRect(0, 0, CORRIDOR_W, CORRIDOR_H);
  }
}

/**
 * Scotland Control — a hardened continuity-of-government command centre
 * somewhere under the Central Belt. Low ceiling, cable trays, a wall display
 * showing the Joint Scotland Surface Reconnaissance Network, three operator
 * terminals and a blast door to Corridor B-17.
 */
import { drawText, FONT_3x5, FONT_5x7 } from '../engine/Font';
import { P } from '../engine/Palette';
import { hash1, hash2, noise1, Rng } from '../engine/Rng';
import { dither, hline, line, outline, rect, vline, type Ctx2D } from '../engine/Surface';
import { glow, lightCone } from '../lighting/Lighting';
import { drawScanlines } from '../surveillance/Overlay';
import { countStatus, drawScotland, drawStations, fitProjection, type StationStatus } from './scotlandMap';
import { surveillanceClock } from '../timeline/Timeline';

export const BUNKER_W = 640;
export const BUNKER_H = 270;

export interface BunkerState {
  /** Film time for clocks. */
  filmTime: number;
  /** Red alert flashing on the wall display. */
  alert?: string;
  alertStrong?: boolean;
  mapOverrides?: Partial<Record<string, StationStatus>>;
  /** 0 = full power, 1 = blackout. */
  dim: number;
  /** 0..1 emergency red lighting. */
  emergency: number;
  /** Which terminal monitors are on (3 entries). */
  monitors: [boolean, boolean, boolean];
  wallDisplay: 'map' | 'off' | 'static';
  /** Extra line under the alert, e.g. UNAUTHORISED VIDEO SOURCE DETECTED. */
  alert2?: string;
  /** Strip-light flicker 0..1. */
  flicker: number;
}

const WALL = P.concrete1;
const WALL_D = P.concrete0;
const WALL_L = P.concrete2;
const FLOOR = '#141618';
const FLOOR_L = '#1b1e21';
const STEEL = '#2d3338';
const STEEL_L = '#3f474d';
const HAZARD = '#8a7a1e';

/** Draws the full-width bunker world. */
export function drawBunkerWide(ctx: Ctx2D, t: number, s: BunkerState): void {
  const power = 1 - s.dim;
  const light = power * (0.75 + 0.25 * s.flicker);

  // --- Ceiling
  rect(ctx, 0, 0, BUNKER_W, 32, WALL_D);
  // ventilation duct
  rect(ctx, 90, 4, 460, 11, STEEL);
  rect(ctx, 90, 4, 460, 1, STEEL_L);
  rect(ctx, 90, 14, 460, 1, '#1a1e22');
  for (let x = 100; x < 550; x += 24) {
    vline(ctx, x, 5, 13, '#23282c');
    // grille
    if ((x / 24) % 3 === 0) for (let k = 0; k < 6; k++) rect(ctx, x + 6 + k * 2, 11, 1, 2, '#0f1113');
  }
  // cable trays
  rect(ctx, 0, 20, BUNKER_W, 3, '#1c2024');
  for (let x = 0; x < BUNKER_W; x += 7) rect(ctx, x, 20, 1, 3, '#262b30');
  rect(ctx, 0, 26, BUNKER_W, 1, '#0c0e10');
  // strip lights (two), cool white, dim
  for (const lx of [150, 330, 510]) {
    const on = light > 0.05;
    const lf = on ? light * (0.7 + 0.3 * noise1(t * 9, lx)) : 0;
    rect(ctx, lx - 30, 28, 60, 3, on ? mixCol('#1a1c1a', '#b6c7bd', lf) : '#15171a');
    rect(ctx, lx - 31, 27, 62, 1, STEEL);
    if (on) lightCone(ctx, lx, 31, 150, 56, 220, `rgba(170,190,180,${(0.09 * lf).toFixed(3)})`, 0.5);
  }

  // --- Back wall
  rect(ctx, 0, 32, BUNKER_W, 160, WALL);
  // panel joints
  for (let x = 0; x < BUNKER_W; x += 40) vline(ctx, x, 32, 191, WALL_D);
  hline(ctx, 0, BUNKER_W, 110, WALL_D);
  // water staining streaks
  const rng = new Rng(4);
  for (let i = 0; i < 26; i++) {
    const x = rng.int(0, BUNKER_W);
    vline(ctx, x, 32, 32 + rng.int(10, 70), '#1a1d20');
  }
  // conduit along wall
  rect(ctx, 0, 150, BUNKER_W, 2, STEEL);
  rect(ctx, 0, 150, BUNKER_W, 1, STEEL_L);
  for (let x = 20; x < BUNKER_W; x += 60) rect(ctx, x, 148, 3, 6, STEEL_L);

  // --- Left: equipment racks
  for (let i = 0; i < 3; i++) {
    const rx = 12 + i * 34;
    rect(ctx, rx, 60, 30, 132, '#16191c');
    outline(ctx, rx, 60, 30, 132, '#24292d');
    for (let u = 0; u < 12; u++) {
      const uy = 64 + u * 10;
      rect(ctx, rx + 2, uy, 26, 8, hash2(i, u) > 0.7 ? '#1d2126' : '#191c20');
      hline(ctx, rx + 2, rx + 27, uy, '#262b30');
      // LEDs
      const leds = 3 + Math.floor(hash2(i * 7, u) * 4);
      for (let l = 0; l < leds; l++) {
        const on = power > 0.1 && hash2(Math.floor(t * (3 + l)) + u, i * 11 + l) > 0.3;
        const col = l === 0 ? '#2fbf4a' : l === 1 ? '#c8a02a' : '#2fbf4a';
        rect(ctx, rx + 4 + l * 3, uy + 3, 1, 1, on ? col : '#1a2a1a');
      }
      // drive slots
      if (u % 3 === 1) for (let d = 0; d < 6; d++) rect(ctx, rx + 14 + d * 2, uy + 2, 1, 4, '#0e1012');
    }
  }
  // sign over racks
  drawText(ctx, 'COMMS / NETWORK CORE', 60, 48, FONT_3x5, '#6a7470', { align: 'center' });

  // --- Right: blast door to Corridor B-17
  const dx = 556;
  rect(ctx, dx - 6, 78, 76, 114, '#1f2428'); // frame recess
  rect(ctx, dx, 84, 64, 108, '#2c3a33'); // door, military green-grey
  rect(ctx, dx, 84, 64, 1, '#3d4d45');
  outline(ctx, dx + 4, 88, 56, 100, '#243029');
  // rivets
  for (let y = 92; y < 186; y += 8) {
    rect(ctx, dx + 6, y, 1, 1, '#4a5a52');
    rect(ctx, dx + 57, y, 1, 1, '#4a5a52');
  }
  // locking bar + wheel
  rect(ctx, dx + 10, 136, 44, 4, STEEL);
  rect(ctx, dx + 10, 136, 44, 1, STEEL_L);
  rect(ctx, dx + 26, 128, 12, 20, '#1a1f23');
  rect(ctx, dx + 28, 130, 8, 16, STEEL);
  rect(ctx, dx + 31, 126, 2, 24, STEEL_L);
  rect(ctx, dx + 24, 137, 16, 2, STEEL_L);
  // stencil
  drawText(ctx, 'B-17', dx + 32, 96, FONT_5x7, '#aeb7a3', { align: 'center' });
  drawText(ctx, 'CORRIDOR', dx + 32, 106, FONT_3x5, '#8a9488', { align: 'center' });
  drawText(ctx, 'AUTHORISED ONLY', dx + 32, 114, FONT_3x5, '#6f7a6d', { align: 'center' });
  // hazard stripe at base
  for (let x = dx - 6; x < dx + 70; x += 4) rect(ctx, x, 188, 2, 4, HAZARD);
  // door status lamp
  const lampOn = power > 0.1 ? Math.floor(t * 1.2) % 2 === 0 : Math.floor(t * 1.2) % 2 === 0;
  rect(ctx, dx + 28, 70, 8, 5, '#1b1f23');
  rect(ctx, dx + 30, 71, 4, 3, lampOn ? (s.emergency > 0.3 ? '#ff3b2f' : '#2fbf4a') : '#163016');
  // wall phone + extinguisher
  rect(ctx, 528, 120, 10, 16, '#1b1f23');
  rect(ctx, 530, 122, 6, 4, '#2fbf4a');
  rect(ctx, 531, 128, 4, 6, '#2a3034');
  rect(ctx, 520, 160, 5, 18, '#7a1a16');
  rect(ctx, 521, 157, 3, 3, '#3a3a3a');
  // radiation trefoil plate
  rect(ctx, 530, 92, 14, 14, '#9a8a1e');
  rect(ctx, 536, 98, 2, 2, '#1a1a10');
  rect(ctx, 533, 94, 3, 3, '#1a1a10');
  rect(ctx, 538, 94, 3, 3, '#1a1a10');
  rect(ctx, 536, 102, 2, 3, '#1a1a10');

  // --- Wall display
  drawWallDisplay(ctx, 200, 40, 240, 108, t, s);
  // side status panels
  drawSidePanel(ctx, 124, 48, 68, 96, t, s, 'left');
  drawSidePanel(ctx, 448, 48, 72, 96, t, s, 'right');

  // --- Floor
  rect(ctx, 0, 192, BUNKER_W, 78, FLOOR);
  // perspective floor seams
  for (let x = -200; x < BUNKER_W + 200; x += 60) line(ctx, x, 192, x + (x - 320) * 0.35, 270, FLOOR_L, 1);
  for (let y = 192; y < 270; y += 14) hline(ctx, 0, BUNKER_W, y, FLOOR_L);
  // hazard line
  for (let x = 0; x < BUNKER_W; x += 6) rect(ctx, x, 236, 4, 1, '#5a4e14');
  // cable covers
  rect(ctx, 0, 226, BUNKER_W, 3, '#1d2023');
  hline(ctx, 0, BUNKER_W, 226, '#262a2e');

  // --- Terminals
  const desks = [240, 320, 400];
  for (let i = 0; i < desks.length; i++) {
    drawTerminal(ctx, desks[i], 198, t, s.monitors[i], i, s.dim);
  }

  // --- Lighting: global dim and emergency wash (applied after geometry)
  if (s.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${(s.dim * 0.92).toFixed(3)})`;
    ctx.fillRect(0, 0, BUNKER_W, BUNKER_H);
  }
  if (s.emergency > 0) {
    // emergency lamps on the wall: red boxes with cones
    for (const ex of [100, 320, 540]) {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.1 + ex));
      rect(ctx, ex - 4, 36, 8, 4, '#4a0d0d');
      rect(ctx, ex - 3, 37, 6, 2, mixCol('#4a0d0d', '#ff3b2f', pulse * s.emergency));
      lightCone(ctx, ex, 40, 170, 10, 160, `rgba(255,40,30,${(0.12 * pulse * s.emergency).toFixed(3)})`, 0.55);
      glow(ctx, ex, 38, 10, `rgba(255,60,40,${(0.25 * s.emergency).toFixed(3)})`, 0.6);
    }
    ctx.fillStyle = `rgba(120,10,10,${(0.08 * s.emergency).toFixed(3)})`;
    ctx.fillRect(0, 0, BUNKER_W, BUNKER_H);
  }
}

/** Monitor light leaks; call after everything else in the room (crew included) has been drawn. */
export function drawMonitorGlows(ctx: Ctx2D, t: number, s: BunkerState): void {
  const desks = [240, 320, 400];
  for (let i = 0; i < desks.length; i++) if (s.monitors[i]) drawTerminalGlow(ctx, desks[i], 198, t, i, s.dim);
}

function mixCol(a: string, b: string, u: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (sh: number) => {
    const va = (pa >> sh) & 255;
    const vb = (pb >> sh) & 255;
    return Math.round(va + (vb - va) * Math.max(0, Math.min(1, u)));
  };
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function drawWallDisplay(ctx: Ctx2D, x: number, y: number, w: number, h: number, t: number, s: BunkerState): void {
  // bezel
  rect(ctx, x - 5, y - 5, w + 10, h + 10, '#0f1214');
  rect(ctx, x - 5, y - 5, w + 10, 1, '#262b30');
  rect(ctx, x - 6, y + h + 5, w + 12, 3, STEEL);
  const power = 1 - s.dim;
  if (s.wallDisplay === 'off' || power < 0.05) {
    rect(ctx, x, y, w, h, '#04060a');
    // faint reflection of emergency lamps
    if (s.emergency > 0) rect(ctx, x + 20, y + 10, w - 40, 2, `rgba(120,20,20,${(0.3 * s.emergency).toFixed(3)})`);
    return;
  }
  rect(ctx, x, y, w, h, P.phos0);
  // header strip
  rect(ctx, x, y, w, 9, '#0e2316');
  drawText(ctx, 'UK CONTINUITY COMMAND', x + 3, y + 2, FONT_3x5, P.phos4);
  drawText(ctx, surveillanceClock(s.filmTime) + ' Z', x + w - 3, y + 2, FONT_3x5, P.phos4, { align: 'right' });
  drawText(ctx, 'JOINT SCOTLAND SURFACE RECONNAISSANCE NETWORK', x + 3, y + 11, FONT_3x5, P.phos3);
  // Map
  const proj = fitProjection(x + 8, y + 18, h - 24);
  drawScotland(ctx, proj, { land: '#102a18', coast: P.phos3, sea: P.phos0, grid: '#0d2114', cityLabels: true });
  drawStations(ctx, proj, { land: '', coast: '', overrides: s.mapOverrides, t, labels: false });
  // Right column: status
  const cx = x + 132;
  const counts = countStatus(s.mapOverrides);
  const online = counts.ok + counts.degraded + counts.alert + counts.compromised;
  const total = online + counts.offline;
  drawText(ctx, '11 OCT 2033', cx, y + 20, FONT_3x5, P.phos4);
  drawText(ctx, 'SURVEILLANCE STATUS', cx, y + 28, FONT_3x5, P.phos3);
  const statusTxt = counts.compromised > 0 ? 'COMPROMISED' : counts.alert > 2 ? 'DEGRADED' : 'OPERATIONAL';
  const statusCol = counts.compromised > 0 ? P.red3 : counts.alert > 2 ? P.yellow2 : P.phos5;
  drawText(ctx, statusTxt, cx, y + 35, FONT_5x7, statusCol);
  drawText(ctx, `STATIONS ${online}/${total}`, cx, y + 46, FONT_3x5, P.phos3);
  rowDot(ctx, cx, y + 54, '#5cbf6a', `OPERATIONAL  ${counts.ok}`);
  rowDot(ctx, cx, y + 61, '#d6b534', `DEGRADED     ${counts.degraded}`);
  rowDot(ctx, cx, y + 68, '#3a4044', `OFFLINE      ${counts.offline}`);
  rowDot(ctx, cx, y + 75, '#ff4a3a', `ALERT        ${counts.alert + counts.compromised}`);
  drawText(ctx, 'BIKINI STATE: BLACK', cx, y + 84, FONT_3x5, P.phos3);
  drawText(ctx, 'LINK: HFO/MW  OK', cx, y + 91, FONT_3x5, counts.compromised > 0 ? P.red3 : P.phos3);
  // Alert banner
  if (s.alert) {
    const on = s.alertStrong ? Math.floor(t * 3) % 2 === 0 : Math.floor(t * 2) % 2 === 0;
    const by = y + h - 18;
    rect(ctx, x + 2, by, w - 4, s.alert2 ? 16 : 9, on ? '#3a0a0a' : '#1a0505');
    drawText(ctx, s.alert, x + w / 2, by + 2, FONT_3x5, on ? P.red3 : P.red1, { align: 'center' });
    if (s.alert2) drawText(ctx, s.alert2, x + w / 2, by + 9, FONT_3x5, on ? P.red4 : P.red2, { align: 'center' });
  }
  drawScanlines(ctx, x, y, w, h, 0.22, t);
  // glow from the display onto the wall above/below
  ctx.fillStyle = `rgba(60,160,90,${(0.05 * power).toFixed(3)})`;
  ctx.fillRect(x - 12, y - 14, w + 24, 8);
  ctx.fillRect(x - 12, y + h + 8, w + 24, 10);
}

function rowDot(ctx: Ctx2D, x: number, y: number, col: string, text: string): void {
  rect(ctx, x, y + 1, 3, 3, col);
  drawText(ctx, text, x + 6, y, FONT_3x5, P.phos3);
}

function drawSidePanel(ctx: Ctx2D, x: number, y: number, w: number, h: number, t: number, s: BunkerState, side: 'left' | 'right'): void {
  rect(ctx, x - 3, y - 3, w + 6, h + 6, '#0f1214');
  const power = 1 - s.dim;
  if (power < 0.2) {
    rect(ctx, x, y, w, h, '#04060a');
    return;
  }
  rect(ctx, x, y, w, h, '#06110b');
  if (side === 'left') {
    drawText(ctx, 'SENSOR TELEMETRY', x + 3, y + 3, FONT_3x5, P.phos3);
    // waveform traces
    for (let r = 0; r < 4; r++) {
      const by = y + 16 + r * 20;
      rect(ctx, x + 3, by - 6, w - 6, 14, '#07160d');
      const labels = ['RAD', 'SEIS', 'EM', 'ACOU'];
      drawText(ctx, labels[r], x + 4, by - 5, FONT_3x5, P.phos2);
      ctx.fillStyle = r === 2 && s.alert ? P.yellow2 : P.phos4;
      for (let xx = 0; xx < w - 10; xx++) {
        const v = noise1((xx + t * 30) / (6 + r * 3), r * 9) - 0.5;
        const spike = r === 2 && s.alert && hash2(Math.floor(t * 8) + xx, r) > 0.97 ? 4 : 0;
        ctx.fillRect(x + 5 + xx, Math.round(by + 2 + v * 6 - spike), 1, 1);
      }
    }
  } else {
    drawText(ctx, 'ZULU', x + 3, y + 3, FONT_3x5, P.phos3);
    drawText(ctx, surveillanceClock(s.filmTime), x + 3, y + 10, FONT_5x7, P.phos5);
    drawText(ctx, 'DUTY WATCH: GOLF', x + 3, y + 22, FONT_3x5, P.phos3);
    drawText(ctx, 'COMMS', x + 3, y + 32, FONT_3x5, P.phos3);
    const chans = ['HF  JSRN-1', 'MW  CLYDE', 'MW  FORTH', 'SAT SKYNET', 'FO  FASLANE', 'VHF GUARD'];
    for (let i = 0; i < chans.length; i++) {
      const cy = y + 40 + i * 8;
      const dead = i === 3;
      const busy = !dead && hash2(Math.floor(t * 2) + i, 5) > 0.5;
      rect(ctx, x + 3, cy + 1, 3, 3, dead ? '#3a4044' : busy ? P.phos4 : P.phos2);
      drawText(ctx, chans[i], x + 9, cy, FONT_3x5, dead ? '#3a4a40' : P.phos3);
    }
    // Scotland Control callsign
    drawText(ctx, 'C/S: SCOTLAND CONTROL', x + 3, y + h - 8, FONT_3x5, P.phos2);
  }
  drawScanlines(ctx, x, y, w, h, 0.22, t);
}

function drawTerminal(ctx: Ctx2D, x: number, deskY: number, t: number, on: boolean, i: number, dim = 0): void {
  // Desk (seen from behind: surface strip + front panel)
  rect(ctx, x - 36, deskY, 72, 6, '#2a2d30');
  rect(ctx, x - 36, deskY, 72, 1, '#3a3e42');
  rect(ctx, x - 36, deskY + 6, 72, 22, '#1a1d20');
  rect(ctx, x - 35, deskY + 7, 70, 1, '#232629');
  // desk legs shadow
  rect(ctx, x - 34, deskY + 28, 3, 6, '#0f1113');
  rect(ctx, x + 31, deskY + 28, 3, 6, '#0f1113');
  // Monitor (back towards us): dark slab on a stand
  rect(ctx, x - 14, deskY - 22, 28, 22, '#0d0f11');
  rect(ctx, x - 14, deskY - 22, 28, 1, '#1e2226');
  rect(ctx, x - 1, deskY - 2, 3, 3, '#1e2226');
  // ventilation slots and label
  for (let k = 0; k < 6; k++) rect(ctx, x - 8 + k * 3, deskY - 18, 1, 6, '#15181b');
  rect(ctx, x - 4, deskY - 8, 8, 2, '#1c1f23');
  // glow leaking around the edges
  void t;
  rect(ctx, x + 20, deskY - 6, 8, 6, '#0d0f11');
  if (on && dim < 0.5) rect(ctx, x + 21, deskY - 5, 6, 4, i === 0 ? '#1d4a2a' : '#1b2f45');
  void dim;
  // Keyboard (visible edge beyond chair) and a mug for terminal 2
  rect(ctx, x - 10, deskY + 1, 20, 2, '#262a2e');
  if (i === 1) {
    rect(ctx, x + 26, deskY - 4, 4, 4, '#8e8b82');
    rect(ctx, x + 30, deskY - 3, 1, 2, '#8e8b82');
  }
  // Papers / binder for terminal 3
  if (i === 2) {
    rect(ctx, x - 32, deskY - 1, 10, 2, '#4a4a3a');
    rect(ctx, x - 31, deskY - 2, 8, 1, '#5a5a4a');
  }
}

/** Phosphor light leaking around a monitor's edges; drawn after room darkening so it survives a blackout. */
function drawTerminalGlow(ctx: Ctx2D, x: number, deskY: number, t: number, i: number, dim: number): void {
  const pulse = 0.7 + 0.3 * noise1(t * 3, i * 7);
  const boost = 1 + dim * 1.6;
  const a = Math.min(1, 0.35 * pulse * boost).toFixed(3);
  rect(ctx, x - 15, deskY - 23, 30, 1, `rgba(120,220,150,${a})`);
  rect(ctx, x - 15, deskY - 23, 1, 24, `rgba(120,220,150,${a})`);
  rect(ctx, x + 14, deskY - 23, 1, 24, `rgba(120,220,150,${a})`);
  rect(ctx, x - 20, deskY, 40, 2, `rgba(120,220,150,${(0.12 * pulse * boost).toFixed(3)})`);
  if (dim > 0.5) {
    // in the dark the screen lights the operator and the desk around it
    glow(ctx, x, deskY - 12, 26, `rgba(120,220,150,${(0.18 * pulse).toFixed(3)})`, 0.5);
    rect(ctx, x - 24, deskY - 2, 48, 6, `rgba(120,220,150,${(0.06 * pulse).toFixed(3)})`);
  }
}

/**
 * Backdrop for front-facing close-ups: the operator sits with their back to
 * the rear wall of the room. The monitor bezel edges the bottom of frame and
 * casts phosphor light; a desk lamp warms one side.
 */
export function drawCloseupBackdrop(ctx: Ctx2D, t: number, s: BunkerState, lampSide: -1 | 1 = 1): void {
  const power = 1 - s.dim;
  rect(ctx, 0, 0, 480, 270, WALL_D);
  // wall panels with joints
  for (let x = -20; x < 480; x += 48) {
    rect(ctx, x, 0, 46, 270, hash1(x) > 0.5 ? WALL : WALL_L);
    vline(ctx, x + 46, 0, 269, WALL_D);
  }
  // staining
  const rng = new Rng(9);
  for (let i = 0; i < 40; i++) {
    const x = rng.int(0, 479);
    vline(ctx, x, 0, rng.int(10, 120), '#171a1d');
  }
  // cable tray + pipes
  rect(ctx, 0, 24, 480, 6, STEEL);
  rect(ctx, 0, 24, 480, 1, STEEL_L);
  for (let x = 0; x < 480; x += 9) rect(ctx, x, 25, 1, 4, '#1c2024');
  rect(ctx, 0, 40, 480, 3, '#262b30');
  rect(ctx, 0, 40, 480, 1, '#343a40');
  rect(ctx, 0, 46, 480, 2, '#1f2428');
  // notice board & clipboard
  rect(ctx, 320, 70, 70, 50, '#2a2520');
  outline(ctx, 320, 70, 70, 50, '#3a332c');
  for (let i = 0; i < 5; i++) {
    const px = 324 + (i % 3) * 22;
    const py = 74 + Math.floor(i / 3) * 22;
    rect(ctx, px, py, 16, 18, i === 2 ? '#8a8578' : '#6f6b60');
    for (let k = 0; k < 5; k++) rect(ctx, px + 2, py + 3 + k * 3, 10 - (k % 2) * 3, 1, '#2a2a28');
    rect(ctx, px + 7, py - 1, 2, 2, '#b03a2a');
  }
  // UK/Scotland flags small plate and unit crest
  rect(ctx, 80, 72, 24, 14, '#1c2540');
  rect(ctx, 80, 72, 24, 1, '#aeb7c3');
  rect(ctx, 91, 72, 2, 14, '#aeb7c3');
  rect(ctx, 80, 78, 24, 2, '#aeb7c3');
  rect(ctx, 110, 72, 24, 14, '#1b3a6a');
  line(ctx, 110, 72, 133, 85, '#aeb7c3', 1);
  line(ctx, 133, 72, 110, 85, '#aeb7c3', 1);
  drawText(ctx, 'JSRN', 118, 90, FONT_3x5, '#6a7470', { align: 'center' });
  // wall clock (24h digital)
  rect(ctx, 200, 66, 80, 18, '#0d0f11');
  if (power > 0.05) drawText(ctx, surveillanceClock(s.filmTime) + ' Z', 240, 71, FONT_5x7, P.red3, { align: 'center' });
  // desk lamp warm light on one side
  if (power > 0.05) {
    const lx = lampSide > 0 ? 430 : 50;
    lightCone(ctx, lx, 100, 170, 20, 200, `rgba(217,164,65,${(0.10 * power).toFixed(3)})`, 0.6);
    dither(ctx, lampSide > 0 ? 300 : 0, 120, 180, 150, 'rgba(0,0,0,0)', `rgba(217,164,65,${(0.06 * power).toFixed(3)})`, 0.5);
  }
  // Mid-height band (what the ×3 close-up actually sees): cable duct, stencils, kit on the wall
  rect(ctx, 0, 168, 480, 5, STEEL);
  rect(ctx, 0, 168, 480, 1, STEEL_L);
  rect(ctx, 0, 172, 480, 1, '#111417');
  for (let x = 6; x < 480; x += 36) rect(ctx, x, 166, 4, 9, '#3a4046');
  for (let x = 0; x < 480; x += 8) rect(ctx, x, 224, 5, 2, HAZARD);
  rect(ctx, 0, 227, 480, 4, '#1a1d21');
  rect(ctx, 0, 227, 480, 1, '#262b30');
  drawText(ctx, 'LEVEL 2  -  OPERATIONS  -  JSRN WATCH FLOOR', 240, 180, FONT_3x5, '#4e5853', { align: 'center' });
  // wall telephone, key safe, sealed socket boxes
  rect(ctx, 150, 186, 12, 20, '#1b1f23');
  rect(ctx, 152, 188, 8, 5, '#2fbf4a');
  rect(ctx, 154, 195, 4, 8, '#2a3034');
  rect(ctx, 318, 188, 16, 12, '#2a2d30');
  rect(ctx, 318, 188, 16, 1, '#3a3e42');
  rect(ctx, 324, 193, 4, 3, '#101214');
  for (const bx of [60, 400]) {
    rect(ctx, bx, 190, 10, 8, '#23282c');
    rect(ctx, bx + 2, 192, 2, 2, '#c0392b');
    rect(ctx, bx + 6, 192, 2, 2, '#2fbf4a');
  }
  // fire extinguisher and a laminated notice
  rect(ctx, 440, 186, 6, 22, '#7a1a16');
  rect(ctx, 441, 183, 4, 3, '#3a3a3a');
  rect(ctx, 200, 186, 22, 16, '#8a8578');
  for (let k = 0; k < 5; k++) rect(ctx, 203, 189 + k * 3, 14 - (k % 2) * 4, 1, '#2a2a28');
  rect(ctx, 210, 185, 2, 2, '#b03a2a');
  // grime and staining along the band
  for (let i = 0; i < 60; i++) {
    const gx = (i * 61) % 480;
    rect(ctx, gx, 176 + ((i * 17) % 44), 1 + (i % 3), 1, '#15181b');
  }
  // Monitor bezel at the bottom of frame (we look over the top of the screen)
  rect(ctx, 100, 236, 280, 34, '#0d0f11');
  rect(ctx, 100, 236, 280, 1, '#2a2f34');
  rect(ctx, 104, 240, 272, 1, '#15181b');
  if (power > 0.05) {
    const pulse = 0.75 + 0.25 * noise1(t * 3.3, 2);
    rect(ctx, 100, 234, 280, 2, `rgba(120,220,150,${(0.5 * pulse).toFixed(3)})`);
    ctx.fillStyle = `rgba(120,220,150,${(0.07 * pulse).toFixed(3)})`;
    for (let y = 150; y < 234; y += 1) {
      const spread = Math.round((234 - y) * 0.35);
      ctx.fillRect(100 - spread, y, 280 + spread * 2, 1);
    }
  }
  if (s.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${(s.dim * 0.9).toFixed(3)})`;
    ctx.fillRect(0, 0, 480, 270);
  }
  if (s.emergency > 0) {
    const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.1));
    ctx.fillStyle = `rgba(140,15,15,${(0.14 * pulse * s.emergency).toFixed(3)})`;
    ctx.fillRect(0, 0, 480, 270);
    rect(ctx, 20, 30, 10, 5, mixCol('#4a0d0d', '#ff3b2f', pulse * s.emergency));
    lightCone(ctx, 25, 35, 200, 12, 220, `rgba(255,40,30,${(0.12 * pulse * s.emergency).toFixed(3)})`, 0.55);
  }
}

/** A standing technician seen from behind at a diagnostics rack, ~50px tall. */
export function drawStandingTech(ctx: Ctx2D, x: number, y: number, t: number, frantic: boolean): void {
  const br = Math.sin(t * 1.5) > 0.2 ? 1 : 0;
  const shift = frantic ? Math.round(Math.sin(t * 7) * 1.5) : 0;
  // legs
  rect(ctx, x - 5, y - 20, 4, 20, P.uniform0);
  rect(ctx, x + 1, y - 20, 4, 20, P.uniform0);
  rect(ctx, x - 6, y - 2, 5, 2, '#0a0b0c');
  rect(ctx, x + 1, y - 2, 5, 2, '#0a0b0c');
  // torso
  rect(ctx, x - 8, y - 42 - br, 16, 23, P.uniform1);
  rect(ctx, x - 8, y - 42 - br, 4, 23, P.uniform0);
  rect(ctx, x, y - 40, 1, 20, P.uniform0);
  // arms up to the rack
  line(ctx, x - 7, y - 38, x - 12 + shift, y - 46, P.uniform1, 3);
  line(ctx, x + 7, y - 38, x + 12 - shift, y - 44 + (frantic ? (Math.floor(t * 10) % 2) * 2 : 0), P.uniform1, 3);
  rect(ctx, x - 14 + shift, y - 48, 3, 3, P.skinPale2);
  rect(ctx, x + 11 - shift, y - 46 + (frantic ? (Math.floor(t * 10) % 2) * 2 : 0), 3, 3, P.skinPale2);
  // head (from behind) with tied hair
  rect(ctx, x - 2, y - 46 - br, 4, 4, P.skinPale1);
  rect(ctx, x - 4 + Math.round(shift * 0.5), y - 54 - br, 8, 8, P.hair2);
  rect(ctx, x - 1 + Math.round(shift * 0.5), y - 56 - br, 3, 3, P.hair2);
}

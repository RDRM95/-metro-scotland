/**
 * Reusable pixel-art set dressing for ruined Glasgow: tenements, warehouses,
 * the Finnieston Crane, bridges, vehicles, street furniture, vegetation and
 * debris. Everything is drawn with the shared palette and seeded detail so
 * the same prop looks the same every frame.
 */
import { P, shade } from '../engine/Palette';
import { Rng, hash2 } from '../engine/Rng';
import { dither, hline, line, rect, vline, type Ctx2D } from '../engine/Surface';

// --------------------------------------------------------------------------
// Buildings
// --------------------------------------------------------------------------

export interface TenementOpts {
  x: number;
  /** Ground line y. */
  y: number;
  w: number;
  floors: number; // typically 4
  /** Base sandstone tone: 'red' or 'blonde'. */
  stone: 'red' | 'blonde';
  /** 0..1 how damaged (collapsed upper floors, missing windows). */
  damage: number;
  seed: number;
  /** Depth shading: 1 = near, 0.4 = far (darker, less detail). */
  depth?: number;
  /** A faint light in one window (survivors) */
  litWindow?: boolean;
  bayWindows?: boolean;
}

/** Classic Glasgow four-storey sandstone tenement with bay windows and chimney stacks. */
export function drawTenement(ctx: Ctx2D, o: TenementOpts): void {
  const rng = new Rng(o.seed);
  const depth = o.depth ?? 1;
  const floorH = 13;
  const h = o.floors * floorH + 4;
  const baseCol = o.stone === 'red' ? '#3a2420' : '#3b3326';
  const wall = shade(baseCol, depth);
  const wallDark = shade(baseCol, depth * 0.72);
  const wallLight = shade(baseCol, depth * 1.25);
  const win = shade('#0a0c10', depth);
  const winFrame = shade('#4a4036', depth);
  const roof = shade('#1d1f22', depth);
  const roofHi = shade('#2b2e33', depth);

  // Damage: collapse part of the top
  const collapseW = Math.round(o.w * o.damage * rng.range(0.2, 0.6));
  const collapseSide = rng.chance(0.5) ? 'left' : 'right';
  const collapseDrop = Math.round(h * o.damage * rng.range(0.25, 0.6));

  const top = o.y - h;
  // Main wall
  rect(ctx, o.x, top, o.w, h, wall);
  // Mortar courses (horizontal) and stone texture
  for (let yy = top + 2; yy < o.y; yy += 3) {
    hline(ctx, o.x, o.x + o.w - 1, yy, hash2(yy, o.seed) > 0.5 ? wallDark : wall);
  }
  // Sooty staining streaks
  for (let i = 0; i < Math.round(o.w / 6); i++) {
    const sx = o.x + rng.int(0, o.w - 1);
    const sh = rng.int(4, h - 4);
    vline(ctx, sx, o.y - sh, o.y - 1, wallDark);
  }
  // Roof (pitched slate) with chimney stacks
  rect(ctx, o.x - 1, top - 3, o.w + 2, 4, roof);
  hline(ctx, o.x - 1, o.x + o.w, top - 3, roofHi);
  const stacks = Math.max(1, Math.floor(o.w / 18));
  for (let i = 0; i < stacks; i++) {
    const cx = o.x + 6 + Math.round(((i + 0.5) * o.w) / stacks) - 6;
    rect(ctx, cx, top - 9, 5, 7, wallDark);
    rect(ctx, cx - 1, top - 10, 7, 2, roofHi);
    // pots
    rect(ctx, cx + 1, top - 12, 1, 2, roof);
    rect(ctx, cx + 3, top - 12, 1, 2, roof);
  }
  // Windows per floor: pairs, bay window column optional
  const cols = Math.max(2, Math.floor((o.w - 6) / 10));
  for (let f = 0; f < o.floors; f++) {
    const wy = top + 4 + f * floorH;
    for (let c = 0; c < cols; c++) {
      const wx = o.x + 4 + c * Math.floor((o.w - 6) / cols);
      const bay = o.bayWindows && c === 0 && f > 0;
      const ww = bay ? 7 : 5;
      // Frame
      rect(ctx, wx - 1, wy - 1, ww + 2, 9, winFrame);
      // Glass (or missing) — damaged buildings have blown-out windows
      const blown = rng.chance(0.25 + o.damage * 0.5);
      rect(ctx, wx, wy, ww, 7, blown ? shade('#07080a', depth) : win);
      if (!blown) {
        // slight sky reflection on upper pane
        rect(ctx, wx + 1, wy + 1, 1, 2, shade('#1c2430', depth));
        // sash bar
        hline(ctx, wx, wx + ww - 1, wy + 3, winFrame);
      } else if (rng.chance(0.4)) {
        // curtain remnant / debris
        rect(ctx, wx + rng.int(0, ww - 2), wy, 2, rng.int(2, 5), shade('#2a2622', depth));
      }
      // Lintel
      hline(ctx, wx - 1, wx + ww, wy - 2, wallLight);
      if (bay) {
        vline(ctx, wx - 2, wy - 1, wy + 8, wallDark);
        vline(ctx, wx + ww + 1, wy - 1, wy + 8, wallLight);
      }
    }
  }
  // Close door at ground floor
  const dx = o.x + Math.floor(o.w / 2) - 2;
  rect(ctx, dx, o.y - 10, 5, 10, shade('#15110e', depth));
  rect(ctx, dx - 1, o.y - 11, 7, 1, wallLight);
  // Survivor light
  if (o.litWindow) {
    const wx = o.x + 4 + rng.int(0, cols - 1) * Math.floor((o.w - 6) / cols);
    const wy = top + 4 + rng.int(1, o.floors - 1) * floorH;
    rect(ctx, wx, wy, 5, 7, '#3a2a10');
    rect(ctx, wx + 1, wy + 2, 2, 3, '#6b4a1c');
  }
  // Collapse
  if (o.damage > 0.15 && collapseW > 3) {
    const cx = collapseSide === 'left' ? o.x - 1 : o.x + o.w - collapseW;
    // remove upper section with jagged edge
    for (let xx = 0; xx < collapseW + 1; xx++) {
      const jag = Math.round(hash2(xx, o.seed + 9) * 4);
      const dropHere = collapseDrop + jag - Math.round(((collapseSide === 'left' ? collapseW - xx : xx) / collapseW) * collapseDrop * 0.8);
      rect(ctx, cx + xx, top - 12, 1, Math.max(0, dropHere + 12), P.night);
    }
    // exposed floor joists / interior walls
    for (let k = 0; k < 3; k++) {
      const jy = top + collapseDrop + 2 + k * 4;
      if (jy < o.y - 4) hline(ctx, cx + 1, cx + collapseW - 2, jy, shade('#2a2320', depth));
    }
    // rubble heap at base
    const rb = Math.round(collapseW * 0.8);
    for (let i = 0; i < rb * 2; i++) {
      const rx = cx + rng.int(-2, collapseW);
      const ry = o.y - rng.int(0, Math.max(1, Math.round(collapseW / 3)));
      rect(ctx, rx, ry, rng.int(1, 3), 1, rng.chance(0.5) ? wallDark : shade('#3a3a38', depth));
    }
  }
}

/** Warehouse / shed: long brick or corrugated building with a sawtooth or arched roof. */
export function drawWarehouse(ctx: Ctx2D, x: number, y: number, w: number, h: number, seed: number, depth = 1, corrugated = false): void {
  const rng = new Rng(seed);
  const wall = shade(corrugated ? '#2d3236' : '#352721', depth);
  const dark = shade(corrugated ? '#1f2326' : '#241a16', depth);
  const light = shade(corrugated ? '#3c4247' : '#45342c', depth);
  const top = y - h;
  rect(ctx, x, top, w, h, wall);
  if (corrugated) {
    for (let xx = x; xx < x + w; xx += 2) vline(ctx, xx, top, y - 1, dark);
    // rust streaks
    for (let i = 0; i < w / 5; i++) {
      const rx = x + rng.int(0, w - 1);
      vline(ctx, rx, top + rng.int(0, h / 2), y - 1, shade(P.rust1, depth));
    }
  } else {
    for (let yy = top + 2; yy < y; yy += 3) hline(ctx, x, x + w - 1, yy, hash2(yy, seed) > 0.4 ? dark : wall);
  }
  // Roof: curved/arched
  for (let xx = 0; xx < w; xx++) {
    const u = (xx / (w - 1)) * 2 - 1;
    const rise = Math.round((1 - u * u) * Math.min(10, w / 6));
    vline(ctx, x + xx, top - rise, top, shade('#1a1c1f', depth));
    rect(ctx, x + xx, top - rise, 1, 1, shade('#2e3236', depth));
  }
  // high windows row
  for (let xx = x + 3; xx < x + w - 6; xx += 8) {
    rect(ctx, xx, top + 4, 5, 6, shade('#0b0d10', depth));
    if (rng.chance(0.35)) rect(ctx, xx + 1, top + 5, 3, 4, shade('#07080a', depth)); // broken
    hline(ctx, xx, xx + 4, top + 7, light);
  }
  // loading door
  const dx = x + rng.int(4, Math.max(5, w - 16));
  rect(ctx, dx, y - 14, 12, 14, dark);
  for (let yy = y - 13; yy < y; yy += 2) hline(ctx, dx, dx + 11, yy, shade('#1a1c1f', depth));
}

/** The Finnieston Crane — the giant cantilever on the Clyde; silhouette with lattice detail. */
export function drawFinniestonCrane(ctx: Ctx2D, x: number, y: number, scale: number, colour: string, detail = true): void {
  // x,y = ground centre under the tower; scale 1 = ~ 60px tall
  const towerH = Math.round(50 * scale);
  const towerW = Math.max(4, Math.round(9 * scale));
  const jibLen = Math.round(62 * scale);
  const counterLen = Math.round(26 * scale);
  const top = y - towerH;
  // Tower: tapered lattice
  for (let yy = 0; yy < towerH; yy++) {
    const u = yy / towerH;
    const w = Math.round(towerW * (0.65 + 0.35 * u));
    const cx = x;
    rect(ctx, cx - Math.floor(w / 2), top + yy, 1, 1, colour);
    rect(ctx, cx + Math.floor(w / 2), top + yy, 1, 1, colour);
    if (detail && yy % 5 === 0) hline(ctx, cx - Math.floor(w / 2), cx + Math.floor(w / 2), top + yy, colour);
    if (detail && yy % 5 === 2) {
      // cross brace
      rect(ctx, cx - Math.floor(w / 2) + Math.round((w * ((yy / 5) % 2 === 0 ? 0.3 : 0.7))), top + yy, 1, 1, colour);
    }
  }
  // Cab block at top
  rect(ctx, x - Math.round(6 * scale), top - Math.round(6 * scale), Math.round(12 * scale), Math.round(6 * scale), colour);
  // Jib: long horizontal boom to the right, counter-jib shorter to the left
  const jibY = top - Math.round(4 * scale);
  rect(ctx, x, jibY, jibLen, Math.max(1, Math.round(2 * scale)), colour);
  rect(ctx, x - counterLen, jibY, counterLen, Math.max(1, Math.round(3 * scale)), colour);
  if (detail) {
    // jib lattice
    for (let xx = 0; xx < jibLen; xx += Math.max(3, Math.round(4 * scale))) {
      rect(ctx, x + xx, jibY - Math.round(3 * scale), 1, Math.round(3 * scale), colour);
      hline(ctx, x + xx, x + xx + Math.round(2 * scale), jibY - Math.round(3 * scale), colour);
    }
    hline(ctx, x, x + jibLen - 1, jibY - Math.round(3 * scale), colour);
    // hook cable + hook hanging from the jib end
    const hx = x + jibLen - Math.round(5 * scale);
    vline(ctx, hx, jibY + 1, jibY + Math.round(14 * scale), colour);
    rect(ctx, hx - 1, jibY + Math.round(14 * scale), 3, 2, colour);
    // counterweight block
    rect(ctx, x - counterLen, jibY - Math.round(5 * scale), Math.round(8 * scale), Math.round(5 * scale), colour);
  }
}

/** Concrete road bridge (Kingston Bridge style): deck on tall piers spanning x0..x1 at deck y. */
export function drawConcreteBridge(ctx: Ctx2D, x0: number, x1: number, deckY: number, groundY: number, depth = 1, broken?: { at: number; gap: number }): void {
  const deck = shade('#2a2e32', depth);
  const deckHi = shade('#3a3f45', depth);
  const deckLo = shade('#1c1f22', depth);
  const pier = shade('#262a2e', depth);
  // Deck slab
  for (let xx = x0; xx <= x1; xx++) {
    if (broken && xx > broken.at && xx < broken.at + broken.gap) continue;
    rect(ctx, xx, deckY, 1, 6, deck);
    rect(ctx, xx, deckY, 1, 1, deckHi);
    rect(ctx, xx, deckY + 5, 1, 1, deckLo);
    // parapet
    if (xx % 2 === 0) rect(ctx, xx, deckY - 2, 1, 2, deckLo);
  }
  // Broken edge: hanging rebar and collapsed slab
  if (broken) {
    for (let k = 0; k < 4; k++) {
      line(ctx, broken.at + k, deckY + 6, broken.at + k + 2, deckY + 10 + k * 2, shade(P.rust2, depth), 1);
      line(ctx, broken.at + broken.gap - k, deckY + 6, broken.at + broken.gap - k - 1, deckY + 9 + k, shade(P.rust2, depth), 1);
    }
    // fallen slab in water/ground
    const sx = broken.at + Math.round(broken.gap * 0.3);
    line(ctx, sx, groundY - 2, sx + Math.round(broken.gap * 0.5), groundY - 10, deck, 4);
  }
  // Piers every ~56px
  for (let px = x0 + 20; px < x1 - 10; px += 56) {
    rect(ctx, px, deckY + 6, 6, groundY - deckY - 6, pier);
    rect(ctx, px, deckY + 6, 1, groundY - deckY - 6, shade('#32373c', depth));
    rect(ctx, px - 2, deckY + 6, 10, 3, pier); // pier head
    // water staining
    rect(ctx, px + 2, groundY - 8, 2, 8, shade('#1a1d20', depth));
  }
}

/** Slender needle tower (Glasgow Tower at the Science Centre) in the distance. */
export function drawNeedleTower(ctx: Ctx2D, x: number, y: number, h: number, colour: string): void {
  vline(ctx, x, y - h, y, colour);
  vline(ctx, x + 1, y - Math.round(h * 0.8), y, colour);
  rect(ctx, x - 1, y - h + Math.round(h * 0.1), 4, Math.round(h * 0.12), colour);
}

// --------------------------------------------------------------------------
// Vehicles (side-on, scale ~ 10 px per metre)
// --------------------------------------------------------------------------

export interface VehicleOpts {
  x: number; // ground left
  y: number; // ground line
  kind: 'car' | 'van' | 'bus' | 'police' | 'ambulance' | 'lorry';
  colour: string;
  depth?: number;
  flipped?: boolean;
  burnt?: boolean;
  seed?: number;
}

export function drawVehicle(ctx: Ctx2D, o: VehicleOpts): void {
  const depth = o.depth ?? 1;
  const rng = new Rng(o.seed ?? 1);
  const body = o.burnt ? shade('#1a1816', depth) : shade(o.colour, depth);
  const bodyDark = shade(body, 0.7);
  const bodyLight = o.burnt ? shade('#24211e', depth) : shade(o.colour, depth * 1.3);
  const glass = shade(o.burnt ? '#0a0a0a' : '#111a22', depth);
  const tyre = shade('#0c0d0f', depth);
  const rim = shade('#3a3d41', depth);
  const rust = shade(P.rust1, depth);
  const dims: Record<VehicleOpts['kind'], [number, number, number]> = {
    car: [22, 7, 5], // length, body height, cabin height
    police: [23, 7, 5],
    van: [26, 10, 5],
    ambulance: [27, 11, 5],
    bus: [50, 14, 12],
    lorry: [40, 12, 6],
  };
  const [len, bh, ch] = dims[o.kind];
  const x = o.x;
  const y = o.y;
  const flip = o.flipped ? -1 : 1;
  const X = (lx: number) => (flip > 0 ? x + lx : x + len - lx);

  // Flat tyres / sunk: body sits low
  const sink = 1;
  const baseY = y - 2 + sink;
  // Body
  rect(ctx, Math.min(X(0), X(len)), baseY - bh, len, bh, body);
  hline(ctx, Math.min(X(0), X(len)), Math.max(X(0), X(len)) - 1, baseY - bh, bodyLight);
  rect(ctx, Math.min(X(0), X(len)), baseY - 2, len, 2, bodyDark);
  if (o.kind === 'bus') {
    // Double-decker: two rows of windows
    for (let wx = 3; wx < len - 6; wx += 7) {
      rect(ctx, Math.min(X(wx), X(wx + 5)), baseY - bh - ch + 2, 5, 6, glass);
      rect(ctx, Math.min(X(wx), X(wx + 5)), baseY - bh + 2, 5, 6, glass);
    }
    rect(ctx, Math.min(X(0), X(len)), baseY - bh - ch, len, ch, body);
    hline(ctx, Math.min(X(0), X(len)), Math.max(X(0), X(len)) - 1, baseY - bh - ch, bodyLight);
    for (let wx = 3; wx < len - 6; wx += 7) {
      rect(ctx, Math.min(X(wx), X(wx + 5)), baseY - bh - ch + 2, 5, 6, glass);
      rect(ctx, Math.min(X(wx), X(wx + 5)), baseY - bh + 2, 5, 6, glass);
    }
    // destination board
    rect(ctx, Math.min(X(1), X(9)), baseY - bh - ch + 1, 8, 2, '#1d1d12');
    // doors
    rect(ctx, Math.min(X(len - 8), X(len - 4)), baseY - bh + 1, 4, bh - 2, bodyDark);
  } else if (o.kind === 'lorry') {
    rect(ctx, Math.min(X(len - 10), X(len)), baseY - bh - ch, 10, ch + 1, bodyDark); // cab
    rect(ctx, Math.min(X(len - 8), X(len - 2)), baseY - bh - ch + 1, 6, 4, glass);
    rect(ctx, Math.min(X(0), X(len - 10)), baseY - bh - 4, len - 10, 4, body); // box
  } else {
    // Cabin
    const cabStart = o.kind === 'van' || o.kind === 'ambulance' ? 2 : 5;
    const cabEnd = o.kind === 'van' || o.kind === 'ambulance' ? len - 2 : len - 6;
    rect(ctx, Math.min(X(cabStart), X(cabEnd)), baseY - bh - ch, cabEnd - cabStart, ch + 1, body);
    hline(ctx, Math.min(X(cabStart), X(cabEnd)), Math.max(X(cabStart), X(cabEnd)) - 1, baseY - bh - ch, bodyLight);
    // Windows
    if (o.kind === 'van' || o.kind === 'ambulance') {
      rect(ctx, Math.min(X(len - 8), X(len - 3)), baseY - bh - ch + 1, 5, ch - 1, glass); // windscreen
      rect(ctx, Math.min(X(len - 14), X(len - 10)), baseY - bh - ch + 1, 4, ch - 1, glass);
    } else {
      rect(ctx, Math.min(X(cabStart + 1), X(cabStart + 6)), baseY - bh - ch + 1, 5, ch - 1, glass);
      rect(ctx, Math.min(X(cabStart + 8), X(cabEnd - 1)), baseY - bh - ch + 1, cabEnd - cabStart - 9, ch - 1, glass);
      // windscreen slant
      rect(ctx, X(cabEnd), baseY - bh - ch + 1, 1, ch, bodyDark);
    }
  }
  // Police / ambulance markings
  if (o.kind === 'police') {
    // Battenburg: alternating blue/yellow blocks
    for (let i = 0; i < len - 2; i += 4) {
      rect(ctx, Math.min(X(1 + i), X(1 + i + 2)), baseY - bh + 2, 2, 3, shade(i % 8 === 0 ? '#1c3f8f' : '#c9b61e', depth * (o.burnt ? 0.4 : 1)));
    }
    rect(ctx, Math.min(X(10), X(14)), baseY - bh - ch - 2, 4, 2, shade('#1a2f6a', depth)); // lightbar
  }
  if (o.kind === 'ambulance') {
    for (let i = 0; i < len - 2; i += 4) {
      rect(ctx, Math.min(X(1 + i), X(1 + i + 2)), baseY - bh + 3, 2, 3, shade(i % 8 === 0 ? '#1f7a2a' : '#c9b61e', depth * (o.burnt ? 0.4 : 1)));
    }
  }
  // Wheels
  const wheelXs = o.kind === 'bus' ? [8, len - 10] : o.kind === 'lorry' ? [6, 12, len - 7] : [4, len - 7];
  for (const wx of wheelXs) {
    rect(ctx, Math.min(X(wx), X(wx + 4)), baseY - 2, 4, 3, tyre);
    rect(ctx, Math.min(X(wx + 1), X(wx + 3)), baseY - 1, 2, 1, rim);
  }
  // Rust and damage
  for (let i = 0; i < 4 + len / 6; i++) {
    const rx = x + rng.int(1, len - 2);
    const ry = baseY - rng.int(1, bh - 1);
    rect(ctx, rx, ry, rng.int(1, 3), 1, rust);
  }
  if (o.burnt) {
    for (let i = 0; i < len / 3; i++) rect(ctx, x + rng.int(0, len - 1), baseY - bh - rng.int(0, ch), 1, 1, '#000');
  }
  // Open door / missing bonnet occasionally
  if (rng.chance(0.3) && o.kind !== 'bus') {
    rect(ctx, X(len) - (flip > 0 ? 0 : 3), baseY - bh + 1, 3, bh - 3, bodyDark);
  }
}

// --------------------------------------------------------------------------
// Street furniture, vegetation, debris
// --------------------------------------------------------------------------

export function drawLampPost(ctx: Ctx2D, x: number, y: number, h: number, depth = 1, bent = false, lit = false): void {
  const col = shade('#2a2e33', depth);
  vline(ctx, x, y - h + (bent ? 6 : 0), y, col);
  if (bent) {
    line(ctx, x, y - h + 6, x + 5, y - h + 2, col, 1);
    line(ctx, x + 5, y - h + 2, x + 10, y - h + 5, col, 1);
    rect(ctx, x + 10, y - h + 5, 3, 1, col);
  } else {
    line(ctx, x, y - h, x + 5, y - h - 2, col, 1);
    rect(ctx, x + 5, y - h - 3, 4, 2, col);
    if (lit) {
      rect(ctx, x + 6, y - h - 1, 2, 1, P.sodium);
    }
  }
  // base
  rect(ctx, x - 1, y - 3, 3, 3, col);
}

export function drawBarrier(ctx: Ctx2D, x: number, y: number, w: number, depth = 1): void {
  // Concrete Jersey barrier
  const c = shade('#3b4046', depth);
  const d = shade('#2a2e33', depth);
  rect(ctx, x, y - 6, w, 6, c);
  rect(ctx, x, y - 6, w, 1, shade('#4c5358', depth));
  rect(ctx, x, y - 2, w, 2, d);
  for (let xx = x + 2; xx < x + w; xx += 6) rect(ctx, xx, y - 5, 1, 4, d);
}

/** A tuft of grass / buddleia growing out of cracked tarmac. */
export function drawVegetation(ctx: Ctx2D, x: number, y: number, size: number, t: number, depth = 1, seed = 1): void {
  const rng = new Rng(seed);
  const g0 = shade(P.moss1, depth);
  const g1 = shade(P.moss2, depth);
  const g2 = shade(P.moss3, depth);
  const blades = Math.round(size * 1.5);
  const sway = Math.sin(t * 1.8 + seed) * 0.6 + Math.sin(t * 3.1 + seed * 2) * 0.3;
  for (let i = 0; i < blades; i++) {
    const bx = x + rng.int(-size, size);
    const bh = rng.int(Math.max(2, size - 1), size * 2);
    const lean = rng.range(-0.5, 0.5);
    const col = rng.pick([g0, g1, g1, g2]);
    for (let k = 0; k < bh; k++) {
      const u = k / bh;
      const ox = Math.round(lean * k + sway * u * u * 2.2);
      rect(ctx, bx + ox, y - k, 1, 1, col);
    }
  }
  // base mound
  rect(ctx, x - size, y, size * 2, 1, g0);
}

export function drawRubble(ctx: Ctx2D, x: number, y: number, w: number, h: number, depth = 1, seed = 2): void {
  const rng = new Rng(seed);
  const cols = [shade('#3a3a38', depth), shade('#2a2a28', depth), shade('#4a4642', depth), shade(P.rust1, depth), shade('#1f2124', depth)];
  const n = Math.round(w * h * 0.5);
  for (let i = 0; i < n; i++) {
    const rx = x + rng.int(0, w - 1);
    const u = (rx - x) / w;
    const peak = Math.sin(u * Math.PI) * h;
    const ry = y - rng.int(0, Math.max(1, Math.round(peak)));
    rect(ctx, rx, ry, rng.int(1, 3), 1, rng.pick(cols));
  }
}

/** Standing water with a reflected sky shimmer. */
export function drawPuddle(ctx: Ctx2D, x: number, y: number, w: number, t: number, depth = 1, seed = 3): void {
  const col = shade('#0e141b', depth);
  const hi = shade('#1f2c3a', depth);
  for (let xx = 0; xx < w; xx++) {
    const u = (xx / w) * 2 - 1;
    const hh = Math.round((1 - u * u) * 2);
    if (hh > 0) rect(ctx, x + xx, y - hh + 1, 1, hh, col);
  }
  // raindrop ripples
  const f = Math.floor(t * 6);
  for (let i = 0; i < Math.max(1, Math.round(w / 8)); i++) {
    if (hash2(f + i * 3, seed) > 0.4) continue;
    const rx = x + Math.floor(hash2(f + i, seed + 1) * w);
    rect(ctx, rx, y, 1, 1, hi);
  }
}

export function drawCracks(ctx: Ctx2D, x: number, y: number, w: number, h: number, depth = 1, seed = 4): void {
  const rng = new Rng(seed);
  const col = shade('#0b0d10', depth);
  const n = Math.round((w * h) / 400);
  for (let i = 0; i < n; i++) {
    let cx = x + rng.int(0, w - 1);
    let cy = y + rng.int(0, h - 1);
    const len = rng.int(4, 14);
    for (let k = 0; k < len; k++) {
      rect(ctx, cx, cy, 1, 1, col);
      cx += rng.chance(0.6) ? 1 : rng.chance(0.5) ? -1 : 0;
      cy += rng.chance(0.4) ? (rng.chance(0.5) ? 1 : -1) : 0;
    }
  }
}

/** Military remote camera housing on a pole/wall bracket with a tiny IR LED. */
export function drawCameraHousing(ctx: Ctx2D, x: number, y: number, t: number, facingLeft = true): void {
  const c = '#2c3136';
  const d = '#1b1f23';
  const dir = facingLeft ? -1 : 1;
  rect(ctx, x - 2, y, 4, 10, d); // bracket
  rect(ctx, x - 6, y + 2, 12, 6, c); // housing
  rect(ctx, x - 6, y + 2, 12, 1, '#3d434a');
  rect(ctx, x + dir * 6, y + 3, 2, 4, d); // lens hood
  rect(ctx, x + dir * 7, y + 4, 1, 2, '#0a1a2a');
  if (Math.floor(t * 2) % 2 === 0) rect(ctx, x - dir * 4, y + 4, 1, 1, '#ff3b2f'); // status LED
}

/** Glasgow-style street sign / notice. */
export function drawSignPlate(ctx: Ctx2D, x: number, y: number, w: number, h: number, bg: string, fg: string, stripes = false): void {
  rect(ctx, x, y, w, h, bg);
  rect(ctx, x, y, w, 1, fg);
  if (stripes) for (let xx = 0; xx < w; xx += 3) rect(ctx, x + xx, y + h - 2, 2, 1, fg);
  else rect(ctx, x + 2, y + Math.floor(h / 2), w - 4, 1, fg);
}

/** Horizon cloud bank using dither. */
export function drawCloudBank(ctx: Ctx2D, x: number, y: number, w: number, h: number, t: number, a: string, b: string): void {
  dither(ctx, x, y, w, h, a, b, 0.35, Math.floor(t * 0.5));
}

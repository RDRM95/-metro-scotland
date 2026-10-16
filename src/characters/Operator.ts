/**
 * Procedurally drawn command-centre operators.
 *
 * The figures are built from parts (skull, hair, brows, eyes, mouth, torso,
 * arms, hands, chair, headset, mug) so that every frame can be posed:
 * breathing, blinking, head turns, typing, lifting a mug, flinching.
 *
 * Front view: 3/4 from across the desk, lit by the monitor in front of them.
 * Rear view: from behind the terminal row, for the wide establishing shots.
 */
import { P } from '../engine/Palette';
import { hash1, noise1 } from '../engine/Rng';
import { disc, ellipse, line, rect, type Ctx2D } from '../engine/Surface';

export type Expression = 'neutral' | 'focused' | 'concerned' | 'alarmed' | 'fear';

export interface OperatorLook {
  skin: [string, string, string];
  hair: string;
  hairStyle: 'short' | 'cropped' | 'tied' | 'receding';
  uniform: [string, string, string];
  headset: boolean;
  glasses?: boolean;
  seed: number;
}

export interface OperatorPose {
  /** Body facing: -1 left, 0 camera, 1 right. */
  facing: number;
  /** Head yaw relative to body, -1..1. */
  headTurn: number;
  /** Head pitch in px: negative = looking up, positive = looking down. */
  headTilt: number;
  /** -1 leaning back ... 1 leaning forward. */
  lean: number;
  typing: boolean;
  /** 0 = mug on desk, 1 = mug at mouth. */
  mug?: number;
  expression: Expression;
  eyesClosed?: boolean;
  lookX: number;
  lookY: number;
  /** Hand to headset earpiece. */
  handToHeadset?: boolean;
  /** Light direction for face shading: -1 from left, 1 from right. */
  light: number;
}

export const LOOKS: Record<'op1' | 'op2' | 'control' | 'tech', OperatorLook> = {
  op1: {
    skin: [P.skinPale1, P.skinPale2, P.skinPale3],
    hair: P.hair1,
    hairStyle: 'cropped',
    uniform: [P.uniform0, P.uniform1, P.uniform2],
    headset: true,
    seed: 11,
  },
  op2: {
    skin: [P.skin0, P.skin1, P.skin2],
    hair: P.hair0,
    hairStyle: 'short',
    uniform: [P.uniform0, P.uniform1, P.uniform2],
    headset: false,
    seed: 23,
  },
  control: {
    skin: [P.skinPale1, P.skinPale2, P.skinPale3],
    hair: P.hairGrey,
    hairStyle: 'receding',
    uniform: ['#141812', '#222a20', '#33402f'],
    headset: true,
    seed: 37,
  },
  tech: {
    skin: [P.skin0, P.skinPale1, P.skinPale2],
    hair: P.hair2,
    hairStyle: 'tied',
    uniform: [P.uniform0, P.uniform1, P.uniform2],
    headset: false,
    glasses: true,
    seed: 53,
  },
};

export function defaultPose(partial: Partial<OperatorPose> = {}): OperatorPose {
  return {
    facing: 0,
    headTurn: 0,
    headTilt: 0,
    lean: 0,
    typing: false,
    expression: 'neutral',
    lookX: 0,
    lookY: 0,
    light: -1,
    ...partial,
  };
}

/** Blink schedule: returns true while eyes are closed. Seeded per character. */
export function isBlinking(t: number, seed: number): boolean {
  const period = 3.2 + hash1(seed) * 2.5;
  const slot = Math.floor(t / period);
  const offset = hash1(slot * 31 + seed) * (period - 0.2);
  const u = t - slot * period - offset;
  return u >= 0 && u < 0.13;
}

/** Breathing offset in px (0 or 1), ~14 breaths/min. */
export function breath(t: number, seed: number): number {
  return Math.sin(t * 1.45 + seed) > 0.2 ? 1 : 0;
}

const CHAIR = '#1a1d20';
const CHAIR_HI = '#2a2f33';
const HEADSET = '#1b1e21';
const HEADSET_HI = '#3a4044';
const MUG = '#8e8b82';
const MUG_HI = '#b5b2a8';

/**
 * Draws a seated operator from the front. (x, y) is the desk-top point under the
 * centre of the body — everything below y is hidden by the desk.
 */
export function drawOperatorFront(ctx: Ctx2D, x: number, y: number, t: number, look: OperatorLook, pose: OperatorPose): void {
  const br = breath(t, look.seed);
  const leanY = Math.round(pose.lean * 2);
  const bodyY = y - 30 + leanY - br; // top of shoulders
  const [u0, u1, u2] = look.uniform;
  const [s0, s1, s2] = look.skin;
  const facing = pose.facing;

  // Chair back (visible either side of the torso)
  rect(ctx, x - 17, bodyY - 6 - leanY, 34, 36, CHAIR);
  rect(ctx, x - 17, bodyY - 6 - leanY, 34, 2, CHAIR_HI);
  rect(ctx, x - 16, bodyY - 4 - leanY, 1, 30, CHAIR_HI);

  // Torso: shoulders → chest, tapering
  const shoulderW = 30 + br;
  const chestW = 26 + br;
  rect(ctx, x - shoulderW / 2, bodyY, shoulderW, 7, u1);
  rect(ctx, x - chestW / 2, bodyY + 7, chestW, 24, u1);
  // shoulder rounding
  rect(ctx, x - shoulderW / 2, bodyY, 2, 1, CHAIR);
  rect(ctx, x + shoulderW / 2 - 2, bodyY, 2, 1, CHAIR);
  // lit side vs shadow side
  const litSide = pose.light;
  rect(ctx, x + (litSide < 0 ? -chestW / 2 : chestW / 2 - 5), bodyY + 7, 5, 24, u2);
  rect(ctx, x + (litSide < 0 ? chestW / 2 - 6 : -chestW / 2), bodyY + 2, 6, 29, u0);
  // Collar / V and zip line
  const cx = x + Math.round(facing * 2);
  rect(ctx, cx - 4, bodyY, 8, 2, u0);
  rect(ctx, cx - 2, bodyY + 2, 4, 3, s1); // throat
  rect(ctx, cx, bodyY + 6, 1, 22, u0);
  // Rank slide (small tab on chest) and arm patch
  rect(ctx, cx - 1, bodyY + 10, 3, 4, '#4a4a3a');
  rect(ctx, cx, bodyY + 11, 1, 1, '#9a9a7a');
  rect(ctx, x - shoulderW / 2 + 1, bodyY + 3, 3, 3, '#2a3340');
  rect(ctx, x - shoulderW / 2 + 2, bodyY + 4, 1, 1, '#3f5a8a');

  // Arms + hands
  const deskY = y;
  const armBaseY = bodyY + 4;
  const typingFrame = Math.floor(t * 9);
  for (const side of [-1, 1] as const) {
    const sx = x + side * (shoulderW / 2 - 2);
    const isMugHand = side === 1 && pose.mug !== undefined && pose.mug > 0;
    const isHeadsetHand = side === -1 && pose.handToHeadset;
    let hx: number;
    let hy: number;
    if (isMugHand) {
      const m = pose.mug ?? 0;
      hx = x + 7 - Math.round(m * 4);
      hy = deskY - 2 - Math.round(m * 30);
    } else if (isHeadsetHand) {
      hx = x - 9;
      hy = bodyY - 12;
    } else {
      hx = x + side * 7 + Math.round(facing * 2);
      hy = deskY - 1;
      if (pose.typing) {
        const h = hash1(typingFrame * 7 + side * 13 + look.seed);
        hy -= h > 0.5 ? 1 : 0;
        hx += h > 0.8 ? 1 : h < 0.2 ? -1 : 0;
      }
    }
    const ex = Math.round((sx + hx) / 2 + side * 3);
    const ey = Math.round((armBaseY + hy) / 2 + 3);
    line(ctx, sx, armBaseY, ex, ey, u1, 4);
    line(ctx, ex, ey, hx, hy, u1, 3);
    // sleeve shadow
    line(ctx, ex + (side < 0 ? 1 : -1), ey, hx + (side < 0 ? 1 : -1), hy, u0, 1);
    // hand
    rect(ctx, hx - 2, hy - 1, 4, 3, s1);
    rect(ctx, hx - 2, hy - 1, 2, 1, s2);
    if (pose.typing && !isMugHand && !isHeadsetHand) {
      // fingers
      rect(ctx, hx - 2, hy + 2, 1, 1, s0);
      rect(ctx, hx, hy + 2, 1, 1, s0);
      rect(ctx, hx + 1, hy + 2, 1, 1, s0);
    }
    if (isMugHand) {
      rect(ctx, hx - 1, hy - 5, 5, 6, MUG);
      rect(ctx, hx - 1, hy - 5, 1, 6, MUG_HI);
      rect(ctx, hx + 4, hy - 4, 1, 3, MUG);
      // steam
      if (Math.floor(t * 4) % 3 !== 0) rect(ctx, hx + 1 + (Math.floor(t * 3) % 2), hy - 7, 1, 1, 'rgba(200,200,200,0.35)');
    }
  }

  // Head
  const hx0 = x + Math.round(facing * 3);
  const headY = bodyY - 20 + Math.round(pose.headTilt);
  drawHeadFront(ctx, hx0, headY, t, look, pose, s0, s1, s2);
}

function drawHeadFront(ctx: Ctx2D, cx: number, top: number, t: number, look: OperatorLook, pose: OperatorPose, s0: string, s1: string, s2: string): void {
  // Head is 14 wide × 17 tall; features shift sideways with the yaw.
  const yaw = Math.max(-1, Math.min(1, pose.facing * 0.6 + pose.headTurn));
  const shift = Math.round(yaw * 3);
  const lit = pose.light;
  const h = look.hair;

  // Neck
  rect(ctx, cx - 3 + Math.round(shift / 2), top + 16, 7, 5, s0);
  rect(ctx, cx - 3 + Math.round(shift / 2) + (lit < 0 ? 0 : 4), top + 16, 3, 5, s1);

  // Skull and jaw
  ellipse(ctx, cx, top + 7, 7, 7, s1);
  rect(ctx, cx - 6, top + 7, 13, 6, s1);
  rect(ctx, cx - 5 + shift, top + 13, 11, 2, s1);
  rect(ctx, cx - 4 + shift, top + 15, 9, 1, s1);
  rect(ctx, cx - 3 + shift, top + 16, 7, 1, s0);
  // Lit side of the face: a soft edge rather than a hard split
  if (lit < 0) {
    rect(ctx, cx - 6, top + 5, 3, 9, s2);
    rect(ctx, cx - 7, top + 7, 1, 5, s2);
    rect(ctx, cx - 3, top + 7, 1, 2, s2);
    rect(ctx, cx - 3, top + 12, 1, 2, s2);
  } else {
    rect(ctx, cx + 4, top + 5, 3, 9, s2);
    rect(ctx, cx + 7, top + 7, 1, 5, s2);
    rect(ctx, cx + 3, top + 7, 1, 2, s2);
    rect(ctx, cx + 3, top + 12, 1, 2, s2);
  }
  // Shadow side edge and under-jaw
  rect(ctx, lit < 0 ? cx + 6 : cx - 6, top + 8, 1, 6, s0);
  rect(ctx, cx - 4 + shift, top + 15, 9, 1, lit < 0 ? s1 : s0);

  // Ears
  if (Math.abs(yaw) < 0.8) {
    rect(ctx, cx - 8 + Math.min(0, shift), top + 8, 2, 4, s1);
    rect(ctx, cx + 7 + Math.max(0, shift), top + 8, 2, 4, s1);
    rect(ctx, cx - 8 + Math.min(0, shift), top + 9, 1, 2, s0);
    rect(ctx, cx + 8 + Math.max(0, shift), top + 9, 1, 2, s0);
  }

  // Hair
  switch (look.hairStyle) {
    case 'short':
      ellipse(ctx, cx, top + 3, 7, 3, h);
      rect(ctx, cx - 7, top + 3, 2, 6, h);
      rect(ctx, cx + 6, top + 3, 2, 6, h);
      rect(ctx, cx - 4 + shift, top + 5, 3, 1, h); // fringe
      break;
    case 'cropped':
      ellipse(ctx, cx, top + 3, 7, 3, h);
      rect(ctx, cx - 7, top + 3, 1, 5, h);
      rect(ctx, cx + 7, top + 3, 1, 5, h);
      break;
    case 'tied':
      ellipse(ctx, cx, top + 3, 7, 3, h);
      rect(ctx, cx - 7, top + 3, 2, 8, h);
      rect(ctx, cx + 6, top + 3, 2, 8, h);
      rect(ctx, cx - 2 - Math.round(yaw * 4), top, 5, 3, h); // bun
      break;
    case 'receding':
      rect(ctx, cx - 7, top + 3, 2, 8, h);
      rect(ctx, cx + 6, top + 3, 2, 8, h);
      rect(ctx, cx - 6, top + 2, 2, 1, h);
      rect(ctx, cx + 5, top + 2, 2, 1, h);
      rect(ctx, cx - 2, top + 1, 1, 1, h);
      rect(ctx, cx + 2, top + 1, 1, 1, h);
      break;
  }

  // Brows
  const browCol = look.hairStyle === 'receding' ? '#6a6a62' : h;
  const raise = pose.expression === 'alarmed' || pose.expression === 'fear' ? -1 : 0;
  const innerUp = pose.expression === 'concerned' || pose.expression === 'fear' ? 1 : 0;
  const frown = pose.expression === 'focused' ? 1 : 0;
  const browY = top + 7 + raise + frown;
  rect(ctx, cx - 6 + shift, browY, 3, 1, browCol);
  rect(ctx, cx + 3 + shift, browY, 3, 1, browCol);
  if (innerUp) {
    rect(ctx, cx - 3 + shift, browY - 1, 1, 1, browCol);
    rect(ctx, cx + 2 + shift, browY - 1, 1, 1, browCol);
  }
  if (frown) {
    rect(ctx, cx - 3 + shift, browY + 1, 1, 1, browCol);
    rect(ctx, cx + 2 + shift, browY + 1, 1, 1, browCol);
  }

  // Eyes
  const eyeY = top + 9;
  const closed = pose.eyesClosed || isBlinking(t, look.seed);
  const wide = pose.expression === 'alarmed' || pose.expression === 'fear';
  const px = Math.round(pose.lookX);
  const py = Math.round(pose.lookY);
  const eyeL = cx - 5 + shift;
  const eyeR = cx + 3 + shift;
  const farNarrow = Math.abs(yaw) > 0.5;
  const wl = farNarrow && yaw > 0 ? 1 : 2;
  const wr = farNarrow && yaw < 0 ? 1 : 2;
  if (closed) {
    rect(ctx, eyeL, eyeY + 1, wl, 1, s0);
    rect(ctx, eyeR, eyeY + 1, wr, 1, s0);
  } else {
    const eyeH = wide ? 2 : 1;
    rect(ctx, eyeL, eyeY, wl, eyeH, '#dcdcd4');
    rect(ctx, eyeR, eyeY, wr, eyeH, '#dcdcd4');
    const look = px > 0 ? 1 : 0;
    const pupilY = eyeY + (wide ? Math.max(0, Math.min(1, py + 1)) : 0);
    rect(ctx, eyeL + Math.min(wl - 1, look), pupilY, 1, 1, '#141210');
    rect(ctx, eyeR + Math.min(wr - 1, look), pupilY, 1, 1, '#141210');
    // lids
    rect(ctx, eyeL, eyeY - 1, wl, 1, s0);
    rect(ctx, eyeR, eyeY - 1, wr, 1, s0);
    if (wide) {
      rect(ctx, eyeL, eyeY + 2, wl, 1, s0);
      rect(ctx, eyeR, eyeY + 2, wr, 1, s0);
    }
  }
  if (look.glasses) {
    const g = '#6a737d';
    rect(ctx, eyeL - 1, eyeY - 1, 4, 1, g);
    rect(ctx, eyeR - 1, eyeY - 1, 4, 1, g);
    rect(ctx, eyeL - 1, eyeY, 1, 2, g);
    rect(ctx, eyeL + 2, eyeY, 1, 2, g);
    rect(ctx, eyeR - 1, eyeY, 1, 2, g);
    rect(ctx, eyeR + 2, eyeY, 1, 2, g);
    rect(ctx, eyeL + 2, eyeY + 1, 1, 1, '#9aa4b0');
    rect(ctx, eyeL + 3, eyeY, 1, 1, g);
  }

  // Nose: bridge highlight on the lit side, shadow on the other, nostril base
  const nx = cx + shift;
  rect(ctx, nx + (lit < 0 ? 1 : -1), top + 11, 1, 2, s0);
  rect(ctx, nx + (lit < 0 ? -1 : 1), top + 10, 1, 2, s2);
  rect(ctx, nx - 1, top + 13, 3, 1, s0);

  // Mouth
  const mouthY = top + 14;
  switch (pose.expression) {
    case 'alarmed':
    case 'fear':
      rect(ctx, cx - 1 + shift, mouthY - 1, 4, 2, '#2a1a16');
      rect(ctx, cx + shift, mouthY - 1, 2, 1, '#d0c8bc');
      break;
    case 'concerned':
      rect(ctx, cx - 1 + shift, mouthY, 4, 1, s0);
      rect(ctx, cx - 2 + shift, mouthY - 1, 1, 1, s0);
      rect(ctx, cx + 3 + shift, mouthY - 1, 1, 1, s0);
      break;
    case 'focused':
      rect(ctx, cx - 1 + shift, mouthY, 3, 1, s0);
      break;
    default:
      rect(ctx, cx - 1 + shift, mouthY, 4, 1, s0);
      rect(ctx, cx - 1 + shift, mouthY + 1, 4, 1, lit < 0 ? s2 : s1);
  }

  // Headset: band, ear cups, boom mic
  if (look.headset) {
    rect(ctx, cx - 7, top + 1, 15, 1, HEADSET);
    rect(ctx, cx - 7, top + 2, 1, 1, HEADSET);
    rect(ctx, cx + 7, top + 2, 1, 1, HEADSET);
    const cupX = cx - 10 + Math.min(0, shift);
    rect(ctx, cupX, top + 7, 3, 6, HEADSET);
    rect(ctx, cupX, top + 7, 1, 6, HEADSET_HI);
    const cupR = cx + 8 + Math.max(0, shift);
    rect(ctx, cupR, top + 7, 3, 6, HEADSET);
    rect(ctx, cupR + 2, top + 7, 1, 6, HEADSET_HI);
    line(ctx, cupX + 1, top + 13, cx - 3 + shift, top + 16, HEADSET_HI, 1);
    rect(ctx, cx - 4 + shift, top + 16, 3, 1, HEADSET);
  }

  // Monitor glow on the lit edge, flickering
  const rim = 'rgba(140,220,160,0.25)';
  const rx = lit < 0 ? cx - 7 : cx + 7;
  rect(ctx, rx, top + 5, 1, 8, rim);
  if (noise1(t * 6, look.seed) > 0.7) rect(ctx, rx + (lit < 0 ? 1 : -1), top + 7, 1, 4, rim);
}

/**
 * Rear view: operator seen from behind their chair, facing a monitor further
 * from the camera. (x, y) is the desk-top point behind the chair.
 */
export function drawOperatorRear(ctx: Ctx2D, x: number, y: number, t: number, look: OperatorLook, pose: OperatorPose): void {
  const br = breath(t, look.seed);
  const leanY = Math.round(-pose.lean * 2);
  const bodyY = y - 30 + leanY - br;
  const [u0, u1, u2] = look.uniform;
  const [s0, s1] = look.skin;
  const yaw = pose.headTurn;

  // Arms forward to keyboard (drawn first; partly hidden by body)
  for (const side of [-1, 1] as const) {
    const sx = x + side * 13;
    const hx = x + side * 7;
    const hy = y - 6 - (pose.typing && hash1(Math.floor(t * 9) * 7 + side * 13 + look.seed) > 0.5 ? 1 : 0);
    line(ctx, sx, bodyY + 5, hx, hy, u1, 3);
    rect(ctx, hx - 1, hy - 1, 3, 2, s1);
  }

  // Torso from behind
  const shoulderW = 30 + br;
  rect(ctx, x - shoulderW / 2, bodyY, shoulderW, 7, u1);
  rect(ctx, x - 13, bodyY + 7, 26, 24, u1);
  rect(ctx, x - 13, bodyY + 7, 4, 24, u0);
  rect(ctx, x + 9, bodyY + 7, 4, 24, u2);
  // centre seam and yoke
  rect(ctx, x, bodyY + 4, 1, 26, u0);
  rect(ctx, x - 12, bodyY + 6, 24, 1, u0);

  // Chair back (in front of the body from this angle)
  rect(ctx, x - 16, y - 24, 32, 24, CHAIR);
  rect(ctx, x - 16, y - 24, 32, 2, CHAIR_HI);
  rect(ctx, x - 15, y - 22, 1, 20, CHAIR_HI);
  rect(ctx, x - 1, y - 26, 2, 2, CHAIR_HI); // headrest post

  // Neck + head from behind
  rect(ctx, x - 3, bodyY - 4, 6, 5, s0);
  const hx = x + Math.round(yaw * 2);
  const top = bodyY - 18;
  ellipse(ctx, hx, top + 6, 6, 6, look.hair);
  rect(ctx, hx - 5, top + 8, 11, 4, look.hair);
  rect(ctx, hx - 4, top + 12, 9, 2, s0); // nape
  if (look.hairStyle === 'receding') {
    ellipse(ctx, hx, top + 5, 4, 4, s1);
    rect(ctx, hx - 4, top + 9, 9, 3, s0);
  }
  if (look.hairStyle === 'tied') rect(ctx, hx - 2, top + 5, 4, 3, look.hair === P.hair2 ? '#6a5540' : look.hair);
  // Turned head reveals ear and cheek
  if (Math.abs(yaw) > 0.3) {
    const side = yaw > 0 ? 1 : -1;
    rect(ctx, hx + side * 5, top + 6, 2, 4, s1);
    rect(ctx, hx + side * 6, top + 7, 1, 2, s0);
    if (Math.abs(yaw) > 0.7) {
      rect(ctx, hx + side * 6, top + 5, 2, 6, s1); // cheek/profile
      rect(ctx, hx + side * 7, top + 7, 1, 1, '#141210'); // eye
    }
  }
  if (look.headset) {
    rect(ctx, hx - 6, top + 1, 13, 1, HEADSET);
    rect(ctx, hx - 8, top + 5, 3, 5, HEADSET);
    rect(ctx, hx + 6, top + 5, 3, 5, HEADSET);
  }
}

/**
 * Small distant operator (for the wide shot where the row of terminals is far
 * from camera): ~14px tall, from behind.
 */
export function drawOperatorTiny(ctx: Ctx2D, x: number, y: number, t: number, look: OperatorLook, headTurn = 0): void {
  const br = Math.sin(t * 1.45 + look.seed) > 0.2 ? 1 : 0;
  rect(ctx, x - 5, y - 10 - br, 10, 8, look.uniform[1]);
  rect(ctx, x - 5, y - 10 - br, 2, 8, look.uniform[0]);
  rect(ctx, x - 6, y - 7, 12, 7, CHAIR);
  disc(ctx, x + Math.round(headTurn), y - 13 - br, 2, look.hair);
  rect(ctx, x - 1 + Math.round(headTurn), y - 11 - br, 3, 1, look.skin[0]);
  if (look.headset) rect(ctx, x - 3 + Math.round(headTurn), y - 15 - br, 7, 1, HEADSET);
}

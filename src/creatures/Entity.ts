/**
 * THE ENTITY — Category Black.
 *
 * A four-metre asymmetrical humanoid rendered from a 3-D skeleton so it can
 * be posed, turned towards the camera, walked, folded into a corridor and
 * drawn in optical, thermal or silhouette form. Joints are allowed to fold
 * the wrong way; one arm has an extra elbow; the head hangs off the neck
 * at a severe angle and tends to stay still while the body moves under it.
 */
import { hash1, lerp, noise1 } from '../engine/Rng';
import { line, disc, ellipse, rect, type Ctx2D } from '../engine/Surface';
import { P } from '../engine/Palette';
import { thermalColour } from '../surveillance/Thermal';

type V3 = [number, number, number]; // x forward, y up, z lateral (right)

interface BoneDef {
  name: string;
  parent: string | null; // joint name
  /** Fraction of total height. */
  len: number;
  /** Offset from parent joint (fractions of height), applied before direction. */
  offset?: V3;
  /** Thickness in fractions of height at start/end. */
  thick: [number, number];
  /** Rendering group for colour/temperature. */
  group: 'torso' | 'neck' | 'head' | 'armL' | 'armR' | 'legL' | 'legR';
}

export interface BoneAngles {
  pitch: number; // swing in forward (x) plane: 0 = straight down, PI = straight up
  roll: number; // lateral tilt (z)
}

export type Pose = Record<string, BoneAngles>;

const BONES: BoneDef[] = [
  { name: 'spine', parent: 'pelvis', len: 0.21, thick: [0.09, 0.115], group: 'torso' },
  { name: 'neck', parent: 'spine', len: 0.09, thick: [0.045, 0.035], group: 'neck' },
  { name: 'head', parent: 'neck', len: 0.15, thick: [0.065, 0.05], group: 'head' },
  { name: 'thighL', parent: 'pelvis', len: 0.25, offset: [0, 0, -0.055], thick: [0.06, 0.04], group: 'legL' },
  { name: 'shinL', parent: 'thighL', len: 0.23, thick: [0.04, 0.025], group: 'legL' },
  { name: 'footL', parent: 'shinL', len: 0.07, thick: [0.025, 0.014], group: 'legL' },
  { name: 'thighR', parent: 'pelvis', len: 0.27, offset: [0, 0, 0.055], thick: [0.06, 0.04], group: 'legR' },
  { name: 'shinR', parent: 'thighR', len: 0.21, thick: [0.04, 0.025], group: 'legR' },
  { name: 'footR', parent: 'shinR', len: 0.06, thick: [0.025, 0.014], group: 'legR' },
  { name: 'upperL', parent: 'spine', len: 0.26, offset: [0, -0.01, -0.12], thick: [0.045, 0.03], group: 'armL' },
  { name: 'foreL', parent: 'upperL', len: 0.24, thick: [0.03, 0.02], group: 'armL' },
  { name: 'handL', parent: 'foreL', len: 0.1, thick: [0.02, 0.008], group: 'armL' },
  { name: 'upperR', parent: 'spine', len: 0.3, offset: [0, -0.01, 0.12], thick: [0.045, 0.03], group: 'armR' },
  { name: 'foreR1', parent: 'upperR', len: 0.17, thick: [0.03, 0.024], group: 'armR' },
  { name: 'foreR2', parent: 'foreR1', len: 0.17, thick: [0.024, 0.018], group: 'armR' },
  { name: 'handR', parent: 'foreR2', len: 0.12, thick: [0.02, 0.008], group: 'armR' },
];

const UP = Math.PI;

function dirOf(a: BoneAngles): V3 {
  const cr = Math.cos(a.roll);
  return [Math.sin(a.pitch) * cr, -Math.cos(a.pitch) * cr, Math.sin(a.roll)];
}

export function blendPose(a: Pose, b: Pose, u: number): Pose {
  const out: Pose = {};
  for (const k of Object.keys(a)) {
    const pa = a[k];
    const pb = b[k] ?? pa;
    out[k] = { pitch: lerp(pa.pitch, pb.pitch, u), roll: lerp(pa.roll, pb.roll, u) };
  }
  return out;
}

function base(): Pose {
  return {
    spine: { pitch: UP - 0.32, roll: 0.05 },
    neck: { pitch: UP - 0.85, roll: 0.1 },
    head: { pitch: Math.PI * 0.42, roll: 0.55 },
    thighL: { pitch: 0.05, roll: -0.16 },
    shinL: { pitch: -0.1, roll: -0.06 },
    footL: { pitch: Math.PI / 2, roll: 0 },
    thighR: { pitch: -0.08, roll: 0.18 },
    shinR: { pitch: 0.12, roll: 0.06 },
    footR: { pitch: Math.PI / 2, roll: 0 },
    upperL: { pitch: 0.12, roll: -0.42 },
    foreL: { pitch: -0.45, roll: -0.25 },
    handL: { pitch: -0.2, roll: -0.1 },
    upperR: { pitch: -0.1, roll: 0.5 },
    foreR1: { pitch: 0.7, roll: 0.35 },
    foreR2: { pitch: -0.9, roll: 0.15 },
    handR: { pitch: -0.5, roll: 0.1 },
  };
}

/** Stillness with sub-pixel twitching — never fully static. */
export function standPose(t: number, seed = 0): Pose {
  const p = base();
  const tw = (k: number, amp: number) => (noise1(t * 0.6, seed + k) - 0.5) * amp;
  p.spine.pitch += tw(1, 0.06);
  p.neck.roll += tw(2, 0.1);
  p.head.roll += tw(3, 0.12);
  p.upperR.pitch += tw(4, 0.08);
  p.foreR2.pitch += tw(5, 0.15);
  // occasional sharp twitch of the long arm
  if (hash1(Math.floor(t * 2) + seed) > 0.9) p.foreR1.pitch += 0.35;
  return p;
}

/** Walking cycle. phase in [0,1). Joints fold the wrong way on purpose. */
export function walkPose(phase: number, t = 0): Pose {
  const p = base();
  const w = phase * Math.PI * 2;
  const sL = Math.sin(w);
  const sR = Math.sin(w + Math.PI);
  p.thighL.pitch = 0.6 * sL;
  p.thighR.pitch = 0.6 * sR;
  // knee bends backwards (hyperextension) when leg is forward
  p.shinL.pitch = p.thighL.pitch - 0.95 * Math.max(0, sL) + 0.2;
  p.shinR.pitch = p.thighR.pitch - 0.95 * Math.max(0, sR) + 0.2;
  p.footL.pitch = Math.PI / 2 + 0.3 * sL;
  p.footR.pitch = Math.PI / 2 + 0.3 * sR;
  // arms counter-swing, elbows folding past straight
  p.upperL.pitch = -0.45 * sL + 0.1;
  p.foreL.pitch = p.upperL.pitch - 0.8 - 0.3 * Math.max(0, -sL);
  p.upperR.pitch = 0.5 * sL + 0.25;
  p.foreR1.pitch = p.upperR.pitch + 1.0;
  p.foreR2.pitch = p.foreR1.pitch - 1.6 + 0.3 * Math.sin(w * 2);
  p.handR.pitch = p.foreR2.pitch - 0.4;
  // torso lurch
  p.spine.pitch = UP - 0.35 + 0.1 * Math.sin(w * 2);
  p.spine.roll = 0.12 * sL;
  p.neck.roll = 0.1 - 0.1 * sL;
  // irregular hitch: every so often the stride stalls
  if (noise1(t * 0.9, 77) > 0.78) {
    p.thighL.pitch *= 0.4;
    p.thighR.pitch *= 0.4;
  }
  return p;
}

/** Head turned toward the camera; `u` 0..1 amount. */
export function headTurnPose(from: Pose, u: number): Pose {
  const p = { ...from, head: { ...from.head }, neck: { ...from.neck } };
  // Head swings up and around: pitch rises from hanging (~0.42π) to level-forward (~0.5π)
  p.head.pitch = lerp(from.head.pitch, Math.PI * 0.5, u);
  p.head.roll = lerp(from.head.roll, -0.9, u); // over to the camera side
  p.neck.roll = lerp(from.neck.roll, -0.35, u);
  return p;
}

/** Right arm raised to point at the lens; `u` 0..1 amount. */
export function pointPose(from: Pose, u: number): Pose {
  const p = { ...from, upperR: { ...from.upperR }, foreR1: { ...from.foreR1 }, foreR2: { ...from.foreR2 }, handR: { ...from.handR } };
  p.upperR.pitch = lerp(from.upperR.pitch, Math.PI * 0.55, u);
  p.upperR.roll = lerp(from.upperR.roll, -0.25, u);
  p.foreR1.pitch = lerp(from.foreR1.pitch, Math.PI * 0.5, u);
  p.foreR1.roll = lerp(from.foreR1.roll, -0.3, u);
  p.foreR2.pitch = lerp(from.foreR2.pitch, Math.PI * 0.52, u);
  p.foreR2.roll = lerp(from.foreR2.roll, -0.35, u);
  p.handR.pitch = lerp(from.handR.pitch, Math.PI * 0.5, u);
  p.handR.roll = lerp(from.handR.roll, -0.35, u);
  return p;
}

/** Folded into a corridor that is far too low for it. */
export function compressedPose(t: number): Pose {
  const p = base();
  const tw = (k: number, amp: number) => (noise1(t * 0.5, 300 + k) - 0.5) * amp;
  p.thighL.pitch = 1.1 + tw(1, 0.05);
  p.shinL.pitch = -1.3;
  p.thighR.pitch = 0.9;
  p.shinR.pitch = -1.5;
  p.spine.pitch = UP - 1.25 + tw(2, 0.04); // bent far forward
  p.neck.pitch = UP - 0.2;
  p.head.pitch = Math.PI * 0.95; // head jammed up/back against the ceiling, twisted
  p.head.roll = 1.3 + tw(3, 0.1);
  p.upperL.pitch = 0.9;
  p.foreL.pitch = -1.0;
  p.upperR.pitch = -0.5;
  p.foreR1.pitch = 1.4;
  p.foreR2.pitch = -0.3;
  p.handR.pitch = 0.4;
  return p;
}

/** Head raised to look straight into the lens. */
export function headRaisePose(from: Pose, u: number): Pose {
  const p = { ...from, head: { ...from.head }, neck: { ...from.neck } };
  p.head.pitch = lerp(from.head.pitch, UP - 0.1, u);
  p.head.roll = lerp(from.head.roll, -0.2, u);
  p.neck.pitch = lerp(from.neck.pitch, UP - 0.1, u);
  return p;
}

export interface EntityStyle {
  mode: 'optical' | 'thermal' | 'silhouette';
  /** Yaw in radians: 0 = walking towards +x (profile), PI/2 = facing camera. */
  yaw: number;
  /** Head yaw additional. */
  headYaw?: number;
  /** Overall alpha. */
  alpha?: number;
  /** 0..1 how strongly the "cold" region reads in thermal. */
  cold?: number;
  /** Optical colours */
  dark?: string;
  mid?: string;
  rim?: string;
  /** Show the pale face cluster (when turned to camera). */
  face?: number;
  /** Bob removed for the head so it hangs still while the body moves. */
  stillHead?: boolean;
  /** Slight vertical bob (fraction of H). */
  bob?: number;
}

interface Joint {
  pos: V3;
}

function solve(pose: Pose, H: number, bob: number): Record<string, Joint> {
  const joints: Record<string, Joint> = { pelvis: { pos: [0, 0.47 + bob, 0] } };
  for (const b of BONES) {
    const parent = joints[b.parent!];
    const start: V3 = [parent.pos[0], parent.pos[1], parent.pos[2]];
    if (b.offset) {
      start[0] += b.offset[0];
      start[1] += b.offset[1];
      start[2] += b.offset[2];
    }
    const ang = pose[b.name] ?? { pitch: 0, roll: 0 };
    const d = dirOf(ang);
    joints[`${b.name}:start`] = { pos: start };
    joints[b.name] = { pos: [start[0] + d[0] * b.len, start[1] + d[1] * b.len, start[2] + d[2] * b.len] };
  }
  // Lower the whole figure so the lowest foot touches ground (y=0).
  let minY = Infinity;
  for (const k of ['footL', 'footR', 'shinL', 'shinR']) minY = Math.min(minY, joints[k].pos[1]);
  for (const k of Object.keys(joints)) joints[k].pos[1] -= minY;
  void H;
  return joints;
}

/**
 * Draws the entity. (gx, gy) is the ground point under it in screen pixels,
 * H is its height in pixels.
 */
export function drawEntity(ctx: Ctx2D, gx: number, gy: number, H: number, pose: Pose, style: EntityStyle, t: number): void {
  void t;
  const yaw = style.yaw;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const bob = style.bob ?? 0;
  const joints = solve(pose, H, bob);
  const still = style.stillHead ? solve(pose, H, 0) : joints;

  const project = (p: V3): [number, number, number] => {
    const sxp = p[0] * cy + p[2] * sy;
    const depth = -p[0] * sy + p[2] * cy;
    return [gx + sxp * H, gy - p[1] * H, depth];
  };

  const dark = style.dark ?? P.flesh1;
  const mid = style.mid ?? P.flesh2;
  const rim = style.rim ?? P.flesh3;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * (style.alpha ?? 1);

  interface Seg { a: [number, number]; b: [number, number]; depth: number; t0: number; t1: number; group: BoneDef['group']; name: string }
  const segs: Seg[] = [];
  for (const b of BONES) {
    const jointsFor = b.group === 'head' || b.group === 'neck' ? still : joints;
    const s = jointsFor[`${b.name}:start`].pos;
    const e = jointsFor[b.name].pos;
    // The neck bridges the moving torso to the still head.
    const sPos = b.name === 'neck' ? joints['spine'].pos : s;
    const [ax, ay, ad] = project(sPos);
    const [bx, by, bd] = project(e);
    segs.push({ a: [ax, ay], b: [bx, by], depth: (ad + bd) / 2, t0: b.thick[0] * H, t1: b.thick[1] * H, group: b.group, name: b.name });
  }
  segs.sort((p, q) => p.depth - q.depth);

  const colourFor = (seg: Seg, far: boolean): [string, string, string] => {
    if (style.mode === 'silhouette') return [dark, dark, dark];
    if (style.mode === 'thermal') {
      const cold = style.cold ?? 1;
      // The left arm and part of the torso read colder than the night air.
      const isCold = seg.group === 'armL' || seg.name === 'thighL';
      if (isCold && cold > 0) {
        const c = thermalColour(0.02 + (1 - cold) * 0.4);
        return [c, c, thermalColour(0.1 + (1 - cold) * 0.4)];
      }
      const heat = seg.group === 'head' ? 0.98 : seg.group === 'torso' ? 0.92 : 0.8;
      const h = far ? heat - 0.12 : heat;
      return [thermalColour(h - 0.15), thermalColour(h), thermalColour(Math.min(1, h + 0.08))];
    }
    return far ? [P.flesh0, dark, mid] : [dark, mid, rim];
  };

  for (const seg of segs) {
    const far = seg.depth < -0.02;
    const [c0, c1, c2] = colourFor(seg, far);
    drawTaperedBone(ctx, seg.a, seg.b, seg.t0, seg.t1, c0, c1, c2, seg.group === 'head');
    // joint knuckles
    if (style.mode === 'optical' && !far && (seg.name.startsWith('shin') || seg.name.startsWith('fore'))) {
      const r = Math.max(1, Math.round(seg.t0 * 0.45));
      disc(ctx, seg.a[0], seg.a[1], r, P.boneDim);
    }
    if (seg.group.startsWith('hand') || seg.name.startsWith('hand')) drawFingers(ctx, seg, c1, H);
  }

  // Head: capsule end + hanging jaw + optional face
  const headEnd = project(still['head'].pos);
  const headStart = project(still['head:start'].pos);
  const hr = Math.max(2, Math.round(0.05 * H));
  const headCols = colourFor({ group: 'head', name: 'head' } as Seg, false);
  disc(ctx, headEnd[0], headEnd[1], hr, headCols[1]);
  disc(ctx, headEnd[0] - Math.round(hr * 0.3), headEnd[1] - Math.round(hr * 0.3), Math.max(1, hr - 2), headCols[2]);
  // jaw — a smaller lobe hanging below/forward of the skull
  const jx = headEnd[0] + Math.round((headEnd[0] - headStart[0]) * 0.25);
  const jy = headEnd[1] + Math.round(hr * 0.9);
  disc(ctx, jx, jy, Math.max(1, Math.round(hr * 0.55)), headCols[0]);
  if (style.face && style.face > 0 && style.mode !== 'silhouette') {
    // A pale cluster where eyes might be — too many, too close.
    const fc = style.mode === 'thermal' ? '#ffffff' : '#b7b0a6';
    const fa = ctx.globalAlpha;
    ctx.globalAlpha = fa * style.face;
    ctx.fillStyle = fc;
    const fx = headEnd[0] + (sy > 0 ? 1 : -1);
    const fy = headEnd[1] - 1;
    ctx.fillRect(fx - 2, fy, 1, 1);
    ctx.fillRect(fx, fy, 1, 1);
    ctx.fillRect(fx + 2, fy - 1, 1, 1);
    ctx.fillRect(fx - 1, fy + 2, 1, 1);
    ctx.fillRect(fx + 1, fy + 2, 1, 1);
    if (H > 120) {
      ctx.fillRect(fx - 4, fy + 1, 1, 1);
      ctx.fillRect(fx + 4, fy, 1, 1);
    }
    ctx.globalAlpha = fa;
  }

  ctx.globalAlpha = prevAlpha;
}

function drawTaperedBone(ctx: Ctx2D, a: [number, number], b: [number, number], t0: number, t1: number, c0: string, c1: string, c2: string, soft: boolean): void {
  const steps = 3;
  for (let i = 0; i < steps; i++) {
    const u0 = i / steps;
    const u1 = (i + 1) / steps;
    const x0 = a[0] + (b[0] - a[0]) * u0;
    const y0 = a[1] + (b[1] - a[1]) * u0;
    const x1 = a[0] + (b[0] - a[0]) * u1;
    const y1 = a[1] + (b[1] - a[1]) * u1;
    const th = Math.max(1, Math.round(t0 + (t1 - t0) * (u0 + u1) / 2));
    line(ctx, x0, y0, x1, y1, c0, th);
    if (th >= 3) line(ctx, x0, y0, x1, y1, c1, th - 2);
    if (th >= 2 && !soft) line(ctx, x0 - 1, y0 - 1, x1 - 1, y1 - 1, c2, 1);
  }
}

function drawFingers(ctx: Ctx2D, seg: { a: [number, number]; b: [number, number] }, colour: string, H: number): void {
  const dx = seg.b[0] - seg.a[0];
  const dy = seg.b[1] - seg.a[1];
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / len;
  const ny = dy / len;
  const fl = Math.max(2, Math.round(H * 0.045));
  // three fingers splayed, one much longer
  const spreads = [-0.35, 0.05, 0.4];
  const lens = [fl, Math.round(fl * 1.7), fl];
  for (let i = 0; i < 3; i++) {
    const ang = spreads[i];
    const fx = nx * Math.cos(ang) - ny * Math.sin(ang);
    const fy = nx * Math.sin(ang) + ny * Math.cos(ang);
    line(ctx, seg.b[0], seg.b[1], seg.b[0] + fx * lens[i], seg.b[1] + fy * lens[i], colour, 1);
  }
}

export interface LoomingStyle {
  mode: 'optical' | 'thermal';
  /** 0..1 strength of the pale eye cluster. */
  face: number;
  /** Rim light direction: -1 from left, 1 from right. */
  light?: number;
  /** Lit palette for interiors where tubes catch the skin. */
  lit?: boolean;
}

/**
 * The entity directly beneath a lens: a huge hanging skull filling the lower
 * part of a frame, shoulders at the edge, the pale cluster looking up.
 * (cx, cy) is the skull centre in the target context; `scale` 1 ≈ 180 px wide.
 */
export function drawLoomingHead(ctx: Ctx2D, cx: number, cy: number, scale: number, t: number, style: LoomingStyle): void {
  const s = scale;
  const th = style.mode === 'thermal';
  const lit = style.lit ?? false;
  const dark = th ? thermalColour(0.82) : lit ? '#161220' : '#0b0910';
  const mid = th ? thermalColour(0.9) : lit ? '#241d2e' : '#16121c';
  const deep = th ? thermalColour(0.7) : lit ? '#0d0b12' : '#07060a';
  const rimC = th ? thermalColour(0.97) : lit ? '#3a3044' : '#231c2b';
  const sway = Math.sin(t * 0.8) * 2 * s;
  const lightDir = style.light ?? -1;
  // shoulder / neck mass behind
  ellipse(ctx, Math.round(cx + 120 * s), Math.round(cy + 44 * s), Math.round(120 * s), Math.round(50 * s), deep);
  ellipse(ctx, Math.round(cx - 110 * s), Math.round(cy + 62 * s), Math.round(90 * s), Math.round(40 * s), deep);
  // skull: elongated, hanging at an angle
  ellipse(ctx, Math.round(cx + sway), Math.round(cy), Math.round(92 * s), Math.round(70 * s), dark);
  ellipse(ctx, Math.round(cx - 22 * s * lightDir * -1 + sway), Math.round(cy - 22 * s), Math.round(62 * s), Math.round(44 * s), rimC);
  ellipse(ctx, Math.round(cx - 10 * s + sway), Math.round(cy - 8 * s), Math.round(74 * s), Math.round(54 * s), mid);
  // jaw lobe, slung low and off to one side
  ellipse(ctx, Math.round(cx + 58 * s + sway), Math.round(cy + 42 * s), Math.round(56 * s), Math.round(32 * s), deep);
  ellipse(ctx, Math.round(cx + 50 * s + sway), Math.round(cy + 36 * s), Math.round(40 * s), Math.round(20 * s), dark);
  // irregular growths so the skull is not a clean dome
  ellipse(ctx, Math.round(cx - 70 * s + sway), Math.round(cy - 36 * s), Math.round(22 * s), Math.round(16 * s), dark);
  ellipse(ctx, Math.round(cx + 40 * s + sway), Math.round(cy - 58 * s), Math.round(18 * s), Math.round(12 * s), dark);
  ellipse(ctx, Math.round(cx + 76 * s + sway), Math.round(cy - 10 * s), Math.round(14 * s), Math.round(22 * s), deep);
  // bone ridge
  line(ctx, Math.round(cx - 60 * s + sway), Math.round(cy - 30 * s), Math.round(cx + 10 * s + sway), Math.round(cy - 50 * s), th ? rimC : P.boneDim, Math.max(1, Math.round(2 * s)));
  line(ctx, Math.round(cx - 60 * s + sway), Math.round(cy - 30 * s), Math.round(cx - 30 * s + sway), Math.round(cy + 6 * s), th ? rimC : P.boneDim, 1);
  // the pale cluster
  if (style.face > 0) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * style.face;
    const eyes: Array<[number, number, number]> = [[-40, -28, 2], [-20, -36, 3], [0, -28, 2], [-30, -10, 2], [-8, -16, 3], [16, -22, 2], [-48, 2, 1], [8, 0, 2], [-18, 6, 1], [30, -8, 1]];
    for (const [ex, ey, r] of eyes) {
      const px = Math.round(cx + ex * s + sway);
      const py = Math.round(cy + ey * s);
      disc(ctx, px, py, Math.max(1, Math.round(r * s)), th ? '#ffffff' : '#d9d2c4');
      if (r * s >= 2) rect(ctx, px, py, 1, 1, th ? '#ffe9b0' : '#0a0a0a');
    }
    ctx.globalAlpha = a;
  }
}

/**
 * Convenience: the entity drawn as a small far silhouette with a little
 * atmospheric haze between it and the lens.
 */
export function drawEntityDistant(ctx: Ctx2D, gx: number, gy: number, H: number, pose: Pose, yaw: number, colour: string, alpha = 1): void {
  drawEntity(ctx, gx, gy, H, pose, { mode: 'silhouette', yaw, dark: colour, alpha }, 0);
}

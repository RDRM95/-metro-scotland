/**
 * Shared bunker photography: the wide rear shot with the crew at their
 * terminals, and front-lit close-ups through the camera.
 */
import { applyCamera, type CameraState } from '../camera/Camera';
import { createSurface, type Ctx2D, type Surface } from '../engine/Surface';
import { BUNKER_H, BUNKER_W, drawBunkerWide, drawCloseupBackdrop, drawMonitorGlows, drawStandingTech, type BunkerState } from '../environments/commandCentre';
import { drawOperatorFront, drawOperatorRear, LOOKS, type OperatorPose, defaultPose } from '../characters/Operator';
import { tint } from '../lighting/Lighting';

export interface CrewPoses {
  op2: Partial<OperatorPose>;
  op1: Partial<OperatorPose>;
  control: Partial<OperatorPose>;
  tech?: { frantic: boolean; visible: boolean };
}

export const DESK_X = { op2: 240, op1: 320, control: 400 } as const;
export const DESK_Y = 214;

export class BunkerSet {
  readonly wide: Surface;
  readonly close: Surface;
  constructor() {
    this.wide = createSurface(BUNKER_W, BUNKER_H);
    this.close = createSurface(480, 270);
  }

  /** Renders the wide room with crew and shoots it with the camera. */
  wideShot(frame: Ctx2D, t: number, state: BunkerState, crew: CrewPoses, cam: CameraState): void {
    const ctx = this.wide.ctx;
    drawBunkerWide(ctx, t, state);
    const power = 1 - state.dim;
    if (crew.tech?.visible !== false) drawStandingTech(ctx, 72, 232, t, crew.tech?.frantic ?? false);
    drawOperatorRear(ctx, DESK_X.op2, DESK_Y, t, LOOKS.op2, defaultPose({ typing: true, ...crew.op2 }));
    drawOperatorRear(ctx, DESK_X.op1, DESK_Y, t, LOOKS.op1, defaultPose({ typing: true, ...crew.op1 }));
    drawOperatorRear(ctx, DESK_X.control, DESK_Y, t, LOOKS.control, defaultPose({ typing: false, ...crew.control }));
    // crew sit in the room's light: re-apply darkness so sprites match the room
    if (state.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${(state.dim * 0.9).toFixed(3)})`;
      ctx.fillRect(0, 150, BUNKER_W, 120);
    }
    if (state.emergency > 0) tint(ctx, 0, 150, BUNKER_W, 120, '#7a1410', 0.08 * state.emergency);
    drawMonitorGlows(ctx, t, state);
    void power;
    applyCamera(frame, this.wide, cam, t);
  }

  /**
   * Front close-up of one operator. The operator sits at (240, 236) in the
   * close-up world and the camera is zoomed ×2 on their head and shoulders.
   */
  closeup(frame: Ctx2D, t: number, state: BunkerState, who: keyof typeof LOOKS, pose: Partial<OperatorPose>, lampSide: -1 | 1 = 1, focusY = 212, redPulse = 0): void {
    const ctx = this.close.ctx;
    drawCloseupBackdrop(ctx, t, state, lampSide);
    const full = defaultPose({ light: lampSide > 0 ? -1 : 1, ...pose });
    drawOperatorFront(ctx, 240, 236, t, LOOKS[who], full);
    if (redPulse > 0) {
      const p = 0.5 + 0.5 * Math.sin(t * 6.0);
      tint(ctx, 0, 0, 480, 270, '#ff3b2f', 0.10 * redPulse * p);
    }
    if (state.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${(state.dim * 0.85).toFixed(3)})`;
      ctx.fillRect(0, 0, 480, 270);
    }
    if (state.emergency > 0) {
      const p = 0.6 + 0.4 * Math.abs(Math.sin(t * 1.1));
      tint(ctx, 0, 0, 480, 270, '#b01a14', 0.16 * state.emergency * p);
    }
    applyCamera(frame, this.close, { x: 240, y: focusY, zoom: 3, shake: 0 }, t);
  }
}

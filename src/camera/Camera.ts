/**
 * A cinematic camera for the 480×270 frame.
 *
 * Scenes render into a larger world surface, then the camera decides what
 * part of it fills the frame. Zoom is applied with nearest-neighbour so the
 * pixel grid stays honest (we snap to the source grid at integer zooms and
 * accept controlled pixel doubling for slow push-ins).
 */
import type { Ctx2D, Surface } from '../engine/Surface';
import { VIEW_H, VIEW_W } from '../engine/Surface';
import { keyframes, type EaseFn, easeInOutQuad } from '../engine/Easing';

export interface CameraState {
  x: number; // world x at centre of frame
  y: number; // world y at centre of frame
  zoom: number; // 1 = 1:1 pixels
  shake: number; // px amplitude
  rotation?: number; // reserved
}

export interface CameraTrack {
  x?: ReadonlyArray<readonly [number, number]>;
  y?: ReadonlyArray<readonly [number, number]>;
  zoom?: ReadonlyArray<readonly [number, number]>;
  shake?: ReadonlyArray<readonly [number, number]>;
  ease?: EaseFn;
}

export function evalCamera(track: CameraTrack, t: number, fallback: CameraState): CameraState {
  const ease = track.ease ?? easeInOutQuad;
  return {
    x: track.x ? keyframes(t, track.x, ease) : fallback.x,
    y: track.y ? keyframes(t, track.y, ease) : fallback.y,
    zoom: track.zoom ? keyframes(t, track.zoom, ease) : fallback.zoom,
    shake: track.shake ? keyframes(t, track.shake, ease) : fallback.shake,
  };
}

export interface CameraWindow {
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  zoom: number;
}

/** The world-space rectangle the camera sees (clamped inside the world). */
export function cameraWindow(cam: CameraState, worldW: number, worldH: number, t: number): CameraWindow {
  const sx = cam.shake ? Math.round(Math.sin(t * 61.7) * cam.shake) : 0;
  const sy = cam.shake ? Math.round(Math.cos(t * 47.3) * cam.shake) : 0;
  const z = cam.zoom;
  const srcW = VIEW_W / z;
  const srcH = VIEW_H / z;
  let srcX = cam.x - srcW / 2 + sx;
  let srcY = cam.y - srcH / 2 + sy;
  if (srcW <= worldW) srcX = Math.max(0, Math.min(worldW - srcW, srcX));
  if (srcH <= worldH) srcY = Math.max(0, Math.min(worldH - srcH, srcY));
  return { srcX, srcY, srcW, srcH, zoom: z };
}

/** Converts a world point to frame coordinates for the given camera. */
export function worldToFrame(cam: CameraState, worldW: number, worldH: number, t: number, wx: number, wy: number): { x: number; y: number } {
  const w = cameraWindow(cam, worldW, worldH, t);
  return { x: (wx - w.srcX) * w.zoom, y: (wy - w.srcY) * w.zoom };
}

/**
 * Draws `world` into `ctx` (the 480×270 frame) according to the camera.
 * Shake is derived from time so it is deterministic.
 */
export function applyCamera(ctx: Ctx2D, world: Surface, cam: CameraState, t: number): void {
  const { srcX, srcY, srcW, srcH, zoom: z } = cameraWindow(cam, world.w, world.h, t);
  ctx.imageSmoothingEnabled = false;
  if (Math.abs(z - Math.round(z)) < 1e-6) {
    // integer zoom: snap to grid
    ctx.drawImage(world.canvas, Math.round(srcX), Math.round(srcY), Math.round(srcW), Math.round(srcH), 0, 0, VIEW_W, VIEW_H);
  } else {
    ctx.drawImage(world.canvas, srcX, srcY, srcW, srcH, 0, 0, VIEW_W, VIEW_H);
  }
}

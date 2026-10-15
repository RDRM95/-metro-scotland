/**
 * Layer cache: static environment layers are drawn once into offscreen
 * surfaces and blitted every frame. Slowly-changing layers (cloud banks)
 * are keyed by a coarse time bucket.
 */
import { createSurface, type Ctx2D, type Surface } from '../engine/Surface';

const cache = new Map<string, Surface>();

export function cached(key: string, w: number, h: number, draw: (ctx: Ctx2D) => void): Surface {
  let s = cache.get(key);
  if (!s) {
    s = createSurface(w, h);
    draw(s.ctx);
    cache.set(key, s);
  }
  return s;
}

/** Like `cached` but re-draws whenever `version` changes (keeps one surface per key). */
export function cachedVersioned(key: string, version: number, w: number, h: number, draw: (ctx: Ctx2D) => void): Surface {
  const vkey = `${key}#v`;
  const existing = cache.get(key);
  const ver = versions.get(vkey);
  if (existing && ver === version) return existing;
  const s = existing ?? createSurface(w, h);
  s.ctx.clearRect(0, 0, w, h);
  draw(s.ctx);
  cache.set(key, s);
  versions.set(vkey, version);
  return s;
}

const versions = new Map<string, number>();

export function clearLayerCache(): void {
  cache.clear();
  versions.clear();
}

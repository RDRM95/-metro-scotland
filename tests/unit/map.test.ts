import { describe, expect, it } from 'vitest';
import { STATIONS, countStatus, fitProjection, mapSize, project } from '../../src/environments/scotlandMap';

describe('Scotland map', () => {
  const p = fitProjection(0, 0, 180);

  it('places cities in the right relative positions', () => {
    const [gx, gy] = project(p, -4.25, 55.86); // Glasgow
    const [ex, ey] = project(p, -3.19, 55.95); // Edinburgh
    const [fx, fy] = project(p, -4.82, 56.06); // Faslane
    const [ix, iy] = project(p, -4.22, 57.48); // Inverness
    expect(ex).toBeGreaterThan(gx); // Edinburgh east of Glasgow
    expect(Math.abs(ey - gy)).toBeLessThan(8); // roughly same latitude
    expect(fx).toBeLessThan(gx); // Faslane west
    expect(fy).toBeLessThan(gy); // and north
    expect(iy).toBeLessThan(gy - 40); // Inverness well north
    expect(Math.abs(ix - gx)).toBeLessThan(6);
  });

  it('fits in its box', () => {
    const { w, h } = mapSize(p);
    expect(h).toBe(180);
    expect(w).toBeGreaterThan(100);
    expect(w).toBeLessThan(180);
    for (const s of STATIONS) {
      const [x, y] = project(p, s.lon, s.lat);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(h);
    }
  });

  it('has unique station ids and sensible status counts', () => {
    const ids = new Set(STATIONS.map((s) => s.id));
    expect(ids.size).toBe(STATIONS.length);
    const c = countStatus();
    expect(c.ok).toBeGreaterThan(10);
    expect(c.offline).toBeGreaterThan(3);
    expect(c.alert).toBe(0);
    const c2 = countStatus({ gw: 'alert', ed: 'alert' });
    expect(c2.alert).toBe(2);
    expect(c2.ok).toBe(c.ok - 2);
  });
});

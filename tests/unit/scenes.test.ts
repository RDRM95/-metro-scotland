import { describe, expect, it } from 'vitest';
import { buildScenes } from '../../src/Film';
import { Timeline } from '../../src/timeline/Timeline';
import { SCRIPT } from '../../src/dialogue/script';
import { SILENCE } from '../../src/audio/AudioMix';

describe('film structure', () => {
  const scenes = buildScenes();
  const tl = new Timeline(scenes);

  it('has the five scripted scenes plus an end card, in order', () => {
    expect(scenes.map((s) => s.id)).toEqual(['control', 'surface', 'entity', 'network', 'inside', 'end']);
  });

  it('runs about two and a half minutes', () => {
    expect(tl.total).toBeGreaterThan(140);
    expect(tl.total).toBeLessThan(180);
  });

  it('every cue falls inside its scene and has a known id', () => {
    const known = new Set(['key', 'alert', 'alert-long', 'blip', 'motor', 'motor-long', 'lost', 'thermal', 'thunder', 'heartbeat', 'sub-hit', 'glitch', 'monitor-off', 'monitor-on', 'squelch-open', 'squelch-close', 'power-dip', 'power-down', 'relay', 'scrape', 'impact', 'connection-lost']);
    for (const s of scenes) {
      for (const c of s.cues) {
        expect(c.time, `${s.id}:${c.id}`).toBeGreaterThanOrEqual(0);
        expect(c.time, `${s.id}:${c.id}`).toBeLessThanOrEqual(s.duration);
        expect(known.has(c.id), `unknown cue ${c.id}`).toBe(true);
      }
    }
  });

  it('each scene has a script entry and returns a complete audio mix', () => {
    for (const s of scenes) {
      expect(SCRIPT[s.id]).toBeDefined();
      for (const t of [0, s.duration / 2, s.duration - 0.01]) {
        const m = s.mix(t);
        for (const k of Object.keys(SILENCE) as Array<keyof typeof SILENCE>) {
          expect(typeof m[k]).toBe('number');
          expect(m[k]).toBeGreaterThanOrEqual(0);
          expect(m[k]).toBeLessThanOrEqual(1.5);
        }
      }
    }
  });

  it('the surface scene chooses sensible entity positions', async () => {
    const { SceneSurface } = await import('../../src/scenes/SceneSurface');
    const s = new SceneSurface();
    expect(s.entity(2)).toBeUndefined();
    const walking = s.entity(8);
    expect(walking).toBeDefined();
    expect(walking!.x).toBeGreaterThan(260);
    expect(walking!.x).toBeLessThan(320);
    const thermal = s.entity(24);
    expect(thermal!.style.mode).toBe('thermal');
  });

  it('the entity scene jumps between separated positions', async () => {
    const { SceneEntity } = await import('../../src/scenes/SceneEntity');
    const s = new SceneEntity();
    const a = s.entity(22.9)!;
    const b = s.entity(23.7)!;
    const c = s.entity(25.0)!;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(200);
    expect(c.H).toBeGreaterThan(a.H * 4);
    // blank frames between jumps
    expect(s.entity(22.52)).toBeUndefined();
  });
});

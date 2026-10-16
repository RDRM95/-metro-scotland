import { describe, expect, it } from 'vitest';
import { SCRIPT, activeLine, SPEAKER_COLOURS } from '../../src/dialogue/script';

const DURATIONS: Record<string, number> = { control: 24, surface: 28, entity: 30, network: 37, inside: 38, end: 6 };

describe('dialogue script', () => {
  it('has lines for every scene and every speaker has a colour', () => {
    for (const id of Object.keys(DURATIONS)) expect(SCRIPT[id]).toBeDefined();
    for (const lines of Object.values(SCRIPT)) {
      for (const l of lines) expect(SPEAKER_COLOURS[l.speaker]).toMatch(/^#/);
    }
  });

  it('lines are sorted, non-overlapping and inside their scene', () => {
    for (const [id, lines] of Object.entries(SCRIPT)) {
      let lastEnd = -1;
      for (const l of lines) {
        expect(l.time).toBeGreaterThanOrEqual(lastEnd);
        expect(l.time + l.duration).toBeLessThanOrEqual(DURATIONS[id]);
        expect(l.duration).toBeGreaterThan(0.8);
        lastEnd = l.time + l.duration;
      }
    }
  });

  it('gives readers time: at least ~0.07 s per character', () => {
    for (const lines of Object.values(SCRIPT)) {
      for (const l of lines) expect(l.duration).toBeGreaterThanOrEqual(l.text.length * 0.04);
    }
  });

  it('resolves the active line at a time', () => {
    const lines = SCRIPT.control;
    expect(activeLine(lines, 0)).toBeUndefined();
    expect(activeLine(lines, 8.3)?.speaker).toBe('OPERATOR 1');
    expect(activeLine(lines, 11.7)?.text).toBe('Which camera?');
  });

  it('covers every beat of the screenplay', () => {
    const all = Object.values(SCRIPT).flat().map((l) => l.text).join(' ');
    for (const needle of ['Magnify.', 'Target acquired.', 'Unknown.', 'Four metres.', 'Is it looking at us?', "That's not possible.", 'Faslane', 'network fault', 'Disconnect the external feeds.', 'Ours.', 'perimeter', 'Scotland Control, respond.']) {
      expect(all).toContain(needle);
    }
  });
});

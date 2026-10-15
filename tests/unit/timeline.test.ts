import { describe, expect, it } from 'vitest';
import { Timeline, cuesCrossed, formatTime, surveillanceClock } from '../../src/timeline/Timeline';

describe('Timeline', () => {
  const tl = new Timeline([
    { id: 'a', duration: 10 },
    { id: 'b', duration: 5 },
    { id: 'c', duration: 2.5 },
  ]);

  it('accumulates starts and total', () => {
    expect(tl.starts).toEqual([0, 10, 15]);
    expect(tl.total).toBe(17.5);
  });

  it('locates segments and local time', () => {
    expect(tl.locate(0)).toMatchObject({ index: 0, local: 0 });
    expect(tl.locate(9.99)).toMatchObject({ index: 0 });
    expect(tl.locate(10)).toMatchObject({ index: 1, local: 0 });
    expect(tl.locate(12.5)).toMatchObject({ index: 1, local: 2.5 });
    expect(tl.locate(17.5)).toMatchObject({ index: 2, local: 2.5 });
  });

  it('clamps out-of-range times', () => {
    expect(tl.locate(-5).index).toBe(0);
    expect(tl.locate(99).index).toBe(2);
    expect(tl.clamp(99)).toBe(17.5);
  });

  it('finds segments by id', () => {
    expect(tl.indexOf('b')).toBe(1);
    expect(tl.startOf(2)).toBe(15);
  });
});

describe('cuesCrossed', () => {
  const cues = [{ time: 1, id: 'x' }, { time: 2, id: 'y' }, { time: 3, id: 'z' }];
  it('fires cues in (prev, now]', () => {
    expect(cuesCrossed(cues, 0.9, 1.0).map((c) => c.id)).toEqual(['x']);
    expect(cuesCrossed(cues, 1.0, 1.2)).toEqual([]);
    expect(cuesCrossed(cues, 1.9, 2.1).map((c) => c.id)).toEqual(['y']);
  });
  it('does not fire on seeks or when time runs backwards', () => {
    expect(cuesCrossed(cues, 0, 3)).toEqual([]);
    expect(cuesCrossed(cues, 2.5, 2.0)).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats mm:ss', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65.9)).toBe('01:05');
    expect(formatTime(599)).toBe('09:59');
  });
  it('advances the surveillance clock', () => {
    expect(surveillanceClock(0)).toBe('23:41:17');
    expect(surveillanceClock(43)).toBe('23:42:00');
    expect(surveillanceClock(19 * 60)).toBe('00:00:17');
  });
});

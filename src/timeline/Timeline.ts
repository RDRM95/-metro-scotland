/**
 * Pure (DOM-free) timeline logic: maps global film time to a scene and local
 * time, and decides which one-shot cues fire when time advances.
 */

export interface TimedSegment {
  id: string;
  duration: number;
}

export interface Cue {
  /** Local scene time in seconds. */
  time: number;
  id: string;
}

export interface Position<S extends TimedSegment = TimedSegment> {
  index: number;
  segment: S;
  local: number;
  start: number;
}

export class Timeline<S extends TimedSegment = TimedSegment> {
  readonly starts: number[] = [];
  readonly total: number;

  constructor(readonly segments: readonly S[]) {
    let acc = 0;
    for (const s of segments) {
      this.starts.push(acc);
      acc += s.duration;
    }
    this.total = acc;
  }

  /** Clamp a global time to [0, total]. */
  clamp(t: number): number {
    return t < 0 ? 0 : t > this.total ? this.total : t;
  }

  /** Locate the segment containing global time `t`. The final instant maps to the last segment. */
  locate(t: number): Position<S> {
    const tt = this.clamp(t);
    let index = this.segments.length - 1;
    for (let i = 0; i < this.segments.length; i++) {
      const end = this.starts[i] + this.segments[i].duration;
      if (tt < end) {
        index = i;
        break;
      }
    }
    const start = this.starts[index];
    return { index, segment: this.segments[index], local: tt - start, start };
  }

  startOf(index: number): number {
    return this.starts[Math.max(0, Math.min(this.segments.length - 1, index))];
  }

  indexOf(id: string): number {
    return this.segments.findIndex((s) => s.id === id);
  }
}

/**
 * Returns cues whose time lies in (prev, now]. If the jump is larger than
 * `maxJump` (a seek), nothing fires — we never want a pile of stale beeps.
 */
export function cuesCrossed<C extends Cue>(cues: readonly C[], prev: number, now: number, maxJump = 0.5): C[] {
  if (now <= prev) return [];
  if (now - prev > maxJump) return [];
  const out: C[] = [];
  for (const c of cues) if (c.time > prev && c.time <= now) out.push(c);
  return out;
}

/** Formats seconds as mm:ss. */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Fictional 2033 timestamp for surveillance overlays: 11 OCT 2033 23:4x:xx. */
export function surveillanceClock(filmTime: number, baseSeconds = 23 * 3600 + 41 * 60 + 17): string {
  const total = Math.floor(baseSeconds + filmTime);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

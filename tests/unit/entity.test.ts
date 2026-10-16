import { describe, expect, it } from 'vitest';
import { blendPose, compressedPose, headRaisePose, headTurnPose, pointPose, standPose, walkPose } from '../../src/creatures/Entity';

const finite = (p: Record<string, { pitch: number; roll: number }>) => {
  for (const [k, v] of Object.entries(p)) {
    expect(Number.isFinite(v.pitch), `${k}.pitch`).toBe(true);
    expect(Number.isFinite(v.roll), `${k}.roll`).toBe(true);
  }
};

describe('entity poses', () => {
  it('produce finite angles for every bone', () => {
    for (let i = 0; i < 20; i++) {
      finite(walkPose(i / 20, i * 0.37));
      finite(standPose(i * 0.5, i));
      finite(compressedPose(i * 0.3));
    }
    finite(headTurnPose(standPose(1), 0.5));
    finite(pointPose(standPose(1), 1));
    finite(headRaisePose(compressedPose(1), 1));
  });

  it('walk cycle actually moves the legs and alternates them', () => {
    const a = walkPose(0.25, 0);
    const b = walkPose(0.75, 0);
    expect(Math.sign(a.thighL.pitch)).not.toBe(Math.sign(b.thighL.pitch));
    expect(Math.sign(a.thighL.pitch)).not.toBe(Math.sign(a.thighR.pitch));
  });

  it('knees fold the wrong way when the leg is forward', () => {
    const p = walkPose(0.25, 0); // left leg forward
    expect(p.shinL.pitch).toBeLessThan(p.thighL.pitch);
  });

  it('the long arm has an extra joint that zig-zags', () => {
    const p = walkPose(0.1, 0);
    expect(Math.sign(p.foreR1.pitch - p.upperR.pitch)).not.toBe(Math.sign(p.foreR2.pitch - p.foreR1.pitch));
  });

  it('head turn and pointing interpolate towards the camera', () => {
    const base = standPose(0, 1);
    const half = headTurnPose(base, 0.5);
    const full = headTurnPose(base, 1);
    expect(full.head.roll).toBeLessThan(half.head.roll);
    expect(half.head.roll).toBeLessThan(base.head.roll);
    const pt = pointPose(base, 1);
    expect(pt.upperR.pitch).toBeGreaterThan(1.5);
  });

  it('blendPose is identity at the ends', () => {
    const a = standPose(0, 1);
    const b = walkPose(0.3, 0);
    expect(blendPose(a, b, 0).spine.pitch).toBeCloseTo(a.spine.pitch);
    expect(blendPose(a, b, 1).spine.pitch).toBeCloseTo(b.spine.pitch);
  });

  it('stillness is never perfectly still', () => {
    const a = standPose(0, 1);
    const b = standPose(2, 1);
    expect(a.head.roll).not.toBe(b.head.roll);
  });
});

import { describe, expect, it } from 'vitest';

import {
  computeFlightAndTrail,
  interpolateFlightPosition,
  trailingLineFor,
} from '@/lib/draw';

// Basic regression test ensuring computeFlightAndTrail matches previous individual helpers

describe('computeFlightAndTrail', () => {
  const layout = {
    clientXPercent: 10,
    serverXPercent: 90,
    topOffset: 50,
    segmentHeight: 80,
    envelopeHeight: 30,
    startLiftFor: (seq: number) => (seq === 0 ? 12 : 0),
  } as const;

  const cases = [
    { seqNum: 0, type: 'A', from: 'client', to: 'server', positionPercent: 0 },
    { seqNum: 1, type: 'B', from: 'server', to: 'client', positionPercent: 37 },
    { seqNum: 2, type: 'C', from: 'client', to: 'server', positionPercent: 73 },
    {
      seqNum: 3,
      type: 'D',
      from: 'server',
      to: 'client',
      positionPercent: 100,
    },
  ] as const;

  it('matches interpolateFlightPosition and trailingLineFor outputs', () => {
    cases.forEach((c) => {
      const interp = interpolateFlightPosition(c, layout);
      const trail = trailingLineFor({ ...c }, { ...layout });
      const unified = computeFlightAndTrail(c, layout);
      expect(unified.xPercent).toBeCloseTo(interp.xPercent, 6);
      expect(unified.yTop).toBeCloseTo(interp.yTop, 6);
      expect(unified.trail.x1).toBeCloseTo(trail.x1, 6);
      expect(unified.trail.y1).toBeCloseTo(trail.y1, 6);
      expect(unified.trail.x2).toBeCloseTo(trail.x2, 6);
      expect(unified.trail.y2).toBeCloseTo(trail.y2, 6);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { computeCollisionOverlaps } from './wave-collision';

// Helper to build segment
type S = { startKm: number; endKm: number };
const seg = (a: number, b: number): S => ({ startKm: a, endKm: b });

describe('computeCollisionOverlaps', () => {
  it('returns empty when 0 or 1 segment', () => {
    expect(computeCollisionOverlaps([])).toEqual([]);
    expect(computeCollisionOverlaps([seg(0, 10)])).toEqual([]);
  });

  it('detects simple overlap between two segments', () => {
    const overlaps = computeCollisionOverlaps([seg(0, 10), seg(5, 15)]);
    expect(overlaps).toEqual([{ startKm: 5, endKm: 10 }]);
  });

  it('detects chained overlaps merging correctly', () => {
    // 0-10 overlaps 5-14, 8-20 overlaps with second -> two or more active from 5..20, but first drops at 10
    // Actually active counts: [0-5:1] [5-8:2] [8-10:3] [10-14:2] [14-20:1]
    const overlaps = computeCollisionOverlaps([
      seg(0, 10),
      seg(5, 14),
      seg(8, 20),
    ]);
    // Regions where active >=2: 5-20 but after 14 only one remains, so 5-14 plus 8-14 merged -> algorithm produces [5,14]
    expect(overlaps).toEqual([{ startKm: 5, endKm: 14 }]);
  });

  it('splits disjoint overlap regions', () => {
    const overlaps = computeCollisionOverlaps([
      seg(0, 5),
      seg(2, 7), // overlap 2-5
      seg(10, 15),
      seg(12, 20), // overlap 12-15
    ]);
    expect(overlaps).toEqual([
      { startKm: 2, endKm: 5 },
      { startKm: 12, endKm: 15 },
    ]);
  });

  it('handles nested segment fully inside another + third overlapping outer', () => {
    // Outer 0-30, nested 5-10, third 8-25 => active>=2 from 5-25
    const overlaps = computeCollisionOverlaps([
      seg(0, 30),
      seg(5, 10),
      seg(8, 25),
    ]);
    expect(overlaps).toEqual([{ startKm: 5, endKm: 25 }]);
  });
});

// Collision overlap utilities for linear wave segments.
// Extracted from CsmaCdSim.computeCollisionOverlaps so it can be reused and unit tested.

export interface BasicSegment {
  startKm: number;
  endKm: number;
}

export interface CollisionInterval {
  startKm: number;
  endKm: number;
}

// Given data-like segments, return merged intervals where at least two segments overlap.
export function computeCollisionOverlaps(
  dataSegs: BasicSegment[]
): CollisionInterval[] {
  if (dataSegs.length <= 1) return [];
  type Edge = { x: number; delta: number };
  const edges: Edge[] = [];
  dataSegs.forEach((s) => {
    edges.push({ x: s.startKm, delta: +1 });
    edges.push({ x: s.endKm, delta: -1 });
  });
  edges.sort((a, b) => a.x - b.x);
  const overlaps: CollisionInterval[] = [];
  let active = 0;
  let curStart: number | null = null;
  for (let i = 0; i < edges.length; i += 1) {
    const e = edges[i];
    const prev = active;
    active += e.delta;
    if (prev < 2 && active >= 2) {
      curStart = e.x;
    } else if (prev >= 2 && active < 2) {
      if (curStart !== null && e.x > curStart) {
        overlaps.push({ startKm: curStart, endKm: e.x });
      }
      curStart = null;
    }
  }
  return overlaps;
}

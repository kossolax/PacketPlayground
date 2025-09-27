// Small drawing primitives/helpers for timeline components

export type Side = 'client' | 'server';

// Return lifeline X position given side and the two lifeline Xs (percent in the 0..100 viewBox)
export function lifelineX(
  side: Side,
  clientX: number,
  serverX: number
): number {
  return side === 'client' ? clientX : serverX;
}

// Compute a vertical segment (y1->y2) for a wait overlay, ensuring a minimum visible size
export function computeWaitSegment(
  lastY: number,
  segmentHeight: number,
  minPx: number = 50
): { y1: number; y2: number } {
  const y1 = lastY + 8; // slight gap after last segment
  const height = Math.max(minPx, segmentHeight * 0.7);
  const y2 = y1 + height;
  return { y1, y2 };
}

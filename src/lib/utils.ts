import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// eslint-disable-next-line import/prefer-default-export
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ======= Mathematical utilities =======

/**
 * Clamp a value between a minimum and maximum
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Calculate Euclidean distance between two 2D points
 */
export function distanceBetweenPoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Scale a distance by a given factor
 */
export function scaleDistance(distance: number, scale: number): number {
  return distance * scale;
}

// ======= Random utilities =======

const DEFAULT_COLOR_PALETTE = [
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#F97316', // orange
  '#EF4444', // red
  '#0EA5E9', // sky
] as const;

/**
 * Get a random color from a predefined palette
 */
export function getRandomColor(
  palette: readonly string[] = DEFAULT_COLOR_PALETTE
): string {
  return palette[Math.floor(Math.random() * palette.length)];
}

// ======= Statistical utilities =======

/**
 * Generate 2D Gaussian noise using Box-Muller transform.
 * Returns two independent normally distributed random values.
 */
export function generateGaussianNoise(stdDev: number = 1): {
  z1: number;
  z2: number;
} {
  const u1 = Math.random();
  const u2 = Math.random();
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

  return {
    z1: z1 * stdDev,
    z2: z2 * stdDev,
  };
}

/**
 * Find the closest point from a list of candidates to a target point.
 * Uses Euclidean distance.
 */
export function findClosestPoint2D<T extends { x: number; y: number }>(
  target: { x: number; y: number },
  candidates: readonly T[]
): T | null {
  if (candidates.length === 0) return null;

  return candidates.reduce((closest, candidate) => {
    const distanceToCandidate =
      (candidate.x - target.x) ** 2 + (candidate.y - target.y) ** 2;
    const distanceToClosest =
      (closest.x - target.x) ** 2 + (closest.y - target.y) ** 2;
    return distanceToCandidate < distanceToClosest ? candidate : closest;
  }, candidates[0]);
}

// ======= Array utilities =======

/**
 * Generate a random binary string of specified length
 */
export function generateRandomBits(length: number = 16): string {
  let bits = '';
  for (let i = 0; i < length; i += 1) {
    bits += Math.random() < 0.5 ? '0' : '1';
  }
  return bits;
}

/**
 * Extract unique values from an array
 */
export function getUniqueValues<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}

/**
 * Find the minimum step between consecutive unique sorted values
 */
export function getMinimumStep(arr: readonly number[]): number {
  const unique = getUniqueValues(arr).sort((a, b) => a - b);
  let step = Infinity;
  for (let i = 1; i < unique.length; i += 1) {
    const delta = unique[i] - unique[i - 1];
    if (delta > 1e-9) step = Math.min(step, delta);
  }
  return Number.isFinite(step) ? step : 1;
}

// ======= Time/progress helpers =======

/**
 * Normalized progress in [0,1] given a start timestamp and a duration.
 * Returns 1 if completed flag is true, 0 if start/duration are missing.
 */
export function progress01(
  startAt: number | null,
  durationMs: number | null | undefined,
  isCompleted: boolean
): number {
  if (isCompleted) return 1;
  if (!startAt || !durationMs) return 0;
  const elapsed = Date.now() - startAt;
  return clamp(elapsed / durationMs, 0, 1);
}

/**
 * Compute arrival window (start/end) of a signal/frame at a receiver given
 * original emission start time, its own duration, and one-way propagation delay.
 */
export function arrivalWindow(
  startMs: number,
  durationMs: number,
  propagationDelayMs: number
): { start: number; end: number } {
  const start = startMs + propagationDelayMs;
  const end = start + durationMs;
  return { start, end };
}

// UI helper utilities for controls and formatting

// ======= Common constants =======

export const TIME_SCALE_VALUES = [0.1, 0.2, 0.5, 1, 2, 5, 10] as const;

export const BANDWIDTH_VALUES_STANDARD = [
  64000, // 64 Kbps
  128000, // 128 Kbps
  256000, // 256 Kbps
  512000, // 512 Kbps
  1000000, // 1 Mbps
  2000000, // 2 Mbps
  5000000, // 5 Mbps
  10000000, // 10 Mbps
  100000000, // 100 Mbps
  1000000000, // 1 Gbps
] as const;

export const PACKET_SIZE_VALUES_STANDARD = [
  1000, // 125 bytes
  8000, // 1 KB
  12000, // 1.5 KB
  40000, // 5 KB
  80000, // 10 KB
  400000, // 50 KB
  800000, // 100 KB
  4000000, // 500 KB
  8000000, // 1 MB
] as const;

// Non-linear loss rate mapping for more granular control at low values
export const LOSS_RATE_VALUES_STANDARD = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 50,
] as const;

// Default loss rate when enabling loss simulation
export const DEFAULT_LOSS_RATE = 2.5;

// ======= Slider mapping utilities =======

/**
 * Map a slider index to a value from an array.
 * Returns the value at the index, or the first value if index is out of bounds.
 */
export function mapSliderToArray<T>(values: readonly T[], index: number): T {
  return values[index] ?? values[0];
}

/**
 * Map a value to the corresponding slider index in an array.
 * Finds the first value greater than or equal to the target.
 * Returns the last index if no match is found.
 */
export function mapArrayToSlider<T>(
  values: readonly T[],
  targetValue: T
): number {
  const index = values.findIndex((val) => val >= targetValue);
  return index === -1 ? values.length - 1 : index;
}

// ======= Formatting utilities =======

/**
 * Format bandwidth in bits per second to human-readable string.
 * Examples: 1000000 → "1M", 64000 → "64K", 1000000000 → "1G"
 */
export function formatBandwidth(bps: number): string {
  if (bps >= 1000000000) return `${bps / 1000000000}G`;
  if (bps >= 1000000) return `${bps / 1000000}M`;
  if (bps >= 1000) return `${bps / 1000}K`;
  return `${bps}`;
}

/**
 * Format bytes to human-readable string with appropriate unit.
 * Examples: 1000 → "1KB", 1000000 → "1MB"
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1000000) return `${bytes / 1000000}M`;
  if (bytes >= 1000) return `${bytes / 1000}K`;
  return `${bytes}B`;
}

/**
 * Format packet size in bits to human-readable byte string.
 * Converts bits to bytes first, then formats.
 */
export function formatPacketSize(bits: number): string {
  const bytes = bits / 8;
  return formatBytes(bytes);
}

/**
 * Format time scale value to human-readable label.
 * Examples: 0.5 → "2x slower", 2 → "2x faster", 1 → "1x"
 */
export function formatTimeScale(timeScale: number): string {
  if (timeScale < 1) {
    return `${Math.round(1 / timeScale)}x slower`;
  }
  if (timeScale > 1) {
    return `${timeScale}x faster`;
  }
  return `${timeScale}x`;
}

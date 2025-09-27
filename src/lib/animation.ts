// Small, reusable flight animation helper used by GoBackN page

export interface FlightAnimationOptions {
  // Total duration to reach 100%
  durationMs: number;
  // Whether this flight should be lost mid-way (default: false)
  willBeLost?: boolean;
  // Percentage at which the loss occurs (default 50)
  lossCutoffPercent?: number;
  // Called on each animation frame with current percentage [0..100]
  onProgress: (percentage: number) => void;
  // Called once if lost at the cutoff point
  onLost?: () => void;
  // Called once when arrival reaches 100%
  onArrived: () => void;
}

/**
 * Start a time-based flight animation using requestAnimationFrame.
 * Returns a cancel function to stop the animation early if needed.
 */
export function startFlightAnimation(
  options: FlightAnimationOptions
): () => void {
  const {
    durationMs,
    willBeLost = false,
    lossCutoffPercent = 50,
    onProgress,
    onLost,
    onArrived,
  } = options;

  let running = true;
  const start = Date.now();
  const tickMs = 50; // match original animation cadence
  const intervalId = setInterval(() => {
    if (!running) return;
    const elapsed = Date.now() - start;
    const percent = Math.min(100, (elapsed / durationMs) * 100);

    if (willBeLost) {
      if (percent >= lossCutoffPercent) {
        onProgress(lossCutoffPercent);
        running = false;
        clearInterval(intervalId);
        onLost?.();
        return;
      }
      onProgress(percent);
    } else {
      if (percent >= 100) {
        onProgress(100);
        running = false;
        clearInterval(intervalId);
        onArrived();
        return;
      }
      onProgress(percent);
    }
  }, tickMs);

  return () => {
    running = false;
    clearInterval(intervalId);
  };
}

/**
 * Determine if an element should be lost given a loss rate percentage.
 * Example: shouldLose(true, 30) ~30% chance; shouldLose(true, 30/2) ~15%.
 */
export function shouldLose(lossRatePercent: number): boolean {
  return Math.random() * 100 < lossRatePercent;
}

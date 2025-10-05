// Small, reusable animation helpers

interface BaseAnimatorOptions {
  durationMs: number; // total duration for 0->100
  tickMs: number; // interval granularity
  onProgress: (percentage: number) => void;
  onDone: () => void;
  stopAtPercent?: number; // optional cutoff percent (<100) where we stop and call onDone
}

function createIntervalAnimator({
  durationMs,
  tickMs,
  onProgress,
  onDone,
  stopAtPercent,
}: BaseAnimatorOptions): () => void {
  let running = true;
  const start = Date.now();
  const cutoff = stopAtPercent ?? 100;
  const id = setInterval(() => {
    if (!running) return;
    const elapsed = Date.now() - start;
    const percent = Math.min(100, (elapsed / durationMs) * 100);
    const clamped = Math.min(percent, cutoff);
    onProgress(clamped);
    if (clamped >= cutoff) {
      running = false;
      clearInterval(id);
      onDone();
    }
  }, tickMs);
  return () => {
    running = false;
    clearInterval(id);
  };
}

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
  if (willBeLost) {
    // Use cutoff as stopAtPercent and invoke onLost when cutoff reached
    return createIntervalAnimator({
      durationMs,
      tickMs: 50,
      onProgress,
      stopAtPercent: lossCutoffPercent,
      onDone: () => onLost?.(),
    });
  }
  return createIntervalAnimator({
    durationMs,
    tickMs: 50,
    onProgress,
    onDone: () => onArrived(),
  });
}

/**
 * Determine if an element should be lost given a loss rate percentage.
 * Example: shouldLose(true, 30) ~30% chance; shouldLose(true, 30/2) ~15%.
 */
export function shouldLose(lossRatePercent: number): boolean {
  return Math.random() * 100 < lossRatePercent;
}

// ======= Physical layer animation helpers =======

export interface TransmissionAnimationOptions {
  durationMs: number;
  onProgress: (percentage: number) => void;
  onComplete: () => void;
}

/**
 * Start a smooth transmission bar animation
 */
export function startTransmissionAnimation(
  options: TransmissionAnimationOptions
): () => void {
  const { durationMs, onProgress, onComplete } = options;
  return createIntervalAnimator({
    durationMs,
    tickMs: 16,
    onProgress,
    onDone: () => onComplete(),
  });
}

export interface PropagationAnimationOptions {
  delayMs: number; // delay before starting
  durationMs: number;
  onProgress: (percentage: number) => void;
  onComplete: () => void;
}

/**
 * Start a propagation signal animation with delay
 */
export function startPropagationAnimation(
  options: PropagationAnimationOptions
): () => void {
  const { delayMs, durationMs, onProgress, onComplete } = options;
  let cancelled = false;
  let cancelInner: (() => void) | null = null;
  const timeoutId = setTimeout(() => {
    if (cancelled) return;
    cancelInner = createIntervalAnimator({
      durationMs,
      tickMs: 16,
      onProgress,
      onDone: () => onComplete(),
    });
  }, delayMs);
  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
    cancelInner?.();
  };
}

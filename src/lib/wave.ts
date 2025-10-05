// Generic bidirectional wave propagation helpers extracted from CSMA/CD simulation.
// A wave originates at position x0 (km) on a linear medium of length L (km) at startMs.
// It expands left and right at speed v (km/s) for durationMs, after which trailing edges follow.
// If abortedAtMs is provided (< startMs + durationMs), duration is clamped for trailing computation.

export interface WaveDescriptor {
  startMs: number; // wave start (sim ms)
  durationMs: number; // intended duration (ms)
  originKm: number; // origin position x0 (km)
  abortedAtMs?: number; // optional early abort moment (ms)
  type?: string; // opaque label (data, jam, etc.)
  originId?: number; // identifier for grouping (e.g., stationId)
}

export interface WaveSegment {
  startKm: number;
  endKm: number;
  type?: string;
  originId?: number;
}

export interface WaveComputationParams extends WaveDescriptor {
  simNowMs: number; // current simulated time (ms)
  mediumLengthKm: number; // L (km)
  propagationSpeedKmPerSec: number; // v (km/s)
}

export interface WaveSegmentsResult {
  segments: WaveSegment[]; // zero, one (if collapsed) or two segments (left/right)
  active: boolean; // true if wave is still active (any front or trail on medium)
  finished: boolean; // true once both trailing edges have exited medium
  // Additional useful geometry values if needed by caller
  leadLeftKm: number;
  leadRightKm: number;
  trailLeftKm: number;
  trailRightKm: number;
}

function emptyResult(finished: boolean): WaveSegmentsResult {
  return {
    segments: [],
    active: !finished,
    finished,
    leadLeftKm: 0,
    leadRightKm: 0,
    trailLeftKm: 0,
    trailRightKm: 0,
  };
}

// Compute the active segments of a single bidirectional wave at simNowMs.
export function computeBidirectionalWaveSegments(
  p: WaveComputationParams
): WaveSegmentsResult {
  const {
    startMs,
    durationMs,
    abortedAtMs,
    originKm: x0,
    simNowMs,
    mediumLengthKm: L,
    propagationSpeedKmPerSec: v,
    type,
    originId,
  } = p;

  const toSec = (ms: number) => ms / 1000;
  const tRel = simNowMs - startMs;
  if (tRel < 0) {
    return emptyResult(false); // not yet started
  }

  const effectiveEnd = abortedAtMs ?? startMs + durationMs;
  const dur = Math.max(0, Math.min(durationMs, effectiveEnd - startMs));

  // Distances to each end from origin
  const maxToLeft = x0;
  const maxToRight = L - x0;
  const totalFinishSec = toSec(dur) + Math.max(maxToLeft, maxToRight) / v;
  if (tRel / 1000 > totalFinishSec) {
    return emptyResult(true); // finished
  }

  // Leading fronts
  const leadDist = Math.min(v * toSec(tRel), L);
  const leadRightKm = Math.min(x0 + leadDist, L);
  const leadLeftKm = Math.max(x0 - leadDist, 0);

  // Trailing fronts (after dur)
  const tRelAfter = tRel - dur;
  let trailRightKm = x0;
  let trailLeftKm = x0;
  if (tRelAfter > 0) {
    const trailDist = Math.min(v * toSec(tRelAfter), L);
    trailRightKm = Math.min(x0 + trailDist, L);
    trailLeftKm = Math.max(x0 - trailDist, 0);
  }

  const segments: WaveSegment[] = [];
  if (trailRightKm < leadRightKm) {
    segments.push({
      startKm: trailRightKm,
      endKm: leadRightKm,
      type,
      originId,
    });
  }
  if (leadLeftKm < trailLeftKm) {
    segments.push({ startKm: leadLeftKm, endKm: trailLeftKm, type, originId });
  }

  return {
    segments,
    active: true,
    finished: false,
    leadLeftKm,
    leadRightKm,
    trailLeftKm,
    trailRightKm,
  };
}

// (emptyResult moved above for lint rule ordering)

// Convenience: determine if wave would be finished at simNowMs without needing result object.
export function isWaveFinished(p: WaveComputationParams): boolean {
  return computeBidirectionalWaveSegments(p).finished;
}

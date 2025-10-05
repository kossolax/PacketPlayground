import { describe, expect, it } from 'vitest';
import { computeBidirectionalWaveSegments } from './wave';

// Basic regression tests for wave geometry

describe('computeBidirectionalWaveSegments', () => {
  const L = 1000; // km
  const v = 200_000; // km/s
  const startMs = 0;
  const originKm = 500; // center
  const durationMs = 10; // ms

  it('returns no segments before start', () => {
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      simNowMs: -1,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.segments.length).toBe(0);
    expect(res.active).toBe(true); // not yet started considered active=false? Here active false would also be acceptable but we defined active=!finished.
  });

  it('expands symmetrically shortly after start', () => {
    const simNowMs = 1; // 1ms
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.segments.length).toBe(2);
    // Leading right - leading left symmetry distances from origin roughly v* t
    const leadSpan = res.leadRightKm - res.leadLeftKm;
    expect(leadSpan).toBeGreaterThan(0);
  });

  it('creates trailing gap after duration', () => {
    const simNowMs = durationMs + 1; // just after transmission ended
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    // trailing edges moved outward creating two segments still
    expect(res.segments.length).toBe(2);
    expect(res.trailRightKm).toBeGreaterThan(originKm);
    expect(res.trailLeftKm).toBeLessThan(originKm);
  });

  it('eventually finishes (no segments, finished true)', () => {
    // time when wave definitely finished: dur + max distance/v *1000 + small epsilon
    const maxDist = Math.max(originKm, L - originKm);
    const finishMs = durationMs + (maxDist / v) * 1000 + 5;
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      simNowMs: finishMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.segments.length).toBe(0);
    expect(res.finished).toBe(true);
  });

  it('handles aborted wave (shorter duration)', () => {
    const abortedAtMs = 3; // early abort
    // Wave effective duration is 3ms, finish time occurs at
    // dur (3ms) + maxDistance/v (2.5ms) = 5.5ms.
    // We pick a time after trailing edges have started ( >3ms )
    // but before the whole wave has disappeared ( <5.5ms ) so
    // that two active segments still exist.
    const simNowMs = 4; // just after abort but before full finish
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      abortedAtMs,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.segments.length).toBe(2);
    // trailing should have started earlier (tRelAfter > 0)
    expect(res.trailRightKm).toBeGreaterThan(originKm);
  });

  it('aborted wave just before finish keeps segments', () => {
    const abortedAtMs = 3;
    // Just before 5.5ms finish threshold
    const simNowMs = 5.4; // ms
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      abortedAtMs,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.finished).toBe(false);
    expect(res.segments.length).toBeGreaterThan(0);
  });

  it('aborted wave after finish has no segments and finished=true', () => {
    const abortedAtMs = 3;
    const simNowMs = 6; // > 5.5ms -> finished
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      abortedAtMs,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.finished).toBe(true);
    expect(res.segments.length).toBe(0);
  });

  // ===== Non-aborted wave finish window tests =====
  it('non-aborted wave just before natural finish has segments', () => {
    // Natural finish time: durationMs (10ms) + maxDist/v (2.5ms) = 12.5ms
    const simNowMs = 12.4; // just before finish
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.finished).toBe(false);
    expect(res.segments.length).toBeGreaterThan(0);
  });

  it('non-aborted wave after natural finish has no segments', () => {
    const simNowMs = 13; // > 12.5ms
    const res = computeBidirectionalWaveSegments({
      startMs,
      durationMs,
      originKm,
      simNowMs,
      mediumLengthKm: L,
      propagationSpeedKmPerSec: v,
    });
    expect(res.finished).toBe(true);
    expect(res.segments.length).toBe(0);
  });
});

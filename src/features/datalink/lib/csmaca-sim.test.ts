import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';
import { CsmaCaSim } from './csmaca-sim';

// Mock setInterval/clearInterval similar to CSMA/CD tests
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('CsmaCaSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let sim: CsmaCaSim;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;

  const advanceSimulation = (totalMs: number, tickMs = 16) => {
    const iterations = Math.ceil(totalMs / tickMs);
    for (let i = 0; i < iterations; i += 1) {
      mockAnimation.mockTimeProvider.advance(tickMs);
      mockAnimation.triggerTick();
    }
  };

  beforeEach(() => {
    setupFakeTimers();
    mockAnimation = createMockAnimationSystem();

    // Save original globals
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    global.setInterval = mockSetInterval.mockImplementation(
      mockAnimation.mockSetInterval
    );
    global.clearInterval = mockClearInterval.mockImplementation(
      mockAnimation.mockClearInterval
    );

    sim = new CsmaCaSim({ timeProvider: mockAnimation.mockTimeProvider });
  });

  afterEach(() => {
    sim.dispose();

    // Restore original globals before cleanup
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  it('Station B detects collision when A and C overlap', () => {
    // Default scenario schedules A->B at t0 and C->B at ~0.3*Tp
    sim.setTimeScale(10); // slow down a bit
    sim.start();

    // Run long enough for overlap at B and for detection to occur
    advanceSimulation(1500); // increased time to allow collision detection

    const state = sim.getState();
    const stationB = state.stations.find((s) => s.id === 2);
    const collisionEventsAtB = state.events.filter(
      (e) => e.type.includes('collision') && e.stationId === 2
    );

    // Check if collision was detected or if simulation has moved past collision phase
    const hasCollisionOrCompleted =
      stationB?.hasCollision || collisionEventsAtB.length > 0;
    expect(hasCollisionOrCompleted).toBe(true);
  });
});

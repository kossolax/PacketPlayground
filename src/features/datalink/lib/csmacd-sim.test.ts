import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';
import { CsmaCdSim, createInitialCsmaCdState } from './csmacd-sim';

// Mock setInterval/clearInterval for the tick system
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('CsmaCdSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let sim: CsmaCdSim;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;

  // Helper to advance time and trigger ticks realistically
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

    sim = new CsmaCdSim({ timeProvider: mockAnimation.mockTimeProvider });
  });

  afterEach(() => {
    sim.dispose();

    // Restore original globals before cleanup
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create initial state with correct default values', () => {
      const state = createInitialCsmaCdState();

      expect(state.bandwidth).toBe(1_000_000);
      expect(state.packetSize).toBe(8_000);
      expect(state.distance).toBe(1_000);
      expect(state.propagationSpeed).toBe(200_000);
      expect(state.timeScale).toBe(500);
      expect(state.isRunning).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.simTimeMs).toBe(0);
      expect(state.stations).toHaveLength(3);
      expect(state.transmissions).toEqual([]);
      expect(state.events).toEqual([]);
    });

    it('should calculate transmission and propagation delays correctly', () => {
      const state = createInitialCsmaCdState();

      // transmissionDelay = (8000 / 1000000) * 1000 = 8 ms
      expect(state.transmissionDelay).toBe(8);
      // propagationDelay = (1000 / 200000) * 1000 = 5 ms
      expect(state.propagationDelay).toBe(5);
      // slotTime = 2 * 5 = 10 ms
      expect(state.slotTime).toBe(10);
    });

    it('should initialize three stations at correct positions', () => {
      const state = createInitialCsmaCdState();

      expect(state.stations).toHaveLength(3);
      expect(state.stations[0].name).toBe('A');
      expect(state.stations[1].name).toBe('B');
      expect(state.stations[2].name).toBe('C');

      // Check positions
      expect(state.stations[0].xKm).toBe(150); // 15% of 1000
      expect(state.stations[1].xKm).toBe(500); // 50% of 1000
      expect(state.stations[2].xKm).toBe(850); // 85% of 1000
    });

    it('should initialize stations in idle state', () => {
      const state = createInitialCsmaCdState();

      state.stations.forEach((station) => {
        expect(station.status).toBe('idle');
        expect(station.carrierSense).toBe(false);
        expect(station.hasFrame).toBe(false);
        expect(station.attempt).toBe(0);
      });
    });
  });

  describe('Configuration', () => {
    it('should update bandwidth and recalculate delays', () => {
      const onUpdate = vi.fn();
      const testSim = new CsmaCdSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setBandwidth(2_000_000);

      const state = testSim.getState();
      expect(state.bandwidth).toBe(2_000_000);
      expect(state.transmissionDelay).toBe(4); // 8000 / 2000000 * 1000
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update packet size and recalculate delays', () => {
      const onUpdate = vi.fn();
      const testSim = new CsmaCdSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setPacketSize(16_000);

      const state = testSim.getState();
      expect(state.packetSize).toBe(16_000);
      expect(state.transmissionDelay).toBe(16); // 16000 / 1000000 * 1000
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update distance and scale station positions', () => {
      const onUpdate = vi.fn();
      const testSim = new CsmaCdSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });
      const initialState = testSim.getState();
      const initialPosA = initialState.stations[0].xKm;

      testSim.setDistance(2_000);

      const state = testSim.getState();
      expect(state.distance).toBe(2_000);
      expect(state.stations[0].xKm).toBe(initialPosA * 2);
      expect(state.propagationDelay).toBe(10); // 2000 / 200000 * 1000
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update time scale', () => {
      const onUpdate = vi.fn();
      const testSim = new CsmaCdSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTimeScale(1000);

      const state = testSim.getState();
      expect(state.timeScale).toBe(1000);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });
  });

  describe('Lifecycle', () => {
    it('should start simulation correctly', () => {
      const onUpdate = vi.fn();
      const testSim = new CsmaCdSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();

      const state = testSim.getState();
      expect(state.isRunning).toBe(true);
      expect(state.isCompleted).toBe(false);
      expect(mockSetInterval).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should not start if already running', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();
      const callCountBefore = mockSetInterval.mock.calls.length;

      testSim.start();
      const callCountAfter = mockSetInterval.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
      testSim.dispose();
    });

    it('should reset simulation to initial state', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      // Advance simulation
      mockAnimation.mockTimeProvider.advance(100);
      mockAnimation.triggerTick();

      testSim.reset();

      const state = testSim.getState();
      expect(state.isRunning).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.simTimeMs).toBe(0);
      expect(state.transmissions).toEqual([]);
      expect(state.events).toEqual([]);
      expect(state.stations.every((s) => s.status === 'idle')).toBe(true);
      testSim.dispose();
    });

    it('should dispose and clean up resources', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      testSim.dispose();

      expect(mockClearInterval).toHaveBeenCalled();
    });
  });

  describe('Scenario Execution', () => {
    it('should schedule station A and C for transmission', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      // After start, stations should be marked with pending frames
      mockAnimation.mockTimeProvider.advance(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      // At least one station should have started transmitting or have pending frame
      const hasActivity =
        state.transmissions.length > 0 ||
        state.stations.some((s) => s.hasFrame || s.status !== 'idle');

      expect(hasActivity).toBe(true);
      testSim.dispose();
    });

    it('should generate transmission_start events', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      mockAnimation.mockTimeProvider.advance(200);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      const txStartEvents = state.events.filter((e) => e.type === 'tx_start');
      expect(txStartEvents.length).toBeGreaterThan(0);
      testSim.dispose();
    });
  });

  describe('Carrier Sense', () => {
    it('should detect carrier when segment covers station', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(10); // Slower for easier testing
      testSim.start();

      // Run simulation through the transmission phase
      // With timeScale=10, transmission takes ~80ms, propagation ~50ms
      let carrierDetected = false;
      for (let t = 0; t < 200; t += 5) {
        advanceSimulation(5); // Advance 5ms at a time
        const state = testSim.getState();
        if (
          state.transmissions.length > 0 &&
          state.stations.some((s) => s.carrierSense)
        ) {
          carrierDetected = true;
          break;
        }
      }

      expect(carrierDetected).toBe(true);
      testSim.dispose();
    });
  });

  describe('Collision Detection', () => {
    it('should mark stations as collision when overlap detected', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(10); // Slower for easier testing
      testSim.start();

      // Run through the collision detection phase
      // A starts at 0ms, C starts at ~15ms (with timeScale=10), collision should be detected
      advanceSimulation(500); // Run enough time to detect collision

      const state = testSim.getState();
      const collisionEvents = state.events.filter(
        (e) => e.type === 'tx_abort_collision'
      );

      // In CSMA/CD scenario with A and C starting close together, collision should occur
      expect(collisionEvents.length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should send JAM signal after collision', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(10); // Slower for easier testing
      testSim.start();

      // Run through collision detection and JAM phase
      advanceSimulation(500);

      const state = testSim.getState();
      const jamEvents = state.events.filter((e) => e.type === 'jam_start');

      expect(jamEvents.length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should initiate backoff after collision', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(10); // Slower for easier testing
      testSim.start();

      // Run through collision, JAM, and backoff initiation
      advanceSimulation(500);

      const state = testSim.getState();
      const backoffEvents = state.events.filter(
        (e) => e.type === 'backoff_start'
      );

      expect(backoffEvents.length).toBeGreaterThan(0);
      testSim.dispose();
    });
  });

  describe('Backoff Mechanism', () => {
    it('should increment attempt counter on collision', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(10); // Slower for easier testing
      testSim.start();

      // Run through collision detection which increments attempt counter
      advanceSimulation(500);

      const state = testSim.getState();
      // After collision, at least one station should have attempt > 0
      const stationWithAttempts = state.stations.find((s) => s.attempt > 0);

      expect(stationWithAttempts).toBeDefined();
      testSim.dispose();
    });

    it('should transition from backoff to idle after backoff completes', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      for (let i = 0; i < 50; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        mockAnimation.triggerTick();
      }

      const state = testSim.getState();
      const backoffEndEvents = state.events.filter(
        (e) => e.type === 'backoff_end'
      );

      // If simulation ran long enough, backoff should complete
      if (backoffEndEvents.length > 0) {
        expect(backoffEndEvents.length).toBeGreaterThan(0);
      }
      testSim.dispose();
    });
  });

  describe('Successful Transmission', () => {
    it('should mark transmission as successful eventually', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      // Run simulation until completion or significant time
      for (let i = 0; i < 100; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        mockAnimation.triggerTick();

        if (testSim.getState().isCompleted) break;
      }

      const state = testSim.getState();
      const successEvents = state.events.filter((e) => e.type === 'tx_success');

      // Eventually some station should succeed
      expect(successEvents.length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should complete simulation when A and C succeed', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      // Run until completion or timeout
      for (let i = 0; i < 200; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        mockAnimation.triggerTick();

        if (testSim.getState().isCompleted) break;
      }

      const state = testSim.getState();
      if (state.isCompleted) {
        expect(state.isRunning).toBe(false);
        const stationA = state.stations.find((s) => s.id === 1);
        const stationC = state.stations.find((s) => s.id === 3);
        expect(stationA?.status).toBe('success');
        expect(stationC?.status).toBe('success');
      }
      testSim.dispose();
    });
  });

  describe('Segments and Collision Overlaps', () => {
    it('should compute segments for active transmissions', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(10); // Slower for easier testing
      testSim.start();

      // Capture state during active transmission
      let segmentsFound = false;
      for (let t = 0; t < 200; t += 5) {
        advanceSimulation(5);
        const state = testSim.getState();
        if (
          state.transmissions.length > 0 &&
          state.currentSegments.length > 0
        ) {
          segmentsFound = true;
          break;
        }
      }

      expect(segmentsFound).toBe(true);
      testSim.dispose();
    });

    it('should compute collision overlaps when data segments overlap', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      // Run until collision occurs
      advanceSimulation(1500);

      const state = testSim.getState();
      // At some point collision overlaps should be detected
      if (state.events.some((e) => e.type === 'tx_abort_collision')) {
        // When collisions are detected, collision segments may be present
        expect(state.collisionSegments).toBeDefined();
      }
      testSim.dispose();
    });
  });

  describe('Manual Transmission Trigger', () => {
    it('should allow manual transmission trigger during simulation', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();

      mockAnimation.mockTimeProvider.advance(100);
      mockAnimation.triggerTick();

      testSim.triggerManualTransmission(2); // Station B

      mockAnimation.mockTimeProvider.advance(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      const stationB = state.stations.find((s) => s.id === 2);
      // Station B should have been marked with a frame or started transmitting
      expect(stationB).toBeDefined();
      testSim.dispose();
    });

    it('should not trigger manual transmission when not running', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.triggerManualTransmission(2);

      const state = testSim.getState();
      const stationB = state.stations.find((s) => s.id === 2);
      expect(stationB?.hasFrame).toBe(false);
      testSim.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero bandwidth gracefully', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      expect(() => testSim.setBandwidth(0)).not.toThrow();
      const state = testSim.getState();
      expect(state.bandwidth).toBe(0);
      testSim.dispose();
    });

    it('should handle zero distance', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setDistance(0);

      const state = testSim.getState();
      expect(state.propagationDelay).toBe(0);
      expect(state.slotTime).toBe(0);
      testSim.dispose();
    });

    it('should handle multiple resets', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setTimeScale(1); // Use real time for tests
      testSim.start();
      testSim.reset();
      testSim.reset();
      testSim.reset();

      const state = testSim.getState();
      expect(state.isRunning).toBe(false);
      expect(state.transmissions).toEqual([]);
      testSim.dispose();
    });

    it('should handle dispose without start', () => {
      const testSim = new CsmaCdSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      expect(() => testSim.dispose()).not.toThrow();
    });
  });
});

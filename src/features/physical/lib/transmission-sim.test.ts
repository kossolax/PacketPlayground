import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  SimulationTestHarness,
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';
import {
  TransmissionSim,
  createInitialTransmissionState,
} from './transmission-sim';

// Mock the animation module
vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

describe('TransmissionSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let harness: SimulationTestHarness<
    ReturnType<typeof createInitialTransmissionState>
  >;

  beforeEach(() => {
    setupFakeTimers();
    mockAnimation = createMockAnimationSystem();

    vi.mocked(animationModule.startFlightAnimation).mockImplementation(
      mockAnimation.mockStartFlightAnimation
    );

    harness = new SimulationTestHarness(TransmissionSim, mockAnimation);
  });

  afterEach(() => {
    harness.dispose();
    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create initial state with correct default values', () => {
      const state = createInitialTransmissionState();

      expect(state.bandwidth).toBe(1_000_000); // 1 Mbps
      expect(state.packetSize).toBe(8_000); // 1 KB
      expect(state.distance).toBe(1_000); // 1000 km
      expect(state.propagationSpeed).toBe(200_000); // 2/3 c
      expect(state.timeScale).toBe(100);
      expect(state.isRunning).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.events).toEqual([]);
    });

    it('should calculate transmission and propagation delays correctly', () => {
      const state = createInitialTransmissionState();

      // transmissionDelay = (8000 bits / 1000000 bps) * 1000 = 8 ms
      expect(state.transmissionDelay).toBe(8);
      // propagationDelay = (1000 km / 200000 km/s) * 1000 = 5 ms
      expect(state.propagationDelay).toBe(5);
    });

    it('should create simulation with onUpdate callback', () => {
      const onUpdate = vi.fn();
      const sim = new TransmissionSim({ onUpdate });

      sim.start();
      expect(onUpdate).toHaveBeenCalled();
      sim.dispose();
    });

    it('should create simulation without onUpdate callback', () => {
      const sim = new TransmissionSim({});
      expect(() => sim.start()).not.toThrow();
      sim.dispose();
    });
  });

  describe('Configuration', () => {
    it('should update bandwidth and recalculate transmission delay', () => {
      const sim = harness.getSimulation() as TransmissionSim;
      harness.clearEmittedStates();

      sim.setBandwidth(2_000_000); // 2 Mbps

      const state = harness.getState();
      expect(state.bandwidth).toBe(2_000_000);
      // transmissionDelay = (8000 / 2000000) * 1000 = 4 ms
      expect(state.transmissionDelay).toBe(4);
      harness.expectEmitted();
    });

    it('should update packet size and recalculate transmission delay', () => {
      const sim = harness.getSimulation() as TransmissionSim;
      harness.clearEmittedStates();

      sim.setPacketSize(16_000); // 2 KB

      const state = harness.getState();
      expect(state.packetSize).toBe(16_000);
      // transmissionDelay = (16000 / 1000000) * 1000 = 16 ms
      expect(state.transmissionDelay).toBe(16);
      harness.expectEmitted();
    });

    it('should update distance and recalculate propagation delay', () => {
      const sim = harness.getSimulation() as TransmissionSim;
      harness.clearEmittedStates();

      sim.setDistance(2_000); // 2000 km

      const state = harness.getState();
      expect(state.distance).toBe(2_000);
      // propagationDelay = (2000 / 200000) * 1000 = 10 ms
      expect(state.propagationDelay).toBe(10);
      harness.expectEmitted();
    });

    it('should update time scale', () => {
      const sim = harness.getSimulation() as TransmissionSim;
      harness.clearEmittedStates();

      sim.setTimeScale(200);

      const state = harness.getState();
      expect(state.timeScale).toBe(200);
      harness.expectEmitted();
    });
  });

  describe('Lifecycle', () => {
    it('should start simulation correctly', () => {
      harness.clearEmittedStates();
      harness.start();

      const state = harness.getState();
      expect(state.isRunning).toBe(true);
      expect(state.progress).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.events).toHaveLength(1);
      expect(state.events[0].type).toBe('transmission_start');
      harness.expectEmitted();
    });

    it('should not start if already running', () => {
      harness.start();
      const callCountBefore =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      harness.start();
      const callCountAfter =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
    });

    it('should reset simulation to initial state', () => {
      harness.start();
      harness.advanceAnimationProgress(50);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.events).toEqual([]);
    });

    it('should dispose and clean up resources', () => {
      harness.start();
      const cancelFn = mockAnimation.cancelFunctions[0];

      harness.dispose();

      expect(cancelFn).toHaveBeenCalled();
    });
  });

  describe('Simulation Logic', () => {
    it('should update progress during animation', () => {
      harness.start();
      harness.clearEmittedStates();

      harness.advanceAnimationProgress(25);

      const state = harness.getState();
      expect(state.progress).toBe(25);
      harness.expectEmitted();
    });

    it('should add transmission_end event at 50% progress', () => {
      harness.start();

      harness.advanceAnimationProgress(50);

      const state = harness.getState();
      const endEvent = state.events.find((e) => e.type === 'transmission_end');
      expect(endEvent).toBeDefined();
      expect(endEvent?.description).toBe('First bit reaches receiver');
    });

    it('should not duplicate transmission_end event', () => {
      harness.start();

      harness.advanceAnimationProgress(50);
      harness.advanceAnimationProgress(60);
      harness.advanceAnimationProgress(70);

      const state = harness.getState();
      const endEvents = state.events.filter(
        (e) => e.type === 'transmission_end'
      );
      expect(endEvents).toHaveLength(1);
    });

    it('should complete simulation at 100% progress', () => {
      harness.start();

      harness.completeAnimation();

      const state = harness.getState();
      expect(state.progress).toBe(100);
      expect(state.isCompleted).toBe(true);
      expect(state.isRunning).toBe(false);

      const completeEvent = state.events.find(
        (e) => e.type === 'propagation_end'
      );
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.description).toBe(
        'Last bit received - packet complete'
      );
    });

    it('should generate correct timeline events sequence', () => {
      harness.start();
      harness.advanceAnimationProgress(50);
      harness.completeAnimation();

      const state = harness.getState();
      expect(state.events).toHaveLength(3);
      expect(state.events[0].type).toBe('transmission_start');
      expect(state.events[1].type).toBe('transmission_end');
      expect(state.events[2].type).toBe('propagation_end');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero bandwidth gracefully', () => {
      const sim = harness.getSimulation() as TransmissionSim;

      expect(() => sim.setBandwidth(0)).not.toThrow();
      const state = harness.getState();
      expect(state.bandwidth).toBe(0);
      // transmissionDelay calculation should complete without error
      expect(state.transmissionDelay).toBeDefined();
    });

    it('should handle zero distance', () => {
      const sim = harness.getSimulation() as TransmissionSim;

      sim.setDistance(0);

      const state = harness.getState();
      expect(state.propagationDelay).toBe(0);
    });

    it('should handle very small time scale', () => {
      const sim = harness.getSimulation() as TransmissionSim;

      sim.setTimeScale(0.1);

      const state = harness.getState();
      expect(state.timeScale).toBe(0.1);
    });

    it('should handle multiple resets', () => {
      harness.start();
      harness.reset();
      harness.reset();
      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.progress).toBe(0);
    });

    it('should handle dispose without start', () => {
      expect(() => harness.dispose()).not.toThrow();
    });

    it('should handle progress updates before start', () => {
      expect(() => harness.advanceAnimationProgress(50)).not.toThrow();
    });
  });
});

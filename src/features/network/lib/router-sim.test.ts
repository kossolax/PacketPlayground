import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  SimulationTestHarness,
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers.test';
import { RouterSim, createInitialRouterState } from './router-sim';

vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

describe('RouterSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let harness: SimulationTestHarness<
    ReturnType<typeof createInitialRouterState>
  >;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;

  beforeEach(() => {
    setupFakeTimers();
    mockAnimation = createMockAnimationSystem();

    // Save original globals
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    // Mock setInterval/clearInterval for the timer system
    global.setInterval = vi
      .fn()
      .mockImplementation(mockAnimation.mockSetInterval);

    global.clearInterval = vi
      .fn()
      .mockImplementation(mockAnimation.mockClearInterval);

    vi.mocked(animationModule.startFlightAnimation).mockImplementation(
      mockAnimation.mockStartFlightAnimation
    );

    harness = new SimulationTestHarness(RouterSim, mockAnimation);
  });

  afterEach(() => {
    harness.dispose();

    // Restore original globals before cleanup
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create initial state with correct default values', () => {
      const state = createInitialRouterState();

      expect(state.inputRate).toBe(3);
      expect(state.outputRate).toBe(3);
      expect(state.switchingFabricSpeed).toBe(5);
      expect(state.inputQueueSize).toBe(5);
      expect(state.outputQueueSize).toBe(5);
      expect(state.timeScale).toBe(1);
      expect(state.isRunning).toBe(false);
      expect(state.inputQueue).toEqual([]);
      expect(state.outputQueue).toEqual([]);
      expect(state.droppedPackets).toEqual([]);
      expect(state.packetsGenerated).toBe(0);
      expect(state.packetsProcessed).toBe(0);
      expect(state.packetsDropped).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update input rate', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.clearEmittedStates();

      sim.setInputRate(5);

      const state = harness.getState();
      expect(state.inputRate).toBe(5);
      harness.expectEmitted();
    });

    it('should update output rate', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.clearEmittedStates();

      sim.setOutputRate(4);

      const state = harness.getState();
      expect(state.outputRate).toBe(4);
      harness.expectEmitted();
    });

    it('should update switching fabric speed', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.clearEmittedStates();

      sim.setSwitchingFabricSpeed(10);

      const state = harness.getState();
      expect(state.switchingFabricSpeed).toBe(10);
      harness.expectEmitted();
    });

    it('should update input queue size', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.clearEmittedStates();

      sim.setInputQueueSize(10);

      const state = harness.getState();
      expect(state.inputQueueSize).toBe(10);
      harness.expectEmitted();
    });

    it('should update output queue size', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.clearEmittedStates();

      sim.setOutputQueueSize(10);

      const state = harness.getState();
      expect(state.outputQueueSize).toBe(10);
      harness.expectEmitted();
    });

    it('should update time scale', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.clearEmittedStates();

      sim.setTimeScale(2);

      const state = harness.getState();
      expect(state.timeScale).toBe(2);
      harness.expectEmitted();
    });
  });

  describe('Queue Size Management', () => {
    it('should trim input queue when size is reduced', () => {
      const sim = harness.getSimulation() as RouterSim;

      // Manually populate input queue
      sim.start();
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(500);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      // Reduce queue size
      sim.setInputQueueSize(2);

      const state = harness.getState();
      expect(state.inputQueue.length).toBeLessThanOrEqual(2);
    });

    it('should count dropped packets when input queue is trimmed', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(500);

        harness.advanceAnimationProgress(10);
      }

      const beforeDropped = harness.getState().packetsDropped;

      sim.setInputQueueSize(1);

      const state = harness.getState();
      expect(state.packetsDropped).toBeGreaterThanOrEqual(beforeDropped);
    });

    it('should trim output queue when size is reduced', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.start();

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.mockTimeProvider.advance(300);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      sim.setOutputQueueSize(2);

      const state = harness.getState();
      expect(state.outputQueue.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Lifecycle', () => {
    it('should start simulation correctly', () => {
      harness.clearEmittedStates();
      harness.start();

      const state = harness.getState();
      expect(state.isRunning).toBe(true);
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
      mockAnimation.mockTimeProvider.advance(1000);
      harness.triggerMultipleTicks(5);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.inputQueue).toEqual([]);
      expect(state.outputQueue).toEqual([]);
      expect(state.droppedPackets).toEqual([]);
      expect(state.packetsGenerated).toBe(0);
      expect(state.packetsProcessed).toBe(0);
      expect(state.packetsDropped).toBe(0);
    });

    it('should dispose and clean up resources', () => {
      harness.start();
      const cancelFn = mockAnimation.cancelFunctions[0];

      harness.dispose();

      expect(cancelFn).toHaveBeenCalled();
    });
  });

  describe('Packet Generation', () => {
    it('should generate packets based on input rate', () => {
      harness.start();

      // Advance time to let packets generate, then trigger animation tick
      for (let i = 0; i < 5; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsGenerated).toBeGreaterThan(0);
    });

    it('should add packets to input queue', () => {
      harness.start();

      // With inputRate=3, we need ~333ms per packet
      // Advance time to 1000ms to ensure packets are generated
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      // Packets may have been moved to output queue or processed, so check total generated
      const totalPackets =
        state.inputQueue.length +
        state.outputQueue.length +
        state.packetsProcessed;
      expect(totalPackets).toBeGreaterThan(0);
    });

    it('should assign unique IDs to packets', () => {
      harness.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      const ids = state.inputQueue.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should drop packets when input queue is full', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputQueueSize(2);
      sim.setSwitchingFabricSpeed(0.5); // Slow switching to fill input queue
      harness.start();

      // Generate many packets faster than they can be switched
      for (let i = 0; i < 25; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.inputQueue.length).toBeLessThanOrEqual(2);
      expect(state.packetsDropped).toBeGreaterThan(0);
    });

    it('should not generate packets when input rate is zero', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputRate(0);
      harness.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsGenerated).toBe(0);
    });
  });

  describe('Switching Fabric', () => {
    it('should transfer packets from input to output queue', () => {
      const sim = harness.getSimulation() as RouterSim;
      // Slow down switching to see packets in input queue
      sim.setSwitchingFabricSpeed(1); // 1 packet per second
      sim.setOutputRate(0.1); // Very slow output to keep packets visible
      harness.start();

      // Generate packets faster than they can be switched
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const beforeState = harness.getState();
      // Check that packets were generated and some are in input queue
      expect(beforeState.packetsGenerated).toBeGreaterThan(0);

      // Let switching fabric process
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      // Check that packets have been transferred to output queue
      expect(state.outputQueue.length).toBeGreaterThan(0);
    });

    it('should respect switching fabric speed', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setSwitchingFabricSpeed(1); // 1 packet per second
      sim.setOutputRate(0.5); // Slow output to keep packets in output queue
      harness.start();

      for (let i = 0; i < 3; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const beforeState = harness.getState();
      const beforeTotal =
        beforeState.outputQueue.length + beforeState.packetsProcessed;

      for (let i = 0; i < 5; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const afterState = harness.getState();
      const afterTotal =
        afterState.outputQueue.length + afterState.packetsProcessed;
      expect(afterTotal).toBeGreaterThan(beforeTotal);
    });

    it('should not process when input queue is empty', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputRate(0); // No packet generation
      harness.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.outputQueue.length).toBe(0);
    });

    it('should not transfer when output queue is full', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setOutputQueueSize(1);
      harness.start();

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.outputQueue.length).toBeLessThanOrEqual(1);
    });

    it('should drop packets when output queue is full during transfer', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setOutputQueueSize(1);
      sim.setInputRate(10); // High input rate
      harness.start();

      for (let i = 0; i < 30; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsDropped).toBeGreaterThan(0);
    });
  });

  describe('Output Processing', () => {
    it('should process packets from output queue', () => {
      harness.start();

      // Fill queues
      for (let i = 0; i < 15; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const beforeProcessed = harness.getState().packetsProcessed;

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsProcessed).toBeGreaterThan(beforeProcessed);
    });

    it('should respect output rate', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setOutputRate(1); // 1 packet per second
      harness.start();

      for (let i = 0; i < 20; i += 1) {
        mockAnimation.mockTimeProvider.advance(150);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      // With limited output rate, should not process too many
      expect(state.packetsProcessed).toBeLessThan(10);
    });

    it('should not process when output queue is empty', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputRate(0); // No generation
      harness.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsProcessed).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track packets generated correctly', () => {
      harness.start();

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsGenerated).toBeGreaterThan(0);
      expect(state.packetsGenerated).toBe(
        state.inputQueue.length +
          state.outputQueue.length +
          state.packetsProcessed +
          state.packetsDropped
      );
    });

    it('should track packets processed correctly', () => {
      harness.start();

      for (let i = 0; i < 30; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsProcessed).toBeGreaterThan(0);
    });

    it('should track packets dropped correctly', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputQueueSize(1);
      sim.setInputRate(10);
      harness.start();

      for (let i = 0; i < 20; i += 1) {
        mockAnimation.mockTimeProvider.advance(100);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsDropped).toBeGreaterThan(0);
      expect(state.droppedPackets.length).toBe(state.packetsDropped);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero input rate', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputRate(0);
      harness.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsGenerated).toBe(0);
    });

    it('should handle zero output rate', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setOutputRate(0);
      harness.start();

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsProcessed).toBe(0);
    });

    it('should handle zero switching fabric speed', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setSwitchingFabricSpeed(0);
      harness.start();

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.outputQueue.length).toBe(0);
    });

    it('should handle very high input rate', () => {
      const sim = harness.getSimulation() as RouterSim;
      sim.setInputRate(1000);
      harness.start();

      for (let i = 0; i < 5; i += 1) {
        mockAnimation.mockTimeProvider.advance(20);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      const state = harness.getState();
      expect(state.packetsGenerated).toBeGreaterThan(0);
    });

    it('should handle multiple resets', () => {
      harness.start();
      harness.reset();
      harness.reset();
      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.packetsGenerated).toBe(0);
    });

    it('should handle dispose without start', () => {
      expect(() => harness.dispose()).not.toThrow();
    });

    it('should handle time scale changes during simulation', () => {
      const sim = harness.getSimulation() as RouterSim;
      harness.start();

      for (let i = 0; i < 5; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      sim.setTimeScale(5);

      for (let i = 0; i < 5; i += 1) {
        mockAnimation.mockTimeProvider.advance(200);
        harness.triggerTick(); // Update elapsedTime
        harness.advanceAnimationProgress(10);
      }

      expect(harness.getState().timeScale).toBe(5);
    });
  });
});

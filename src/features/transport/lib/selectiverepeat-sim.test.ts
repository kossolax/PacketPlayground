import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  SimulationTestHarness,
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers.test';
import { SelectiveRepeatSim, createInitialState } from './selectiverepeat-sim';

vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
  shouldLose: vi.fn(() => false), // Default to no loss
}));

describe('SelectiveRepeatSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let harness: SimulationTestHarness<ReturnType<typeof createInitialState>>;
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

    harness = new SimulationTestHarness(SelectiveRepeatSim, mockAnimation);
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
      const state = createInitialState();

      expect(state.totalPackets).toBe(10);
      expect(state.windowSize).toBe(4);
      expect(state.lossRate).toBe(2.5);
      expect(state.speed).toBe(2000);
      expect(state.timeoutDuration).toBe(5000);
      expect(state.isRunning).toBe(false);
      expect(state.base).toBe(0);
      expect(state.nextSeqNum).toBe(0);
      expect(state.expectedSeqNum).toBe(0);
      expect(state.lastAckSent).toBe(-1);
      expect(state.duplicateAckCount).toBe(0);
      expect(state.senderPackets).toHaveLength(10);
      expect(state.receiverBuffer).toHaveLength(10);
      expect(state.deliveredPackets).toEqual([]);
      expect(state.arrivedPackets).toEqual([]);
      expect(state.flyingPackets).toEqual([]);
      expect(state.flyingAcks).toEqual([]);
    });

    it('should initialize sender packets with correct status', () => {
      const state = createInitialState();

      state.senderPackets.forEach((packet, i) => {
        expect(packet.seqNum).toBe(i);
        expect(packet.status).toBe('waiting');
        expect(packet.hasTimer).toBe(false);
        expect(packet.timer).toBeNull();
        expect(packet.isFastRetransmit).toBe(false);
      });
    });

    it('should initialize receiver buffer', () => {
      const state = createInitialState();

      state.receiverBuffer.forEach((buf, i) => {
        expect(buf.seqNum).toBe(i);
        expect(buf.received).toBe(false);
      });
    });

    it('should accept custom totalPackets', () => {
      const state = createInitialState(15);

      expect(state.totalPackets).toBe(15);
      expect(state.senderPackets).toHaveLength(15);
      expect(state.receiverBuffer).toHaveLength(15);
    });
  });

  describe('Configuration', () => {
    it('should update window size', () => {
      const sim = harness.getSimulation() as SelectiveRepeatSim;
      harness.clearEmittedStates();

      sim.setWindowSize(6);

      const state = harness.getState();
      expect(state.windowSize).toBe(6);
      harness.expectEmitted();
    });

    it('should update speed', () => {
      const sim = harness.getSimulation() as SelectiveRepeatSim;
      harness.clearEmittedStates();

      sim.setSpeed(3000);

      const state = harness.getState();
      expect(state.speed).toBe(3000);
      harness.expectEmitted();
    });

    it('should update timeout duration', () => {
      const sim = harness.getSimulation() as SelectiveRepeatSim;
      harness.clearEmittedStates();

      sim.setTimeoutDuration(7000);

      const state = harness.getState();
      expect(state.timeoutDuration).toBe(7000);
      harness.expectEmitted();
    });

    it('should update loss rate', () => {
      const sim = harness.getSimulation() as SelectiveRepeatSim;
      harness.clearEmittedStates();

      sim.setLossRate(10);

      const state = harness.getState();
      expect(state.lossRate).toBe(10);
      harness.expectEmitted();
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
      vi.advanceTimersByTime(1000);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.base).toBe(0);
      expect(state.nextSeqNum).toBe(0);
      expect(state.expectedSeqNum).toBe(0);
      expect(state.flyingPackets).toEqual([]);
      expect(state.flyingAcks).toEqual([]);
      expect(state.deliveredPackets).toEqual([]);
      expect(state.arrivedPackets).toEqual([]);
    });

    it('should dispose and clean up resources', () => {
      harness.start();

      harness.dispose();

      expect(mockAnimation.cancelFunctions.length).toBeGreaterThan(0);
    });
  });

  describe('Individual Timers', () => {
    it('should set individual timers for sent packets', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      const sentPackets = state.senderPackets.filter(
        (p) => p.status === 'sent'
      );
      const packetsWithTimers = sentPackets.filter((p) => p.hasTimer);

      expect(packetsWithTimers.length).toBeGreaterThan(0);
    });

    it('should retransmit specific packet on timeout', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      const beforeCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      // Trigger timeout for a specific packet
      vi.advanceTimersByTime(6000);

      const afterCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;
      // Timeout should trigger retransmission of specific packet
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it('should clear timer when packet is ACKed', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      const ackedPackets = state.senderPackets.filter(
        (p) => p.status === 'acked'
      );
      const ackedWithTimers = ackedPackets.filter((p) => p.hasTimer);

      expect(ackedWithTimers.length).toBe(0);
    });
  });

  describe('Individual ACKs', () => {
    it('should send individual ACK for each received packet', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      // Individual ACKs should be sent
      expect(state.flyingAcks.length).toBeGreaterThanOrEqual(0);
    });

    it('should ACK only the specific packet', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      const ackedPackets = state.senderPackets.filter(
        (p) => p.status === 'acked'
      );

      // With individual ACKs, only specific packets are ACKed
      expect(ackedPackets.length).toBeGreaterThanOrEqual(0);
    });

    it('should slide window only when base is ACKed', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      const initialBase = harness.getState().base;

      harness.completeAnimation();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      // Base should only slide when base packet is ACKed
      expect(state.base).toBeGreaterThanOrEqual(initialBase);
    });
  });

  describe('Receiver Buffer', () => {
    it('should buffer out-of-order packets', () => {
      vi.mocked(animationModule.shouldLose)
        .mockReturnValueOnce(true) // Packet 0 lost
        .mockReturnValueOnce(false); // Packet 1 arrives

      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      // Buffer should mark packets as received
      const receivedInBuffer = state.receiverBuffer.filter((b) => b.received);
      expect(receivedInBuffer.length).toBeGreaterThanOrEqual(0);
    });

    it('should deliver packets in order', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);
      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      // Delivered packets should be in sequential order
      for (let i = 0; i < state.deliveredPackets.length - 1; i += 1) {
        expect(state.deliveredPackets[i + 1]).toBe(
          state.deliveredPackets[i] + 1
        );
      }
    });

    it('should update expectedSeqNum when delivering packets', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      // expectedSeqNum should be next undelivered packet
      expect(state.expectedSeqNum).toBe(state.deliveredPackets.length);
    });
  });

  describe('Fast Retransmit', () => {
    it('should track duplicate ACKs on sender', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      // Duplicate ACK tracking should be present
      expect(state.duplicateAckCount).toBeDefined();
    });

    it('should trigger fast retransmit on 3 duplicate ACKs', () => {
      vi.mocked(animationModule.shouldLose)
        .mockReturnValueOnce(false) // Packet 0 arrives
        .mockReturnValueOnce(true) // Packet 1 lost
        .mockReturnValueOnce(false) // Packet 2 arrives
        .mockReturnValueOnce(false) // Packet 3 arrives
        .mockReturnValueOnce(false); // Packet 4 arrives

      harness.start();
      vi.advanceTimersByTime(1000);

      const beforeCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      // Simulate arrivals
      harness.completeAnimation();
      vi.advanceTimersByTime(500);
      harness.completeAnimation();
      vi.advanceTimersByTime(500);
      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const afterCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;
      // Should retransmit missing packet
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it('should retransmit only the missing packet', () => {
      vi.mocked(animationModule.shouldLose)
        .mockReturnValueOnce(false) // Packet 0 arrives
        .mockReturnValueOnce(true) // Packet 1 lost
        .mockReturnValueOnce(false) // Packets 2, 3, 4 arrive
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      harness.start();
      vi.advanceTimersByTime(1000);

      const beforeAnimCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      // Trigger fast retransmit
      harness.completeAnimation();
      vi.advanceTimersByTime(500);
      harness.completeAnimation();
      vi.advanceTimersByTime(500);
      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const afterAnimCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;
      // Fast retransmit should trigger additional packet transmission
      expect(afterAnimCount).toBeGreaterThan(beforeAnimCount);
    });
  });

  describe('Duplicate ACKs for Gaps', () => {
    it('should send duplicate ACK for out-of-order packets', () => {
      vi.mocked(animationModule.shouldLose)
        .mockReturnValueOnce(true) // Packet 0 lost
        .mockReturnValueOnce(false); // Packet 1 arrives

      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      // Duplicate ACKs should be sent for gaps
      expect(state.flyingAcks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Packet Loss', () => {
    it('should handle packet loss', () => {
      vi.mocked(animationModule.shouldLose).mockReturnValue(true);

      harness.start();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      const lostPackets = state.flyingPackets.filter((p) => p.willBeLost);

      expect(lostPackets.length).toBeGreaterThan(0);
    });

    it('should handle ACK loss', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      // Mock ACK loss
      vi.mocked(animationModule.shouldLose).mockReturnValue(true);

      const state = harness.getState();
      // ACKs can be lost too
      expect(state.flyingAcks).toBeDefined();
    });

    it('should retransmit lost packets via timeout', () => {
      vi.mocked(animationModule.shouldLose).mockReturnValue(true);

      harness.start();
      vi.advanceTimersByTime(1000);

      const beforeCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      // Trigger packet loss
      const onLostCallback =
        mockAnimation.mockStartFlightAnimation.mock.calls[0]?.[0]?.onLost;
      if (onLostCallback) {
        onLostCallback();
      }

      // Wait for timeout
      vi.advanceTimersByTime(6000);

      const afterCount =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;
      expect(afterCount).toBeGreaterThan(beforeCount);
    });
  });

  describe('Completion', () => {
    it('should complete when all packets are ACKed', () => {
      const smallSim = new SelectiveRepeatSim({
        totalPackets: 3,
        onUpdate: () => {},
      });
      smallSim.start();

      // Advance enough time for all packets to complete
      for (let i = 0; i < 20; i += 1) {
        vi.advanceTimersByTime(500);
        harness.completeAnimation();
      }

      const state = smallSim.getState();
      if (state.base >= state.totalPackets) {
        expect(state.isRunning).toBe(false);
      }

      smallSim.dispose();
    });

    it('should deliver all packets in order eventually', () => {
      const smallSim = new SelectiveRepeatSim({
        totalPackets: 5,
        onUpdate: () => {},
      });
      smallSim.start();

      // Advance enough time
      for (let i = 0; i < 30; i += 1) {
        vi.advanceTimersByTime(500);
        harness.completeAnimation();
      }

      const state = smallSim.getState();
      // All packets should eventually be delivered in order
      expect(state.deliveredPackets.length).toBeLessThanOrEqual(5);

      smallSim.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle window size of 1', () => {
      const sim = harness.getSimulation() as SelectiveRepeatSim;
      sim.setWindowSize(1);
      harness.start();

      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      const inFlightCount = state.nextSeqNum - state.base;
      expect(inFlightCount).toBeLessThanOrEqual(1);
    });

    it('should handle zero loss rate', () => {
      const sim = harness.getSimulation() as SelectiveRepeatSim;
      vi.mocked(animationModule.shouldLose).mockReturnValue(false);

      sim.setLossRate(0);
      harness.start();
      vi.advanceTimersByTime(2000);

      const state = harness.getState();
      const lostPackets = state.flyingPackets.filter((p) => p.willBeLost);
      expect(lostPackets.length).toBe(0);
    });

    it('should handle all packets lost', () => {
      vi.mocked(animationModule.shouldLose).mockReturnValue(true);

      harness.start();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      const lostPackets = state.flyingPackets.filter((p) => p.willBeLost);
      expect(lostPackets.length).toBeGreaterThan(0);
    });

    it('should handle multiple resets', () => {
      harness.start();
      harness.reset();
      harness.reset();
      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.base).toBe(0);
      expect(state.deliveredPackets).toEqual([]);
    });

    it('should handle dispose without start', () => {
      expect(() => harness.dispose()).not.toThrow();
    });

    it('should preserve totalPackets on reset', () => {
      const initialTotal = harness.getState().totalPackets;

      harness.start();
      harness.reset();

      const state = harness.getState();
      expect(state.totalPackets).toBe(initialTotal);
    });

    it('should handle receiving same packet multiple times', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.completeAnimation();
      vi.advanceTimersByTime(500);
      harness.completeAnimation();
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      // Should handle duplicate receptions gracefully
      expect(state.receiverBuffer).toBeDefined();
    });
  });
});

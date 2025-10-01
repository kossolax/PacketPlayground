import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  SimulationTestHarness,
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers.test';
import { TcpFinSim, createInitialState } from './tcpfin-sim';

vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

describe('TcpFinSim', () => {
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

    harness = new SimulationTestHarness(TcpFinSim, mockAnimation);
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

      expect(state.variant).toBe('client_closes_first');
      expect(state.speed).toBe(2000);
      expect(state.timeWaitDuration).toBe(4000);
      expect(state.isRunning).toBe(false);
      expect(state.phase).toBe('waiting');
      expect(state.clientState).toBe('ESTABLISHED');
      expect(state.serverState).toBe('ESTABLISHED');
      expect(state.expectedPackets).toEqual([]);
      expect(state.sentPackets).toEqual([]);
      expect(state.flyingPackets).toEqual([]);
      expect(state.hasTimeWaitTimer).toBe(false);
      expect(state.timeWaitStartAt).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should update variant', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      harness.clearEmittedStates();

      sim.setVariant('server_closes_first');

      const state = harness.getState();
      expect(state.variant).toBe('server_closes_first');
      harness.expectEmitted();
    });

    it('should update speed', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      harness.clearEmittedStates();

      sim.setSpeed(3000);

      const state = harness.getState();
      expect(state.speed).toBe(3000);
      harness.expectEmitted();
    });

    it('should update TIME_WAIT duration', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      harness.clearEmittedStates();

      sim.setTimeWaitDuration(6000);

      const state = harness.getState();
      expect(state.timeWaitDuration).toBe(6000);
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
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.phase).toBe('waiting');
      expect(state.clientState).toBe('ESTABLISHED');
      expect(state.serverState).toBe('ESTABLISHED');
      expect(state.sentPackets).toEqual([]);
      expect(state.flyingPackets).toEqual([]);
      expect(state.hasTimeWaitTimer).toBe(false);
      expect(state.variant).toBe('server_closes_first'); // Variant preserved
    });

    it('should dispose and clean up resources', () => {
      harness.start();
      vi.advanceTimersByTime(600); // Allow animation to start

      harness.dispose();

      // If animations started, they should have cancel functions
      expect(mockAnimation.mockStartFlightAnimation).toHaveBeenCalled();
    });
  });

  describe('Client Closes First', () => {
    it('should initiate FIN from client', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.clientState).toBe('FIN_WAIT_1');
      expect(state.phase).toBe('fin1_sent');
      expect(state.sentPackets.length).toBeGreaterThan(0);
      expect(state.sentPackets[0].type).toBe('FIN');
      expect(state.sentPackets[0].from).toBe('client');
    });

    it('should transition server to CLOSE_WAIT after receiving FIN', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      // Simulate FIN arrival
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.serverState).toBe('CLOSE_WAIT');
    });

    it('should send ACK from server', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.phase).toBe('ack1_sent');
      const ackPacket = state.sentPackets.find((p) => p.type === 'ACK');
      expect(ackPacket).toBeDefined();
      expect(ackPacket?.from).toBe('server');
    });

    it('should transition client to FIN_WAIT_2 after receiving ACK', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.clientState).toBe('FIN_WAIT_2');
    });

    it('should send FIN from server and transition to LAST_ACK', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);

      const state = harness.getState();
      expect(state.serverState).toBe('LAST_ACK');
      expect(state.phase).toBe('fin2_sent');
      const finPackets = state.sentPackets.filter((p) => p.type === 'FIN');
      expect(finPackets.length).toBe(2); // Client FIN + Server FIN
    });

    it('should transition client to TIME_WAIT', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.clientState).toBe('TIME_WAIT');
      expect(state.hasTimeWaitTimer).toBe(true);
    });

    it('should transition server to CLOSED after final ACK', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete all handshake steps
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.serverState).toBe('CLOSED');
    });

    it('should complete after TIME_WAIT', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete all steps
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      // Wait for TIME_WAIT to expire
      vi.advanceTimersByTime(5000);

      const state = harness.getState();
      expect(state.clientState).toBe('CLOSED');
      expect(state.phase).toBe('completed');
      expect(state.isRunning).toBe(false);
    });
  });

  describe('Server Closes First', () => {
    it('should initiate FIN from server', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.serverState).toBe('FIN_WAIT_1');
      expect(state.phase).toBe('fin1_sent');
      expect(state.sentPackets[0].type).toBe('FIN');
      expect(state.sentPackets[0].from).toBe('server');
    });

    it('should transition client to CLOSE_WAIT after receiving FIN', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.clientState).toBe('CLOSE_WAIT');
    });

    it('should send ACK from client', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.phase).toBe('ack1_sent');
      const ackPacket = state.sentPackets.find((p) => p.type === 'ACK');
      expect(ackPacket).toBeDefined();
      expect(ackPacket?.from).toBe('client');
    });

    it('should transition server to FIN_WAIT_2 after receiving ACK', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.serverState).toBe('FIN_WAIT_2');
    });

    it('should send FIN from client and transition to LAST_ACK', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);

      const state = harness.getState();
      expect(state.clientState).toBe('LAST_ACK');
      expect(state.phase).toBe('fin2_sent');
    });

    it('should transition server to TIME_WAIT', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.serverState).toBe('TIME_WAIT');
      expect(state.hasTimeWaitTimer).toBe(true);
    });

    it('should transition client to CLOSED after final ACK', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.clientState).toBe('CLOSED');
    });

    it('should complete after TIME_WAIT', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete all steps
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      // Wait for TIME_WAIT to expire
      vi.advanceTimersByTime(5000);

      const state = harness.getState();
      expect(state.serverState).toBe('CLOSED');
      expect(state.phase).toBe('completed');
      expect(state.isRunning).toBe(false);
    });
  });

  describe('TIME_WAIT Timer', () => {
    it('should start TIME_WAIT timer', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete handshake to TIME_WAIT
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.hasTimeWaitTimer).toBe(true);
      expect(state.timeWaitStartAt).not.toBeNull();
    });

    it('should respect TIME_WAIT duration', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      sim.setTimeWaitDuration(2000);
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete to TIME_WAIT
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const beforeState = harness.getState();
      expect(beforeState.hasTimeWaitTimer).toBe(true);

      // Wait for timer
      vi.advanceTimersByTime(2500);

      const afterState = harness.getState();
      expect(afterState.hasTimeWaitTimer).toBe(false);
      expect(afterState.phase).toBe('completed');
    });

    it('should clear TIME_WAIT timer on reset', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete to TIME_WAIT
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      harness.reset();

      const state = harness.getState();
      expect(state.hasTimeWaitTimer).toBe(false);
      expect(state.timeWaitStartAt).toBeNull();
    });
  });

  describe('Packet Tracking', () => {
    it('should track sent packets', () => {
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.sentPackets.length).toBeGreaterThan(0);
    });

    it('should track flying packets', () => {
      harness.start();
      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.flyingPackets.length).toBeGreaterThan(0);
    });

    it('should remove packets after arrival', () => {
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      // Flying packets should be removed after arrival
      expect(state.flyingPackets.length).toBeLessThan(state.sentPackets.length);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple resets', () => {
      harness.start();
      harness.reset();
      harness.reset();
      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.phase).toBe('waiting');
      expect(state.sentPackets).toEqual([]);
    });

    it('should handle dispose without start', () => {
      expect(() => harness.dispose()).not.toThrow();
    });

    it('should preserve variant on reset', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('server_closes_first');

      harness.start();
      harness.reset();

      const state = harness.getState();
      expect(state.variant).toBe('server_closes_first');
    });

    it('should handle very fast speed', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setSpeed(100);
      harness.start();

      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.speed).toBe(100);
      expect(state.flyingPackets.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long TIME_WAIT', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setTimeWaitDuration(10000);

      expect(harness.getState().timeWaitDuration).toBe(10000);
    });

    it('should handle variant change during simulation', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      harness.start();
      vi.advanceTimersByTime(600);

      sim.setVariant('server_closes_first');

      const state = harness.getState();
      expect(state.variant).toBe('server_closes_first');
    });
  });

  describe('State Transitions', () => {
    it('should follow correct state sequence for client closes first', () => {
      const sim = harness.getSimulation() as TcpFinSim;
      sim.setVariant('client_closes_first');
      harness.start();

      const states: string[] = [];

      // Track client states
      vi.advanceTimersByTime(600);
      states.push(harness.getState().clientState);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().clientState);

      harness.completeAnimation();
      vi.advanceTimersByTime(1200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().clientState);

      // Should transition through FIN_WAIT_1 -> FIN_WAIT_2 -> TIME_WAIT
      expect(states).toContain('FIN_WAIT_1');
      expect(states).toContain('FIN_WAIT_2');
      expect(states).toContain('TIME_WAIT');
    });

    it('should follow correct phase sequence', () => {
      harness.start();

      const phases: string[] = [];
      phases.push(harness.getState().phase);

      vi.advanceTimersByTime(600);
      phases.push(harness.getState().phase);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      phases.push(harness.getState().phase);

      // Should transition through waiting -> fin1_sent -> ack1_sent...
      expect(phases[0]).toBe('waiting');
      expect(phases).toContain('fin1_sent');
    });
  });
});

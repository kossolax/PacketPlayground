import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  SimulationTestHarness,
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers.test';
import { TcpSynSim, createInitialSynState } from './tcpsyn-sim';

vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

describe('TcpSynSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let harness: SimulationTestHarness<ReturnType<typeof createInitialSynState>>;
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

    harness = new SimulationTestHarness(TcpSynSim, mockAnimation);
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
      const state = createInitialSynState();

      expect(state.withFirewall).toBe(false);
      expect(state.speed).toBe(2000);
      expect(state.isRunning).toBe(false);
      expect(state.phase).toBe('waiting');
      expect(state.clientState).toBe('CLOSED');
      expect(state.serverState).toBe('LISTEN');
      expect(state.firewallState).toBe('IDLE');
      expect(state.sentPackets).toEqual([]);
      expect(state.flyingPackets).toEqual([]);
      expect(state.generatedCookie).toBeNull();
      expect(state.validatedConnections).toEqual([]);
    });
  });

  describe('Configuration', () => {
    it('should enable firewall', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      harness.clearEmittedStates();

      sim.setWithFirewall(true);

      const state = harness.getState();
      expect(state.withFirewall).toBe(true);
      expect(state.firewallState).toBe('FILTERING');
      harness.expectEmitted();
    });

    it('should disable firewall', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.clearEmittedStates();

      sim.setWithFirewall(false);

      const state = harness.getState();
      expect(state.withFirewall).toBe(false);
      expect(state.firewallState).toBe('IDLE');
      harness.expectEmitted();
    });

    it('should update speed', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      harness.clearEmittedStates();

      sim.setSpeed(3000);

      const state = harness.getState();
      expect(state.speed).toBe(3000);
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
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.phase).toBe('waiting');
      expect(state.clientState).toBe('CLOSED');
      expect(state.serverState).toBe('LISTEN');
      expect(state.sentPackets).toEqual([]);
      expect(state.flyingPackets).toEqual([]);
      expect(state.generatedCookie).toBeNull();
      expect(state.withFirewall).toBe(true); // Preserved
    });

    it('should dispose and clean up resources', () => {
      harness.start();
      vi.advanceTimersByTime(600); // Allow animation to start

      harness.dispose();

      // If animations started, they should have cancel functions
      expect(mockAnimation.mockStartFlightAnimation).toHaveBeenCalled();
    });
  });

  describe('Normal Mode (No Firewall)', () => {
    it('should initiate SYN from client to server', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.clientState).toBe('SYN_SENT');
      expect(state.phase).toBe('syn_sent');
      expect(state.sentPackets.length).toBeGreaterThan(0);
      expect(state.sentPackets[0].type).toBe('SYN');
      expect(state.sentPackets[0].from).toBe('client');
      expect(state.sentPackets[0].to).toBe('server');
    });

    it('should transition server to SYN_RCVD after receiving SYN', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.serverState).toBe('SYN_RCVD');
    });

    it('should send SYN-ACK from server', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.phase).toBe('syn_ack_sent');
      const synAckPacket = state.sentPackets.find((p) => p.type === 'SYN_ACK');
      expect(synAckPacket).toBeDefined();
      expect(synAckPacket?.from).toBe('server');
      expect(synAckPacket?.to).toBe('client');
    });

    it('should transition client to ESTABLISHED after receiving SYN-ACK', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.clientState).toBe('ESTABLISHED');
      expect(state.phase).toBe('ack_sent');
    });

    it('should send final ACK from client', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      const ackPacket = state.sentPackets.find((p) => p.type === 'ACK');
      expect(ackPacket).toBeDefined();
      expect(ackPacket?.from).toBe('client');
      expect(ackPacket?.to).toBe('server');
    });

    it('should transition server to ESTABLISHED after final ACK', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.serverState).toBe('ESTABLISHED');
      expect(state.phase).toBe('established');
    });

    it('should complete handshake successfully', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(1200);

      const state = harness.getState();
      expect(state.phase).toBe('completed');
      expect(state.isRunning).toBe(false);
      expect(state.clientState).toBe('ESTABLISHED');
      expect(state.serverState).toBe('ESTABLISHED');
    });
  });

  describe('Firewall Mode', () => {
    it('should initiate SYN from client to firewall', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.clientState).toBe('SYN_SENT');
      expect(state.firewallState).toBe('FILTERING');
      expect(state.sentPackets[0].type).toBe('SYN');
      expect(state.sentPackets[0].from).toBe('client');
      expect(state.sentPackets[0].to).toBe('firewall');
    });

    it('should generate SYN cookie', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.generatedCookie).not.toBeNull();
      expect(state.generatedCookie).toContain('cookie_');
    });

    it('should send SYN-ACK with cookie from firewall', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.firewallState).toBe('COOKIE_SENT');
      const synAckPacket = state.sentPackets.find((p) => p.type === 'SYN_ACK');
      expect(synAckPacket).toBeDefined();
      expect(synAckPacket?.from).toBe('firewall');
      expect(synAckPacket?.to).toBe('client');
      expect(synAckPacket?.hasCookie).toBe(true);
      expect(synAckPacket?.cookieValue).toBe(state.generatedCookie);
    });

    it('should send ACK from client to firewall', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      const ackPacket = state.sentPackets.find((p) => p.type === 'ACK');
      expect(ackPacket).toBeDefined();
      expect(ackPacket?.from).toBe('client');
      expect(ackPacket?.to).toBe('firewall');
    });

    it('should send RST from firewall after receiving ACK', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.firewallState).toBe('RST_SENT');
      expect(state.phase).toBe('rst_sent');
      const rstPacket = state.sentPackets.find((p) => p.type === 'RST');
      expect(rstPacket).toBeDefined();
      expect(rstPacket?.from).toBe('firewall');
      expect(rstPacket?.to).toBe('client');
    });

    it('should start real handshake after RST', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      expect(state.phase).toBe('syn_to_server');
      const synPackets = state.sentPackets.filter((p) => p.type === 'SYN');
      expect(synPackets.length).toBeGreaterThanOrEqual(2); // Initial SYN + real SYN
      const realSyn = synPackets[synPackets.length - 1];
      expect(realSyn.from).toBe('client');
      expect(realSyn.to).toBe('server');
    });

    it('should complete full handshake with firewall', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete all steps
      for (let i = 0; i < 7; i += 1) {
        harness.completeAnimation();
        vi.advanceTimersByTime(200);
      }

      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      expect(state.clientState).toBe('ESTABLISHED');
      expect(state.serverState).toBe('ESTABLISHED');
      expect(state.isRunning).toBe(false);
    });
  });

  describe('SYN Cookie', () => {
    it('should generate unique cookies', () => {
      const sim1 = new TcpSynSim({ onUpdate: () => {} });
      sim1.setWithFirewall(true);
      sim1.start();
      vi.advanceTimersByTime(600);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      const cookie1 = sim1.getState().generatedCookie;

      sim1.dispose();

      const sim2 = new TcpSynSim({ onUpdate: () => {} });
      sim2.setWithFirewall(true);
      sim2.start();
      vi.advanceTimersByTime(600);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      const cookie2 = sim2.getState().generatedCookie;

      sim2.dispose();

      expect(cookie1).not.toBeNull();
      expect(cookie2).not.toBeNull();
      // Cookies should be different (with very high probability)
      expect(cookie1).not.toBe(cookie2);
    });

    it('should include cookie in SYN-ACK packet', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      const synAck = state.sentPackets.find((p) => p.type === 'SYN_ACK');
      expect(synAck?.hasCookie).toBe(true);
      expect(synAck?.cookieValue).toBe(state.generatedCookie);
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
      expect(state.flyingPackets.length).toBeLessThan(state.sentPackets.length);
    });

    it('should set correct packet flags', () => {
      harness.start();
      vi.advanceTimersByTime(600);

      const state = harness.getState();
      const synPacket = state.sentPackets.find((p) => p.type === 'SYN');
      expect(synPacket?.synFlag).toBe(true);
      expect(synPacket?.ackFlag).toBe(false);
      expect(synPacket?.rstFlag).toBe(false);
    });
  });

  describe('State Transitions', () => {
    it('should follow correct client state sequence in normal mode', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();

      const states: string[] = [];
      states.push(harness.getState().clientState);

      vi.advanceTimersByTime(600);
      states.push(harness.getState().clientState);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().clientState);

      expect(states).toContain('CLOSED');
      expect(states).toContain('SYN_SENT');
      expect(states).toContain('ESTABLISHED');
    });

    it('should follow correct server state sequence in normal mode', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();

      const states: string[] = [];
      states.push(harness.getState().serverState);

      vi.advanceTimersByTime(600);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().serverState);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().serverState);

      expect(states).toContain('LISTEN');
      expect(states).toContain('SYN_RCVD');
      expect(states).toContain('ESTABLISHED');
    });

    it('should follow correct firewall state sequence', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();

      const states: string[] = [];

      vi.advanceTimersByTime(600);
      states.push(harness.getState().firewallState);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().firewallState);

      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      states.push(harness.getState().firewallState);

      expect(states).toContain('FILTERING');
      expect(states).toContain('COOKIE_SENT');
      expect(states).toContain('RST_SENT');
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

    it('should preserve firewall setting on reset', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);

      harness.start();
      harness.reset();

      const state = harness.getState();
      expect(state.withFirewall).toBe(true);
    });

    it('should handle firewall toggle during simulation', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      harness.start();
      vi.advanceTimersByTime(600);

      sim.setWithFirewall(true);

      const state = harness.getState();
      expect(state.withFirewall).toBe(true);
      expect(state.firewallState).toBe('FILTERING');
    });

    it('should handle very fast speed', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setSpeed(100);
      harness.start();

      vi.advanceTimersByTime(600);

      const state = harness.getState();
      expect(state.speed).toBe(100);
    });

    it('should handle very slow speed', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setSpeed(10000);

      expect(harness.getState().speed).toBe(10000);
    });

    it('should handle rapid start/reset cycles', () => {
      harness.start();
      harness.reset();
      harness.start();
      harness.reset();
      harness.start();

      const state = harness.getState();
      expect(state.isRunning).toBe(true);
    });
  });

  describe('Packet Count Verification', () => {
    it('should send exactly 3 packets in normal mode', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(false);
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete handshake
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);
      harness.completeAnimation();
      vi.advanceTimersByTime(200);

      const state = harness.getState();
      // SYN + SYN-ACK + ACK = 3 packets
      expect(state.sentPackets.length).toBe(3);
    });

    it('should send more packets in firewall mode', () => {
      const sim = harness.getSimulation() as TcpSynSim;
      sim.setWithFirewall(true);
      harness.start();
      vi.advanceTimersByTime(600);

      // Complete all handshakes
      for (let i = 0; i < 7; i += 1) {
        harness.completeAnimation();
        vi.advanceTimersByTime(200);
      }

      const state = harness.getState();
      // Firewall handshake + real handshake = more packets
      expect(state.sentPackets.length).toBeGreaterThan(3);
    });
  });
});

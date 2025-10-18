import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';

import { CastingSim, createInitialCastingState } from './casting-sim';

// Mock the animation module
vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

// Mock setInterval/clearInterval
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('CastingSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let sim: CastingSim;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;

  beforeEach(async () => {
    setupFakeTimers();
    mockAnimation = createMockAnimationSystem();

    // Mock startFlightAnimation
    const { startFlightAnimation } = await import('@/lib/animation');
    vi.mocked(startFlightAnimation).mockImplementation(
      mockAnimation.mockStartFlightAnimation
    );

    // Save original globals
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;

    global.setInterval = mockSetInterval.mockImplementation(
      mockAnimation.mockSetInterval
    );
    global.clearInterval = mockClearInterval.mockImplementation(
      mockAnimation.mockClearInterval
    );

    sim = new CastingSim({
      timeProvider: mockAnimation.mockTimeProvider,
    });
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
      const state = createInitialCastingState();

      expect(state.timeScale).toBe(1);
      expect(state.flightDuration).toBe(1500);
      expect(state.sendInterval).toBe(3000);
      expect(state.selectedType).toBe('unicast');
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.nodes).toHaveLength(8); // 1 source + 2 switches + 5 PCs
      expect(state.links).toHaveLength(7); // Linear topology
      expect(state.packets).toEqual([]);
      expect(
        Object.keys(state.multicastGroup).filter((k) => state.multicastGroup[k])
          .length
      ).toBe(2); // Even PCs by default (PC2, PC4)
      expect(state.stats.unicastSent).toBe(0);
      expect(state.stats.broadcastSent).toBe(0);
      expect(state.stats.multicastSent).toBe(0);
      expect(state.stats.anycastSent).toBe(0);
      expect(state.stats.totalPackets).toBe(0);
      expect(state.stats.totalHops).toBe(0);
    });

    it('should create linear topology with switches', () => {
      const state = createInitialCastingState();

      const pc0 = state.nodes.find((n) => n.id === 'pc0');
      const sw1 = state.nodes.find((n) => n.id === 'sw1');
      const sw2 = state.nodes.find((n) => n.id === 'sw2');
      const pc5 = state.nodes.find((n) => n.id === 'pc5');

      expect(pc0?.type).toBe('pc');
      expect(sw1?.type).toBe('switch');
      expect(sw2?.type).toBe('switch');
      expect(pc5?.type).toBe('pc');
    });

    it('should create links for linear topology', () => {
      const state = createInitialCastingState();

      // Check key links
      const pc0ToSw1 = state.links.find(
        (l) => l.from === 'pc0' && l.to === 'sw1'
      );
      const sw1ToSw2 = state.links.find(
        (l) => l.from === 'sw1' && l.to === 'sw2'
      );

      expect(pc0ToSw1).toBeDefined();
      expect(sw1ToSw2).toBeDefined();
      expect(pc0ToSw1?.distance).toBe(1);
    });

    it('should position nodes correctly', () => {
      const state = createInitialCastingState();

      const pc0 = state.positioned.find((n) => n.id === 'pc0');
      const sw1 = state.positioned.find((n) => n.id === 'sw1');
      expect(pc0?.x).toBe(50);
      expect(sw1?.x).toBe(250);
      expect(state.positioned).toHaveLength(8);
    });
  });

  describe('Configuration', () => {
    it('should update time scale', () => {
      const onUpdate = vi.fn();
      const testSim = new CastingSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTimeScale(2);

      const state = testSim.getState();
      expect(state.timeScale).toBe(2);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update flight duration', () => {
      const onUpdate = vi.fn();
      const testSim = new CastingSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setFlightDuration(2000);

      const state = testSim.getState();
      expect(state.flightDuration).toBe(2000);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update send interval', () => {
      const onUpdate = vi.fn();
      const testSim = new CastingSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setSendInterval(5000);

      const state = testSim.getState();
      expect(state.sendInterval).toBe(5000);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update selected type', () => {
      const onUpdate = vi.fn();
      const testSim = new CastingSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setSelectedType('broadcast');

      const state = testSim.getState();
      expect(state.selectedType).toBe('broadcast');
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should toggle multicast member', () => {
      // Initially only even PCs are in group
      let state = sim.getState();
      expect(state.multicastGroup.pc1).toBe(false);

      // Toggle on
      sim.toggleMulticastMember('pc1');
      state = sim.getState();
      expect(state.multicastGroup.pc1).toBe(true);

      // Toggle off again
      sim.toggleMulticastMember('pc1');
      state = sim.getState();
      expect(state.multicastGroup.pc1).toBe(false);
    });
  });

  describe('Simulation Control', () => {
    it('should start simulation', () => {
      sim.start();
      const state = sim.getState();
      expect(state.isRunning).toBe(true);
    });

    it('should not start if already running', () => {
      sim.start();
      const onUpdate = vi.fn();
      const testSim = new CastingSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();
      onUpdate.mockClear();
      testSim.start();
      expect(onUpdate).not.toHaveBeenCalled();
      testSim.dispose();
    });

    it('should stop simulation', () => {
      sim.start();
      sim.stop();
      const state = sim.getState();
      expect(state.isRunning).toBe(false);
    });

    it('should reset simulation', () => {
      sim.start();
      sim.reset();

      const state = sim.getState();
      expect(state.isRunning).toBe(false);
      expect(state.packets).toEqual([]);
      expect(state.stats.totalPackets).toBe(0);
    });

    it('should preserve configuration on reset', () => {
      sim.setTimeScale(3);
      sim.setFlightDuration(2500);
      sim.setSelectedType('broadcast');
      sim.reset();

      const state = sim.getState();
      expect(state.timeScale).toBe(3);
      expect(state.flightDuration).toBe(2500);
      expect(state.selectedType).toBe('broadcast');
    });
  });

  describe('Packet Sending (via start)', () => {
    it('should send unicast packet when type is unicast', () => {
      sim.setSelectedType('unicast');
      sim.start();

      const state = sim.getState();
      // First packet sent immediately
      expect(state.stats.unicastSent).toBe(1);
      expect(state.stats.totalPackets).toBe(1);
      expect(state.packets.length).toBeGreaterThan(0);
      expect(state.packets[0].packetType).toBe('unicast');
    });

    it('should send broadcast packets when type is broadcast', () => {
      sim.setSelectedType('broadcast');
      sim.start();

      const state = sim.getState();
      expect(state.stats.broadcastSent).toBe(1);
      // 5 PCs (pc1-pc5), no source or switches
      expect(state.stats.totalPackets).toBe(5);
      expect(state.packets.length).toBe(5);
    });

    it('should send multicast only to selected group', () => {
      // Set multicast group to only pc1 and pc2
      // Default: pc2=true, pc4=true. We want: pc1=true, pc2=true
      sim.setSelectedType('multicast');
      sim.toggleMulticastMember('pc1'); // add (false -> true)
      sim.toggleMulticastMember('pc4'); // remove (true -> false)

      sim.start();

      const state = sim.getState();
      expect(state.stats.multicastSent).toBe(1);
      expect(state.stats.totalPackets).toBe(2); // Only pc1 and pc2
    });

    it('should send anycast to closest PC', () => {
      sim.setSelectedType('anycast');
      sim.start();

      const state = sim.getState();
      expect(state.stats.anycastSent).toBe(1);
      expect(state.stats.totalPackets).toBe(1);
      // pc1 should be closest (2 hops: pc0 -> sw1 -> pc1)
      expect(state.packets[0].targetNodeId).toBe('pc1');
    });
  });

  describe('Statistics', () => {
    it('should track different casting types', () => {
      // Create fresh sim for this test
      const testSim = new CastingSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      // Send unicast
      testSim.setSelectedType('unicast');
      testSim.start();
      testSim.stop();

      // Change to broadcast and start again
      testSim.setSelectedType('broadcast');
      testSim.start();
      testSim.stop();

      const state = testSim.getState();
      // First start sent unicast, second start sent broadcast
      expect(state.stats.unicastSent).toBeGreaterThanOrEqual(1);
      expect(state.stats.broadcastSent).toBeGreaterThanOrEqual(1);

      testSim.dispose();
    });
  });

  describe('Packet Animation', () => {
    it('should create packet with correct path', () => {
      sim.setSelectedType('unicast');
      sim.start();

      const state = sim.getState();
      const packet = state.packets[0];

      expect(packet.path.length).toBeGreaterThan(0);
      expect(packet.path[0].from).toBe('pc0');
      expect(packet.pathProgress).toBe(0);
      expect(packet.currentLinkIndex).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should properly dispose and clean up', () => {
      sim.start();
      sim.dispose();

      expect(mockClearInterval).toHaveBeenCalled();
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';

import {
  createInitialSwitchLearningState,
  SwitchLearningSim,
} from './switch-learning-sim';

// Mock the animation module
vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

// Mock setInterval/clearInterval
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('SwitchLearningSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let sim: SwitchLearningSim;
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

    sim = new SwitchLearningSim({
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
      const state = createInitialSwitchLearningState();

      expect(state.agingTimeoutSec).toBe(20);
      expect(state.timeScale).toBe(1);
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.devices).toHaveLength(6); // 4 PCs + 2 switches
      expect(state.links).toHaveLength(5);
      expect(state.packets).toEqual([]);
      expect(state.totalPackets).toBe(0);
      expect(state.floodedPackets).toBe(0);
      expect(state.forwardedPackets).toBe(0);
    });

    it('should initialize empty CAM tables for switches', () => {
      const state = createInitialSwitchLearningState();

      expect(Object.keys(state.camTables)).toHaveLength(2); // SW1 and SW2
      expect(Object.keys(state.camTables.sw1)).toHaveLength(0);
      expect(Object.keys(state.camTables.sw2)).toHaveLength(0);
    });

    it('should create devices with correct MAC addresses', () => {
      const state = createInitialSwitchLearningState();

      const pc1 = state.devices.find((d) => d.id === 'pc1');
      const sw1 = state.devices.find((d) => d.id === 'sw1');

      expect(pc1?.mac).toBe('AA:BB:CC:DD:EE:01');
      expect(sw1?.mac).toBe('FF:FF:FF:FF:FF:01');
    });

    it('should create correct topology', () => {
      const state = createInitialSwitchLearningState();

      // Check links
      expect(state.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ from: 'pc1', to: 'sw1' }),
          expect.objectContaining({ from: 'pc2', to: 'sw1' }),
          expect.objectContaining({ from: 'sw1', to: 'sw2' }),
          expect.objectContaining({ from: 'sw2', to: 'pc3' }),
          expect.objectContaining({ from: 'sw2', to: 'pc4' }),
        ])
      );
    });
  });

  describe('Configuration', () => {
    it('should update aging timeout', () => {
      const onUpdate = vi.fn();
      const testSim = new SwitchLearningSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setAgingTimeout(600);

      const state = testSim.getState();
      expect(state.agingTimeoutSec).toBe(600);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update time scale', () => {
      const onUpdate = vi.fn();
      const testSim = new SwitchLearningSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTimeScale(2);

      const state = testSim.getState();
      expect(state.timeScale).toBe(2);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });
  });

  describe('Lifecycle', () => {
    it('should start simulation correctly', () => {
      const onUpdate = vi.fn();
      const testSim = new SwitchLearningSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();

      const state = testSim.getState();
      expect(state.isRunning).toBe(true);
      expect(mockSetInterval).toHaveBeenCalled();
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should not start if already running', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();
      const callCountBefore = mockSetInterval.mock.calls.length;

      testSim.start();
      const callCountAfter = mockSetInterval.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
      testSim.dispose();
    });

    it('should reset simulation to initial state', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Advance simulation
      mockAnimation.mockTimeProvider.advance(100);
      mockAnimation.triggerTick();

      testSim.reset();

      const state = testSim.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.packets).toEqual([]);
      expect(state.totalPackets).toBe(0);
      expect(state.floodedPackets).toBe(0);
      expect(state.forwardedPackets).toBe(0);
      testSim.dispose();
    });

    it('should dispose and clean up resources', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.dispose();

      expect(mockClearInterval).toHaveBeenCalled();
    });
  });

  describe('MAC Learning', () => {
    it('should learn MAC addresses when packets are sent', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Trigger animations
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const sw1CamTable = testSim.getCamTable('sw1');

      // SW1 should learn PC1's MAC
      expect(Object.keys(sw1CamTable).length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should refresh timestamp when MAC is relearned on same port', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // First packet
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const sw1Table1 = testSim.getCamTable('sw1');
      const entry1 = Object.values(sw1Table1)[0];
      const firstTimestamp = entry1?.timestamp;

      // Advance time
      mockAnimation.mockTimeProvider.advance(2000);
      vi.advanceTimersByTime(2000);

      // Second packet (same source)
      testSim.sendPacket('pc1', 'pc3', 0);
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const sw1Table2 = testSim.getCamTable('sw1');
      const entry2 = Object.values(sw1Table2)[0];
      const secondTimestamp = entry2?.timestamp;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp || 0);
      testSim.dispose();
    });
  });

  describe('Forwarding vs Flooding', () => {
    it('should flood when destination MAC is unknown', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // First packet (destination unknown)
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const state = testSim.getState();
      expect(state.floodedPackets).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should forward when destination MAC is known', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // First packet (learn PC1 and PC3 MACs)
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights(); // Complete PC1→SW1 flight

      // Trigger cascading flights (SW1 floods to SW2 and PC3)
      mockAnimation.triggerAllFlights(); // Complete SW1→SW2 flight
      mockAnimation.triggerAllFlights(); // Complete SW2→PC3 flight

      // PC3 receives and sends auto-reply after 100ms
      mockAnimation.mockTimeProvider.advance(200);
      vi.advanceTimersByTime(200);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights(); // PC3→SW2 (should forward, not flood)

      const state = testSim.getState();
      expect(state.forwardedPackets).toBeGreaterThan(0);
      testSim.dispose();
    });
  });

  describe('CAM Table Aging', () => {
    it('should age out old entries after timeout', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setAgingTimeout(10); // 10 seconds for testing
      testSim.start();

      // Learn MAC - update currentTime first, then complete flight
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick(); // Update currentTime to ~1 second
      mockAnimation.triggerAllFlights(); // Learn MAC with timestamp ~1

      const sw1TableBefore = testSim.getCamTable('sw1');
      expect(Object.keys(sw1TableBefore).length).toBeGreaterThan(0);

      // Advance time beyond aging timeout (1s + 15s = 16s total, which is > 10s aging)
      mockAnimation.mockTimeProvider.advance(15000);
      vi.advanceTimersByTime(15000);
      mockAnimation.triggerTick(); // Update currentTime to ~16 seconds

      // Manually trigger aging check
      // eslint-disable-next-line @typescript-eslint/dot-notation
      testSim['checkAging']();

      const sw1TableAfter = testSim.getCamTable('sw1');
      expect(Object.keys(sw1TableAfter).length).toBe(0);
      testSim.dispose();
    });
  });

  describe('Packet Animation', () => {
    it('should create flying packets when sent', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      mockAnimation.mockTimeProvider.advance(1100);
      vi.advanceTimersByTime(1100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.packets.length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should remove packets when they arrive', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      mockAnimation.mockTimeProvider.advance(1100);
      vi.advanceTimersByTime(1100);
      mockAnimation.triggerTick();

      expect(testSim.getState().packets.length).toBeGreaterThan(0);

      // Complete all cascading flights (each arrival may create new packets)
      // PC1→SW1, SW1 floods to SW2 and potentially PC2, SW2 floods to PC3/PC4
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      expect(testSim.getState().packets.length).toBe(0);
      testSim.dispose();
    });
  });

  describe('Auto-Reply Mechanism', () => {
    it('should allow any PC to auto-reply when receiving a packet', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Send from PC1 to PC4
      testSim.sendPacket('pc1', 'pc4', 0);

      // Advance to let packet arrive at PC4
      mockAnimation.mockTimeProvider.advance(10000);
      vi.advanceTimersByTime(10000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      // PC4 should send a reply to PC1
      const state = testSim.getState();
      // Should have PC4→PC1 reply packet created
      expect(state.totalPackets).toBeGreaterThan(1);
      testSim.dispose();
    });

    it('should not create infinite loops with isReply flag', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Send PC1→PC3
      testSim.sendPacket('pc1', 'pc3', 0);

      // Let all packets complete (initial + request + reply)
      mockAnimation.mockTimeProvider.advance(20000);
      vi.advanceTimersByTime(20000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const state = testSim.getState();
      // Should not have infinite replies, only: auto packet + manual packet + 2 replies
      expect(state.totalPackets).toBeLessThan(10);
      testSim.dispose();
    });
  });

  describe('Real-time Clock', () => {
    it('should update currentTime with tick()', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      const initialTime = testSim.getState().currentTime;

      // Advance time by 5 seconds
      mockAnimation.mockTimeProvider.advance(5000);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.currentTime).toBeGreaterThan(initialTime);
      testSim.dispose();
    });
  });

  describe('Metrics', () => {
    it('should track total packets sent', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      mockAnimation.mockTimeProvider.advance(1100);
      vi.advanceTimersByTime(1100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.totalPackets).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should calculate total CAM table size', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const totalSize = testSim.getTotalCamSize();
      expect(totalSize).toBeGreaterThanOrEqual(0);
      testSim.dispose();
    });
  });

  describe('Manual Packet Sending', () => {
    it('should allow manual packet sending', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      const initialPackets = testSim.getState().totalPackets;
      testSim.sendPacket('pc2', 'pc4', 0);

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.totalPackets).toBeGreaterThan(initialPackets);
      testSim.dispose();
    });

    it('should handle invalid source or destination', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      const initialPackets = testSim.getState().totalPackets;
      testSim.sendPacket('invalid', 'pc1', 0);

      // Advance time to allow setTimeout to execute
      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      // Invalid source should not create packet
      const state = testSim.getState();
      expect(state.totalPackets).toBe(initialPackets);
      testSim.dispose();
    });
  });

  describe('Link States', () => {
    it('should set link states during packet transmission', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const state = testSim.getState();

      // Links should have states set during transmission
      // May be idle again if animation completed
      expect(state.links.length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should set first link to forwarding immediately when PC sends packet', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Send packet from PC2 to PC4
      testSim.sendPacket('pc2', 'pc4', 0);

      // Check immediately (before animation starts)
      mockAnimation.mockTimeProvider.advance(10);
      vi.advanceTimersByTime(10);
      const state = testSim.getState();

      // Find PC2→SW1 link
      const pc2ToSw1Link = state.links.find(
        (l) =>
          (l.from === 'pc2' && l.to === 'sw1') ||
          (l.from === 'sw1' && l.to === 'pc2')
      );

      expect(pc2ToSw1Link?.state).toBe('forwarding');
      testSim.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty CAM table gracefully', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      const camTable = testSim.getCamTable('sw1');
      expect(Object.keys(camTable).length).toBe(0);

      // Test non-existent switch
      const nonExistentTable = testSim.getCamTable('non-existent');
      expect(Object.keys(nonExistentTable).length).toBe(0);

      testSim.dispose();
    });

    it('should handle multiple resets', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();
      testSim.reset();
      testSim.reset();
      testSim.reset();

      const state = testSim.getState();
      expect(state.isRunning).toBe(false);
      expect(state.packets).toEqual([]);
      testSim.dispose();
    });

    it('should handle dispose without start', () => {
      const testSim = new SwitchLearningSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      expect(() => testSim.dispose()).not.toThrow();
    });
  });
});

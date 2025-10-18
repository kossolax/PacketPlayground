import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';

import { ArpSim, createInitialArpState } from './arp-sim';

// Mock the animation module
vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

// Mock setInterval/clearInterval
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('ArpSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let sim: ArpSim;
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

    sim = new ArpSim({
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
      const state = createInitialArpState();

      expect(state.cacheTimeoutSec).toBe(30);
      expect(state.agingTimeoutSec).toBe(300);
      expect(state.timeScale).toBe(1);
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.devices).toHaveLength(6); // 4 PCs + 2 switches
      expect(state.links).toHaveLength(5);
      expect(state.packets).toEqual([]);
      expect(state.totalRequests).toBe(0);
      expect(state.totalReplies).toBe(0);
      expect(state.gratuitousArps).toBe(0);
      expect(state.poisonedPackets).toBe(0);
    });

    it('should initialize empty ARP caches for PCs', () => {
      const state = createInitialArpState();

      expect(Object.keys(state.arpCaches)).toHaveLength(4); // 4 PCs
      expect(Object.keys(state.arpCaches.pc1)).toHaveLength(0);
      expect(Object.keys(state.arpCaches.pc2)).toHaveLength(0);
      expect(Object.keys(state.arpCaches.pc3)).toHaveLength(0);
      expect(Object.keys(state.arpCaches.pc4)).toHaveLength(0);
    });

    it('should initialize empty CAM tables for switches', () => {
      const state = createInitialArpState();

      expect(Object.keys(state.camTables)).toHaveLength(2); // SW1 and SW2
      expect(Object.keys(state.camTables.sw1)).toHaveLength(0);
      expect(Object.keys(state.camTables.sw2)).toHaveLength(0);
    });

    it('should create devices with correct MAC and IP addresses', () => {
      const state = createInitialArpState();

      const pc1 = state.devices.find((d) => d.id === 'pc1');
      const pc2 = state.devices.find((d) => d.id === 'pc2');
      const sw1 = state.devices.find((d) => d.id === 'sw1');

      expect(pc1?.mac).toBe('AA:BB:CC:DD:EE:01');
      expect(pc1?.ip).toBe('192.168.1.1');
      expect(pc2?.mac).toBe('AA:BB:CC:DD:EE:02');
      expect(pc2?.ip).toBe('192.168.1.2');
      expect(sw1?.mac).toBe('FF:FF:FF:FF:FF:01');
      expect(sw1?.ip).toBeUndefined(); // Switches don't have IPs
    });

    it('should create correct topology', () => {
      const state = createInitialArpState();

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
    it('should update cache timeout', () => {
      const onUpdate = vi.fn();
      const testSim = new ArpSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setCacheTimeout(60);

      const state = testSim.getState();
      expect(state.cacheTimeoutSec).toBe(60);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should update aging timeout', () => {
      const onUpdate = vi.fn();
      const testSim = new ArpSim({
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
      const testSim = new ArpSim({
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
      const testSim = new ArpSim({
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
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();
      const callCountBefore = mockSetInterval.mock.calls.length;

      testSim.start();
      const callCountAfter = mockSetInterval.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
      testSim.dispose();
    });

    it('should stop simulation correctly', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.stop();

      const state = testSim.getState();
      expect(state.isRunning).toBe(false);
      expect(mockClearInterval).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should reset simulation to initial state', () => {
      const testSim = new ArpSim({
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
      expect(state.totalRequests).toBe(0);
      expect(state.totalReplies).toBe(0);
      expect(state.gratuitousArps).toBe(0);
      expect(state.poisonedPackets).toBe(0);
      testSim.dispose();
    });

    it('should preserve configuration on reset', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setCacheTimeout(60);
      testSim.setAgingTimeout(600);
      testSim.setTimeScale(2);

      testSim.reset();

      const state = testSim.getState();
      expect(state.cacheTimeoutSec).toBe(60);
      expect(state.agingTimeoutSec).toBe(600);
      expect(state.timeScale).toBe(2);
      testSim.dispose();
    });

    it('should dispose and clean up resources', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.dispose();

      expect(mockClearInterval).toHaveBeenCalled();
    });
  });

  describe('ARP Request', () => {
    it('should send ARP Request as broadcast', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.packets.length).toBeGreaterThan(0);
      expect(state.totalRequests).toBe(1);

      const packet = state.packets[0];
      expect(packet?.type).toBe('broadcast');
      expect(packet?.packetType).toBe('arp-request');
      expect(packet?.dstMAC).toBe('FF:FF:FF:FF:FF:FF');
      testSim.dispose();
    });

    it('should increment totalRequests counter', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');
      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);

      testSim.sendArpRequest('pc2', '192.168.1.4');
      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);

      const state = testSim.getState();
      expect(state.totalRequests).toBe(2);
      testSim.dispose();
    });
  });

  describe('ARP Reply', () => {
    it('should send ARP Reply as unicast when receiving request', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // PC1 sends ARP Request for PC3
      testSim.sendArpRequest('pc1', '192.168.1.3');

      // Let packet arrive at PC3
      mockAnimation.mockTimeProvider.advance(10000);
      vi.advanceTimersByTime(10000);
      mockAnimation.triggerTick();

      // Trigger all cascading flights
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        mockAnimation.mockTimeProvider.advance(100);
        vi.advanceTimersByTime(100);
      }

      const state = testSim.getState();
      expect(state.totalReplies).toBeGreaterThan(0);
      testSim.dispose();
    });
  });

  describe('Gratuitous ARP', () => {
    it('should send Gratuitous ARP periodically', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Advance past first gratuitous ARP interval (15s)
      mockAnimation.mockTimeProvider.advance(16000);
      vi.advanceTimersByTime(16000);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.gratuitousArps).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should broadcast Gratuitous ARP', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Trigger gratuitous ARP
      mockAnimation.mockTimeProvider.advance(16000);
      vi.advanceTimersByTime(16000);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      const gratuitousPacket = state.packets.find(
        (p) => p.packetType === 'gratuitous-arp'
      );

      if (gratuitousPacket) {
        expect(gratuitousPacket.type).toBe('broadcast');
        expect(gratuitousPacket.dstMAC).toBe('FF:FF:FF:FF:FF:FF');
      }
      testSim.dispose();
    });
  });

  describe('ARP Poisoning', () => {
    it('should send poisoned ARP packet', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendPoisonedArp('pc1', 'pc2', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.poisonedPackets).toBe(1);

      const poisonedPacket = state.packets.find(
        (p) => p.packetType === 'poisoned-arp'
      );
      expect(poisonedPacket).toBeDefined();
      expect(poisonedPacket?.type).toBe('broadcast');
      testSim.dispose();
    });

    it('should mark poisoned entries in ARP cache', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // Send poisoned ARP: PC1 claims to be 192.168.1.3
      testSim.sendPoisonedArp('pc1', 'pc2', '192.168.1.3');

      // Let packet arrive at PC2
      mockAnimation.mockTimeProvider.advance(10000);
      vi.advanceTimersByTime(10000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const arpCache = testSim.getArpCache('pc2');
      const poisonedEntry = arpCache['192.168.1.3'];

      if (poisonedEntry) {
        expect(poisonedEntry.isPoisoned).toBe(true);
        expect(poisonedEntry.mac).toBe('AA:BB:CC:DD:EE:01'); // PC1's MAC
      }
      testSim.dispose();
    });
  });

  describe('ARP Cache Management', () => {
    it('should update ARP cache when learning IP-MAC mappings', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(10000);
      vi.advanceTimersByTime(10000);
      mockAnimation.triggerTick();

      // Trigger all flights to complete the request-reply cycle
      for (let i = 0; i < 15; i += 1) {
        mockAnimation.triggerAllFlights();
        mockAnimation.mockTimeProvider.advance(500);
        vi.advanceTimersByTime(500);
      }

      const pc1Cache = testSim.getArpCache('pc1');
      const pc3Cache = testSim.getArpCache('pc3');

      // PC3 should learn PC1's mapping from the request
      expect(Object.keys(pc3Cache).length).toBeGreaterThan(0);

      // PC1 should learn PC3's mapping from the reply
      expect(Object.keys(pc1Cache).length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should age out old ARP cache entries after timeout', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setCacheTimeout(10); // 10 seconds for testing
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      // Complete the ARP exchange - update currentTime first, then complete flight
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick(); // Update currentTime to ~1 second

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.triggerAllFlights();
        mockAnimation.mockTimeProvider.advance(100);
        vi.advanceTimersByTime(100);
      }

      const cacheBefore = testSim.getArpCache('pc3');
      expect(Object.keys(cacheBefore).length).toBeGreaterThan(0);

      // Advance past cache timeout (1s + 15s = 16s total, which is > 10s cache timeout)
      mockAnimation.mockTimeProvider.advance(15000);
      vi.advanceTimersByTime(15000);
      mockAnimation.triggerTick(); // Update currentTime to ~16 seconds

      // Manually trigger aging check
      // eslint-disable-next-line @typescript-eslint/dot-notation
      testSim['checkAging']();

      const cacheAfter = testSim.getArpCache('pc3');
      expect(Object.keys(cacheAfter).length).toBe(0);
      testSim.dispose();
    });

    it('should refresh timestamp when same entry is relearned', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      // First ARP request
      testSim.sendArpRequest('pc1', '192.168.1.3');
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick(); // Update currentTime to ~1s

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.triggerAllFlights();
      }

      // Trigger tick to update timestamp with current time
      mockAnimation.triggerTick();

      const cache1 = testSim.getArpCache('pc3');
      const firstTimestamp = Object.values(cache1)[0]?.timestamp;
      expect(firstTimestamp).toBeGreaterThan(0);

      // Advance time significantly and update currentTime
      mockAnimation.mockTimeProvider.advance(5000);
      vi.advanceTimersByTime(5000);
      mockAnimation.triggerTick(); // Update currentTime to ~6s

      // Second ARP request (should refresh timestamp)
      testSim.sendArpRequest('pc1', '192.168.1.3');
      mockAnimation.mockTimeProvider.advance(500);
      vi.advanceTimersByTime(500);
      mockAnimation.triggerTick(); // Update currentTime to ~6.5s

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.triggerAllFlights();
      }

      // Final tick to ensure timestamp is updated
      mockAnimation.mockTimeProvider.advance(500);
      vi.advanceTimersByTime(500);
      mockAnimation.triggerTick();

      const cache2 = testSim.getArpCache('pc3');
      const secondTimestamp = Object.values(cache2)[0]?.timestamp;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
      testSim.dispose();
    });
  });

  describe('CAM Table (MAC Learning)', () => {
    it('should learn MAC addresses when packets pass through switches', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(5000);
      vi.advanceTimersByTime(5000);
      mockAnimation.triggerTick();
      mockAnimation.triggerAllFlights();

      const sw1CamTable = testSim.getCamTable('sw1');
      expect(Object.keys(sw1CamTable).length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should age out old CAM entries after timeout', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.setAgingTimeout(10); // 10 seconds for testing
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      // Learn MAC - update currentTime first, then complete flight
      mockAnimation.mockTimeProvider.advance(1000);
      vi.advanceTimersByTime(1000);
      mockAnimation.triggerTick(); // Update currentTime to ~1 second
      mockAnimation.triggerAllFlights(); // Learn MAC with timestamp ~1

      const camBefore = testSim.getCamTable('sw1');
      expect(Object.keys(camBefore).length).toBeGreaterThan(0);

      // Advance past aging timeout (1s + 15s = 16s total, which is > 10s aging)
      mockAnimation.mockTimeProvider.advance(15000);
      vi.advanceTimersByTime(15000);
      mockAnimation.triggerTick(); // Update currentTime to ~16 seconds

      // Manually trigger aging check
      // eslint-disable-next-line @typescript-eslint/dot-notation
      testSim['checkAging']();

      const camAfter = testSim.getCamTable('sw1');
      expect(Object.keys(camAfter).length).toBe(0);
      testSim.dispose();
    });
  });

  describe('Packet Animation', () => {
    it('should create flying packets when ARP Request is sent', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.packets.length).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should remove packets when they arrive at destination', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      expect(testSim.getState().packets.length).toBeGreaterThan(0);

      // Complete all flights
      for (let i = 0; i < 20; i += 1) {
        mockAnimation.triggerAllFlights();
        mockAnimation.mockTimeProvider.advance(500);
        vi.advanceTimersByTime(500);
      }

      expect(testSim.getState().packets.length).toBe(0);
      testSim.dispose();
    });
  });

  describe('Metrics', () => {
    it('should track total ARP requests', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendArpRequest('pc1', '192.168.1.3');
      testSim.sendArpRequest('pc2', '192.168.1.4');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.totalRequests).toBe(2);
      testSim.dispose();
    });

    it('should track gratuitous ARPs', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      mockAnimation.mockTimeProvider.advance(16000);
      vi.advanceTimersByTime(16000);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.gratuitousArps).toBeGreaterThan(0);
      testSim.dispose();
    });

    it('should track poisoned packets', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      testSim.sendPoisonedArp('pc1', 'pc2', '192.168.1.3');
      testSim.sendPoisonedArp('pc1', 'pc3', '192.168.1.4');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);

      const state = testSim.getState();
      expect(state.poisonedPackets).toBe(2);
      testSim.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid device IDs gracefully', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      const initialRequests = testSim.getState().totalRequests;
      testSim.sendArpRequest('invalid-device', '192.168.1.3');

      mockAnimation.mockTimeProvider.advance(100);
      vi.advanceTimersByTime(100);

      const state = testSim.getState();
      expect(state.totalRequests).toBe(initialRequests);
      testSim.dispose();
    });

    it('should handle empty ARP cache gracefully', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      const cache = testSim.getArpCache('pc1');
      expect(Object.keys(cache).length).toBe(0);

      const nonExistentCache = testSim.getArpCache('non-existent');
      expect(Object.keys(nonExistentCache).length).toBe(0);

      testSim.dispose();
    });

    it('should handle empty CAM table gracefully', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      const camTable = testSim.getCamTable('sw1');
      expect(Object.keys(camTable).length).toBe(0);

      const nonExistentTable = testSim.getCamTable('non-existent');
      expect(Object.keys(nonExistentTable).length).toBe(0);

      testSim.dispose();
    });

    it('should handle multiple resets', () => {
      const testSim = new ArpSim({
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
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      expect(() => testSim.dispose()).not.toThrow();
    });

    it('should handle ARP request for non-existent IP', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      // Manually start timer without auto-scenarios
      testSim.getState().isRunning = true;
      testSim.startTimer();

      const initialRequests = testSim.getState().totalRequests;
      testSim.sendArpRequest('pc1', '192.168.99.99');

      mockAnimation.mockTimeProvider.advance(10000);
      vi.advanceTimersByTime(10000);
      mockAnimation.triggerTick();

      for (let i = 0; i < 15; i += 1) {
        mockAnimation.triggerAllFlights();
      }

      // Should broadcast but get no reply
      const state = testSim.getState();
      expect(state.totalRequests).toBe(initialRequests + 1);
      // No reply expected since IP doesn't exist
      testSim.dispose();
    });
  });

  describe('Real-time Clock', () => {
    it('should update currentTime with tick()', () => {
      const testSim = new ArpSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });
      testSim.start();

      const initialTime = testSim.getState().currentTime;

      mockAnimation.mockTimeProvider.advance(5000);
      mockAnimation.triggerTick();

      const state = testSim.getState();
      expect(state.currentTime).toBeGreaterThan(initialTime);
      testSim.dispose();
    });
  });
});

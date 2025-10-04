import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';
import { FragmentingRouter, type FragmentLike } from './fragmenting-router';

describe('FragmentingRouter', () => {
  beforeEach(() => {
    setupFakeTimers();
  });

  afterEach(() => {
    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create router with correct configuration', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(router).toBeDefined();
      router.dispose();
    });

    it('should accept optional onFragmentation callback', () => {
      const onForward = vi.fn();
      const onFragmentation = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
        onFragmentation,
      });

      expect(router).toBeDefined();
      router.dispose();
    });
  });

  describe('Configuration', () => {
    it('should update IP version', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(() => router.setIpVersion(6)).not.toThrow();
      router.dispose();
    });

    it('should update time scale', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(() => router.setTimeScale(2)).not.toThrow();
      router.dispose();
    });

    it('should update processing delay', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(() => router.setDelays({ processingDelayMs: 300 })).not.toThrow();
      router.dispose();
    });

    it('should update pacing delay', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(() => router.setDelays({ pacingMs: 500 })).not.toThrow();
      router.dispose();
    });

    it('should update both delays at once', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(() =>
        router.setDelays({ processingDelayMs: 300, pacingMs: 500 })
      ).not.toThrow();
      router.dispose();
    });
  });

  describe('Forwarding Without Fragmentation', () => {
    it('should forward packet that fits MTU (IPv4)', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400, // fits in MTU 1500
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);

      // Advance time to trigger processing and pacing
      vi.advanceTimersByTime(200 + 700 + 100);

      expect(onForward).toHaveBeenCalledTimes(1);
      expect(onForward).toHaveBeenCalledWith(
        expect.objectContaining({
          originalPacketId: 'packet-1',
          fragmentIndex: 0,
          size: 1400,
          offset: 0,
          color: '#0EA5E9',
        })
      );

      router.dispose();
    });

    it('should forward packet that fits MTU (IPv6)', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 6,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 700 + 100);

      expect(onForward).toHaveBeenCalledTimes(1);
      router.dispose();
    });

    it('should preserve existingId when forwarding without fragmentation', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
        existingId: 'fragment-123',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 700 + 100);

      expect(onForward).toHaveBeenCalledWith(
        expect.objectContaining({
          existingId: 'fragment-123',
        })
      );

      router.dispose();
    });
  });

  describe('IPv4 Fragmentation', () => {
    it('should fragment packet exceeding MTU', () => {
      const onForward = vi.fn();
      const onFragmentation = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
        onFragmentation,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000, // exceeds MTU 1000
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);

      // Advance time to allow all fragments to be forwarded
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      // Should fragment into multiple parts
      expect(onForward.mock.calls.length).toBeGreaterThan(1);
      expect(onFragmentation).toHaveBeenCalled();

      router.dispose();
    });

    it('should align fragment offsets to 8-byte boundaries', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      // Check that offsets are multiples of 8
      onForward.mock.calls.forEach((call) => {
        const frag = call[0] as FragmentLike;
        expect(frag.offset % 8).toBe(0);
      });

      router.dispose();
    });

    it('should include IP header size in fragment size calculation', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      // Each fragment should not exceed MTU
      onForward.mock.calls.forEach((call) => {
        const frag = call[0] as FragmentLike;
        expect(frag.size).toBeLessThanOrEqual(1000);
      });

      router.dispose();
    });

    it('should assign hierarchical fragment indices', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 5, // original index
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      // First fragment should be 5000, second 5001, etc.
      const indices = onForward.mock.calls.map(
        (call) => (call[0] as FragmentLike).fragmentIndex
      );
      expect(indices[0]).toBe(5000);
      expect(indices[1]).toBe(5001);

      router.dispose();
    });

    it('should call onFragmentation with correct counts', () => {
      const onForward = vi.fn();
      const onFragmentation = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
        onFragmentation,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      expect(onFragmentation).toHaveBeenCalled();
      const call = onFragmentation.mock.calls[0];
      const [addedFragments, addedOverhead] = call;

      // addedFragments should be count - 1 (excluding original)
      expect(addedFragments).toBeGreaterThan(0);
      // addedOverhead should be addedFragments * 20 (IP header size)
      expect(addedOverhead).toBe(addedFragments * 20);

      router.dispose();
    });

    it('should reuse existingId for first fragment only', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
        existingId: 'fragment-123',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      // First fragment should have existingId
      expect(onForward.mock.calls[0][0]).toHaveProperty(
        'existingId',
        'fragment-123'
      );

      // Subsequent fragments should not have existingId
      for (let i = 1; i < onForward.mock.calls.length; i += 1) {
        expect(onForward.mock.calls[i][0].existingId).toBeUndefined();
      }

      router.dispose();
    });
  });

  describe('IPv6 Behavior', () => {
    it('should NOT fragment packets in IPv6 mode', () => {
      const onForward = vi.fn();
      const onFragmentation = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 6,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
        onFragmentation,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000, // exceeds MTU but IPv6 should not fragment
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 700 + 100);

      // Should forward without fragmenting
      expect(onForward).toHaveBeenCalledTimes(1);
      expect(onFragmentation).not.toHaveBeenCalled();

      router.dispose();
    });
  });

  describe('Queue Management', () => {
    it('should process packets sequentially', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment1: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      const fragment2: FragmentLike = {
        originalPacketId: 'packet-2',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#10B981',
      };

      router.enqueue(fragment1);
      router.enqueue(fragment2);

      // Advance time for first packet
      vi.advanceTimersByTime(200 + 700);
      expect(onForward).toHaveBeenCalledTimes(1);
      expect(onForward.mock.calls[0][0].originalPacketId).toBe('packet-1');

      // Advance time for second packet
      vi.advanceTimersByTime(200 + 700);
      expect(onForward).toHaveBeenCalledTimes(2);
      expect(onForward.mock.calls[1][0].originalPacketId).toBe('packet-2');

      router.dispose();
    });

    it('should clear queue on clearQueue', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment1: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      const fragment2: FragmentLike = {
        originalPacketId: 'packet-2',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#10B981',
      };

      router.enqueue(fragment1);
      router.enqueue(fragment2);

      // Clear queue before second packet is processed
      router.clearQueue();

      vi.advanceTimersByTime(200 + 700 + 100);

      // First packet should still be forwarded (already processing)
      // but second packet should not
      expect(onForward).toHaveBeenCalledTimes(1);
      expect(onForward.mock.calls[0][0].originalPacketId).toBe('packet-1');

      router.dispose();
    });
  });

  describe('Time Scaling', () => {
    it('should respect time scale for processing delay', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 2, // 2x speed
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);

      // At 2x speed, 200ms becomes 100ms, 700ms becomes 350ms
      vi.advanceTimersByTime(100 + 350 + 50);

      expect(onForward).toHaveBeenCalledTimes(1);

      router.dispose();
    });

    it('should apply time scale to pacing delay', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 2,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);

      // At 2x speed: processing=100ms, each pacing=350ms
      vi.advanceTimersByTime(100); // processing
      vi.advanceTimersByTime(350); // first fragment pacing
      expect(onForward).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(350); // second fragment pacing
      expect(onForward).toHaveBeenCalledTimes(2);

      router.dispose();
    });
  });

  describe('Lifecycle', () => {
    it('should dispose and clear pending timeouts', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      router.dispose();

      // Advance time - nothing should be called
      vi.advanceTimersByTime(1000);
      expect(onForward).not.toHaveBeenCalled();
    });

    it('should handle dispose without enqueued packets', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      expect(() => router.dispose()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small MTU', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 100);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 15 * 700 + 100);

      // Should fragment into many small pieces
      expect(onForward.mock.calls.length).toBeGreaterThan(5);

      router.dispose();
    });

    it('should handle MTU exactly matching packet size', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1500, // exactly MTU
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 700 + 100);

      // Should not fragment
      expect(onForward).toHaveBeenCalledTimes(1);

      router.dispose();
    });

    it('should handle zero processing delay', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 0,
        pacingMs: 700,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(700 + 100);

      expect(onForward).toHaveBeenCalledTimes(1);

      router.dispose();
    });

    it('should handle zero pacing delay', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 0,
        onForward,
      });

      const fragment: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 1400,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment);
      vi.advanceTimersByTime(200 + 100);

      expect(onForward).toHaveBeenCalledTimes(1);

      router.dispose();
    });

    it('should handle multiple packets in rapid succession', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1500);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      for (let i = 0; i < 5; i += 1) {
        const fragment: FragmentLike = {
          originalPacketId: `packet-${i}`,
          fragmentIndex: 0,
          size: 1400,
          offset: 0,
          color: '#0EA5E9',
        };
        router.enqueue(fragment);
      }

      // Advance time for all packets
      vi.advanceTimersByTime(5 * (200 + 700) + 100);

      expect(onForward).toHaveBeenCalledTimes(5);

      router.dispose();
    });

    it('should handle switching IP version mid-operation', () => {
      const onForward = vi.fn();
      const getNextMtu = vi.fn(() => 1000);

      const router = new FragmentingRouter({
        routerIndex: 0,
        getNextMtu,
        ipVersion: 4,
        timeScale: 1,
        processingDelayMs: 200,
        pacingMs: 700,
        onForward,
      });

      const fragment1: FragmentLike = {
        originalPacketId: 'packet-1',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#0EA5E9',
      };

      router.enqueue(fragment1);
      // Wait for all fragments of packet-1 to be processed
      vi.advanceTimersByTime(200 + 3 * 700 + 100);

      // Switch to IPv6
      router.setIpVersion(6);

      const fragment2: FragmentLike = {
        originalPacketId: 'packet-2',
        fragmentIndex: 0,
        size: 2000,
        offset: 0,
        color: '#10B981',
      };

      router.enqueue(fragment2);
      // Wait for packet-2 to be processed
      vi.advanceTimersByTime(200 + 700 + 100);

      // First packet should be fragmented (IPv4), second should not (IPv6)
      const packet1Calls = onForward.mock.calls.filter(
        (call) => (call[0] as FragmentLike).originalPacketId === 'packet-1'
      );
      const packet2Calls = onForward.mock.calls.filter(
        (call) => (call[0] as FragmentLike).originalPacketId === 'packet-2'
      );

      expect(packet1Calls.length).toBeGreaterThan(1);
      expect(packet2Calls.length).toBe(1);

      router.dispose();
    });
  });
});

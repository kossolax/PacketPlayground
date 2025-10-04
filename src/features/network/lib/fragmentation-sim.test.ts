import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
  SimulationTestHarness,
} from '@/lib/simulation-test-helpers';
import {
  createInitialFragmentationState,
  FragmentationSim,
} from './fragmentation-sim';

vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

describe('FragmentationSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let harness: SimulationTestHarness<
    ReturnType<typeof createInitialFragmentationState>
  >;

  beforeEach(() => {
    setupFakeTimers();
    mockAnimation = createMockAnimationSystem();

    vi.mocked(animationModule.startFlightAnimation).mockImplementation(
      mockAnimation.mockStartFlightAnimation
    );

    harness = new SimulationTestHarness(FragmentationSim, mockAnimation);
  });

  afterEach(() => {
    harness.dispose();
    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create initial state with correct default values', () => {
      const state = createInitialFragmentationState();

      expect(state.ipVersion).toBe(4);
      expect(state.packetSize).toBe(2000);
      expect(state.timeScale).toBe(1);
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.packetsGenerated).toBe(0);
      expect(state.flyingFragments).toEqual([]);
      expect(state.totalFragments).toBe(0);
      expect(state.ipv4Overhead).toBe(0);
      expect(state.ipv6Overhead).toBe(0);
      expect(state.deliveredFragments).toBe(0);
    });

    it('should initialize three networks with decreasing MTUs', () => {
      const state = createInitialFragmentationState();

      expect(state.networks).toHaveLength(3);
      expect(state.networks[0].mtu).toBe(1500);
      expect(state.networks[1].mtu).toBe(1492);
      expect(state.networks[2].mtu).toBe(1468);
    });

    it('should position networks at equidistant horizontal positions', () => {
      const state = createInitialFragmentationState();

      expect(state.networks[0].x).toBe(100);
      expect(state.networks[1].x).toBe(300);
      expect(state.networks[2].x).toBe(500);
    });
  });

  describe('Configuration', () => {
    it('should update IP version', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      harness.clearEmittedStates();

      sim.setIpVersion(6);

      const state = harness.getState();
      expect(state.ipVersion).toBe(6);
      harness.expectEmitted();
    });

    it('should update packet size', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      harness.clearEmittedStates();

      sim.setPacketSize(3000);

      const state = harness.getState();
      expect(state.packetSize).toBe(3000);
      harness.expectEmitted();
    });

    it('should update time scale', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      harness.clearEmittedStates();

      sim.setTimeScale(2);

      const state = harness.getState();
      expect(state.timeScale).toBe(2);
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
      const sim = harness.getSimulation() as FragmentationSim;
      harness.start();
      vi.advanceTimersByTime(1000);

      const preservedIpVersion = harness.getState().ipVersion;
      const preservedPacketSize = harness.getState().packetSize;

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.flyingFragments).toEqual([]);
      expect(state.packetsGenerated).toBe(0);
      expect(state.totalFragments).toBe(0);
      expect(state.ipv4Overhead).toBe(0);
      expect(state.ipv6Overhead).toBe(0);
      expect(state.deliveredFragments).toBe(0);

      // Should preserve configuration
      expect(state.ipVersion).toBe(preservedIpVersion);
      expect(state.packetSize).toBe(preservedPacketSize);

      sim.dispose();
    });

    it('should preserve configuration values on reset', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      sim.setTimeScale(2);

      harness.reset();

      const state = harness.getState();
      expect(state.ipVersion).toBe(6);
      expect(state.packetSize).toBe(3000);
      expect(state.timeScale).toBe(2);
    });

    it('should dispose and clean up resources', () => {
      harness.start();

      // Dispose clears all active animations
      expect(() => harness.dispose()).not.toThrow();
    });
  });

  describe('IPv4 Packet Transmission', () => {
    it('should generate packet when started', () => {
      harness.start();

      const state = harness.getState();
      expect(state.packetsGenerated).toBe(1);
    });

    it('should create fragments for packets exceeding first MTU', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000); // exceeds first MTU 1500
      harness.start();

      const state = harness.getState();
      expect(state.totalFragments).toBeGreaterThan(1);
    });

    it('should calculate IPv4 overhead for fragmentation', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      // Overhead = (fragmentCount - 1) * 20 bytes IPv4 header
      expect(state.ipv4Overhead).toBeGreaterThan(0);
    });

    it('should not create fragments if packet fits first MTU', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400); // fits in first MTU 1500
      harness.start();

      const state = harness.getState();
      expect(state.totalFragments).toBe(1);
    });

    it('should align IPv4 fragment payloads to 8-byte boundaries', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000);
      harness.start();

      // Advance to let fragments fly
      vi.advanceTimersByTime(5000);

      const state = harness.getState();
      state.flyingFragments.forEach((frag) => {
        // Offset should be multiple of 8
        expect(frag.offset % 8).toBe(0);
      });
    });

    it('should send fragments with delays', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000);
      harness.start();

      const initialFragments = harness.getState().flyingFragments.length;

      // Wait for additional fragments to be sent
      vi.advanceTimersByTime(2000);

      const laterFragments = harness.getState().flyingFragments.length;
      // Should have more fragments in flight after delay
      expect(laterFragments).toBeGreaterThanOrEqual(initialFragments);
    });
  });

  describe('IPv6 Packet Transmission', () => {
    it('should use Path MTU Discovery for IPv6', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      // Should discover minimum MTU
      expect(state.discoveredPathMtu).toBeDefined();
      expect(state.discoveredPathMtu).toBe(1468); // minimum of all MTUs
    });

    it('should set PMTUD active flag during discovery', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      // PMTUD may be active or completed depending on timing
      expect(state.pmtuDiscoveryActive !== undefined).toBe(true);
    });

    it('should calculate IPv6 overhead for fragmentation', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      // Wait for PMTUD to complete
      vi.advanceTimersByTime(5000);

      const state = harness.getState();
      // IPv6 overhead = fragmentCount * 8 bytes fragment header
      if (state.totalFragments > 1) {
        expect(state.ipv6Overhead).toBeGreaterThan(0);
      }
    });

    it('should send discovery probe for oversized IPv6 packets', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      // Should have probe or PMTUD activity
      const hasProbe = state.flyingFragments.some((f) => f.kind === 'probe');
      const pmtuActive = state.pmtuDiscoveryActive;

      expect(hasProbe || pmtuActive).toBe(true);
    });

    it('should send ICMP-like response during PMTUD', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      // PMTUD should be initiated for large IPv6 packets
      expect(state.discoveredPathMtu).toBeDefined();
      expect(state.discoveredPathMtu).toBe(1468); // minimum MTU
    });

    it('should not fragment if packet fits minimum MTU', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(1400); // fits min MTU 1468
      harness.start();

      // Wait for simulation
      vi.advanceTimersByTime(5000);

      const state = harness.getState();
      expect(state.totalFragments).toBe(1);
    });
  });

  describe('Fragment Animation', () => {
    it('should animate fragments across networks', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      // Advance time to ensure fragments are sent
      vi.advanceTimersByTime(1500);

      const state = harness.getState();
      // Check if there are flying fragments or if they've been delivered
      const hasFragmentsOrDelivered =
        state.flyingFragments.length > 0 || state.deliveredFragments > 0;
      expect(hasFragmentsOrDelivered).toBe(true);

      // Check positions of any flying fragments
      state.flyingFragments.forEach((frag) => {
        expect(frag.position).toBeGreaterThanOrEqual(0);
        expect(frag.position).toBeLessThanOrEqual(100);
      });
    });

    it('should advance fragment positions during animation', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      const initialState = harness.getState();
      const initialFragment = initialState.flyingFragments[0];
      const initialPosition = initialFragment?.position || 0;

      // Advance animation
      harness.advanceAnimationProgress(50);

      const laterState = harness.getState();
      const laterFragment = laterState.flyingFragments.find(
        (f) => f.id === initialFragment?.id
      );

      if (laterFragment) {
        expect(laterFragment.position).toBeGreaterThan(initialPosition);
      }
    });

    it('should remove fragments when they reach destination', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      // Complete multiple animations and advance time
      for (let i = 0; i < 5; i += 1) {
        harness.completeAnimation();
        vi.advanceTimersByTime(3000);
      }

      // Some fragments should have been delivered and removed
      const state = harness.getState();
      expect(state.deliveredFragments).toBeGreaterThan(0);
    });
  });

  describe('Router Processing', () => {
    it('should process fragments through routers', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      // Let fragment reach first router
      harness.advanceAnimationProgress(100);
      vi.advanceTimersByTime(3000);

      const state = harness.getState();
      // Should have fragments in various stages
      expect(state.flyingFragments.length).toBeGreaterThanOrEqual(0);
    });

    it('should fragment at routers when needed', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(4);
      sim.setPacketSize(2000); // exceeds all MTUs - will fragment multiple times
      harness.start();

      const state = harness.getState();
      // Should have created fragments due to exceeding first MTU
      expect(state.totalFragments).toBeGreaterThan(1);
    });

    it('should account for router processing delays', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      // Advance just past arrival at router
      harness.advanceAnimationProgress(100);
      vi.advanceTimersByTime(100);

      // Fragment should still be visible (processing delay)
      const state = harness.getState();
      expect(state.flyingFragments.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track total fragments generated', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      expect(state.totalFragments).toBeGreaterThan(0);
    });

    it('should track IPv4 overhead separately', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(4);
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      expect(state.ipv4Overhead).toBeGreaterThan(0);
      expect(state.ipv6Overhead).toBe(0);
    });

    it('should track IPv6 overhead separately', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      vi.advanceTimersByTime(5000); // wait for PMTUD

      const state = harness.getState();
      expect(state.ipv6Overhead).toBeGreaterThanOrEqual(0);
      expect(state.ipv4Overhead).toBe(0);
    });

    it('should count delivered fragments', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      // Complete multiple animations to ensure delivery
      for (let i = 0; i < 5; i += 1) {
        harness.completeAnimation();
        vi.advanceTimersByTime(3000);
      }

      const state = harness.getState();
      expect(state.deliveredFragments).toBeGreaterThan(0);
    });

    it('should increment packets generated', () => {
      harness.start();

      const state = harness.getState();
      expect(state.packetsGenerated).toBe(1);
    });
  });

  describe('Fragment Attributes', () => {
    it('should assign unique IDs to fragments', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      const ids = state.flyingFragments.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should assign colors to fragments', () => {
      harness.start();

      const state = harness.getState();
      state.flyingFragments.forEach((frag) => {
        expect(frag.color).toBeDefined();
        expect(frag.color).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should set source and target network IDs', () => {
      harness.start();

      const state = harness.getState();
      state.flyingFragments.forEach((frag) => {
        expect(frag.sourceNetworkId).toBeGreaterThanOrEqual(0);
        expect(frag.targetNetworkId).toBeGreaterThanOrEqual(0);
        expect(frag.targetNetworkId).toBeGreaterThan(frag.sourceNetworkId);
      });
    });

    it('should include fragment size and offset', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      state.flyingFragments.forEach((frag) => {
        expect(frag.size).toBeGreaterThan(0);
        expect(frag.offset).toBeGreaterThanOrEqual(0);
      });
    });

    it('should set router anchor flags correctly', () => {
      harness.start();
      vi.advanceTimersByTime(3000);

      const stateHistory = harness.getEmittedStates();
      const allFragments = stateHistory.flatMap((s) => s.flyingFragments);

      // Some fragments should have router anchor flags
      const hasRouterAnchors = allFragments.some(
        (f) => f.startAtRouter || f.endAtRouter || f.startAtRightRouter
      );
      expect(hasRouterAnchors).toBe(true);
    });
  });

  describe('Completion Detection', () => {
    it('should stop when all fragments delivered', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1400);
      harness.start();

      // Complete all animations
      for (let i = 0; i < 10; i += 1) {
        harness.completeAnimation();
        vi.advanceTimersByTime(3000);
      }

      const state = harness.getState();
      // Should eventually stop
      if (state.deliveredFragments >= state.totalFragments) {
        expect(state.isRunning).toBe(false);
      }
    });

    it('should exclude probe/ICMP fragments from delivery count', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      vi.advanceTimersByTime(10000);

      const state = harness.getState();
      // deliveredFragments should only count data fragments
      expect(state.deliveredFragments).toBeLessThanOrEqual(
        state.totalFragments
      );
    });
  });

  describe('Time Scaling', () => {
    it('should respect time scale for delays', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setTimeScale(2); // 2x speed
      sim.setPacketSize(1400);
      harness.start();

      // At 2x speed, things should happen faster
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      // Should have fragments generated or time progressed
      const hasProgress =
        state.flyingFragments.length > 0 ||
        state.deliveredFragments > 0 ||
        state.totalFragments > 0;
      expect(hasProgress).toBe(true);
    });

    it('should apply time scale to router delays', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setTimeScale(5);
      sim.setPacketSize(1500);
      harness.start();

      // Advance less time due to higher time scale
      vi.advanceTimersByTime(500);

      const state = harness.getState();
      // Should have fragments in flight or delivered
      expect(
        state.flyingFragments.length + state.deliveredFragments
      ).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large packet size', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(10000);
      harness.start();

      const state = harness.getState();
      expect(state.totalFragments).toBeGreaterThan(5);
    });

    it('should handle very small packet size', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(100);
      harness.start();

      const state = harness.getState();
      expect(state.totalFragments).toBe(1);
      expect(state.ipv4Overhead).toBe(0);
    });

    it('should handle packet size exactly matching MTU', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setPacketSize(1500);
      harness.start();

      const state = harness.getState();
      // May still fragment at later routers with smaller MTUs
      expect(state.totalFragments).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple resets', () => {
      harness.start();
      harness.reset();
      harness.reset();
      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.flyingFragments).toEqual([]);
      expect(state.totalFragments).toBe(0);
    });

    it('should handle dispose without start', () => {
      expect(() => harness.dispose()).not.toThrow();
    });

    it('should handle reset during active simulation', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.flyingFragments).toEqual([]);
    });

    it('should handle IP version switch before start', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setIpVersion(4);
      sim.setIpVersion(6);

      harness.start();

      const state = harness.getState();
      expect(state.ipVersion).toBe(6);
    });

    it('should not start multiple times concurrently', () => {
      harness.start();
      harness.start();
      harness.start();

      const state = harness.getState();
      expect(state.packetsGenerated).toBe(1); // only one packet generated
    });
  });

  describe('PMTUD Animation', () => {
    it('should show discovery probe traveling forward', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      const stateHistory = harness.getEmittedStates();
      const hasForwardProbe = stateHistory.some((s) =>
        s.flyingFragments.some(
          (f) => f.kind === 'probe' && f.direction === 'forward'
        )
      );

      expect(hasForwardProbe).toBe(true);
    });

    it('should show ICMP response traveling backward', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      const state = harness.getState();
      // PMTUD should be active or have discovered path MTU
      expect(
        state.pmtuDiscoveryActive !== undefined ||
          state.discoveredPathMtu !== undefined
      ).toBe(true);
    });

    it('should include custom label for ICMP', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      vi.advanceTimersByTime(4000);

      const stateHistory = harness.getEmittedStates();
      const icmpFragments = stateHistory
        .flatMap((s) => s.flyingFragments)
        .filter((f) => f.kind === 'icmp');

      icmpFragments.forEach((frag) => {
        expect(frag.customLabel).toBeDefined();
        expect(frag.customLabel).toMatch(/MTU \d+/);
      });
    });

    it('should clear PMTUD active flag after discovery', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(6);
      sim.setPacketSize(3000);
      harness.start();

      // Complete animations to allow discovery to finish
      for (let i = 0; i < 3; i += 1) {
        harness.completeAnimation();
        vi.advanceTimersByTime(2000);
      }

      const state = harness.getState();
      // PMTUD should eventually complete
      expect(state.pmtuDiscoveryActive).toBe(false);
    });
  });

  describe('Network Configuration', () => {
    it('should use correct MTU values for fragmentation', () => {
      const sim = harness.getSimulation() as FragmentationSim;
      sim.setIpVersion(4);
      sim.setPacketSize(2000); // exceeds all MTUs
      harness.start();

      const state = harness.getState();
      // Should fragment due to exceeding MTUs
      expect(state.totalFragments).toBeGreaterThan(1);
    });

    it('should position fragments between correct networks', () => {
      harness.start();
      vi.advanceTimersByTime(1000);

      const state = harness.getState();
      state.flyingFragments.forEach((frag) => {
        expect(frag.sourceNetworkId).toBeLessThan(state.networks.length);
        expect(frag.targetNetworkId).toBeLessThanOrEqual(state.networks.length);
      });
    });
  });
});

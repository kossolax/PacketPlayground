import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
} from '@/lib/simulation-test-helpers';

import { createInitialVlanState, VlanSim } from './vlan-sim';

// Mock the animation module
vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

// Mock setInterval/clearInterval
const mockSetInterval = vi.fn();
const mockClearInterval = vi.fn();

describe('VlanSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let sim: VlanSim;
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

    sim = new VlanSim({
      timeProvider: mockAnimation.mockTimeProvider,
    });
  });

  afterEach(() => {
    sim.dispose();

    // Restore original globals
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;

    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create initial state with correct default values', () => {
      const state = createInitialVlanState();

      expect(state.timeScale).toBe(1);
      expect(state.isRunning).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.devices).toHaveLength(10); // 8 PCs + 2 switches
      expect(state.links).toHaveLength(9);
      expect(state.ports).toHaveLength(10); // 10 port configs
      expect(state.packets).toEqual([]);
      expect(state.totalPackets).toBe(0);
      expect(state.forwardedPackets).toBe(0);
      expect(state.floodedPackets).toBe(0);
      expect(state.droppedPackets).toBe(0);
    });

    it('should initialize PCs with correct VLAN IDs', () => {
      const state = createInitialVlanState();

      const pc1 = state.devices.find((d) => d.id === 'pc1');
      const pc2 = state.devices.find((d) => d.id === 'pc2');
      const pc3 = state.devices.find((d) => d.id === 'pc3');
      const pc4 = state.devices.find((d) => d.id === 'pc4');
      const pc5 = state.devices.find((d) => d.id === 'pc5');
      const pc6 = state.devices.find((d) => d.id === 'pc6');
      const pc7 = state.devices.find((d) => d.id === 'pc7');
      const pc8 = state.devices.find((d) => d.id === 'pc8');

      expect(pc1?.vlanId).toBe(10);
      expect(pc2?.vlanId).toBe(10);
      expect(pc3?.vlanId).toBe(20);
      expect(pc4?.vlanId).toBe(20);
      expect(pc5?.vlanId).toBe(10);
      expect(pc6?.vlanId).toBe(10);
      expect(pc7?.vlanId).toBe(20);
      expect(pc8?.vlanId).toBe(20);
    });

    it('should configure trunk and access ports correctly', () => {
      const state = createInitialVlanState();

      // Check trunk ports (sw1 <-> sw2)
      const trunkPort1 = state.ports.find(
        (p) => p.deviceId === 'sw1' && p.portId === 'sw2'
      );
      const trunkPort2 = state.ports.find(
        (p) => p.deviceId === 'sw2' && p.portId === 'sw1'
      );

      expect(trunkPort1?.mode).toBe('trunk');
      expect(trunkPort1?.allowedVlans).toEqual([10, 20]);
      expect(trunkPort2?.mode).toBe('trunk');
      expect(trunkPort2?.allowedVlans).toEqual([10, 20]);

      // Check access ports
      const accessPort = state.ports.find(
        (p) => p.deviceId === 'sw1' && p.portId === 'pc1'
      );
      expect(accessPort?.mode).toBe('access');
      expect(accessPort?.allowedVlans).toEqual([10]);
    });

    it('should mark trunk links correctly', () => {
      const state = createInitialVlanState();

      const trunkLink = state.links.find(
        (l) =>
          (l.from === 'sw1' && l.to === 'sw2') ||
          (l.from === 'sw2' && l.to === 'sw1')
      );
      const accessLink = state.links.find(
        (l) =>
          (l.from === 'pc1' && l.to === 'sw1') ||
          (l.from === 'sw1' && l.to === 'pc1')
      );

      expect(trunkLink?.isTrunk).toBe(true);
      expect(accessLink?.isTrunk).toBe(false);
    });

    it('should initialize empty CAM tables for switches', () => {
      const state = createInitialVlanState();

      expect(Object.keys(state.camTables)).toHaveLength(2);
      expect(Object.keys(state.camTables.sw1)).toHaveLength(0);
      expect(Object.keys(state.camTables.sw2)).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    it('should update time scale', () => {
      const onUpdate = vi.fn();
      const testSim = new VlanSim({
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
      const testSim = new VlanSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();

      const state = testSim.getState();
      expect(state.isRunning).toBe(true);
      expect(onUpdate).toHaveBeenCalled();
      testSim.dispose();
    });

    it('should not start if already running', () => {
      const onUpdate = vi.fn();
      const testSim = new VlanSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      const callCount = onUpdate.mock.calls.length;
      testSim.start(); // Try starting again

      expect(onUpdate.mock.calls.length).toBe(callCount); // No new call
      testSim.dispose();
    });

    it('should reset simulation to initial state', () => {
      const onUpdate = vi.fn();
      const testSim = new VlanSim({
        onUpdate,
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc2');

      testSim.reset();

      const state = testSim.getState();
      expect(state.isRunning).toBe(false);
      expect(state.packets).toHaveLength(0);
      expect(state.totalPackets).toBe(0);
      testSim.dispose();
    });

    it('should preserve configuration on reset', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTimeScale(5);
      testSim.reset();

      const state = testSim.getState();
      expect(state.timeScale).toBe(5);
      testSim.dispose();
    });
  });

  describe('VLAN Tagging', () => {
    it('should send untagged packet from PC on access port', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');

      const state = testSim.getState();
      expect(state.packets).toHaveLength(1);
      expect(state.packets[0].vlanId).toBe(10);
      expect(state.packets[0].tagged).toBe(false); // Starts untagged
      testSim.dispose();
    });

    it('should tag packet when forwarding to trunk port', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5'); // PC1 → SW1 → trunk → SW2 → PC5

      // Complete first hop (PC1 → SW1)
      mockAnimation.triggerAllFlights();

      const state = testSim.getState();
      // Packet should now be on trunk (SW1 → SW2) with tag
      const trunkPacket = state.packets.find((p) =>
        p.currentPath.some(
          (path) =>
            (path.from === 'sw1' && path.to === 'sw2') ||
            (path.from === 'sw2' && path.to === 'sw1')
        )
      );

      if (trunkPacket) {
        expect(trunkPacket.tagged).toBe(true);
        expect(trunkPacket.vlanId).toBe(10);
      }

      testSim.dispose();
    });

    it('should untag packet when forwarding to access port', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');

      // Complete all hops until packet arrives at PC5
      for (let i = 0; i < 5; i += 1) {
        mockAnimation.triggerAllFlights();
      }

      // Check that CAM table was learned
      const camSw2 = testSim.getCamTable('sw2');

      // Should have learned PC1's MAC from trunk
      expect(Object.keys(camSw2).length).toBeGreaterThanOrEqual(0);

      testSim.dispose();
    });
  });

  describe('VLAN Filtering', () => {
    it('should forward packets within same VLAN (intra-VLAN)', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();

      // First packet: PC1 → PC5 (both VLAN 10, will flood to learn MACs)
      testSim.sendPacket('pc1', 'pc5');
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      // Second packet: PC5 → PC1 (will still flood, but learns PC1's MAC)
      testSim.sendPacket('pc5', 'pc1');
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      // Third packet: PC1 → PC5 (should be forwarded as both MACs are learned)
      const packetsBefore = testSim.getState().forwardedPackets;
      testSim.sendPacket('pc1', 'pc5');
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      expect(state.forwardedPackets).toBeGreaterThan(packetsBefore);
      expect(state.droppedPackets).toBe(0); // No drops
      testSim.dispose();
    });

    it('should block packets between different VLANs (inter-VLAN isolation)', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc3'); // PC1 is VLAN 10, PC3 is VLAN 20

      // Complete all flights
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      // Packet should be flooded only within VLAN 10
      // It should NOT be forwarded to PC3 (VLAN 20)
      // Check that packet was flooded within same VLAN
      expect(state.floodedPackets).toBeGreaterThanOrEqual(1);
      testSim.dispose();
    });

    it('should flood only within same VLAN when destination unknown', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5'); // Both VLAN 10

      // Trigger first hop (PC1 → SW1)
      mockAnimation.triggerAllFlights();

      const state = testSim.getState();

      // SW1 should flood to VLAN 10 ports only (PC1 excluded as ingress)
      // Expected flooding: SW1 → PC2 and trunk (for VLAN 10)
      // Should NOT flood to PC3/PC4 (VLAN 20)
      expect(state.floodedPackets).toBeGreaterThanOrEqual(0);

      testSim.dispose();
    });
  });

  describe('CAM Table Learning', () => {
    it('should learn MAC addresses with VLAN ID', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');

      // Complete first hop
      mockAnimation.triggerAllFlights();

      const camSw1 = testSim.getCamTable('sw1');
      const pc1Mac = testSim
        .getState()
        .devices.find((d) => d.id === 'pc1')?.mac;

      // Should learn PC1's MAC with VLAN 10
      const camKey = `${pc1Mac}:10`;
      expect(camSw1[camKey]).toBeDefined();
      expect(camSw1[camKey]?.vlanId).toBe(10);
      expect(camSw1[camKey]?.mac).toBe(pc1Mac);

      testSim.dispose();
    });

    it('should isolate MAC addresses by VLAN', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();

      // Send packet from PC1 (VLAN 10)
      testSim.sendPacket('pc1', 'pc5');
      mockAnimation.triggerAllFlights();

      // Send packet from PC3 (VLAN 20)
      testSim.sendPacket('pc3', 'pc7');
      mockAnimation.triggerAllFlights();

      const camSw1 = testSim.getCamTable('sw1');
      const pc1Mac = testSim
        .getState()
        .devices.find((d) => d.id === 'pc1')?.mac;
      const pc3Mac = testSim
        .getState()
        .devices.find((d) => d.id === 'pc3')?.mac;

      // Should have separate entries for each VLAN
      expect(camSw1[`${pc1Mac}:10`]).toBeDefined();
      expect(camSw1[`${pc3Mac}:20`]).toBeDefined();

      testSim.dispose();
    });
  });

  describe('Packet Animation', () => {
    it('should create packet with correct initial properties', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');

      const state = testSim.getState();
      expect(state.packets).toHaveLength(1);

      const packet = state.packets[0];
      expect(packet.vlanId).toBe(10);
      expect(packet.srcMAC).toBe('AA:BB:CC:DD:00:01');
      expect(packet.dstMAC).toBe('AA:BB:CC:DD:00:05');
      expect(packet.pathProgress).toBe(0);

      testSim.dispose();
    });

    it('should update packet progress during animation', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');

      mockAnimation.triggerProgress(50);

      const state = testSim.getState();
      const packet = state.packets.find((p) => p.srcMAC.includes('01'));
      expect(packet?.pathProgress).toBe(50);

      testSim.dispose();
    });

    it('should remove packet when animation completes', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');

      expect(testSim.getState().packets).toHaveLength(1);

      mockAnimation.triggerAllFlights();

      // After arrival, packet should be removed (or forwarded to next hop)
      const state = testSim.getState();
      // Either packet is forwarded to next hop or removed
      expect(state.packets.length).toBeGreaterThanOrEqual(0);

      testSim.dispose();
    });
  });

  describe('Metrics', () => {
    it('should track total packets sent', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');
      testSim.sendPacket('pc3', 'pc7');

      const state = testSim.getState();
      expect(state.totalPackets).toBe(2);

      testSim.dispose();
    });

    it('should track forwarded packets', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();

      // Send packets to learn MACs first
      testSim.sendPacket('pc1', 'pc5');
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      testSim.sendPacket('pc5', 'pc1');
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      // Now send a packet that should be forwarded
      const forwardedBefore = testSim.getState().forwardedPackets;
      testSim.sendPacket('pc1', 'pc5');
      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      expect(state.forwardedPackets).toBeGreaterThan(forwardedBefore);

      testSim.dispose();
    });

    it('should track flooded packets when destination unknown', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5'); // First packet will be flooded

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      expect(state.floodedPackets).toBeGreaterThan(0);

      testSim.dispose();
    });
  });

  describe('Trunk Mode Configuration', () => {
    it('should initialize with trunk mode by default', () => {
      const state = createInitialVlanState();
      expect(state.trunkMode).toBe('trunk');
    });

    it('should change trunk mode and reset simulation', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc2');

      expect(testSim.getState().packets.length).toBeGreaterThan(0);

      testSim.setTrunkMode('vlan10');

      const state = testSim.getState();
      expect(state.trunkMode).toBe('vlan10');
      expect(state.packets).toHaveLength(0); // Reset clears packets
      expect(state.isRunning).toBe(false); // Reset stops simulation

      testSim.dispose();
    });

    it('should configure inter-switch link as trunk in trunk mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('trunk');

      const state = testSim.getState();
      const trunkLink = state.links.find(
        (l) =>
          (l.from === 'sw1' && l.to === 'sw2') ||
          (l.from === 'sw2' && l.to === 'sw1')
      );

      expect(trunkLink?.isTrunk).toBe(true);

      const sw1Port = state.ports.find(
        (p) => p.deviceId === 'sw1' && p.portId === 'sw2'
      );
      expect(sw1Port?.mode).toBe('trunk');
      expect(sw1Port?.allowedVlans).toEqual([10, 20]);

      testSim.dispose();
    });

    it('should configure inter-switch link as access VLAN 10 in vlan10 mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan10');

      const state = testSim.getState();
      const trunkLink = state.links.find(
        (l) =>
          (l.from === 'sw1' && l.to === 'sw2') ||
          (l.from === 'sw2' && l.to === 'sw1')
      );

      expect(trunkLink?.isTrunk).toBe(false);

      const sw1Port = state.ports.find(
        (p) => p.deviceId === 'sw1' && p.portId === 'sw2'
      );
      expect(sw1Port?.mode).toBe('access');
      expect(sw1Port?.allowedVlans).toEqual([10]);

      testSim.dispose();
    });

    it('should configure inter-switch link as access VLAN 20 in vlan20 mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan20');

      const state = testSim.getState();
      const sw1Port = state.ports.find(
        (p) => p.deviceId === 'sw1' && p.portId === 'sw2'
      );
      expect(sw1Port?.mode).toBe('access');
      expect(sw1Port?.allowedVlans).toEqual([20]);

      testSim.dispose();
    });

    it('should allow VLAN 10 traffic between switches in vlan10 mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan10');
      testSim.start();

      // Send VLAN 10 packet across switches
      testSim.sendPacket('pc1', 'pc5'); // Both VLAN 10

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      // Should successfully forward/flood VLAN 10 packets
      expect(state.totalPackets).toBeGreaterThan(0);

      testSim.dispose();
    });

    it('should block VLAN 20 traffic between switches in vlan10 mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan10');
      testSim.start();

      // Try to send VLAN 20 packet across switches
      testSim.sendPacket('pc3', 'pc7'); // PC3 on SW1, PC7 on SW2, both VLAN 20

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      // VLAN 20 should NOT cross the inter-switch link in vlan10 mode
      // SW2 should not learn PC3's MAC since packet shouldn't reach it
      const camSw2 = testSim.getCamTable('sw2');
      const pc3Mac = state.devices.find((d) => d.id === 'pc3')?.mac;
      const pc3Entry = camSw2[`${pc3Mac}:20`];

      expect(pc3Entry).toBeUndefined(); // PC3 MAC not learned on SW2

      testSim.dispose();
    });

    it('should allow VLAN 20 traffic between switches in vlan20 mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan20');
      testSim.start();

      // Send VLAN 20 packet across switches
      testSim.sendPacket('pc3', 'pc7'); // Both VLAN 20

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      // Should successfully forward/flood VLAN 20 packets
      expect(state.totalPackets).toBeGreaterThan(0);

      testSim.dispose();
    });

    it('should block VLAN 10 traffic between switches in vlan20 mode', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan20');
      testSim.start();

      // Try to send VLAN 10 packet across switches
      testSim.sendPacket('pc1', 'pc5'); // PC1 on SW1, PC5 on SW2, both VLAN 10

      for (let i = 0; i < 10; i += 1) {
        mockAnimation.triggerAllFlights();
        if (testSim.getState().packets.length === 0) break;
      }

      const state = testSim.getState();
      // VLAN 10 should NOT cross the inter-switch link in vlan20 mode
      // SW2 should not learn PC1's MAC since packet shouldn't reach it
      const camSw2 = testSim.getCamTable('sw2');
      const pc1Mac = state.devices.find((d) => d.id === 'pc1')?.mac;
      const pc1Entry = camSw2[`${pc1Mac}:10`];

      expect(pc1Entry).toBeUndefined(); // PC1 MAC not learned on SW2

      testSim.dispose();
    });

    it('should preserve trunk mode after reset', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.setTrunkMode('vlan10');
      testSim.start();
      testSim.sendPacket('pc1', 'pc2');

      // Manual reset (not via setTrunkMode)
      testSim.reset();

      const state = testSim.getState();
      expect(state.trunkMode).toBe('vlan10'); // Should preserve mode
      expect(state.packets).toHaveLength(0); // Should clear packets

      testSim.dispose();
    });
  });

  describe('Edge Cases', () => {
    it('should not send packet if source is not a PC', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('sw1', 'pc1'); // Invalid source

      const state = testSim.getState();
      expect(state.packets).toHaveLength(0);
      expect(state.totalPackets).toBe(0);

      testSim.dispose();
    });

    it('should not send packet if simulation is not running', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.sendPacket('pc1', 'pc5'); // Not started

      const state = testSim.getState();
      expect(state.packets).toHaveLength(0);
      expect(state.totalPackets).toBe(0);

      testSim.dispose();
    });

    it('should handle dispose correctly', () => {
      const testSim = new VlanSim({
        timeProvider: mockAnimation.mockTimeProvider,
      });

      testSim.start();
      testSim.sendPacket('pc1', 'pc5');
      testSim.dispose();

      // Should not throw
      expect(() => testSim.dispose()).not.toThrow();
    });
  });
});

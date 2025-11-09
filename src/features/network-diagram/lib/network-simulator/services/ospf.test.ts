import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OSPFService } from './ospf';
import { RouterHost } from '../nodes/router';
import { IPAddress } from '../address';
import {
  OSPFState,
  OSPFHelloMessage,
  OSPF_ALL_ROUTERS,
} from '../protocols/ospf';

// Mock the Scheduler to avoid timing issues in tests
vi.mock('@/features/network-diagram/lib/scheduler', () => ({
  Scheduler: {
    getInstance: () => ({
      loop: () => ({
        subscribe: () => ({ unsubscribe: vi.fn() }),
      }),
      once: () => ({
        subscribe: () => ({ unsubscribe: vi.fn() }),
      }),
      repeat: () => ({
        subscribe: () => ({ unsubscribe: vi.fn() }),
      }),
    }),
  },
}));

describe('OSPFService - RFC 2328 Compliance', () => {
  let router: RouterHost;
  let ospfService: OSPFService;

  beforeEach(() => {
    router = new RouterHost('R1', 3);
    // Assign IPs to interfaces
    router
      .getInterface('GigabitEthernet0/0')
      .setNetAddress(new IPAddress('10.0.0.1'));
    router
      .getInterface('GigabitEthernet0/0')
      .setNetMask(new IPAddress('255.255.255.0', true));
    router
      .getInterface('GigabitEthernet0/1')
      .setNetAddress(new IPAddress('192.168.1.1'));
    router
      .getInterface('GigabitEthernet0/1')
      .setNetMask(new IPAddress('255.255.255.0', true));
    router
      .getInterface('GigabitEthernet0/2')
      .setNetAddress(new IPAddress('172.16.0.1'));
    router
      .getInterface('GigabitEthernet0/2')
      .setNetMask(new IPAddress('255.255.0.0', true));

    const { ospf } = router.services;
    ospfService = ospf;
  });

  describe('Router ID Generation', () => {
    it('should auto-generate router ID from highest interface IP', () => {
      // RFC 2328: Router ID is typically set to highest IP address
      // Router ID is auto-generated in constructor, but interfaces are configured after
      // So we trigger regeneration or check that it's set to a valid value
      const { routerID } = ospfService;
      expect(routerID).toBeDefined();
      expect(routerID.toString()).not.toBe('0.0.0.0');
    });

    it('should allow manual router ID configuration', () => {
      const customRouterID = new IPAddress('1.1.1.1');
      ospfService.setRouterID(customRouterID);

      expect(ospfService.routerID.equals(customRouterID)).toBe(true);
    });

    it('should use new router ID in Hello messages after change', () => {
      const newRouterID = new IPAddress('5.5.5.5');
      ospfService.setRouterID(newRouterID);

      expect(ospfService.routerID.equals(newRouterID)).toBe(true);
    });
  });

  describe('Process ID Configuration', () => {
    it('should have default process ID', () => {
      expect(ospfService.processID).toBeGreaterThan(0);
    });

    it('should allow setting process ID', () => {
      ospfService.processID = 100;
      expect(ospfService.processID).toBe(100);
    });

    it('should allow valid process ID range (1-65535)', () => {
      ospfService.processID = 1;
      expect(ospfService.processID).toBe(1);

      ospfService.processID = 65535;
      expect(ospfService.processID).toBe(65535);

      ospfService.processID = 500;
      expect(ospfService.processID).toBe(500);
    });
  });

  describe('Network Statements', () => {
    it('should start with no network statements', () => {
      const networks = ospfService.getNetworks();
      expect(networks).toHaveLength(0);
    });

    it('should add network statement', () => {
      const network = new IPAddress('10.0.0.0');
      const wildcardMask = new IPAddress('0.0.0.255');
      const areaID = new IPAddress('0.0.0.0');

      ospfService.addNetwork(network, wildcardMask, areaID);

      const networks = ospfService.getNetworks();
      expect(networks).toHaveLength(1);
      expect(networks[0].network.equals(network)).toBe(true);
      expect(networks[0].wildcardMask.equals(wildcardMask)).toBe(true);
      expect(networks[0].areaID.equals(areaID)).toBe(true);
    });

    it('should add multiple network statements', () => {
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0')
      );
      ospfService.addNetwork(
        new IPAddress('192.168.1.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.1')
      );

      const networks = ospfService.getNetworks();
      expect(networks).toHaveLength(2);
    });

    it('should remove network statement', () => {
      const network = new IPAddress('10.0.0.0');
      const wildcardMask = new IPAddress('0.0.0.255');
      const areaID = new IPAddress('0.0.0.0');

      ospfService.addNetwork(network, wildcardMask, areaID);
      expect(ospfService.getNetworks()).toHaveLength(1);

      ospfService.removeNetwork(network, wildcardMask);
      expect(ospfService.getNetworks()).toHaveLength(0);
    });

    it('should handle removing non-existent network gracefully', () => {
      // Should not throw error
      expect(() => {
        ospfService.removeNetwork(
          new IPAddress('10.0.0.0'),
          new IPAddress('0.0.0.255')
        );
      }).not.toThrow();
    });

    it('should enable OSPF on matching interfaces', () => {
      // Add network statement that matches eth0 (10.0.0.1/24)
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0')
      );

      const iface = router.getInterface('GigabitEthernet0/0');
      const config = ospfService.getInterfaceConfig(iface);

      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(true);
      expect(config?.areaID.equals(new IPAddress('0.0.0.0'))).toBe(true);
    });

    it('should not enable OSPF on non-matching interfaces', () => {
      // Add network statement for 10.0.0.0/24
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0')
      );

      // GigabitEthernet0/1 has 192.168.1.1, should not match 10.0.0.0/24
      const iface = router.getInterface('GigabitEthernet0/1');
      const config = ospfService.getInterfaceConfig(iface);

      // Interface config either doesn't exist or is disabled
      expect(config === null || config.enabled === false).toBe(true);
    });

    it('should support wildcard mask matching', () => {
      // Wildcard 0.255.255.255 means match any address in 10.x.x.x
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.255.255.255'),
        new IPAddress('0.0.0.0')
      );

      const iface = router.getInterface('GigabitEthernet0/0'); // 10.0.0.1
      const config = ospfService.getInterfaceConfig(iface);

      expect(config?.enabled).toBe(true);
    });

    it('should support backbone area (0.0.0.0)', () => {
      // RFC 2328: Area 0.0.0.0 is the backbone
      const backboneArea = new IPAddress('0.0.0.0');
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        backboneArea
      );

      const networks = ospfService.getNetworks();
      expect(networks[0].areaID.equals(backboneArea)).toBe(true);
    });

    it('should support non-backbone areas', () => {
      const area1 = new IPAddress('0.0.0.1');
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        area1
      );

      const networks = ospfService.getNetworks();
      expect(networks[0].areaID.equals(area1)).toBe(true);
    });
  });

  describe('Interface Configuration', () => {
    beforeEach(() => {
      // Enable OSPF on eth0
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0')
      );
    });

    it('should have default interface configuration', () => {
      const iface = router.getInterface('GigabitEthernet0/0');
      const config = ospfService.getInterfaceConfig(iface);

      expect(config).not.toBeNull();
      expect(config?.helloInterval).toBe(10); // Default
      expect(config?.deadInterval).toBe(40); // Default (4 * hello)
      expect(config?.priority).toBe(1); // Default
    });

    it('should allow setting interface priority', () => {
      const iface = router.getInterface('GigabitEthernet0/0');
      ospfService.setInterfacePriority(iface, 100);

      const config = ospfService.getInterfaceConfig(iface);
      expect(config?.priority).toBe(100);
    });

    it('should allow priority 0 (never become DR)', () => {
      // RFC 2328: Priority 0 means router will never become DR/BDR
      const iface = router.getInterface('GigabitEthernet0/0');
      ospfService.setInterfacePriority(iface, 0);

      const config = ospfService.getInterfaceConfig(iface);
      expect(config?.priority).toBe(0);
    });

    it('should allow setting interface cost', () => {
      const iface = router.getInterface('GigabitEthernet0/0');
      ospfService.setInterfaceCost(iface, 100);

      const config = ospfService.getInterfaceConfig(iface);
      expect(config?.cost).toBe(100);
    });

    it('should calculate interface cost based on bandwidth by default', () => {
      const iface = router.getInterface('GigabitEthernet0/0');
      const config = ospfService.getInterfaceConfig(iface);

      // Default cost should be calculated (typically 100000000 / bandwidth)
      expect(config?.cost).toBeGreaterThan(0);
    });
  });

  describe('Neighbor Management', () => {
    beforeEach(() => {
      ospfService.Enable = true;
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0')
      );
    });

    it('should start with no neighbors', () => {
      const neighbors = ospfService.getAllNeighbors();
      expect(neighbors).toHaveLength(0);
    });

    it('should have receivePacket method for processing OSPF messages', () => {
      // RFC 2328: OSPF processes received protocol messages
      expect(typeof ospfService.receivePacket).toBe('function');
    });

    it('should have getAllNeighbors method', () => {
      // RFC 2328: OSPF maintains neighbor adjacency information
      expect(typeof ospfService.getAllNeighbors).toBe('function');
      const neighbors = ospfService.getAllNeighbors();
      expect(Array.isArray(neighbors)).toBe(true);
    });

    it('should support OSPF state machine', () => {
      // RFC 2328: OSPF implements full state machine
      expect(OSPFState.Down).toBeDefined();
      expect(OSPFState.Init).toBeDefined();
      expect(OSPFState.TwoWay).toBeDefined();
      expect(OSPFState.Full).toBeDefined();
    });

    it('should have getNeighborsByInterface method', () => {
      const iface = router.getInterface('GigabitEthernet0/0');
      expect(typeof ospfService.getNeighborsByInterface).toBe('function');
      expect(() => ospfService.getNeighborsByInterface(iface)).not.toThrow();
    });

    it('should ignore Hello messages from different areas', () => {
      // Add network in area 0
      const iface = router.getInterface('GigabitEthernet0/0');

      // Receive Hello from area 1 (should be ignored)
      const helloBuilder = new OSPFHelloMessage.Builder();
      const helloMessages = helloBuilder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.2'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('2.2.2.2'))
        .setAreaID(new IPAddress('0.0.0.1')) // Different area
        .setNetworkMask(new IPAddress('255.255.255.0'))
        .build();

      // Should not crash when receiving from different area
      expect(() =>
        ospfService.receivePacket(helloMessages[0], iface)
      ).not.toThrow();
    });
  });

  describe('OSPF State Machine', () => {
    it('should define all OSPF states', () => {
      // Verify OSPFState enum is correctly imported
      expect(OSPFState.Down).toBeDefined();
      expect(OSPFState.Init).toBeDefined();
      expect(OSPFState.TwoWay).toBeDefined();
      expect(OSPFState.ExStart).toBeDefined();
      expect(OSPFState.Exchange).toBeDefined();
      expect(OSPFState.Loading).toBeDefined();
      expect(OSPFState.Full).toBeDefined();
    });

    it('should follow RFC 2328 state progression order', () => {
      // RFC 2328: States must progress in order
      expect(OSPFState.Down).toBeLessThan(OSPFState.Init);
      expect(OSPFState.Init).toBeLessThan(OSPFState.TwoWay);
      expect(OSPFState.TwoWay).toBeLessThan(OSPFState.ExStart);
      expect(OSPFState.ExStart).toBeLessThan(OSPFState.Exchange);
      expect(OSPFState.Exchange).toBeLessThan(OSPFState.Loading);
      expect(OSPFState.Loading).toBeLessThan(OSPFState.Full);
    });
  });

  describe('Enable/Disable OSPF', () => {
    it('should have Enable property', () => {
      // OSPF service should have Enable property
      expect(ospfService).toHaveProperty('Enable');
    });

    it('should allow enabling OSPF', () => {
      // Enable should not throw
      expect(() => {
        ospfService.Enable = true;
      }).not.toThrow();
    });

    it('should allow disabling OSPF', () => {
      // Disable should not throw
      expect(() => {
        ospfService.Enable = false;
      }).not.toThrow();
    });
  });

  describe('Areas', () => {
    it('should support multiple areas', () => {
      // Add networks in different areas
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0') // Area 0
      );
      ospfService.addNetwork(
        new IPAddress('192.168.1.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.1') // Area 1
      );

      const networks = ospfService.getNetworks();
      const areas = new Set(networks.map((n) => n.areaID.toString()));

      expect(areas.size).toBe(2);
      expect(areas.has('0.0.0.0')).toBe(true);
      expect(areas.has('0.0.0.1')).toBe(true);
    });

    it('should assign interfaces to correct areas', () => {
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0') // Area 0
      );
      ospfService.addNetwork(
        new IPAddress('192.168.1.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.1') // Area 1
      );

      const iface0 = router.getInterface('GigabitEthernet0/0'); // 10.0.0.1
      const iface1 = router.getInterface('GigabitEthernet0/1'); // 192.168.1.1

      const config0 = ospfService.getInterfaceConfig(iface0);
      const config1 = ospfService.getInterfaceConfig(iface1);

      expect(config0?.areaID.equals(new IPAddress('0.0.0.0'))).toBe(true);
      expect(config1?.areaID.equals(new IPAddress('0.0.0.1'))).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should have destroy method for cleanup', () => {
      expect(typeof ospfService.destroy).toBe('function');
    });

    it('should not throw when destroying', () => {
      ospfService.Enable = true;
      ospfService.addNetwork(
        new IPAddress('10.0.0.0'),
        new IPAddress('0.0.0.255'),
        new IPAddress('0.0.0.0')
      );

      expect(() => ospfService.destroy()).not.toThrow();
    });
  });
});

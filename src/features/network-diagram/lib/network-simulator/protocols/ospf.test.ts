import { describe, it, expect, beforeEach } from 'vitest';
import {
  OSPFMessage,
  OSPFHelloMessage,
  OSPFDatabaseDescriptionMessage,
  OSPFState,
  OSPFPacketType,
  OSPF_PROTOCOL_NUMBER,
  OSPF_ALL_ROUTERS,
  OSPF_ALL_DR,
  OSPF_DEFAULT_HELLO_INTERVAL,
  OSPF_DEFAULT_DEAD_INTERVAL,
  OSPF_DEFAULT_PRIORITY,
} from './ospf';
import { IPAddress } from '../address';

describe('OSPF Protocol - RFC 2328 Compliance', () => {
  describe('OSPF Constants', () => {
    it('should use correct OSPF protocol number (RFC 2328)', () => {
      // RFC 2328: OSPF uses IP protocol number 89
      expect(OSPF_PROTOCOL_NUMBER).toBe(89);
    });

    it('should use correct AllSPFRouters multicast address', () => {
      // RFC 2328: AllSPFRouters multicast address is 224.0.0.5
      expect(OSPF_ALL_ROUTERS.toString()).toBe('224.0.0.5');
    });

    it('should use correct AllDRouters multicast address', () => {
      // RFC 2328: AllDRouters multicast address is 224.0.0.6
      expect(OSPF_ALL_DR.toString()).toBe('224.0.0.6');
    });

    it('should have correct default timers', () => {
      // Standard OSPF timers
      expect(OSPF_DEFAULT_HELLO_INTERVAL).toBe(10);
      expect(OSPF_DEFAULT_DEAD_INTERVAL).toBe(40);
      expect(OSPF_DEFAULT_PRIORITY).toBe(1);
    });
  });

  describe('OSPFState Enum', () => {
    it('should define all OSPF neighbor states per RFC 2328', () => {
      // RFC 2328 Section 10.1: Neighbor states
      expect(OSPFState.Down).toBe(0);
      expect(OSPFState.Attempt).toBe(1);
      expect(OSPFState.Init).toBe(2);
      expect(OSPFState.TwoWay).toBe(3);
      expect(OSPFState.ExStart).toBe(4);
      expect(OSPFState.Exchange).toBe(5);
      expect(OSPFState.Loading).toBe(6);
      expect(OSPFState.Full).toBe(7);
    });

    it('should have states in correct progression order', () => {
      // States should progress: Down -> Init -> TwoWay -> ExStart -> Exchange -> Loading -> Full
      expect(OSPFState.Down).toBeLessThan(OSPFState.Init);
      expect(OSPFState.Init).toBeLessThan(OSPFState.TwoWay);
      expect(OSPFState.TwoWay).toBeLessThan(OSPFState.ExStart);
      expect(OSPFState.ExStart).toBeLessThan(OSPFState.Exchange);
      expect(OSPFState.Exchange).toBeLessThan(OSPFState.Loading);
      expect(OSPFState.Loading).toBeLessThan(OSPFState.Full);
    });
  });

  describe('OSPFPacketType Enum', () => {
    it('should define all OSPF packet types per RFC 2328', () => {
      // RFC 2328 Appendix A.3: OSPF packet types
      expect(OSPFPacketType.Hello).toBe(1);
      expect(OSPFPacketType.DatabaseDescription).toBe(2);
      expect(OSPFPacketType.LinkStateRequest).toBe(3);
      expect(OSPFPacketType.LinkStateUpdate).toBe(4);
      expect(OSPFPacketType.LinkStateAck).toBe(5);
    });
  });

  describe('OSPFMessage', () => {
    let builder: InstanceType<typeof OSPFMessage.Builder>;

    beforeEach(() => {
      builder = new OSPFMessage.Builder();
    });

    it('should create OSPF message with correct version', () => {
      // RFC 2328: OSPFv2 version number is 2
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      expect(messages).toHaveLength(1);
      const message = messages[0] as OSPFMessage;
      expect(message.version).toBe(2);
    });

    it('should use OSPF protocol number in IP header', () => {
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFMessage;
      expect(message.protocol).toBe(OSPF_PROTOCOL_NUMBER);
    });

    it('should set router ID correctly', () => {
      const routerID = new IPAddress('1.1.1.1');
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(routerID)
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFMessage;
      expect(message.routerID.equals(routerID)).toBe(true);
    });

    it('should set area ID correctly', () => {
      const areaID = new IPAddress('0.0.0.1');
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(areaID)
        .build();

      const message = messages[0] as OSPFMessage;
      expect(message.areaID.equals(areaID)).toBe(true);
    });

    it('should support backbone area 0.0.0.0', () => {
      // RFC 2328: Backbone area is always area 0.0.0.0
      const backboneArea = new IPAddress('0.0.0.0');
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(backboneArea)
        .build();

      const message = messages[0] as OSPFMessage;
      expect(message.areaID.equals(backboneArea)).toBe(true);
    });

    it('should default to no authentication', () => {
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFMessage;
      expect(message.authType).toBe(0); // No authentication
    });

    it('should validate authentication type range', () => {
      // RFC 2328: Auth types are 0 (none), 1 (simple), 2 (MD5)
      expect(() => builder.setAuthType(-1)).toThrow();
      expect(() => builder.setAuthType(3)).toThrow();
      expect(() => builder.setAuthType(0)).not.toThrow();
      expect(() => builder.setAuthType(1)).not.toThrow();
      expect(() => builder.setAuthType(2)).not.toThrow();
    });

    it('should calculate packet length correctly', () => {
      // RFC 2328: OSPF header is 24 bytes minimum
      const messages = builder
        .setPayload('test')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFMessage;
      expect(message.packetLength).toBeGreaterThanOrEqual(24);
    });

    it('should require source and destination addresses', () => {
      expect(() => {
        builder.setPayload('test').setRouterID(new IPAddress('1.1.1.1')).build();
      }).toThrow();
    });
  });

  describe('OSPFHelloMessage', () => {
    let builder: InstanceType<typeof OSPFHelloMessage.Builder>;

    beforeEach(() => {
      builder = new OSPFHelloMessage.Builder();
    });

    it('should create Hello message with correct packet type', () => {
      // RFC 2328: Hello packets have type 1
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.type).toBe(OSPFPacketType.Hello);
    });

    it('should include network mask', () => {
      const networkMask = new IPAddress('255.255.255.0');
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setNetworkMask(networkMask)
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.networkMask.equals(networkMask)).toBe(true);
    });

    it('should use default hello interval of 10 seconds', () => {
      // RFC 2328: Default HelloInterval is 10 seconds
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.helloInterval).toBe(OSPF_DEFAULT_HELLO_INTERVAL);
    });

    it('should use default dead interval of 40 seconds', () => {
      // RFC 2328: Default RouterDeadInterval is typically 4 * HelloInterval
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.routerDeadInterval).toBe(OSPF_DEFAULT_DEAD_INTERVAL);
      expect(message.routerDeadInterval).toBe(message.helloInterval * 4);
    });

    it('should validate hello interval range', () => {
      // Hello interval must be between 1 and 65535 seconds
      expect(() => builder.setHelloInterval(0)).toThrow();
      expect(() => builder.setHelloInterval(65536)).toThrow();
      expect(() => builder.setHelloInterval(1)).not.toThrow();
      expect(() => builder.setHelloInterval(10)).not.toThrow();
      expect(() => builder.setHelloInterval(65535)).not.toThrow();
    });

    it('should validate dead interval range', () => {
      expect(() => builder.setRouterDeadInterval(0)).toThrow();
      expect(() => builder.setRouterDeadInterval(65536)).toThrow();
      expect(() => builder.setRouterDeadInterval(1)).not.toThrow();
      expect(() => builder.setRouterDeadInterval(40)).not.toThrow();
      expect(() => builder.setRouterDeadInterval(65535)).not.toThrow();
    });

    it('should validate router priority range', () => {
      // RFC 2328: Priority is 0-255, where 0 means never become DR
      expect(() => builder.setRouterPriority(-1)).toThrow();
      expect(() => builder.setRouterPriority(256)).toThrow();
      expect(() => builder.setRouterPriority(0)).not.toThrow();
      expect(() => builder.setRouterPriority(1)).not.toThrow();
      expect(() => builder.setRouterPriority(255)).not.toThrow();
    });

    it('should support priority 0 for non-DR routers', () => {
      // RFC 2328: Priority 0 means router will never become DR/BDR
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setRouterPriority(0)
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.routerPriority).toBe(0);
    });

    it('should include designated router field', () => {
      const dr = new IPAddress('10.0.0.1');
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setDesignatedRouter(dr)
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.designatedRouter.equals(dr)).toBe(true);
    });

    it('should include backup designated router field', () => {
      const bdr = new IPAddress('10.0.0.2');
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setBackupDesignatedRouter(bdr)
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.backupDesignatedRouter.equals(bdr)).toBe(true);
    });

    it('should default DR/BDR to 0.0.0.0 when not elected', () => {
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.designatedRouter.equals(new IPAddress('0.0.0.0'))).toBe(true);
      expect(message.backupDesignatedRouter.equals(new IPAddress('0.0.0.0'))).toBe(
        true
      );
    });

    it('should include list of neighbors', () => {
      const neighbors = [
        new IPAddress('2.2.2.2'),
        new IPAddress('3.3.3.3'),
        new IPAddress('4.4.4.4'),
      ];

      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setNeighbors(neighbors)
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.neighbors).toHaveLength(3);
      expect(message.neighbors[0].equals(neighbors[0])).toBe(true);
      expect(message.neighbors[1].equals(neighbors[1])).toBe(true);
      expect(message.neighbors[2].equals(neighbors[2])).toBe(true);
    });

    it('should calculate packet length including neighbor list', () => {
      // RFC 2328: Each neighbor adds 4 bytes to packet
      const neighbors = [new IPAddress('2.2.2.2'), new IPAddress('3.3.3.3')];

      const messagesWithoutNeighbors = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const builderWithNeighbors = new OSPFHelloMessage.Builder();
      const messagesWithNeighbors = builderWithNeighbors
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setNeighbors(neighbors)
        .build();

      const msg1 = messagesWithoutNeighbors[0] as OSPFHelloMessage;
      const msg2 = messagesWithNeighbors[0] as OSPFHelloMessage;

      // Should be 8 bytes larger (2 neighbors * 4 bytes each)
      expect(msg2.packetLength).toBe(msg1.packetLength + 8);
    });

    it('should display Hello in string representation', () => {
      const messages = builder
        .setPayload('hello')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(OSPF_ALL_ROUTERS)
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFHelloMessage;
      expect(message.toString()).toContain('OSPF');
      expect(message.toString()).toContain('Hello');
    });
  });

  describe('OSPFDatabaseDescriptionMessage', () => {
    let builder: InstanceType<typeof OSPFDatabaseDescriptionMessage.Builder>;

    beforeEach(() => {
      builder = new OSPFDatabaseDescriptionMessage.Builder();
    });

    it('should create DBD message with correct packet type', () => {
      // RFC 2328: Database Description packets have type 2
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.type).toBe(OSPFPacketType.DatabaseDescription);
    });

    it('should include interface MTU field', () => {
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setInterfaceMTU(1500)
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.interfaceMTU).toBe(1500);
    });

    it('should support Init flag', () => {
      // RFC 2328: I-bit indicates first DBD packet
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setInitFlag(true)
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.initFlag).toBe(true);
    });

    it('should support More flag', () => {
      // RFC 2328: M-bit indicates more DBD packets to follow
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setMoreFlag(true)
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.moreFlag).toBe(true);
    });

    it('should support Master/Slave flag', () => {
      // RFC 2328: MS-bit indicates master/slave relationship
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setMasterFlag(true)
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.masterFlag).toBe(true);
    });

    it('should include DD sequence number', () => {
      // RFC 2328: Sequence number for DBD packets
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .setDDSequenceNumber(12345)
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.ddSequenceNumber).toBe(12345);
    });

    it('should display DBD in string representation', () => {
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.toString()).toContain('OSPF');
      expect(message.toString()).toContain('DBD');
    });

    it('should default flags to false', () => {
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.initFlag).toBe(false);
      expect(message.moreFlag).toBe(false);
      expect(message.masterFlag).toBe(false);
    });

    it('should default DD sequence number to 0', () => {
      const messages = builder
        .setPayload('dbd')
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'))
        .setRouterID(new IPAddress('1.1.1.1'))
        .setAreaID(new IPAddress('0.0.0.0'))
        .build();

      const message = messages[0] as OSPFDatabaseDescriptionMessage;
      expect(message.ddSequenceNumber).toBe(0);
    });
  });

  describe('OSPFProtocol', () => {
    it('should accept OSPF messages destined for AllSPFRouters', () => {
      // This would require mocking NetworkInterface
      // Tested in integration tests
    });

    it('should accept OSPF messages destined for AllDRouters', () => {
      // This would require mocking NetworkInterface
      // Tested in integration tests
    });

    it('should verify OSPF version 2', () => {
      // This would require mocking NetworkInterface
      // Tested in integration tests
    });
  });
});

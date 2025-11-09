import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import {
  RIPMessage,
  RIPCommand,
  RIPRouteEntry,
  RIP_MULTICAST_IP,
  RIP_METRIC_INFINITY,
  RIP_MAX_ROUTES_PER_MESSAGE,
} from './rip';

describe('RIP protocol', () => {
  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  describe('RIPRouteEntry', () => {
    it('should create route entry with default values', () => {
      const route = new RIPRouteEntry();

      expect(route.addressFamily).toBe(2); // IP
      expect(route.routeTag).toBe(0);
      expect(route.network.toString()).toBe('0.0.0.0');
      expect(route.mask.toString()).toBe('0.0.0.0');
      expect(route.nextHop.toString()).toBe('0.0.0.0');
      expect(route.metric).toBe(1);
    });

    it('should create route entry with custom values', () => {
      const network = new IPAddress('192.168.1.0');
      const mask = new IPAddress('255.255.255.0', true);
      const nextHop = new IPAddress('192.168.1.1');
      const metric = 5;

      const route = new RIPRouteEntry(network, mask, nextHop, metric);

      expect(route.network.toString()).toBe('192.168.1.0');
      expect(route.mask.CIDR).toBe(24);
      expect(route.nextHop.toString()).toBe('192.168.1.1');
      expect(route.metric).toBe(5);
    });

    it('should format route entry as string', () => {
      const route = new RIPRouteEntry(
        new IPAddress('10.0.0.0'),
        new IPAddress('255.0.0.0', true),
        new IPAddress('10.0.0.1'),
        3
      );

      const str = route.toString();
      expect(str).toContain('10.0.0.0/8');
      expect(str).toContain('10.0.0.1');
      expect(str).toContain('metric 3');
    });
  });

  describe('RIPMessage Builder', () => {
    it('should build RIP request message', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Request)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP);

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(RIPMessage);

      const ripMsg = messages[0] as RIPMessage;
      expect(ripMsg.command).toBe(RIPCommand.Request);
      expect(ripMsg.version).toBe(2);
      expect(ripMsg.routes).toHaveLength(0);
    });

    it('should build RIP response message with routes', () => {
      const route1 = new RIPRouteEntry(
        new IPAddress('192.168.1.0'),
        new IPAddress('255.255.255.0', true),
        new IPAddress('0.0.0.0'),
        1
      );
      const route2 = new RIPRouteEntry(
        new IPAddress('10.0.0.0'),
        new IPAddress('255.0.0.0', true),
        new IPAddress('0.0.0.0'),
        2
      );

      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Response)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP)
        .addRoute(route1)
        .addRoute(route2);

      const messages = builder.build();

      expect(messages).toHaveLength(1);

      const ripMsg = messages[0] as RIPMessage;
      expect(ripMsg.command).toBe(RIPCommand.Response);
      expect(ripMsg.routes).toHaveLength(2);
      expect(ripMsg.routes[0].network.toString()).toBe('192.168.1.0');
      expect(ripMsg.routes[1].network.toString()).toBe('10.0.0.0');
    });

    it('should set RIP version', () => {
      const builder = new RIPMessage.Builder()
        .setVersion(2)
        .setCommand(RIPCommand.Request)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP);

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;

      expect(ripMsg.version).toBe(2);
    });

    it('should reject invalid RIP version', () => {
      const builder = new RIPMessage.Builder();

      expect(() => builder.setVersion(3)).toThrow();
      expect(() => builder.setVersion(0)).toThrow();
    });

    it('should split messages when exceeding max routes', () => {
      const routes: RIPRouteEntry[] = [];

      // Create 30 routes (should split into 2 messages)
      for (let i = 0; i < 30; i += 1) {
        const route = new RIPRouteEntry(
          new IPAddress(`10.${i}.0.0`),
          new IPAddress('255.255.0.0', true),
          new IPAddress('0.0.0.0'),
          1
        );
        routes.push(route);
      }

      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Response)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP)
        .setRoutes(routes);

      const messages = builder.build();

      expect(messages).toHaveLength(2); // 25 + 5
      expect((messages[0] as RIPMessage).routes).toHaveLength(25);
      expect((messages[1] as RIPMessage).routes).toHaveLength(5);
    });

    it('should throw when source address not set', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Request)
        .setNetDestination(RIP_MULTICAST_IP);

      expect(() => builder.build()).toThrow('Source address is not set');
    });

    it('should throw when destination address not set', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Request)
        .setNetSource(new IPAddress('192.168.1.1'));

      expect(() => builder.build()).toThrow('Destination address is not set');
    });

    it('should respect max routes limit when adding individually', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Response)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP);

      // Add exactly max routes - should work
      for (let i = 0; i < RIP_MAX_ROUTES_PER_MESSAGE; i += 1) {
        const route = new RIPRouteEntry(
          new IPAddress(`10.${i}.0.0`),
          new IPAddress('255.255.0.0', true),
          new IPAddress('0.0.0.0'),
          1
        );
        expect(() => builder.addRoute(route)).not.toThrow();
      }

      // Adding one more should throw
      const extraRoute = new RIPRouteEntry(
        new IPAddress('172.16.0.0'),
        new IPAddress('255.255.0.0', true),
        new IPAddress('0.0.0.0'),
        1
      );
      expect(() => builder.addRoute(extraRoute)).toThrow();
    });

    it('should use setRoutes to replace all routes', () => {
      const route1 = new RIPRouteEntry(
        new IPAddress('192.168.1.0'),
        new IPAddress('255.255.255.0', true),
        new IPAddress('0.0.0.0'),
        1
      );
      const route2 = new RIPRouteEntry(
        new IPAddress('10.0.0.0'),
        new IPAddress('255.0.0.0', true),
        new IPAddress('0.0.0.0'),
        2
      );

      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Response)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP)
        .addRoute(route1)
        .setRoutes([route2]); // This should replace route1

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;

      expect(ripMsg.routes).toHaveLength(1);
      expect(ripMsg.routes[0].network.toString()).toBe('10.0.0.0');
    });
  });

  describe('RIPMessage toString', () => {
    it('should format request message', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Request)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP);

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;
      const str = ripMsg.toString();

      expect(str).toContain('RIPv2');
      expect(str).toContain('Request');
      expect(str).toContain('0 routes');
    });

    it('should format response message with routes', () => {
      const route = new RIPRouteEntry(
        new IPAddress('192.168.1.0'),
        new IPAddress('255.255.255.0', true),
        new IPAddress('0.0.0.0'),
        1
      );

      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Response)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP)
        .addRoute(route);

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;
      const str = ripMsg.toString();

      expect(str).toContain('RIPv2');
      expect(str).toContain('Response');
      expect(str).toContain('1 routes');
    });
  });

  describe('RIPMessage properties', () => {
    it('should use IP protocol 17 (UDP)', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Request)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP);

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;

      expect(ripMsg.protocol).toBe(17);
    });

    it('should have reserved field set to 0', () => {
      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Request)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP);

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;

      expect(ripMsg.reserved).toBe(0);
    });

    it('should calculate correct total length', () => {
      const route = new RIPRouteEntry(
        new IPAddress('192.168.1.0'),
        new IPAddress('255.255.255.0', true),
        new IPAddress('0.0.0.0'),
        1
      );

      const builder = new RIPMessage.Builder()
        .setCommand(RIPCommand.Response)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(RIP_MULTICAST_IP)
        .addRoute(route);

      const messages = builder.build();
      const ripMsg = messages[0] as RIPMessage;

      // IPv4 header (20) + RIP header (4) + 1 route (20) = 44 bytes
      expect(ripMsg.totalLength).toBe(44);
    });
  });

  describe('RIP constants', () => {
    it('should have correct multicast IP', () => {
      expect(RIP_MULTICAST_IP.toString()).toBe('224.0.0.9');
    });

    it('should have correct metric infinity', () => {
      expect(RIP_METRIC_INFINITY).toBe(16);
    });

    it('should have correct max routes per message', () => {
      expect(RIP_MAX_ROUTES_PER_MESSAGE).toBe(25);
    });
  });
});

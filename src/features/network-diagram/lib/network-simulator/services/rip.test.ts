import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import { Link } from '../layers/physical';
import { RIPService } from './rip';
import { RouterHost } from '../nodes/router';
import { RIP_METRIC_INFINITY } from '../protocols/rip';

describe('RIP Service', () => {
  let R1: RouterHost;
  let R2: RouterHost;
  let R3: RouterHost;

  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    // Create three routers
    R1 = new RouterHost('R1', 2);
    R1.getInterface(0).up();
    R1.getInterface(0).setNetAddress(new IPAddress('192.168.1.1'));
    R1.getInterface(0).setNetMask(new IPAddress('255.255.255.0', true));
    R1.getInterface(1).up();
    R1.getInterface(1).setNetAddress(new IPAddress('10.0.0.1'));
    R1.getInterface(1).setNetMask(new IPAddress('255.255.255.0', true));

    R2 = new RouterHost('R2', 2);
    R2.getInterface(0).up();
    R2.getInterface(0).setNetAddress(new IPAddress('192.168.1.2'));
    R2.getInterface(0).setNetMask(new IPAddress('255.255.255.0', true));
    R2.getInterface(1).up();
    R2.getInterface(1).setNetAddress(new IPAddress('172.16.0.1'));
    R2.getInterface(1).setNetMask(new IPAddress('255.255.0.0', true));

    R3 = new RouterHost('R3', 2);
    R3.getInterface(0).up();
    R3.getInterface(0).setNetAddress(new IPAddress('172.16.0.2'));
    R3.getInterface(0).setNetMask(new IPAddress('255.255.0.0', true));
    R3.getInterface(1).up();
    R3.getInterface(1).setNetAddress(new IPAddress('10.1.1.1'));
    R3.getInterface(1).setNetMask(new IPAddress('255.255.255.0', true));
  });

  describe('Service lifecycle', () => {
    it('should be disabled by default', () => {
      expect(R1.services.rip.Enable).toBe(false);
    });

    it('should enable and disable RIP service', () => {
      R1.services.rip.Enable = true;
      expect(R1.services.rip.Enable).toBe(true);

      R1.services.rip.Enable = false;
      expect(R1.services.rip.Enable).toBe(false);
    });

    it('should clear routes when disabled', () => {
      R1.services.rip.Enable = true;
      R1.services.rip.enableOnInterface(R1.getInterface(0));

      // Manually add a route for testing
      const route = {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 1,
        interface: R1.getInterface(0),
        lastUpdate: Scheduler.getInstance().getDeltaTime(),
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      };

      // Access private field for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R1.services.rip as any).ripRoutes.set('10.0.0.0/24', route);

      expect(R1.services.rip.getRoutes().length).toBe(1);

      R1.services.rip.Enable = false;

      expect(R1.services.rip.getRoutes().length).toBe(0);
    });
  });

  describe('Interface configuration', () => {
    beforeEach(() => {
      R1.services.rip.Enable = true;
    });

    it('should enable RIP on interface', () => {
      const iface = R1.getInterface(0);

      expect(R1.services.rip.isEnabledOnInterface(iface)).toBe(false);

      R1.services.rip.enableOnInterface(iface);

      expect(R1.services.rip.isEnabledOnInterface(iface)).toBe(true);
    });

    it('should disable RIP on interface', () => {
      const iface = R1.getInterface(0);

      R1.services.rip.enableOnInterface(iface);
      expect(R1.services.rip.isEnabledOnInterface(iface)).toBe(true);

      R1.services.rip.disableOnInterface(iface);
      expect(R1.services.rip.isEnabledOnInterface(iface)).toBe(false);
    });

    it('should list enabled interfaces', () => {
      const iface0 = R1.getInterface(0);
      const iface1 = R1.getInterface(1);

      console.log('Interface 0 toString:', iface0.toString());
      console.log('Interface 1 toString:', iface1.toString());

      R1.services.rip.enableOnInterface(iface0);
      R1.services.rip.enableOnInterface(iface1);

      const enabled = R1.services.rip.getEnabledInterfaces();
      console.log('Enabled interfaces:', enabled);

      expect(enabled).toHaveLength(2);
      // getEnabledInterfaces returns toString() format like "R1(Gi0/0)"
      expect(enabled.some((name) => name.includes('Gi0/0'))).toBe(true);
      expect(enabled.some((name) => name.includes('Gi0/1'))).toBe(true);
    });
  });

  describe('Route management', () => {
    beforeEach(() => {
      R1.services.rip.Enable = true;
      R1.services.rip.enableOnInterface(R1.getInterface(0));
    });

    it('should start with no routes', () => {
      expect(R1.services.rip.getRoutes()).toHaveLength(0);
    });

    it('should get routes for specific interface', () => {
      const iface0 = R1.getInterface(0);
      const iface1 = R1.getInterface(1);

      // Manually add routes for testing
      const route1 = {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 1,
        interface: iface0,
        lastUpdate: Scheduler.getInstance().getDeltaTime(),
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      };

      const route2 = {
        network: new IPAddress('172.16.0.0'),
        mask: new IPAddress('255.255.0.0', true),
        nextHop: new IPAddress('10.0.0.2'),
        metric: 1,
        interface: iface1,
        lastUpdate: Scheduler.getInstance().getDeltaTime(),
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R1.services.rip as any).ripRoutes.set('10.0.0.0/24', route1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R1.services.rip as any).ripRoutes.set('172.16.0.0/16', route2);

      const iface0Routes = R1.services.rip.getRoutesForInterface(iface0);
      expect(iface0Routes).toHaveLength(1);
      expect(iface0Routes[0].network.toString()).toBe('10.0.0.0');

      const iface1Routes = R1.services.rip.getRoutesForInterface(iface1);
      expect(iface1Routes).toHaveLength(1);
      expect(iface1Routes[0].network.toString()).toBe('172.16.0.0');
    });

    it('should clear all routes', () => {
      // Manually add a route for testing
      const route = {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 1,
        interface: R1.getInterface(0),
        lastUpdate: Scheduler.getInstance().getDeltaTime(),
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R1.services.rip as any).ripRoutes.set('10.0.0.0/24', route);

      expect(R1.services.rip.getRoutes().length).toBe(1);

      R1.services.rip.clearRoutes();

      expect(R1.services.rip.getRoutes().length).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should have default timer values', () => {
      expect(R1.services.rip.updateInterval).toBe(30);
      expect(R1.services.rip.invalidAfter).toBe(180);
      expect(R1.services.rip.flushAfter).toBe(240);
    });

    it('should have default metric', () => {
      expect(R1.services.rip.defaultMetric).toBe(1);
    });

    it('should enable split horizon by default', () => {
      expect(R1.services.rip.splitHorizon).toBe(true);
    });

    it('should enable poison reverse by default', () => {
      expect(R1.services.rip.poisonReverse).toBe(true);
    });

    it('should allow modifying timer values', () => {
      R1.services.rip.updateInterval = 60;
      R1.services.rip.invalidAfter = 360;
      R1.services.rip.flushAfter = 480;

      expect(R1.services.rip.updateInterval).toBe(60);
      expect(R1.services.rip.invalidAfter).toBe(360);
      expect(R1.services.rip.flushAfter).toBe(480);
    });

    it('should allow disabling split horizon', () => {
      R1.services.rip.splitHorizon = false;
      expect(R1.services.rip.splitHorizon).toBe(false);
    });

    it('should allow disabling poison reverse', () => {
      R1.services.rip.poisonReverse = false;
      expect(R1.services.rip.poisonReverse).toBe(false);
    });
  });

  describe('Route learning', () => {
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const link12 = new Link(R1.getInterface(0), R2.getInterface(0), 1000);

      R1.services.rip.Enable = true;
      R1.services.rip.enableOnInterface(R1.getInterface(0));

      R2.services.rip.Enable = true;
      R2.services.rip.enableOnInterface(R2.getInterface(0));
      R2.services.rip.enableOnInterface(R2.getInterface(1));
    });

    it('should learn routes from neighbors', async () => {
      // Wait for RIP updates to be exchanged
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      const r1Routes = R1.services.rip.getRoutes();

      // R1 should learn about 172.16.0.0/16 from R2
      const learnedRoute = r1Routes.find(
        (r) => r.network.toString() === '172.16.0.0'
      );

      expect(learnedRoute).toBeDefined();
      if (learnedRoute) {
        expect(learnedRoute.mask.CIDR).toBe(16);
        expect(learnedRoute.nextHop.toString()).toBe('192.168.1.2');
        expect(learnedRoute.metric).toBe(2); // 1 hop + 1
      }
    });

    it('should not learn routes when disabled', async () => {
      R1.services.rip.Enable = false;

      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      const r1Routes = R1.services.rip.getRoutes();
      expect(r1Routes).toHaveLength(0);
    });

    it('should not learn routes on disabled interface', async () => {
      R1.services.rip.disableOnInterface(R1.getInterface(0));

      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      const r1Routes = R1.services.rip.getRoutes();
      expect(r1Routes).toHaveLength(0);
    });
  });

  describe('Route propagation', () => {
    beforeEach(() => {
      // Create a linear topology: R1 -- R2 -- R3
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const link12 = new Link(R1.getInterface(0), R2.getInterface(0), 1000);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const link23 = new Link(R2.getInterface(1), R3.getInterface(0), 1000);

      // Enable RIP on all routers
      R1.services.rip.Enable = true;
      R1.services.rip.enableOnInterface(R1.getInterface(0));
      R1.services.rip.enableOnInterface(R1.getInterface(1));

      R2.services.rip.Enable = true;
      R2.services.rip.enableOnInterface(R2.getInterface(0));
      R2.services.rip.enableOnInterface(R2.getInterface(1));

      R3.services.rip.Enable = true;
      R3.services.rip.enableOnInterface(R3.getInterface(0));
      R3.services.rip.enableOnInterface(R3.getInterface(1));
    });

    it('should propagate routes across multiple hops', async () => {
      // Wait for RIP updates to propagate
      await new Promise((resolve) => {
        setTimeout(resolve, 3000);
      });

      // R1 should learn about R3's network (10.1.1.0/24) with metric 3
      const r1Routes = R1.services.rip.getRoutes();
      const r3Network = r1Routes.find(
        (r) => r.network.toString() === '10.1.1.0'
      );

      expect(r3Network).toBeDefined();
      if (r3Network) {
        expect(r3Network.metric).toBe(3); // 2 hops + 1
      }

      // R3 should learn about R1's network (10.0.0.0/24) with metric 3
      const r3Routes = R3.services.rip.getRoutes();
      const r1Network = r3Routes.find((r) => r.network.toString() === '10.0.0.0');

      expect(r1Network).toBeDefined();
      if (r1Network) {
        expect(r1Network.metric).toBe(3); // 2 hops + 1
      }
    });
  });

  describe('Metric infinity', () => {
    it('should reject routes with metric >= infinity', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const link12 = new Link(R1.getInterface(0), R2.getInterface(0), 1000);

      R1.services.rip.Enable = true;
      R1.services.rip.enableOnInterface(R1.getInterface(0));

      R2.services.rip.Enable = true;
      R2.services.rip.enableOnInterface(R2.getInterface(0));

      // Manually create a route with metric infinity on R2
      const route = {
        network: new IPAddress('10.99.99.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('0.0.0.0'),
        metric: RIP_METRIC_INFINITY,
        interface: R2.getInterface(0),
        lastUpdate: Scheduler.getInstance().getDeltaTime(),
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R2.services.rip as any).ripRoutes.set('10.99.99.0/24', route);

      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      // R1 should not learn this unreachable route
      const r1Routes = R1.services.rip.getRoutes();
      const unreachable = r1Routes.find(
        (r) => r.network.toString() === '10.99.99.0'
      );

      expect(unreachable).toBeUndefined();
    });
  });

  describe('Split horizon', () => {
    it('should not advertise routes back on incoming interface', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const link12 = new Link(R1.getInterface(0), R2.getInterface(0), 1000);

      R1.services.rip.Enable = true;
      R1.services.rip.splitHorizon = true;
      R1.services.rip.poisonReverse = false; // Disable poison reverse for pure split horizon
      R1.services.rip.enableOnInterface(R1.getInterface(0));

      R2.services.rip.Enable = true;
      R2.services.rip.splitHorizon = true;
      R2.services.rip.poisonReverse = false;
      R2.services.rip.enableOnInterface(R2.getInterface(0));
      R2.services.rip.enableOnInterface(R2.getInterface(1));

      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });

      // R1 learns about 172.16.0.0/16 from R2
      // R2 should not learn about 172.16.0.0/16 back from R1
      const r2Routes = R2.services.rip.getRoutes();
      const loopedRoute = r2Routes.find(
        (r) =>
          r.network.toString() === '172.16.0.0' &&
          r.nextHop.toString() === '192.168.1.1'
      );

      expect(loopedRoute).toBeUndefined();
    });
  });

  describe('Destroy', () => {
    it('should cleanup resources on destroy', () => {
      R1.services.rip.Enable = true;
      R1.services.rip.enableOnInterface(R1.getInterface(0));

      // Add a route
      const route = {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 1,
        interface: R1.getInterface(0),
        lastUpdate: Scheduler.getInstance().getDeltaTime(),
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (R1.services.rip as any).ripRoutes.set('10.0.0.0/24', route);

      expect(R1.services.rip.getRoutes().length).toBe(1);

      R1.services.rip.destroy();

      expect(R1.services.rip.getRoutes().length).toBe(0);
    });
  });
});

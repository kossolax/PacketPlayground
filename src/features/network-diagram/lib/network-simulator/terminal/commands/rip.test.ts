import { describe, it, expect, beforeEach } from 'vitest';
import { IPAddress } from '../../address';
import { RouterHost } from '../../nodes/router';
import { ServerHost } from '../../nodes/server';
import { SwitchHost } from '../../nodes/switch';
import { Terminal } from '../terminal';

describe('Terminal RIP commands test', () => {
  let terminalRouter: Terminal;
  let terminalServer: Terminal;
  let terminalSwitch: Terminal;
  let router: RouterHost;

  beforeEach(() => {
    router = new RouterHost('R1', 2);
    terminalRouter = new Terminal(router);
    terminalServer = new Terminal(new ServerHost('S1'));
    terminalSwitch = new Terminal(new SwitchHost('SW1', 2));

    // Configure interface IP addresses
    router.getInterface(0).up();
    router.getInterface(0).setNetAddress(new IPAddress('192.168.1.1'));
    router.getInterface(0).setNetMask(new IPAddress('255.255.255.0', true));

    router.getInterface(1).up();
    router.getInterface(1).setNetAddress(new IPAddress('10.0.0.1'));
    router.getInterface(1).setNetMask(new IPAddress('255.255.255.0', true));
  });

  describe('router rip command - global configuration', () => {
    it('should enable RIP globally', () => {
      expect(router.services.rip.Enable).toBe(false);

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      expect(terminalRouter.exec('router rip')).toBe(true);

      expect(router.services.rip.Enable).toBe(true);
    });

    it('should disable RIP globally with "no router rip"', () => {
      router.services.rip.Enable = true;

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      expect(terminalRouter.exec('no router rip')).toBe(true);

      expect(router.services.rip.Enable).toBe(false);
    });

    it('should clear routes when disabling RIP', () => {
      // Enable RIP and add routes
      router.services.rip.Enable = true;
      router.services.rip.enableOnInterface(router.getInterface(0));

      // Manually add a test route
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router.services.rip as any).ripRoutes.set('10.0.0.0/24', {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 1,
        interface: router.getInterface(0),
        lastUpdate: 0,
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      });

      expect(router.services.rip.getRoutes().length).toBe(1);

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('no router rip');

      expect(router.services.rip.getRoutes().length).toBe(0);
    });
  });

  describe('ip rip command - interface configuration', () => {
    beforeEach(() => {
      // Enable RIP globally first
      router.services.rip.Enable = true;
    });

    it('should enable RIP on interface', () => {
      const iface = router.getInterface(0);
      expect(router.services.rip.isEnabledOnInterface(iface)).toBe(false);

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      expect(terminalRouter.exec('ip rip')).toBe(true);

      expect(router.services.rip.isEnabledOnInterface(iface)).toBe(true);
    });

    it('should disable RIP on interface with "no ip rip"', () => {
      const iface = router.getInterface(0);
      router.services.rip.enableOnInterface(iface);

      expect(router.services.rip.isEnabledOnInterface(iface)).toBe(true);

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      expect(terminalRouter.exec('no ip rip')).toBe(true);

      expect(router.services.rip.isEnabledOnInterface(iface)).toBe(false);
    });

    it('should require global RIP to be enabled first', () => {
      router.services.rip.Enable = false;

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');

      expect(terminalRouter.exec('ip rip')).toBe(false);
    });

    it('should enable RIP on multiple interfaces', () => {
      const iface0 = router.getInterface(0);
      const iface1 = router.getInterface(1);

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');

      terminalRouter.exec('interface gig 0/0');
      expect(terminalRouter.exec('ip rip')).toBe(true);

      terminalRouter.exec('end');
      terminalRouter.exec('interface gig 0/1');
      expect(terminalRouter.exec('ip rip')).toBe(true);

      expect(router.services.rip.isEnabledOnInterface(iface0)).toBe(true);
      expect(router.services.rip.isEnabledOnInterface(iface1)).toBe(true);

      const enabled = router.services.rip.getEnabledInterfaces();
      expect(enabled).toHaveLength(2);
    });
  });

  describe('show ip rip command', () => {
    beforeEach(() => {
      router.services.rip.Enable = true;
      router.services.rip.enableOnInterface(router.getInterface(0));
    });

    it('should show RIP status when enabled', () => {
      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip')).toBe(true);
    });

    it('should show "not enabled" when RIP is disabled', () => {
      router.services.rip.Enable = false;

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip')).toBe(true);
    });

    it('should show enabled interfaces', () => {
      router.services.rip.enableOnInterface(router.getInterface(1));

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip')).toBe(true);
    });

    it('should show RIP routes', () => {
      // Manually add a test route
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router.services.rip as any).ripRoutes.set('10.0.0.0/24', {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 2,
        interface: router.getInterface(0),
        lastUpdate: 0,
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      });

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip')).toBe(true);
    });

    it('should show database view', () => {
      // Manually add a test route
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router.services.rip as any).ripRoutes.set('172.16.0.0/16', {
        network: new IPAddress('172.16.0.0'),
        mask: new IPAddress('255.255.0.0', true),
        nextHop: new IPAddress('192.168.1.3'),
        metric: 3,
        interface: router.getInterface(0),
        lastUpdate: 0,
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      });

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip database')).toBe(true);
    });

    it('should show message when no interfaces configured', () => {
      router.services.rip.disableOnInterface(router.getInterface(0));

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip')).toBe(true);
    });
  });

  describe('show ip protocols command', () => {
    beforeEach(() => {
      router.services.rip.Enable = true;
      router.services.rip.enableOnInterface(router.getInterface(0));
    });

    it('should show routing protocol information', () => {
      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });

    it('should show split horizon status', () => {
      router.services.rip.splitHorizon = true;

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });

    it('should show poison reverse status', () => {
      router.services.rip.poisonReverse = false;

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });

    it('should show timer values', () => {
      router.services.rip.updateInterval = 30;
      router.services.rip.invalidAfter = 180;
      router.services.rip.flushAfter = 240;

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });

    it('should show configured networks', () => {
      router.services.rip.enableOnInterface(router.getInterface(1));

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });

    it('should show routing information sources', () => {
      // Manually add test routes from different sources
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router.services.rip as any).ripRoutes.set('10.0.0.0/24', {
        network: new IPAddress('10.0.0.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 1,
        interface: router.getInterface(0),
        lastUpdate: 0,
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router.services.rip as any).ripRoutes.set('172.16.0.0/16', {
        network: new IPAddress('172.16.0.0'),
        mask: new IPAddress('255.255.0.0', true),
        nextHop: new IPAddress('192.168.1.3'),
        metric: 2,
        interface: router.getInterface(0),
        lastUpdate: 0,
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      });

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });

    it('should show message when no protocols enabled', () => {
      router.services.rip.Enable = false;

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip protocols')).toBe(true);
    });
  });

  describe('autocomplete', () => {
    it('should autocomplete "router rip"', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');

      const suggestions = terminalRouter.autocomplete('router ');
      expect(suggestions).toContain('rip');
    });

    it('should autocomplete "ip rip" in interface mode', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');

      const suggestions = terminalRouter.autocomplete('ip ');
      expect(suggestions).toContain('rip');
    });

    it('should autocomplete "show ip rip"', () => {
      terminalRouter.exec('enable');

      const suggestions = terminalRouter.autocomplete('show ip ');
      expect(suggestions).toContain('rip');
    });

    it('should autocomplete "show ip protocols"', () => {
      terminalRouter.exec('enable');

      const suggestions = terminalRouter.autocomplete('show ip ');
      expect(suggestions).toContain('protocols');
    });

    it('should autocomplete "show ip rip database"', () => {
      terminalRouter.exec('enable');

      const suggestions = terminalRouter.autocomplete('show ip rip ');
      expect(suggestions).toContain('database');
    });
  });

  describe('device type restrictions', () => {
    it('should not be available on servers', () => {
      terminalServer.exec('enable');
      terminalServer.exec('configure terminal');

      expect(terminalServer.autocomplete('router ')).not.toContain('rip');
    });

    it('should not be available on switches', () => {
      terminalSwitch.exec('enable');
      terminalSwitch.exec('configure terminal');

      expect(terminalSwitch.autocomplete('router ')).not.toContain('rip');
    });

    it('show ip rip should not be available on non-routers', () => {
      terminalServer.exec('enable');
      const serverSuggestions = terminalServer.autocomplete('show ip ');
      expect(serverSuggestions).not.toContain('rip');

      terminalSwitch.exec('enable');
      const switchSuggestions = terminalSwitch.autocomplete('show ip ');
      expect(switchSuggestions).not.toContain('rip');
    });

    it('show ip protocols should not be available on non-routers', () => {
      terminalServer.exec('enable');
      const serverSuggestions = terminalServer.autocomplete('show ip ');
      expect(serverSuggestions).not.toContain('protocols');

      terminalSwitch.exec('enable');
      const switchSuggestions = terminalSwitch.autocomplete('show ip ');
      expect(switchSuggestions).not.toContain('protocols');
    });
  });

  describe('error handling', () => {
    it('should fail if RIP not supported on device', () => {
      // This is already tested by device type restrictions
      // but we test it explicitly with exec instead of autocomplete
      terminalServer.exec('enable');
      terminalServer.exec('configure terminal');

      // Server doesn't have RIP service, so this should fail silently
      // (command not found)
      expect(terminalServer.exec('router rip')).toBe(false);
    });

    it('should fail when trying to enable interface RIP without global RIP', () => {
      router.services.rip.Enable = false;

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');

      expect(terminalRouter.exec('ip rip')).toBe(false);
    });
  });

  describe('configuration persistence', () => {
    it('should maintain RIP state across command executions', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('router rip');

      expect(router.services.rip.Enable).toBe(true);

      terminalRouter.exec('end');
      terminalRouter.exec('end');

      // RIP should still be enabled
      expect(router.services.rip.Enable).toBe(true);
    });

    it('should maintain interface RIP state', () => {
      router.services.rip.Enable = true;

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('ip rip');

      const iface = router.getInterface(0);
      expect(router.services.rip.isEnabledOnInterface(iface)).toBe(true);

      terminalRouter.exec('end');
      terminalRouter.exec('end');

      // Interface RIP should still be enabled
      expect(router.services.rip.isEnabledOnInterface(iface)).toBe(true);
    });
  });

  describe('RIP metric infinity display', () => {
    it('should show unreachable routes with inf metric', () => {
      router.services.rip.Enable = true;
      router.services.rip.enableOnInterface(router.getInterface(0));

      // Add route with infinity metric
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (router.services.rip as any).ripRoutes.set('10.99.99.0/24', {
        network: new IPAddress('10.99.99.0'),
        mask: new IPAddress('255.255.255.0', true),
        nextHop: new IPAddress('192.168.1.2'),
        metric: 16, // Infinity
        interface: router.getInterface(0),
        lastUpdate: 0,
        invalidTimer: 0,
        flushTimer: 0,
        routeTag: 0,
        changed: false,
      });

      terminalRouter.exec('enable');
      expect(terminalRouter.exec('show ip rip')).toBe(true);
    });
  });
});

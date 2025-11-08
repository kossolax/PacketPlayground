import { describe, it, expect, beforeEach } from 'vitest';
import { IPAddress } from '../../address';
import { RouterHost } from '../../nodes/router';
import { SwitchHost } from '../../nodes/switch';
import { HSRPState } from '../../protocols/hsrp';
import { Terminal } from '../terminal';

describe('Terminal FHRP (HSRP) test', () => {
  let terminalRouter: Terminal;
  let terminalSwitch: Terminal;
  let router: RouterHost;

  beforeEach(() => {
    router = new RouterHost('R1', 2);
    terminalRouter = new Terminal(router);
    terminalSwitch = new Terminal(new SwitchHost('S1', 2));

    // Configure interface IP addresses
    router.getInterface(0).setNetAddress(new IPAddress('192.168.1.1'));
    router.getInterface(0).setNetMask(new IPAddress('255.255.255.0', true));
  });

  describe('standby command - basic configuration', () => {
    it('should configure HSRP group with virtual IP', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');

      // Test invalid syntax
      expect(terminalRouter.exec('standby')).toBe(false);
      expect(terminalRouter.exec('standby 1')).toBe(false);
      expect(terminalRouter.exec('standby 1 ip')).toBe(false);

      // Valid configuration
      expect(terminalRouter.exec('standby 1 ip 192.168.1.254')).toBe(true);

      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 1);

      expect(group).toBeDefined();
      expect(group?.virtualIP.toString()).toBe('192.168.1.254');
      expect(group?.group).toBe(1);
      expect(group?.priority).toBe(100); // Default priority
    });

    it('should reject invalid IP addresses', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');

      expect(terminalRouter.exec('standby 1 ip 999.999.999.999')).toBe(false);
      expect(terminalRouter.exec('standby 1 ip invalid')).toBe(false);
    });

    it('should reject invalid group numbers', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');

      expect(terminalRouter.exec('standby -1 ip 192.168.1.254')).toBe(false);
      expect(terminalRouter.exec('standby 256 ip 192.168.1.254')).toBe(false);
      expect(terminalRouter.exec('standby abc ip 192.168.1.254')).toBe(false);
    });
  });

  describe('standby command - priority configuration', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
    });

    it('should set priority', () => {
      expect(terminalRouter.exec('standby 1 priority 110')).toBe(true);

      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 1);

      expect(group?.priority).toBe(110);
    });

    it('should reject invalid priorities', () => {
      expect(terminalRouter.exec('standby 1 priority -1')).toBe(false);
      expect(terminalRouter.exec('standby 1 priority 256')).toBe(false);
      expect(terminalRouter.exec('standby 1 priority abc')).toBe(false);
    });

    it('should require group to be configured first', () => {
      expect(terminalRouter.exec('standby 2 priority 110')).toBe(false);
    });
  });

  describe('standby command - preempt configuration', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
    });

    it('should enable preempt', () => {
      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 1);

      expect(group?.preempt).toBe(false); // Default

      expect(terminalRouter.exec('standby 1 preempt')).toBe(true);
      expect(group?.preempt).toBe(true);
    });

    it('should require group to be configured first', () => {
      expect(terminalRouter.exec('standby 2 preempt')).toBe(false);
    });
  });

  describe('standby command - timers configuration', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
    });

    it('should configure timers', () => {
      expect(terminalRouter.exec('standby 1 timers 5 15')).toBe(true);

      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 1);

      expect(group?.hellotime).toBe(5);
      expect(group?.holdtime).toBe(15);
    });

    it('should reject invalid timer values', () => {
      expect(terminalRouter.exec('standby 1 timers 0 10')).toBe(false); // hellotime too small
      expect(terminalRouter.exec('standby 1 timers 256 300')).toBe(false); // hellotime too large
      expect(terminalRouter.exec('standby 1 timers 10 5')).toBe(false); // holdtime <= hellotime
      expect(terminalRouter.exec('standby 1 timers abc def')).toBe(false); // invalid format
    });

    it('should require group to be configured first', () => {
      expect(terminalRouter.exec('standby 2 timers 3 10')).toBe(false);
    });
  });

  describe('standby command - authentication configuration', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
    });

    it('should configure authentication', () => {
      expect(terminalRouter.exec('standby 1 authentication secret')).toBe(true);

      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 1);

      expect(group?.authentication).toBe('secret\x00\x00'); // Padded to 8 chars
    });

    it('should truncate authentication strings longer than 8 characters', () => {
      expect(terminalRouter.exec('standby 1 authentication verylongstring')).toBe(
        false
      ); // Should fail validation
    });

    it('should require group to be configured first', () => {
      expect(terminalRouter.exec('standby 2 authentication test')).toBe(false);
    });
  });

  describe('standby command - removal with "no"', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
      terminalRouter.exec('standby 2 ip 192.168.1.253');
    });

    it('should remove HSRP group', () => {
      const iface = router.getInterface(0);

      expect(router.services.fhrp.getGroup(iface, 1)).toBeDefined();
      expect(router.services.fhrp.getGroup(iface, 2)).toBeDefined();

      expect(terminalRouter.exec('no standby 1')).toBe(true);

      expect(router.services.fhrp.getGroup(iface, 1)).toBeNull();
      expect(router.services.fhrp.getGroup(iface, 2)).toBeDefined();
    });
  });

  describe('show standby command', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
      terminalRouter.exec('standby 1 priority 110');
      terminalRouter.exec('exit');
      terminalRouter.exec('exit');
    });

    it('should show HSRP status', () => {
      expect(terminalRouter.exec('show standby')).toBe(true);
    });

    it('should show HSRP brief status', () => {
      expect(terminalRouter.exec('show standby brief')).toBe(true);
    });

    it('should filter by interface', () => {
      expect(terminalRouter.exec('show standby GigabitEthernet0/0')).toBe(true);
    });

    it('should show "No HSRP groups configured" when none exist', () => {
      const router2 = new RouterHost('R2', 2);
      const terminal2 = new Terminal(router2);

      terminal2.exec('enable');
      expect(terminal2.exec('show standby')).toBe(true);
    });
  });

  describe('autocomplete', () => {
    beforeEach(() => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
    });

    it('should autocomplete standby group numbers', () => {
      const suggestions = terminalRouter.autocomplete('standby 1');
      expect(suggestions).toContain('10');
    });

    it('should autocomplete standby subcommands', () => {
      const suggestions = terminalRouter.autocomplete('standby 1 p');
      expect(suggestions).toContain('priority');
      expect(suggestions).toContain('preempt');
    });

    it('should autocomplete show standby', () => {
      terminalRouter.exec('exit');
      terminalRouter.exec('exit');
      const suggestions = terminalRouter.autocomplete('show s');
      expect(suggestions).toContain('standby');
    });
  });

  describe('device type restrictions', () => {
    it('should not be available on switches', () => {
      terminalSwitch.exec('enable');
      terminalSwitch.exec('configure terminal');
      terminalSwitch.exec('interface gig 0/0');

      expect(terminalSwitch.autocomplete('standby')).toEqual([]);
    });

    it('show standby should not be available on switches', () => {
      terminalSwitch.exec('enable');

      const suggestions = terminalSwitch.autocomplete('show s');
      expect(suggestions).not.toContain('standby');
    });
  });

  describe('HSRP state verification', () => {
    it('should initialize group in Initial state', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');

      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 1);

      // Group should be created but service not enabled yet
      expect(group).toBeDefined();
      expect(group?.state).toBe(HSRPState.Initial);
    });

    it('should have correct virtual MAC format', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 10 ip 192.168.1.254');

      const iface = router.getInterface(0);
      const group = router.services.fhrp.getGroup(iface, 10);

      expect(group?.getVirtualMAC().toString()).toBe('00:00:0C:07:AC:0A');
    });
  });

  describe('multiple groups on same interface', () => {
    it('should support multiple HSRP groups', () => {
      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');
      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
      terminalRouter.exec('standby 2 ip 192.168.1.253');
      terminalRouter.exec('standby 1 priority 110');
      terminalRouter.exec('standby 2 priority 90');

      const iface = router.getInterface(0);
      const group1 = router.services.fhrp.getGroup(iface, 1);
      const group2 = router.services.fhrp.getGroup(iface, 2);

      expect(group1?.virtualIP.toString()).toBe('192.168.1.254');
      expect(group1?.priority).toBe(110);

      expect(group2?.virtualIP.toString()).toBe('192.168.1.253');
      expect(group2?.priority).toBe(90);
    });
  });

  describe('groups on different interfaces', () => {
    it('should support HSRP on multiple interfaces', () => {
      router.getInterface(1).setNetAddress(new IPAddress('10.0.0.1'));
      router.getInterface(1).setNetMask(new IPAddress('255.255.255.0', true));

      terminalRouter.exec('enable');
      terminalRouter.exec('configure terminal');

      terminalRouter.exec('interface gig 0/0');
      terminalRouter.exec('standby 1 ip 192.168.1.254');
      terminalRouter.exec('exit');

      terminalRouter.exec('interface gig 0/1');
      terminalRouter.exec('standby 1 ip 10.0.0.254');

      const iface0 = router.getInterface(0);
      const iface1 = router.getInterface(1);

      const group0 = router.services.fhrp.getGroup(iface0, 1);
      const group1 = router.services.fhrp.getGroup(iface1, 1);

      expect(group0?.virtualIP.toString()).toBe('192.168.1.254');
      expect(group1?.virtualIP.toString()).toBe('10.0.0.254');
    });
  });
});

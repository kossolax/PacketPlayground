import { describe, it, expect, beforeEach } from 'vitest';
import { SwitchHost } from '../../nodes/switch';
import { SpanningTreeProtocol, MSTPService } from '../../services/spanningtree';
import { Terminal } from '../terminal';

describe('Terminal spanning-tree commands', () => {
  let terminal: Terminal;
  let host: SwitchHost;

  beforeEach(() => {
    host = new SwitchHost('S', 4);
    terminal = new Terminal(host);
  });

  describe('spanning-tree mode (config mode)', () => {
    it('should change protocol to STP', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      expect(terminal.exec('spanning-tree mode stp')).toBe(true);
      expect(host.getStpProtocol()).toBe(SpanningTreeProtocol.STP);
    });

    it('should change protocol to PVST', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      expect(terminal.exec('spanning-tree mode pvst')).toBe(true);
      expect(host.getStpProtocol()).toBe(SpanningTreeProtocol.PVST);
    });

    it('should change protocol to RPVST', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      expect(terminal.exec('spanning-tree mode rapid-pvst')).toBe(true);
      expect(host.getStpProtocol()).toBe(SpanningTreeProtocol.RPVST);
    });

    it('should reject invalid mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      expect(terminal.exec('spanning-tree mode invalid')).toBe(false);
    });

    it('should disable STP with no spanning-tree', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      expect(host.spanningTree.Enable).toBe(true);
      expect(terminal.exec('no spanning-tree')).toBe(true);
      expect(host.spanningTree.Enable).toBe(false);
    });
  });

  describe('spanning-tree priority (config mode)', () => {
    it('should set global priority', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      expect(terminal.exec('spanning-tree priority 4096')).toBe(true);
      expect(host.spanningTree.Priority).toBe(4096);
    });

    it('should reject invalid priority', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      expect(terminal.exec('spanning-tree priority 1000')).toBe(false);
    });

    it('should set per-VLAN priority in PVST mode', () => {
      host.knownVlan[10] = 'VLAN 10';
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode pvst');
      const r = terminal.exec('spanning-tree vlan 10 priority 4096');
      expect(r).toBe(true);
    });
  });

  describe('spanning-tree cost (interface config mode)', () => {
    it('should set port cost on interface', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      terminal.exec('interface gig 0/0');
      expect(terminal.exec('spanning-tree cost 100')).toBe(true);
      expect(host.spanningTree.Cost(host.getInterface(0))).toBe(100);
    });

    it('should reject out-of-range cost', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('interface gig 0/0');
      expect(terminal.exec('spanning-tree cost 0')).toBe(false);
    });

    it('should reset cost with no spanning-tree cost', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      terminal.exec('interface gig 0/0');
      terminal.exec('spanning-tree cost 100');
      expect(terminal.exec('no spanning-tree cost')).toBe(true);
      expect(host.spanningTree.Cost(host.getInterface(0))).toBe(0);
    });
  });

  describe('show spanning-tree (admin mode)', () => {
    it('should display STP info', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      terminal.exec('end');

      terminal.exec('show spanning-tree');
      expect(output).toContain('Spanning tree enabled protocol ieee');
    });

    it('should report disabled when STP is off', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      terminal.exec('enable');
      expect(terminal.exec('show spanning-tree')).toBe(true);
      expect(output).toContain('disabled');
    });

    it('should display RPVST info with rapid-pvst protocol', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      host.knownVlan[10] = 'VLAN 10';
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode rapid-pvst');
      terminal.exec('end');

      terminal.exec('show spanning-tree');
      expect(output).toContain('rapid-pvst');
    });

    it('should display PVST per-VLAN info', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      host.knownVlan[10] = 'VLAN 10';
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode pvst');
      terminal.exec('end');

      terminal.exec('show spanning-tree');
      expect(output).toContain('pvst');
    });
  });

  describe('spanning-tree mode mst (config mode)', () => {
    it('should change protocol to MST', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      expect(terminal.exec('spanning-tree mode mst')).toBe(true);
      expect(host.getStpProtocol()).toBe(SpanningTreeProtocol.MSTP);
    });

    it('should set per-instance priority', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      expect(terminal.exec('spanning-tree mst 1 priority 4096')).toBe(true);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.getInstancePriority(1)).toBe(4096);
    });

    it('should reject invalid per-instance priority', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      expect(terminal.exec('spanning-tree mst 1 priority 1000')).toBe(false);
    });

    it('should reject mst priority when not in MST mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode stp');
      expect(terminal.exec('spanning-tree mst 0 priority 4096')).toBe(false);
    });
  });

  describe('MST configuration submode', () => {
    beforeEach(() => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('spanning-tree mst configuration');
    });

    it('should enter (config-mst)# submode', () => {
      expect(terminal.Prompt).toContain('(config-mst)#');
    });

    it('should set region name', () => {
      expect(terminal.exec('name MY_REGION')).toBe(true);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.mstConfig.name).toBe('MY_REGION');
    });

    it('should truncate name to 32 characters', () => {
      const longName = 'A'.repeat(50);
      terminal.exec(`name ${longName}`);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.mstConfig.name.length).toBe(32);
    });

    it('should reject name without value', () => {
      expect(terminal.exec('name')).toBe(false);
    });

    it('should set revision', () => {
      expect(terminal.exec('revision 1')).toBe(true);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.mstConfig.revision).toBe(1);
    });

    it('should reject invalid revision', () => {
      expect(terminal.exec('revision 70000')).toBe(false);
    });

    it('should reject revision without value', () => {
      expect(terminal.exec('revision')).toBe(false);
    });

    it('should map VLAN to instance', () => {
      expect(terminal.exec('instance 1 vlan 10')).toBe(true);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.mstConfig.getInstanceForVlan(10)).toBe(1);
    });

    it('should map VLAN range to instance', () => {
      expect(terminal.exec('instance 2 vlan 10,20,30-35')).toBe(true);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.mstConfig.getInstanceForVlan(10)).toBe(2);
      expect(mstp.mstConfig.getInstanceForVlan(20)).toBe(2);
      expect(mstp.mstConfig.getInstanceForVlan(32)).toBe(2);
      expect(mstp.mstConfig.getInstanceForVlan(35)).toBe(2);
    });

    it('should unmap VLAN with no instance', () => {
      terminal.exec('instance 1 vlan 10');
      expect(terminal.exec('no instance 1 vlan 10')).toBe(true);
      const mstp = host.spanningTree as MSTPService;
      expect(mstp.mstConfig.getInstanceForVlan(10)).toBe(0);
    });

    it('should reject invalid instance ID', () => {
      expect(terminal.exec('instance 20 vlan 10')).toBe(false);
    });

    it('should reject instance without vlan keyword', () => {
      expect(terminal.exec('instance 1 10')).toBe(false);
    });

    it('should exit submode with exit', () => {
      terminal.exec('exit');
      // exit goes to root in this terminal implementation
      expect(terminal.Prompt).toBe('S$');
    });
  });

  describe('show spanning-tree mst (admin mode)', () => {
    it('should display MST instance info', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('end');

      terminal.exec('show spanning-tree');
      expect(output).toContain('mst');
      expect(output).toContain('MST00 (IST)');
    });

    it('should display MST configuration', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('spanning-tree mst configuration');
      terminal.exec('name REGION1');
      terminal.exec('revision 5');
      terminal.exec('exit');
      terminal.exec('enable');

      terminal.exec('show spanning-tree mst configuration');
      expect(output).toContain('REGION1');
      expect(output).toContain('5');
    });

    it('should display specific MST instance', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('spanning-tree mst configuration');
      terminal.exec('instance 1 vlan 10');
      terminal.exec('exit');
      terminal.exec('enable');

      terminal.exec('show spanning-tree mst 1');
      expect(output).toContain('MST01');
      expect(output).toContain('10');
    });

    it('should report not found for nonexistent instance', () => {
      let output = '';
      terminal.onText = (t) => {
        output = t;
      };

      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('exit');
      terminal.exec('enable');

      terminal.exec('show spanning-tree mst 15');
      expect(output).toContain('not found');
    });
  });

  describe('autocomplete', () => {
    it('should autocomplete spanning-tree in config mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      expect(terminal.autocomplete('span')).toEqual(['spanning-tree']);
    });

    it('should autocomplete spanning-tree mode options', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      const completions = terminal.autocomplete('spanning-tree mode ');
      expect(completions).toContain('stp');
      expect(completions).toContain('pvst');
    });

    it('should autocomplete show in admin mode', () => {
      terminal.exec('enable');
      expect(terminal.autocomplete('sho')).toEqual(['show']);
    });

    it('should autocomplete show spanning-tree', () => {
      terminal.exec('enable');
      const completions = terminal.autocomplete('show ');
      expect(completions).toContain('spanning-tree');
    });

    it('should autocomplete spanning-tree cost in interface mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('interface gig 0/0');
      expect(terminal.autocomplete('span')).toEqual(['spanning-tree']);
      const completions = terminal.autocomplete('spanning-tree ');
      expect(completions).toContain('cost');
    });

    it('should autocomplete mst in spanning-tree mode options', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      const completions = terminal.autocomplete('spanning-tree mode ');
      expect(completions).toContain('mst');
    });

    it('should autocomplete mst subcommands in config mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      const completions = terminal.autocomplete('spanning-tree ');
      expect(completions).toContain('mst');
    });

    it('should autocomplete mst configuration in config mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      const completions = terminal.autocomplete('spanning-tree mst ');
      expect(completions).toContain('configuration');
    });

    it('should autocomplete show spanning-tree mst when in MST mode', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('end');
      const completions = terminal.autocomplete('show spanning-tree ');
      expect(completions).toContain('mst');
    });

    it('should autocomplete show spanning-tree mst configuration', () => {
      terminal.exec('enable');
      terminal.exec('configure terminal');
      terminal.exec('spanning-tree mode mst');
      terminal.exec('end');
      const completions = terminal.autocomplete('show spanning-tree mst ');
      expect(completions).toContain('configuration');
    });
  });
});

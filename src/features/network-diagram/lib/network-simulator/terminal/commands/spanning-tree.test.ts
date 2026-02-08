import { describe, it, expect, beforeEach } from 'vitest';
import { SwitchHost } from '../../nodes/switch';
import { SpanningTreeProtocol } from '../../services/spanningtree';
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
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { IPAddress } from '../../address';
import { Dot1QInterface } from '../../layers/datalink';
import { RouterHost } from '../../nodes/router';
import { SwitchHost } from '../../nodes/switch';
import { VlanMode } from '../../protocols/ethernet';
import { Terminal } from '../terminal';

describe('Terminal interface test', () => {
  let terminalRouter: Terminal;
  let terminalSwitch: Terminal;

  beforeEach(() => {
    terminalRouter = new Terminal(new RouterHost('R', 4));
    terminalSwitch = new Terminal(new SwitchHost('S', 4));
  });

  it('ip addr', () => {
    const host = terminalRouter.Node as RouterHost;
    const A = IPAddress.generateAddress();
    const B = IPAddress.generateAddress();

    host.getInterface(0).setNetAddress(A);

    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    expect(terminalRouter.exec('interface')).toBe(false);
    expect(terminalRouter.exec('interface gig')).toBe(false);
    expect(terminalRouter.exec('interface gig 9/9')).toBe(false);
    expect(terminalRouter.exec('interface gig 0/0')).toBe(true);

    expect(terminalRouter.exec('ip')).toBe(false);
    expect(terminalRouter.exec('ip address')).toBe(false);
    expect(terminalRouter.exec(`ip address ${B.toString()}`)).toBe(false);
    expect(
      terminalRouter.exec(
        `ip address ${B.toString()} ${B.generateMask().toString()}`
      )
    ).toBe(true);

    expect(host.getInterface(0).getNetAddress().toString()).toBe(B.toString());
    expect(host.getInterface(0).getNetMask().toString()).toBe(
      B.generateMask().toString()
    );

    // should not exist on switch
    terminalSwitch.exec('enable');
    terminalSwitch.exec('configure terminal');
    terminalSwitch.exec('interface gig 0/0');
    expect(terminalSwitch.autocomplete('ip')).toEqual([]);
  });

  it('switchport', () => {
    const host = terminalSwitch.Node as SwitchHost;
    host.knownVlan[10] = 'VLAN10';
    host.knownVlan[20] = 'VLAN20';

    const iface = host.getInterface(0) as Dot1QInterface;

    terminalSwitch.exec('enable');
    terminalSwitch.exec('configure terminal');
    terminalSwitch.exec('interface gig 0/0');

    expect(iface.Vlan).toEqual([iface.NativeVlan]);
    expect(iface.VlanMode).toBe(VlanMode.Access);

    expect(terminalSwitch.exec('switchport')).toBe(false);
    expect(terminalSwitch.exec('switchport mode')).toBe(false);
    expect(terminalSwitch.exec('switchport mode toto')).toBe(false);
    expect(terminalSwitch.exec('switchport mode trunk')).toBe(true);
    expect(iface.VlanMode).toBe(VlanMode.Trunk);

    expect(terminalSwitch.exec('switchport mode access')).toBe(true);

    expect(terminalSwitch.exec('switchport access')).toBe(false);
    expect(terminalSwitch.exec('switchport access vlan')).toBe(false);
    expect(terminalSwitch.exec('switchport access vlan 10')).toBe(true);
    expect(iface.Vlan).toEqual([10]);
    expect(iface.VlanMode).toBe(VlanMode.Access);
    terminalSwitch.exec('switchport access vlan 20');
    expect(iface.Vlan).toEqual([20]);

    terminalSwitch.exec('switchport mode trunk');
    terminalSwitch.exec('switchport trunk allowed vlan remove 20');
    terminalSwitch.exec('switchport trunk allowed vlan add 10');
    expect(iface.Vlan).toEqual([10]);
    terminalSwitch.exec('switchport trunk allowed vlan add 20');
    expect(iface.Vlan).toEqual([10, 20]);
    terminalSwitch.exec('switchport trunk allowed vlan remove 10');
    expect(iface.Vlan).toEqual([20]);
    terminalSwitch.exec('switchport trunk allowed vlan remove 20');
    expect(iface.Vlan).toEqual([]);
    terminalSwitch.exec('switchport trunk allowed vlan all');
    expect(iface.Vlan).toEqual([10, 20]);
    terminalSwitch.exec('switchport trunk allowed vlan 10');
    expect(iface.Vlan).toEqual([10]);
    terminalSwitch.exec('switchport trunk allowed vlan except 10');
    expect(iface.Vlan).toEqual([20]);
    terminalSwitch.exec('switchport trunk allowed vlan all');
    expect(iface.Vlan).toEqual([10, 20]);

    terminalSwitch.exec('switchport trunk native vlan 42');
    terminalSwitch.exec('switchport trunk allowed vlan remove 10');
    terminalSwitch.exec('switchport trunk allowed vlan remove 20');
    expect(iface.Vlan).toEqual([]);
    terminalSwitch.exec('switchport mode access');
    expect(iface.Vlan).toEqual([42]);

    // should not exist on router
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');
    terminalRouter.exec('interface gig 0/0');
    expect(terminalRouter.autocomplete('switchport')).toEqual([]);
  });

  it('interface range - basic parsing with slash format', () => {
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    // Test valid range with slash format (0/0-3)
    expect(terminalRouter.exec('interface range gig 0/0-3')).toBe(true);
    expect(terminalRouter.Prompt).toContain('(config-if-range)#');

    // Exit and test again with different range
    terminalRouter.exec('end');
    expect(terminalRouter.exec('interface range gig 0/1-2')).toBe(true);
    expect(terminalRouter.Prompt).toContain('(config-if-range)#');
  });

  it('interface range - commands apply to all interfaces', () => {
    const host = terminalRouter.Node as RouterHost;

    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    // Set initial state
    host.getInterface(0).description = '';
    host.getInterface(1).description = '';
    host.getInterface(2).description = '';

    // Enter range mode and set description
    terminalRouter.exec('interface range gig 0/0-2');
    terminalRouter.exec('description TestRange');

    // Verify all interfaces in range got the description
    expect(host.getInterface(0).description).toBe('TestRange');
    expect(host.getInterface(1).description).toBe('TestRange');
    expect(host.getInterface(2).description).toBe('TestRange');
    expect(host.getInterface(3).description).toBe(''); // Not in range
  });

  it('interface range - shutdown command applies to all', () => {
    const host = terminalRouter.Node as RouterHost;

    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    // Enable all interfaces first
    host.getInterface(0).up();
    host.getInterface(1).up();
    host.getInterface(2).up();
    host.getInterface(3).up();

    // Shutdown range
    terminalRouter.exec('interface range gig 0/0-2');
    terminalRouter.exec('shutdown');

    expect(host.getInterface(0).isActive()).toBe(false);
    expect(host.getInterface(1).isActive()).toBe(false);
    expect(host.getInterface(2).isActive()).toBe(false);
    expect(host.getInterface(3).isActive()).toBe(true); // Not in range

    // Test no shutdown
    terminalRouter.exec('no shutdown');
    expect(host.getInterface(0).isActive()).toBe(true);
    expect(host.getInterface(1).isActive()).toBe(true);
    expect(host.getInterface(2).isActive()).toBe(true);
  });

  it('interface range - IP addresses on range', () => {
    const host = terminalRouter.Node as RouterHost;
    const ipBase = new IPAddress('192.168.1.1');
    const mask = new IPAddress('255.255.255.0', true);

    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    terminalRouter.exec('interface range gig 0/0-2');
    terminalRouter.exec(`ip address ${ipBase.toString()} ${mask.toString()}`);

    // All interfaces should have the same IP (not ideal but shows it applies)
    expect(host.getInterface(0).getNetAddress().toString()).toBe(
      ipBase.toString()
    );
    expect(host.getInterface(1).getNetAddress().toString()).toBe(
      ipBase.toString()
    );
    expect(host.getInterface(2).getNetAddress().toString()).toBe(
      ipBase.toString()
    );
  });

  it('interface range - validation rejects invalid interfaces', () => {
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    // Try to use a range that includes non-existent interfaces
    // Router has 4 interfaces (0/0 to 0/3)
    expect(terminalRouter.exec('interface range gig 0/0-10')).toBe(false);
  });

  it('interface range - switchport commands on switch', () => {
    const host = terminalSwitch.Node as SwitchHost;
    host.knownVlan[10] = 'VLAN10';

    terminalSwitch.exec('enable');
    terminalSwitch.exec('configure terminal');

    const iface0 = host.getInterface(0) as Dot1QInterface;
    const iface1 = host.getInterface(1) as Dot1QInterface;
    const iface2 = host.getInterface(2) as Dot1QInterface;

    // Set all to trunk mode via range
    terminalSwitch.exec('interface range gig 0/0-2');
    terminalSwitch.exec('switchport mode trunk');

    expect(iface0.VlanMode).toBe(VlanMode.Trunk);
    expect(iface1.VlanMode).toBe(VlanMode.Trunk);
    expect(iface2.VlanMode).toBe(VlanMode.Trunk);

    // Set to access mode and assign VLAN
    terminalSwitch.exec('switchport mode access');
    terminalSwitch.exec('switchport access vlan 10');

    expect(iface0.VlanMode).toBe(VlanMode.Access);
    expect(iface0.Vlan).toEqual([10]);
    expect(iface1.VlanMode).toBe(VlanMode.Access);
    expect(iface1.Vlan).toEqual([10]);
    expect(iface2.VlanMode).toBe(VlanMode.Access);
    expect(iface2.Vlan).toEqual([10]);
  });

  it('interface range - autocomplete shows range option', () => {
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    // Check that "range" is suggested
    const completions = terminalRouter.autocomplete('interface ');
    expect(completions).toContain('range');

    // Check that "range" autocompletes properly
    const rangeCompletions = terminalRouter.autocomplete('interface r');
    expect(rangeCompletions).toContain('range');
  });

  it('interface range - invalid format errors', () => {
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    // Missing range
    expect(terminalRouter.exec('interface range')).toBe(false);

    // Missing type
    expect(terminalRouter.exec('interface range gig')).toBe(false);

    // Invalid range format (no dash)
    expect(terminalRouter.exec('interface range gig 0/0')).toBe(false);

    // Invalid range format (start > end)
    expect(terminalRouter.exec('interface range gig 0/3-0')).toBe(false);
  });

  it('interface range - trunk allowed vlan commands', () => {
    const host = terminalSwitch.Node as SwitchHost;
    host.knownVlan[10] = 'VLAN10';
    host.knownVlan[20] = 'VLAN20';
    host.knownVlan[30] = 'VLAN30';

    terminalSwitch.exec('enable');
    terminalSwitch.exec('configure terminal');

    const iface0 = host.getInterface(0) as Dot1QInterface;
    const iface1 = host.getInterface(1) as Dot1QInterface;
    const iface2 = host.getInterface(2) as Dot1QInterface;

    // Set all to trunk mode and configure allowed VLANs
    terminalSwitch.exec('interface range gig 0/0-2');
    terminalSwitch.exec('switchport mode trunk');
    terminalSwitch.exec('switchport trunk allowed vlan all');

    expect(iface0.Vlan).toEqual([10, 20, 30]);
    expect(iface1.Vlan).toEqual([10, 20, 30]);
    expect(iface2.Vlan).toEqual([10, 20, 30]);

    // Test allowed vlan add
    terminalSwitch.exec('switchport trunk allowed vlan remove 20');
    expect(iface0.Vlan).toEqual([10, 30]);
    expect(iface1.Vlan).toEqual([10, 30]);
    expect(iface2.Vlan).toEqual([10, 30]);

    // Test allowed vlan except
    terminalSwitch.exec('switchport trunk allowed vlan except 10');
    expect(iface0.Vlan).toEqual([20, 30]);
    expect(iface1.Vlan).toEqual([20, 30]);
    expect(iface2.Vlan).toEqual([20, 30]);

    // Test native vlan
    terminalSwitch.exec('switchport trunk native vlan 20');
    expect(iface0.NativeVlan).toBe(20);
    expect(iface1.NativeVlan).toBe(20);
    expect(iface2.NativeVlan).toBe(20);
  });
});

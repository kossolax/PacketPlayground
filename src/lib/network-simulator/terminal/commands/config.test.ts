import { describe, it, expect, beforeEach } from 'vitest';
import { RouterHost } from '../../nodes/router';
import { SwitchHost } from '../../nodes/switch';
import { Terminal } from '../terminal';

describe('Terminal config test', () => {
  let terminalRouter: Terminal;
  let terminalSwitch: Terminal;

  beforeEach(() => {
    terminalRouter = new Terminal(new RouterHost('R', 4));
    terminalSwitch = new Terminal(new SwitchHost('S', 4));
  });

  it('configure', () => {
    terminalRouter.exec('enable');
    expect(terminalRouter.exec('configure')).toBe(false);
    expect(terminalRouter.exec('configure terminal')).toBe(true);
  });

  it('hostname', () => {
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    const hostname = Math.random().toString(36).substring(7);
    expect(terminalRouter.exec(`hostname ${hostname}`)).toBe(true);
    expect(terminalRouter.exec('hostname')).toBe(false);

    expect(terminalRouter.Node.name).toBe(hostname);
    expect(terminalRouter.Prompt).toBe(`${hostname}(config)#`);

    terminalRouter.exec('exit');
    expect(terminalRouter.Prompt).toBe(`${hostname}$`);
  });

  it('ip route', () => {
    const host = terminalRouter.Node as RouterHost;

    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');

    expect(host.RoutingTable.length).toBe(0);

    expect(terminalRouter.exec('ip')).toBe(false);
    expect(terminalRouter.exec('ip route')).toBe(false);
    expect(terminalRouter.exec('ip route 192.168.0.0')).toBe(false);
    expect(terminalRouter.exec('ip route 192.168.0.0 255.255.255.0')).toBe(
      false
    );
    expect(
      terminalRouter.exec('ip route 192.168.0.0 255.255.255.0 192.168.20.1')
    ).toBe(true);

    terminalRouter.exec('ip route 0.0.0.0 0.0.0.0 192.168.30.1');
    expect(host.RoutingTable.length).toBe(2);
    terminalRouter.exec('no ip route 0.0.0.0 0.0.0.0 192.168.30.1');
    expect(host.RoutingTable.length).toBe(1);
    expect(host.RoutingTable[0].network.toString()).toBe('192.168.0.0');
    terminalRouter.exec('ip route 0.0.0.0 0.0.0.0 192.168.30.1');
    terminalRouter.exec('no ip route 192.168.0.0 255.255.255.0 192.168.20.1');
    expect(host.RoutingTable.length).toBe(1);
    expect(host.RoutingTable[0].network.toString()).toBe('0.0.0.0');

    // should not exist on switch
    terminalSwitch.exec('enable');
    terminalSwitch.exec('configure terminal');
    expect(terminalSwitch.autocomplete('ip')).toEqual([]);
  });

  it('vlan', () => {
    const host = terminalSwitch.Node as SwitchHost;

    terminalSwitch.exec('enable');
    terminalSwitch.exec('configure terminal');

    expect(host.knownVlan[10]).toBeUndefined();
    expect(host.knownVlan[20]).toBeUndefined();

    expect(terminalSwitch.exec('vlan')).toBe(false);
    expect(terminalSwitch.exec('vlan 10')).toBe(true);
    expect(terminalSwitch.exec('name')).toBe(false);
    expect(terminalSwitch.exec('name rouge')).toBe(true);
    terminalSwitch.exec('end');

    terminalSwitch.exec('vlan 20');
    terminalSwitch.exec('name bleu');
    terminalSwitch.exec('end');

    expect(host.knownVlan[10]).toBe('rouge');
    expect(host.knownVlan[20]).toBe('bleu');

    terminalSwitch.exec('no vlan 10');
    expect(host.knownVlan[10]).toBeUndefined();

    terminalSwitch.exec('vlan 10');
    terminalSwitch.exec('end');
    expect(host.knownVlan[10]).not.toBeUndefined();
    expect(host.knownVlan[10]).not.toBe('rouge');

    // should not exist on router
    terminalRouter.exec('enable');
    terminalRouter.exec('configure terminal');
    expect(terminalRouter.autocomplete('vlan')).toEqual([]);
  });
});

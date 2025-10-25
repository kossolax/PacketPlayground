import { describe, it, expect, beforeEach } from 'vitest';
import { Link } from '../layers/physical';
import { SwitchHost } from './switch';
import { RouterHost } from './router';
import { ComputerHost, ServerHost } from './server';
import type { GenericEventListener } from '../protocols/base';
import { IPAddress, MacAddress } from '../address';
import { DatalinkMessage, NetworkMessage } from '../message';

describe('nodes', () => {
  let L1: Link;
  let L2: SwitchHost;
  let L3: RouterHost;
  let L4A: ServerHost;
  let L4B: ComputerHost;

  beforeEach(() => {
    L2 = new SwitchHost('Switch', 2);
    L3 = new RouterHost('Router', 2);

    L4A = new ServerHost('Server', 'server', 1);
    L4B = new ComputerHost('Computer', 'computer', 1);
    L1 = new Link(L2.getInterface(0), L2.getInterface(1), 1000);

    for (let i = 0; i < 2; i += 1) {
      L2.getInterface(i).up();
      L3.getInterface(i).up();
    }
    L4A.getInterface(0).up();
    L4B.getInterface(0).up();
  });

  it('L2 clone', () => {
    const node = L2.clone();

    expect(node).not.toEqual(L2);
    expect(node.name).toEqual(L2.name);

    const ifaces = L2.getInterfaces().length;
    expect(node.getInterfaces().length).toEqual(L2.getInterfaces().length);
    for (let i = 0; i < ifaces; i += 1) {
      expect(node.getInterfaces()[i]).toEqual(L2.getInterfaces()[i]);
      expect(node.getInterface(i)).not.toEqual(L2.getInterface(i));
    }
  });

  it('L3 clone', () => {
    const node = L3.clone();

    expect(node).not.toEqual(L3);
    expect(node.name).toEqual(L3.name);

    const ifaces = L3.getInterfaces().length;
    expect(node.getInterfaces().length).toEqual(L3.getInterfaces().length);
    for (let i = 0; i < ifaces; i += 1) {
      expect(node.getInterfaces()[i]).toEqual(L3.getInterfaces()[i]);
      expect(node.getInterface(i)).not.toEqual(L3.getInterface(i));
      expect(node.getInterface(i).getInterface(0)).not.toEqual(
        L3.getInterface(i).getInterface(0)
      );
    }
  });

  it('L4 clone', () => {
    const nodeA = L4A.clone();

    expect(nodeA).not.toEqual(L4A);
    expect(nodeA.name).toEqual(L4A.name);

    expect(nodeA.getInterfaces().length).toEqual(L4A.getInterfaces().length);
    for (let i = 0; i < L4A.getInterfaces().length; i += 1) {
      expect(nodeA.getInterfaces()[i]).toEqual(L4A.getInterfaces()[i]);
      expect(nodeA.getInterface(i)).not.toEqual(L4A.getInterface(i));
      expect(nodeA.getInterface(i).getInterface(0)).not.toEqual(
        L4A.getInterface(i).getInterface(0)
      );
    }

    const nodeB = L4B.clone();
    expect(nodeB).not.toEqual(L4B);
    expect(nodeB.name).toEqual(L4B.name);

    expect(nodeB.getInterfaces().length).toEqual(L4B.getInterfaces().length);
    for (let i = 0; i < L4B.getInterfaces().length; i += 1) {
      expect(nodeB.getInterfaces()[i]).toEqual(L4B.getInterfaces()[i]);
      expect(nodeB.getInterface(i)).not.toEqual(L4B.getInterface(i));
      expect(nodeB.getInterface(i).getInterface(0)).not.toEqual(
        L4B.getInterface(i).getInterface(0)
      );
    }
  });

  it('listener', () => {
    const listener: GenericEventListener = () => {};
    const obj = [L1, L2, L3, L4A, L4B];

    obj.forEach((L) => {
      let count = L.getListener.length;
      L.addListener(listener);
      L.addListener(listener);
      expect(L.getListener.length).toEqual(count + 1);
      L.removeListener(listener);
      expect(L.getListener.length).toEqual(count);

      const iface = L.getInterface(0)!;

      count = iface.getListener.length;
      iface.addListener(listener);
      iface.addListener(listener);
      expect(iface.getListener.length).toEqual(count + 1);
      iface.removeListener(listener);
      expect(iface.getListener.length).toEqual(count);
    });
  });

  it('string', () => {
    const obj = [L1, L2, L3, L4A, L4B];

    obj.forEach((L) => {
      expect(L.toString()).not.toBe('undefined');
      expect(L.toString()).not.toBe('null');
      expect(L.toString()).not.toBe('object');
      expect(L.toString()).not.toBe('Object');
    });
  });

  it('getInterface', () => {
    expect(() => L2.getInterface(-1)).toThrow();
    expect(() => L2.getInterface(2)).toThrow();
    expect(() => L2.getInterface('plop' as unknown as number)).toThrow();
    expect(() => L2.getFirstAvailableInterface()).toThrow();
  });

  it('send', () => {
    const mac = [L2];
    const ip = [L3, L4A, L4B];

    mac.forEach((L) => {
      expect(() => L.send('hello')).toThrow();
      expect(() =>
        L.send('hello', MacAddress.generateBroadcast())
      ).not.toThrow();
      expect(() =>
        L.send(
          new DatalinkMessage(
            'hello',
            L.getInterface(0).getMacAddress(),
            MacAddress.generateBroadcast()
          )
        )
      ).not.toThrow();
    });

    ip.forEach((L) => {
      expect(() => L.send('hello')).toThrow();
      expect(() =>
        L.send('hello', IPAddress.generateBroadcast())
      ).not.toThrow();
      expect(() =>
        L.send(
          new NetworkMessage(
            'hello',
            L.getInterface(0).getNetAddress(),
            IPAddress.generateBroadcast()
          )
        )
      ).not.toThrow();
    });
  });

  it('nextHop', () => {
    const ipRouters = [L3];
    const pc = [L4A, L4B];

    ipRouters.forEach((L) => {
      L.getInterface(0).setNetAddress(new IPAddress('192.168.0.1'));
      expect(
        L.getNextHop(new IPAddress('192.168.0.2'))?.equals(
          new IPAddress('192.168.0.2')
        )
      ).toBe(true);
      expect(L.getNextHop(new IPAddress('192.168.1.2'))).toBeNull();

      L.addRoute('0.0.0.0', '0.0.0.0', '192.168.0.254');

      expect(
        L.getNextHop(new IPAddress('192.168.0.2'))?.equals(
          new IPAddress('192.168.0.2')
        )
      ).toBe(true);
      expect(
        L.getNextHop(new IPAddress('192.168.1.2'))?.equals(
          new IPAddress('192.168.0.254')
        )
      ).toBe(true);
    });

    pc.forEach((L) => {
      L.getInterface(0).setNetAddress(new IPAddress('192.168.0.1'));
      expect(
        L.getNextHop(new IPAddress('192.168.0.2'))?.equals(
          new IPAddress('192.168.0.2')
        )
      ).toBe(true);
      expect(L.getNextHop(new IPAddress('192.168.1.2'))).toBeNull();

      // eslint-disable-next-line no-param-reassign
      L.gateway = new IPAddress('192.168.0.254');

      expect(
        L.getNextHop(new IPAddress('192.168.0.2'))?.equals(
          new IPAddress('192.168.0.2')
        )
      ).toBe(true);
      expect(
        L.getNextHop(new IPAddress('192.168.1.2'))?.equals(
          new IPAddress('192.168.0.254')
        )
      ).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { IPAddress, MacAddress } from './address';

describe('address test', () => {
  it('equals', () => {
    const mac1 = MacAddress.generateAddress();
    const mac2 = MacAddress.generateAddress();
    const mac3 = new MacAddress('40:41:42:43:44:45');
    const mac4 = new MacAddress('40:41:42:43:44:45');

    const ipv41 = IPAddress.generateAddress();
    const ipv42 = IPAddress.generateAddress();
    const ipv43 = new IPAddress('10.1.2.3');
    const ipv44 = new IPAddress('10.1.2.3');

    expect(mac1.equals(mac2)).toBe(false);
    expect(mac1.equals(mac3)).toBe(false);
    expect(mac1.equals(null)).toBe(false);
    expect(mac3.equals(mac3)).toBe(true);
    expect(mac3.equals(mac4)).toBe(true);

    expect(ipv41.equals(ipv42)).toBe(false);
    expect(ipv41.equals(ipv43)).toBe(false);
    expect(ipv41.equals(null)).toBe(false);
    expect(ipv43.equals(ipv43)).toBe(true);
    expect(ipv43.equals(ipv44)).toBe(true);
  });

  it('compare', () => {
    const mac1 = new MacAddress('40:41:42:43:44:45');
    const mac2 = new MacAddress('40:41:43:43:44:45');
    const mac3 = new MacAddress('40:41:44:43:44:45');

    const ipv41 = new IPAddress('10.1.2.3');
    const ipv42 = new IPAddress('10.2.2.3');
    const ipv43 = new IPAddress('10.3.2.3');

    expect(mac2.compareTo(mac1)).toBe(1);
    expect(mac2.compareTo(mac2)).toBe(0);
    expect(mac2.compareTo(mac3)).toBe(-1);

    expect(ipv42.compareTo(ipv41)).toBe(1);
    expect(ipv42.compareTo(ipv42)).toBe(0);
    expect(ipv42.compareTo(ipv43)).toBe(-1);
  });

  it('invalid MAC', () => {
    expect(() => new MacAddress('FF:FF:FF:FF:FF:FF:')).toThrow();
    expect(() => new MacAddress(':FF:FF:FF:FF:FF:FF')).toThrow();
    expect(() => new MacAddress('FF:FF::FF:FF:FF:FF')).toThrow();
    expect(() => new MacAddress('FF:FF:FF:FF:FF:042')).toThrow();
    expect(() => new MacAddress('FF:FF:FF:FF:FF:128')).toThrow();
    expect(() => new MacAddress('FF:FF:FF:FF:FF:-1')).toThrow();

    expect(() => new MacAddress('40:41:42:43:44:45')).not.toThrow();
  });

  it('invalid IPv4', () => {
    expect(() => new IPAddress('255.255.255.255.')).toThrow();
    expect(() => new IPAddress('.255.255.255.255')).toThrow();
    expect(() => new IPAddress('255.255..255.255')).toThrow();
    expect(() => new IPAddress('255.255.255.042')).toThrow();
    expect(() => new IPAddress('255.255.255.256')).toThrow();
    expect(() => new IPAddress('255.255.255.-1')).toThrow();

    expect(() => new IPAddress('255.0.255.0', true)).toThrow();

    expect(() => new IPAddress('192.168.0.1')).not.toThrow();
    expect(() => new IPAddress('255.255.0.0', true)).not.toThrow();
  });

  it('broadcast', () => {
    expect(
      IPAddress.generateBroadcast().equals(new IPAddress('255.255.255.255'))
    ).toBe(true);
    expect(
      MacAddress.generateBroadcast().equals(new MacAddress('FF:FF:FF:FF:FF:FF'))
    ).toBe(true);

    expect(IPAddress.generateBroadcast().isBroadcast).toBe(true);
    expect(MacAddress.generateBroadcast().isBroadcast).toBe(true);

    expect(IPAddress.generateAddress().isBroadcast).toBe(false);
    expect(MacAddress.generateAddress().isBroadcast).toBe(false);
  });

  it('IPv4 mask', () => {
    const ipv41 = new IPAddress('10.0.0.1');
    const ipv42 = new IPAddress('172.16.0.1');
    const ipv43 = new IPAddress('192.168.0.1');

    expect(ipv41.generateMask().equals(new IPAddress('255.0.0.0', true))).toBe(
      true
    );
    expect(
      ipv42.generateMask().equals(new IPAddress('255.255.0.0', true))
    ).toBe(true);
    expect(
      ipv43.generateMask().equals(new IPAddress('255.255.255.0', true))
    ).toBe(true);
    expect(ipv41.generateMask().CIDR).toBe(8);
    expect(ipv42.generateMask().CIDR).toBe(16);
    expect(ipv43.generateMask().CIDR).toBe(24);
  });

  it('IPv4 network', () => {
    const ipv41 = new IPAddress('10.0.0.1');
    const ipv42 = new IPAddress('172.16.0.1');
    const ipv43 = new IPAddress('192.168.0.1');

    expect(
      ipv41.InSameNetwork(ipv41.generateMask(), new IPAddress('10.0.0.1'))
    ).toBe(true);
    expect(
      ipv41.InSameNetwork(ipv41.generateMask(), new IPAddress('10.250.42.24'))
    ).toBe(true);
    expect(
      ipv41.InSameNetwork(ipv41.generateMask(), new IPAddress('11.0.0.1'))
    ).toBe(false);
    expect(
      ipv41.InSameNetwork(ipv41.generateMask(), new IPAddress('9.0.0.1'))
    ).toBe(false);

    expect(
      ipv42.InSameNetwork(ipv42.generateMask(), new IPAddress('172.16.0.1'))
    ).toBe(true);
    expect(
      ipv42.InSameNetwork(ipv42.generateMask(), new IPAddress('172.16.42.24'))
    ).toBe(true);
    expect(
      ipv42.InSameNetwork(ipv42.generateMask(), new IPAddress('172.17.0.0'))
    ).toBe(false);
    expect(
      ipv42.InSameNetwork(ipv42.generateMask(), new IPAddress('172.15.0.0'))
    ).toBe(false);

    expect(
      ipv43.InSameNetwork(ipv43.generateMask(), new IPAddress('192.168.0.1'))
    ).toBe(true);
    expect(
      ipv43.InSameNetwork(ipv43.generateMask(), new IPAddress('192.168.0.42'))
    ).toBe(true);
    expect(
      ipv43.InSameNetwork(ipv43.generateMask(), new IPAddress('192.168.1.1'))
    ).toBe(false);
    expect(
      ipv43.InSameNetwork(ipv43.generateMask(), new IPAddress('192.168.255.1'))
    ).toBe(false);

    expect(
      ipv43.InSameNetwork(
        new IPAddress('255.0.0.0', true),
        new IPAddress('192.42.255.1')
      )
    ).toBe(true);
    expect(
      ipv43.InSameNetwork(
        new IPAddress('255.255.0.0', true),
        new IPAddress('192.42.255.1')
      )
    ).toBe(false);
    expect(
      ipv43.InSameNetwork(
        new IPAddress('255.255.0.0', true),
        new IPAddress('192.168.42.1')
      )
    ).toBe(true);
    expect(
      ipv43.InSameNetwork(
        new IPAddress('0.0.0.0', true),
        new IPAddress('42.42.42.42')
      )
    ).toBe(true);
  });

  it('IPv4 math', () => {
    const ipv41 = new IPAddress('10.0.0.1');
    const ipv42 = new IPAddress('172.16.0.1');
    const ipv43 = new IPAddress('192.168.0.1');

    expect(
      ipv41.getNetworkIP(ipv41.generateMask()).equals(new IPAddress('10.0.0.0'))
    ).toBe(true);
    expect(
      ipv41
        .getNetworkIP(ipv41.generateMask())
        .add(2)
        .equals(new IPAddress('10.0.0.2'))
    ).toBe(true);
    expect(
      ipv41
        .getNetworkIP(ipv41.generateMask())
        .add(256)
        .equals(new IPAddress('10.0.1.0'))
    ).toBe(true);
    expect(
      ipv41
        .getNetworkIP(ipv41.generateMask())
        .add(256 * 256)
        .equals(new IPAddress('10.1.0.0'))
    ).toBe(true);

    expect(
      ipv41
        .getBroadcastIP(ipv41.generateMask())
        .equals(new IPAddress('10.255.255.255'))
    ).toBe(true);
    expect(
      ipv41
        .getBroadcastIP(ipv41.generateMask())
        .subtract(1)
        .equals(new IPAddress('10.255.255.254'))
    ).toBe(true);
    expect(
      ipv41
        .getBroadcastIP(ipv41.generateMask())
        .subtract(256)
        .equals(new IPAddress('10.255.254.255'))
    ).toBe(true);
    expect(
      ipv41
        .getBroadcastIP(ipv41.generateMask())
        .subtract(256 * 256)
        .equals(new IPAddress('10.254.255.255'))
    ).toBe(true);

    expect(
      ipv41
        .getBroadcastIP(ipv41.generateMask())
        .subtract(256 * 256)
        .add(256 * 256 + 1)
        .equals(new IPAddress('11.0.0.0'))
    ).toBe(true);

    expect(
      ipv42
        .getNetworkIP(ipv42.generateMask())
        .equals(new IPAddress('172.16.0.0'))
    ).toBe(true);
    expect(
      ipv42
        .getBroadcastIP(ipv42.generateMask())
        .equals(new IPAddress('172.16.255.255'))
    ).toBe(true);

    expect(
      ipv43
        .getNetworkIP(ipv43.generateMask())
        .equals(new IPAddress('192.168.0.0'))
    ).toBe(true);
    expect(
      ipv43
        .getBroadcastIP(ipv43.generateMask())
        .equals(new IPAddress('192.168.0.255'))
    ).toBe(true);
  });
});

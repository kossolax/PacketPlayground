import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress, MacAddress } from '../address';
import { Link } from '../layers/physical';
import {
  DhcpClient,
  DhcpMessage,
  DhcpPool,
  DhcpServer,
  DhcpType,
} from './dhcp';
import { ServerHost } from '../nodes/server';
import { RouterHost } from '../nodes/router';
import { SwitchHost } from '../nodes/switch';

describe('DHCP protocol', () => {
  let A: ServerHost;
  let B: ServerHost;
  let C: ServerHost;
  let R: RouterHost;
  let S: SwitchHost;

  beforeEach(() => {
    A = new ServerHost();
    A.name = 'A';
    A.addInterface().up();
    A.getInterface(0).setNetAddress(new IPAddress('192.168.0.1'));
    A.gateway = new IPAddress('192.168.0.254');

    B = new ServerHost();
    B.name = 'B';
    B.addInterface().up();

    C = new ServerHost();
    C.name = 'C';
    C.addInterface().up();

    S = new SwitchHost();
    S.addInterface().up();
    S.addInterface().up();
    S.addInterface().up();

    R = new RouterHost();
    R.addInterface().up();
    R.getInterface(0).setNetAddress(new IPAddress('192.168.0.254'));
    R.addInterface().up();
    R.getInterface(1).setNetAddress(new IPAddress('192.168.1.254'));

    const pool0 = new DhcpPool();
    pool0.gatewayAddress = new IPAddress('192.168.0.254');
    pool0.netmaskAddress = new IPAddress('255.255.255.0');
    pool0.startAddress = new IPAddress('192.168.0.2');
    pool0.endAddress = new IPAddress('192.168.0.254');

    const pool1 = new DhcpPool();
    pool1.gatewayAddress = new IPAddress('192.168.1.254');
    pool1.netmaskAddress = new IPAddress('255.255.255.0');
    pool1.startAddress = new IPAddress('192.168.1.1');
    pool1.endAddress = new IPAddress('192.168.1.254');

    A.services.dhcp.pools.push(pool0);
    A.services.dhcp.pools.push(pool1);
    A.services.dhcp.Enable = true;

    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  it('Request: PC-->Server', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AB = new Link(A.getInterface(0), B.getInterface(0));

    B.getInterface(0).AutoNegociateAddress = false;
    expect(B.getInterface(0).AutoNegociateAddress).toBeFalsy();
    B.getInterface(0).AutoNegociateAddress = true;
    expect(B.getInterface(0).AutoNegociateAddress).toBeTruthy();
    B.getInterface(0).AutoNegociateAddress = false;

    const dhcpClient = new DhcpClient(B.getInterface(0));
    const msg = await dhcpClient.negociate();

    expect(msg).toBeInstanceOf(IPAddress);
    expect(msg as IPAddress).not.toEqual(new IPAddress('0.0.0.0'));
  });

  it('Request: PC-->Switch-->Server', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AS = new Link(A.getInterface(0), S.getInterface(0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const SB = new Link(S.getInterface(1), B.getInterface(0));

    const dhcpClient = new DhcpClient(B.getInterface(0));

    const msg = await dhcpClient.negociate();

    expect(msg).toBeInstanceOf(IPAddress);
    expect(msg as IPAddress).not.toEqual(new IPAddress('0.0.0.0'));
  });

  it('Request: [2PC]-->Switch-->Server', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AS = new Link(A.getInterface(0), S.getInterface(0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const SB = new Link(S.getInterface(1), B.getInterface(0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const SC = new Link(S.getInterface(2), C.getInterface(0));

    const dhcpClient1 = new DhcpClient(B.getInterface(0));
    const dhcpClient2 = new DhcpClient(C.getInterface(0));

    const [msg1, msg2] = await Promise.all([
      dhcpClient1.negociate(),
      dhcpClient2.negociate(),
    ]);

    expect(msg1).toBeInstanceOf(IPAddress);
    expect(msg2).toBeInstanceOf(IPAddress);
    expect(msg1 as IPAddress).not.toEqual(new IPAddress('0.0.0.0'));
    expect(msg2 as IPAddress).not.toEqual(new IPAddress('0.0.0.0'));
    expect(msg1 as IPAddress).not.toEqual(msg2 as IPAddress);
  });

  it('Request: PC-->Router-->Server', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AR = new Link(A.getInterface(0), R.getInterface(0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const RB = new Link(R.getInterface(1), B.getInterface(0));

    const dhcpRelay = new DhcpServer(R);
    dhcpRelay.forwarder = new IPAddress('192.168.0.1');
    dhcpRelay.Enable = true;

    const dhcpClient = new DhcpClient(B.getInterface(0));

    const msg = await dhcpClient.negociate();

    expect(msg).toBeInstanceOf(IPAddress);
    expect(msg as IPAddress).not.toEqual(new IPAddress('0.0.0.0'));
    expect(
      new IPAddress('192.168.1.0').InSameNetwork(
        new IPAddress('255.255.255.0'),
        msg as IPAddress
      )
    ).toBeTruthy();
  });

  it('Release: [2PC]-->Switch-->Server', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AS = new Link(A.getInterface(0), S.getInterface(0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const SB = new Link(S.getInterface(1), B.getInterface(0));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const SC = new Link(S.getInterface(2), C.getInterface(0));

    const dhcpClient1 = new DhcpClient(B.getInterface(0));
    const dhcpClient2 = new DhcpClient(C.getInterface(0));

    const ip1 = await dhcpClient1.negociate();
    expect(ip1).toBeInstanceOf(IPAddress);

    dhcpClient1.release();

    // Wait a bit
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    const ip2 = await dhcpClient2.negociate();
    expect(ip2).toBeInstanceOf(IPAddress);
    expect((ip2 as IPAddress).equals(ip1 as IPAddress)).toBeTruthy();

    // Wait a bit
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });

    const ip3 = await dhcpClient1.negociate();
    expect(ip3).toBeInstanceOf(IPAddress);
    expect((ip3 as IPAddress).equals(ip1 as IPAddress)).toBeFalsy();
  });

  it('builder', () => {
    const msg = new DhcpMessage.Builder();
    expect(() => msg.build()).toThrow();

    msg.setNetSource(IPAddress.generateAddress());
    expect(() => msg.build()).toThrow();

    msg.setNetDestination(IPAddress.generateAddress());
    expect(() => msg.build()).toThrow();

    msg.setClientHardwareAddress(MacAddress.generateAddress());

    expect(() => msg.setType(DhcpType.Ack).build()).toThrow();
    expect(() => msg.setType(DhcpType.Nak).build()).toThrow();
    expect(() => msg.setType(DhcpType.Offer).build()).toThrow();

    msg.setServerAddress(IPAddress.generateAddress());
    expect(() => msg.setType(DhcpType.Offer).build()).toThrow();
    expect(() => msg.setType(DhcpType.Request).build()).toThrow();
    expect(() => msg.setType(DhcpType.Request).build()).toThrow();
    expect(() => msg.setType(DhcpType.Release).build()).toThrow();

    msg.setServerAddress(new IPAddress('0.0.0.0'));
    msg.setYourAddress(IPAddress.generateAddress());
    expect(() => msg.setType(DhcpType.Ack).build()).toThrow();
    expect(() => msg.setType(DhcpType.Nak).build()).toThrow();
    expect(() => msg.setType(DhcpType.Offer).build()).toThrow();

    msg.setClientAddress(IPAddress.generateAddress());
    expect(() => msg.setType(DhcpType.Request).build()).toThrow();

    const request = new DhcpMessage.Builder()
      .setType(DhcpType.Discover)
      .setNetSource(new IPAddress('0.0.0.0'))
      .setNetDestination(IPAddress.generateBroadcast())
      .setClientHardwareAddress(MacAddress.generateAddress())
      .build()[0] as DhcpMessage;

    expect(request.toString()).toContain('DHCP');
  });
});

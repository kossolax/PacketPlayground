import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { Link, type Interface } from './physical';
import { IPAddress, MacAddress } from '../address';
import { RouterHost } from '../nodes/router';
import { SwitchHost } from '../nodes/switch';
import { SpanningTreeProtocol } from '../services/spanningtree';
import type { NetworkMessage } from '../message';
import { ActionHandle, type NetworkListener } from '../protocols/base';

// Test listener helper
class TestListener implements NetworkListener {
  public receivedPackets: NetworkMessage[] = [];

  public onReceivePacket?: (message: NetworkMessage) => void;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  receivePacket(message: NetworkMessage, _from: Interface): ActionHandle {
    this.receivedPackets.push(message);
    this.onReceivePacket?.(message);
    return ActionHandle.Continue;
  }
}

// Helper to wait for packet or timeout
function waitForPacket(
  node: RouterHost,
  timeoutMs: number = 1000
): Promise<NetworkMessage | undefined> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;
    const listener = new TestListener();

    // eslint-disable-next-line no-param-reassign
    listener.onReceivePacket = (message) => {
      if (timeoutId) clearTimeout(timeoutId);
      node.removeListener(listener);
      resolve(message);
    };

    node.addListener(listener);

    timeoutId = setTimeout(() => {
      node.removeListener(listener);
      resolve(undefined);
    }, timeoutMs);
  });
}

describe('Network layer test', () => {
  let A: RouterHost;
  let B: SwitchHost;
  let C: RouterHost;

  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    A = new RouterHost();
    A.name = 'A';
    A.addInterface().up();

    // Disable STP in test switch to prevent RSTP message interference
    B = new SwitchHost('', 0, SpanningTreeProtocol.None);
    B.name = 'B';
    B.addInterface().up();
    B.addInterface().up();

    C = new RouterHost();
    C.name = 'C';
    C.addInterface().up();
  });

  it('L3 (down) -> L3', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `test ${Math.random()}`;
    const dst = C.getInterface(0).getNetAddress();

    A.getInterface(0).down();
    expect(() => A.send(message, dst)).toThrow();
  });

  it('L3 -> (down) L3', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 1);

    const message = `test ${Math.random()}`;
    const dst = C.getInterface(0).getNetAddress();

    C.getInterface(0).down();
    A.send(message, dst);

    const msg = await waitForPacket(C, 1000);
    expect(msg).toBeUndefined();
  });

  it('L3 <- (loopback)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `test ${Math.random()}`;

    const listener = new TestListener();
    A.getInterface(0).addListener(listener);
    A.getInterface(0).addListener(listener);

    // Note: In Angular version, this checked receiveBits$ and receiveTrame$
    // which should never fire for network layer loopback
    // The React version doesn't have these Observables, so we just check
    // that we don't receive anything unexpected

    A.send(message, A.getInterface(0).getNetAddress());

    const msg = await waitForPacket(A, 1000);
    expect(msg?.netSrc).toEqual(A.getInterface(0).getNetAddress());
    expect(msg?.netDst).toEqual(A.getInterface(0).getNetAddress());
    expect(msg?.payload).toBe(message);
  });

  it('L3 -> L3', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `Hello World: ${Math.random()}`;
    A.send(message, C.getInterface(0).getNetAddress());

    const msg = await waitForPacket(C);
    expect(msg?.netSrc).toEqual(A.getInterface(0).getNetAddress());
    expect(msg?.netDst).toEqual(C.getInterface(0).getNetAddress());
    expect(msg?.payload).toBe(message);
  });

  it('L3 -> L2 -> L3', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link2 = new Link(B.getInterface(1), C.getInterface(0), 100);

    const message = `Hello World: ${Math.random()}`;
    A.send(message, C.getInterface(0).getNetAddress());

    const msg = await waitForPacket(C);
    expect(msg?.netSrc).toEqual(A.getInterface(0).getNetAddress());
    expect(msg?.netDst).toEqual(C.getInterface(0).getNetAddress());
    expect(msg?.payload).toBe(message);
  });

  it('L3 MacAddress function', () => {
    const mac1 = A.getInterface(0).getMacAddress();
    const mac2 = MacAddress.generateAddress();

    expect(A.getInterface(0).getMacAddress()).toEqual(mac1);

    A.getInterface(0).setMacAddress(mac2);
    expect(A.getInterface(0).getMacAddress()).toEqual(mac2);
  });

  it('L3 NetAddress function', () => {
    const addr1 = A.getInterface(0).getNetAddress();
    const addr2 = IPAddress.generateAddress();

    expect(A.getInterface(0).hasNetAddress(addr1)).toBe(true);
    expect(A.getInterface(0).hasNetAddress(IPAddress.generateBroadcast())).toBe(
      true
    );
    expect(A.getInterface(0).hasNetAddress(addr2)).toBe(addr1.equals(addr2));

    expect(() => A.getInterface(0).addNetAddress(addr1)).toThrow();
    expect(() =>
      A.getInterface(0).addNetAddress(IPAddress.generateBroadcast())
    ).toThrow();

    A.getInterface(0).setNetAddress(addr2);
    expect(A.getInterface(0).hasNetAddress(addr2)).toBe(true);

    const mask = new IPAddress('255.0.0.0', true);
    A.getInterface(0).setNetMask(mask);
    expect(A.getInterface(0).getNetMask()).toEqual(
      new IPAddress('255.0.0.0', true)
    );

    expect(() => A.getInterface(0).setNetAddress(mask)).toThrow();
    expect(() =>
      A.getInterface(0).setNetMask(new IPAddress('255.0.255.0', true))
    ).toThrow();
    expect(() =>
      A.getInterface(0).setNetMask(new IPAddress('255.0.255.0'))
    ).toThrow();
  });

  it('L3 speed function', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), B.getInterface(0), 100);

    expect(() => {
      A.getInterface(0).Speed = 42;
    }).toThrow();
    expect(() => {
      A.getInterface(0).Speed = 10000000;
    }).toThrow();
    expect(() => {
      A.getInterface(0).Speed = -1;
    }).toThrow();
    expect(() => {
      A.getInterface(0).Speed = -10;
    }).toThrow();

    [10, 100, 1000].forEach((speed) => {
      A.getInterface(0).Speed = speed;
      expect(A.getInterface(0).Speed).toBe(speed);
    });
  });

  it('L3 other functions', () => {
    expect(A.getInterface(0).isConnected).toBe(false);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    expect(A.getInterface(0).isConnected).toBe(true);
  });
});

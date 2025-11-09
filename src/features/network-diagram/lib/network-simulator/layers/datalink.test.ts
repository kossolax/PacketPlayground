import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { Link } from './physical';
import { MacAddress } from '../address';
import { AutonegotiationMessage } from '../protocols/autonegotiation';
import { SwitchHost } from '../nodes/switch';
import { SpanningTreeProtocol } from '../services/spanningtree';
import { PhysicalMessage, type DatalinkMessage } from '../message';
import { HardwareInterface, EthernetInterface } from './datalink';
import { VlanMode } from '../protocols/ethernet';
import { ActionHandle, type DatalinkListener } from '../protocols/base';

// Test listener helper
class TestListener implements DatalinkListener {
  public receivedTrames: DatalinkMessage[] = [];

  public onReceiveTrame?: (message: DatalinkMessage) => void;

  receiveTrame(
    message: DatalinkMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _from: HardwareInterface
  ): ActionHandle {
    this.receivedTrames.push(message);
    this.onReceiveTrame?.(message);
    return ActionHandle.Continue;
  }
}

// Helper to wait for message or timeout
function waitForTrame(
  node: SwitchHost,
  timeoutMs: number = 1000
): Promise<DatalinkMessage | undefined> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;
    const listener = new TestListener();

    // eslint-disable-next-line no-param-reassign
    listener.onReceiveTrame = (message) => {
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

describe('Datalink layer test', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let C: SwitchHost;

  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    // Disable STP in test switches to prevent RSTP message interference
    A = new SwitchHost('A', 1, SpanningTreeProtocol.None);
    A.getInterfaces().forEach((i) => {
      A.getInterface(i).up();
    });

    B = new SwitchHost('B', 2, SpanningTreeProtocol.None);
    B.getInterfaces().forEach((i) => {
      B.getInterface(i).up();
    });

    C = new SwitchHost('C', 1, SpanningTreeProtocol.None);
    C.getInterfaces().forEach((i) => {
      C.getInterface(i).up();
    });
  });

  it('L2 (down) -> L2', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `test ${Math.random()}`;
    const mac = C.getInterface(0).getMacAddress();

    A.getInterface(0).down();
    expect(() => A.send(message, mac)).toThrow();
    expect(() =>
      A.getInterface(0).sendBits(new PhysicalMessage('hi'))
    ).toThrow();
  });

  it('L2 -> (down) L2', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 1);

    const message = `test ${Math.random()}`;
    const mac = C.getInterface(0).getMacAddress();

    C.getInterface(0).down();
    A.send(message, mac);

    const msg = await waitForTrame(C, 1000);
    expect(msg).toBeUndefined();
  });

  it('L2 -> none', async () => {
    const message = `${Math.random()}`;
    const mac = MacAddress.generateBroadcast();
    A.send(message, mac);

    const msg = await waitForTrame(C, 500);
    expect(msg).toBeUndefined();
  });

  it('L2 <- (loopback)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `test ${Math.random()}`;

    const listener = new TestListener();
    A.getInterface(0).addListener(listener);

    listener.receivedTrames.forEach((msg) => {
      if (!(msg instanceof AutonegotiationMessage)) {
        throw new Error('Should not receive bit');
      }
    });

    A.send(message, A.getInterface(0).getMacAddress());

    const msg = await waitForTrame(A, 1000);
    expect(msg?.macSrc).toEqual(A.getInterface(0).getMacAddress());
    expect(msg?.macDst).toEqual(A.getInterface(0).getMacAddress());
    expect(msg?.payload).toBe(message);
  });

  it('L2 -> L2', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), C.getInterface(0), 100);

    const message = `test ${Math.random()}`;
    A.send(message, C.getInterface(0).getMacAddress());

    const msg = await waitForTrame(C);
    expect(msg?.macSrc).toEqual(A.getInterface(0).getMacAddress());
    expect(msg?.macDst).toEqual(C.getInterface(0).getMacAddress());
    expect(msg?.payload).toBe(message);
  });

  it('L2 -> L2 -> L2', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link1 = new Link(A.getInterface(0), B.getInterface(0), 10);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link2 = new Link(B.getInterface(1), C.getInterface(0), 10);

    const message = `test ${Math.random()}`;
    A.send(message, C.getInterface(0).getMacAddress());

    const msg = await waitForTrame(C);
    expect(msg?.macSrc).toEqual(A.getInterface(0).getMacAddress());
    expect(msg?.macDst).toEqual(C.getInterface(0).getMacAddress());
    expect(msg?.payload).toBe(message);
  });

  it('L2 MacAddress function', () => {
    const mac1 = A.getInterface(0).getMacAddress();
    const mac2 = MacAddress.generateAddress();

    expect(A.getInterface(0).hasMacAddress(mac1)).toBe(true);
    expect(
      A.getInterface(0).hasMacAddress(MacAddress.generateBroadcast())
    ).toBe(true);
    expect(A.getInterface(0).hasMacAddress(mac2)).toBe(mac1.equals(mac2));

    A.getInterface(0).setMacAddress(mac2);
    expect(A.getInterface(0).hasMacAddress(mac2)).toBe(true);
  });

  it('L2 link function', () => {
    const link1 = new Link(A.getInterface(0), B.getInterface(0), 100);
    const link2 = new Link(B.getInterface(1), C.getInterface(0), 100);

    expect(A.getInterface(0).isConnectedTo(link1)).toBe(true);
    expect(B.getInterface(0).isConnectedTo(link1)).toBe(true);
    expect(B.getInterface(1).isConnectedTo(link2)).toBe(true);
    expect(C.getInterface(0).isConnectedTo(link2)).toBe(true);
    expect(A.getInterface(0).isConnectedTo(link2)).toBe(false);

    expect(() => new Link(A.getInterface(0), C.getInterface(0), 100)).toThrow();
    expect(() => new Link(A.getInterface(0), B.getInterface(0), 100)).toThrow();
    expect(() => new Link(B.getInterface(0), B.getInterface(0), 100)).toThrow();
    expect(() => new Link(B.getInterface(0), B.getInterface(1), 100)).toThrow();
    expect(() => new Link(B.getInterface(2), B.getInterface(3), 100)).toThrow();

    expect(() => A.getInterface(0).connectTo(link1)).toThrow();
    expect(() => A.getInterface(0).connectTo(link2)).toThrow();
  });

  it('L2 speed function', () => {
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

    const ethNoAuto = new EthernetInterface(
      A,
      MacAddress.generateAddress(),
      'eth0',
      100,
      100,
      false,
      false
    );
    const ethAuto = new EthernetInterface(
      A,
      MacAddress.generateAddress(),
      'eth0',
      100,
      100,
      false,
      true
    );

    ethNoAuto.up();
    ethAuto.up();

    expect(() => {
      ethNoAuto.Speed = 0;
    }).toThrow();
    expect(() => {
      ethAuto.Speed = 0;
    }).not.toThrow();
    expect(ethAuto.Speed).toBe(100);
  });

  it('L2 duplex function', () => {
    const ethHalf = new EthernetInterface(
      A,
      MacAddress.generateAddress(),
      'eth0',
      100,
      100,
      false
    );
    const ethFull = new EthernetInterface(
      A,
      MacAddress.generateAddress(),
      'eth0',
      100,
      100,
      true
    );

    expect(ethHalf.FullDuplex).toBe(false);
    expect(() => {
      ethHalf.FullDuplex = true;
    }).toThrow();

    expect(ethFull.FullDuplex).toBe(false);
    ethFull.FullDuplex = true;
    expect(ethFull.FullDuplex).toBe(true);
  });

  it('L2 other function', () => {
    expect(A.getInterface(0).Host).toEqual(A);
    expect(() => A.getInterface(2)).toThrow();
  });

  it('L2 dot1Q', () => {
    const native = 2;

    const dot1q = A.getInterface(0) as HardwareInterface;
    expect(dot1q.Vlan[0]).toBe(1); // Default native VLAN is 1
    dot1q.addVlan(10);
    expect(dot1q.Vlan[0]).toBe(10);

    dot1q.removeVlan(10);
    expect(dot1q.Vlan[0]).toBe(1); // Restored to native VLAN 1

    dot1q.NativeVlan = native;
    expect(dot1q.Vlan[0]).toBe(1); // Still has VLAN 1
    expect(dot1q.NativeVlan).toBe(2); // But native is now 2
    dot1q.removeVlan(1);
    expect(dot1q.Vlan[0]).toBe(2); // Restored to new native VLAN 2

    // Reset to native 1 for rest of test
    dot1q.NativeVlan = 1;
    dot1q.addVlan(1);

    dot1q.VlanMode = VlanMode.Trunk;
    dot1q.addVlan(2);
    expect(dot1q.Vlan[0]).toBe(1);
    expect(dot1q.Vlan[1]).toBe(2);
    dot1q.removeVlan(1);
    expect(dot1q.Vlan[0]).toBe(2);
    dot1q.removeVlan(2);
    expect(dot1q.Vlan[0]).toBeUndefined();

    dot1q.addVlan(3);
    dot1q.addVlan(4);
    dot1q.addVlan(5);
    dot1q.VlanMode = VlanMode.Access;
    expect(dot1q.Vlan[0]).toBe(3);
  });

  it('L2 up/down event', () =>
    new Promise<void>((resolve) => {
      A.getInterface(0).addListener((message, iface) => {
        expect(message).toBe('OnInterfaceDown');
        expect(iface).toBe(A.getInterface(0));
        resolve();
      });

      setTimeout(() => A.getInterface(0).down(), 10);
    }));
});

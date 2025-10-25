import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { HardwareInterface } from '../layers/datalink';
import { Link } from '../layers/physical';
import { DatalinkMessage } from '../message';
import { Dot1QMessage, EthernetMessage, VlanMode } from './ethernet';
import { SwitchHost } from '../nodes/switch';
import { RouterHost } from '../nodes/router';
import { MacAddress } from '../address';
import { ActionHandle, type DatalinkListener } from './base';

// Test listener helper
class TestListener implements DatalinkListener {
  public receivedTrames: DatalinkMessage[] = [];

  public onReceiveTrame?: (message: DatalinkMessage) => void;

  receiveTrame(message: DatalinkMessage): ActionHandle {
    this.receivedTrames.push(message);
    this.onReceiveTrame?.(message);
    return ActionHandle.Continue;
  }
}

// Helper to wait for message or timeout
function waitForMessage(
  testListener: TestListener,
  timeoutMs: number = 1000
): Promise<DatalinkMessage | undefined> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout | null = null;

    // eslint-disable-next-line no-param-reassign
    testListener.onReceiveTrame = (message) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve(message);
    };

    timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      testListener.onReceiveTrame = undefined;
      resolve(undefined);
    }, timeoutMs);
  });
}

describe('Ethernet protocol', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let C: SwitchHost;
  let D: RouterHost;

  let listener: TestListener;

  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    A = new SwitchHost('A', 2);
    A.getInterface(0).up();
    A.getInterface(1).up();

    B = new SwitchHost('B', 2);
    B.getInterface(0).up();
    B.getInterface(1).up();

    C = new SwitchHost('C', 2);
    C.getInterface(0).up();
    C.getInterface(1).up();

    D = new RouterHost('D', 1);
    D.getInterface(0).up();

    // Create links
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkAB = new Link(A.getInterface(0), B.getInterface(0), 1000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkBC = new Link(B.getInterface(1), C.getInterface(0), 1000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkCD = new Link(C.getInterface(1), D.getInterface(0), 1000);

    listener = new TestListener();
  });

  it('Switch[0]->ETH-->[0]Switch[0]-->[0]Switch', async () => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      A.getInterface(0).getMacAddress(),
      C.getInterface(0).getMacAddress()
    );

    A.send(trame);

    const packet = await waitForMessage(listener);
    expect(packet?.payload).toBe(message);
  });

  it('Switch[0]->ETH-->[1]Switch[1]-->[1]Switch', async () => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      A.getInterface(0).getMacAddress(),
      C.getInterface(0).getMacAddress()
    );

    (B.getInterface(0) as HardwareInterface).addVlan(1);
    (B.getInterface(1) as HardwareInterface).addVlan(1);
    (C.getInterface(0) as HardwareInterface).addVlan(1);

    A.send(trame);

    const packet = await waitForMessage(listener);
    expect(packet?.payload).toBe(message);
  });

  it('Switch[0]->DOT1Q-->[1]Switch[1]-->[1]Switch', async () => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      A.getInterface(0).getMacAddress(),
      C.getInterface(0).getMacAddress()
    );

    (A.getInterface(0) as HardwareInterface).vlanMode = VlanMode.Trunk;
    (B.getInterface(0) as HardwareInterface).addVlan(1);
    (B.getInterface(0) as HardwareInterface).vlanMode = VlanMode.Trunk;
    (B.getInterface(1) as HardwareInterface).addVlan(1);
    (B.getInterface(1) as HardwareInterface).vlanMode = VlanMode.Trunk;
    (C.getInterface(0) as HardwareInterface).addVlan(1);
    (C.getInterface(1) as HardwareInterface).vlanMode = VlanMode.Trunk;

    A.send(trame);

    const packet = await waitForMessage(listener, 1000);
    expect(packet).toBeUndefined();
  });

  it('Switch[0]->ETH-->[0]Switch[1]-->[1]Switch', async () => {
    C.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      A.getInterface(0).getMacAddress(),
      C.getInterface(0).getMacAddress()
    );

    (B.getInterface(1) as HardwareInterface).addVlan(1);
    (C.getInterface(0) as HardwareInterface).addVlan(1);

    A.send(trame);

    const packet = await waitForMessage(listener, 1000);
    expect(packet).toBeUndefined();
  });

  it('Router->ETH-->[0]Switch[0]-->[0]Switch[0]..>[0]Switch', async () => {
    B.getInterface(1).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      D.getInterface(0).getMacAddress(),
      A.getInterface(0).getMacAddress()
    );

    D.getInterface(0).sendTrame(trame);

    const packet = await waitForMessage(listener);
    expect(packet?.payload).toBe(message);
    expect(packet).not.toBeInstanceOf(Dot1QMessage);
    expect(packet).toBeInstanceOf(EthernetMessage);
  });

  it('Router->ETH-->[0]Switch[1]-->[1]Switch', async () => {
    B.getInterface(1).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      D.getInterface(0).getMacAddress(),
      B.getInterface(0).getMacAddress()
    );

    (C.getInterface(0) as HardwareInterface).addVlan(1);
    (B.getInterface(1) as HardwareInterface).addVlan(1);

    D.getInterface(0).sendTrame(trame);

    const packet = await waitForMessage(listener, 1000);
    expect(packet).toBeUndefined();
  });

  it('Router-Eth->[0]Switch[0]-->[0]Switch', async () => {
    B.getInterface(1).addListener(listener);

    const message = `Hello World! ${Math.random()}`;
    const trame = new DatalinkMessage(
      message,
      D.getInterface(0).getMacAddress(),
      B.getInterface(0).getMacAddress()
    );

    D.getInterface(0).sendTrame(trame);

    const packet = await waitForMessage(listener);
    expect(packet?.payload).toBe(message);
    expect(packet).not.toBeInstanceOf(Dot1QMessage);
    expect(packet).toBeInstanceOf(EthernetMessage);
  });

  it('builder', () => {
    const messageEth = new EthernetMessage.Builder()
      .setMacSource(new MacAddress('00:00:00:00:00:01'))
      .setMacDestination(new MacAddress('00:00:00:00:00:02'))
      .setPayload('Hello World!')
      .build();

    const messageDot1q = new Dot1QMessage.Builder()
      .setMacSource(new MacAddress('00:00:00:00:00:01'))
      .setMacDestination(new MacAddress('00:00:00:00:00:02'))
      .setVlan(42)
      .setPayload('Hello World!')
      .build();

    expect(messageEth.macSrc.equals(new MacAddress('00:00:00:00:00:01'))).toBe(
      true
    );
    expect(messageEth.macDst?.equals(new MacAddress('00:00:00:00:00:02'))).toBe(
      true
    );
    expect(messageEth.payload).toBe('Hello World!');
    expect(messageEth.toString()).toContain('Ethernet');

    expect(
      messageDot1q.macSrc.equals(new MacAddress('00:00:00:00:00:01'))
    ).toBe(true);
    expect(
      messageDot1q.macDst?.equals(new MacAddress('00:00:00:00:00:02'))
    ).toBe(true);
    expect(messageDot1q.payload).toBe('Hello World!');
    expect(messageDot1q.vlanId).toBe(42);
    expect(messageDot1q.toString()).toContain('Dot1Q');

    A.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:01'));
    B.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:02'));

    expect(messageEth.isReadyAtEndPoint(A.getInterface(0))).toBe(false);
    expect(messageEth.isReadyAtEndPoint(B.getInterface(0))).toBe(true);
    expect(messageDot1q.isReadyAtEndPoint(A.getInterface(0))).toBe(false);
    expect(messageDot1q.isReadyAtEndPoint(B.getInterface(0))).toBe(true);

    expect(() =>
      new EthernetMessage.Builder()
        .setPayload('Hello World!')
        .setMacSource(new MacAddress('00:00:00:00:00:01'))
        .build()
    ).toThrow();
    expect(() =>
      new EthernetMessage.Builder()
        .setPayload('Hello World!')
        .setMacDestination(new MacAddress('00:00:00:00:00:01'))
        .build()
    ).toThrow();

    expect(() =>
      new Dot1QMessage.Builder()
        .setPayload('Hello World!')
        .setMacSource(new MacAddress('00:00:00:00:00:01'))
        .build()
    ).toThrow();
    expect(() =>
      new Dot1QMessage.Builder()
        .setPayload('Hello World!')
        .setMacDestination(new MacAddress('00:00:00:00:00:01'))
        .build()
    ).toThrow();
  });
});

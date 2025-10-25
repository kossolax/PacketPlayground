import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import { Link } from '../layers/physical';
import { DatalinkMessage } from '../message';
import { IPv4Message } from './ipv4';
import { RouterHost } from '../nodes/router';
import { ActionHandle, type NetworkListener } from './base';
import type { NetworkMessage } from '../message';

// Test listener helper
class TestListener implements NetworkListener {
  public receivedPackets: NetworkMessage[] = [];

  public onReceivePacket?: (message: NetworkMessage) => void;

  receivePacket(message: NetworkMessage): ActionHandle {
    this.receivedPackets.push(message);
    this.onReceivePacket?.(message);
    return ActionHandle.Continue;
  }
}

// Helper to wait for N messages
function waitForMessages(
  testListener: TestListener,
  count: number,
  timeoutMs: number = 2000
): Promise<NetworkMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: NetworkMessage[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    // eslint-disable-next-line no-param-reassign
    testListener.onReceivePacket = (message) => {
      messages.push(message);
      if (messages.length >= count) {
        if (timeoutId) clearTimeout(timeoutId);
        // eslint-disable-next-line no-param-reassign
        testListener.onReceivePacket = undefined;
        resolve(messages);
      }
    };

    timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      testListener.onReceivePacket = undefined;
      if (messages.length < count) {
        reject(
          new Error(
            `Timeout: Expected ${count} messages, got ${messages.length}`
          )
        );
      } else {
        resolve(messages);
      }
    }, timeoutMs);
  });
}

describe('IPv4 protocol', () => {
  let A: RouterHost;
  let B: RouterHost;
  let C: RouterHost;

  let listener: TestListener;

  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    A = new RouterHost('A', 1);
    A.getInterface(0).up();

    B = new RouterHost('B', 2);
    B.getInterface(0).up();
    B.getInterface(1).up();

    C = new RouterHost('C', 1);
    C.getInterface(0).up();

    // Create links
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkAB = new Link(A.getInterface(0), B.getInterface(0), 1000);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkBC = new Link(B.getInterface(1), C.getInterface(0), 1000);

    listener = new TestListener();
  });

  it('Router->IPv4-->Router', async () => {
    B.getInterface(0).addListener(listener);

    const message = `Hello World! ${Math.random()}`;

    const msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize(1500)
      .build();

    expect(msg.length).toBe(1);

    A.send(msg[0]);

    const packets = await waitForMessages(listener, 1);
    expect(packets[0] instanceof IPv4Message).toBe(true);
    expect(packets[0].payload).toBe(message);
    expect((packets[0] as IPv4Message).flags.moreFragments).toBe(false);
  });

  it('Router->IPv4[fragmented]-->Router (should reconstruct)', async () => {
    B.getInterface(0).addListener(listener);

    const message = `Fragmented Packet ${Math.random()}`;

    const msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize(Math.ceil(message.length / 2) + 1)
      .build();

    expect(msg.length).toBe(2);

    msg.forEach((i) => A.send(i));

    const packets = await waitForMessages(listener, 1);
    expect(packets[0] instanceof IPv4Message).toBe(true);
    expect(packets[0].payload).toBe(message);
    expect((packets[0] as IPv4Message).flags.moreFragments).toBe(false);
    expect((packets[0] as IPv4Message).totalLength).toBe(message.length);
  });

  it('Router->IPv4[fragmented]-->Router....>Router  (should not reconstruct)', async () => {
    B.getInterface(0).addListener(listener);

    const message = `Router->IPv4[fragmented]-->Router....>Router  (should not reconstruct) ${Math.random()}`;

    const msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(C.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize(Math.ceil(message.length / 2) + 1)
      .build();

    expect(msg.length).toBe(2);

    msg.forEach((i) => {
      const trame = new DatalinkMessage(
        i,
        A.getInterface(0).getMacAddress(),
        B.getInterface(0).getMacAddress()
      );
      A.getInterface(0).sendTrame(trame);
    });

    const packets = await waitForMessages(listener, 2);

    expect(packets[0] instanceof IPv4Message).toBe(true);
    expect(packets[1] instanceof IPv4Message).toBe(true);

    expect(packets[0].payload).toBe(message);
    expect(packets[1].payload).toBe('');

    expect((packets[0] as IPv4Message).flags.moreFragments).toBe(true);
    expect((packets[1] as IPv4Message).flags.moreFragments).toBe(false);
  });

  it('IPv4 builder', () => {
    const data = `Hello World! ${Math.random()}`;

    const msgBuilder = new IPv4Message.Builder().setService(1).setPayload(data);

    expect(() => msgBuilder.setMaximumSize(65536)).toThrow();
    expect(() => msgBuilder.setMaximumSize(0)).toThrow();
    msgBuilder.setMaximumSize(1500);

    expect(() => msgBuilder.setTTL(65536)).toThrow();
    expect(() => msgBuilder.setTTL(-1)).toThrow();
    msgBuilder.setTTL(30);

    expect(() => msgBuilder.build()).toThrow();
    msgBuilder.setNetSource(A.getInterface(0).getNetAddress() as IPAddress);
    expect(() => msgBuilder.build()).toThrow();
    msgBuilder.setNetDestination(
      B.getInterface(0).getNetAddress() as IPAddress
    );

    expect(msgBuilder.build().length).toBe(1);
    expect(msgBuilder.build()[0].IsReadyAtEndPoint(A.getInterface(0))).toBe(
      false
    );
    expect(msgBuilder.build()[0].IsReadyAtEndPoint(B.getInterface(0))).toBe(
      true
    );

    msgBuilder.setMaximumSize(1);
    expect(msgBuilder.build().length).toBe(data.length);
    expect(msgBuilder.build()[0].toString()).toContain('IPv4');
  });
});

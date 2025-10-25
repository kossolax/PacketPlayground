import { describe, it, expect, beforeEach } from 'vitest';
import { IPAddress, MacAddress } from '../address';
import { Link } from '../layers/physical';
import { ArpMessage } from './arp';
import { RouterHost } from '../nodes/router';
import { SwitchHost } from '../nodes/switch';
import { ActionHandle, type DatalinkListener } from './base';
import type { DatalinkMessage } from '../message';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';

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

// Helper to wait for specific ARP message
function waitForArpMessage(
  listener: TestListener,
  predicate: (msg: DatalinkMessage) => boolean,
  timeoutMs: number = 5000
): Promise<DatalinkMessage> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    // Check if we already received the message
    const existing = listener.receivedTrames.find(
      (msg) => msg.payload instanceof ArpMessage && predicate(msg)
    );
    if (existing) {
      resolve(existing);
      return;
    }

    // eslint-disable-next-line no-param-reassign
    listener.onReceiveTrame = (message) => {
      if (message.payload instanceof ArpMessage && predicate(message)) {
        if (timeoutId) clearTimeout(timeoutId);
        // eslint-disable-next-line no-param-reassign
        listener.onReceiveTrame = undefined;
        resolve(message);
      }
    };

    timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      listener.onReceiveTrame = undefined;
      reject(new Error('Timeout waiting for ARP message'));
    }, timeoutMs);
  });
}

describe('ARP Protocol test', () => {
  let A: RouterHost;
  let B: SwitchHost;
  let C: RouterHost;

  beforeEach(() => {
    A = new RouterHost();
    A.name = 'A';
    A.addInterface().up();

    B = new SwitchHost();
    B.name = 'B';
    B.addInterface().up();
    B.addInterface().up();

    C = new RouterHost();
    C.name = 'C';
    C.addInterface().up();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkAB = new Link(A.getInterface(0), B.getInterface(0), 100);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const linkBC = new Link(B.getInterface(1), C.getInterface(0), 100);

    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  it('Automatic ARP lookup from L3 request', async () => {
    // Configure IP addresses
    A.getInterface(0).setNetAddress(new IPAddress('192.168.1.1'));
    C.getInterface(0).setNetAddress(new IPAddress('192.168.1.2'));

    const message = `test ${Math.random()}`;
    const dst = C.getInterface(0).getNetAddress();

    const listenerOfA = new TestListener();
    const listenerOfC = new TestListener();
    A.getInterface(0).getInterface(0).addListener(listenerOfA);
    C.getInterface(0).getInterface(0).addListener(listenerOfC);

    // Wait for ARP request and reply
    const requestPromise = waitForArpMessage(listenerOfC, (msg) => {
      const arp = msg.payload as ArpMessage;
      if (arp.type !== 'request') return false;

      expect(arp.type).toEqual('request');
      expect(arp.request).toEqual(dst);
      expect(msg.macSrc).toEqual(A.getInterface(0).getMacAddress());
      expect(msg.macDst).toEqual(MacAddress.generateBroadcast());
      return true;
    });

    const replyPromise = waitForArpMessage(listenerOfA, (msg) => {
      const arp = msg.payload as ArpMessage;
      if (arp.type !== 'reply') return false;

      expect(arp.type).toEqual('reply');
      expect(arp.request).toEqual(dst);
      expect(arp.response).toEqual(C.getInterface(0).getMacAddress());
      expect(msg.macSrc).toEqual(C.getInterface(0).getMacAddress());
      expect(msg.macDst).toEqual(A.getInterface(0).getMacAddress());
      return true;
    });

    // Send message that triggers ARP
    A.send(message, dst);

    // Wait for both request and reply
    await Promise.all([requestPromise, replyPromise]);
  });

  it('builder', () => {
    expect(() =>
      new ArpMessage.Builder()
        .SetHardwareAddress(MacAddress.generateAddress())
        .build()
    ).toThrow();

    const request = new ArpMessage.Builder()
      .SetNetworkAddress(IPAddress.generateAddress())
      .build();
    const reply = new ArpMessage.Builder()
      .SetNetworkAddress(IPAddress.generateAddress())
      .SetHardwareAddress(MacAddress.generateAddress())
      .build();

    expect(request.type).toEqual('request');
    expect(reply.type).toEqual('reply');
    expect(request.toString()).toContain('ARP');
    expect(request.toString()).toContain('request');
    expect(reply.toString()).toContain('ARP');
    expect(reply.toString()).toContain('reply');
  });
});

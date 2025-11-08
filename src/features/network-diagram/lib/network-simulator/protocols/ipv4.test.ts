import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    // CRITICAL: Complete Scheduler isolation between tests
    // This destroys and recreates the singleton to prevent memory leaks
    Scheduler.resetInstance();
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

    // RFC 791: maxSize must include 20-byte header + payload
    // To get 2 fragments, set maxSize so each fragment holds ~half the payload
    const headerBytes = 20;
    const payloadPerFragment = Math.ceil(message.length / 2);
    // Round UP to multiple of 8 to ensure 2 fragments (not 3)
    const alignedPayloadPerFragment = Math.ceil(payloadPerFragment / 8) * 8;
    const maxSize = headerBytes + alignedPayloadPerFragment;

    const msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize(maxSize)
      .build();

    expect(msg.length).toBe(2);

    msg.forEach((i) => A.send(i));

    const packets = await waitForMessages(listener, 1);
    expect(packets[0] instanceof IPv4Message).toBe(true);
    expect(packets[0].payload).toBe(message);
    expect((packets[0] as IPv4Message).flags.moreFragments).toBe(false);
    expect((packets[0] as IPv4Message).totalLength).toBe(headerBytes + message.length);
  });

  it('Router->IPv4[fragmented]-->Router....>Router  (should not reconstruct)', async () => {
    B.getInterface(0).addListener(listener);

    const message = `Router->IPv4[fragmented]-->Router....>Router  (should not reconstruct) ${Math.random()}`;

    // RFC 791: maxSize must include 20-byte header + payload
    const headerBytes = 20;
    const payloadPerFragment = Math.ceil(message.length / 2);
    // Round UP to multiple of 8 to ensure 2 fragments (not 3)
    const alignedPayloadPerFragment = Math.ceil(payloadPerFragment / 8) * 8;
    const maxSize = headerBytes + alignedPayloadPerFragment;

    const msg = new IPv4Message.Builder()
      .setPayload(message)
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(C.getInterface(0).getNetAddress() as IPAddress)
      .setMaximumSize(maxSize)
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

    // Fragments should split the payload
    // First fragment has alignedPayloadPerFragment bytes
    // Second fragment has the rest
    expect(packets[0].payload).toBe(message.substring(0, alignedPayloadPerFragment));
    expect(packets[1].payload).toBe(message.substring(alignedPayloadPerFragment));

    // Reconstruct and verify full message
    const reconstructed = packets[0].payload + packets[1].payload;
    expect(reconstructed).toBe(message);

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

    const builtMessages = msgBuilder.build();
    expect(builtMessages.length).toBe(1);
    expect(builtMessages[0].IsReadyAtEndPoint(A.getInterface(0))).toBe(false);
    expect(builtMessages[0].IsReadyAtEndPoint(B.getInterface(0))).toBe(true);

    // RFC 791: Minimum valid maxSize is 28 bytes (20 header + 8 payload)
    msgBuilder.setMaximumSize(28);
    const fragmentedMessages = msgBuilder.build();
    // With maxSize=28, each fragment has 8 bytes payload
    const expectedFragments = Math.ceil(data.length / 8);
    expect(fragmentedMessages.length).toBe(expectedFragments);
    expect(fragmentedMessages[0].toString()).toContain('IPv4');
  });
});

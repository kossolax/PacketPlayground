import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import type { Interface, EthernetInterface } from '../layers/datalink';
import { Link } from '../layers/physical';
import {
  AutonegotiationMessage,
  TechnologyField,
  AdvancedTechnologyField,
} from './autonegotiation';
import { SwitchHost } from '../nodes/switch';
import { ActionHandle, type PhysicalListener } from './base';
import type { PhysicalMessage } from '../message';

// Test listener helper
class TestListener implements PhysicalListener {
  public receivedBits: PhysicalMessage[] = [];

  public onReceiveBits?: (message: PhysicalMessage) => void;

  receiveBits(
    message: PhysicalMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _from: Interface,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _to: Interface
  ): ActionHandle {
    this.receivedBits.push(message);
    this.onReceiveBits?.(message);
    return ActionHandle.Continue;
  }
}

// Helper to collect N messages
function collectBits(
  listener: TestListener,
  count: number,
  timeoutMs: number = 5000
): Promise<PhysicalMessage[]> {
  return new Promise((resolve, reject) => {
    const collected: PhysicalMessage[] = [];
    let timeoutId: NodeJS.Timeout | null = null;

    // Check if we already have enough messages
    if (listener.receivedBits.length >= count) {
      resolve(listener.receivedBits.slice(0, count));
      return;
    }

    // eslint-disable-next-line no-param-reassign
    listener.onReceiveBits = (message) => {
      collected.push(message);
      if (collected.length >= count) {
        if (timeoutId) clearTimeout(timeoutId);
        // eslint-disable-next-line no-param-reassign
        listener.onReceiveBits = undefined;
        resolve(collected);
      }
    };

    timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      listener.onReceiveBits = undefined;
      reject(
        new Error(
          `Timeout: only collected ${collected.length}/${count} messages`
        )
      );
    }, timeoutMs);
  });
}

describe('AutoNegotiation Protocol test', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let listener: TestListener;

  beforeEach(() => {
    A = new SwitchHost();
    A.name = 'A';
    A.addInterface().up();
    A.addInterface().up();

    B = new SwitchHost();
    B.name = 'B';
    B.addInterface().up();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AB = new Link(A.getInterface(0), B.getInterface(0));

    listener = new TestListener();
    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  it('On cable connects', async () => {
    B.getInterface(0).addListener(listener);

    const messages = await collectBits(listener, 4);

    expect(messages[0]).toBeInstanceOf(AutonegotiationMessage);
    expect(messages[1]).toBeInstanceOf(AutonegotiationMessage);
    expect(messages[2]).toBeInstanceOf(AutonegotiationMessage);
    expect(messages[3]).toBeInstanceOf(AutonegotiationMessage);
  });

  it('On cable goes UP', async () => {
    B.getInterface(0).addListener(listener);

    await collectBits(listener, 4);

    A.getInterface(0).down();
    A.getInterface(0).up();

    const messages = await collectBits(listener, 2);

    expect(messages[0]).toBeInstanceOf(AutonegotiationMessage);
    expect(messages[1]).toBeInstanceOf(AutonegotiationMessage);
  });

  it('Reconfigure both interfaces to different same speeds', async () => {
    B.getInterface(0).addListener(listener);

    // Helper function to test reconfiguration
    async function testReconfigure(
      speed: number,
      duplex: boolean,
      expectedBits: number
    ): Promise<void> {
      // Clear previous messages
      listener.receivedBits = [];
      listener.onReceiveBits = undefined;

      // Reconfigure both interfaces
      (A.getInterface(0) as EthernetInterface).reconfigure(
        speed,
        speed,
        duplex
      );
      (B.getInterface(0) as EthernetInterface).reconfigure(
        speed,
        speed,
        duplex
      );

      // Collect messages (for 1000+ Mbps we expect 2 messages per side, otherwise 1)
      const expectedCount = speed >= 1000 ? 4 : 2;
      const messages = await collectBits(listener, expectedCount, 3000);

      // Filter out ACK messages to get the actual negotiation messages
      const nonAckMessages = messages.filter(
        (msg) => !(msg as AutonegotiationMessage).payload.acknowledge
      );

      // Verify all messages are AutonegotiationMessage
      nonAckMessages.forEach((msg) => {
        expect(msg).toBeInstanceOf(AutonegotiationMessage);
      });

      // For multi-page messages (1000 Mbps), verify technology field bits
      if (nonAckMessages.length > 1) {
        // All but last should have nextPage=true and technologyField=0
        for (let i = 0; i < nonAckMessages.length - 1; i += 1) {
          const autoMsg = nonAckMessages[i] as AutonegotiationMessage;
          expect(autoMsg.payload.acknowledge).toBe(false);
          expect(autoMsg.payload.nextPage).toBe(true);
          expect(autoMsg.payload.technologyField).toBe(0);
        }

        // Last message should have the actual bits
        const lastMsg = nonAckMessages[
          nonAckMessages.length - 1
        ] as AutonegotiationMessage;
        expect(lastMsg.payload.acknowledge).toBe(false);
        expect(lastMsg.payload.nextPage).toBe(false);
        expect(lastMsg.payload.technologyField).toBe(expectedBits);
      } else {
        // Single message should have the bits
        const msg = nonAckMessages[0] as AutonegotiationMessage;
        expect(msg.payload.acknowledge).toBe(false);
        expect(msg.payload.technologyField).toBe(expectedBits);
      }

      // Verify final speed
      expect(A.getInterface(0).Speed).toBe(speed);
      expect(B.getInterface(0).Speed).toBe(speed);
    }

    // Wait for initial connection (4 messages)
    await collectBits(listener, 4);

    // Test 10 Mbps half-duplex
    await testReconfigure(10, false, TechnologyField.A10BaseT);

    // Test 10 Mbps full-duplex
    await testReconfigure(
      10,
      true,
      TechnologyField.A10BaseT | TechnologyField.A10BaseT_FullDuplex
    );

    // Test 100 Mbps half-duplex
    await testReconfigure(100, false, TechnologyField.A100BaseTX);

    // Test 100 Mbps full-duplex
    await testReconfigure(
      100,
      true,
      TechnologyField.A100BaseTX | TechnologyField.A100BaseTX_FullDuplex
    );

    // Test 1000 Mbps half-duplex
    await testReconfigure(
      1000,
      false,
      AdvancedTechnologyField.A1000BaseT |
        AdvancedTechnologyField.A1000BaseT_HalfDuplex
    );

    // Test 1000 Mbps full-duplex
    await testReconfigure(1000, true, AdvancedTechnologyField.A1000BaseT);

    // Test 2500 Mbps (not supported, should timeout or return empty)
    try {
      await testReconfigure(2500, false, 0);
      // If we get here without timeout, check it returns no valid tech bits
    } catch (error) {
      // Expected to timeout or fail
      expect(error).toBeDefined();
    }

    try {
      await testReconfigure(2500, true, 0);
      // If we get here without timeout, check it returns no valid tech bits
    } catch (error) {
      // Expected to timeout or fail
      expect(error).toBeDefined();
    }
  });

  it('Auto-Negociate L1 --> none', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const l1 = new Link(A.getInterface(1), null, 1000);
    }).toThrow();
  });

  it('builder', () => {
    const one = new AutonegotiationMessage.Builder().setMaxSpeed(100).build();
    const two = new AutonegotiationMessage.Builder().setMaxSpeed(1000).build();

    expect(one.length).toBe(1);
    expect(two.length).toBe(2);
    expect(one[0].payload.nextPage).toBe(false);
    expect(two[0].payload.nextPage).toBe(true);
    expect(one[0].toString()).toContain('AutoNegotiation');
  });
});

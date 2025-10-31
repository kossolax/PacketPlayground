import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { Link } from '../layers/physical';
import { SpanningTreeMessage } from './spanningtree';
import { MacAddress } from '../address';
import { SwitchHost } from '../nodes/switch';
import { ActionHandle, type DatalinkListener } from '../protocols/base';
import type { DatalinkMessage } from '../message';

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

// Helper to collect N messages
function collectTrames(
  listener: TestListener,
  count: number,
  timeoutMs: number = 5000
): Promise<DatalinkMessage[]> {
  return new Promise((resolve, reject) => {
    // Copy any already-received messages to avoid race condition
    const collected: DatalinkMessage[] = [...listener.receivedTrames];
    let timeoutId: NodeJS.Timeout | null = null;

    // Check if we already have enough messages after copying
    if (collected.length >= count) {
      resolve(collected.slice(0, count));
      return;
    }

    // Setup callback to collect future messages
    // eslint-disable-next-line no-param-reassign
    listener.onReceiveTrame = (message) => {
      collected.push(message);
      if (collected.length >= count) {
        if (timeoutId) clearTimeout(timeoutId);
        // eslint-disable-next-line no-param-reassign
        listener.onReceiveTrame = undefined;
        resolve(collected.slice(0, count));
      }
    };

    timeoutId = setTimeout(() => {
      // eslint-disable-next-line no-param-reassign
      listener.onReceiveTrame = undefined;
      reject(
        new Error(
          `Timeout: only collected ${collected.length}/${count} messages`
        )
      );
    }, timeoutMs);
  });
}

describe('STP protocol', () => {
  let A: SwitchHost;
  let B: SwitchHost;
  let C: SwitchHost;
  let D: SwitchHost;

  beforeEach(() => {
    A = new SwitchHost('A', 2);
    A.getInterface(0).up();
    A.getInterface(1).up();
    A.spanningTree.Enable = true;

    B = new SwitchHost('B', 2);
    B.getInterface(0).up();
    B.getInterface(1).up();
    B.spanningTree.Enable = true;

    C = new SwitchHost('C', 3);
    C.getInterface(0).up();
    C.getInterface(1).up();
    C.getInterface(2).up();
    C.spanningTree.Enable = true;

    D = new SwitchHost('D', 1);
    D.getInterface(0).up();
    D.spanningTree.Enable = true;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const AB = new Link(
      A.getFirstAvailableInterface(),
      B.getFirstAvailableInterface()
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const BC = new Link(
      B.getFirstAvailableInterface(),
      C.getFirstAvailableInterface()
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const CA = new Link(
      C.getFirstAvailableInterface(),
      A.getFirstAvailableInterface()
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const CD = new Link(
      C.getFirstAvailableInterface(),
      D.getFirstAvailableInterface()
    );

    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  afterEach(() => {
    // Cleanup: destroy all switches to unsubscribe from observables
    A?.destroy();
    B?.destroy();
    C?.destroy();
    D?.destroy();

    // Note: Scheduler is a singleton and maintains state across tests.
    // Ideally we would reset it, but the cleanup above should prevent
    // most interference by unsubscribing all observables.
  });

  it('STP Broadcast', async () => {
    const listener = new TestListener();
    D.getInterface(0).addListener(listener);

    A.spanningTree.negociate();

    // Wait for at least 1 STP message to arrive (increased timeout for reliability)
    const messages = await collectTrames(listener, 1, 5000);

    const stpMessages = messages.filter(
      (msg) => msg instanceof SpanningTreeMessage
    );
    expect(stpMessages.length).toBeGreaterThan(0);
  });

  it('STP root', async () => {
    const mac = new MacAddress('00:00:00:00:00:01');

    A.spanningTree.Enable = false;
    A.getInterface(0).setMacAddress(mac);
    A.spanningTree.Enable = true;

    expect(A.spanningTree.IsRoot).toBeTruthy();
    expect(B.spanningTree.IsRoot).toBeTruthy();
    expect(C.spanningTree.IsRoot).toBeTruthy();
    expect(D.spanningTree.IsRoot).toBeTruthy();

    // Poll for convergence - call negociate() repeatedly until convergence
    const checkConvergence = (): boolean =>
      A.spanningTree.Root.equals(mac) &&
      B.spanningTree.Root.equals(mac) &&
      C.spanningTree.Root.equals(mac) &&
      D.spanningTree.Root.equals(mac) &&
      A.spanningTree.IsRoot &&
      !B.spanningTree.IsRoot &&
      !C.spanningTree.IsRoot &&
      !D.spanningTree.IsRoot;

    // Poll every 100ms for up to 5 seconds
    const startTime = Date.now();
    const timeout = 5000;

    // eslint-disable-next-line no-await-in-loop
    while (!checkConvergence() && Date.now() - startTime < timeout) {
      // Call negociate on all switches
      A.spanningTree.negociate();
      B.spanningTree.negociate();
      C.spanningTree.negociate();
      D.spanningTree.negociate();

      // Wait 100ms before next iteration
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    // Verify convergence
    expect(A.spanningTree.Root.equals(mac)).toBeTruthy();
    expect(B.spanningTree.Root.equals(mac)).toBeTruthy();
    expect(C.spanningTree.Root.equals(mac)).toBeTruthy();
    expect(D.spanningTree.Root.equals(mac)).toBeTruthy();

    expect(A.spanningTree.IsRoot).toBeTruthy();
    expect(B.spanningTree.IsRoot).toBeFalsy();
    expect(C.spanningTree.IsRoot).toBeFalsy();
    expect(D.spanningTree.IsRoot).toBeFalsy();
  });

  it('builder', () => {
    const msg = new SpanningTreeMessage.Builder().build();
    expect(msg.toString()).toContain('STP');
  });
});

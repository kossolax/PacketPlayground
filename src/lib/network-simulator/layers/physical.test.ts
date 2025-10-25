import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom, Subject } from 'rxjs';
import { take, toArray } from 'rxjs/operators';

import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { MacAddress } from '../address';
import { PhysicalMessage } from '../message';
import {
  EthernetInterface,
  type HardwareInterface,
  Interface,
} from './datalink';
import { Link } from './physical';
import { SwitchHost } from '../nodes/switch';
import { ActionHandle, type PhysicalListener } from '../protocols/base';

// Test listener helper (restored RxJS pattern from Angular)
class TestListener implements PhysicalListener {
  public receiveBits$ = new Subject<PhysicalMessage>();

  receiveBits(
    message: PhysicalMessage,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _from: Interface,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _to: Interface
  ): ActionHandle {
    this.receiveBits$.next(message);
    return ActionHandle.Continue;
  }
}

describe('Physical layer test', () => {
  let A: HardwareInterface;
  let B: HardwareInterface;
  let listener: TestListener;

  beforeEach(() => {
    A = new EthernetInterface(
      new SwitchHost(),
      MacAddress.generateAddress(),
      'Ethernet0/0',
      0,
      1000,
      true,
      false
    );
    B = new EthernetInterface(
      new SwitchHost(),
      MacAddress.generateAddress(),
      'Ethernet0/0',
      0,
      1000,
      true,
      false
    );

    A.up();
    B.up();

    listener = new TestListener();
    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  it('L1 -> L1', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const l1 = new Link(A, B, 1000);
    B.addListener(listener);

    const message = `Hello World: ${Math.random()}`;

    l1.sendBits(new PhysicalMessage(message), A);

    const msg = await firstValueFrom(listener.receiveBits$.pipe(take(1)));
    expect(msg.payload).toBe(message);
  });

  it('L1 queuing', async () => {
    Scheduler.getInstance().Speed = SchedulerState.REAL_TIME;

    const l1 = new Link(A, B, 1000);
    B.addListener(listener);

    const messages: string[] = [];
    const toSend = 10;

    for (let i = 0; i < toSend; i += 1) {
      messages.push(`Hello World: ${Math.random()}`);
      l1.sendBits(new PhysicalMessage(messages[i]), A);
    }

    const received = await firstValueFrom(
      listener.receiveBits$.pipe(take(toSend), toArray())
    );

    expect(received.length).toBe(toSend);
    received.forEach((msg, index) => {
      expect(msg.payload).toBe(messages[index]);
    });
  });

  it('L1 full duplex should be faster than half duplex', async () => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    const l1 = new Link(A, B, 1000 * 1000 * 1000);
    l1.addListener(listener);

    const toSend = 20;
    const payloadSize = 100 * 1024; // 100 KB for faster testing
    const payload = new PhysicalMessage('A'.repeat(payloadSize));

    const send = (duplex: boolean): void => {
      A.FullDuplex = duplex;
      B.FullDuplex = duplex;

      // Random pattern to test full-duplex advantage regardless of message order
      for (let i = 0; i < toSend; i += 1) {
        l1.sendBits(payload, Math.random() > 0.5 ? A : B);
      }
    };

    // Use simulated time instead of wall clock for deterministic testing
    const start = Scheduler.getInstance().getDeltaTime();

    // Send half duplex
    send(false);
    await firstValueFrom(listener.receiveBits$.pipe(take(toSend), toArray()));
    const mid = Scheduler.getInstance().getDeltaTime();

    // Send full duplex
    send(true);
    await firstValueFrom(listener.receiveBits$.pipe(take(toSend), toArray()));
    const end = Scheduler.getInstance().getDeltaTime();

    const half = mid - start;
    const full = end - mid;
    const ratio = half / full;

    expect(half).toBeGreaterThan(full);
    expect(ratio).toBeGreaterThan(1.3); // More realistic threshold for simulated time
  }, 30000);

  it('L1 -> none', () => {
    const l1 = new Link(A, null, 1000);
    B.addListener(listener);

    const message = `Hello World: ${Math.random()}`;
    expect(() => l1.sendBits(new PhysicalMessage(message), A)).toThrow();

    expect(l1.getInterface(0)).toEqual(A);
    expect(l1.getInterface(1)).toBeNull();
    expect(() => l1.getInterface(2)).toThrow();
  });

  it('L1 speed function', () => {
    const link1 = new Link(A, B, 100);
    const speeds: { propagation: number; transmission: number }[] = [];

    [0, 10, 100, 1000].forEach((speed) => {
      speeds.push({
        propagation: link1.getPropagationDelay(),
        transmission: link1.getTransmissionDelay(42, speed),
      });
    });

    Scheduler.getInstance().Speed = SchedulerState.REAL_TIME;

    // propagation is constant
    expect(speeds[0].propagation).toBe(speeds[1].propagation);
    expect(speeds[1].propagation).toBe(speeds[2].propagation);
    expect(speeds[2].propagation).toBe(speeds[3].propagation);

    // transmission goes faster as speed goes up
    expect(speeds[1].transmission).toBeGreaterThan(speeds[2].transmission);
    expect(speeds[2].transmission).toBeGreaterThan(speeds[3].transmission);

    // transmission is longer as bytes goes up
    A.Speed = 10;
    expect(link1.getTransmissionDelay(1000, 100)).toBeGreaterThan(
      link1.getTransmissionDelay(100, 100)
    );
    expect(link1.getTransmissionDelay(10000, 100)).toBeGreaterThan(
      link1.getTransmissionDelay(10, 100)
    );

    Scheduler.getInstance().Speed = SchedulerState.FASTER;
    const fast = link1.getDelay(1000, 100);
    Scheduler.getInstance().Speed = SchedulerState.REAL_TIME;
    const real = link1.getDelay(1000, 100);
    Scheduler.getInstance().Speed = SchedulerState.SLOWER;
    const slow = link1.getDelay(1000, 100);
    Scheduler.getInstance().Speed = SchedulerState.PAUSED;
    const paused = link1.getDelay(1000, 100);
    Scheduler.getInstance().Speed = SchedulerState.FASTER;

    expect(fast).toBeLessThan(real);
    expect(real).toBeLessThan(slow);
    expect(slow).toBeLessThan(paused);
  });
});

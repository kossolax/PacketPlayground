import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import { NetworkInterface } from '../layers/network';
import { Link } from '../layers/physical';
import { ICMPMessage, ICMPType } from './icmp';
import { RouterHost } from '../nodes/router';

describe('ICMP protocol', () => {
  let A: RouterHost;
  let B: RouterHost;
  let C: RouterHost;

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
  });

  it('Router->ICMP-->Router', async () => {
    const ipface = A.getInterface(0) as NetworkInterface;

    const msg = await firstValueFrom(
      ipface.sendIcmpRequest(B.getInterface(0).getNetAddress() as IPAddress)
    );

    expect(msg).not.toBeNull();
    expect(msg instanceof ICMPMessage).toBe(true);
  });

  it('Router->ICMP-->none', async () => {
    const ipface = A.getInterface(0) as NetworkInterface;

    const msg = await firstValueFrom(
      ipface.sendIcmpRequest(IPAddress.generateAddress())
    );

    expect(msg).toBeNull();
  });

  it('ICMP builder', () => {
    const msgBuilder = new ICMPMessage.Builder()
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress);

    expect(() => {
      msgBuilder.setType(ICMPType.EchoRequest);
      msgBuilder.setCode(1);
    }).toThrow();

    expect(() => {
      msgBuilder.setType(ICMPType.EchoReply);
      msgBuilder.setCode(1);
    }).toThrow();

    expect(() => {
      msgBuilder.setType(ICMPType.TimeExceeded);
      msgBuilder.setCode(2);
    }).toThrow();

    expect(() => {
      msgBuilder.setType(ICMPType.DestinationUnreachable);
      msgBuilder.setCode(3);
    }).not.toThrow();

    expect(() => {
      msgBuilder.setType(ICMPType.DestinationUnreachable);
      msgBuilder.setCode(16);
    }).toThrow();

    expect(() => {
      msgBuilder.setType(42 as ICMPType);
      msgBuilder.setCode(42);
    }).toThrow();

    expect(msgBuilder.build().length).toBe(1);

    expect(() =>
      new ICMPMessage.Builder()
        .setNetSource(IPAddress.generateAddress())
        .build()
    ).toThrow();
    expect(() =>
      new ICMPMessage.Builder()
        .setNetDestination(IPAddress.generateAddress())
        .build()
    ).toThrow();

    const request = new ICMPMessage.Builder()
      .setNetSource(A.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(B.getInterface(0).getNetAddress() as IPAddress)
      .setType(ICMPType.EchoRequest)
      .setCode(0)
      .build()[0];
    const reply = new ICMPMessage.Builder()
      .setNetSource(B.getInterface(0).getNetAddress() as IPAddress)
      .setNetDestination(A.getInterface(0).getNetAddress() as IPAddress)
      .setType(ICMPType.EchoReply)
      .setCode(0)
      .build()[0];

    expect(request.toString()).toContain('ICMP');
    expect(request.toString()).toContain('Request');
    expect(reply.toString()).toContain('ICMP');
    expect(reply.toString()).toContain('Reply');
    expect(msgBuilder.build()[0].toString()).toContain('ICMP');
  });
});

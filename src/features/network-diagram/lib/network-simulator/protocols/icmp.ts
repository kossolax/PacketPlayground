import { map, Observable, race, Subject, tap } from 'rxjs';

import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage, type Payload } from '../message';
import { IPv4Message } from './ipv4';
import { ActionHandle, type NetworkListener } from './base';

export enum ICMPType {
  EchoReply = 0,
  DestinationUnreachable = 3,
  EchoRequest = 8,
  TimeExceeded = 11,
}

export class ICMPMessage extends IPv4Message {
  public type: ICMPType = ICMPType.EchoRequest;

  public code: number = 0;

  protected constructor(
    payload: Payload | string,
    src: IPAddress,
    dst: IPAddress,
    type: ICMPType,
    code: number
  ) {
    super(payload, src, dst);
    this.type = type;
    this.code = code;
  }

  override get length(): number {
    // ICMP header is 8 bytes minimum (Type 1 + Code 1 + Checksum 2 + Rest of Header 4)
    // + payload
    return 8 + this.payload.length;
  }

  public override toString(): string {
    switch (this.type) {
      case ICMPType.EchoReply:
        return 'ICMP\nReply';
      case ICMPType.EchoRequest:
        return 'ICMP\nRequest';
      default:
        return 'ICMP';
    }
  }

  public override checksum(): number {
    let sum = 0;

    sum = Math.imul(31, sum) + (this.type + this.code);

    return sum;
  }

  public static override Builder = class extends IPv4Message.Builder {
    protected type: ICMPType = ICMPType.EchoReply;

    protected code: number = 0;

    public setType(type: ICMPType): this {
      this.type = type;
      this.code = 0;
      return this;
    }

    public setCode(code: number): this {
      let validCode: number[] = [];

      switch (this.type) {
        case ICMPType.EchoReply:
          validCode = [0];
          break;
        case ICMPType.EchoRequest:
          validCode = [0];
          break;
        case ICMPType.DestinationUnreachable:
          validCode = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
          break;
        case ICMPType.TimeExceeded:
          validCode = [0, 1];
          break;
        default:
          throw new Error('Invalid ICMP type');
      }

      if (validCode.indexOf(code) === -1)
        throw new Error('Invalid ICMP code for the given type');

      this.code = code;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('No source address specified');
      if (this.netDst === null)
        throw new Error('No destination address specified');

      const message = new ICMPMessage(
        this.payload,
        this.netSrc,
        this.netDst,
        this.type,
        this.code
      );
      message.headerChecksum = message.checksum();
      message.protocol = 1;
      message.TOS = 0;

      return [message];
    }
  };
}

export class ICMPProtocol implements NetworkListener {
  private iface: NetworkInterface;

  private queue: Map<number, Subject<IPv4Message>>;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    iface.addListener(this);

    this.queue = new Map<number, Subject<IPv4Message>>();
  }

  public sendIcmpRequest(
    destination: IPAddress,
    timeout: number = 20
  ): Observable<IPv4Message | null> {
    const request = new ICMPMessage.Builder()
      .setType(ICMPType.EchoRequest)
      .setCode(0)
      .setNetSource(this.iface.getNetAddress() as IPAddress)
      .setNetDestination(destination)
      .build()[0];

    const subject: Subject<IPv4Message> = new Subject();

    this.queue.set(request.identification, subject);
    this.iface.sendPacket(request);

    const timeout$ = Scheduler.getInstance()
      .once(timeout)
      .pipe(map(() => null));
    return race(subject, timeout$).pipe(
      tap(() => this.queue.delete(request.identification))
    );
  }

  public receivePacket(message: NetworkMessage): ActionHandle {
    if (
      message instanceof ICMPMessage &&
      message.IsReadyAtEndPoint(this.iface)
    ) {
      if (message.type === ICMPType.EchoRequest) {
        const reply = new ICMPMessage.Builder()
          .setType(ICMPType.EchoReply)
          .setCode(0)
          .setNetSource(message.netDst as IPAddress)
          .setNetDestination(message.netSrc as IPAddress)
          .setIdentification(message.identification)
          .build()[0];

        this.iface.sendPacket(reply);

        return ActionHandle.Handled;
      }

      if (message.type === ICMPType.EchoReply) {
        if (this.queue.has(message.identification)) {
          this.queue.get(message.identification)?.next(message);
          return ActionHandle.Handled;
        }
      }
    }

    return ActionHandle.Continue;
  }
}

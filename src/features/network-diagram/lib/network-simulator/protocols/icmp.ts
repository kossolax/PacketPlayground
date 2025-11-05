import { map, Observable, race, Subject, tap } from 'rxjs';

import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage, type Payload } from '../message';
import { IPv4Message } from './ipv4';
import { ActionHandle, type NetworkListener } from './base';
import { internetChecksum } from './checksum';

export enum ICMPType {
  EchoReply = 0,
  DestinationUnreachable = 3,
  EchoRequest = 8,
  TimeExceeded = 11,
}

export class ICMPMessage extends IPv4Message {
  public type: ICMPType = ICMPType.EchoRequest;

  public code: number = 0;

  // RFC 792: Echo Request/Reply specific fields
  public identifier: number = 0;

  public sequence: number = 0;

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
    // RFC 792: Same algorithm as IPv4 - Internet Checksum
    const words: number[] = [];

    // Type (8 bits) + Code (8 bits)
    words.push(((this.type << 8) | this.code) & 0xffff);

    // RFC 792: Rest of header (4 bytes - for Echo: Identifier + Sequence)
    words.push(this.identifier & 0xffff); // Identifier (16 bits)
    words.push(this.sequence & 0xffff); // Sequence (16 bits)

    // Add payload data as 16-bit words
    const payloadStr = this.payload.toString();
    for (let i = 0; i < payloadStr.length; i += 2) {
      const highByte = payloadStr.charCodeAt(i);
      const lowByte =
        i + 1 < payloadStr.length ? payloadStr.charCodeAt(i + 1) : 0;
      words.push(((highByte << 8) | lowByte) & 0xffff);
    }

    return internetChecksum(words);
  }

  public static override Builder = class extends IPv4Message.Builder {
    protected type: ICMPType = ICMPType.EchoReply;

    protected code: number = 0;

    // RFC 792: Echo Request/Reply fields
    protected identifier: number = 0;

    protected sequence: number = 0;

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

    // RFC 792: Set identifier for Echo Request/Reply correlation
    public setIdentifier(identifier: number): this {
      this.identifier = identifier & 0xffff; // 16-bit value
      return this;
    }

    // RFC 792: Set sequence number for Echo Request/Reply ordering
    public setSequence(sequence: number): this {
      this.sequence = sequence & 0xffff; // 16-bit value
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

      // RFC 792: Set identifier and sequence for Echo messages
      message.identifier = this.identifier;
      message.sequence = this.sequence;

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
    // RFC 792: Use identification as ICMP identifier for correlation
    const identifier = Math.floor(Math.random() * 0xffff);

    const request = new ICMPMessage.Builder()
      .setType(ICMPType.EchoRequest)
      .setCode(0)
      .setNetSource(this.iface.getNetAddress() as IPAddress)
      .setNetDestination(destination)
      .setIdentifier(identifier)
      .setSequence(0) // Could be incremented for multiple pings
      .build()[0] as ICMPMessage;

    const subject: Subject<IPv4Message> = new Subject();

    // Use ICMP identifier for correlation instead of IPv4 identification
    this.queue.set(request.identifier, subject);
    this.iface.sendPacket(request);

    const timeout$ = Scheduler.getInstance()
      .once(timeout)
      .pipe(map(() => null));
    return race(subject, timeout$).pipe(
      tap(() => this.queue.delete(request.identifier))
    );
  }

  public receivePacket(message: NetworkMessage): ActionHandle {
    if (
      message instanceof ICMPMessage &&
      message.IsReadyAtEndPoint(this.iface)
    ) {
      if (message.type === ICMPType.EchoRequest) {
        // RFC 792: Echo Reply must copy identifier and sequence from Request
        const reply = new ICMPMessage.Builder()
          .setType(ICMPType.EchoReply)
          .setCode(0)
          .setNetSource(message.netDst as IPAddress)
          .setNetDestination(message.netSrc as IPAddress)
          .setIdentification(message.identification)
          .setIdentifier(message.identifier) // Copy from request
          .setSequence(message.sequence) // Copy from request
          .build()[0];

        this.iface.sendPacket(reply);

        return ActionHandle.Handled;
      }

      if (message.type === ICMPType.EchoReply) {
        // RFC 792: Match reply to request using identifier
        if (this.queue.has(message.identifier)) {
          this.queue.get(message.identifier)?.next(message);
          return ActionHandle.Handled;
        }
      }
    }

    return ActionHandle.Continue;
  }
}

import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { NetworkMessage, type Payload } from '../message';
import { ActionHandle, type NetworkListener } from './base';

export class IPv4Message extends NetworkMessage {
  public version: number = 4;

  public headerLength: number = 5;

  public TOS: number = 0;

  public totalLength: number = 0;

  public identification: number = 0;

  public flags = {
    reserved: false,
    dontFragment: false,
    moreFragments: false,
  };

  public fragmentOffset: number = 0;

  public ttl: number = 0;

  public protocol: number = 0;

  public headerChecksum: number = 0;

  protected constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
  }

  override get length(): number {
    return this.payload.length + 16 + this.payload.length;
  }

  public override toString(): string {
    return `IPv4 (v${this.version})`;
  }

  public checksum(): number {
    let sum = 0;

    sum =
      Math.imul(31, sum) +
      (this.version + this.headerLength + this.TOS + this.totalLength);
    sum =
      Math.imul(31, sum) +
      (this.identification +
        (this.flags.reserved ? 1 : 0) +
        (this.flags.dontFragment ? 1 : 0) +
        (this.flags.moreFragments ? 1 : 0) +
        this.fragmentOffset);
    sum = Math.imul(31, sum) + (this.ttl + this.protocol);

    return sum;
  }

  public IsFragmented(): boolean {
    if (this.fragmentOffset === 0 && this.flags.moreFragments === false)
      return false;
    return true;
  }

  public IsReadyAtEndPoint(iface: NetworkInterface): boolean {
    if (
      this.IsFragmented() === false &&
      this.netDst &&
      iface.hasNetAddress(this.netDst)
    )
      return true;
    return false;
  }

  public static Builder = class {
    protected payload: Payload | string = '';

    protected netSrc: IPAddress | null = null;

    protected netDst: IPAddress | null = null;

    protected ttl: number = 30;

    protected id: number;

    protected protocol: number = 0;

    protected service: number = 0;

    protected maxSize: number = 65535;

    constructor() {
      this.id = Math.floor(Math.random() * 65535);
    }

    public setNetSource(addr: IPAddress): this {
      this.netSrc = addr;
      return this;
    }

    public setNetDestination(addr: IPAddress): this {
      this.netDst = addr;
      return this;
    }

    public setPayload(payload: Payload | string): this {
      this.payload = payload;
      return this;
    }

    public setTTL(ttl: number): this {
      if (ttl > 255) throw new Error('TTL is too big');
      if (ttl < 0) throw new Error('TTL is too small');
      this.ttl = ttl;
      return this;
    }

    public setMaximumSize(size: number): this {
      if (size > 65535) throw new Error('Maximum size is 65535');
      if (size < 1) throw new Error('Minimum size is 1');

      this.maxSize = size;
      return this;
    }

    public setIdentification(id: number): this {
      this.id = id;
      return this;
    }

    public setProtocol(id: number): this {
      this.protocol = id;
      return this;
    }

    public setService(service: number): this {
      this.service = service;
      return this;
    }

    public build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const messages = [];

      let fragment = 0;
      do {
        // payload doesn't support splicing.
        // so we put the payload on the first message, the others are left empty
        let payload: string | Payload = '';
        if (fragment === 0) payload = this.payload;

        const message = new IPv4Message(payload, this.netSrc, this.netDst);

        message.ttl = this.ttl;
        message.identification = this.id;
        message.protocol = this.protocol;
        message.headerChecksum = message.checksum();
        message.fragmentOffset = fragment;
        message.totalLength = Math.min(
          this.maxSize,
          this.payload.length - fragment
        );
        message.TOS = this.service;

        if (fragment + this.maxSize < this.payload.length)
          message.flags.moreFragments = true;

        messages.push(message);
        fragment += this.maxSize;
      } while (fragment < this.payload.length);

      return messages;
    }
  };
}

export class IPv4Protocol implements NetworkListener {
  private queue: Map<string, { message: IPv4Message[]; lastReceive: number }>;

  private iface: NetworkInterface;

  private cleanupTimer: (() => void) | null = null;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    this.queue = new Map();

    iface.addListener(this);
    this.cleanupTimer = Scheduler.getInstance().repeat(10, () => {
      this.cleanQueue();
    });
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      this.cleanupTimer();
      this.cleanupTimer = null;
    }
  }

  public receivePacket(message: NetworkMessage): ActionHandle {
    if (message instanceof IPv4Message) {
      // this packet was not fragmented
      if (message.IsFragmented() === false) {
        return ActionHandle.Continue;
      }

      // this packet is fragmented, but we are not the receiver.
      if (
        message.netDst &&
        this.iface.hasNetAddress(message.netDst) === false
      ) {
        return ActionHandle.Continue;
      }

      // this packet is fragmented, and we are the receiver, we need to buffer it.
      const time = Scheduler.getInstance().getDeltaTime();
      const key = this.generateUniqueKey(message);

      const entry = this.queue.get(key);
      if (!entry) {
        this.queue.set(key, { message: [message], lastReceive: time });
        return ActionHandle.Stop;
      }

      entry.message.push(message);
      entry.lastReceive = time;
      this.queue.set(key, entry);

      entry.message.sort((a, b) => a.fragmentOffset - b.fragmentOffset);

      const totalReceivedLength = entry.message.reduce(
        (sum, i) => sum + i.totalLength,
        0
      );

      const firstPacket = entry.message[0];
      const lastPacket = entry.message[entry.message.length - 1];
      const totalSize = lastPacket.fragmentOffset + lastPacket.totalLength;

      if (
        lastPacket.flags.moreFragments === false &&
        totalReceivedLength >= totalSize
      ) {
        this.queue.delete(key);

        const msg = new IPv4Message.Builder()
          .setPayload(firstPacket.payload)
          .setNetSource(message.netSrc as IPAddress)
          .setNetDestination(message.netDst as IPAddress)
          .setTTL(message.ttl)
          .setIdentification(message.identification)
          .setProtocol(message.protocol)
          .setMaximumSize(totalReceivedLength)
          .build();

        if (msg.length !== 1) throw new Error('Invalid message length');

        this.iface.receivePacket(msg[0]);

        return ActionHandle.Stop;
      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  private cleanQueue(): void {
    const cleanDelay = Scheduler.getInstance().getDelay(60 * 5);

    this.queue.forEach((value, key) => {
      const timeSinceLastSeen =
        Scheduler.getInstance().getDeltaTime() - value.lastReceive;

      if (timeSinceLastSeen > cleanDelay) this.queue.delete(key);
    });
  }

  private generateUniqueKey(message: IPv4Message): string {
    // Include interface name for uniqueness across multiple interfaces
    const ifaceName = this.iface.toString();
    return `${ifaceName}_${message.netSrc.toString()}_${message.identification}`;
  }
}

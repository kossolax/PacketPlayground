import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { NetworkMessage, type Payload } from '../message';
import { ActionHandle, type NetworkListener } from './base';
import { internetChecksum } from './checksum';

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
    // IPv4 header length is in 32-bit words (minimum 5 = 20 bytes)
    // headerLength field contains number of 32-bit words
    const headerBytes = this.headerLength * 4;
    return headerBytes + this.payload.length;
  }

  public override toString(): string {
    return `IPv4 (v${this.version})`;
  }

  public checksum(): number {
    // RFC 791: Internet Checksum - construct header as 16-bit words
    const words: number[] = [];

    // Version (4 bits) + IHL (4 bits) + TOS (8 bits)
    words.push(
      ((this.version << 12) | (this.headerLength << 8) | this.TOS) & 0xffff
    );

    // Total Length (16 bits)
    words.push(this.totalLength & 0xffff);

    // Identification (16 bits)
    words.push(this.identification & 0xffff);

    // Flags (3 bits) + Fragment Offset (13 bits)
    const flags =
      ((this.flags.reserved ? 1 : 0) << 2) |
      ((this.flags.dontFragment ? 1 : 0) << 1) |
      (this.flags.moreFragments ? 1 : 0);
    words.push(((flags << 13) | (this.fragmentOffset & 0x1fff)) & 0xffff);

    // TTL (8 bits) + Protocol (8 bits)
    words.push(((this.ttl << 8) | this.protocol) & 0xffff);

    // Checksum field (0 for calculation)
    words.push(0);

    // Source IP (32 bits split into 2x 16 bits)
    const srcNum = (this.netSrc as IPAddress).toNumber();
    words.push((srcNum >> 16) & 0xffff);
    words.push(srcNum & 0xffff);

    // Destination IP (32 bits split into 2x 16 bits)
    const dstNum = (this.netDst as IPAddress).toNumber();
    words.push((dstNum >> 16) & 0xffff);
    words.push(dstNum & 0xffff);

    return internetChecksum(words);
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

    protected ttl: number = 64; // RFC 1122 recommended default

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

      // RFC 791: Basic validation
      if (this.ttl <= 0) throw new Error('TTL must be greater than 0');
      if (this.ttl > 255) throw new Error('TTL must be <= 255');

      // Convert payload to string for fragmentation
      const payloadStr =
        typeof this.payload === 'string'
          ? this.payload
          : this.payload.toString();
      const payloadLength = payloadStr.length;

      // RFC 791: Header size (minimum 20 bytes for no options)
      const headerBytes = this.protocol === 1 ? 20 : 20; // IHL=5 → 5*4=20 bytes

      // RFC 791: Validate minimum packet size (header + at least 8 bytes of data)
      if (this.maxSize < headerBytes + 8) {
        throw new Error(
          `Maximum size ${this.maxSize} is too small. Must be at least ${headerBytes + 8} bytes (${headerBytes}-byte header + 8 bytes minimum fragment data)`
        );
      }

      // RFC 791: Calculate maximum payload per fragment
      // Fragment data must be multiple of 8 bytes (except last fragment)
      const maxDataPerFragment =
        Math.floor((this.maxSize - headerBytes) / 8) * 8;

      // If no fragmentation needed, return single packet
      if (headerBytes + payloadLength <= this.maxSize) {
        const message = new IPv4Message(this.payload, this.netSrc, this.netDst);
        message.ttl = this.ttl;
        message.identification = this.id;
        message.protocol = this.protocol;
        message.TOS = this.service;
        message.fragmentOffset = 0;
        message.flags.moreFragments = false;
        message.totalLength = headerBytes + payloadLength;
        message.headerChecksum = message.checksum();
        return [message];
      }

      // RFC 791: Fragment the payload
      const messages: IPv4Message[] = [];
      let byteOffset = 0;

      while (byteOffset < payloadLength) {
        // Calculate data size for this fragment
        const remainingBytes = payloadLength - byteOffset;
        let fragmentDataSize: number;

        // RFC 791: All fragments except last must have data size multiple of 8
        const isLastFragment = remainingBytes <= maxDataPerFragment;
        if (isLastFragment) {
          fragmentDataSize = remainingBytes;
        } else {
          fragmentDataSize = maxDataPerFragment;
        }

        // Extract fragment payload
        const fragmentPayload = payloadStr.substring(
          byteOffset,
          byteOffset + fragmentDataSize
        );

        // Create fragment message
        const message = new IPv4Message(
          fragmentPayload,
          this.netSrc,
          this.netDst
        );
        message.ttl = this.ttl;
        message.identification = this.id;
        message.protocol = this.protocol;
        message.TOS = this.service;

        // RFC 791: Fragment Offset is in units of 8 octets
        message.fragmentOffset = byteOffset / 8;

        // RFC 791: Set More Fragments flag
        message.flags.moreFragments = !isLastFragment;

        // RFC 791: Total Length = header + data for THIS fragment
        message.totalLength = headerBytes + fragmentDataSize;

        // Calculate checksum
        message.headerChecksum = message.checksum();

        messages.push(message);
        byteOffset += fragmentDataSize;
      }

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
    const subscription = Scheduler.getInstance()
      .repeat(10)
      .subscribe(() => {
        this.cleanQueue();
      });
    this.cleanupTimer = () => subscription.unsubscribe();
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      this.cleanupTimer();
      this.cleanupTimer = null;
    }
  }

  public receivePacket(message: NetworkMessage): ActionHandle {
    if (message instanceof IPv4Message) {
      // RFC 791: Basic validation
      if (message.version !== 4) {
        // Drop invalid version packets
        return ActionHandle.Stop;
      }

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

      // RFC 791: Sum payload lengths (not totalLength which includes headers)
      const totalReceivedLength = entry.message.reduce(
        (sum, i) => sum + i.payload.length,
        0
      );

      const lastPacket = entry.message[entry.message.length - 1];
      // RFC 791: fragmentOffset is in units of 8 octets, convert to bytes
      const totalSize =
        lastPacket.fragmentOffset * 8 + lastPacket.payload.length;

      if (
        lastPacket.flags.moreFragments === false &&
        totalReceivedLength >= totalSize
      ) {
        this.queue.delete(key);

        // RFC 791: Reassemble all fragment payloads in order
        const reassembledPayload = entry.message
          .map((frag) => frag.payload)
          .join('');

        // RFC 791: Maximum size must include header + payload to avoid refragmentation
        const headerBytes = 20; // IPv4 header without options
        const msg = new IPv4Message.Builder()
          .setPayload(reassembledPayload)
          .setNetSource(message.netSrc as IPAddress)
          .setNetDestination(message.netDst as IPAddress)
          .setTTL(message.ttl)
          .setIdentification(message.identification)
          .setProtocol(message.protocol)
          .setMaximumSize(headerBytes + totalReceivedLength)
          .build();

        if (msg.length !== 1) throw new Error('Invalid message length');

        // CRITICAL: Verify reconstructed message is defragmented to prevent infinite loop
        if (msg[0].IsFragmented()) {
          throw new Error(
            'Reassembled message is still fragmented - reconstruction failed'
          );
        }

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

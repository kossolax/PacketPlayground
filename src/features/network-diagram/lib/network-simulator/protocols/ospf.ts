import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage, type Payload } from '../message';
import { IPv4Message } from './ipv4';
import { ActionHandle, type NetworkListener } from './base';

// RFC 2328: OSPF Neighbor States
export enum OSPFState {
  Down = 0, // Initial state, no recent information from neighbor
  Attempt = 1, // For NBMA networks (not commonly used)
  Init = 2, // Hello packet received but bidirectional communication not established
  TwoWay = 3, // Bidirectional communication established
  ExStart = 4, // Master/Slave relationship established, start DBD exchange
  Exchange = 5, // Database description packets being exchanged
  Loading = 6, // Requesting link state information
  Full = 7, // Full adjacency established, databases synchronized
}

// RFC 2328: OSPF Packet Types
export enum OSPFPacketType {
  Hello = 1, // Discover/maintain neighbors
  DatabaseDescription = 2, // Summarize database contents
  LinkStateRequest = 3, // Request pieces of neighbor's database
  LinkStateUpdate = 4, // Flooding LSAs
  LinkStateAck = 5, // Acknowledge receipt of LSAs
}

// RFC 2328: OSPF uses IP protocol number 89
export const OSPF_PROTOCOL_NUMBER = 89;

// RFC 2328: OSPF Multicast Addresses
export const OSPF_ALL_ROUTERS = new IPAddress('224.0.0.5'); // AllSPFRouters
export const OSPF_ALL_DR = new IPAddress('224.0.0.6'); // AllDRouters (DR/BDR)

// Default OSPF timers (in seconds)
export const OSPF_DEFAULT_HELLO_INTERVAL = 10;
export const OSPF_DEFAULT_DEAD_INTERVAL = 40;
export const OSPF_DEFAULT_PRIORITY = 1;

/**
 * RFC 2328: OSPF Packet Header
 * All OSPF packets share a common header
 */
export class OSPFMessage extends IPv4Message {
  // RFC 2328: Version (2 for OSPFv2)
  public version: number = 2;

  // RFC 2328: Packet type (Hello, DBD, LSR, LSU, LSAck)
  public type: OSPFPacketType = OSPFPacketType.Hello;

  // RFC 2328: Packet length including header (bytes)
  public packetLength: number = 24; // Minimum header size

  // RFC 2328: Router ID of packet source
  public routerID: IPAddress = new IPAddress('0.0.0.0');

  // RFC 2328: Area ID - backbone area is 0.0.0.0
  public areaID: IPAddress = new IPAddress('0.0.0.0');

  // RFC 2328: Standard IP checksum
  public ospfChecksum: number = 0;

  // RFC 2328: Authentication type (0 = none, 1 = simple password, 2 = MD5)
  public authType: number = 0;

  // RFC 2328: Authentication data (64 bits)
  public authData: bigint = BigInt(0);

  protected constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
    // RFC 2328: OSPF uses IP protocol number 89
    this.protocol = OSPF_PROTOCOL_NUMBER;
  }

  public override toString(): string {
    const typeName = OSPFPacketType[this.type];
    return `OSPF\n${typeName}`;
  }

  public override checksum(): number {
    // OSPF has its own checksum separate from IP header checksum
    return super.checksum();
  }

  public static override Builder = class extends IPv4Message.Builder {
    protected ospfType: OSPFPacketType = OSPFPacketType.Hello;

    protected routerID: IPAddress = new IPAddress('0.0.0.0');

    protected areaID: IPAddress = new IPAddress('0.0.0.0');

    protected authType: number = 0;

    protected authData: bigint = BigInt(0);

    public setOSPFType(type: OSPFPacketType): this {
      this.ospfType = type;
      return this;
    }

    public setRouterID(routerID: IPAddress): this {
      this.routerID = routerID;
      return this;
    }

    public setAreaID(areaID: IPAddress): this {
      this.areaID = areaID;
      return this;
    }

    public setAuthType(authType: number): this {
      if (authType < 0 || authType > 2)
        throw new Error('Auth type must be 0 (none), 1 (simple), or 2 (MD5)');
      this.authType = authType;
      return this;
    }

    public setAuthData(authData: bigint): this {
      this.authData = authData;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new OSPFMessage(this.payload, this.netSrc, this.netDst);

      // Set OSPF-specific fields
      message.version = 2; // OSPFv2
      message.type = this.ospfType;
      message.routerID = this.routerID;
      message.areaID = this.areaID;
      message.authType = this.authType;
      message.authData = this.authData;

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = OSPF_PROTOCOL_NUMBER;
      message.TOS = this.service;
      message.identification = this.id;

      // Calculate total length (IPv4 header + OSPF header)
      // OSPF header is 24 bytes minimum
      const ospfLength = 24;
      message.packetLength = ospfLength;
      message.totalLength = 20 + ospfLength; // 20 bytes IPv4 header + OSPF packet

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * RFC 2328: OSPF Hello Packet
 * Used for neighbor discovery and keepalive
 */
export class OSPFHelloMessage extends OSPFMessage {
  // RFC 2328: Network mask of interface
  public networkMask: IPAddress = new IPAddress('255.255.255.0');

  // RFC 2328: Hello interval in seconds
  public helloInterval: number = OSPF_DEFAULT_HELLO_INTERVAL;

  // RFC 2328: Router priority for DR election (0-255, 0 = never DR)
  public routerPriority: number = OSPF_DEFAULT_PRIORITY;

  // RFC 2328: Dead interval in seconds (typically 4 * hello interval)
  public routerDeadInterval: number = OSPF_DEFAULT_DEAD_INTERVAL;

  // RFC 2328: Designated Router IP address
  public designatedRouter: IPAddress = new IPAddress('0.0.0.0');

  // RFC 2328: Backup Designated Router IP address
  public backupDesignatedRouter: IPAddress = new IPAddress('0.0.0.0');

  // RFC 2328: List of neighbor Router IDs seen via this interface
  public neighbors: IPAddress[] = [];

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public override toString(): string {
    return 'OSPF\nHello';
  }

  public static override Builder = class extends OSPFMessage.Builder {
    protected networkMask: IPAddress = new IPAddress('255.255.255.0');

    protected helloInterval: number = OSPF_DEFAULT_HELLO_INTERVAL;

    protected routerPriority: number = OSPF_DEFAULT_PRIORITY;

    protected routerDeadInterval: number = OSPF_DEFAULT_DEAD_INTERVAL;

    protected designatedRouter: IPAddress = new IPAddress('0.0.0.0');

    protected backupDesignatedRouter: IPAddress = new IPAddress('0.0.0.0');

    protected neighbors: IPAddress[] = [];

    public setNetworkMask(mask: IPAddress): this {
      this.networkMask = mask;
      return this;
    }

    public setHelloInterval(interval: number): this {
      if (interval < 1 || interval > 65535)
        throw new Error('Hello interval must be between 1 and 65535 seconds');
      this.helloInterval = interval;
      return this;
    }

    public setRouterPriority(priority: number): this {
      if (priority < 0 || priority > 255)
        throw new Error('Router priority must be between 0 and 255');
      this.routerPriority = priority;
      return this;
    }

    public setRouterDeadInterval(interval: number): this {
      if (interval < 1 || interval > 65535)
        throw new Error('Dead interval must be between 1 and 65535 seconds');
      this.routerDeadInterval = interval;
      return this;
    }

    public setDesignatedRouter(dr: IPAddress): this {
      this.designatedRouter = dr;
      return this;
    }

    public setBackupDesignatedRouter(bdr: IPAddress): this {
      this.backupDesignatedRouter = bdr;
      return this;
    }

    public setNeighbors(neighbors: IPAddress[]): this {
      this.neighbors = neighbors;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new OSPFHelloMessage(
        this.payload,
        this.netSrc,
        this.netDst
      );

      // Set OSPF base fields
      message.version = 2;
      message.type = OSPFPacketType.Hello;
      message.routerID = this.routerID;
      message.areaID = this.areaID;
      message.authType = this.authType;
      message.authData = this.authData;

      // Set Hello-specific fields
      message.networkMask = this.networkMask;
      message.helloInterval = this.helloInterval;
      message.routerPriority = this.routerPriority;
      message.routerDeadInterval = this.routerDeadInterval;
      message.designatedRouter = this.designatedRouter;
      message.backupDesignatedRouter = this.backupDesignatedRouter;
      message.neighbors = [...this.neighbors];

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = OSPF_PROTOCOL_NUMBER;
      message.TOS = this.service;
      message.identification = this.id;

      // Calculate packet length: 24 (OSPF header) + 20 (Hello fixed) + 4*neighbors
      const helloFixedFields = 20;
      const neighborListSize = this.neighbors.length * 4;
      const ospfLength = 24 + helloFixedFields + neighborListSize;
      message.packetLength = ospfLength;
      message.totalLength = 20 + ospfLength;

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * RFC 2328: OSPF Database Description Packet
 * Used to describe the contents of the link-state database
 */
export class OSPFDatabaseDescriptionMessage extends OSPFMessage {
  // RFC 2328: Interface MTU
  public interfaceMTU: number = 1500;

  // RFC 2328: Options field
  public options: number = 0;

  // RFC 2328: Flags (I=Init, M=More, MS=Master/Slave)
  public initFlag: boolean = false;

  public moreFlag: boolean = false;

  public masterFlag: boolean = false;

  // RFC 2328: Database Description sequence number
  public ddSequenceNumber: number = 0;

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public override toString(): string {
    return 'OSPF\nDBD';
  }

  public static override Builder = class extends OSPFMessage.Builder {
    protected interfaceMTU: number = 1500;

    protected options: number = 0;

    protected initFlag: boolean = false;

    protected moreFlag: boolean = false;

    protected masterFlag: boolean = false;

    protected ddSequenceNumber: number = 0;

    public setInterfaceMTU(mtu: number): this {
      this.interfaceMTU = mtu;
      return this;
    }

    public setOptions(options: number): this {
      this.options = options;
      return this;
    }

    public setInitFlag(flag: boolean): this {
      this.initFlag = flag;
      return this;
    }

    public setMoreFlag(flag: boolean): this {
      this.moreFlag = flag;
      return this;
    }

    public setMasterFlag(flag: boolean): this {
      this.masterFlag = flag;
      return this;
    }

    public setDDSequenceNumber(seq: number): this {
      this.ddSequenceNumber = seq;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new OSPFDatabaseDescriptionMessage(
        this.payload,
        this.netSrc,
        this.netDst
      );

      // Set OSPF base fields
      message.version = 2;
      message.type = OSPFPacketType.DatabaseDescription;
      message.routerID = this.routerID;
      message.areaID = this.areaID;
      message.authType = this.authType;
      message.authData = this.authData;

      // Set DBD-specific fields
      message.interfaceMTU = this.interfaceMTU;
      message.options = this.options;
      message.initFlag = this.initFlag;
      message.moreFlag = this.moreFlag;
      message.masterFlag = this.masterFlag;
      message.ddSequenceNumber = this.ddSequenceNumber;

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = OSPF_PROTOCOL_NUMBER;
      message.TOS = this.service;
      message.identification = this.id;

      // Calculate packet length
      const dbdFields = 8;
      const ospfLength = 24 + dbdFields;
      message.packetLength = ospfLength;
      message.totalLength = 20 + ospfLength;

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * OSPF Protocol Implementation
 * Handles basic OSPF packet validation
 */
export class OSPFProtocol implements NetworkListener {
  private iface: NetworkInterface;

  private cleanupTimer: (() => void) | null = null;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
    iface.addListener(this);
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      this.cleanupTimer();
      this.cleanupTimer = null;
    }
  }

  public receivePacket(message: NetworkMessage): ActionHandle {
    if (message instanceof OSPFMessage) {
      // RFC 2328: Verify OSPF version
      if (message.version !== 2) {
        // Drop invalid version packets
        return ActionHandle.Stop;
      }

      // Check if this message is destined for OSPF multicast addresses or this interface
      if (
        message.netDst &&
        !message.netDst.equals(OSPF_ALL_ROUTERS) &&
        !message.netDst.equals(OSPF_ALL_DR) &&
        !this.iface.hasNetAddress(message.netDst)
      ) {
        return ActionHandle.Continue;
      }

      // Message is valid OSPF packet, continue processing in OSPF service
      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }
}

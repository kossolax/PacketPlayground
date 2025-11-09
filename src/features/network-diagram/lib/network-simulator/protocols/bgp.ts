import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage, type Payload } from '../message';
import { IPv4Message } from './ipv4';
import { ActionHandle, type NetworkListener } from './base';

// RFC 4271: BGP Message Types
export enum BGPMessageType {
  Open = 1, // Establish BGP session
  Update = 2, // Exchange routing information
  Notification = 3, // Report errors
  Keepalive = 4, // Maintain session
}

// RFC 4271: BGP Finite State Machine
export enum BGPState {
  Idle = 0, // Initial state, refusing connections
  Connect = 1, // Waiting for TCP connection to complete
  Active = 2, // Trying to acquire peer by initiating TCP connection
  OpenSent = 3, // Waiting for OPEN message from peer
  OpenConfirm = 4, // Waiting for KEEPALIVE or NOTIFICATION
  Established = 5, // Peers can exchange UPDATE, KEEPALIVE and NOTIFICATION
}

// RFC 4271: BGP uses TCP port 179
export const BGP_TCP_PORT = 179;

// RFC 4271: BGP version 4
export const BGP_VERSION = 4;

// RFC 4271: Default timers (in seconds)
export const BGP_DEFAULT_HOLD_TIME = 180; // Hold timer (3 minutes)
export const BGP_DEFAULT_KEEPALIVE_TIME = 60; // Keepalive timer (1 minute, typically 1/3 of hold time)
export const BGP_DEFAULT_CONNECT_RETRY_TIME = 120; // Connect retry timer (2 minutes)

// RFC 4271: BGP Error Codes
export enum BGPErrorCode {
  MessageHeaderError = 1,
  OpenMessageError = 2,
  UpdateMessageError = 3,
  HoldTimerExpired = 4,
  FiniteStateMachineError = 5,
  Cease = 6,
}

/**
 * RFC 4271: BGP Path Attribute
 * Represents a single path attribute in BGP UPDATE messages
 */
export class BGPPathAttribute {
  public flags: number = 0; // Attribute flags (Optional, Transitive, Partial, Extended Length)

  public typeCode: number = 0; // Attribute type code

  public value: number[] = []; // Attribute value

  constructor(flags?: number, typeCode?: number, value?: number[]) {
    if (flags !== undefined) this.flags = flags;
    if (typeCode !== undefined) this.typeCode = typeCode;
    if (value !== undefined) this.value = value;
  }

  public toString(): string {
    return `Attr(type=${this.typeCode}, len=${this.value.length})`;
  }
}

/**
 * RFC 4271: BGP NLRI (Network Layer Reachability Information)
 * Represents advertised or withdrawn routes
 */
export class BGPNLRI {
  public prefix: IPAddress;

  public prefixLength: number; // CIDR prefix length

  constructor(prefix: IPAddress, prefixLength: number) {
    this.prefix = prefix;
    this.prefixLength = prefixLength;
  }

  public toString(): string {
    return `${this.prefix.toString()}/${this.prefixLength}`;
  }
}

/**
 * RFC 4271: BGP Message Base Class
 * All BGP messages share a common header
 */
export class BGPMessage extends IPv4Message {
  // RFC 4271: Marker field (16 bytes, all ones for authentication compatibility)
  public marker: bigint = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');

  // RFC 4271: Message length field
  protected bgpLength: number = 19; // Minimum header size

  // RFC 4271: Total length of message including header (bytes)
  public override get length(): number {
    return this.bgpLength;
  }

  // RFC 4271: Message type
  public type: BGPMessageType = BGPMessageType.Keepalive;

  protected constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
    // RFC 4271: BGP uses TCP (IP protocol number 6)
    this.protocol = 6;
  }

  public override toString(): string {
    const typeName = BGPMessageType[this.type];
    return `BGP\n${typeName}`;
  }

  public override checksum(): number {
    // BGP relies on TCP checksum
    return super.checksum();
  }

  public static override Builder = class extends IPv4Message.Builder {
    protected bgpType: BGPMessageType = BGPMessageType.Keepalive;

    public setBGPType(type: BGPMessageType): this {
      this.bgpType = type;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new BGPMessage(this.payload, this.netSrc, this.netDst);

      // Set BGP-specific fields
      message.marker = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      message.type = this.bgpType;
      message.bgpLength = 19; // Minimum BGP header

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = 6; // TCP
      message.TOS = this.service;
      message.identification = this.id;

      // Calculate total length (IPv4 header + TCP header + BGP message)
      // Simplified: 20 (IPv4) + 20 (TCP) + 19 (BGP header)
      message.totalLength = 20 + 20 + message.length;

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * RFC 4271: BGP OPEN Message
 * Used to establish a BGP session between peers
 */
export class BGPOpenMessage extends BGPMessage {
  // RFC 4271: BGP version (must be 4)
  public version: number = BGP_VERSION;

  // RFC 4271: Autonomous System number of sender
  public myAutonomousSystem: number = 0;

  // RFC 4271: Hold time proposed by sender (seconds)
  public holdTime: number = BGP_DEFAULT_HOLD_TIME;

  // RFC 4271: BGP Identifier (Router ID) - typically router's highest IP
  public bgpIdentifier: IPAddress = new IPAddress('0.0.0.0');

  // RFC 4271: Optional parameters length
  public optionalParametersLength: number = 0;

  // RFC 4271: Optional parameters (capabilities, etc.)
  public optionalParameters: number[] = [];

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
  }

  public override toString(): string {
    return `BGP\nOPEN (AS ${this.myAutonomousSystem})`;
  }

  public static override Builder = class extends BGPMessage.Builder {
    protected version: number = BGP_VERSION;

    protected myAS: number = 0;

    protected holdTime: number = BGP_DEFAULT_HOLD_TIME;

    protected bgpID: IPAddress = new IPAddress('0.0.0.0');

    protected optParams: number[] = [];

    public setVersion(version: number): this {
      if (version !== 4) {
        throw new Error('BGP version must be 4');
      }
      this.version = version;
      return this;
    }

    public setMyAutonomousSystem(asNumber: number): this {
      if (asNumber < 0 || asNumber > 65535) {
        throw new Error('AS number must be between 0 and 65535');
      }
      this.myAS = asNumber;
      return this;
    }

    public setHoldTime(holdTime: number): this {
      if (holdTime !== 0 && (holdTime < 3 || holdTime > 65535)) {
        throw new Error('Hold time must be 0 or between 3 and 65535 seconds');
      }
      this.holdTime = holdTime;
      return this;
    }

    public setBGPIdentifier(routerID: IPAddress): this {
      this.bgpID = routerID;
      return this;
    }

    public setOptionalParameters(params: number[]): this {
      this.optParams = params;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new BGPOpenMessage(
        this.payload,
        this.netSrc,
        this.netDst
      );

      // Set BGP base fields
      message.marker = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      message.type = BGPMessageType.Open;

      // Set OPEN-specific fields
      message.version = this.version;
      message.myAutonomousSystem = this.myAS;
      message.holdTime = this.holdTime;
      message.bgpIdentifier = this.bgpID;
      message.optionalParameters = [...this.optParams];
      message.optionalParametersLength = this.optParams.length;

      // Calculate BGP message length
      // 19 (header) + 10 (OPEN fixed fields) + optional parameters length
      message.bgpLength = 19 + 10 + message.optionalParametersLength;

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = 6; // TCP
      message.TOS = this.service;
      message.identification = this.id;

      message.totalLength = 20 + 20 + message.length;

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * RFC 4271: BGP UPDATE Message
 * Used to advertise or withdraw routes
 */
export class BGPUpdateMessage extends BGPMessage {
  // RFC 4271: Withdrawn routes (routes that are no longer available)
  public withdrawnRoutes: BGPNLRI[] = [];

  // RFC 4271: Path attributes for advertised routes
  public pathAttributes: BGPPathAttribute[] = [];

  // RFC 4271: Network Layer Reachability Information (advertised routes)
  public nlri: BGPNLRI[] = [];

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
  }

  public override toString(): string {
    const nlriCount = this.nlri.length;
    const withdrawnCount = this.withdrawnRoutes.length;
    return `BGP\nUPDATE (+${nlriCount}/-${withdrawnCount})`;
  }

  public static override Builder = class extends BGPMessage.Builder {
    protected withdrawn: BGPNLRI[] = [];

    protected pathAttrs: BGPPathAttribute[] = [];

    protected nlriList: BGPNLRI[] = [];

    public addWithdrawnRoute(route: BGPNLRI): this {
      this.withdrawn.push(route);
      return this;
    }

    public setWithdrawnRoutes(routes: BGPNLRI[]): this {
      this.withdrawn = [...routes];
      return this;
    }

    public addPathAttribute(attr: BGPPathAttribute): this {
      this.pathAttrs.push(attr);
      return this;
    }

    public setPathAttributes(attrs: BGPPathAttribute[]): this {
      this.pathAttrs = [...attrs];
      return this;
    }

    public addNLRI(nlri: BGPNLRI): this {
      this.nlriList.push(nlri);
      return this;
    }

    public setNLRI(nlriList: BGPNLRI[]): this {
      this.nlriList = [...nlriList];
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new BGPUpdateMessage(
        this.payload,
        this.netSrc,
        this.netDst
      );

      // Set BGP base fields
      message.marker = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      message.type = BGPMessageType.Update;

      // Set UPDATE-specific fields
      message.withdrawnRoutes = [...this.withdrawn];
      message.pathAttributes = [...this.pathAttrs];
      message.nlri = [...this.nlriList];

      // Calculate variable field lengths (simplified)
      const withdrawnLength = this.withdrawn.length * 5; // Approximate
      const pathAttrLength = this.pathAttrs.reduce(
        (sum, attr) => sum + attr.value.length + 3,
        0
      );
      const nlriLength = this.nlriList.length * 5; // Approximate

      // Calculate BGP message length
      message.bgpLength =
        19 + 2 + withdrawnLength + 2 + pathAttrLength + nlriLength;

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = 6; // TCP
      message.TOS = this.service;
      message.identification = this.id;

      message.totalLength = 20 + 20 + message.length;

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * RFC 4271: BGP NOTIFICATION Message
 * Used to report errors and close sessions
 */
export class BGPNotificationMessage extends BGPMessage {
  // RFC 4271: Error code
  public errorCode: BGPErrorCode = BGPErrorCode.Cease;

  // RFC 4271: Error subcode
  public errorSubcode: number = 0;

  // RFC 4271: Diagnostic data
  public data: number[] = [];

  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
  }

  public override toString(): string {
    const errorName = BGPErrorCode[this.errorCode] || 'Unknown';
    return `BGP\nNOTIFICATION (${errorName})`;
  }

  public static override Builder = class extends BGPMessage.Builder {
    protected errCode: BGPErrorCode = BGPErrorCode.Cease;

    protected errSubcode: number = 0;

    protected errData: number[] = [];

    public setErrorCode(code: BGPErrorCode): this {
      this.errCode = code;
      return this;
    }

    public setErrorSubcode(subcode: number): this {
      this.errSubcode = subcode;
      return this;
    }

    public setData(data: number[]): this {
      this.errData = [...data];
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new BGPNotificationMessage(
        this.payload,
        this.netSrc,
        this.netDst
      );

      // Set BGP base fields
      message.marker = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      message.type = BGPMessageType.Notification;

      // Set NOTIFICATION-specific fields
      message.errorCode = this.errCode;
      message.errorSubcode = this.errSubcode;
      message.data = [...this.errData];

      // Calculate BGP message length
      // 19 (header) + 2 (error code + subcode) + data length
      message.bgpLength = 19 + 2 + this.errData.length;

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = 6; // TCP
      message.TOS = this.service;
      message.identification = this.id;

      message.totalLength = 20 + 20 + message.length;

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

/**
 * RFC 4271: BGP Protocol Listener
 * Validates incoming BGP messages
 */
export class BGPProtocol implements NetworkListener {
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
    if (message instanceof BGPMessage) {
      // RFC 4271: Verify BGP version in OPEN messages
      if (message instanceof BGPOpenMessage) {
        if (message.version !== BGP_VERSION) {
          // Drop invalid version packets
          return ActionHandle.Stop;
        }
      }

      // Check if this message is destined for this interface
      if (message.netDst && !this.iface.hasNetAddress(message.netDst)) {
        return ActionHandle.Continue;
      }

      // Message is valid BGP packet, continue processing in BGP service
      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }
}

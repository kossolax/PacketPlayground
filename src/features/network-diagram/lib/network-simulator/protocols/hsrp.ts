import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage, type Payload } from '../message';
import { IPv4Message } from './ipv4';
import { ActionHandle, type NetworkListener } from './base';

// RFC 2281: HSRP States
export enum HSRPState {
  Initial = 0, // Initial state at startup
  Learn = 1, // Router has not determined virtual IP address
  Listen = 2, // Router knows virtual IP but is neither active nor standby
  Speak = 3, // Router is participating in election
  Standby = 4, // Router is prepared to take over forwarding
  Active = 5, // Router is forwarding packets
}

// RFC 2281: HSRP Message Types (Op Code)
export enum HSRPOpCode {
  Hello = 0, // Hello message sent periodically
  Coup = 1, // Coup message (router wants to become active)
  Resign = 2, // Resign message (active router is shutting down)
}

// RFC 2281: HSRP uses UDP port 1985 and multicast to 224.0.0.2
export const HSRP_MULTICAST_IP = new IPAddress('224.0.0.2');
export const HSRP_UDP_PORT = 1985;

// HSRP Virtual MAC: 0000.0c07.acXX where XX is the group number
export function getHSRPVirtualMAC(group: number): string {
  const groupHex = group.toString(16).padStart(2, '0').toUpperCase();
  return `00:00:0C:07:AC:${groupHex}`;
}

export class HSRPMessage extends IPv4Message {
  // RFC 2281: Version field (currently version 0 for HSRPv1)
  public version: number = 0;

  // RFC 2281: Op Code - type of HSRP message
  public opCode: HSRPOpCode = HSRPOpCode.Hello;

  // RFC 2281: State of the router sending this message
  public state: HSRPState = HSRPState.Initial;

  // RFC 2281: Hellotime - seconds between hello messages (default 3)
  public hellotime: number = 3;

  // RFC 2281: Holdtime - seconds before active/standby is declared down (default 10)
  public holdtime: number = 10;

  // RFC 2281: Priority - used for election (0-255, default 100, higher is better)
  public priority: number = 100;

  // RFC 2281: Group number (0-255)
  public group: number = 0;

  // RFC 2281: Reserved field (must be 0)
  public reserved: number = 0;

  // RFC 2281: Authentication data (8 bytes, default "cisco")
  public authData: string = 'cisco\x00\x00\x00';

  // RFC 2281: Virtual IP address for this HSRP group
  public virtualIP: IPAddress = new IPAddress('0.0.0.0');

  protected constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
    // RFC 2281: HSRP uses IP protocol number 17 (UDP)
    this.protocol = 17;
  }

  public override toString(): string {
    const opCodeName = HSRPOpCode[this.opCode];
    const stateName = HSRPState[this.state];
    return `HSRP\n${opCodeName} (${stateName})`;
  }

  public override checksum(): number {
    // HSRP doesn't use a separate checksum, it relies on UDP/IP checksums
    return super.checksum();
  }

  public static override Builder = class extends IPv4Message.Builder {
    protected opCode: HSRPOpCode = HSRPOpCode.Hello;

    protected hsrpState: HSRPState = HSRPState.Initial;

    protected hellotime: number = 3;

    protected holdtime: number = 10;

    protected priority: number = 100;

    protected group: number = 0;

    protected authData: string = 'cisco\x00\x00\x00';

    protected virtualIP: IPAddress = new IPAddress('0.0.0.0');

    public setOpCode(opCode: HSRPOpCode): this {
      this.opCode = opCode;
      return this;
    }

    public setHSRPState(state: HSRPState): this {
      this.hsrpState = state;
      return this;
    }

    public setHellotime(hellotime: number): this {
      if (hellotime < 0 || hellotime > 255)
        throw new Error('Hellotime must be between 0 and 255');
      this.hellotime = hellotime;
      return this;
    }

    public setHoldtime(holdtime: number): this {
      if (holdtime < 0 || holdtime > 255)
        throw new Error('Holdtime must be between 0 and 255');
      this.holdtime = holdtime;
      return this;
    }

    public setPriority(priority: number): this {
      if (priority < 0 || priority > 255)
        throw new Error('Priority must be between 0 and 255');
      this.priority = priority;
      return this;
    }

    public setGroup(group: number): this {
      if (group < 0 || group > 255)
        throw new Error('Group must be between 0 and 255');
      this.group = group;
      return this;
    }

    public setAuthData(authData: string): this {
      // RFC 2281: Authentication data is 8 bytes, pad or truncate as needed
      if (authData.length > 8) {
        this.authData = authData.substring(0, 8);
      } else {
        this.authData = authData.padEnd(8, '\x00');
      }
      return this;
    }

    public setVirtualIP(virtualIP: IPAddress): this {
      this.virtualIP = virtualIP;
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      const message = new HSRPMessage(this.payload, this.netSrc, this.netDst);

      // Set HSRP-specific fields
      message.version = 0; // HSRPv1
      message.opCode = this.opCode;
      message.state = this.hsrpState;
      message.hellotime = this.hellotime;
      message.holdtime = this.holdtime;
      message.priority = this.priority;
      message.group = this.group;
      message.reserved = 0;
      message.authData = this.authData;
      message.virtualIP = this.virtualIP;

      // Set IPv4 fields
      message.ttl = this.ttl;
      message.protocol = 17; // UDP
      message.TOS = this.service;
      message.identification = this.id;

      // Calculate total length (IPv4 header + HSRP message)
      // HSRP message is 20 bytes minimum
      const hsrpLength = 20;
      message.totalLength = 20 + hsrpLength; // 20 bytes IPv4 header + 20 bytes HSRP

      message.headerChecksum = message.checksum();

      return [message];
    }
  };
}

export class HSRPProtocol implements NetworkListener {
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
    if (message instanceof HSRPMessage) {
      // RFC 2281: Verify HSRP version
      if (message.version !== 0) {
        // Drop invalid version packets
        return ActionHandle.Stop;
      }

      // Check if this message is destined for HSRP multicast address
      if (
        message.netDst &&
        !message.netDst.equals(HSRP_MULTICAST_IP) &&
        !this.iface.hasNetAddress(message.netDst)
      ) {
        return ActionHandle.Continue;
      }

      // Message is valid HSRP packet, continue processing in HSRP service
      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }
}

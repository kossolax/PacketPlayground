import type { HardwareAddress, MacAddress } from '../address';
import type {
  Dot1QInterface,
  EthernetInterface,
  HardwareInterface,
} from '../layers/datalink';
import { DatalinkMessage, type Payload } from '../message';
import { ActionHandle, type DatalinkListener } from './base';
import { crc32 } from './checksum';

export class EthernetMessage extends DatalinkMessage {
  public headerChecksum: number = 0;

  protected constructor(
    payload: Payload | string,
    macSrc: HardwareAddress,
    macDst: HardwareAddress | null
  ) {
    super(payload, macSrc, macDst);
  }

  public override get length(): number {
    // Ethernet frame: MAC dest (6) + MAC src (6) + EtherType (2) = 14 bytes header
    // + Payload (minimum 46 bytes per IEEE 802.3) + FCS/CRC (4 bytes)
    const payloadLength = Math.max(46, this.payload.length);
    return 14 + payloadLength + 4;
  }

  public override toString(): string {
    return `Ethernet\n${this.payload.toString()}`;
  }

  public checksum(): number {
    // IEEE 802.3: FCS uses CRC-32 polynomial 0x04C11DB7
    const bytes: number[] = [];

    // Add destination MAC (6 bytes)
    if (this.macDst) {
      const dstBytes = this.macDst
        .toString()
        .split(':')
        .map((b) => parseInt(b, 16));
      bytes.push(...dstBytes);
    }

    // Add source MAC (6 bytes)
    const srcBytes = this.macSrc
      .toString()
      .split(':')
      .map((b) => parseInt(b, 16));
    bytes.push(...srcBytes);

    // Add EtherType/Length field (2 bytes)
    // IEEE 802.3 Section 3.2.6: Values >= 1536 (0x0600) indicate EtherType
    // Determine EtherType based on payload type
    let etherType = 0x0000; // Default
    const payloadName = this.payload.toString();

    if (payloadName.includes('ARP')) {
      etherType = 0x0806; // ARP
    } else if (
      payloadName.includes('IPv4') ||
      payloadName.includes('ICMP') ||
      payloadName.includes('DHCP')
    ) {
      etherType = 0x0800; // IPv4
    } else if (payloadName.includes('IPv6')) {
      etherType = 0x86dd; // IPv6
    } else if (this.payload.length < 1536) {
      // IEEE 802.3: If < 1536, it's a Length field, not EtherType
      etherType = this.payload.length;
    } else {
      // Default to IPv4 for unknown payloads
      etherType = 0x0800;
    }

    // Add EtherType as big-endian (network byte order)
    bytes.push((etherType >> 8) & 0xff); // High byte
    bytes.push(etherType & 0xff); // Low byte

    // Add payload
    const payloadStr = this.payload.toString();
    for (let i = 0; i < payloadStr.length; i++) {
      bytes.push(payloadStr.charCodeAt(i) & 0xff);
    }

    return crc32(bytes);
  }

  public isReadyAtEndPoint(iface: HardwareInterface): boolean {
    if (this.macDst && iface.hasMacAddress(this.macDst)) return true;
    return false;
  }

  public static Builder = class {
    public payload: Payload | string = '';

    public macSrc: MacAddress | null = null;

    public macDst: MacAddress | null = null;

    public setMacSource(addr: MacAddress): this {
      this.macSrc = addr;
      return this;
    }

    public setMacDestination(addr: MacAddress): this {
      this.macDst = addr;
      return this;
    }

    public setPayload(payload: Payload | string): this {
      this.payload = payload;
      return this;
    }

    public build(): EthernetMessage {
      if (this.macSrc === null)
        throw new Error('MAC source address is not set');
      if (this.macDst === null)
        throw new Error('MAC destination address is not set');

      const message = new EthernetMessage(
        this.payload,
        this.macSrc,
        this.macDst
      );
      message.headerChecksum = message.checksum();

      return message;
    }
  };
}

export class Dot1QMessage extends EthernetMessage {
  public vlanId: number = 0;

  protected constructor(
    payload: Payload | string,
    macSrc: HardwareAddress,
    macDst: HardwareAddress | null
  ) {
    super(payload, macSrc, macDst);
  }

  public override toString(): string {
    return `Dot1Q\n${this.payload.toString()}`;
  }

  public static override Builder = class extends EthernetMessage.Builder {
    public vlanId: number = 0;

    public setVlan(vlanId: number): this {
      this.vlanId = vlanId;
      return this;
    }

    public override build(): Dot1QMessage {
      if (this.macSrc === null)
        throw new Error('MAC source address is not set');
      if (this.macDst === null)
        throw new Error('MAC destination address is not set');

      const message = new Dot1QMessage(this.payload, this.macSrc, this.macDst);
      message.vlanId = this.vlanId;
      message.headerChecksum = message.checksum();

      return message;
    }
  };
}

export enum VlanMode {
  Access = 0,
  Trunk = 1,
}

export class EthernetProtocol implements DatalinkListener {
  protected iface: EthernetInterface;

  constructor(iface: EthernetInterface) {
    this.iface = iface;
    iface.addListener(this);
  }

  public receiveTrame(message: DatalinkMessage): ActionHandle {
    if (message instanceof EthernetMessage) {
      if (message instanceof Dot1QMessage) return ActionHandle.Continue;
      // Standard Ethernet frame received on interface
      // Base implementation - subclasses may use this.iface for additional processing
      if (this.iface.isActive()) {
        return ActionHandle.Continue;
      }
    }

    return ActionHandle.Continue;
  }
}

export class Dot1QProtocol extends EthernetProtocol {
  public override receiveTrame(message: DatalinkMessage): ActionHandle {
    if (message instanceof Dot1QMessage) {
      if ((this.iface as Dot1QInterface).Vlan.indexOf(message.vlanId) === -1)
        return ActionHandle.Stop;
    }

    return ActionHandle.Continue;
  }
}

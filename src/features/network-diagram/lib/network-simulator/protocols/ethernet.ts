import type { HardwareAddress, MacAddress } from '../address';
import type {
  Dot1QInterface,
  EthernetInterface,
  HardwareInterface,
} from '../layers/datalink';
import { DatalinkMessage, type Payload } from '../message';
import { ActionHandle, type DatalinkListener } from './base';

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
    // Stub implementation - Ethernet uses FCS (Frame Check Sequence) with CRC-32
    // TODO: Implement proper CRC-32 calculation
    let sum = 0;
    sum += this.payload.length;
    return sum;
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

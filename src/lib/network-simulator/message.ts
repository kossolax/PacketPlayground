import type { HardwareAddress, NetworkAddress } from './address';

export interface Payload {
  get length(): number;
}

export abstract class Message {
  public payload: Payload | string;

  constructor(payload: Payload | string) {
    this.payload = payload;
  }

  public toString(): string {
    return this.payload.toString();
  }

  public get length(): number {
    return this.payload.length;
  }
}

export class PhysicalMessage extends Message {
  // Inherits length getter from Message
}

export class DatalinkMessage extends PhysicalMessage {
  public macSrc: HardwareAddress;

  public macDst: HardwareAddress | null;

  constructor(
    payload: Payload | string,
    macSrc: HardwareAddress,
    macDst: HardwareAddress | null
  ) {
    super(payload);
    this.macSrc = macSrc;
    this.macDst = macDst;
  }

  public override get length(): number {
    return this.payload.length + this.macSrc.length * 2;
  }
}

export class NetworkMessage extends Message {
  public netSrc: NetworkAddress;

  public netDst: NetworkAddress | null;

  constructor(
    payload: Payload | string,
    netSrc: NetworkAddress,
    netDst: NetworkAddress | null
  ) {
    super(payload);
    this.netSrc = netSrc;
    this.netDst = netDst;
  }

  public override get length(): number {
    return this.payload.length + this.netSrc.length * 2;
  }
}

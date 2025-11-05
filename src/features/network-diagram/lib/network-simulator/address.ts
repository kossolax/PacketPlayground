export abstract class Address {
  protected address: string;

  protected broadcast: boolean = false;

  get isBroadcast(): boolean {
    return this.broadcast;
  }

  constructor(address: string = '') {
    this.address = address;
  }

  public equals(other: Address | null): boolean {
    if (other === null) return false;

    return this.address === other.address;
  }

  public toString(): string {
    return this.address;
  }

  abstract get length(): number;

  protected abstract IsValid(): boolean;

  public abstract compareTo(other: Address): number;
}

export abstract class HardwareAddress extends Address {}

export class MacAddress extends HardwareAddress {
  constructor(address: string) {
    const normalizedAddress = address.toUpperCase();
    super(normalizedAddress);

    if (normalizedAddress === 'FF:FF:FF:FF:FF:FF') this.broadcast = true;

    if (!this.IsValid()) throw new Error(`Invalid MAC address: ${address}`);
  }

  protected IsValid(): boolean {
    const mac = this.address.split(':');
    if (mac.length !== 6) return false;

    for (let i = 0; i < 6; i += 1) {
      const value = parseInt(mac[i], 16);
      if (
        mac[i].length === 0 ||
        value.toString(16).padStart(2, '0').toUpperCase() !==
          mac[i].padStart(2, '0') ||
        Number.isNaN(value) ||
        value < 0 ||
        value > 255
      )
        return false;
    }

    return true;
  }

  override get length(): number {
    return this.address.split(':').length;
  }

  public compareTo(other: MacAddress): number {
    const mac = this.address.split(':');
    const otherMac = other.address.split(':');

    for (let i = 0; i < 6; i += 1) {
      const value = parseInt(mac[i], 16);
      const otherValue = parseInt(otherMac[i], 16);

      if (value < otherValue) return -1;
      if (value > otherValue) return 1;
    }

    return 0;
  }

  public static generateAddress(): MacAddress {
    const mac = new Array(6);
    for (let i = 0; i < 6; i += 1)
      mac[i] = Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0');
    return new MacAddress(mac.join(':'));
  }

  public static generateBroadcast(): MacAddress {
    const mac = new MacAddress('FF:FF:FF:FF:FF:FF');
    mac.broadcast = true;
    return mac;
  }
}

export abstract class NetworkAddress extends Address {
  protected isMask: boolean = false;

  get IsMask(): boolean {
    return this.isMask;
  }

  public abstract generateMask(): IPAddress;

  public abstract InSameNetwork(
    mask: NetworkAddress,
    dest: NetworkAddress
  ): boolean;

  abstract get CIDR(): number;
}

export class IPAddress extends NetworkAddress {
  constructor(address: string, isMask: boolean = false) {
    super(address);

    this.isMask = isMask;
    if (!isMask && address === '255.255.255.255') this.broadcast = true;

    if (!this.IsValid()) throw new Error('Invalid IP address');
  }

  protected IsValid(): boolean {
    const ip = this.address.split('.');
    if (ip.length !== 4) return false;

    for (let i = 0; i < 4; i += 1) {
      const value = parseInt(ip[i], 10);
      if (
        ip[i].length === 0 ||
        value.toString(10) !== ip[i] ||
        Number.isNaN(value) ||
        value < 0 ||
        value > 255
      )
        return false;
    }

    if (this.isMask) {
      const binary = this.address
        .split('.')
        .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
        .join('');

      let lookForOne = true;
      for (let i = 0; i < binary.length; i += 1) {
        const bit = binary[i];

        if (lookForOne && bit === '0') lookForOne = false;
        else if (!lookForOne && bit === '1') return false;
      }
    }

    return true;
  }

  override get length(): number {
    return this.address.split('.').length;
  }

  public compareTo(other: IPAddress): number {
    const ip = this.address.split('.');
    const otherIp = other.address.split('.');

    for (let i = 0; i < 4; i += 1) {
      const value = parseInt(ip[i], 10);
      const otherValue = parseInt(otherIp[i], 10);

      if (value < otherValue) return -1;
      if (value > otherValue) return 1;
    }

    return 0;
  }

  public toNumber(): number {
    const parts = this.address.split('.');
    return (
      (parseInt(parts[0], 10) << 24) +
      (parseInt(parts[1], 10) << 16) +
      (parseInt(parts[2], 10) << 8) +
      parseInt(parts[3], 10)
    );
  }

  public static generateAddress(): IPAddress {
    const ip = new Array(4);
    for (let i = 0; i < 4; i += 1) ip[i] = Math.floor(Math.random() * 256);
    return new IPAddress(ip.join('.'));
  }

  public override generateMask(): IPAddress {
    const firstBlock = parseInt(this.address.split('.')[0], 10);

    if (firstBlock >= 0 && firstBlock <= 127)
      // class A
      return new IPAddress('255.0.0.0', true);
    if (firstBlock >= 128 && firstBlock <= 191)
      // class B
      return new IPAddress('255.255.0.0', true);
    if (firstBlock >= 192 && firstBlock <= 223)
      // class C
      return new IPAddress('255.255.255.0', true);
    if (firstBlock >= 224 && firstBlock <= 240)
      // class D, multicast
      return new IPAddress('255.255.255.0', true);
    // class E, reserved
    return new IPAddress('255.255.255.0', true);
  }

  public getNetworkIP(mask: IPAddress): IPAddress {
    const src = this.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');
    const net = mask.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');

    const srcAnd = src
      .split('')
      .map((value, index) => (value === '1' && net[index] === '1' ? '1' : '0'))
      .join('');
    const blocks = [
      parseInt(srcAnd.slice(0, 8), 2),
      parseInt(srcAnd.slice(8, 16), 2),
      parseInt(srcAnd.slice(16, 24), 2),
      parseInt(srcAnd.slice(24, 32), 2),
    ];

    return new IPAddress(blocks.join('.'));
  }

  public getBroadcastIP(mask: IPAddress): IPAddress {
    const src = this.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');
    const net = mask.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');
    const netReverse = net
      .split('')
      .map((value) => (value === '1' ? '0' : '1'))
      .join('');

    const srcOr = src
      .split('')
      .map((value, index) =>
        value === '1' || netReverse[index] === '1' ? '1' : '0'
      )
      .join('');
    const blocks = [
      parseInt(srcOr.slice(0, 8), 2),
      parseInt(srcOr.slice(8, 16), 2),
      parseInt(srcOr.slice(16, 24), 2),
      parseInt(srcOr.slice(24, 32), 2),
    ];

    return new IPAddress(blocks.join('.'));
  }

  public add(value: number): IPAddress {
    const blocks = this.address.split('.').map((v) => parseInt(v, 10));
    let remaining = value;

    for (let i = 3; i >= 0; i -= 1) {
      blocks[i] += remaining;

      if (blocks[i] > 255) {
        blocks[i] %= 256;
        remaining = Math.ceil(remaining / 256);
      } else {
        break;
      }
    }

    return new IPAddress(blocks.join('.'));
  }

  public subtract(value: number): IPAddress {
    const blocks = this.address.split('.').map((v) => parseInt(v, 10));
    let remaining = value;

    for (let i = 3; i >= 0; i -= 1) {
      blocks[i] -= remaining;

      if (blocks[i] < 0) {
        blocks[i] = 256 - (-blocks[i] % 256);
        remaining = Math.ceil(remaining / 256);
      } else {
        break;
      }
    }

    return new IPAddress(blocks.join('.'));
  }

  public InSameNetwork(mask: IPAddress, dest: IPAddress): boolean {
    const src = this.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');
    const net = mask.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');
    const dst = dest.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');

    const srcAnd = src
      .split('')
      .map((value, index) => (value === '1' && net[index] === '1' ? '1' : '0'))
      .join('');
    const dstAnd = dst
      .split('')
      .map((value, index) => (value === '1' && net[index] === '1' ? '1' : '0'))
      .join('');

    return srcAnd === dstAnd;
  }

  get CIDR(): number {
    const binary = this.address
      .split('.')
      .map((value) => parseInt(value, 10).toString(2).padStart(8, '0'))
      .join('');

    let count = 0;
    for (let i = 0; i < binary.length; i += 1) {
      if (binary[i] === '1') count += 1;
    }
    return count;
  }

  public static generateBroadcast(): IPAddress {
    const ip = new IPAddress('255.255.255.255');
    ip.broadcast = true;
    return ip;
  }
}

import type { Observable } from 'rxjs';

import type { HardwareAddress, IPAddress, NetworkAddress } from '../address';
import { DatalinkMessage, NetworkMessage } from '../message';
import { ArpProtocol } from '../protocols/arp';
import { ICMPProtocol } from '../protocols/icmp';
import { IPv4Message, IPv4Protocol } from '../protocols/ipv4';
import {
  ActionHandle,
  type DatalinkListener,
  handleChain,
  type NetworkListener,
  type NetworkSender,
} from '../protocols/base';
import { DhcpClient } from '../services/dhcp';
import { HardwareInterface, Interface } from './datalink';
import type { GenericNode, NetworkHost } from '../nodes/generic';
import { NetworkInterfaceMarker } from './layer-base';
import { Scheduler } from '@/features/network-diagram/lib/scheduler';

export abstract class NetworkInterface
  extends Interface
  implements DatalinkListener, NetworkListener, NetworkSender
{
  // Marker for type checking in base.ts to avoid circular dependencies
  public readonly netInterfaceMarker: NetworkInterfaceMarker =
    new NetworkInterfaceMarker();

  private addresses: { addr: NetworkAddress; mask: NetworkAddress }[] = [];

  protected datalink: HardwareInterface;

  protected discovery: ArpProtocol;

  protected dhcp: DhcpClient | null;

  constructor(node: GenericNode, name: string, datalink: HardwareInterface) {
    super(node, name);
    this.datalink = datalink;
    this.datalink.addListener(this);
    this.discovery = new ArpProtocol(this, datalink);
    this.dhcp = null;
  }

  get AutoNegociateAddress(): boolean {
    return this.dhcp !== null;
  }

  set AutoNegociateAddress(value: boolean) {
    if (value) {
      this.dhcp?.destroy();
      this.dhcp = new DhcpClient(this);
      this.dhcp.negociate();
    } else if (!value) {
      this.dhcp?.destroy();
      this.dhcp = null;
    }
  }

  public hasNetAddress(ip: NetworkAddress): boolean {
    if (ip.isBroadcast) return true;

    return this.addresses.filter((i) => i.addr.equals(ip)).length > 0;
  }

  public addNetAddress(ip: NetworkAddress): void {
    if (this.hasNetAddress(ip)) throw new Error('IP address already added');

    this.addresses.push({
      addr: ip,
      mask: ip.generateMask(),
    });
  }

  public getNetAddress(index: number = 0): NetworkAddress {
    return this.addresses[index].addr;
  }

  public getNetMask(index: number = 0): NetworkAddress {
    return this.addresses[index].mask;
  }

  public setNetAddress(addr: NetworkAddress, index: number = 0): void {
    if (addr.IsMask) throw new Error('Invalid netmask');

    this.addresses[index].addr = addr;
    this.addresses[index].mask = addr.generateMask();
  }

  public setNetMask(addr: NetworkAddress, index: number = 0): void {
    if (!addr.IsMask) throw new Error('Invalid netmask');
    this.addresses[index].mask = addr;
  }

  public getMacAddress(): HardwareAddress {
    return this.datalink.getMacAddress();
  }

  public setMacAddress(addr: HardwareAddress): void {
    this.datalink.setMacAddress(addr);
  }

  public getInterface(): HardwareInterface {
    return this.datalink;
  }

  public override up(): void {
    super.up();
    this.datalink.up();
  }

  public override down(): void {
    super.down();
    this.datalink.down();
  }

  override get isConnected(): boolean {
    return this.datalink.isConnected;
  }

  override get Speed(): number {
    return this.datalink.Speed;
  }

  override set Speed(speed: number) {
    this.datalink.Speed = speed;
  }

  public receiveTrame(message: DatalinkMessage): ActionHandle {
    const macDst = message.macDst as HardwareAddress;

    if (
      (macDst.equals(this.datalink.getMacAddress()) &&
        macDst.isBroadcast === false) ||
      macDst.isBroadcast
    ) {
      if (message.payload instanceof NetworkMessage)
        this.receivePacket(message.payload as NetworkMessage);

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  public receivePacket(message: NetworkMessage): ActionHandle {
    const action = handleChain(
      'receivePacket',
      this.getListener,
      message,
      this
    );
    if (action !== ActionHandle.Continue) return action;

    // throw new Error("IP forwarding is not implemented on NetworkInterface");
    return ActionHandle.Continue;
  }

  public sendPacket(message: NetworkMessage): void {
    if (!this.isActive()) throw new Error('Interface is down');

    const action = handleChain('sendPacket', this.getListener, message, this);
    if (action !== ActionHandle.Continue) return;

    const loopback = this.addresses.filter((i) =>
      i.addr.equals(message.netDst)
    );
    if (loopback.length > 0) {
      // Schedule loopback asynchronously to allow listeners to be added
      Scheduler.getInstance().once(0, () => {
        this.receivePacket(message);
      });
      return;
    }

    let nextHop = null;
    if (message.netDst?.isBroadcast === false)
      nextHop = (this.Host as unknown as NetworkHost).getNextHop(
        message.netDst
      );

    if (nextHop === null || this.hasNetAddress(nextHop))
      nextHop = message.netDst;

    if (nextHop === null) throw new Error('No next hop found');

    this.discovery.enqueueRequest(message, nextHop);
  }

  public sendTrame(message: DatalinkMessage): void {
    this.datalink.sendTrame(message);
  }
}

export class IPInterface extends NetworkInterface {
  private protocols1: IPv4Protocol;

  private protocols2: ICMPProtocol;

  constructor(node: GenericNode, name: string, datalink: HardwareInterface) {
    super(node, 'ethip', datalink);
    this.protocols1 = new IPv4Protocol(this);
    this.protocols2 = new ICMPProtocol(this);
  }

  public sendIcmpRequest(
    destination: IPAddress,
    timeout: number = 20
  ): Observable<IPv4Message | null> {
    return this.protocols2.sendIcmpRequest(destination, timeout);
  }

  public override sendPacket(message: NetworkMessage): void {
    if (message instanceof IPv4Message) {
      super.sendPacket(message);
    } else {
      const ipv4 = new IPv4Message.Builder()
        .setNetSource(message.netSrc as IPAddress)
        .setNetDestination(message.netDst as IPAddress)
        .setPayload(message.payload)
        .build();

      ipv4.map((i) => super.sendPacket(i));
    }
  }
}

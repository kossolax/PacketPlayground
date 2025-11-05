import { IPAddress, type NetworkAddress } from '../address';
import {
  ActionHandle,
  handleChain,
  type NetworkListener,
} from '../protocols/base';
import { DhcpServer } from '../services/dhcp';
import { NetworkHost } from './generic';
import { NetworkMessage } from '../message';
import type { NetworkInterface } from '../layers/network';
import { IPv4Message } from '../protocols/ipv4';
import { ICMPMessage, ICMPType } from '../protocols/icmp';

export type RoutingTableEntry = {
  network: NetworkAddress;
  mask: NetworkAddress;
  gateway: NetworkAddress;
};

export class RouterHost extends NetworkHost implements NetworkListener {
  public override name = 'Router';

  public override type = 'router';

  private routingTable: RoutingTableEntry[] = [];

  get RoutingTable(): RoutingTableEntry[] {
    return this.routingTable;
  }

  public services: { dhcp: DhcpServer };

  // Modern callback pattern instead of RxJS Subject
  public onReceivePacket?: (message: NetworkMessage) => void;

  constructor(name: string = '', iface: number = 0) {
    super();
    if (name !== '') this.name = name;

    for (let i = 0; i < iface; i += 1) this.addInterface();

    this.services = {
      dhcp: new DhcpServer(this),
    };
  }

  public clone(): RouterHost {
    const clone = new RouterHost();
    this.applyCloneProperties(clone);
    this.cloneInterfaces(clone);
    return clone;
  }

  public send(message: string | NetworkMessage, netDst?: NetworkAddress): void {
    if (message instanceof NetworkMessage) {
      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        if (
          this.interfaces[keys[i]].hasNetAddress(
            message.netSrc as NetworkAddress
          )
        )
          this.interfaces[keys[i]].sendPacket(message);
      }
    } else {
      if (netDst === undefined) throw new Error('No destination specified');

      const netSrc = this.getInterface(0).getNetAddress();

      const msg = new NetworkMessage(message, netSrc, netDst);

      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        if (
          this.interfaces[keys[i]].hasNetAddress(msg.netSrc as NetworkAddress)
        )
          this.interfaces[keys[i]].sendPacket(msg);
      }
    }
  }

  public receivePacket(
    message: NetworkMessage,
    from: NetworkInterface
  ): ActionHandle {
    const dst = message.netDst as NetworkAddress;

    if (from && !from.hasNetAddress(dst)) {
      // RFC 791: Decrement TTL when forwarding IPv4 packets
      if (message instanceof IPv4Message) {
        // eslint-disable-next-line no-param-reassign, no-plusplus
        message.ttl--;

        // RFC 792: Send ICMP Time Exceeded if TTL reaches 0
        if (message.ttl <= 0) {
          const icmpReply = new ICMPMessage.Builder()
            .setType(ICMPType.TimeExceeded)
            .setCode(0) // TTL exceeded in transit
            .setNetSource(from.getNetAddress() as IPAddress)
            .setNetDestination(message.netSrc as IPAddress)
            .build()[0];

          from.sendPacket(icmpReply);
          return ActionHandle.Handled; // Drop the packet
        }
      }

      const route = this.getNextHop(dst);

      if (route != null) {
        const keys = Object.keys(this.interfaces);
        for (let i = 0; i < keys.length; i += 1) {
          const ifaceIp = this.interfaces[keys[i]].getNetAddress();
          const ifaceMask = this.interfaces[keys[i]].getNetMask();

          if (ifaceIp.InSameNetwork(ifaceMask, route)) {
            this.interfaces[keys[i]].sendPacket(message);
          }
        }
      }
    }

    // Propagate message to node's own listeners
    handleChain('receivePacket', this.getListener, message, from);

    // Trigger callback if defined
    if (this.onReceivePacket) {
      this.onReceivePacket(message);
    }

    return ActionHandle.Continue;
  }

  private findInterfaceWithAddress(
    address: NetworkAddress
  ): NetworkInterface | null {
    const keys = Object.keys(this.interfaces);
    for (let i = 0; i < keys.length; i += 1) {
      if (this.interfaces[keys[i]].hasNetAddress(address)) {
        return this.interfaces[keys[i]];
      }
    }
    return null;
  }

  public addRoute(
    network: NetworkAddress | string,
    mask: NetworkAddress | string,
    gateway: NetworkAddress | string
  ): void {
    let net = network;
    let msk = mask;
    let gtw = gateway;

    if (typeof net === 'string') net = new IPAddress(net);
    if (typeof msk === 'string') msk = new IPAddress(msk, true);
    if (typeof gtw === 'string') gtw = new IPAddress(gtw);

    for (let i = 0; i < this.routingTable.length; i += 1) {
      const route = this.routingTable[i];
      if (
        route.network.equals(net) &&
        route.mask.equals(msk) &&
        route.gateway.equals(gtw)
      )
        throw new Error('Route already exists');
    }
    this.routingTable.push({ network: net, mask: msk, gateway: gtw });
  }

  public deleteRoute(
    network: NetworkAddress | string,
    mask: NetworkAddress | string,
    gateway: NetworkAddress | string
  ): void {
    let net = network;
    let msk = mask;
    let gtw = gateway;

    if (typeof net === 'string') net = new IPAddress(net);
    if (typeof msk === 'string') msk = new IPAddress(msk, true);
    if (typeof gtw === 'string') gtw = new IPAddress(gtw);

    for (let i = 0; i < this.routingTable.length; i += 1) {
      if (
        this.routingTable[i].network.equals(net) &&
        this.routingTable[i].mask.equals(msk) &&
        this.routingTable[i].gateway.equals(gtw)
      ) {
        this.routingTable.splice(i, 1);
        return;
      }
    }
    throw new Error('Route not found');
  }

  public getNextHop(address: NetworkAddress): NetworkAddress | null {
    let bestRoute = null;
    let bestCidr = 0;

    for (let i = 0; i < this.routingTable.length; i += 1) {
      const route = this.routingTable[i];
      if (route.network.InSameNetwork(route.mask, address)) {
        if (bestRoute === null) {
          bestRoute = route.gateway;
          bestCidr = route.mask.CIDR;
        }

        if (route.mask.CIDR > bestCidr) {
          bestRoute = route.gateway;
          bestCidr = route.mask.CIDR;
        }
      }
    }

    const keys = Object.keys(this.interfaces);
    for (let i = 0; i < keys.length; i += 1) {
      if (
        this.interfaces[keys[i]]
          .getNetAddress()
          .InSameNetwork(this.interfaces[keys[i]].getNetMask(), address)
      ) {
        if (bestRoute === null) {
          bestRoute = address;
          bestCidr = this.interfaces[keys[i]].getNetMask().CIDR;
        }

        if (this.interfaces[keys[i]].getNetMask().CIDR > bestCidr) {
          bestRoute = address;
          bestCidr = this.interfaces[keys[i]].getNetMask().CIDR;
        }
      }
    }

    return bestRoute;
  }
}

import {
  type Address,
  IPAddress,
  MacAddress,
  type NetworkAddress,
} from '../address';
import { EthernetInterface, type Interface } from '../layers/datalink';
import { IPInterface, type NetworkInterface } from '../layers/network';
import { NetworkMessage } from '../message';
import { type GenericEventListener, handleChain } from '../protocols/base';

export abstract class GenericNode {
  public guid: string = Math.random().toString(36).substring(2, 9);

  public name: string = 'Node';

  public type: string = 'unknown';

  public x: number = 0;

  public y: number = 0;

  public toString(): string {
    return this.name;
  }

  public abstract clone(): GenericNode;

  /**
   * Returns properties to be cloned into new instance
   * Modern cloning pattern - returns data instead of mutating parameters
   */
  protected getCloneProperties() {
    return {
      guid: Math.random().toString(36).substring(2, 9),
      name: this.name,
      type: this.type,
      x: this.x,
      y: this.y,
    };
  }

  /**
   * Apply clone properties to target instance
   */
  protected applyCloneProperties(
    target: GenericNode,
    properties = this.getCloneProperties()
  ): void {
    Object.assign(target, properties);
  }

  // ---
  private listener: GenericEventListener[] = [];

  public addListener(listener: GenericEventListener): void {
    this.removeListener(listener);
    this.listener.push(listener);
  }

  public removeListener(listener: GenericEventListener): void {
    this.listener = this.listener.filter((l) => l !== listener);
  }

  get getListener(): GenericEventListener[] {
    return this.listener;
  }
}

export abstract class Node<T extends Interface> extends GenericNode {
  protected interfaces: Record<string, T> = {};

  public abstract addInterface(name: string): T;

  public getInterface(index: string | number): T {
    let response;
    if (typeof index === 'number')
      response = this.interfaces[Object.keys(this.interfaces)[index]];
    else if (typeof index === 'string') response = this.interfaces[index];

    if (!response)
      throw new Error(
        `Interface ${index} not found, available interfaces: ${Object.keys(this.interfaces)}`
      );

    return response;
  }

  public getInterfaces(): string[] {
    return Object.keys(this.interfaces);
  }

  public getFirstAvailableInterface(): T {
    const keys = Object.keys(this.interfaces);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!this.interfaces[key].isConnected) return this.interfaces[key];
    }

    throw new Error('No available interfaces');
  }

  /**
   * Clone interfaces into target node
   */
  protected cloneInterfaces(target: Node<T>): void {
    const keys = Object.keys(this.interfaces);
    for (let i = 0; i < keys.length; i += 1) {
      target.addInterface(keys[i]);
    }
  }

  public abstract send(message: string, dst?: Address): void;
}

export abstract class NetworkHost extends Node<NetworkInterface> {
  public addInterface(name: string = ''): NetworkInterface {
    let interfaceName = name;
    if (interfaceName === '')
      interfaceName = `gig0/${Object.keys(this.interfaces).length}`;

    const ip = IPAddress.generateAddress();
    const mac = MacAddress.generateAddress();

    const eth = new EthernetInterface(this, mac, interfaceName, 10, 1000, true);
    const iface = new IPInterface(this, interfaceName, eth);
    iface.addNetAddress(ip);
    iface.addListener(this);
    handleChain('on', this.getListener, 'OnInterfaceAdded', iface);

    this.interfaces[interfaceName] = iface;

    return iface;
  }

  public abstract override send(
    message: string | NetworkMessage,
    netDst?: NetworkAddress
  ): void;

  public abstract getNextHop(address: NetworkAddress): NetworkAddress | null;
}

export abstract class L4Host extends NetworkHost {
  public override name = 'Server';

  public override type = 'server';

  public gateway: NetworkAddress | null = null;

  constructor(name: string = '', type: string = 'server', iface: number = 0) {
    super();
    if (name !== '') this.name = name;
    if (type !== '') this.type = type;

    for (let i = 0; i < iface; i += 1) this.addInterface();
  }

  public send(message: string | NetworkMessage, netDst?: NetworkAddress): void {
    if (message instanceof NetworkMessage) {
      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        this.interfaces[keys[i]].sendPacket(message);
      }
    } else {
      if (netDst === undefined) throw new Error('No destination specified');

      const netSrc = this.getInterface(0).getNetAddress();

      const msg = new NetworkMessage(message, netSrc, netDst);

      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        this.interfaces[keys[i]].sendPacket(msg);
      }
    }
  }

  public getNextHop(address: NetworkAddress): NetworkAddress | null {
    const keys = Object.keys(this.interfaces);
    for (let i = 0; i < keys.length; i += 1) {
      const name = keys[i];
      if (
        this.interfaces[name]
          .getNetAddress()
          .InSameNetwork(this.interfaces[name].getNetMask(), address)
      )
        return address;
    }

    return this.gateway;
  }
}

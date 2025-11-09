import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage, type Payload } from '../message';
import { IPv4Message } from './ipv4';
import { ActionHandle, type NetworkListener } from './base';

// RFC 2453: RIP Version 2 Command Types
export enum RIPCommand {
  Request = 1, // Request for routing information
  Response = 2, // Response containing routing information
}

// RFC 2453: RIP uses UDP port 520
export const RIP_UDP_PORT = 520;

// RFC 2453: RIP v2 multicast address 224.0.0.9
export const RIP_MULTICAST_IP = new IPAddress('224.0.0.9');

// RFC 2453: Maximum metric value (16 = unreachable)
export const RIP_METRIC_INFINITY = 16;

// RFC 2453: Maximum number of routes per RIP message
export const RIP_MAX_ROUTES_PER_MESSAGE = 25;

/**
 * RFC 2453: RIP Route Entry
 * Each route entry contains network address, mask, next hop, and metric
 */
export class RIPRouteEntry {
  public addressFamily: number = 2; // Address Family Identifier (2 = IP)

  public routeTag: number = 0; // Route tag for external routes

  public network: IPAddress = new IPAddress('0.0.0.0');

  public mask: IPAddress = new IPAddress('0.0.0.0', true);

  public nextHop: IPAddress = new IPAddress('0.0.0.0');

  public metric: number = 1; // Hop count (1-16, 16 = unreachable)

  constructor(
    network?: IPAddress,
    mask?: IPAddress,
    nextHop?: IPAddress,
    metric?: number
  ) {
    if (network) this.network = network;
    if (mask) this.mask = mask;
    if (nextHop) this.nextHop = nextHop;
    if (metric !== undefined) this.metric = metric;
  }

  public toString(): string {
    return `${this.network.toString()}/${this.mask.CIDR} via ${this.nextHop.toString()} metric ${this.metric}`;
  }
}

/**
 * RFC 2453: RIP Version 2 Message
 * RIP is a distance-vector routing protocol using hop count as the metric
 */
export class RIPMessage extends IPv4Message {
  // RFC 2453: RIP version (2 for RIPv2)
  public version: number = 2;

  // RFC 2453: Command type (Request or Response)
  public command: RIPCommand = RIPCommand.Response;

  // RFC 2453: Must be zero
  public reserved: number = 0;

  // RFC 2453: Route entries (maximum 25 per message)
  public routes: RIPRouteEntry[] = [];

  protected constructor(
    payload: Payload | string,
    netSrc: IPAddress,
    netDst: IPAddress | null
  ) {
    super(payload, netSrc, netDst);
    // RFC 2453: RIP uses IP protocol number 17 (UDP)
    this.protocol = 17;
  }

  public override toString(): string {
    const commandName =
      this.command === RIPCommand.Request ? 'Request' : 'Response';
    const routeCount = this.routes.length;
    return `RIPv${this.version}\n${commandName} (${routeCount} routes)`;
  }

  public override checksum(): number {
    // RIP doesn't use a separate checksum, it relies on UDP/IP checksums
    return super.checksum();
  }

  public static override Builder = class extends IPv4Message.Builder {
    protected version: number = 2;

    protected command: RIPCommand = RIPCommand.Response;

    protected routes: RIPRouteEntry[] = [];

    public setVersion(version: number): this {
      if (version !== 1 && version !== 2) {
        throw new Error('RIP version must be 1 or 2');
      }
      this.version = version;
      return this;
    }

    public setCommand(command: RIPCommand): this {
      this.command = command;
      return this;
    }

    public addRoute(route: RIPRouteEntry): this {
      if (this.routes.length >= RIP_MAX_ROUTES_PER_MESSAGE) {
        throw new Error(
          `Cannot add more than ${RIP_MAX_ROUTES_PER_MESSAGE} routes to a single RIP message`
        );
      }
      this.routes.push(route);
      return this;
    }

    public addRoutes(routes: RIPRouteEntry[]): this {
      routes.forEach((route) => this.addRoute(route));
      return this;
    }

    public setRoutes(routes: RIPRouteEntry[]): this {
      this.routes = [];
      this.addRoutes(routes);
      return this;
    }

    public override build(): IPv4Message[] {
      if (this.netSrc === null) throw new Error('Source address is not set');
      if (this.netDst === null)
        throw new Error('Destination address is not set');

      // RFC 2453: If more than 25 routes, split into multiple messages
      const messages: IPv4Message[] = [];
      const chunks: RIPRouteEntry[][] = [];

      for (let i = 0; i < this.routes.length; i += RIP_MAX_ROUTES_PER_MESSAGE) {
        chunks.push(this.routes.slice(i, i + RIP_MAX_ROUTES_PER_MESSAGE));
      }

      // If no routes (e.g., Request), still create one message
      if (chunks.length === 0) {
        chunks.push([]);
      }

      chunks.forEach((chunk) => {
        const message = new RIPMessage(
          this.payload,
          this.netSrc!,
          this.netDst!
        );

        // Set RIP-specific fields
        message.version = this.version;
        message.command = this.command;
        message.reserved = 0;
        message.routes = chunk;

        // Set IPv4 fields
        message.ttl = this.ttl;
        message.protocol = 17; // UDP
        message.TOS = this.service;
        message.identification = this.id;

        // Calculate total length (IPv4 header + RIP header + routes)
        // RIP header: 4 bytes (command, version, reserved)
        // Each route entry: 20 bytes
        const ripHeaderLength = 4;
        const routeEntryLength = 20;
        const ripLength = ripHeaderLength + chunk.length * routeEntryLength;
        message.totalLength = 20 + ripLength; // 20 bytes IPv4 header + RIP message

        message.headerChecksum = message.checksum();

        messages.push(message);
      });

      return messages;
    }
  };
}

/**
 * RFC 2453: RIP Protocol Listener
 * Validates incoming RIP messages
 */
export class RIPProtocol implements NetworkListener {
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
    if (message instanceof RIPMessage) {
      // RFC 2453: Verify RIP version
      if (message.version !== 1 && message.version !== 2) {
        // Drop invalid version packets
        return ActionHandle.Stop;
      }

      // Check if this message is destined for RIP multicast address or this interface
      if (
        message.netDst &&
        !message.netDst.equals(RIP_MULTICAST_IP) &&
        !this.iface.hasNetAddress(message.netDst)
      ) {
        return ActionHandle.Continue;
      }

      // Message is valid RIP packet, continue processing in RIP service
      return ActionHandle.Continue;
    }

    return ActionHandle.Continue;
  }
}

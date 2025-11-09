/* eslint-disable no-param-reassign */
import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage } from '../message';
import { ActionHandle, type NetworkListener } from '../protocols/base';
import {
  BGPMessage,
  BGPOpenMessage,
  BGPUpdateMessage,
  BGPNotificationMessage,
  BGPMessageType,
  BGPState,
  BGP_DEFAULT_HOLD_TIME,
  BGP_DEFAULT_KEEPALIVE_TIME,
  BGP_DEFAULT_CONNECT_RETRY_TIME,
  BGPErrorCode,
  BGPNLRI,
  BGPPathAttribute,
} from '../protocols/bgp';
import { NetworkServices } from './dhcp';
import type { RouterHost } from '../nodes/router';

/**
 * BGP Neighbor Configuration and State
 * Represents a configured BGP peer relationship
 */
export class BGPNeighbor {
  // Configuration
  public neighborIP: IPAddress;

  public remoteAS: number;

  public description: string = '';

  // State
  public state: BGPState = BGPState.Idle;

  public remoteRouterID: IPAddress | null = null;

  public holdTime: number = BGP_DEFAULT_HOLD_TIME;

  public keepaliveTime: number = BGP_DEFAULT_KEEPALIVE_TIME;

  public connectRetryTime: number = BGP_DEFAULT_CONNECT_RETRY_TIME;

  // Timers
  public lastKeepalive: number = 0;

  public lastUpdate: number = 0;

  public connectRetryTimer: (() => void) | null = null;

  public holdTimer: (() => void) | null = null;

  public keepaliveTimer: (() => void) | null = null;

  // Statistics
  public messagesReceived: number = 0;

  public messagesSent: number = 0;

  public prefixesReceived: number = 0;

  public uptime: number = 0;

  public establishedTime: number = 0;

  constructor(neighborIP: IPAddress, remoteAS: number, description?: string) {
    this.neighborIP = neighborIP;
    this.remoteAS = remoteAS;
    if (description) this.description = description;
  }

  public toString(): string {
    return `${this.neighborIP.toString()} (AS ${this.remoteAS}) - ${BGPState[this.state]}`;
  }
}

/**
 * BGP Route Entry
 * Stores routing information learned via BGP protocol
 */
export class BGPRoute {
  public network: IPAddress;

  public prefixLength: number;

  public nextHop: IPAddress;

  public asPath: number[] = [];

  public localPref: number = 100;

  public origin: number = 0; // 0=IGP, 1=EGP, 2=Incomplete

  public med: number = 0; // Multi-Exit Discriminator

  public fromNeighbor: IPAddress;

  public lastUpdate: number = 0;

  constructor(
    network: IPAddress,
    prefixLength: number,
    nextHop: IPAddress,
    fromNeighbor: IPAddress
  ) {
    this.network = network;
    this.prefixLength = prefixLength;
    this.nextHop = nextHop;
    this.fromNeighbor = fromNeighbor;
    this.lastUpdate = Scheduler.getInstance().getDeltaTime();
  }

  public toString(): string {
    return `${this.network.toString()}/${this.prefixLength} via ${this.nextHop.toString()}`;
  }

  public getRouteKey(): string {
    return `${this.network.toString()}/${this.prefixLength}`;
  }
}

/**
 * BGPService - Border Gateway Protocol Service
 * Implements RFC 4271 (BGPv4) for inter-domain routing
 *
 * BGP is a path-vector routing protocol that exchanges routing information between autonomous systems.
 * Simplified implementation for educational purposes (Packet Tracer style):
 * - Basic neighbor establishment (OPEN, KEEPALIVE)
 * - Route advertisement (UPDATE messages)
 * - Simple path selection
 * - Hold timer and Keepalive mechanism
 */
export class BGPService
  extends NetworkServices<RouterHost>
  implements NetworkListener
{
  // Local AS configuration
  public localAS: number = 65000;

  public routerID: IPAddress = new IPAddress('0.0.0.0');

  // BGP neighbors
  private neighbors = new Map<string, BGPNeighbor>();

  // BGP routing table (separate from main routing table)
  private bgpRoutes = new Map<string, BGPRoute>();

  // Configuration
  public holdTime: number = BGP_DEFAULT_HOLD_TIME;

  public keepaliveTime: number = BGP_DEFAULT_KEEPALIVE_TIME;

  // Timers
  private maintenanceTimer: (() => void) | null = null;

  constructor(
    host: RouterHost,
    localAS: number = 65000,
    enabled: boolean = false
  ) {
    super(host);
    this.localAS = localAS;
    this.Enable = enabled;

    // Set router ID to highest interface IP
    this.updateRouterID();
  }

  /**
   * Update router ID based on interfaces
   * Uses highest IP address on any interface
   */
  private updateRouterID(): void {
    let highestIP = new IPAddress('0.0.0.0');

    this.host.getInterfaces().forEach((ifaceName) => {
      const iface = this.host.getInterface(ifaceName);
      const ip = iface.getNetAddress() as IPAddress;
      if (ip && ip.toNumber() > highestIP.toNumber()) {
        highestIP = ip;
      }
    });

    this.routerID = highestIP;
  }

  /**
   * Add a BGP neighbor
   */
  public addNeighbor(
    neighborIP: IPAddress,
    remoteAS: number,
    description?: string
  ): void {
    const key = neighborIP.toString();
    if (!this.neighbors.has(key)) {
      const neighbor = new BGPNeighbor(neighborIP, remoteAS, description);
      this.neighbors.set(key, neighbor);

      // If service is enabled, try to establish connection
      if (this.enabled) {
        this.initiateConnection(neighbor);
      }
    }
  }

  /**
   * Remove a BGP neighbor
   */
  public removeNeighbor(neighborIP: IPAddress): void {
    const key = neighborIP.toString();
    const neighbor = this.neighbors.get(key);
    if (neighbor) {
      this.resetNeighbor(neighbor);
      this.neighbors.delete(key);

      // Remove routes learned from this neighbor
      const routesToRemove: string[] = [];
      this.bgpRoutes.forEach((route, routeKey) => {
        if (route.fromNeighbor.equals(neighborIP)) {
          routesToRemove.push(routeKey);
          // Remove from main routing table
          try {
            const mask = new IPAddress(`255.255.255.255`).getNetworkIP(
              new IPAddress(`255.255.255.255`, true).fromCIDR(route.prefixLength)
            ) as IPAddress;
            this.host.deleteRoute(route.network, mask, route.nextHop);
          } catch {
            // Route might not be in main table
          }
        }
      });
      routesToRemove.forEach((key) => this.bgpRoutes.delete(key));
    }
  }

  /**
   * Get all BGP neighbors
   */
  public getNeighbors(): BGPNeighbor[] {
    return Array.from(this.neighbors.values());
  }

  /**
   * Get neighbor by IP
   */
  public getNeighbor(neighborIP: IPAddress): BGPNeighbor | undefined {
    return this.neighbors.get(neighborIP.toString());
  }

  /**
   * Get all BGP routes
   */
  public getRoutes(): BGPRoute[] {
    return Array.from(this.bgpRoutes.values());
  }

  /**
   * Clear all BGP routes
   */
  public clearRoutes(): void {
    this.bgpRoutes.clear();
  }

  /**
   * Enable/disable the BGP service
   */
  public override get Enable(): boolean {
    return this.enabled;
  }

  public override set Enable(enable: boolean) {
    super.Enable = enable;

    if (enable) {
      this.updateRouterID();
      this.startMaintenanceTimer();

      // Try to establish all configured neighbors
      this.neighbors.forEach((neighbor) => {
        this.initiateConnection(neighbor);
      });
    } else {
      this.stopTimers();

      // Reset all neighbors
      this.neighbors.forEach((neighbor) => {
        this.resetNeighbor(neighbor);
      });

      // Clear routing table
      this.clearRoutes();
    }
  }

  /**
   * Start maintenance timer for keepalive and hold timer checks
   */
  private startMaintenanceTimer(): void {
    if (this.maintenanceTimer) {
      this.maintenanceTimer();
    }

    // Check every second for timer expiration
    const subscription = Scheduler.getInstance()
      .repeat(1)
      .subscribe(() => {
        this.checkTimers();
      });

    this.maintenanceTimer = () => subscription.unsubscribe();
  }

  /**
   * Stop all timers
   */
  private stopTimers(): void {
    if (this.maintenanceTimer) {
      this.maintenanceTimer();
      this.maintenanceTimer = null;
    }
  }

  /**
   * Check keepalive and hold timers for all neighbors
   */
  private checkTimers(): void {
    if (!this.enabled) return;

    const currentTime = Scheduler.getInstance().getDeltaTime();

    this.neighbors.forEach((neighbor) => {
      if (neighbor.state === BGPState.Established) {
        // Check if we need to send keepalive
        const timeSinceKeepalive =
          (currentTime - neighbor.lastKeepalive) /
          Scheduler.getInstance().getDelay(1);
        if (timeSinceKeepalive >= neighbor.keepaliveTime) {
          this.sendKeepalive(neighbor);
        }

        // Check hold timer
        const timeSinceUpdate =
          (currentTime - neighbor.lastUpdate) /
          Scheduler.getInstance().getDelay(1);
        if (timeSinceUpdate >= neighbor.holdTime) {
          // Hold timer expired, close connection
          this.sendNotification(neighbor, BGPErrorCode.HoldTimerExpired, 0);
          this.resetNeighbor(neighbor);
        }
      }
    });
  }

  /**
   * Initiate BGP connection to neighbor (simplified)
   */
  private initiateConnection(neighbor: BGPNeighbor): void {
    if (neighbor.state !== BGPState.Idle) return;

    neighbor.state = BGPState.Connect;
    neighbor.lastUpdate = Scheduler.getInstance().getDeltaTime();

    // Simplified: Move directly to OpenSent and send OPEN message
    // In real BGP, TCP connection establishment happens first
    Scheduler.getInstance()
      .delay(0.1)
      .subscribe(() => {
        if (neighbor.state === BGPState.Connect) {
          this.sendOpen(neighbor);
          neighbor.state = BGPState.OpenSent;
        }
      });
  }

  /**
   * Reset neighbor to Idle state
   */
  private resetNeighbor(neighbor: BGPNeighbor): void {
    // Stop all timers
    if (neighbor.connectRetryTimer) {
      neighbor.connectRetryTimer();
      neighbor.connectRetryTimer = null;
    }
    if (neighbor.holdTimer) {
      neighbor.holdTimer();
      neighbor.holdTimer = null;
    }
    if (neighbor.keepaliveTimer) {
      neighbor.keepaliveTimer();
      neighbor.keepaliveTimer = null;
    }

    neighbor.state = BGPState.Idle;
    neighbor.remoteRouterID = null;
  }

  /**
   * Send BGP OPEN message
   */
  private sendOpen(neighbor: BGPNeighbor): void {
    // Find interface to reach neighbor
    const iface = this.findInterfaceForNeighbor(neighbor.neighborIP);
    if (!iface) return;

    const srcIP = iface.getNetAddress() as IPAddress;
    const message = new BGPOpenMessage.Builder()
      .setNetSource(srcIP)
      .setNetDestination(neighbor.neighborIP)
      .setMyAutonomousSystem(this.localAS)
      .setHoldTime(this.holdTime)
      .setBGPIdentifier(this.routerID)
      .build()[0];

    iface.sendPacket(message);
    neighbor.messagesSent += 1;
    neighbor.lastUpdate = Scheduler.getInstance().getDeltaTime();
  }

  /**
   * Send BGP KEEPALIVE message
   */
  private sendKeepalive(neighbor: BGPNeighbor): void {
    const iface = this.findInterfaceForNeighbor(neighbor.neighborIP);
    if (!iface) return;

    const srcIP = iface.getNetAddress() as IPAddress;
    const message = new BGPMessage.Builder()
      .setNetSource(srcIP)
      .setNetDestination(neighbor.neighborIP)
      .setBGPType(BGPMessageType.Keepalive)
      .build()[0];

    iface.sendPacket(message);
    neighbor.messagesSent += 1;
    neighbor.lastKeepalive = Scheduler.getInstance().getDeltaTime();
  }

  /**
   * Send BGP NOTIFICATION message
   */
  private sendNotification(
    neighbor: BGPNeighbor,
    errorCode: BGPErrorCode,
    errorSubcode: number
  ): void {
    const iface = this.findInterfaceForNeighbor(neighbor.neighborIP);
    if (!iface) return;

    const srcIP = iface.getNetAddress() as IPAddress;
    const message = new BGPNotificationMessage.Builder()
      .setNetSource(srcIP)
      .setNetDestination(neighbor.neighborIP)
      .setErrorCode(errorCode)
      .setErrorSubcode(errorSubcode)
      .build()[0];

    iface.sendPacket(message);
    neighbor.messagesSent += 1;
  }

  /**
   * Send BGP UPDATE message with routes
   */
  private sendUpdate(neighbor: BGPNeighbor, routes: BGPNLRI[]): void {
    if (neighbor.state !== BGPState.Established) return;

    const iface = this.findInterfaceForNeighbor(neighbor.neighborIP);
    if (!iface) return;

    const srcIP = iface.getNetAddress() as IPAddress;

    // Build path attributes (simplified: just AS_PATH and NEXT_HOP)
    const pathAttrs: BGPPathAttribute[] = [];

    // AS_PATH attribute (simplified representation)
    pathAttrs.push(new BGPPathAttribute(0x40, 2, [this.localAS]));

    // NEXT_HOP attribute (this router's IP)
    pathAttrs.push(new BGPPathAttribute(0x40, 3, []));

    const message = new BGPUpdateMessage.Builder()
      .setNetSource(srcIP)
      .setNetDestination(neighbor.neighborIP)
      .setNLRI(routes)
      .setPathAttributes(pathAttrs)
      .build()[0];

    iface.sendPacket(message);
    neighbor.messagesSent += 1;
  }

  /**
   * Find interface to reach a neighbor
   */
  private findInterfaceForNeighbor(
    neighborIP: IPAddress
  ): NetworkInterface | null {
    // Check all interfaces to find one in the same subnet as neighbor
    for (const ifaceName of this.host.getInterfaces()) {
      const iface = this.host.getInterface(ifaceName);
      const ifaceIP = iface.getNetAddress() as IPAddress;
      const ifaceMask = iface.getNetMask() as IPAddress;

      if (ifaceIP && ifaceMask) {
        const ifaceNetwork = ifaceIP.getNetworkIP(ifaceMask);
        const neighborNetwork = neighborIP.getNetworkIP(ifaceMask);

        if (ifaceNetwork?.equals(neighborNetwork)) {
          return iface;
        }
      }
    }

    return null;
  }

  /**
   * Process received BGP messages
   */
  public receivePacket(
    message: NetworkMessage,
    from: NetworkInterface
  ): ActionHandle {
    if (!(message instanceof BGPMessage)) {
      return ActionHandle.Continue;
    }

    if (!this.enabled) {
      return ActionHandle.Continue;
    }

    const senderIP = message.netSrc as IPAddress;
    const neighbor = this.getNeighbor(senderIP);

    if (!neighbor) {
      // Received message from non-configured neighbor, ignore
      return ActionHandle.Handled;
    }

    neighbor.messagesReceived += 1;
    neighbor.lastUpdate = Scheduler.getInstance().getDeltaTime();

    // Process based on message type
    if (message instanceof BGPOpenMessage) {
      this.processOpen(message, neighbor);
    } else if (message instanceof BGPUpdateMessage) {
      this.processUpdate(message, neighbor);
    } else if (message.type === BGPMessageType.Keepalive) {
      this.processKeepalive(neighbor);
    } else if (message instanceof BGPNotificationMessage) {
      this.processNotification(message, neighbor);
    }

    return ActionHandle.Handled;
  }

  /**
   * Process BGP OPEN message
   */
  private processOpen(message: BGPOpenMessage, neighbor: BGPNeighbor): void {
    // Verify AS number
    if (message.myAutonomousSystem !== neighbor.remoteAS) {
      this.sendNotification(neighbor, BGPErrorCode.OpenMessageError, 2); // Bad Peer AS
      this.resetNeighbor(neighbor);
      return;
    }

    // Store remote router ID
    neighbor.remoteRouterID = message.bgpIdentifier;

    // Negotiate hold time (use minimum)
    neighbor.holdTime = Math.min(this.holdTime, message.holdTime);
    neighbor.keepaliveTime = Math.floor(neighbor.holdTime / 3);

    if (neighbor.state === BGPState.OpenSent) {
      // Send KEEPALIVE to confirm
      this.sendKeepalive(neighbor);
      neighbor.state = BGPState.OpenConfirm;
    } else if (neighbor.state === BGPState.OpenConfirm) {
      // Should not happen in normal flow, but handle it
      this.sendKeepalive(neighbor);
    }
  }

  /**
   * Process BGP KEEPALIVE message
   */
  private processKeepalive(neighbor: BGPNeighbor): void {
    if (neighbor.state === BGPState.OpenConfirm) {
      // Move to Established
      neighbor.state = BGPState.Established;
      neighbor.establishedTime = Scheduler.getInstance().getDeltaTime();
      neighbor.lastKeepalive = neighbor.establishedTime;

      // Advertise our local routes
      this.advertiseRoutes(neighbor);
    } else if (neighbor.state === BGPState.Established) {
      // Just update last update time (already done in receivePacket)
    }
  }

  /**
   * Process BGP UPDATE message
   */
  private processUpdate(message: BGPUpdateMessage, neighbor: BGPNeighbor): void {
    if (neighbor.state !== BGPState.Established) {
      return;
    }

    // Process withdrawn routes
    message.withdrawnRoutes.forEach((nlri) => {
      const key = `${nlri.prefix.toString()}/${nlri.prefixLength}`;
      const route = this.bgpRoutes.get(key);
      if (route && route.fromNeighbor.equals(neighbor.neighborIP)) {
        this.bgpRoutes.delete(key);
        neighbor.prefixesReceived -= 1;

        // Remove from main routing table
        try {
          const mask = new IPAddress(`255.255.255.255`).getNetworkIP(
            new IPAddress(`255.255.255.255`, true).fromCIDR(nlri.prefixLength)
          ) as IPAddress;
          this.host.deleteRoute(route.network, mask, route.nextHop);
        } catch {
          // Route might not be in main table
        }
      }
    });

    // Process advertised routes
    message.nlri.forEach((nlri) => {
      const key = `${nlri.prefix.toString()}/${nlri.prefixLength}`;

      // Create BGP route
      const route = new BGPRoute(
        nlri.prefix,
        nlri.prefixLength,
        neighbor.neighborIP, // Use neighbor as next hop
        neighbor.neighborIP
      );

      // Simple path selection: just accept the route
      this.bgpRoutes.set(key, route);
      neighbor.prefixesReceived += 1;

      // Add to main routing table
      try {
        const mask = new IPAddress(`255.255.255.255`).getNetworkIP(
          new IPAddress(`255.255.255.255`, true).fromCIDR(nlri.prefixLength)
        ) as IPAddress;
        this.host.addRoute(route.network, mask, route.nextHop);
      } catch {
        // Route might already exist
      }
    });
  }

  /**
   * Process BGP NOTIFICATION message
   */
  private processNotification(
    _message: BGPNotificationMessage,
    neighbor: BGPNeighbor
  ): void {
    // Peer is closing connection, reset neighbor
    this.resetNeighbor(neighbor);
  }

  /**
   * Advertise local routes to established neighbor
   */
  private advertiseRoutes(neighbor: BGPNeighbor): void {
    const routes: BGPNLRI[] = [];

    // Advertise directly connected networks
    this.host.getInterfaces().forEach((ifaceName) => {
      const iface = this.host.getInterface(ifaceName);
      const ip = iface.getNetAddress() as IPAddress;
      const mask = iface.getNetMask() as IPAddress;

      if (ip && mask) {
        const network = ip.getNetworkIP(mask) as IPAddress;
        routes.push(new BGPNLRI(network, mask.CIDR));
      }
    });

    if (routes.length > 0) {
      this.sendUpdate(neighbor, routes);
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopTimers();

    // Reset all neighbors
    this.neighbors.forEach((neighbor) => {
      this.sendNotification(neighbor, BGPErrorCode.Cease, 0);
      this.resetNeighbor(neighbor);
    });

    this.clearRoutes();
  }
}

/* eslint-disable no-param-reassign */
import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage } from '../message';
import { ActionHandle, type NetworkListener } from '../protocols/base';
import {
  RIPMessage,
  RIPCommand,
  RIP_MULTICAST_IP,
  RIP_METRIC_INFINITY,
  RIPRouteEntry,
} from '../protocols/rip';
import { NetworkServices } from './dhcp';
import type { RouterHost } from '../nodes/router';

/**
 * RIP Route Table Entry
 * Stores routing information learned via RIP protocol
 */
export class RIPRoute {
  public network: IPAddress;

  public mask: IPAddress;

  public nextHop: IPAddress;

  public metric: number;

  public interface: NetworkInterface;

  // Timers (in seconds since last update)
  public lastUpdate: number = 0;

  public invalidTimer: number = 0;

  public flushTimer: number = 0;

  // Route tag for external routes
  public routeTag: number = 0;

  // Changed flag for triggered updates
  public changed: boolean = false;

  constructor(
    network: IPAddress,
    mask: IPAddress,
    nextHop: IPAddress,
    metric: number,
    iface: NetworkInterface
  ) {
    this.network = network;
    this.mask = mask;
    this.nextHop = nextHop;
    this.metric = metric;
    this.interface = iface;
    this.lastUpdate = Scheduler.getInstance().getDeltaTime();
  }

  public toString(): string {
    return `${this.network.toString()}/${this.mask.CIDR} via ${this.nextHop.toString()} metric ${this.metric}`;
  }
}

/**
 * RIPService - Routing Information Protocol Service
 * Implements RFC 2453 (RIPv2) for dynamic routing
 *
 * RIP is a distance-vector routing protocol that uses hop count as the metric.
 * Features:
 * - Periodic updates (default: 30 seconds)
 * - Triggered updates on route changes
 * - Split horizon with poison reverse
 * - Invalid timer (default: 180 seconds)
 * - Flush timer (default: 240 seconds)
 */
export class RIPService
  extends NetworkServices<RouterHost>
  implements NetworkListener
{
  // RIP routing table (separate from static routing table)
  private ripRoutes = new Map<string, RIPRoute>();

  // Interfaces where RIP is enabled
  private enabledInterfaces = new Set<string>();

  // Timers
  private updateTimer: (() => void) | null = null;

  private maintenanceTimer: (() => void) | null = null;

  // RFC 2453: Default timers (in seconds)
  public updateInterval: number = 30; // Send updates every 30 seconds

  public invalidAfter: number = 180; // Route becomes invalid after 180 seconds

  public flushAfter: number = 240; // Remove route after 240 seconds

  // Configuration
  public splitHorizon: boolean = true; // Enable split horizon

  public poisonReverse: boolean = true; // Enable poison reverse

  public defaultMetric: number = 1; // Default metric for redistributed routes

  constructor(host: RouterHost, enabled: boolean = false) {
    super(host);
    this.Enable = enabled;
  }

  /**
   * Enable RIP on a specific interface
   */
  public enableOnInterface(iface: NetworkInterface): void {
    const ifaceName = iface.toString();
    this.enabledInterfaces.add(ifaceName);

    // Send request to neighbors when first enabled
    if (this.enabled) {
      this.sendRequest(iface);
    }
  }

  /**
   * Disable RIP on a specific interface
   */
  public disableOnInterface(iface: NetworkInterface): void {
    const ifaceName = iface.toString();
    this.enabledInterfaces.delete(ifaceName);
  }

  /**
   * Check if RIP is enabled on an interface
   */
  public isEnabledOnInterface(iface: NetworkInterface): boolean {
    return this.enabledInterfaces.has(iface.toString());
  }

  /**
   * Get all enabled interfaces
   */
  public getEnabledInterfaces(): string[] {
    return Array.from(this.enabledInterfaces);
  }

  /**
   * Get all RIP routes
   */
  public getRoutes(): RIPRoute[] {
    return Array.from(this.ripRoutes.values());
  }

  /**
   * Get RIP routes for a specific interface
   */
  public getRoutesForInterface(iface: NetworkInterface): RIPRoute[] {
    return this.getRoutes().filter((route) => route.interface === iface);
  }

  /**
   * Clear all RIP routes
   */
  public clearRoutes(): void {
    this.ripRoutes.clear();
  }

  /**
   * Enable/disable the RIP service
   */
  public override get Enable(): boolean {
    return this.enabled;
  }

  public override set Enable(enable: boolean) {
    super.Enable = enable;

    if (enable) {
      // Start update and maintenance timers
      this.startUpdateTimer();
      this.startMaintenanceTimer();

      // Send requests on all enabled interfaces
      this.host.getInterfaces().forEach((ifaceName) => {
        const iface = this.host.getInterface(ifaceName);
        if (this.isEnabledOnInterface(iface)) {
          this.sendRequest(iface);
        }
      });
    } else {
      // Stop timers
      this.stopTimers();

      // Clear routing table
      this.clearRoutes();
    }
  }

  /**
   * RFC 2453: Start periodic update timer
   */
  private startUpdateTimer(): void {
    if (this.updateTimer) {
      this.updateTimer();
    }

    const subscription = Scheduler.getInstance()
      .repeat(this.updateInterval)
      .subscribe(() => {
        this.sendPeriodicUpdates();
      });

    this.updateTimer = () => subscription.unsubscribe();
  }

  /**
   * RFC 2453: Start maintenance timer for route expiration
   */
  private startMaintenanceTimer(): void {
    if (this.maintenanceTimer) {
      this.maintenanceTimer();
    }

    // Check every second for expired routes
    const subscription = Scheduler.getInstance()
      .repeat(1)
      .subscribe(() => {
        this.checkRouteExpiration();
      });

    this.maintenanceTimer = () => subscription.unsubscribe();
  }

  /**
   * Stop all timers
   */
  private stopTimers(): void {
    if (this.updateTimer) {
      this.updateTimer();
      this.updateTimer = null;
    }

    if (this.maintenanceTimer) {
      this.maintenanceTimer();
      this.maintenanceTimer = null;
    }
  }

  /**
   * RFC 2453: Send RIP request message to discover routes
   */
  private sendRequest(iface: NetworkInterface): void {
    if (!this.enabled || !this.isEnabledOnInterface(iface)) return;

    const request = new RIPMessage.Builder()
      .setCommand(RIPCommand.Request)
      .setNetSource(iface.getNetAddress() as IPAddress)
      .setNetDestination(RIP_MULTICAST_IP)
      .build()[0];

    iface.sendPacket(request);
  }

  /**
   * RFC 2453: Send periodic updates to all neighbors
   */
  private sendPeriodicUpdates(): void {
    if (!this.enabled) return;

    this.host.getInterfaces().forEach((ifaceName) => {
      const iface = this.host.getInterface(ifaceName);
      if (this.isEnabledOnInterface(iface)) {
        this.sendUpdate(iface, false);
      }
    });
  }

  /**
   * RFC 2453: Send RIP update (response) message
   * @param iface Interface to send update on
   * @param triggered Whether this is a triggered update
   */
  private sendUpdate(
    iface: NetworkInterface,
    triggered: boolean = false
  ): void {
    if (!this.enabled || !this.isEnabledOnInterface(iface)) return;

    const routes: RIPRouteEntry[] = [];

    // Add directly connected networks
    this.host.getInterfaces().forEach((ifaceName) => {
      const connectedIface = this.host.getInterface(ifaceName);
      const netAddr = connectedIface.getNetAddress() as IPAddress;
      const mask = connectedIface.getNetMask() as IPAddress;
      const network = netAddr.getNetworkIP(mask);

      // RFC 2453: Split horizon - don't advertise routes back out the interface they came from
      if (this.splitHorizon && connectedIface === iface) {
        if (this.poisonReverse) {
          // Advertise with metric 16 (unreachable)
          routes.push(
            new RIPRouteEntry(
              network as IPAddress,
              mask as IPAddress,
              new IPAddress('0.0.0.0'),
              RIP_METRIC_INFINITY
            )
          );
        }
        // Otherwise, don't advertise at all (simple split horizon)
      } else {
        routes.push(
          new RIPRouteEntry(
            network as IPAddress,
            mask as IPAddress,
            new IPAddress('0.0.0.0'),
            this.defaultMetric
          )
        );
      }
    });

    // Add learned RIP routes
    this.getRoutes().forEach((ripRoute) => {
      // Skip invalid routes in periodic updates (but include in triggered)
      if (!triggered && ripRoute.metric >= RIP_METRIC_INFINITY) {
        return;
      }

      // RFC 2453: Split horizon with poison reverse
      if (this.splitHorizon && ripRoute.interface === iface) {
        if (this.poisonReverse) {
          // Advertise with metric 16 (unreachable)
          routes.push(
            new RIPRouteEntry(
              ripRoute.network,
              ripRoute.mask,
              new IPAddress('0.0.0.0'),
              RIP_METRIC_INFINITY
            )
          );
        }
        // Otherwise, don't advertise (simple split horizon)
      } else {
        // RFC 2453: Increment metric by 1 when advertising
        const metric = Math.min(ripRoute.metric + 1, RIP_METRIC_INFINITY);
        routes.push(
          new RIPRouteEntry(
            ripRoute.network,
            ripRoute.mask,
            new IPAddress('0.0.0.0'),
            metric
          )
        );
      }
    });

    // If triggered update, only send changed routes
    const routesToSend = triggered
      ? routes.filter((route) => {
          const key = RIPService.getRouteKey(route.network, route.mask);
          const ripRoute = this.ripRoutes.get(key);
          return ripRoute?.changed;
        })
      : routes;

    if (routesToSend.length === 0 && triggered) return;

    // RFC 2453: Build and send RIP response messages
    const messages = new RIPMessage.Builder()
      .setCommand(RIPCommand.Response)
      .setNetSource(iface.getNetAddress() as IPAddress)
      .setNetDestination(RIP_MULTICAST_IP)
      .setRoutes(routesToSend)
      .build();

    messages.forEach((message) => {
      iface.sendPacket(message);
    });

    // Clear changed flags after triggered update
    if (triggered) {
      this.getRoutes().forEach((route) => {
        route.changed = false;
      });
    }
  }

  /**
   * RFC 2453: Check for expired routes
   */
  private checkRouteExpiration(): void {
    if (!this.enabled) return;

    const currentTime = Scheduler.getInstance().getDeltaTime();
    const routesToRemove: string[] = [];
    let hasChanges = false;

    this.ripRoutes.forEach((route, key) => {
      const timeSinceUpdate =
        (currentTime - route.lastUpdate) / Scheduler.getInstance().getDelay(1);

      // RFC 2453: Invalid timer - mark route as unreachable after invalidAfter seconds
      if (
        timeSinceUpdate > this.invalidAfter &&
        route.metric < RIP_METRIC_INFINITY
      ) {
        route.metric = RIP_METRIC_INFINITY;
        route.changed = true;
        hasChanges = true;

        // Also remove from static routing table
        try {
          this.host.deleteRoute(route.network, route.mask, route.nextHop);
        } catch {
          // Route might not be in static table
        }
      }

      // RFC 2453: Flush timer - remove route after flushAfter seconds
      if (timeSinceUpdate > this.flushAfter) {
        routesToRemove.push(key);
      }
    });

    // Remove flushed routes
    routesToRemove.forEach((key) => {
      this.ripRoutes.delete(key);
    });

    // RFC 2453: Triggered update on route changes
    if (hasChanges) {
      this.sendTriggeredUpdates();
    }
  }

  /**
   * RFC 2453: Send triggered updates when routes change
   */
  private sendTriggeredUpdates(): void {
    this.host.getInterfaces().forEach((ifaceName) => {
      const iface = this.host.getInterface(ifaceName);
      if (this.isEnabledOnInterface(iface)) {
        this.sendUpdate(iface, true);
      }
    });
  }

  /**
   * Generate unique key for a route
   */
  private static getRouteKey(network: IPAddress, mask: IPAddress): string {
    return `${network.toString()}/${mask.CIDR}`;
  }

  /**
   * Process received RIP messages
   */
  public receivePacket(
    message: NetworkMessage,
    from: NetworkInterface
  ): ActionHandle {
    if (!(message instanceof RIPMessage)) {
      return ActionHandle.Continue;
    }

    if (!this.enabled || !this.isEnabledOnInterface(from)) {
      return ActionHandle.Continue;
    }

    // RFC 2453: Process based on command type
    if (message.command === RIPCommand.Request) {
      this.processRequest(message, from);
    } else if (message.command === RIPCommand.Response) {
      this.processResponse(message, from);
    }

    return ActionHandle.Handled;
  }

  /**
   * RFC 2453: Process RIP request message
   */
  private processRequest(_message: RIPMessage, from: NetworkInterface): void {
    // RFC 2453: Send full routing table in response to request
    this.sendUpdate(from, false);
  }

  /**
   * RFC 2453: Process RIP response message
   */
  private processResponse(message: RIPMessage, from: NetworkInterface): void {
    const senderIP = message.netSrc as IPAddress;
    const currentTime = Scheduler.getInstance().getDeltaTime();
    let hasChanges = false;

    message.routes.forEach((routeEntry) => {
      // Skip invalid routes
      if (
        routeEntry.metric >= RIP_METRIC_INFINITY &&
        routeEntry.metric !== RIP_METRIC_INFINITY
      ) {
        return;
      }

      // Skip default route or invalid entries
      if (
        routeEntry.network.toString() === '0.0.0.0' &&
        routeEntry.mask.toString() === '0.0.0.0'
      ) {
        return;
      }

      const key = RIPService.getRouteKey(routeEntry.network, routeEntry.mask);
      const existingRoute = this.ripRoutes.get(key);

      // RFC 2453: Increment metric by 1 (cost of this link)
      const newMetric = Math.min(routeEntry.metric + 1, RIP_METRIC_INFINITY);

      if (!existingRoute) {
        // New route
        if (newMetric < RIP_METRIC_INFINITY) {
          const ripRoute = new RIPRoute(
            routeEntry.network,
            routeEntry.mask,
            senderIP,
            newMetric,
            from
          );
          ripRoute.routeTag = routeEntry.routeTag;
          this.ripRoutes.set(key, ripRoute);

          // Add to static routing table
          try {
            this.host.addRoute(routeEntry.network, routeEntry.mask, senderIP);
          } catch {
            // Route might already exist
          }

          hasChanges = true;
          ripRoute.changed = true;
        }
      } else {
        // Existing route
        const isSameSource = existingRoute.nextHop.equals(senderIP);

        // RFC 2453: Always update if from same source
        if (isSameSource) {
          if (existingRoute.metric !== newMetric) {
            // Update static routing table if metric changed to/from infinity
            if (newMetric >= RIP_METRIC_INFINITY) {
              try {
                this.host.deleteRoute(
                  routeEntry.network,
                  routeEntry.mask,
                  senderIP
                );
              } catch {
                // Route might not exist
              }
            } else if (existingRoute.metric >= RIP_METRIC_INFINITY) {
              try {
                this.host.addRoute(
                  routeEntry.network,
                  routeEntry.mask,
                  senderIP
                );
              } catch {
                // Route might already exist
              }
            }

            existingRoute.metric = newMetric;
            hasChanges = true;
            existingRoute.changed = true;
          }
          existingRoute.lastUpdate = currentTime;
        } else if (newMetric < existingRoute.metric) {
          // RFC 2453: Update if better metric from different source
          // Remove old route from static table
          try {
            this.host.deleteRoute(
              routeEntry.network,
              routeEntry.mask,
              existingRoute.nextHop
            );
          } catch {
            // Route might not exist
          }

          // Update route
          existingRoute.nextHop = senderIP;
          existingRoute.metric = newMetric;
          existingRoute.interface = from;
          existingRoute.lastUpdate = currentTime;
          existingRoute.routeTag = routeEntry.routeTag;

          // Add new route to static table
          if (newMetric < RIP_METRIC_INFINITY) {
            try {
              this.host.addRoute(routeEntry.network, routeEntry.mask, senderIP);
            } catch {
              // Route might already exist
            }
          }

          hasChanges = true;
          existingRoute.changed = true;
        }
      }
    });

    // RFC 2453: Send triggered update if routes changed
    if (hasChanges) {
      this.sendTriggeredUpdates();
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopTimers();
    this.clearRoutes();
  }
}

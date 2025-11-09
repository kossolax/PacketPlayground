/* eslint-disable no-param-reassign */
import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress, type NetworkAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage } from '../message';
import { ActionHandle, type NetworkListener } from '../protocols/base';
import {
  OSPFHelloMessage,
  OSPFMessage,
  OSPFPacketType,
  OSPFState,
  OSPF_ALL_ROUTERS,
  OSPF_DEFAULT_HELLO_INTERVAL,
  OSPF_DEFAULT_DEAD_INTERVAL,
  OSPF_DEFAULT_PRIORITY,
  OSPFDatabaseDescriptionMessage,
} from '../protocols/ospf';
import { NetworkServices } from './dhcp';
import type { RouterHost } from '../nodes/router';

/**
 * OSPF Network Configuration
 * Defines which networks participate in OSPF
 */
export class OSPFNetwork {
  public network: IPAddress;

  public wildcardMask: IPAddress;

  public areaID: IPAddress;

  constructor(network: IPAddress, wildcardMask: IPAddress, areaID: IPAddress) {
    this.network = network;
    this.wildcardMask = wildcardMask;
    this.areaID = areaID;
  }

  /**
   * Check if an IP address matches this network statement
   */
  public matches(ipAddress: IPAddress): boolean {
    const networkNum = this.network.toNumber();
    const ipNum = ipAddress.toNumber();
    const wildcardNum = this.wildcardMask.toNumber();

    // Wildcard mask: 1 bits mean "don't care", 0 bits mean "must match"
    // Example: network 10.0.0.0 0.255.255.255 matches 10.x.x.x
    return (networkNum & ~wildcardNum) === (ipNum & ~wildcardNum);
  }
}

/**
 * OSPF Interface Configuration
 * Stores OSPF settings per interface
 */
export class OSPFInterfaceConfig {
  public iface: NetworkInterface;

  public areaID: IPAddress = new IPAddress('0.0.0.0'); // Backbone area

  public priority: number = OSPF_DEFAULT_PRIORITY;

  public helloInterval: number = OSPF_DEFAULT_HELLO_INTERVAL;

  public deadInterval: number = OSPF_DEFAULT_DEAD_INTERVAL;

  public cost: number = 1; // OSPF cost for this interface

  public enabled: boolean = false;

  constructor(iface: NetworkInterface) {
    this.iface = iface;
  }
}

/**
 * OSPF Neighbor Information
 * Tracks state and information about each OSPF neighbor
 */
export class OSPFNeighbor {
  public neighborID: IPAddress; // Router ID of neighbor

  public neighborIP: IPAddress; // IP address of neighbor interface

  public state: OSPFState = OSPFState.Down;

  public priority: number = OSPF_DEFAULT_PRIORITY;

  public designatedRouter: IPAddress = new IPAddress('0.0.0.0');

  public backupDesignatedRouter: IPAddress = new IPAddress('0.0.0.0');

  public lastHelloReceived: number = 0;

  public deadTimer: (() => void) | null = null;

  constructor(neighborID: IPAddress, neighborIP: IPAddress) {
    this.neighborID = neighborID;
    this.neighborIP = neighborIP;
  }
}

/**
 * OSPF Area Configuration
 * Each OSPF area has its own link-state database
 */
export class OSPFArea {
  public areaID: IPAddress;

  public interfaces: Set<NetworkInterface> = new Set();

  public neighbors: Map<string, OSPFNeighbor> = new Map(); // Key: neighbor router ID

  constructor(areaID: IPAddress) {
    this.areaID = areaID;
  }
}

/**
 * OSPF Service - Open Shortest Path First
 * Implements OSPF routing protocol for dynamic route calculation
 *
 * RFC 2328: OSPF is a link-state routing protocol that uses Dijkstra's algorithm
 * to calculate shortest paths. Routers exchange link-state information and build
 * a complete topology map of the network.
 */
export class OSPFService
  extends NetworkServices<RouterHost>
  implements NetworkListener
{
  // OSPF Process ID (locally significant)
  public processID: number = 0;

  // Router ID (must be unique, typically highest IP on loopback or interface)
  public routerID: IPAddress = new IPAddress('0.0.0.0');

  // Network statements - define which interfaces participate in OSPF
  private networks: OSPFNetwork[] = [];

  // Interface configurations
  private interfaceConfigs = new Map<NetworkInterface, OSPFInterfaceConfig>();

  // OSPF Areas
  private areas = new Map<string, OSPFArea>(); // Key: area ID string

  // Hello timers for each interface
  private helloTimers = new Map<string, (() => void) | null>();

  constructor(host: RouterHost, processID: number = 0, enabled: boolean = false) {
    super(host);
    this.processID = processID;
    this.Enable = enabled;
    this.autoGenerateRouterID();
  }

  /**
   * Auto-generate Router ID from highest IP address on interfaces
   */
  private autoGenerateRouterID(): void {
    let highestIP = new IPAddress('0.0.0.0');

    Object.values(this.host.Interfaces).forEach((iface) => {
      const ip = iface.getNetAddress();
      if (ip instanceof IPAddress && ip.compareTo(highestIP) > 0) {
        highestIP = ip;
      }
    });

    if (!highestIP.equals(new IPAddress('0.0.0.0'))) {
      this.routerID = highestIP;
    }
  }

  /**
   * Set Router ID manually
   */
  public setRouterID(routerID: IPAddress): void {
    this.routerID = routerID;
  }

  /**
   * Add a network statement to enable OSPF on matching interfaces
   */
  public addNetwork(
    network: IPAddress,
    wildcardMask: IPAddress,
    areaID: IPAddress
  ): void {
    const ospfNetwork = new OSPFNetwork(network, wildcardMask, areaID);
    this.networks.push(ospfNetwork);

    // Apply to matching interfaces
    this.applyNetworkStatements();
  }

  /**
   * Remove a network statement
   */
  public removeNetwork(network: IPAddress, wildcardMask: IPAddress): void {
    const index = this.networks.findIndex(
      (n) => n.network.equals(network) && n.wildcardMask.equals(wildcardMask)
    );

    if (index >= 0) {
      this.networks.splice(index, 1);
      this.applyNetworkStatements();
    }
  }

  /**
   * Get all network statements
   */
  public getNetworks(): OSPFNetwork[] {
    return this.networks;
  }

  /**
   * Apply network statements to interfaces
   * Enables OSPF on interfaces that match network statements
   */
  private applyNetworkStatements(): void {
    // First, disable OSPF on all interfaces
    this.interfaceConfigs.forEach((config) => {
      config.enabled = false;
      this.stopHelloTimer(config.iface);
    });

    // Then enable on matching interfaces
    Object.values(this.host.Interfaces).forEach((iface) => {
      const ip = iface.getNetAddress();
      if (!(ip instanceof IPAddress)) return;

      // Check each network statement
      this.networks.forEach((networkStmt) => {
        if (networkStmt.matches(ip)) {
          // Enable OSPF on this interface
          let config = this.interfaceConfigs.get(iface);
          if (!config) {
            config = new OSPFInterfaceConfig(iface);
            this.interfaceConfigs.set(iface, config);
          }

          config.enabled = true;
          config.areaID = networkStmt.areaID;

          // Add interface to area
          const areaKey = networkStmt.areaID.toString();
          if (!this.areas.has(areaKey)) {
            this.areas.set(areaKey, new OSPFArea(networkStmt.areaID));
          }
          const area = this.areas.get(areaKey)!;
          area.interfaces.add(iface);

          // Start hello timer if service is enabled
          if (this.enabled) {
            this.startHelloTimer(iface);
          }
        }
      });
    });
  }

  /**
   * Get interface configuration
   */
  public getInterfaceConfig(iface: NetworkInterface): OSPFInterfaceConfig | null {
    return this.interfaceConfigs.get(iface) || null;
  }

  /**
   * Set interface priority (for DR/BDR election)
   */
  public setInterfacePriority(iface: NetworkInterface, priority: number): void {
    let config = this.interfaceConfigs.get(iface);
    if (!config) {
      config = new OSPFInterfaceConfig(iface);
      this.interfaceConfigs.set(iface, config);
    }
    config.priority = priority;
  }

  /**
   * Set interface cost
   */
  public setInterfaceCost(iface: NetworkInterface, cost: number): void {
    let config = this.interfaceConfigs.get(iface);
    if (!config) {
      config = new OSPFInterfaceConfig(iface);
      this.interfaceConfigs.set(iface, config);
    }
    config.cost = cost;
  }

  /**
   * Get all neighbors across all areas
   */
  public getAllNeighbors(): OSPFNeighbor[] {
    const neighbors: OSPFNeighbor[] = [];
    this.areas.forEach((area) => {
      area.neighbors.forEach((neighbor) => {
        neighbors.push(neighbor);
      });
    });
    return neighbors;
  }

  /**
   * Get neighbors for a specific interface
   */
  public getNeighborsByInterface(iface: NetworkInterface): OSPFNeighbor[] {
    const neighbors: OSPFNeighbor[] = [];
    this.areas.forEach((area) => {
      if (area.interfaces.has(iface)) {
        area.neighbors.forEach((neighbor) => {
          neighbors.push(neighbor);
        });
      }
    });
    return neighbors;
  }

  /**
   * Enable/disable the OSPF service
   */
  public override set Enable(enable: boolean) {
    super.Enable = enable;

    if (enable) {
      // Apply network statements to start OSPF on matching interfaces
      this.applyNetworkStatements();

      // Start hello timers for all enabled interfaces
      this.interfaceConfigs.forEach((config, iface) => {
        if (config.enabled) {
          this.startHelloTimer(iface);
        }
      });
    } else {
      // Stop all timers
      this.helloTimers.forEach((cleanup) => {
        if (cleanup) cleanup();
      });
      this.helloTimers.clear();

      // Clear neighbor dead timers
      this.areas.forEach((area) => {
        area.neighbors.forEach((neighbor) => {
          if (neighbor.deadTimer) {
            neighbor.deadTimer();
            neighbor.deadTimer = null;
          }
        });
      });
    }
  }

  /**
   * Start periodic hello timer for an interface
   */
  private startHelloTimer(iface: NetworkInterface): void {
    const key = iface.toString();
    const config = this.interfaceConfigs.get(iface);
    if (!config || !config.enabled) return;

    // Clean up existing timer
    const existing = this.helloTimers.get(key);
    if (existing) existing();

    // RFC 2328: Send hello messages every hello interval
    const subscription = Scheduler.getInstance()
      .repeat(config.helloInterval)
      .subscribe(() => {
        this.sendHello(iface);
      });

    this.helloTimers.set(key, () => subscription.unsubscribe());
  }

  /**
   * Stop hello timer for an interface
   */
  private stopHelloTimer(iface: NetworkInterface): void {
    const key = iface.toString();
    const cleanup = this.helloTimers.get(key);
    if (cleanup) {
      cleanup();
      this.helloTimers.delete(key);
    }
  }

  /**
   * Send OSPF Hello message
   */
  private sendHello(iface: NetworkInterface): void {
    if (!this.enabled) return;

    const config = this.interfaceConfigs.get(iface);
    if (!config || !config.enabled) return;

    const ip = iface.getNetAddress();
    if (!(ip instanceof IPAddress)) return;

    const mask = iface.getNetMask() as IPAddress;
    const areaKey = config.areaID.toString();
    const area = this.areas.get(areaKey);

    // Build list of known neighbors
    const neighborIDs: IPAddress[] = [];
    if (area) {
      area.neighbors.forEach((neighbor) => {
        neighborIDs.push(neighbor.neighborID);
      });
    }

    // Determine DR and BDR (simplified - would need election algorithm)
    const dr = new IPAddress('0.0.0.0');
    const bdr = new IPAddress('0.0.0.0');

    const hello = new OSPFHelloMessage.Builder()
      .setNetSource(ip)
      .setNetDestination(OSPF_ALL_ROUTERS)
      .setRouterID(this.routerID)
      .setAreaID(config.areaID)
      .setNetworkMask(mask)
      .setHelloInterval(config.helloInterval)
      .setRouterDeadInterval(config.deadInterval)
      .setRouterPriority(config.priority)
      .setDesignatedRouter(dr)
      .setBackupDesignatedRouter(bdr)
      .setNeighbors(neighborIDs)
      .build()[0];

    iface.sendPacket(hello);
  }

  /**
   * Process received OSPF messages
   */
  public receivePacket(
    message: NetworkMessage,
    from: NetworkInterface
  ): ActionHandle {
    if (!(message instanceof OSPFMessage)) {
      return ActionHandle.Continue;
    }

    if (!this.enabled) {
      return ActionHandle.Continue;
    }

    const config = this.interfaceConfigs.get(from);
    if (!config || !config.enabled) {
      return ActionHandle.Continue;
    }

    // RFC 2328: Verify area ID matches
    if (!message.areaID.equals(config.areaID)) {
      // Drop packets from different area
      return ActionHandle.Stop;
    }

    // Process based on packet type
    switch (message.type) {
      case OSPFPacketType.Hello:
        if (message instanceof OSPFHelloMessage) {
          this.processHello(from, message, config);
        }
        break;

      case OSPFPacketType.DatabaseDescription:
        if (message instanceof OSPFDatabaseDescriptionMessage) {
          this.processDatabaseDescription(from, message, config);
        }
        break;

      case OSPFPacketType.LinkStateRequest:
        // Not fully implemented in this simulation
        break;

      case OSPFPacketType.LinkStateUpdate:
        // Not fully implemented in this simulation
        break;

      case OSPFPacketType.LinkStateAck:
        // Not fully implemented in this simulation
        break;

      default:
        // All OSPF packet types are handled above
        break;
    }

    return ActionHandle.Handled;
  }

  /**
   * Process incoming Hello message
   */
  private processHello(
    iface: NetworkInterface,
    message: OSPFHelloMessage,
    config: OSPFInterfaceConfig
  ): void {
    const areaKey = config.areaID.toString();
    const area = this.areas.get(areaKey);
    if (!area) return;

    const neighborRouterID = message.routerID;
    const neighborIP = message.netSrc as IPAddress;
    const currentTime = Scheduler.getInstance().getDeltaTime();

    // RFC 2328: Check hello parameters match
    if (
      message.helloInterval !== config.helloInterval ||
      message.routerDeadInterval !== config.deadInterval
    ) {
      // Parameters mismatch, drop packet
      return;
    }

    // RFC 2328: Check network mask matches
    const ourMask = iface.getNetMask() as IPAddress;
    if (!message.networkMask.equals(ourMask)) {
      // Network mask mismatch, drop packet
      return;
    }

    // Find or create neighbor
    const neighborKey = neighborRouterID.toString();
    let neighbor = area.neighbors.get(neighborKey);

    if (!neighbor) {
      neighbor = new OSPFNeighbor(neighborRouterID, neighborIP);
      area.neighbors.set(neighborKey, neighbor);
    }

    // Update neighbor information
    neighbor.lastHelloReceived = currentTime;
    neighbor.priority = message.routerPriority;
    neighbor.designatedRouter = message.designatedRouter;
    neighbor.backupDesignatedRouter = message.backupDesignatedRouter;

    // RFC 2328: Neighbor state machine
    switch (neighbor.state) {
      case OSPFState.Down:
        // Transition to Init when first hello received
        neighbor.state = OSPFState.Init;
        this.startNeighborDeadTimer(neighbor, config);
        break;

      case OSPFState.Init:
        // Check if we are in neighbor's hello list
        if (this.isRouterInNeighborList(message.neighbors)) {
          // Bidirectional communication established
          neighbor.state = OSPFState.TwoWay;
          // In a full implementation, would proceed to ExStart if adjacency needed
        }
        break;

      case OSPFState.TwoWay:
      case OSPFState.ExStart:
      case OSPFState.Exchange:
      case OSPFState.Loading:
      case OSPFState.Full:
        // Refresh dead timer
        this.startNeighborDeadTimer(neighbor, config);
        break;

      default:
        // All OSPF states are handled above
        break;
    }
  }

  /**
   * Check if our Router ID is in the neighbor list
   */
  private isRouterInNeighborList(neighbors: IPAddress[]): boolean {
    return neighbors.some((id) => id.equals(this.routerID));
  }

  /**
   * Start or restart the dead timer for a neighbor
   */
  private startNeighborDeadTimer(
    neighbor: OSPFNeighbor,
    config: OSPFInterfaceConfig
  ): void {
    // Clear existing timer
    if (neighbor.deadTimer) {
      neighbor.deadTimer();
      neighbor.deadTimer = null;
    }

    // Set new timer
    const subscription = Scheduler.getInstance()
      .delay(config.deadInterval)
      .subscribe(() => {
        // Neighbor dead - transition to Down
        neighbor.state = OSPFState.Down;
        neighbor.deadTimer = null;
      });

    neighbor.deadTimer = () => subscription.unsubscribe();
  }

  /**
   * Process Database Description message
   */
  private processDatabaseDescription(
    iface: NetworkInterface,
    message: OSPFDatabaseDescriptionMessage,
    config: OSPFInterfaceConfig
  ): void {
    // Find neighbor
    const areaKey = config.areaID.toString();
    const area = this.areas.get(areaKey);
    if (!area) return;

    const neighborKey = message.routerID.toString();
    const neighbor = area.neighbors.get(neighborKey);
    if (!neighbor) return;

    // RFC 2328: DBD processing for database synchronization
    // Simplified implementation - would include full state machine in production

    switch (neighbor.state) {
      case OSPFState.ExStart:
        // Determine master/slave relationship
        if (message.initFlag) {
          if (this.routerID.compareTo(message.routerID) > 0) {
            // We are master
            neighbor.state = OSPFState.Exchange;
          } else {
            // We are slave
            neighbor.state = OSPFState.Exchange;
          }
        }
        break;

      case OSPFState.Exchange:
        // Exchange database descriptions
        if (!message.moreFlag) {
          // No more DBDs to exchange
          neighbor.state = OSPFState.Loading;
          // Would send Link State Requests here
          // For simulation, skip directly to Full
          neighbor.state = OSPFState.Full;
        }
        break;

      case OSPFState.Loading:
        // Loading link states
        neighbor.state = OSPFState.Full;
        break;

      default:
        // Ignore DBD in other states
        break;
    }
  }

  /**
   * Calculate OSPF routes using Dijkstra's algorithm
   * This would update the router's routing table
   */
  public calculateRoutes(): void {
    // RFC 2328: Run Dijkstra's SPF algorithm on link-state database
    // For this simulation, we keep it simplified

    // Would build complete network topology from LSAs
    // Then use Dijkstra to find shortest paths
    // Finally update routing table with calculated routes

    // Placeholder for full implementation
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.helloTimers.forEach((cleanup) => {
      if (cleanup) cleanup();
    });
    this.helloTimers.clear();

    this.areas.forEach((area) => {
      area.neighbors.forEach((neighbor) => {
        if (neighbor.deadTimer) {
          neighbor.deadTimer();
        }
      });
    });

    this.areas.clear();
  }
}

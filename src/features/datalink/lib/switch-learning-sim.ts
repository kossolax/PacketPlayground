// Switch Learning Algorithm Simulation
// Demonstrates MAC address learning, CAM table aging, and flooding vs forwarding

import { startFlightAnimation } from '@/lib/animation';
import { NetworkLink, NetworkNode, PositionedNode } from '@/lib/network-layout';
import { Packet as BasePacket } from '@/lib/network-simulation';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * CAM (Content Addressable Memory) table entry
 */
export interface CamEntry {
  mac: string;
  port: string | number; // port ID (link to neighbor)
  timestamp: number; // when learned (for aging)
}

/**
 * Network device types
 */
export type DeviceType = 'pc' | 'switch';

/**
 * Network device with MAC address
 */
export interface Device extends NetworkNode {
  mac: string; // MAC address (e.g., "AA:BB:CC:DD:EE:01")
}

/**
 * Packet with source and destination MAC
 */
export interface Packet extends BasePacket {
  currentPath: NetworkLink[]; // path currently taking
  pathProgress: number; // 0-100 on current path
  animId: number; // unique animation ID
  ingressPort?: string | number; // port where packet entered (prevents loop)
  isReply?: boolean; // true if this packet is a reply (prevents reply loops)
}

/**
 * Link state for visualization
 */
export type LinkStateType = 'idle' | 'forwarding' | 'flooding' | 'learning';

/**
 * Link with current state
 */
export interface LinkWithState extends NetworkLink {
  state: LinkStateType;
}

/**
 * Simulation state
 */
export interface SwitchLearningState {
  // Configuration
  agingTimeoutSec: number; // CAM entry expiration (default 300s)
  timeScale: number; // simulation speed multiplier

  // Topology
  devices: Device[];
  positioned: PositionedNode[];
  links: LinkWithState[];

  // Runtime
  isRunning: boolean;
  currentTime: number; // seconds

  // CAM tables per switch (switchId -> MAC -> CamEntry)
  camTables: Record<string | number, Record<string, CamEntry>>;

  // Flying packets
  packets: Packet[];

  // Metrics
  totalPackets: number;
  floodedPackets: number;
  forwardedPackets: number;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Create initial simulation state
 */
export function createInitialSwitchLearningState(): SwitchLearningState {
  // Topology: 2 switches + 4 PCs
  // PC1 --- SW1 --- SW2 --- PC3
  //          |       |
  //         PC2     PC4

  const devices: Device[] = [
    { id: 'pc1', type: 'pc', label: 'PC1', mac: 'AA:BB:CC:DD:EE:01' },
    { id: 'pc2', type: 'pc', label: 'PC2', mac: 'AA:BB:CC:DD:EE:02' },
    { id: 'sw1', type: 'switch', label: 'SW1', mac: 'FF:FF:FF:FF:FF:01' },
    { id: 'pc3', type: 'pc', label: 'PC3', mac: 'AA:BB:CC:DD:EE:03' },
    { id: 'pc4', type: 'pc', label: 'PC4', mac: 'AA:BB:CC:DD:EE:04' },
    { id: 'sw2', type: 'switch', label: 'SW2', mac: 'FF:FF:FF:FF:FF:02' },
  ];

  const links: LinkWithState[] = [
    { from: 'pc1', to: 'sw1', state: 'idle' },
    { from: 'pc2', to: 'sw1', state: 'idle' },
    { from: 'sw1', to: 'sw2', state: 'idle' },
    { from: 'sw2', to: 'pc3', state: 'idle' },
    { from: 'sw2', to: 'pc4', state: 'idle' },
  ];

  // Layout: Bus topology between switches with tree-connected PCs
  //   SW1 ---------- SW2
  //  |    |         |    |
  // PC1  PC2       PC3  PC4
  const positioned: PositionedNode[] = [
    { id: 'sw1', label: 'SW1', type: 'switch', x: 300, y: 100 },
    { id: 'sw2', label: 'SW2', type: 'switch', x: 600, y: 100 },
    { id: 'pc1', label: 'PC1', type: 'pc', x: 250, y: 250 },
    { id: 'pc2', label: 'PC2', type: 'pc', x: 350, y: 250 },
    { id: 'pc3', label: 'PC3', type: 'pc', x: 550, y: 250 },
    { id: 'pc4', label: 'PC4', type: 'pc', x: 650, y: 250 },
  ];

  const camTables: Record<string | number, Record<string, CamEntry>> = {
    sw1: {},
    sw2: {},
  };

  return {
    agingTimeoutSec: 20, // Default 20 seconds
    timeScale: 1,
    devices,
    positioned,
    links,
    isRunning: false,
    currentTime: 0,
    camTables,
    packets: [],
    totalPackets: 0,
    floodedPackets: 0,
    forwardedPackets: 0,
  };
}

// ============================================================================
// SIMULATION CLASS
// ============================================================================

export class SwitchLearningSim extends Simulation<SwitchLearningState> {
  private activeAnimations = new Set<() => void>();

  private nextAnimId = 1;

  private agingInterval?: NodeJS.Timeout;

  private tickCounter = 0;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<SwitchLearningState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialSwitchLearningState(), onUpdate, timeProvider);
  }

  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.startTimer();
    this.emit();

    // Start tick interval (every 100ms for currentTime update + aging check)
    this.agingInterval = setInterval(() => {
      this.tick();
    }, 100 / this.state.timeScale);

    // Auto-scenario: PC1 → PC3 (flooding + learning)
    // PC3 will auto-reply when packet arrives (see animatePacket onArrived)
    this.sendPacket('pc1', 'pc3', 1000);

    // Test aging: wait for aging timeout + send another packet
    const agingDelay = (this.state.agingTimeoutSec + 5) * 1000;
    this.sendPacket('pc1', 'pc3', agingDelay);
  }

  reset(): void {
    this.stopAllAnimations();
    this.stopTimer();
    this.resetTimer();

    if (this.agingInterval) {
      clearInterval(this.agingInterval);
      this.agingInterval = undefined;
    }

    this.tickCounter = 0;

    const preservedAgingTimeout = this.state.agingTimeoutSec;
    const preservedTimeScale = this.state.timeScale;

    const fresh = createInitialSwitchLearningState();
    fresh.agingTimeoutSec = preservedAgingTimeout;
    fresh.timeScale = preservedTimeScale;

    this.state = fresh;
    this.emit();
  }

  setAgingTimeout(seconds: number): void {
    this.state.agingTimeoutSec = seconds;
    this.emit();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = scale;

    // Restart tick interval with new time scale
    if (this.agingInterval) {
      clearInterval(this.agingInterval);
      this.agingInterval = setInterval(() => {
        this.tick();
      }, 100 / this.state.timeScale);
    }

    this.emit();
  }

  /**
   * Tick function called every 100ms to update currentTime and check aging
   */
  private tick(): void {
    if (!this.state.isRunning) return;

    // Update current time from elapsed time (convert ms to seconds)
    this.state.currentTime = this.getElapsedTime() / 1000;

    // Increment tick counter
    this.tickCounter += 1;

    // Check aging every 100 ticks (= 10 seconds at 100ms per tick)
    if (this.tickCounter >= 100) {
      this.tickCounter = 0;
      this.checkAging();
    }

    this.emit();
  }

  /**
   * Manually send a packet from source to destination
   */
  sendPacket(
    fromId: string | number,
    toId: string | number,
    delayMs: number = 0,
    isReply: boolean = false
  ): void {
    setTimeout(() => {
      if (!this.state.isRunning) return;

      const from = this.state.devices.find((d) => d.id === fromId);
      const to = this.state.devices.find((d) => d.id === toId);

      if (!from || !to) {
        return;
      }

      // Find the first hop (link directly connected to source)
      const firstLink = this.state.links.find(
        (l) => l.from === fromId || l.to === fromId
      );

      if (!firstLink) {
        return;
      }

      // Normalize link direction: always fromId → neighbor
      const neighbor =
        firstLink.from === fromId ? firstLink.to : firstLink.from;
      const normalizedLink: NetworkLink = { from: fromId, to: neighbor };

      const packet: Packet = {
        id: `packet-${this.nextAnimId}`,
        type: 'unicast',
        srcMAC: from.mac,
        dstMAC: to.mac,
        progress: 0,
        currentPath: [normalizedLink], // Only the first hop
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: fromId, // Packet originates from this PC
        isReply, // Mark if this is a reply packet
      };

      this.nextAnimId += 1;
      this.state.totalPackets += 1;
      this.state.packets.push(packet);

      // Set the first link state to forwarding (PC sending packet)
      this.setLinkState(firstLink, 'forwarding');

      this.emit();

      // Animate packet to first switch (hop-by-hop starts here)
      this.animatePacket(packet);
    }, delayMs / this.state.timeScale);
  }

  /**
   * Animate packet along its path
   */
  private animatePacket(packet: Packet): void {
    const flightDuration = 2000 / this.state.timeScale;

    const cancel = startFlightAnimation({
      durationMs: flightDuration,
      onProgress: (percentage) => {
        const p = this.state.packets.find((pk) => pk.animId === packet.animId);
        if (p) {
          p.pathProgress = percentage;
          this.emit();
        }
      },
      onArrived: () => {
        // Remove packet from animation
        this.state.packets = this.state.packets.filter(
          (p) => p.animId !== packet.animId
        );

        // Get destination node (where packet arrived)
        const destNodeId = packet.currentPath[0].to;
        const destDevice = this.state.devices.find((d) => d.id === destNodeId);

        if (!destDevice) {
          this.emit();
          return;
        }

        if (destDevice.type === 'switch') {
          // Packet arrived at a switch → process (learn + decide flood/forward)
          this.processPacketAtSwitch(packet, destDevice.id);
        } else if (destDevice.type === 'pc') {
          // Packet arrived at a PC
          // Check if packet is actually for this PC (not just flooded)
          if (packet.dstMAC === destDevice.mac) {
            // Generic auto-reply: any PC that receives a packet responds to sender
            // BUT only if this packet is not already a reply (prevents infinite loop)
            if (!packet.isReply) {
              const sourceDevice = this.state.devices.find(
                (d) => d.mac === packet.srcMAC
              );
              if (sourceDevice && sourceDevice.type === 'pc') {
                this.sendPacket(destDevice.id, sourceDevice.id, 100, true);
              }
            }
          }
          // If packet is not for this PC, it's ignored (flooded but wrong dest)
        }

        this.emit();
      },
    });

    this.activeAnimations.add(cancel);
  }

  /**
   * Learn MAC address on a switch port
   */
  private learnMac(
    switchId: string | number,
    mac: string,
    port: string | number
  ): void {
    const camTable = this.state.camTables[switchId];
    if (!camTable) return;

    // Check if already learned
    const existing = camTable[mac];
    if (existing && existing.port === port) {
      // Refresh timestamp
      existing.timestamp = this.state.currentTime;
      return;
    }

    // Add new entry
    camTable[mac] = {
      mac,
      port,
      timestamp: this.state.currentTime,
    };

    this.emit();
  }

  /**
   * Check for aged entries and remove them
   */
  private checkAging(): void {
    if (!this.state.isRunning) return;

    const { currentTime } = this.state;

    Object.values(this.state.camTables).forEach((camTable) => {
      const toRemove: string[] = [];

      Object.entries(camTable).forEach(([mac, entry]) => {
        const age = currentTime - entry.timestamp;
        if (age > this.state.agingTimeoutSec) {
          toRemove.push(mac);
        }
      });

      toRemove.forEach((mac) => {
        // eslint-disable-next-line no-param-reassign
        delete camTable[mac];
      });
    });

    if (Object.keys(this.state.camTables).length > 0) {
      this.emit();
    }
  }

  /**
   * Process packet when it arrives at a switch (learn + decide flood/forward)
   */
  private processPacketAtSwitch(
    packet: Packet,
    switchId: string | number
  ): void {
    // Learn source MAC address on ingress port
    if (packet.ingressPort) {
      this.learnMac(switchId, packet.srcMAC, packet.ingressPort);
      const ingressLink = this.state.links.find(
        (l) =>
          (l.from === switchId && l.to === packet.ingressPort) ||
          (l.to === switchId && l.from === packet.ingressPort)
      );
      if (ingressLink) {
        this.setLinkState(ingressLink, 'learning');
      }
    }

    // Check CAM table for destination MAC
    const camTable = this.state.camTables[switchId];
    const camEntry = camTable?.[packet.dstMAC];

    if (camEntry) {
      // Destination known → forward to specific port
      this.forwardPacket(packet, switchId, camEntry.port);
    } else {
      // Destination unknown → flood to all ports except ingress
      this.floodPacket(packet, switchId);
    }
  }

  /**
   * Forward packet to a specific port (destination known in CAM table)
   */
  private forwardPacket(
    packet: Packet,
    switchId: string | number,
    targetPort: string | number
  ): void {
    // Find the link to the target port
    const link = this.state.links.find(
      (l) =>
        (l.from === switchId && l.to === targetPort) ||
        (l.to === switchId && l.from === targetPort)
    );

    if (!link) return;

    // Normalize link direction: always switch → targetPort
    const normalizedLink: NetworkLink = { from: switchId, to: targetPort };

    // Create new packet with this single link as path
    const newPacket: Packet = {
      ...packet,
      currentPath: [normalizedLink],
      pathProgress: 0,
      animId: this.nextAnimId,
      ingressPort: switchId,
    };

    this.nextAnimId += 1;
    this.state.packets.push(newPacket);
    this.state.forwardedPackets += 1;

    this.setLinkState(link, 'forwarding');
    this.emit();

    // Animate this packet
    this.animatePacket(newPacket);
  }

  /**
   * Flood packet to all ports except ingress port (destination unknown)
   */
  private floodPacket(packet: Packet, switchId: string | number): void {
    const connectedPorts = this.getConnectedPorts(switchId);

    // Filter out the ingress port (don't send back where it came from)
    const portsToFlood = connectedPorts.filter(
      ({ port }) => port !== packet.ingressPort
    );

    portsToFlood.forEach(({ link, port }) => {
      // Normalize link direction: always switch → port
      const normalizedLink: NetworkLink = { from: switchId, to: port };

      // Create a clone packet for each port
      const clonePacket: Packet = {
        ...packet,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: switchId,
      };

      this.nextAnimId += 1;
      this.state.packets.push(clonePacket);
      this.setLinkState(link, 'flooding');

      // Animate this clone
      this.animatePacket(clonePacket);
    });

    this.state.floodedPackets += portsToFlood.length;
    this.emit();
  }

  /**
   * Set link visual state
   */
  private setLinkState(link: NetworkLink, state: LinkStateType): void {
    const existingLink = this.state.links.find(
      (l) =>
        (l.from === link.from && l.to === link.to) ||
        (l.from === link.to && l.to === link.from)
    );

    if (existingLink) {
      existingLink.state = state;
    }

    // Reset to idle after flight duration (synchronized with packet animation)
    const flightDuration = 2000 / this.state.timeScale;
    setTimeout(() => {
      if (existingLink) {
        existingLink.state = 'idle';
        this.emit();
      }
    }, flightDuration);
  }

  /**
   * Get all ports (neighbors) connected to a switch
   */
  private getConnectedPorts(
    switchId: string | number
  ): Array<{ link: LinkWithState; port: string | number }> {
    return this.state.links
      .filter((l) => l.from === switchId || l.to === switchId)
      .map((l) => ({
        link: l,
        port: l.from === switchId ? l.to : l.from,
      }));
  }

  /**
   * Get CAM table for a specific switch
   */
  getCamTable(switchId: string | number): Record<string, CamEntry> {
    return this.state.camTables[switchId] || {};
  }

  /**
   * Get total CAM table size across all switches
   */
  getTotalCamSize(): number {
    let total = 0;
    Object.values(this.state.camTables).forEach((table) => {
      total += Object.keys(table).length;
    });
    return total;
  }

  private stopAllAnimations(): void {
    this.activeAnimations.forEach((cancel) => cancel());
    this.activeAnimations.clear();
  }

  dispose(): void {
    this.stopAllAnimations();
    if (this.agingInterval) {
      clearInterval(this.agingInterval);
      this.agingInterval = undefined;
    }
    super.dispose();
  }
}

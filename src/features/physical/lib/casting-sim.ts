// Casting Types Simulation (Physical Layer)
// Demonstrates unicast, broadcast, multicast, and anycast transmissions

import { startFlightAnimation } from '@/lib/animation';
import { NetworkLink, NetworkNode, PositionedNode } from '@/lib/network-layout';
import { Packet as BasePacket } from '@/lib/network-simulation';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Packet types for casting demonstration
 */
export type CastPacketType = 'unicast' | 'broadcast' | 'multicast' | 'anycast';

/**
 * Packet with casting information
 */
export interface CastingPacket extends BasePacket {
  packetType: CastPacketType;
  path: NetworkLink[]; // Full path the packet will take
  pathProgress: number; // 0-100 on current link
  currentLinkIndex: number; // Which link in path we're on
  animId: number; // Unique animation ID
  targetNodeId?: string | number; // For unicast and anycast
}

/**
 * Link state for visualization
 */
export type LinkStateType = 'idle' | 'active';

/**
 * Link with current state
 */
export interface LinkWithState extends NetworkLink {
  state: LinkStateType;
  distance: number; // Physical distance for anycast calculation
}

/**
 * Statistics for the simulation
 */
export interface CastingStats {
  unicastSent: number;
  broadcastSent: number;
  multicastSent: number;
  anycastSent: number;
  totalPackets: number;
  totalHops: number;
}

/**
 * Simulation state
 */
export interface CastingSimulationState {
  // Configuration
  timeScale: number; // simulation speed multiplier
  flightDuration: number; // ms per hop
  sendInterval: number; // ms between packet sends in loop mode

  // User selections
  selectedType: CastPacketType; // Which type to send when start is pressed
  multicastGroup: Record<string | number, boolean>; // Which PCs are in multicast group (checkboxes)

  // Topology
  nodes: NetworkNode[];
  positioned: PositionedNode[];
  links: LinkWithState[];

  // Runtime
  isRunning: boolean;
  currentTime: number; // seconds

  // Flying packets
  packets: CastingPacket[];

  // Statistics
  stats: CastingStats;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Create initial simulation state with linear topology
 */
export function createInitialCastingState(): CastingSimulationState {
  // Linear topology: PC0 -> SW1 -> SW2
  //                        |      |
  //                      PC1,2  PC3,4,5

  const nodes: NetworkNode[] = [
    { id: 'pc0', type: 'pc', label: 'Source' },
    { id: 'sw1', type: 'switch', label: 'SW1' },
    { id: 'pc1', type: 'pc', label: 'PC1' },
    { id: 'pc2', type: 'pc', label: 'PC2' },
    { id: 'sw2', type: 'switch', label: 'SW2' },
    { id: 'pc3', type: 'pc', label: 'PC3' },
    { id: 'pc4', type: 'pc', label: 'PC4' },
    { id: 'pc5', type: 'pc', label: 'PC5' },
  ];

  // Linear topology links
  const links: LinkWithState[] = [
    // PC0 -> SW1
    { from: 'pc0', to: 'sw1', state: 'idle', distance: 1 },
    // SW1 -> SW2
    { from: 'sw1', to: 'sw2', state: 'idle', distance: 1 },
    // SW1 -> PC1, PC2
    { from: 'sw1', to: 'pc1', state: 'idle', distance: 1 },
    { from: 'sw1', to: 'pc2', state: 'idle', distance: 1 },
    // SW2 -> PC3, PC4, PC5
    { from: 'sw2', to: 'pc3', state: 'idle', distance: 1 },
    { from: 'sw2', to: 'pc4', state: 'idle', distance: 1 },
    { from: 'sw2', to: 'pc5', state: 'idle', distance: 1 },
  ];

  // Position nodes for tree layout
  // Source -> SW1 (tree) -> SW2 (tree)
  const positioned: PositionedNode[] = [
    // Source on the left, centered vertically
    { id: 'pc0', label: 'Source', type: 'pc', x: 50, y: 200 },

    // SW1 tree: SW1 at top, PC1 and PC2 below
    { id: 'sw1', label: 'SW1', type: 'switch', x: 250, y: 100 },
    { id: 'pc1', label: 'PC1', type: 'pc', x: 200, y: 230 },
    { id: 'pc2', label: 'PC2', type: 'pc', x: 300, y: 230 },

    // SW2 tree: SW2 at top, PC3, PC4, PC5 below
    { id: 'sw2', label: 'SW2', type: 'switch', x: 550, y: 100 },
    { id: 'pc3', label: 'PC3', type: 'pc', x: 480, y: 230 },
    { id: 'pc4', label: 'PC4', type: 'pc', x: 550, y: 230 },
    { id: 'pc5', label: 'PC5', type: 'pc', x: 620, y: 230 },
  ];

  // By default, only even PCs are in multicast group
  const multicastGroup: Record<string | number, boolean> = {
    pc1: false,
    pc2: true,
    pc3: false,
    pc4: true,
    pc5: false,
  };

  return {
    timeScale: 1,
    flightDuration: 1500, // 1.5s per hop
    sendInterval: 3000, // Send every 3s in loop mode
    selectedType: 'unicast', // Default selection
    multicastGroup,
    nodes,
    positioned,
    links,
    isRunning: false,
    currentTime: 0,
    packets: [],
    stats: {
      unicastSent: 0,
      broadcastSent: 0,
      multicastSent: 0,
      anycastSent: 0,
      totalPackets: 0,
      totalHops: 0,
    },
  };
}

// ============================================================================
// SIMULATION CLASS
// ============================================================================

export class CastingSim extends Simulation<CastingSimulationState> {
  private activeAnimations = new Set<() => void>();

  private nextAnimId = 1;

  private tickInterval?: NodeJS.Timeout;

  private sendLoopInterval?: NodeJS.Timeout;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<CastingSimulationState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialCastingState(), onUpdate, timeProvider);
  }

  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.startTimer();
    this.emit();

    // Start tick interval for currentTime update
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 100 / this.state.timeScale);

    // Send first packet immediately
    this.sendPacketByType(this.state.selectedType);

    // Start loop: send packet every sendInterval
    this.sendLoopInterval = setInterval(() => {
      if (this.state.isRunning) {
        this.sendPacketByType(this.state.selectedType);
      }
    }, this.state.sendInterval / this.state.timeScale);
  }

  reset(): void {
    this.stopAllAnimations();
    this.stopTimer();
    this.resetTimer();

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }

    if (this.sendLoopInterval) {
      clearInterval(this.sendLoopInterval);
      this.sendLoopInterval = undefined;
    }

    const preservedTimeScale = this.state.timeScale;
    const preservedFlightDuration = this.state.flightDuration;
    const preservedSendInterval = this.state.sendInterval;
    const preservedSelectedType = this.state.selectedType;
    const preservedMulticastGroup = this.state.multicastGroup;

    const fresh = createInitialCastingState();
    fresh.timeScale = preservedTimeScale;
    fresh.flightDuration = preservedFlightDuration;
    fresh.sendInterval = preservedSendInterval;
    fresh.selectedType = preservedSelectedType;
    fresh.multicastGroup = preservedMulticastGroup;

    this.state = fresh;
    this.emit();
  }

  stop(): void {
    this.state.isRunning = false;
    this.stopTimer();
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
    if (this.sendLoopInterval) {
      clearInterval(this.sendLoopInterval);
      this.sendLoopInterval = undefined;
    }
    this.emit();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = scale;

    // Restart tick interval with new time scale
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(() => {
        this.tick();
      }, 100 / this.state.timeScale);
    }

    this.emit();
  }

  setFlightDuration(ms: number): void {
    this.state.flightDuration = ms;
    this.emit();
  }

  setSendInterval(ms: number): void {
    this.state.sendInterval = ms;
    this.emit();
  }

  setSelectedType(type: CastPacketType): void {
    this.state.selectedType = type;
    this.emit();
  }

  toggleMulticastMember(pcId: string | number): void {
    this.state.multicastGroup[pcId] = !this.state.multicastGroup[pcId];
    this.emit();
  }

  /**
   * Tick function called every 100ms to update currentTime
   */
  private tick(): void {
    if (!this.state.isRunning) return;
    this.state.currentTime = this.getElapsedTime() / 1000;
    this.emit();
  }

  /**
   * Send packet(s) based on selected type
   */
  private sendPacketByType(type: CastPacketType): void {
    if (!this.state.isRunning) return;

    // Get all PC targets (exclude source and switches)
    const allPCs = this.state.nodes.filter(
      (n) => n.type === 'pc' && n.id !== 'pc0'
    );

    switch (type) {
      case 'unicast': {
        // Send to 1 random PC
        if (allPCs.length === 0) return;
        const target = allPCs[Math.floor(Math.random() * allPCs.length)];
        const path = this.findPath('pc0', target.id);
        if (!path || path.length === 0) return;

        this.sendPacket({
          type: 'unicast',
          packetType: 'unicast',
          targetNodeId: target.id,
          path,
        });

        this.state.stats.unicastSent += 1;
        this.state.stats.totalPackets += 1;
        this.state.stats.totalHops += path.length;
        break;
      }

      case 'broadcast': {
        // Send to ALL PCs
        allPCs.forEach((target) => {
          const path = this.findPath('pc0', target.id);
          if (!path || path.length === 0) return;

          this.sendPacket({
            type: 'broadcast',
            packetType: 'broadcast',
            targetNodeId: target.id,
            path,
          });

          this.state.stats.totalHops += path.length;
        });

        this.state.stats.broadcastSent += 1;
        this.state.stats.totalPackets += allPCs.length;
        break;
      }

      case 'multicast': {
        // Send to PCs in multicast group (user-selected via checkboxes)
        const multicastPCs = allPCs.filter(
          (n) => this.state.multicastGroup[n.id] === true
        );

        multicastPCs.forEach((target) => {
          const path = this.findPath('pc0', target.id);
          if (!path || path.length === 0) return;

          this.sendPacket({
            type: 'multicast',
            packetType: 'multicast',
            targetNodeId: target.id,
            path,
          });

          this.state.stats.totalHops += path.length;
        });

        this.state.stats.multicastSent += 1;
        this.state.stats.totalPackets += multicastPCs.length;
        break;
      }

      case 'anycast': {
        // Send to closest PC (by hop count)
        if (allPCs.length === 0) return;

        let closestNode = allPCs[0];
        let minDistance = this.getPathDistance('pc0', closestNode.id);

        allPCs.forEach((node) => {
          const dist = this.getPathDistance('pc0', node.id);
          if (dist < minDistance) {
            minDistance = dist;
            closestNode = node;
          }
        });

        const path = this.findPath('pc0', closestNode.id);
        if (!path || path.length === 0) return;

        this.sendPacket({
          type: 'anycast',
          packetType: 'anycast',
          targetNodeId: closestNode.id,
          path,
        });

        this.state.stats.anycastSent += 1;
        this.state.stats.totalPackets += 1;
        this.state.stats.totalHops += path.length;
        break;
      }

      default:
        break;
    }

    this.emit();
  }

  /**
   * Internal method to send a packet with animation
   */
  private sendPacket({
    type,
    packetType,
    targetNodeId,
    path,
  }: {
    type: 'unicast' | 'broadcast' | 'multicast' | 'anycast';
    packetType: CastPacketType;
    targetNodeId: string | number;
    path: NetworkLink[];
  }): void {
    const packet: CastingPacket = {
      id: `${type}-${this.nextAnimId}`,
      type,
      srcMAC: 'PC0-MAC',
      dstMAC: `${targetNodeId}-MAC`,
      packetType,
      progress: 0,
      path,
      pathProgress: 0,
      currentLinkIndex: 0,
      animId: this.nextAnimId,
      targetNodeId,
    };

    this.nextAnimId += 1;
    this.state.packets.push(packet);

    // Set first link to active
    if (path.length > 0) {
      this.setLinkState(path[0], 'active');
    }

    this.emit();

    // Animate packet along path
    this.animatePacket(packet);
  }

  /**
   * Animate packet along its path
   */
  private animatePacket(packet: CastingPacket): void {
    const animateLink = (linkIndex: number) => {
      if (linkIndex >= packet.path.length) {
        // Animation complete - remove packet
        this.state.packets = this.state.packets.filter(
          (p) => p.animId !== packet.animId
        );
        this.emit();
        return;
      }

      const link = packet.path[linkIndex];
      this.setLinkState(link, 'active');

      const cancel = startFlightAnimation({
        durationMs: this.state.flightDuration / this.state.timeScale,
        onProgress: (percentage) => {
          const p = this.state.packets.find(
            (pk) => pk.animId === packet.animId
          );
          if (p) {
            p.pathProgress = percentage;
            p.currentLinkIndex = linkIndex;
            this.emit();
          }
        },
        onArrived: () => {
          // Move to next link
          const p = this.state.packets.find(
            (pk) => pk.animId === packet.animId
          );
          if (p) {
            p.currentLinkIndex = linkIndex + 1;
            animateLink(linkIndex + 1);
          }
        },
      });

      this.activeAnimations.add(cancel);
    };

    animateLink(0);
  }

  /**
   * Find path between two nodes using BFS (shortest path)
   */
  private findPath(
    from: string | number,
    to: string | number
  ): NetworkLink[] | null {
    if (from === to) return [];

    // Build adjacency list
    const adj = new Map<string | number, Array<string | number>>();
    this.state.links.forEach((link) => {
      if (!adj.has(link.from)) adj.set(link.from, []);
      if (!adj.has(link.to)) adj.set(link.to, []);
      adj.get(link.from)!.push(link.to);
      adj.get(link.to)!.push(link.from);
    });

    // BFS
    const visited = new Set<string | number>();
    const parent = new Map<string | number, string | number>();
    const queue: Array<string | number> = [from];

    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === to) {
        // Reconstruct path
        const path: NetworkLink[] = [];
        let node = to;

        while (parent.has(node)) {
          const prev = parent.get(node)!;
          path.unshift({ from: prev, to: node });
          node = prev;
        }

        return path;
      }

      const neighbors = adj.get(current) || [];
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, current);
          queue.push(neighbor);
        }
      });
    }

    return null; // No path found
  }

  /**
   * Get total distance of path
   */
  private getPathDistance(from: string | number, to: string | number): number {
    const path = this.findPath(from, to);
    if (!path) return Infinity;

    let totalDistance = 0;
    path.forEach((link) => {
      const linkWithState = this.state.links.find(
        (l) =>
          (l.from === link.from && l.to === link.to) ||
          (l.from === link.to && l.to === link.from)
      );
      if (linkWithState) {
        totalDistance += linkWithState.distance;
      }
    });

    return totalDistance;
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

    const flightDuration = this.state.flightDuration / this.state.timeScale;
    setTimeout(() => {
      if (existingLink) {
        existingLink.state = 'idle';
        this.emit();
      }
    }, flightDuration);
  }

  private stopAllAnimations(): void {
    this.activeAnimations.forEach((cancel) => cancel());
    this.activeAnimations.clear();
  }

  dispose(): void {
    this.stopAllAnimations();
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
    if (this.sendLoopInterval) {
      clearInterval(this.sendLoopInterval);
      this.sendLoopInterval = undefined;
    }
    super.dispose();
  }
}

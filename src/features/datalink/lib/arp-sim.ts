// ARP (Address Resolution Protocol) Simulation
// Demonstrates IP-to-MAC resolution, ARP cache, gratuitous ARP, and ARP poisoning

import { startFlightAnimation } from '@/lib/animation';
import { NetworkLink, NetworkNode, PositionedNode } from '@/lib/network-layout';
import { Packet as BasePacket } from '@/lib/network-simulation';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * ARP Cache entry
 */
export interface ArpCacheEntry {
  ip: string;
  mac: string;
  timestamp: number; // when learned (for aging)
  isPoisoned?: boolean; // true if entry was poisoned by an attacker
}

/**
 * CAM (Content Addressable Memory) table entry for switches
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
 * Network device with MAC and IP address
 */
export interface ArpDevice extends NetworkNode {
  mac: string; // MAC address (e.g., "AA:BB:CC:DD:EE:01")
  ip?: string; // IP address (e.g., "192.168.1.1") - only for PCs
}

/**
 * ARP packet types
 */
export type ArpPacketType =
  | 'arp-request'
  | 'arp-reply'
  | 'gratuitous-arp'
  | 'poisoned-arp';

/**
 * ARP packet
 */
export interface ArpPacket extends BasePacket {
  packetType: ArpPacketType;
  senderIP: string;
  senderMAC: string;
  targetIP: string;
  targetMAC?: string; // undefined for requests, set for replies
  currentPath: NetworkLink[]; // path currently taking
  pathProgress: number; // 0-100 on current path
  animId: number; // unique animation ID
  ingressPort?: string | number; // port where packet entered (prevents loop)
}

/**
 * Link state for visualization
 */
export type LinkStateType = 'idle' | 'forwarding' | 'broadcasting';

/**
 * Link with current state
 */
export interface LinkWithState extends NetworkLink {
  state: LinkStateType;
}

/**
 * Simulation state
 */
export interface ArpSimulationState {
  // Configuration
  cacheTimeoutSec: number; // ARP cache entry expiration (default 60s)
  agingTimeoutSec: number; // CAM table aging timeout (default 300s)
  timeScale: number; // simulation speed multiplier

  // Topology
  devices: ArpDevice[];
  positioned: PositionedNode[];
  links: LinkWithState[];

  // Runtime
  isRunning: boolean;
  currentTime: number; // seconds

  // ARP caches per device (deviceId -> IP -> ArpCacheEntry)
  arpCaches: Record<string | number, Record<string, ArpCacheEntry>>;

  // CAM tables per switch (switchId -> MAC -> CamEntry)
  camTables: Record<string | number, Record<string, CamEntry>>;

  // Flying packets
  packets: ArpPacket[];

  // Metrics
  totalRequests: number;
  totalReplies: number;
  gratuitousArps: number;
  cacheHits: number;
  cacheMisses: number;
  poisonedPackets: number;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Create initial simulation state
 */
export function createInitialArpState(): ArpSimulationState {
  // Topology: 2 switches + 4 PCs (same as Switch Learning)
  // PC1 --- SW1 --- SW2 --- PC3
  //          |       |
  //         PC2     PC4

  const devices: ArpDevice[] = [
    {
      id: 'pc1',
      type: 'pc',
      label: 'PC1',
      mac: 'AA:BB:CC:DD:EE:01',
      ip: '192.168.1.1',
    },
    {
      id: 'pc2',
      type: 'pc',
      label: 'PC2',
      mac: 'AA:BB:CC:DD:EE:02',
      ip: '192.168.1.2',
    },
    { id: 'sw1', type: 'switch', label: 'SW1', mac: 'FF:FF:FF:FF:FF:01' },
    {
      id: 'pc3',
      type: 'pc',
      label: 'PC3',
      mac: 'AA:BB:CC:DD:EE:03',
      ip: '192.168.1.3',
    },
    {
      id: 'pc4',
      type: 'pc',
      label: 'PC4',
      mac: 'AA:BB:CC:DD:EE:04',
      ip: '192.168.1.4',
    },
    { id: 'sw2', type: 'switch', label: 'SW2', mac: 'FF:FF:FF:FF:FF:02' },
  ];

  const links: LinkWithState[] = [
    { from: 'pc1', to: 'sw1', state: 'idle' },
    { from: 'pc2', to: 'sw1', state: 'idle' },
    { from: 'sw1', to: 'sw2', state: 'idle' },
    { from: 'sw2', to: 'pc3', state: 'idle' },
    { from: 'sw2', to: 'pc4', state: 'idle' },
  ];

  const positioned: PositionedNode[] = [
    { id: 'sw1', label: 'SW1', type: 'switch', x: 300, y: 100 },
    { id: 'sw2', label: 'SW2', type: 'switch', x: 600, y: 100 },
    { id: 'pc1', label: 'PC1', type: 'pc', x: 250, y: 250 },
    { id: 'pc2', label: 'PC2', type: 'pc', x: 350, y: 250 },
    { id: 'pc3', label: 'PC3', type: 'pc', x: 550, y: 250 },
    { id: 'pc4', label: 'PC4', type: 'pc', x: 650, y: 250 },
  ];

  // Initialize ARP caches for all PCs (switches don't have ARP cache)
  const arpCaches: Record<string | number, Record<string, ArpCacheEntry>> = {
    pc1: {},
    pc2: {},
    pc3: {},
    pc4: {},
  };

  // Initialize CAM tables for all switches
  const camTables: Record<string | number, Record<string, CamEntry>> = {
    sw1: {},
    sw2: {},
  };

  return {
    cacheTimeoutSec: 30, // Default 30 seconds
    agingTimeoutSec: 300, // Default 300 seconds (5 minutes)
    timeScale: 1,
    devices,
    positioned,
    links,
    isRunning: false,
    currentTime: 0,
    arpCaches,
    camTables,
    packets: [],
    totalRequests: 0,
    totalReplies: 0,
    gratuitousArps: 0,
    cacheHits: 0,
    cacheMisses: 0,
    poisonedPackets: 0,
  };
}

// ============================================================================
// SIMULATION CLASS
// ============================================================================

export class ArpSim extends Simulation<ArpSimulationState> {
  private activeAnimations = new Set<() => void>();

  private nextAnimId = 1;

  private agingInterval?: NodeJS.Timeout;

  private tickCounter = 0;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<ArpSimulationState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialArpState(), onUpdate, timeProvider);
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

    // Auto-scenario 1: PC1 → PC3 (cache empty, need ARP)
    this.sendArpRequest('pc1', '192.168.1.3', 1000);

    // Auto-scenario 2: PC1 → PC3 again (cache hit, no ARP)
    setTimeout(() => {
      if (!this.state.isRunning) return;
      const cache = this.state.arpCaches.pc1;
      if (cache['192.168.1.3']) {
        this.state.cacheHits += 1;
        this.emit();
      }
    }, 5000 / this.state.timeScale);

    // Auto-scenario 3: Gratuitous ARP from PC2 (announces its IP)
    this.sendGratuitousArp('pc2', 15000);

    // Auto-scenario 4: Cache aging - send another request after timeout
    const agingDelay = (this.state.cacheTimeoutSec + 5) * 1000;
    this.sendArpRequest('pc1', '192.168.1.3', agingDelay);
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

    const preservedCacheTimeout = this.state.cacheTimeoutSec;
    const preservedAgingTimeout = this.state.agingTimeoutSec;
    const preservedTimeScale = this.state.timeScale;

    const fresh = createInitialArpState();
    fresh.cacheTimeoutSec = preservedCacheTimeout;
    fresh.agingTimeoutSec = preservedAgingTimeout;
    fresh.timeScale = preservedTimeScale;

    this.state = fresh;
    this.emit();
  }

  setCacheTimeout(seconds: number): void {
    this.state.cacheTimeoutSec = seconds;
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

  setAgingTimeout(seconds: number): void {
    this.state.agingTimeoutSec = seconds;
    this.emit();
  }

  stop(): void {
    this.state.isRunning = false;
    this.stopTimer();
    if (this.agingInterval) {
      clearInterval(this.agingInterval);
      this.agingInterval = undefined;
    }
    this.emit();
  }

  getCamTable(switchId: string | number): Record<string, CamEntry> {
    return this.state.camTables[switchId] || {};
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
   * Send ARP Request to resolve IP to MAC
   */
  sendArpRequest(
    fromId: string | number,
    targetIP: string,
    delayMs: number = 0
  ): void {
    setTimeout(() => {
      if (!this.state.isRunning) return;

      const from = this.state.devices.find((d) => d.id === fromId);
      if (!from || from.type !== 'pc' || !from.ip) {
        return;
      }

      // Check cache first
      const cache = this.state.arpCaches[fromId];
      if (cache && cache[targetIP]) {
        this.state.cacheHits += 1;
        this.emit();
        return; // Cache hit, no need to send ARP Request
      }

      // Cache miss
      this.state.cacheMisses += 1;

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

      const packet: ArpPacket = {
        id: `arp-req-${this.nextAnimId}`,
        type: 'broadcast', // ARP Request is always broadcast
        srcMAC: from.mac,
        dstMAC: 'FF:FF:FF:FF:FF:FF', // Broadcast MAC
        packetType: 'arp-request',
        senderIP: from.ip,
        senderMAC: from.mac,
        targetIP,
        targetMAC: undefined, // Unknown (that's why we're asking!)
        progress: 0,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: fromId,
      };

      this.nextAnimId += 1;
      this.state.totalRequests += 1;
      this.state.packets.push(packet);

      this.setLinkState(firstLink, 'broadcasting');
      this.emit();

      // Animate packet
      this.animatePacket(packet);
    }, delayMs / this.state.timeScale);
  }

  /**
   * Send Gratuitous ARP (PC announces its own IP)
   */
  sendGratuitousArp(fromId: string | number, delayMs: number = 0): void {
    setTimeout(() => {
      if (!this.state.isRunning) return;

      const from = this.state.devices.find((d) => d.id === fromId);
      if (!from || from.type !== 'pc' || !from.ip) {
        return;
      }

      const firstLink = this.state.links.find(
        (l) => l.from === fromId || l.to === fromId
      );

      if (!firstLink) {
        return;
      }

      const neighbor =
        firstLink.from === fromId ? firstLink.to : firstLink.from;
      const normalizedLink: NetworkLink = { from: fromId, to: neighbor };

      const packet: ArpPacket = {
        id: `arp-grat-${this.nextAnimId}`,
        type: 'broadcast',
        srcMAC: from.mac,
        dstMAC: 'FF:FF:FF:FF:FF:FF',
        packetType: 'gratuitous-arp',
        senderIP: from.ip,
        senderMAC: from.mac,
        targetIP: from.ip, // Same as sender (gratuitous)
        targetMAC: undefined,
        progress: 0,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: fromId,
      };

      this.nextAnimId += 1;
      this.state.gratuitousArps += 1;
      this.state.packets.push(packet);

      this.setLinkState(firstLink, 'broadcasting');
      this.emit();

      this.animatePacket(packet);
    }, delayMs / this.state.timeScale);
  }

  /**
   * Send Poisoned ARP (attacker sends fake ARP Reply to poison cache)
   */
  sendPoisonedArp(
    attackerId: string | number,
    victimId: string | number,
    targetIP: string
  ): void {
    if (!this.state.isRunning) return;

    const attacker = this.state.devices.find((d) => d.id === attackerId);
    const victim = this.state.devices.find((d) => d.id === victimId);

    if (
      !attacker ||
      !victim ||
      attacker.type !== 'pc' ||
      victim.type !== 'pc'
    ) {
      return;
    }

    // Find path to victim
    const firstLink = this.state.links.find(
      (l) => l.from === attackerId || l.to === attackerId
    );

    if (!firstLink) {
      return;
    }

    const neighbor =
      firstLink.from === attackerId ? firstLink.to : firstLink.from;
    const normalizedLink: NetworkLink = { from: attackerId, to: neighbor };

    // Attacker claims to own targetIP (poison)
    const packet: ArpPacket = {
      id: `arp-poison-${this.nextAnimId}`,
      type: 'broadcast', // Poisoned ARP is broadcast
      srcMAC: attacker.mac,
      dstMAC: 'FF:FF:FF:FF:FF:FF',
      packetType: 'poisoned-arp',
      senderIP: targetIP, // FAKE IP (attacker claims to be target)
      senderMAC: attacker.mac, // Attacker's real MAC
      targetIP: victim.ip || '',
      targetMAC: undefined,
      progress: 0,
      currentPath: [normalizedLink],
      pathProgress: 0,
      animId: this.nextAnimId,
      ingressPort: attackerId,
    };

    this.nextAnimId += 1;
    this.state.poisonedPackets += 1;
    this.state.packets.push(packet);

    this.setLinkState(firstLink, 'broadcasting');
    this.emit();

    this.animatePacket(packet);
  }

  /**
   * Animate packet along its path
   */
  private animatePacket(packet: ArpPacket): void {
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

        const destNodeId = packet.currentPath[0].to;
        const destDevice = this.state.devices.find((d) => d.id === destNodeId);

        if (!destDevice) {
          this.emit();
          return;
        }

        if (destDevice.type === 'switch') {
          // Switch forwards the packet (flood if broadcast, forward if unicast)
          this.processPacketAtSwitch(packet, destDevice.id);
        } else if (destDevice.type === 'pc') {
          // PC processes the ARP packet
          this.processArpPacketAtPC(packet, destDevice.id);
        }

        this.emit();
      },
    });

    this.activeAnimations.add(cancel);
  }

  /**
   * Process ARP packet when it arrives at a switch
   */
  private processPacketAtSwitch(
    packet: ArpPacket,
    switchId: string | number
  ): void {
    // Learn source MAC address and its ingress port
    if (packet.ingressPort !== undefined) {
      this.updateCamTable(switchId, packet.srcMAC, packet.ingressPort);
    }

    if (packet.type === 'broadcast') {
      // Flood to all ports except ingress
      this.floodPacket(packet, switchId);
    } else {
      // Unicast (ARP Reply) - forward to specific port based on destination MAC
      const targetDevice = this.state.devices.find(
        (d) => d.mac === packet.dstMAC
      );

      if (targetDevice) {
        // Find which port leads to the target device
        const targetPort = this.findPortToDevice(switchId, targetDevice.id);

        if (targetPort) {
          this.forwardPacketToPort(packet, switchId, targetPort);
          return;
        }
      }

      // If we don't know where to send it, flood it
      this.floodPacket(packet, switchId);
    }
  }

  /**
   * Process ARP packet when it arrives at a PC
   */
  private processArpPacketAtPC(packet: ArpPacket, pcId: string | number): void {
    const pc = this.state.devices.find((d) => d.id === pcId);
    if (!pc || pc.type !== 'pc' || !pc.ip) {
      return;
    }

    // Update cache with sender's IP-MAC mapping (learning)
    if (packet.packetType !== 'poisoned-arp') {
      this.updateCache(pcId, packet.senderIP, packet.senderMAC, false);
    } else {
      // Poisoned ARP - update cache but mark as poisoned
      this.updateCache(pcId, packet.senderIP, packet.senderMAC, true);
    }

    // If this is an ARP Request for this PC's IP, send ARP Reply
    if (packet.packetType === 'arp-request' && packet.targetIP === pc.ip) {
      this.sendArpReply(pcId, packet.senderIP, 500);
    }

    // If this is a Gratuitous ARP and the IP matches ours, there's a conflict!
    if (
      packet.packetType === 'gratuitous-arp' &&
      packet.targetIP === pc.ip &&
      packet.senderMAC !== pc.mac
    ) {
      // IP conflict detected (not implemented in UI, just logged in state)
    }
  }

  /**
   * Send ARP Reply in response to ARP Request
   */
  private sendArpReply(
    fromId: string | number,
    targetIP: string,
    delayMs: number = 0
  ): void {
    setTimeout(() => {
      if (!this.state.isRunning) return;

      const from = this.state.devices.find((d) => d.id === fromId);
      if (!from || from.type !== 'pc' || !from.ip) {
        return;
      }

      // Find target device by IP
      const target = this.state.devices.find((d) => d.ip === targetIP);
      if (!target || target.type !== 'pc') {
        return;
      }

      const firstLink = this.state.links.find(
        (l) => l.from === fromId || l.to === fromId
      );

      if (!firstLink) {
        return;
      }

      const neighbor =
        firstLink.from === fromId ? firstLink.to : firstLink.from;
      const normalizedLink: NetworkLink = { from: fromId, to: neighbor };

      const packet: ArpPacket = {
        id: `arp-reply-${this.nextAnimId}`,
        type: 'unicast', // ARP Reply is unicast
        srcMAC: from.mac,
        dstMAC: target.mac,
        packetType: 'arp-reply',
        senderIP: from.ip,
        senderMAC: from.mac,
        targetIP,
        targetMAC: target.mac,
        progress: 0,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: fromId,
      };

      this.nextAnimId += 1;
      this.state.totalReplies += 1;
      this.state.packets.push(packet);

      this.setLinkState(firstLink, 'forwarding');
      this.emit();

      this.animatePacket(packet);
    }, delayMs / this.state.timeScale);
  }

  /**
   * Update ARP cache with IP-MAC mapping
   */
  private updateCache(
    deviceId: string | number,
    ip: string,
    mac: string,
    isPoisoned: boolean = false
  ): void {
    const cache = this.state.arpCaches[deviceId];
    if (!cache) return;

    const existing = cache[ip];
    if (existing && existing.mac === mac && !isPoisoned) {
      // Refresh timestamp
      existing.timestamp = this.state.currentTime;
      return;
    }

    // Add or update entry
    cache[ip] = {
      ip,
      mac,
      timestamp: this.state.currentTime,
      isPoisoned,
    };

    this.emit();
  }

  /**
   * Update CAM table with MAC-port mapping (switch learning)
   */
  private updateCamTable(
    switchId: string | number,
    mac: string,
    port: string | number
  ): void {
    const camTable = this.state.camTables[switchId];
    if (!camTable) return;

    const existing = camTable[mac];
    if (existing && existing.port === port) {
      // Refresh timestamp
      existing.timestamp = this.state.currentTime;
      return;
    }

    // Add or update entry
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

    // Age ARP cache entries
    Object.values(this.state.arpCaches).forEach((cache) => {
      const toRemove: string[] = [];

      Object.entries(cache).forEach(([ip, entry]) => {
        const age = currentTime - entry.timestamp;
        if (age > this.state.cacheTimeoutSec) {
          toRemove.push(ip);
        }
      });

      toRemove.forEach((ip) => {
        // eslint-disable-next-line no-param-reassign
        delete cache[ip];
      });
    });

    // Age CAM table entries
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

    if (
      Object.keys(this.state.arpCaches).length > 0 ||
      Object.keys(this.state.camTables).length > 0
    ) {
      this.emit();
    }
  }

  /**
   * Flood packet to all ports except ingress port
   */
  private floodPacket(packet: ArpPacket, switchId: string | number): void {
    const connectedPorts = this.getConnectedPorts(switchId);

    const portsToFlood = connectedPorts.filter(
      ({ port }) => port !== packet.ingressPort
    );

    portsToFlood.forEach(({ link, port }) => {
      const normalizedLink: NetworkLink = { from: switchId, to: port };

      const clonePacket: ArpPacket = {
        ...packet,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: switchId,
      };

      this.nextAnimId += 1;
      this.state.packets.push(clonePacket);
      this.setLinkState(
        link,
        packet.type === 'broadcast' ? 'broadcasting' : 'forwarding'
      );

      this.animatePacket(clonePacket);
    });

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
   * Find which port on a switch leads to a target device (using BFS)
   */
  private findPortToDevice(
    switchId: string | number,
    targetDeviceId: string | number
  ): string | number | null {
    // Check direct connections first
    const directLink = this.state.links.find(
      (l) =>
        (l.from === switchId && l.to === targetDeviceId) ||
        (l.to === switchId && l.from === targetDeviceId)
    );

    if (directLink) {
      return directLink.from === switchId ? directLink.to : directLink.from;
    }

    // BFS to find path through other switches
    const visited = new Set<string | number>();
    const queue: Array<{
      nodeId: string | number;
      firstPort: string | number;
    }> = [];

    // Start with all neighbors of the switch
    this.getConnectedPorts(switchId).forEach(({ port }) => {
      queue.push({ nodeId: port, firstPort: port });
      visited.add(port);
    });

    while (queue.length > 0) {
      const { nodeId, firstPort } = queue.shift()!;

      if (nodeId === targetDeviceId) {
        return firstPort;
      }

      // Only traverse through switches, not PCs
      const device = this.state.devices.find((d) => d.id === nodeId);
      if (device && device.type === 'switch') {
        this.state.links.forEach((link) => {
          let neighbor: string | number | null = null;
          if (link.from === nodeId) {
            neighbor = link.to;
          } else if (link.to === nodeId) {
            neighbor = link.from;
          }

          if (neighbor && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push({ nodeId: neighbor, firstPort });
          }
        });
      }
    }

    return null;
  }

  /**
   * Forward packet to a specific port (unicast)
   */
  private forwardPacketToPort(
    packet: ArpPacket,
    switchId: string | number,
    targetPort: string | number
  ): void {
    const link = this.state.links.find(
      (l) =>
        (l.from === switchId && l.to === targetPort) ||
        (l.to === switchId && l.from === targetPort)
    );

    if (!link) return;

    const normalizedLink: NetworkLink = { from: switchId, to: targetPort };

    const clonePacket: ArpPacket = {
      ...packet,
      currentPath: [normalizedLink],
      pathProgress: 0,
      animId: this.nextAnimId,
      ingressPort: switchId,
    };

    this.nextAnimId += 1;
    this.state.packets.push(clonePacket);
    this.setLinkState(link, 'forwarding');

    this.emit();
    this.animatePacket(clonePacket);
  }

  /**
   * Get ARP cache for a specific device
   */
  getArpCache(deviceId: string | number): Record<string, ArpCacheEntry> {
    return this.state.arpCaches[deviceId] || {};
  }

  /**
   * Get total ARP cache size across all devices
   */
  getTotalCacheSize(): number {
    let total = 0;
    Object.values(this.state.arpCaches).forEach((cache) => {
      total += Object.keys(cache).length;
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

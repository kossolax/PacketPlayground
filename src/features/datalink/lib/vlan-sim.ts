// VLAN & Trunk Tagging Simulation (802.1Q)
// Demonstrates VLAN segmentation, tagging/untagging, and inter-VLAN isolation

import { startFlightAnimation } from '@/lib/animation';
import { NetworkLink, NetworkNode, PositionedNode } from '@/lib/network-layout';
import { Packet as BasePacket } from '@/lib/network-simulation';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';

// ============================================================================
// TYPES
// ============================================================================

/**
 * VLAN port modes
 */
export type PortMode = 'access' | 'trunk';

/**
 * Trunk mode configuration for inter-switch link
 */
export type TrunkMode = 'trunk' | 'vlan10' | 'vlan20';

/**
 * VLAN port configuration
 */
export interface VlanPort {
  deviceId: string | number; // switch ID
  portId: string | number; // connected neighbor ID
  mode: PortMode; // access or trunk
  allowedVlans: number[]; // [10] for access, [10, 20] for trunk
  nativeVlan?: number; // native VLAN for trunk (untagged)
}

/**
 * CAM table entry with VLAN awareness
 */
export interface CamEntry {
  mac: string;
  vlanId: number;
  port: string | number;
  timestamp: number;
}

/**
 * Network device types
 */
export type DeviceType = 'pc' | 'switch';

/**
 * Network device with MAC and VLAN
 */
export interface Device extends NetworkNode {
  mac: string; // MAC address
  vlanId?: number; // VLAN ID for PCs (undefined for switches)
}

/**
 * VLAN-aware packet
 */
export interface VlanPacket extends BasePacket {
  vlanId: number; // VLAN ID (10, 20, etc.)
  tagged: boolean; // true on trunk, false on access
  currentPath: NetworkLink[]; // current hop
  pathProgress: number; // 0-100 on current path
  animId: number; // unique animation ID
  ingressPort?: string | number; // port where packet entered
  isReply?: boolean; // true if this packet is a reply (prevents reply loops)
}

/**
 * Link state for visualization
 */
export type LinkStateType = 'idle' | 'forwarding' | 'flooding' | 'blocked';

/**
 * Link with VLAN metadata
 */
export interface LinkWithState extends NetworkLink {
  state: LinkStateType;
  isTrunk: boolean; // true if this is a trunk link
}

/**
 * Simulation state
 */
export interface VlanState {
  // Configuration
  timeScale: number;
  trunkMode: TrunkMode; // inter-switch link mode

  // Topology
  devices: Device[];
  positioned: PositionedNode[];
  links: LinkWithState[];
  ports: VlanPort[]; // port configurations

  // Runtime
  isRunning: boolean;
  currentTime: number; // seconds

  // CAM tables per switch (switchId -> MAC:VLAN -> CamEntry)
  camTables: Record<string | number, Record<string, CamEntry>>;

  // Flying packets
  packets: VlanPacket[];

  // Metrics
  totalPackets: number;
  forwardedPackets: number;
  floodedPackets: number;
  droppedPackets: number; // inter-VLAN blocked packets
}

// ============================================================================
// INITIAL STATE
// ============================================================================

/**
 * Create initial VLAN simulation state
 * Topology: 2 PCs per VLAN per switch
 *   PC1 PC2 (V10)    PC5 PC6 (V10)
 *      \ /               \ /
 *      SW1 =========== SW2  (Trunk: VLANs 10, 20)
 *      / \               / \
 *   PC3 PC4 (V20)    PC7 PC8 (V20)
 */
export function createInitialVlanState(): VlanState {
  const devices: Device[] = [
    // SW1 - VLAN 10
    {
      id: 'pc1',
      type: 'pc',
      label: 'PC1',
      mac: 'AA:BB:CC:DD:00:01',
      vlanId: 10,
    },
    {
      id: 'pc2',
      type: 'pc',
      label: 'PC2',
      mac: 'AA:BB:CC:DD:00:02',
      vlanId: 10,
    },
    // SW1 - VLAN 20
    {
      id: 'pc3',
      type: 'pc',
      label: 'PC3',
      mac: 'AA:BB:CC:DD:00:03',
      vlanId: 20,
    },
    {
      id: 'pc4',
      type: 'pc',
      label: 'PC4',
      mac: 'AA:BB:CC:DD:00:04',
      vlanId: 20,
    },
    // SW2 - VLAN 10
    {
      id: 'pc5',
      type: 'pc',
      label: 'PC5',
      mac: 'AA:BB:CC:DD:00:05',
      vlanId: 10,
    },
    {
      id: 'pc6',
      type: 'pc',
      label: 'PC6',
      mac: 'AA:BB:CC:DD:00:06',
      vlanId: 10,
    },
    // SW2 - VLAN 20
    {
      id: 'pc7',
      type: 'pc',
      label: 'PC7',
      mac: 'AA:BB:CC:DD:00:07',
      vlanId: 20,
    },
    {
      id: 'pc8',
      type: 'pc',
      label: 'PC8',
      mac: 'AA:BB:CC:DD:00:08',
      vlanId: 20,
    },
    { id: 'sw1', type: 'switch', label: 'SW1', mac: 'FF:FF:FF:FF:00:01' },
    { id: 'sw2', type: 'switch', label: 'SW2', mac: 'FF:FF:FF:FF:00:02' },
  ];

  const links: LinkWithState[] = [
    // SW1 - VLAN 10
    { from: 'pc1', to: 'sw1', state: 'idle', isTrunk: false },
    { from: 'pc2', to: 'sw1', state: 'idle', isTrunk: false },
    // SW1 - VLAN 20
    { from: 'pc3', to: 'sw1', state: 'idle', isTrunk: false },
    { from: 'pc4', to: 'sw1', state: 'idle', isTrunk: false },
    // Trunk
    { from: 'sw1', to: 'sw2', state: 'idle', isTrunk: true },
    // SW2 - VLAN 10
    { from: 'sw2', to: 'pc5', state: 'idle', isTrunk: false },
    { from: 'sw2', to: 'pc6', state: 'idle', isTrunk: false },
    // SW2 - VLAN 20
    { from: 'sw2', to: 'pc7', state: 'idle', isTrunk: false },
    { from: 'sw2', to: 'pc8', state: 'idle', isTrunk: false },
  ];

  // Port configurations
  const ports: VlanPort[] = [
    // SW1 ports
    { deviceId: 'sw1', portId: 'pc1', mode: 'access', allowedVlans: [10] },
    { deviceId: 'sw1', portId: 'pc2', mode: 'access', allowedVlans: [10] },
    { deviceId: 'sw1', portId: 'pc3', mode: 'access', allowedVlans: [20] },
    { deviceId: 'sw1', portId: 'pc4', mode: 'access', allowedVlans: [20] },
    { deviceId: 'sw1', portId: 'sw2', mode: 'trunk', allowedVlans: [10, 20] },

    // SW2 ports
    { deviceId: 'sw2', portId: 'pc5', mode: 'access', allowedVlans: [10] },
    { deviceId: 'sw2', portId: 'pc6', mode: 'access', allowedVlans: [10] },
    { deviceId: 'sw2', portId: 'pc7', mode: 'access', allowedVlans: [20] },
    { deviceId: 'sw2', portId: 'pc8', mode: 'access', allowedVlans: [20] },
    { deviceId: 'sw2', portId: 'sw1', mode: 'trunk', allowedVlans: [10, 20] },
  ];

  // Layout: Horizontal switches with PCs above/below in groups
  //   PC1  PC2 (V10)      PC5  PC6 (V10)
  //      \ /                  \ /
  //      SW1 ============== SW2
  //      / \                  / \
  //   PC3  PC4 (V20)      PC7  PC8 (V20)
  const positioned: PositionedNode[] = [
    { id: 'sw1', label: 'SW1', type: 'switch', x: 250, y: 240 },
    { id: 'sw2', label: 'SW2', type: 'switch', x: 650, y: 240 },
    // SW1 - VLAN 10 (top left)
    { id: 'pc1', label: 'PC1\nVLAN 10', type: 'pc', x: 180, y: 80 },
    { id: 'pc2', label: 'PC2\nVLAN 10', type: 'pc', x: 320, y: 80 },
    // SW1 - VLAN 20 (bottom left)
    { id: 'pc3', label: 'PC3\nVLAN 20', type: 'pc', x: 180, y: 400 },
    { id: 'pc4', label: 'PC4\nVLAN 20', type: 'pc', x: 320, y: 400 },
    // SW2 - VLAN 10 (top right)
    { id: 'pc5', label: 'PC5\nVLAN 10', type: 'pc', x: 580, y: 80 },
    { id: 'pc6', label: 'PC6\nVLAN 10', type: 'pc', x: 720, y: 80 },
    // SW2 - VLAN 20 (bottom right)
    { id: 'pc7', label: 'PC7\nVLAN 20', type: 'pc', x: 580, y: 400 },
    { id: 'pc8', label: 'PC8\nVLAN 20', type: 'pc', x: 720, y: 400 },
  ];

  const camTables: Record<string | number, Record<string, CamEntry>> = {
    sw1: {},
    sw2: {},
  };

  return {
    timeScale: 1,
    trunkMode: 'trunk',
    devices,
    positioned,
    links,
    ports,
    isRunning: false,
    currentTime: 0,
    camTables,
    packets: [],
    totalPackets: 0,
    forwardedPackets: 0,
    floodedPackets: 0,
    droppedPackets: 0,
  };
}

// ============================================================================
// SIMULATION CLASS
// ============================================================================

export class VlanSim extends Simulation<VlanState> {
  private activeAnimations = new Set<() => void>();

  private nextAnimId = 1;

  private tickInterval?: NodeJS.Timeout;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<VlanState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialVlanState(), onUpdate, timeProvider);
  }

  start(
    initialSourcePc?: string | number,
    initialDestPc?: string | number
  ): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.startTimer();
    this.emit();

    // Start tick interval for currentTime update
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 100 / this.state.timeScale);

    // Auto-send initial packet if source and dest are provided
    if (initialSourcePc && initialDestPc) {
      this.sendPacket(initialSourcePc, initialDestPc, 1000);
    }
  }

  reset(): void {
    this.stopAllAnimations();
    this.stopTimer();
    this.resetTimer();

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }

    const preservedTimeScale = this.state.timeScale;
    const preservedTrunkMode = this.state.trunkMode;
    const fresh = createInitialVlanState();
    fresh.timeScale = preservedTimeScale;
    fresh.trunkMode = preservedTrunkMode;

    // Apply trunk mode configuration
    VlanSim.configureTrunkMode(fresh, preservedTrunkMode);

    this.state = fresh;
    this.emit();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = scale;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(() => {
        this.tick();
      }, 100 / this.state.timeScale);
    }

    this.emit();
  }

  /**
   * Change trunk mode between switches
   * This will reset the simulation to apply new configuration
   */
  setTrunkMode(mode: TrunkMode): void {
    this.state.trunkMode = mode;
    VlanSim.configureTrunkMode(this.state, mode);
    this.reset();
  }

  /**
   * Configure inter-switch link based on trunk mode
   */
  private static configureTrunkMode(state: VlanState, mode: TrunkMode): void {
    // Find trunk link between switches
    const trunkLink = state.links.find(
      (l) =>
        (l.from === 'sw1' && l.to === 'sw2') ||
        (l.from === 'sw2' && l.to === 'sw1')
    );

    // Find port configurations for sw1<->sw2
    const sw1Port = state.ports.find(
      (p) => p.deviceId === 'sw1' && p.portId === 'sw2'
    );
    const sw2Port = state.ports.find(
      (p) => p.deviceId === 'sw2' && p.portId === 'sw1'
    );

    if (!trunkLink || !sw1Port || !sw2Port) return;

    switch (mode) {
      case 'trunk':
        // Configure as trunk - allows both VLANs with tagging
        sw1Port.mode = 'trunk';
        sw1Port.allowedVlans = [10, 20];
        sw2Port.mode = 'trunk';
        sw2Port.allowedVlans = [10, 20];
        trunkLink.isTrunk = true;
        break;

      case 'vlan10':
        // Configure as access port for VLAN 10 only
        sw1Port.mode = 'access';
        sw1Port.allowedVlans = [10];
        sw2Port.mode = 'access';
        sw2Port.allowedVlans = [10];
        trunkLink.isTrunk = false;
        break;

      case 'vlan20':
        // Configure as access port for VLAN 20 only
        sw1Port.mode = 'access';
        sw1Port.allowedVlans = [20];
        sw2Port.mode = 'access';
        sw2Port.allowedVlans = [20];
        trunkLink.isTrunk = false;
        break;

      default:
        // Default to trunk mode
        sw1Port.mode = 'trunk';
        sw1Port.allowedVlans = [10, 20];
        sw2Port.mode = 'trunk';
        sw2Port.allowedVlans = [10, 20];
        trunkLink.isTrunk = true;
        break;
    }
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
   * Send packet from source PC to destination PC
   */
  sendPacket(
    fromId: string | number,
    toId: string | number,
    delayMs: number = 0,
    isReply: boolean = false
  ): void {
    const doSendPacket = () => {
      if (!this.state.isRunning) return;

      const from = this.state.devices.find((d) => d.id === fromId);
      const to = this.state.devices.find((d) => d.id === toId);

      if (!from || !to || from.type !== 'pc' || to.type !== 'pc') {
        return;
      }

      if (!from.vlanId) {
        return;
      }

      // Find first hop (link from source PC to switch)
      const firstLink = this.state.links.find(
        (l) => l.from === fromId || l.to === fromId
      );

      if (!firstLink) {
        return;
      }

      const neighbor =
        firstLink.from === fromId ? firstLink.to : firstLink.from;
      const normalizedLink: NetworkLink = { from: fromId, to: neighbor };

      const packet: VlanPacket = {
        id: `packet-${this.nextAnimId}`,
        type: 'unicast',
        srcMAC: from.mac,
        dstMAC: to.mac,
        vlanId: from.vlanId,
        tagged: false, // Starts untagged on access port
        progress: 0,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: fromId,
        isReply, // Mark if this is a reply packet
      };

      this.nextAnimId += 1;
      this.state.totalPackets += 1;
      this.state.packets.push(packet);

      this.setLinkState(firstLink, 'forwarding');
      this.emit();

      // Animate packet
      this.animatePacket(packet);
    };

    if (delayMs > 0) {
      setTimeout(doSendPacket, delayMs / this.state.timeScale);
    } else {
      doSendPacket();
    }
  }

  /**
   * Animate packet along its path
   */
  private animatePacket(packet: VlanPacket): void {
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
        // Remove packet from flight
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
          this.processPacketAtSwitch(packet, destDevice.id);
        } else if (destDevice.type === 'pc') {
          // Packet arrived at a PC
          // Check if packet is actually for this PC (not just flooded)
          if (packet.dstMAC === destDevice.mac) {
            // Auto-reply: any PC that receives a packet responds to sender
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
   * Get port configuration for a specific switch port
   */
  private getPortConfig(
    switchId: string | number,
    portId: string | number
  ): VlanPort | undefined {
    return this.state.ports.find(
      (p) => p.deviceId === switchId && p.portId === portId
    );
  }

  /**
   * Process packet at switch (tag/untag, learn, forward/flood/drop)
   */
  private processPacketAtSwitch(
    packet: VlanPacket,
    switchId: string | number
  ): void {
    // Get ingress port config
    const ingressPort = this.getPortConfig(switchId, packet.ingressPort!);

    if (!ingressPort) return;

    // Apply tagging based on ingress port mode
    if (ingressPort.mode === 'trunk') {
      // Packet arrives on trunk → should already be tagged
      // (In real scenario, we'd read VLAN ID from 802.1Q header)
      // eslint-disable-next-line no-param-reassign
      packet.tagged = true;
    } else {
      // Packet arrives on access port → add VLAN tag
      // eslint-disable-next-line no-param-reassign
      packet.tagged = false;
      // VLAN ID stays as-is from the source PC
    }

    // Check if VLAN is allowed on ingress port
    if (!ingressPort.allowedVlans.includes(packet.vlanId)) {
      // VLAN not allowed → drop packet
      this.state.droppedPackets += 1;
      return;
    }

    // Learn source MAC with VLAN
    if (packet.ingressPort) {
      this.learnMac(switchId, packet.srcMAC, packet.vlanId, packet.ingressPort);
    }

    // Check CAM table for destination MAC + VLAN
    const camKey = `${packet.dstMAC}:${packet.vlanId}`;
    const camTable = this.state.camTables[switchId];
    const camEntry = camTable?.[camKey];

    if (camEntry) {
      // Destination known → forward
      this.forwardPacket(packet, switchId, camEntry.port);
    } else {
      // Destination unknown → flood within VLAN
      this.floodPacket(packet, switchId);
    }
  }

  /**
   * Learn MAC address with VLAN ID
   */
  private learnMac(
    switchId: string | number,
    mac: string,
    vlanId: number,
    port: string | number
  ): void {
    const camTable = this.state.camTables[switchId];
    if (!camTable) return;

    const camKey = `${mac}:${vlanId}`;
    const existing = camTable[camKey];

    if (existing && existing.port === port) {
      // Refresh timestamp
      existing.timestamp = this.state.currentTime;
      return;
    }

    // Add new entry
    camTable[camKey] = {
      mac,
      vlanId,
      port,
      timestamp: this.state.currentTime,
    };

    this.emit();
  }

  /**
   * Forward packet to specific port
   */
  private forwardPacket(
    packet: VlanPacket,
    switchId: string | number,
    targetPort: string | number
  ): void {
    // Get egress port config
    const egressPort = this.getPortConfig(switchId, targetPort);

    if (!egressPort) return;

    // Check if VLAN is allowed on egress port
    if (!egressPort.allowedVlans.includes(packet.vlanId)) {
      // VLAN not allowed → drop (inter-VLAN blocked)
      this.state.droppedPackets += 1;
      return;
    }

    const link = this.state.links.find(
      (l) =>
        (l.from === switchId && l.to === targetPort) ||
        (l.to === switchId && l.from === targetPort)
    );

    if (!link) return;

    const normalizedLink: NetworkLink = { from: switchId, to: targetPort };

    // Apply tagging based on egress port mode
    const isTagged = egressPort.mode === 'trunk';

    const newPacket: VlanPacket = {
      ...packet,
      tagged: isTagged,
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

    this.animatePacket(newPacket);
  }

  /**
   * Flood packet to all ports in the same VLAN (except ingress)
   */
  private floodPacket(packet: VlanPacket, switchId: string | number): void {
    const connectedPorts = this.getConnectedPorts(switchId);

    // Filter: exclude ingress, only same VLAN
    const portsToFlood = connectedPorts.filter(({ port, portConfig }) => {
      if (port === packet.ingressPort) return false;
      if (!portConfig) return false;
      return portConfig.allowedVlans.includes(packet.vlanId);
    });

    portsToFlood.forEach(({ link, port, portConfig }) => {
      const normalizedLink: NetworkLink = { from: switchId, to: port };

      // Apply tagging based on egress port mode
      const isTagged = portConfig!.mode === 'trunk';

      const clonePacket: VlanPacket = {
        ...packet,
        tagged: isTagged,
        currentPath: [normalizedLink],
        pathProgress: 0,
        animId: this.nextAnimId,
        ingressPort: switchId,
      };

      this.nextAnimId += 1;
      this.state.packets.push(clonePacket);
      this.setLinkState(link, 'flooding');

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

    const flightDuration = 2000 / this.state.timeScale;
    setTimeout(() => {
      if (existingLink) {
        existingLink.state = 'idle';
        this.emit();
      }
    }, flightDuration);
  }

  /**
   * Get all connected ports for a switch
   */
  private getConnectedPorts(switchId: string | number): Array<{
    link: LinkWithState;
    port: string | number;
    portConfig: VlanPort | undefined;
  }> {
    return this.state.links
      .filter((l) => l.from === switchId || l.to === switchId)
      .map((l) => {
        const port = l.from === switchId ? l.to : l.from;
        const portConfig = this.getPortConfig(switchId, port);
        return { link: l, port, portConfig };
      });
  }

  /**
   * Get CAM table for a specific switch
   */
  getCamTable(switchId: string | number): Record<string, CamEntry> {
    return this.state.camTables[switchId] || {};
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
    super.dispose();
  }
}

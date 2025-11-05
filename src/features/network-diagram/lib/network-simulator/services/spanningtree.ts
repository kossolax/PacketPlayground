import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { type HardwareAddress, MacAddress } from '../address';
import { type HardwareInterface, type Interface } from '../layers/datalink';
import { DatalinkMessage, type Payload } from '../message';
import { EthernetMessage } from '../protocols/ethernet';
import { ActionHandle, type DatalinkListener } from '../protocols/base';
import { NetworkServices } from './dhcp';
import type { SwitchHost } from '../nodes/switch';

export enum SpanningTreeState {
  Disabled,
  Listening,
  Learning,
  Forwarding,
  Blocking,
}

enum MessageType {
  configuration,
  topologyChange,
}

export enum SpanningTreePortRole {
  Disabled,
  Root,
  Designated,
  Blocked,
  Alternate,
  Backup,
}

export enum SpanningTreeProtocol {
  None = 'none',
  STP = 'stp', // 802.1D - Single spanning tree
  RSTP = 'rstp', // 802.1w - Rapid Spanning Tree Protocol
  PVST = 'pvst', // Per-VLAN Spanning Tree (Cisco proprietary)
  RPVST = 'rpvst', // Rapid PVST+ (802.1w + per-VLAN)
  MSTP = 'mstp', // Multiple Spanning Tree (802.1s)
}

const SpanningTreeMultiCastAddress = new MacAddress('01:80:C2:00:00:00');

export class SpanningTreeMessage extends EthernetMessage {
  public protocolId = 0;

  public version = 0;

  public messageType: MessageType = MessageType.configuration;

  public flags = {
    topologyChange: false,
    topologyChangeAck: false,
  };

  public rootId = {
    priority: 32768,
    mac: new MacAddress('FF:FF:FF:FF:FF:FF'),
  };

  public rootPathCost = 0;

  public bridgeId = {
    priority: 32768,
    mac: new MacAddress('FF:FF:FF:FF:FF:FF'),
  };

  public portId = {
    priority: 32768,
    globalId: 0,
  };

  public messageAge = 0;

  public maxAge = 20;

  public helloTime = 2;

  public forwardDelay = 15;

  public override toString(): string {
    return `STP (age=${this.messageAge})`;
  }

  protected constructor(
    payload: Payload | string,
    macSrc: HardwareAddress,
    macDst: HardwareAddress | null
  ) {
    super(payload, macSrc, macDst);
  }

  public static override Builder = class extends EthernetMessage.Builder {
    private type = MessageType.configuration;

    public setType(type: MessageType): this {
      this.type = type;
      return this;
    }

    private bridge = new MacAddress('FF:FF:FF:FF:FF:FF');

    public setBridge(bridge: MacAddress): this {
      this.bridge = bridge;
      return this;
    }

    private root = new MacAddress('FF:FF:FF:FF:FF:FF');

    public setRoot(root: MacAddress): this {
      this.root = root;
      return this;
    }

    private cost = 0;

    public setCost(cost: number): this {
      this.cost = cost;
      return this;
    }

    private port = 0;

    public setPort(port: number | string): this {
      // convert string to number using hashcode
      if (typeof port === 'string') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.port = STPService.getPortId(port);
      } else {
        this.port = port;
      }
      return this;
    }

    private age = -1;

    public setMessageAge(age: number): this {
      this.age = age;
      return this;
    }

    public override build(): SpanningTreeMessage {
      // Validate that Layer 2 source MAC was set via setMacSource()
      if (this.macSrc === null) {
        throw new Error('MAC source address must be set via setMacSource()');
      }

      // Create BPDU with correct Layer 2 source MAC (interface MAC, not Bridge ID)
      const message = new SpanningTreeMessage(
        this.payload,
        this.macSrc,
        SpanningTreeMultiCastAddress
      );

      // Set Bridge ID in BPDU payload (lowest MAC of all interfaces)
      message.bridgeId.mac = this.bridge;
      message.rootId.mac = this.root;
      message.messageType = this.type;
      message.rootPathCost = this.cost;
      message.portId.globalId = this.port;
      // RFC 802.1D: messageAge is relative (0 for new BPDUs from root)
      message.messageAge = this.age > 0 ? this.age : 0;

      return message;
    }
  };
}

/**
 * PVST Message - extends standard STP BPDU with VLAN identifier
 * Used for per-VLAN spanning tree (one tree per VLAN)
 */
export class PVSTMessage extends SpanningTreeMessage {
  public vlanId: number = 0;

  public override toString(): string {
    return `PVST (VLAN=${this.vlanId}, age=${this.messageAge})`;
  }

  public static setVlanId(
    message: SpanningTreeMessage,
    vlanId: number
  ): PVSTMessage {
    // Convert SpanningTreeMessage to PVSTMessage by copying all fields
    const pvstMsg = Object.create(PVSTMessage.prototype);
    Object.assign(pvstMsg, message);
    pvstMsg.vlanId = vlanId;
    return pvstMsg;
  }
}

/**
 * RSTP Message - IEEE 802.1w Rapid Spanning Tree Protocol
 * Version 2 BPDU with extended flags for rapid convergence
 */
export class RSTPMessage extends SpanningTreeMessage {
  public override version = 2;

  // RSTP flags (overrides STP flags structure)
  public override flags = {
    // From STP (maintained for compatibility)
    topologyChange: false,
    topologyChangeAck: false,
    // RSTP extensions
    proposal: false,
    agreement: false,
    forwarding: false,
    learning: false,
    portRole: SpanningTreePortRole.Disabled,
  };

  public override toString(): string {
    const roleStr = [
      'Disabled',
      'Root',
      'Designated',
      'Blocked',
      'Alternate',
      'Backup',
    ][this.flags.portRole];
    return `RSTP (role=${roleStr}, age=${this.messageAge})`;
  }

  /**
   * Convert standard STP message to RSTP message
   * Used when upgrading from STP to RSTP
   */
  public static fromSTP(message: SpanningTreeMessage): RSTPMessage {
    const rstpMsg = Object.create(RSTPMessage.prototype);
    Object.assign(rstpMsg, message);
    rstpMsg.version = 2;
    // Initialize RSTP-specific flags
    rstpMsg.flags.proposal = false;
    rstpMsg.flags.agreement = false;
    rstpMsg.flags.forwarding = false;
    rstpMsg.flags.learning = false;
    rstpMsg.flags.portRole = SpanningTreePortRole.Disabled;
    return rstpMsg;
  }

  /**
   * Create RSTP Builder extending STP Builder
   */
  public static override Builder = class extends SpanningTreeMessage.Builder {
    private proposal = false;

    private agreement = false;

    private forwarding = false;

    private learning = false;

    private portRole = SpanningTreePortRole.Disabled;

    public setProposal(proposal: boolean): this {
      this.proposal = proposal;
      return this;
    }

    public setAgreement(agreement: boolean): this {
      this.agreement = agreement;
      return this;
    }

    public setForwarding(forwarding: boolean): this {
      this.forwarding = forwarding;
      return this;
    }

    public setLearning(learning: boolean): this {
      this.learning = learning;
      return this;
    }

    public setPortRole(role: SpanningTreePortRole): this {
      this.portRole = role;
      return this;
    }

    public override build(): RSTPMessage {
      // Build base STP message first
      const stpMessage = super.build();

      // Convert to RSTP message (preserves prototype correctly)
      const message = Object.assign(
        Object.create(RSTPMessage.prototype),
        stpMessage
      ) as RSTPMessage;

      // Override version to 2 for RSTP
      message.version = 2;

      // Set RSTP-specific flags (override STP flags)
      message.flags = {
        topologyChange: false,
        topologyChangeAck: false,
        proposal: this.proposal,
        agreement: this.agreement,
        forwarding: this.forwarding,
        learning: this.learning,
        portRole: this.portRole,
      };

      return message;
    }
  };
}

/**
 * Abstract base class for all Spanning Tree Protocol implementations
 * Provides common interface for STP, PVST, R-PVST, and MSTP
 */
export abstract class SpanningTreeService
  extends NetworkServices<SwitchHost>
  implements DatalinkListener
{
  // Enable getter/setter will be overridden by each implementation
  // to maintain compatibility with the old API

  /**
   * Returns the protocol type implemented by this service
   */
  abstract getProtocolType(): SpanningTreeProtocol;

  /**
   * Returns the spanning tree state for a given interface
   * @param vlanId Optional VLAN ID for per-VLAN protocols (PVST/RPVST)
   */
  abstract State(iface: Interface, vlanId?: number): SpanningTreeState;

  /**
   * Returns the spanning tree role for a given interface
   * @param vlanId Optional VLAN ID for per-VLAN protocols (PVST/RPVST)
   */
  abstract Role(iface: Interface, vlanId?: number): SpanningTreePortRole;

  /**
   * Returns the cost to reach the root bridge via this interface
   * @param vlanId Optional VLAN ID for per-VLAN protocols (PVST/RPVST)
   */
  abstract Cost(iface: Interface, vlanId?: number): number;

  /**
   * Returns the root bridge MAC address
   */
  abstract get Root(): MacAddress;

  /**
   * Returns this bridge's MAC address
   */
  abstract get BridgeId(): MacAddress;

  /**
   * Returns true if this bridge is the root bridge
   */
  abstract get IsRoot(): boolean;

  /**
   * Performs spanning tree negotiation (sends BPDUs)
   */
  abstract negociate(): void;

  /**
   * Receives and processes incoming frames
   */
  abstract receiveTrame(
    message: DatalinkMessage,
    from: Interface
  ): ActionHandle;

  /**
   * Cleans up resources when service is destroyed
   */
  abstract destroy(): void;
}

/**
 * IEEE 802.1D Spanning Tree Protocol (STP) implementation
 * Provides basic loop prevention using a single spanning tree for all VLANs
 */
export class STPService
  extends SpanningTreeService
  implements DatalinkListener
{
  protected roles = new Map<Interface, SpanningTreePortRole>();

  protected state = new Map<Interface, SpanningTreeState>();

  protected cost = new Map<Interface, number>();

  private bpduTimers = new Map<Interface, (() => void) | null>();

  private receivedBPDUs = new Map<Interface, SpanningTreeMessage>();

  protected maxAge = 20;

  protected helloTime = 2; // RFC 802.1D default: 2 seconds

  protected forwardDelay = 15;

  protected rootId = {
    mac: new MacAddress('FF:FF:FF:FF:FF:FF'),
    priority: 32768,
  };

  get Root(): MacAddress {
    return this.rootId.mac;
  }

  get BridgeId(): MacAddress {
    return this.bridgeId.mac;
  }

  get IsRoot(): boolean {
    return this.rootId.mac.equals(this.bridgeId.mac);
  }

  protected bridgeId = {
    mac: new MacAddress('FF:FF:FF:FF:FF:FF'),
    priority: 32768,
  };

  private repeatCleanup: (() => void) | null = null;

  // Track interfaces that already have event listeners
  private interfacesWithListeners: Set<HardwareInterface> = new Set();

  // Handler for interface up/down events (bound to preserve 'this')
  private handleInterfaceEvent = (msg: string) => {
    if (msg === 'OnInterfaceUp' || msg === 'OnInterfaceDown') {
      // Re-evaluate roles and states when interface goes up/down
      this.setDefaultRoot();
    }
  };

  constructor(host: SwitchHost, enabled: boolean = true) {
    super(host);

    host.addListener((msg) => {
      if (msg === 'OnInterfaceAdded') this.setDefaultRoot();
    });

    // Initialize bridge ID from existing interfaces
    // (interfaces may have been added before STP service was created)
    this.setDefaultRoot();

    // Use the Enable setter to properly register listeners
    // This calls super.Enable which manages listener registration
    this.Enable = enabled;

    const subscription = Scheduler.getInstance()
      .repeat(this.helloTime)
      .subscribe(() => this.negociate());
    this.repeatCleanup = () => subscription.unsubscribe();
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getProtocolType(): SpanningTreeProtocol {
    return SpanningTreeProtocol.STP;
  }

  public destroy(): void {
    if (this.repeatCleanup) {
      this.repeatCleanup();
      this.repeatCleanup = null;
    }

    // Cancel all BPDU aging timers
    this.bpduTimers.forEach((cleanup) => {
      if (cleanup) cleanup();
    });
    this.bpduTimers.clear();
  }

  public State(iface: Interface, _vlanId?: number): SpanningTreeState {
    // STP ignores vlanId (single tree for all VLANs)
    return this.state.get(iface) ?? SpanningTreeState.Disabled;
  }

  public Role(iface: Interface, _vlanId?: number): SpanningTreePortRole {
    // STP ignores vlanId (single tree for all VLANs)
    return this.roles.get(iface) ?? SpanningTreePortRole.Disabled;
  }

  public Cost(iface: Interface, _vlanId?: number): number {
    // STP ignores vlanId (single tree for all VLANs)
    return this.cost.get(iface) ?? Number.MAX_VALUE;
  }

  override set Enable(enable: boolean) {
    // Call parent to handle listener registration/unregistration
    super.Enable = enable;
    // Recalculate STP when enabled
    if (enable) {
      this.setDefaultRoot();
    }
  }

  override get Enable(): boolean {
    return this.enabled;
  }

  private setDefaultRoot(): void {
    // Save current root status and bridge ID for transition detection
    const wasRoot = this.IsRoot;
    const oldBridgeId = this.bridgeId.mac;

    // Find lowest MAC among all interfaces (bridge ID)
    let lowestMac = new MacAddress('FF:FF:FF:FF:FF:FF');
    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);
      const mac = iface.getMacAddress() as MacAddress;
      if (mac.compareTo(lowestMac) < 0) lowestMac = mac;
    });

    this.bridgeId.mac = lowestMac;

    // RFC 802.1D: Update rootId when:
    // 1. First boot (rootId is still FF:FF:FF:FF:FF:FF)
    // 2. We are currently root AND our bridge ID changed
    // 3. Our new bridge ID is better than our current root
    const isFirstBoot = this.rootId.mac.equals(
      new MacAddress('FF:FF:FF:FF:FF:FF')
    );
    const bridgeIdChanged = !oldBridgeId.equals(lowestMac);
    const bridgeBetterThanRoot = lowestMac.compareTo(this.rootId.mac) < 0;

    if (isFirstBoot || (wasRoot && bridgeIdChanged) || bridgeBetterThanRoot) {
      this.rootId.mac = lowestMac;
    }

    // Assign roles to interfaces
    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);

      // Add interface up/down listener only once per interface
      if (!this.interfacesWithListeners.has(iface)) {
        iface.addListener(this.handleInterfaceEvent);
        this.interfacesWithListeners.add(iface);
      }

      if (this.enabled) {
        if (this.roles.get(iface) === undefined) {
          // New interface: assign role based on current root status
          if (this.IsRoot) {
            this.changeRole(iface, SpanningTreePortRole.Designated);
            this.cost.set(iface, 0);
          } else {
            // Non-root: new interfaces start as Blocked until they receive BPDUs
            this.changeRole(iface, SpanningTreePortRole.Blocked);
            this.cost.set(iface, Number.MAX_VALUE);
          }
        } else {
          // Existing interface: re-sync state with role (handles up/down transitions)
          const currentRole = this.roles.get(iface);
          if (currentRole !== undefined) {
            this.changeRole(iface, currentRole);
          }
        }
      } else {
        this.changeRole(iface, SpanningTreePortRole.Disabled);
        this.roles.delete(iface);
        this.state.delete(iface);
        this.changingState.delete(iface);
      }
    });

    // RFC 802.1D: If we just became root, reassign Blocked ports to Designated
    const isNowRoot = this.IsRoot;
    if (!wasRoot && isNowRoot) {
      this.host.getInterfaces().forEach((i) => {
        const iface = this.host.getInterface(i);
        const role = this.Role(iface);
        if (
          role === SpanningTreePortRole.Blocked ||
          role === SpanningTreePortRole.Alternate ||
          role === SpanningTreePortRole.Backup
        ) {
          this.changeRole(iface, SpanningTreePortRole.Designated);
          this.cost.set(iface, 0);
        }
      });
    }
  }

  protected changingState: Map<HardwareInterface, (() => void) | null> =
    new Map();

  protected changeState(
    iface: HardwareInterface,
    state: SpanningTreeState,
    force: boolean = false
  ): void {
    const oldState = this.state.get(iface) ?? SpanningTreeState.Disabled;
    this.state.set(iface, state);

    if (state !== oldState || force) {
      const existing = this.changingState.get(iface);
      if (existing) existing();

      switch (state) {
        case SpanningTreeState.Blocking:
          // RFC 802.1D: Blocked ports remain blocked until topology event
          // (becoming root port or designated port based on BPDU comparison)
          // No automatic transition after timer
          break;
        case SpanningTreeState.Listening: {
          const subscription = Scheduler.getInstance()
            .once(this.forwardDelay)
            .subscribe(() => {
              this.changeState(iface, SpanningTreeState.Learning);
            });
          this.changingState.set(iface, () => subscription.unsubscribe());
          break;
        }
        case SpanningTreeState.Learning: {
          const subscription = Scheduler.getInstance()
            .once(this.forwardDelay)
            .subscribe(() => {
              this.changeState(iface, SpanningTreeState.Forwarding);
            });
          this.changingState.set(iface, () => subscription.unsubscribe());
          break;
        }
        case SpanningTreeState.Forwarding:
          break;
        default:
          break;
      }
      // Notify React listeners about state change
      iface.trigger('OnInterfaceChange');
    }
  }

  protected changeRole(
    iface: HardwareInterface,
    role: SpanningTreePortRole
  ): void {
    // RFC 802.1D: Root bridge ports can ONLY be Designated or Disabled
    // Root bridge must never have Blocked/Alternate/Backup ports
    if (this.IsRoot) {
      if (
        role !== SpanningTreePortRole.Designated &&
        role !== SpanningTreePortRole.Disabled
      ) {
        return; // Silently reject invalid role assignment
      }
    }

    this.roles.set(iface, role);

    // RFC 802.1D: Interface down → Disabled state regardless of role
    if (!iface.isActive()) {
      this.changeState(iface, SpanningTreeState.Disabled);
      return;
    }

    // RFC 802.1D: Always synchronize state with role (even if role unchanged)
    // This fixes cases where port has correct role but wrong state
    switch (role) {
      case SpanningTreePortRole.Backup:
      case SpanningTreePortRole.Blocked:
      case SpanningTreePortRole.Alternate:
        // RFC 802.1D: Non-forwarding roles → Blocking state
        this.changeState(iface, SpanningTreeState.Blocking, true);
        break;
      case SpanningTreePortRole.Root:
      case SpanningTreePortRole.Designated: {
        // RFC 802.1D: Forwarding roles → Listening → Learning → Forwarding
        // Only transition to Listening if not already in forwarding state chain
        const currentState = this.State(iface);
        if (
          currentState !== SpanningTreeState.Listening &&
          currentState !== SpanningTreeState.Learning &&
          currentState !== SpanningTreeState.Forwarding
        ) {
          this.changeState(iface, SpanningTreeState.Listening);
        }
        break;
      }
      case SpanningTreePortRole.Disabled:
        this.changeState(iface, SpanningTreeState.Disabled);
        break;
      default:
        break;
    }
  }

  /**
   * Convert port name to port ID using hash function
   * Same algorithm as Builder.setPort() (lines 117-128)
   * Returns absolute value to ensure positive port IDs
   */
  public static getPortId(portName: string): number {
    let hash = 0;
    for (let i = 0; i < portName.length; i += 1) {
      hash = portName.charCodeAt(i) + (hash << 5) - hash;
    }
    return Math.abs(hash);
  }

  /**
   * Compare BPDU priority: returns true if 'message' is better (should be designated)
   * RFC 802.1D comparison order:
   * 1. Root Bridge ID (priority + MAC) - lower is better
   * 2. Root Path Cost - lower is better
   * 3. Sender Bridge ID (priority + MAC) - lower is better
   * 4. Sender Port ID - lower is better
   */
  private static isBetterBPDU(
    message: SpanningTreeMessage,
    myCost: number,
    myBridgeId: { priority: number; mac: MacAddress },
    myRootId: { priority: number; mac: MacAddress },
    myPortId: number
  ): boolean {
    // 1. Compare root priority (lower is better)
    if (message.rootId.priority < myRootId.priority) return true;
    if (message.rootId.priority > myRootId.priority) return false;

    // 2. Compare root MAC (lower is better)
    const rootMacCompare = message.rootId.mac.compareTo(myRootId.mac);
    if (rootMacCompare < 0) return true;
    if (rootMacCompare > 0) return false;

    // 3. Compare root path cost (lower is better)
    if (message.rootPathCost < myCost) return true;
    if (message.rootPathCost > myCost) return false;

    // 4. Compare sender bridge priority (lower is better)
    if (message.bridgeId.priority < myBridgeId.priority) return true;
    if (message.bridgeId.priority > myBridgeId.priority) return false;

    // 5. Compare sender bridge MAC (lower is better)
    const macCompare = message.bridgeId.mac.compareTo(myBridgeId.mac);
    if (macCompare < 0) return true;
    if (macCompare > 0) return false;

    // 6. Compare sender port ID (lower is better)
    return message.portId.globalId < myPortId;
  }

  public negociate(): void {
    if (!this.enabled) return;

    const isRoot = this.rootId.mac.equals(this.bridgeId.mac);

    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);
      if (iface.isActive() === false || iface.isConnected === false) return;

      let role = this.Role(iface);

      // RFC 802.1D: Re-evaluate Blocked/Alternate/Backup ports with expired BPDUs
      // If cost is MAX_VALUE, the BPDU timer expired (neighbor died or stopped sending)
      // This port should become Designated since there's no longer a better BPDU
      if (
        (role === SpanningTreePortRole.Blocked ||
          role === SpanningTreePortRole.Alternate ||
          role === SpanningTreePortRole.Backup) &&
        this.cost.get(iface) === Number.MAX_VALUE
      ) {
        // Neighbor is dead or stopped sending BPDUs - become Designated
        this.changeRole(iface, SpanningTreePortRole.Designated);
        this.cost.set(iface, 0);
        // Update role variable to reflect the change
        role = SpanningTreePortRole.Designated;
      }

      // Blocked/Alternate/Backup roles don't send BPDUs
      if (
        role === SpanningTreePortRole.Blocked ||
        role === SpanningTreePortRole.Alternate ||
        role === SpanningTreePortRole.Backup
      ) {
        return;
      }

      // Root sends on all ports except blocked
      // Non-root sends only on designated ports
      if (isRoot || role === SpanningTreePortRole.Designated) {
        // RFC 802.1D: Advertise cost to reach root via best path
        let advertisedCost = 0;
        if (!isRoot) {
          // Find root port and use its cost
          const rootPortEntry = Array.from(this.roles.entries()).find(
            ([_, portRole]) => portRole === SpanningTreePortRole.Root
          );
          if (rootPortEntry) {
            advertisedCost = this.Cost(rootPortEntry[0]);
          }
        }

        const message = new SpanningTreeMessage.Builder()
          .setMacSource(iface.getMacAddress() as MacAddress)
          .setBridge(this.bridgeId.mac)
          .setRoot(this.rootId.mac)
          .setPort(i)
          .setCost(advertisedCost) // RFC 802.1D: Cost to root via best path
          .setMessageAge(0) // RFC 802.1D: BPDUs generated by this bridge start with age 0
          .build();

        iface.sendTrame(message);
      }
    });
  }

  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {
    if (message instanceof SpanningTreeMessage) {
      // RFC 802.1D Section 8.6.4: Discard BPDU if messageAge >= maxAge
      if (message.messageAge >= this.maxAge) {
        return ActionHandle.Stop;
      }
      if (message.bridgeId.mac.equals(this.bridgeId.mac))
        return ActionHandle.Stop;

      // RFC 802.1D Section 8.6.4: Reset BPDU aging timer for this port
      const existingTimer = this.bpduTimers.get(from);
      if (existingTimer) existingTimer(); // Cancel old timer

      const subscription = Scheduler.getInstance()
        .once(this.maxAge)
        .subscribe(() => {
          // BPDU timeout - this port hasn't received BPDUs for maxAge seconds
          // Clear cost and check if we need to recompute spanning tree
          const wasRootPort =
            this.Role(from as HardwareInterface) === SpanningTreePortRole.Root;

          this.cost.set(from, Number.MAX_VALUE);

          // If this was the root port, we lost connection to root
          if (wasRootPort && !this.IsRoot) {
            // Clear root information and assume we're root until we hear otherwise
            this.rootId.mac = this.bridgeId.mac;
            this.rootId.priority = this.bridgeId.priority;

            // Reassign all ports to Designated (will be corrected if we receive BPDUs)
            this.host.getInterfaces().forEach((i) => {
              const iface = this.host.getInterface(i);
              if (iface.isActive() && iface.isConnected) {
                this.changeRole(iface, SpanningTreePortRole.Designated);
                this.cost.set(iface, 0);
              }
            });
          }
        });

      this.bpduTimers.set(from, () => subscription.unsubscribe());

      // RFC 802.1D: Check if we need to update root bridge
      // Save current root status before updates
      const wasRoot = this.IsRoot;

      // We have a new root (lower priority wins):
      if (
        message.rootId.priority < this.rootId.priority ||
        (this.rootId.priority === message.rootId.priority &&
          message.rootId.mac.compareTo(this.rootId.mac) < 0)
      ) {
        // Check if root actually changed (not just receiving same BPDU again)
        const rootChanged =
          !this.rootId.mac.equals(message.rootId.mac) ||
          this.rootId.priority !== message.rootId.priority;

        this.rootId.mac = message.rootId.mac;
        this.rootId.priority = message.rootId.priority;

        this.forwardDelay = message.forwardDelay;
        this.helloTime = message.helloTime;
        this.maxAge = message.maxAge;

        // Only clear costs if root actually changed
        if (rootChanged) {
          this.cost.clear();
          this.receivedBPDUs.clear();
        }
      }

      // RFC 802.1D: If we just BECAME root (better root disappeared),
      // reassign all Blocked/Alternate/Backup ports to Designated
      const isNowRoot = this.IsRoot;
      if (!wasRoot && isNowRoot) {
        this.host.getInterfaces().forEach((i) => {
          const iface = this.host.getInterface(i);
          if (iface.isActive() === false || iface.isConnected === false) return;

          const role = this.Role(iface);
          if (
            role === SpanningTreePortRole.Blocked ||
            role === SpanningTreePortRole.Alternate ||
            role === SpanningTreePortRole.Backup
          ) {
            // Reassign to Designated - changeRole() will update state
            this.changeRole(iface, SpanningTreePortRole.Designated);
            this.cost.set(iface, 0);
          }
        });
      }

      // Update cost if we receive BPDU from same root
      if (this.rootId.mac.equals(message.rootId.mac)) {
        // Root bridge never updates costs from BPDUs - it IS the root
        if (this.IsRoot) return ActionHandle.Handled;

        // Update port cost: received cost + link cost (simplified to 10)
        const newCost = message.rootPathCost + 10;
        this.cost.set(from, newCost);

        // Store received BPDU for tie-breaking in root port selection
        this.receivedBPDUs.set(from, message);
      }

      // I'm not the root
      if (this.bridgeId.mac.equals(this.rootId.mac) === false) {
        let bestInterface!: HardwareInterface;
        let bestCost = Number.MAX_VALUE;
        let bestBPDU: SpanningTreeMessage | undefined;

        // RFC 802.1D Section 8.6.5: Root Port Selection with Tie-Breaking
        this.host.getInterfaces().forEach((i) => {
          const iface = this.host.getInterface(i);
          if (iface.isActive() === false || iface.isConnected === false) return;

          const interfaceCost = this.Cost(iface);
          const bpdu = this.receivedBPDUs.get(iface);
          if (!bpdu) return; // No BPDU received on this port

          if (interfaceCost < bestCost) {
            // Better cost - select this port
            bestInterface = iface;
            bestCost = interfaceCost;
            bestBPDU = bpdu;
          } else if (interfaceCost === bestCost && bestBPDU) {
            // Tie in cost - use tie-breakers per RFC 802.1D

            // Tie-breaker 1: Sender bridge priority (lower wins)
            if (bpdu.bridgeId.priority < bestBPDU.bridgeId.priority) {
              bestInterface = iface;
              bestBPDU = bpdu;
            } else if (bpdu.bridgeId.priority === bestBPDU.bridgeId.priority) {
              // Tie-breaker 2: Sender bridge MAC (lower wins)
              const macCompare = bpdu.bridgeId.mac.compareTo(
                bestBPDU.bridgeId.mac
              );
              if (macCompare < 0) {
                bestInterface = iface;
                bestBPDU = bpdu;
              } else if (macCompare === 0) {
                // Tie-breaker 3: Sender port ID (lower wins)
                if (bpdu.portId.globalId < bestBPDU.portId.globalId) {
                  bestInterface = iface;
                  bestBPDU = bpdu;
                } else if (bpdu.portId.globalId === bestBPDU.portId.globalId) {
                  // Tie-breaker 4: Receiver port ID (lower wins)
                  const currentPortId = STPService.getPortId(i);
                  const bestInterfaceName = this.host
                    .getInterfaces()
                    .find(
                      (name) => this.host.getInterface(name) === bestInterface
                    );
                  const bestPortId = bestInterfaceName
                    ? STPService.getPortId(bestInterfaceName)
                    : 0;

                  if (currentPortId < bestPortId) {
                    bestInterface = iface;
                    bestBPDU = bpdu;
                  }
                }
              }
            }
          }
        });

        if (bestInterface) {
          // Assign root port
          if (this.Role(bestInterface) !== SpanningTreePortRole.Root) {
            this.changeRole(bestInterface, SpanningTreePortRole.Root);
          }

          // For ports that WERE root but aren't anymore, reset to designated
          // (they will be re-evaluated when they receive BPDUs)
          this.host.getInterfaces().forEach((i) => {
            const iface = this.host.getInterface(i);
            if (iface.isActive() === false || iface.isConnected === false)
              return;

            if (
              iface !== bestInterface &&
              this.Role(iface) === SpanningTreePortRole.Root
            ) {
              this.changeRole(iface, SpanningTreePortRole.Designated);
            }
          });
        }

        const hasRoot = this.host
          .getInterfaces()
          .find(
            (i) =>
              this.roles.get(this.host.getInterface(i)) ===
              SpanningTreePortRole.Root
          );
        if (
          hasRoot &&
          this.Role(from as HardwareInterface) !== SpanningTreePortRole.Root
        ) {
          const iface = from as HardwareInterface;

          // RFC 802.1D: Compare received BPDU with what we would advertise
          // We advertise: cost to reach root via our root port (bestCost)
          const interfaceName = this.host
            .getInterfaces()
            .find((name) => this.host.getInterface(name) === iface);
          const myPortId = interfaceName
            ? STPService.getPortId(interfaceName)
            : 0;

          if (
            STPService.isBetterBPDU(
              message,
              bestCost, // RFC 802.1D: Cost we would advertise (root port cost)
              this.bridgeId,
              this.rootId,
              myPortId
            )
          ) {
            this.changeRole(iface, SpanningTreePortRole.Blocked);
          } else {
            this.changeRole(iface, SpanningTreePortRole.Designated);
          }
        }

        // RFC 802.1D: Non-root bridges do NOT forward/relay received BPDUs
        // They only generate and send their own BPDUs on designated ports (via negociate())
      }

      return ActionHandle.Handled;
    }

    if (this.State(from as HardwareInterface) === SpanningTreeState.Blocking)
      return ActionHandle.Stop;

    return ActionHandle.Continue;
  }
}

/**
 * RSTP (Rapid Spanning Tree Protocol) - IEEE 802.1w
 * Extends STP with rapid convergence (1-3s vs 30-50s)
 * Features: Proposal/Agreement, edge port auto-detection, point-to-point link detection
 */
export class RSTPService extends STPService implements DatalinkListener {
  // RSTP-specific state tracking
  private edgePorts = new Map<Interface, boolean>(); // Auto-detected edge ports

  private edgeDetectionTimers = new Map<Interface, (() => void) | null>(); // 3s timers

  private lastBpduReceived = new Map<Interface, number>(); // Timestamp for edge detection

  private proposedPorts = new Set<Interface>(); // Ports awaiting agreement

  private stpNeighbors = new Set<Interface>(); // Neighbors running STP (not RSTP)

  private linkType = new Map<Interface, 'point-to-point' | 'shared'>(); // Duplex detection

  constructor(host: SwitchHost, enabled: boolean = true) {
    super(host, enabled);
    // Initialize edge port detection for all interfaces
    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);
      this.startEdgeDetection(iface);
    });
  }

  public override getProtocolType(): SpanningTreeProtocol {
    return SpanningTreeProtocol.RSTP;
  }

  /**
   * Start edge port auto-detection timer (3 seconds without BPDU = edge port)
   */
  private startEdgeDetection(iface: Interface): void {
    // Cancel existing timer if any
    const existingTimer = this.edgeDetectionTimers.get(iface);
    if (existingTimer) existingTimer();

    // Mark as non-edge initially
    this.edgePorts.set(iface, false);

    // Start 3-second timer
    const subscription = Scheduler.getInstance()
      .once(3)
      .subscribe(() => {
        // If no BPDU received in 3 seconds, mark as edge port
        const lastBpdu = this.lastBpduReceived.get(iface) || 0;
        const now = Scheduler.getInstance().getDeltaTime();
        if (now - lastBpdu >= Scheduler.getInstance().getDelay(3)) {
          this.edgePorts.set(iface, true);
          // Edge port can forward immediately
          const role = this.Role(iface);
          if (role === SpanningTreePortRole.Designated) {
            this.changeState(
              iface as HardwareInterface,
              SpanningTreeState.Forwarding
            );
          }
        }
      });

    this.edgeDetectionTimers.set(iface, () => subscription.unsubscribe());
  }

  /**
   * Detect link type based on interface duplex mode
   */
  private detectLinkType(
    iface: HardwareInterface
  ): 'point-to-point' | 'shared' {
    // Simplified: check if interface has duplex property
    // In real implementation, check actual duplex mode
    // For now, assume all full-duplex = point-to-point
    const hardwareIface = iface as HardwareInterface & { duplex?: string };
    if (hardwareIface.duplex === 'half') {
      return 'shared';
    }
    // Default to point-to-point (most modern switches are full-duplex)
    return 'point-to-point';
  }

  /**
   * Synchronize: block all non-edge designated ports except the specified port
   * This is the core of RSTP rapid convergence
   */
  private synchronize(exceptPort: Interface): void {
    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);

      // Don't block: the port that triggered sync, edge ports, or non-designated ports
      if (iface === exceptPort) return;
      if (this.edgePorts.get(iface)) return; // Edge ports stay forwarding
      if (this.Role(iface) !== SpanningTreePortRole.Designated) return;

      // Block designated ports temporarily
      this.changeState(iface, SpanningTreeState.Blocking);
    });
  }

  /**
   * Override changeState to support rapid transitions for edge ports and proposals
   */
  protected override changeState(
    iface: HardwareInterface,
    state: SpanningTreeState,
    force: boolean = false
  ): void {
    // If edgePorts not initialized yet (during parent constructor), use STP behavior
    if (!this.edgePorts) {
      super.changeState(iface, state, force);
      return;
    }

    // If edge port transitioning to Designated role, skip timers
    if (this.edgePorts.get(iface) && state === SpanningTreeState.Forwarding) {
      const oldState = this.State(iface);
      this.state.set(iface, state);
      if (state !== oldState || force) {
        iface.trigger('OnInterfaceChange');
      }
      return;
    }

    // Otherwise, use standard STP state machine
    super.changeState(iface, state, force);
  }

  /**
   * Override negociate to send RSTP BPDUs (version 2) with proposal flag
   */
  public override negociate(): void {
    if (!this.enabled) return;

    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);
      if (iface.isActive() === false || iface.isConnected === false) return;

      const role = this.Role(iface);

      // Only send BPDUs on Root and Designated ports (same as STP)
      if (
        role !== SpanningTreePortRole.Root &&
        role !== SpanningTreePortRole.Designated
      ) {
        return;
      }

      // Detect link type
      this.linkType.set(iface, this.detectLinkType(iface));

      // Build RSTP BPDU (version 2)
      const message = new RSTPMessage.Builder()
        .setMacSource(iface.getMacAddress() as MacAddress)
        .setBridge(this.bridgeId.mac)
        .setRoot(this.rootId.mac)
        .setPort(i)
        .setCost(role === SpanningTreePortRole.Root ? this.Cost(iface) : 0)
        .setPortRole(role)
        .setForwarding(this.State(iface) === SpanningTreeState.Forwarding)
        .setLearning(
          this.State(iface) === SpanningTreeState.Learning ||
            this.State(iface) === SpanningTreeState.Forwarding
        )
        .build();

      // Set proposal flag for designated ports on point-to-point links
      if (
        role === SpanningTreePortRole.Designated &&
        this.linkType.get(iface) === 'point-to-point' &&
        !this.stpNeighbors.has(iface)
      ) {
        message.flags.proposal = true;
        // Track that we sent a proposal on this port
        this.proposedPorts.add(iface);
      }

      iface.sendTrame(message);
    });
  }

  /**
   * Override receiveTrame to handle RSTP proposal/agreement
   */
  public override receiveTrame(
    message: DatalinkMessage,
    from: Interface
  ): ActionHandle {
    // Handle RSTP messages
    if (message instanceof RSTPMessage) {
      this.onBpduReceived(from);

      // Check if neighbor is running STP or RSTP
      if (message.version === 0) {
        // Neighbor is running STP - add to STP neighbors list
        this.stpNeighbors.add(from);
      } else {
        // Remove from STP neighbors if it was there
        this.stpNeighbors.delete(from);
      }

      // Handle Proposal flag
      if (message.flags.proposal) {
        // Synchronize all non-edge designated ports
        this.synchronize(from);

        // Send Agreement response
        const agreement = new RSTPMessage.Builder()
          .setMacSource(
            (from as HardwareInterface).getMacAddress() as MacAddress
          )
          .setBridge(this.bridgeId.mac)
          .setRoot(this.rootId.mac)
          .setPort(from.toString())
          .setCost(this.Cost(from))
          .setPortRole(this.Role(from))
          .setAgreement(true)
          .build();

        (from as HardwareInterface).sendTrame(agreement);
      }

      // Handle Agreement flag
      if (message.flags.agreement && this.proposedPorts.has(from)) {
        // Agreement received - transition to forwarding immediately
        this.proposedPorts.delete(from);
        this.changeState(
          from as HardwareInterface,
          SpanningTreeState.Forwarding
        );
      }
    }

    // If standard STP message, mark neighbor as STP-only
    if (
      message instanceof SpanningTreeMessage &&
      !(message instanceof RSTPMessage)
    ) {
      this.stpNeighbors.add(from);
      this.onBpduReceived(from);
    }

    // Call parent STP processing for root election, etc.
    return super.receiveTrame(message, from);
  }

  /**
   * Called when BPDU is received on a port
   * Resets edge detection timer (port is not edge if it receives BPDUs)
   */
  private onBpduReceived(iface: Interface): void {
    // Update last BPDU received timestamp
    this.lastBpduReceived.set(iface, Scheduler.getInstance().getDeltaTime());

    // If port was marked as edge, disable edge status
    if (this.edgePorts.get(iface)) {
      this.edgePorts.set(iface, false);
    }

    // Restart edge detection timer
    this.startEdgeDetection(iface);
  }

  /**
   * Cleanup timers on destroy
   */
  public override destroy(): void {
    // Cancel all edge detection timers
    this.edgeDetectionTimers.forEach((cleanup) => {
      if (cleanup) cleanup();
    });
    this.edgeDetectionTimers.clear();

    // Call parent cleanup
    super.destroy();
  }
}

/**
 * PVST (Per-VLAN Spanning Tree) Service
 * Maintains one independent spanning tree per VLAN for load balancing
 * Uses standard STP (802.1D) convergence, not rapid (802.1w)
 */
export class PVSTService
  extends SpanningTreeService
  implements DatalinkListener
{
  // Map: VLAN ID → Independent STP instance for that VLAN
  private vlanTrees = new Map<number, STPService>();

  // Cleanup functions for timers and subscriptions
  private cleanups: (() => void)[] = [];

  constructor(host: SwitchHost, enabled: boolean = true) {
    super(host);

    // Listen for interface additions to update VLAN trees
    host.addListener((msg) => {
      if (msg === 'OnInterfaceAdded') {
        this.initializeVlanTrees();
      }
    });

    // Use the Enable setter to properly register listeners
    this.Enable = enabled;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getProtocolType(): SpanningTreeProtocol {
    return SpanningTreeProtocol.PVST;
  }

  /**
   * Discover all VLANs from host configuration and interface settings
   */
  private discoverVlans(): number[] {
    const vlans = new Set<number>();

    // 1. From host.knownVlan registry
    Object.keys(this.host.knownVlan).forEach((id) => {
      vlans.add(parseInt(id, 10));
    });

    // 2. From interface configurations
    this.host.getInterfaces().forEach((name) => {
      const iface = this.host.getInterface(name);
      if ('Vlan' in iface) {
        const dot1qIface = iface as unknown as {
          Vlan: number[];
          NativeVlan: number;
        };
        dot1qIface.Vlan.forEach((vlanId) => vlans.add(vlanId));
        if (dot1qIface.NativeVlan) vlans.add(dot1qIface.NativeVlan);
      }
    });

    return Array.from(vlans);
  }

  /**
   * Initialize or update VLAN spanning tree instances
   */
  private initializeVlanTrees(): void {
    const vlans = this.discoverVlans();

    // Create missing VLAN trees
    vlans.forEach((vlanId) => {
      if (!this.vlanTrees.has(vlanId)) {
        const stpInstance = new STPService(this.host, this.enabled);
        this.vlanTrees.set(vlanId, stpInstance);
      }
    });

    // TODO: Remove trees for VLANs that no longer exist?
    // For now, keep them to avoid state loss
  }

  /**
   * Get VLAN ID for a given interface and message
   */
  private static getVlanId(message: DatalinkMessage, iface: Interface): number {
    // Check if message is VLAN-tagged
    if ('vlanId' in message && typeof message.vlanId === 'number') {
      return message.vlanId;
    }

    // Extract from interface configuration
    if ('Vlan' in iface && 'NativeVlan' in iface) {
      const dot1qIface = iface as unknown as {
        Vlan: number[];
        NativeVlan: number;
        VlanMode: number;
      };

      // Access mode: use first VLAN
      if (dot1qIface.VlanMode === 0) {
        // VlanMode.Access = 0
        return dot1qIface.Vlan[0] ?? dot1qIface.NativeVlan;
      }

      // Trunk mode: use native VLAN for untagged
      return dot1qIface.NativeVlan;
    }

    return 0; // Default VLAN
  }

  public State(iface: Interface, vlanId?: number): SpanningTreeState {
    if (!this.enabled) return SpanningTreeState.Disabled;

    // If no VLAN specified, use default/first VLAN
    let vlan = vlanId;
    if (vlan === undefined) {
      const vlans = this.discoverVlans();
      vlan = vlans[0] ?? 0;
    }

    const tree = this.vlanTrees.get(vlan);
    return tree?.State(iface) ?? SpanningTreeState.Disabled;
  }

  public Role(iface: Interface, vlanId?: number): SpanningTreePortRole {
    if (!this.enabled) return SpanningTreePortRole.Disabled;

    let vlan = vlanId;
    if (vlan === undefined) {
      const vlans = this.discoverVlans();
      vlan = vlans[0] ?? 0;
    }

    const tree = this.vlanTrees.get(vlan);
    return tree?.Role(iface) ?? SpanningTreePortRole.Disabled;
  }

  public Cost(iface: Interface, vlanId?: number): number {
    if (!this.enabled) return Number.MAX_VALUE;

    let vlan = vlanId;
    if (vlan === undefined) {
      const vlans = this.discoverVlans();
      vlan = vlans[0] ?? 0;
    }

    const tree = this.vlanTrees.get(vlan);
    return tree?.Cost(iface) ?? Number.MAX_VALUE;
  }

  get Root(): MacAddress {
    // For PVST, "Root" concept is per-VLAN
    // Return root of first VLAN for backward compatibility
    const firstTree = Array.from(this.vlanTrees.values())[0];
    return firstTree?.Root ?? new MacAddress('FF:FF:FF:FF:FF:FF');
  }

  get BridgeId(): MacAddress {
    // Bridge ID is shared across all VLANs
    const firstTree = Array.from(this.vlanTrees.values())[0];
    return firstTree?.BridgeId ?? new MacAddress('FF:FF:FF:FF:FF:FF');
  }

  get IsRoot(): boolean {
    // Switch is "root" if it's root for at least one VLAN
    return Array.from(this.vlanTrees.values()).some((tree) => tree.IsRoot);
  }

  public negociate(): void {
    if (!this.enabled) return;

    // Each VLAN tree negotiates independently
    this.vlanTrees.forEach((tree) => {
      // Get original BPDUs from STP instance
      tree.negociate();
    });
  }

  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {
    if (!this.enabled) return ActionHandle.Continue;

    // Check if this is a PVST BPDU
    if (message instanceof PVSTMessage) {
      const { vlanId } = message;
      const tree = this.vlanTrees.get(vlanId);

      if (!tree) {
        // Unknown VLAN - ignore BPDU
        return ActionHandle.Stop;
      }

      // Delegate to appropriate VLAN tree
      return tree.receiveTrame(message, from);
    }

    // Check if this is a standard STP BPDU (treat as VLAN 0)
    if (message instanceof SpanningTreeMessage) {
      const tree =
        this.vlanTrees.get(0) ?? Array.from(this.vlanTrees.values())[0];
      return tree?.receiveTrame(message, from) ?? ActionHandle.Continue;
    }

    // Data frame - check STP state for the frame's VLAN
    const vlanId = PVSTService.getVlanId(message, from);
    const tree = this.vlanTrees.get(vlanId);

    if (tree) {
      const state = tree.State(from);
      if (state === SpanningTreeState.Blocking) {
        return ActionHandle.Stop;
      }
    }

    return ActionHandle.Continue;
  }

  override set Enable(enable: boolean) {
    // Call parent to handle listener registration/unregistration
    super.Enable = enable;

    // Initialize VLAN trees when enabled
    if (enable) {
      this.initializeVlanTrees();
    } else {
      // Disable all VLAN trees
      this.vlanTrees.forEach((tree) => {
        // eslint-disable-next-line no-param-reassign
        tree.Enable = false;
      });
    }
  }

  override get Enable(): boolean {
    return this.enabled;
  }

  public destroy(): void {
    // Destroy all VLAN tree instances
    this.vlanTrees.forEach((tree) => tree.destroy());
    this.vlanTrees.clear();

    // Cancel all cleanup timers
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
  }
}

/**
 * Factory function to create the appropriate spanning tree service
 * based on the requested protocol type
 */
export function createSpanningTreeService(
  protocol: SpanningTreeProtocol,
  host: SwitchHost
): SpanningTreeService {
  switch (protocol) {
    case SpanningTreeProtocol.None:
      // Return STP service but disabled, to maintain backward compatibility
      // This avoids service recreation when Enable is toggled
      return new STPService(host, false);
    case SpanningTreeProtocol.STP:
      return new STPService(host, true);
    case SpanningTreeProtocol.RSTP:
      // RSTP: Rapid Spanning Tree Protocol (IEEE 802.1w)
      return new RSTPService(host, true);
    case SpanningTreeProtocol.PVST:
      // PVST: Per-VLAN Spanning Tree (one tree per VLAN)
      return new PVSTService(host, true);
    case SpanningTreeProtocol.RPVST:
      // TODO: Implement Rapid PVST+ (802.1w + per-VLAN)
      throw new Error('R-PVST protocol not yet implemented');
    case SpanningTreeProtocol.MSTP:
      // TODO: Implement MSTP (802.1s)
      throw new Error('MSTP protocol not yet implemented');
    default:
      return new STPService(host, false);
  }
}

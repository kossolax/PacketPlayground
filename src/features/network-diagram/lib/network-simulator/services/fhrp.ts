/* eslint-disable no-param-reassign */
import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress, MacAddress } from '../address';
import type { NetworkInterface } from '../layers/network';
import { type NetworkMessage } from '../message';
import { ActionHandle, type NetworkListener } from '../protocols/base';
import {
  HSRPMessage,
  HSRPOpCode,
  HSRPState,
  HSRP_MULTICAST_IP,
  getHSRPVirtualMAC,
} from '../protocols/hsrp';
import { NetworkServices } from './dhcp';
import type { RouterHost } from '../nodes/router';

/**
 * HSRP Group Configuration
 * Each HSRP group has its own virtual IP, priority, and state
 */
export class HSRPGroup {
  public group: number = 0;

  public virtualIP: IPAddress = new IPAddress('0.0.0.0');

  public priority: number = 100;

  public preempt: boolean = false;

  public authentication: string = 'cisco';

  // Timers (in seconds)
  public hellotime: number = 3;

  public holdtime: number = 10;

  // Current state
  public state: HSRPState = HSRPState.Initial;

  // Active and Standby routers
  public activeRouter: IPAddress | null = null;

  public standbyRouter: IPAddress | null = null;

  // Last hello received from active router
  public lastActiveHello: number = 0;

  public lastStandbyHello: number = 0;

  constructor(group: number, virtualIP: IPAddress, priority: number = 100) {
    this.group = group;
    this.virtualIP = virtualIP;
    this.priority = priority;
  }

  public getVirtualMAC(): MacAddress {
    return new MacAddress(getHSRPVirtualMAC(this.group));
  }
}

/**
 * FHRP Service - First Hop Redundancy Protocol
 * Implements Cisco HSRP (Hot Standby Router Protocol) for router redundancy
 *
 * RFC 2281: HSRP provides default gateway redundancy by allowing multiple routers
 * to share a virtual IP address. One router is elected as Active (forwards traffic),
 * another as Standby (ready to take over), and others listen.
 */
export class FHRPService
  extends NetworkServices<RouterHost>
  implements NetworkListener
{
  // Map of interface to HSRP groups
  private groups = new Map<NetworkInterface, HSRPGroup[]>();

  // Hello timers for each interface/group
  private helloTimers = new Map<string, (() => void) | null>();

  // Holdtime timers to detect failures
  private holdtimeTimers = new Map<string, (() => void) | null>();

  constructor(host: RouterHost, enabled: boolean = false) {
    super(host);
    this.Enable = enabled;
  }

  /**
   * Add or update an HSRP group on an interface
   */
  public setGroup(
    iface: NetworkInterface,
    group: number,
    virtualIP: IPAddress,
    priority: number = 100
  ): void {
    if (!this.groups.has(iface)) {
      this.groups.set(iface, []);
    }

    const groups = this.groups.get(iface)!;
    const existingGroup = groups.find((g) => g.group === group);

    if (existingGroup) {
      existingGroup.virtualIP = virtualIP;
      existingGroup.priority = priority;
    } else {
      const hsrpGroup = new HSRPGroup(group, virtualIP, priority);
      groups.push(hsrpGroup);
    }

    // If service is enabled, start sending hellos
    if (this.enabled) {
      this.startHelloTimer(iface, group);
    }
  }

  /**
   * Remove an HSRP group from an interface
   */
  public removeGroup(iface: NetworkInterface, group: number): void {
    const groups = this.groups.get(iface);
    if (!groups) return;

    const index = groups.findIndex((g) => g.group === group);
    if (index >= 0) {
      groups.splice(index, 1);
      this.stopTimers(iface, group);
    }
  }

  /**
   * Get all HSRP groups for an interface
   */
  public getGroups(iface: NetworkInterface): HSRPGroup[] {
    return this.groups.get(iface) || [];
  }

  /**
   * Get a specific HSRP group
   */
  public getGroup(iface: NetworkInterface, group: number): HSRPGroup | null {
    const groups = this.groups.get(iface);
    if (!groups) return null;
    return groups.find((g) => g.group === group) || null;
  }

  /**
   * Enable/disable the FHRP service
   */
  public override set Enable(enable: boolean) {
    super.Enable = enable;

    if (enable) {
      // Start hello timers for all groups
      this.groups.forEach((groups, iface) => {
        groups.forEach((group) => {
          // RFC 2281: Initial state, learn virtual IP, then transition
          if (group.state === HSRPState.Initial) {
            this.transitionToListen(iface, group);
          }
          this.startHelloTimer(iface, group.group);
        });
      });
    } else {
      // Stop all timers
      this.helloTimers.forEach((cleanup) => {
        if (cleanup) cleanup();
      });
      this.helloTimers.clear();

      this.holdtimeTimers.forEach((cleanup) => {
        if (cleanup) cleanup();
      });
      this.holdtimeTimers.clear();
    }
  }

  /**
   * RFC 2281: State machine - transition to Listen state
   */
  private transitionToListen(iface: NetworkInterface, group: HSRPGroup): void {
    group.state = HSRPState.Listen;
    group.activeRouter = null;
    group.standbyRouter = null;

    // Start listening for hellos, wait for election
    this.scheduleHoldtimeCheck(iface, group);
  }

  /**
   * RFC 2281: State machine - transition to Speak state
   */
  private transitionToSpeak(iface: NetworkInterface, group: HSRPGroup): void {
    group.state = HSRPState.Speak;
    this.sendHello(iface, group);
  }

  /**
   * RFC 2281: State machine - transition to Standby state
   */
  private transitionToStandby(iface: NetworkInterface, group: HSRPGroup): void {
    group.state = HSRPState.Standby;
    this.sendHello(iface, group);
  }

  /**
   * RFC 2281: State machine - transition to Active state
   */
  private transitionToActive(iface: NetworkInterface, group: HSRPGroup): void {
    group.state = HSRPState.Active;
    group.activeRouter = iface.getNetAddress() as IPAddress;

    // Send gratuitous ARP for virtual IP (not implemented in this simulation)
    this.sendHello(iface, group);
  }

  /**
   * Start periodic hello timer for a group
   */
  private startHelloTimer(iface: NetworkInterface, groupNum: number): void {
    const key = `${iface.toString()}-${groupNum}`;
    const group = this.getGroup(iface, groupNum);
    if (!group) return;

    // Clean up existing timer
    const existing = this.helloTimers.get(key);
    if (existing) existing();

    // RFC 2281: Send hello messages every hellotime seconds
    const subscription = Scheduler.getInstance()
      .repeat(group.hellotime)
      .subscribe(() => {
        this.sendHello(iface, group);
        this.checkElection(iface, group);
      });

    this.helloTimers.set(key, () => subscription.unsubscribe());
  }

  /**
   * Stop all timers for a specific interface/group
   */
  private stopTimers(iface: NetworkInterface, groupNum: number): void {
    const key = `${iface.toString()}-${groupNum}`;

    const helloCleanup = this.helloTimers.get(key);
    if (helloCleanup) {
      helloCleanup();
      this.helloTimers.delete(key);
    }

    const holdCleanup = this.holdtimeTimers.get(key);
    if (holdCleanup) {
      holdCleanup();
      this.holdtimeTimers.delete(key);
    }
  }

  /**
   * Send HSRP hello message
   */
  private sendHello(iface: NetworkInterface, group: HSRPGroup): void {
    if (!this.enabled) return;

    const hello = new HSRPMessage.Builder()
      .setOpCode(HSRPOpCode.Hello)
      .setHSRPState(group.state)
      .setNetSource(iface.getNetAddress() as IPAddress)
      .setNetDestination(HSRP_MULTICAST_IP)
      .setPriority(group.priority)
      .setGroup(group.group)
      .setHellotime(group.hellotime)
      .setHoldtime(group.holdtime)
      .setVirtualIP(group.virtualIP)
      .setAuthData(group.authentication)
      .build()[0];

    iface.sendPacket(hello);
  }

  /**
   * RFC 2281: Check if we should participate in election
   */
  private checkElection(iface: NetworkInterface, group: HSRPGroup): void {
    const currentTime = Scheduler.getInstance().getDeltaTime();

    // Check if active router has failed (no hello within holdtime)
    if (group.activeRouter && group.lastActiveHello > 0) {
      const timeSinceActive = currentTime - group.lastActiveHello;
      if (timeSinceActive > Scheduler.getInstance().getDelay(group.holdtime)) {
        // Active router has failed
        group.activeRouter = null;

        // If we are standby, become active
        if (group.state === HSRPState.Standby) {
          this.transitionToActive(iface, group);
          return;
        }
      }
    }

    // Check if standby router has failed
    if (group.standbyRouter && group.lastStandbyHello > 0) {
      const timeSinceStandby = currentTime - group.lastStandbyHello;
      if (timeSinceStandby > Scheduler.getInstance().getDelay(group.holdtime)) {
        // Standby router has failed
        group.standbyRouter = null;

        // If we are in speak/listen, try to become standby
        if (
          group.state === HSRPState.Speak ||
          group.state === HSRPState.Listen
        ) {
          this.transitionToStandby(iface, group);
          return;
        }
      }
    }

    // RFC 2281: State machine logic
    switch (group.state) {
      case HSRPState.Initial:
      case HSRPState.Learn:
        this.transitionToListen(iface, group);
        break;

      case HSRPState.Listen:
        // If no active router, try to become active via speak
        if (!group.activeRouter) {
          this.transitionToSpeak(iface, group);
        }
        break;

      case HSRPState.Speak:
        // After speaking, either become standby or active
        if (!group.activeRouter) {
          this.transitionToActive(iface, group);
        } else if (!group.standbyRouter) {
          this.transitionToStandby(iface, group);
        }
        break;

      case HSRPState.Standby:
        // If active fails, become active
        if (!group.activeRouter) {
          this.transitionToActive(iface, group);
        }
        break;

      case HSRPState.Active:
        // Check for preemption - higher priority router can take over
        if (group.preempt && group.standbyRouter) {
          // In a real implementation, we'd check standby priority
          // For now, just maintain active state
        }
        break;

      default:
        // All HSRP states are handled above
        break;
    }
  }

  /**
   * Schedule holdtime check for detecting failures
   */
  private scheduleHoldtimeCheck(
    iface: NetworkInterface,
    group: HSRPGroup
  ): void {
    const key = `${iface.toString()}-${group.group}-hold`;

    const existing = this.holdtimeTimers.get(key);
    if (existing) existing();

    const subscription = Scheduler.getInstance()
      .repeat(1) // Check every second
      .subscribe(() => {
        this.checkElection(iface, group);
      });

    this.holdtimeTimers.set(key, () => subscription.unsubscribe());
  }

  /**
   * Process received HSRP messages
   */
  public receivePacket(
    message: NetworkMessage,
    from: NetworkInterface
  ): ActionHandle {
    if (!(message instanceof HSRPMessage)) {
      return ActionHandle.Continue;
    }

    // Find the group this message belongs to
    const groups = this.groups.get(from);
    if (!groups) return ActionHandle.Continue;

    const group = groups.find((g) => g.group === message.group);
    if (!group) return ActionHandle.Continue;

    // RFC 2281: Verify authentication
    if (group.authentication !== message.authData.trim()) {
      // Authentication failed, drop packet
      return ActionHandle.Stop;
    }

    const currentTime = Scheduler.getInstance().getDeltaTime();

    // Process based on message type
    switch (message.opCode) {
      case HSRPOpCode.Hello:
        this.processHello(from, group, message, currentTime);
        break;

      case HSRPOpCode.Coup:
        this.processCoup(from, group, message);
        break;

      case HSRPOpCode.Resign:
        this.processResign(from, group, message);
        break;

      default:
        // All HSRP message types are handled above
        break;
    }

    return ActionHandle.Handled;
  }

  /**
   * Process incoming Hello message
   */
  private processHello(
    iface: NetworkInterface,
    group: HSRPGroup,
    message: HSRPMessage,
    currentTime: number
  ): void {
    const senderIP = message.netSrc as IPAddress;

    // RFC 2281: Update active/standby tracking based on sender's state
    if (message.state === HSRPState.Active) {
      // Check if we should yield to higher priority active router
      if (!group.activeRouter || senderIP.equals(group.activeRouter)) {
        group.activeRouter = senderIP;
        group.lastActiveHello = currentTime;

        // If we were active but have lower priority, yield
        if (
          group.state === HSRPState.Active &&
          message.priority > group.priority
        ) {
          this.transitionToSpeak(iface, group);
        }
      } else if (message.priority > group.priority && group.preempt) {
        // Higher priority router is preempting
        group.activeRouter = senderIP;
        group.lastActiveHello = currentTime;
        if (group.state === HSRPState.Active) {
          this.transitionToStandby(iface, group);
        }
      }
    } else if (message.state === HSRPState.Standby) {
      if (!group.standbyRouter || senderIP.equals(group.standbyRouter)) {
        group.standbyRouter = senderIP;
        group.lastStandbyHello = currentTime;

        // If we were standby but have lower priority, yield
        if (
          group.state === HSRPState.Standby &&
          message.priority > group.priority
        ) {
          this.transitionToListen(iface, group);
        }
      }
    }
  }

  /**
   * Process Coup message (router wants to become active)
   */
  private processCoup(
    iface: NetworkInterface,
    group: HSRPGroup,
    message: HSRPMessage
  ): void {
    const senderIP = message.netSrc as IPAddress;

    // RFC 2281: Coup message forces active router change
    if (
      message.priority > group.priority ||
      (message.priority === group.priority && group.state !== HSRPState.Active)
    ) {
      group.activeRouter = senderIP;
      if (group.state === HSRPState.Active) {
        this.transitionToStandby(iface, group);
      }
    }
  }

  /**
   * Process Resign message (active router is shutting down)
   */
  private processResign(
    iface: NetworkInterface,
    group: HSRPGroup,
    message: HSRPMessage
  ): void {
    const senderIP = message.netSrc as IPAddress;

    // RFC 2281: If active router is resigning, standby takes over
    if (group.activeRouter?.equals(senderIP)) {
      group.activeRouter = null;
      if (group.state === HSRPState.Standby) {
        this.transitionToActive(iface, group);
      }
    } else if (group.standbyRouter?.equals(senderIP)) {
      group.standbyRouter = null;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.helloTimers.forEach((cleanup) => {
      if (cleanup) cleanup();
    });
    this.helloTimers.clear();

    this.holdtimeTimers.forEach((cleanup) => {
      if (cleanup) cleanup();
    });
    this.holdtimeTimers.clear();
  }
}

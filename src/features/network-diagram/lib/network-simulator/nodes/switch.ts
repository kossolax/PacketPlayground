import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import {
  Dot1QInterface,
  type HardwareInterface,
  type Interface,
} from '../layers/datalink';
import {
  ActionHandle,
  type DatalinkListener,
  handleChain,
} from '../protocols/base';
import { Node } from './generic';
import { DatalinkMessage } from '../message';
import {
  PVSTPService,
  SpanningTreeMessage,
  SpanningTreeState,
  SpanningTreePortRole,
} from '../services/spanningtree';
import { HardwareAddress, MacAddress } from '../address';
import { Dot1QMessage, EthernetMessage, VlanMode } from '../protocols/ethernet';
import { normalizeInterfaceName } from '../utils/interface-names';

export type MACTableEntry = { iface: HardwareInterface; lastSeen: number };

export class SwitchHost
  extends Node<HardwareInterface>
  implements DatalinkListener
{
  public override name = 'Switch';

  public override type = 'switch';

  // Modern callback pattern instead of RxJS Subject
  public onReceiveTrame?: (message: DatalinkMessage) => void;

  public knownVlan: Record<number, string> = {};

  public spanningTree: PVSTPService;

  private ARPTable: Map<string, MACTableEntry[]> = new Map<
    string,
    MACTableEntry[]
  >();

  private cleanupTimer: (() => void) | null = null;

  constructor(
    name: string = '',
    iface: number = 0,
    spanningTreeSupport: boolean = false
  ) {
    super();
    if (name !== '') this.name = name;

    for (let i = 0; i < iface; i += 1) this.addInterface();

    this.spanningTree = new PVSTPService(this);
    this.spanningTree.Enable = spanningTreeSupport;

    const subscription = Scheduler.getInstance()
      .repeat(10)
      .subscribe(() => {
        this.cleanARPTable();
      });
    this.cleanupTimer = () => subscription.unsubscribe();
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      this.cleanupTimer();
      this.cleanupTimer = null;
    }
  }

  public addInterface(name: string = ''): HardwareInterface {
    const mac = MacAddress.generateAddress();

    let interfaceName = name;
    if (interfaceName === '')
      interfaceName = `gig0/${Object.keys(this.interfaces).length}`;

    // Normalize interface name to full format for internal storage
    interfaceName = normalizeInterfaceName(interfaceName);

    const iface = new Dot1QInterface(this, mac, interfaceName, 10, 1000, true);
    iface.addListener(this);
    this.interfaces[interfaceName] = iface;
    handleChain('on', this.getListener, 'OnInterfaceAdded', iface);

    return iface;
  }

  public clone(): SwitchHost {
    const clone = new SwitchHost();
    this.applyCloneProperties(clone);
    this.cloneInterfaces(clone);
    return clone;
  }

  public send(message: string | DatalinkMessage, dst?: HardwareAddress): void {
    if (message instanceof DatalinkMessage) {
      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        if (
          this.interfaces[keys[i]].hasMacAddress(
            message.macSrc as HardwareAddress
          )
        ) {
          if (
            this.spanningTree.State(this.interfaces[keys[i]]) !==
            SpanningTreeState.Blocking
          ) {
            this.interfaces[keys[i]].sendTrame(message);
          }
        }
      }
    } else {
      if (dst === undefined)
        throw new Error('Destination address is undefined');
      const src = this.getInterface(0).getMacAddress();

      const msg = new DatalinkMessage(message, src, dst);

      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        if (
          this.interfaces[keys[i]].hasMacAddress(msg.macSrc as HardwareAddress)
        ) {
          if (
            this.spanningTree.State(this.interfaces[keys[i]]) !==
            SpanningTreeState.Blocking
          ) {
            this.interfaces[keys[i]].sendTrame(msg);
          }
        }
      }
    }
  }

  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {
    if (message instanceof SpanningTreeMessage) {
      return ActionHandle.Continue;
    }

    const sourceInterface = from as HardwareInterface;

    if (this.spanningTree.State(sourceInterface) === SpanningTreeState.Blocking)
      return ActionHandle.Stop;

    // Also check port role - non-forwarding roles drop all data frames
    const sourceRole = this.spanningTree.Role(sourceInterface);
    if (
      sourceRole === SpanningTreePortRole.Blocked ||
      sourceRole === SpanningTreePortRole.Alternate ||
      sourceRole === SpanningTreePortRole.Backup
    )
      return ActionHandle.Stop;

    if (
      this.spanningTree.State(sourceInterface) === SpanningTreeState.Listening
    )
      return ActionHandle.Handled;

    const src = message.macSrc as HardwareAddress;
    const dst = message.macDst as HardwareAddress;

    // Learn source MAC address
    this.learnMAC(src, sourceInterface);

    if (this.spanningTree.State(sourceInterface) === SpanningTreeState.Learning)
      return ActionHandle.Handled;

    let vlanId = (sourceInterface as Dot1QInterface).NativeVlan;
    if (message instanceof Dot1QMessage) {
      vlanId = message.vlanId;
    } else {
      const [firstVlan] = (sourceInterface as Dot1QInterface).Vlan;
      vlanId = firstVlan;
    }

    const interfaces: Dot1QInterface[] = [];
    if (dst.isBroadcast || this.ARPTable.get(dst.toString()) === undefined) {
      // Broadcast or unknown destination - flood to all interfaces in VLAN
      const keys = Object.keys(this.interfaces);
      for (let i = 0; i < keys.length; i += 1) {
        if (this.interfaces[keys[i]] !== sourceInterface) {
          if (
            (this.interfaces[keys[i]] as Dot1QInterface).Vlan.indexOf(
              vlanId
            ) !== -1
          )
            interfaces.push(this.interfaces[keys[i]] as Dot1QInterface);
        }
      }
    } else {
      // Unicast - send to specific interface(s)
      const entries = this.ARPTable.get(dst.toString());
      if (entries) {
        entries.forEach((entry) => {
          if (entry.iface !== sourceInterface) {
            if ((entry.iface as Dot1QInterface).Vlan.indexOf(vlanId) !== -1)
              interfaces.push(entry.iface as Dot1QInterface);
          }
        });
      }
    }

    // Forward to all target interfaces with proper VLAN tagging
    interfaces.forEach((iface) => {
      let msg: DatalinkMessage = message;

      // Check both state and role - non-forwarding roles/states drop frames
      if (this.spanningTree.State(iface) === SpanningTreeState.Blocking) return;

      const ifaceRole = this.spanningTree.Role(iface);
      if (
        ifaceRole === SpanningTreePortRole.Blocked ||
        ifaceRole === SpanningTreePortRole.Alternate ||
        ifaceRole === SpanningTreePortRole.Backup
      )
        return;

      if (iface.VlanMode === VlanMode.Trunk) {
        if (!(message instanceof Dot1QMessage)) {
          msg = new Dot1QMessage.Builder()
            .setMacSource(msg.macSrc as MacAddress)
            .setMacDestination(msg.macDst as MacAddress)
            .setVlan(vlanId)
            .setPayload(msg.payload)
            .build();
        }
      }
      if (iface.VlanMode === VlanMode.Access) {
        if (message instanceof Dot1QMessage) {
          msg = new EthernetMessage.Builder()
            .setMacSource(msg.macSrc as MacAddress)
            .setMacDestination(msg.macDst as MacAddress)
            .setPayload(msg.payload)
            .build();
        }
      }

      iface.sendTrame(msg);
    });

    // Propagate message to node's own listeners
    handleChain('receiveTrame', this.getListener, message, from);

    // Trigger callback if defined
    if (this.onReceiveTrame) {
      this.onReceiveTrame(message);
    }

    return ActionHandle.Continue;
  }

  private learnMAC(src: HardwareAddress, from: HardwareInterface): void {
    const key = src.toString();
    const currentTime = Scheduler.getInstance().getDeltaTime();
    let found = false;

    const entries = this.ARPTable.get(key);
    if (entries) {
      // Update existing entry by replacing it with new object
      const updatedEntries = entries.map((entry) => {
        if (entry.iface.getMacAddress().equals(from.getMacAddress())) {
          found = true;
          return { iface: entry.iface, lastSeen: currentTime };
        }
        return entry;
      });
      this.ARPTable.set(key, updatedEntries);
    }

    if (!found) {
      if (!this.ARPTable.get(key)) this.ARPTable.set(key, []);
      this.ARPTable.get(key)?.push({
        iface: from,
        lastSeen: currentTime,
      });
    }
  }

  private cleanARPTable(): void {
    const cleanDelay = Scheduler.getInstance().getDelay(60 * 5);

    const keys = Array.from(this.ARPTable.keys());
    keys.forEach((key) => {
      const interfaces = this.ARPTable.get(key);
      if (interfaces !== undefined) {
        let i = 0;
        while (i < interfaces.length) {
          const timeSinceLastSeen =
            Scheduler.getInstance().getDeltaTime() - interfaces[i].lastSeen;

          if (timeSinceLastSeen > cleanDelay) interfaces.splice(i, 1);
          else {
            i += 1;
          }
        }

        if (interfaces.length === 0) this.ARPTable.delete(key);
      }
    });
  }
}

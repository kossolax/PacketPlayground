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

enum SpanningTreePortRole {
  Disabled,
  Root,
  Designated,
  Blocked,
  Alternate,
  Backup,
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

      if (this.bridge.compareTo(this.root) < 0) this.root = this.bridge;

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
        let hash = 0;
        for (let i = 0; i < port.length; i += 1)
          hash = port.charCodeAt(i) + (hash << 5) - hash;
        this.port = hash;
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
      const message = new SpanningTreeMessage(
        this.payload,
        this.bridge,
        SpanningTreeMultiCastAddress
      );
      message.macSrc = this.macSrc as MacAddress;
      message.bridgeId.mac = this.bridge;
      message.rootId.mac = this.root;
      message.messageType = this.type;
      message.rootPathCost = this.cost;
      message.portId.globalId = this.port;
      message.messageAge =
        this.age > 0 ? this.age : Scheduler.getInstance().getDeltaTime();

      return message;
    }
  };
}

export class PVSTPService
  extends NetworkServices<SwitchHost>
  implements DatalinkListener
{
  private roles = new Map<Interface, SpanningTreePortRole>();

  private state = new Map<Interface, SpanningTreeState>();

  private cost = new Map<Interface, number>();

  private maxAge = 20;

  private helloTime = 15;

  private forwardDelay = 15;

  private rootId = {
    mac: new MacAddress('FF:FF:FF:FF:FF:FF'),
    priority: 32768,
  };

  get Root(): MacAddress {
    return this.rootId.mac;
  }

  get IsRoot(): boolean {
    return this.rootId.mac.equals(this.bridgeId.mac);
  }

  private bridgeId = {
    mac: new MacAddress('FF:FF:FF:FF:FF:FF'),
    priority: 32768,
  };

  private repeatCleanup: (() => void) | null = null;

  constructor(host: SwitchHost) {
    super(host);

    host.addListener((msg) => {
      if (msg === 'OnInterfaceAdded' || msg === 'OnInterfaceChange')
        this.setDefaultRoot();
    });

    this.setDefaultRoot();
    this.repeatCleanup = Scheduler.getInstance().repeat(this.helloTime, () =>
      this.negociate()
    );
  }

  public destroy(): void {
    if (this.repeatCleanup) {
      this.repeatCleanup();
      this.repeatCleanup = null;
    }
  }

  public State(iface: Interface): SpanningTreeState {
    return this.state.get(iface) ?? SpanningTreeState.Disabled;
  }

  public Role(iface: Interface): SpanningTreePortRole {
    return this.roles.get(iface) ?? SpanningTreePortRole.Disabled;
  }

  public Cost(iface: Interface): number {
    return this.cost.get(iface) ?? Number.MAX_VALUE;
  }

  override set Enable(enable: boolean) {
    if (enable) {
      this.host.getInterfaces().forEach((i) => {
        const iface = this.host.getInterface(i);

        if (this.ifaces.indexOf(iface) < 0) {
          this.ifaces.push(iface);
          iface.addListener(this);
        }
      });
    } else {
      this.ifaces.forEach((i) => {
        i.removeListener(this);
      });
      this.ifaces = [];
    }
    this.enabled = enable;
    this.setDefaultRoot();
  }

  override get Enable(): boolean {
    return this.enabled;
  }

  private setDefaultRoot(): void {
    this.rootId.mac = new MacAddress('FF:FF:FF:FF:FF:FF');
    this.bridgeId.mac = new MacAddress('FF:FF:FF:FF:FF:FF');

    this.host.getInterfaces().forEach((i) => {
      const iface = this.host.getInterface(i);
      const mac = iface.getMacAddress() as MacAddress;

      if (mac.compareTo(this.rootId.mac) < 0) this.rootId.mac = mac;

      if (mac.compareTo(this.bridgeId.mac) < 0) this.bridgeId.mac = mac;

      if (this.enabled) {
        // boot, we are the root. So the COST is set to default.

        if (this.roles.get(iface) === undefined) {
          this.changeRole(iface, SpanningTreePortRole.Designated);
          this.changeState(iface, SpanningTreeState.Blocking);
          this.cost.set(iface, 42);
        }
      } else {
        this.changeRole(iface, SpanningTreePortRole.Disabled);
        this.changeState(iface, SpanningTreeState.Disabled);
        this.roles.delete(iface);
        this.state.delete(iface);
        this.changingState.delete(iface);
      }
    });
  }

  private changingState: Map<HardwareInterface, (() => void) | null> =
    new Map();

  private changeState(
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
          this.changingState.set(
            iface,
            Scheduler.getInstance().once(this.maxAge, () => {
              this.changeState(iface, SpanningTreeState.Listening);
            })
          );
          break;
        case SpanningTreeState.Listening:
          this.changingState.set(
            iface,
            Scheduler.getInstance().once(this.forwardDelay, () => {
              this.changeState(iface, SpanningTreeState.Learning);
            })
          );
          break;
        case SpanningTreeState.Learning:
          this.changingState.set(
            iface,
            Scheduler.getInstance().once(this.forwardDelay, () => {
              this.changeState(iface, SpanningTreeState.Forwarding);
            })
          );
          break;
        case SpanningTreeState.Forwarding:
          break;
        default:
          break;
      }
    }
  }

  private changeRole(
    iface: HardwareInterface,
    role: SpanningTreePortRole
  ): void {
    const oldRole = this.roles.get(iface);
    this.roles.set(iface, role);

    if (this.roles.get(iface) !== oldRole) {
      switch (role) {
        case SpanningTreePortRole.Backup:
        case SpanningTreePortRole.Blocked:
          this.changeState(iface, SpanningTreeState.Blocking, true);
          break;
        default:
          break;
      }
    }
  }

  public negociate(): void {
    if (!this.enabled) return;

    if (this.rootId.mac.equals(this.bridgeId.mac)) {
      this.host.getInterfaces().forEach((i) => {
        const iface = this.host.getInterface(i);
        if (iface.isActive() === false || iface.isConnected === false) return;
        if (this.State(iface) === SpanningTreeState.Blocking) return;

        const message = new SpanningTreeMessage.Builder()
          .setMacSource(iface.getMacAddress() as MacAddress)
          .setBridge(this.bridgeId.mac)
          .setRoot(this.rootId.mac)
          .setPort(i)
          .setCost(this.Cost(iface))
          .setMessageAge(Scheduler.getInstance().getDeltaTime())
          .build();

        iface.sendTrame(message);
      });
    }
  }

  public receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle {
    if (message instanceof SpanningTreeMessage) {
      if (
        message.messageAge + this.maxAge >
        Scheduler.getInstance().getDeltaTime() + this.maxAge
      )
        return ActionHandle.Stop;
      if (message.bridgeId.mac.equals(this.bridgeId.mac))
        return ActionHandle.Stop;

      // We have a new root:
      if (
        this.rootId.priority < message.rootId.priority ||
        (this.rootId.priority === message.rootId.priority &&
          message.rootId.mac.compareTo(this.rootId.mac) < 0)
      ) {
        this.rootId.mac = message.rootId.mac;
        this.rootId.priority = message.rootId.priority;

        this.forwardDelay = message.forwardDelay;
        this.helloTime = message.helloTime;
        this.maxAge = message.maxAge;

        this.cost.clear();
      }

      if (
        this.rootId.mac.equals(message.rootId.mac) &&
        this.Cost(from) > message.rootPathCost
      ) {
        this.cost.set(from, message.rootPathCost + 10);
      }

      // I'm not the root
      if (this.bridgeId.mac.equals(this.rootId.mac) === false) {
        let bestInterface!: HardwareInterface;
        let bestCost = Number.MAX_VALUE;

        this.host.getInterfaces().forEach((i) => {
          const iface = this.host.getInterface(i);
          if (iface.isActive() === false || iface.isConnected === false) return;

          const interfaceCost = this.Cost(iface);
          if (interfaceCost < bestCost) {
            bestInterface = iface;
            bestCost = interfaceCost;
          }
        });

        if (bestInterface) {
          this.host.getInterfaces().forEach((i) => {
            const iface = this.host.getInterface(i);
            if (iface.isActive() === false || iface.isConnected === false)
              return;

            if (iface === bestInterface)
              this.changeRole(iface, SpanningTreePortRole.Root);
            else this.changeRole(iface, SpanningTreePortRole.Designated);
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

          if (iface.getMacAddress().compareTo(message.macSrc) >= 0)
            this.changeRole(iface, SpanningTreePortRole.Blocked);
          else this.changeRole(iface, SpanningTreePortRole.Designated);
        }

        if (
          this.State(from as HardwareInterface) === SpanningTreeState.Blocking
        )
          return ActionHandle.Stop;

        this.host.getInterfaces().forEach((i) => {
          const iface = this.host.getInterface(i);
          if (iface.isActive() === false || iface.isConnected === false) return;
          if (this.State(iface) === SpanningTreeState.Blocking) return;

          if (iface !== from) {
            const forwarded = new SpanningTreeMessage.Builder()
              .setMacSource(iface.getMacAddress() as MacAddress)
              .setBridge(this.bridgeId.mac)
              .setRoot(message.rootId.mac)
              .setCost(this.Cost(iface))
              .setPort(message.portId.globalId)
              .setMessageAge(message.messageAge)
              .build();
            iface.sendTrame(forwarded);
          }
        });
      }

      return ActionHandle.Handled;
    }

    if (this.State(from as HardwareInterface) === SpanningTreeState.Blocking)
      return ActionHandle.Stop;

    return ActionHandle.Continue;
  }
}

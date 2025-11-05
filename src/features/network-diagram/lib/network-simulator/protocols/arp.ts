import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { HardwareAddress, MacAddress, type NetworkAddress } from '../address';
import type { HardwareInterface } from '../layers/datalink';
import type { NetworkInterface } from '../layers/network';
import { DatalinkMessage, type NetworkMessage, type Payload } from '../message';
import { ActionHandle, type DatalinkListener } from './base';

export class ArpMessage implements Payload {
  public type: 'request' | 'reply';

  public request: NetworkAddress;

  public response?: HardwareAddress | null;

  private constructor(type: 'request' | 'reply', request: NetworkAddress) {
    this.type = type;
    this.request = request;
  }

  get length(): number {
    // ARP header: 8 bytes (htype, ptype, hlen, plen, oper)
    // + sender hw addr (6 for MAC) + sender proto addr (request.length for IPv4 = 4)
    // + target hw addr (6 for MAC) + target proto addr (request.length for IPv4 = 4)
    // Total for Ethernet/IPv4: 8 + 6 + 4 + 6 + 4 = 28 bytes
    const hardwareAddrLength = 6; // MAC address
    const protocolAddrLength = this.request.length; // IPv4 = 4 bytes
    return 8 + (hardwareAddrLength * 2) + (protocolAddrLength * 2);
  }

  public toString(): string {
    return `ARP${this.type}`;
  }

  public static Builder = class {
    private type: 'request' | 'reply' = 'request';

    private net: NetworkAddress | null = null;

    private mac: HardwareAddress | null = null;

    public SetNetworkAddress(net: NetworkAddress): this {
      this.type = 'request';
      this.net = net;
      return this;
    }

    public SetHardwareAddress(net: HardwareAddress): this {
      this.type = 'reply';
      this.mac = net;
      return this;
    }

    public build(): ArpMessage {
      if (this.net === null) throw new Error('No request data specified');

      const message = new ArpMessage(this.type, this.net);

      if (this.type === 'reply') message.response = this.mac;
      return message;
    }
  };
}

export class ArpProtocol implements DatalinkListener {
  private table: Map<string, { address: HardwareAddress; lastSeen: number }> =
    new Map<string, { address: HardwareAddress; lastSeen: number }>();

  private queue: Map<string, NetworkMessage[]> = new Map<
    string,
    NetworkMessage[]
  >();

  private interface: NetworkInterface;

  private cleanupTimer: (() => void) | null = null;

  constructor(netface: NetworkInterface, hardface: HardwareInterface) {
    this.interface = netface;
    hardface.addListener(this);

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

  public getMapping(addr: NetworkAddress): HardwareAddress | undefined {
    return this.table.get(addr.toString())?.address;
  }

  public enqueueRequest(
    message: NetworkMessage,
    nextHop: NetworkAddress
  ): void {
    if (nextHop.isBroadcast) {
      this.sendTrame(message, MacAddress.generateBroadcast());
    } else if (this.table.has(nextHop.toString())) {
      const entry = this.table.get(nextHop.toString());
      if (entry) {
        entry.lastSeen = Scheduler.getInstance().getDeltaTime();
        this.sendTrame(message, entry.address);
      }
    } else {
      if (this.queue.has(nextHop.toString()))
        this.queue.get(nextHop.toString())?.push(message);
      else this.queue.set(nextHop.toString(), [message]);
      this.sendArpRequest(nextHop);
    }
  }

  private sendArpRequest(addr: NetworkAddress): void {
    const arp = new ArpMessage.Builder().SetNetworkAddress(addr).build();

    const message: DatalinkMessage = new DatalinkMessage(
      arp,
      this.interface.getMacAddress(),
      MacAddress.generateBroadcast()
    );
    this.interface.sendTrame(message);
  }

  public receiveTrame(message: DatalinkMessage): ActionHandle {
    if (message.payload instanceof ArpMessage) {
      const arp = message.payload as ArpMessage;

      if (arp.type === 'request' && this.interface.hasNetAddress(arp.request)) {
        const reply = new ArpMessage.Builder()
          .SetNetworkAddress(arp.request)
          .SetHardwareAddress(this.interface.getMacAddress())
          .build();

        const replyMessage: DatalinkMessage = new DatalinkMessage(
          reply,
          this.interface.getMacAddress(),
          message.macSrc
        );

        this.interface.sendTrame(replyMessage);
      } else if (arp.type === 'reply' && arp.response != null) {
        this.table.set(arp.request.toString(), {
          address: arp.response,
          lastSeen: Scheduler.getInstance().getDeltaTime(),
        });

        if (this.queue.has(arp.request.toString())) {
          this.queue.get(arp.request.toString())?.forEach((i) => {
            this.sendTrame(i, arp.response!);
          });
          this.queue.delete(arp.request.toString());
        }
      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  private sendTrame(message: NetworkMessage, mac: HardwareAddress): void {
    const trame = new DatalinkMessage(
      message,
      this.interface.getMacAddress(),
      mac!
    );
    this.interface.sendTrame(trame);
  }

  private cleanARPTable(): void {
    const cleanDelay = Scheduler.getInstance().getDelay(60 * 5);

    this.table.forEach((value, key) => {
      const timeSinceLastSeen =
        Scheduler.getInstance().getDeltaTime() - value.lastSeen;

      if (timeSinceLastSeen > cleanDelay) this.table.delete(key);
    });
  }
}

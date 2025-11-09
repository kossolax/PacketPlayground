import type { RouterHost } from '../../nodes/router';
import type { SwitchHost } from '../../nodes/switch';
import type { NetworkInterface } from '../../layers/network';
import type { HardwareInterface } from '../../layers/datalink';
import { TerminalCommand } from '../command-base';
import { toShortName } from '../../utils/interface-names';

/**
 * Show IP Interface Brief Command - Display summary of interface IP configuration
 * Usage: show ip interface brief
 */
export class ShowIpInterfaceBriefCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (
      command === this.name &&
      args[0] === 'interface' &&
      args[1] === 'brief'
    ) {
      const node = this.Terminal.Node;

      // Check if node has network interfaces (router or L3 switch)
      const interfaces = node.getInterfaces();

      // Print header
      this.terminal.write(
        'Interface              IP-Address      OK? Method  Status                Protocol'
      );

      interfaces.forEach((ifaceName) => {
        const iface = node.getInterface(ifaceName);

        // Only show network interfaces (Layer 3)
        if ('getNetAddress' in iface) {
          const networkIface = iface as NetworkInterface;
          const shortName = toShortName(ifaceName);
          const ipAddress =
            networkIface.getNetAddress()?.toString() || 'unassigned';
          const status = iface.isActive() ? 'up' : 'administratively down';
          const protocol =
            iface.isActive() && iface.isConnected ? 'up' : 'down';
          const method = ipAddress === 'unassigned' ? 'unset' : 'manual';

          // Format: Interface (22 chars), IP (15 chars), OK (3), Method (7), Status (21), Protocol
          this.terminal.write(
            `${shortName.padEnd(22)} ${ipAddress.padEnd(15)} YES ${method.padEnd(7)} ${status.padEnd(21)} ${protocol}`
          );
        }
      });

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

/**
 * Show VLAN Brief Command - Display VLAN summary
 * Usage: show vlan brief
 */
export class ShowVlanBriefCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'vlan');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name && args[0] === 'brief') {
      const switchHost = this.Terminal.Node as SwitchHost;

      if (!('knownVlan' in switchHost)) {
        throw new Error('VLANs are not supported on this device');
      }

      // Print header
      this.terminal.write('');
      this.terminal.write(
        'VLAN Name                             Status    Ports'
      );
      this.terminal.write(
        '---- -------------------------------- --------- -------------------------------'
      );

      // Get all VLANs
      const vlans = Object.entries(switchHost.knownVlan);

      vlans.forEach(([vlanId, vlanName]) => {
        // Find interfaces in this VLAN
        const ports: string[] = [];
        switchHost.getInterfaces().forEach((ifaceName) => {
          const iface = switchHost.getInterface(ifaceName);
          if ('Vlan' in iface) {
            const dot1qIface = iface as { Vlan: number[] };
            if (dot1qIface.Vlan.includes(parseInt(vlanId, 10))) {
              ports.push(toShortName(ifaceName));
            }
          }
        });

        const status = 'active';
        const portsList = ports.join(', ');

        this.terminal.write(
          `${vlanId.padStart(4)} ${vlanName.padEnd(32)} ${status.padEnd(9)} ${portsList}`
        );
      });

      this.terminal.write('');
      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

/**
 * Show MAC Address-Table Command - Display MAC address table
 * Usage: show mac address-table
 */
export class ShowMacAddressTableCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'mac');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name && args[0] === 'address-table') {
      const switchHost = this.Terminal.Node as SwitchHost;

      if (!('knownVlan' in switchHost)) {
        throw new Error('MAC address table is not supported on this device');
      }

      // Print header
      this.terminal.write('');
      this.terminal.write('          Mac Address Table');
      this.terminal.write('-------------------------------------------');
      this.terminal.write('');
      this.terminal.write('Vlan    Mac Address       Type        Ports');
      this.terminal.write('----    -----------------  --------    -----');

      // Access the internal ARPTable (MAC table)
      const macTable = (
        switchHost as unknown as {
          ARPTable: Map<
            string,
            { iface: HardwareInterface; lastSeen: number }[]
          >;
        }
      ).ARPTable;

      if (macTable && macTable.size > 0) {
        macTable.forEach((entries, macAddress) => {
          entries.forEach((entry) => {
            const ifaceName = switchHost
              .getInterfaces()
              .find((name) => switchHost.getInterface(name) === entry.iface);
            const shortIfaceName = ifaceName
              ? toShortName(ifaceName)
              : 'Unknown';

            // Get VLAN from interface (if 802.1Q)
            let vlan = '1';
            if ('Vlan' in entry.iface) {
              const vlans = (entry.iface as { Vlan: number[] }).Vlan;
              if (vlans.length > 0) {
                vlan = vlans[0].toString();
              }
            }

            const type = 'DYNAMIC';

            this.terminal.write(
              `${vlan.padStart(4)}    ${macAddress.padEnd(17)}  ${type.padEnd(11)} ${shortIfaceName}`
            );
          });
        });
      } else {
        this.terminal.write('No entries found');
      }

      this.terminal.write('');
      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

/**
 * Show ARP Command - Display ARP table
 * Usage: show arp
 */
export class ShowArpCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'arp');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const node = this.Terminal.Node;

      // Print header
      this.terminal.write(
        'Protocol  Address          Age (min)  Hardware Addr   Type   Interface'
      );

      const interfaces = node.getInterfaces();
      let foundEntries = false;

      interfaces.forEach((ifaceName) => {
        const iface = node.getInterface(ifaceName);

        // Only process network interfaces
        if ('arpTable' in iface) {
          const networkIface = iface as NetworkInterface;
          // eslint-disable-next-line prefer-destructuring
          const arpTable = (
            networkIface as unknown as {
              arpTable: Map<string, { mac: unknown; lastSeen: number }>;
            }
          ).arpTable;

          if (arpTable && arpTable.size > 0) {
            arpTable.forEach((entry, ipAddress) => {
              foundEntries = true;
              const age = '-'; // Could calculate from lastSeen
              const hwAddr = (
                entry.mac as { toString: () => string }
              ).toString();
              const type = 'ARPA';
              const shortIfaceName = toShortName(ifaceName);

              this.terminal.write(
                `Internet  ${ipAddress.padEnd(15)}  ${age.padEnd(9)}  ${hwAddr.padEnd(14)}  ${type.padEnd(6)} ${shortIfaceName}`
              );
            });
          }
        }
      });

      if (!foundEntries) {
        this.terminal.write('No ARP entries found');
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

/**
 * Show IP Route Command - Display routing table
 * Usage: show ip route
 */
export class ShowIpRouteCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name && args[0] === 'route') {
      const router = this.Terminal.Node as RouterHost;

      if (!('RoutingTable' in router)) {
        throw new Error('Routing table is not supported on this device');
      }

      // Print header
      this.terminal.write('Codes: C - connected, S - static');
      this.terminal.write('');
      this.terminal.write('Gateway of last resort is not set');
      this.terminal.write('');

      const routingTable = router.RoutingTable;
      let hasRoutes = false;

      routingTable.forEach((route) => {
        hasRoutes = true;
        const network = route.network.toString();
        const mask = route.mask.toString();
        const gateway = route.gateway?.toString() || 'directly connected';

        // Since RoutingTableEntry doesn't store iface, we can't show it accurately
        // In a real implementation, this would need to be added to the type
        const shortIfaceName = 'Unknown';

        // Determine route type (C for connected, S for static)
        const code = gateway === 'directly connected' ? 'C' : 'S';

        // Format Cisco-style
        if (code === 'C') {
          this.terminal.write(
            `${code}    ${network}/${ShowIpRouteCommand.maskToCidr(mask)} is directly connected, ${shortIfaceName}`
          );
        } else {
          this.terminal.write(
            `${code}    ${network}/${ShowIpRouteCommand.maskToCidr(mask)} [1/0] via ${gateway}, ${shortIfaceName}`
          );
        }
      });

      if (!hasRoutes) {
        this.terminal.write('No routes found');
      }

      this.terminal.write('');
      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  private static maskToCidr(mask: string): number {
    // Convert netmask to CIDR notation
    const parts = mask.split('.').map((p) => parseInt(p, 10));
    let cidr = 0;
    parts.forEach((part) => {
      const binary = part.toString(2);
      cidr += binary.split('1').length - 1;
    });
    return cidr;
  }
}

/**
 * Show Interfaces Command - Display detailed interface information
 * Usage: show interfaces [interface-name]
 */
export class ShowInterfacesCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'interfaces');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const node = this.Terminal.Node;
      const interfaces = node.getInterfaces();

      // If specific interface requested
      const targetIface = args[0];

      if (targetIface && targetIface === 'status') {
        // show interfaces status
        this.showInterfacesStatus();
        return;
      }

      interfaces.forEach((ifaceName) => {
        if (targetIface && toShortName(ifaceName) !== targetIface) {
          return;
        }

        const iface = node.getInterface(ifaceName);
        const shortName = toShortName(ifaceName);

        // Header
        const status = iface.isActive() ? 'up' : 'administratively down';
        const protocol = iface.isActive() && iface.isConnected ? 'up' : 'down';

        this.terminal.write(
          `${shortName} is ${status}, line protocol is ${protocol}`
        );

        // Description
        if (iface.Description) {
          this.terminal.write(`  Description: ${iface.Description}`);
        }

        // MAC address
        if ('getMacAddress' in iface) {
          const hwIface = iface as HardwareInterface;
          this.terminal.write(
            `  Hardware is ${hwIface.getMacAddress().toString()}`
          );
        }

        // IP address (if network interface)
        if ('getNetAddress' in iface) {
          const networkIface = iface as NetworkInterface;
          const ipAddr = networkIface.getNetAddress();
          const netmask = networkIface.getNetMask();
          if (ipAddr && netmask) {
            this.terminal.write(
              `  Internet address is ${ipAddr.toString()}/${ShowInterfacesCommand.maskToCidr(netmask.toString())}`
            );
          }
        }

        // MTU and speed
        this.terminal.write(`  MTU 1500 bytes, BW ${iface.Speed} Mbit`);
        const duplex = iface.FullDuplex ? 'full' : 'half';
        this.terminal.write(`  ${duplex}-duplex, ${iface.Speed}Mb/s`);

        // Packets (would need to add counters to interface)
        this.terminal.write('  0 packets input, 0 bytes');
        this.terminal.write('  0 packets output, 0 bytes');

        this.terminal.write('');
      });

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  private showInterfacesStatus(): void {
    const node = this.Terminal.Node;
    const interfaces = node.getInterfaces();

    // Print header
    this.terminal.write('');
    this.terminal.write(
      'Port      Name               Status       Vlan       Duplex  Speed Type'
    );
    this.terminal.write(
      '--------- ------------------ ------------ ---------- ------- ----- ----'
    );

    interfaces.forEach((ifaceName) => {
      const iface = node.getInterface(ifaceName);
      const shortName = toShortName(ifaceName);
      const description = iface.Description || '';

      // Determine status
      let status: string;
      if (!iface.isActive()) {
        status = 'disabled';
      } else if (iface.isConnected) {
        status = 'connected';
      } else {
        status = 'notconnect';
      }

      // VLAN (for switch ports)
      let vlan = 'routed';
      if ('Vlan' in iface) {
        const dot1qIface = iface as { Vlan: number[] };
        if (dot1qIface.Vlan.length > 0) {
          vlan = dot1qIface.Vlan[0].toString();
        }
      }

      const duplex = iface.FullDuplex ? 'full' : 'half';
      const speed = iface.Speed.toString();
      const type = '10/100/1000BaseTX';

      this.terminal.write(
        `${shortName.padEnd(9)} ${description.padEnd(18).substring(0, 18)} ${status.padEnd(12)} ${vlan.padEnd(10)} ${duplex.padEnd(7)} ${speed.padEnd(5)} ${type}`
      );
    });

    this.terminal.write('');
    this.finalize();
  }

  private static maskToCidr(mask: string): number {
    const parts = mask.split('.').map((p) => parseInt(p, 10));
    let cidr = 0;
    parts.forEach((part) => {
      const binary = part.toString(2);
      cidr += binary.split('1').length - 1;
    });
    return cidr;
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name && args.length === 1) {
      const interfaces = this.Terminal.Node.getInterfaces().map((name) =>
        toShortName(name)
      );
      interfaces.push('status');
      return interfaces.filter((i) => i.startsWith(args[0]));
    }

    return super.autocomplete(command, args, negated);
  }
}

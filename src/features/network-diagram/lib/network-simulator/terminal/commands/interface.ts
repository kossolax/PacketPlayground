import { IPAddress } from '../../address';
import type { Dot1QInterface, HardwareInterface } from '../../layers/datalink';
import type { NetworkInterface } from '../../layers/network';
import type { SwitchHost } from '../../nodes/switch';
import type { RouterHost } from '../../nodes/router';
import { VlanMode } from '../../protocols/ethernet';
import { TerminalCommand } from '../command-base';
import { parseInterfaceName, toShortName } from '../../utils/interface-names';
import { StandbyCommand } from './fhrp';
import { SpanningTreeInterfaceCommand } from './stp';
import { IpRipCommand } from './rip';

export { VlanMode };

// Internal command classes defined first to avoid no-use-before-define

class SwitchPortCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'switchport');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args[0] === 'access' && args[1] === 'vlan' && args.length === 3) {
        const vlanid = parseInt(args[2], 10);

        const iface = (this.parent as InterfaceCommand).iface as Dot1QInterface;
        if (iface.VlanMode === VlanMode.Access) iface.addVlan(vlanid);
      } else if (
        args[0] === 'trunk' &&
        args[1] === 'allowed' &&
        args[2] === 'vlan'
      ) {
        const iface = (this.parent as InterfaceCommand).iface as Dot1QInterface;

        if ((args[3] === 'add' || args[3] === 'remove') && args.length === 5) {
          const vlanid = parseInt(args[4], 10);
          if (args[3] === 'add') iface.addVlan(vlanid);
          else iface.removeVlan(vlanid);
        } else if (args[3] === 'except' && args.length === 5) {
          const host = this.Terminal.Node as SwitchHost;
          const vlanid = parseInt(args[4], 10);

          const vlans = iface.Vlan.map((i) => i);
          vlans.forEach((i) => iface.removeVlan(i));

          Object.keys(host.knownVlan).forEach((vlanKey) => {
            iface.addVlan(parseInt(vlanKey, 10));
          });
          iface.removeVlan(vlanid);
        } else if (args[3] === 'all' && args.length === 4) {
          const host = this.Terminal.Node as SwitchHost;

          const vlans = iface.Vlan.map((i) => i);
          vlans.forEach((i) => iface.removeVlan(i));

          Object.keys(host.knownVlan).forEach((vlanKey) => {
            iface.addVlan(parseInt(vlanKey, 10));
          });
        } else if (args.length === 4) {
          const vlanid = parseInt(args[3], 10);

          const vlans = iface.Vlan.map((i) => i);
          vlans.forEach((i) => iface.removeVlan(i));
          iface.addVlan(vlanid);
        }
      } else if (
        args[0] === 'trunk' &&
        args[1] === 'native' &&
        args[2] === 'vlan' &&
        args.length === 4
      ) {
        const iface = (this.parent as InterfaceCommand).iface as Dot1QInterface;
        const vlanid = parseInt(args[3], 10);

        iface.NativeVlan = vlanid;
      } else if (args[0] === 'mode' && args.length === 2) {
        const iface = (this.parent as InterfaceCommand).iface as Dot1QInterface;

        if (args[1] === 'access') iface.VlanMode = VlanMode.Access;
        else if (args[1] === 'trunk') iface.VlanMode = VlanMode.Trunk;
        else throw new Error(`Invalid mode ${args[1]}`);
      } else throw new Error(`${this.name} requires a subcommand`);

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1)
        return ['access', 'trunk', 'mode'].filter((c) => c.startsWith(args[0]));

      if (args[0] === 'access' && args.length === 2)
        return ['vlan'].filter((c) => c.startsWith(args[1]));

      if (args[0] === 'trunk') {
        if (args.length === 2)
          return ['allowed', 'native'].filter((c) => c.startsWith(args[1]));

        if (args[1] === 'allowed' && args.length === 3)
          return ['vlan'].filter((c) => c.startsWith(args[2]));

        if (args[1] === 'allowed' && args[2] === 'vlan' && args.length === 4)
          return ['add', 'remove', 'except', 'all'].filter((c) =>
            c.startsWith(args[3])
          );

        if (args[1] === 'native' && args.length === 3)
          return ['vlan'].filter((c) => c.startsWith(args[2]));
      }

      if (args[0] === 'mode' && args.length === 2)
        return ['access', 'dynamic', 'trunk'].filter((c) =>
          c.startsWith(args[1])
        );

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

class IPInterfaceCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
    this.canBeNegative = true;

    // Register RIP command if available
    const node = this.terminal.Node;
    if ('services' in node && 'rip' in (node as RouterHost).services) {
      this.registerCommand(new IpRipCommand(this));
    }
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args[0] === 'address' && args.length === 3) {
        const network = new IPAddress(args[1]);
        const mask = new IPAddress(args[2], true);

        const iface = (this.parent as InterfaceCommand)
          .iface as NetworkInterface;

        iface.setNetAddress(network);
        iface.setNetMask(mask);
        this.finalize();
      } else if (args.length > 0) {
        // Try to dispatch to subcommands
        super.exec(args[0], args.slice(1), negated);
      } else {
        throw new Error(`${this.name} requires a subcommand`);
      }
    } else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1) {
        const suggestions = ['address'];

        // Add 'rip' if RIP is available
        const node = this.terminal.Node;
        if ('services' in node && 'rip' in (node as RouterHost).services) {
          suggestions.push('rip');
        }

        return suggestions.filter((c) => c.startsWith(args[0]));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

// Interface configuration commands

class ShutdownCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'shutdown');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // eslint-disable-next-line prefer-destructuring
      const iface = (this.parent as InterfaceCommand).iface;

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (negated) {
        iface.up();
        this.terminal.write('Interface enabled');
      } else {
        iface.down();
        this.terminal.write('Interface disabled');
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

class DescriptionCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'description');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // eslint-disable-next-line prefer-destructuring
      const iface = (this.parent as InterfaceCommand).iface;

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (negated) {
        iface.Description = '';
        this.terminal.write('Description removed');
      } else if (args.length > 0) {
        const description = args.join(' ');
        iface.Description = description;
        this.terminal.write(`Description set to: ${description}`);
      } else {
        throw new Error('Description requires text argument');
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

class SpeedCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'speed');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // eslint-disable-next-line prefer-destructuring
      const iface = (this.parent as InterfaceCommand).iface;

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (args.length === 1) {
        const speed = args[0];

        if (speed === 'auto') {
          // Auto-negotiation would be handled by AutoNegotiationProtocol
          this.terminal.write('Speed set to auto-negotiation');
        } else {
          const speedValue = parseInt(speed, 10);
          if ([10, 100, 1000].includes(speedValue)) {
            iface.Speed = speedValue;
            this.terminal.write(`Speed set to ${speedValue}Mb/s`);
          } else {
            throw new Error(
              'Invalid speed. Valid options: 10, 100, 1000, auto'
            );
          }
        }
      } else {
        throw new Error('Speed requires an argument (10, 100, 1000, or auto)');
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name && args.length === 1) {
      return ['10', '100', '1000', 'auto'].filter((s) => s.startsWith(args[0]));
    }

    return super.autocomplete(command, args, negated);
  }
}

class DuplexCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'duplex');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // eslint-disable-next-line prefer-destructuring
      const iface = (this.parent as InterfaceCommand).iface;

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (args.length === 1) {
        const duplex = args[0];

        if (duplex === 'auto') {
          // Auto-negotiation would be handled by AutoNegotiationProtocol
          this.terminal.write('Duplex set to auto-negotiation');
        } else if (duplex === 'full') {
          iface.FullDuplex = true;
          this.terminal.write('Duplex set to full');
        } else if (duplex === 'half') {
          iface.FullDuplex = false;
          this.terminal.write('Duplex set to half');
        } else {
          throw new Error(
            'Invalid duplex mode. Valid options: auto, full, half'
          );
        }
      } else {
        throw new Error('Duplex requires an argument (auto, full, or half)');
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name && args.length === 1) {
      return ['auto', 'full', 'half'].filter((s) => s.startsWith(args[0]));
    }

    return super.autocomplete(command, args, negated);
  }
}

// InterfaceRangeCommand - Configure multiple interfaces at once
class InterfaceRangeCommand extends TerminalCommand {
  private interfaces: (NetworkInterface | HardwareInterface)[] = [];

  public iface: NetworkInterface | HardwareInterface | null = null;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'range', '(config-if-range)#');
    this.parent = parent;
    this.isRecursive = true;

    // Register same subcommands as InterfaceCommand
    if ('RoutingTable' in this.terminal.Node) {
      this.registerCommand(new IPInterfaceCommand(this));
      this.registerCommand(new StandbyCommand(this));
    }
    if ('knownVlan' in this.terminal.Node) {
      this.registerCommand(new SwitchPortCommand(this));
      this.registerCommand(new SpanningTreeInterfaceCommand(this));
    }

    // Common interface commands (all devices)
    this.registerCommand(new ShutdownCommand(this));
    this.registerCommand(new DescriptionCommand(this));
    this.registerCommand(new SpeedCommand(this));
    this.registerCommand(new DuplexCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // Expected: range <type> <range>
      // Example: range gi 0/1-24, range fa 1-10
      if (args.length !== 2) {
        throw new Error('Usage: interface range <type> <range>');
      }

      const interfaceType = args[0];
      const rangeStr = args[1];

      // Parse and validate all interfaces in range
      this.interfaces = this.parseAndValidateRange(interfaceType, rangeStr);

      // Enter range config mode
      this.terminal.changeDirectory(this);
    } else {
      // Apply command to all interfaces in range
      this.interfaces.forEach((iface) => {
        // Temporarily set the interface for subcommands to access
        this.iface = iface;

        try {
          super.exec(command, args, negated);
        } finally {
          // Clear interface after command execution
          this.iface = null;
        }
      });
    }
  }

  private parseAndValidateRange(
    interfaceType: string,
    rangeStr: string
  ): (NetworkInterface | HardwareInterface)[] {
    // Parse range: "0/1-24" or "1-10"
    const rangeParts = rangeStr.split('-');
    if (rangeParts.length !== 2) {
      throw new Error('Invalid range format. Expected: <start>-<end>');
    }

    const start = rangeParts[0];
    const end = rangeParts[1];

    // Check if range includes slashes (e.g., 0/1-0/24)
    const hasSlash = start.includes('/');

    let interfaceNames: string[];

    if (hasSlash) {
      // Format: 0/1-0/24 or 0/1-24
      const startParts = start.split('/');
      const endNum = end.includes('/') ? end.split('/')[1] : end;

      const startSlot = startParts[0];
      const startPort = parseInt(startParts[1], 10);
      const endPort = parseInt(endNum, 10);

      if (Number.isNaN(startPort) || Number.isNaN(endPort)) {
        throw new Error('Invalid port numbers in range');
      }

      if (startPort > endPort) {
        throw new Error('Start port must be less than or equal to end port');
      }

      // Generate interface names
      interfaceNames = [];
      for (let port = startPort; port <= endPort; port += 1) {
        const ifaceName = parseInterfaceName(
          interfaceType,
          `${startSlot}/${port}`
        );
        interfaceNames.push(ifaceName);
      }
    } else {
      // Format: 1-10 (simple numeric range)
      const startNum = parseInt(start, 10);
      const endNum = parseInt(end, 10);

      if (Number.isNaN(startNum) || Number.isNaN(endNum)) {
        throw new Error('Invalid port numbers in range');
      }

      if (startNum > endNum) {
        throw new Error('Start port must be less than or equal to end port');
      }

      // Generate interface names
      interfaceNames = [];
      for (let port = startNum; port <= endNum; port += 1) {
        const ifaceName = parseInterfaceName(interfaceType, port.toString());
        interfaceNames.push(ifaceName);
      }
    }

    // Validate all interfaces exist
    const allInterfaces = this.Terminal.Node.getInterfaces();
    const resolvedInterfaces: (NetworkInterface | HardwareInterface)[] = [];

    interfaceNames.forEach((ifaceName) => {
      const matchingIface = allInterfaces.find(
        (iface) =>
          iface === ifaceName || iface.toLowerCase() === ifaceName.toLowerCase()
      );

      if (!matchingIface) {
        throw new Error(
          `Interface ${ifaceName} does not exist. Range command aborted.`
        );
      }

      resolvedInterfaces.push(this.Terminal.Node.getInterface(matchingIface));
    });

    if (resolvedInterfaces.length === 0) {
      throw new Error('No interfaces found in range');
    }

    return resolvedInterfaces;
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1) {
        // Show short interface type names
        const ifaces = this.Terminal.Node.getInterfaces()
          .map((iface) => {
            const match = iface.match(/^([a-zA-Z-]+)(\d+(?:\/\d+)*)$/);
            return match ? toShortName(iface) : null;
          })
          .filter((iface): iface is string => iface !== null)
          .map((iface) => {
            const match = iface.match(/^([a-z-]+)(\d+(?:\/\d+)*)$/);
            return match ? match[1] : iface;
          })
          .filter((type) => type.startsWith(args[0].toLowerCase()));

        return Array.from(new Set(ifaces));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

// Main InterfaceCommand class

export class InterfaceCommand extends TerminalCommand {
  public iface: NetworkInterface | HardwareInterface | null;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'interface', '(config-if)#');
    this.parent = parent;
    this.iface = null;
    this.isRecursive = true;

    if ('RoutingTable' in this.terminal.Node) {
      this.registerCommand(new IPInterfaceCommand(this));
      this.registerCommand(new StandbyCommand(this));
    }
    if ('knownVlan' in this.terminal.Node) {
      this.registerCommand(new SwitchPortCommand(this));
      this.registerCommand(new SpanningTreeInterfaceCommand(this));
    }

    // Common interface commands (all devices)
    this.registerCommand(new ShutdownCommand(this));
    this.registerCommand(new DescriptionCommand(this));
    this.registerCommand(new SpeedCommand(this));
    this.registerCommand(new DuplexCommand(this));

    // Register interface range command
    this.registerCommand(new InterfaceRangeCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // Check if this is an interface range command
      if (args.length > 0 && args[0] === 'range') {
        // Delegate to InterfaceRangeCommand
        super.exec('range', args.slice(1), negated);
        return;
      }

      if (args.length === 2) {
        // Parse interface name using utility (supports both short and full names)
        const requestedName = parseInterfaceName(args[0], args[1]);

        // Find matching interface
        const ifaces = this.Terminal.Node.getInterfaces().filter(
          (iface) =>
            // Match against both the stored name and parsed request
            iface === requestedName ||
            iface.toLowerCase() === requestedName.toLowerCase()
        );

        if (ifaces.length !== 1)
          throw new Error(`${this.name} requires a valid interface`);

        this.iface = this.Terminal.Node.getInterface(ifaces[0]);
        this.terminal.changeDirectory(this);
      } else {
        throw new Error(`${this.name} requires an interface`);
      }
    } else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1) {
        // Check if user is typing "range"
        if ('range'.startsWith(args[0].toLowerCase())) {
          // Show both "range" and interface types
          const interfaceTypes = this.Terminal.Node.getInterfaces()
            .map((iface) => {
              const match = iface.match(/^([a-zA-Z-]+)(\d+(?:\/\d+)*)$/);
              return match ? toShortName(iface) : null;
            })
            .filter((iface): iface is string => iface !== null)
            .map((iface) => {
              const match = iface.match(/^([a-z-]+)(\d+(?:\/\d+)*)$/);
              return match ? match[1] : iface;
            })
            .filter((type) => type.startsWith(args[0].toLowerCase()));

          const suggestions = Array.from(new Set(['range', ...interfaceTypes]));
          return suggestions.filter((s) => s.startsWith(args[0].toLowerCase()));
        }

        // Show short interface type names for autocomplete
        const ifaces = this.Terminal.Node.getInterfaces()
          .map((iface) => {
            const match = iface.match(/^([a-zA-Z-]+)(\d+(?:\/\d+)*)$/);
            return match ? toShortName(iface) : null;
          })
          .filter((iface): iface is string => iface !== null)
          .map((iface) => {
            const match = iface.match(/^([a-z-]+)(\d+(?:\/\d+)*)$/);
            return match ? match[1] : iface;
          })
          .filter((type) => type.startsWith(args[0].toLowerCase()));

        return Array.from(new Set(ifaces));
      }
      if (args.length === 2) {
        // Check if first arg is "range" - delegate to InterfaceRangeCommand
        if (args[0] === 'range') {
          return this.autocompleteChild('range', args.slice(1), negated);
        }

        // Show port numbers for matching interface types
        const ifaces = this.Terminal.Node.getInterfaces()
          .map((iface) => toShortName(iface))
          .map((iface) => {
            const match = iface.match(/^([a-z-]+)(\d+(?:\/\d+)*)$/);
            return match ? { type: match[1], port: match[2] } : null;
          })
          .filter(
            (iface): iface is { type: string; port: string } =>
              iface !== null && iface.type.startsWith(args[0].toLowerCase())
          )
          .map((iface) => iface.port)
          .filter((port) => port.startsWith(args[1]));

        return Array.from(new Set(ifaces));
      }
      if (args.length === 3 && args[0] === 'range') {
        // Delegate to InterfaceRangeCommand for range-specific autocomplete
        return this.autocompleteChild('range', args.slice(1), negated);
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

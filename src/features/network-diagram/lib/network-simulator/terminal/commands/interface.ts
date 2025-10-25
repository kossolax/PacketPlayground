import { IPAddress } from '../../address';
import type { Dot1QInterface, HardwareInterface } from '../../layers/datalink';
import type { NetworkInterface } from '../../layers/network';
import type { SwitchHost } from '../../nodes/switch';
import { VlanMode } from '../../protocols/ethernet';
import { TerminalCommand } from '../command-base';

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
      } else throw new Error(`${this.name} requires a subcommand`);
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
        return ['address'].filter((c) => c.startsWith(args[0]));

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

    if ('RoutingTable' in this.terminal.Node)
      this.registerCommand(new IPInterfaceCommand(this));
    if ('knownVlan' in this.terminal.Node)
      this.registerCommand(new SwitchPortCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length === 2) {
        const ifaces = this.Terminal.Node.getInterfaces()
          .map((iface) => {
            const match = iface.matchAll(/^([a-zA-Z]+)\s?(\d+(?:\/\d+)*)/g);
            return match.next().value;
          })
          .filter((iface) => iface[1].startsWith(args[0]))
          .filter((iface) => iface[2].startsWith(args[1]))
          .map((iface) => iface[0]);

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
        const ifaces = this.Terminal.Node.getInterfaces()
          .filter((iface) => iface.startsWith(args[0]))
          .map((iface) => {
            const match = iface.matchAll(/^([a-zA-Z]+)\s?(\d+(?:\/\d+)*)/g);
            return match.next().value[1];
          });

        return Array.from(new Set(ifaces));
      }
      if (args.length === 2) {
        const ifaces = this.Terminal.Node.getInterfaces()
          .filter((iface) => iface.startsWith(args[0]))
          .map((iface) => {
            const match = iface.matchAll(/^([a-zA-Z]+)\s?(\d+(?:\/\d+)*)/g);
            return match.next().value[2];
          })
          .filter((iface) => iface.startsWith(args[1]));

        return Array.from(new Set(ifaces));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

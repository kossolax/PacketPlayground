import { IPAddress } from '../../address';
import type { RouterHost } from '../../nodes/router';
import type { SwitchHost } from '../../nodes/switch';
import { InterfaceCommand } from './interface';
import { RouterOSPFCommand } from './ospf';
import { TerminalCommand } from '../command-base';
import { SpanningTreeConfigCommand } from './stp';
import { RouterRipCommand } from './rip';

export { InterfaceCommand };

// Internal command classes defined first to avoid no-use-before-define

class HostnameConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'hostname');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const [hostname] = args;
      if (args.length === 1) {
        this.Terminal.Node.name = hostname;

        this.finalize();
      } else throw new Error(`${this.name} requires a subcommand`);
    } else {
      super.exec(command, args, negated);
    }
  }
}

class IPConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args[0] === 'route' && args.length === 4) {
        const network = new IPAddress(args[1]);
        const mask = new IPAddress(args[2], true);
        const gateway = new IPAddress(args[3]);

        if (negated)
          (this.Terminal.Node as RouterHost).deleteRoute(
            network,
            mask,
            gateway
          );
        else
          (this.Terminal.Node as RouterHost).addRoute(network, mask, gateway);
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
        return ['route'].filter((c) => c.startsWith(args[0]));

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

class VlanNameCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'name');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const [vlanName] = args;
      if (args.length === 1) {
        const { vlanId } = this.parent as VlanConfigCommand;
        const host = this.Terminal.Node as SwitchHost;

        if (!negated) host.knownVlan[vlanId] = vlanName;

        this.finalize();
      } else {
        throw new Error(`${this.name} requires an vlan name`);
      }
    } else {
      super.exec(command, args, negated);
    }
  }
}
class VlanConfigCommand extends TerminalCommand {
  public vlanId: number = 0;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'vlan', '(config-vlan)#');
    this.parent = parent;
    this.canBeNegative = true;

    this.registerCommand(new VlanNameCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length === 1) {
        const host = this.Terminal.Node as SwitchHost;
        this.vlanId = parseInt(args[0], 10);

        if (!negated) {
          if (!host.knownVlan[this.vlanId])
            host.knownVlan[this.vlanId] = `VLAN${this.vlanId}`;

          this.terminal.changeDirectory(this);
        } else {
          if (host.knownVlan[this.vlanId]) delete host.knownVlan[this.vlanId];
          this.finalize();
        }
      } else {
        throw new Error(`${this.name} requires an vlan id`);
      }
    } else {
      super.exec(command, args, negated);
    }
  }
}

class RouterCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'router');
    this.parent = parent;
    this.canBeNegative = true;

    // Register router subcommands conditionally based on device type
    const node = this.terminal.Node;
    if ('services' in node && 'rip' in (node as RouterHost).services) {
      this.registerCommand(new RouterRipCommand(this));
    }
    if ('services' in node && 'ospf' in (node as RouterHost).services) {
      this.registerCommand(new RouterOSPFCommand(this));
    }
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // If no subcommand, show available commands
      if (args.length === 0) {
        throw new Error('% Incomplete command');
      }
      // Let subcommands handle the rest
      super.exec(args[0], args.slice(1), negated);
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
      const suggestions: string[] = [];
      const node = this.terminal.Node;

      // Add 'rip' if RIP is available
      if ('services' in node && 'rip' in (node as RouterHost).services) {
        suggestions.push('rip');
      }

      // Add 'ospf' if OSPF is available
      if ('services' in node && 'ospf' in (node as RouterHost).services) {
        suggestions.push('ospf');
      }

      return suggestions.filter((s) => s.startsWith(args[0]));
    }

    return super.autocomplete(command, args, negated);
  }
}

// Main ConfigCommand class

export class ConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'configure', '(config)#');
    this.parent = parent;

    this.registerCommand(new HostnameConfigCommand(this));

    if ('RoutingTable' in this.terminal.Node)
      this.registerCommand(new IPConfigCommand(this));
    if ('knownVlan' in this.terminal.Node)
      this.registerCommand(new VlanConfigCommand(this));
    if ('spanningTree' in this.terminal.Node)
      this.registerCommand(new SpanningTreeConfigCommand(this));

    // Register router command for routers with services (RIP, OSPF, etc.)
    if ('services' in this.terminal.Node)
      this.registerCommand(new RouterCommand(this));

    this.registerCommand(new InterfaceCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length > 0 && args[0] === 'terminal')
        this.terminal.changeDirectory(this);
      else throw new Error(`${this.name} requires a subcommand`);
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
        return ['terminal'].filter((c) => c.startsWith(args[0]));

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

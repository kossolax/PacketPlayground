import { PingCommand } from './basic';
import { ConfigCommand } from './config';
import { ShowStandbyCommand } from './fhrp';
import { ShowSpanningTreeCommand } from './stp';
import {
  ShowIpInterfaceBriefCommand,
  ShowVlanBriefCommand,
  ShowMacAddressTableCommand,
  ShowArpCommand,
  ShowIpRouteCommand,
  ShowInterfacesCommand,
} from './show';
import { TerminalCommand } from '../command-base';
import type { RouterHost } from '../../nodes/router';

export { PingCommand };

// Simple dispatcher that passes through exec but propagates onComplete properly
class ShowIpCommand extends TerminalCommand {
  private ipInterfaceBriefCmd: ShowIpInterfaceBriefCommand;

  private ipRouteCmd: ShowIpRouteCommand;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;

    this.ipInterfaceBriefCmd = new ShowIpInterfaceBriefCommand(this);
    this.ipRouteCmd = new ShowIpRouteCommand(this);

    this.registerCommand(this.ipInterfaceBriefCmd);
    this.registerCommand(this.ipRouteCmd);
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length === 0) {
        throw new Error('% Incomplete command');
      }

      // Dispatch based on next argument
      // Note: onComplete is now automatically propagated by parent class
      if (args[0] === 'interface' && args[1] === 'brief') {
        this.ipInterfaceBriefCmd.exec('ip', args, negated);
      } else if (args[0] === 'route') {
        this.ipRouteCmd.exec('ip', args, negated);
      } else {
        throw new Error('% Incomplete or invalid command');
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
        return ['interface', 'route'].filter((s) => s.startsWith(args[0]));
      }
      if (args.length === 2 && args[0] === 'interface') {
        return ['brief'].filter((s) => s.startsWith(args[1]));
      }
    }
    return super.autocomplete(command, args, negated);
  }
}

class ShowVlanCommand extends TerminalCommand {
  private vlanBriefCmd: ShowVlanBriefCommand;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'vlan');
    this.parent = parent;

    this.vlanBriefCmd = new ShowVlanBriefCommand(this);
    this.registerCommand(this.vlanBriefCmd);
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length === 0 || args[0] !== 'brief') {
        throw new Error('% Incomplete or invalid command');
      }

      // Note: onComplete is now automatically propagated by parent class
      this.vlanBriefCmd.exec('vlan', args, negated);
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
      return ['brief'].filter((s) => s.startsWith(args[0]));
    }
    return super.autocomplete(command, args, negated);
  }
}

class ShowMacCommand extends TerminalCommand {
  private macAddressTableCmd: ShowMacAddressTableCommand;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'mac');
    this.parent = parent;

    this.macAddressTableCmd = new ShowMacAddressTableCommand(this);
    this.registerCommand(this.macAddressTableCmd);
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length === 0 || args[0] !== 'address-table') {
        throw new Error('% Incomplete or invalid command');
      }

      // Note: onComplete is now automatically propagated by parent class
      this.macAddressTableCmd.exec('mac', args, negated);
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
      return ['address-table'].filter((s) => s.startsWith(args[0]));
    }
    return super.autocomplete(command, args, negated);
  }
}

// ShowCommand - parent for all 'show' commands
class ShowCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'show');
    this.parent = parent;

    // Register show subcommands conditionally based on device type
    const node = this.terminal.Node;

    // IP-related commands (routers and L3 switches)
    if ('RoutingTable' in node) {
      this.registerCommand(new ShowIpCommand(this));
    }

    // VLAN and MAC commands (switches)
    if ('knownVlan' in node) {
      this.registerCommand(new ShowVlanCommand(this));
      this.registerCommand(new ShowMacCommand(this));
    }

    // General commands (all devices)
    this.registerCommand(new ShowArpCommand(this));
    this.registerCommand(new ShowInterfacesCommand(this));

    // Protocol-specific commands
    if ('services' in node && 'fhrp' in (node as RouterHost).services) {
      this.registerCommand(new ShowStandbyCommand(this));
    }
    if ('spanningTree' in node) {
      this.registerCommand(new ShowSpanningTreeCommand(this));
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
    if (command === this.name) {
      // Level 1: "show" or "show ?" - return available show commands
      if (args.length <= 1) {
        const suggestions: string[] = [];

        const node = this.terminal.Node;

        // Add IP commands
        if ('RoutingTable' in node) {
          suggestions.push('ip');
        }

        // Add VLAN and MAC commands
        if ('knownVlan' in node) {
          suggestions.push('vlan');
          suggestions.push('mac');
        }

        // General commands
        suggestions.push('arp');
        suggestions.push('interfaces');

        // Protocol-specific commands
        if ('services' in node && 'fhrp' in (node as RouterHost).services) {
          suggestions.push('standby');
        }
        if ('spanningTree' in node) {
          suggestions.push('spanning-tree');
        }

        // Filter by prefix if we have an argument
        return args.length === 0
          ? suggestions
          : suggestions.filter((s) => s.startsWith(args[0]));
      }

      // Level 2+: "show ip ?" or "show ip interface ?" - delegate to child commands
      if (args.length >= 2) {
        return this.autocompleteChild(args[0], args.slice(1), negated);
      }
    }

    return super.autocomplete(command, args, negated);
  }
}

export class AdminCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'enable', '#');
    this.parent = parent;

    this.registerCommand(new ShowCommand(this));
    this.registerCommand(new PingCommand(this));
    this.registerCommand(new ConfigCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      this.terminal.write(`${this.Terminal.Node.name} is now in admin mode.`);
      this.terminal.changeDirectory(this);
    } else {
      super.exec(command, args, negated);
    }
  }
}

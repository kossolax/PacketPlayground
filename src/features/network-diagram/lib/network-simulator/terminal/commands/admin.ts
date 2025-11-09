import { PingCommand } from './basic';
import { ConfigCommand } from './config';
import { ShowStandbyCommand } from './fhrp';
import { ShowIpRipCommand, ShowIpProtocolsCommand } from './rip';
import { ShowIPOSPFCommand } from './ospf';
import { ShowIpBgpCommand } from './bgp';
import { TerminalCommand } from '../command-base';
import type { RouterHost } from '../../nodes/router';

export { PingCommand };

// ShowIpCommand - parent for 'show ip' commands
class ShowIPCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ip');
    this.parent = parent;

    // Register show ip subcommands
    const node = this.terminal.Node;
    if ('services' in node && 'rip' in (node as RouterHost).services) {
      this.registerCommand(new ShowIpRipCommand(this));
      this.registerCommand(new ShowIpProtocolsCommand(this));
    }
    // Register OSPF show commands
    if ('services' in node && 'ospf' in (node as RouterHost).services) {
      this.registerCommand(new ShowIPOSPFCommand(this));
    }
    // Register BGP show commands
    if ('services' in node && 'bgp' in (node as RouterHost).services) {
      this.registerCommand(new ShowIpBgpCommand(this));
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
      if (args.length === 1) {
        const suggestions: string[] = [];
        const node = this.terminal.Node;

        // Add 'rip' and 'protocols' if RIP is available
        if ('services' in node && 'rip' in (node as RouterHost).services) {
          suggestions.push('rip', 'protocols');
        }

        // Add 'ospf' if OSPF is available
        if ('services' in node && 'ospf' in (node as RouterHost).services) {
          suggestions.push('ospf');
        }

        // Add 'bgp' if BGP is available
        if ('services' in node && 'bgp' in (node as RouterHost).services) {
          suggestions.push('bgp');
        }

        return suggestions.filter((s) => s.startsWith(args[0]));
      }

      if (args.length > 1) {
        // Delegate to subcommand
        return this.autocompleteChild(args[0], args.slice(1), negated);
      }
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
    if ('services' in node && 'fhrp' in (node as RouterHost).services) {
      this.registerCommand(new ShowStandbyCommand(this));
    }

    // Register show ip commands
    if ('services' in node && 'rip' in (node as RouterHost).services) {
      this.registerCommand(new ShowIPCommand(this));
    }
    if ('services' in node && 'ospf' in (node as RouterHost).services) {
      this.registerCommand(new ShowIPCommand(this));
    }
    if ('services' in node && 'bgp' in (node as RouterHost).services) {
      this.registerCommand(new ShowIPCommand(this));
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
      if (args.length === 1) {
        const suggestions: string[] = [];

        // Add 'standby' if FHRP is available
        const node = this.terminal.Node;
        if ('services' in node && 'fhrp' in (node as RouterHost).services) {
          suggestions.push('standby');
        }

        // Add 'ip' if RIP, OSPF or BGP is available
        if ('services' in node && 'rip' in (node as RouterHost).services) {
          suggestions.push('ip');
        }
        if ('services' in node && 'ospf' in (node as RouterHost).services) {
          suggestions.push('ip');
        }
        if ('services' in node && 'bgp' in (node as RouterHost).services) {
          suggestions.push('ip');
        }

        return suggestions.filter((s) => s.startsWith(args[0]));
      }

      if (args.length > 1) {
        // Delegate to subcommand
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

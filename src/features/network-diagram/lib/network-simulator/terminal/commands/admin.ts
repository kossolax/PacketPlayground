import { PingCommand } from './basic';
import { ConfigCommand } from './config';
import { ShowStandbyCommand } from './fhrp';
import { TerminalCommand } from '../command-base';

export { PingCommand };

// ShowCommand - parent for all 'show' commands
class ShowCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'show');
    this.parent = parent;

    // Register show subcommands conditionally based on device type
    if ('services' in this.terminal.Node && 'fhrp' in this.terminal.Node.services) {
      this.registerCommand(new ShowStandbyCommand(this));
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

      // Add 'standby' if FHRP is available
      if ('services' in this.terminal.Node && 'fhrp' in this.terminal.Node.services) {
        suggestions.push('standby');
      }

      return suggestions.filter((s) => s.startsWith(args[0]));
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

import { RootCommand } from './commands/basic';
import { AdminCommand } from './commands/admin';
import type { TerminalCommand } from './command-base';
import type { NetworkHost } from '../nodes/generic';
import type { SwitchHost } from '../nodes/switch';

export type { TerminalCommand };

export class Terminal {
  public onDirectoryChange?: (directory: TerminalCommand) => void;

  public onText?: (text: string) => void;

  public onComplete?: () => void;

  protected locked: boolean = false;

  private historyIndex: number = 0;

  private history: string[] = [];

  private location: TerminalCommand;

  private node: NetworkHost | SwitchHost;

  get Locked(): boolean {
    return this.locked;
  }

  get Node(): NetworkHost | SwitchHost {
    return this.node;
  }

  get Prompt(): string {
    return `${this.Node.name}${this.location.Prompt}`;
  }

  constructor(node: NetworkHost | SwitchHost) {
    this.node = node;
    this.location = new RootCommand(this);

    // Register AdminCommand after RootCommand to avoid circular dependency
    if ('RoutingTable' in node || 'knownVlan' in node) {
      this.location.registerCommand(new AdminCommand(this.location));
    }

    this.changeDirectory(this.location);
  }

  public exec(commandWithArguments: string): boolean {
    if (this.locked) return false;

    const commands = commandWithArguments
      .trim()
      .split(' ')
      .filter((x) => x);
    let command = commands[0];
    const args = commands.slice(1);

    this.locked = true;
    this.history.push([command, ...args].join(' '));
    this.historyIndex = this.history.length - 1;

    let negated = false;
    if (command === 'no') {
      negated = true;
      command = args.length >= 1 ? args.shift()! : '';
    }

    try {
      let node = this.location;

      if (node.Recursive) {
        const realCommand = node.Parent.autocomplete(command, [], negated);
        if (realCommand.length === 1 && realCommand[0] === node.Name) {
          node = node.Parent;
        }
      }

      const realCommand = node.autocomplete(command, [], negated);
      if (realCommand.length === 1) {
        command = realCommand.join('');

        for (let i = 0; i < args.length; i += 1) {
          const realArgs = node.autocompleteChild(
            command,
            args.slice(0, i + 1),
            negated
          );
          if (realArgs.length === 1) args[i] = realArgs.join('');
        }
      }

      node.exec(command, args, negated);
      return true;
    } catch (e) {
      if (this.onText) {
        this.onText(e as string);
      }
      if (this.onComplete) {
        this.onComplete();
      }
      this.locked = false;
    }

    return false;
  }

  public historyBack(): string {
    if (this.historyIndex > 0) this.historyIndex -= 1;
    return this.history[this.historyIndex];
  }

  public historyForward(): string {
    if (this.historyIndex < this.history.length - 1) this.historyIndex += 1;
    return this.history[this.historyIndex];
  }

  public autocomplete(commandWithArguments: string): string[] {
    const commands = commandWithArguments
      .trim()
      .split(' ')
      .filter((x) => x);
    let command = commands[0] || '';
    const args = commands.slice(1) || [];
    let negated = false;

    if (command === 'no') {
      negated = true;
      command = args.length >= 1 ? args.shift()! : '';
    }

    if (commandWithArguments[commandWithArguments.length - 1] === ' ')
      args.push('');

    const commandsAvailable = this.location.autocomplete(
      command,
      args,
      negated
    );

    if (commandsAvailable.length === 1) {
      const subCommands = this.location.autocompleteChild(
        commandsAvailable[0],
        args,
        negated
      );
      if (subCommands.length >= 1 || args.length >= 1) return subCommands;
    }

    return commandsAvailable;
  }

  public changeDirectory(t: TerminalCommand): void {
    const command = t;
    this.location = command;

    // Set up completion callback for this command
    command.onComplete = () => {
      this.locked = false;
      if (this.onComplete) {
        this.onComplete();
      }
    };

    if (this.onDirectoryChange) {
      this.onDirectoryChange(command);
    }

    // Unlock terminal when changing directory (like Angular's Complete$ tap)
    this.locked = false;

    if (this.onComplete) {
      this.onComplete();
    }
  }

  public write(text: string): void {
    if (this.onText) {
      this.onText(text);
    }
  }
}

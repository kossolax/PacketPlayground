import type { Terminal } from './terminal';

export type { Terminal };

export abstract class TerminalCommand {
  protected name: string;

  protected terminal: Terminal;

  protected parent: TerminalCommand;

  protected canBeNegative: boolean;

  protected isRecursive: boolean;

  private prompt: string;

  public onComplete?: () => void;

  get Prompt(): string {
    return this.prompt;
  }

  get Terminal(): Terminal {
    return this.terminal;
  }

  get Recursive(): boolean {
    return this.isRecursive;
  }

  get Name(): string {
    return this.name;
  }

  get Parent(): TerminalCommand {
    return this.parent;
  }

  private subCommands: Record<string, TerminalCommand> = {};

  constructor(terminal: Terminal, name: string, prompt: string = '') {
    this.terminal = terminal;
    this.name = name;
    this.prompt = prompt;
    this.parent = this;
    this.canBeNegative = false;
    this.isRecursive = false;
  }

  public registerCommand(command: TerminalCommand): void {
    this.subCommands[command.name] = command;
  }

  public exec(command: string, args: string[], negated: boolean = false): void {
    if (command === 'end' && !negated) {
      this.terminal.changeDirectory(this.parent);
    } else if (command === 'exit' && !negated) {
      let p = this.parent;
      while (p !== p.parent) p = p.parent;

      this.terminal.changeDirectory(p);
    } else if (
      command in this.subCommands &&
      ((negated && this.subCommands[command].canBeNegative) || !negated)
    ) {
      this.subCommands[command].exec(command, args, negated);
    } else {
      throw new Error(`Command "${negated ? 'no ' : ''}${command}" not found.`);
    }
  }

  public autocomplete(
    command: string,
    _args: string[],
    negated: boolean
  ): string[] {
    const commands = Object.keys(this.subCommands).filter(
      (c) => (negated && this.subCommands[c].canBeNegative) || !negated
    );

    commands.sort();

    if (!command) return commands;

    return commands.filter((c) => c.startsWith(command));
  }

  public autocompleteChild(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command in this.subCommands)
      return this.subCommands[command].autocomplete(command, args, negated);
    return [];
  }

  protected finalize(): void {
    if (this.parent.onComplete) {
      this.parent.onComplete();
    }
  }
}

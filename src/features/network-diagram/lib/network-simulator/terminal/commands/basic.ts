import { firstValueFrom } from 'rxjs';

import { IPAddress } from '../../address';
import type { IPInterface } from '../../layers/network';
import type { Terminal } from '../terminal';
import { TerminalCommand } from '../command-base';
import type { NetworkHost } from '../../nodes/generic';

export class PingCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ping');
    this.parent = parent;
  }

  public override exec(command: string, args: string[]): void {
    if (args.length < 1) throw new Error(`${this.name} requires a hostname`);

    const nethost = this.terminal.Node as NetworkHost;
    const ipface = nethost.getInterface(0) as IPInterface;

    firstValueFrom(ipface.sendIcmpRequest(new IPAddress(args[0]), 20)).then(
      (data) => {
        if (data) this.terminal.write(`${args[0]} is alive`);
        else this.terminal.write(`${args[0]} is dead`);
        this.finalize();
      }
    );
  }
}

export class RootCommand extends TerminalCommand {
  constructor(terminal: Terminal) {
    super(terminal, '', '$');
    this.parent = this;

    // AdminCommand is registered after import to avoid circular dependency
    // See terminal.ts for registration

    this.registerCommand(new PingCommand(this));
  }
}

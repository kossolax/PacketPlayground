import type { SwitchHost } from '../../nodes/switch';
import {
  SpanningTreeProtocol,
  PVSTService,
  isPerVlanProtocol,
} from '../../services/spanningtree';
import { TerminalCommand } from '../command-base';
import type { InterfaceCommand } from './interface';

/**
 * Global spanning-tree configuration command (config mode)
 * Supports:
 *   spanning-tree mode {stp|pvst}
 *   spanning-tree vlan <ID> priority <VALUE>
 *   spanning-tree priority <VALUE>
 *   no spanning-tree
 */
export class SpanningTreeConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'spanning-tree');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const host = this.terminal.Node as SwitchHost;

      if (negated && args.length === 0) {
        host.spanningTree.Enable = false;
        this.finalize();
        return;
      }

      if (args[0] === 'mode' && args.length === 2) {
        this.execMode(host, args[1]);
        return;
      }

      if (args[0] === 'vlan' && args[2] === 'priority' && args.length === 4) {
        this.execVlanPriority(host, args[1], args[3]);
        return;
      }

      if (args[0] === 'priority' && args.length === 2) {
        const priority = parseInt(args[1], 10);
        host.spanningTree.Priority = priority;
        this.finalize();
        return;
      }

      throw new Error(`${this.name} requires a subcommand`);
    } else {
      super.exec(command, args, negated);
    }
  }

  private execMode(host: SwitchHost, mode: string): void {
    let protocol: SpanningTreeProtocol;

    switch (mode) {
      case 'stp':
        protocol = SpanningTreeProtocol.STP;
        break;
      case 'pvst':
        protocol = SpanningTreeProtocol.PVST;
        break;
      case 'rapid-pvst':
        protocol = SpanningTreeProtocol.RPVST;
        break;
      case 'mst':
        protocol = SpanningTreeProtocol.MSTP;
        break;
      default:
        throw new Error(`Invalid spanning-tree mode: ${mode}`);
    }

    host.setStpProtocol(protocol);
    this.finalize();
  }

  private execVlanPriority(
    host: SwitchHost,
    vlanArg: string,
    priorityArg: string
  ): void {
    const vlanId = parseInt(vlanArg, 10);
    const priority = parseInt(priorityArg, 10);

    if (priority % 4096 !== 0 || priority < 0 || priority > 61440) {
      throw new Error(
        '% Bridge Priority must be in increments of 4096.\n% Allowed values are: 0 4096 8192 12288 16384 20480 24576 28672 32768 36864 40960 45056 49152 53248 57344 61440'
      );
    }

    const protocol = host.getStpProtocol();
    if (isPerVlanProtocol(protocol)) {
      const pvst = host.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      if (tree) {
        tree.Priority = priority;
      } else {
        throw new Error(`% VLAN ${vlanId} not found`);
      }
    } else {
      // eslint-disable-next-line no-param-reassign
      host.spanningTree.Priority = priority;
    }
    this.finalize();
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1) {
        return ['mode', 'vlan', 'priority'].filter((c) =>
          c.startsWith(args[0])
        );
      }

      if (args[0] === 'mode' && args.length === 2) {
        return ['stp', 'pvst', 'rapid-pvst', 'mst'].filter((c) =>
          c.startsWith(args[1])
        );
      }

      if (args[0] === 'vlan' && args.length === 3) {
        return ['priority'].filter((c) => c.startsWith(args[2]));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Interface-level spanning-tree cost command (config-if mode)
 * Supports:
 *   spanning-tree cost <VALUE>
 *   no spanning-tree cost
 */
export class SpanningTreeInterfaceCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'spanning-tree');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const host = this.terminal.Node as SwitchHost;
      const { iface } = this.parent as InterfaceCommand;
      if (!iface) throw new Error('No interface selected');

      if (args[0] === 'cost' && args.length === 2 && !negated) {
        const cost = parseInt(args[1], 10);
        if (cost < 1 || cost > 200000000) {
          throw new Error('% Value must be between 1 and 200000000');
        }
        host.spanningTree.setPortCost(iface, cost);
        this.finalize();
        return;
      }

      if (args[0] === 'cost' && negated) {
        host.spanningTree.setPortCost(iface, 0);
        this.finalize();
        return;
      }

      throw new Error(`${this.name} requires a subcommand`);
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
        return ['cost'].filter((c) => c.startsWith(args[0]));
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

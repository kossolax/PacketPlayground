import type { SwitchHost } from '../../nodes/switch';
import {
  SpanningTreeProtocol,
  PVSTService,
  MSTPService,
  isPerVlanProtocol,
  isMstpProtocol,
} from '../../services/spanningtree';
import { TerminalCommand } from '../command-base';
import type { InterfaceCommand } from './interface';

// --- MST Configuration submode commands ---

class MstNameCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'name');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    _negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length !== 1) throw new Error('% Name requires a value');
      const host = this.terminal.Node as SwitchHost;
      const mstp = host.spanningTree as MSTPService;
      mstp.mstConfig.name = args[0].substring(0, 32);
      this.finalize();
    } else {
      super.exec(command, args, _negated);
    }
  }
}

class MstRevisionCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'revision');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    _negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length !== 1) throw new Error('% Revision requires a value');
      const rev = parseInt(args[0], 10);
      if (Number.isNaN(rev) || rev < 0 || rev > 65535) {
        throw new Error('% Revision must be between 0 and 65535');
      }
      const host = this.terminal.Node as SwitchHost;
      const mstp = host.spanningTree as MSTPService;
      mstp.mstConfig.revision = rev;
      this.finalize();
    } else {
      super.exec(command, args, _negated);
    }
  }
}

class MstInstanceVlanCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'instance');
    this.parent = parent;
    this.canBeNegative = true;
  }

  /**
   * Parse VLAN range string: "10,20,30-40" → [10, 20, 30, 31, ..., 40]
   */
  private static parseVlanRange(rangeStr: string): number[] {
    const vlans: number[] = [];
    rangeStr.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        for (let v = start; v <= end; v += 1) vlans.push(v);
      } else {
        vlans.push(parseInt(trimmed, 10));
      }
    });
    return vlans;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // instance <ID> vlan <RANGE>
      if (args.length < 3 || args[1] !== 'vlan') {
        throw new Error('% Usage: instance <ID> vlan <RANGE>');
      }
      const instanceId = parseInt(args[0], 10);
      if (Number.isNaN(instanceId) || instanceId < 0 || instanceId > 15) {
        throw new Error('% Instance ID must be between 0 and 15');
      }
      const vlanRange = args.slice(2).join(',');
      const vlans = MstInstanceVlanCommand.parseVlanRange(vlanRange);
      const host = this.terminal.Node as SwitchHost;
      const mstp = host.spanningTree as MSTPService;

      vlans.forEach((vlanId) => {
        if (negated) {
          // no instance X vlan Y → unmap back to IST
          mstp.mstConfig.setVlanInstance(vlanId, 0);
        } else {
          mstp.mstConfig.setVlanInstance(vlanId, instanceId);
        }
      });
      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

class MstConfigurationCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'configuration', '(config-mst)#');
    this.parent = parent;

    this.registerCommand(new MstNameCommand(this));
    this.registerCommand(new MstRevisionCommand(this));
    this.registerCommand(new MstInstanceVlanCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name && args.length === 0) {
      this.terminal.changeDirectory(this);
    } else {
      super.exec(command, args, negated);
    }
  }
}

/**
 * Global spanning-tree configuration command (config mode)
 * Supports:
 *   spanning-tree mode {stp|pvst|rapid-pvst|mst}
 *   spanning-tree vlan <ID> priority <VALUE>
 *   spanning-tree priority <VALUE>
 *   spanning-tree mst configuration → enters (config-mst)# submode
 *   spanning-tree mst <ID> priority <VALUE> → per-instance priority
 *   no spanning-tree
 */
export class SpanningTreeConfigCommand extends TerminalCommand {
  private mstConfigCmd: MstConfigurationCommand;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'spanning-tree');
    this.parent = parent;
    this.canBeNegative = true;
    this.mstConfigCmd = new MstConfigurationCommand(this);
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

      // spanning-tree mst configuration → enter MST config submode
      if (args[0] === 'mst' && args[1] === 'configuration') {
        this.mstConfigCmd.exec('configuration', [], false);
        return;
      }

      // spanning-tree mst <ID> priority <VALUE> → per-instance priority
      if (args[0] === 'mst' && args.length === 4 && args[2] === 'priority') {
        this.execMstPriority(host, args[1], args[3]);
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

  private execMstPriority(
    host: SwitchHost,
    instanceArg: string,
    priorityArg: string
  ): void {
    const instanceId = parseInt(instanceArg, 10);
    const priority = parseInt(priorityArg, 10);

    if (priority % 4096 !== 0 || priority < 0 || priority > 61440) {
      throw new Error(
        '% Bridge Priority must be in increments of 4096.\n% Allowed values are: 0 4096 8192 12288 16384 20480 24576 28672 32768 36864 40960 45056 49152 53248 57344 61440'
      );
    }

    if (!isMstpProtocol(host.getStpProtocol())) {
      throw new Error('% Spanning tree mode is not MST');
    }

    const mstp = host.spanningTree as MSTPService;
    mstp.setInstancePriority(instanceId, priority);
    this.finalize();
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1) {
        return ['mode', 'vlan', 'mst', 'priority'].filter((c) =>
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

      if (args[0] === 'mst' && args.length === 2) {
        return ['configuration', 'priority'].filter((c) =>
          c.startsWith(args[1])
        );
      }

      if (
        args[0] === 'mst' &&
        args.length === 3 &&
        args[1] !== 'configuration'
      ) {
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

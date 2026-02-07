import type { SwitchHost } from '../../nodes/switch';
import {
  SpanningTreeProtocol,
  SpanningTreeState,
  SpanningTreePortRole,
  PVSTService,
} from '../../services/spanningtree';
import { TerminalCommand } from '../command-base';

function stateToString(state: SpanningTreeState): string {
  switch (state) {
    case SpanningTreeState.Disabled:
      return 'Disabled';
    case SpanningTreeState.Blocking:
      return 'BLK';
    case SpanningTreeState.Listening:
      return 'LIS';
    case SpanningTreeState.Learning:
      return 'LRN';
    case SpanningTreeState.Forwarding:
      return 'FWD';
    default:
      return '???';
  }
}

function roleToString(role: SpanningTreePortRole): string {
  switch (role) {
    case SpanningTreePortRole.Disabled:
      return 'Disabled';
    case SpanningTreePortRole.Root:
      return 'Root';
    case SpanningTreePortRole.Designated:
      return 'Desg';
    case SpanningTreePortRole.Blocked:
      return 'Blkd';
    case SpanningTreePortRole.Alternate:
      return 'Altn';
    case SpanningTreePortRole.Backup:
      return 'BkUp';
    default:
      return '????';
  }
}

function protocolToString(protocol: SpanningTreeProtocol): string {
  switch (protocol) {
    case SpanningTreeProtocol.STP:
      return 'ieee';
    case SpanningTreeProtocol.PVST:
      return 'pvst';
    case SpanningTreeProtocol.RPVST:
      return 'rapid-pvst';
    case SpanningTreeProtocol.MSTP:
      return 'mst';
    default:
      return 'none';
  }
}

function formatSpanningTreeForVlan(
  host: SwitchHost,
  vlanId: number,
  protocol: SpanningTreeProtocol
): string {
  const { spanningTree: stp } = host;
  const lines: string[] = [];

  if (protocol === SpanningTreeProtocol.PVST) {
    const pvst = stp as PVSTService;
    const tree = pvst.getVlanTree(vlanId);
    if (!tree) return '';

    const proto = protocolToString(protocol);
    lines.push(`VLAN${String(vlanId).padStart(4, '0')}`);
    lines.push(`  Spanning tree enabled protocol ${proto}`);
    lines.push(`  Root ID    Priority    ${tree.Priority}`);
    lines.push(`             Address     ${tree.Root.toString()}`);
    if (tree.IsRoot) {
      lines.push('             This bridge is the root');
    }
    lines.push(`  Bridge ID  Priority    ${tree.Priority}`);
    lines.push(`             Address     ${tree.BridgeId.toString()}`);
  } else {
    const proto = protocolToString(protocol);
    lines.push(`  Spanning tree enabled protocol ${proto}`);
    lines.push(`  Root ID    Priority    ${stp.Priority}`);
    lines.push(`             Address     ${stp.Root.toString()}`);
    if (stp.IsRoot) {
      lines.push('             This bridge is the root');
    }
    lines.push(`  Bridge ID  Priority    ${stp.Priority}`);
    lines.push(`             Address     ${stp.BridgeId.toString()}`);
  }

  lines.push('');
  lines.push('Interface        Role Sts      Cost');
  lines.push('---------------- ---- --- ---------');

  host.getInterfaces().forEach((ifaceName) => {
    const iface = host.getInterface(ifaceName);
    const state = stp.State(iface, vlanId);
    const role = stp.Role(iface, vlanId);
    const cost = stp.Cost(iface, vlanId);

    const costStr =
      cost === Number.MAX_VALUE ? '        ∞' : String(cost).padStart(9);
    const name = ifaceName.padEnd(17);
    const roleStr = roleToString(role).padEnd(5);
    const stateStr = stateToString(state).padEnd(4);

    lines.push(`${name}${roleStr}${stateStr}${costStr}`);
  });

  return lines.join('\n');
}

class ShowSpanningTreeCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'spanning-tree');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const host = this.terminal.Node as SwitchHost;
      const protocol = host.getStpProtocol();

      if (!host.spanningTree.Enable) {
        this.terminal.write('Spanning tree is disabled');
        this.finalize();
        return;
      }

      if (
        protocol === SpanningTreeProtocol.PVST &&
        args.length === 2 &&
        args[0] === 'vlan'
      ) {
        const id = parseInt(args[1], 10);
        const output = formatSpanningTreeForVlan(host, id, protocol);
        if (output) {
          this.terminal.write(output);
        } else {
          this.terminal.write(`VLAN ${id} not found`);
        }
      } else if (protocol === SpanningTreeProtocol.PVST) {
        const vlanIds = host.spanningTree.getVlanIds();
        const outputs = vlanIds
          .map((id) => formatSpanningTreeForVlan(host, id, protocol))
          .filter((o) => o);
        this.terminal.write(outputs.join('\n\n'));
      } else {
        const output = formatSpanningTreeForVlan(host, 0, protocol);
        this.terminal.write(output);
      }

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
      const host = this.terminal.Node as SwitchHost;
      const protocol = host.getStpProtocol();

      if (protocol === SpanningTreeProtocol.PVST) {
        if (args.length === 1)
          return ['vlan'].filter((c) => c.startsWith(args[0]));
      }
      return [];
    }
    return super.autocomplete(command, args, negated);
  }
}

// eslint-disable-next-line import/prefer-default-export
export class ShowCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'show');
    this.parent = parent;

    if ('knownVlan' in this.terminal.Node) {
      this.registerCommand(new ShowSpanningTreeCommand(this));
    }
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      if (args.length >= 1) {
        const [subCommand, ...subArgs] = args;
        super.exec(subCommand, subArgs, negated);
      } else {
        throw new Error(`${this.name} requires a subcommand`);
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
      if (args.length >= 1) {
        const [subCommand, ...subArgs] = args;

        if (subArgs.length === 0) {
          return super.autocomplete(subCommand, subArgs, negated);
        }

        return super.autocompleteChild(subCommand, subArgs, negated);
      }
      return [];
    }
    return super.autocomplete(command, args, negated);
  }
}

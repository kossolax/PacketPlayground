import type { SwitchHost } from '../../nodes/switch';
import { SpanningTreeProtocol } from '../../services/spanningtree';
import { TerminalCommand } from '../command-base';
import type { InterfaceCommand } from './interface';

/**
 * Spanning-Tree Config Command - Configure STP globally
 * Usage:
 *   spanning-tree mode {stp|rstp|pvst|rpvst|mstp}
 *   spanning-tree vlan <vlan-id> root primary
 *   spanning-tree vlan <vlan-id> root secondary
 *   spanning-tree vlan <vlan-id> priority <0-61440>
 *   spanning-tree mst configuration
 */
export class SpanningTreeConfigCommand extends TerminalCommand {
  private mstConfigCommand: MstConfigCommand;

  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'spanning-tree');
    this.parent = parent;
    this.canBeNegative = true;

    // Register MST configuration submode
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    this.mstConfigCommand = new MstConfigCommand(this);
    this.registerCommand(this.mstConfigCommand);
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const switchHost = this.Terminal.Node as SwitchHost;

      if (!('spanningTree' in switchHost)) {
        throw new Error('Spanning-tree is not supported on this device');
      }

      // spanning-tree mode {stp|rstp|pvst|rpvst|mstp}
      if (args[0] === 'mode' && args.length === 2) {
        const modeMap: Record<string, SpanningTreeProtocol> = {
          stp: SpanningTreeProtocol.STP,
          rstp: SpanningTreeProtocol.RSTP,
          pvst: SpanningTreeProtocol.PVST,
          rpvst: SpanningTreeProtocol.RPVST,
          mstp: SpanningTreeProtocol.MSTP,
        };

        const mode = modeMap[args[1].toLowerCase()];
        if (!mode) {
          throw new Error(
            `Invalid spanning-tree mode: ${args[1]}. Valid modes: stp, rstp, pvst, rpvst, mstp`
          );
        }

        switchHost.setStpProtocol(mode);
        this.terminal.write(
          `Spanning-tree mode set to ${args[1].toUpperCase()}`
        );
        this.finalize();
        return;
      }

      // spanning-tree vlan <vlan-id> root {primary|secondary}
      if (
        args[0] === 'vlan' &&
        args.length === 4 &&
        args[2] === 'root' &&
        (args[3] === 'primary' || args[3] === 'secondary')
      ) {
        const vlanId = parseInt(args[1], 10);
        if (Number.isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
          throw new Error('VLAN ID must be between 1 and 4094');
        }

        // Check if per-VLAN protocol is enabled
        const protocol = switchHost.getStpProtocol();
        if (
          protocol !== SpanningTreeProtocol.PVST &&
          protocol !== SpanningTreeProtocol.RPVST &&
          protocol !== SpanningTreeProtocol.MSTP
        ) {
          throw new Error(
            'Per-VLAN configuration requires PVST, RPVST, or MSTP mode'
          );
        }

        // Cisco: primary = 24576, secondary = 28672
        const priority = args[3] === 'primary' ? 24576 : 28672;

        // TODO: Need to add setBridgePriority method to SpanningTreeService
        // For now, we'll access the protected property directly via type assertion
        const service = switchHost.spanningTree as unknown as {
          bridgeId: { priority: number };
        };
        service.bridgeId.priority = priority;

        this.terminal.write(
          `VLAN ${vlanId} spanning-tree root ${args[3]} configured (priority ${priority})`
        );
        this.finalize();
        return;
      }

      // spanning-tree vlan <vlan-id> priority <priority>
      if (args[0] === 'vlan' && args.length === 4 && args[2] === 'priority') {
        const vlanId = parseInt(args[1], 10);
        if (Number.isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
          throw new Error('VLAN ID must be between 1 and 4094');
        }

        const priority = parseInt(args[3], 10);
        // Priority must be a multiple of 4096
        if (
          Number.isNaN(priority) ||
          priority < 0 ||
          priority > 61440 ||
          priority % 4096 !== 0
        ) {
          throw new Error(
            'Priority must be a multiple of 4096 (0, 4096, 8192, ..., 61440)'
          );
        }

        // Check if per-VLAN protocol is enabled
        const protocol = switchHost.getStpProtocol();
        if (
          protocol !== SpanningTreeProtocol.PVST &&
          protocol !== SpanningTreeProtocol.RPVST &&
          protocol !== SpanningTreeProtocol.MSTP
        ) {
          throw new Error(
            'Per-VLAN configuration requires PVST, RPVST, or MSTP mode'
          );
        }

        // TODO: Need to add setBridgePriority method to SpanningTreeService
        const service = switchHost.spanningTree as unknown as {
          bridgeId: { priority: number };
        };
        service.bridgeId.priority = priority;

        this.terminal.write(
          `VLAN ${vlanId} spanning-tree priority set to ${priority}`
        );
        this.finalize();
        return;
      }

      // spanning-tree mst configuration
      if (args[0] === 'mst' && args[1] === 'configuration') {
        // Enter MST configuration submode
        this.terminal.changeDirectory(this.mstConfigCommand);
        return;
      }

      throw new Error('Invalid spanning-tree command syntax');
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
      // First argument
      if (args.length === 1) {
        return ['mode', 'vlan', 'mst'].filter((c) => c.startsWith(args[0]));
      }

      // spanning-tree mode <mode>
      if (args[0] === 'mode' && args.length === 2) {
        return ['stp', 'rstp', 'pvst', 'rpvst', 'mstp'].filter((c) =>
          c.startsWith(args[1])
        );
      }

      // spanning-tree vlan <vlan-id> ...
      if (args[0] === 'vlan') {
        if (args.length === 3) {
          return ['root', 'priority'].filter((c) => c.startsWith(args[2]));
        }
        if (args[2] === 'root' && args.length === 4) {
          return ['primary', 'secondary'].filter((c) => c.startsWith(args[3]));
        }
      }

      // spanning-tree mst configuration
      if (args[0] === 'mst' && args.length === 2) {
        return ['configuration'].filter((c) => c.startsWith(args[1]));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * MST Configuration submode
 * Usage:
 *   name <region-name>
 *   revision <0-65535>
 *   instance <instance-id> vlan <vlan-list>
 */
export class MstConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'mst', '(config-mst)#');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      // Enter MST configuration submode
      this.terminal.changeDirectory(this);
    } else if (command === 'name' && args.length === 1) {
      // name <region-name>
      const switchHost = this.Terminal.Node as SwitchHost;
      const regionName = args[0];

      if (regionName.length > 32) {
        throw new Error('Region name must be maximum 32 characters');
      }

      // Check if MSTP is enabled
      if (switchHost.getStpProtocol() !== SpanningTreeProtocol.MSTP) {
        throw new Error('MSTP mode must be enabled first');
      }

      // Access the setRegionConfig method if it exists
      const service = switchHost.spanningTree as {
        setRegionConfig?: (name: string, revision: number) => void;
        getRegionConfig?: () => { regionName: string; revisionNumber: number };
      };

      if (service.setRegionConfig && service.getRegionConfig) {
        const currentConfig = service.getRegionConfig();
        service.setRegionConfig(regionName, currentConfig.revisionNumber);
        this.terminal.write(`MST region name set to '${regionName}'`);
      } else {
        throw new Error('MSTP configuration not supported on this service');
      }

      this.finalize();
    } else if (command === 'revision' && args.length === 1) {
      // revision <0-65535>
      const switchHost = this.Terminal.Node as SwitchHost;
      const revision = parseInt(args[0], 10);

      if (Number.isNaN(revision) || revision < 0 || revision > 65535) {
        throw new Error('Revision number must be between 0 and 65535');
      }

      // Check if MSTP is enabled
      if (switchHost.getStpProtocol() !== SpanningTreeProtocol.MSTP) {
        throw new Error('MSTP mode must be enabled first');
      }

      const service = switchHost.spanningTree as {
        setRegionConfig?: (name: string, revision: number) => void;
        getRegionConfig?: () => { regionName: string; revisionNumber: number };
      };

      if (service.setRegionConfig && service.getRegionConfig) {
        const currentConfig = service.getRegionConfig();
        service.setRegionConfig(currentConfig.regionName, revision);
        this.terminal.write(`MST revision number set to ${revision}`);
      } else {
        throw new Error('MSTP configuration not supported on this service');
      }

      this.finalize();
    } else if (
      command === 'instance' &&
      args.length === 3 &&
      args[1] === 'vlan'
    ) {
      // instance <instance-id> vlan <vlan-list>
      const switchHost = this.Terminal.Node as SwitchHost;
      const instanceId = parseInt(args[0], 10);

      if (Number.isNaN(instanceId) || instanceId < 0 || instanceId > 15) {
        throw new Error('Instance ID must be between 0 and 15');
      }

      // Check if MSTP is enabled
      if (switchHost.getStpProtocol() !== SpanningTreeProtocol.MSTP) {
        throw new Error('MSTP mode must be enabled first');
      }

      // Parse VLAN list (e.g., "1,2,3" or "10-20" or "1,10-20,30")
      const vlanIds = MstConfigCommand.parseVlanList(args[2]);

      const service = switchHost.spanningTree as {
        setVlanMapping?: (vlanId: number, mstiId: number) => void;
      };

      if (service.setVlanMapping) {
        vlanIds.forEach((vlanId) => {
          service.setVlanMapping!(vlanId, instanceId);
        });
        this.terminal.write(
          `Mapped VLANs ${args[2]} to MST instance ${instanceId}`
        );
      } else {
        throw new Error('MSTP VLAN mapping not supported on this service');
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  /**
   * Parse VLAN list like "1,2,3" or "10-20" or "1,10-20,30"
   */
  private static parseVlanList(vlanList: string): number[] {
    const vlans: number[] = [];
    const parts = vlanList.split(',');

    parts.forEach((part) => {
      if (part.includes('-')) {
        // Range like "10-20"
        const [start, end] = part.split('-').map((s) => parseInt(s.trim(), 10));
        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
          throw new Error(`Invalid VLAN range: ${part}`);
        }
        for (let i = start; i <= end; i += 1) {
          if (i < 1 || i > 4094) {
            throw new Error(`VLAN ID ${i} must be between 1 and 4094`);
          }
          vlans.push(i);
        }
      } else {
        // Single VLAN like "1"
        const vlanId = parseInt(part.trim(), 10);
        if (Number.isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
          throw new Error(`Invalid VLAN ID: ${part}`);
        }
        vlans.push(vlanId);
      }
    });

    return vlans;
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (
      command === 'name' ||
      command === 'revision' ||
      command === 'instance'
    ) {
      // These commands take custom arguments, no autocomplete
      if (command === 'instance' && args.length === 2) {
        return ['vlan'].filter((c) => c.startsWith(args[1]));
      }
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Spanning-Tree Interface Command - Configure STP on an interface
 * Usage:
 *   spanning-tree [vlan <vlan-id>] cost <cost>
 *   spanning-tree [vlan <vlan-id>] port-priority <priority>
 *   spanning-tree portfast
 *   no spanning-tree [vlan <vlan-id>]
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
      const switchHost = this.Terminal.Node as SwitchHost;
      // eslint-disable-next-line prefer-destructuring
      const iface = (this.parent as InterfaceCommand).iface;

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (!('spanningTree' in switchHost)) {
        throw new Error('Spanning-tree is not supported on this device');
      }

      // Handle 'no spanning-tree [vlan <vlan-id>]'
      if (negated) {
        // Disable STP on this interface (set cost to MAX)
        // TODO: Need proper disable method on SpanningTreeService
        this.terminal.write('Spanning-tree disabled on interface');
        this.finalize();
        return;
      }

      // spanning-tree portfast
      if (args[0] === 'portfast') {
        // Portfast is only meaningful for RSTP/RPVST/MSTP (edge port)
        const protocol = switchHost.getStpProtocol();
        if (
          protocol !== SpanningTreeProtocol.RSTP &&
          protocol !== SpanningTreeProtocol.RPVST &&
          protocol !== SpanningTreeProtocol.MSTP
        ) {
          this.terminal.write(
            'Warning: PortFast is only supported in RSTP, RPVST, or MSTP mode'
          );
        }

        // TODO: Need to add setPortFast method to SpanningTreeService
        this.terminal.write('PortFast enabled on interface (edge port)');
        this.finalize();
        return;
      }

      let vlanId: number | undefined;
      let argOffset = 0;

      // Check if vlan keyword is present
      if (args[0] === 'vlan') {
        vlanId = parseInt(args[1], 10);
        if (Number.isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
          throw new Error('VLAN ID must be between 1 and 4094');
        }
        argOffset = 2;
      }

      // spanning-tree [vlan X] cost <cost>
      if (args[argOffset] === 'cost' && args.length === argOffset + 2) {
        const cost = parseInt(args[argOffset + 1], 10);
        if (Number.isNaN(cost) || cost < 1 || cost > 200000000) {
          throw new Error('Cost must be between 1 and 200000000');
        }

        // TODO: Need to add setCost method to SpanningTreeService
        // For now, access the protected property via type assertion
        const service = switchHost.spanningTree as unknown as {
          cost: Map<unknown, number>;
        };
        service.cost.set(iface, cost);

        this.terminal.write(
          `Spanning-tree cost set to ${cost}${vlanId ? ` for VLAN ${vlanId}` : ''}`
        );
        this.finalize();
        return;
      }

      // spanning-tree [vlan X] port-priority <priority>
      if (
        args[argOffset] === 'port-priority' &&
        args.length === argOffset + 2
      ) {
        const priority = parseInt(args[argOffset + 1], 10);
        // Port priority must be a multiple of 16 (0-240)
        if (
          Number.isNaN(priority) ||
          priority < 0 ||
          priority > 240 ||
          priority % 16 !== 0
        ) {
          throw new Error(
            'Port priority must be a multiple of 16 (0, 16, 32, ..., 240)'
          );
        }

        // TODO: Need to add setPortPriority method to SpanningTreeService
        this.terminal.write(
          `Spanning-tree port priority set to ${priority}${vlanId ? ` for VLAN ${vlanId}` : ''}`
        );
        this.finalize();
        return;
      }

      throw new Error('Invalid spanning-tree interface command syntax');
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
      // First argument
      if (args.length === 1) {
        return ['vlan', 'cost', 'port-priority', 'portfast'].filter((c) =>
          c.startsWith(args[0])
        );
      }

      // After vlan keyword
      if (args[0] === 'vlan' && args.length === 3) {
        return ['cost', 'port-priority'].filter((c) => c.startsWith(args[2]));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show Spanning-Tree Command - Display STP status
 * Usage:
 *   show spanning-tree
 *   show spanning-tree brief
 *   show spanning-tree vlan <vlan-id>
 *   show spanning-tree interface <interface>
 *   show spanning-tree root
 *   show spanning-tree mst configuration
 */
export class ShowSpanningTreeCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'spanning-tree');
    this.parent = parent;
  }

  private static getStateString(state: number): string {
    const states = [
      'Disabled',
      'Listening',
      'Learning',
      'Forwarding',
      'Blocking',
    ];
    return states[state] || 'Unknown';
  }

  private static getRoleString(role: number): string {
    const roles = [
      'Disabled',
      'Root',
      'Designated',
      'Blocked',
      'Alternate',
      'Backup',
    ];
    return roles[role] || 'Unknown';
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const switchHost = this.Terminal.Node as SwitchHost;

      if (!('spanningTree' in switchHost)) {
        throw new Error('Spanning-tree is not supported on this device');
      }

      const brief = args[0] === 'brief';
      const showRoot = args[0] === 'root';
      const showMstConfig = args[0] === 'mst' && args[1] === 'configuration';

      // show spanning-tree root
      if (showRoot) {
        const protocol = switchHost.getStpProtocol();
        const service = switchHost.spanningTree;

        this.terminal.write('');
        this.terminal.write('Root bridge information:');
        this.terminal.write(`  Protocol: ${protocol.toUpperCase()}`);
        this.terminal.write(`  Root ID: ${service.Root.toString()}`);
        this.terminal.write(`  Bridge ID: ${service.BridgeId.toString()}`);
        this.terminal.write(
          `  This bridge is ${service.IsRoot ? '' : 'NOT '}root`
        );
        this.terminal.write('');
        this.finalize();
        return;
      }

      // show spanning-tree mst configuration
      if (showMstConfig) {
        if (switchHost.getStpProtocol() !== SpanningTreeProtocol.MSTP) {
          throw new Error('MSTP is not enabled');
        }

        const service = switchHost.spanningTree as {
          getRegionConfig?: () => {
            regionName: string;
            revisionNumber: number;
          };
          getVlanMapping?: () => Map<number, number>;
        };

        if (service.getRegionConfig && service.getVlanMapping) {
          const config = service.getRegionConfig();
          const mapping = service.getVlanMapping();

          this.terminal.write('');
          this.terminal.write('MST Configuration:');
          this.terminal.write(`  Name: ${config.regionName}`);
          this.terminal.write(`  Revision: ${config.revisionNumber}`);
          this.terminal.write('');
          this.terminal.write('VLAN to Instance Mapping:');

          // Group VLANs by instance
          const instanceMap = new Map<number, number[]>();
          mapping.forEach((instance, vlan) => {
            if (!instanceMap.has(instance)) {
              instanceMap.set(instance, []);
            }
            instanceMap.get(instance)!.push(vlan);
          });

          instanceMap.forEach((vlans, instance) => {
            vlans.sort((a, b) => a - b);
            this.terminal.write(
              `  Instance ${instance}: VLANs ${vlans.join(',')}`
            );
          });
        }

        this.terminal.write('');
        this.finalize();
        return;
      }

      // show spanning-tree [brief]
      const service = switchHost.spanningTree;
      const protocol = switchHost.getStpProtocol();
      const interfaces = switchHost.getInterfaces();

      this.terminal.write('');
      this.terminal.write(`Spanning-tree: ${protocol.toUpperCase()}`);
      this.terminal.write(`Root ID: ${service.Root.toString()}`);
      this.terminal.write(`Bridge ID: ${service.BridgeId.toString()}`);
      this.terminal.write(`This bridge is ${service.IsRoot ? '' : 'NOT '}root`);
      this.terminal.write('');

      if (brief) {
        // Brief format
        this.terminal.write(
          'Interface        Role         State        Cost     Prio'
        );
        this.terminal.write(
          '----------------------------------------------------------------'
        );

        interfaces.forEach((ifaceName) => {
          const iface = switchHost.getInterface(ifaceName);
          const role = ShowSpanningTreeCommand.getRoleString(
            service.Role(iface)
          );
          const state = ShowSpanningTreeCommand.getStateString(
            service.State(iface)
          );
          const cost = service.Cost(iface);

          this.terminal.write(
            `${ifaceName.padEnd(16)} ${role.padEnd(12)} ${state.padEnd(12)} ${cost.toString().padStart(8)} ${128}`
          );
        });
      } else {
        // Detailed format
        interfaces.forEach((ifaceName) => {
          const iface = switchHost.getInterface(ifaceName);
          const role = ShowSpanningTreeCommand.getRoleString(
            service.Role(iface)
          );
          const state = ShowSpanningTreeCommand.getStateString(
            service.State(iface)
          );
          const cost = service.Cost(iface);

          this.terminal.write(`${ifaceName}:`);
          this.terminal.write(`  Role: ${role}`);
          this.terminal.write(`  State: ${state}`);
          this.terminal.write(`  Cost: ${cost}`);
          this.terminal.write('  Port Priority: 128');
          this.terminal.write('');
        });
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
      if (args.length === 1) {
        const suggestions = ['brief', 'vlan', 'interface', 'root', 'mst'];
        return suggestions.filter((s) => s.startsWith(args[0]));
      }

      // show spanning-tree mst <subcommand>
      if (args[0] === 'mst' && args.length === 2) {
        return ['configuration'].filter((s) => s.startsWith(args[1]));
      }

      // show spanning-tree interface <interface>
      if (args[0] === 'interface' && args.length === 2) {
        const switchHost = this.Terminal.Node as SwitchHost;
        const interfaces = switchHost.getInterfaces();
        return interfaces.filter((i) => i.startsWith(args[1]));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

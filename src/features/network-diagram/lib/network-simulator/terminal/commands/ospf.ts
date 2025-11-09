import { IPAddress } from '../../address';
import type { RouterHost } from '../../nodes/router';
import { OSPFState } from '../../protocols/ospf';
import { TerminalCommand } from '../command-base';
import type { ConfigCommand } from './config';

/**
 * Router OSPF command - Enter OSPF configuration mode
 * Usage:
 *   router ospf <process-id>
 */
export class RouterOSPFCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ospf');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (args.length === 0) {
        throw new Error('OSPF process ID required');
      }

      const processID = parseInt(args[0], 10);
      if (Number.isNaN(processID) || processID < 1 || processID > 65535) {
        throw new Error('Process ID must be between 1 and 65535');
      }

      // Set process ID and enable OSPF
      router.services.ospf.processID = processID;
      this.terminal.write(`Configuring OSPF process ${processID}`);

      // Enter OSPF config mode
      const ospfConfig = new OSPFConfigCommand(this);
      this.addCommand(ospfConfig);
      this.pushInteractiveMode(ospfConfig);
    } else {
      super.exec(command, args, negated);
    }
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name && args.length === 1 && args[0] === '') {
      return ['1'];
    }
    return super.autocomplete(command, args, negated);
  }
}

/**
 * OSPF Configuration Mode Commands
 * Available commands:
 *   network <address> <wildcard-mask> area <area-id>
 *   router-id <router-id>
 *   exit
 */
class OSPFConfigCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ospf-config');
    this.parent = parent;

    // Add subcommands
    this.addCommand(new NetworkCommand(this));
    this.addCommand(new RouterIDCommand(this));
  }

  public override getPrompt(): string {
    return 'config-router';
  }
}

/**
 * Network command - Define which networks participate in OSPF
 * Usage:
 *   network <address> <wildcard-mask> area <area-id>
 *   no network <address> <wildcard-mask>
 */
class NetworkCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'network');
    this.parent = parent;
    this.canBeNegative = true;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (args.length < 2) {
        throw new Error('Usage: network <address> <wildcard-mask> area <area-id>');
      }

      try {
        const networkAddr = new IPAddress(args[0]);
        const wildcardMask = new IPAddress(args[1]);

        if (negated) {
          // Remove network statement
          router.services.ospf.removeNetwork(networkAddr, wildcardMask);
          this.terminal.write(
            `Removed OSPF network ${args[0]} ${args[1]}`
          );
        } else {
          // Add network statement
          if (args.length < 4 || args[2] !== 'area') {
            throw new Error('Usage: network <address> <wildcard-mask> area <area-id>');
          }

          const areaID = new IPAddress(args[3]);
          router.services.ospf.addNetwork(networkAddr, wildcardMask, areaID);
          this.terminal.write(
            `Added OSPF network ${args[0]} ${args[1]} area ${args[3]}`
          );

          // Enable OSPF if not already enabled
          if (!router.services.ospf.Enabled) {
            router.services.ospf.Enable = true;
            this.terminal.write('OSPF process enabled');
          }
        }
      } catch (error) {
        throw new Error(`Invalid IP address: ${error instanceof Error ? error.message : String(error)}`);
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
      // network <address>
      if (args.length === 1 && args[0] === '') {
        return ['0.0.0.0', '10.0.0.0', '192.168.1.0'];
      }

      // network <address> <wildcard>
      if (args.length === 2 && args[1] === '') {
        return ['0.255.255.255', '0.0.0.255', '0.0.255.255'];
      }

      // network <address> <wildcard> area
      if (args.length === 3) {
        return ['area'].filter((c) => c.startsWith(args[2]));
      }

      // network <address> <wildcard> area <area-id>
      if (args.length === 4 && args[3] === '') {
        return ['0', '0.0.0.0'];
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Router ID command - Set OSPF router ID
 * Usage:
 *   router-id <router-id>
 */
class RouterIDCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'router-id');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (args.length === 0) {
        throw new Error('Router ID required');
      }

      try {
        const routerID = new IPAddress(args[0]);
        router.services.ospf.setRouterID(routerID);
        this.terminal.write(`OSPF router ID set to ${args[0]}`);
      } catch {
        throw new Error(`Invalid router ID: ${args[0]}`);
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
    if (command === this.name && args.length === 1 && args[0] === '') {
      const router = this.Terminal.Node as RouterHost;
      // Suggest current highest IP as router ID
      return [router.services.ospf.routerID.toString()];
    }
    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show IP OSPF command - Display OSPF information
 * Usage:
 *   show ip ospf
 */
export class ShowIPOSPFCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'ospf');
    this.parent = parent;

    // Register subcommands
    this.registerCommand(new ShowIPOSPFNeighborCommand(this));
    this.registerCommand(new ShowIPOSPFInterfaceCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('ospf' in router.services)) {
        throw new Error('OSPF is not supported on this device');
      }

      const ospf = router.services.ospf;

      this.terminal.write(`Routing Process "ospf ${ospf.processID}"`);
      this.terminal.write(
        `  Router ID ${ospf.routerID.toString()}`
      );
      this.terminal.write(
        `  OSPF process is ${ospf.Enabled ? 'enabled' : 'disabled'}`
      );

      // Display network statements
      const networks = ospf.getNetworks();
      if (networks.length > 0) {
        this.terminal.write('  Networks:');
        networks.forEach((net) => {
          this.terminal.write(
            `    ${net.network.toString()} ${net.wildcardMask.toString()} area ${net.areaID.toString()}`
          );
        });
      } else {
        this.terminal.write('  No networks configured');
      }

      // Display neighbor count
      const neighbors = ospf.getAllNeighbors();
      this.terminal.write(`  Number of neighbors: ${neighbors.length}`);

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }
}

/**
 * Show IP OSPF Neighbor command - Display OSPF neighbor information
 * Usage:
 *   show ip ospf neighbor
 *   show ip ospf neighbor detail
 */
export class ShowIPOSPFNeighborCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'neighbor');
    this.parent = parent;
  }

  private static getStateString(state: OSPFState): string {
    switch (state) {
      case OSPFState.Down:
        return 'DOWN';
      case OSPFState.Attempt:
        return 'ATTEMPT';
      case OSPFState.Init:
        return 'INIT';
      case OSPFState.TwoWay:
        return '2WAY';
      case OSPFState.ExStart:
        return 'EXSTART';
      case OSPFState.Exchange:
        return 'EXCHANGE';
      case OSPFState.Loading:
        return 'LOADING';
      case OSPFState.Full:
        return 'FULL';
      default:
        return 'UNKNOWN';
    }
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('ospf' in router.services)) {
        throw new Error('OSPF is not supported on this device');
      }

      const ospf = router.services.ospf;
      const neighbors = ospf.getAllNeighbors();
      const detail = args[0] === 'detail';

      if (neighbors.length === 0) {
        this.terminal.write('No OSPF neighbors');
        this.finalize();
        return;
      }

      if (detail) {
        // Detailed output
        neighbors.forEach((neighbor) => {
          const state = ShowIPOSPFNeighborCommand.getStateString(neighbor.state);
          this.terminal.write(`Neighbor ${neighbor.neighborID.toString()}`);
          this.terminal.write(`  State: ${state}`);
          this.terminal.write(`  Address: ${neighbor.neighborIP.toString()}`);
          this.terminal.write(`  Priority: ${neighbor.priority}`);
          if (!neighbor.designatedRouter.equals(new IPAddress('0.0.0.0'))) {
            this.terminal.write(
              `  Designated Router: ${neighbor.designatedRouter.toString()}`
            );
          }
          if (!neighbor.backupDesignatedRouter.equals(new IPAddress('0.0.0.0'))) {
            this.terminal.write(
              `  Backup Designated Router: ${neighbor.backupDesignatedRouter.toString()}`
            );
          }
          this.terminal.write('');
        });
      } else {
        // Brief output
        this.terminal.write(
          'Neighbor ID     Pri   State           Address'
        );
        this.terminal.write(
          '--------------------------------------------------------'
        );

        neighbors.forEach((neighbor) => {
          const state = ShowIPOSPFNeighborCommand.getStateString(neighbor.state);
          const neighborID = neighbor.neighborID.toString().padEnd(15);
          const priority = neighbor.priority.toString().padStart(3);
          const stateStr = state.padEnd(15);
          const address = neighbor.neighborIP.toString();

          this.terminal.write(
            `${neighborID} ${priority}   ${stateStr} ${address}`
          );
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
    if (command === this.name && args.length === 1) {
      return ['detail'].filter((s) => s.startsWith(args[0]));
    }
    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show IP OSPF Interface command - Display OSPF interface information
 * Usage:
 *   show ip ospf interface
 *   show ip ospf interface <interface-name>
 */
export class ShowIPOSPFInterfaceCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'interface');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('ospf' in router.services)) {
        throw new Error('OSPF is not supported on this device');
      }

      const ospf = router.services.ospf;
      const interfaceFilter = args.length > 0 ? args[0] : null;

      // Get all interfaces
      const interfaces = router.getInterfaces();
      let hasOutput = false;

      interfaces.forEach((ifaceName) => {
        if (interfaceFilter && ifaceName !== interfaceFilter) {
          return;
        }

        const iface = router.getInterface(ifaceName);
        const config = ospf.getInterfaceConfig(iface);

        if (!config || !config.enabled) {
          return;
        }

        hasOutput = true;

        this.terminal.write(`${ifaceName} is up`);
        this.terminal.write(
          `  Internet Address ${iface.getNetAddress().toString()}/${iface.getNetMask().CIDR}`
        );
        this.terminal.write(`  Area ${config.areaID.toString()}`);
        this.terminal.write(`  Router ID ${ospf.routerID.toString()}`);
        this.terminal.write(
          `  Process ID ${ospf.processID}, Router Priority ${config.priority}`
        );
        this.terminal.write(`  Cost: ${config.cost}`);
        this.terminal.write(
          `  Timers: Hello ${config.helloInterval}s, Dead ${config.deadInterval}s`
        );

        // Display neighbors on this interface
        const neighbors = ospf.getNeighborsByInterface(iface);
        if (neighbors.length > 0) {
          this.terminal.write(`  Neighbors: ${neighbors.length}`);
        } else {
          this.terminal.write('  No neighbors');
        }

        this.terminal.write('');
      });

      if (!hasOutput) {
        this.terminal.write('No OSPF-enabled interfaces');
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
    if (command === this.name && args.length === 1) {
      const router = this.Terminal.Node as RouterHost;
      return router.getInterfaces().filter((iface) => iface.startsWith(args[0]));
    }
    return super.autocomplete(command, args, negated);
  }
}

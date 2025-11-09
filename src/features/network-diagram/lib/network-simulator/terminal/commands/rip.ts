import type { NetworkInterface } from '../../layers/network';
import type { RouterHost } from '../../nodes/router';
import { RIP_METRIC_INFINITY } from '../../protocols/rip';
import { TerminalCommand } from '../command-base';
import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../../address';

/**
 * Router RIP command - Enable RIP routing protocol globally
 * Usage:
 *   router rip
 *   no router rip
 */
export class RouterRipCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'rip');
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

      if (!('services' in router) || !('rip' in router.services)) {
        throw new Error('RIP is not supported on this device');
      }

      if (negated) {
        // Disable RIP
        router.services.rip.Enable = false;
        this.terminal.write('RIP routing disabled');
      } else {
        // Enable RIP
        router.services.rip.Enable = true;
        this.terminal.write('RIP routing enabled');
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
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Network command (under router rip) - Enable RIP on an interface
 * Usage:
 *   network <network-address>
 *   no network <network-address>
 *
 * Note: In this simplified implementation, we enable RIP on interfaces via interface config
 */

/**
 * RIP command (interface level) - Enable RIP on an interface
 * Usage:
 *   ip rip
 *   no ip rip
 */
export class IpRipCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'rip');
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

      // Navigate up to InterfaceCommand parent
      // this.parent is IPInterfaceCommand, this.parent.parent is InterfaceCommand
      let iface: NetworkInterface | null = null;
      let currentParent = this.parent;

      // Walk up the parent chain to find a command with an 'iface' property
      while (currentParent && !iface) {
        if ('iface' in currentParent && currentParent.iface instanceof Object) {
          iface = currentParent.iface as NetworkInterface;
          break;
        }
        currentParent = currentParent.parent;
      }

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (!('services' in router) || !('rip' in router.services)) {
        throw new Error('RIP is not supported on this device');
      }

      if (negated) {
        // Disable RIP on interface
        router.services.rip.disableOnInterface(iface);
        this.terminal.write(`RIP disabled on ${iface.toString()}`);
      } else {
        // Enable RIP on interface
        if (!router.services.rip.Enable) {
          throw new Error(
            'RIP routing must be enabled globally first (use "router rip")'
          );
        }
        router.services.rip.enableOnInterface(iface);
        this.terminal.write(`RIP enabled on ${iface.toString()}`);
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
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show IP RIP command - Display RIP routing information
 * Usage:
 *   show ip rip
 *   show ip rip database
 */
export class ShowIpRipCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'rip');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('rip' in router.services)) {
        throw new Error('RIP is not supported on this device');
      }

      const showDatabase = args[0] === 'database';

      if (!router.services.rip.Enable) {
        this.terminal.write('RIP routing is not enabled');
        this.finalize();
        return;
      }

      // Show enabled interfaces
      const enabledInterfaces = router.services.rip.getEnabledInterfaces();
      if (enabledInterfaces.length === 0) {
        this.terminal.write('RIP is enabled but no interfaces are configured');
        this.finalize();
        return;
      }

      this.terminal.write('RIP Routing Protocol');
      this.terminal.write('');
      this.terminal.write('Enabled on interfaces:');
      enabledInterfaces.forEach((ifaceName) => {
        this.terminal.write(`  ${ifaceName}`);
      });
      this.terminal.write('');

      // Show RIP routes
      const routes = router.services.rip.getRoutes();
      if (routes.length === 0) {
        this.terminal.write('No RIP routes learned');
      } else {
        if (showDatabase) {
          // Detailed database view
          this.terminal.write('RIP Routing Database:');
          this.terminal.write(
            'Network          Metric  Next Hop        Interface  Age'
          );
          this.terminal.write(
            '---------------------------------------------------------------'
          );

          routes.forEach((route) => {
            const network =
              `${route.network.toString()}/${route.mask.CIDR}`.padEnd(16);
            const metric =
              route.metric === RIP_METRIC_INFINITY
                ? 'inf'.padStart(6)
                : route.metric.toString().padStart(6);
            const nextHop = route.nextHop.toString().padEnd(15);
            const iface = route.interface.toString().padEnd(10);

            // Calculate age in seconds
            const currentTime = Scheduler.getInstance().getDeltaTime();
            const age = Math.floor(
              (currentTime - route.lastUpdate) /
                Scheduler.getInstance().getDelay(1)
            );

            this.terminal.write(
              `${network} ${metric}  ${nextHop} ${iface} ${age}s`
            );
          });
        } else {
          // Brief view
          this.terminal.write('RIP Routes:');
          this.terminal.write(
            'Network          Next Hop        Metric  Interface'
          );
          this.terminal.write(
            '---------------------------------------------------------------'
          );

          routes.forEach((route) => {
            const network =
              `${route.network.toString()}/${route.mask.CIDR}`.padEnd(16);
            const nextHop = route.nextHop.toString().padEnd(15);
            const metric =
              route.metric === RIP_METRIC_INFINITY
                ? 'inf'.padStart(6)
                : route.metric.toString().padStart(6);
            const iface = route.interface.toString();

            this.terminal.write(`${network} ${nextHop} ${metric}  ${iface}`);
          });
        }

        this.terminal.write('');
        this.terminal.write(`Total routes: ${routes.length}`);
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
        return ['database'].filter((s) => s.startsWith(args[0]));
      }
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show IP Protocols command - Display routing protocol information
 * Usage:
 *   show ip protocols
 */
export class ShowIpProtocolsCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'protocols');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('rip' in router.services)) {
        throw new Error('Routing protocols are not supported on this device');
      }

      this.terminal.write('Routing Protocol Information:');
      this.terminal.write('');

      // RIP
      if (router.services.rip.Enable) {
        this.terminal.write('Routing Protocol is "rip"');
        this.terminal.write('  Sending updates every 30 seconds');
        this.terminal.write('  Invalid after 180 seconds, flush after 240');
        this.terminal.write(
          `  Split horizon: ${router.services.rip.splitHorizon ? 'enabled' : 'disabled'}`
        );
        this.terminal.write(
          `  Poison reverse: ${router.services.rip.poisonReverse ? 'enabled' : 'disabled'}`
        );

        const enabledInterfaces = router.services.rip.getEnabledInterfaces();
        if (enabledInterfaces.length > 0) {
          this.terminal.write('  Routing for Networks:');
          enabledInterfaces.forEach((ifaceName) => {
            const iface = router.getInterface(ifaceName);
            const netAddr = iface.getNetAddress();
            const mask = iface.getNetMask();
            if (netAddr && mask) {
              // Calculate network address by ANDing IP with mask
              const networkAddr = (netAddr as IPAddress).getNetworkIP(
                mask as IPAddress
              );
              this.terminal.write(`    ${networkAddr.toString()}/${mask.CIDR}`);
            }
          });
        }

        this.terminal.write('  Routing Information Sources:');
        const routes = router.services.rip.getRoutes();
        const sources: string[] = [];
        routes.forEach((route) => {
          const source = route.nextHop.toString();
          if (sources.indexOf(source) === -1) {
            sources.push(source);
          }
        });
        if (sources.length === 0) {
          this.terminal.write('    None');
        } else {
          sources.forEach((source) => {
            this.terminal.write(`    ${source}`);
          });
        }
      } else {
        this.terminal.write('No routing protocols are currently enabled');
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
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

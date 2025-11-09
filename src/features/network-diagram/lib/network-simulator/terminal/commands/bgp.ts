import type { RouterHost } from '../../nodes/router';
import { TerminalCommand } from '../command-base';
import { Scheduler } from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../../address';
import { BGPState } from '../../protocols/bgp';

/**
 * Neighbor command (under router bgp) - Configure BGP neighbor
 * Usage:
 *   neighbor <ip-address> remote-as <as-number>
 *   neighbor <ip-address> description <text>
 *   no neighbor <ip-address>
 */
class NeighborCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'neighbor');
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

      if (!('services' in router) || !('bgp' in router.services)) {
        throw new Error('BGP is not supported on this device');
      }

      if (!router.services.bgp.Enable) {
        throw new Error('BGP must be enabled first (use "router bgp <as>")');
      }

      if (args.length < 1) {
        throw new Error('% Neighbor IP address required');
      }

      let neighborIP: IPAddress;
      try {
        neighborIP = new IPAddress(args[0]);
      } catch {
        throw new Error(`% Invalid IP address: ${args[0]}`);
      }

      if (negated) {
        // Remove neighbor
        router.services.bgp.removeNeighbor(neighborIP);
        this.terminal.write(
          `Neighbor ${neighborIP.toString()} removed from BGP configuration`
        );
        this.finalize();
        return;
      }

      // Add or configure neighbor
      if (args.length < 3) {
        throw new Error('% Incomplete command');
      }

      const subcommand = args[1];

      if (subcommand === 'remote-as') {
        const remoteAS = parseInt(args[2], 10);
        if (Number.isNaN(remoteAS) || remoteAS < 0 || remoteAS > 65535) {
          throw new Error('% Invalid AS number (must be 0-65535)');
        }

        const description = args.length > 4 ? args.slice(4).join(' ') : '';
        router.services.bgp.addNeighbor(neighborIP, remoteAS, description);
        this.terminal.write(
          `BGP neighbor ${neighborIP.toString()} configured with remote AS ${remoteAS}`
        );
      } else if (subcommand === 'description') {
        const description = args.slice(2).join(' ');
        // Get existing neighbor and update description
        const neighbor = router.services.bgp.getNeighbor(neighborIP);
        if (neighbor) {
          neighbor.description = description;
          this.terminal.write('Neighbor description updated');
        } else {
          throw new Error(`% Neighbor ${neighborIP.toString()} not configured`);
        }
      } else {
        throw new Error(`% Invalid neighbor command: ${subcommand}`);
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
      if (args.length === 2) {
        return ['remote-as', 'description'].filter((s) =>
          s.startsWith(args[1])
        );
      }
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Router BGP command - Configure BGP routing protocol
 * Usage:
 *   router bgp <as-number>
 *   no router bgp
 */
export class RouterBgpCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'bgp', '(config-router)#');
    this.parent = parent;
    this.canBeNegative = true;

    // Register neighbor command for BGP configuration
    this.registerCommand(new NeighborCommand(this));
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('bgp' in router.services)) {
        throw new Error('BGP is not supported on this device');
      }

      if (negated) {
        // Disable BGP
        router.services.bgp.Enable = false;
        this.terminal.write('BGP routing disabled');
        this.finalize();
      } else {
        // Enable BGP with AS number
        if (args.length !== 1) {
          throw new Error('% Autonomous system number required');
        }

        const asNumber = parseInt(args[0], 10);
        if (Number.isNaN(asNumber) || asNumber < 0 || asNumber > 65535) {
          throw new Error('% Invalid AS number (must be 0-65535)');
        }

        router.services.bgp.localAS = asNumber;
        router.services.bgp.Enable = true;
        this.terminal.write(`BGP routing enabled for AS ${asNumber}`);

        // Enter router configuration mode
        this.terminal.changeDirectory(this);
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
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show IP BGP command - Display BGP routing information
 * Usage:
 *   show ip bgp
 *   show ip bgp summary
 *   show ip bgp neighbors
 */
export class ShowIpBgpCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'bgp');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('bgp' in router.services)) {
        throw new Error('BGP is not supported on this device');
      }

      const subcommand = args[0] || '';

      if (!router.services.bgp.Enable) {
        this.terminal.write('BGP routing is not enabled');
        this.finalize();
        return;
      }

      if (subcommand === 'summary') {
        this.showBgpSummary(router);
      } else if (subcommand === 'neighbors') {
        this.showBgpNeighbors(router);
      } else {
        this.showBgpRoutes(router);
      }

      this.finalize();
    } else {
      super.exec(command, args, negated);
    }
  }

  private showBgpSummary(router: RouterHost): void {
    this.terminal.write(
      `BGP router identifier ${router.services.bgp.routerID.toString()}, local AS number ${router.services.bgp.localAS}`
    );
    this.terminal.write('');

    const neighbors = router.services.bgp.getNeighbors();
    if (neighbors.length === 0) {
      this.terminal.write('No BGP neighbors configured');
      return;
    }

    this.terminal.write(
      'Neighbor        V    AS MsgRcvd MsgSent   State/PfxRcd'
    );
    this.terminal.write(
      '----------------------------------------------------------------'
    );

    neighbors.forEach((neighbor) => {
      const ip = neighbor.neighborIP.toString().padEnd(15);
      const version = '4'.padStart(4);
      const as = neighbor.remoteAS.toString().padStart(5);
      const msgRcvd = neighbor.messagesReceived.toString().padStart(7);
      const msgSent = neighbor.messagesSent.toString().padStart(7);
      const state =
        neighbor.state === BGPState.Established
          ? neighbor.prefixesReceived.toString().padStart(15)
          : BGPState[neighbor.state].padStart(15);

      this.terminal.write(
        `${ip} ${version} ${as} ${msgRcvd} ${msgSent} ${state}`
      );
    });

    this.terminal.write('');
    this.terminal.write(`Total number of neighbors ${neighbors.length}`);
  }

  private showBgpNeighbors(router: RouterHost): void {
    const neighbors = router.services.bgp.getNeighbors();

    if (neighbors.length === 0) {
      this.terminal.write('No BGP neighbors configured');
      return;
    }

    neighbors.forEach((neighbor, index) => {
      if (index > 0) this.terminal.write('');

      this.terminal.write(
        `BGP neighbor is ${neighbor.neighborIP.toString()}, remote AS ${neighbor.remoteAS}`
      );

      if (neighbor.description) {
        this.terminal.write(`  Description: ${neighbor.description}`);
      }

      this.terminal.write('  BGP version 4');
      this.terminal.write(`  BGP state = ${BGPState[neighbor.state]}`);

      if (neighbor.remoteRouterID) {
        this.terminal.write(
          `  Remote router ID ${neighbor.remoteRouterID.toString()}`
        );
      }

      this.terminal.write(
        `  Hold time is ${neighbor.holdTime}, keepalive interval is ${neighbor.keepaliveTime} seconds`
      );

      this.terminal.write('  Message statistics:');
      this.terminal.write(`    Sent: ${neighbor.messagesSent}`);
      this.terminal.write(`    Received: ${neighbor.messagesReceived}`);

      if (neighbor.state === BGPState.Established) {
        const currentTime = Scheduler.getInstance().getDeltaTime();
        const uptime = Math.floor(
          (currentTime - neighbor.establishedTime) /
            Scheduler.getInstance().getDelay(1)
        );
        this.terminal.write(`  Connection established ${uptime} seconds ago`);
        this.terminal.write(
          `  Prefixes received: ${neighbor.prefixesReceived}`
        );
      }
    });
  }

  private showBgpRoutes(router: RouterHost): void {
    const routes = router.services.bgp.getRoutes();

    this.terminal.write(
      `BGP table version is 1, local router ID is ${router.services.bgp.routerID.toString()}`
    );
    this.terminal.write('Status codes: * valid, > best');
    this.terminal.write('Origin codes: i - IGP, e - EGP, ? - incomplete');
    this.terminal.write('');

    if (routes.length === 0) {
      this.terminal.write('No BGP routes learned');
      return;
    }

    this.terminal.write(
      '   Network          Next Hop            Metric LocPrf Path'
    );
    this.terminal.write(
      '----------------------------------------------------------------'
    );

    routes.forEach((route) => {
      const network =
        `${route.network.toString()}/${route.prefixLength}`.padEnd(16);
      const nextHop = route.nextHop.toString().padEnd(19);
      const metric = route.med.toString().padStart(6);
      const locPrf = route.localPref.toString().padStart(6);
      const path =
        route.asPath.length > 0
          ? route.asPath.join(' ')
          : router.services.bgp.localAS.toString();

      this.terminal.write(
        `*> ${network} ${nextHop} ${metric} ${locPrf} ${path}`
      );
    });

    this.terminal.write('');
    this.terminal.write(`Total number of prefixes ${routes.length}`);
  }

  public override autocomplete(
    command: string,
    args: string[],
    negated: boolean
  ): string[] {
    if (command === this.name) {
      if (args.length === 1) {
        return ['summary', 'neighbors'].filter((s) => s.startsWith(args[0]));
      }
      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

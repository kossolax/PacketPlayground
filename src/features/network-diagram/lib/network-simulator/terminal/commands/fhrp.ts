import { IPAddress } from '../../address';
import type { NetworkInterface } from '../../layers/network';
import type { RouterHost } from '../../nodes/router';
import { HSRPState } from '../../protocols/hsrp';
import { TerminalCommand } from '../command-base';
import type { InterfaceCommand } from './interface';

/**
 * Standby command - Configure HSRP on an interface
 * Usage:
 *   standby <group> ip <virtual-ip>
 *   standby <group> priority <priority>
 *   standby <group> preempt
 *   standby <group> timers <hellotime> <holdtime>
 *   standby <group> authentication <string>
 *   no standby <group>
 */
export class StandbyCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'standby');
    this.parent = parent;
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;
      const iface = (this.parent as InterfaceCommand).iface as NetworkInterface;

      if (!iface) {
        throw new Error('No interface selected');
      }

      if (args.length === 0) {
        throw new Error(`${this.name} requires a group number`);
      }

      const groupNum = parseInt(args[0], 10);
      if (Number.isNaN(groupNum) || groupNum < 0 || groupNum > 255) {
        throw new Error('Group number must be between 0 and 255');
      }

      // Handle 'no standby <group>' to remove group
      if (negated) {
        router.services.fhrp.removeGroup(iface, groupNum);
        this.terminal.write(`Removed HSRP group ${groupNum}`);
        this.finalize();
        return;
      }

      // Get existing group or prepare to create new one
      let group = router.services.fhrp.getGroup(iface, groupNum);

      // standby <group> ip <virtual-ip>
      if (args[1] === 'ip' && args.length === 3) {
        try {
          const virtualIP = new IPAddress(args[2]);

          if (group) {
            // Update existing group
            router.services.fhrp.setGroup(
              iface,
              groupNum,
              virtualIP,
              group.priority
            );
          } else {
            // Create new group with default priority
            router.services.fhrp.setGroup(iface, groupNum, virtualIP, 100);
          }

          this.terminal.write(
            `Configured HSRP group ${groupNum} with virtual IP ${args[2]}`
          );
        } catch (error) {
          throw new Error(`Invalid IP address: ${args[2]}`);
        }
      }
      // standby <group> priority <priority>
      else if (args[1] === 'priority' && args.length === 3) {
        const priority = parseInt(args[2], 10);
        if (Number.isNaN(priority) || priority < 0 || priority > 255) {
          throw new Error('Priority must be between 0 and 255');
        }

        if (!group) {
          throw new Error(
            `HSRP group ${groupNum} must be configured with IP first`
          );
        }

        router.services.fhrp.setGroup(
          iface,
          groupNum,
          group.virtualIP,
          priority
        );
        this.terminal.write(
          `Set HSRP group ${groupNum} priority to ${priority}`
        );
      }
      // standby <group> preempt
      else if (args[1] === 'preempt' && args.length === 2) {
        if (!group) {
          throw new Error(
            `HSRP group ${groupNum} must be configured with IP first`
          );
        }

        group.preempt = true;
        this.terminal.write(`Enabled preempt for HSRP group ${groupNum}`);
      }
      // standby <group> timers <hellotime> <holdtime>
      else if (args[1] === 'timers' && args.length === 4) {
        const hellotime = parseInt(args[2], 10);
        const holdtime = parseInt(args[3], 10);

        if (Number.isNaN(hellotime) || hellotime < 1 || hellotime > 255) {
          throw new Error('Hello time must be between 1 and 255 seconds');
        }
        if (Number.isNaN(holdtime) || holdtime < 1 || holdtime > 255) {
          throw new Error('Hold time must be between 1 and 255 seconds');
        }
        if (holdtime <= hellotime) {
          throw new Error('Hold time must be greater than hello time');
        }

        if (!group) {
          throw new Error(
            `HSRP group ${groupNum} must be configured with IP first`
          );
        }

        group.hellotime = hellotime;
        group.holdtime = holdtime;
        this.terminal.write(
          `Set HSRP group ${groupNum} timers: hello ${hellotime}s, hold ${holdtime}s`
        );
      }
      // standby <group> authentication <string>
      else if (args[1] === 'authentication' && args.length === 3) {
        if (args[2].length > 8) {
          throw new Error('Authentication string maximum is 8 characters');
        }

        if (!group) {
          throw new Error(
            `HSRP group ${groupNum} must be configured with IP first`
          );
        }

        group.authentication = args[2].padEnd(8, '\x00');
        this.terminal.write(
          `Set HSRP group ${groupNum} authentication string`
        );
      } else {
        throw new Error(`Invalid standby command syntax`);
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
      // Group number
      if (args.length === 1) {
        return ['0', '1', '2', '10'].filter((g) => g.startsWith(args[0]));
      }

      // Subcommands after group number
      if (args.length === 2) {
        return ['ip', 'priority', 'preempt', 'timers', 'authentication'].filter(
          (c) => c.startsWith(args[1])
        );
      }

      // Default values for timers
      if (args[1] === 'timers') {
        if (args.length === 3) return ['3']; // Default hello time
        if (args.length === 4) return ['10']; // Default hold time
      }

      // Default authentication
      if (args[1] === 'authentication' && args.length === 3) {
        return ['cisco'];
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

/**
 * Show Standby command - Display HSRP status
 * Usage:
 *   show standby
 *   show standby brief
 *   show standby <interface>
 */
export class ShowStandbyCommand extends TerminalCommand {
  constructor(parent: TerminalCommand) {
    super(parent.Terminal, 'standby');
    this.parent = parent;
  }

  private getStateString(state: HSRPState): string {
    switch (state) {
      case HSRPState.Initial:
        return 'Initial';
      case HSRPState.Learn:
        return 'Learn';
      case HSRPState.Listen:
        return 'Listen';
      case HSRPState.Speak:
        return 'Speak';
      case HSRPState.Standby:
        return 'Standby';
      case HSRPState.Active:
        return 'Active';
      default:
        return 'Unknown';
    }
  }

  public override exec(
    command: string,
    args: string[],
    negated: boolean
  ): void {
    if (command === this.name) {
      const router = this.Terminal.Node as RouterHost;

      if (!('services' in router) || !('fhrp' in router.services)) {
        throw new Error('HSRP is not supported on this device');
      }

      const brief = args[0] === 'brief';
      const interfaceFilter =
        args.length > 0 && args[0] !== 'brief' ? args[0] : null;

      // Get all interfaces with HSRP groups
      const interfaces = router.getInterfaces();
      let hasOutput = false;

      interfaces.forEach((ifaceName) => {
        if (interfaceFilter && ifaceName !== interfaceFilter) {
          return;
        }

        const iface = router.getInterface(ifaceName);
        const groups = router.services.fhrp.getGroups(iface);

        if (groups.length === 0) {
          return;
        }

        hasOutput = true;

        if (brief) {
          // Brief output format
          if (!hasOutput) {
            this.terminal.write(
              'Interface   Grp  Pri  State    Virtual IP      Active router   Standby router'
            );
            this.terminal.write(
              '---------------------------------------------------------------------------------'
            );
          }

          groups.forEach((group) => {
            const state = this.getStateString(group.state);
            const virtualIP = group.virtualIP.toString().padEnd(15);
            const activeRouter =
              group.activeRouter?.toString().padEnd(15) || 'local'.padEnd(15);
            const standbyRouter =
              group.standbyRouter?.toString().padEnd(15) ||
              'unknown'.padEnd(15);

            this.terminal.write(
              `${ifaceName.padEnd(11)} ${group.group.toString().padStart(3)}  ${group.priority.toString().padStart(3)}  ${state.padEnd(8)} ${virtualIP} ${activeRouter} ${standbyRouter}`
            );
          });
        } else {
          // Detailed output format
          groups.forEach((group) => {
            const state = this.getStateString(group.state);

            this.terminal.write(`${ifaceName} - Group ${group.group}`);
            this.terminal.write(
              `  State is ${state}${group.state === HSRPState.Active ? ' (Active router)' : ''}`
            );
            this.terminal.write(
              `  Virtual IP address is ${group.virtualIP.toString()}`
            );
            if (group.activeRouter) {
              this.terminal.write(
                `  Active router is ${group.activeRouter.toString()}${group.state === HSRPState.Active ? ' (local)' : ''}`
              );
            } else {
              this.terminal.write(`  Active router is unknown`);
            }
            if (group.standbyRouter) {
              this.terminal.write(
                `  Standby router is ${group.standbyRouter.toString()}${group.state === HSRPState.Standby ? ' (local)' : ''}`
              );
            } else {
              this.terminal.write(`  Standby router is unknown`);
            }
            this.terminal.write(`  Priority ${group.priority}${group.preempt ? ' (preempt enabled)' : ''}`);
            this.terminal.write(
              `  Timers: hello ${group.hellotime}s, hold ${group.holdtime}s`
            );
            this.terminal.write(
              `  Virtual MAC address is ${group.getVirtualMAC().toString()}`
            );
            this.terminal.write('');
          });
        }
      });

      if (!hasOutput) {
        this.terminal.write('No HSRP groups configured');
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
        const router = this.Terminal.Node as RouterHost;
        const suggestions = ['brief'];

        // Add interface names
        if ('services' in router && 'fhrp' in router.services) {
          router.getInterfaces().forEach((ifaceName) => {
            suggestions.push(ifaceName);
          });
        }

        return suggestions.filter((s) => s.startsWith(args[0]));
      }

      return [];
    }

    return super.autocomplete(command, args, negated);
  }
}

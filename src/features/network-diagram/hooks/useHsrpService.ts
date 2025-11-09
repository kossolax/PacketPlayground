import { useState, useEffect, useCallback } from 'react';
import type { RouterHost } from '../lib/network-simulator/nodes/router';
import type { Network } from '../lib/network-simulator/network';
import { IPAddress } from '../lib/network-simulator/address';
import { HSRPState } from '../lib/network-simulator/protocols/hsrp';
import type { HSRPGroup } from '../lib/network-simulator/services/fhrp';
import { Scheduler } from '../lib/scheduler/scheduler';

export interface HSRPGroupInfo {
  interfaceName: string;
  group: number;
  virtualIP: string;
  priority: number;
  preempt: boolean;
  state: HSRPState;
  activeRouter: string | null;
  standbyRouter: string | null;
  virtualMAC: string;
}

export interface HSRPGroupFormData {
  interfaceName: string;
  group: number;
  virtualIP: string;
  priority: number;
  preempt: boolean;
  hellotime: number;
  holdtime: number;
  authentication: string;
}

export default function useHsrpService(
  node: RouterHost,
  _network?: Network | null
) {
  const scheduler = Scheduler.getInstance();
  const [enabled, setEnabled] = useState(node.services.fhrp.Enable);
  const [groups, setGroups] = useState<HSRPGroupInfo[]>([]);

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.fhrp.Enable = enabled;
  }, [enabled, node]);

  // Subscribe to scheduler timer to reactively update groups
  useEffect(() => {
    const subscription = scheduler.Timer$.subscribe(() => {
      const allGroups: HSRPGroupInfo[] = [];

      node.getInterfaces().forEach((ifaceName) => {
        const iface = node.getInterface(ifaceName);
        const hsrpGroups = node.services.fhrp.getGroups(iface);

        hsrpGroups.forEach((hsrpGroup) => {
          allGroups.push({
            interfaceName: ifaceName,
            group: hsrpGroup.group,
            virtualIP: hsrpGroup.virtualIP.toString(),
            priority: hsrpGroup.priority,
            preempt: hsrpGroup.preempt,
            state: hsrpGroup.state,
            activeRouter: hsrpGroup.activeRouter?.toString() || null,
            standbyRouter: hsrpGroup.standbyRouter?.toString() || null,
            virtualMAC: hsrpGroup.getVirtualMAC().toString(),
          });
        });
      });

      setGroups(allGroups);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [node, scheduler]);

  // Add or update an HSRP group
  const setGroup = useCallback(
    (formData: HSRPGroupFormData) => {
      const iface = node.getInterface(formData.interfaceName);
      if (!iface) {
        throw new Error(`Interface ${formData.interfaceName} not found`);
      }

      // Set the group on the interface
      node.services.fhrp.setGroup(
        iface,
        formData.group,
        new IPAddress(formData.virtualIP),
        formData.priority
      );

      // Get the group to update additional properties
      const group = node.services.fhrp.getGroup(iface, formData.group);
      if (group) {
        group.preempt = formData.preempt;
        group.hellotime = formData.hellotime;
        group.holdtime = formData.holdtime;
        group.authentication = formData.authentication;
      }
    },
    [node]
  );

  // Remove an HSRP group
  const removeGroup = useCallback(
    (interfaceName: string, groupNum: number) => {
      const iface = node.getInterface(interfaceName);
      if (!iface) {
        throw new Error(`Interface ${interfaceName} not found`);
      }

      node.services.fhrp.removeGroup(iface, groupNum);
    },
    [node]
  );

  // Get a specific HSRP group
  const getGroup = useCallback(
    (interfaceName: string, groupNum: number): HSRPGroup | null => {
      const iface = node.getInterface(interfaceName);
      if (!iface) return null;

      return node.services.fhrp.getGroup(iface, groupNum);
    },
    [node]
  );

  // Get form data for a specific group
  const getGroupFormData = useCallback(
    (interfaceName: string, groupNum: number): HSRPGroupFormData | null => {
      const iface = node.getInterface(interfaceName);
      if (!iface) return null;

      const group = node.services.fhrp.getGroup(iface, groupNum);
      if (!group) return null;

      return {
        interfaceName,
        group: group.group,
        virtualIP: group.virtualIP.toString(),
        priority: group.priority,
        preempt: group.preempt,
        hellotime: group.hellotime,
        holdtime: group.holdtime,
        authentication: group.authentication,
      };
    },
    [node]
  );

  // Get list of available interfaces
  const getInterfaces = useCallback(
    (): string[] => node.getInterfaces(),
    [node]
  );

  // Get state string for display
  const getStateString = (state: HSRPState): string => {
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
  };

  return {
    enabled,
    setEnabled,
    groups,
    setGroup,
    removeGroup,
    getGroup,
    getGroupFormData,
    getInterfaces,
    getStateString,
  };
}

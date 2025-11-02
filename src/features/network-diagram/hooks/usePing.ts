/**
 * Hook for executing ICMP ping between network devices
 * Handles interface selection and result display
 */

import { useCallback } from 'react';
import { firstValueFrom } from 'rxjs';
import { toast } from 'sonner';
import type { Network } from '../lib/network-simulator';
import { NetworkHost } from '../lib/network-simulator/nodes/generic';
import type { IPInterface } from '../lib/network-simulator/layers/network';
import { IPAddress } from '../lib/network-simulator/address';
import { Scheduler } from '../lib/scheduler/scheduler';

/**
 * Find the best IP interface on a node for reaching a destination
 * Returns the first interface that has a route to the destination
 */
function findSourceInterface(
  node: NetworkHost,
  destinationIp: IPAddress
): IPInterface | null {
  // Try to find interface with route to destination
  try {
    node.getNextHop(destinationIp);

    // Find the interface that can reach this next hop
    const foundInterface = node.getInterfaces().find((ifaceName) => {
      const iface = node.getInterface(ifaceName);
      if (iface && 'getNetAddress' in iface) {
        const ipIface = iface as IPInterface;
        const ifaceAddress = ipIface.getNetAddress();
        return ifaceAddress instanceof IPAddress;
      }
      return false;
    });

    if (foundInterface) {
      const iface = node.getInterface(foundInterface);
      return iface && 'getNetAddress' in iface ? (iface as IPInterface) : null;
    }
  } catch {
    // If getNextHop fails, fall through to find any interface with IP
  }

  // Fallback: return first interface with an IP address
  const fallbackInterface = node.getInterfaces().find((ifaceName) => {
    const iface = node.getInterface(ifaceName);
    if (iface && 'getNetAddress' in iface) {
      const ipIface = iface as IPInterface;
      return ipIface.getNetAddress() instanceof IPAddress;
    }
    return false;
  });

  if (fallbackInterface) {
    const iface = node.getInterface(fallbackInterface);
    return iface && 'getNetAddress' in iface ? (iface as IPInterface) : null;
  }

  return null;
}

/**
 * Find the first IP interface on a node
 */
function findTargetInterface(node: NetworkHost): IPInterface | null {
  const interfaceName = node.getInterfaces().find((ifaceName) => {
    const iface = node.getInterface(ifaceName);
    if (iface && 'getNetAddress' in iface) {
      const ipIface = iface as IPInterface;
      return ipIface.getNetAddress() instanceof IPAddress;
    }
    return false;
  });

  if (interfaceName) {
    const iface = node.getInterface(interfaceName);
    return iface && 'getNetAddress' in iface ? (iface as IPInterface) : null;
  }

  return null;
}

/**
 * Check if a node has at least one configured IP address
 */
export function hasConfiguredIP(
  network: Network | null,
  nodeId: string
): boolean {
  if (!network) return false;

  const node = network.nodes[nodeId];
  if (!node || !(node instanceof NetworkHost)) return false;

  return node.getInterfaces().some((ifaceName) => {
    const iface = node.getInterface(ifaceName);
    if (iface && 'getNetAddress' in iface) {
      const ipIface = iface as IPInterface;
      return ipIface.getNetAddress() instanceof IPAddress;
    }
    return false;
  });
}

/**
 * Hook for ping functionality
 */
export function usePing(network: Network | null) {
  const executePing = useCallback(
    async (sourceNodeId: string, targetNodeId: string): Promise<void> => {
      if (!network) {
        toast.error('No network loaded');
        return;
      }

      const sourceNode = network.nodes[sourceNodeId];
      const targetNode = network.nodes[targetNodeId];

      // Validate nodes exist
      if (!sourceNode || !targetNode) {
        toast.error('Invalid device selection');
        return;
      }

      // Validate nodes are NetworkHost (have IP capabilities)
      if (
        !(sourceNode instanceof NetworkHost) ||
        !(targetNode instanceof NetworkHost)
      ) {
        toast.error('Selected devices do not support IP networking');
        return;
      }

      // Find best interfaces
      const targetIface = findTargetInterface(targetNode);
      if (!targetIface) {
        toast.error(`Target device "${targetNode.guid}" has no IP configured`);
        return;
      }

      const targetIp = targetIface.getNetAddress() as IPAddress;
      const sourceIface = findSourceInterface(sourceNode, targetIp);

      if (!sourceIface) {
        toast.error(`Source device "${sourceNode.guid}" has no IP configured`);
        return;
      }

      const sourceIp = sourceIface.getNetAddress() as IPAddress;

      // Execute ping with 2000ms timeout (simulation time)
      const scheduler = Scheduler.getInstance();
      const startTime = scheduler.getDeltaTime();

      try {
        const result = await firstValueFrom(
          sourceIface.sendIcmpRequest(targetIp, 2000)
        );

        const endTime = scheduler.getDeltaTime();
        const duration = endTime - startTime;

        if (result) {
          toast.success(
            `Ping successful: ${sourceIp.toString()} → ${targetIp.toString()} (${duration.toFixed(1)}ms)`
          );
        } else {
          toast.error(
            `Ping timeout: ${sourceIp.toString()} → ${targetIp.toString()}`
          );
        }
      } catch (error) {
        toast.error(
          `Ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
    [network]
  );

  return {
    executePing,
    hasConfiguredIP: (nodeId: string) => hasConfiguredIP(network, nodeId),
  };
}

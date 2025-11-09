import { useState, useEffect, useCallback } from 'react';
import { SwitchHost } from '../lib/network-simulator/nodes/switch';
import type { Network } from '../lib/network-simulator/network';
import {
  SpanningTreeState,
  SpanningTreeProtocol,
} from '../lib/network-simulator/services/spanningtree';
import { Scheduler } from '../lib/scheduler/scheduler';

export interface StpPortInfo {
  name: string;
  state: SpanningTreeState;
  role: string;
  cost: number;
}

export default function useStpService(
  node: SwitchHost,
  network?: Network | null
) {
  const scheduler = Scheduler.getInstance();
  const [enabled, setEnabled] = useState(node.spanningTree.Enable);
  const [protocol, setProtocolState] = useState(node.getStpProtocol());
  const [bridgeId, setBridgeId] = useState<string>('Unknown');
  const [rootId, setRootId] = useState<string>('Unknown');
  const [isRoot, setIsRoot] = useState<boolean>(false);
  const [priority, setPriority] = useState<number>(32768);
  const [portsInfo, setPortsInfo] = useState<StpPortInfo[]>([]);

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.spanningTree.Enable = enabled;
  }, [enabled, node]);

  // Sync with backend when protocol changes
  useEffect(() => {
    node.setStpProtocol(protocol);
  }, [protocol, node]);

  // Subscribe to scheduler timer to reactively update STP state
  useEffect(() => {
    const subscription = scheduler.Timer$.subscribe(() => {
      // Update bridge ID
      const interfaces = node.getInterfaces();
      if (interfaces.length > 0) {
        const firstIface = node.getInterface(interfaces[0]);
        setBridgeId(firstIface.getMacAddress()?.toString() || 'Unknown');
      } else {
        setBridgeId('Unknown');
      }

      // Update root bridge info
      setRootId(node.spanningTree.Root.toString());
      setIsRoot(node.spanningTree.IsRoot);
      setPriority(32768);

      // Update ports info
      const ports: StpPortInfo[] = node.getInterfaces().map((ifaceName) => {
        const iface = node.getInterface(ifaceName);
        const state = node.spanningTree.State(iface);
        const role = node.spanningTree.Role(iface);
        const cost = node.spanningTree.Cost(iface);

        // Convert role enum to string
        let roleStr = 'Unknown';
        switch (role) {
          case 0:
            roleStr = 'Disabled';
            break;
          case 1:
            roleStr = 'Root';
            break;
          case 2:
            roleStr = 'Designated';
            break;
          case 3:
            roleStr = 'Blocked';
            break;
          case 4:
            roleStr = 'Alternate';
            break;
          case 5:
            roleStr = 'Backup';
            break;
          default:
            roleStr = 'Unknown';
        }

        return {
          name: ifaceName,
          state,
          role: roleStr,
          cost,
        };
      });

      setPortsInfo(ports);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [node, scheduler]);

  // Set the spanning tree protocol type
  // Automatically applies to all connected switches in the same broadcast domain
  const setProtocol = useCallback(
    (newProtocol: SpanningTreeProtocol): void => {
      if (!network) {
        // Fallback: only update current switch if network not available
        setProtocolState(newProtocol);
        return;
      }

      // Assign to const for type narrowing in nested function
      const currentNetwork = network;

      // Find all connected switches in the same broadcast domain using graph traversal
      const visited = new Set<string>();
      const connectedSwitches: SwitchHost[] = [];

      function traverse(currentSwitch: SwitchHost) {
        if (visited.has(currentSwitch.guid)) return;
        visited.add(currentSwitch.guid);
        connectedSwitches.push(currentSwitch);

        // Find all links connected to this switch
        currentNetwork.links.forEach((link) => {
          const iface1 = link.getInterface(0);
          const iface2 = link.getInterface(1);

          // Check if link connects to current switch and find the other end
          if (
            iface1?.Host === currentSwitch &&
            iface2?.Host instanceof SwitchHost
          ) {
            traverse(iface2.Host as SwitchHost);
          } else if (
            iface2?.Host === currentSwitch &&
            iface1?.Host instanceof SwitchHost
          ) {
            traverse(iface1.Host as SwitchHost);
          }
        });
      }

      // Start traversal from current switch
      traverse(node);

      // Apply protocol to all connected switches
      connectedSwitches.forEach((sw) => {
        sw.setStpProtocol(newProtocol);
      });

      // Update UI state for current switch
      setProtocolState(newProtocol);
    },
    [network, node]
  );

  return {
    enabled,
    setEnabled,
    protocol,
    setProtocol,
    bridgeId,
    rootId,
    isRoot,
    priority,
    portsInfo,
  };
}

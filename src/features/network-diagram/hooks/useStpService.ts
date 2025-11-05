import { useState, useEffect } from 'react';
import type { SwitchHost } from '../lib/network-simulator/nodes/switch';
import {
  SpanningTreeState,
  SpanningTreeProtocol,
} from '../lib/network-simulator/services/spanningtree';

export interface StpPortInfo {
  name: string;
  state: SpanningTreeState;
  role: string;
  cost: number;
}

export default function useStpService(node: SwitchHost) {
  const [enabled, setEnabled] = useState(node.spanningTree.Enable);
  const [protocol, setProtocolState] = useState(node.getStpProtocol());

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.spanningTree.Enable = enabled;
  }, [enabled, node]);

  // Sync with backend when protocol changes
  useEffect(() => {
    node.setStpProtocol(protocol);
  }, [protocol, node]);

  // Get bridge ID (MAC address)
  // Bridge ID is the lowest MAC address of all interfaces
  const getBridgeId = (): string => {
    const interfaces = node.getInterfaces();
    if (interfaces.length === 0) return 'Unknown';

    // Get the first interface's MAC as default
    const firstIface = node.getInterface(interfaces[0]);
    return firstIface.getMacAddress()?.toString() || 'Unknown';
  };

  // Get root bridge ID
  const getRootId = (): string => node.spanningTree.Root.toString();

  // Check if this switch is the root bridge
  const getIsRoot = (): boolean => node.spanningTree.IsRoot;

  // Set the spanning tree protocol type
  const setProtocol = (newProtocol: SpanningTreeProtocol): void => {
    setProtocolState(newProtocol);
  };

  // Get priority (default STP priority is 32768)
  const getPriority = (): number => 32768;

  // Get all ports with their STP information
  const getPortsInfo = (): StpPortInfo[] =>
    node.getInterfaces().map((ifaceName) => {
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

  return {
    enabled,
    setEnabled,
    protocol,
    setProtocol,
    getBridgeId,
    getRootId,
    getIsRoot,
    getPriority,
    getPortsInfo,
  };
}

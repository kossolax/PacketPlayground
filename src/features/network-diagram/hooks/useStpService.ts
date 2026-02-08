import { useState, useEffect } from 'react';
import type { SwitchHost } from '../lib/network-simulator/nodes/switch';
import {
  SpanningTreeState,
  SpanningTreeProtocol,
  SpanningTreePortRole,
  PVSTService,
  isPerVlanProtocol,
} from '../lib/network-simulator/services/spanningtree';

export interface StpPortInfo {
  name: string;
  state: SpanningTreeState;
  role: string;
  cost: number;
}

function roleToString(role: SpanningTreePortRole): string {
  switch (role) {
    case SpanningTreePortRole.Disabled:
      return 'Disabled';
    case SpanningTreePortRole.Root:
      return 'Root';
    case SpanningTreePortRole.Designated:
      return 'Designated';
    case SpanningTreePortRole.Blocked:
      return 'Blocked';
    case SpanningTreePortRole.Alternate:
      return 'Alternate';
    case SpanningTreePortRole.Backup:
      return 'Backup';
    default:
      return 'Unknown';
  }
}

export default function useStpService(node: SwitchHost) {
  const [enabled, setEnabled] = useState(node.spanningTree.Enable);
  const [protocol, setProtocolState] = useState(node.getStpProtocol());
  const [selectedVlan, setSelectedVlan] = useState<number | null>(null);

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.spanningTree.Enable = enabled;
  }, [enabled, node]);

  // Sync with backend when protocol changes
  useEffect(() => {
    node.setStpProtocol(protocol);
  }, [protocol, node]);

  const getBridgeId = (vlanId?: number): string => {
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.BridgeId.toString() || 'Unknown';
    }
    return node.spanningTree.BridgeId.toString();
  };

  const getRootId = (vlanId?: number): string => {
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.Root.toString() || 'Unknown';
    }
    return node.spanningTree.Root.toString();
  };

  const getIsRoot = (vlanId?: number): boolean => {
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.IsRoot ?? false;
    }
    return node.spanningTree.IsRoot;
  };

  const setProtocol = (newProtocol: SpanningTreeProtocol): void => {
    setProtocolState(newProtocol);
    setSelectedVlan(null);
  };

  const getPriority = (vlanId?: number): number => {
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.Priority ?? 32768;
    }
    return node.spanningTree.Priority;
  };

  const setPriority = (value: number, vlanId?: number): void => {
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      if (tree) tree.Priority = value;
    } else {
      // eslint-disable-next-line no-param-reassign
      node.spanningTree.Priority = value;
    }
  };

  const getVlanIds = (): number[] => node.spanningTree.getVlanIds();

  const getPortsInfo = (vlanId?: number): StpPortInfo[] =>
    node.getInterfaces().map((ifaceName) => {
      const iface = node.getInterface(ifaceName);
      const state = node.spanningTree.State(iface, vlanId);
      const role = node.spanningTree.Role(iface, vlanId);
      const cost = node.spanningTree.Cost(iface, vlanId);

      return {
        name: ifaceName,
        state,
        role: roleToString(role),
        cost,
      };
    });

  const setPortCost = (ifaceName: string, value: number): void => {
    const iface = node.getInterface(ifaceName);
    node.spanningTree.setPortCost(iface, value);
  };

  return {
    enabled,
    setEnabled,
    protocol,
    setProtocol,
    selectedVlan,
    setSelectedVlan,
    getBridgeId,
    getRootId,
    getIsRoot,
    getPriority,
    setPriority,
    getVlanIds,
    getPortsInfo,
    setPortCost,
  };
}

import { useState, useEffect } from 'react';
import type { SwitchHost } from '../lib/network-simulator/nodes/switch';
import {
  SpanningTreeState,
  SpanningTreeProtocol,
  SpanningTreePortRole,
  PVSTService,
  MSTPService,
  MSTConfiguration,
  isPerVlanProtocol,
  isMstpProtocol,
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
  const [selectedInstance, setSelectedInstance] = useState<number>(0);

  // Sync with backend when enabled changes — skip if already in sync
  useEffect(() => {
    if (node.spanningTree.Enable !== enabled) {
      // eslint-disable-next-line no-param-reassign
      node.spanningTree.Enable = enabled;
    }
  }, [enabled, node]);

  // Sync with backend when protocol changes — skip if already in sync
  useEffect(() => {
    if (node.getStpProtocol() !== protocol) {
      node.setStpProtocol(protocol);
    }
  }, [protocol, node]);

  const isMstp = isMstpProtocol(protocol);

  const getBridgeId = (vlanId?: number): string => {
    if (isMstp) {
      const mstp = node.spanningTree as MSTPService;
      const tree = mstp.getInstance(selectedInstance);
      return tree?.BridgeId.toString() || 'Unknown';
    }
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.BridgeId.toString() || 'Unknown';
    }
    return node.spanningTree.BridgeId.toString();
  };

  const getRootId = (vlanId?: number): string => {
    if (isMstp) {
      const mstp = node.spanningTree as MSTPService;
      const tree = mstp.getInstance(selectedInstance);
      return tree?.Root.toString() || 'Unknown';
    }
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.Root.toString() || 'Unknown';
    }
    return node.spanningTree.Root.toString();
  };

  const getIsRoot = (vlanId?: number): boolean => {
    if (isMstp) {
      const mstp = node.spanningTree as MSTPService;
      const tree = mstp.getInstance(selectedInstance);
      return tree?.IsRoot ?? false;
    }
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
    setSelectedInstance(0);
  };

  const getPriority = (vlanId?: number): number => {
    if (isMstp) {
      const mstp = node.spanningTree as MSTPService;
      return mstp.getInstancePriority(selectedInstance);
    }
    if (isPerVlanProtocol(protocol) && vlanId !== undefined) {
      const pvst = node.spanningTree as PVSTService;
      const tree = pvst.getVlanTree(vlanId);
      return tree?.Priority ?? 32768;
    }
    return node.spanningTree.Priority;
  };

  const setPriority = (value: number, vlanId?: number): void => {
    if (isMstp) {
      const mstp = node.spanningTree as MSTPService;
      mstp.setInstancePriority(selectedInstance, value);
      return;
    }
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

  // MSTP-specific getters
  const getMstConfig = (): MSTConfiguration | null => {
    if (!isMstp) return null;
    return (node.spanningTree as MSTPService).mstConfig;
  };

  const setMstName = (name: string): void => {
    if (!isMstp) return;
    const config = (node.spanningTree as MSTPService).mstConfig;
    config.name = name;
  };

  const setMstRevision = (revision: number): void => {
    if (!isMstp) return;
    const config = (node.spanningTree as MSTPService).mstConfig;
    config.revision = revision;
  };

  const setMstInstanceVlan = (
    instanceId: number,
    vlanId: number,
    remove: boolean = false
  ): void => {
    if (!isMstp) return;
    (node.spanningTree as MSTPService).mstConfig.setVlanInstance(
      vlanId,
      remove ? 0 : instanceId
    );
  };

  return {
    enabled,
    setEnabled,
    protocol,
    setProtocol,
    selectedVlan,
    setSelectedVlan,
    selectedInstance,
    setSelectedInstance,
    getBridgeId,
    getRootId,
    getIsRoot,
    getPriority,
    setPriority,
    getVlanIds,
    getPortsInfo,
    setPortCost,
    getMstConfig,
    setMstName,
    setMstRevision,
    setMstInstanceVlan,
  };
}

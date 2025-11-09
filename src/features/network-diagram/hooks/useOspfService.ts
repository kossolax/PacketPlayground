import { useState, useEffect, useCallback } from 'react';
import type { RouterHost } from '../lib/network-simulator/nodes/router';
import type { Network } from '../lib/network-simulator/network';
import { IPAddress } from '../lib/network-simulator/address';
import { OSPFState } from '../lib/network-simulator/protocols/ospf';
import type {
  OSPFNetwork,
  OSPFNeighbor,
  OSPFInterfaceConfig,
} from '../lib/network-simulator/services/ospf';

export interface OSPFNetworkInfo {
  network: string;
  wildcardMask: string;
  areaID: string;
}

export interface OSPFNeighborInfo {
  neighborID: string;
  neighborIP: string;
  state: OSPFState;
  priority: number;
  designatedRouter: string;
  backupDesignatedRouter: string;
}

export interface OSPFInterfaceInfo {
  interfaceName: string;
  areaID: string;
  priority: number;
  helloInterval: number;
  deadInterval: number;
  cost: number;
  enabled: boolean;
  ipAddress: string;
  neighbors: OSPFNeighborInfo[];
}

export interface OSPFNetworkFormData {
  network: string;
  wildcardMask: string;
  areaID: string;
}

export interface OSPFInterfaceFormData {
  interfaceName: string;
  priority: number;
  cost: number;
}

export default function useOspfService(
  node: RouterHost,
  _network?: Network | null
) {
  const [enabled, setEnabled] = useState(node.services.ospf.Enabled);
  const [processID, setProcessID] = useState(node.services.ospf.processID);
  const [routerID, setRouterID] = useState(
    node.services.ospf.routerID.toString()
  );

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.ospf.Enable = enabled;
  }, [enabled, node]);

  // Sync process ID with backend
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.ospf.processID = processID;
  }, [processID, node]);

  // Sync router ID with backend
  useEffect(() => {
    try {
      const newRouterID = new IPAddress(routerID);
      node.services.ospf.setRouterID(newRouterID);
    } catch {
      // Invalid IP address, don't update
    }
  }, [routerID, node]);

  // Get all OSPF network statements
  const getAllNetworks = useCallback((): OSPFNetworkInfo[] => {
    const networks = node.services.ospf.getNetworks();
    return networks.map((net) => ({
      network: net.network.toString(),
      wildcardMask: net.wildcardMask.toString(),
      areaID: net.areaID.toString(),
    }));
  }, [node]);

  // Add a network statement
  const addNetwork = useCallback(
    (formData: OSPFNetworkFormData) => {
      try {
        const network = new IPAddress(formData.network);
        const wildcardMask = new IPAddress(formData.wildcardMask);
        const areaID = new IPAddress(formData.areaID);

        node.services.ospf.addNetwork(network, wildcardMask, areaID);
      } catch (error) {
        throw new Error(
          `Invalid IP address: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [node]
  );

  // Remove a network statement
  const removeNetwork = useCallback(
    (network: string, wildcardMask: string) => {
      try {
        const net = new IPAddress(network);
        const mask = new IPAddress(wildcardMask);
        node.services.ospf.removeNetwork(net, mask);
      } catch (error) {
        throw new Error(
          `Invalid IP address: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [node]
  );

  // Get all OSPF neighbors
  const getAllNeighbors = useCallback((): OSPFNeighborInfo[] => {
    const neighbors = node.services.ospf.getAllNeighbors();
    return neighbors.map((neighbor) => ({
      neighborID: neighbor.neighborID.toString(),
      neighborIP: neighbor.neighborIP.toString(),
      state: neighbor.state,
      priority: neighbor.priority,
      designatedRouter: neighbor.designatedRouter.toString(),
      backupDesignatedRouter: neighbor.backupDesignatedRouter.toString(),
    }));
  }, [node]);

  // Get OSPF-enabled interfaces
  const getOspfInterfaces = useCallback((): OSPFInterfaceInfo[] => {
    const interfaces: OSPFInterfaceInfo[] = [];

    node.getInterfaces().forEach((ifaceName) => {
      const iface = node.getInterface(ifaceName);
      const config = node.services.ospf.getInterfaceConfig(iface);

      if (config && config.enabled) {
        const neighbors = node.services.ospf
          .getNeighborsByInterface(iface)
          .map((neighbor) => ({
            neighborID: neighbor.neighborID.toString(),
            neighborIP: neighbor.neighborIP.toString(),
            state: neighbor.state,
            priority: neighbor.priority,
            designatedRouter: neighbor.designatedRouter.toString(),
            backupDesignatedRouter: neighbor.backupDesignatedRouter.toString(),
          }));

        interfaces.push({
          interfaceName: ifaceName,
          areaID: config.areaID.toString(),
          priority: config.priority,
          helloInterval: config.helloInterval,
          deadInterval: config.deadInterval,
          cost: config.cost,
          enabled: config.enabled,
          ipAddress: iface.getNetAddress().toString(),
          neighbors,
        });
      }
    });

    return interfaces;
  }, [node]);

  // Update interface settings
  const updateInterface = useCallback(
    (formData: OSPFInterfaceFormData) => {
      const iface = node.getInterface(formData.interfaceName);
      if (!iface) {
        throw new Error(`Interface ${formData.interfaceName} not found`);
      }

      node.services.ospf.setInterfacePriority(iface, formData.priority);
      node.services.ospf.setInterfaceCost(iface, formData.cost);
    },
    [node]
  );

  // Get list of available interfaces
  const getInterfaces = useCallback(
    (): string[] => node.getInterfaces(),
    [node]
  );

  // Get state string for display
  const getStateString = (state: OSPFState): string => {
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
  };

  return {
    enabled,
    setEnabled,
    processID,
    setProcessID,
    routerID,
    setRouterID,
    getAllNetworks,
    addNetwork,
    removeNetwork,
    getAllNeighbors,
    getOspfInterfaces,
    updateInterface,
    getInterfaces,
    getStateString,
  };
}

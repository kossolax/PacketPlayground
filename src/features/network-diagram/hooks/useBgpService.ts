import { useState, useEffect, useCallback } from 'react';
import type { RouterHost } from '../lib/network-simulator/nodes/router';
import type { Network } from '../lib/network-simulator/network';
import type { BGPNeighbor, BGPRoute } from '../lib/network-simulator/services/bgp';
import { IPAddress } from '../lib/network-simulator/address';
import { BGPState } from '../lib/network-simulator/protocols/bgp';

export interface BGPNeighborInfo {
  neighborIP: string;
  remoteAS: number;
  description: string;
  state: BGPState;
  stateName: string;
  remoteRouterID: string | null;
  holdTime: number;
  keepaliveTime: number;
  messagesReceived: number;
  messagesSent: number;
  prefixesReceived: number;
  uptime: number;
}

export interface BGPRouteInfo {
  network: string;
  prefixLength: number;
  nextHop: string;
  asPath: number[];
  localPref: number;
  origin: number;
  med: number;
  fromNeighbor: string;
  lastUpdate: number;
}

export interface BGPConfiguration {
  enabled: boolean;
  localAS: number;
  routerID: string;
  holdTime: number;
  keepaliveTime: number;
  neighbors: BGPNeighborInfo[];
}

export default function useBgpService(
  node: RouterHost,
  _network?: Network | null
) {
  const [enabled, setEnabled] = useState(node.services.bgp.Enable);
  const [localAS, setLocalAS] = useState(node.services.bgp.localAS);

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.bgp.Enable = enabled;
  }, [enabled, node]);

  // Sync with backend when localAS changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.bgp.localAS = localAS;
  }, [localAS, node]);

  // Get all BGP neighbors
  const getAllNeighbors = useCallback((): BGPNeighborInfo[] => {
    const neighbors: BGPNeighborInfo[] = [];

    node.services.bgp.getNeighbors().forEach((neighbor: BGPNeighbor) => {
      neighbors.push({
        neighborIP: neighbor.neighborIP.toString(),
        remoteAS: neighbor.remoteAS,
        description: neighbor.description,
        state: neighbor.state,
        stateName: BGPState[neighbor.state],
        remoteRouterID: neighbor.remoteRouterID?.toString() || null,
        holdTime: neighbor.holdTime,
        keepaliveTime: neighbor.keepaliveTime,
        messagesReceived: neighbor.messagesReceived,
        messagesSent: neighbor.messagesSent,
        prefixesReceived: neighbor.prefixesReceived,
        uptime: neighbor.uptime,
      });
    });

    return neighbors;
  }, [node]);

  // Get all BGP routes
  const getAllRoutes = useCallback((): BGPRouteInfo[] => {
    const routes: BGPRouteInfo[] = [];

    node.services.bgp.getRoutes().forEach((route: BGPRoute) => {
      routes.push({
        network: route.network.toString(),
        prefixLength: route.prefixLength,
        nextHop: route.nextHop.toString(),
        asPath: route.asPath,
        localPref: route.localPref,
        origin: route.origin,
        med: route.med,
        fromNeighbor: route.fromNeighbor.toString(),
        lastUpdate: route.lastUpdate,
      });
    });

    return routes;
  }, [node]);

  // Add a BGP neighbor
  const addNeighbor = useCallback(
    (neighborIP: string, remoteAS: number, description?: string) => {
      const ip = new IPAddress(neighborIP);
      node.services.bgp.addNeighbor(ip, remoteAS, description);
    },
    [node]
  );

  // Remove a BGP neighbor
  const removeNeighbor = useCallback(
    (neighborIP: string) => {
      const ip = new IPAddress(neighborIP);
      node.services.bgp.removeNeighbor(ip);
    },
    [node]
  );

  // Get neighbor by IP
  const getNeighbor = useCallback(
    (neighborIP: string): BGPNeighborInfo | null => {
      const ip = new IPAddress(neighborIP);
      const neighbor = node.services.bgp.getNeighbor(ip);

      if (!neighbor) return null;

      return {
        neighborIP: neighbor.neighborIP.toString(),
        remoteAS: neighbor.remoteAS,
        description: neighbor.description,
        state: neighbor.state,
        stateName: BGPState[neighbor.state],
        remoteRouterID: neighbor.remoteRouterID?.toString() || null,
        holdTime: neighbor.holdTime,
        keepaliveTime: neighbor.keepaliveTime,
        messagesReceived: neighbor.messagesReceived,
        messagesSent: neighbor.messagesSent,
        prefixesReceived: neighbor.prefixesReceived,
        uptime: neighbor.uptime,
      };
    },
    [node]
  );

  // Get BGP configuration
  const getConfiguration = useCallback(
    (): BGPConfiguration => ({
      enabled: node.services.bgp.Enable,
      localAS: node.services.bgp.localAS,
      routerID: node.services.bgp.routerID.toString(),
      holdTime: node.services.bgp.holdTime,
      keepaliveTime: node.services.bgp.keepaliveTime,
      neighbors: getAllNeighbors(),
    }),
    [node, getAllNeighbors]
  );

  // Update BGP configuration
  const updateConfiguration = useCallback(
    (config: Partial<BGPConfiguration>) => {
      if (config.localAS !== undefined) {
        setLocalAS(config.localAS);
      }
      if (config.holdTime !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.bgp.holdTime = config.holdTime;
      }
      if (config.keepaliveTime !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.bgp.keepaliveTime = config.keepaliveTime;
      }
    },
    [node]
  );

  // Clear all BGP routes
  const clearRoutes = useCallback(() => {
    node.services.bgp.clearRoutes();
  }, [node]);

  // Get Router ID
  const getRouterID = useCallback(
    (): string => node.services.bgp.routerID.toString(),
    [node]
  );

  return {
    enabled,
    setEnabled,
    localAS,
    setLocalAS,
    getAllNeighbors,
    getAllRoutes,
    addNeighbor,
    removeNeighbor,
    getNeighbor,
    getConfiguration,
    updateConfiguration,
    clearRoutes,
    getRouterID,
  };
}

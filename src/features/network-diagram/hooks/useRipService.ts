import { useState, useEffect, useCallback } from 'react';
import type { RouterHost } from '../lib/network-simulator/nodes/router';
import type { Network } from '../lib/network-simulator/network';
import type { RIPRoute } from '../lib/network-simulator/services/rip';
import { RIP_METRIC_INFINITY } from '../lib/network-simulator/protocols/rip';

export interface RIPRouteInfo {
  network: string;
  mask: string;
  cidr: number;
  nextHop: string;
  metric: number;
  interface: string;
  lastUpdate: number;
  routeTag: number;
}

export interface RIPConfiguration {
  enabled: boolean;
  updateInterval: number;
  invalidAfter: number;
  flushAfter: number;
  splitHorizon: boolean;
  poisonReverse: boolean;
  defaultMetric: number;
  enabledInterfaces: string[];
}

export default function useRipService(
  node: RouterHost,
  _network?: Network | null
) {
  const [enabled, setEnabled] = useState(node.services.rip.Enable);
  const [selectedInterface, setSelectedInterface] = useState<string | null>(
    null
  );

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.rip.Enable = enabled;
  }, [enabled, node]);

  // Get all RIP routes
  const getAllRoutes = useCallback((): RIPRouteInfo[] => {
    const routes: RIPRouteInfo[] = [];

    node.services.rip.getRoutes().forEach((route: RIPRoute) => {
      routes.push({
        network: route.network.toString(),
        mask: route.mask.toString(),
        cidr: route.mask.CIDR,
        nextHop: route.nextHop.toString(),
        metric: route.metric,
        interface: route.interface.toString(),
        lastUpdate: route.lastUpdate,
        routeTag: route.routeTag,
      });
    });

    return routes;
  }, [node]);

  // Get RIP routes for a specific interface
  const getRoutesForInterface = useCallback(
    (ifaceName: string): RIPRouteInfo[] => {
      const iface = node.getInterface(ifaceName);
      const ripRoutes = node.services.rip.getRoutesForInterface(iface);

      return ripRoutes.map((route) => ({
        network: route.network.toString(),
        mask: route.mask.toString(),
        cidr: route.mask.CIDR,
        nextHop: route.nextHop.toString(),
        metric: route.metric,
        interface: route.interface.toString(),
        lastUpdate: route.lastUpdate,
        routeTag: route.routeTag,
      }));
    },
    [node]
  );

  // Enable RIP on a specific interface
  const enableOnInterface = useCallback(
    (ifaceName: string) => {
      const iface = node.getInterface(ifaceName);
      if (!iface) {
        throw new Error(`Interface ${ifaceName} not found`);
      }

      node.services.rip.enableOnInterface(iface);
    },
    [node]
  );

  // Disable RIP on a specific interface
  const disableOnInterface = useCallback(
    (ifaceName: string) => {
      const iface = node.getInterface(ifaceName);
      if (!iface) {
        throw new Error(`Interface ${ifaceName} not found`);
      }

      node.services.rip.disableOnInterface(iface);
    },
    [node]
  );

  // Check if RIP is enabled on an interface
  const isEnabledOnInterface = useCallback(
    (ifaceName: string): boolean => {
      const iface = node.getInterface(ifaceName);
      if (!iface) return false;

      return node.services.rip.isEnabledOnInterface(iface);
    },
    [node]
  );

  // Get all enabled interfaces
  const getEnabledInterfaces = useCallback(
    (): string[] => node.services.rip.getEnabledInterfaces(),
    [node]
  );

  // Get list of available interfaces
  const getInterfaces = useCallback(
    (): string[] => node.getInterfaces(),
    [node]
  );

  // Get RIP configuration
  const getConfiguration = useCallback(
    (): RIPConfiguration => ({
      enabled: node.services.rip.Enable,
      updateInterval: node.services.rip.updateInterval,
      invalidAfter: node.services.rip.invalidAfter,
      flushAfter: node.services.rip.flushAfter,
      splitHorizon: node.services.rip.splitHorizon,
      poisonReverse: node.services.rip.poisonReverse,
      defaultMetric: node.services.rip.defaultMetric,
      enabledInterfaces: node.services.rip.getEnabledInterfaces(),
    }),
    [node]
  );

  // Update RIP configuration
  const updateConfiguration = useCallback(
    (config: Partial<RIPConfiguration>) => {
      if (config.updateInterval !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.rip.updateInterval = config.updateInterval;
      }
      if (config.invalidAfter !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.rip.invalidAfter = config.invalidAfter;
      }
      if (config.flushAfter !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.rip.flushAfter = config.flushAfter;
      }
      if (config.splitHorizon !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.rip.splitHorizon = config.splitHorizon;
      }
      if (config.poisonReverse !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.rip.poisonReverse = config.poisonReverse;
      }
      if (config.defaultMetric !== undefined) {
        // eslint-disable-next-line no-param-reassign
        node.services.rip.defaultMetric = config.defaultMetric;
      }
    },
    [node]
  );

  // Clear all RIP routes
  const clearRoutes = useCallback(() => {
    node.services.rip.clearRoutes();
  }, [node]);

  // Get metric infinity constant
  const getMetricInfinity = useCallback(() => RIP_METRIC_INFINITY, []);

  return {
    enabled,
    setEnabled,
    selectedInterface,
    setSelectedInterface,
    getAllRoutes,
    getRoutesForInterface,
    enableOnInterface,
    disableOnInterface,
    isEnabledOnInterface,
    getEnabledInterfaces,
    getInterfaces,
    getConfiguration,
    updateConfiguration,
    clearRoutes,
    getMetricInfinity,
  };
}

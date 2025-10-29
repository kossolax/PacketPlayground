/**
 * Hook for managing network simulation state
 * The Network class already contains simulation objects (RouterHost, SwitchHost, Link, etc.)
 */

import { useState, useEffect } from 'react';
import type { Network } from '../lib/network-simulator';
import { useNetworkSimulation } from '../context/NetworkSimulationContext';

interface UseSimulationNetworkReturn {
  simulation: Network | null;
  isSimulationReady: boolean;
}

/**
 * Hook to manage network simulation
 * Network class already contains simulation objects, no factory needed
 */
export default function useSimulationNetwork(
  network: Network | null
): UseSimulationNetworkReturn {
  const { spy } = useNetworkSimulation();
  const [simulation, setSimulation] = useState<Network | null>(null);
  const [isSimulationReady, setIsSimulationReady] = useState(false);

  useEffect(() => {
    if (!network) {
      setSimulation(null);
      setIsSimulationReady(false);
      return;
    }

    try {
      setSimulation(network);

      // Initialize interfaces after delay (matches Angular's scheduler.once(0.1) pattern)
      setTimeout(() => {
        // Bring up all interfaces on all nodes (triggers autonegotiation)
        Object.values(network.nodes).forEach((node) => {
          node.getInterfaces().forEach((ifaceName) => {
            try {
              const iface = node.getInterface(ifaceName);
              iface.up(); // Activates interface + triggers autonegotiation
            } catch (error) {
              // eslint-disable-next-line no-console
              console.warn(
                `[Simulation] Failed to bring up interface ${node.guid}[${ifaceName}]:`,
                error
              );
            }
          });
        });

        // Connect spy to all links for packet animation (matches Angular behavior)
        network.links.forEach((link) => {
          link.addListener(spy);
        });

        setIsSimulationReady(true);
      }, 100);
    } catch (_error) {
      setSimulation(null);
      setIsSimulationReady(false);
    }
  }, [network, spy]);

  return {
    simulation,
    isSimulationReady,
  };
}

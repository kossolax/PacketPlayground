/**
 * Network Simulation Context
 * Provides global access to simulation state and LinkLayerSpy for packet visualization
 */

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { LinkLayerSpy } from '../lib/network-simulator';
import { PhysicalMessage } from '../lib/network-simulator/message';
import type { GenericNode } from '../lib/network-simulator/nodes/generic';
import type { Interface } from '../lib/network-simulator/layers/datalink';

interface NetworkSimulationContextValue {
  spy: LinkLayerSpy;
  simulatePacket: (
    sourceNode: GenericNode,
    targetNode: GenericNode,
    message: string,
    delay: number
  ) => void;
}

const NetworkSimulationContext = createContext<
  NetworkSimulationContextValue | undefined
>(undefined);

interface NetworkSimulationProviderProps {
  children: ReactNode;
}

export function NetworkSimulationProvider({
  children,
}: NetworkSimulationProviderProps) {
  const spy = useMemo(() => new LinkLayerSpy(), []);

  // Demo function to simulate packet transmission
  const simulatePacket = useCallback(
    (
      sourceNode: GenericNode,
      targetNode: GenericNode,
      message: string,
      delay: number
    ) => {
      // Create mock interfaces for testing
      const mockSourceInterface = {
        Host: sourceNode,
        toString: () => 'eth0',
      } as unknown as Interface;

      const mockTargetInterface = {
        Host: targetNode,
        toString: () => 'eth0',
      } as unknown as Interface;

      // Create a physical message
      const physicalMessage = new PhysicalMessage(message);

      // Trigger the spy event
      spy.sendBits(
        physicalMessage,
        mockSourceInterface,
        mockTargetInterface,
        delay
      );
    },
    [spy]
  );

  const value = useMemo<NetworkSimulationContextValue>(
    () => ({
      spy,
      simulatePacket,
    }),
    [spy, simulatePacket]
  );

  return (
    <NetworkSimulationContext.Provider value={value}>
      {children}
    </NetworkSimulationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNetworkSimulation(): NetworkSimulationContextValue {
  const context = useContext(NetworkSimulationContext);
  if (!context) {
    throw new Error(
      'useNetworkSimulation must be used within NetworkSimulationProvider'
    );
  }
  return context;
}

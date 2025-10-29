/**
 * Hook to monitor interface state changes in real-time
 * Uses interface listeners (like Angular version) to update LED states
 */

/* eslint-disable import/prefer-default-export */

import { useEffect, useState } from 'react';
import type { Network } from '../lib/network-simulator';
import type { InterfaceState } from '../components/edges/CustomEdge';
import type { HardwareInterface } from '../lib/network-simulator/layers/datalink';
import { SwitchHost } from '../lib/network-simulator/nodes/switch';
import type { GenericListener } from '../lib/network-simulator/protocols/base';

interface EdgeInterfaceStates {
  sourceState: InterfaceState;
  targetState: InterfaceState;
}

/**
 * Extract interface state for LED display
 */
function getInterfaceState(iface: HardwareInterface): InterfaceState {
  const state: InterfaceState = {
    isActive: iface.isActive(),
    speed: iface.Speed,
    fullDuplex: iface.FullDuplex,
    isSwitch: iface.Host instanceof SwitchHost,
  };

  // Add Spanning Tree state ONLY if switch has STP enabled
  if (iface.Host instanceof SwitchHost && iface.Host.spanningTree.Enable) {
    state.spanningTreeState = iface.Host.spanningTree.State(iface);
  }

  return state;
}

/**
 * Hook that monitors interface state changes and returns updated LED states
 * Matches Angular implementation using addListener callbacks
 */
export function useInterfaceStateMonitor(
  network: Network | null
): Map<string, EdgeInterfaceStates> {
  const [edgeStates, setEdgeStates] = useState<
    Map<string, EdgeInterfaceStates>
  >(new Map());

  useEffect(() => {
    if (!network) {
      setEdgeStates(new Map());
      return undefined;
    }

    // Initialize states for all links
    const initialStates = new Map<string, EdgeInterfaceStates>();
    network.links.forEach((link, index) => {
      const iface1 = link.getInterface(0);
      const iface2 = link.getInterface(1);

      if (iface1 && iface2) {
        initialStates.set(`link-${index}`, {
          sourceState: getInterfaceState(iface1),
          targetState: getInterfaceState(iface2),
        });
      }
    });
    setEdgeStates(initialStates);

    // Set up listeners for each interface (like Angular)
    const listeners: Array<{
      iface: HardwareInterface;
      listener: GenericListener;
    }> = [];

    network.links.forEach((link, index) => {
      const iface1 = link.getInterface(0);
      const iface2 = link.getInterface(1);

      if (!iface1 || !iface2) return;

      // Listener for source interface
      const sourceListener: GenericListener = () => {
        setEdgeStates((prev) => {
          const newStates = new Map(prev);
          const currentState = newStates.get(`link-${index}`);
          if (currentState) {
            newStates.set(`link-${index}`, {
              ...currentState,
              sourceState: getInterfaceState(iface1),
            });
          }
          return newStates;
        });
      };

      // Listener for target interface
      const targetListener: GenericListener = () => {
        setEdgeStates((prev) => {
          const newStates = new Map(prev);
          const currentState = newStates.get(`link-${index}`);
          if (currentState) {
            newStates.set(`link-${index}`, {
              ...currentState,
              targetState: getInterfaceState(iface2),
            });
          }
          return newStates;
        });
      };

      // Add listeners to interfaces
      iface1.addListener(sourceListener);
      iface2.addListener(targetListener);

      // Track for cleanup
      listeners.push(
        { iface: iface1, listener: sourceListener },
        { iface: iface2, listener: targetListener }
      );
    });

    // Cleanup: remove all listeners when network changes or component unmounts
    return () => {
      listeners.forEach(({ iface, listener }) => {
        iface.removeListener(listener);
      });
    };
  }, [network]);

  return edgeStates;
}

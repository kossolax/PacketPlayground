/**
 * Centralized hook for network link management
 * Handles link creation, interface state monitoring, and listener attachment
 */

/* eslint-disable import/prefer-default-export */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterfaceState } from '../components/edges/CustomEdge';
import type { DeviceType, Network } from '../lib/network-simulator';
import { Link, Node as SimNode } from '../lib/network-simulator';
import type { CableUIType } from '../lib/network-simulator/cables';
import {
  detectCableType,
  getCableVisualProps,
} from '../lib/network-simulator/cables';
import type { HardwareInterface } from '../lib/network-simulator/layers/datalink';
import { SwitchHost } from '../lib/network-simulator/nodes/switch';
import type {
  GenericListener,
  LinkLayerSpy,
} from '../lib/network-simulator/protocols/base';

export interface EdgeInterfaceStates {
  sourceState: InterfaceState;
  targetState: InterfaceState;
}

interface CreateLinkResult {
  success: boolean;
  message: string;
  linkId?: string;
  sourcePort?: string;
  targetPort?: string;
  cableType?: CableUIType;
}

interface UseNetworkLinksReturn {
  createLink: (
    sourceNodeId: string,
    targetNodeId: string,
    cableType?: CableUIType
  ) => CreateLinkResult;
  linkStates: Map<string, EdgeInterfaceStates>;
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

  // Add Spanning Tree state and role ONLY if switch has STP enabled
  if (iface.Host instanceof SwitchHost && iface.Host.spanningTree.Enable) {
    state.spanningTreeState = iface.Host.spanningTree.State(iface);
    state.spanningTreeRole = iface.Host.spanningTree.Role(iface);
  }

  return state;
}

/**
 * Hook to centralize all link management logic
 */
export function useNetworkLinks(
  network: Network | null,
  spy: LinkLayerSpy | null
): UseNetworkLinksReturn {
  const [linkStates, setLinkStates] = useState<
    Map<string, EdgeInterfaceStates>
  >(new Map());

  // Track listeners for cleanup
  const listenersRef = useRef<
    Array<{
      iface: HardwareInterface;
      listener: GenericListener;
    }>
  >([]);

  // Initialize states and listeners for all existing links
  useEffect(() => {
    if (!network) {
      setLinkStates(new Map());
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
    setLinkStates(initialStates);

    // Set up listeners for each interface
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
        setLinkStates((prev) => {
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
        setLinkStates((prev) => {
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

    listenersRef.current = listeners;

    // Cleanup: remove all listeners when network changes or component unmounts
    return () => {
      listeners.forEach(({ iface, listener }) => {
        iface.removeListener(listener);
      });
      listenersRef.current = [];
    };
  }, [network]);

  // Function to create a new link
  const createLink = useCallback(
    (
      sourceNodeId: string,
      targetNodeId: string,
      _cableType?: CableUIType
    ): CreateLinkResult => {
      if (!network || !spy) {
        return {
          success: false,
          message: 'Network or spy not available',
        };
      }

      // Get source and target nodes from simulator
      const sourceSimNode = network.nodes[sourceNodeId];
      const targetSimNode = network.nodes[targetNodeId];

      if (!sourceSimNode || !targetSimNode) {
        return {
          success: false,
          message: 'Cannot connect: Device not found in network',
        };
      }

      // Cast to Node to access getInterfaces() method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceNode = sourceSimNode as SimNode<any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const targetNode = targetSimNode as SimNode<any>;

      // Get first available interface on each device
      const sourceInterfaces = sourceNode.getInterfaces();
      const targetInterfaces = targetNode.getInterfaces();

      if (sourceInterfaces.length === 0) {
        return {
          success: false,
          message: `${sourceNode.guid} has no interfaces`,
        };
      }

      if (targetInterfaces.length === 0) {
        return {
          success: false,
          message: `${targetNode.guid} has no interfaces`,
        };
      }

      // Find first available (unconnected) interface
      const availableSourceIface = sourceInterfaces.find((ifaceName) => {
        const iface = sourceNode.getInterface(ifaceName);
        return !iface.isConnected;
      });
      const sourceIface = availableSourceIface
        ? sourceNode.getInterface(availableSourceIface)
        : null;

      const availableTargetIface = targetInterfaces.find((ifaceName) => {
        const iface = targetNode.getInterface(ifaceName);
        return !iface.isConnected;
      });
      const targetIface = availableTargetIface
        ? targetNode.getInterface(availableTargetIface)
        : null;

      if (!sourceIface) {
        return {
          success: false,
          message: `${sourceNode.guid}: No available interfaces`,
        };
      }

      if (!targetIface) {
        return {
          success: false,
          message: `${targetNode.guid}: No available interfaces`,
        };
      }

      // Create physical link (interfaces are inactive, no auto-negotiation yet)
      const link = new Link(sourceIface, targetIface, 10); // 10 meters cable
      network.links.push(link);

      // CRITICAL: Get link index AFTER pushing to array
      // This index must match the format used for edge IDs
      const linkIndex = network.links.length - 1;
      const linkId = `link-${linkIndex}`;

      // Attach spy to new link BEFORE enabling interfaces
      // This ensures we capture auto-negotiation packets
      link.addListener(spy);

      // Create listeners for interface state updates
      const sourceListener: GenericListener = () => {
        setLinkStates((prev) => {
          const newStates = new Map(prev);
          const currentState = newStates.get(linkId);
          if (currentState) {
            newStates.set(linkId, {
              ...currentState,
              sourceState: getInterfaceState(sourceIface),
            });
          }
          return newStates;
        });
      };

      const targetListener: GenericListener = () => {
        setLinkStates((prev) => {
          const newStates = new Map(prev);
          const currentState = newStates.get(linkId);
          if (currentState) {
            newStates.set(linkId, {
              ...currentState,
              targetState: getInterfaceState(targetIface),
            });
          }
          return newStates;
        });
      };

      // Attach interface listeners
      sourceIface.addListener(sourceListener);
      targetIface.addListener(targetListener);

      // Track listeners for cleanup
      listenersRef.current.push(
        { iface: sourceIface, listener: sourceListener },
        { iface: targetIface, listener: targetListener }
      );

      // Initialize state for this link
      setLinkStates((prev) => {
        const newStates = new Map(prev);
        newStates.set(linkId, {
          sourceState: getInterfaceState(sourceIface),
          targetState: getInterfaceState(targetIface),
        });
        return newStates;
      });

      // Enable interfaces (this will trigger auto-negotiation)
      try {
        sourceIface.up();
        targetIface.up();

        // Manually trigger auto-negotiation now that interfaces are up and spy is attached
        if (sourceIface.discovery) {
          sourceIface.discovery.negociate(
            sourceIface.minSpeed,
            sourceIface.maxSpeed,
            sourceIface.fullDuplexCapable
          );
        }
        if (targetIface.discovery) {
          targetIface.discovery.negociate(
            targetIface.minSpeed,
            targetIface.maxSpeed,
            targetIface.fullDuplexCapable
          );
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[Link Creation] Failed to enable interfaces:', error);
      }

      // Auto-detect cable type based on device types
      // When cableType is 'auto' or undefined, we detect the actual cable type
      const actualCableType = detectCableType(
        sourceSimNode.type as DeviceType,
        targetSimNode.type as DeviceType
      );
      const cableProps = getCableVisualProps(actualCableType);

      return {
        success: true,
        message: `Connected ${sourceNode.guid}[${sourceIface.toString()}] ↔ ${targetNode.guid}[${targetIface.toString()}] using ${cableProps.displayName} cable`,
        linkId,
        sourcePort: sourceIface.toString(),
        targetPort: targetIface.toString(),
        cableType: actualCableType,
      };
    },
    [network, spy]
  );

  return {
    createLink,
    linkStates,
  };
}

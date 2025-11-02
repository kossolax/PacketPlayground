/**
 * Hook for network diagram editing
 * Manages ReactFlow nodes and edges state
 */

/* eslint-disable import/prefer-default-export */

import { useCallback, useState } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import { toast } from 'sonner';
import type { Device, Network, DeviceType } from '../lib/network-simulator';
import {
  Node as SimNode,
  DEVICE_CATALOG,
  GenericNode,
} from '../lib/network-simulator';
import { detectCableType } from '../lib/network-simulator/cables';
import { useNetworkSimulation } from '../context/NetworkSimulationContext';
import {
  ServerHost,
  ComputerHost,
} from '../lib/network-simulator/nodes/server';
import { SwitchHost } from '../lib/network-simulator/nodes/switch';
import { RouterHost } from '../lib/network-simulator/nodes/router';
import type { CableUIType } from '../lib/network-simulator/cables';
import { useNetworkLinks, type EdgeInterfaceStates } from './useNetworkLinks';

interface ConnectionInProgress {
  sourceNodeId: string;
  cableType: CableUIType;
}

interface PingInProgress {
  sourceNodeId: string;
}

interface UseNetworkEditorReturn {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  loadTopology: (network: Network) => void;
  addDevice: (device: Device) => void;
  clearDiagram: () => void;
  selectedCable: CableUIType | null;
  selectCable: (cableType: CableUIType) => void;
  clearCableSelection: () => void;
  connectionInProgress: ConnectionInProgress | null;
  startConnection: (nodeId: string) => void;
  cancelConnection: () => void;
  linkStates: Map<string, EdgeInterfaceStates>;
  isPingMode: boolean;
  pingInProgress: PingInProgress | null;
  startPingMode: () => void;
  disablePingMode: () => void;
  setPingSource: (nodeId: string) => void;
}

/**
 * Create a simulator node based on device type
 */
function createSimulatorNode(device: Device): GenericNode {
  const { name, type, guid } = device;

  let simNode: GenericNode;

  switch (type) {
    case 'router':
      simNode = new RouterHost(name, 2); // Router with 2 interfaces
      break;
    case 'switch':
      simNode = new SwitchHost(name, 24, true); // Switch with 24 ports, STP enabled
      break;
    case 'hub':
      simNode = new SwitchHost(name, 8, false); // Hub is a switch with 8 ports
      break;
    case 'server':
      simNode = new ServerHost(name, type, 1); // Server with 1 interface
      break;
    case 'pc':
    case 'laptop':
    default:
      simNode = new ComputerHost(name, type, 1); // PC/Laptop with 1 interface
      break;
  }

  // Set position and guid
  simNode.guid = guid;
  simNode.x = device.x;
  simNode.y = device.y;
  simNode.type = type;

  return simNode;
}

/**
 * Hook to manage network diagram state
 */
export function useNetworkEditor(
  simulationNetwork?: Network | null
): UseNetworkEditorReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const { spy } = useNetworkSimulation();
  const { createLink, linkStates } = useNetworkLinks(
    simulationNetwork || null,
    spy
  );

  // Cable selection state
  const [selectedCable, setSelectedCable] = useState<CableUIType | null>(null);
  const [connectionInProgress, setConnectionInProgress] =
    useState<ConnectionInProgress | null>(null);

  // Ping state
  const [isPingMode, setIsPingMode] = useState(false);
  const [pingInProgress, setPingInProgress] = useState<PingInProgress | null>(
    null
  );

  const selectCable = useCallback((cableType: CableUIType) => {
    setSelectedCable(cableType);
    setConnectionInProgress(null);
    setPingInProgress(null);
  }, []);

  const clearCableSelection = useCallback(() => {
    setSelectedCable(null);
    setConnectionInProgress(null);
  }, []);

  const startConnection = useCallback(
    (nodeId: string) => {
      if (!selectedCable) return;
      setConnectionInProgress({
        sourceNodeId: nodeId,
        cableType: selectedCable,
      });
    },
    [selectedCable]
  );

  const cancelConnection = useCallback(() => {
    setConnectionInProgress(null);
  }, []);

  const startPingMode = useCallback(() => {
    setIsPingMode((prev) => {
      const newMode = !prev;
      if (newMode) {
        // Entering ping mode: clear other modes
        setSelectedCable(null);
        setConnectionInProgress(null);
        setPingInProgress(null);
      } else {
        // Exiting ping mode: clear ping state
        setPingInProgress(null);
      }
      return newMode;
    });
  }, []);

  const disablePingMode = useCallback(() => {
    setIsPingMode(false);
    setPingInProgress(null);
  }, []);

  const setPingSource = useCallback((nodeId: string) => {
    setPingInProgress({ sourceNodeId: nodeId });
  }, []);

  const loadTopology = useCallback(
    (network: Network) => {
      // Convert Network.nodes (Record<string, GenericNode>) to UI nodes
      const newNodes: Node[] = Object.values(network.nodes).map((simNode) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodeWithMethods = simNode as SimNode<any>; // Cast to access getInterfaces()

        const node = {
          id: simNode.guid,
          type: 'customNode',
          position: { x: simNode.x, y: simNode.y },
          data: {
            label: simNode.guid,
            deviceType: simNode.type,
            icon:
              DEVICE_CATALOG[simNode.type as DeviceType]?.icon ||
              '/network-icons/pc.png',
            interfaces: nodeWithMethods
              .getInterfaces()
              .map((ifaceName: string) => {
                const iface = nodeWithMethods.getInterface(ifaceName);
                return {
                  name: ifaceName,
                  type: ifaceName.includes('Gigabit')
                    ? 'GigabitEthernet'
                    : 'FastEthernet',
                  isConnected: iface.isConnected,
                };
              }),
          },
        };

        // eslint-disable-next-line no-console
        console.log(
          `[Node Created] ID: ${simNode.guid} | Type: ${simNode.type}`
        );

        return node;
      });

      // Convert Network.links (Link[]) to UI edges
      // Filter out invalid links (missing interfaces or hosts) then map to edges
      const newEdges: Edge[] = network.links
        .filter((link) => {
          const iface1 = link.getInterface(0);
          const iface2 = link.getInterface(1);
          return iface1?.Host && iface2?.Host;
        })
        .map((link, index) => {
          const iface1 = link.getInterface(0)!;
          const iface2 = link.getInterface(1)!;

          // Detect actual cable type based on device types
          const actualCableType = detectCableType(
            (iface1.Host as unknown as SimNode).type as DeviceType,
            (iface2.Host as unknown as SimNode).type as DeviceType
          );

          const edge = {
            id: `link-${index}`,
            source: iface1.Host.guid,
            target: iface2.Host.guid,
            type: 'customEdge',
            data: {
              sourcePort: iface1.toString(),
              targetPort: iface2.toString(),
              cableType: actualCableType,
            },
          };

          // eslint-disable-next-line no-console
          console.log(
            `[Edge Created] ${iface1.Host.guid}[${iface1.toString()}] ↔ ${iface2.Host.guid}[${iface2.toString()}]`
          );

          return edge;
        });

      setNodes(newNodes);
      setEdges(newEdges);

      // Auto-fit view only when loading a network file
      setTimeout(() => {
        fitView({
          padding: 0.2,
          duration: 0,
          includeHiddenNodes: false,
          maxZoom: 1.5,
          minZoom: 0.1,
        });
      }, 100);
    },
    [setNodes, setEdges, fitView]
  );

  const addDevice = useCallback(
    (device: Device) => {
      let { interfaces } = device;

      // Create simulator node if network exists
      if (simulationNetwork) {
        const simNode = createSimulatorNode(device);

        // Cast to SimNode to access getInterfaces()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodeWithMethods = simNode as SimNode<any>;

        // Add to network (we need to mutate this)
        // eslint-disable-next-line no-param-reassign
        simulationNetwork.nodes[device.guid] = simNode;

        // Get interface list for UI
        interfaces = nodeWithMethods
          .getInterfaces()
          .map((ifaceName: string) => {
            const iface = nodeWithMethods.getInterface(ifaceName);
            return {
              name: ifaceName,
              type: ifaceName.includes('Gigabit')
                ? 'GigabitEthernet'
                : 'FastEthernet',
              isConnected: iface.isConnected,
            };
          });
      }

      // Create ReactFlow node
      const newNode: Node = {
        id: device.guid,
        type: 'customNode',
        position: { x: device.x, y: device.y },
        data: {
          label: device.name,
          deviceType: device.type,
          icon: DEVICE_CATALOG[device.type]?.icon || '/network-icons/pc.png',
          interfaces,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, simulationNetwork]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      // If no network simulator is available, just add the edge visually
      if (!simulationNetwork) {
        // For visual-only mode, detect cable type from node device types
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);

        const actualCableType =
          sourceNode && targetNode
            ? detectCableType(
                (sourceNode.data as { deviceType: DeviceType }).deviceType,
                (targetNode.data as { deviceType: DeviceType }).deviceType
              )
            : 'ethernet';

        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              type: 'customEdge',
              data: {
                cableType: actualCableType,
              },
            },
            eds
          )
        );
        // Auto-deselect cable after visual connection
        clearCableSelection();
        return;
      }

      // Delegate link creation to useNetworkLinks
      const result = createLink(
        connection.source,
        connection.target,
        selectedCable || undefined
      );

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      // Add edge to ReactFlow
      // LED states will be merged in NetworkCanvas
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: result.linkId,
            type: 'customEdge',
            data: {
              sourcePort: result.sourcePort,
              targetPort: result.targetPort,
              cableType: result.cableType,
            },
          },
          eds
        )
      );

      toast.success(result.message);

      // Auto-deselect cable after successful connection
      clearCableSelection();
    },
    [
      nodes,
      setEdges,
      simulationNetwork,
      createLink,
      selectedCable,
      clearCableSelection,
    ]
  );

  const clearDiagram = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    loadTopology,
    addDevice,
    clearDiagram,
    selectedCable,
    selectCable,
    clearCableSelection,
    connectionInProgress,
    startConnection,
    cancelConnection,
    linkStates,
    isPingMode,
    pingInProgress,
    startPingMode,
    disablePingMode,
    setPingSource,
  };
}

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
  Link,
  GenericNode,
} from '../lib/network-simulator';
import {
  ServerHost,
  ComputerHost,
} from '../lib/network-simulator/nodes/server';
import { SwitchHost } from '../lib/network-simulator/nodes/switch';
import { RouterHost } from '../lib/network-simulator/nodes/router';
import type { InterfaceState } from '../components/edges/CustomEdge';
import type { HardwareInterface } from '../lib/network-simulator/layers/datalink';
import type { CableUIType } from '../lib/network-simulator/cables';
import {
  detectCableType,
  getCableVisualProps,
} from '../lib/network-simulator/cables';

interface ConnectionInProgress {
  sourceNodeId: string;
  cableType: CableUIType;
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
      simNode = new SwitchHost(name, 24, false); // Switch with 24 ports, STP disabled
      break;
    case 'hub':
      simNode = new SwitchHost(name, 8, false); // Hub is a switch with 8 ports
      break;
    case 'server':
      simNode = new ServerHost(name, type, 1); // Server with 1 interface
      break;
    case 'pc':
    case 'laptop':
    case 'printer':
    default:
      simNode = new ComputerHost(name, type, 1); // PC/Laptop/Printer with 1 interface
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
 * Hook to manage network diagram state
 */
export function useNetworkEditor(
  simulationNetwork?: Network | null
): UseNetworkEditorReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // Cable selection state
  const [selectedCable, setSelectedCable] = useState<CableUIType | null>(null);
  const [connectionInProgress, setConnectionInProgress] =
    useState<ConnectionInProgress | null>(null);

  const selectCable = useCallback((cableType: CableUIType) => {
    setSelectedCable(cableType);
    setConnectionInProgress(null);
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

          const edge = {
            id: `link-${index}`,
            source: iface1.Host.guid,
            target: iface2.Host.guid,
            type: 'customEdge',
            data: {
              sourcePort: iface1.toString(),
              targetPort: iface2.toString(),
              cableType: 'ethernet',
              sourceInterfaceState: getInterfaceState(iface1),
              targetInterfaceState: getInterfaceState(iface2),
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
        // For visual-only mode, default to ethernet (no device type info available)
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              type: 'customEdge',
              data: {
                cableType: 'ethernet',
              },
            },
            eds
          )
        );
        // Auto-deselect cable after visual connection
        clearCableSelection();
        return;
      }

      // Get source and target nodes from simulator
      const sourceSimNode = simulationNetwork.nodes[connection.source];
      const targetSimNode = simulationNetwork.nodes[connection.target];

      if (!sourceSimNode || !targetSimNode) {
        toast.error('Cannot connect: Device not found in network');
        return;
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
        toast.error(`${sourceNode.guid} has no interfaces`);
        return;
      }

      if (targetInterfaces.length === 0) {
        toast.error(`${targetNode.guid} has no interfaces`);
        return;
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
        toast.error(`${sourceNode.guid}: No available interfaces`);
        return;
      }

      if (!targetIface) {
        toast.error(`${targetNode.guid}: No available interfaces`);
        return;
      }

      // Create physical link
      const link = new Link(sourceIface, targetIface, 10); // 10 meters cable
      simulationNetwork.links.push(link);

      // Auto-enable interfaces
      try {
        sourceIface.up();
        targetIface.up();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[Connection] Failed to enable interfaces:', error);
      }

      // Auto-detect cable type based on device types
      const detectedCableType = detectCableType(
        sourceSimNode.type,
        targetSimNode.type
      );
      const cableProps = getCableVisualProps(detectedCableType);

      // Add edge to ReactFlow with detected cable type
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'customEdge',
            data: {
              sourcePort: sourceIface.toString(),
              targetPort: targetIface.toString(),
              cableType: detectedCableType,
              sourceInterfaceState: getInterfaceState(sourceIface),
              targetInterfaceState: getInterfaceState(targetIface),
            },
          },
          eds
        )
      );

      toast.success(
        `Connected ${sourceNode.guid}[${sourceIface.toString()}] ↔ ${targetNode.guid}[${targetIface.toString()}] using ${cableProps.displayName} cable`
      );

      // Auto-deselect cable after successful connection
      clearCableSelection();
    },
    [setEdges, simulationNetwork, selectedCable, clearCableSelection]
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
  };
}

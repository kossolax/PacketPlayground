/**
 * Hook for network diagram editing
 * Manages ReactFlow nodes and edges state
 */

/* eslint-disable import/prefer-default-export */

import { useCallback } from 'react';
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
import type { Device, Network, DeviceType } from '../lib/network-simulator';
import { DEVICE_CATALOG } from '../lib/network-simulator';

interface UseNetworkEditorReturn {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  loadTopology: (network: Network) => void;
  addDevice: (device: Device) => void;
  clearDiagram: () => void;
}

/**
 * Hook to manage network diagram state
 */
export function useNetworkEditor(): UseNetworkEditorReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  const loadTopology = useCallback(
    (network: Network) => {
      // Convert Network.nodes (Record<string, GenericNode>) to UI nodes
      const newNodes: Node[] = Object.values(network.nodes).map((simNode) => {
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
            interfaces: simNode.interfaces
              ? Object.values(simNode.interfaces).map((iface) => ({
                  name: iface.name,
                  type: iface.name.includes('Gigabit')
                    ? 'GigabitEthernet'
                    : 'FastEthernet',
                  isConnected: false,
                }))
              : [],
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
        .filter((link) => link.iface1?.host && link.iface2?.host)
        .map((link, index) => {
          const edge = {
            id: `link-${index}`,
            source: link.iface1!.host.guid,
            target: link.iface2!.host.guid,
            type: 'customEdge',
            data: {
              sourcePort: link.iface1!.name,
              targetPort: link.iface2!.name,
              cableType: 'ethernet',
            },
          };

          // eslint-disable-next-line no-console
          console.log(
            `[Edge Created] ${link.iface1!.host.guid}[${link.iface1!.name}] ↔ ${link.iface2!.host.guid}[${link.iface2!.name}]`
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
      const newNode: Node = {
        id: device.guid,
        type: 'customNode',
        position: { x: device.x, y: device.y },
        data: {
          label: device.name,
          deviceType: device.type,
          icon: DEVICE_CATALOG[device.type]?.icon || '/network-icons/pc.png',
          interfaces: device.interfaces,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'customEdge',
          },
          eds
        )
      );
    },
    [setEdges]
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
  };
}

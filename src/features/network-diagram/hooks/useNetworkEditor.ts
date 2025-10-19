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
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import type { Device, NetworkTopology } from '@/lib/network-simulator';
import { DEVICE_CATALOG } from '@/lib/network-simulator';

interface UseNetworkEditorReturn {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  loadTopology: (topology: NetworkTopology) => void;
  addDevice: (device: Device) => void;
  clearDiagram: () => void;
}

/**
 * Hook to manage network diagram state
 */
export function useNetworkEditor(): UseNetworkEditorReturn {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const loadTopology = useCallback(
    (topology: NetworkTopology) => {
      const newNodes: Node[] = topology.devices.map((device) => ({
        id: device.guid,
        type: 'customNode',
        position: { x: device.x, y: device.y },
        data: {
          label: device.name,
          deviceType: device.type,
          icon: DEVICE_CATALOG[device.type]?.icon || '/network-icons/pc.png',
          interfaces: device.interfaces,
        },
      }));

      const newEdges: Edge[] = topology.links.map((link) => ({
        id: link.id,
        source: link.sourceGuid,
        target: link.targetGuid,
        type: 'customEdge',
        data: {
          sourcePort: link.sourcePort,
          targetPort: link.targetPort,
          cableType: link.cableType,
        },
      }));

      setNodes(newNodes);
      setEdges(newEdges);
    },
    [setNodes, setEdges]
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

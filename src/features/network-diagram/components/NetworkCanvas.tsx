/**
 * Network Canvas Component
 * Main ReactFlow canvas for displaying and editing network topology
 */

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './nodes/CustomNode';
import CustomEdge from './edges/CustomEdge';
import {
  createDevice,
  type Device,
  type DeviceType,
  type Network,
  type GenericNode,
} from '../lib/network-simulator';
import { usePacketAnimation } from '../hooks/usePacketAnimation';
import type { EdgeInterfaceStates } from '../hooks/useNetworkLinks';
import type { CableUIType } from '../lib/network-simulator/cables';

interface NetworkCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onAddDevice: (device: Device) => void;
  selectedDevice: DeviceType | null;
  onDeviceAdded: () => void;
  network: Network | null;
  selectedCable: CableUIType | null;
  connectionInProgress: { sourceNodeId: string; cableType: CableUIType } | null;
  onStartConnection: (nodeId: string) => void;
  onCancelConnection: () => void;
  onNodeDoubleClick: (node: GenericNode) => void;
  linkStates: Map<string, EdgeInterfaceStates>;
  isPingMode: boolean;
  pingInProgress: { sourceNodeId: string } | null;
  onSetPingSource: (nodeId: string) => void;
  onDisablePingMode: () => void;
  onExecutePing: (sourceNodeId: string, targetNodeId: string) => void;
  hasConfiguredIP: (nodeId: string) => boolean;
}

export default function NetworkCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddDevice,
  selectedDevice,
  onDeviceAdded,
  network,
  selectedCable,
  connectionInProgress,
  onStartConnection,
  onCancelConnection,
  onNodeDoubleClick,
  linkStates,
  isPingMode,
  pingInProgress,
  onSetPingSource,
  onDisablePingMode,
  onExecutePing,
  hasConfiguredIP,
}: NetworkCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { edgesWithPackets } = usePacketAnimation({ edges });

  // Handle ESC key to cancel connection or ping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pingInProgress) {
          onDisablePingMode();
        } else if (connectionInProgress) {
          onCancelConnection();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    connectionInProgress,
    onCancelConnection,
    pingInProgress,
    onDisablePingMode,
  ]);

  // Merge LED states into edges
  const edgesWithLEDs = useMemo(
    () =>
      edgesWithPackets.map((edge) => {
        const ledStates = linkStates.get(edge.id);
        if (!ledStates) return edge;

        return {
          ...edge,
          data: {
            ...edge.data,
            sourceInterfaceState: ledStates.sourceState,
            targetInterfaceState: ledStates.targetState,
          },
        };
      }),
    [edgesWithPackets, linkStates]
  );

  const nodeTypes = useMemo(
    () => ({
      customNode: CustomNode,
    }),
    []
  );

  const edgeTypes = useMemo(
    () => ({
      customEdge: CustomEdge,
    }),
    []
  );

  // Handle node click for cable connection and ping
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      // Handle ping mode
      if (isPingMode) {
        // Validate node has IP configured
        if (!hasConfiguredIP(node.id)) {
          return; // Silently ignore click on nodes without IP
        }

        // First click: set source
        if (!pingInProgress) {
          onSetPingSource(node.id);
          return;
        }

        // Second click on same node: cancel
        if (pingInProgress.sourceNodeId === node.id) {
          onDisablePingMode();
          return;
        }

        // Second click on different node: execute ping
        onExecutePing(pingInProgress.sourceNodeId, node.id);

        // Disable ping mode immediately (like cable mode)
        onDisablePingMode();
        return;
      }

      // Handle cable connection mode
      if (!selectedCable) return;

      // First click: start connection
      if (!connectionInProgress) {
        onStartConnection(node.id);
        return;
      }

      // Second click on same node: cancel
      if (connectionInProgress.sourceNodeId === node.id) {
        onCancelConnection();
        return;
      }

      // Second click on different node: create connection
      // Trigger onConnect manually
      onConnect({
        source: connectionInProgress.sourceNodeId,
        target: node.id,
        sourceHandle: null,
        targetHandle: null,
      });

      // Clear connection state
      onCancelConnection();
    },
    [
      isPingMode,
      pingInProgress,
      hasConfiguredIP,
      onSetPingSource,
      onDisablePingMode,
      onExecutePing,
      selectedCable,
      connectionInProgress,
      onStartConnection,
      onCancelConnection,
      onConnect,
    ]
  );

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      // Cancel ping if clicking on pane while ping in progress
      if (pingInProgress) {
        onDisablePingMode();
        return;
      }

      // Cancel connection if clicking on pane while connection in progress
      if (connectionInProgress) {
        onCancelConnection();
        return;
      }

      if (!selectedDevice) return;

      const target = event.target as HTMLElement;
      if (!target.classList.contains('react-flow__pane')) return;

      // Convert screen coordinates to flow coordinates (accounts for zoom/pan)
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Center the device on cursor position (icon is 48px, so offset by 24px)
      const centeredPosition = {
        x: position.x - 24,
        y: position.y - 24,
      };

      const device = createDevice(selectedDevice, centeredPosition);
      onAddDevice(device);
      onDeviceAdded();
    },
    [
      selectedDevice,
      onAddDevice,
      onDeviceAdded,
      screenToFlowPosition,
      pingInProgress,
      onDisablePingMode,
      connectionInProgress,
      onCancelConnection,
    ]
  );

  // Handle node double-click to open configuration
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!network) return;

      const simNode = network.nodes[node.id];
      if (!simNode) return;

      onNodeDoubleClick(simNode);
    },
    [network, onNodeDoubleClick]
  );

  return (
    <div
      className="flex-1 h-full"
      onClick={handlePaneClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handlePaneClick(e as unknown as React.MouseEvent);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edgesWithLEDs}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
        connectionMode={ConnectionMode.Loose}
        className="bg-background"
      >
        <Background color="hsl(var(--muted-foreground))" gap={16} />
        <Controls
          showInteractive={false}
          className="bg-background border border-border"
        />
      </ReactFlow>
    </div>
  );
}

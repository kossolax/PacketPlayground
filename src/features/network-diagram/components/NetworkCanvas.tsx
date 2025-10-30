/**
 * Network Canvas Component
 * Main ReactFlow canvas for displaying and editing network topology
 */

import { useCallback, useMemo } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CustomNode from './nodes/CustomNode';
import CustomEdge from './edges/CustomEdge';
import {
  createDevice,
  type Device,
  type DeviceType,
  type Network,
} from '../lib/network-simulator';
import { usePacketAnimation } from '../hooks/usePacketAnimation';
import { useInterfaceStateMonitor } from '../hooks/useInterfaceStateMonitor';

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
}: NetworkCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { edgesWithPackets } = usePacketAnimation({ edges });
  const interfaceStates = useInterfaceStateMonitor(network);

  // Merge LED states into edges
  const edgesWithLEDs = useMemo(
    () =>
      edgesWithPackets.map((edge) => {
        const ledStates = interfaceStates.get(edge.id);
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
    [edgesWithPackets, interfaceStates]
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

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
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
    [selectedDevice, onAddDevice, onDeviceAdded, screenToFlowPosition]
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

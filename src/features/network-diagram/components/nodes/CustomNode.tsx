/**
 * Custom Node for ReactFlow
 * Displays network device with icon and label
 */

import { memo, useState } from 'react';
import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react';
import type { DeviceType, NetworkInterface } from '../../lib/network-simulator';
import { useNetworkEditorContext } from '../../contexts/NetworkEditorContext';

export interface CustomNodeData {
  label: string;
  deviceType: DeviceType;
  icon: string;
  interfaces: NetworkInterface[];
}

function CustomNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CustomNodeData;
  const [isHovered, setIsHovered] = useState(false);
  const connection = useConnection();
  const { selectedCable, connectionInProgress } = useNetworkEditorContext();

  // Show handles when:
  // 1. Node is hovered
  // 2. Cable is selected
  // 3. ReactFlow connection is in progress
  const showHandles =
    isHovered ||
    selectedCable !== null ||
    connectionInProgress !== null ||
    connection.inProgress;

  const handleClassName = `!bg-primary transition-opacity duration-200 ${showHandles ? 'opacity-100' : 'opacity-0'}`;

  return (
    <div
      className="relative"
      style={{ width: 80, height: 90 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top handles */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className={handleClassName}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className={handleClassName}
      />
      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className={handleClassName}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className={handleClassName}
      />
      {/* Left handles */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className={handleClassName}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className={handleClassName}
      />
      {/* Right handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className={handleClassName}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className={handleClassName}
      />

      <div
        className={`flex flex-col items-center gap-1 ${
          selected ? 'ring-2 ring-primary ring-offset-2 rounded-md' : ''
        }`}
        style={{ width: 80 }}
      >
        <img
          src={nodeData.icon}
          alt={nodeData.deviceType}
          className="h-12 w-12 object-contain"
          draggable={false}
          onError={(e) => {
            e.currentTarget.src = '/network-icons/pc.png';
          }}
        />
        <div className="bg-background px-2 py-0.5 text-xs font-medium rounded border border-border max-w-full truncate">
          {nodeData.label}
        </div>
      </div>
    </div>
  );
}

export default memo(CustomNode);

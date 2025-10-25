/**
 * Custom Node for ReactFlow
 * Displays network device with icon and label
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DeviceType, NetworkInterface } from '../../lib/network-simulator';

export interface CustomNodeData {
  label: string;
  deviceType: DeviceType;
  icon: string;
  interfaces: NetworkInterface[];
}

function CustomNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CustomNodeData;

  return (
    <div className="relative" style={{ width: 80, height: 90 }}>
      {/* Top handles */}
      <Handle
        type="source"
        position={Position.Top}
        id="top-source"
        className="!bg-primary opacity-0"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top-target"
        className="!bg-primary opacity-0"
      />
      {/* Bottom handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-source"
        className="!bg-primary opacity-0"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        className="!bg-primary opacity-0"
      />
      {/* Left handles */}
      <Handle
        type="source"
        position={Position.Left}
        id="left-source"
        className="!bg-primary opacity-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!bg-primary opacity-0"
      />
      {/* Right handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!bg-primary opacity-0"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right-target"
        className="!bg-primary opacity-0"
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

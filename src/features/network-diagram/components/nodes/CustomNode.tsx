/**
 * Custom Node for ReactFlow
 * Displays network device with icon and label
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { DeviceType, NetworkInterface } from '@/lib/network-simulator';

export interface CustomNodeData {
  label: string;
  deviceType: DeviceType;
  icon: string;
  interfaces: NetworkInterface[];
}

function CustomNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CustomNodeData;

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary opacity-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary opacity-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary opacity-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary opacity-0"
      />

      <div
        className={`flex flex-col items-center gap-1 ${
          selected ? 'ring-2 ring-primary ring-offset-2 rounded-md' : ''
        }`}
      >
        <img
          src={nodeData.icon}
          alt={nodeData.deviceType}
          className="h-12 w-12 object-contain"
          draggable={false}
        />
        <div className="bg-background px-2 py-0.5 text-xs font-medium rounded border border-border">
          {nodeData.label}
        </div>
      </div>
    </div>
  );
}

export default memo(CustomNode);

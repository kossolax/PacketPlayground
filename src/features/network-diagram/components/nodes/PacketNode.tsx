/**
 * PacketNode Component
 * Displays an animated packet moving along network connections
 */

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

export interface PacketNodeData {
  message: string; // Protocol/message type to display
}

function PacketNode({ data }: NodeProps) {
  const nodeData = data as unknown as PacketNodeData;

  return (
    <div
      className="bg-red-500 text-white border-4 border-yellow-400 rounded-lg shadow-2xl px-4 py-3 pointer-events-none"
      style={{
        fontSize: '16px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        minWidth: '80px',
        textAlign: 'center',
        boxShadow: '0 0 20px rgba(255,0,0,0.8)',
      }}
    >
      🔴 {nodeData.message}
    </div>
  );
}

export default memo(PacketNode);

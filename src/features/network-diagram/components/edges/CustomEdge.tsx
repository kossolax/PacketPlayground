/**
 * Custom Edge for ReactFlow
 * Displays network connection between devices
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';

export interface CustomEdgeData {
  sourcePort?: string;
  targetPort?: string;
  cableType?: string;
}

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as CustomEdgeData | undefined;

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? 'hsl(var(--primary))' : 'hsl(var(--border))',
          strokeWidth: selected ? 2 : 1.5,
        }}
      />
      {edgeData?.sourcePort && edgeData?.targetPort && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="text-xs bg-background border border-border px-1.5 py-0.5 rounded nodrag nopan"
          >
            {edgeData.sourcePort} ↔ {edgeData.targetPort}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(CustomEdge);

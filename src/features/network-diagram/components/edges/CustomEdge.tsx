/**
 * Custom Edge for ReactFlow
 * Displays network connection between devices using floating edges
 */

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import getEdgeParams from '../../utils/edgeUtils';

export interface CustomEdgeData {
  sourcePort?: string;
  targetPort?: string;
  cableType?: string;
}

function CustomEdge({ id, source, target, data, selected }: EdgeProps) {
  const edgeData = data as CustomEdgeData | undefined;

  const sourceNode = useStore((state) => state.nodeLookup.get(source));
  const targetNode = useStore((state) => state.nodeLookup.get(target));

  if (!sourceNode || !targetNode) {
    return null;
  }

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? '#3b82f6' : '#94a3b8',
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray:
            edgeData?.cableType === 'crossover' ? '5,5' : undefined,
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

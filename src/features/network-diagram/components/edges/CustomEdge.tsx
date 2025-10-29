/**
 * Custom Edge for ReactFlow
 * Displays network connection between devices using floating edges
 */

import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useStore,
  type EdgeProps,
} from '@xyflow/react';
import { memo, useEffect, useRef } from 'react';
import getEdgeParams from '../../utils/edgeUtils';

export interface AnimatedPacket {
  id?: string; // unique key for React mounting
  message: string;
  delay: number; // Animation duration in seconds
  reverse?: boolean; // if true, animate from target to source
}

export interface CustomEdgeData {
  sourcePort?: string;
  targetPort?: string;
  cableType?: string;
  isBlinking?: boolean;
  animatedPackets?: AnimatedPacket[]; // Packets currently animating on this edge
}

// JS-driven packet animator
function PacketDot({
  edgeId,
  packet,
}: {
  edgeId: string;
  packet: AnimatedPacket;
}) {
  const circleRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    const path = document.getElementById(
      `edge-path-${edgeId}`
    ) as SVGPathElement | null;
    const circle = circleRef.current;
    if (!path || !circle) return undefined;

    const total = path.getTotalLength();
    const durMs = Math.max(0, packet.delay * 1000);
    const start = performance.now();

    // Position immediately at start to avoid initial blink
    const initProgress = packet.reverse ? 1 : 0;
    const initPoint = path.getPointAtLength(initProgress * total);
    circle.setAttribute(
      'transform',
      `translate(${initPoint.x},${initPoint.y})`
    );

    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = durMs === 0 ? 1 : Math.min(1, elapsed / durMs);
      const prog = packet.reverse ? 1 - t : t;
      const pt = path.getPointAtLength(prog * total);
      circle.setAttribute('transform', `translate(${pt.x},${pt.y})`);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edgeId, packet.id, packet.delay, packet.reverse]);

  return (
    <circle
      ref={circleRef}
      r="8"
      fill="#ef4444"
      stroke="#fff"
      strokeWidth="2"
    />
  );
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

  // Determine stroke color
  const getStrokeColor = () => {
    if (edgeData?.isBlinking) return '#f59e0b';
    if (selected) return '#3b82f6';
    return '#94a3b8';
  };

  // Determine stroke width
  const getStrokeWidth = () => {
    if (edgeData?.isBlinking) return 3;
    if (selected) return 2.5;
    return 1.5;
  };

  return (
    <>
      {/* Define a path referenced by the JS animator to stabilize motion across renders */}
      <defs>
        <path id={`edge-path-${id}`} d={edgePath} />
      </defs>

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: getStrokeColor(),
          strokeWidth: getStrokeWidth(),
          strokeDasharray:
            edgeData?.cableType === 'crossover' ? '5,5' : undefined,
          opacity: edgeData?.isBlinking ? 0.5 : 1,
        }}
      />

      {/* Animated packets as SVG circles (JS-driven) */}
      {edgeData?.animatedPackets?.map((packet) => (
        <g key={`${id}-packet-${packet.id ?? ''}`}>
          <PacketDot edgeId={id} packet={packet} />
        </g>
      ))}

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

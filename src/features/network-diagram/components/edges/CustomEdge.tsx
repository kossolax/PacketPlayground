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
import { SpanningTreeState } from '../../lib/network-simulator/services/spanningtree';

export interface AnimatedPacket {
  id?: string; // unique key for React mounting
  message: string;
  delay: number; // Animation duration in seconds
  reverse?: boolean; // if true, animate from target to source
}

export interface InterfaceState {
  isActive: boolean;
  speed?: number; // Mbps
  fullDuplex?: boolean;
  isSwitch?: boolean;
  spanningTreeState?: SpanningTreeState;
}

export interface CustomEdgeData {
  sourcePort?: string;
  targetPort?: string;
  cableType?: string;
  isBlinking?: boolean;
  animatedPackets?: AnimatedPacket[]; // Packets currently animating on this edge
  sourceInterfaceState?: InterfaceState;
  targetInterfaceState?: InterfaceState;
}

/**
 * Get LED color based on interface state
 * Colors:
 * - Black: not initialized (system error)
 * - Red: interface down
 * - Orange: STP Blocking (only if STP enabled)
 * - Blue: STP Listening/Learning (only if STP enabled)
 * - Green: interface up (default for switches without STP, routers, PCs)
 */
function getLEDColor(state?: InterfaceState): string {
  if (!state) return '#505050'; // Black - not initialized (system error)

  if (!state.isActive) return '#f44336'; // Red - interface down

  // If switch WITH STP enabled, show STP state colors
  if (state.isSwitch && state.spanningTreeState !== undefined) {
    switch (state.spanningTreeState) {
      case SpanningTreeState.Blocking:
        return '#f4af50'; // Orange
      case SpanningTreeState.Listening:
      case SpanningTreeState.Learning:
        return '#2196f3'; // Blue
      case SpanningTreeState.Forwarding:
        return '#4caf50'; // Green
      case SpanningTreeState.Disabled:
        return '#f44336'; // Red - STP disabled this port
      default:
        break;
    }
  }

  // Default: interface up (switch without STP, router, PC, or unknown STP state)
  return '#4caf50'; // Green
}

/**
 * Get tooltip text describing the interface state
 */
function getInterfaceTooltip(state?: InterfaceState): string {
  if (!state) return 'Interface not initialized';

  if (!state.isActive) return 'Interface DOWN';

  const parts: string[] = ['Interface UP'];

  if (state.speed) {
    parts.push(`${state.speed} Mbps`);
  }

  if (state.fullDuplex !== undefined) {
    parts.push(state.fullDuplex ? 'Full Duplex' : 'Half Duplex');
  }

  if (state.isSwitch && state.spanningTreeState !== undefined) {
    const stpState = SpanningTreeState[state.spanningTreeState];
    parts.push(`STP: ${stpState}`);
  }

  return parts.join(' | ');
}

// JS-driven packet animator with badge display
function PacketDot({
  edgeId,
  packet,
}: {
  edgeId: string;
  packet: AnimatedPacket;
}) {
  const groupRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    const path = document.getElementById(
      `edge-path-${edgeId}`
    ) as SVGPathElement | null;
    const group = groupRef.current;
    if (!path || !group) return undefined;

    const total = path.getTotalLength();
    const durMs = Math.max(0, packet.delay * 1000);
    const start = performance.now();

    // Position immediately at start to avoid initial blink
    const initProgress = packet.reverse ? 1 : 0;
    const initPoint = path.getPointAtLength(initProgress * total);
    group.setAttribute(
      'transform',
      `translate(${initPoint.x},${initPoint.y})`
    );

    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - start;
      const t = durMs === 0 ? 1 : Math.min(1, elapsed / durMs);
      const prog = packet.reverse ? 1 - t : t;
      const pt = path.getPointAtLength(prog * total);
      group.setAttribute('transform', `translate(${pt.x},${pt.y})`);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edgeId, packet.id, packet.delay, packet.reverse]);

  // Parse message lines
  const lines = packet.message.split('\n').filter((line) => line.trim() !== '');
  const lineHeight = 12;
  const padding = 6;
  const minWidth = 40;

  // Calculate dynamic width based on text length (rough estimate)
  const maxLineLength = Math.max(...lines.map((line) => line.length));
  const width = Math.max(minWidth, maxLineLength * 6 + padding * 2);
  const height = lines.length * lineHeight + padding * 2;

  return (
    <g ref={groupRef}>
      {/* Rectangle badge with rounded corners */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx="4"
        fill="#ef4444"
        stroke="#fff"
        strokeWidth="2"
      />

      {/* Multi-line text centered */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize="9"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {lines.map((line, i) => (
          <tspan
            key={i}
            x="0"
            dy={i === 0 ? -(lines.length - 1) * lineHeight / 2 : lineHeight}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
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

      {/* LED Status Indicators at edge endpoints */}
      <g className="pointer-events-none">
        {/* Source LED */}
        <circle
          cx={sx}
          cy={sy}
          r="6"
          fill={getLEDColor(edgeData?.sourceInterfaceState)}
          stroke="#fff"
          strokeWidth="1.5"
          style={{ transition: 'fill 0.2s ease' }}
        >
          <title>{getInterfaceTooltip(edgeData?.sourceInterfaceState)}</title>
        </circle>

        {/* Target LED */}
        <circle
          cx={tx}
          cy={ty}
          r="6"
          fill={getLEDColor(edgeData?.targetInterfaceState)}
          stroke="#fff"
          strokeWidth="1.5"
          style={{ transition: 'fill 0.2s ease' }}
        >
          <title>{getInterfaceTooltip(edgeData?.targetInterfaceState)}</title>
        </circle>
      </g>

      {/* Animated packets as SVG circles (JS-driven) */}
      {edgeData?.animatedPackets?.map((packet) => (
        <g key={`${id}-packet-${packet.id ?? ''}`}>
          <PacketDot edgeId={id} packet={packet} />
        </g>
      ))}
    </>
  );
}

export default memo(CustomEdge);

/**
 * Hook for animating packet transmission in network diagram
 * Subscribes to LinkLayerSpy events and adds animated packets to edges
 */

import type { Edge } from '@xyflow/react';
/* eslint-disable import/prefer-default-export */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimatedPacket } from '../components/edges/CustomEdge';
import { useNetworkSimulation } from '../context/NetworkSimulationContext';
import { type PacketTransmission } from '../lib/network-simulator';

interface PacketOnEdge {
  sourceGuid: string;
  targetGuid: string;
  message: string;
  delay: number; // seconds (already visually adjusted)
  id: string; // unique identifier (stable + collision-free)
}

interface UsePacketAnimationProps {
  edges: Edge[]; // ReactFlow edges
}

interface UsePacketAnimationReturn {
  edgesWithPackets: Edge[]; // Edges with animated packets added
}

const BLINK_THRESHOLD = 0.01; // Packets faster than this will blink instead of animate

/**
 * Hook to manage packet animation in the network diagram
 */
export function usePacketAnimation({
  edges,
}: UsePacketAnimationProps): UsePacketAnimationReturn {
  const { spy } = useNetworkSimulation();
  const [activePackets, setActivePackets] = useState<PacketOnEdge[]>([]);
  // Monotonic sequence to avoid id collisions when multiple events share the same millisecond
  const seqRef = useRef(0);

  // Listen to packet transmission events
  useEffect(() => {
    if (!spy) return undefined;

    const unsubscribe = spy.onSendBits((transmission: PacketTransmission) => {
      // Skip very fast packets (we'll handle them with blinking edges later)
      if (transmission.delay < BLINK_THRESHOLD) {
        return;
      }

      // Extract source and target node GUIDs
      const sourceGuid = transmission.source.Host.guid;
      const targetGuid = transmission.destination.Host.guid;

      // Use simulator-provided delay directly (no artificial multiplier)
      const visualDelay = transmission.delay;

      // Build a collision-free id: time-seq-random (kept short). Using setState callback ensures monotonic increment.
      const uid = (() => {
        const t = Date.now();
        seqRef.current += 1;
        const r = Math.random().toString(36).slice(2, 6);
        return `${t}-${seqRef.current}-${r}`;
      })();

      const packetOnEdge: PacketOnEdge = {
        sourceGuid,
        targetGuid,
        message: transmission.message.toString(),
        delay: visualDelay,
        id: uid,
      };

      setActivePackets((prev) => [...prev, packetOnEdge]);

      // Remove packet after animation completes
      setTimeout(() => {
        setActivePackets((prev) => prev.filter((p) => p.id !== uid));
      }, visualDelay * 1000);
    });

    return unsubscribe;
  }, [spy]);

  // Merge packets into edges by matching source/target GUIDs
  const edgesWithPackets = useMemo(() => {
    if (activePackets.length === 0) return edges;

    return edges.map((edge) => {
      // Packets moving in edge direction
      const forward = activePackets
        .filter(
          (p) => p.sourceGuid === edge.source && p.targetGuid === edge.target
        )
        .map<AnimatedPacket>((p) => ({
          message: p.message,
          delay: p.delay,
          reverse: false,
          id: String(p.id),
        }));

      // Packets moving in reverse direction
      const reverse = activePackets
        .filter(
          (p) => p.sourceGuid === edge.target && p.targetGuid === edge.source
        )
        .map<AnimatedPacket>((p) => ({
          message: p.message,
          delay: p.delay,
          reverse: true,
          id: String(p.id),
        }));

      const packets = [...forward, ...reverse];
      if (packets.length === 0) return edge;

      return {
        ...edge,
        data: {
          ...edge.data,
          animatedPackets: packets,
        },
      };
    });
  }, [edges, activePackets]);

  return {
    edgesWithPackets,
  };
}

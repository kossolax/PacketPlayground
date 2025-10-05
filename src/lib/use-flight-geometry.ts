import { useMemo } from 'react';
import { computeFlightAndTrail, Side, StartLiftPolicy } from '@/lib/draw';

export interface FlightPacket<T extends string = string> {
  animId: number;
  type: T;
  from: Side;
  to: Side;
  position: number; // 0..100
}

export interface FlightGeometryLayout<T extends string = string> {
  clientXPercent: number;
  serverXPercent: number;
  topOffset: number;
  segmentHeight: number;
  envelopeHeight: number;
  firewallXPercent?: number;
  startLiftFor?: StartLiftPolicy<T>;
}

export interface UnifiedFlightVM {
  trails: Array<{
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    stroke: string;
  }>;
  flying: Array<{
    key: string;
    xPercent: number;
    yTop: number;
    label: string;
    bg: string;
    border: string;
  }>;
}

export interface UseFlightGeometryParams<T extends string = string> {
  packets: ReadonlyArray<FlightPacket<T>>;
  flightRowByAnimId: Map<number, number>; // from assignFlightsAndSegments
  layout: FlightGeometryLayout<T>;
  labelFor: (type: T) => { label: string; bg: string; border: string };
  strokeFor: (type: T) => string;
}

/**
 * Hook utilitaire pour générer d'un coup les VM trails et flying à partir
 * d'une liste de paquets en vol et d'une map animId->row.
 */
export function useFlightGeometry<T extends string = string>(
  params: UseFlightGeometryParams<T>
): UnifiedFlightVM {
  const { packets, flightRowByAnimId, layout, labelFor, strokeFor } = params;

  return useMemo(() => {
    const trails: UnifiedFlightVM['trails'] = [];
    const flying: UnifiedFlightVM['flying'] = [];
    packets.forEach((p) => {
      const seqNum = flightRowByAnimId.get(p.animId);
      if (seqNum == null) return;
      const geom = computeFlightAndTrail(
        {
          seqNum,
          type: p.type,
          from: p.from,
          to: p.to,
          positionPercent: p.position,
        },
        layout
      );
      trails.push({
        key: `trail-${p.animId}`,
        x1: geom.trail.x1,
        y1: geom.trail.y1,
        x2: geom.trail.x2,
        y2: geom.trail.y2,
        stroke: strokeFor(p.type),
      });
      const style = labelFor(p.type);
      flying.push({
        key: `fly-${p.animId}`,
        xPercent: geom.xPercent,
        yTop: geom.yTop,
        label: style.label,
        bg: style.bg,
        border: style.border,
      });
    });
    return { trails, flying } as const;
  }, [packets, flightRowByAnimId, layout, labelFor, strokeFor]);
}

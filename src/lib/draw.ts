// Small drawing primitives/helpers for timeline components

import { clamp, lerp } from './utils';

export type Side = 'client' | 'server' | 'firewall';

// Return lifeline X position given side and the two lifeline Xs (percent in the 0..100 viewBox)
export function lifelineX(
  side: Side,
  clientX: number,
  serverX: number,
  firewallX?: number
): number {
  if (side === 'client') return clientX;
  if (side === 'server') return serverX;
  // firewall
  return firewallX ?? (clientX + serverX) / 2;
}

// Compute a vertical segment (y1->y2) for a wait overlay, ensuring a minimum visible size
export function computeWaitSegment(
  lastY: number,
  segmentHeight: number,
  minPx: number = 50
): { y1: number; y2: number } {
  const y1 = lastY + 8; // slight gap after last segment
  const height = Math.max(minPx, segmentHeight * 0.7);
  const y2 = y1 + height;
  return { y1, y2 };
}

// ======= Timeline geometry helpers (moved from timeline-geometry) =======

export type PacketLike<T extends string = string> = {
  seqNum: number;
  type: T;
  from: Side;
  to: Side;
};

export type FlyingPacketLike<T extends string = string> = {
  animId: number;
  type: T;
  from: Side;
  to: Side;
  position: number; // 0..100
  startTime: number; // for FIFO ordering of parallel flights
};

export type Segment<T extends string = string> = {
  seqNum: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: T;
};

export type Arrival<T extends string = string> = {
  seqNum: number;
  to: Side;
  x: number;
  y: number;
  type: T;
};

export type StartLiftPolicy<T extends string = string> = (
  seqNum: number,
  type: T
) => number;

export interface GeometryParams<T extends string = string> {
  // data
  sentPackets: ReadonlyArray<PacketLike<T>>;
  flyingPackets: ReadonlyArray<FlyingPacketLike<T>>;
  // layout
  clientXPercent: number;
  serverXPercent: number;
  firewallXPercent?: number;
  topOffset: number;
  segmentHeight: number;
  envelopeHeight: number;
  // policy
  startLiftFor?: StartLiftPolicy<T>;
}

export interface GeometryResult<T extends string = string> {
  flightRowByAnimId: Map<number, number>; // animId -> seqNum (row)
  segments: Array<Segment<T>>; // completed segments
  arrivals: Array<Arrival<T>>; // stationary envelopes at arrival
}

// Compute row top helper (exported for convenience)
export const rowTopFor = (
  seqNum: number,
  topOffset: number,
  segmentHeight: number
) => topOffset + seqNum * segmentHeight;

// Internal shared computation for flight geometry (not exported)
function baseFlightGeometry<T extends string = string>(
  opts: {
    seqNum: number;
    type: T;
    from: Side;
    to: Side;
    positionPercent: number;
  },
  layout: {
    clientXPercent: number;
    serverXPercent: number;
    firewallXPercent?: number;
    topOffset: number;
    segmentHeight: number;
    startLiftFor?: StartLiftPolicy<T>;
  }
) {
  const t = clamp(opts.positionPercent / 100, 0, 1);
  const startLift = layout.startLiftFor
    ? layout.startLiftFor(opts.seqNum, opts.type)
    : 0;
  const startY =
    rowTopFor(opts.seqNum, layout.topOffset, layout.segmentHeight) - startLift;
  const yTop = startY + t * (layout.segmentHeight + startLift);
  const fromX = lifelineX(
    opts.from,
    layout.clientXPercent,
    layout.serverXPercent,
    layout.firewallXPercent
  );
  const toX = lifelineX(
    opts.to,
    layout.clientXPercent,
    layout.serverXPercent,
    layout.firewallXPercent
  );
  const xPercent = lerp(fromX, toX, t);
  return { t, xPercent, yTop, fromX, toX, startY, startLift } as const;
}

// Build a mapping from packet signature to the currently flying packets (FIFO by startTime)
function buildFlyMap<T extends string = string>(
  flying: ReadonlyArray<FlyingPacketLike<T>>
) {
  type Key = `${string}:${Side}:${Side}`;
  const keyOf = (t: T, f: Side, to: Side): Key => `${t}:${f}:${to}`;
  const acc: Record<Key, FlyingPacketLike<T>[]> = Object.create(null);
  flying.forEach((p) => {
    const k = keyOf(p.type, p.from, p.to);
    (acc[k] ||= []).push(p);
  });
  Object.values(acc).forEach((arr) =>
    arr.sort((a, b) => a.startTime - b.startTime)
  );
  return { map: acc, keyOf } as const;
}

/**
 * Assign each flying packet to a visual row and compute completed segments and arrivals.
 * This is purely geometric and protocol-agnostic.
 */
export function assignFlightsAndSegments<T extends string = string>(
  params: GeometryParams<T>
): GeometryResult<T> {
  const {
    sentPackets,
    flyingPackets,
    clientXPercent,
    serverXPercent,
    topOffset,
    segmentHeight,
    envelopeHeight,
    startLiftFor,
  } = params;

  const rowTop = (seq: number) => rowTopFor(seq, topOffset, segmentHeight);
  const startLift = (seq: number, type: T) =>
    startLiftFor ? startLiftFor(seq, type) : 0;

  const { map: flyMap, keyOf } = buildFlyMap<T>(flyingPackets);

  const flightRowByAnimId = new Map<number, number>();
  const segments: Segment<T>[] = [];
  const arrivals: Arrival<T>[] = [];

  sentPackets.forEach((pkt) => {
    const k = keyOf(pkt.type, pkt.from, pkt.to);
    const rowY = rowTop(pkt.seqNum);
    let fromX = clientXPercent;
    if (pkt.from === 'server') {
      fromX = serverXPercent;
    } else if (pkt.from === 'firewall') {
      fromX = lifelineX(
        'firewall',
        clientXPercent,
        serverXPercent,
        params.firewallXPercent
      );
    }
    let toX = clientXPercent;
    if (pkt.to === 'server') {
      toX = serverXPercent;
    } else if (pkt.to === 'firewall') {
      toX = lifelineX(
        'firewall',
        clientXPercent,
        serverXPercent,
        params.firewallXPercent
      );
    }
    const lift = startLift(pkt.seqNum, pkt.type);

    const list = flyMap[k];
    if (list && list.length > 0) {
      // This instance is currently flying; consume one and assign its row
      const flight = list.shift()!;
      flightRowByAnimId.set(flight.animId, pkt.seqNum);
    } else {
      // Consider it arrived; render full segment + stationary envelope at arrival
      segments.push({
        seqNum: pkt.seqNum,
        x1: fromX,
        y1: rowY + envelopeHeight - lift,
        x2: toX,
        y2: rowY + segmentHeight,
        type: pkt.type,
      });
      arrivals.push({
        seqNum: pkt.seqNum,
        to: pkt.to,
        x: toX,
        y: rowY + segmentHeight,
        type: pkt.type,
      });
    }
  });

  return { flightRowByAnimId, segments, arrivals };
}

/**
 * Compute interpolated x,y position for a flying packet along a row.
 * Returns { xPercent, yTop } where yTop is the top of the moving envelope.
 */
export function interpolateFlightPosition<T extends string = string>(
  opts: {
    seqNum: number;
    type: T;
    from: Side;
    to: Side;
    positionPercent: number; // 0..100
  },
  layout: {
    clientXPercent: number;
    serverXPercent: number;
    firewallXPercent?: number;
    topOffset: number;
    segmentHeight: number;
    startLiftFor?: StartLiftPolicy<T>;
  }
) {
  const g = baseFlightGeometry(opts, layout);
  return { xPercent: g.xPercent, yTop: g.yTop };
}

/**
 * Compute trailing line geometry behind a flying envelope so that the line meets the bottom of the chip.
 */
export function trailingLineFor<T extends string = string>(
  opts: {
    seqNum: number;
    type: T;
    from: Side;
    to: Side;
    positionPercent: number; // 0..100
  },
  layout: {
    clientXPercent: number;
    serverXPercent: number;
    firewallXPercent?: number;
    topOffset: number;
    segmentHeight: number;
    envelopeHeight: number;
    startLiftFor?: StartLiftPolicy<T>;
  }
) {
  const g = baseFlightGeometry(opts, layout);
  const y1 = g.startY + layout.envelopeHeight;
  const y2 = g.yTop + (1 - g.t) * layout.envelopeHeight;
  return { x1: g.fromX, y1, x2: g.xPercent, y2 };
}

/**
 * Combined helper returning both the moving envelope top position and its trailing line geometry.
 * Useful to avoid recomputing interpolation twice in UI layers.
 */
export function computeFlightAndTrail<T extends string = string>(
  opts: {
    seqNum: number;
    type: T;
    from: Side;
    to: Side;
    positionPercent: number; // 0..100
  },
  layout: {
    clientXPercent: number;
    serverXPercent: number;
    firewallXPercent?: number;
    topOffset: number;
    segmentHeight: number;
    envelopeHeight: number;
    startLiftFor?: StartLiftPolicy<T>;
  }
) {
  const g = baseFlightGeometry(opts, layout);
  const trail = {
    x1: g.fromX,
    y1: g.startY + layout.envelopeHeight,
    x2: g.xPercent,
    y2: g.yTop + (1 - g.t) * layout.envelopeHeight,
  };
  return { xPercent: g.xPercent, yTop: g.yTop, trail };
}

// progress01 moved to utils.ts (import from '@/lib/utils')
// ======= Physical layer transmission primitives =======

/**
 * Compute the visual width of a transmission bar based on progress (0-100%)
 */
export function computeTransmissionBarWidth(
  progress: number,
  containerWidth: number
): number {
  const normalizedProgress = clamp(progress, 0, 100) / 100;
  return containerWidth * normalizedProgress;
}

/**
 * Compute the position of a propagating signal along a medium
 */
export function computePropagationPosition(
  progress: number,
  startX: number,
  endX: number
): number {
  const normalizedProgress = clamp(progress, 0, 100) / 100;
  return lerp(startX, endX, normalizedProgress);
}

/**
 * Generate timeline markers for transmission events
 */
export function generateTransmissionTimelineMarkers(
  events: Array<{ timestamp: number; type: string; description: string }>,
  totalDuration: number,
  timelineWidth: number
): Array<{ x: number; label: string; type: string }> {
  if (totalDuration === 0) return [];

  return events.map((event) => ({
    x: (event.timestamp / totalDuration) * timelineWidth,
    label: event.description,
    type: event.type,
  }));
}

/**
 * Compute interpolated position for a fragment in flight.
 * Handles complex routing scenarios with multiple anchors and directions.
 *
 * @param fragment - Fragment with position, direction, routing flags
 * @param anchors - Object with getters for source, destination, and router positions
 * @returns {x, y} position for rendering
 */
export function interpolateFragmentPosition<
  T extends {
    position: number; // 0..100
    sourceNetworkId: number;
    targetNetworkId: number;
    direction?: 'forward' | 'back';
    startAtRouter?: boolean;
    endAtRouter?: boolean;
    startAtRightRouter?: boolean;
  },
>(
  fragment: T,
  anchors: {
    getSourceX: () => number;
    getDestinationX: () => number;
    getRouterX: (networkId: number) => number;
  }
): { x: number; y: number } {
  const { position, sourceNetworkId, direction } = fragment;
  const { getSourceX, getDestinationX, getRouterX } = anchors;

  // Determine start anchor
  let startX: number;
  if (direction === 'back') {
    startX = getDestinationX();
  } else if (fragment.startAtRightRouter) {
    startX = getRouterX(sourceNetworkId);
  } else if (fragment.startAtRouter) {
    startX = getRouterX(sourceNetworkId - 1);
  } else {
    startX = getSourceX();
  }

  // Determine end anchor
  let endX: number;
  if (direction === 'back') {
    endX = getSourceX();
  } else if (fragment.endAtRouter) {
    endX = getRouterX(sourceNetworkId);
  } else if (
    fragment.targetNetworkId !== undefined &&
    typeof anchors.getDestinationX === 'function'
  ) {
    endX = getDestinationX();
  } else {
    endX = getRouterX(sourceNetworkId + 1);
  }

  const x = lerp(startX, endX, position / 100);
  return { x, y: 0 }; // y is provided by caller context (e.g., networkY)
}

/**
 * Compute the geometry of a propagating transmission bar.
 * Models a physical transmission where:
 * - The leading edge (front) propagates from sender to receiver over propagationDelay
 * - The bar length represents bits currently on the wire
 * - During transmission, the trailing edge (back) stays at sender
 * - Once transmission ends, the back propagates too
 *
 * @param from - Starting position {x, y}
 * @param to - Ending position {x, y}
 * @param elapsedMs - Time elapsed since transmission start
 * @param transmissionDelayMs - Time to transmit all bits
 * @param propagationDelayMs - Time for signal to travel from sender to receiver
 * @returns Bar geometry or null if not yet started
 */
export function computePropagatingBar(
  from: { x: number; y: number },
  to: { x: number; y: number },
  elapsedMs: number,
  transmissionDelayMs: number,
  propagationDelayMs: number
): {
  frontX: number;
  frontY: number;
  backX: number;
  backY: number;
  centerX: number;
  centerY: number;
  length: number;
  angle: number;
  isActive: boolean;
} | null {
  // Not yet started
  if (elapsedMs < 0) return null;

  const Tt = transmissionDelayMs;
  const Tp = propagationDelayMs;

  // Leading edge progress (travels from sender to receiver over Tp)
  const frontProgress =
    Tp <= 0 ? 1 : clamp(elapsedMs / Math.max(1e-6, Tp), 0, 1);
  const frontX = lerp(from.x, to.x, frontProgress);
  const frontY = lerp(from.y, to.y, frontProgress);

  // Trailing edge progress
  // - Stays at sender while transmitting (elapsedMs <= Tt)
  // - Then propagates to receiver over Tp
  let backProgress = 0;
  if (elapsedMs > Tt) {
    backProgress =
      Tp <= 0 ? 1 : clamp((elapsedMs - Tt) / Math.max(1e-6, Tp), 0, 1);
  }
  const backX = lerp(from.x, to.x, backProgress);
  const backY = lerp(from.y, to.y, backProgress);

  const length = Math.hypot(frontX - backX, frontY - backY);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const centerX = (frontX + backX) / 2;
  const centerY = (frontY + backY) / 2;

  // Active while any portion of the bar exists
  const isActive = elapsedMs >= 0 && elapsedMs <= Tt + Tp;

  return {
    frontX,
    frontY,
    backX,
    backY,
    centerX,
    centerY,
    length,
    angle,
    isActive,
  };
}

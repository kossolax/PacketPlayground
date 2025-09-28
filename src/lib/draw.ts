// Small drawing primitives/helpers for timeline components

export type Side = 'client' | 'server';

// Return lifeline X position given side and the two lifeline Xs (percent in the 0..100 viewBox)
export function lifelineX(
  side: Side,
  clientX: number,
  serverX: number
): number {
  return side === 'client' ? clientX : serverX;
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
    const fromX = pkt.from === 'client' ? clientXPercent : serverXPercent;
    const toX = pkt.to === 'client' ? clientXPercent : serverXPercent;
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
    topOffset: number;
    segmentHeight: number;
    startLiftFor?: StartLiftPolicy<T>;
  }
) {
  const t = Math.max(0, Math.min(1, opts.positionPercent / 100));
  const startLift = layout.startLiftFor
    ? layout.startLiftFor(opts.seqNum, opts.type)
    : 0;
  const startY =
    rowTopFor(opts.seqNum, layout.topOffset, layout.segmentHeight) - startLift;
  const yTop = startY + t * (layout.segmentHeight + startLift);
  const isL2R = opts.from === 'client' && opts.to === 'server';
  const xPercent = isL2R
    ? layout.clientXPercent +
      (layout.serverXPercent - layout.clientXPercent) * t
    : layout.serverXPercent -
      (layout.serverXPercent - layout.clientXPercent) * t;
  return { xPercent, yTop };
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
    topOffset: number;
    segmentHeight: number;
    envelopeHeight: number;
    startLiftFor?: StartLiftPolicy<T>;
  }
) {
  const { xPercent, yTop } = interpolateFlightPosition(opts, layout);
  const t = Math.max(0, Math.min(1, opts.positionPercent / 100));
  const startLift = layout.startLiftFor
    ? layout.startLiftFor(opts.seqNum, opts.type)
    : 0;
  const startY =
    rowTopFor(opts.seqNum, layout.topOffset, layout.segmentHeight) - startLift;
  const y1 = startY + layout.envelopeHeight; // line starts at bottom of chip at start
  const y2 = yTop + (1 - t) * layout.envelopeHeight; // ends under the moving chip
  const x1 =
    opts.from === 'client' ? layout.clientXPercent : layout.serverXPercent;
  const x2 = xPercent;
  return { x1, y1, x2, y2 };
}

/**
 * Small helper to compute normalized progress [0..1] from timeWait timestamps.
 */
export function progress01(
  startAt: number | null,
  durationMs: number | null | undefined,
  isCompleted: boolean
) {
  if (isCompleted) return 1;
  if (!startAt || !durationMs) return 0;
  const elapsed = Date.now() - startAt;
  return Math.max(0, Math.min(1, elapsed / durationMs));
}

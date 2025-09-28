import { Mail } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { lifelineX } from '@/lib/draw';
import type { TcpFinState } from '../lib/tcpfin';

interface TcpFinTimelineProps {
  state: TcpFinState;
}

/**
 * TCP FIN handshake timeline.
 * Two vertical lifelines (Client left, Server right). Packets travel left→right (FIN)
 * or right→left (ACK) with a slight downward slope to convey time.
 */
export default function TcpFinTimeline({ state }: TcpFinTimelineProps) {
  // Layout constants
  const height = 436; // vertical extent of the lifelines (keeps bottom within 500px container)
  const topOffset = 64; // space for headers
  const clientXPercent = 15; // lifeline x positions in %
  const serverXPercent = 85;
  const envelopeHeight = 28; // Height of the envelope chip so lines meet its bottom edge
  const segmentHeight = 90; // vertical step per message

  // Helper: compute base Y (top of a row) from seqNum
  const rowTop = (seqNum: number) => topOffset + seqNum * segmentHeight;
  // Apply a start-lift only to the very first FIN (seq 0) so its left start sits under the label,
  // but keep the arrival aligned to the normal row to avoid right-side artifacts.
  const firstRowLiftPx = 14;
  const startLiftFor = (seqNum: number, type: 'FIN' | 'ACK' | 'FIN_ACK') =>
    seqNum === 0 && type === 'FIN' ? firstRowLiftPx : 0;

  // Build a mapping from packet signature to the currently flying packets (FIFO by startTime)
  type Key = `${'FIN' | 'ACK' | 'FIN_ACK'}:${'client' | 'server'}:${
    | 'client'
    | 'server'}`;
  const keyOf = (
    t: 'FIN' | 'ACK' | 'FIN_ACK',
    f: 'client' | 'server',
    to: 'client' | 'server'
  ): Key => `${t}:${f}:${to}`;

  const flyMap = state.flyingPackets.reduce(
    (acc, p) => {
      const k = keyOf(p.type, p.from, p.to);
      if (!acc[k]) acc[k] = [];
      acc[k].push(p);
      return acc;
    },
    {} as Record<Key, typeof state.flyingPackets>
  );
  // Ensure FIFO order (oldest first)
  Object.values(flyMap).forEach((arr) =>
    arr.sort((a, b) => a.startTime - b.startTime)
  );

  // Walk through sentPackets (by seqNum) and classify each as flying or arrived
  const flightRowByAnimId = new Map<number, number>(); // animId -> seqNum
  type Segment = {
    seqNum: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'FIN' | 'ACK' | 'FIN_ACK';
  };
  type Arrival = {
    seqNum: number;
    to: 'client' | 'server';
    x: number;
    y: number;
    type: 'FIN' | 'ACK' | 'FIN_ACK';
  };
  const segments: Segment[] = [];
  const arrivals: Arrival[] = [];

  state.sentPackets.forEach((pkt) => {
    const k = keyOf(pkt.type, pkt.from, pkt.to);
    const rowY = rowTop(pkt.seqNum);
    const fromX = pkt.from === 'client' ? clientXPercent : serverXPercent;
    const toX = pkt.to === 'client' ? clientXPercent : serverXPercent;
    const startLift = startLiftFor(pkt.seqNum, pkt.type);

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
        y1: rowY + envelopeHeight - startLift,
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

  // Map connection states to soft colors
  const stateColor = (s: string) => {
    switch (s) {
      case 'ESTABLISHED':
        return 'bg-blue-100 border-blue-300';
      case 'FIN_WAIT_1':
      case 'LAST_ACK':
        return 'bg-yellow-100 border-yellow-300';
      case 'FIN_WAIT_2':
      case 'CLOSE_WAIT':
        return 'bg-orange-100 border-orange-300';
      case 'TIME_WAIT':
        return 'bg-purple-100 border-purple-300';
      case 'CLOSED':
        return 'bg-green-100 border-green-300';
      default:
        return 'bg-muted border-border';
    }
  };

  // TIME_WAIT indicator: static bar from the last ACK (by owner) down to bottom when active
  const timeWaitOwner =
    state.variant === 'client_closes_first' ? 'client' : 'server';
  const shouldShowWait =
    state.phase === 'time_wait' ||
    state.hasTimeWaitTimer ||
    state.clientState === 'TIME_WAIT' ||
    state.serverState === 'TIME_WAIT' ||
    state.phase === 'completed';

  let timeWaitY1 = topOffset;
  if (shouldShowWait) {
    // Prefer the last ACK sent by the owner
    const lastAckFromOwner = [...state.sentPackets]
      .reverse()
      .find((p) => p.type === 'ACK' && p.from === timeWaitOwner);
    if (lastAckFromOwner) {
      timeWaitY1 = rowTop(lastAckFromOwner.seqNum) + envelopeHeight;
    } else {
      // Fallback: last FIN received by the owner
      const lastFinToOwner = [...state.sentPackets]
        .reverse()
        .find((p) => p.type === 'FIN' && p.to === timeWaitOwner);
      if (lastFinToOwner) {
        timeWaitY1 = rowTop(lastFinToOwner.seqNum) + segmentHeight;
      } else if (segments.length > 0) {
        timeWaitY1 = segments[segments.length - 1].y2;
      }
    }
  }

  // Progress of the TIME_WAIT bar: if we have a start timestamp, use it; if completed, full height
  const yEnd = topOffset + height;
  const timeWaitProgress = (() => {
    if (state.phase === 'completed') return 1;
    if (!state.timeWaitStartAt || !state.timeWaitDuration) return 0;
    const elapsed = Date.now() - state.timeWaitStartAt;
    return Math.max(0, Math.min(1, elapsed / state.timeWaitDuration));
  })();
  const timeWaitCurrentY = Math.min(
    timeWaitY1 + (yEnd - timeWaitY1) * timeWaitProgress,
    yEnd
  );

  return (
    <div className="relative h-[500px] bg-gradient-to-r from-blue-50 via-background to-green-50 overflow-hidden rounded-md border">
      {/* Lifeline labels (top textual labels removed to avoid duplication; keep encased badges) */}

      {/* Lifelines */}
      <div
        className="absolute top-[64px] left-[15%] -translate-x-1/2"
        style={{ height }}
      >
        <div className="w-[2px] h-full bg-border" />
      </div>
      <div
        className="absolute top-[64px] left-[85%] -translate-x-1/2"
        style={{ height }}
      >
        <div className="w-[2px] h-full bg-border" />
      </div>

      {/* Current states chips */}
      <div className="absolute left-4 top-10">
        <div
          className={`border px-2 py-1 rounded ${stateColor(state.clientState)}`}
        >
          <span className="text-xs font-medium">{state.clientState}</span>
        </div>
      </div>
      <div className="absolute right-4 top-10">
        <div
          className={`border px-2 py-1 rounded ${stateColor(state.serverState)}`}
        >
          <span className="text-xs font-medium">{state.serverState}</span>
        </div>
      </div>

      {/* Completed segments (drawn as lines) */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        viewBox="0 0 100 500"
        preserveAspectRatio="none"
      >
        {segments.map((s) => {
          const stroke =
            s.type === 'FIN' ? 'rgb(147, 197, 253)' : 'rgb(134, 239, 172)';
          return (
            <line
              key={`seg-${s.type}-${s.seqNum}-${s.x1}-${s.x2}-${s.y2}`}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* TIME_WAIT indicator (purple) on owner's lifeline when active; static (state-driven) */}
      {shouldShowWait && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          viewBox="0 0 100 500"
          preserveAspectRatio="none"
        >
          <line
            x1={lifelineX(timeWaitOwner, clientXPercent, serverXPercent)}
            y1={timeWaitY1}
            x2={lifelineX(timeWaitOwner, clientXPercent, serverXPercent)}
            y2={timeWaitCurrentY}
            stroke="rgb(192, 132, 252)"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Trailing lines for flying packets (same coordinate system) */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        viewBox="0 0 100 500"
        preserveAspectRatio="none"
      >
        {state.flyingPackets.map((p) => {
          const seqNum = flightRowByAnimId.get(p.animId);
          if (seqNum == null) return null; // Shouldn't happen; safe-guard
          const t = p.position / 100;
          const startLift = startLiftFor(seqNum, p.type);
          const startY = rowTop(seqNum) - startLift;
          // Interpolate so that arrival lands on the normal row (no lift at the end)
          const yTop = startY + t * (segmentHeight + startLift); // top of the moving envelope
          const y = yTop + (1 - t) * envelopeHeight; // trailing line end meets the envelope bottom
          const isLeftToRight = p.from === 'client' && p.to === 'server';
          const x = isLeftToRight
            ? clientXPercent + (serverXPercent - clientXPercent) * t
            : serverXPercent - (serverXPercent - clientXPercent) * t;
          const xStart = isLeftToRight ? clientXPercent : serverXPercent;
          const strokeColor =
            p.type === 'FIN' ? 'rgb(147, 197, 253)' : 'rgb(134, 239, 172)';
          return (
            <line
              key={`trail-${p.animId}`}
              x1={xStart}
              y1={startY + envelopeHeight}
              x2={x}
              y2={y}
              stroke={strokeColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Flying packets with trailing line growing progressively */}
      {state.flyingPackets.map((p) => {
        const seqNum = flightRowByAnimId.get(p.animId);
        if (seqNum == null) return null;
        const t = p.position / 100;
        const startLift = startLiftFor(seqNum, p.type);
        // Interpolate so arrival is aligned to the normal row top
        const y = rowTop(seqNum) - startLift + t * (segmentHeight + startLift);
        const isLeftToRight = p.from === 'client' && p.to === 'server';
        const x = isLeftToRight
          ? clientXPercent + (serverXPercent - clientXPercent) * t
          : serverXPercent - (serverXPercent - clientXPercent) * t;
        const bg = p.type === 'FIN' ? 'bg-blue-100' : 'bg-green-100';
        const border =
          p.type === 'FIN' ? 'border-blue-300' : 'border-green-300';
        const label = p.type === 'FIN' ? 'FIN' : 'FIN+ACK';
        return (
          <div
            key={p.animId}
            className="absolute z-10"
            style={{ left: `${x}%`, top: y }}
          >
            <div
              className={`-translate-x-1/2 px-3 py-1 rounded-lg shadow border flex items-center gap-2 ${bg} ${border}`}
            >
              <Mail className="h-4 w-4" />
              <span className="font-mono text-sm">{label}</span>
            </div>
          </div>
        );
      })}

      {/* Stationary envelopes at arrival points */}
      {arrivals.map((a) => (
        <div
          key={`arr-${a.type}-${a.to}-${a.seqNum}-${a.x}-${a.y}`}
          className="absolute"
          style={{ left: `${a.x}%`, top: a.y }}
        >
          <div className="-translate-x-1/2 px-3 py-1 rounded-lg border bg-muted text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="font-mono text-xs">
              {a.type === 'FIN' ? 'FIN' : 'FIN+ACK'}
            </span>
          </div>
        </div>
      ))}

      {/* Lifeline tops for reference */}
      <div className="absolute left-[15%] -translate-x-1/2 top-10">
        <Badge
          variant="outline"
          className="bg-card shadow-sm text-base px-3 py-1.5"
        >
          Client
        </Badge>
      </div>
      <div className="absolute left-[85%] -translate-x-1/2 top-10">
        <Badge
          variant="outline"
          className="bg-card shadow-sm text-base px-3 py-1.5"
        >
          Server
        </Badge>
      </div>
    </div>
  );
}

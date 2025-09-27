import { Mail } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
  const height = 436; // vertical extent of the lifelines (keeps bottom within 500px container)
  const topOffset = 64; // space for headers
  const clientXPercent = 15; // lifeline x positions in %
  const serverXPercent = 85;

  // Visual timeline state: progressive y cursor, completed segments, and stationary envelopes
  const segmentHeight = 90; // vertical step per message
  const [segments, setSegments] = useState<
    Array<{
      id: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      type: 'FIN' | 'ACK' | 'FIN_ACK';
    }>
  >([]);
  const [arrivals, setArrivals] = useState<
    Array<{ id: number; x: number; y: number; type: 'FIN' | 'ACK' | 'FIN_ACK' }>
  >([]);
  const cursorYRef = useRef<number>(topOffset);
  const startYMapRef = useRef<Record<number, number>>({});
  const dirMapRef = useRef<Record<number, 'L2R' | 'R2L'>>({});
  const typeMapRef = useRef<Record<number, 'FIN' | 'ACK' | 'FIN_ACK'>>({});

  // TIME_WAIT local animation (grow a vertical bar downwards)
  const [waitProgress, setWaitProgress] = useState(0);
  const waitStartRef = useRef<number | null>(null);
  const waitRafRef = useRef<number | null>(null);

  // Reset visuals when simulation resets fully
  useEffect(() => {
    const isClean =
      state.phase === 'waiting' &&
      state.flyingPackets.length === 0 &&
      state.sentPackets.length === 0;
    if (isClean) {
      cursorYRef.current = topOffset;
      startYMapRef.current = {};
      dirMapRef.current = {};
      typeMapRef.current = {};
      setSegments([]);
      setArrivals([]);
    }
  }, [state.phase, state.flyingPackets.length, state.sentPackets.length]);

  // Track new/removed flying packets to assign start positions and finalize segments
  const flyingIds = useMemo(
    () => state.flyingPackets.map((p) => p.animId),
    [state.flyingPackets]
  );
  const prevFlyingIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const prev = new Set(prevFlyingIdsRef.current);
    const curr = new Set(flyingIds);

    // New packets started
    state.flyingPackets.forEach((p) => {
      if (!prev.has(p.animId)) {
        // allocate start Y at current cursor (chain effect)
        startYMapRef.current[p.animId] = cursorYRef.current;
        dirMapRef.current[p.animId] = p.from === 'client' ? 'L2R' : 'R2L';
        typeMapRef.current[p.animId] = p.type;
      }
    });

    // Packets that just arrived (removed now)
    prevFlyingIdsRef.current.forEach((id) => {
      if (!curr.has(id)) {
        const startY = startYMapRef.current[id] ?? topOffset;
        const dir = dirMapRef.current[id] ?? 'L2R';
        const type = typeMapRef.current[id] ?? 'FIN';
        const x1 = dir === 'L2R' ? clientXPercent : serverXPercent;
        const x2 = dir === 'L2R' ? serverXPercent : clientXPercent;
        const y1 = startY;
        const y2 = startY + segmentHeight;

        // finalize segment and stationary envelope at arrival
        setSegments((s) => [...s, { id, x1, y1, x2, y2, type }]);
        setArrivals((a) => [...a, { id, x: x2, y: y2, type }]);

        // advance cursor for next packet to start here
        cursorYRef.current = y2;
        // cleanup maps for this id
        delete startYMapRef.current[id];
        delete dirMapRef.current[id];
        delete typeMapRef.current[id];
      }
    });

    prevFlyingIdsRef.current = flyingIds;
  }, [flyingIds, state.flyingPackets, clientXPercent, serverXPercent]);

  // Drive WAIT progress animation as soon as TIME_WAIT starts on the initiator side
  // Start when the client enters TIME_WAIT or as soon as the time-wait timer is armed,
  // not only when phase === 'time_wait' (which flips after the final ACK arrives).
  useEffect(() => {
    const cancel = () => {
      if (waitRafRef.current) cancelAnimationFrame(waitRafRef.current);
      waitRafRef.current = null;
    };

    const timeWaitActive =
      state.clientState === 'TIME_WAIT' ||
      state.hasTimeWaitTimer ||
      state.phase === 'time_wait';

    if (timeWaitActive) {
      waitStartRef.current = waitStartRef.current ?? Date.now();
      const tick = () => {
        const start = waitStartRef.current ?? Date.now();
        const elapsed = Date.now() - start;
        const p = Math.min(1, elapsed / state.timeWaitDuration);
        setWaitProgress(p);
        if (p < 1 && (state.hasTimeWaitTimer || state.phase === 'time_wait')) {
          waitRafRef.current = requestAnimationFrame(tick);
        }
      };
      cancel();
      setWaitProgress((p) => (p === 0 ? 0 : p)); // keep progress if re-entering
      waitRafRef.current = requestAnimationFrame(tick);
    } else {
      // If completed, ensure progress is full; otherwise reset
      setWaitProgress(state.phase === 'completed' ? 1 : 0);
      waitStartRef.current = null;
      cancel();
    }
    return () => cancel();
  }, [
    state.phase,
    state.clientState,
    state.hasTimeWaitTimer,
    state.timeWaitDuration,
  ]);

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

      {/* Completed segments (drawn as lines + custom arrowheads + labels) */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        viewBox="0 0 100 500"
        preserveAspectRatio="none"
      >
        {segments.map((s) => (
          // Group: line + polygon arrowhead + optional rotated label
          <g key={s.id}>
            {(() => {
              const stroke =
                s.type === 'FIN' ? 'rgb(147, 197, 253)' : 'rgb(134, 239, 172)';

              return (
                <line
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke={stroke}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              );
            })()}
          </g>
        ))}
      </svg>

      {/* WAIT indicator (purple) on the TIME_WAIT owner's lifeline during TIME_WAIT */}
      {(() => {
        const timeWaitOwner =
          state.variant === 'client_closes_first' ? 'client' : 'server';
        const ownerStateIsTimeWait =
          timeWaitOwner === 'client'
            ? state.clientState === 'TIME_WAIT'
            : state.serverState === 'TIME_WAIT';
        const shouldShowWait =
          state.phase === 'time_wait' ||
          ownerStateIsTimeWait ||
          state.hasTimeWaitTimer ||
          state.phase === 'completed';
        if (!shouldShowWait) return null;

        // Show WAIT on the owner's lifeline, progressing downward
        const x = lifelineX(timeWaitOwner, clientXPercent, serverXPercent);
        // Start at the exact moment TIME_WAIT begins:
        // - Prefer the start Y of the in-flight final ACK (owner -> peer) if present
        // - Else, prefer the start Y of the last ACK sent by the owner that has already completed
        // - Else, fall back to the FIN arrival on the owner's lifeline
        // - Else, use the end of last segment or topOffset
        const ackFrom = timeWaitOwner;
        const ackTo = timeWaitOwner === 'client' ? 'server' : 'client';
        const ownerXPercent =
          timeWaitOwner === 'client' ? clientXPercent : serverXPercent;
        const clientAckFlying = state.flyingPackets.find(
          (p) => p.type === 'ACK' && p.from === ackFrom && p.to === ackTo
        );
        const reversed = [...segments].reverse();
        const ackFromClient = reversed.find(
          (s) => s.type === 'ACK' && s.x1 === ownerXPercent
        );
        const finOnClient = reversed.find(
          (s) => s.type === 'FIN' && s.x2 === ownerXPercent
        );
        let y1 = topOffset;
        if (clientAckFlying) {
          y1 = startYMapRef.current[clientAckFlying.animId] ?? topOffset;
        } else if (ackFromClient) {
          y1 = ackFromClient.y1;
        } else if (finOnClient) {
          y1 = finOnClient.y2;
        } else if (segments.length > 0) {
          y1 = segments[segments.length - 1].y2;
        }

        const yEnd = topOffset + height;
        const currentY = Math.min(y1 + (yEnd - y1) * waitProgress, yEnd);
        const stroke = 'rgb(192, 132, 252)';

        return (
          <svg
            className="absolute inset-0 pointer-events-none"
            width="100%"
            height="100%"
            viewBox="0 0 100 500"
            preserveAspectRatio="none"
          >
            <line
              x1={x}
              y1={y1}
              x2={x}
              y2={currentY}
              stroke={stroke}
              strokeWidth={3}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        );
      })()}

      {/* Trailing lines for flying packets (same coordinate system) */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height="100%"
        viewBox="0 0 100 500"
        preserveAspectRatio="none"
      >
        {state.flyingPackets.map((p) => {
          const t = p.position / 100;
          const startY = startYMapRef.current[p.animId] ?? topOffset;
          const y = startY + t * segmentHeight;
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
              y1={startY}
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
        const t = p.position / 100;
        const startY = startYMapRef.current[p.animId] ?? topOffset;
        const y = startY + t * segmentHeight;
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
            {/* moving envelope */}
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
          key={`arr-${a.id}`}
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

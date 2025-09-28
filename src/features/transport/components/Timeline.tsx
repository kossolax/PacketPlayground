import { Mail } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

export interface TimelineLayout {
  height: number;
  topOffset: number;
  clientXPercent: number;
  serverXPercent: number;
  firewallXPercent?: number; // optional middle lifeline
}

export interface TimelineChip {
  label: string;
  className: string; // includes bg/border
}

export interface TimelineSegmentVM {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
}

export interface TimelineTrailVM {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
}

export interface TimelineFlyingVM {
  key: string;
  xPercent: number;
  yTop: number;
  label: string;
  bg: string;
  border: string;
}

export interface TimelineArrivalVM {
  key: string;
  xPercent: number;
  y: number;
  label: string;
}

export interface TimelineTimeWaitVM {
  show: boolean;
  x: number; // x percent on viewbox
  y1: number;
  y2: number;
}

interface TcpFinTimelineProps {
  layout: TimelineLayout;
  clientChip: TimelineChip;
  serverChip: TimelineChip;
  segments: TimelineSegmentVM[];
  trails: TimelineTrailVM[];
  flying: TimelineFlyingVM[];
  arrivals: TimelineArrivalVM[];
  timeWait?: TimelineTimeWaitVM;
}

/**
 * TCP FIN timeline (presentational): renders lifelines, segments, flying envelopes,
 * arrivals, and time-wait overlay based on a precomputed view model.
 */
export default function Timeline({
  layout,
  clientChip,
  serverChip,
  segments,
  trails,
  flying,
  arrivals,
  timeWait,
}: TcpFinTimelineProps) {
  const {
    height,
    clientXPercent,
    serverXPercent,
    topOffset,
    firewallXPercent,
  } = layout;

  return (
    <div className="relative h-[500px] bg-gradient-to-r from-blue-50 via-background to-green-50 overflow-hidden rounded-md border">
      {/* Lifeline labels (top textual labels removed to avoid duplication; keep encased badges) */}

      {/* Lifelines */}
      <div
        className="absolute -translate-x-1/2"
        style={{ height, top: topOffset, left: `${clientXPercent}%` }}
      >
        <div className="w-[2px] h-full bg-border" />
      </div>
      <div
        className="absolute -translate-x-1/2"
        style={{ height, top: topOffset, left: `${serverXPercent}%` }}
      >
        <div className="w-[2px] h-full bg-border" />
      </div>
      {firewallXPercent != null && (
        <div
          className="absolute -translate-x-1/2"
          style={{ height, top: topOffset, left: `${firewallXPercent}%` }}
        >
          <div className="w-[2px] h-full bg-border" />
        </div>
      )}

      {/* Current states chips */}
      <div className="absolute left-4 top-10">
        <div className={`border px-2 py-1 rounded ${clientChip.className}`}>
          <span className="text-xs font-medium">{clientChip.label}</span>
        </div>
      </div>
      <div className="absolute right-4 top-10">
        <div className={`border px-2 py-1 rounded ${serverChip.className}`}>
          <span className="text-xs font-medium">{serverChip.label}</span>
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
        {segments.map((s) => (
          <line
            key={s.key}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* TIME_WAIT indicator (purple) on owner's lifeline when active; static (state-driven) */}
      {timeWait?.show && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height="100%"
          viewBox="0 0 100 500"
          preserveAspectRatio="none"
        >
          <line
            x1={timeWait.x}
            y1={timeWait.y1}
            x2={timeWait.x}
            y2={timeWait.y2}
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
        {trails.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.stroke}
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Flying packets with trailing line growing progressively */}
      {flying.map((f) => (
        <div
          key={f.key}
          className="absolute z-10"
          style={{ left: `${f.xPercent}%`, top: f.yTop }}
        >
          <div
            className={`-translate-x-1/2 px-3 py-1 rounded-lg shadow border flex items-center gap-2 ${f.bg} ${f.border}`}
          >
            <Mail className="h-4 w-4" />
            <span className="font-mono text-sm">{f.label}</span>
          </div>
        </div>
      ))}

      {/* Stationary envelopes at arrival points */}
      {arrivals.map((a) => (
        <div
          key={a.key}
          className="absolute"
          style={{ left: `${a.xPercent}%`, top: a.y }}
        >
          <div className="-translate-x-1/2 px-3 py-1 rounded-lg border bg-muted text-foreground flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="font-mono text-xs">{a.label}</span>
          </div>
        </div>
      ))}

      {/* Lifeline tops for reference */}
      <div
        className="absolute -translate-x-1/2 top-10"
        style={{ left: `${clientXPercent}%` }}
      >
        <Badge
          variant="outline"
          className="bg-card shadow-sm text-base px-3 py-1.5"
        >
          Client
        </Badge>
      </div>
      <div
        className="absolute -translate-x-1/2 top-10"
        style={{ left: `${serverXPercent}%` }}
      >
        <Badge
          variant="outline"
          className="bg-card shadow-sm text-base px-3 py-1.5"
        >
          Server
        </Badge>
      </div>
      {firewallXPercent != null && (
        <div
          className="absolute -translate-x-1/2 top-10"
          style={{ left: `${firewallXPercent}%` }}
        >
          <Badge
            variant="outline"
            className="bg-card shadow-sm text-base px-3 py-1.5"
          >
            Firewall
          </Badge>
        </div>
      )}
    </div>
  );
}

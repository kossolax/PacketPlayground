import { Radio } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { CsmaCaState, Frame, computeFrameBar } from '../lib/csmaca-sim';

interface CsmaCaVisualizationProps {
  state: CsmaCaState;
}

export default function CsmaCaVisualization({
  state,
}: CsmaCaVisualizationProps) {
  const containerWidth = 900;
  const containerHeight = 420;

  // Helper to get frame style (muted/translucent like other visualizations)
  const getFrameStyle = (
    type: Frame['type']
  ): { bg: string; border: string; label: string } => {
    switch (type) {
      case 'rts':
        return {
          bg: 'bg-green-300/80',
          border: 'border border-green-400',
          label: 'RTS',
        };
      case 'cts':
        return {
          bg: 'bg-green-300/80',
          border: 'border border-green-400',
          label: 'CTS',
        };
      case 'data':
        return {
          bg: 'bg-blue-300/80',
          border: 'border border-blue-400',
          label: 'DATA',
        };
      case 'ack':
        return {
          bg: 'bg-purple-300/80',
          border: 'border border-purple-400',
          label: 'ACK',
        };
      default:
        return {
          bg: 'bg-gray-300/80',
          border: 'border border-gray-400',
          label: '?',
        };
    }
  };

  // Calculate frame as a propagating bar (linear, per-link based)
  const getFrameBar = (frame: Frame) => computeFrameBar(state, frame);

  return (
    <div className="relative bg-gradient-to-r from-blue-50 via-background to-green-50 rounded-md border overflow-hidden">
      <div
        className="relative"
        style={{
          width: containerWidth,
          height: containerHeight,
          margin: '0 auto',
        }}
      >
        {/* Radio range circles */}
        {state.stations.map((station) => (
          <div
            key={`range-${station.id}`}
            className="absolute rounded-full border-2 border-dashed border-gray-300/40"
            style={{
              left: station.x - station.range,
              top: station.y - station.range,
              width: station.range * 2,
              height: station.range * 2,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Frames traveling in the air as propagating bars */}
        {state.frames.map((frame) => {
          const bar = getFrameBar(frame);
          if (!bar || !bar.active || bar.length < 1) return null;
          const style = getFrameStyle(frame.type);

          const barHeight = 12;

          return (
            <div key={frame.id}>
              {/* Propagating bar */}
              <div
                className={`absolute ${style.bg} ${style.border} rounded`}
                style={{
                  left: bar.x,
                  top: bar.y,
                  width: Math.max(bar.length, 4),
                  height: barHeight,
                  transform: 'translate(-50%, -50%)',
                  transformOrigin: 'center',
                }}
              />
            </div>
          );
        })}

        {/* Stations */}
        {state.stations.map((s) => (
          <div
            key={s.id}
            className="absolute"
            style={{ left: s.x - 40, top: s.y - 40 }}
          >
            {/* Label */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-14">
              <Badge variant="outline" className="text-xs">
                Station {s.name}
              </Badge>
            </div>

            {/* Carrier sense halo: show when sensing, waiting for ACK, OR actually sensing energy */}
            {(s.carrierSense ||
              s.status === 'sensing' ||
              s.status === 'wait_ack') && (
              <div
                className={`absolute -inset-4 rounded-full animate-pulse ${
                  s.hasCollision
                    ? 'bg-red-200/50 border border-red-500'
                    : 'bg-yellow-200/40 border border-yellow-400'
                }`}
                style={{ filter: 'blur(0.2px)' }}
              />
            )}

            {/* Node */}
            <div className="w-16 h-16 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center shadow-sm">
              <Radio className="h-4 w-4 text-gray-700" />
            </div>

            {/* Status badge */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
              <Badge variant="outline" className="text-xs">
                {s.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

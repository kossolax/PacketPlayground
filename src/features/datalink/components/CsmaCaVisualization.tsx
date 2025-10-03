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

  // Helper to get frame color and label
  const getFrameStyle = (
    type: Frame['type']
  ): { color: string; label: string } => {
    switch (type) {
      case 'rts':
        return { color: 'bg-green-400 border-green-600', label: 'RTS' };
      case 'cts':
        return { color: 'bg-green-400 border-green-600', label: 'CTS' };
      case 'data':
        return { color: 'bg-blue-400 border-blue-600', label: 'DATA' };
      case 'ack':
        return { color: 'bg-purple-400 border-purple-600', label: 'ACK' };
      default:
        return { color: 'bg-gray-400', label: '?' };
    }
  };

  // Calculate frame as a propagating bar (linear, per-link based)
  const getFrameBar = (frame: Frame) => computeFrameBar(state, frame);

  // Get status color
  const getStatusColor = (
    status: string
  ): { bg: string; border: string; text: string } => {
    switch (status) {
      case 'idle':
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          text: 'text-gray-700',
        };
      case 'sensing':
        return {
          bg: 'bg-yellow-100',
          border: 'border-yellow-400',
          text: 'text-yellow-700',
        };
      case 'rts_tx':
      case 'wait_cts':
        return {
          bg: 'bg-green-100',
          border: 'border-green-400',
          text: 'text-green-700',
        };
      case 'data_tx':
      case 'wait_ack':
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-400',
          text: 'text-blue-700',
        };
      case 'success':
        return {
          bg: 'bg-emerald-100',
          border: 'border-emerald-500',
          text: 'text-emerald-700',
        };
      case 'timeout':
        return {
          bg: 'bg-red-100',
          border: 'border-red-400',
          text: 'text-red-700',
        };
      default:
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          text: 'text-gray-700',
        };
    }
  };

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
                className={`absolute ${style.color
                  .replace('border-', 'bg-')
                  .replace('100', '400')} rounded`}
                style={{
                  left: bar.x,
                  top: bar.y,
                  width: Math.max(bar.length, 4),
                  height: barHeight,
                  transform: 'translate(-50%, -50%)',
                  transformOrigin: 'center',
                }}
              />
              {/* Label on the bar */}
              {bar.length > 30 && (
                <div
                  className="absolute text-xs font-bold text-white pointer-events-none"
                  style={{
                    left: bar.x,
                    top: bar.y,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {style.label}
                </div>
              )}
            </div>
          );
        })}

        {/* Stations */}
        {state.stations.map((station) => {
          const statusStyle = getStatusColor(station.status);

          return (
            <div
              key={station.id}
              className="absolute"
              style={{ left: station.x - 40, top: station.y - 40 }}
            >
              {/* Label */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-14">
                <Badge variant="outline" className="text-sm font-bold">
                  Station {station.name}
                </Badge>
              </div>

              {/* Carrier sense halo */}
              {station.carrierSense && (
                <div
                  className={`absolute -inset-6 rounded-full border-2 animate-pulse ${
                    station.hasCollision
                      ? 'bg-red-200/50 border-red-500'
                      : 'bg-yellow-200/50 border-yellow-400'
                  }`}
                  style={{ filter: 'blur(1px)' }}
                />
              )}

              {/* Node */}
              <div
                className={`w-20 h-20 ${statusStyle.bg} border-4 ${statusStyle.border} rounded-full flex items-center justify-center shadow-lg transition-all`}
              >
                <Radio className={`h-6 w-6 ${statusStyle.text}`} />
              </div>

              {/* Status badge */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-12">
                <Badge
                  variant="outline"
                  className={`text-xs ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}
                >
                  {station.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Radio } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { CsmaCdState } from '../lib/csmacd-sim';

interface CsmaCdVisualizationProps {
  state: CsmaCdState;
}

export default function CsmaCdVisualization({
  state,
}: CsmaCdVisualizationProps) {
  const containerWidth = 800;
  const containerHeight = 420;
  const busY = containerHeight / 2;
  const margin = 60;
  const busStartX = margin;
  const busEndX = containerWidth - margin;
  const busPx = busEndX - busStartX;

  const kmToPx = (km: number) => (km / Math.max(1, state.distance)) * busPx;
  const xForKm = (km: number) => busStartX + kmToPx(km);

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
        {/* Bus line */}
        <div
          className="absolute bg-gray-300 rounded"
          style={{ left: busStartX, top: busY - 2, width: busPx, height: 4 }}
        />

        {/* Data segments (blue) and Jam segments (red) */}
        {state.currentSegments.map((seg) => (
          <div
            key={`${seg.type}-${seg.originId}-${seg.startKm}-${seg.endKm}`}
            className={
              seg.type === 'jam'
                ? 'absolute bg-red-300/80 border border-red-400 rounded'
                : 'absolute bg-blue-300/80 border border-blue-400 rounded'
            }
            style={{
              left: xForKm(seg.startKm),
              top: busY - 8,
              width: Math.max(0, kmToPx(seg.endKm - seg.startKm)),
              height: 16,
            }}
          />
        ))}

        {/* Collision overlays where two data segments overlap */}
        {state.collisionSegments.map((c) => (
          <div
            key={`${c.startKm}-${c.endKm}`}
            className="absolute bg-red-500/30 rounded"
            style={{
              left: xForKm(c.startKm),
              top: busY - 14,
              width: Math.max(0, kmToPx(c.endKm - c.startKm)),
              height: 28,
            }}
          />
        ))}

        {/* Stations */}
        {state.stations.map((s) => {
          const x = xForKm(s.xKm);
          const isListening =
            !!s.listenWindowEndMs &&
            state.simTimeMs <= (s.listenWindowEndMs || 0);
          return (
            <div
              key={s.id}
              className="absolute"
              style={{ left: x - 20, top: busY - 20 }}
            >
              {/* Label */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-10">
                <Badge variant="outline" className="text-xs">
                  Station {s.name}
                </Badge>
              </div>

              {/* Carrier sense halo */}
              {s.carrierSense && (
                <div
                  className="absolute -inset-4 rounded-full bg-yellow-200/40 border border-yellow-400 animate-pulse"
                  style={{ filter: 'blur(0.2px)' }}
                />
              )}

              {/* Listening window indicator (≈ 2·Tp after TX start) */}
              {isListening && s.status === 'transmitting' && (
                <div className="absolute -inset-3 rounded-full border-2 border-purple-400/80" />
              )}

              {/* Node */}
              <div className="w-10 h-10 bg-white border-2 border-gray-300 rounded-full flex items-center justify-center shadow-sm">
                <Radio className="h-4 w-4 text-gray-700" />
              </div>

              {/* Status badge */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-10">
                <Badge variant="outline" className="text-xs">
                  {s.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

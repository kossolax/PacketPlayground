import { Radio, Router } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { computePropagatingBar } from '@/lib/draw';

import { TransmissionState } from '../lib/transmission-sim';

interface TransmissionVisualizationProps {
  state: TransmissionState;
}

export default function TransmissionVisualization({
  state,
}: TransmissionVisualizationProps) {
  const containerWidth = 600;
  const sidePadding = 30; // reduce padding to push nodes further apart
  const senderX = sidePadding;
  const receiverX = containerWidth - sidePadding;
  const mediumY = 200;
  const barHeight = 12;
  const squareSize = 96; // half of previous (w-24/h-24)

  // Use inner edges of the device squares so the medium line is flush with them
  const halfSquare = squareSize / 2;
  const innerSenderX = senderX + halfSquare; // right edge of sender square
  const innerReceiverX = receiverX - halfSquare; // left edge of receiver square

  const Tt = state.transmissionDelay; // transmission time (ms)
  const Tp = state.propagationDelay; // propagation time (ms)
  const T = Tt + Tp; // total animation time (ms)
  const p = state.progress / 100; // 0..1
  const elapsedMs = p * T; // simulated elapsed time (ms)

  // Compute bar geometry using centralized function
  const barGeometry = computePropagatingBar(
    { x: innerSenderX, y: mediumY },
    { x: innerReceiverX, y: mediumY },
    elapsedMs,
    Tt,
    Tp
  );

  const barStart = barGeometry
    ? Math.min(barGeometry.backX, barGeometry.frontX)
    : innerSenderX;
  const barWidth = barGeometry
    ? Math.max(barGeometry.frontX - barGeometry.backX, 0)
    : 0;

  return (
    <div className="relative bg-gradient-to-r from-blue-50 via-background to-green-50 rounded-md border overflow-hidden">
      <div
        className="relative"
        style={{ width: containerWidth, height: 400, margin: '0 auto' }}
      >
        {/* Sender */}
        <div
          className="absolute"
          style={{ left: senderX - halfSquare, top: mediumY - halfSquare }}
        >
          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 -top-8">
              <Badge
                variant="outline"
                className="bg-blue-100 border-blue-300 text-blue-700"
              >
                Sender
              </Badge>
            </div>
          </div>
          <div className="w-24 h-24 bg-blue-100 border-2 border-blue-300 rounded-lg flex items-center justify-center">
            <Radio className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        {/* Receiver */}
        <div
          className="absolute"
          style={{ left: receiverX - halfSquare, top: mediumY - halfSquare }}
        >
          <div className="relative">
            <div className="absolute left-1/2 -translate-x-1/2 -top-8">
              <Badge
                variant="outline"
                className="bg-green-100 border-green-300 text-green-700"
              >
                Receiver
              </Badge>
            </div>
          </div>
          <div className="w-24 h-24 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center">
            <Router className="h-6 w-6 text-green-600" />
          </div>
        </div>

        {/* Medium (transmission line) - flush to square inner edges */}
        <div
          className="absolute bg-gray-200 rounded"
          style={{
            left: innerSenderX,
            top: mediumY - 2,
            width: innerReceiverX - innerSenderX,
            height: 4,
          }}
        />

        {/* Transmission bar - represents all bits on the cable */}
        {state.isRunning && !state.isCompleted && (
          <div
            className="absolute bg-blue-400 rounded transition-all duration-75"
            style={{
              left: barStart,
              top: mediumY - barHeight / 2,
              width: barWidth,
              height: barHeight,
            }}
          />
        )}
      </div>
    </div>
  );
}

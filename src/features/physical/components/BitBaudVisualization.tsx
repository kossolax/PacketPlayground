/* eslint-disable react/no-array-index-key */
import { getMinimumStep } from '@/lib/utils';

import { BitBaudState, getAllIdealPoints } from '../lib/bit-baud-sim';

interface BitBaudVisualizationProps {
  state: BitBaudState;
}

export default function BitBaudVisualization({
  state,
}: BitBaudVisualizationProps) {
  const { currentBatch, bitsPerSymbol, currentSymbolIndex, modulationType } =
    state;

  // Get all ideal constellation points for the current modulation
  const idealPoints = getAllIdealPoints(modulationType);

  // Split current batch bits into symbols
  const symbols: string[] = [];
  for (let i = 0; i < 16; i += bitsPerSymbol) {
    symbols.push(currentBatch.slice(i, i + bitsPerSymbol));
  }

  // Constellation diagram size and dynamic scaling to better fill space across modulations
  const constellationSize = 500;
  const padding = 24; // px margin inside the SVG
  // Use half-pixel centers to align 1px strokes crisply and ensure perfect visual centering
  const centerX = (constellationSize - 1) / 2;
  const centerY = (constellationSize - 1) / 2;

  // Compute dynamic scale based on constellation extents and decision boundaries
  let scale = 80; // fallback
  if (modulationType !== 'none' && idealPoints.length > 0) {
    const xs = idealPoints.map((p) => p.x).sort((a, b) => a - b);
    const ys = idealPoints.map((p) => p.y).sort((a, b) => a - b);

    const stepX = getMinimumStep(xs);
    const stepY = getMinimumStep(ys);
    const minX = xs[0];
    const maxX = xs[xs.length - 1];
    const minY = ys[0];
    const maxY = ys[ys.length - 1];

    // Decision boundary extremes are half a step beyond the outermost points
    const boundaryMinX = minX - stepX / 2;
    const boundaryMaxX = maxX + stepX / 2;
    const boundaryMinY = minY - stepY / 2;
    const boundaryMaxY = maxY + stepY / 2;

    const extentX = Math.max(Math.abs(boundaryMinX), Math.abs(boundaryMaxX));
    const extentY = Math.max(Math.abs(boundaryMinY), Math.abs(boundaryMaxY));

    const usableHalf = (constellationSize - padding * 2) / 2;
    const scaleX = usableHalf / (extentX || 1);
    const scaleY = usableHalf / (extentY || 1);
    scale = Math.max(10, Math.min(scaleX, scaleY));
  }

  // Precompute decision boundary positions based on ideal points
  const boundaryXs: number[] = [];
  const boundaryYs: number[] = [];
  if (modulationType !== 'none' && idealPoints.length > 0) {
    const xs = idealPoints.map((p) => p.x).sort((a, b) => a - b);
    const ys = idealPoints.map((p) => p.y).sort((a, b) => a - b);

    const stepX = getMinimumStep(xs);
    const stepY = getMinimumStep(ys);
    const minX = xs[0];
    const maxX = xs[xs.length - 1];
    const minY = ys[0];
    const maxY = ys[ys.length - 1];

    const startX = minX - stepX / 2;
    const endX = maxX + stepX / 2;
    const startY = minY - stepY / 2;
    const endY = maxY + stepY / 2;

    // Generate inclusive ranges accounting for floating precision
    for (let x = startX; x <= endX + 1e-9; x += stepX) boundaryXs.push(x);
    for (let y = startY; y <= endY + 1e-9; y += stepY) boundaryYs.push(y);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Statistics - Symbols Transmitted */}
      <div className="bg-muted p-3 rounded-lg">
        <div className="font-medium text-orange-600">Symbols Transmitted</div>
        <div className="font-mono text-lg">
          {state.transmittedSymbols.length}
        </div>
        <div className="text-muted-foreground text-xs">
          Total on constellation
        </div>
      </div>

      {/* Constellation diagram - spans 4 rows on large screens */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-md border p-6 lg:row-span-4">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          Constellation Diagram with SNR ({state.transmittedSymbols.length}{' '}
          symbols)
        </div>
        <div className="flex justify-center">
          <svg
            width={constellationSize}
            height={constellationSize}
            viewBox={`0 0 ${constellationSize} ${constellationSize}`}
            preserveAspectRatio="xMidYMid meet"
            shapeRendering="crispEdges"
            className="border border-gray-300 bg-white rounded"
          >
            {/* Axes */}
            <line
              x1={centerX}
              y1={0}
              x2={centerX}
              y2={constellationSize}
              stroke="#ccc"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={centerY}
              x2={constellationSize}
              y2={centerY}
              stroke="#ccc"
              strokeWidth={1}
            />

            {/* Draw decision boundaries (grid lines) */}
            {modulationType !== 'none' &&
              boundaryXs.length > 0 &&
              boundaryYs.length > 0 && (
                <>
                  {/* Vertical lines based on computed decision boundaries */}
                  {boundaryXs.map((x, i) => (
                    <line
                      key={`v-${i}`}
                      x1={centerX + x * scale}
                      y1={0}
                      x2={centerX + x * scale}
                      y2={constellationSize}
                      stroke="#ddd"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  ))}
                  {/* Horizontal lines based on computed decision boundaries */}
                  {boundaryYs.map((y, i) => (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={centerY - y * scale}
                      x2={constellationSize}
                      y2={centerY - y * scale}
                      stroke="#ddd"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  ))}
                </>
              )}

            {/* Draw ideal constellation points (always visible) */}
            {idealPoints.map((point) => {
              const x = centerX + point.x * scale;
              const y = centerY - point.y * scale;

              return (
                <circle
                  key={point.bits}
                  cx={x}
                  cy={y}
                  r={2}
                  fill="#22c55e"
                  stroke="none"
                />
              );
            })}

            {/* Plot all transmitted symbols with noise, color-coded by error */}
            {state.transmittedSymbols.map((symbol, idx) => {
              const x = centerX + symbol.noisyX * scale;
              const y = centerY - symbol.noisyY * scale;

              return (
                <circle
                  key={`tx-${idx}`}
                  cx={x}
                  cy={y}
                  r={1.5}
                  fill={symbol.hasError ? '#ef4444' : '#3b82f6'}
                  fillOpacity={0.6}
                />
              );
            })}

            {/* Labels */}
            <text
              x={centerX + 5}
              y={15}
              fontSize={10}
              fill="#666"
              className="select-none"
            >
              Q
            </text>
            <text
              x={constellationSize - 15}
              y={centerY - 5}
              fontSize={10}
              fill="#666"
              className="select-none"
            >
              I
            </text>
          </svg>
        </div>
      </div>

      {/* Statistics - Bit Error Rate */}
      <div className="bg-muted p-3 rounded-lg">
        <div className="font-medium text-red-600">Bit Error Rate</div>
        <div className="font-mono text-lg">
          {state.transmittedSymbols.length > 0
            ? (
                ((state.transmittedSymbols.filter((s) => s.hasError).length *
                  state.bitsPerSymbol) /
                  (state.transmittedSymbols.length * state.bitsPerSymbol)) *
                100
              ).toFixed(1)
            : '0.0'}
          %
        </div>
        <div className="text-muted-foreground text-xs">
          {state.transmittedSymbols.filter((s) => s.hasError).length *
            state.bitsPerSymbol}{' '}
          / {state.transmittedSymbols.length * state.bitsPerSymbol} bits
        </div>
      </div>

      {/* Bit stream visualization */}
      <div className="rounded-md border p-6">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          Current Batch (16 bits)
        </div>
        <div className="flex gap-1 justify-center flex-wrap">
          {currentBatch.split('').map((bit, idx) => {
            const symbolIdx = Math.floor(idx / bitsPerSymbol);
            const isInCurrentSymbol =
              symbolIdx === currentSymbolIndex && state.isRunning;
            const isPastSymbol = symbolIdx < currentSymbolIndex;

            let className = 'bg-white border border-gray-300 text-gray-700';
            if (isPastSymbol) {
              className = 'bg-gray-300 border border-gray-400 text-gray-600';
            }
            if (isInCurrentSymbol) {
              className =
                'bg-blue-500 border border-blue-600 text-white shadow-md';
            }

            return (
              <div
                key={`bit-${idx}`}
                className={`px-2 py-1 rounded font-mono font-bold text-xs transition-all duration-200 ${className}`}
              >
                {bit}
              </div>
            );
          })}
        </div>
      </div>

      {/* Symbol sequence */}
      <div className="rounded-md border p-6">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          Symbol Sequence ({symbols.length} symbols/batch)
        </div>
        <div className="flex gap-1 justify-center flex-wrap">
          {symbols.map((symbol, idx) => {
            const isCurrent = idx === currentSymbolIndex && state.isRunning;
            const isPast = idx < currentSymbolIndex;

            let className = 'bg-white border border-gray-300 text-gray-700';
            if (isPast) {
              className = 'bg-gray-300 border border-gray-400 text-gray-600';
            }
            if (isCurrent) {
              className =
                'bg-blue-500 border border-blue-600 text-white shadow-md';
            }

            return (
              <div
                key={`symbol-${idx}`}
                className={`px-2 py-1 rounded font-mono font-bold text-xs transition-all duration-200 ${className}`}
              >
                {symbol}
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-center text-xs text-muted-foreground">
          {state.bitsPerSymbol} bit{state.bitsPerSymbol > 1 ? 's' : ''} per
          symbol
        </div>
      </div>
    </div>
  );
}

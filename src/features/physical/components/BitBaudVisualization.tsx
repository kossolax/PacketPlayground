/* eslint-disable react/no-array-index-key */
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

  // Constellation diagram size and scaling
  const constellationSize = 500;
  let scale = 80; // default for 4-QAM
  if (modulationType === '16qam') scale = 50;
  if (modulationType === '64qam') scale = 35;
  if (modulationType === '256qam') scale = 25;
  const centerX = constellationSize / 2;
  const centerY = constellationSize / 2;

  // Calculate grid size for decision boundaries
  const gridSize = Math.sqrt(2 ** bitsPerSymbol);
  const gridRows = gridSize;
  const gridCols = gridSize;

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
            {modulationType !== 'none' && (
              <>
                {/* Vertical lines - placed between and around constellation points */}
                {Array.from({ length: Math.ceil(gridCols) + 1 }).map((_, i) => {
                  // For N columns, we need N+1 vertical lines (including extremes)
                  let xPosition: number;
                  if (modulationType === '4qam') {
                    // Points at x = -1, 1 → boundaries at x = -2, 0, 2
                    xPosition = (i - 1) * 2;
                  } else if (modulationType === '16qam') {
                    // Points at x = -3, -1, 1, 3 → boundaries at x = -4, -2, 0, 2, 4
                    xPosition = (i - 2) * 2;
                  } else {
                    // For 64-QAM and 256-QAM (programmatic generation)
                    xPosition = i - gridCols / 2;
                  }
                  return (
                    <line
                      key={`v-${i}`}
                      x1={centerX + xPosition * scale}
                      y1={0}
                      x2={centerX + xPosition * scale}
                      y2={constellationSize}
                      stroke="#ddd"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  );
                })}
                {/* Horizontal lines - placed between and around constellation points */}
                {Array.from({ length: Math.ceil(gridRows) + 1 }).map((_, i) => {
                  // For N rows, we need N+1 horizontal lines (including extremes)
                  let yPosition: number;
                  if (modulationType === '4qam') {
                    // Points at y = -1, 1 → boundaries at y = -2, 0, 2
                    yPosition = (i - 1) * 2;
                  } else if (modulationType === '16qam') {
                    // Points at y = -3, -1, 1, 3 → boundaries at y = -4, -2, 0, 2, 4
                    yPosition = (i - 2) * 2;
                  } else {
                    // For 64-QAM and 256-QAM (programmatic generation)
                    yPosition = i - gridRows / 2;
                  }
                  return (
                    <line
                      key={`h-${i}`}
                      x1={0}
                      y1={centerY - yPosition * scale}
                      x2={constellationSize}
                      y2={centerY - yPosition * scale}
                      stroke="#ddd"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  );
                })}
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

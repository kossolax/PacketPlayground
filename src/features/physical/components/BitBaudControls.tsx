import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

import {
  BitBaudSim,
  BitBaudState,
  getModulationLabel,
  ModulationType,
} from '../lib/bit-baud-sim';

interface BitBaudControlsProps {
  state: BitBaudState;
  simulation: BitBaudSim | null;
}

// Pre-defined bit rate values (lower values for better visibility)
const BIT_RATE_VALUES = [
  100, // 100 bps
  200, // 200 bps
  400, // 400 bps
  800, // 800 bps
  1600, // 1.6 kbps
  3200, // 3.2 kbps
  6400, // 6.4 kbps
  12800, // 12.8 kbps
  25600, // 25.6 kbps
  51200, // 51.2 kbps
  102400, // 102.4 kbps
];

function mapSliderToBitRate(sliderValue: number): number {
  return BIT_RATE_VALUES[sliderValue] || BIT_RATE_VALUES[0];
}

function mapBitRateToSlider(bitRate: number): number {
  const index = BIT_RATE_VALUES.findIndex((val) => val >= bitRate);
  return index === -1 ? BIT_RATE_VALUES.length - 1 : index;
}

function formatBitRate(bps: number): string {
  if (bps >= 1000000) return `${bps / 1000000}M`;
  if (bps >= 1000) return `${bps / 1000}K`;
  return `${bps}`;
}

export default function BitBaudControls({
  state,
  simulation,
}: BitBaudControlsProps) {
  const handleStart = useCallback(() => {
    simulation?.start();
  }, [simulation]);

  const handleReset = useCallback(() => {
    simulation?.reset();
  }, [simulation]);

  const handleModulationChange = useCallback(
    (type: ModulationType) => {
      simulation?.setModulationType(type);
    },
    [simulation]
  );

  const handleBitRateChange = useCallback(
    (bps: number) => {
      simulation?.setBitRate(bps);
    },
    [simulation]
  );

  const handleNoiseLevelChange = useCallback(
    (noiseLevel: number) => {
      simulation?.setNoiseLevel(noiseLevel);
    },
    [simulation]
  );

  const handleStop = useCallback(() => {
    simulation?.stop();
  }, [simulation]);

  const handleBatchTransmit = useCallback(() => {
    simulation?.transmitBatch(1000);
  }, [simulation]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Button
          onClick={state.isRunning ? handleStop : handleStart}
          variant={state.isRunning ? 'destructive' : 'default'}
        >
          {state.isRunning ? 'Stop' : 'Start'}
        </Button>
        <Button onClick={handleReset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button
          onClick={handleBatchTransmit}
          variant="outline"
          disabled={state.isRunning}
        >
          Generate 1000 Symbols
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            Timer: {simulation?.getFormattedElapsedTime() || '0.0s'}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-sm">Modulation Type</Label>
        <Select
          value={state.modulationType}
          onValueChange={(v) => handleModulationChange(v as ModulationType)}
          disabled={state.isRunning}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No modulation (1 bit/symbol)</SelectItem>
            <SelectItem value="4qam">4-QAM (2 bits/symbol)</SelectItem>
            <SelectItem value="16qam">16-QAM (4 bits/symbol)</SelectItem>
            <SelectItem value="64qam">64-QAM (6 bits/symbol)</SelectItem>
            <SelectItem value="256qam">256-QAM (8 bits/symbol)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">
            Bit Rate: {formatBitRate(state.bitRate)}bps
          </Label>
          <Slider
            value={[mapBitRateToSlider(state.bitRate)]}
            onValueChange={(v) => handleBitRateChange(mapSliderToBitRate(v[0]))}
            min={0}
            max={BIT_RATE_VALUES.length - 1}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Noise Level: {state.noiseLevel.toFixed(0)}
          </Label>
          <Slider
            value={[state.noiseLevel]}
            onValueChange={(v) => handleNoiseLevelChange(v[0])}
            min={0}
            max={50}
            step={5}
            disabled={state.isRunning}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-sm">
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-blue-600">Bits per Symbol</div>
          <div className="font-mono text-lg">{state.bitsPerSymbol}</div>
          <div className="text-muted-foreground text-xs">
            {getModulationLabel(state.modulationType)}
          </div>
        </div>

        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-green-600">Bit Rate</div>
          <div className="font-mono text-lg">
            {formatBitRate(state.bitRate)}bps
          </div>
          <div className="text-muted-foreground text-xs">16 bits per batch</div>
        </div>

        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-orange-600">Symbols Transmitted</div>
          <div className="font-mono text-lg">
            {state.transmittedSymbols.length}
          </div>
          <div className="text-muted-foreground text-xs">
            Total on constellation
          </div>
        </div>

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
      </div>
    </div>
  );
}

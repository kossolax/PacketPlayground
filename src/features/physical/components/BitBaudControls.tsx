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

import { BitBaudSim, BitBaudState, ModulationType } from '../lib/bit-baud-sim';

interface BitBaudControlsProps {
  state: BitBaudState;
  simulation: BitBaudSim | null;
}

// Pre-defined baud rate values (lower values for better visibility)
const BAUD_RATE_VALUES = [
  100, // 100 baud
  200, // 200 baud
  400, // 400 baud
  800, // 800 baud
  1600, // 1.6 kbaud
];

function mapSliderToBaudRate(sliderValue: number): number {
  return BAUD_RATE_VALUES[sliderValue] || BAUD_RATE_VALUES[0];
}

function mapBaudRateToSlider(baudRate: number): number {
  const index = BAUD_RATE_VALUES.findIndex((val) => val >= baudRate);
  return index === -1 ? BAUD_RATE_VALUES.length - 1 : index;
}

function formatRate(rate: number): string {
  if (rate >= 1000000) return `${rate / 1000000}M`;
  if (rate >= 1000) return `${rate / 1000}K`;
  return `${rate}`;
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

  const handleBaudRateChange = useCallback(
    (baudRate: number) => {
      simulation?.setBaudRate(baudRate);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div className="space-y-1">
          <Label className="text-sm">
            Baud rate: {formatRate(state.baudRate)} bauds | Bit rate:{' '}
            {formatRate(state.bitRate)}bps
          </Label>
          <Slider
            value={[mapBaudRateToSlider(state.baudRate)]}
            onValueChange={(v) =>
              handleBaudRateChange(mapSliderToBaudRate(v[0]))
            }
            min={0}
            max={BAUD_RATE_VALUES.length - 1}
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
    </div>
  );
}

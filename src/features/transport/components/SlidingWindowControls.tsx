import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Simulation } from '@/lib/simulation';
import {
  LOSS_RATE_VALUES_STANDARD,
  DEFAULT_LOSS_RATE,
  mapSliderToArray,
  mapArrayToSlider,
} from '@/lib/ui-helpers';

// Generic interface for simulation state that has the required properties
interface SimulationState {
  isRunning: boolean;
  windowSize: number;
  speed: number;
  timeoutDuration: number;
  lossRate: number;
}

// Generic interface for simulation instance
interface SimulationInstance<T extends SimulationState> extends Simulation<T> {
  start(): void;
  reset(): void;
  setWindowSize(value: number): void;
  setSpeed(ms: number): void;
  setTimeoutDuration(ms: number): void;
  setLossRate(v: number): void;
  getFormattedElapsedTime(): string;
}

interface SlidingWindowControlsProps<T extends SimulationState> {
  state: T;
  simulation: SimulationInstance<T> | null;
}

export default function SlidingWindowControls<T extends SimulationState>({
  state,
  simulation,
}: SlidingWindowControlsProps<T>) {
  const handleStart = useCallback(() => {
    simulation?.start();
  }, [simulation]);

  const reset = useCallback(() => {
    simulation?.reset();
  }, [simulation]);

  // Handle loss simulation toggle - smart logic without state property
  const handleLossToggle = useCallback(
    (enabled: boolean) => {
      if (!simulation) return;

      if (enabled) {
        // When enabling, set to default value if currently 0
        const currentRate = state.lossRate;
        if (currentRate === 0) {
          simulation.setLossRate(DEFAULT_LOSS_RATE);
        }
      } else {
        // When disabling, set loss rate to 0
        simulation.setLossRate(0);
      }
    },
    [simulation, state.lossRate]
  );

  // Handle loss rate change
  const handleLossRateChange = useCallback(
    (rate: number) => {
      simulation?.setLossRate(rate);
    },
    [simulation]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Button onClick={handleStart} disabled={state.isRunning}>
          Start
        </Button>
        <Button onClick={reset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            Timer: {simulation?.getFormattedElapsedTime() || '0.0s'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">Window: {state.windowSize}</Label>
          <Slider
            value={[state.windowSize]}
            onValueChange={(v) => simulation?.setWindowSize(v[0])}
            min={1}
            max={5}
            disabled={state.isRunning}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Speed: {state.speed / 1000}s</Label>
          <Slider
            value={[state.speed]}
            onValueChange={(v) => simulation?.setSpeed(v[0])}
            min={1000}
            max={3000}
            step={500}
            disabled={state.isRunning}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">
            Timeout: {state.timeoutDuration / 1000}s
          </Label>
          <Slider
            value={[state.timeoutDuration]}
            onValueChange={(v) => simulation?.setTimeoutDuration(v[0])}
            min={3000}
            max={7000}
            step={1000}
            disabled={state.isRunning}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={state.lossRate > 0}
              onCheckedChange={handleLossToggle}
              disabled={state.isRunning}
            />
            <Label className="text-sm">Loss {state.lossRate}%</Label>
          </div>
          <Slider
            value={[
              mapArrayToSlider(LOSS_RATE_VALUES_STANDARD, state.lossRate),
            ]}
            onValueChange={(v) =>
              handleLossRateChange(
                mapSliderToArray(LOSS_RATE_VALUES_STANDARD, v[0])
              )
            }
            min={0}
            max={LOSS_RATE_VALUES_STANDARD.length - 1}
            step={1}
            disabled={state.isRunning}
            className={state.lossRate === 0 ? 'opacity-50' : ''}
          />
        </div>
      </div>
    </div>
  );
}

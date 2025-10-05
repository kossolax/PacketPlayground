import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  TIME_SCALE_VALUES,
  mapSliderToArray,
  mapArrayToSlider,
  formatTimeScale,
} from '@/lib/ui-helpers';

import { RouterSim, RouterState } from '../lib/router-sim';

interface RouterControlsProps {
  state: RouterState;
  simulation: RouterSim | null;
}

export default function RouterControls({
  state,
  simulation,
}: RouterControlsProps) {
  const handleStart = useCallback(() => {
    simulation?.start();
  }, [simulation]);

  const handleReset = useCallback(() => {
    simulation?.reset();
  }, [simulation]);

  const handleInputRateChange = useCallback(
    (rate: number) => {
      simulation?.setInputRate(rate);
    },
    [simulation]
  );

  const handleOutputRateChange = useCallback(
    (rate: number) => {
      simulation?.setOutputRate(rate);
    },
    [simulation]
  );

  const handleSwitchingFabricSpeedChange = useCallback(
    (speed: number) => {
      simulation?.setSwitchingFabricSpeed(speed);
    },
    [simulation]
  );

  const handleInputQueueSizeChange = useCallback(
    (size: number) => {
      simulation?.setInputQueueSize(size);
    },
    [simulation]
  );

  const handleOutputQueueSizeChange = useCallback(
    (size: number) => {
      simulation?.setOutputQueueSize(size);
    },
    [simulation]
  );

  const handleTimeScaleChange = useCallback(
    (scale: number) => {
      simulation?.setTimeScale(scale);
    },
    [simulation]
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Button onClick={handleStart} disabled={state.isRunning}>
          Start
        </Button>
        <Button onClick={handleReset} variant="outline">
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">Input Rate: {state.inputRate} pkt/s</Label>
          <Slider
            value={[state.inputRate]}
            onValueChange={(v) => handleInputRateChange(v[0])}
            min={0}
            max={20}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Switching Fabric: {state.switchingFabricSpeed} pkt/s
          </Label>
          <Slider
            value={[state.switchingFabricSpeed]}
            onValueChange={(v) => handleSwitchingFabricSpeedChange(v[0])}
            min={0}
            max={30}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Output Rate: {state.outputRate} pkt/s
          </Label>
          <Slider
            value={[state.outputRate]}
            onValueChange={(v) => handleOutputRateChange(v[0])}
            min={0}
            max={20}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Input Queue Size: {state.inputQueueSize}
          </Label>
          <Slider
            value={[state.inputQueueSize]}
            onValueChange={(v) => handleInputQueueSizeChange(v[0])}
            min={1}
            max={10}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Time Scale: {formatTimeScale(state.timeScale)}
          </Label>
          <Slider
            value={[mapArrayToSlider(TIME_SCALE_VALUES, state.timeScale)]}
            onValueChange={(v) =>
              handleTimeScaleChange(mapSliderToArray(TIME_SCALE_VALUES, v[0]))
            }
            min={0}
            max={6}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Output Queue Size: {state.outputQueueSize}
          </Label>
          <Slider
            value={[state.outputQueueSize]}
            onValueChange={(v) => handleOutputQueueSizeChange(v[0])}
            min={1}
            max={10}
            step={1}
            disabled={state.isRunning}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-blue-600">Input Queue</div>
          <div className="font-mono text-lg">
            {state.inputQueue.length}/{state.inputQueueSize}
          </div>
          <div className="text-muted-foreground text-xs">
            Packets waiting to be processed
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-yellow-600">Switching Fabric</div>
          <div className="font-mono text-lg">
            {state.switchingFabricSpeed} pkt/s
          </div>
          <div className="text-muted-foreground text-xs">Processing speed</div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-green-600">Output Queue</div>
          <div className="font-mono text-lg">
            {state.outputQueue.length}/{state.outputQueueSize}
          </div>
          <div className="text-muted-foreground text-xs">
            Packets waiting to be transmitted
          </div>
        </div>
      </div>
    </div>
  );
}

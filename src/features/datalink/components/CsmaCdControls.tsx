import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  BANDWIDTH_VALUES_STANDARD,
  PACKET_SIZE_VALUES_STANDARD,
  mapSliderToArray,
  mapArrayToSlider,
  formatBandwidth,
  formatPacketSize,
} from '@/lib/ui-helpers';

import { CsmaCdSim, CsmaCdState } from '../lib/csmacd-sim';

interface Props {
  state: CsmaCdState;
  simulation: CsmaCdSim | null;
}

export default function CsmaCdControls({ state, simulation }: Props) {
  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <Button onClick={handleStart} disabled={state.isRunning}>
          Start
        </Button>
        <Button onClick={handleReset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Reset
        </Button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            {simulation?.getFormattedElapsedTime() ?? '0.0s'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">
            Bandwidth: {formatBandwidth(state.bandwidth)}bps
          </Label>
          <Slider
            value={[
              mapArrayToSlider(BANDWIDTH_VALUES_STANDARD, state.bandwidth),
            ]}
            onValueChange={(v) =>
              simulation?.setBandwidth(
                mapSliderToArray(BANDWIDTH_VALUES_STANDARD, v[0])
              )
            }
            min={0}
            max={BANDWIDTH_VALUES_STANDARD.length - 1}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Packet: {formatPacketSize(state.packetSize)}
          </Label>
          <Slider
            value={[
              mapArrayToSlider(PACKET_SIZE_VALUES_STANDARD, state.packetSize),
            ]}
            onValueChange={(v) =>
              simulation?.setPacketSize(
                mapSliderToArray(PACKET_SIZE_VALUES_STANDARD, v[0])
              )
            }
            min={0}
            max={PACKET_SIZE_VALUES_STANDARD.length - 1}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Distance: {state.distance}km</Label>
          <Slider
            value={[state.distance]}
            onValueChange={(v) => simulation?.setDistance(v[0])}
            min={100}
            max={10_000}
            step={100}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Time Scale: {state.timeScale.toFixed(0)}x slower
          </Label>
          <Slider
            value={[state.timeScale]}
            onValueChange={(v) => simulation?.setTimeScale(v[0])}
            min={250}
            max={2500}
            step={250}
            disabled={false}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-blue-600">Transmission Delay</div>
          <div className="font-mono text-lg">
            {state.transmissionDelay.toFixed(1)}ms
          </div>
          <div className="text-muted-foreground text-xs">
            Time to push all bits onto link
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-green-600">Propagation Delay</div>
          <div className="font-mono text-lg">
            {state.propagationDelay.toFixed(1)}ms
          </div>
          <div className="text-muted-foreground text-xs">
            Time for signal to travel the distance
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-purple-600">
            Detection Window ≈ 2·Tp
          </div>
          <div className="font-mono text-lg">{state.slotTime.toFixed(1)}ms</div>
          <div className="text-muted-foreground text-xs">
            Minimal collision detection window
          </div>
        </div>
      </div>
    </div>
  );
}

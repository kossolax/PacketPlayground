import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  TIME_SCALE_VALUES,
  mapSliderToArray,
  mapArrayToSlider,
  formatTimeScale,
} from '@/lib/ui-helpers';

import { FragmentationSim, FragmentationState } from '../lib/fragmentation-sim';

// Time scale values: /10, /5, /2, 1, *2, *5, *10

interface FragmentationControlsProps {
  state: FragmentationState;
  simulation: FragmentationSim | null;
}

export default function FragmentationControls({
  state,
  simulation,
}: FragmentationControlsProps) {
  const handleStart = useCallback(() => {
    simulation?.start();
  }, [simulation]);

  const handleReset = useCallback(() => {
    simulation?.reset();
  }, [simulation]);

  const handleIpVersionChange = useCallback(
    (checked: boolean) => {
      simulation?.setIpVersion(checked ? 6 : 4);
    },
    [simulation]
  );

  const handlePacketSizeChange = useCallback(
    (size: number) => {
      simulation?.setPacketSize(size);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">IP Version</Label>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs ${state.ipVersion === 4 ? 'font-medium' : 'text-muted-foreground'}`}
              >
                IPv4
              </span>
              <Switch
                checked={state.ipVersion === 6}
                onCheckedChange={handleIpVersionChange}
                disabled={state.isRunning}
              />
              <span
                className={`text-xs ${state.ipVersion === 6 ? 'font-medium' : 'text-muted-foreground'}`}
              >
                IPv6
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {state.ipVersion === 4
              ? 'Fragments at each router when MTU exceeded'
              : 'Path MTU Discovery, source fragments only'}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Packet Size: {state.packetSize} bytes
          </Label>
          <Slider
            value={[state.packetSize]}
            onValueChange={(v) => handlePacketSizeChange(v[0])}
            min={500}
            max={9000}
            step={100}
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
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2 text-sm">
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-blue-600">Total Fragments</div>
          <div className="font-mono text-lg">{state.totalFragments}</div>
          <div className="text-muted-foreground text-xs">
            Number of fragments created
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-orange-600">Overhead</div>
          <div className="font-mono text-lg">
            {state.ipVersion === 4 ? state.ipv4Overhead : state.ipv6Overhead}{' '}
            bytes
          </div>
          <div className="text-muted-foreground text-xs">
            Extra bytes for fragmentation
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-green-600">Packets Sent</div>
          <div className="font-mono text-lg">{state.packetsGenerated}</div>
          <div className="text-muted-foreground text-xs">
            Original packets transmitted
          </div>
        </div>
      </div>
    </div>
  );
}

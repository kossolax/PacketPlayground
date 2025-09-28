import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { CsmaCdSim, CsmaCdState } from '../lib/csmacd-sim';

interface Props {
  state: CsmaCdState;
  simulation: CsmaCdSim | null;
}

const BANDWIDTH_VALUES = [
  64_000, 128_000, 256_000, 512_000, 1_000_000, 2_000_000, 5_000_000,
  10_000_000, 100_000_000, 1_000_000_000,
];

const PACKET_SIZE_VALUES = [
  1_000, 8_000, 12_000, 40_000, 80_000, 400_000, 800_000, 4_000_000, 8_000_000,
];

function mapSliderTo(values: number[], idx: number): number {
  return values[idx] ?? values[0];
}
function mapToSlider(values: number[], value: number): number {
  const i = values.findIndex((v) => v >= value);
  return i === -1 ? values.length - 1 : i;
}
function fmtBandwidth(bps: number): string {
  if (bps >= 1_000_000_000) return `${bps / 1_000_000_000}G`;
  if (bps >= 1_000_000) return `${bps / 1_000_000}M`;
  if (bps >= 1_000) return `${bps / 1_000}K`;
  return `${bps}`;
}
function fmtPacket(bits: number): string {
  const bytes = bits / 8;
  if (bytes >= 1_000_000) return `${bytes / 1_000_000}M`;
  if (bytes >= 1_000) return `${bytes / 1_000}K`;
  return `${bytes}B`;
}

export default function CsmaCdControls({ state, simulation }: Props) {
  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);

  const handleManualTransmission = useCallback(
    (stationId: number) => {
      simulation?.triggerManualTransmission(stationId);
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
            Bandwidth: {fmtBandwidth(state.bandwidth)}bps
          </Label>
          <Slider
            value={[mapToSlider(BANDWIDTH_VALUES, state.bandwidth)]}
            onValueChange={(v) =>
              simulation?.setBandwidth(mapSliderTo(BANDWIDTH_VALUES, v[0]))
            }
            min={0}
            max={BANDWIDTH_VALUES.length - 1}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Packet: {fmtPacket(state.packetSize)}
          </Label>
          <Slider
            value={[mapToSlider(PACKET_SIZE_VALUES, state.packetSize)]}
            onValueChange={(v) =>
              simulation?.setPacketSize(mapSliderTo(PACKET_SIZE_VALUES, v[0]))
            }
            min={0}
            max={PACKET_SIZE_VALUES.length - 1}
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

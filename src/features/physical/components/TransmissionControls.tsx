import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

import { TransmissionSim, TransmissionState } from '../lib/transmission-sim';

interface TransmissionControlsProps {
  state: TransmissionState;
  simulation: TransmissionSim | null;
}

// Pre-defined bandwidth values for better UX
const BANDWIDTH_VALUES = [
  64000, // 64 Kbps
  128000, // 128 Kbps
  256000, // 256 Kbps
  512000, // 512 Kbps
  1000000, // 1 Mbps
  2000000, // 2 Mbps
  5000000, // 5 Mbps
  10000000, // 10 Mbps
  100000000, // 100 Mbps
  1000000000, // 1 Gbps
];

const PACKET_SIZE_VALUES = [
  1000, // 125 bytes
  8000, // 1 KB
  12000, // 1.5 KB
  40000, // 5 KB
  80000, // 10 KB
  400000, // 50 KB
  800000, // 100 KB
  4000000, // 500 KB
  8000000, // 1 MB
];

function mapSliderToBandwidth(sliderValue: number): number {
  return BANDWIDTH_VALUES[sliderValue] || BANDWIDTH_VALUES[0];
}

function mapBandwidthToSlider(bandwidth: number): number {
  const index = BANDWIDTH_VALUES.findIndex((val) => val >= bandwidth);
  return index === -1 ? BANDWIDTH_VALUES.length - 1 : index;
}

function mapSliderToPacketSize(sliderValue: number): number {
  return PACKET_SIZE_VALUES[sliderValue] || PACKET_SIZE_VALUES[0];
}

function mapPacketSizeToSlider(packetSize: number): number {
  const index = PACKET_SIZE_VALUES.findIndex((val) => val >= packetSize);
  return index === -1 ? PACKET_SIZE_VALUES.length - 1 : index;
}

function formatBandwidth(bps: number): string {
  if (bps >= 1000000000) return `${bps / 1000000000}G`;
  if (bps >= 1000000) return `${bps / 1000000}M`;
  if (bps >= 1000) return `${bps / 1000}K`;
  return `${bps}`;
}

function formatPacketSize(bits: number): string {
  const bytes = bits / 8;
  if (bytes >= 1000000) return `${bytes / 1000000}M`;
  if (bytes >= 1000) return `${bytes / 1000}K`;
  return `${bytes}B`;
}

export default function TransmissionControls({
  state,
  simulation,
}: TransmissionControlsProps) {
  const handleStart = useCallback(() => {
    simulation?.start();
  }, [simulation]);

  const handleReset = useCallback(() => {
    simulation?.reset();
  }, [simulation]);

  const handleBandwidthChange = useCallback(
    (bps: number) => {
      simulation?.setBandwidth(bps);
    },
    [simulation]
  );

  const handlePacketSizeChange = useCallback(
    (bits: number) => {
      simulation?.setPacketSize(bits);
    },
    [simulation]
  );

  const handleDistanceChange = useCallback(
    (km: number) => {
      simulation?.setDistance(km);
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">
            Bandwidth: {formatBandwidth(state.bandwidth)}bps
          </Label>
          <Slider
            value={[mapBandwidthToSlider(state.bandwidth)]}
            onValueChange={(v) =>
              handleBandwidthChange(mapSliderToBandwidth(v[0]))
            }
            min={0}
            max={BANDWIDTH_VALUES.length - 1}
            step={1}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Packet: {formatPacketSize(state.packetSize)}
          </Label>
          <Slider
            value={[mapPacketSizeToSlider(state.packetSize)]}
            onValueChange={(v) =>
              handlePacketSizeChange(mapSliderToPacketSize(v[0]))
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
            onValueChange={(v) => handleDistanceChange(v[0])}
            min={100}
            max={10000}
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
            onValueChange={(v) => handleTimeScaleChange(v[0])}
            min={1}
            max={500}
            step={10}
            disabled={state.isRunning}
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
          <div className="font-medium text-purple-600">Propagation Speed</div>
          <div className="font-mono text-lg">
            {(state.propagationSpeed / 1000).toFixed(0)}k km/s
          </div>
          <div className="text-muted-foreground text-xs">
            2/3 speed of light
          </div>
        </div>
      </div>
    </div>
  );
}

import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  CastingSim,
  CastingSimulationState,
  CastPacketType,
} from '../lib/casting-sim';

interface Props {
  state: CastingSimulationState;
  simulation: CastingSim | null;
}

export default function CastingControls({ state, simulation }: Props) {
  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);

  const handleTypeChange = useCallback(
    (value: CastPacketType) => {
      simulation?.setSelectedType(value);
    },
    [simulation]
  );

  const handleToggleMulticastMember = useCallback(
    (pcId: string) => {
      simulation?.toggleMulticastMember(pcId);
    },
    [simulation]
  );

  // Get all PC nodes (exclude source and switches)
  const allPCs = state.nodes.filter((n) => n.type === 'pc' && n.id !== 'pc0');

  return (
    <div className="space-y-4">
      {/* Start/Reset Controls */}
      <div className="flex gap-3 items-center flex-wrap">
        <Button onClick={handleStart} disabled={state.isRunning}>
          Start Simulation
        </Button>
        <Button onClick={handleReset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Reset
        </Button>

        <Select
          value={state.selectedType}
          onValueChange={handleTypeChange}
          disabled={state.isRunning}
        >
          <SelectTrigger id="cast-type" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unicast">Unicast (1 random PC)</SelectItem>
            <SelectItem value="broadcast">Broadcast (all PCs)</SelectItem>
            <SelectItem value="multicast">Multicast (selected PCs)</SelectItem>
            <SelectItem value="anycast">Anycast (closest PC)</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            {simulation?.getFormattedElapsedTime() ?? '0.0s'}
          </span>
        </div>
      </div>

      {/* Multicast Group Selection (only visible when multicast is selected) */}
      {state.selectedType === 'multicast' && (
        <div className="rounded-md border p-4 space-y-2">
          <Label>Multicast Group (select PCs to receive)</Label>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {allPCs.map((pc) => (
              <div key={pc.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`multicast-${pc.id}`}
                  checked={state.multicastGroup[pc.id] === true}
                  onCheckedChange={() =>
                    handleToggleMulticastMember(String(pc.id))
                  }
                  disabled={state.isRunning}
                />
                <label
                  htmlFor={`multicast-${pc.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {pc.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Sliders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">
            Animation Speed: {state.timeScale.toFixed(1)}x
          </Label>
          <Slider
            value={[state.timeScale]}
            onValueChange={(v) => simulation?.setTimeScale(v[0])}
            min={0.5}
            max={3}
            step={0.5}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Send Interval: {state.sendInterval}ms
          </Label>
          <Slider
            value={[state.sendInterval]}
            onValueChange={(v) => simulation?.setSendInterval(v[0])}
            min={1000}
            max={5000}
            step={500}
            disabled={state.isRunning}
          />
        </div>
      </div>
    </div>
  );
}

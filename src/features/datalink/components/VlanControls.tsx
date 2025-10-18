import { Clock, RefreshCw, Send } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

import { TrunkMode, VlanSim, VlanState } from '../lib/vlan-sim';

interface Props {
  state: VlanState;
  simulation: VlanSim | null;
}

export default function VlanControls({ state, simulation }: Props) {
  const [sourcePC, setSourcePC] = useState<string>('pc1');
  const [destPC, setDestPC] = useState<string>('pc5');

  const handleStart = useCallback(
    () => simulation?.start(sourcePC, destPC),
    [simulation, sourcePC, destPC]
  );
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);
  const handleSendPacket = useCallback(
    () => simulation?.sendPacket(sourcePC, destPC),
    [simulation, sourcePC, destPC]
  );
  const handleTrunkModeChange = useCallback(
    (value: TrunkMode) => simulation?.setTrunkMode(value),
    [simulation]
  );

  // Get all PC devices
  const pcDevices = state.devices.filter((d) => d.type === 'pc');

  // Get VLAN info for source and dest
  const sourceDevice = pcDevices.find((d) => d.id === sourcePC);
  const destDevice = pcDevices.find((d) => d.id === destPC);
  const sameVlan = sourceDevice?.vlanId === destDevice?.vlanId;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <Button onClick={handleStart} disabled={state.isRunning}>
          Start
        </Button>
        <Button onClick={handleReset} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Reset
        </Button>

        <div className="flex gap-2 items-center">
          <Select value={sourcePC} onValueChange={setSourcePC}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>VLAN 10</SelectLabel>
                {pcDevices
                  .filter((pc) => pc.vlanId === 10)
                  .map((pc) => (
                    <SelectItem key={pc.id} value={String(pc.id)}>
                      {pc.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>VLAN 20</SelectLabel>
                {pcDevices
                  .filter((pc) => pc.vlanId === 20)
                  .map((pc) => (
                    <SelectItem key={pc.id} value={String(pc.id)}>
                      {pc.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <span className="text-muted-foreground">→</span>

          <Select value={destPC} onValueChange={setDestPC}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>VLAN 10</SelectLabel>
                {pcDevices
                  .filter((pc) => pc.vlanId === 10)
                  .map((pc) => (
                    <SelectItem key={pc.id} value={String(pc.id)}>
                      {pc.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>VLAN 20</SelectLabel>
                {pcDevices
                  .filter((pc) => pc.vlanId === 20)
                  .map((pc) => (
                    <SelectItem key={pc.id} value={String(pc.id)}>
                      {pc.label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button
            onClick={handleSendPacket}
            variant="secondary"
            disabled={!state.isRunning}
          >
            <Send className="mr-2 h-4 w-4" /> Send
          </Button>

          {!sameVlan && (
            <span className="text-xs text-orange-600 font-medium">
              ⚠ Different VLANs (will be blocked)
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            {simulation?.getFormattedElapsedTime() ?? '0.0s'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex gap-3 items-center">
          <Label htmlFor="trunk-mode" className="text-sm whitespace-nowrap">
            Inter-Switch:
          </Label>
          <Select
            value={state.trunkMode}
            onValueChange={handleTrunkModeChange}
            disabled={state.isRunning}
          >
            <SelectTrigger id="trunk-mode" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trunk">Trunk (802.1Q)</SelectItem>
              <SelectItem value="vlan10">Access VLAN 10</SelectItem>
              <SelectItem value="vlan20">Access VLAN 20</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Time Scale: {state.timeScale.toFixed(0)}x faster
          </Label>
          <Slider
            value={[state.timeScale]}
            onValueChange={(v) => simulation?.setTimeScale(v[0])}
            min={1}
            max={10}
            step={1}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
}

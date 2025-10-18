import { Clock, RefreshCw, Send } from 'lucide-react';
import { useCallback, useState } from 'react';

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
  SwitchLearningSim,
  SwitchLearningState,
} from '../lib/switch-learning-sim';

interface Props {
  state: SwitchLearningState;
  simulation: SwitchLearningSim | null;
}

export default function SwitchLearningControls({ state, simulation }: Props) {
  const [sourcePC, setSourcePC] = useState<string>('pc1');
  const [destPC, setDestPC] = useState<string>('pc3');

  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);
  const handleSendPacket = useCallback(
    () => simulation?.sendPacket(sourcePC, destPC, 0),
    [simulation, sourcePC, destPC]
  );

  // Get all PC devices
  const pcDevices = state.devices.filter((d) => d.type === 'pc');

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
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pcDevices.map((pc) => (
                <SelectItem key={pc.id} value={String(pc.id)}>
                  {pc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-muted-foreground">→</span>

          <Select value={destPC} onValueChange={setDestPC}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pcDevices.map((pc) => (
                <SelectItem key={pc.id} value={String(pc.id)}>
                  {pc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleSendPacket}
            variant="secondary"
            disabled={!state.isRunning}
          >
            <Send className="mr-2 h-4 w-4" /> Send
          </Button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span className="font-mono">
            {simulation?.getFormattedElapsedTime() ?? '0.0s'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">
            Aging Timeout: {state.agingTimeoutSec}s
          </Label>
          <Slider
            value={[state.agingTimeoutSec]}
            onValueChange={(v) => simulation?.setAgingTimeout(v[0])}
            min={10}
            max={120}
            step={10}
            disabled={state.isRunning}
          />
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

      <div className="grid grid-cols-4 gap-4 pt-2 text-sm">
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-blue-600">Total Packets</div>
          <div className="font-mono text-lg">{state.totalPackets}</div>
          <div className="text-muted-foreground text-xs">Packets sent</div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-yellow-600">Flooded</div>
          <div className="font-mono text-lg">{state.floodedPackets}</div>
          <div className="text-muted-foreground text-xs">
            Unknown destination
          </div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-green-600">Forwarded</div>
          <div className="font-mono text-lg">{state.forwardedPackets}</div>
          <div className="text-muted-foreground text-xs">Known destination</div>
        </div>
        <div className="bg-muted p-3 rounded-lg">
          <div className="font-medium text-purple-600">CAM Table Size</div>
          <div className="font-mono text-lg">
            {simulation?.getTotalCamSize() ?? 0}
          </div>
          <div className="text-muted-foreground text-xs">Total entries</div>
        </div>
      </div>
    </div>
  );
}

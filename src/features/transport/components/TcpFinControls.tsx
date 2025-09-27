import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import type { TcpFinSim, TcpFinState } from '../lib/tcpfin';

interface TcpFinControlsProps {
  state: TcpFinState;
  simulation: TcpFinSim | null;
}

export default function TcpFinControls({
  state,
  simulation,
}: TcpFinControlsProps) {
  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);

  const handleSpeed = useCallback(
    (ms: number) => simulation?.setSpeed(ms),
    [simulation]
  );
  const handleTimeWait = useCallback(
    (ms: number) => simulation?.setTimeWaitDuration(ms),
    [simulation]
  );
  const handleVariantToggle = useCallback(
    (clientFirst: boolean) =>
      simulation?.setVariant(
        clientFirst ? 'client_closes_first' : 'server_closes_first'
      ),
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
        <div className="space-y-1">
          <Label className="text-sm">Speed: {state.speed / 1000}s</Label>
          <Slider
            value={[state.speed]}
            onValueChange={(v) => handleSpeed(v[0])}
            min={1000}
            max={3000}
            step={500}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-sm">
            Time-Wait: {state.timeWaitDuration / 1000}s
          </Label>
          <Slider
            value={[state.timeWaitDuration]}
            onValueChange={(v) => handleTimeWait(v[0])}
            min={3000}
            max={7000}
            step={1000}
            disabled={state.isRunning}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={state.variant === 'client_closes_first'}
              onCheckedChange={handleVariantToggle}
              disabled={state.isRunning}
            />
            <Label className="text-sm">Client closes first</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Toggle to switch who initiates closure (client/server)
          </p>
        </div>
      </div>
    </div>
  );
}

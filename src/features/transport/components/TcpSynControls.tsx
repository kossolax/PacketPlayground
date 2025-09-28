import { Clock, RefreshCw } from 'lucide-react';
import { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

import type { TcpSynSim, TcpSynStateInterface } from '../lib/tcpsyn';

interface TcpSynControlsProps {
  state: TcpSynStateInterface;
  simulation: TcpSynSim | null;
}

export default function TcpSynControls({
  state,
  simulation,
}: TcpSynControlsProps) {
  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);

  const handleSpeed = useCallback(
    (ms: number) => simulation?.setSpeed(ms),
    [simulation]
  );
  const handleFirewallToggle = useCallback(
    (enabled: boolean) => {
      if (!simulation) return;
      simulation.setWithFirewall(enabled);
      simulation.reset();
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
          <div className="flex items-center gap-2">
            <Switch
              checked={state.withFirewall}
              onCheckedChange={handleFirewallToggle}
              disabled={state.isRunning}
            />
            <Label className="text-sm">Enable SYN firewall</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

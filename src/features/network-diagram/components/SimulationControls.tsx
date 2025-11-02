/**
 * Simulation Controls Component
 * Controls for network simulation speed and displays current simulation time
 */

import {
  Activity,
  Clock,
  FastForward,
  Pause,
  Play,
  PlayCircle,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSimulation } from '../hooks/useSimulation';
import { SchedulerState } from '../lib/scheduler/scheduler';

interface SimulationControlsProps {
  isPingMode?: boolean;
  onPingSelect?: () => void;
}

export default function SimulationControls({
  isPingMode = false,
  onPingSelect,
}: SimulationControlsProps) {
  const { speed, setSpeed, time, speedOfLight, transmission } = useSimulation();

  const speedButtons = [
    {
      state: SchedulerState.PAUSED,
      icon: Pause,
      label: 'Pause',
      title: 'Pause simulation',
    },
    {
      state: SchedulerState.SLOWER,
      icon: Play,
      label: 'Slow',
      title: 'Slow simulation (1/1,000,000x)',
    },
    {
      state: SchedulerState.REAL_TIME,
      icon: PlayCircle,
      label: 'Real-time',
      title: 'Real-time simulation (1x)',
    },
    {
      state: SchedulerState.FASTER,
      icon: FastForward,
      label: 'Fast',
      title: 'Fast simulation (100,000x)',
    },
  ];

  return (
    <div className="h-12 bg-muted/50 border-b border-border flex items-center px-4 gap-4">
      {/* Speed Control Buttons */}
      <div className="flex items-center gap-2">
        {speedButtons.map(({ state, icon: Icon, label, title }) => (
          <Button
            key={state}
            variant={speed === state ? 'default' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={() => setSpeed(state)}
            title={title}
          >
            <Icon className="size-4" />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Simulation Time Display */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <Clock className="size-4 text-muted-foreground" />
        <span className="font-mono text-sm font-medium">{time}</span>
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Speed Multipliers */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5 font-normal">
          <Clock className="size-3" />
          <span className="text-xs">
            {speedOfLight === 0 ? '0' : `${speedOfLight}`}
          </span>
        </Badge>
        <Badge variant="outline" className="gap-1.5 font-normal">
          <Zap className="size-3" />
          <span className="text-xs">
            {transmission === 0 ? '0' : `${transmission}`}
          </span>
        </Badge>
      </div>

      {onPingSelect && (
        <>
          <Separator orientation="vertical" className="h-8" />

          {/* Ping Button */}
          <Button
            variant={isPingMode ? 'default' : 'ghost'}
            size="sm"
            className="gap-2"
            onClick={onPingSelect}
            title="Send ICMP ping between two devices"
          >
            <Activity className="size-4" />
            <span className="text-xs">Ping</span>
          </Button>
        </>
      )}
    </div>
  );
}

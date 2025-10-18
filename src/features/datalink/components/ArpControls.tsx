import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Send,
  Shield,
  Wifi,
} from 'lucide-react';
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

import { ArpSim, ArpSimulationState } from '../lib/arp-sim';

interface Props {
  state: ArpSimulationState;
  simulation: ArpSim | null;
}

export default function ArpControls({ state, simulation }: Props) {
  const [sourcePC, setSourcePC] = useState<string>('pc1');
  const [targetIP, setTargetIP] = useState<string>('192.168.1.3');
  const [attackerPC, setAttackerPC] = useState<string>('pc2');
  const [victimPC, setVictimPC] = useState<string>('pc1');
  const [spoofedIP, setSpoofedIP] = useState<string>('192.168.1.3');

  const handleStart = useCallback(() => simulation?.start(), [simulation]);
  const handleReset = useCallback(() => simulation?.reset(), [simulation]);

  const handleSendArpRequest = useCallback(() => {
    simulation?.sendArpRequest(sourcePC, targetIP, 0);
  }, [simulation, sourcePC, targetIP]);

  const handleSendGratuitousArp = useCallback(() => {
    simulation?.sendGratuitousArp(sourcePC, 0);
  }, [simulation, sourcePC]);

  const handleSendPoisonedArp = useCallback(() => {
    simulation?.sendPoisonedArp(attackerPC, victimPC, spoofedIP);
  }, [simulation, attackerPC, victimPC, spoofedIP]);

  // Get all PC devices
  const pcDevices = state.devices.filter((d) => d.type === 'pc');

  // Get all available IPs
  const availableIPs = pcDevices.filter((d) => d.ip).map((d) => d.ip as string);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
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

      {/* ARP Request & Gratuitous ARP Controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* ARP Request */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="font-medium text-sm flex items-center gap-2">
            <Send className="h-4 w-4" />
            ARP Request
          </div>
          <div className="flex gap-2 items-center flex-wrap">
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

            <span className="text-muted-foreground text-sm">looking for</span>

            <Select value={targetIP} onValueChange={setTargetIP}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableIPs.map((ip) => (
                  <SelectItem key={ip} value={ip}>
                    {ip}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSendArpRequest}
              variant="secondary"
              disabled={!state.isRunning}
              size="sm"
            >
              <Send className="mr-2 h-3 w-3" /> Send Request
            </Button>
          </div>
        </div>

        {/* Gratuitous ARP */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="font-medium text-sm flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Gratuitous ARP
          </div>
          <div className="flex gap-2 items-center flex-wrap">
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

            <span className="text-muted-foreground text-sm">
              announces its IP
            </span>

            <Button
              onClick={handleSendGratuitousArp}
              variant="secondary"
              disabled={!state.isRunning}
              size="sm"
            >
              <Wifi className="mr-2 h-3 w-3" /> Send Gratuitous
            </Button>
          </div>
        </div>
      </div>

      {/* ARP Poisoning Controls */}
      <div className="rounded-md border border-orange-300 bg-orange-50 p-3 space-y-3">
        <div className="font-medium text-sm flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          ARP Poisoning Attack
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={attackerPC} onValueChange={setAttackerPC}>
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

          <span className="text-muted-foreground text-sm">poisons</span>

          <Select value={victimPC} onValueChange={setVictimPC}>
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

          <span className="text-muted-foreground text-sm">with fake IP</span>

          <Select value={spoofedIP} onValueChange={setSpoofedIP}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableIPs.map((ip) => (
                <SelectItem key={ip} value={ip}>
                  {ip}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleSendPoisonedArp}
            variant="destructive"
            disabled={!state.isRunning}
            size="sm"
          >
            <Shield className="mr-2 h-3 w-3" /> Poison
          </Button>
        </div>
      </div>

      {/* Configuration Sliders */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm">
            Cache Timeout: {state.cacheTimeoutSec}s
          </Label>
          <Slider
            value={[state.cacheTimeoutSec]}
            onValueChange={(v) => simulation?.setCacheTimeout(v[0])}
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
    </div>
  );
}

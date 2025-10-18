import { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import ArpControls from './components/ArpControls';
import ArpVisualization from './components/ArpVisualization';
import {
  ArpSim,
  ArpSimulationState,
  createInitialArpState,
} from './lib/arp-sim';

export default function ArpSimulation() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Data Link', 'ARP');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<ArpSimulationState>(() =>
    createInitialArpState()
  );

  const simRef = useRef<ArpSim | null>(null);
  if (!simRef.current) {
    simRef.current = new ArpSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  return (
    <Card>
      <CardHeader>
        <ArpControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <ArpVisualization state={vm} />
      </CardContent>
    </Card>
  );
}

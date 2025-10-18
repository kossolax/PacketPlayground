import { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import VlanControls from './components/VlanControls';
import VlanVisualization from './components/VlanVisualization';
import { createInitialVlanState, VlanSim, VlanState } from './lib/vlan-sim';

export default function VlanSimulation() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Data Link', 'VLAN & Trunk');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<VlanState>(() => createInitialVlanState());

  const simRef = useRef<VlanSim | null>(null);
  if (!simRef.current) {
    simRef.current = new VlanSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  return (
    <Card>
      <CardHeader>
        <VlanControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <VlanVisualization state={vm} />
      </CardContent>
    </Card>
  );
}

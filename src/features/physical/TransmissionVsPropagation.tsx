import { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import TransmissionControls from './components/TransmissionControls';
import TransmissionVisualization from './components/TransmissionVisualization';
import {
  TransmissionSim,
  TransmissionState,
  createInitialTransmissionState,
} from './lib/transmission-sim';

export default function TransmissionVsPropagation() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Physical', 'Transmission delay');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<TransmissionState>(() =>
    createInitialTransmissionState()
  );

  const simRef = useRef<TransmissionSim | null>(null);
  if (!simRef.current) {
    simRef.current = new TransmissionSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  return (
    <Card>
      <CardHeader>
        <TransmissionControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <TransmissionVisualization state={vm} />
      </CardContent>
    </Card>
  );
}

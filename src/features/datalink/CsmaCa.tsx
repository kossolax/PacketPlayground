import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import CsmaCaControls from './components/CsmaCaControls';
import CsmaCaVisualization from './components/CsmaCaVisualization';
import {
  CsmaCaSim,
  CsmaCaState,
  createInitialCsmaCaState,
} from './lib/csmaca-sim';

export default function CsmaCa() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Data Link', 'CSMA/CA');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<CsmaCaState>(() => createInitialCsmaCaState());

  const simRef = useRef<CsmaCaSim | null>(null);
  if (!simRef.current) {
    simRef.current = new CsmaCaSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const legendItems: LegendItem[] = [
    { color: 'bg-green-100 border-green-400', label: 'RTS/CTS frames' },
    { color: 'bg-blue-100 border-blue-400', label: 'Data frame' },
    { color: 'bg-purple-100 border-purple-400', label: 'ACK frame' },
    { color: 'bg-yellow-100 border-yellow-400', label: 'Carrier sense (busy)' },
    { color: 'bg-red-100 border-red-500', label: 'Collision detected' },
  ];

  return (
    <Card>
      <CardHeader>
        <CsmaCaControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <CsmaCaVisualization state={vm} />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

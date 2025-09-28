import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import CsmaCdControls from './components/CsmaCdControls';
import CsmaCdVisualization from './components/CsmaCdVisualization';
import {
  CsmaCdSim,
  CsmaCdState,
  createInitialCsmaCdState,
} from './lib/csmacd-sim';

export default function CsmaCd() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Data Link', 'CSMA/CD');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<CsmaCdState>(() => createInitialCsmaCdState());

  const simRef = useRef<CsmaCdSim | null>(null);
  if (!simRef.current) {
    simRef.current = new CsmaCdSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const legendItems: LegendItem[] = [
    { color: 'bg-blue-100 border-blue-400', label: 'Data on the bus' },
    { color: 'bg-red-100 border-red-400', label: 'Collision/Jam' },
    { color: 'bg-yellow-100 border-yellow-400', label: 'Carrier sense' },
    { color: 'bg-purple-100 border-purple-400', label: '≈2·Tp listen window' },
  ];

  return (
    <Card>
      <CardHeader>
        <CsmaCdControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <CsmaCdVisualization state={vm} />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

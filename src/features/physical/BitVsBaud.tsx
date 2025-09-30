import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import BitBaudControls from './components/BitBaudControls';
import BitBaudVisualization from './components/BitBaudVisualization';
import {
  BitBaudSim,
  BitBaudState,
  createInitialBitBaudState,
} from './lib/bit-baud-sim';

export default function BitVsBaud() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Physical', 'Bit vs Baud');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<BitBaudState>(() => createInitialBitBaudState());

  const simRef = useRef<BitBaudSim | null>(null);
  if (!simRef.current) {
    simRef.current = new BitBaudSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const legendItems: LegendItem[] = [
    {
      color: 'bg-blue-100 border-blue-400',
      label: 'Transmitting',
    },
    {
      color: 'bg-gray-100 border-gray-400',
      label: 'Transmitted',
    },
    {
      color: 'bg-green-100 border-green-400',
      label: 'Ideal points',
    },
    {
      color: 'bg-blue-100 border-blue-400 opacity-60',
      label: 'Correct decode',
    },
    {
      color: 'bg-red-100 border-red-400 opacity-60',
      label: 'Error decode',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <BitBaudControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <BitBaudVisualization state={vm} />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

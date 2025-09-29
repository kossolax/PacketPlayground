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
      color: 'bg-blue-100 border-blue-300',
      label: 'Current bits/symbols being transmitted',
    },
    {
      color: 'bg-blue-500 border-blue-600',
      label: 'Received symbols with noise (constellation)',
    },
    {
      color: 'bg-red-100 border-red-300',
      label: 'Ideal constellation points (no noise)',
    },
    {
      color: 'bg-gray-300 border-gray-400',
      label: 'Already transmitted (current batch)',
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

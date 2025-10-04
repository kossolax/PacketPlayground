import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import FragmentationControls from './components/FragmentationControls';
import FragmentationVisualization from './components/FragmentationVisualization';
import {
  FragmentationSim,
  FragmentationState,
  createInitialFragmentationState,
} from './lib/fragmentation-sim';

export default function IpFragmentation() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Network', 'IP Fragmentation');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<FragmentationState>(() =>
    createInitialFragmentationState()
  );

  const simRef = useRef<FragmentationSim | null>(null);
  if (!simRef.current) {
    simRef.current = new FragmentationSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const legendItems: LegendItem[] = [
    {
      color: 'bg-orange-100 border-orange-300',
      label: 'Fragment overhead',
    },
    {
      color: 'bg-sky-100 border-sky-300',
      label: 'Data fragment',
    },
    {
      color: 'bg-indigo-100 border-indigo-300',
      label: 'Discovery probe',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <FragmentationControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <FragmentationVisualization state={vm} />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

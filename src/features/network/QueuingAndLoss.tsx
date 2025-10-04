import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import RouterControls from './components/RouterControls';
import RouterVisualization from './components/RouterVisualization';
import {
  RouterSim,
  RouterState,
  createInitialRouterState,
} from './lib/router-sim';

export default function QueuingAndLoss() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Network', 'Queuing and Loss');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<RouterState>(() => createInitialRouterState());

  const simRef = useRef<RouterSim | null>(null);
  if (!simRef.current) {
    simRef.current = new RouterSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const legendItems: LegendItem[] = [
    {
      color: 'bg-blue-100 border-blue-300',
      label: 'Input queue packets',
    },
    {
      color: 'bg-green-100 border-green-300',
      label: 'Output queue packets',
    },
    {
      color: 'bg-yellow-100 border-yellow-300',
      label: 'Switching fabric',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <RouterControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <RouterVisualization state={vm} />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

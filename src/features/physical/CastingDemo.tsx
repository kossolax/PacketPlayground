import { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import CastingControls from './components/CastingControls';
import CastingVisualization from './components/CastingVisualization';
import {
  CastingSim,
  CastingSimulationState,
  createInitialCastingState,
} from './lib/casting-sim';

export default function CastingDemo() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Physical', 'Cast Types');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<CastingSimulationState>(() =>
    createInitialCastingState()
  );

  const simRef = useRef<CastingSim | null>(null);
  if (!simRef.current) {
    simRef.current = new CastingSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  return (
    <Card>
      <CardHeader>
        <CastingControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <CastingVisualization state={vm} />
      </CardContent>
    </Card>
  );
}

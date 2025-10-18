import { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';

import SwitchLearningControls from './components/SwitchLearningControls';
import SwitchLearningVisualization from './components/SwitchLearningVisualization';
import {
  createInitialSwitchLearningState,
  SwitchLearningSim,
  SwitchLearningState,
} from './lib/switch-learning-sim';

export default function SwitchLearning() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Data Link', 'Switch Learning');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<SwitchLearningState>(() =>
    createInitialSwitchLearningState()
  );

  const simRef = useRef<SwitchLearningSim | null>(null);
  if (!simRef.current) {
    simRef.current = new SwitchLearningSim({ onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  return (
    <Card>
      <CardHeader>
        <SwitchLearningControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <SwitchLearningVisualization state={vm} />
      </CardContent>
    </Card>
  );
}

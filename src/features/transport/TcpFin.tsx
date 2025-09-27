import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import TcpFinControls from './components/TcpFinControls';
import TcpFinTimeline from './components/TcpFinTimeline';
import { TcpFinSim, TcpFinState, createInitialState } from './lib/tcpfin';

export default function TcpFin() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Transport', 'TCP FIN');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<TcpFinState>(() => createInitialState());
  const simRef = useRef<TcpFinSim | null>(null);
  if (!simRef.current) {
    simRef.current = new TcpFinSim({ onUpdate: setVm });
  }
  useEffect(() => () => simRef.current?.dispose(), []);

  const legendItems: LegendItem[] = [
    { color: 'bg-blue-100 border-blue-300', label: 'FIN' },
    { color: 'bg-green-100 border-green-300', label: 'FIN+ACK' },
    { color: 'bg-purple-100 border-purple-300', label: 'WAIT' },
  ];

  return (
    <Card>
      <CardHeader>
        <TcpFinControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <TcpFinTimeline state={vm} />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

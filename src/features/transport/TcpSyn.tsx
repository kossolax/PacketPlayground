import { useEffect, useMemo, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import { assignFlightsAndSegments } from '@/lib/draw';
import { useFlightGeometry } from '@/lib/use-flight-geometry';
import TcpSynControls from './components/TcpSynControls';
import Timeline from './components/Timeline';
import { stateColor } from './lib/tcp-state-style';
import {
  TcpSynSim,
  TcpSynStateInterface,
  createInitialSynState,
} from './lib/tcpsyn-sim';

type SynPacketType = 'SYN' | 'SYN_ACK' | 'ACK' | 'RST';

function segmentStrokeFor(t: SynPacketType): string {
  switch (t) {
    case 'SYN':
      return 'rgb(147, 197, 253)'; // blue-300
    case 'SYN_ACK':
      return 'rgb(134, 239, 172)'; // green-300
    case 'RST':
      return 'rgb(252, 165, 165)'; // red-300
    case 'ACK':
      return 'rgb(192, 132, 252)'; // purple-300
    default:
      return 'rgb(203, 213, 225)'; // fallback slate-300
  }
}

function chipStyleFor(t: SynPacketType): { bg: string; border: string } {
  switch (t) {
    case 'SYN':
      return { bg: 'bg-blue-100', border: 'border-blue-300' };
    case 'SYN_ACK':
      return { bg: 'bg-green-100', border: 'border-green-300' };
    case 'RST':
      return { bg: 'bg-red-100', border: 'border-red-300' };
    case 'ACK':
      return { bg: 'bg-purple-100', border: 'border-purple-300' };
    default:
      return { bg: 'bg-slate-100', border: 'border-slate-300' };
  }
}

export default function TcpSyn() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Transport', 'TCP SYN');
  }, [setBreadcrumbs]);

  const [vm, setVm] = useState<TcpSynStateInterface>(() =>
    createInitialSynState()
  );
  const simRef = useRef<TcpSynSim | null>(null);
  if (!simRef.current) {
    simRef.current = new TcpSynSim({ onUpdate: setVm });
  }
  useEffect(() => () => simRef.current?.dispose(), []);

  // Legend items
  const legendItems: LegendItem[] = [
    { color: 'bg-blue-100 border-blue-300', label: 'SYN' },
    { color: 'bg-green-100 border-green-300', label: 'SYN+ACK' },
    { color: 'bg-purple-100 border-purple-300', label: 'ACK' },
    { color: 'bg-red-100 border-red-300', label: 'RST' },
  ];

  // Layout constants (shared with presentational timeline)
  const layout = useMemo(
    () => ({
      height: 436,
      topOffset: 64,
      clientXPercent: 15,
      serverXPercent: 85,
    }),
    []
  );
  const layoutForRender = useMemo(
    () => (vm.withFirewall ? { ...layout, firewallXPercent: 50 } : layout),
    [layout, vm.withFirewall]
  );
  const envelopeHeight = 28;
  const segmentHeight = useMemo(
    () => (vm.withFirewall ? 45 : 90),
    [vm.withFirewall]
  );

  // Slight lift for the very first SYN row so envelope doesn't overlap lifeline top
  const firstRowLiftPx = 14;
  const startLiftFor = (seqNum: number, type: SynPacketType) =>
    seqNum === 0 && type === 'SYN' ? firstRowLiftPx : 0;

  // Build data for geometry; include firewall flows when enabled
  const sentPackets = useMemo(
    () =>
      vm.sentPackets
        .filter((p) =>
          vm.withFirewall ? true : p.from !== 'firewall' && p.to !== 'firewall'
        )
        .map((p) => ({
          seqNum: p.seqNum,
          type: p.type as SynPacketType,
          from: p.from as 'client' | 'server' | 'firewall',
          to: p.to as 'client' | 'server' | 'firewall',
        })),
    [vm.sentPackets, vm.withFirewall]
  );
  const flyingPackets = useMemo(
    () =>
      vm.flyingPackets
        .filter((p) =>
          vm.withFirewall ? true : p.from !== 'firewall' && p.to !== 'firewall'
        )
        .map((p) => ({
          animId: p.animId,
          type: p.type as SynPacketType,
          from: p.from as 'client' | 'server' | 'firewall',
          to: p.to as 'client' | 'server' | 'firewall',
          position: p.position,
          startTime: p.startTime,
        })),
    [vm.flyingPackets, vm.withFirewall]
  );

  // Compute geometry assignments
  const geometry = useMemo(
    () =>
      assignFlightsAndSegments<'SYN' | 'SYN_ACK' | 'ACK' | 'RST'>({
        sentPackets,
        flyingPackets,
        clientXPercent: layout.clientXPercent,
        serverXPercent: layout.serverXPercent,
        firewallXPercent: vm.withFirewall ? 50 : undefined,
        topOffset: layout.topOffset,
        segmentHeight,
        envelopeHeight,
        startLiftFor,
      }),
    [
      sentPackets,
      flyingPackets,
      layout.clientXPercent,
      layout.serverXPercent,
      vm.withFirewall,
      layout.topOffset,
      segmentHeight,
      envelopeHeight,
    ]
  );

  // Presentational segments VM
  const segmentsVM = useMemo(
    () =>
      geometry.segments.map((s) => ({
        key: `seg-${s.type}-${s.seqNum}-${s.x1}-${s.x2}-${s.y2}`,
        x1: s.x1,
        y1: s.y1,
        x2: s.x2,
        y2: s.y2,
        stroke: segmentStrokeFor(s.type),
      })),
    [geometry.segments]
  );

  const { trails: trailsVM, flying: flyingVM } = useFlightGeometry({
    packets: flyingPackets.map((p) => ({
      animId: p.animId,
      type: p.type,
      from: p.from,
      to: p.to,
      position: p.position,
    })),
    flightRowByAnimId: geometry.flightRowByAnimId,
    layout: {
      clientXPercent: layout.clientXPercent,
      serverXPercent: layout.serverXPercent,
      topOffset: layout.topOffset,
      segmentHeight,
      envelopeHeight,
      startLiftFor,
      firewallXPercent: vm.withFirewall ? 50 : undefined,
    },
    labelFor: (t: SynPacketType) => {
      const label = t === 'SYN_ACK' ? 'SYN+ACK' : t;
      const chip = chipStyleFor(t);
      return { label, bg: chip.bg, border: chip.border };
    },
    strokeFor: (t: SynPacketType) => segmentStrokeFor(t),
  });

  // Arrivals VM
  const arrivalsVM = useMemo(
    () =>
      geometry.arrivals.map((a) => ({
        key: `arr-${a.type}-${a.to}-${a.seqNum}-${a.x}-${a.y}`,
        xPercent: a.x,
        y: a.y,
        label: a.type === 'SYN_ACK' ? 'SYN+ACK' : a.type,
      })),
    [geometry.arrivals]
  );

  const clientChip = useMemo(
    () => ({ label: vm.clientState, className: stateColor(vm.clientState) }),
    [vm.clientState]
  );
  const serverChip = useMemo(
    () => ({ label: vm.serverState, className: stateColor(vm.serverState) }),
    [vm.serverState]
  );

  return (
    <Card>
      <CardHeader>
        <TcpSynControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <Timeline
          layout={layoutForRender}
          clientChip={clientChip}
          serverChip={serverChip}
          segments={segmentsVM}
          trails={trailsVM}
          flying={flyingVM}
          arrivals={arrivalsVM}
        />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

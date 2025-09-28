import { useEffect, useMemo, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import {
  assignFlightsAndSegments,
  interpolateFlightPosition,
  lifelineX,
  progress01,
  rowTopFor,
  trailingLineFor,
} from '@/lib/draw';
import { stateColor } from '@/lib/tcp-state-style';
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
  const envelopeHeight = 28;
  const segmentHeight = 90;

  // Start-lift policy: only first FIN row gets a slight lift at start
  const firstRowLiftPx = 14;
  const startLiftFor = (seqNum: number, type: 'FIN' | 'ACK' | 'FIN_ACK') =>
    seqNum === 0 && type === 'FIN' ? firstRowLiftPx : 0;

  // Compute geometry assignments
  const geometry = useMemo(
    () =>
      assignFlightsAndSegments({
        sentPackets: vm.sentPackets,
        flyingPackets: vm.flyingPackets,
        clientXPercent: layout.clientXPercent,
        serverXPercent: layout.serverXPercent,
        topOffset: layout.topOffset,
        segmentHeight,
        envelopeHeight,
        startLiftFor,
      }),
    [vm.sentPackets, vm.flyingPackets, layout, segmentHeight, envelopeHeight]
  );

  // TIME_WAIT bar
  const timeWaitVM = useMemo(() => {
    const timeWaitOwner =
      vm.variant === 'client_closes_first' ? 'client' : 'server';
    const shouldShowWait =
      vm.phase === 'time_wait' ||
      vm.hasTimeWaitTimer ||
      vm.clientState === 'TIME_WAIT' ||
      vm.serverState === 'TIME_WAIT' ||
      vm.phase === 'completed';

    let y1 = layout.topOffset;
    if (shouldShowWait) {
      const lastAckFromOwner = [...vm.sentPackets]
        .reverse()
        .find((p) => p.type === 'ACK' && p.from === timeWaitOwner);
      if (lastAckFromOwner) {
        y1 =
          rowTopFor(lastAckFromOwner.seqNum, layout.topOffset, segmentHeight) +
          envelopeHeight;
      } else {
        const lastFinToOwner = [...vm.sentPackets]
          .reverse()
          .find((p) => p.type === 'FIN' && p.to === timeWaitOwner);
        if (lastFinToOwner) {
          y1 =
            rowTopFor(lastFinToOwner.seqNum, layout.topOffset, segmentHeight) +
            segmentHeight;
        } else if (geometry.segments.length > 0) {
          y1 = geometry.segments[geometry.segments.length - 1].y2;
        }
      }
    }

    const yEnd = layout.topOffset + layout.height;
    const prog = progress01(
      vm.timeWaitStartAt,
      vm.timeWaitDuration,
      vm.phase === 'completed'
    );
    const y2 = Math.min(y1 + (yEnd - y1) * prog, yEnd);
    return {
      show: shouldShowWait,
      x: lifelineX(timeWaitOwner, layout.clientXPercent, layout.serverXPercent),
      y1,
      y2,
    };
  }, [vm, layout, geometry.segments, segmentHeight]);

  // Presentational segments VM
  const segmentsVM = useMemo(
    () =>
      geometry.segments.map((s) => ({
        key: `seg-${s.type}-${s.seqNum}-${s.x1}-${s.x2}-${s.y2}`,
        x1: s.x1,
        y1: s.y1,
        x2: s.x2,
        y2: s.y2,
        stroke: s.type === 'FIN' ? 'rgb(147, 197, 253)' : 'rgb(134, 239, 172)',
      })),
    [geometry.segments]
  );

  // Trails VM
  const trailsVM = useMemo(
    () =>
      vm.flyingPackets
        .map((p) => {
          const seqNum = geometry.flightRowByAnimId.get(p.animId);
          if (seqNum == null) return null;
          const t = trailingLineFor(
            {
              seqNum,
              type: p.type,
              from: p.from,
              to: p.to,
              positionPercent: p.position,
            },
            {
              clientXPercent: layout.clientXPercent,
              serverXPercent: layout.serverXPercent,
              topOffset: layout.topOffset,
              segmentHeight,
              envelopeHeight,
              startLiftFor,
            }
          );
          return {
            key: `trail-${p.animId}`,
            x1: t.x1,
            y1: t.y1,
            x2: t.x2,
            y2: t.y2,
            stroke:
              p.type === 'FIN' ? 'rgb(147, 197, 253)' : 'rgb(134, 239, 172)',
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        stroke: string;
      }>,
    [
      vm.flyingPackets,
      geometry.flightRowByAnimId,
      layout,
      segmentHeight,
      envelopeHeight,
    ]
  );

  // Flying VM
  const flyingVM = useMemo(
    () =>
      vm.flyingPackets
        .map((p) => {
          const seqNum = geometry.flightRowByAnimId.get(p.animId);
          if (seqNum == null) return null;
          const pos = interpolateFlightPosition(
            {
              seqNum,
              type: p.type,
              from: p.from,
              to: p.to,
              positionPercent: p.position,
            },
            {
              clientXPercent: layout.clientXPercent,
              serverXPercent: layout.serverXPercent,
              topOffset: layout.topOffset,
              segmentHeight,
              startLiftFor,
            }
          );
          const isFin = p.type === 'FIN';
          return {
            key: `fly-${p.animId}`,
            xPercent: pos.xPercent,
            yTop: pos.yTop,
            label: isFin ? 'FIN' : 'FIN+ACK',
            bg: isFin ? 'bg-blue-100' : 'bg-green-100',
            border: isFin ? 'border-blue-300' : 'border-green-300',
          };
        })
        .filter(Boolean) as Array<{
        key: string;
        xPercent: number;
        yTop: number;
        label: string;
        bg: string;
        border: string;
      }>,
    [vm.flyingPackets, geometry.flightRowByAnimId, layout, segmentHeight]
  );

  // Arrivals VM
  const arrivalsVM = useMemo(
    () =>
      geometry.arrivals.map((a) => ({
        key: `arr-${a.type}-${a.to}-${a.seqNum}-${a.x}-${a.y}`,
        xPercent: a.x,
        y: a.y,
        label: a.type === 'FIN' ? 'FIN' : 'FIN+ACK',
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
        <TcpFinControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <TcpFinTimeline
          layout={layout}
          clientChip={clientChip}
          serverChip={serverChip}
          segments={segmentsVM}
          trails={trailsVM}
          flying={flyingVM}
          arrivals={arrivalsVM}
          timeWait={timeWaitVM}
        />
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

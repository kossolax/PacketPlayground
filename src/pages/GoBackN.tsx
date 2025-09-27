import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import ReceiverTimeline, {
  ReceiverPacketInfo,
} from '@/components/ReceiverTimeline';
import SenderTimeline, { SenderPacket } from '@/components/SenderTimeline';
import SimulationControls from '@/components/SimulationControls';
import TransitZone from '@/components/TransitZone';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/use-title';
import { GoBackNSim, GoBackNState, createInitialState } from '@/lib/gobackn';

export default function GoBackN() {
  const { setTitle } = usePageTitle();
  setTitle('Go-Back-N');

  const totalPackets = 10;
  const [vm, setVm] = useState<GoBackNState>(() =>
    createInitialState(totalPackets)
  );

  const simRef = useRef<GoBackNSim | null>(null);
  if (!simRef.current) {
    simRef.current = new GoBackNSim({ totalPackets, onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const PACKET_HEIGHT = 36;
  const PACKET_SPACING = 6;
  const TIMELINE_TOP_OFFSET = 16 + 22 + PACKET_HEIGHT / 2;

  // Convert GoBackN state to component props
  const senderPackets: SenderPacket[] = vm.senderPackets.map((p) => ({
    seqNum: p.seqNum,
    status: p.status,
    hasTimer: p.hasTimer,
    isFastRetransmit: p.isFastRetransmit,
  }));

  const receiverPackets: ReceiverPacketInfo[] = Array.from(
    { length: totalPackets },
    (_, i) => {
      const isDelivered = vm.receivedPackets.includes(i);
      const hasArrived = vm.arrivedPackets.includes(i);

      let bgColor = 'bg-gray-50';
      if (isDelivered) {
        bgColor = 'bg-blue-100';
      } else if (hasArrived) {
        bgColor = 'bg-orange-100';
      }

      return {
        seqNum: i,
        bgColor,
        icons: {
          delivered: isDelivered,
          rejected: hasArrived && !isDelivered,
        },
      };
    }
  );

  const legendItems: LegendItem[] = [
    { color: 'bg-yellow-100 border-yellow-300', label: 'Sent' },
    { color: 'bg-blue-100 border-blue-300', label: 'Delivered' },
    { color: 'bg-orange-100 border-orange-300', label: 'Rejected' },
    { color: 'bg-green-100 border-green-300', label: 'Acknowledged' },
    { color: 'bg-red-200 border-red-300', label: 'Lost' },
    { color: 'bg-purple-100 border-purple-300', label: 'Fast Retransmit' },
  ];

  return (
    <Card>
      <CardHeader>
        <SimulationControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <div className="border-1">
          <div className="relative h-[500px] bg-gradient-to-r from-blue-50 via-white to-green-50 overflow-hidden">
            <SenderTimeline
              packets={senderPackets}
              base={vm.base}
              windowSize={vm.windowSize}
            />

            <ReceiverTimeline
              totalPackets={totalPackets}
              packets={receiverPackets}
            />

            <TransitZone
              flyingPackets={vm.flyingPackets}
              flyingAcks={vm.flyingAcks}
              packetHeight={PACKET_HEIGHT}
              packetSpacing={PACKET_SPACING}
              timelineTopOffset={TIMELINE_TOP_OFFSET}
            />

            <ProtocolLegend items={legendItems} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

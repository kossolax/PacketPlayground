import { useEffect, useRef, useState } from 'react';

import Header from '@/components/header';
import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import ReceiverTimeline, {
  ReceiverPacketInfo,
} from '@/components/ReceiverTimeline';
import SenderTimeline, { SenderPacket } from '@/components/SenderTimeline';
import SimulationControls from '@/components/SimulationControls';
import TransitZone from '@/components/TransitZone';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  SelectiveRepeatSim,
  SelectiveRepeatState,
  createInitialState,
} from '@/lib/selectiverepeat';

export default function SelectiveRepeat() {
  const totalPackets = 10;
  const [vm, setVm] = useState<SelectiveRepeatState>(() =>
    createInitialState(totalPackets)
  );
  const simRef = useRef<SelectiveRepeatSim | null>(null);
  if (!simRef.current) {
    simRef.current = new SelectiveRepeatSim({ totalPackets, onUpdate: setVm });
  }

  useEffect(() => () => simRef.current?.dispose(), []);

  const PACKET_HEIGHT = 36;
  const PACKET_SPACING = 6;
  const TIMELINE_TOP_OFFSET = 16 + 22 + PACKET_HEIGHT / 2;

  // Convert Selective Repeat state to component props
  const senderPackets: SenderPacket[] = vm.senderPackets.map((p) => ({
    seqNum: p.seqNum,
    status: p.status,
    hasTimer: p.hasTimer,
    isFastRetransmit: p.isFastRetransmit,
  }));

  const receiverPackets: ReceiverPacketInfo[] = Array.from(
    { length: totalPackets },
    (_, i) => {
      const isDelivered = vm.deliveredPackets.includes(i);
      const hasArrived = vm.arrivedPackets.includes(i);
      const isBuffered = vm.receiverBuffer[i]?.received && !isDelivered;

      let bgColor = 'bg-gray-50';
      if (isDelivered) {
        bgColor = 'bg-blue-100';
      } else if (isBuffered) {
        bgColor = 'bg-orange-100';
      } else if (hasArrived) {
        bgColor = 'bg-orange-100';
      }

      return {
        seqNum: i,
        bgColor,
        icons: {
          delivered: isDelivered,
          buffered: isBuffered,
          rejected: hasArrived && !isDelivered && !isBuffered,
        },
      };
    }
  );

  const legendItems: LegendItem[] = [
    { color: 'bg-yellow-100 border-yellow-300', label: 'Sent' },
    { color: 'bg-blue-100 border-blue-300', label: 'Delivered' },
    { color: 'bg-orange-100 border-orange-300', label: 'Buffered' },
    { color: 'bg-green-100 border-green-300', label: 'Acknowledged' },
    { color: 'bg-red-200 border-red-300', label: 'Lost' },
    { color: 'bg-purple-100 border-purple-300', label: 'Fast Retransmit' },
  ];

  return (
    <>
      <Header>Selective Repeat</Header>

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
                windowStart={vm.expectedSeqNum}
                windowSize={vm.windowSize}
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
    </>
  );
}

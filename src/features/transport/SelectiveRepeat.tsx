import { useEffect, useRef, useState } from 'react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import ReceiverTimeline, {
  ReceiverPacketInfo,
} from './components/ReceiverTimeline';
import SenderTimeline, { SenderPacket } from './components/SenderTimeline';
import SlidingWindowControls from './components/SlidingWindowControls';
import TransitZone from './components/TransitZone';
import {
  SelectiveRepeatSim,
  SelectiveRepeatState,
  createInitialState,
} from './lib/selectiverepeat-sim';

// Protocol simulation colors
const PACKET_COLORS = {
  sent: 'bg-yellow-100 border-yellow-300',
  delivered: 'bg-blue-100 border-blue-300',
  buffered: 'bg-orange-100 border-orange-300',
  acknowledged: 'bg-green-100 border-green-300',
  lost: 'bg-red-200 border-red-300',
  fastRetransmit: 'bg-purple-100 border-purple-300',
};

export default function SelectiveRepeat() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Transport', 'Selective Repeat');
  }, [setBreadcrumbs]);

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

      let bgColor = 'bg-muted';
      if (isDelivered) {
        [bgColor] = PACKET_COLORS.delivered.split(' ');
      } else if (isBuffered) {
        [bgColor] = PACKET_COLORS.buffered.split(' ');
      } else if (hasArrived) {
        [bgColor] = PACKET_COLORS.buffered.split(' ');
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
    { color: PACKET_COLORS.sent, label: 'Sent' },
    { color: PACKET_COLORS.delivered, label: 'Delivered' },
    { color: PACKET_COLORS.buffered, label: 'Buffered' },
    { color: PACKET_COLORS.acknowledged, label: 'Acknowledged' },
    { color: PACKET_COLORS.lost, label: 'Lost' },
    { color: PACKET_COLORS.fastRetransmit, label: 'Fast Retransmit' },
  ];

  return (
    <Card>
      <CardHeader>
        <SlidingWindowControls state={vm} simulation={simRef.current} />
      </CardHeader>
      <CardContent>
        <div className="border-1">
          <div className="relative h-[500px] bg-gradient-to-r from-blue-50 via-background to-green-50 overflow-hidden">
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
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <ProtocolLegend items={legendItems} />
      </CardFooter>
    </Card>
  );
}

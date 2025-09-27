import { Check, Clock, Mail, X } from 'lucide-react';

export interface ReceiverPacketInfo {
  seqNum: number;
  bgColor: string;
  showWindow?: boolean;
  icons: {
    delivered?: boolean;
    buffered?: boolean;
    rejected?: boolean;
  };
}

interface ReceiverTimelineProps {
  totalPackets: number;
  packets: ReceiverPacketInfo[];
  windowStart?: number;
  windowSize?: number;
}

export default function ReceiverTimeline({
  totalPackets,
  packets,
  windowStart,
  windowSize,
}: ReceiverTimelineProps) {
  const getPacketInfo = (i: number): ReceiverPacketInfo =>
    packets.find((p) => p.seqNum === i) || {
      seqNum: i,
      bgColor: 'bg-gray-50',
      icons: {},
    };

  const hasWindow = windowStart !== undefined && windowSize !== undefined;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-48 bg-green-50 border-l border-green-200">
      <div className="p-4">
        <h3 className="font-semibold mb-3 text-green-900">Receiver</h3>
        <div className="space-y-1.5">
          {Array.from({ length: totalPackets }, (_, i) => {
            const packetInfo = getPacketInfo(i);

            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 rounded h-9 ${packetInfo.bgColor} ${
                  hasWindow &&
                  i >= windowStart! &&
                  i < windowStart! + windowSize!
                    ? 'ring-2 ring-green-500'
                    : ''
                }`}
              >
                <Mail className="h-4 w-4" />
                <span className="font-mono text-sm">P{i}</span>
                {packetInfo.icons.delivered && (
                  <Check className="h-3 w-3 text-blue-600" />
                )}
                {packetInfo.icons.buffered && (
                  <Clock className="h-3 w-3 text-orange-600" />
                )}
                {packetInfo.icons.rejected && (
                  <X className="h-3 w-3 text-orange-600" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

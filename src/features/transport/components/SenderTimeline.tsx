import { Check, Clock, Mail, RefreshCw } from 'lucide-react';

export interface SenderPacket {
  seqNum: number;
  status: 'waiting' | 'sent' | 'acked';
  hasTimer?: boolean;
  isFastRetransmit?: boolean;
}

interface SenderTimelineProps {
  packets: SenderPacket[];
  base: number;
  windowSize: number;
}

export default function SenderTimeline({
  packets,
  base,
  windowSize,
}: SenderTimelineProps) {
  return (
    <div className="absolute left-0 top-0 bottom-0 w-48 bg-blue-50 border-r border-blue-200">
      <div className="p-4">
        <h3 className="font-semibold mb-3 text-foreground">Sender</h3>
        <div className="space-y-1.5">
          {packets.map((packet) => (
            <div
              key={packet.seqNum}
              className={`
                flex items-center gap-2 px-2 rounded transition-all h-9
                ${
                  packet.seqNum >= base && packet.seqNum < base + windowSize
                    ? 'ring-2 ring-blue-500'
                    : ''
                }
                ${packet.status === 'waiting' ? 'bg-muted' : ''}
                ${packet.status === 'sent' ? 'bg-yellow-100' : ''}
                ${packet.status === 'acked' ? 'bg-green-100' : ''}
                ${
                  packet.isFastRetransmit
                    ? 'bg-purple-100 border border-purple-400'
                    : ''
                }
              `}
            >
              <Mail className="h-4 w-4" />
              <span className="font-mono text-sm">P{packet.seqNum}</span>
              {packet.hasTimer && (
                <Clock className="h-3 w-3 text-orange-500 animate-pulse" />
              )}
              {packet.status === 'acked' && (
                <Check className="h-3 w-3 text-green-600" />
              )}
              {packet.isFastRetransmit && (
                <RefreshCw className="h-3 w-3 text-purple-600" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

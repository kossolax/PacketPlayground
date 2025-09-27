import { Check, Mail, RefreshCw, X } from 'lucide-react';

export interface FlyingPacket {
  animId: number;
  seqNum: number;
  position: number;
  lost: boolean;
  isFastRetransmit?: boolean;
}

export interface FlyingAck {
  animId: number;
  seqNum: number;
  position: number;
  lost: boolean;
}

interface TransitZoneProps {
  flyingPackets: FlyingPacket[];
  flyingAcks: FlyingAck[];
  packetHeight: number;
  packetSpacing: number;
  timelineTopOffset: number;
}

export default function TransitZone({
  flyingPackets,
  flyingAcks,
  packetHeight,
  packetSpacing,
  timelineTopOffset,
}: TransitZoneProps) {
  const packetStep = packetHeight + packetSpacing;

  const getFlyingPacketStyles = (packet: FlyingPacket) => {
    const baseClasses =
      'px-3 py-1 rounded-lg shadow-lg flex items-center gap-2';

    if (packet.lost && packet.position >= 50) {
      return `${baseClasses} bg-red-200 text-red-700`;
    }

    if (packet.isFastRetransmit) {
      return `${baseClasses} bg-purple-200 border border-purple-400 text-purple-700`;
    }

    return `${baseClasses} bg-white border border-gray-300`;
  };

  return (
    <div className="absolute left-48 right-48 top-0 bottom-0">
      {/* Flying packets */}
      {flyingPackets.map((packet) => (
        <div
          key={packet.animId}
          className="absolute top-4"
          style={{
            left: `${packet.position}%`,
            transform: 'translateX(-50%)',
            top: `${timelineTopOffset + packet.seqNum * packetStep}px`,
          }}
        >
          <div className={getFlyingPacketStyles(packet)}>
            <Mail className="h-4 w-4" />
            <span className="font-mono text-sm">P{packet.seqNum}</span>
            {packet.lost && packet.position >= 50 && <X className="h-4 w-4" />}
            {packet.isFastRetransmit && !packet.lost && (
              <RefreshCw className="h-3 w-3" />
            )}
          </div>
        </div>
      ))}

      {/* Flying ACKs */}
      {flyingAcks.map((ack) => (
        <div
          key={ack.animId}
          className="absolute"
          style={{
            right: `${ack.position}%`,
            transform: 'translateX(50%)',
            top: `${timelineTopOffset + ack.seqNum * packetStep}px`,
          }}
        >
          <div
            className={`
              px-3 py-1 rounded-lg shadow-lg flex items-center gap-2
              ${
                ack.lost && ack.position >= 50
                  ? 'bg-red-200 text-red-700'
                  : 'bg-green-100 border border-green-300'
              }
            `}
          >
            <Check className="h-4 w-4" />
            <span className="font-mono text-sm">ACK{ack.seqNum}</span>
            {ack.lost && ack.position >= 50 && <X className="h-4 w-4" />}
          </div>
        </div>
      ))}
    </div>
  );
}

import { Check, Clock, Mail, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  FlyingPacket,
  GoBackNSim,
  GoBackNState,
  createInitialState,
} from '@/lib/gobackn';

export default function GoBackN() {
  const totalPackets = 10;
  const [vm, setVm] = useState<GoBackNState>(() =>
    createInitialState(totalPackets)
  );
  const simRef = useRef<GoBackNSim | null>(null);
  if (!simRef.current) {
    simRef.current = new GoBackNSim({ totalPackets, onUpdate: setVm });
  }

  // optional cleanup to stop timers when leaving the page
  useEffect(() => () => simRef.current?.dispose(), []);

  // Start timeout for the base packet only and reflect timer on base
  // Defined after handleTimeout to satisfy hook dependencies

  // Configuration des dimensions pour l'alignement parfait
  const PACKET_HEIGHT = 36; // h-9 en pixels
  const PACKET_SPACING = 6; // espacement entre items (+2px)
  const TIMELINE_TOP_OFFSET = 16 + 22 + PACKET_HEIGHT / 2; // p-4 padding + titre h3 + mb-3 + centre du premier item
  const PACKET_STEP = PACKET_HEIGHT + PACKET_SPACING;

  // Pas d'initialisation via useEffect: déjà initialisé par lazy state

  // Bouton Démarrer (ne bascule plus en Pause)
  const handleStart = useCallback(() => {
    simRef.current?.start();
  }, []);

  // Reset
  const reset = () => {
    simRef.current?.reset();
  };

  // Styles pour les paquets volants
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
    <>
      <Header>GoBackN</Header>

      <Card>
        {/* Contrôles */}
        <CardHeader className="space-y-4">
          <div className="flex gap-3 items-center">
            <Button onClick={handleStart} disabled={vm.isRunning}>
              Start
            </Button>
            <Button onClick={reset} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Window: {vm.windowSize}</Label>
              <Slider
                value={[vm.windowSize]}
                onValueChange={(v) => simRef.current?.setWindowSize(v[0])}
                min={2}
                max={5}
                disabled={vm.isRunning}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Speed: {vm.speed / 1000}s</Label>
              <Slider
                value={[vm.speed]}
                onValueChange={(v) => simRef.current?.setSpeed(v[0])}
                min={1000}
                max={3000}
                step={500}
                disabled={vm.isRunning}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">
                Timeout: {vm.timeoutDuration / 1000}s
              </Label>
              <Slider
                value={[vm.timeoutDuration]}
                onValueChange={(v) => simRef.current?.setTimeoutDuration(v[0])}
                min={3000}
                max={7000}
                step={1000}
                disabled={vm.isRunning}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={vm.simulateLoss}
                  onCheckedChange={(v) => simRef.current?.setSimulateLoss(v)}
                  disabled={vm.isRunning}
                />
                <Label className="text-sm">Loss {vm.lossRate}%</Label>
              </div>
              {vm.simulateLoss && (
                <Slider
                  value={[vm.lossRate]}
                  onValueChange={(v) => simRef.current?.setLossRate(v[0])}
                  min={10}
                  max={50}
                  step={10}
                  disabled={vm.isRunning}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Zone d'animation */}

          <div className="border-1">
            <div className="relative h-[500px] bg-gradient-to-r from-blue-50 via-white to-green-50 overflow-hidden">
              {/* Émetteur */}
              <div className="absolute left-0 top-0 bottom-0 w-48 bg-blue-50 border-r border-blue-200">
                <div className="p-4">
                  <h3 className="font-semibold mb-3 text-blue-900">Sender</h3>
                  <div className="space-y-1.5">
                    {vm.senderPackets.map((packet) => (
                      <div
                        key={packet.seqNum}
                        className={`
                        flex items-center gap-2 px-2 rounded transition-all h-9
                        ${
                          packet.seqNum >= vm.base &&
                          packet.seqNum < vm.base + vm.windowSize
                            ? 'ring-2 ring-blue-500'
                            : ''
                        }
                        ${packet.status === 'waiting' ? 'bg-gray-100' : ''}
                        ${packet.status === 'sent' ? 'bg-yellow-100' : ''}
                        ${packet.status === 'acked' ? 'bg-green-100' : ''}
                      `}
                      >
                        <Mail className="h-4 w-4" />
                        <span className="font-mono text-sm">
                          P{packet.seqNum}
                        </span>
                        {packet.hasTimer && (
                          <Clock className="h-3 w-3 text-orange-500 animate-pulse" />
                        )}
                        {packet.status === 'acked' && (
                          <Check className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Récepteur */}
              <div className="absolute right-0 top-0 bottom-0 w-48 bg-green-50 border-l border-green-200">
                <div className="p-4">
                  <h3 className="font-semibold mb-3 text-green-900">
                    Receiver
                  </h3>
                  <div className="space-y-1.5">
                    {Array.from({ length: totalPackets }, (_, i) => {
                      const isAccepted = vm.receivedPackets.includes(i);
                      const hasArrived = vm.arrivedPackets.includes(i);

                      let bgColor = 'bg-gray-50'; // Pas encore reçu
                      if (isAccepted) {
                        bgColor = 'bg-blue-100'; // Accepté (dans l'ordre)
                      } else if (hasArrived) {
                        bgColor = 'bg-orange-100'; // Arrivé mais rejeté (hors ordre)
                      }

                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-2 rounded h-9 ${bgColor}`}
                        >
                          <Mail className="h-4 w-4" />
                          <span className="font-mono text-sm">P{i}</span>
                          {isAccepted && (
                            <Check className="h-3 w-3 text-blue-600" />
                          )}
                          {hasArrived && !isAccepted && (
                            <X className="h-3 w-3 text-orange-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Zone de transit */}
              <div className="absolute left-48 right-48 top-0 bottom-0">
                {/* Paquets en vol */}
                {vm.flyingPackets.map((packet) => (
                  <div
                    key={packet.animId}
                    className="absolute top-4"
                    style={{
                      left: `${packet.position}%`,
                      transform: 'translateX(-50%)',
                      top: `${TIMELINE_TOP_OFFSET + packet.seqNum * PACKET_STEP}px`,
                    }}
                  >
                    <div className={getFlyingPacketStyles(packet)}>
                      <Mail className="h-4 w-4" />
                      <span className="font-mono text-sm">
                        P{packet.seqNum}
                      </span>
                      {packet.lost && packet.position >= 50 && (
                        <X className="h-4 w-4" />
                      )}
                      {packet.isFastRetransmit && !packet.lost && (
                        <RefreshCw className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                ))}

                {/* ACKs en vol */}
                {vm.flyingAcks.map((ack) => (
                  <div
                    key={ack.animId}
                    className="absolute"
                    style={{
                      right: `${ack.position}%`,
                      transform: 'translateX(50%)',
                      top: `${TIMELINE_TOP_OFFSET + ack.seqNum * PACKET_STEP}px`,
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
                      {ack.lost && ack.position >= 50 && (
                        <X className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Légende */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-white px-4 py-2 rounded-lg shadow text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-100 rounded border border-yellow-300" />
                  <span>Sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-100 rounded border border-blue-300" />
                  <span>Accepted</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-100 rounded border border-orange-300" />
                  <span>Rejected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded border border-green-300" />
                  <span>Acquitted</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-200 rounded border border-red-300" />
                  <span>Lost</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-100 rounded border border-purple-300" />
                  <span>Fast Retransmit</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

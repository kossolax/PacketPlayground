import { Check, Clock, Mail, RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Non-linear loss rate mapping for more granular control at low values
const LOSS_RATE_VALUES = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 50
];
const DEFAULT_LOSS_RATE = 2.5;

function mapSliderToLossRate(sliderValue: number): number {
  return LOSS_RATE_VALUES[sliderValue] || 0;
}

function mapLossRateToSlider(lossRate: number): number {
  const index = LOSS_RATE_VALUES.findIndex(val => val >= lossRate);
  return index === -1 ? LOSS_RATE_VALUES.length - 1 : index;
}

import Header from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  FlyingPacket,
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
  const PACKET_STEP = PACKET_HEIGHT + PACKET_SPACING;

  const handleStart = useCallback(() => {
    simRef.current?.start();
  }, []);

  const reset = () => {
    simRef.current?.reset();
  };

  // Handle loss simulation toggle
  const handleLossToggle = (enabled: boolean) => {
    if (enabled) {
      // When enabling, set to default value if currently 0
      const currentRate = vm.lossRate;
      simRef.current?.setSimulateLoss(true);
      if (currentRate === 0) {
        simRef.current?.setLossRate(DEFAULT_LOSS_RATE);
      }
    } else {
      // When disabling, set loss rate to 0
      simRef.current?.setSimulateLoss(false);
      simRef.current?.setLossRate(0);
    }
  };

  // Handle loss rate change
  const handleLossRateChange = (rate: number) => {
    simRef.current?.setLossRate(rate);
    // Auto-disable switch if rate is set to 0
    if (rate === 0) {
      simRef.current?.setSimulateLoss(false);
    }
    // Auto-enable switch if rate is > 0 and switch is off
    else if (!vm.simulateLoss) {
      simRef.current?.setSimulateLoss(true);
    }
  };

  const getFlyingPacketStyles = (packet: FlyingPacket) => {
    const baseClasses = 'px-3 py-1 rounded-lg shadow-lg flex items-center gap-2';

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
      <Header>Selective Repeat</Header>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex gap-3 items-center">
            <Button onClick={handleStart} disabled={vm.isRunning}>
              Start
            </Button>
            <Button onClick={reset} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-mono">
                Timer: {simRef.current?.getFormattedElapsedTime() || '0.0s'}
              </span>
            </div>
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
                  onCheckedChange={handleLossToggle}
                  disabled={vm.isRunning}
                />
                <Label className="text-sm">Loss {vm.lossRate}%</Label>
              </div>
              <Slider
                value={[mapLossRateToSlider(vm.lossRate)]}
                onValueChange={(v) => handleLossRateChange(mapSliderToLossRate(v[0]))}
                min={0}
                max={LOSS_RATE_VALUES.length - 1}
                step={1}
                disabled={vm.isRunning}
                className={vm.lossRate === 0 ? 'opacity-50' : ''}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border-1">
            <div className="relative h-[500px] bg-gradient-to-r from-blue-50 via-white to-green-50 overflow-hidden">
              {/* Sender */}
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
                        ${packet.isFastRetransmit ? 'bg-purple-100 border border-purple-400' : ''}
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
                        {packet.isFastRetransmit && (
                          <RefreshCw className="h-3 w-3 text-purple-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Receiver */}
              <div className="absolute right-0 top-0 bottom-0 w-48 bg-green-50 border-l border-green-200">
                <div className="p-4">
                  <h3 className="font-semibold mb-3 text-green-900">
                    Receiver
                  </h3>
                  <div className="space-y-1.5">
                    {Array.from({ length: totalPackets }, (_, i) => {
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

                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-2 rounded h-9 ${bgColor} ${
                            i >= vm.expectedSeqNum && i < vm.expectedSeqNum + vm.windowSize
                              ? 'ring-2 ring-green-500'
                              : ''
                          }`}
                        >
                          <Mail className="h-4 w-4" />
                          <span className="font-mono text-sm">P{i}</span>
                          {isDelivered && (
                            <Check className="h-3 w-3 text-blue-600" />
                          )}
                          {isBuffered && (
                            <Clock className="h-3 w-3 text-orange-600" />
                          )}
                          {hasArrived && !isDelivered && !isBuffered && (
                            <X className="h-3 w-3 text-orange-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Transit zone */}
              <div className="absolute left-48 right-48 top-0 bottom-0">
                {/* Flying packets */}
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

                {/* Flying ACKs */}
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

              {/* Legend */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-white px-4 py-2 rounded-lg shadow text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-100 rounded border border-yellow-300" />
                  <span>Sent</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-100 rounded border border-blue-300" />
                  <span>Delivered</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-100 rounded border border-orange-300" />
                  <span>Buffered</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-100 rounded border border-green-300" />
                  <span>Acknowledged</span>
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
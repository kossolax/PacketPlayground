import { Monitor, Network } from 'lucide-react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import { computePacketPositionOnPath } from '@/lib/network-simulation';

import { SwitchLearningState } from '../lib/switch-learning-sim';

interface Props {
  state: SwitchLearningState;
}

export default function SwitchLearningVisualization({ state }: Props) {
  const config = { width: 900, height: 420 };

  const legendItems: LegendItem[] = [
    { color: 'bg-green-100 border-green-400', label: 'Forwarding (known MAC)' },
    {
      color: 'bg-yellow-100 border-yellow-400',
      label: 'Flooding (unknown MAC)',
    },
    { color: 'bg-blue-100 border-blue-400', label: 'Learning (source MAC)' },
    { color: 'bg-orange-100 border-orange-400', label: 'Packet in flight' },
  ];

  // Get link color based on state
  const getLinkColor = (linkState: string) => {
    switch (linkState) {
      case 'forwarding':
        return 'stroke-green-500';
      case 'flooding':
        return 'stroke-yellow-500';
      case 'learning':
        return 'stroke-blue-500';
      default:
        return 'stroke-border';
    }
  };

  return (
    <div className="space-y-4">
      {/* Network Topology */}
      <div className="relative bg-gradient-to-r from-blue-50 via-background to-green-50 rounded-md border overflow-hidden">
        <div
          className="relative"
          style={{
            width: config.width,
            height: config.height,
            margin: '0 auto',
          }}
        >
          <svg width={config.width} height={config.height}>
            {/* Links */}
            {state.links.map((link) => {
              const from = state.positioned.find((n) => n.id === link.from);
              const to = state.positioned.find((n) => n.id === link.to);
              if (!from || !to) return null;

              return (
                <line
                  key={`${link.from}-${link.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className={`${getLinkColor(link.state)} stroke-2`}
                />
              );
            })}

            {/* Nodes */}
            {state.positioned.map((node) => {
              const device = state.devices.find((d) => d.id === node.id);
              if (!device) return null;

              const Icon = device.type === 'switch' ? Network : Monitor;
              const color =
                device.type === 'switch' ? 'text-green-600' : 'text-blue-600';
              const bgColor =
                device.type === 'switch' ? 'fill-green-50' : 'fill-blue-50';

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle
                    r={25}
                    className={`${bgColor} stroke-border stroke-2`}
                  />
                  <foreignObject x={-12} y={-12} width={24} height={24}>
                    <Icon className={`h-6 w-6 ${color}`} />
                  </foreignObject>
                  <text
                    y={45}
                    textAnchor="middle"
                    className="text-xs fill-foreground font-medium"
                  >
                    {node.label}
                  </text>
                  <text
                    y={58}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground font-mono"
                  >
                    {device.mac.slice(-8)}
                  </text>
                </g>
              );
            })}

            {/* Flying Packets */}
            {state.packets.map((packet) => {
              const position = computePacketPositionOnPath(
                packet.currentPath,
                state.positioned,
                packet.pathProgress
              );

              return (
                <g
                  key={packet.animId}
                  transform={`translate(${position.x}, ${position.y})`}
                >
                  <circle
                    r={8}
                    className="fill-orange-400 stroke-orange-600 stroke-2"
                  />
                  <text
                    y={-12}
                    textAnchor="middle"
                    className="text-[10px] fill-foreground font-mono"
                  >
                    PKT
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <ProtocolLegend items={legendItems} />

      {/* CAM Tables */}
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(state.camTables).map(([switchId, camTable]) => {
          const switchDevice = state.devices.find((d) => d.id === switchId);
          const entries = Object.entries(camTable);

          return (
            <div key={switchId} className="rounded-md border">
              <div className="bg-muted px-4 py-2 font-medium flex items-center gap-2">
                <Network className="h-4 w-4 text-green-600" />
                {switchDevice?.label} CAM Table ({entries.length} entries)
              </div>
              <div className="p-2">
                {entries.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    No learned MAC addresses
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">
                          MAC Address
                        </th>
                        <th className="text-left p-2 font-medium">Port</th>
                        <th className="text-right p-2 font-medium">TTL (s)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(([mac, entry]) => {
                        const age = Math.floor(
                          state.currentTime - entry.timestamp
                        );
                        const timeRemaining = Math.max(
                          0,
                          state.agingTimeoutSec - age
                        );
                        const portDevice = state.devices.find(
                          (d) => d.id === entry.port
                        );
                        const macDevice = state.devices.find(
                          (d) => d.mac === mac
                        );

                        // Color coding based on remaining time
                        let ttlColor = 'text-foreground';
                        if (timeRemaining < 5) {
                          ttlColor = 'text-red-600 font-bold';
                        } else if (timeRemaining < 10) {
                          ttlColor = 'text-orange-600';
                        }

                        return (
                          <tr key={mac} className="border-b last:border-0">
                            <td className="p-2 font-mono text-xs">
                              {mac}{' '}
                              {macDevice && (
                                <span className="text-muted-foreground font-normal">
                                  ({macDevice.label})
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              {portDevice?.label || entry.port}
                            </td>
                            <td
                              className={`p-2 text-right font-mono ${ttlColor}`}
                            >
                              {timeRemaining}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Monitor, Network } from 'lucide-react';

import ProtocolLegend, { LegendItem } from '@/components/ProtocolLegend';
import { computePacketPositionOnPath } from '@/lib/network-simulation';

import { VlanState } from '../lib/vlan-sim';

interface Props {
  state: VlanState;
}

export default function VlanVisualization({ state }: Props) {
  const config = { width: 900, height: 480 };

  const legendItems: LegendItem[] = [
    { color: 'bg-blue-100 border-blue-500', label: 'VLAN 10' },
    { color: 'bg-green-100 border-green-500', label: 'VLAN 20' },
    {
      color: 'bg-purple-100 border-purple-500',
      label: 'Trunk (802.1Q tagged)',
    },
    { color: 'bg-gray-100 border-gray-400', label: 'Access Port (untagged)' },
    { color: 'bg-red-100 border-red-500', label: 'Blocked (inter-VLAN)' },
  ];

  // Get link color and style based on state and trunk mode
  const getLinkStyle = (link: {
    state: string;
    isTrunk: boolean;
    from: string | number;
    to: string | number;
  }): { color: string; width: string } => {
    if (link.state === 'blocked') {
      return { color: 'stroke-red-500', width: 'stroke-2' };
    }

    // Check if this is the inter-switch link
    const isInterSwitch =
      (link.from === 'sw1' && link.to === 'sw2') ||
      (link.from === 'sw2' && link.to === 'sw1');

    if (isInterSwitch) {
      // Style based on trunk mode
      switch (state.trunkMode) {
        case 'trunk':
          return {
            color:
              link.state === 'idle' ? 'stroke-purple-400' : 'stroke-purple-600',
            width: 'stroke-[4px]',
          };
        case 'vlan10':
          return {
            color:
              link.state === 'idle' ? 'stroke-blue-400' : 'stroke-blue-600',
            width: 'stroke-2',
          };
        case 'vlan20':
          return {
            color:
              link.state === 'idle' ? 'stroke-green-400' : 'stroke-green-600',
            width: 'stroke-2',
          };
      }
    }

    // Access port
    return {
      color: link.state === 'idle' ? 'stroke-border' : 'stroke-green-500',
      width: 'stroke-2',
    };
  };

  // Get packet color based on VLAN
  const getPacketColor = (vlanId: number) => {
    switch (vlanId) {
      case 10:
        return { fill: 'fill-blue-400', stroke: 'stroke-blue-600' };
      case 20:
        return { fill: 'fill-green-400', stroke: 'stroke-green-600' };
      default:
        return { fill: 'fill-orange-400', stroke: 'stroke-orange-600' };
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

              const style = getLinkStyle(link);

              return (
                <g key={`${link.from}-${link.to}`}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={`${style.color} ${style.width}`}
                  />
                  {/* Inter-switch link label */}
                  {((link.from === 'sw1' && link.to === 'sw2') ||
                    (link.from === 'sw2' && link.to === 'sw1')) && (
                    <text
                      x={(from.x + to.x) / 2}
                      y={(from.y + to.y) / 2 - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-bold ${
                        state.trunkMode === 'trunk'
                          ? 'fill-purple-600'
                          : state.trunkMode === 'vlan10'
                            ? 'fill-blue-600'
                            : 'fill-green-600'
                      }`}
                    >
                      {state.trunkMode === 'trunk'
                        ? 'TRUNK'
                        : state.trunkMode === 'vlan10'
                          ? 'VLAN 10'
                          : 'VLAN 20'}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {state.positioned.map((node) => {
              const device = state.devices.find((d) => d.id === node.id);
              if (!device) return null;

              const Icon = device.type === 'switch' ? Network : Monitor;

              // Color based on type
              let nodeColor = 'text-purple-600';
              let nodeBg = 'fill-purple-50';
              let nodeBorder = 'stroke-purple-400';

              if (device.type === 'pc') {
                if (device.vlanId === 10) {
                  nodeColor = 'text-blue-600';
                  nodeBg = 'fill-blue-50';
                  nodeBorder = 'stroke-blue-400';
                } else if (device.vlanId === 20) {
                  nodeColor = 'text-green-600';
                  nodeBg = 'fill-green-50';
                  nodeBorder = 'stroke-green-400';
                }
              }

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle
                    r={25}
                    className={`${nodeBg} ${nodeBorder} stroke-2`}
                  />
                  <foreignObject x={-12} y={-12} width={24} height={24}>
                    <Icon className={`h-6 w-6 ${nodeColor}`} />
                  </foreignObject>
                  <text
                    y={45}
                    textAnchor="middle"
                    className="text-xs fill-foreground font-medium"
                  >
                    {node.label?.split('\n')[0] || node.id}
                  </text>
                  {device.vlanId && (
                    <text
                      y={58}
                      textAnchor="middle"
                      className="text-[10px] fill-muted-foreground font-bold"
                    >
                      VLAN {device.vlanId}
                    </text>
                  )}
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

              const packetColor = getPacketColor(packet.vlanId);

              return (
                <g
                  key={packet.animId}
                  transform={`translate(${position.x}, ${position.y})`}
                >
                  <circle
                    r={10}
                    className={`${packetColor.fill} ${packetColor.stroke} stroke-2`}
                  />
                  {/* 802.1Q tag badge for tagged packets */}
                  {packet.tagged && (
                    <rect
                      x={-20}
                      y={-20}
                      width={40}
                      height={12}
                      rx={2}
                      className="fill-purple-500"
                    />
                  )}
                  {packet.tagged && (
                    <text
                      y={-11}
                      textAnchor="middle"
                      className="text-[8px] fill-white font-bold"
                    >
                      802.1Q
                    </text>
                  )}
                  {/* VLAN ID */}
                  <text
                    y={packet.tagged ? 25 : 20}
                    textAnchor="middle"
                    className="text-[10px] fill-foreground font-bold"
                  >
                    V{packet.vlanId}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <ProtocolLegend items={legendItems} />
    </div>
  );
}

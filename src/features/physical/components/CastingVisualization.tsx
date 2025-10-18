import { Monitor, Network } from 'lucide-react';

import { computePacketPosition } from '@/lib/network-simulation';

import { CastingSimulationState } from '../lib/casting-sim';

interface Props {
  state: CastingSimulationState;
}

export default function CastingVisualization({ state }: Props) {
  const config = { width: 800, height: 420 };

  // Get link color based on state
  const getLinkColor = (linkState: string) => {
    switch (linkState) {
      case 'active':
        return 'stroke-primary stroke-[3]';
      default:
        return 'stroke-border stroke-2';
    }
  };

  // Get packet color based on casting type
  const getPacketColor = (packetType: string) => {
    switch (packetType) {
      case 'unicast':
        return { fill: 'fill-purple-400', stroke: 'stroke-purple-600' };
      case 'broadcast':
        return { fill: 'fill-red-400', stroke: 'stroke-red-600' };
      case 'multicast':
        return { fill: 'fill-blue-400', stroke: 'stroke-blue-600' };
      case 'anycast':
        return { fill: 'fill-green-400', stroke: 'stroke-green-600' };
      default:
        return { fill: 'fill-gray-400', stroke: 'stroke-gray-600' };
    }
  };

  // Get node colors
  const getNodeColors = (nodeId: string | number, nodeType: string) => {
    if (nodeType === 'switch') {
      return {
        bgColor: 'fill-green-50',
        textColor: 'text-green-600',
      };
    }

    if (nodeId === 'pc0') {
      return {
        bgColor: 'fill-orange-50',
        textColor: 'text-orange-600',
      };
    }

    // Check if in multicast group
    if (state.multicastGroup[nodeId] === true) {
      return {
        bgColor: 'fill-blue-50',
        textColor: 'text-blue-600',
      };
    }

    return {
      bgColor: 'fill-gray-50',
      textColor: 'text-gray-600',
    };
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
                  className={getLinkColor(link.state)}
                />
              );
            })}

            {/* Nodes */}
            {state.positioned.map((node) => {
              const device = state.nodes.find((d) => d.id === node.id);
              if (!device) return null;

              const { bgColor, textColor } = getNodeColors(
                node.id,
                device.type
              );
              const Icon = device.type === 'switch' ? Network : Monitor;

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <circle
                    r={25}
                    className={`${bgColor} stroke-border stroke-2`}
                  />
                  <foreignObject x={-12} y={-12} width={24} height={24}>
                    <Icon className={`h-6 w-6 ${textColor}`} />
                  </foreignObject>
                  <text
                    y={45}
                    textAnchor="middle"
                    className="text-xs fill-foreground font-medium"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}

            {/* Flying Packets */}
            {state.packets.map((packet) => {
              // Get current link based on currentLinkIndex
              if (
                !packet.path ||
                packet.currentLinkIndex >= packet.path.length
              ) {
                return null;
              }

              const currentLink = packet.path[packet.currentLinkIndex];
              const position = computePacketPosition(
                currentLink,
                state.positioned,
                packet.pathProgress
              );

              const colors = getPacketColor(packet.packetType);

              return (
                <g
                  key={packet.animId}
                  transform={`translate(${position.x}, ${position.y})`}
                >
                  <circle
                    r={8}
                    className={`${colors.fill} ${colors.stroke} stroke-2`}
                  />
                  <text
                    y={-12}
                    textAnchor="middle"
                    className="text-[10px] fill-foreground font-mono uppercase"
                  >
                    {packet.packetType.slice(0, 3)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

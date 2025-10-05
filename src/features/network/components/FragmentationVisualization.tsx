import { Router } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { interpolateFragmentPosition } from '@/lib/draw';

import { Fragment, FragmentationState } from '../lib/fragmentation-sim';

interface FragmentationVisualizationProps {
  state: FragmentationState;
}

export default function FragmentationVisualization({
  state,
}: FragmentationVisualizationProps) {
  const containerWidth = 900;
  const containerHeight = 400;
  const networkY = 200;
  const routerSize = 48;

  // Equidistant anchors: Source (0), R1 (1), R2 (2), Destination (3)
  const anchorSpacing = (containerWidth - 100) / 3;
  const getSourceX = () => 50;
  const getDestinationX = () => 50 + 3 * anchorSpacing;
  const getRouterAnchorX = (routerIndex: number) =>
    50 + (routerIndex + 1) * anchorSpacing; // routerIndex: 0->R1, 1->R2

  const getNetworkX = (networkId: number): number => {
    if (networkId === 0) return getSourceX();
    if (networkId === state.networks.length - 1) return getDestinationX();
    return getRouterAnchorX(networkId - 1);
  };

  const getRouterX = (leftNetworkId: number): number =>
    getRouterAnchorX(leftNetworkId);

  const getFragmentPosition = (fragment: Fragment) => {
    const pos = interpolateFragmentPosition(fragment, {
      getSourceX,
      getDestinationX,
      getRouterX: getRouterAnchorX,
    });
    return { x: pos.x, y: networkY };
  };

  const renderFragmentNode = (fragment: Fragment) => {
    const pos = getFragmentPosition(fragment);
    let extraStyles: React.CSSProperties = {};
    let label = fragment.customLabel || fragment.size.toString();
    // Harmonisation thème TCP SYN (utilisation palette pastel similaire)
    // SYN: blue, ACK: purple, etc. Ici on mappe:
    // data -> blue/green/purple cycle ; probe -> indigo ; icmp -> red
    if (fragment.kind === 'probe' || fragment.kind === 'icmp') {
      extraStyles = {
        background: 'linear-gradient(135deg,#e0e7ff,#c7d2fe)', // indigo unity
        borderColor: '#6366F1',
        color: '#312e81',
      };
      if (!fragment.customLabel) {
        label = fragment.kind === 'probe' ? 'Discovery' : 'ICMP';
      }
    } else {
      // data
      extraStyles = {
        background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', // sky 100->200
        borderColor: '#0EA5E9',
        color: '#0c4a6e',
      };
    }
    const pulseClass = fragment.kind === 'probe' ? 'animate-pulse' : '';
    return (
      <div
        key={fragment.id}
        className="absolute"
        style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
      >
        <div
          className={`px-2 py-1 rounded shadow-md border text-[10px] font-mono whitespace-nowrap backdrop-blur-sm ${pulseClass}`}
          style={{
            opacity: 0.95,
            ...extraStyles,
          }}
        >
          {label}
        </div>
      </div>
    );
  };

  return (
    <div className="relative bg-gradient-to-r from-blue-50 via-background to-green-50 rounded-md border overflow-hidden">
      <div
        className="relative"
        style={{
          width: containerWidth,
          height: containerHeight,
          margin: '0 auto',
        }}
      >
        {/* Fixed segments: Source->R1, R1->R2, R2->Destination */}
        {[0, 1, 2].map((seg) => {
          const leftX = seg === 0 ? getSourceX() : getRouterAnchorX(seg - 1);
          const rightX = seg === 2 ? getDestinationX() : getRouterAnchorX(seg);
          return (
            <div
              key={`cable-${seg}`}
              className="absolute bg-gray-300"
              style={{
                left: leftX,
                top: networkY - 2,
                width: rightX - leftX,
                height: 4,
              }}
            />
          );
        })}

        {/* Networks (source and destination) */}
        {[state.networks[0], state.networks[state.networks.length - 1]].map(
          (network, idx) => {
            const x = getNetworkX(network.id);
            const isSource = idx === 0;
            const label = isSource ? 'Source' : 'Destination';
            const colorClasses = isSource
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'bg-green-100 border-green-300 text-green-700';

            return (
              <div key={`network-${network.id}`}>
                {/* Network circle */}
                <div
                  className={`absolute ${colorClasses} border-2 rounded-full`}
                  style={{
                    left: x - 30,
                    top: networkY - 30,
                    width: 60,
                    height: 60,
                  }}
                />

                {/* Label above */}
                <div
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ left: x, top: networkY - 60 }}
                >
                  <Badge variant="outline" className={colorClasses}>
                    {label}
                  </Badge>
                </div>

                {/* MTU label below */}
                <div
                  className="absolute text-xs text-muted-foreground"
                  style={{ left: x - 30, top: networkY + 40, width: 60 }}
                >
                  <div className="text-center">MTU: {network.mtu}</div>
                </div>
              </div>
            );
          }
        )}

        {/* Routers (R1, R2) */}
        {state.networks.slice(0, -1).map((network) => {
          const routerIdx = network.id;
          const routerX = getRouterX(network.id);
          const nextMtu = state.networks[network.id + 1].mtu;
          return (
            <div key={`router-${network.id}`}>
              <div
                className="absolute bg-gray-100 border-2 border-gray-400 rounded-lg flex items-center justify-center"
                style={{
                  left: routerX - routerSize / 2,
                  top: networkY - routerSize / 2,
                  width: routerSize,
                  height: routerSize,
                }}
              >
                <Router className="h-6 w-6 text-gray-600" />
              </div>
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ left: routerX, top: networkY - routerSize / 2 - 30 }}
              >
                <Badge
                  variant="outline"
                  className="bg-gray-200 border-gray-400 text-gray-700"
                >
                  R{routerIdx + 1}
                </Badge>
              </div>
              <div
                className="absolute text-xs text-muted-foreground"
                style={{
                  left: routerX - 30,
                  top: networkY + routerSize / 2 + 10,
                  width: 60,
                }}
              >
                <div className="text-center">MTU: {nextMtu}</div>
              </div>
            </div>
          );
        })}

        {/* Flying fragments */}
        {state.flyingFragments.map((fragment) => renderFragmentNode(fragment))}

        {/* Statistics overlay */}
        <div className="absolute bottom-3 left-3">
          <div className="rounded-md border bg-white/80 backdrop-blur px-3 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-foreground">
                IPv{state.ipVersion}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Packets:</span>
                <span className="font-medium text-foreground">
                  {state.packetsGenerated}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Fragments:</span>
                <span className="font-medium text-foreground">
                  {state.totalFragments}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Overhead:</span>
                <span className="font-medium text-orange-600">
                  {state.ipVersion === 4
                    ? state.ipv4Overhead
                    : state.ipv6Overhead}{' '}
                  bytes
                </span>
              </div>
              {state.ipVersion === 6 && (
                <div className="flex flex-col gap-0.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Path MTU:</span>
                    <span className="font-medium">
                      {state.discoveredPathMtu || '—'}
                    </span>
                  </div>
                  {state.pmtuDiscoveryActive && (
                    <div className="text-[10px] text-indigo-600 animate-pulse">
                      Discovering…
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Packet size info */}
        <div className="absolute bottom-3 right-3">
          <div className="rounded-md border bg-white/80 backdrop-blur px-3 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Packet size:</span>
              <span className="font-medium text-foreground">
                {state.packetSize} bytes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

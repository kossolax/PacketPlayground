import { useEffect, useState } from 'react';
import { Monitor, Network } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import {
  busLayout,
  starLayout,
  ringLayout,
  meshLayout,
  treeLayout,
  hybridLayout,
  generateBusLinks,
  generateStarLinks,
  generateRingLinks,
  generatePartialMeshLinks,
  generateFullMeshLinks,
  generateTreeLinks,
  generateHybridLinks,
  type NetworkNode,
  type PositionedNode,
  type NetworkLink,
} from '@/lib/network-layout';

export default function NetworkTopologyDemo() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Physical', 'Network Topologies');
  }, [setBreadcrumbs]);

  const [layoutType, setLayoutType] = useState<
    'bus' | 'star' | 'ring' | 'partial-mesh' | 'full-mesh' | 'tree' | 'hybrid'
  >('bus');
  const [nodeCount, setNodeCount] = useState(6);

  const config = { width: 900, height: 420, padding: 80 };

  // For hybrid topology, calculate total nodes from nodes per section
  const actualNodeCount = layoutType === 'hybrid' ? nodeCount * 3 : nodeCount;

  // Generate nodes
  const nodes: NetworkNode[] = Array.from(
    { length: actualNodeCount },
    (_, i) => {
      let type: 'pc' | 'switch' = 'pc';
      let label = String.fromCharCode(65 + i);

      if (layoutType === 'star' && i === 0) {
        type = 'switch';
        label = 'Hub';
      }

      return { id: i, type, label };
    }
  );

  // Apply layout
  let positioned: PositionedNode[];
  let links: NetworkLink[];
  const nodeIds = nodes.map((n) => n.id);

  switch (layoutType) {
    case 'bus':
      positioned = busLayout(nodes, config);
      links = generateBusLinks(nodeIds);
      break;
    case 'star':
      positioned = starLayout(nodes, config);
      links = generateStarLinks(nodeIds[0], nodeIds.slice(1));
      break;
    case 'ring':
      positioned = ringLayout(nodes, config);
      links = generateRingLinks(nodeIds);
      break;
    case 'partial-mesh':
      positioned = meshLayout(nodes, config);
      links = generatePartialMeshLinks(nodeIds);
      break;
    case 'full-mesh':
      positioned = meshLayout(nodes, config);
      links = generateFullMeshLinks(nodeIds);
      break;
    case 'tree':
      positioned = treeLayout(nodes, config);
      links = generateTreeLinks(nodeIds);
      break;
    case 'hybrid':
      positioned = hybridLayout(nodes, config);
      links = generateHybridLinks(nodeIds);
      break;
    default:
      positioned = busLayout(nodes, config);
      links = generateBusLinks(nodeIds);
  }

  const getNode = (id: string | number) => positioned.find((n) => n.id === id);

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <Label>Topology Type</Label>
            <Select
              value={layoutType}
              onValueChange={(v: typeof layoutType) => setLayoutType(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bus">Bus (Linear)</SelectItem>
                <SelectItem value="star">Star (Hub-Spoke)</SelectItem>
                <SelectItem value="ring">Ring (Circle)</SelectItem>
                <SelectItem value="partial-mesh">
                  Mesh (Partial - Internet)
                </SelectItem>
                <SelectItem value="full-mesh">
                  Mesh (Full - All Connected)
                </SelectItem>
                <SelectItem value="tree">Tree (Binary)</SelectItem>
                <SelectItem value="hybrid">
                  Hybrid (Ring + Bus + Tree)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label>
              {layoutType === 'hybrid'
                ? `Nodes per section: ${nodeCount}`
                : `Nodes: ${nodeCount}`}
            </Label>
            <Slider
              value={[nodeCount]}
              onValueChange={([v]) => setNodeCount(v)}
              min={3}
              max={10}
              step={1}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-muted p-3 rounded">
            <div className="font-medium">
              {layoutType === 'hybrid'
                ? `Total Nodes: ${actualNodeCount} (${nodeCount}×3)`
                : `Nodes: ${actualNodeCount}`}
            </div>
          </div>
          <div className="bg-muted p-3 rounded">
            <div className="font-medium">Links: {links.length}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
              {links.map((link) => {
                const from = getNode(link.from);
                const to = getNode(link.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={`${link.from}-${link.to}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="stroke-border stroke-2"
                  />
                );
              })}
              {/* Nodes */}
              {positioned.map((node) => {
                const Icon = node.type === 'switch' ? Network : Monitor;
                const color =
                  node.type === 'switch' ? 'text-green-600' : 'text-blue-600';
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                  >
                    <circle
                      r={25}
                      className="fill-background stroke-border stroke-2"
                    />
                    <foreignObject x={-12} y={-12} width={24} height={24}>
                      <Icon className={`h-6 w-6 ${color}`} />
                    </foreignObject>
                    <text
                      y={45}
                      textAnchor="middle"
                      className="text-xs fill-foreground"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

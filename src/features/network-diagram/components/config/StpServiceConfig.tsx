/**
 * STP Service Configuration Component
 * Provides UI for viewing and configuring Spanning Tree Protocol settings
 */

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SwitchHost } from '../../lib/network-simulator/nodes/switch';
import useStpService from '../../hooks/useStpService';
import {
  SpanningTreeState,
  SpanningTreeProtocol,
} from '../../lib/network-simulator/services/spanningtree';

interface StpServiceConfigProps {
  node: SwitchHost;
}

function getStateColor(state: SpanningTreeState): string {
  switch (state) {
    case SpanningTreeState.Forwarding:
      return 'bg-green-500';
    case SpanningTreeState.Blocking:
      return 'bg-orange-500';
    case SpanningTreeState.Listening:
    case SpanningTreeState.Learning:
      return 'bg-blue-500';
    case SpanningTreeState.Disabled:
    default:
      return 'bg-muted';
  }
}

function getStateName(state: SpanningTreeState): string {
  switch (state) {
    case SpanningTreeState.Disabled:
      return 'Disabled';
    case SpanningTreeState.Listening:
      return 'Listening';
    case SpanningTreeState.Learning:
      return 'Learning';
    case SpanningTreeState.Forwarding:
      return 'Forwarding';
    case SpanningTreeState.Blocking:
      return 'Blocking';
    default:
      return 'Unknown';
  }
}

const VALID_PRIORITIES = Array.from({ length: 16 }, (_, i) => i * 4096);

export default function StpServiceConfig({ node }: StpServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    protocol,
    setProtocol,
    selectedVlan,
    setSelectedVlan,
    getBridgeId,
    getRootId,
    getIsRoot,
    getPriority,
    setPriority,
    getVlanIds,
    getPortsInfo,
    setPortCost,
  } = useStpService(node);

  const isPvst = protocol === SpanningTreeProtocol.PVST;
  const activeVlan = isPvst ? (selectedVlan ?? undefined) : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Spanning Tree Protocol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="stp-enable">Enable STP</Label>
              <p className="text-muted-foreground text-xs">
                Activate Spanning Tree Protocol to prevent network loops
              </p>
            </div>
            <Switch
              id="stp-enable"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="stp-protocol">Protocol Type</Label>
              <p className="text-muted-foreground text-xs">
                Choose the spanning tree protocol variant for this switch
              </p>
            </div>
            <Select
              value={protocol}
              onValueChange={(value) =>
                setProtocol(value as SpanningTreeProtocol)
              }
              disabled={!enabled}
            >
              <SelectTrigger id="stp-protocol" className="w-[240px]">
                <SelectValue placeholder="Select protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SpanningTreeProtocol.STP}>
                  STP (802.1D)
                </SelectItem>
                <SelectItem value={SpanningTreeProtocol.PVST}>
                  PVST (Per-VLAN STP)
                </SelectItem>
                <SelectItem
                  value={SpanningTreeProtocol.RPVST}
                  disabled
                  className="text-muted-foreground"
                >
                  Rapid PVST+ (Not implemented)
                </SelectItem>
                <SelectItem
                  value={SpanningTreeProtocol.MSTP}
                  disabled
                  className="text-muted-foreground"
                >
                  MSTP (Not implemented)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {enabled && isPvst && (
        <Card>
          <CardHeader>
            <CardTitle>VLAN Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedVlan !== null ? String(selectedVlan) : ''}
              onValueChange={(value) => setSelectedVlan(parseInt(value, 10))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a VLAN to view" />
              </SelectTrigger>
              <SelectContent>
                {getVlanIds().map((vlanId) => (
                  <SelectItem key={vlanId} value={String(vlanId)}>
                    VLAN {vlanId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {enabled && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Bridge Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Bridge ID
                  </Label>
                  <p className="font-mono text-sm">{getBridgeId(activeVlan)}</p>
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="stp-priority"
                    className="text-muted-foreground text-xs"
                  >
                    Priority
                  </Label>
                  <Select
                    value={String(getPriority(activeVlan))}
                    onValueChange={(value) =>
                      setPriority(parseInt(value, 10), activeVlan)
                    }
                  >
                    <SelectTrigger id="stp-priority" className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Root Bridge ID
                  </Label>
                  <p className="font-mono text-sm">{getRootId(activeVlan)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Root Bridge
                  </Label>
                  <div>
                    {getIsRoot(activeVlan) ? (
                      <Badge variant="default" className="bg-green-500">
                        This switch
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Other switch</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Port States</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
                  <div>Interface</div>
                  <div>State</div>
                  <div>Role</div>
                  <div className="text-right">Cost</div>
                </div>
                {getPortsInfo(activeVlan).map((port) => (
                  <div
                    key={port.name}
                    className="grid grid-cols-4 items-center gap-2 border-b py-2 text-sm last:border-0"
                  >
                    <div className="truncate font-mono" title={port.name}>
                      {port.name}
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={`${getStateColor(port.state)} border-0 text-white`}
                      >
                        {getStateName(port.state)}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{port.role}</div>
                    <div className="text-right">
                      <Input
                        type="number"
                        className="h-7 w-20 text-right font-mono text-xs ml-auto"
                        value={port.cost === Number.MAX_VALUE ? '' : port.cost}
                        placeholder="auto"
                        min={0}
                        max={200000000}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setPortCost(port.name, Number.isNaN(val) ? 0 : val);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

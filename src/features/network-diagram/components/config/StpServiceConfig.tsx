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
  isPerVlanProtocol,
  isMstpProtocol,
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
    selectedInstance,
    setSelectedInstance,
    getBridgeId,
    getRootId,
    getIsRoot,
    getPriority,
    setPriority,
    getVlanIds,
    getPortsInfo,
    setPortCost,
    getMstConfig,
    setMstName,
    setMstRevision,
    setMstInstanceVlan,
  } = useStpService(node);

  const isPvst = isPerVlanProtocol(protocol);
  const isMstp = isMstpProtocol(protocol);
  const activeVlan = isPvst ? (selectedVlan ?? undefined) : undefined;
  const mstConfig = getMstConfig();

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
                <SelectItem value={SpanningTreeProtocol.RPVST}>
                  Rapid PVST+ (802.1w)
                </SelectItem>
                <SelectItem value={SpanningTreeProtocol.MSTP}>
                  MSTP (802.1s)
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

      {enabled && isMstp && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>MST Region Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label
                    htmlFor="mst-name"
                    className="text-muted-foreground text-xs"
                  >
                    Region Name
                  </Label>
                  <Input
                    id="mst-name"
                    className="h-8"
                    value={mstConfig?.name ?? ''}
                    maxLength={32}
                    placeholder="Region name"
                    onChange={(e) => setMstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="mst-revision"
                    className="text-muted-foreground text-xs"
                  >
                    Revision
                  </Label>
                  <Input
                    id="mst-revision"
                    type="number"
                    className="h-8"
                    value={mstConfig?.revision ?? 0}
                    min={0}
                    max={65535}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!Number.isNaN(val)) setMstRevision(val);
                    }}
                  />
                </div>
              </div>
              {mstConfig && mstConfig.getActiveInstances().length > 1 && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Instance-VLAN Mapping
                  </Label>
                  <div className="space-y-1 text-xs font-mono">
                    {mstConfig.getActiveInstances().map((instId) => {
                      const vlans =
                        instId === 0
                          ? '(unmapped VLANs)'
                          : mstConfig.getVlansForInstance(instId).join(', ') ||
                            'none';
                      return (
                        <div key={instId} className="flex justify-between">
                          <span>Instance {instId}:</span>
                          <span className="text-muted-foreground">{vlans}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Instance
                  </Label>
                  <Input
                    id="mst-add-instance"
                    type="number"
                    className="h-8"
                    min={1}
                    max={15}
                    placeholder="1-15"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    VLAN ID
                  </Label>
                  <Input
                    id="mst-add-vlan"
                    type="number"
                    className="h-8"
                    min={1}
                    max={4094}
                    placeholder="VLAN"
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs"
                    onClick={() => {
                      const instEl = document.getElementById(
                        'mst-add-instance'
                      ) as HTMLInputElement;
                      const vlanEl = document.getElementById(
                        'mst-add-vlan'
                      ) as HTMLInputElement;
                      const inst = parseInt(instEl?.value, 10);
                      const vlan = parseInt(vlanEl?.value, 10);
                      if (
                        inst >= 1 &&
                        inst <= 15 &&
                        vlan >= 1 &&
                        vlan <= 4094
                      ) {
                        setMstInstanceVlan(inst, vlan);
                      }
                    }}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    className="h-8 px-3 rounded-md bg-destructive text-destructive-foreground text-xs"
                    onClick={() => {
                      const vlanEl = document.getElementById(
                        'mst-add-vlan'
                      ) as HTMLInputElement;
                      const vlan = parseInt(vlanEl?.value, 10);
                      if (vlan >= 1 && vlan <= 4094) {
                        setMstInstanceVlan(0, vlan, true);
                      }
                    }}
                  >
                    Unmap
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instance Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={String(selectedInstance)}
                onValueChange={(value) =>
                  setSelectedInstance(parseInt(value, 10))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getVlanIds().map((instId) => (
                    <SelectItem key={instId} value={String(instId)}>
                      {instId === 0 ? 'IST (0)' : `Instance ${instId}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </>
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

/**
 * STP Service Configuration Component
 * Provides UI for viewing and configuring Spanning Tree Protocol settings
 */

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

function getProtocolName(protocol: SpanningTreeProtocol): string {
  switch (protocol) {
    case SpanningTreeProtocol.None:
      return 'Disabled';
    case SpanningTreeProtocol.STP:
      return 'STP (802.1D)';
    case SpanningTreeProtocol.PVST:
      return 'PVST+';
    case SpanningTreeProtocol.RPVST:
      return 'Rapid PVST+';
    case SpanningTreeProtocol.MSTP:
      return 'MSTP (802.1s)';
    default:
      return 'Unknown';
  }
}

export default function StpServiceConfig({ node }: StpServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    getBridgeId,
    getRootId,
    getIsRoot,
    getProtocol,
    getPriority,
    getPortsInfo,
  } = useStpService(node);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Spanning Tree Protocol</CardTitle>
            <Badge variant="secondary">{getProtocolName(getProtocol())}</Badge>
          </div>
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
        </CardContent>
      </Card>

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
                  <p className="font-mono text-sm">{getBridgeId()}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Priority
                  </Label>
                  <p className="font-mono text-sm">{getPriority()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Root Bridge ID
                  </Label>
                  <p className="font-mono text-sm">{getRootId()}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">
                    Root Bridge
                  </Label>
                  <div>
                    {getIsRoot() ? (
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
                <div className="grid grid-cols-4 gap-2 pb-2 border-b text-muted-foreground text-xs font-medium">
                  <div>Interface</div>
                  <div>State</div>
                  <div>Role</div>
                  <div className="text-right">Cost</div>
                </div>
                {getPortsInfo().map((port) => (
                  <div
                    key={port.name}
                    className="grid grid-cols-4 gap-2 py-2 border-b last:border-0 text-sm"
                  >
                    <div className="font-mono truncate" title={port.name}>
                      {port.name}
                    </div>
                    <div>
                      <Badge
                        variant="outline"
                        className={`${getStateColor(port.state)} text-white border-0`}
                      >
                        {getStateName(port.state)}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{port.role}</div>
                    <div className="text-right font-mono text-muted-foreground">
                      {port.cost === Number.MAX_VALUE ? '∞' : port.cost}
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

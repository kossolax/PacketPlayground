/**
 * RIP Service Configuration Component
 * Provides UI for configuring RIP (Routing Information Protocol) settings
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RouterHost } from '../../lib/network-simulator/nodes/router';
import type { Network } from '../../lib/network-simulator/network';
import useRipService from '../../hooks/useRipService';

interface RipServiceConfigProps {
  node: RouterHost;
  network?: Network | null;
}

export default function RipServiceConfig({
  node,
  network,
}: RipServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    selectedInterface,
    setSelectedInterface,
    getAllRoutes,
    getRoutesForInterface,
    enableOnInterface,
    disableOnInterface,
    isEnabledOnInterface,
    getEnabledInterfaces,
    getInterfaces,
    getConfiguration,
    updateConfiguration,
    clearRoutes,
    getMetricInfinity,
  } = useRipService(node, network);

  const interfaces = getInterfaces();
  const enabledInterfaces = getEnabledInterfaces();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleToggleInterface = (ifaceName: string) => {
    if (isEnabledOnInterface(ifaceName)) {
      disableOnInterface(ifaceName);
    } else {
      enableOnInterface(ifaceName);
    }
  };

  const handleClearRoutes = () => {
    clearRoutes();
  };

  const allRoutes = getAllRoutes();
  const filteredRoutes = selectedInterface
    ? getRoutesForInterface(selectedInterface)
    : allRoutes;

  const config = getConfiguration();
  const metricInfinity = getMetricInfinity();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>RIP Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="rip-enable">Enable RIP Service</Label>
              <p className="text-muted-foreground text-xs">
                Activate Routing Information Protocol for dynamic routing
              </p>
            </div>
            <Switch
              id="rip-enable"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="interface-filter">Filter by Interface</Label>
                <Select
                  value={selectedInterface || 'all'}
                  onValueChange={(value) =>
                    setSelectedInterface(value === 'all' ? null : value)
                  }
                >
                  <SelectTrigger id="interface-filter">
                    <SelectValue placeholder="All interfaces" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All interfaces</SelectItem>
                    {interfaces.map((iface) => (
                      <SelectItem key={iface} value={iface}>
                        {iface}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>Advanced Settings</Label>
                  <p className="text-muted-foreground text-xs">
                    Configure RIP timers and behavior
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced
                </Button>
              </div>

              {showAdvanced && (
                <div className="border-border rounded-lg border p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Update Interval</Label>
                      <p className="text-muted-foreground text-xs">
                        {config.updateInterval}s (send updates every 30 seconds)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Invalid After</Label>
                      <p className="text-muted-foreground text-xs">
                        {config.invalidAfter}s (route invalid after 180 seconds)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Flush After</Label>
                      <p className="text-muted-foreground text-xs">
                        {config.flushAfter}s (remove route after 240 seconds)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Default Metric</Label>
                      <p className="text-muted-foreground text-xs">
                        {config.defaultMetric} (hop count for redistributed routes)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Split Horizon</Label>
                      <p className="text-muted-foreground text-xs">
                        Prevent routing loops by not advertising routes back
                      </p>
                    </div>
                    <Switch
                      checked={config.splitHorizon}
                      onCheckedChange={(checked) =>
                        updateConfiguration({ splitHorizon: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Poison Reverse</Label>
                      <p className="text-muted-foreground text-xs">
                        Advertise routes as unreachable on incoming interface
                      </p>
                    </div>
                    <Switch
                      checked={config.poisonReverse}
                      onCheckedChange={(checked) =>
                        updateConfiguration({ poisonReverse: checked })
                      }
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {enabled && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Interface Configuration</CardTitle>
              {interfaces.length > 0 && (
                <Badge variant="secondary">
                  {enabledInterfaces.length} of {interfaces.length} enabled
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {interfaces.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  No interfaces available
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Interface</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interfaces.map((ifaceName) => {
                      const iface = node.getInterface(ifaceName);
                      const ripEnabled = isEnabledOnInterface(ifaceName);
                      const ipAddress = iface.getNetAddress()?.toString() || 'N/A';
                      const mask = iface.getNetMask()?.CIDR || 0;

                      return (
                        <TableRow key={ifaceName}>
                          <TableCell className="font-medium">
                            {ifaceName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {ipAddress}/{mask}
                          </TableCell>
                          <TableCell>
                            <Badge variant={ripEnabled ? 'default' : 'outline'}>
                              {ripEnabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() => handleToggleInterface(ifaceName)}
                              variant="ghost"
                              size="sm"
                            >
                              {ripEnabled ? 'Disable' : 'Enable'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>RIP Routing Table</CardTitle>
              <div className="flex gap-2">
                {allRoutes.length > 0 && (
                  <Button
                    onClick={handleClearRoutes}
                    variant="outline"
                    size="sm"
                  >
                    Clear Routes
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredRoutes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  {enabledInterfaces.length === 0
                    ? 'Enable RIP on interfaces to start learning routes'
                    : 'No RIP routes learned yet'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Network</TableHead>
                      <TableHead>Next Hop</TableHead>
                      <TableHead>Metric</TableHead>
                      <TableHead>Interface</TableHead>
                      <TableHead>Route Tag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoutes.map((route, index) => (
                      <TableRow
                        key={`${route.network}-${route.nextHop}-${index}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {route.network}/{route.cidr}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {route.nextHop}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              route.metric >= metricInfinity
                                ? 'destructive'
                                : 'default'
                            }
                          >
                            {route.metric >= metricInfinity
                              ? 'unreachable'
                              : route.metric}
                          </Badge>
                        </TableCell>
                        <TableCell>{route.interface}</TableCell>
                        <TableCell>{route.routeTag}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {filteredRoutes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>RIP Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Routes:</span>{' '}
                    {allRoutes.length}
                  </div>
                  <div>
                    <span className="font-medium">Valid Routes:</span>{' '}
                    {allRoutes.filter((r) => r.metric < metricInfinity).length}
                  </div>
                  <div>
                    <span className="font-medium">Invalid Routes:</span>{' '}
                    {
                      allRoutes.filter((r) => r.metric >= metricInfinity)
                        .length
                    }
                  </div>
                  <div>
                    <span className="font-medium">Enabled Interfaces:</span>{' '}
                    {enabledInterfaces.length}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

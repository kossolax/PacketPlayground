/**
 * OSPF Service Configuration Component
 * Provides UI for configuring OSPF (Open Shortest Path First) routing protocol
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import type { RouterHost } from '../../lib/network-simulator/nodes/router';
import type { Network } from '../../lib/network-simulator/network';
import useOspfService, {
  type OSPFNetworkFormData,
} from '../../hooks/useOspfService';
import { IPAddress } from '../../lib/network-simulator/address';
import { OSPFState } from '../../lib/network-simulator/protocols/ospf';

interface ValidationErrors {
  network?: string;
  wildcardMask?: string;
  areaID?: string;
  routerID?: string;
  processID?: string;
}

function validateIPAddress(ip: string): boolean {
  if (!ip) return false;
  try {
    const validIp = new IPAddress(ip);
    return !!validIp;
  } catch {
    return false;
  }
}

function validateOSPFNetwork(formData: OSPFNetworkFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!validateIPAddress(formData.network)) {
    errors.network = 'Invalid network address format';
  }

  if (!validateIPAddress(formData.wildcardMask)) {
    errors.wildcardMask = 'Invalid wildcard mask format';
  }

  if (!validateIPAddress(formData.areaID)) {
    errors.areaID = 'Invalid area ID format';
  }

  return errors;
}

function getStateBadgeVariant(
  state: OSPFState
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case OSPFState.Full:
      return 'default';
    case OSPFState.TwoWay:
      return 'secondary';
    case OSPFState.Down:
    case OSPFState.Init:
      return 'destructive';
    default:
      return 'outline';
  }
}

interface OspfServiceConfigProps {
  node: RouterHost;
  network?: Network | null;
}

export default function OspfServiceConfig({
  node,
  network,
}: OspfServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    processID,
    setProcessID,
    routerID,
    setRouterID,
    getAllNetworks,
    addNetwork,
    removeNetwork,
    getAllNeighbors,
    getOspfInterfaces,
    getStateString,
  } = useOspfService(node, network);

  const [showAddNetworkForm, setShowAddNetworkForm] = useState(false);
  const [localRouterID, setLocalRouterID] = useState(routerID);
  const [localProcessID, setLocalProcessID] = useState(processID.toString());

  const defaultNetworkFormData: OSPFNetworkFormData = {
    network: '0.0.0.0',
    wildcardMask: '255.255.255.255',
    areaID: '0.0.0.0',
  };

  const [localNetworkFormData, setLocalNetworkFormData] =
    useState<OSPFNetworkFormData>(defaultNetworkFormData);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );

  const handleNetworkInputChange = (
    field: keyof OSPFNetworkFormData,
    value: string
  ) => {
    const newFormData = { ...localNetworkFormData, [field]: value };
    setLocalNetworkFormData(newFormData);

    const errors = validateOSPFNetwork(newFormData);
    setValidationErrors(errors);
  };

  const handleSaveNetwork = () => {
    const errors = validateOSPFNetwork(localNetworkFormData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      addNetwork(localNetworkFormData);
      setShowAddNetworkForm(false);
      setLocalNetworkFormData(defaultNetworkFormData);
      setValidationErrors({});
    } catch (error) {
      setValidationErrors({
        network: error instanceof Error ? error.message : 'Failed to add network',
      });
    }
  };

  const handleRemoveNetwork = (network: string, wildcardMask: string) => {
    try {
      removeNetwork(network, wildcardMask);
    } catch {
      // Error handled silently
    }
  };

  const handleCancelNetworkForm = () => {
    setShowAddNetworkForm(false);
    setLocalNetworkFormData(defaultNetworkFormData);
    setValidationErrors({});
  };

  const handleRouterIDBlur = () => {
    if (validateIPAddress(localRouterID)) {
      setRouterID(localRouterID);
    }
  };

  const handleProcessIDBlur = () => {
    const pid = parseInt(localProcessID, 10);
    if (!Number.isNaN(pid) && pid >= 1 && pid <= 65535) {
      setProcessID(pid);
    } else {
      setLocalProcessID(processID.toString());
    }
  };

  const allNetworks = getAllNetworks();
  const allNeighbors = getAllNeighbors();
  const ospfInterfaces = getOspfInterfaces();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OSPF Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="ospf-enable">Enable OSPF Service</Label>
              <p className="text-muted-foreground text-xs">
                Activate OSPF dynamic routing protocol
              </p>
            </div>
            <Switch
              id="ospf-enable"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="process-id">Process ID (1-65535)</Label>
                  <Input
                    id="process-id"
                    type="number"
                    min="1"
                    max="65535"
                    value={localProcessID}
                    onChange={(e) => setLocalProcessID(e.target.value)}
                    onBlur={handleProcessIDBlur}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="router-id">Router ID</Label>
                  <Input
                    id="router-id"
                    type="text"
                    placeholder="0.0.0.0"
                    value={localRouterID}
                    onChange={(e) => setLocalRouterID(e.target.value)}
                    onBlur={handleRouterIDBlur}
                    className={
                      localRouterID && !validateIPAddress(localRouterID)
                        ? 'border-destructive'
                        : ''
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    Unique identifier for this router (IP format)
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {enabled && (
        <Tabs defaultValue="networks" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="networks">Networks</TabsTrigger>
            <TabsTrigger value="neighbors">Neighbors</TabsTrigger>
            <TabsTrigger value="interfaces">Interfaces</TabsTrigger>
          </TabsList>

          <TabsContent value="networks" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Network Statements</CardTitle>
                <Button
                  onClick={() => {
                    setShowAddNetworkForm(true);
                    setLocalNetworkFormData(defaultNetworkFormData);
                  }}
                  variant="outline"
                  size="sm"
                >
                  Add Network
                </Button>
              </CardHeader>
              <CardContent>
                {allNetworks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">
                    No network statements configured
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Network</TableHead>
                        <TableHead>Wildcard Mask</TableHead>
                        <TableHead>Area ID</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allNetworks.map((net, index) => (
                        <TableRow key={`${net.network}-${net.wildcardMask}-${index}`}>
                          <TableCell className="font-mono text-xs">
                            {net.network}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {net.wildcardMask}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {net.areaID}
                          </TableCell>
                          <TableCell>
                            <Button
                              onClick={() =>
                                handleRemoveNetwork(net.network, net.wildcardMask)
                              }
                              variant="ghost"
                              size="sm"
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {showAddNetworkForm && (
              <Card>
                <CardHeader>
                  <CardTitle>Add Network Statement</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="network">Network Address</Label>
                      <Input
                        id="network"
                        type="text"
                        placeholder="0.0.0.0"
                        value={localNetworkFormData.network}
                        onChange={(e) =>
                          handleNetworkInputChange('network', e.target.value)
                        }
                        className={
                          validationErrors.network ? 'border-destructive' : ''
                        }
                      />
                      {validationErrors.network && (
                        <p className="text-destructive text-xs">
                          {validationErrors.network}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wildcard">Wildcard Mask</Label>
                      <Input
                        id="wildcard"
                        type="text"
                        placeholder="0.0.0.255"
                        value={localNetworkFormData.wildcardMask}
                        onChange={(e) =>
                          handleNetworkInputChange('wildcardMask', e.target.value)
                        }
                        className={
                          validationErrors.wildcardMask ? 'border-destructive' : ''
                        }
                      />
                      {validationErrors.wildcardMask && (
                        <p className="text-destructive text-xs">
                          {validationErrors.wildcardMask}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Inverse of subnet mask
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="area">Area ID</Label>
                      <Input
                        id="area"
                        type="text"
                        placeholder="0.0.0.0"
                        value={localNetworkFormData.areaID}
                        onChange={(e) =>
                          handleNetworkInputChange('areaID', e.target.value)
                        }
                        className={
                          validationErrors.areaID ? 'border-destructive' : ''
                        }
                      />
                      {validationErrors.areaID && (
                        <p className="text-destructive text-xs">
                          {validationErrors.areaID}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Area 0 = backbone
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveNetwork}>Add Network</Button>
                    <Button variant="outline" onClick={handleCancelNetworkForm}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="neighbors">
            <Card>
              <CardHeader>
                <CardTitle>OSPF Neighbors</CardTitle>
              </CardHeader>
              <CardContent>
                {allNeighbors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">
                    No OSPF neighbors discovered
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Router ID</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>DR</TableHead>
                        <TableHead>BDR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allNeighbors.map((neighbor) => (
                        <TableRow key={neighbor.neighborID}>
                          <TableCell className="font-mono text-xs">
                            {neighbor.neighborID}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {neighbor.neighborIP}
                          </TableCell>
                          <TableCell>{neighbor.priority}</TableCell>
                          <TableCell>
                            <Badge variant={getStateBadgeVariant(neighbor.state)}>
                              {getStateString(neighbor.state)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {neighbor.designatedRouter !== '0.0.0.0'
                              ? neighbor.designatedRouter
                              : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {neighbor.backupDesignatedRouter !== '0.0.0.0'
                              ? neighbor.backupDesignatedRouter
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interfaces">
            <Card>
              <CardHeader>
                <CardTitle>OSPF-Enabled Interfaces</CardTitle>
              </CardHeader>
              <CardContent>
                {ospfInterfaces.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">
                    No interfaces enabled for OSPF. Add network statements to enable
                    interfaces.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Interface</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Timers</TableHead>
                        <TableHead>Neighbors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ospfInterfaces.map((iface) => (
                        <TableRow key={iface.interfaceName}>
                          <TableCell className="font-medium">
                            {iface.interfaceName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {iface.ipAddress}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {iface.areaID}
                          </TableCell>
                          <TableCell>{iface.priority}</TableCell>
                          <TableCell>{iface.cost}</TableCell>
                          <TableCell className="text-xs">
                            Hello: {iface.helloInterval}s
                            <br />
                            Dead: {iface.deadInterval}s
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{iface.neighbors.length}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

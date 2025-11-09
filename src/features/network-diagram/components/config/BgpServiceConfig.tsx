/**
 * BGP Service Configuration Component
 * Provides UI for configuring BGP (Border Gateway Protocol) settings
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import type { RouterHost } from '../../lib/network-simulator/nodes/router';
import type { Network } from '../../lib/network-simulator/network';
import useBgpService from '../../hooks/useBgpService';

interface BgpServiceConfigProps {
  node: RouterHost;
  network?: Network | null;
}

export default function BgpServiceConfig({
  node,
  network,
}: BgpServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    localAS,
    setLocalAS,
    getAllNeighbors,
    getAllRoutes,
    addNeighbor,
    removeNeighbor,
    getConfiguration,
    clearRoutes,
    getRouterID,
  } = useBgpService(node, network);

  const neighbors = getAllNeighbors();
  const routes = getAllRoutes();
  const config = getConfiguration();
  const routerID = getRouterID();

  // Dialog state for adding neighbor
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newNeighborIP, setNewNeighborIP] = useState('');
  const [newRemoteAS, setNewRemoteAS] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Dialog state for removing neighbor
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [neighborToDelete, setNeighborToDelete] = useState<string | null>(null);

  const handleAddNeighbor = () => {
    try {
      const asNumber = parseInt(newRemoteAS, 10);
      if (Number.isNaN(asNumber) || asNumber < 0 || asNumber > 65535) {
        // eslint-disable-next-line no-alert
        alert('AS number must be between 0 and 65535');
        return;
      }

      addNeighbor(newNeighborIP, asNumber, newDescription || undefined);
      setDialogOpen(false);
      setNewNeighborIP('');
      setNewRemoteAS('');
      setNewDescription('');
    } catch (error) {
      // eslint-disable-next-line no-alert
      alert(`Failed to add neighbor: ${error}`);
    }
  };

  const handleRemoveNeighbor = () => {
    if (neighborToDelete) {
      try {
        removeNeighbor(neighborToDelete);
        setDeleteDialogOpen(false);
        setNeighborToDelete(null);
      } catch (error) {
        // eslint-disable-next-line no-alert
        alert(`Failed to remove neighbor: ${error}`);
      }
    }
  };

  const handleClearRoutes = () => {
    clearRoutes();
  };

  const handleLocalASChange = (value: string) => {
    const asNumber = parseInt(value, 10);
    if (!Number.isNaN(asNumber) && asNumber >= 0 && asNumber <= 65535) {
      setLocalAS(asNumber);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>BGP Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="bgp-enable">Enable BGP Service</Label>
              <p className="text-muted-foreground text-xs">
                Activate Border Gateway Protocol for inter-domain routing
              </p>
            </div>
            <Switch
              id="bgp-enable"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="local-as">Local AS Number</Label>
            <Input
              id="local-as"
              type="number"
              min="0"
              max="65535"
              value={localAS}
              onChange={(e) => handleLocalASChange(e.target.value)}
              placeholder="65000"
            />
            <p className="text-muted-foreground text-xs">
              Autonomous System number for this router (0-65535)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Router ID</Label>
            <p className="font-mono text-xs">{routerID}</p>
            <p className="text-muted-foreground text-xs">
              Automatically set to highest interface IP address
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hold Time</Label>
              <p className="text-muted-foreground text-xs">
                {config.holdTime}s (session timeout)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Keepalive Time</Label>
              <p className="text-muted-foreground text-xs">
                {config.keepaliveTime}s (keepalive interval)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>BGP Neighbors</CardTitle>
              <div className="flex gap-2">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      Add Neighbor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add BGP Neighbor</DialogTitle>
                      <DialogDescription>
                        Configure a new BGP peer relationship
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="neighbor-ip">Neighbor IP Address</Label>
                        <Input
                          id="neighbor-ip"
                          value={newNeighborIP}
                          onChange={(e) => setNewNeighborIP(e.target.value)}
                          placeholder="192.168.1.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remote-as">Remote AS Number</Label>
                        <Input
                          id="remote-as"
                          type="number"
                          min="0"
                          max="65535"
                          value={newRemoteAS}
                          onChange={(e) => setNewRemoteAS(e.target.value)}
                          placeholder="65001"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">
                          Description (optional)
                        </Label>
                        <Input
                          id="description"
                          value={newDescription}
                          onChange={(e) => setNewDescription(e.target.value)}
                          placeholder="ISP Peer"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleAddNeighbor}>Add Neighbor</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {neighbors.length > 0 && (
                  <Badge variant="secondary">
                    {neighbors.filter((n) => n.state === 5).length} of{' '}
                    {neighbors.length} established
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {neighbors.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  No BGP neighbors configured. Add a neighbor to start.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Neighbor IP</TableHead>
                      <TableHead>Remote AS</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Prefixes</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {neighbors.map((neighbor) => (
                      <TableRow key={neighbor.neighborIP}>
                        <TableCell className="font-mono text-xs">
                          {neighbor.neighborIP}
                        </TableCell>
                        <TableCell>{neighbor.remoteAS}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              neighbor.state === 5 ? 'default' : 'outline'
                            }
                          >
                            {neighbor.stateName}
                          </Badge>
                        </TableCell>
                        <TableCell>{neighbor.prefixesReceived}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {neighbor.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Dialog
                            open={
                              deleteDialogOpen &&
                              neighborToDelete === neighbor.neighborIP
                            }
                            onOpenChange={(open) => {
                              setDeleteDialogOpen(open);
                              if (!open) setNeighborToDelete(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                onClick={() =>
                                  setNeighborToDelete(neighbor.neighborIP)
                                }
                                variant="ghost"
                                size="sm"
                              >
                                Remove
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Remove BGP Neighbor</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to remove neighbor{' '}
                                  {neighbor.neighborIP}? This will delete all
                                  routes learned from this peer.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setDeleteDialogOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={handleRemoveNeighbor}
                                >
                                  Remove Neighbor
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>BGP Routing Table</CardTitle>
              <div className="flex gap-2">
                {routes.length > 0 && (
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
              {routes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  {neighbors.length === 0
                    ? 'Add BGP neighbors to start learning routes'
                    : 'No BGP routes learned yet. Waiting for neighbor establishment...'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Network</TableHead>
                      <TableHead>Next Hop</TableHead>
                      <TableHead>From Neighbor</TableHead>
                      <TableHead>Local Pref</TableHead>
                      <TableHead>MED</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route) => (
                      <TableRow
                        key={`${route.network}/${route.prefixLength}-${route.nextHop}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {route.network}/{route.prefixLength}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {route.nextHop}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {route.fromNeighbor}
                        </TableCell>
                        <TableCell>{route.localPref}</TableCell>
                        <TableCell>{route.med}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {neighbors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>BGP Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Total Neighbors:</span>{' '}
                    {neighbors.length}
                  </div>
                  <div>
                    <span className="font-medium">Established:</span>{' '}
                    {neighbors.filter((n) => n.state === 5).length}
                  </div>
                  <div>
                    <span className="font-medium">Total Routes:</span>{' '}
                    {routes.length}
                  </div>
                  <div>
                    <span className="font-medium">Local AS:</span> {localAS}
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

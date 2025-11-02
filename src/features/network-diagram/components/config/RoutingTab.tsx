/**
 * Routing Tab Component
 * Displays and edits routing table for RouterHost devices
 */

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IPAddress } from '../../lib/network-simulator/address';
import type { RouterHost } from '../../lib/network-simulator/nodes/router';

interface RoutingTabProps {
  node: RouterHost;
}

export default function RoutingTab({ node }: RoutingTabProps) {
  // Form state for adding new routes
  const [newNetwork, setNewNetwork] = useState('');
  const [newMask, setNewMask] = useState('');
  const [newGateway, setNewGateway] = useState('');

  // Error states
  const [networkError, setNetworkError] = useState('');
  const [maskError, setMaskError] = useState('');
  const [gatewayError, setGatewayError] = useState('');
  const [addError, setAddError] = useState('');

  // Force re-render when routing table changes
  const [, setRefresh] = useState(0);

  // Add route handler
  const handleAddRoute = () => {
    // Reset errors
    setNetworkError('');
    setMaskError('');
    setGatewayError('');
    setAddError('');

    // Validate all fields are filled
    if (!newNetwork.trim() || !newMask.trim() || !newGateway.trim()) {
      setAddError('All fields are required');
      return;
    }

    // Validate IP addresses
    let isValid = true;

    try {
      new IPAddress(newNetwork);
    } catch {
      setNetworkError('Invalid network address (expected: a.b.c.d)');
      isValid = false;
    }

    try {
      new IPAddress(newMask, true);
    } catch {
      setMaskError('Invalid subnet mask (e.g., 255.255.255.0)');
      isValid = false;
    }

    try {
      new IPAddress(newGateway);
    } catch {
      setGatewayError('Invalid gateway address (expected: a.b.c.d)');
      isValid = false;
    }

    if (!isValid) return;

    // Try to add the route
    try {
      node.addRoute(newNetwork, newMask, newGateway);

      // Clear form on success
      setNewNetwork('');
      setNewMask('');
      setNewGateway('');

      // Force re-render to show new route
      setRefresh((prev) => prev + 1);
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : 'Failed to add route'
      );
    }
  };

  // Delete route handler
  const handleDeleteRoute = (
    network: string,
    mask: string,
    gateway: string
  ) => {
    try {
      node.deleteRoute(network, mask, gateway);

      // Force re-render to update table
      setRefresh((prev) => prev + 1);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete route:', error);
    }
  };

  // Handle Enter key in form inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddRoute();
    }
  };

  return (
    <div className="space-y-4">
      {/* Routing Table Display Card */}
      <Card>
        <CardHeader>
          <CardTitle>Routing Table</CardTitle>
        </CardHeader>
        <CardContent>
          {node.RoutingTable.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No routes configured. Add a route below to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Network</TableHead>
                  <TableHead>Subnet Mask</TableHead>
                  <TableHead>Gateway</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {node.RoutingTable.map((route, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono">
                      {route.network.toString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {route.mask.toString()}
                    </TableCell>
                    <TableCell className="font-mono">
                      {route.gateway.toString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleDeleteRoute(
                            route.network.toString(),
                            route.mask.toString(),
                            route.gateway.toString()
                          )
                        }
                        className="h-8 w-8"
                        aria-label="Delete route"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Route Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add Route</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input fields in a grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Network Address */}
            <div className="space-y-2">
              <Label htmlFor="route-network">Network</Label>
              <Input
                id="route-network"
                value={newNetwork}
                onChange={(e) => {
                  setNewNetwork(e.target.value);
                  setNetworkError('');
                  setAddError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="192.168.1.0"
                aria-invalid={!!networkError}
                className={networkError ? 'border-destructive' : ''}
              />
              {networkError && (
                <p className="text-destructive text-sm">{networkError}</p>
              )}
            </div>

            {/* Subnet Mask */}
            <div className="space-y-2">
              <Label htmlFor="route-mask">Subnet</Label>
              <Input
                id="route-mask"
                value={newMask}
                onChange={(e) => {
                  setNewMask(e.target.value);
                  setMaskError('');
                  setAddError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="255.255.255.0"
                aria-invalid={!!maskError}
                className={maskError ? 'border-destructive' : ''}
              />
              {maskError && (
                <p className="text-destructive text-sm">{maskError}</p>
              )}
            </div>

            {/* Gateway */}
            <div className="space-y-2">
              <Label htmlFor="route-gateway">Gateway</Label>
              <Input
                id="route-gateway"
                value={newGateway}
                onChange={(e) => {
                  setNewGateway(e.target.value);
                  setGatewayError('');
                  setAddError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="192.168.1.1"
                aria-invalid={!!gatewayError}
                className={gatewayError ? 'border-destructive' : ''}
              />
              {gatewayError && (
                <p className="text-destructive text-sm">{gatewayError}</p>
              )}
            </div>
          </div>

          {/* Add Error Message */}
          {addError && <p className="text-destructive text-sm">{addError}</p>}

          {/* Add Button */}
          <Button onClick={handleAddRoute} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

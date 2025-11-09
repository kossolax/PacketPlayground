/**
 * VLAN Database Tab Component
 * Displays and edits VLAN database for SwitchHost devices
 */

import { useState } from 'react';
import { Trash2, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SwitchHost } from '../../lib/network-simulator/nodes/switch';
import useVlanDatabase from '../../hooks/useVlanDatabase';

interface VlanDatabaseTabProps {
  node: SwitchHost;
}

export default function VlanDatabaseTab({ node }: VlanDatabaseTabProps) {
  const { vlans, addVlan, deleteVlan } = useVlanDatabase(node);

  // Form state for adding new VLANs
  const [newVlanId, setNewVlanId] = useState('');
  const [newVlanName, setNewVlanName] = useState('');

  // Error states
  const [vlanIdError, setVlanIdError] = useState('');
  const [vlanNameError, setVlanNameError] = useState('');
  const [addError, setAddError] = useState('');

  // Add VLAN handler
  const handleAddVlan = () => {
    // Reset errors
    setVlanIdError('');
    setVlanNameError('');
    setAddError('');

    // Validate all fields are filled
    if (!newVlanId.trim() || !newVlanName.trim()) {
      setAddError('All fields are required');
      return;
    }

    // Validate VLAN ID
    let isValid = true;
    const vlanId = parseInt(newVlanId, 10);

    if (Number.isNaN(vlanId)) {
      setVlanIdError('VLAN ID must be a number');
      isValid = false;
    } else if (vlanId < 1 || vlanId > 4094) {
      setVlanIdError('VLAN ID must be between 1 and 4094');
      isValid = false;
    }

    if (!isValid) return;

    // Try to add the VLAN
    try {
      addVlan(vlanId, newVlanName.trim());

      // Clear form on success
      setNewVlanId('');
      setNewVlanName('');
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : 'Failed to add VLAN'
      );
    }
  };

  // Delete VLAN handler
  const handleDeleteVlan = (vlanId: number) => {
    try {
      deleteVlan(vlanId);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete VLAN:', error);
    }
  };

  // Handle Enter key in form inputs
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddVlan();
    }
  };

  return (
    <div className="space-y-4">
      {/* VLAN Database Display Card */}
      <Card>
        <CardHeader>
          <CardTitle>VLAN Database</CardTitle>
        </CardHeader>
        <CardContent>
          {vlans.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No VLANs configured. Add a VLAN below to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">VLAN ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vlans.map((vlan) => (
                  <TableRow key={vlan.id}>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {vlan.id}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{vlan.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVlan(vlan.id)}
                        className="h-8 w-8"
                        aria-label={`Delete VLAN ${vlan.id}`}
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

      {/* Add VLAN Card */}
      <Card>
        <CardHeader>
          <CardTitle>Add VLAN</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input fields in a grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* VLAN ID */}
            <div className="space-y-2">
              <Label htmlFor="vlan-id">VLAN ID</Label>
              <Input
                id="vlan-id"
                value={newVlanId}
                onChange={(e) => {
                  setNewVlanId(e.target.value);
                  setVlanIdError('');
                  setAddError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="10"
                type="number"
                min="1"
                max="4094"
                aria-invalid={!!vlanIdError}
                className={vlanIdError ? 'border-destructive' : ''}
              />
              {vlanIdError && (
                <p className="text-destructive text-sm">{vlanIdError}</p>
              )}
            </div>

            {/* VLAN Name */}
            <div className="space-y-2">
              <Label htmlFor="vlan-name">Name</Label>
              <Input
                id="vlan-name"
                value={newVlanName}
                onChange={(e) => {
                  setNewVlanName(e.target.value);
                  setVlanNameError('');
                  setAddError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="SALES"
                aria-invalid={!!vlanNameError}
                className={vlanNameError ? 'border-destructive' : ''}
              />
              {vlanNameError && (
                <p className="text-destructive text-sm">{vlanNameError}</p>
              )}
            </div>
          </div>

          {/* Add Error Message */}
          {addError && <p className="text-destructive text-sm">{addError}</p>}

          {/* Add Button */}
          <Button onClick={handleAddVlan} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add VLAN
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

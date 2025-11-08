/**
 * FHRP (HSRP) Service Configuration Component
 * Provides UI for configuring Cisco HSRP (Hot Standby Router Protocol) settings
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Separator } from '@/components/ui/separator';
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
import useHsrpService, {
  type HSRPGroupFormData,
} from '../../hooks/useHsrpService';
import { IPAddress } from '../../lib/network-simulator/address';
import { HSRPState } from '../../lib/network-simulator/protocols/hsrp';

interface ValidationErrors {
  virtualIP?: string;
  group?: string;
  priority?: string;
  hellotime?: string;
  holdtime?: string;
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

function validateHSRPGroup(formData: HSRPGroupFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!validateIPAddress(formData.virtualIP)) {
    errors.virtualIP = 'Invalid IP address format';
  }

  if (formData.group < 0 || formData.group > 255) {
    errors.group = 'Group must be between 0 and 255';
  }

  if (formData.priority < 0 || formData.priority > 255) {
    errors.priority = 'Priority must be between 0 and 255';
  }

  if (formData.hellotime < 1 || formData.hellotime > 255) {
    errors.hellotime = 'Hello time must be between 1 and 255 seconds';
  }

  if (formData.holdtime < 1 || formData.holdtime > 255) {
    errors.holdtime = 'Hold time must be between 1 and 255 seconds';
  }

  if (formData.holdtime <= formData.hellotime) {
    errors.holdtime = 'Hold time must be greater than hello time';
  }

  return errors;
}

function getStateBadgeVariant(
  state: HSRPState
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (state) {
    case HSRPState.Active:
      return 'default';
    case HSRPState.Standby:
      return 'secondary';
    case HSRPState.Initial:
    case HSRPState.Learn:
      return 'destructive';
    default:
      return 'outline';
  }
}

interface FhrpServiceConfigProps {
  node: RouterHost;
  network?: Network | null;
}

export default function FhrpServiceConfig({
  node,
  network,
}: FhrpServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    selectedInterface,
    setSelectedInterface,
    getAllGroups,
    getGroupsForInterface,
    setGroup,
    removeGroup,
    getGroupFormData,
    getInterfaces,
    getStateString,
  } = useHsrpService(node, network);

  const interfaces = getInterfaces();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{
    interfaceName: string;
    groupNum: number;
  } | null>(null);

  const defaultFormData: HSRPGroupFormData = {
    interfaceName: interfaces[0] || '',
    group: 0,
    virtualIP: '192.168.1.254',
    priority: 100,
    preempt: false,
    hellotime: 3,
    holdtime: 10,
    authentication: 'cisco',
  };

  const [localFormData, setLocalFormData] =
    useState<HSRPGroupFormData>(defaultFormData);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );

  // Update form when editing a group
  useEffect(() => {
    if (editingGroup) {
      const formData = getGroupFormData(
        editingGroup.interfaceName,
        editingGroup.groupNum
      );
      if (formData) {
        setLocalFormData(formData);
        setValidationErrors(validateHSRPGroup(formData));
      }
    }
  }, [editingGroup, getGroupFormData]);

  const handleInputChange = (
    field: keyof HSRPGroupFormData,
    value: string | number | boolean
  ) => {
    const newFormData = { ...localFormData, [field]: value };
    setLocalFormData(newFormData);

    const errors = validateHSRPGroup(newFormData);
    setValidationErrors(errors);
  };

  const handleSaveGroup = () => {
    const errors = validateHSRPGroup(localFormData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setGroup(localFormData);
      setShowAddForm(false);
      setEditingGroup(null);
      setLocalFormData(defaultFormData);
    } catch {
      // Error handled silently
    }
  };

  const handleEditGroup = (interfaceName: string, groupNum: number) => {
    setEditingGroup({ interfaceName, groupNum });
    setShowAddForm(true);
  };

  const handleRemoveGroup = (interfaceName: string, groupNum: number) => {
    try {
      removeGroup(interfaceName, groupNum);
    } catch {
      // Error handled silently
    }
  };

  const handleCancelForm = () => {
    setShowAddForm(false);
    setEditingGroup(null);
    setLocalFormData(defaultFormData);
    setValidationErrors({});
  };

  const allGroups = getAllGroups();
  const filteredGroups = selectedInterface
    ? getGroupsForInterface(selectedInterface)
    : allGroups;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>FHRP Configuration (HSRP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="fhrp-enable">Enable HSRP Service</Label>
              <p className="text-muted-foreground text-xs">
                Activate Cisco HSRP for gateway redundancy
              </p>
            </div>
            <Switch
              id="fhrp-enable"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && interfaces.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      {enabled && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>HSRP Groups</CardTitle>
              <Button
                onClick={() => {
                  setShowAddForm(true);
                  setEditingGroup(null);
                  setLocalFormData(defaultFormData);
                }}
                variant="outline"
                size="sm"
                disabled={interfaces.length === 0}
              >
                Add Group
              </Button>
            </CardHeader>
            <CardContent>
              {filteredGroups.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  No HSRP groups configured
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Interface</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Virtual IP</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Virtual MAC</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => (
                      <TableRow key={`${group.interfaceName}-${group.group}`}>
                        <TableCell className="font-medium">
                          {group.interfaceName}
                        </TableCell>
                        <TableCell>{group.group}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {group.virtualIP}
                        </TableCell>
                        <TableCell>{group.priority}</TableCell>
                        <TableCell>
                          <Badge variant={getStateBadgeVariant(group.state)}>
                            {getStateString(group.state)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {group.virtualMAC}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              onClick={() =>
                                handleEditGroup(
                                  group.interfaceName,
                                  group.group
                                )
                              }
                              variant="ghost"
                              size="sm"
                            >
                              Edit
                            </Button>
                            <Button
                              onClick={() =>
                                handleRemoveGroup(
                                  group.interfaceName,
                                  group.group
                                )
                              }
                              variant="ghost"
                              size="sm"
                            >
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingGroup ? 'Edit HSRP Group' : 'Add HSRP Group'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interface">Interface</Label>
                    <Select
                      value={localFormData.interfaceName}
                      onValueChange={(value) =>
                        handleInputChange('interfaceName', value)
                      }
                      disabled={!!editingGroup}
                    >
                      <SelectTrigger id="interface">
                        <SelectValue placeholder="Select interface" />
                      </SelectTrigger>
                      <SelectContent>
                        {interfaces.map((iface) => (
                          <SelectItem key={iface} value={iface}>
                            {iface}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="group">Group Number (0-255)</Label>
                    <Input
                      id="group"
                      type="number"
                      min="0"
                      max="255"
                      value={localFormData.group}
                      onChange={(e) =>
                        handleInputChange('group', parseInt(e.target.value, 10))
                      }
                      disabled={!!editingGroup}
                      className={
                        validationErrors.group ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.group && (
                      <p className="text-destructive text-xs">
                        {validationErrors.group}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="virtualIP">Virtual IP Address</Label>
                    <Input
                      id="virtualIP"
                      value={localFormData.virtualIP}
                      onChange={(e) =>
                        handleInputChange('virtualIP', e.target.value)
                      }
                      placeholder="192.168.1.254"
                      className={
                        validationErrors.virtualIP ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.virtualIP && (
                      <p className="text-destructive text-xs">
                        {validationErrors.virtualIP}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority (0-255)</Label>
                    <Input
                      id="priority"
                      type="number"
                      min="0"
                      max="255"
                      value={localFormData.priority}
                      onChange={(e) =>
                        handleInputChange(
                          'priority',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className={
                        validationErrors.priority ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.priority && (
                      <p className="text-destructive text-xs">
                        {validationErrors.priority}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Higher priority = more likely to become active (default:
                      100)
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hellotime">Hello Time (sec)</Label>
                    <Input
                      id="hellotime"
                      type="number"
                      min="1"
                      max="255"
                      value={localFormData.hellotime}
                      onChange={(e) =>
                        handleInputChange(
                          'hellotime',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className={
                        validationErrors.hellotime ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.hellotime && (
                      <p className="text-destructive text-xs">
                        {validationErrors.hellotime}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="holdtime">Hold Time (sec)</Label>
                    <Input
                      id="holdtime"
                      type="number"
                      min="1"
                      max="255"
                      value={localFormData.holdtime}
                      onChange={(e) =>
                        handleInputChange(
                          'holdtime',
                          parseInt(e.target.value, 10)
                        )
                      }
                      className={
                        validationErrors.holdtime ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.holdtime && (
                      <p className="text-destructive text-xs">
                        {validationErrors.holdtime}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="preempt"
                      checked={localFormData.preempt}
                      onCheckedChange={(checked) =>
                        handleInputChange('preempt', checked)
                      }
                    />
                    <Label htmlFor="preempt">Preempt</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authentication">Authentication</Label>
                  <Input
                    id="authentication"
                    value={localFormData.authentication}
                    onChange={(e) =>
                      handleInputChange('authentication', e.target.value)
                    }
                    placeholder="cisco"
                    maxLength={8}
                  />
                  <p className="text-muted-foreground text-xs">
                    Plain text authentication (max 8 characters)
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button onClick={handleCancelForm} variant="outline">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveGroup}
                    disabled={Object.keys(validationErrors).length > 0}
                  >
                    {editingGroup ? 'Update' : 'Add'} Group
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>HSRP Status Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredGroups.map((group) => (
                    <div
                      key={`${group.interfaceName}-${group.group}`}
                      className="border-border rounded-lg border p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="font-semibold">
                          {group.interfaceName} - Group {group.group}
                        </h4>
                        <Badge variant={getStateBadgeVariant(group.state)}>
                          {getStateString(group.state)}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="font-medium">Virtual IP:</span>{' '}
                          <span className="font-mono">{group.virtualIP}</span>
                        </div>
                        <div>
                          <span className="font-medium">Virtual MAC:</span>{' '}
                          <span className="font-mono">{group.virtualMAC}</span>
                        </div>
                        <div>
                          <span className="font-medium">Priority:</span>{' '}
                          {group.priority}
                        </div>
                        <div>
                          <span className="font-medium">Preempt:</span>{' '}
                          {group.preempt ? 'Enabled' : 'Disabled'}
                        </div>
                        {group.activeRouter && (
                          <div>
                            <span className="font-medium">Active Router:</span>{' '}
                            <span className="font-mono">
                              {group.activeRouter}
                            </span>
                          </div>
                        )}
                        {group.standbyRouter && (
                          <div>
                            <span className="font-medium">Standby Router:</span>{' '}
                            <span className="font-mono">
                              {group.standbyRouter}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

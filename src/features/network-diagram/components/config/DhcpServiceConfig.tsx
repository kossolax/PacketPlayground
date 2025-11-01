/**
 * DHCP Service Configuration Component
 * Provides UI for configuring DHCP server settings including pools and addresses
 */

import { useState } from 'react';
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
import type { ServerHost } from '../../lib/network-simulator/nodes/server';
import useDhcpService from '../../hooks/useDhcpService';
import { IPAddress } from '../../lib/network-simulator/address';

interface ValidationErrors {
  gateway?: string;
  netmask?: string;
  startIp?: string;
  endIp?: string;
  dns?: string;
  tftp?: string;
  wlc?: string;
}

function validateIPAddress(ip: string): boolean {
  if (!ip || ip === '0.0.0.0') return true;
  try {
    const validIp = new IPAddress(ip);
    return !!validIp;
  } catch {
    return false;
  }
}

function validatePool(
  gateway: string,
  netmask: string,
  startIp: string,
  endIp: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!validateIPAddress(gateway)) {
    errors.gateway = 'Invalid IP address format';
  }
  if (!validateIPAddress(netmask)) {
    errors.netmask = 'Invalid subnet mask format';
  }
  if (!validateIPAddress(startIp)) {
    errors.startIp = 'Invalid IP address format';
  }
  if (!validateIPAddress(endIp)) {
    errors.endIp = 'Invalid IP address format';
  }

  // Validate that start and end are in the same network as gateway
  if (!errors.gateway && !errors.netmask && !errors.startIp) {
    try {
      const gw = new IPAddress(gateway);
      const mask = new IPAddress(netmask);
      const start = new IPAddress(startIp);
      if (!gw.InSameNetwork(mask, start)) {
        errors.startIp = 'Start IP must be in the same network as gateway';
      }
    } catch {
      // Already handled by format validation
    }
  }

  if (!errors.gateway && !errors.netmask && !errors.endIp) {
    try {
      const gw = new IPAddress(gateway);
      const mask = new IPAddress(netmask);
      const end = new IPAddress(endIp);
      if (!gw.InSameNetwork(mask, end)) {
        errors.endIp = 'End IP must be in the same network as gateway';
      }
    } catch {
      // Already handled by format validation
    }
  }

  return errors;
}

interface DhcpServiceConfigProps {
  node: ServerHost;
}

export default function DhcpServiceConfig({ node }: DhcpServiceConfigProps) {
  const {
    enabled,
    setEnabled,
    pools,
    selectedPoolIndex,
    setSelectedPoolIndex,
    selectedPool,
    getPoolFormData,
    addPool,
    removePool,
    updatePool,
  } = useDhcpService(node);

  const formData = getPoolFormData(selectedPool);
  const [localFormData, setLocalFormData] = useState(formData);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>(
    {}
  );

  // Update local form when selected pool changes
  const handlePoolChange = (value: string) => {
    const index = parseInt(value, 10);
    setSelectedPoolIndex(index);
    const newFormData = getPoolFormData(pools[index]);
    setLocalFormData(newFormData);
    setValidationErrors(
      validatePool(
        newFormData.gateway,
        newFormData.netmask,
        newFormData.startIp,
        newFormData.endIp
      )
    );
  };

  const handleInputChange = (
    field: keyof typeof localFormData,
    value: string
  ) => {
    const newFormData = { ...localFormData, [field]: value };
    setLocalFormData(newFormData);

    // Validate
    const errors = validatePool(
      newFormData.gateway,
      newFormData.netmask,
      newFormData.startIp,
      newFormData.endIp
    );

    // Validate optional services
    if (newFormData.dns && !validateIPAddress(newFormData.dns)) {
      errors.dns = 'Invalid IP address format';
    }
    if (newFormData.tftp && !validateIPAddress(newFormData.tftp)) {
      errors.tftp = 'Invalid IP address format';
    }
    if (newFormData.wlc && !validateIPAddress(newFormData.wlc)) {
      errors.wlc = 'Invalid IP address format';
    }

    setValidationErrors(errors);

    // Auto-save only if no errors
    if (selectedPoolIndex !== null && Object.keys(errors).length === 0) {
      try {
        updatePool(selectedPoolIndex, newFormData);
      } catch {
        // Pool update failed - silently handled
      }
    }
  };

  const handleAddPool = () => {
    addPool();
    setLocalFormData(getPoolFormData(pools[pools.length]));
  };

  const handleRemovePool = () => {
    if (selectedPoolIndex !== null) {
      removePool(selectedPoolIndex);
      if (pools.length > 1) {
        const newIndex = selectedPoolIndex === 0 ? 0 : selectedPoolIndex - 1;
        setLocalFormData(getPoolFormData(pools[newIndex]));
      } else {
        setLocalFormData(getPoolFormData(null));
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DHCP Server Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="dhcp-enable">Enable DHCP Service</Label>
              <p className="text-muted-foreground text-xs">
                Activate DHCP server to provide IP addresses to clients
              </p>
            </div>
            <Switch
              id="dhcp-enable"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Pool Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="pool-select">Select Pool</Label>
                <Select
                  value={selectedPoolIndex?.toString() || ''}
                  onValueChange={handlePoolChange}
                  disabled={pools.length === 0}
                >
                  <SelectTrigger id="pool-select">
                    <SelectValue placeholder="No pools available" />
                  </SelectTrigger>
                  <SelectContent>
                    {pools.map((pool, index) => (
                      <SelectItem key={pool.name} value={index.toString()}>
                        {pool.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleAddPool} variant="outline" size="sm">
                  Add Pool
                </Button>
                <Button
                  onClick={handleRemovePool}
                  variant="outline"
                  size="sm"
                  disabled={pools.length === 0}
                >
                  Remove
                </Button>
              </div>
            </div>

            {selectedPool && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pool-name">Pool Name</Label>
                  <Input
                    id="pool-name"
                    value={localFormData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Pool1"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gateway">Gateway Address</Label>
                    <Input
                      id="gateway"
                      value={localFormData.gateway}
                      onChange={(e) =>
                        handleInputChange('gateway', e.target.value)
                      }
                      placeholder="192.168.1.1"
                      className={
                        validationErrors.gateway ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.gateway && (
                      <p className="text-destructive text-xs">
                        {validationErrors.gateway}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="netmask">Subnet Mask</Label>
                    <Input
                      id="netmask"
                      value={localFormData.netmask}
                      onChange={(e) =>
                        handleInputChange('netmask', e.target.value)
                      }
                      placeholder="255.255.255.0"
                      className={
                        validationErrors.netmask ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.netmask && (
                      <p className="text-destructive text-xs">
                        {validationErrors.netmask}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="start-ip">Start IP Address</Label>
                    <Input
                      id="start-ip"
                      value={localFormData.startIp}
                      onChange={(e) =>
                        handleInputChange('startIp', e.target.value)
                      }
                      placeholder="192.168.1.10"
                      className={
                        validationErrors.startIp ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.startIp && (
                      <p className="text-destructive text-xs">
                        {validationErrors.startIp}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-ip">End IP Address</Label>
                    <Input
                      id="end-ip"
                      value={localFormData.endIp}
                      onChange={(e) =>
                        handleInputChange('endIp', e.target.value)
                      }
                      placeholder="192.168.1.100"
                      className={
                        validationErrors.endIp ? 'border-destructive' : ''
                      }
                    />
                    {validationErrors.endIp && (
                      <p className="text-destructive text-xs">
                        {validationErrors.endIp}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Additional Services</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dns-server">DNS Server</Label>
                      <Input
                        id="dns-server"
                        value={localFormData.dns}
                        onChange={(e) =>
                          handleInputChange('dns', e.target.value)
                        }
                        placeholder="0.0.0.0 (disabled)"
                        className={
                          validationErrors.dns ? 'border-destructive' : ''
                        }
                      />
                      {validationErrors.dns && (
                        <p className="text-destructive text-xs">
                          {validationErrors.dns}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tftp-server">TFTP Server</Label>
                      <Input
                        id="tftp-server"
                        value={localFormData.tftp}
                        onChange={(e) =>
                          handleInputChange('tftp', e.target.value)
                        }
                        placeholder="0.0.0.0 (disabled)"
                        className={
                          validationErrors.tftp ? 'border-destructive' : ''
                        }
                      />
                      {validationErrors.tftp && (
                        <p className="text-destructive text-xs">
                          {validationErrors.tftp}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="wlc-server">WLC Server</Label>
                      <Input
                        id="wlc-server"
                        value={localFormData.wlc}
                        onChange={(e) =>
                          handleInputChange('wlc', e.target.value)
                        }
                        placeholder="0.0.0.0 (disabled)"
                        className={
                          validationErrors.wlc ? 'border-destructive' : ''
                        }
                      />
                      {validationErrors.wlc && (
                        <p className="text-destructive text-xs">
                          {validationErrors.wlc}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

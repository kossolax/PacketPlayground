/**
 * Interface Tab Component
 * Displays and edits network interface settings
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HardwareInterface,
  Dot1QInterface,
} from '../../lib/network-simulator/layers/datalink';
import { NetworkInterface } from '../../lib/network-simulator/layers/network';
import { VlanMode } from '../../lib/network-simulator/protocols/ethernet';
import { MacAddress, IPAddress } from '../../lib/network-simulator/address';
import type { Node } from '../../lib/network-simulator/nodes/generic';
import { SwitchHost } from '../../lib/network-simulator/nodes/switch';
import { Scheduler } from '../../lib/scheduler/scheduler';

interface InterfaceTabProps {
  node: Node<HardwareInterface>;
  interfaceName: string;
}

export default function InterfaceTab({
  node,
  interfaceName,
}: InterfaceTabProps) {
  const scheduler = Scheduler.getInstance();
  const iface = node.getInterface(interfaceName);
  const isNetworkInterface = iface instanceof NetworkInterface;
  const isDot1QInterface = iface instanceof Dot1QInterface;
  const isSwitchHost = node instanceof SwitchHost;

  // State for all fields
  const [isActive, setIsActive] = useState(iface.isActive());
  const [isConnected, setIsConnected] = useState(iface.isConnected);
  const [isDhcp, setIsDhcp] = useState(
    isNetworkInterface ? iface.AutoNegociateAddress : false
  );
  const [speed, setSpeed] = useState(iface.Speed);
  const [macAddress, setMacAddress] = useState(
    iface.getMacAddress().toString()
  );
  const [ipAddress, setIpAddress] = useState(
    isNetworkInterface ? iface.getNetAddress().toString() : ''
  );
  const [subnetMask, setSubnetMask] = useState(
    isNetworkInterface ? iface.getNetMask().toString() : ''
  );

  // VLAN state (for Dot1QInterface)
  const [vlanMode, setVlanMode] = useState<VlanMode>(
    isDot1QInterface ? (iface as Dot1QInterface).VlanMode : VlanMode.Access
  );
  const [accessVlan, setAccessVlan] = useState<number>(
    isDot1QInterface && (iface as Dot1QInterface).VlanMode === VlanMode.Access
      ? (iface as Dot1QInterface).Vlan[0] || 1
      : 1
  );
  const [allowedVlans, setAllowedVlans] = useState<number[]>(
    isDot1QInterface ? (iface as Dot1QInterface).Vlan : []
  );
  const [nativeVlan, setNativeVlan] = useState<number>(
    isDot1QInterface ? (iface as Dot1QInterface).NativeVlan : 1
  );

  // Error states
  const [macError, setMacError] = useState('');
  const [ipError, setIpError] = useState('');
  const [maskError, setMaskError] = useState('');
  const [vlanError, setVlanError] = useState('');

  // Subscribe to scheduler timer to reactively update interface state
  useEffect(() => {
    const subscription = scheduler.Timer$.subscribe(() => {
      // Update interface active status
      setIsActive(iface.isActive());

      // Update connection status (for speed radio buttons)
      setIsConnected(iface.isConnected);

      // Update speed (for auto-negotiation)
      setSpeed(iface.Speed);

      // Update IP and subnet mask only if DHCP is enabled
      // (when DHCP is disabled, user is editing these fields manually)
      if (isNetworkInterface && isDhcp) {
        setIpAddress(iface.getNetAddress().toString());
        setSubnetMask(iface.getNetMask().toString());
      }

      // Update VLAN state
      if (isDot1QInterface) {
        const dot1qIface = iface as Dot1QInterface;
        setVlanMode(dot1qIface.VlanMode);
        setAllowedVlans(dot1qIface.Vlan);
        setNativeVlan(dot1qIface.NativeVlan);
        if (
          dot1qIface.VlanMode === VlanMode.Access &&
          dot1qIface.Vlan.length > 0
        ) {
          setAccessVlan(dot1qIface.Vlan[0]);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [iface, isNetworkInterface, isDhcp, isDot1QInterface, scheduler]);

  // Interface Status Handler
  const handleStatusChange = (checked: boolean) => {
    setIsActive(checked);
    if (checked) {
      iface.up();
    } else {
      iface.down();
    }
  };

  // DHCP Handler
  const handleDhcpChange = (checked: boolean) => {
    if (!isNetworkInterface) return;

    setIsDhcp(checked);
    // eslint-disable-next-line no-param-reassign
    (iface as NetworkInterface).AutoNegociateAddress = checked;

    // Clear errors when DHCP is enabled (fields become disabled)
    if (checked) {
      setIpError('');
      setMaskError('');
    }
  };

  // Speed Handler
  const handleSpeedChange = (value: string) => {
    const newSpeed = Number(value);
    setSpeed(newSpeed);

    try {
      // eslint-disable-next-line no-param-reassign
      iface.Speed = newSpeed;
    } catch {
      // Speed validation failed - revert to previous value
      setSpeed(iface.Speed);
    }
  };

  // MAC Address Handler
  const handleMacChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMac = e.target.value;
    setMacAddress(newMac);
    setMacError('');

    try {
      iface.setMacAddress(new MacAddress(newMac));
    } catch {
      setMacError('Invalid MAC address format (expected: XX:XX:XX:XX:XX:XX)');
    }
  };

  // IP Address Handler
  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isNetworkInterface) return;

    const newIp = e.target.value;
    setIpAddress(newIp);
    setIpError('');

    try {
      if (newIp.trim() === '') {
        return; // Allow empty value
      }
      (iface as NetworkInterface).setNetAddress(new IPAddress(newIp));
    } catch {
      setIpError('Invalid IP address format (expected: a.b.c.d)');
    }
  };

  // Subnet Mask Handler
  const handleMaskChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isNetworkInterface) return;

    const newMask = e.target.value;
    setSubnetMask(newMask);
    setMaskError('');

    try {
      if (newMask.trim() === '') {
        return; // Allow empty value
      }
      (iface as NetworkInterface).setNetMask(new IPAddress(newMask, true));
    } catch {
      setMaskError('Invalid subnet mask (e.g., 255.255.255.0)');
    }
  };

  // VLAN Mode Handler
  const handleVlanModeChange = (value: string) => {
    if (!isDot1QInterface) return;

    const newMode = value === 'trunk' ? VlanMode.Trunk : VlanMode.Access;
    setVlanMode(newMode);

    const dot1qIface = iface as Dot1QInterface;
    // eslint-disable-next-line no-param-reassign
    dot1qIface.VlanMode = newMode;

    // If switching to Access mode, set the access VLAN
    if (newMode === VlanMode.Access) {
      // Clear all VLANs first
      const currentVlans = [...dot1qIface.Vlan];
      currentVlans.forEach((vlanId) => dot1qIface.removeVlan(vlanId));
      // Add access VLAN
      dot1qIface.addVlan(accessVlan);
    }
  };

  // Access VLAN Handler
  const handleAccessVlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDot1QInterface || vlanMode !== VlanMode.Access) return;

    const vlanId = parseInt(e.target.value, 10);
    setAccessVlan(vlanId);
    setVlanError('');

    if (Number.isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
      setVlanError('VLAN ID must be between 1 and 4094');
      return;
    }

    const dot1qIface = iface as Dot1QInterface;
    // Clear all VLANs first
    const currentVlans = [...dot1qIface.Vlan];
    currentVlans.forEach((vId) => dot1qIface.removeVlan(vId));
    // Add new access VLAN
    dot1qIface.addVlan(vlanId);
  };

  // Allowed VLAN Toggle Handler
  const handleAllowedVlanToggle = (vlanId: number, checked: boolean) => {
    if (!isDot1QInterface || vlanMode !== VlanMode.Trunk) return;

    const dot1qIface = iface as Dot1QInterface;

    if (checked) {
      dot1qIface.addVlan(vlanId);
    } else {
      dot1qIface.removeVlan(vlanId);
    }

    setAllowedVlans([...dot1qIface.Vlan]);
  };

  // Native VLAN Handler
  const handleNativeVlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDot1QInterface || vlanMode !== VlanMode.Trunk) return;

    const vlanId = parseInt(e.target.value, 10);
    setNativeVlan(vlanId);
    setVlanError('');

    if (Number.isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
      setVlanError('Native VLAN ID must be between 1 and 4094');
      return;
    }

    const dot1qIface = iface as Dot1QInterface;
    // eslint-disable-next-line no-param-reassign
    dot1qIface.NativeVlan = vlanId;
  };

  return (
    <div className="space-y-4">
      {/* Interface Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Interface Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Interface Status */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={`${interfaceName}-status`}>
                Interface Status
              </Label>
              <p className="text-muted-foreground text-xs">
                {isActive ? 'Interface is active' : 'Interface is disabled'}
              </p>
            </div>
            <Switch
              id={`${interfaceName}-status`}
              checked={isActive}
              onCheckedChange={handleStatusChange}
            />
          </div>

          {/* Speed Selection */}
          <div className="space-y-3">
            <Label>Interface Speed</Label>
            <RadioGroup
              value={speed.toString()}
              onValueChange={handleSpeedChange}
              className="flex flex-row gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="0" id={`${interfaceName}-speed-auto`} />
                <Label htmlFor={`${interfaceName}-speed-auto`}>Auto</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="10"
                  id={`${interfaceName}-speed-10`}
                  disabled={!isConnected}
                />
                <Label
                  htmlFor={`${interfaceName}-speed-10`}
                  className={!isConnected ? 'text-muted-foreground' : ''}
                >
                  10 Mbps
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="100"
                  id={`${interfaceName}-speed-100`}
                  disabled={!isConnected}
                />
                <Label
                  htmlFor={`${interfaceName}-speed-100`}
                  className={!isConnected ? 'text-muted-foreground' : ''}
                >
                  100 Mbps
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="1000"
                  id={`${interfaceName}-speed-1000`}
                  disabled={!isConnected}
                />
                <Label
                  htmlFor={`${interfaceName}-speed-1000`}
                  className={!isConnected ? 'text-muted-foreground' : ''}
                >
                  1000 Mbps
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* MAC Address */}
          <div className="space-y-2">
            <Label htmlFor={`${interfaceName}-mac`}>MAC Address</Label>
            <Input
              id={`${interfaceName}-mac`}
              value={macAddress}
              onChange={handleMacChange}
              placeholder="AA:BB:CC:DD:EE:FF"
              aria-invalid={!!macError}
              className={`${macError ? 'border-destructive' : ''}`}
            />
            {macError && <p className="text-destructive text-sm">{macError}</p>}
          </div>
        </CardContent>
      </Card>

      {/* DHCP & IP Configuration Card - Only for NetworkInterface */}
      {isNetworkInterface && (
        <Card>
          <CardHeader>
            <CardTitle>IP Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* DHCP Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor={`${interfaceName}-dhcp`}>DHCP</Label>
                <p className="text-muted-foreground text-xs">
                  {isDhcp
                    ? 'Automatically obtain IP address'
                    : 'Use static IP configuration'}
                </p>
              </div>
              <Switch
                id={`${interfaceName}-dhcp`}
                checked={isDhcp}
                onCheckedChange={handleDhcpChange}
              />
            </div>

            {/* IP Address */}
            <div className="space-y-2">
              <Label htmlFor={`${interfaceName}-ip`}>IP Address</Label>
              <Input
                id={`${interfaceName}-ip`}
                value={ipAddress}
                onChange={handleIpChange}
                disabled={isDhcp}
                placeholder="192.168.1.1"
                aria-invalid={!!ipError}
                className={`${ipError ? 'border-destructive' : ''}`}
              />
              {ipError && <p className="text-destructive text-sm">{ipError}</p>}
            </div>

            {/* Subnet Mask */}
            <div className="space-y-2">
              <Label htmlFor={`${interfaceName}-mask`}>Subnet Mask</Label>
              <Input
                id={`${interfaceName}-mask`}
                value={subnetMask}
                onChange={handleMaskChange}
                disabled={isDhcp}
                placeholder="255.255.255.0"
                aria-invalid={!!maskError}
                className={`${maskError ? 'border-destructive' : ''}`}
              />
              {maskError && (
                <p className="text-destructive text-sm">{maskError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VLAN Configuration Card - Only for Dot1Q Interface on Switch */}
      {isDot1QInterface && isSwitchHost && (
        <Card>
          <CardHeader>
            <CardTitle>VLAN Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* VLAN Mode Selection */}
            <div className="space-y-3">
              <Label>Switchport Mode</Label>
              <RadioGroup
                value={vlanMode === VlanMode.Trunk ? 'trunk' : 'access'}
                onValueChange={handleVlanModeChange}
                className="flex flex-row gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="access"
                    id={`${interfaceName}-mode-access`}
                  />
                  <Label htmlFor={`${interfaceName}-mode-access`}>Access</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="trunk"
                    id={`${interfaceName}-mode-trunk`}
                  />
                  <Label htmlFor={`${interfaceName}-mode-trunk`}>Trunk</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Access Mode Configuration */}
            {vlanMode === VlanMode.Access && (
              <div className="space-y-2">
                <Label htmlFor={`${interfaceName}-access-vlan`}>
                  Access VLAN
                </Label>
                <Input
                  id={`${interfaceName}-access-vlan`}
                  type="number"
                  min="1"
                  max="4094"
                  value={accessVlan}
                  onChange={handleAccessVlanChange}
                  placeholder="1"
                  aria-invalid={!!vlanError}
                  className={vlanError ? 'border-destructive' : ''}
                />
                {vlanError && (
                  <p className="text-destructive text-sm">{vlanError}</p>
                )}
              </div>
            )}

            {/* Trunk Mode Configuration */}
            {vlanMode === VlanMode.Trunk && (
              <>
                {/* Allowed VLANs */}
                <div className="space-y-2">
                  <Label>Allowed VLANs</Label>
                  <div className="rounded-md border p-4 max-h-48 overflow-y-auto">
                    {Object.keys((node as SwitchHost).knownVlan).length ===
                    0 ? (
                      <p className="text-muted-foreground text-sm">
                        No VLANs configured. Create VLANs in the VLAN Database
                        tab first.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {Object.keys((node as SwitchHost).knownVlan)
                          .map((key) => parseInt(key, 10))
                          .sort((a, b) => a - b)
                          .map((vlanId) => (
                            <div
                              key={vlanId}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`${interfaceName}-vlan-${vlanId}`}
                                checked={allowedVlans.includes(vlanId)}
                                onCheckedChange={(checked) =>
                                  handleAllowedVlanToggle(
                                    vlanId,
                                    checked as boolean
                                  )
                                }
                              />
                              <Label
                                htmlFor={`${interfaceName}-vlan-${vlanId}`}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Badge variant="secondary">{vlanId}</Badge>
                                {(node as SwitchHost).knownVlan[vlanId]}
                              </Label>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Native VLAN */}
                <div className="space-y-2">
                  <Label htmlFor={`${interfaceName}-native-vlan`}>
                    Native VLAN
                  </Label>
                  <Input
                    id={`${interfaceName}-native-vlan`}
                    type="number"
                    min="1"
                    max="4094"
                    value={nativeVlan}
                    onChange={handleNativeVlanChange}
                    placeholder="1"
                    aria-invalid={!!vlanError}
                    className={vlanError ? 'border-destructive' : ''}
                  />
                  {vlanError && (
                    <p className="text-destructive text-sm">{vlanError}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

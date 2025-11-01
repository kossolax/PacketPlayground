/**
 * Interface Tab Component
 * Displays and edits network interface settings
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Interface } from '../../lib/network-simulator/layers/datalink';
import { NetworkInterface } from '../../lib/network-simulator/layers/network';
import { MacAddress, IPAddress } from '../../lib/network-simulator/address';
import type { Node } from '../../lib/network-simulator/nodes/generic';

interface InterfaceTabProps {
  node: Node<Interface>;
  interfaceName: string;
}

export default function InterfaceTab({
  node,
  interfaceName,
}: InterfaceTabProps) {
  const iface = node.getInterface(interfaceName);
  const isNetworkInterface = iface instanceof NetworkInterface;

  // State for all fields
  const [isActive, setIsActive] = useState(iface.isActive());
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

  // Error states
  const [macError, setMacError] = useState('');
  const [ipError, setIpError] = useState('');
  const [maskError, setMaskError] = useState('');

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

  return (
    <div className="space-y-4">
      {/* Interface Configuration Card */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        {/* Interface Status */}
        <div className="flex items-center gap-3">
          <Label htmlFor={`${interfaceName}-status`}>Interface Status</Label>
          <Switch
            id={`${interfaceName}-status`}
            checked={isActive}
            onCheckedChange={handleStatusChange}
          />
          <span className="text-muted-foreground text-sm">
            {isActive ? 'ON' : 'OFF'}
          </span>
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
                disabled={!iface.isConnected}
              />
              <Label
                htmlFor={`${interfaceName}-speed-10`}
                className={!iface.isConnected ? 'text-muted-foreground' : ''}
              >
                10 Mbps
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="100"
                id={`${interfaceName}-speed-100`}
                disabled={!iface.isConnected}
              />
              <Label
                htmlFor={`${interfaceName}-speed-100`}
                className={!iface.isConnected ? 'text-muted-foreground' : ''}
              >
                100 Mbps
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="1000"
                id={`${interfaceName}-speed-1000`}
                disabled={!iface.isConnected}
              />
              <Label
                htmlFor={`${interfaceName}-speed-1000`}
                className={!iface.isConnected ? 'text-muted-foreground' : ''}
              >
                1000 Mbps
              </Label>
            </div>
          </RadioGroup>
          {!iface.isConnected && speed !== 0 && (
            <p className="text-muted-foreground text-sm">
              Connect a cable to configure manual speed
            </p>
          )}
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
      </div>

      {/* DHCP & IP Configuration Card - Only for NetworkInterface */}
      {isNetworkInterface && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {/* DHCP Toggle */}
          <div className="flex items-center gap-3">
            <Label htmlFor={`${interfaceName}-dhcp`}>DHCP</Label>
            <Switch
              id={`${interfaceName}-dhcp`}
              checked={isDhcp}
              onCheckedChange={handleDhcpChange}
            />
            <span className="text-muted-foreground text-sm">
              {isDhcp ? 'ON' : 'OFF'}
            </span>
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
        </div>
      )}
    </div>
  );
}

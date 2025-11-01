/**
 * General Tab Component
 * Displays and edits general device settings (name, gateway)
 */

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { GenericNode } from '../../lib/network-simulator';
import { L4Host, Node } from '../../lib/network-simulator/nodes/generic';
import { IPAddress } from '../../lib/network-simulator/address';
import type { NetworkInterface } from '../../lib/network-simulator/layers/network';

interface GeneralTabProps {
  node: GenericNode;
}

export default function GeneralTab({ node }: GeneralTabProps) {
  const [name, setName] = useState(node.name);
  const [gateway, setGateway] = useState(
    node instanceof L4Host ? (node.gateway?.toString() ?? '') : ''
  );
  const [gatewayError, setGatewayError] = useState('');

  // Check if this device supports gateway configuration (L4Host only)
  const hasGateway = node instanceof L4Host;

  // Check if DHCP is enabled on the first interface
  const isDhcpEnabled = useMemo(() => {
    if (!hasGateway) return false;

    try {
      const iface = (node as Node<NetworkInterface>).getInterface(0);
      return iface.AutoNegociateAddress;
    } catch {
      return false;
    }
  }, [node, hasGateway]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // eslint-disable-next-line no-param-reassign
    node.name = newName; // Immediate update to node
  };

  const handleGatewayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newGateway = e.target.value;
    setGateway(newGateway);
    setGatewayError('');

    // Update node gateway with validation
    try {
      if (node instanceof L4Host) {
        if (newGateway.trim() === '') {
          // eslint-disable-next-line no-param-reassign
          node.gateway = null; // Clear gateway
        } else {
          // eslint-disable-next-line no-param-reassign
          node.gateway = new IPAddress(newGateway);
        }
      }
    } catch {
      setGatewayError('Invalid IP address format (expected: a.b.c.d)');
    }
  };

  return (
    <div className="space-y-4">
      {/* Device Name Field */}
      <div className="space-y-2">
        <Label htmlFor="device-name">Device Name</Label>
        <Input
          id="device-name"
          value={name}
          onChange={handleNameChange}
          placeholder="Enter device name"
          className="bg-background"
        />
      </div>

      {/* Gateway Field - Only for L4Host devices */}
      {hasGateway && (
        <div className="space-y-2">
          <Label htmlFor="gateway">Default Gateway</Label>
          <Input
            id="gateway"
            value={gateway}
            onChange={handleGatewayChange}
            disabled={isDhcpEnabled}
            placeholder="e.g., 192.168.1.1"
            aria-invalid={!!gatewayError}
            className={`bg-background ${gatewayError ? 'border-destructive' : ''}`}
          />
          {gatewayError && (
            <p className="text-destructive text-sm">{gatewayError}</p>
          )}
          {isDhcpEnabled && (
            <p className="text-muted-foreground text-sm">
              Gateway is automatically configured by DHCP
            </p>
          )}
        </div>
      )}
    </div>
  );
}

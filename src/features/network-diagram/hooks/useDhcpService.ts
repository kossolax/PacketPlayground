import { useState, useEffect } from 'react';
import type { ServerHost } from '../lib/network-simulator/nodes/server';
import { DhcpPool } from '../lib/network-simulator/services/dhcp';
import { IPAddress } from '../lib/network-simulator/address';

interface PoolFormData {
  name: string;
  gateway: string;
  netmask: string;
  startIp: string;
  endIp: string;
  dns: string;
  tftp: string;
  wlc: string;
}

export default function useDhcpService(node: ServerHost) {
  const [enabled, setEnabled] = useState(node.services.dhcp.Enable);
  const [pools, setPools] = useState<DhcpPool[]>(node.services.dhcp.pools);
  const [selectedPoolIndex, setSelectedPoolIndex] = useState<number | null>(
    pools.length > 0 ? 0 : null
  );

  // Sync with backend when enabled changes
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.dhcp.Enable = enabled;
  }, [enabled, node]);

  // Sync pools with backend
  useEffect(() => {
    // eslint-disable-next-line no-param-reassign
    node.services.dhcp.pools = pools;
  }, [pools, node]);

  const selectedPool =
    selectedPoolIndex !== null ? pools[selectedPoolIndex] : null;

  const getPoolFormData = (pool: DhcpPool | null): PoolFormData => {
    if (!pool) {
      return {
        name: '',
        gateway: '',
        netmask: '',
        startIp: '',
        endIp: '',
        dns: '',
        tftp: '',
        wlc: '',
      };
    }

    return {
      name: pool.name,
      gateway: pool.gatewayAddress.toString(),
      netmask: pool.netmaskAddress.toString(),
      startIp: pool.startAddress.toString(),
      endIp: pool.endAddress.toString(),
      dns: pool.otherServices.dns?.toString() || '0.0.0.0',
      tftp: pool.otherServices.tftp?.toString() || '0.0.0.0',
      wlc: pool.otherServices.wlc?.toString() || '0.0.0.0',
    };
  };

  const addPool = () => {
    const newPool = new DhcpPool(
      `Pool${pools.length + 1}`,
      new IPAddress('192.168.1.1'),
      new IPAddress('255.255.255.0'),
      new IPAddress('192.168.1.10'),
      new IPAddress('192.168.1.100')
    );
    setPools([...pools, newPool]);
    setSelectedPoolIndex(pools.length);
  };

  const removePool = (index: number) => {
    const newPools = pools.filter((_, i) => i !== index);
    setPools(newPools);
    if (selectedPoolIndex === index) {
      setSelectedPoolIndex(newPools.length > 0 ? 0 : null);
    } else if (selectedPoolIndex !== null && selectedPoolIndex > index) {
      setSelectedPoolIndex(selectedPoolIndex - 1);
    }
  };

  const updatePool = (index: number, formData: PoolFormData) => {
    const newPools = [...pools];
    const pool = newPools[index];

    pool.name = formData.name;

    // Update gateway first (this auto-updates netmask, start, end)
    if (formData.gateway) {
      pool.gatewayAddress = new IPAddress(formData.gateway);
    }

    // Then update netmask if provided
    if (formData.netmask) {
      pool.netmaskAddress = new IPAddress(formData.netmask);
    }

    // Then update start and end addresses
    if (formData.startIp) {
      pool.startAddress = new IPAddress(formData.startIp);
    }
    if (formData.endIp) {
      pool.endAddress = new IPAddress(formData.endIp);
    }

    // Update other services
    pool.otherServices.dns = formData.dns
      ? new IPAddress(formData.dns)
      : new IPAddress('0.0.0.0');
    pool.otherServices.tftp = formData.tftp
      ? new IPAddress(formData.tftp)
      : new IPAddress('0.0.0.0');
    pool.otherServices.wlc = formData.wlc
      ? new IPAddress(formData.wlc)
      : new IPAddress('0.0.0.0');

    setPools(newPools);
  };

  return {
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
  };
}

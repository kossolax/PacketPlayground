import { useState, useEffect, useCallback } from 'react';
import type { SwitchHost } from '../lib/network-simulator/nodes/switch';
import { Scheduler } from '../lib/scheduler/scheduler';

export interface VlanInfo {
  id: number;
  name: string;
}

export default function useVlanDatabase(node: SwitchHost) {
  const scheduler = Scheduler.getInstance();
  const [vlans, setVlans] = useState<VlanInfo[]>([]);

  // Subscribe to scheduler timer to reactively update VLAN database
  useEffect(() => {
    const subscription = scheduler.Timer$.subscribe(() => {
      const vlanArray: VlanInfo[] = Object.keys(node.knownVlan)
        .map((key) => ({
          id: parseInt(key, 10),
          name: node.knownVlan[parseInt(key, 10)],
        }))
        .sort((a, b) => a.id - b.id);

      setVlans(vlanArray);
    });

    // Initial load
    const initialVlans: VlanInfo[] = Object.keys(node.knownVlan)
      .map((key) => ({
        id: parseInt(key, 10),
        name: node.knownVlan[parseInt(key, 10)],
      }))
      .sort((a, b) => a.id - b.id);
    setVlans(initialVlans);

    return () => {
      subscription.unsubscribe();
    };
  }, [node, scheduler]);

  // Add a VLAN to the database
  const addVlan = useCallback(
    (id: number, name: string): void => {
      // Validate VLAN ID range
      if (id < 1 || id > 4094) {
        throw new Error('VLAN ID must be between 1 and 4094');
      }

      // Check if VLAN already exists
      if (node.knownVlan[id]) {
        throw new Error(`VLAN ${id} already exists`);
      }

      // Add to backend
      // eslint-disable-next-line no-param-reassign
      node.knownVlan[id] = name;
    },
    [node]
  );

  // Delete a VLAN from the database
  const deleteVlan = useCallback(
    (id: number): void => {
      if (!node.knownVlan[id]) {
        throw new Error(`VLAN ${id} does not exist`);
      }

      // Delete from backend
      // eslint-disable-next-line no-param-reassign
      delete node.knownVlan[id];
    },
    [node]
  );

  return {
    vlans,
    addVlan,
    deleteVlan,
  };
}

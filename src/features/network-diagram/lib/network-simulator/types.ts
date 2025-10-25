/**
 * Network Simulator Types
 * Pure TypeScript types for network topology - no React dependencies
 */

/**
 * Device types supported by Packet Tracer
 */
export type DeviceType =
  | 'pc'
  | 'laptop'
  | 'server'
  | 'router'
  | 'switch'
  | 'hub'
  | 'printer'
  | 'cloud'
  | 'bridge';

/**
 * Network interface (port) on a device
 */
export interface NetworkInterface {
  name: string;
  type: string;
  isConnected: boolean;
}

/**
 * Network device (node in the topology)
 */
export interface Device {
  guid: string;
  name: string;
  type: DeviceType;
  x: number;
  y: number;
  interfaces: NetworkInterface[];
}

/**
 * Network link (edge in the topology)
 */
export interface Link {
  id: string;
  sourceGuid: string;
  targetGuid: string;
  sourcePort: string;
  targetPort: string;
  cableType?: string;
  length?: number;
}

/**
 * Complete network topology
 */
export interface NetworkTopology {
  devices: Device[];
  links: Link[];
  metadata?: {
    version?: string;
    filename?: string;
  };
}

/**
 * Device catalog entry for creating new devices
 */
export interface DeviceCatalogEntry {
  type: DeviceType;
  displayName: string;
  icon: string;
  defaultName: string;
  description: string;
}

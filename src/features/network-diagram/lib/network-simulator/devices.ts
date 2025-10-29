/**
 * Device Catalog
 * Catalog of available network devices for the simulator
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
 * Network interface (port) on a device - UI representation
 */
export interface NetworkInterface {
  name: string;
  type: string;
  isConnected: boolean;
}

/**
 * Network device (node in the topology) - UI representation
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
 * Device catalog entry for creating new devices
 */
export interface DeviceCatalogEntry {
  type: DeviceType;
  displayName: string;
  icon: string;
  defaultName: string;
  description: string;
}

/**
 * Catalog of available devices
 */
export const DEVICE_CATALOG: Record<DeviceType, DeviceCatalogEntry> = {
  pc: {
    type: 'pc',
    displayName: 'PC',
    icon: '/network-icons/pc.png',
    defaultName: 'PC',
    description: 'Desktop computer',
  },
  laptop: {
    type: 'laptop',
    displayName: 'Laptop',
    icon: '/network-icons/laptop.png',
    defaultName: 'Laptop',
    description: 'Portable computer',
  },
  server: {
    type: 'server',
    displayName: 'Server',
    icon: '/network-icons/server.png',
    defaultName: 'Server',
    description: 'Network server',
  },
  router: {
    type: 'router',
    displayName: 'Router',
    icon: '/network-icons/router.png',
    defaultName: 'Router',
    description: 'Network router',
  },
  switch: {
    type: 'switch',
    displayName: 'Switch',
    icon: '/network-icons/switch.png',
    defaultName: 'Switch',
    description: 'Network switch',
  },
  hub: {
    type: 'hub',
    displayName: 'Hub',
    icon: '/network-icons/hub.png',
    defaultName: 'Hub',
    description: 'Network hub',
  },
  printer: {
    type: 'printer',
    displayName: 'Printer',
    icon: '/network-icons/printer.png',
    defaultName: 'Printer',
    description: 'Network printer',
  },
  cloud: {
    type: 'cloud',
    displayName: 'Cloud',
    icon: '/network-icons/cloud.png',
    defaultName: 'Cloud',
    description: 'Cloud/Internet',
  },
  bridge: {
    type: 'bridge',
    displayName: 'Bridge',
    icon: '/network-icons/bridge.png',
    defaultName: 'Bridge',
    description: 'Network bridge',
  },
};

/**
 * Create a new device with default values
 */
export function createDevice(
  type: DeviceType,
  position: { x: number; y: number }
): Device {
  const catalog = DEVICE_CATALOG[type];

  if (!catalog) {
    throw new Error(`Unknown device type: ${type}`);
  }

  return {
    guid: `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: catalog.defaultName,
    type,
    x: position.x,
    y: position.y,
    interfaces: [],
  };
}

/**
 * Map Packet Tracer device type to our internal DeviceType
 */
export function mapPacketTracerType(ptType: string): DeviceType {
  const normalized = ptType.toLowerCase().trim();

  const typeMap: Record<string, DeviceType> = {
    pc: 'pc',
    laptop: 'laptop',
    server: 'server',
    router: 'router',
    switch: 'switch',
    hub: 'hub',
    printer: 'printer',
    cloud: 'cloud',
    bridge: 'bridge',
  };

  return typeMap[normalized] || 'pc';
}

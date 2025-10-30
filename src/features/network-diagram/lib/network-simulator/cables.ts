/**
 * Cable Catalog
 * Catalog of available network cables for connecting devices
 */

import type { DeviceType } from './devices';

/**
 * Cable types for visual representation
 * 'ethernet' = straight-through cable (solid blue line)
 * 'crossover' = crossover cable (dashed orange line)
 */
export type CableType = 'ethernet' | 'crossover';

/**
 * UI cable selection type (only one option now with auto-detection)
 */
export type CableUIType = 'auto';

/**
 * Cable catalog entry for UI display
 */
export interface CableCatalogEntry {
  type: CableUIType;
  displayName: string;
  icon: string;
  description: string;
}

/**
 * Catalog of available cables in UI (only one now)
 */
export const CABLE_CATALOG: Record<CableUIType, CableCatalogEntry> = {
  auto: {
    type: 'auto',
    displayName: 'RJ45 Ethernet',
    icon: 'Cable',
    description:
      'Auto-detects straight-through or crossover cable based on device types',
  },
};

/**
 * Detect which cable type to use based on device types
 * @param sourceType - Type of the source device
 * @param targetType - Type of the target device
 * @returns 'ethernet' for straight-through, 'crossover' for crossover cable
 */
export function detectCableType(
  sourceType: DeviceType,
  targetType: DeviceType
): CableType {
  // Define device categories
  const endDevices: DeviceType[] = ['pc', 'laptop', 'server', 'printer'];
  const networkDevices: DeviceType[] = ['switch', 'hub'];
  const routingDevices: DeviceType[] = ['router'];

  // Categorize source and target
  const sourceIsEnd = endDevices.includes(sourceType);
  const targetIsEnd = endDevices.includes(targetType);
  const sourceIsNetwork = networkDevices.includes(sourceType);
  const targetIsNetwork = networkDevices.includes(targetType);
  const sourceIsRouting = routingDevices.includes(sourceType);
  const targetIsRouting = routingDevices.includes(targetType);

  // Same category = crossover cable needed
  if (
    (sourceIsEnd && targetIsEnd) ||
    (sourceIsNetwork && targetIsNetwork) ||
    (sourceIsRouting && targetIsRouting)
  ) {
    return 'crossover';
  }

  // Different categories = straight-through cable
  return 'ethernet';
}

/**
 * Get cable visual properties based on type
 */
export function getCableVisualProps(type: CableType): {
  color: string;
  strokeStyle: 'solid' | 'dashed';
  displayName: string;
} {
  if (type === 'crossover') {
    return {
      color: '#f59e0b', // amber-500
      strokeStyle: 'dashed',
      displayName: 'Crossover',
    };
  }

  return {
    color: '#3b82f6', // blue-500
    strokeStyle: 'solid',
    displayName: 'Straight-through',
  };
}

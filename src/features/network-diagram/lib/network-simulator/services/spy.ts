/**
 * Link Layer Spy Service
 * Used for monitoring and analyzing link-layer traffic
 */

import type { PhysicalListener } from '../protocols/base';

/**
 * Interface for link layer spy functionality
 * Allows monitoring of physical layer messages
 */
export type LinkLayerSpy = PhysicalListener;

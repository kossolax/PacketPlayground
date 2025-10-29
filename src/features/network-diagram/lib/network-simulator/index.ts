/**
 * Network Simulator - Logic Layer
 * Pure TypeScript implementation with no React dependencies
 */

// Core network parsing and representation
export { parseXMLToJSON } from './parser';
export { Network } from './network';

// Device catalog
export * from './devices';

// Protocol monitoring
export { LinkLayerSpy, type PacketTransmission } from './protocols/base';

// Re-export core classes for convenience
export { GenericNode, NetworkHost, Node, L4Host } from './nodes/generic';
export { RouterHost } from './nodes/router';
export { SwitchHost } from './nodes/switch';
export { ServerHost, ComputerHost } from './nodes/server';
export { Link, AbstractLink } from './layers/physical';
export { IPAddress, MacAddress } from './address';

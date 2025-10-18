// Network simulation utilities for L2/L3 protocols
// Provides graph algorithms, packet types, and animation helpers

import { NetworkLink, PositionedNode } from './network-layout';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Packet type for network simulations
 */
export interface Packet {
  id: string;
  type: 'unicast' | 'broadcast' | 'multicast' | 'anycast';
  srcMAC: string;
  dstMAC: string;
  srcIP?: string;
  dstIP?: string;
  vlanId?: number;
  progress: number; // 0-100 for animation
}

/**
 * Link state for visualization
 */
export enum LinkState {
  Idle = 'idle',
  Forwarding = 'forwarding',
  Flooding = 'flooding',
  Learning = 'learning',
  Blocking = 'blocking',
}

/**
 * Adjacency list representation for efficient graph operations
 */
export type AdjacencyList = Map<string | number, Array<string | number>>;

// ============================================================================
// GRAPH ALGORITHMS
// ============================================================================

/**
 * Build an adjacency list from network links (bidirectional)
 * @param links Array of network links
 * @returns Adjacency list mapping node IDs to their neighbors
 */
export function buildAdjacencyList(links: NetworkLink[]): AdjacencyList {
  const adj: AdjacencyList = new Map();

  links.forEach((link) => {
    // Add forward edge
    if (!adj.has(link.from)) {
      adj.set(link.from, []);
    }
    adj.get(link.from)!.push(link.to);

    // Add reverse edge (bidirectional)
    if (!adj.has(link.to)) {
      adj.set(link.to, []);
    }
    adj.get(link.to)!.push(link.from);
  });

  return adj;
}

/**
 * Get all direct neighbors of a node
 * @param nodeId Node to find neighbors for
 * @param links Array of network links
 * @returns Array of neighbor node IDs
 */
export function getNeighbors(
  nodeId: string | number,
  links: NetworkLink[]
): Array<string | number> {
  const adj = buildAdjacencyList(links);
  return adj.get(nodeId) || [];
}

/**
 * Find shortest path between two nodes using BFS
 * @param from Source node ID
 * @param to Destination node ID
 * @param links Array of network links
 * @returns Array of links forming the path, or null if no path exists
 */
export function findPath(
  from: string | number,
  to: string | number,
  links: NetworkLink[]
): NetworkLink[] | null {
  if (from === to) return [];

  const adj = buildAdjacencyList(links);
  const visited = new Set<string | number>();
  const parent = new Map<string | number, string | number>();
  const queue: Array<string | number> = [from];

  visited.add(from);

  // BFS to find shortest path
  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === to) {
      // Reconstruct path
      const path: NetworkLink[] = [];
      let node = to;

      while (parent.has(node)) {
        const prev = parent.get(node)!;
        path.unshift({ from: prev, to: node });
        node = prev;
      }

      return path;
    }

    const neighbors = adj.get(current) || [];
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
    });
  }

  return null; // No path found
}

/**
 * Find all nodes reachable from a given node (for broadcast simulation)
 * @param from Source node ID
 * @param links Array of network links
 * @returns Array of reachable node IDs (excluding source)
 */
export function findAllReachable(
  from: string | number,
  links: NetworkLink[]
): Array<string | number> {
  const adj = buildAdjacencyList(links);
  const visited = new Set<string | number>();
  const queue: Array<string | number> = [from];

  visited.add(from);

  // BFS traversal
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current) || [];

    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  // Remove source node from result
  visited.delete(from);
  return Array.from(visited);
}

/**
 * Calculate broadcast domain (stops at router boundaries)
 * @param nodeId Source node ID
 * @param links Array of network links
 * @param routers Array of router node IDs (broadcast stops here)
 * @returns Array of node IDs in the same broadcast domain
 */
export function getBroadcastDomain(
  nodeId: string | number,
  links: NetworkLink[],
  routers: Array<string | number>
): Array<string | number> {
  const adj = buildAdjacencyList(links);
  const visited = new Set<string | number>();
  const queue: Array<string | number> = [nodeId];
  const routerSet = new Set(routers);

  visited.add(nodeId);

  // BFS but stop at routers
  while (queue.length > 0) {
    const current = queue.shift()!;

    // Don't traverse through routers (they segment broadcast domains)
    if (!routerSet.has(current) || current === nodeId) {
      const neighbors = adj.get(current) || [];
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  }

  // Remove source node from result
  visited.delete(nodeId);
  return Array.from(visited);
}

// ============================================================================
// PACKET ANIMATION UTILITIES
// ============================================================================

/**
 * Compute packet position on a single link
 * @param link Network link to compute position on
 * @param positioned Array of positioned nodes
 * @param progress Progress along the link (0-100)
 * @returns {x, y} coordinates of the packet
 */
export function computePacketPosition(
  link: NetworkLink,
  positioned: PositionedNode[],
  progress: number
): { x: number; y: number } {
  const from = positioned.find((n) => n.id === link.from);
  const to = positioned.find((n) => n.id === link.to);

  if (!from || !to) {
    return { x: 0, y: 0 };
  }

  const t = progress / 100;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/**
 * Compute packet position on a multi-hop path
 * @param path Array of links forming the path
 * @param positioned Array of positioned nodes
 * @param totalProgress Progress across the entire path (0-100)
 * @returns {x, y} coordinates and current link index
 */
export function computePacketPositionOnPath(
  path: NetworkLink[],
  positioned: PositionedNode[],
  totalProgress: number
): { x: number; y: number; currentLinkIndex: number } {
  if (path.length === 0) {
    return { x: 0, y: 0, currentLinkIndex: -1 };
  }

  // Distribute progress evenly across all links
  const progressPerLink = 100 / path.length;
  const currentLinkIndex = Math.min(
    Math.floor(totalProgress / progressPerLink),
    path.length - 1
  );
  const linkProgress =
    (totalProgress - currentLinkIndex * progressPerLink) / progressPerLink;

  const currentLink = path[currentLinkIndex];
  const position = computePacketPosition(
    currentLink,
    positioned,
    linkProgress * 100
  );

  return { ...position, currentLinkIndex };
}

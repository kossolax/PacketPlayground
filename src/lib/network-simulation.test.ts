import { describe, it, expect } from 'vitest';

import { NetworkLink, PositionedNode } from './network-layout';
import {
  buildAdjacencyList,
  getNeighbors,
  findPath,
  findAllReachable,
  getBroadcastDomain,
  computePacketPosition,
  computePacketPositionOnPath,
} from './network-simulation';

describe('network-simulation', () => {
  describe('Graph Algorithms', () => {
    describe('buildAdjacencyList', () => {
      it('should build adjacency list from links', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];

        const adj = buildAdjacencyList(links);

        expect(adj.get('A')).toEqual(['B']);
        expect(adj.get('B')).toEqual(expect.arrayContaining(['A', 'C']));
        expect(adj.get('C')).toEqual(['B']);
      });

      it('should handle empty links', () => {
        const links: NetworkLink[] = [];
        const adj = buildAdjacencyList(links);
        expect(adj.size).toBe(0);
      });

      it('should handle bidirectional links correctly', () => {
        const links: NetworkLink[] = [{ from: 1, to: 2 }];
        const adj = buildAdjacencyList(links);

        expect(adj.get(1)).toContain(2);
        expect(adj.get(2)).toContain(1);
      });

      it('should handle multiple links from same node', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'A', to: 'C' },
          { from: 'A', to: 'D' },
        ];
        const adj = buildAdjacencyList(links);

        expect(adj.get('A')).toEqual(expect.arrayContaining(['B', 'C', 'D']));
      });
    });

    describe('getNeighbors', () => {
      it('should return all neighbors of a node', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'A', to: 'C' },
          { from: 'B', to: 'D' },
        ];

        const neighbors = getNeighbors('A', links);
        expect(neighbors).toEqual(expect.arrayContaining(['B', 'C']));
        expect(neighbors).toHaveLength(2);
      });

      it('should return empty array for isolated node', () => {
        const links: NetworkLink[] = [{ from: 'A', to: 'B' }];
        const neighbors = getNeighbors('C', links);
        expect(neighbors).toEqual([]);
      });

      it('should handle nonexistent node', () => {
        const links: NetworkLink[] = [{ from: 'A', to: 'B' }];
        const neighbors = getNeighbors('Z', links);
        expect(neighbors).toEqual([]);
      });

      it('should include bidirectional neighbors', () => {
        const links: NetworkLink[] = [{ from: 1, to: 2 }];
        const neighbors1 = getNeighbors(1, links);
        const neighbors2 = getNeighbors(2, links);

        expect(neighbors1).toContain(2);
        expect(neighbors2).toContain(1);
      });
    });

    describe('findPath', () => {
      it('should find shortest path between two nodes', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'D' },
        ];

        const path = findPath('A', 'D', links);

        expect(path).not.toBeNull();
        expect(path).toHaveLength(3);
        expect(path![0]).toEqual({ from: 'A', to: 'B' });
        expect(path![1]).toEqual({ from: 'B', to: 'C' });
        expect(path![2]).toEqual({ from: 'C', to: 'D' });
      });

      it('should return null for disconnected nodes', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'C', to: 'D' },
        ];

        const path = findPath('A', 'D', links);
        expect(path).toBeNull();
      });

      it('should handle direct connection', () => {
        const links: NetworkLink[] = [{ from: 'A', to: 'B' }];

        const path = findPath('A', 'B', links);

        expect(path).not.toBeNull();
        expect(path).toHaveLength(1);
        expect(path![0]).toEqual({ from: 'A', to: 'B' });
      });

      it('should handle same source and destination', () => {
        const links: NetworkLink[] = [{ from: 'A', to: 'B' }];

        const path = findPath('A', 'A', links);

        expect(path).toEqual([]);
      });

      it('should handle cycles correctly', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'A' }, // Cycle
        ];

        const path = findPath('A', 'C', links);

        expect(path).not.toBeNull();
        expect(path!.length).toBeGreaterThanOrEqual(1);
      });

      it('should find shortest path when multiple paths exist', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'D' },
          { from: 'A', to: 'C' },
          { from: 'C', to: 'D' },
        ];

        const path = findPath('A', 'D', links);

        expect(path).not.toBeNull();
        expect(path).toHaveLength(2); // Shortest path is 2 hops
      });

      it('should handle bidirectional traversal', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];

        const pathForward = findPath('A', 'C', links);
        const pathBackward = findPath('C', 'A', links);

        expect(pathForward).not.toBeNull();
        expect(pathBackward).not.toBeNull();
        expect(pathForward!.length).toBe(pathBackward!.length);
      });
    });

    describe('findAllReachable', () => {
      it('should find all reachable nodes', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'D' },
        ];

        const reachable = findAllReachable('A', links);

        expect(reachable).toEqual(expect.arrayContaining(['B', 'C', 'D']));
        expect(reachable).toHaveLength(3);
      });

      it('should handle isolated node', () => {
        const links: NetworkLink[] = [{ from: 'A', to: 'B' }];

        const reachable = findAllReachable('C', links);

        expect(reachable).toEqual([]);
      });

      it('should handle fully connected graph', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'A' },
        ];

        const reachable = findAllReachable('A', links);

        expect(reachable).toEqual(expect.arrayContaining(['B', 'C']));
        expect(reachable).toHaveLength(2);
      });

      it('should handle partial connectivity', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'D', to: 'E' },
        ];

        const reachable = findAllReachable('A', links);

        expect(reachable).toEqual(expect.arrayContaining(['B', 'C']));
        expect(reachable).not.toContain('D');
        expect(reachable).not.toContain('E');
      });

      it('should not include source node in results', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];

        const reachable = findAllReachable('A', links);

        expect(reachable).not.toContain('A');
      });
    });

    describe('getBroadcastDomain', () => {
      it('should stop at router boundaries', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'R1' }, // A connects to router
          { from: 'R1', to: 'B' }, // Router connects to B
          { from: 'B', to: 'C' },
        ];
        const routers = ['R1'];

        const domain = getBroadcastDomain('A', links, routers);

        expect(domain).toEqual(['R1']);
        expect(domain).not.toContain('B');
        expect(domain).not.toContain('C');
      });

      it('should include all switches in domain', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'S1' },
          { from: 'S1', to: 'S2' },
          { from: 'S2', to: 'B' },
        ];
        const routers: string[] = [];

        const domain = getBroadcastDomain('A', links, routers);

        expect(domain).toEqual(expect.arrayContaining(['S1', 'S2', 'B']));
        expect(domain).toHaveLength(3);
      });

      it('should handle multiple routers', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'S1' },
          { from: 'S1', to: 'R1' },
          { from: 'R1', to: 'R2' },
          { from: 'R2', to: 'B' },
        ];
        const routers = ['R1', 'R2'];

        const domain = getBroadcastDomain('A', links, routers);

        expect(domain).toEqual(expect.arrayContaining(['S1', 'R1']));
        expect(domain).not.toContain('R2');
        expect(domain).not.toContain('B');
      });

      it('should handle no routers (entire network)', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'D' },
        ];
        const routers: string[] = [];

        const domain = getBroadcastDomain('A', links, routers);

        expect(domain).toEqual(expect.arrayContaining(['B', 'C', 'D']));
        expect(domain).toHaveLength(3);
      });

      it('should not include source node in results', () => {
        const links: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];
        const routers: string[] = [];

        const domain = getBroadcastDomain('A', links, routers);

        expect(domain).not.toContain('A');
      });

      it('should allow broadcast from router itself', () => {
        const links: NetworkLink[] = [
          { from: 'R1', to: 'A' },
          { from: 'R1', to: 'B' },
          { from: 'A', to: 'C' },
        ];
        const routers = ['R1'];

        const domain = getBroadcastDomain('R1', links, routers);

        expect(domain).toEqual(expect.arrayContaining(['A', 'B', 'C']));
      });
    });
  });

  describe('Packet Animation', () => {
    const testNodes: PositionedNode[] = [
      { id: 'A', x: 0, y: 0, type: 'pc', label: 'A' },
      { id: 'B', x: 100, y: 0, type: 'pc', label: 'B' },
      { id: 'C', x: 100, y: 100, type: 'pc', label: 'C' },
      { id: 'D', x: 200, y: 200, type: 'pc', label: 'D' },
    ];

    describe('computePacketPosition', () => {
      it('should compute position at start (progress 0)', () => {
        const link: NetworkLink = { from: 'A', to: 'B' };
        const pos = computePacketPosition(link, testNodes, 0);

        expect(pos.x).toBe(0);
        expect(pos.y).toBe(0);
      });

      it('should compute position at end (progress 100)', () => {
        const link: NetworkLink = { from: 'A', to: 'B' };
        const pos = computePacketPosition(link, testNodes, 100);

        expect(pos.x).toBe(100);
        expect(pos.y).toBe(0);
      });

      it('should compute position at midpoint (progress 50)', () => {
        const link: NetworkLink = { from: 'A', to: 'B' };
        const pos = computePacketPosition(link, testNodes, 50);

        expect(pos.x).toBe(50);
        expect(pos.y).toBe(0);
      });

      it('should handle vertical links', () => {
        const link: NetworkLink = { from: 'B', to: 'C' };
        const pos = computePacketPosition(link, testNodes, 50);

        expect(pos.x).toBe(100);
        expect(pos.y).toBe(50);
      });

      it('should handle horizontal links', () => {
        const link: NetworkLink = { from: 'A', to: 'B' };
        const pos = computePacketPosition(link, testNodes, 25);

        expect(pos.x).toBe(25);
        expect(pos.y).toBe(0);
      });

      it('should handle diagonal links', () => {
        const link: NetworkLink = { from: 'B', to: 'D' };
        const pos = computePacketPosition(link, testNodes, 50);

        expect(pos.x).toBe(150);
        expect(pos.y).toBe(100);
      });

      it('should handle nonexistent nodes gracefully', () => {
        const link: NetworkLink = { from: 'X', to: 'Y' };
        const pos = computePacketPosition(link, testNodes, 50);

        expect(pos.x).toBe(0);
        expect(pos.y).toBe(0);
      });

      it('should handle reverse direction', () => {
        const link: NetworkLink = { from: 'B', to: 'A' };
        const posStart = computePacketPosition(link, testNodes, 0);
        const posEnd = computePacketPosition(link, testNodes, 100);

        expect(posStart.x).toBe(100);
        expect(posEnd.x).toBe(0);
      });
    });

    describe('computePacketPositionOnPath', () => {
      it('should compute position on multi-hop path', () => {
        const path: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];

        const pos = computePacketPositionOnPath(path, testNodes, 50);

        // At 50% progress on 2-hop path, should be at node B
        expect(pos.currentLinkIndex).toBe(1);
      });

      it('should transition between links correctly', () => {
        const path: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];

        // Just before transition (49%)
        const posBefore = computePacketPositionOnPath(path, testNodes, 49);
        expect(posBefore.currentLinkIndex).toBe(0);

        // Just after transition (51%)
        const posAfter = computePacketPositionOnPath(path, testNodes, 51);
        expect(posAfter.currentLinkIndex).toBe(1);
      });

      it('should handle single-link path', () => {
        const path: NetworkLink[] = [{ from: 'A', to: 'B' }];

        const posStart = computePacketPositionOnPath(path, testNodes, 0);
        const posEnd = computePacketPositionOnPath(path, testNodes, 100);

        expect(posStart.currentLinkIndex).toBe(0);
        expect(posEnd.currentLinkIndex).toBe(0);
        expect(posStart.x).toBe(0);
        expect(posEnd.x).toBe(100);
      });

      it('should handle progress boundaries', () => {
        const path: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'D' },
        ];

        const pos0 = computePacketPositionOnPath(path, testNodes, 0);
        const pos100 = computePacketPositionOnPath(path, testNodes, 100);

        expect(pos0.currentLinkIndex).toBe(0);
        expect(pos100.currentLinkIndex).toBe(2);
      });

      it('should handle empty path gracefully', () => {
        const path: NetworkLink[] = [];

        const pos = computePacketPositionOnPath(path, testNodes, 50);

        expect(pos.x).toBe(0);
        expect(pos.y).toBe(0);
        expect(pos.currentLinkIndex).toBe(-1);
      });

      it('should distribute progress evenly across links', () => {
        const path: NetworkLink[] = [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
        ];

        // At 25% total progress, should be at 50% of first link
        const pos25 = computePacketPositionOnPath(path, testNodes, 25);
        expect(pos25.currentLinkIndex).toBe(0);
        expect(pos25.x).toBeCloseTo(50, 0);

        // At 75% total progress, should be at 50% of second link
        const pos75 = computePacketPositionOnPath(path, testNodes, 75);
        expect(pos75.currentLinkIndex).toBe(1);
        expect(pos75.x).toBeCloseTo(100, 0);
        expect(pos75.y).toBeCloseTo(50, 0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty graph', () => {
      const links: NetworkLink[] = [];

      expect(buildAdjacencyList(links).size).toBe(0);
      expect(getNeighbors('A', links)).toEqual([]);
      expect(findPath('A', 'B', links)).toBeNull();
      expect(findAllReachable('A', links)).toEqual([]);
      expect(getBroadcastDomain('A', links, [])).toEqual([]);
    });

    it('should handle self-loops', () => {
      const links: NetworkLink[] = [{ from: 'A', to: 'A' }];
      const adj = buildAdjacencyList(links);

      expect(adj.get('A')).toContain('A');
    });

    it('should handle duplicate links', () => {
      const links: NetworkLink[] = [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'B' }, // Duplicate
      ];
      const adj = buildAdjacencyList(links);

      // Should handle duplicates (may have multiple entries)
      expect(adj.get('A')).toBeDefined();
      expect(adj.get('A')!.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle very large graphs', () => {
      const links: NetworkLink[] = [];
      for (let i = 0; i < 1000; i += 1) {
        links.push({ from: i, to: i + 1 });
      }

      const adj = buildAdjacencyList(links);
      expect(adj.size).toBeGreaterThan(0);

      const path = findPath(0, 1000, links);
      expect(path).not.toBeNull();
      expect(path!.length).toBe(1000);
    });

    it('should handle numeric node IDs', () => {
      const links: NetworkLink[] = [
        { from: 1, to: 2 },
        { from: 2, to: 3 },
      ];

      const path = findPath(1, 3, links);
      expect(path).not.toBeNull();
      expect(path).toHaveLength(2);
    });

    it('should handle mixed string and numeric IDs', () => {
      const links: NetworkLink[] = [
        { from: 'A', to: 1 },
        { from: 1, to: 'B' },
      ];

      const neighbors = getNeighbors('A', links);
      expect(neighbors).toContain(1);
    });
  });
});

// Network topology layout utilities

// Types de base
export interface NetworkNode {
  id: string | number;
  type: 'pc' | 'switch' | 'router';
  label?: string;
}

export interface NetworkLink {
  from: string | number;
  to: string | number;
}

export interface PositionedNode extends NetworkNode {
  x: number;
  y: number;
}

export interface LayoutConfig {
  width: number;
  height: number;
  padding: number;
}

// 1. Bus Layout (horizontal line)
export function busLayout(
  nodes: NetworkNode[],
  config: LayoutConfig
): PositionedNode[] {
  const spacing =
    (config.width - 2 * config.padding) / Math.max(1, nodes.length - 1);
  const y = config.height / 2;

  return nodes.map((node, i) => ({
    ...node,
    x: config.padding + i * spacing,
    y,
  }));
}

// 2. Star Layout (center + periphery in circle)
export function starLayout(
  nodes: NetworkNode[],
  config: LayoutConfig
): PositionedNode[] {
  const centerX = config.width / 2;
  const centerY = config.height / 2;
  const radius = Math.min(config.width, config.height) / 2 - config.padding;

  return nodes.map((node, i) => {
    if (i === 0) {
      // Center node (hub/switch)
      return { ...node, x: centerX, y: centerY };
    }
    // Peripheral nodes arranged in a circle
    const angle = ((i - 1) * 2 * Math.PI) / (nodes.length - 1);
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

// 3. Ring Layout (circle)
export function ringLayout(
  nodes: NetworkNode[],
  config: LayoutConfig
): PositionedNode[] {
  const centerX = config.width / 2;
  const centerY = config.height / 2;
  const radius = Math.min(config.width, config.height) / 2 - config.padding;

  return nodes.map((node, i) => {
    const angle = (i * 2 * Math.PI) / nodes.length - Math.PI / 2; // start at top
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

// 4. Mesh Layout (grid positions for clarity, all interconnected)
export function meshLayout(
  nodes: NetworkNode[],
  config: LayoutConfig
): PositionedNode[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  const spacingX = (config.width - 2 * config.padding) / Math.max(1, cols - 1);
  const spacingY = (config.height - 2 * config.padding) / Math.max(1, rows - 1);

  return nodes.map((node, i) => ({
    ...node,
    x: config.padding + (i % cols) * spacingX,
    y: config.padding + Math.floor(i / cols) * spacingY,
  }));
}

// 5. Tree Layout (binary tree)
export function treeLayout(
  nodes: NetworkNode[],
  config: LayoutConfig
): PositionedNode[] {
  const levels = Math.ceil(Math.log2(nodes.length + 1));
  const levelHeight =
    (config.height - 2 * config.padding) / Math.max(1, levels - 1);

  return nodes.map((node, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (2 ** level - 1);
    const nodesInLevel = 2 ** level;
    const levelWidth = config.width - 2 * config.padding;
    const spacing = levelWidth / (nodesInLevel + 1);

    return {
      ...node,
      x: config.padding + spacing * (posInLevel + 1),
      y: config.padding + level * levelHeight,
    };
  });
}

// Helper: Generate links for bus topology
export function generateBusLinks(
  nodeIds: Array<string | number>
): NetworkLink[] {
  return nodeIds.slice(0, -1).map((id, i) => ({
    from: id,
    to: nodeIds[i + 1],
  }));
}

// Helper: Generate links for star topology
export function generateStarLinks(
  centerId: string | number,
  peripheralIds: Array<string | number>
): NetworkLink[] {
  return peripheralIds.map((id) => ({ from: centerId, to: id }));
}

// Helper: Generate links for ring topology
export function generateRingLinks(
  nodeIds: Array<string | number>
): NetworkLink[] {
  const links = nodeIds.slice(0, -1).map((id, i) => ({
    from: id,
    to: nodeIds[i + 1],
  }));
  // Connect last to first to close the ring
  links.push({ from: nodeIds[nodeIds.length - 1], to: nodeIds[0] });
  return links;
}

// Helper: Generate links for full mesh topology (all nodes connected)
export function generateFullMeshLinks(
  nodeIds: Array<string | number>
): NetworkLink[] {
  const links: NetworkLink[] = [];
  for (let i = 0; i < nodeIds.length; i += 1) {
    for (let j = i + 1; j < nodeIds.length; j += 1) {
      links.push({ from: nodeIds[i], to: nodeIds[j] });
    }
  }
  return links;
}

// Helper: Generate links for partial mesh topology (Internet-style)
// Sparse connections: each node connects to 2-3 neighbors
export function generatePartialMeshLinks(
  nodeIds: Array<string | number>
): NetworkLink[] {
  const links: NetworkLink[] = [];
  const cols = Math.ceil(Math.sqrt(nodeIds.length));

  for (let i = 0; i < nodeIds.length; i += 1) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Connect to right neighbor
    if (col < cols - 1 && i + 1 < nodeIds.length) {
      links.push({ from: nodeIds[i], to: nodeIds[i + 1] });
    }

    // Connect to bottom neighbor
    if (i + cols < nodeIds.length) {
      links.push({ from: nodeIds[i], to: nodeIds[i + cols] });
    }

    // Add very sparse diagonal for redundancy (only top-left corner of each 3x3 block)
    if (
      col < cols - 1 &&
      i + cols + 1 < nodeIds.length &&
      row % 3 === 0 &&
      col % 3 === 0
    ) {
      links.push({ from: nodeIds[i], to: nodeIds[i + cols + 1] });
    }
  }

  return links;
}

// Helper: Generate links for binary tree topology
export function generateTreeLinks(
  nodeIds: Array<string | number>
): NetworkLink[] {
  const links: NetworkLink[] = [];
  for (let i = 0; i < nodeIds.length; i += 1) {
    const leftChild = 2 * i + 1;
    const rightChild = 2 * i + 2;
    if (leftChild < nodeIds.length) {
      links.push({ from: nodeIds[i], to: nodeIds[leftChild] });
    }
    if (rightChild < nodeIds.length) {
      links.push({ from: nodeIds[i], to: nodeIds[rightChild] });
    }
  }
  return links;
}

// 6. Hybrid Layout (combines ring + bus + tree)
export function hybridLayout(
  nodes: NetworkNode[],
  config: LayoutConfig
): PositionedNode[] {
  const positioned: PositionedNode[] = [];
  const totalNodes = nodes.length;

  // Divide nodes into 3 sections
  const section1Size = Math.floor(totalNodes / 3);
  const section2Size = Math.floor(totalNodes / 3);

  // Section 1: Ring (left) - ~33% of nodes
  const ringNodes = nodes.slice(0, section1Size);
  const ringCenterX = config.padding + 100;
  const ringCenterY = config.height / 2;
  const ringRadius = 80;

  ringNodes.forEach((node, i) => {
    const angle = (i * 2 * Math.PI) / ringNodes.length - Math.PI / 2;
    positioned.push({
      ...node,
      x: ringCenterX + ringRadius * Math.cos(angle),
      y: ringCenterY + ringRadius * Math.sin(angle),
    });
  });

  // Section 2: Bus (middle) - ~33% of nodes
  const busNodes = nodes.slice(section1Size, section1Size + section2Size);
  const busStartX = config.padding + 250;
  const busEndX = config.padding + 550;
  const busSpacing = (busEndX - busStartX) / Math.max(1, busNodes.length - 1);
  const busY = config.height / 2;

  busNodes.forEach((node, i) => {
    positioned.push({
      ...node,
      x: busStartX + i * busSpacing,
      y: busY,
    });
  });

  // Section 3: Tree (right) - remaining nodes
  const treeNodes = nodes.slice(section1Size + section2Size);
  const treeConfig = {
    width: 200,
    height: config.height,
    padding: 40,
  };
  const treePositioned = treeLayout(treeNodes, treeConfig);

  // Offset tree to the right
  const treeOffsetX = config.width - config.padding - 150;
  treePositioned.forEach((node) => {
    positioned.push({
      ...node,
      x: treeOffsetX + node.x - treeConfig.width / 2,
      y: node.y,
    });
  });

  return positioned;
}

// Helper: Generate links for hybrid topology (ring + bus + tree)
export function generateHybridLinks(
  nodeIds: Array<string | number>
): NetworkLink[] {
  const links: NetworkLink[] = [];
  const totalNodes = nodeIds.length;

  const section1Size = Math.floor(totalNodes / 3);
  const section2Size = Math.floor(totalNodes / 3);

  // Section 1: Ring links
  const ringIds = nodeIds.slice(0, section1Size);
  if (ringIds.length > 0) {
    for (let i = 0; i < ringIds.length - 1; i += 1) {
      links.push({ from: ringIds[i], to: ringIds[i + 1] });
    }
    // Close the ring
    if (ringIds.length > 2) {
      links.push({ from: ringIds[ringIds.length - 1], to: ringIds[0] });
    }
  }

  // Section 2: Bus links
  const busIds = nodeIds.slice(section1Size, section1Size + section2Size);
  for (let i = 0; i < busIds.length - 1; i += 1) {
    links.push({ from: busIds[i], to: busIds[i + 1] });
  }

  // Section 3: Tree links
  const treeIds = nodeIds.slice(section1Size + section2Size);
  if (treeIds.length > 0) {
    for (let i = 0; i < treeIds.length; i += 1) {
      const leftChild = 2 * i + 1;
      const rightChild = 2 * i + 2;
      if (leftChild < treeIds.length) {
        links.push({ from: treeIds[i], to: treeIds[leftChild] });
      }
      if (rightChild < treeIds.length) {
        links.push({ from: treeIds[i], to: treeIds[rightChild] });
      }
    }
  }

  // Connect sections together
  // Ring to Bus: connect last ring node to first bus node
  if (ringIds.length > 0 && busIds.length > 0) {
    links.push({
      from: ringIds[Math.floor(ringIds.length / 2)], // middle of ring
      to: busIds[0],
    });
  }

  // Bus to Tree: connect last bus node to tree root
  if (busIds.length > 0 && treeIds.length > 0) {
    links.push({
      from: busIds[busIds.length - 1],
      to: treeIds[0], // tree root
    });
  }

  return links;
}

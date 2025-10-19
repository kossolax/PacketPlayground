/**
 * Edge Utility Functions for Floating Edges
 * Calculates dynamic connection points between nodes
 */

import type { Node } from '@xyflow/react';
import { Position } from '@xyflow/react';

/**
 * Calculate the intersection point between two nodes
 * Uses geometric calculations to find where an edge should connect
 */
function getNodeIntersection(intersectionNode: Node, targetNode: Node) {
  const intersectionNodePosition = intersectionNode.position;
  const targetPosition = targetNode.position;

  const w = (intersectionNode.measured?.width ?? 80) / 2;
  const h = (intersectionNode.measured?.height ?? 90) / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + (targetNode.measured?.width ?? 80) / 2;
  const y1 = targetPosition.y + (targetNode.measured?.height ?? 90) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

/**
 * Determine which side of the node the edge should connect to
 * Based on the intersection point coordinates
 */
function getEdgePosition(
  node: Node,
  intersectionPoint: { x: number; y: number }
) {
  const nodePos = node.position;
  const nodeWidth = node.measured?.width ?? 80;
  const nodeHeight = node.measured?.height ?? 90;

  const nx = Math.round(nodePos.x);
  const ny = Math.round(nodePos.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + nodeWidth - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= ny + nodeHeight - 1) {
    return Position.Bottom;
  }

  return Position.Top;
}

/**
 * Main function to get floating edge parameters
 * Returns dynamic source and target coordinates and positions
 */
export default function getEdgeParams(source: Node, target: Node) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);

  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);

  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos,
  };
}

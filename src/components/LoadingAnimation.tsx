import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/card';

interface QuantumNode {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

interface QuantumParticle {
  id: number;
  x: number;
  y: number;
  sourceNodeId: number;
  targetNodeId: number;
  phase: 'materializing' | 'stable' | 'dematerializing' | 'teleporting';
  opacity: number;
  scale: number;
  progress: number;
}

interface Connection {
  from: number;
  to: number;
  active: boolean;
  opacity: number;
}

const NODES: Omit<QuantumNode, 'active'>[] = [
  { id: 0, x: 100, y: 80 },
  { id: 1, x: 300, y: 60 },
  { id: 2, x: 200, y: 150 },
  { id: 3, x: 80, y: 220 },
  { id: 4, x: 320, y: 240 },
];

interface LoadingAnimationProps {
  fullScreen?: boolean;
}

export default function LoadingAnimation({
  fullScreen = true,
}: LoadingAnimationProps) {
  const [nodes, setNodes] = useState<QuantumNode[]>(
    NODES.map((n) => ({ ...n, active: false }))
  );
  const [particles, setParticles] = useState<QuantumParticle[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Initialize particles
  useEffect(() => {
    const initialParticles: QuantumParticle[] = [
      {
        id: 0,
        x: NODES[0].x,
        y: NODES[0].y,
        sourceNodeId: 0,
        targetNodeId: 1,
        phase: 'stable',
        opacity: 1,
        scale: 1,
        progress: 0,
      },
      {
        id: 1,
        x: NODES[2].x,
        y: NODES[2].y,
        sourceNodeId: 2,
        targetNodeId: 3,
        phase: 'stable',
        opacity: 1,
        scale: 1,
        progress: 0,
      },
      {
        id: 2,
        x: NODES[4].x,
        y: NODES[4].y,
        sourceNodeId: 4,
        targetNodeId: 0,
        phase: 'stable',
        opacity: 1,
        scale: 1,
        progress: 0,
      },
    ];
    setParticles(initialParticles);
  }, []);

  // Animate particles
  useEffect(() => {
    const interval = setInterval(() => {
      setParticles((prevParticles) =>
        prevParticles.map((particle) => {
          const newParticle = { ...particle };
          newParticle.progress += 1;

          switch (newParticle.phase) {
            case 'stable':
              // Wait before dematerializing
              if (newParticle.progress > 30) {
                newParticle.phase = 'dematerializing';
                newParticle.progress = 0;
              }
              break;

            case 'dematerializing':
              // Fade out and shrink
              newParticle.opacity = Math.max(0, 1 - newParticle.progress / 15);
              newParticle.scale = Math.max(0.3, 1 - newParticle.progress / 20);

              if (newParticle.progress >= 15) {
                newParticle.phase = 'teleporting';
                newParticle.progress = 0;

                // Activate source node
                setNodes((prevNodes) =>
                  prevNodes.map((n) =>
                    n.id === newParticle.sourceNodeId
                      ? { ...n, active: true }
                      : n
                  )
                );

                // Activate connection
                setConnections((prevConn) => [
                  ...prevConn.filter(
                    (c) =>
                      !(
                        c.from === newParticle.sourceNodeId &&
                        c.to === newParticle.targetNodeId
                      )
                  ),
                  {
                    from: newParticle.sourceNodeId,
                    to: newParticle.targetNodeId,
                    active: true,
                    opacity: 1,
                  },
                ]);
              }
              break;

            case 'teleporting':
              // Instant position change
              if (newParticle.progress === 1) {
                const targetNode = NODES.find(
                  (n) => n.id === newParticle.targetNodeId
                );
                if (targetNode) {
                  newParticle.x = targetNode.x;
                  newParticle.y = targetNode.y;
                  newParticle.phase = 'materializing';
                  newParticle.progress = 0;

                  // Activate target node
                  setNodes((prevNodes) =>
                    prevNodes.map((n) =>
                      n.id === newParticle.targetNodeId
                        ? { ...n, active: true }
                        : n
                    )
                  );
                }
              }
              break;

            case 'materializing':
              // Fade in and grow
              newParticle.opacity = Math.min(1, newParticle.progress / 15);
              newParticle.scale = Math.min(1, 0.3 + newParticle.progress / 20);

              if (newParticle.progress >= 15) {
                newParticle.phase = 'stable';
                newParticle.progress = 0;
                newParticle.opacity = 1;
                newParticle.scale = 1;

                // Select new random target
                const availableNodes = NODES.filter(
                  (n) => n.id !== newParticle.targetNodeId
                );
                const newTarget =
                  availableNodes[
                    Math.floor(Math.random() * availableNodes.length)
                  ];

                newParticle.sourceNodeId = newParticle.targetNodeId;
                newParticle.targetNodeId = newTarget.id;
              }
              break;

            default:
              break;
          }

          return newParticle;
        })
      );

      // Deactivate nodes gradually
      setNodes((prevNodes) =>
        prevNodes.map((n) => (n.active ? { ...n, active: false } : n))
      );

      // Fade out connections
      setConnections((prevConn) =>
        prevConn
          .map((c) => ({
            ...c,
            opacity: Math.max(0, c.opacity - 0.1),
            active: false,
          }))
          .filter((c) => c.opacity > 0)
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const containerClass = fullScreen
    ? 'bg-gradient-to-br from-background to-muted h-screen flex items-center justify-center p-6'
    : 'flex items-center justify-center min-h-[400px]';

  const cardClass = fullScreen
    ? 'p-8 relative overflow-hidden min-h-[500px] flex flex-col'
    : 'p-6 relative overflow-hidden min-h-[300px] flex flex-col bg-transparent border-0';

  return (
    <div className={containerClass}>
      <div className="max-w-2xl w-full">
        <Card className={cardClass}>
          {/* Animated quantum network background */}
          <div className="absolute inset-0 opacity-75">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 300"
              className="absolute"
            >
              {/* Static network connections */}
              <g stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                <line x1="100" y1="80" x2="300" y2="60" />
                <line x1="100" y1="80" x2="200" y2="150" />
                <line x1="300" y1="60" x2="200" y2="150" />
                <line x1="200" y1="150" x2="80" y2="220" />
                <line x1="200" y1="150" x2="320" y2="240" />
                <line x1="80" y1="220" x2="100" y2="80" />
                <line x1="320" y1="240" x2="300" y2="60" />
              </g>

              {/* Active connections (when particles teleport) */}
              {connections.map((conn, idx) => {
                const fromNode = NODES.find((n) => n.id === conn.from);
                const toNode = NODES.find((n) => n.id === conn.to);
                if (!fromNode || !toNode) return null;

                return (
                  <line
                    // eslint-disable-next-line react/no-array-index-key
                    key={`conn-${idx}-${conn.from}-${conn.to}`}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity={conn.opacity * 0.9}
                    className="text-primary transition-opacity duration-200"
                  />
                );
              })}

              {/* Quantum nodes */}
              {nodes.map((node) => (
                <g key={node.id}>
                  {/* Pulse effect when active */}
                  {node.active && (
                    <>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="18"
                        fill="currentColor"
                        opacity="0.5"
                        className="text-primary animate-ping"
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r="24"
                        fill="currentColor"
                        opacity="0.3"
                        className="text-primary animate-ping"
                        style={{ animationDelay: '0.1s' }}
                      />
                    </>
                  )}
                  {/* Node core */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="8"
                    fill="currentColor"
                    className={
                      node.active
                        ? 'text-primary transition-colors duration-200'
                        : 'text-muted-foreground transition-colors duration-200'
                    }
                  />
                </g>
              ))}

              {/* Quantum particles */}
              {particles.map((particle) => (
                <g key={particle.id}>
                  {/* Outer glow */}
                  <circle
                    cx={particle.x}
                    cy={particle.y}
                    r={16 * particle.scale}
                    fill="currentColor"
                    opacity={particle.opacity * 0.2}
                    className="text-primary"
                  />
                  {/* Inner glow */}
                  <circle
                    cx={particle.x}
                    cy={particle.y}
                    r={10 * particle.scale}
                    fill="currentColor"
                    opacity={particle.opacity * 0.5}
                    className="text-primary"
                  />
                  {/* Particle core */}
                  <circle
                    cx={particle.x}
                    cy={particle.y}
                    r={5 * particle.scale}
                    fill="currentColor"
                    opacity={particle.opacity}
                    className="text-primary"
                  />
                </g>
              ))}
            </svg>
          </div>

          {/* Loading text at bottom */}
          <div className="relative z-10 mt-auto">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                <div
                  className="h-2 w-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: '0.2s' }}
                />
                <div
                  className="h-2 w-2 bg-primary rounded-full animate-pulse"
                  style={{ animationDelay: '0.4s' }}
                />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                Chargement en cours
              </p>
              <p className="text-xs text-muted-foreground font-mono opacity-50">
                Quantum data transfer active
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

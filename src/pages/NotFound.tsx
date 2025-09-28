import { AlertTriangle, Home, Router, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Packet {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lost: boolean;
  opacity: number;
}

export default function NotFound() {
  const navigate = useNavigate();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [lostPackets, setLostPackets] = useState(0);
  const [retryProgress, setRetryProgress] = useState(0);

  // Reset animations when component mounts
  useEffect(() => {
    setPackets([]);
    setLostPackets(0);
    setRetryProgress(0);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPackets((prevPackets) => {
        const newPackets = [...prevPackets];

        // Move existing packets and filter completed ones
        const updatedPackets = newPackets.filter((packet) => {
          if (!packet.lost) {
            const dx = packet.targetX - packet.x;
            const dy = packet.targetY - packet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 5) {
              // eslint-disable-next-line no-param-reassign
              packet.x += dx * 0.02;
              // eslint-disable-next-line no-param-reassign
              packet.y += dy * 0.02;

              // Random chance for packet loss
              if (Math.random() < 0.003) {
                // eslint-disable-next-line no-param-reassign
                packet.lost = true;
                // eslint-disable-next-line no-param-reassign
                packet.opacity = 1;
                setLostPackets((prev) => prev + 1);
              }
              return true; // Keep the packet
            }
            // Packet reached destination, remove it
            return false;
          }
          // Fade out lost packets
          // eslint-disable-next-line no-param-reassign
          packet.opacity -= 0.02;
          return packet.opacity > 0; // Keep only if still visible
        });

        // Add new packets occasionally
        if (Math.random() < 0.1 && updatedPackets.length < 15) {
          const startSide = Math.floor(Math.random() * 4);
          let startX;
          let startY;
          let targetX;
          let targetY;

          switch (startSide) {
            case 0: // Top
              startX = Math.random() * 400;
              startY = 0;
              targetX = Math.random() * 400;
              targetY = 300;
              break;
            case 1: // Right
              startX = 400;
              startY = Math.random() * 300;
              targetX = 0;
              targetY = Math.random() * 300;
              break;
            case 2: // Bottom
              startX = Math.random() * 400;
              startY = 300;
              targetX = Math.random() * 400;
              targetY = 0;
              break;
            default: // Left
              startX = 0;
              startY = Math.random() * 300;
              targetX = 400;
              targetY = Math.random() * 300;
              break;
          }

          updatedPackets.push({
            id: Date.now() + Math.random(),
            x: startX,
            y: startY,
            targetX,
            targetY,
            lost: false,
            opacity: 1,
          });
        }

        return updatedPackets;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setRetryProgress((prev) => {
        const newProgress = prev + 1;
        if (newProgress >= 100) {
          // Redirect to home after a short delay
          setTimeout(() => {
            navigate('/');
          }, 500);
          return 100;
        }
        return newProgress;
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, [navigate]);

  return (
    <div className="bg-gradient-to-br from-background to-muted h-full flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
        <Card className="p-8 text-center relative overflow-hidden">
          {/* Animated network background */}
          <div className="absolute inset-0 opacity-10">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 300"
              className="absolute"
            >
              {/* Network nodes */}
              <circle cx="50" cy="50" r="8" fill="currentColor" />
              <circle cx="200" cy="50" r="8" fill="currentColor" />
              <circle cx="350" cy="50" r="8" fill="currentColor" />
              <circle cx="50" cy="150" r="8" fill="currentColor" />
              <circle cx="200" cy="150" r="8" fill="currentColor" />
              <circle cx="350" cy="150" r="8" fill="currentColor" />
              <circle cx="50" cy="250" r="8" fill="currentColor" />
              <circle cx="200" cy="250" r="8" fill="currentColor" />
              <circle cx="350" cy="250" r="8" fill="currentColor" />

              {/* Network connections */}
              <line
                x1="50"
                y1="50"
                x2="200"
                y2="50"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="200"
                y1="50"
                x2="350"
                y2="50"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="50"
                y1="50"
                x2="50"
                y2="150"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="200"
                y1="50"
                x2="200"
                y2="150"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="350"
                y1="50"
                x2="350"
                y2="150"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="50"
                y1="150"
                x2="200"
                y2="150"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="200"
                y1="150"
                x2="350"
                y2="150"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="50"
                y1="150"
                x2="50"
                y2="250"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="200"
                y1="150"
                x2="200"
                y2="250"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="350"
                y1="150"
                x2="350"
                y2="250"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="50"
                y1="250"
                x2="200"
                y2="250"
                stroke="currentColor"
                strokeWidth="2"
              />
              <line
                x1="200"
                y1="250"
                x2="350"
                y2="250"
                stroke="currentColor"
                strokeWidth="2"
              />

              {/* Animated packets */}
              {packets.map((packet) => (
                <circle
                  key={packet.id}
                  cx={packet.x}
                  cy={packet.y}
                  r="3"
                  fill={packet.lost ? '#ef4444' : '#3b82f6'}
                  opacity={packet.opacity}
                  className="transition-opacity duration-75"
                />
              ))}
            </svg>
          </div>

          <div className="relative z-10">
            {/* Error icon and code */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                <Router className="h-16 w-16 text-muted-foreground" />
                <Wifi className="h-8 w-8 text-red-500 absolute -top-2 -right-2 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <h1 className="text-6xl font-bold font-mono text-foreground">
                4<span className="text-red-500 animate-pulse">0</span>4
              </h1>
              <p className="text-xl text-muted-foreground">
                Erreur de routage détectée
              </p>
            </div>

            {/* Network status */}
            <div className="bg-muted p-4 rounded-lg mb-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">État du réseau</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Paquets perdus</div>
                  <div className="font-mono text-lg text-red-500">
                    {lostPackets.toString().padStart(3, '0')}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">
                    Tentative de reconnexion
                  </div>
                  <Progress value={retryProgress} className="mt-1" />
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Le chemin vers la ressource demandée n&apos;a pas pu être
                établi.
                <br />
                Les paquets de données se perdent dans les méandres du réseau...
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-center">
              <Button asChild className="flex items-center gap-2">
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Retour à l&apos;accueil
                </Link>
              </Button>
            </div>

            {/* Network diagnostics */}
            <div className="mt-8 text-xs text-muted-foreground font-mono">
              <div>Status: CONNECTION_TIMEOUT</div>
              <div>Error: NET::ERR_ADDRESS_UNREACHABLE</div>
              <div>Packets dropped: {lostPackets}/∞</div>
            </div>
          </div>
        </Card>
        </div>
    </div>
  );
}

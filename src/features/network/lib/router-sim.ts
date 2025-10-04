import { startFlightAnimation } from '@/lib/animation';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';

export interface Packet {
  id: string;
  color: string;
  arrivalTime: number;
}

export interface RouterState {
  // Configuration
  inputRate: number; // packets per second
  outputRate: number; // packets per second
  switchingFabricSpeed: number; // packets per second
  inputQueueSize: number; // maximum number of packets
  outputQueueSize: number; // maximum number of packets
  timeScale: number; // time scale factor

  // Queues
  inputQueue: Packet[];
  outputQueue: Packet[];
  droppedPackets: Packet[];

  // Statistics
  packetsGenerated: number;
  packetsProcessed: number;
  packetsDropped: number;

  // Animation state
  isRunning: boolean;
  currentTime: number; // simulation time in ms
}

export function createInitialRouterState(): RouterState {
  return {
    inputRate: 3, // 3 packets/sec
    outputRate: 3, // 3 packets/sec
    switchingFabricSpeed: 5, // 5 packets/sec
    inputQueueSize: 5,
    outputQueueSize: 5,
    timeScale: 1, // 1x normal speed

    inputQueue: [],
    outputQueue: [],
    droppedPackets: [],

    packetsGenerated: 0,
    packetsProcessed: 0,
    packetsDropped: 0,

    isRunning: false,
    currentTime: 0,
  };
}

export class RouterSim extends Simulation<RouterState> {
  private animationCancel?: () => void;

  private nextPacketId = 1;

  private lastInputTime = 0;

  private lastSwitchingTime = 0;

  private lastOutputTime = 0;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<RouterState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialRouterState(), onUpdate, timeProvider);
  }

  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.startTimer();
    this.emit();

    this.startAnimation();
  }

  reset(): void {
    this.stopAnimation();
    this.stopTimer();
    this.resetTimer();

    this.state = createInitialRouterState();
    this.nextPacketId = 1;
    this.lastInputTime = 0;
    this.lastSwitchingTime = 0;
    this.lastOutputTime = 0;
    this.emit();
  }

  setInputRate(packetsPerSec: number): void {
    this.state.inputRate = packetsPerSec;
    this.emit();
  }

  setOutputRate(packetsPerSec: number): void {
    this.state.outputRate = packetsPerSec;
    this.emit();
  }

  setSwitchingFabricSpeed(packetsPerSec: number): void {
    this.state.switchingFabricSpeed = packetsPerSec;
    this.emit();
  }

  setInputQueueSize(size: number): void {
    this.state.inputQueueSize = size;
    // Trim queue if it's now too large
    while (this.state.inputQueue.length > size) {
      const dropped = this.state.inputQueue.pop();
      if (dropped) {
        this.state.droppedPackets.push(dropped);
        this.state.packetsDropped += 1;
      }
    }
    this.emit();
  }

  setOutputQueueSize(size: number): void {
    this.state.outputQueueSize = size;
    // Trim queue if it's now too large
    while (this.state.outputQueue.length > size) {
      const dropped = this.state.outputQueue.pop();
      if (dropped) {
        this.state.droppedPackets.push(dropped);
        this.state.packetsDropped += 1;
      }
    }
    this.emit();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = scale;
    this.emit();
  }

  private startAnimation(): void {
    // Run indefinitely until stopped
    this.animationCancel = startFlightAnimation({
      durationMs: Infinity,
      onProgress: () => {
        this.updateSimulation();
        this.emit();
      },
      onArrived: () => {
        // Never called for infinite duration
      },
    });
  }

  private updateSimulation(): void {
    const now = this.getElapsedTime();
    this.state.currentTime = now;

    // Generate new packets based on input rate
    this.generatePackets(now);

    // Process switching fabric (move from input to output queue)
    this.processSwitchingFabric(now);

    // Process output (remove packets from output queue)
    this.processOutput(now);
  }

  private generatePackets(now: number): void {
    if (this.state.inputRate <= 0) return;

    const intervalMs = 1000 / this.state.inputRate / this.state.timeScale;

    while (now - this.lastInputTime >= intervalMs) {
      this.lastInputTime += intervalMs;

      const packet: Packet = {
        id: `packet-${this.nextPacketId}`,
        arrivalTime: now,
        color: RouterSim.getRandomColor(),
      };

      this.nextPacketId += 1;

      if (this.state.inputQueue.length < this.state.inputQueueSize) {
        this.state.inputQueue.unshift(packet);
        this.state.packetsGenerated += 1;
      } else {
        // Queue is full, drop the packet
        this.state.droppedPackets.push(packet);
        this.state.packetsDropped += 1;
      }
    }
  }

  private processSwitchingFabric(now: number): void {
    if (this.state.switchingFabricSpeed <= 0) return;
    if (this.state.inputQueue.length === 0) return;
    if (this.state.outputQueue.length >= this.state.outputQueueSize) return;

    const intervalMs =
      1000 / this.state.switchingFabricSpeed / this.state.timeScale;

    if (now - this.lastSwitchingTime >= intervalMs) {
      this.lastSwitchingTime = now;

      const packet = this.state.inputQueue.pop();
      if (packet) {
        if (this.state.outputQueue.length < this.state.outputQueueSize) {
          this.state.outputQueue.unshift(packet);
        } else {
          // Output queue is full, drop the packet
          this.state.droppedPackets.push(packet);
          this.state.packetsDropped += 1;
        }
      }
    }
  }

  private processOutput(now: number): void {
    if (this.state.outputRate <= 0) return;
    if (this.state.outputQueue.length === 0) return;

    const intervalMs = 1000 / this.state.outputRate / this.state.timeScale;

    if (now - this.lastOutputTime >= intervalMs) {
      this.lastOutputTime = now;

      const packet = this.state.outputQueue.pop();
      if (packet) {
        this.state.packetsProcessed += 1;
      }
    }
  }

  private stopAnimation(): void {
    this.animationCancel?.();
    this.animationCancel = undefined;
  }

  private static getRandomColor(): string {
    const colors = [
      '#3B82F6', // blue
      '#6366F1', // indigo
      '#10B981', // green
      '#F59E0B', // amber
      '#8B5CF6', // purple
      '#F97316', // orange
      '#EF4444', // red
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  dispose(): void {
    this.stopAnimation();
    super.dispose();
  }
}

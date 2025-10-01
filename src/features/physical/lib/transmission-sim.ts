import { startFlightAnimation } from '@/lib/animation';
import { Simulation, UpdateCallback, TimeProvider } from '@/lib/simulation';

export interface TransmissionState {
  // Configuration
  bandwidth: number; // bits per second
  packetSize: number; // bits
  distance: number; // kilometers
  propagationSpeed: number; // km/s (fixed at 2/3 speed of light)
  timeScale: number; // time scale factor (1x = real time, 100x = 100x slower than real time)

  // Calculated timings
  transmissionDelay: number; // ms
  propagationDelay: number; // ms

  // Animation state
  progress: number; // 0-100% overall progress
  isRunning: boolean;
  isCompleted: boolean;

  // Timeline events
  events: TransmissionEvent[];
}

export interface TransmissionEvent {
  timestamp: number;
  type:
    | 'transmission_start'
    | 'transmission_end'
    | 'propagation_start'
    | 'propagation_end';
  description: string;
}

export function createInitialTransmissionState(): TransmissionState {
  const bandwidth = 1000000; // 1 Mbps
  const packetSize = 8000; // 1 KB = 8000 bits
  const distance = 1000; // 1000 km
  const propagationSpeed = 200000; // 200,000 km/s (2/3 speed of light, fixed)
  const timeScale = 100.0; // 100x slower than real time for visibility

  const transmissionDelay = (packetSize / bandwidth) * 1000; // ms
  const propagationDelay = (distance / propagationSpeed) * 1000; // ms

  return {
    isRunning: false,
    bandwidth,
    packetSize,
    distance,
    propagationSpeed,
    timeScale,
    transmissionDelay,
    propagationDelay,
    progress: 0,
    isCompleted: false,
    events: [],
  };
}

export class TransmissionSim extends Simulation<TransmissionState> {
  private animationCancel?: () => void;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<TransmissionState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialTransmissionState(), onUpdate, timeProvider);
  }

  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.progress = 0;
    this.state.isCompleted = false;
    this.state.events = [];

    this.startTimer();
    this.emit();

    this.addEvent('transmission_start', 'Transmission begins');
    this.startAnimation();
  }

  reset(): void {
    this.stopAnimation();
    this.stopTimer();
    this.resetTimer();

    this.state = createInitialTransmissionState();
    this.recalculateDelays();
    this.emit();
  }

  setBandwidth(bps: number): void {
    this.state.bandwidth = bps;
    this.recalculateDelays();
    this.emit();
  }

  setPacketSize(bits: number): void {
    this.state.packetSize = bits;
    this.recalculateDelays();
    this.emit();
  }

  setDistance(km: number): void {
    this.state.distance = km;
    this.recalculateDelays();
    this.emit();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = scale;
    this.emit();
  }

  private recalculateDelays(): void {
    this.state.transmissionDelay =
      (this.state.packetSize / this.state.bandwidth) * 1000;
    this.state.propagationDelay =
      (this.state.distance / this.state.propagationSpeed) * 1000;
  }

  private startAnimation(): void {
    // Total time = transmission delay + propagation delay
    const totalDelay =
      this.state.transmissionDelay + this.state.propagationDelay;
    const animationDuration = totalDelay * this.state.timeScale;

    this.animationCancel = startFlightAnimation({
      durationMs: animationDuration,
      onProgress: (percentage) => {
        this.state.progress = percentage;

        // Add timeline events at key moments
        if (
          percentage >= 50 &&
          !this.state.events.find((e) => e.type === 'transmission_end')
        ) {
          this.addEvent('transmission_end', 'First bit reaches receiver');
        }

        this.emit();
      },
      onArrived: () => {
        this.state.progress = 100;
        this.state.isCompleted = true;
        this.state.isRunning = false;
        this.addEvent('propagation_end', 'Last bit received - packet complete');
        this.stopTimer();
        this.emit();
      },
    });
  }

  private addEvent(type: TransmissionEvent['type'], description: string): void {
    this.state.events.push({
      timestamp: this.getElapsedTime(),
      type,
      description,
    });
  }

  private stopAnimation(): void {
    this.animationCancel?.();
    this.animationCancel = undefined;
  }

  dispose(): void {
    this.stopAnimation();
    super.dispose();
  }
}

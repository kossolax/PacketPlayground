import { startFlightAnimation } from '@/lib/animation';
import { PacketBase, Simulation } from '@/lib/simulation';

export type TcpConnectionState =
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'TIME_WAIT'
  | 'CLOSE_WAIT'
  | 'LAST_ACK'
  | 'CLOSED';

export type TcpPacketType = 'FIN' | 'ACK' | 'FIN_ACK';

export interface TcpFinPacket extends PacketBase {
  type: TcpPacketType;
  from: 'client' | 'server';
  to: 'client' | 'server';
  ackFlag: boolean;
  finFlag: boolean;
}

export interface FlyingTcpPacket {
  animId: number;
  type: TcpPacketType;
  from: 'client' | 'server';
  to: 'client' | 'server';
  position: number;
  startTime: number;
}

export interface TcpFinState {
  // config
  variant: 'client_closes_first' | 'server_closes_first';
  speed: number;
  timeWaitDuration: number;

  // runtime
  isRunning: boolean;
  phase:
    | 'waiting'
    | 'fin1_sent'
    | 'ack1_sent'
    | 'fin2_sent'
    | 'ack2_sent'
    | 'time_wait'
    | 'completed';
  clientState: TcpConnectionState;
  serverState: TcpConnectionState;

  // packet tracking
  expectedPackets: TcpFinPacket[];
  sentPackets: TcpFinPacket[];
  flyingPackets: FlyingTcpPacket[];

  // timers
  hasTimeWaitTimer: boolean;
}

export function createInitialState(): TcpFinState {
  return {
    variant: 'client_closes_first',
    speed: 2000,
    timeWaitDuration: 4000,
    isRunning: false,
    phase: 'waiting',
    clientState: 'ESTABLISHED',
    serverState: 'ESTABLISHED',
    expectedPackets: [],
    sentPackets: [],
    flyingPackets: [],
    hasTimeWaitTimer: false,
  };
}

export interface TcpFinOptions {
  onUpdate?: (state: TcpFinState) => void;
}

export class TcpFinSim extends Simulation<TcpFinState> {
  private animationId = 0;

  private activeAnimations = new Set<() => void>();

  private timeWaitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: TcpFinOptions = {}) {
    super(createInitialState(), opts.onUpdate);
  }

  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.startTimer();
    this.emit();

    // Start the closing sequence based on variant
    setTimeout(() => {
      if (this.state.variant === 'client_closes_first') {
        this.clientInitiatesClose();
      } else {
        this.serverInitiatesClose();
      }
    }, 500);
  }

  reset(): void {
    this.clearAllTimers();
    this.cancelAllAnimations();
    this.resetTimer();
    const currentVariant = this.state.variant;
    this.state = createInitialState();
    this.state.variant = currentVariant;
    this.emit();
  }

  dispose(): void {
    this.clearAllTimers();
    this.cancelAllAnimations();
  }

  setVariant(variant: 'client_closes_first' | 'server_closes_first'): void {
    this.state.variant = variant;
    this.emit();
  }

  setSpeed(ms: number): void {
    this.state.speed = ms;
    this.emit();
  }

  setTimeWaitDuration(ms: number): void {
    this.state.timeWaitDuration = ms;
    this.emit();
  }

  private clientInitiatesClose(): void {
    this.sendFinPacket('client', 'server');
    this.state.clientState = 'FIN_WAIT_1';
    this.state.phase = 'fin1_sent';
    this.emit();
  }

  private serverInitiatesClose(): void {
    this.sendFinPacket('server', 'client');
    this.state.serverState = 'FIN_WAIT_1';
    this.state.phase = 'fin1_sent';
    this.emit();
  }

  private sendFinPacket(
    from: 'client' | 'server',
    to: 'client' | 'server'
  ): void {
    const packet: TcpFinPacket = {
      seqNum: this.state.sentPackets.length,
      type: 'FIN',
      from,
      to,
      ackFlag: false,
      finFlag: true,
    };

    this.state.sentPackets.push(packet);
    this.sendPacket(packet);
  }

  private sendAckPacket(
    from: 'client' | 'server',
    to: 'client' | 'server'
  ): void {
    const packet: TcpFinPacket = {
      seqNum: this.state.sentPackets.length,
      type: 'ACK',
      from,
      to,
      ackFlag: true,
      finFlag: false,
    };

    this.state.sentPackets.push(packet);
    this.sendPacket(packet);
  }

  private sendPacket(packet: TcpFinPacket): void {
    if (!this.state.isRunning) return;

    const packetAnimId = this.animationId;
    this.animationId += 1;

    const flyingPacket: FlyingTcpPacket = {
      animId: packetAnimId,
      type: packet.type,
      from: packet.from,
      to: packet.to,
      position: 0,
      startTime: Date.now(),
    };

    this.state.flyingPackets = [...this.state.flyingPackets, flyingPacket];
    this.emit();

    const cancelAnimation = startFlightAnimation({
      durationMs: this.state.speed,
      onProgress: (percentage) => {
        this.state.flyingPackets = this.state.flyingPackets.map((p) =>
          p.animId === packetAnimId
            ? {
                ...p,
                position: Math.min(percentage, 100),
              }
            : p
        );
        this.emit();
      },
      onArrived: () => {
        this.activeAnimations.delete(cancelAnimation);
        this.state.flyingPackets = this.state.flyingPackets.filter(
          (p) => p.animId !== packetAnimId
        );

        this.handlePacketArrival(packet);
        this.emit();
      },
    });

    this.activeAnimations.add(cancelAnimation);
  }

  private handlePacketArrival(packet: TcpFinPacket): void {
    const { variant } = this.state;

    if (variant === 'client_closes_first') {
      this.handleClientClosesFirst(packet);
    } else {
      this.handleServerClosesFirst(packet);
    }
  }

  private handleClientClosesFirst(packet: TcpFinPacket): void {
    const { phase } = this.state;

    if (
      phase === 'fin1_sent' &&
      packet.type === 'FIN' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives FIN from client
      this.state.serverState = 'CLOSE_WAIT';
      setTimeout(() => {
        this.sendAckPacket('server', 'client');
        this.state.phase = 'ack1_sent';
      }, 100);
    } else if (
      phase === 'ack1_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'server' &&
      packet.to === 'client'
    ) {
      // Client receives ACK from server
      this.state.clientState = 'FIN_WAIT_2';
      setTimeout(() => {
        this.sendFinPacket('server', 'client');
        this.state.serverState = 'LAST_ACK';
        this.state.phase = 'fin2_sent';
      }, 1000);
    } else if (
      phase === 'fin2_sent' &&
      packet.type === 'FIN' &&
      packet.from === 'server' &&
      packet.to === 'client'
    ) {
      // Client receives FIN from server
      setTimeout(() => {
        this.sendAckPacket('client', 'server');
        this.state.clientState = 'TIME_WAIT';
        this.state.phase = 'ack2_sent';
        this.startTimeWaitTimer();
      }, 100);
    } else if (
      phase === 'ack2_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives final ACK
      this.state.serverState = 'CLOSED';
      this.state.phase = 'time_wait';
    }
  }

  private handleServerClosesFirst(packet: TcpFinPacket): void {
    const { phase } = this.state;

    if (
      phase === 'fin1_sent' &&
      packet.type === 'FIN' &&
      packet.from === 'server' &&
      packet.to === 'client'
    ) {
      // Client receives FIN from server
      this.state.clientState = 'CLOSE_WAIT';
      setTimeout(() => {
        this.sendAckPacket('client', 'server');
        this.state.phase = 'ack1_sent';
      }, 100);
    } else if (
      phase === 'ack1_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives ACK from client
      this.state.serverState = 'FIN_WAIT_2';
      setTimeout(() => {
        this.sendFinPacket('client', 'server');
        this.state.clientState = 'LAST_ACK';
        this.state.phase = 'fin2_sent';
      }, 1000);
    } else if (
      phase === 'fin2_sent' &&
      packet.type === 'FIN' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives FIN from client
      setTimeout(() => {
        this.sendAckPacket('server', 'client');
        this.state.serverState = 'TIME_WAIT';
        this.state.phase = 'ack2_sent';
        this.startTimeWaitTimer();
      }, 100);
    } else if (
      phase === 'ack2_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'server' &&
      packet.to === 'client'
    ) {
      // Client receives final ACK
      this.state.clientState = 'CLOSED';
      this.state.phase = 'time_wait';
    }
  }

  private startTimeWaitTimer(): void {
    this.state.hasTimeWaitTimer = true;
    this.emit();
    this.timeWaitTimer = setTimeout(() => {
      this.state.hasTimeWaitTimer = false;
      if (this.state.variant === 'client_closes_first') {
        this.state.clientState = 'CLOSED';
      } else {
        this.state.serverState = 'CLOSED';
      }
      this.state.phase = 'completed';
      this.state.isRunning = false;
      this.stopTimer();
      this.emit();
    }, this.state.timeWaitDuration);
  }

  private clearAllTimers(): void {
    if (this.timeWaitTimer) {
      clearTimeout(this.timeWaitTimer);
      this.timeWaitTimer = null;
    }
  }

  private cancelAllAnimations(): void {
    this.activeAnimations.forEach((cancel) => cancel());
    this.activeAnimations.clear();
  }
}

import { startFlightAnimation } from '@/lib/animation';
import { PacketBase, Simulation } from '@/lib/simulation';

export type TcpSynState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RCVD'
  | 'ESTABLISHED';

export type FirewallState =
  | 'FILTERING'
  | 'COOKIE_SENT'
  | 'VALIDATED'
  | 'RST_SENT'
  | 'IDLE';

export type TcpSynPacketType = 'SYN' | 'SYN_ACK' | 'ACK' | 'RST';

export interface TcpSynPacket extends PacketBase {
  type: TcpSynPacketType;
  from: 'client' | 'server' | 'firewall';
  to: 'client' | 'server' | 'firewall';
  synFlag: boolean;
  ackFlag: boolean;
  rstFlag: boolean;
  hasCookie?: boolean;
  cookieValue?: string;
  // For firewall relaying
  originalFrom?: 'client' | 'server';
  originalTo?: 'client' | 'server';
}

export interface FlyingSynPacket {
  animId: number;
  type: TcpSynPacketType;
  from: 'client' | 'server' | 'firewall';
  to: 'client' | 'server' | 'firewall';
  position: number;
  startTime: number;
  hasCookie?: boolean;
}

export interface TcpSynStateInterface {
  // config
  withFirewall: boolean;
  speed: number;

  // runtime
  isRunning: boolean;
  phase:
    | 'waiting'
    | 'syn_sent'
    | 'syn_ack_sent'
    | 'ack_sent'
    | 'syn_to_server'
    | 'cookie_validated'
    | 'firewall_to_server'
    | 'server_syn_ack'
    | 'established'
    | 'rst_sent'
    | 'completed';
  clientState: TcpSynState;
  serverState: TcpSynState;
  firewallState: FirewallState;

  // packet tracking
  sentPackets: TcpSynPacket[];
  flyingPackets: FlyingSynPacket[];

  // SYN cookie tracking
  generatedCookie: string | null;
  validatedConnections: string[];
}

export function createInitialSynState(): TcpSynStateInterface {
  return {
    withFirewall: false,
    speed: 2000,
    isRunning: false,
    phase: 'waiting',
    clientState: 'CLOSED',
    serverState: 'LISTEN',
    firewallState: 'IDLE',
    sentPackets: [],
    flyingPackets: [],
    generatedCookie: null,
    validatedConnections: [],
  };
}

export interface TcpSynOptions {
  onUpdate?: (state: TcpSynStateInterface) => void;
}

export class TcpSynSim extends Simulation<TcpSynStateInterface> {
  private animationId = 0;

  private activeAnimations = new Set<() => void>();

  constructor(opts: TcpSynOptions = {}) {
    super(createInitialSynState(), opts.onUpdate);
  }

  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.startTimer();

    // Initialize states based on firewall mode
    if (this.state.withFirewall) {
      this.state.firewallState = 'FILTERING';
    }

    this.emit();

    // Start the SYN handshake
    setTimeout(() => {
      this.clientInitiatesSyn();
    }, 500);
  }

  reset(): void {
    this.cancelAllAnimations();
    this.resetTimer();
    const { withFirewall } = this.state;
    this.state = createInitialSynState();
    this.state.withFirewall = withFirewall;
    this.emit();
  }

  dispose(): void {
    this.cancelAllAnimations();
  }

  setWithFirewall(enabled: boolean): void {
    this.state.withFirewall = enabled;
    if (enabled) {
      this.state.firewallState = 'FILTERING';
    } else {
      this.state.firewallState = 'IDLE';
    }
    this.emit();
  }

  setSpeed(ms: number): void {
    this.state.speed = ms;
    this.emit();
  }

  private clientInitiatesSyn(): void {
    const target = this.state.withFirewall ? 'firewall' : 'server';
    this.sendSynPacket('client', target);
    this.state.clientState = 'SYN_SENT';
    this.state.phase = 'syn_sent';
    this.emit();
  }

  private sendSynPacket(
    from: 'client' | 'server' | 'firewall',
    to: 'client' | 'server' | 'firewall'
  ): void {
    const packet: TcpSynPacket = {
      seqNum: this.state.sentPackets.length,
      type: 'SYN',
      from,
      to,
      synFlag: true,
      ackFlag: false,
      rstFlag: false,
    };

    this.state.sentPackets.push(packet);
    this.sendPacket(packet);
  }

  private sendSynAckPacket(
    from: 'client' | 'server' | 'firewall',
    to: 'client' | 'server' | 'firewall',
    hasCookie = false,
    cookieValue?: string
  ): void {
    const packet: TcpSynPacket = {
      seqNum: this.state.sentPackets.length,
      type: 'SYN_ACK',
      from,
      to,
      synFlag: true,
      ackFlag: true,
      rstFlag: false,
      hasCookie,
      cookieValue,
    };

    this.state.sentPackets.push(packet);
    this.sendPacket(packet);
  }

  private sendAckPacket(
    from: 'client' | 'server' | 'firewall',
    to: 'client' | 'server' | 'firewall'
  ): void {
    const packet: TcpSynPacket = {
      seqNum: this.state.sentPackets.length,
      type: 'ACK',
      from,
      to,
      synFlag: false,
      ackFlag: true,
      rstFlag: false,
    };

    this.state.sentPackets.push(packet);
    this.sendPacket(packet);
  }

  private sendRstPacket(
    from: 'client' | 'server' | 'firewall',
    to: 'client' | 'server' | 'firewall'
  ): void {
    const packet: TcpSynPacket = {
      seqNum: this.state.sentPackets.length,
      type: 'RST',
      from,
      to,
      synFlag: false,
      ackFlag: false,
      rstFlag: true,
    };

    this.state.sentPackets.push(packet);
    this.sendPacket(packet);
  }

  private sendPacket(packet: TcpSynPacket): void {
    if (!this.state.isRunning) return;

    const packetAnimId = this.animationId;
    this.animationId += 1;

    const flyingPacket: FlyingSynPacket = {
      animId: packetAnimId,
      type: packet.type,
      from: packet.from,
      to: packet.to,
      position: 0,
      startTime: Date.now(),
      hasCookie: packet.hasCookie,
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

  private handlePacketArrival(packet: TcpSynPacket): void {
    if (this.state.withFirewall) {
      this.handleFirewallMode(packet);
    } else {
      this.handleNormalMode(packet);
    }
  }

  private handleNormalMode(packet: TcpSynPacket): void {
    const { phase } = this.state;

    if (
      phase === 'syn_sent' &&
      packet.type === 'SYN' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives SYN
      this.state.serverState = 'SYN_RCVD';
      setTimeout(() => {
        this.sendSynAckPacket('server', 'client');
        this.state.phase = 'syn_ack_sent';
      }, 100);
    } else if (
      phase === 'syn_ack_sent' &&
      packet.type === 'SYN_ACK' &&
      packet.from === 'server' &&
      packet.to === 'client'
    ) {
      // Client receives SYN-ACK
      setTimeout(() => {
        this.sendAckPacket('client', 'server');
        this.state.clientState = 'ESTABLISHED';
        this.state.phase = 'ack_sent';
      }, 100);
    } else if (
      phase === 'ack_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives final ACK
      this.state.serverState = 'ESTABLISHED';
      this.state.phase = 'established';

      setTimeout(() => {
        this.state.phase = 'completed';
        this.state.isRunning = false;
        this.stopTimer();
        this.emit();
      }, 1000);
    }
  }

  private handleFirewallMode(packet: TcpSynPacket): void {
    const { phase, firewallState } = this.state;

    if (
      phase === 'syn_sent' &&
      packet.type === 'SYN' &&
      packet.from === 'client' &&
      packet.to === 'firewall'
    ) {
      // Step 1: Firewall receives SYN from client
      if (firewallState === 'FILTERING') {
        this.state.firewallState = 'COOKIE_SENT';
        this.state.generatedCookie = this.generateSynCookie();

        setTimeout(() => {
          this.sendSynAckPacket(
            'firewall',
            'client',
            true,
            this.state.generatedCookie || undefined
          );
          this.state.phase = 'syn_ack_sent';
        }, 100);
      }
    } else if (
      phase === 'syn_ack_sent' &&
      packet.type === 'SYN_ACK' &&
      packet.from === 'firewall' &&
      packet.to === 'client'
    ) {
      // Step 2: Client receives SYN-ACK with cookie from firewall
      setTimeout(() => {
        this.sendAckPacket('client', 'firewall');
        this.state.phase = 'ack_sent';
      }, 100);
    } else if (
      phase === 'ack_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'client' &&
      packet.to === 'firewall'
    ) {
      // Firewall received client's ACK -> respond with RST to close this pseudo-handshake
      this.state.firewallState = 'RST_SENT';
      setTimeout(() => {
        this.sendRstPacket('firewall', 'client');
        this.state.phase = 'rst_sent';
      }, 100);
    } else if (
      phase === 'rst_sent' &&
      packet.type === 'RST' &&
      packet.from === 'firewall' &&
      packet.to === 'client'
    ) {
      // Client received RST from firewall -> start real handshake with server directly
      setTimeout(() => {
        this.sendSynPacket('client', 'server');
        this.state.clientState = 'SYN_SENT';
        this.state.phase = 'syn_to_server';
      }, 150);
    } else if (
      phase === 'syn_to_server' &&
      packet.type === 'SYN' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives SYN from client
      this.state.serverState = 'SYN_RCVD';
      setTimeout(() => {
        this.sendSynAckPacket('server', 'client');
        this.state.phase = 'server_syn_ack';
      }, 100);
    } else if (
      phase === 'server_syn_ack' &&
      packet.type === 'SYN_ACK' &&
      packet.from === 'server' &&
      packet.to === 'client'
    ) {
      // Client receives SYN-ACK from server
      setTimeout(() => {
        this.sendAckPacket('client', 'server');
        this.state.clientState = 'ESTABLISHED';
        this.state.phase = 'ack_sent';
      }, 100);
    } else if (
      phase === 'ack_sent' &&
      packet.type === 'ACK' &&
      packet.from === 'client' &&
      packet.to === 'server'
    ) {
      // Server receives final ACK -> fully established
      this.state.serverState = 'ESTABLISHED';
      this.state.phase = 'established';
      setTimeout(() => {
        this.state.phase = 'completed';
        this.state.isRunning = false;
        this.stopTimer();
        this.emit();
      }, 800);
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private generateSynCookie(): string {
    return `cookie_${Math.random().toString(36).substring(2, 11)}`;
  }

  private validateSynCookie(): boolean {
    return this.state.generatedCookie !== null;
  }

  private cancelAllAnimations(): void {
    this.activeAnimations.forEach((cancel) => cancel());
    this.activeAnimations.clear();
  }
}

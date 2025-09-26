import { shouldLose, startFlightAnimation } from '@/lib/animation';
import { PacketBase, Simulation } from '@/lib/simulation';

export interface SenderPacket extends PacketBase {
  status: 'waiting' | 'sent' | 'acked';
  hasTimer: boolean;
  isFastRetransmit: boolean;
}

export interface FlyingBase {
  // Unique animation instance id (retransmissions => multiple animIds for same seqNum)
  animId: number;
  seqNum: number;
  position: number; // 0..100 (left to right)
  lost: boolean;
  willBeLost: boolean;
  startTime: number;
  isFastRetransmit: boolean;
}

export type FlyingPacket = FlyingBase;

export type FlyingAck = FlyingBase;

export interface GoBackNState {
  // config
  totalPackets: number;
  windowSize: number;
  simulateLoss: boolean;
  lossRate: number; // percent
  speed: number; // ms flight time
  timeoutDuration: number; // ms

  // runtime
  isRunning: boolean;
  base: number;
  nextSeqNum: number;
  expectedSeqNum: number;

  // fast retransmit
  lastAckReceived: number;
  duplicateAckCount: number;

  // visuals/state
  senderPackets: SenderPacket[];
  receivedPackets: number[];
  arrivedPackets: number[];
  flyingPackets: FlyingPacket[];
  flyingAcks: FlyingAck[];
}

export function createInitialState(totalPackets = 10): GoBackNState {
  return {
    totalPackets,
    windowSize: 4,
    simulateLoss: true,
    lossRate: 30,
    speed: 2000,
    timeoutDuration: 5000,
    isRunning: false,
    base: 0,
    nextSeqNum: 0,
    expectedSeqNum: 0,
    lastAckReceived: -1,
    duplicateAckCount: 0,
    senderPackets: Array.from({ length: totalPackets }, (_, i) => ({
      seqNum: i,
      status: 'waiting',
      hasTimer: false,
      isFastRetransmit: false,
    })),
    receivedPackets: [],
    arrivedPackets: [],
    flyingPackets: [],
    flyingAcks: [],
  };
}

export interface GoBackNOptions {
  totalPackets?: number;
  onUpdate?: (state: GoBackNState) => void;
}

export class GoBackNSim extends Simulation<GoBackNState> {
  private baseTimer: ReturnType<typeof setTimeout> | null = null;

  private pendingSend: ReturnType<typeof setTimeout> | null = null;

  private lastSendAt = 0;

  private animationId = 0;

  private isFastRetransmitting = false;

  private activeAnimations = new Set<() => void>();

  private readonly SEND_PACING_MS = 800;

  constructor(opts: GoBackNOptions = {}) {
    super(createInitialState(opts.totalPackets ?? 10), opts.onUpdate);
  }

  // --- public controls ---
  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.emit();
    this.scheduleSendPaced();
  }

  reset(): void {
    const total = this.state.totalPackets;
    this.clearBaseTimer();
    this.clearPendingSend();
    this.cancelAllAnimations();
    this.state = createInitialState(total);
    this.emit();
  }

  dispose(): void {
    this.clearBaseTimer();
    this.clearPendingSend();
    this.cancelAllAnimations();
  }

  // --- config setters ---
  setWindowSize(value: number): void {
    this.state.windowSize = value;
    this.emit();
    this.scheduleSendPaced();
  }

  setSpeed(ms: number): void {
    this.state.speed = ms;
    this.emit();
  }

  setTimeoutDuration(ms: number): void {
    this.state.timeoutDuration = ms;
    this.emit();
  }

  setSimulateLoss(v: boolean): void {
    this.state.simulateLoss = v;
    this.emit();
  }

  setLossRate(v: number): void {
    this.state.lossRate = v;
    this.emit();
  }

  // --- core ---
  private handleTimeout = (): void => {
    this.clearBaseTimer();
    // reset all non-acked >= base
    const { base } = this.state;
    this.state.senderPackets = this.state.senderPackets.map((p) =>
      p.seqNum >= base && p.status !== 'acked'
        ? { ...p, status: 'waiting', hasTimer: false, isFastRetransmit: false }
        : { ...p, hasTimer: false, isFastRetransmit: false }
    );

    this.state.nextSeqNum = base;
    this.state.duplicateAckCount = 0;
    this.lastSendAt = 0;
    this.emit();
    if (this.state.isRunning) this.scheduleSendPaced();
  };

  private handleFastRetransmit = (): void => {
    const { base } = this.state;
    // reset all non-acked >= base
    this.state.senderPackets = this.state.senderPackets.map((p) =>
      p.seqNum >= base && p.status !== 'acked'
        ? { ...p, status: 'waiting', hasTimer: false, isFastRetransmit: false }
        : { ...p, hasTimer: false, isFastRetransmit: false }
    );

    this.state.nextSeqNum = base;
    this.state.duplicateAckCount = 0;
    this.isFastRetransmitting = true;
    this.lastSendAt = 0;
    this.emit();
    if (this.state.isRunning) this.scheduleSendPaced();
  };

  private clearBaseTimer(): void {
    if (this.baseTimer) {
      clearTimeout(this.baseTimer);
      this.baseTimer = null;
    }
  }

  private startBaseTimer(seqNum: number): void {
    this.clearBaseTimer();
    this.baseTimer = setTimeout(this.handleTimeout, this.state.timeoutDuration);
    // reflect timer only on base if it's sent
    this.state.senderPackets = this.state.senderPackets.map((p) => ({
      ...p,
      hasTimer: p.seqNum === seqNum && p.status === 'sent',
    }));
    this.emit();
  }

  private clearPendingSend(): void {
    if (this.pendingSend) {
      clearTimeout(this.pendingSend);
      this.pendingSend = null;
    }
  }

  private cancelAllAnimations(): void {
    this.activeAnimations.forEach((cancel) => cancel());
    this.activeAnimations.clear();
  }

  private canSendNow(): boolean {
    const {
      isRunning,
      totalPackets,
      windowSize,
      base,
      nextSeqNum,
      senderPackets,
    } = this.state;
    if (!isRunning) return false;
    if (nextSeqNum >= totalPackets || nextSeqNum >= base + windowSize)
      return false;
    return senderPackets[nextSeqNum]?.status === 'waiting';
  }

  private trySendOnce(): boolean {
    if (!this.canSendNow()) return false;
    const n = this.state.nextSeqNum;
    this.sendPacket(n);
    if (n === this.state.base) this.startBaseTimer(n);
    this.lastSendAt = Date.now();
    this.state.nextSeqNum = n + 1;
    this.emit();
    return true;
  }

  private scheduleSendPaced(): void {
    // auto-stop if everything acked
    if (this.state.base >= this.state.totalPackets) {
      this.clearPendingSend();
      if (this.state.isRunning) {
        this.state.isRunning = false;
        this.emit();
      }
      return;
    }
    if (!this.canSendNow()) {
      this.clearPendingSend();
      return;
    }
    const now = Date.now();
    const elapsed = now - this.lastSendAt;
    if (elapsed >= this.SEND_PACING_MS) {
      this.clearPendingSend();
      if (this.trySendOnce()) this.scheduleSendPaced();
    } else if (!this.pendingSend) {
      this.pendingSend = setTimeout(() => {
        this.pendingSend = null;
        this.trySendOnce();
        this.scheduleSendPaced();
      }, this.SEND_PACING_MS - elapsed);
    }
  }

  private sendPacket(seqNum: number): void {
    if (seqNum >= this.state.totalPackets || !this.state.isRunning) return;
    // mark sent
    this.state.senderPackets = this.state.senderPackets.map((p) =>
      p.seqNum === seqNum ? { ...p, status: 'sent', isFastRetransmit: false } : p
    );
    this.emit();

    const willBeLost = shouldLose(this.state.simulateLoss, this.state.lossRate);
    const packetAnimId = this.animationId;
    this.animationId += 1;
    const flyingPacket: FlyingPacket = {
      animId: packetAnimId,
      seqNum,
      position: 0,
      lost: false,
      willBeLost,
      startTime: Date.now(),
      isFastRetransmit: this.isFastRetransmitting,
    };
    this.state.flyingPackets = [...this.state.flyingPackets, flyingPacket];

    // Reset fast retransmit flag after sending the first packet
    if (this.isFastRetransmitting && seqNum === this.state.base) {
      this.isFastRetransmitting = false;
    }

    this.emit();

    const cancelAnimation = startFlightAnimation({
      durationMs: this.state.speed,
      willBeLost,
      onProgress: (percentage) => {
        this.state.flyingPackets = this.state.flyingPackets.map((p) =>
          p.animId === packetAnimId && !p.lost
            ? {
                ...p,
                position: willBeLost
                  ? Math.min(percentage, 50)
                  : Math.min(percentage, 100),
              }
            : p
        );
        this.emit();
      },
      onLost: () => {
        this.activeAnimations.delete(cancelAnimation);
        this.state.flyingPackets = this.state.flyingPackets.map((p) =>
          p.animId === packetAnimId ? { ...p, lost: true, position: 50 } : p
        );
        this.emit();
        setTimeout(() => {
          this.state.flyingPackets = this.state.flyingPackets.filter(
            (p) => p.animId !== packetAnimId
          );
          this.emit();
        }, 500);
      },
      onArrived: () => {
        this.activeAnimations.delete(cancelAnimation);
        this.state.flyingPackets = this.state.flyingPackets.filter(
          (p) => p.animId !== packetAnimId
        );
        this.state.arrivedPackets = [...this.state.arrivedPackets, seqNum];
        // receiver logic
        const currentExpected = this.state.expectedSeqNum;
        if (seqNum === currentExpected) {
          this.state.receivedPackets = [...this.state.receivedPackets, seqNum];
          this.state.expectedSeqNum = currentExpected + 1;
          setTimeout(() => this.sendAck(seqNum), 100);
        } else {
          const lastInOrder = currentExpected - 1;
          if (lastInOrder >= 0) {
            setTimeout(() => this.sendAck(lastInOrder), 100);
          }
        }
        this.emit();
      },
    });

    this.activeAnimations.add(cancelAnimation);
  }

  private sendAck(seqNum: number): void {
    const willBeLost = shouldLose(
      this.state.simulateLoss,
      this.state.lossRate / 2
    );
    const ackAnimId = this.animationId;
    this.animationId += 1;
    const flyingAck: FlyingAck = {
      animId: ackAnimId,
      seqNum,
      position: 0,
      lost: false,
      willBeLost,
      startTime: Date.now(),
      isFastRetransmit: false, // ACKs are never fast retransmits
    };
    this.state.flyingAcks = [...this.state.flyingAcks, flyingAck];
    this.emit();

    const cancelAckAnimation = startFlightAnimation({
      durationMs: this.state.speed,
      willBeLost,
      onProgress: (percentage) => {
        this.state.flyingAcks = this.state.flyingAcks.map((a) =>
          a.animId === ackAnimId && !a.lost
            ? {
                ...a,
                position: willBeLost
                  ? Math.min(percentage, 50)
                  : Math.min(percentage, 100),
              }
            : a
        );
        this.emit();
      },
      onLost: () => {
        this.activeAnimations.delete(cancelAckAnimation);
        this.state.flyingAcks = this.state.flyingAcks.map((a) =>
          a.animId === ackAnimId ? { ...a, lost: true, position: 50 } : a
        );
        this.emit();
        setTimeout(() => {
          this.state.flyingAcks = this.state.flyingAcks.filter(
            (a) => a.animId !== ackAnimId
          );
          this.emit();
        }, 500);
      },
      onArrived: () => {
        this.activeAnimations.delete(cancelAckAnimation);
        this.state.flyingAcks = this.state.flyingAcks.filter(
          (a) => a.animId !== ackAnimId
        );

        // Fast retransmit detection
        if (seqNum === this.state.lastAckReceived) {
          this.state.duplicateAckCount++;
          if (this.state.duplicateAckCount >= 3) {
            this.handleFastRetransmit();
            return;
          }
        } else {
          // New ACK received
          this.state.lastAckReceived = seqNum;
          this.state.duplicateAckCount = 1;
        }

        // cumulative ACK
        this.clearBaseTimer();
        this.state.senderPackets = this.state.senderPackets.map((p) =>
          p.seqNum <= seqNum
            ? { ...p, status: 'acked', hasTimer: false, isFastRetransmit: false }
            : { ...p, hasTimer: false }
        );
        const prevBase = this.state.base;
        const newBase = Math.max(prevBase, seqNum + 1);
        this.state.base = newBase;
        if (newBase < this.state.nextSeqNum) this.startBaseTimer(newBase);
        this.emit();
        if (this.state.isRunning) this.scheduleSendPaced();
      },
    });

    this.activeAnimations.add(cancelAckAnimation);
  }

  // emit() and getState() are inherited from Simulation<TState>
}

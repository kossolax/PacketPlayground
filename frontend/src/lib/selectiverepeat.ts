import { shouldLose, startFlightAnimation } from '@/lib/animation';
import { PacketBase, Simulation } from '@/lib/simulation';

export interface SenderPacket extends PacketBase {
  status: 'waiting' | 'sent' | 'acked';
  hasTimer: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  isFastRetransmit: boolean;
}

export interface FlyingBase {
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

export interface ReceiverBuffer {
  seqNum: number;
  received: boolean;
}

export interface SelectiveRepeatState {
  // config
  totalPackets: number;
  windowSize: number;
  lossRate: number; // percent
  speed: number; // ms flight time
  timeoutDuration: number; // ms

  // runtime
  isRunning: boolean;
  base: number;
  nextSeqNum: number;
  expectedSeqNum: number;

  // TCP-like duplicate ACK tracking
  lastAckSent: number;
  duplicateAckCount: number;

  // visuals/state
  senderPackets: SenderPacket[];
  receiverBuffer: ReceiverBuffer[];
  deliveredPackets: number[];
  arrivedPackets: number[];
  flyingPackets: FlyingPacket[];
  flyingAcks: FlyingAck[];
}

export function createInitialState(totalPackets = 10): SelectiveRepeatState {
  return {
    totalPackets,
    windowSize: 4,
    lossRate: 2.5,
    speed: 2000,
    timeoutDuration: 5000,
    isRunning: false,
    base: 0,
    nextSeqNum: 0,
    expectedSeqNum: 0,
    lastAckSent: -1,
    duplicateAckCount: 0,
    senderPackets: Array.from({ length: totalPackets }, (_, i) => ({
      seqNum: i,
      status: 'waiting',
      hasTimer: false,
      timer: null,
      isFastRetransmit: false,
    })),
    receiverBuffer: Array.from({ length: totalPackets }, (_, i) => ({
      seqNum: i,
      received: false,
    })),
    deliveredPackets: [],
    arrivedPackets: [],
    flyingPackets: [],
    flyingAcks: [],
  };
}

export interface SelectiveRepeatOptions {
  totalPackets?: number;
  onUpdate?: (state: SelectiveRepeatState) => void;
}

export class SelectiveRepeatSim extends Simulation<SelectiveRepeatState> {
  private pendingSend: ReturnType<typeof setTimeout> | null = null;

  private lastSendAt = 0;

  private animationId = 0;

  private activeAnimations = new Set<() => void>();

  private readonly SEND_PACING_MS = 800;

  // Track duplicate ACKs for fast retransmit
  private lastAckReceived = -1;

  private senderDuplicateAckCount = 0;

  constructor(opts: SelectiveRepeatOptions = {}) {
    super(createInitialState(opts.totalPackets ?? 10), opts.onUpdate);
  }

  start(): void {
    if (this.state.isRunning) return;
    this.state.isRunning = true;
    this.startTimer();
    this.emit();
    this.scheduleSendPaced();
  }

  reset(): void {
    const total = this.state.totalPackets;
    this.clearPendingSend();
    this.clearAllTimers();
    this.cancelAllAnimations();
    this.resetTimer();
    this.lastAckReceived = -1;
    this.senderDuplicateAckCount = 0;
    this.state = createInitialState(total);
    this.emit();
  }

  dispose(): void {
    this.clearPendingSend();
    this.clearAllTimers();
    this.cancelAllAnimations();
  }

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

  setLossRate(v: number): void {
    this.state.lossRate = v;
    this.emit();
  }

  private handleTimeout = (seqNum: number): void => {
    const packet = this.state.senderPackets.find((p) => p.seqNum === seqNum);
    if (packet && packet.status === 'sent') {
      packet.status = 'waiting';
      packet.hasTimer = false;
      packet.timer = null;
      this.emit();

      // Immediately retransmit the timed-out packet
      if (this.state.isRunning) {
        setTimeout(() => {
          if (packet.status === 'waiting') {
            this.sendPacket(seqNum);
            this.startPacketTimer(seqNum);
            this.emit();
          }
        }, 100);
      }
    }
  };

  private clearAllTimers(): void {
    this.state.senderPackets.forEach((packet) => {
      if (packet.timer) {
        clearTimeout(packet.timer);
        packet.timer = null;
        packet.hasTimer = false;
      }
    });
  }

  private startPacketTimer(seqNum: number): void {
    const packet = this.state.senderPackets.find((p) => p.seqNum === seqNum);
    if (packet) {
      if (packet.timer) {
        clearTimeout(packet.timer);
      }
      packet.timer = setTimeout(
        () => this.handleTimeout(seqNum),
        this.state.timeoutDuration
      );
      packet.hasTimer = true;
      this.emit();
    }
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
    this.startPacketTimer(n);
    this.lastSendAt = Date.now();
    this.state.nextSeqNum = n + 1;
    this.emit();
    return true;
  }

  private scheduleSendPaced(): void {
    if (this.state.base >= this.state.totalPackets) {
      this.clearPendingSend();
      if (this.state.isRunning) {
        this.state.isRunning = false;
        this.stopTimer();
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

    this.state.senderPackets = this.state.senderPackets.map((p) =>
      p.seqNum === seqNum
        ? { ...p, status: 'sent', isFastRetransmit: false }
        : p
    );
    this.emit();

    const willBeLost = shouldLose(this.state.lossRate);
    const packetAnimId = this.animationId;
    this.animationId += 1;
    const flyingPacket: FlyingPacket = {
      animId: packetAnimId,
      seqNum,
      position: 0,
      lost: false,
      willBeLost,
      startTime: Date.now(),
      isFastRetransmit:
        this.state.senderPackets[seqNum]?.isFastRetransmit || false,
    };
    this.state.flyingPackets = [...this.state.flyingPackets, flyingPacket];
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

        // Selective Repeat receiver logic with individual ACKs
        this.state.receiverBuffer[seqNum] = { seqNum, received: true };

        // Deliver packets in order starting from expectedSeqNum
        let currentExpected = this.state.expectedSeqNum;
        while (
          currentExpected < this.state.totalPackets &&
          this.state.receiverBuffer[currentExpected]?.received
        ) {
          this.state.deliveredPackets = [
            ...this.state.deliveredPackets,
            currentExpected,
          ];
          currentExpected += 1;
        }
        this.state.expectedSeqNum = currentExpected;

        // Hybrid TCP-SR: Individual ACK + Duplicate ACK for gaps
        // Always send individual ACK for the received packet
        setTimeout(() => this.sendIndividualAck(seqNum), 100);

        // TCP-like aggressive duplicate ACKs: send duplicate ACK for EVERY out-of-order packet
        if (seqNum >= this.state.expectedSeqNum + 1) {
          // Any packet that arrives when we're expecting a lower sequence number
          const lastInOrder = this.state.expectedSeqNum - 1;
          if (lastInOrder >= 0) {
            setTimeout(() => this.sendDuplicateAck(lastInOrder), 150);
          }
        }
        this.emit();
      },
    });

    this.activeAnimations.add(cancelAnimation);
  }

  private sendIndividualAck(seqNum: number): void {
    this.sendAckInternal(seqNum, false);
  }

  private sendDuplicateAck(seqNum: number): void {
    this.sendAckInternal(seqNum, true);
  }

  private sendAckInternal(seqNum: number, isDuplicate: boolean): void {
    // Track duplicate ACKs for receiver state (for UI display only)
    if (seqNum === this.state.lastAckSent) {
      this.state.duplicateAckCount += 1;
    } else if (!isDuplicate) {
      this.state.lastAckSent = seqNum;
      this.state.duplicateAckCount = 1;
    }
    const willBeLost = shouldLose(this.state.lossRate / 2);
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

        // Handle individual ACK with duplicate detection for fast retransmit
        if (seqNum === this.lastAckReceived) {
          // Duplicate ACK received
          this.senderDuplicateAckCount += 1;

          // Fast retransmit on 3rd duplicate ACK
          if (this.senderDuplicateAckCount === 3) {
            const nextUnacked = seqNum + 1;
            const packetToRetransmit = this.state.senderPackets.find(
              (p) => p.seqNum === nextUnacked
            );
            if (packetToRetransmit && packetToRetransmit.status === 'sent') {
              // Fast retransmit only this specific packet
              packetToRetransmit.status = 'waiting';
              packetToRetransmit.isFastRetransmit = true;
              if (packetToRetransmit.timer) {
                clearTimeout(packetToRetransmit.timer);
                packetToRetransmit.timer = null;
                packetToRetransmit.hasTimer = false;
              }
              // Schedule immediate retransmission
              setTimeout(() => {
                if (packetToRetransmit.status === 'waiting') {
                  this.sendPacket(nextUnacked);
                  this.startPacketTimer(nextUnacked);
                  this.emit();
                }
              }, 50);
            }
          }
        } else {
          // New ACK received - ACK only this specific packet (Selective Repeat style)
          this.lastAckReceived = seqNum;
          this.senderDuplicateAckCount = 1;

          // ACK only the specific packet that was acknowledged
          const packet = this.state.senderPackets.find(
            (p) => p.seqNum === seqNum
          );
          if (packet && packet.status === 'sent') {
            packet.status = 'acked';
            packet.hasTimer = false;
            if (packet.timer) {
              clearTimeout(packet.timer);
              packet.timer = null;
            }
          }

          // Slide window only if this is the base packet
          if (seqNum === this.state.base) {
            let newBase = this.state.base;
            while (
              newBase < this.state.totalPackets &&
              this.state.senderPackets[newBase]?.status === 'acked'
            ) {
              newBase += 1;
            }
            this.state.base = newBase;
          }
        }

        this.emit();
        if (this.state.isRunning) this.scheduleSendPaced();
      },
    });

    this.activeAnimations.add(cancelAckAnimation);
  }
}

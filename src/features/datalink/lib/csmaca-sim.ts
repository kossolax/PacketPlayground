import { computePropagatingBar } from '@/lib/draw';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';
import { arrivalWindow, distanceBetweenPoints } from '@/lib/utils';

// ===== Types =====
export type StationStatus =
  | 'idle'
  | 'sensing'
  | 'rts_tx'
  | 'wait_cts'
  | 'data_tx'
  | 'wait_ack'
  | 'timeout'
  | 'success';

export type FrameType = 'rts' | 'cts' | 'data' | 'ack';

export interface StationState {
  id: number;
  name: string;
  x: number; // position X (px for visualization)
  y: number; // position Y (px for visualization)
  range: number; // radio range (px)
  status: StationStatus;
  carrierSense: boolean;
  hasCollision: boolean; // true when collision detected
  // Transmission state
  targetId?: number; // destination station
  waitingUntilMs?: number; // waiting for response until this time
  // Receiver reservation (when this station has issued CTS)
  reservedForId?: number; // sender for which medium is reserved
  reservedUntilMs?: number; // do not issue CTS to others before this
}

export interface Frame {
  id: number;
  type: FrameType;
  fromId: number;
  toId: number;
  startMs: number;
  durationMs: number;
}

export interface CsmaCaState {
  // Configuration (aligned with CSMA/CD)
  bandwidth: number; // bits per second
  packetSize: number; // bits
  distance: number; // km (for calculating propagation delay)
  propagationSpeed: number; // km/s
  timeScale: number;
  rtsEnabled: boolean;

  // Derived timings (ms simulated)
  transmissionDelay: number; // ms
  propagationDelay: number; // ms

  // Runtime flags
  isRunning: boolean;
  isCompleted: boolean;
  simTimeMs: number;

  // Entities
  stations: StationState[];
  frames: Frame[];

  // Events
  events: Array<{
    timestamp: number;
    simTimeMs: number;
    type: string;
    description: string;
    stationId?: number;
  }>;
}

// ===== Utilities for linear propagation (px <-> km mapping) =====
// We assume the configured `distance` (km) represents the nominal physical
// distance between the typical communicating pair (e.g., A<->B). We map that to
// pixels using their current layout distance to derive km/px, then compute
// per-link propagation times so the animation moves linearly in screen space.

// Get pixel distance between two stations (fallback 0 if any missing)
export function getPxDistance(
  state: CsmaCaState,
  aId: number,
  bId: number
): number {
  const a = state.stations.find((s) => s.id === aId);
  const b = state.stations.find((s) => s.id === bId);
  if (!a || !b) return 0;
  return distanceBetweenPoints(a, b);
}

// Determine km per pixel using the baseline pair (1<->2) if available,
// otherwise use the first two stations, else a conservative default scale.
export function getKmPerPx(state: CsmaCaState): number {
  const s1 = state.stations.find((s) => s.id === 1) ?? state.stations[0];
  const s2 = state.stations.find((s) => s.id === 2) ?? state.stations[1];
  const fallbackPx = 300; // sensible default spacing used in layout
  const basePx =
    s1 && s2 ? Math.max(1, Math.hypot(s1.x - s2.x, s1.y - s2.y)) : fallbackPx;
  // Map configured km to baseline pixel spacing
  return state.distance / basePx;
}

// Propagation delay between two stations, derived from their pixel distance
export function getPairPropagationDelayMs(
  state: CsmaCaState,
  fromId: number,
  toId: number
): number {
  const dPx = getPxDistance(state, fromId, toId);
  const kmPerPx = getKmPerPx(state);
  const dKm = dPx * kmPerPx;
  return (dKm / state.propagationSpeed) * 1000; // ms
}

// Arrival window of a frame (from -> stationId), i.e., when the leading edge reaches
// the station (start), and when the trailing edge passes (end).
export function getArrivalWindowMs(
  state: CsmaCaState,
  frame: Frame,
  stationId: number
): { start: number; end: number } {
  const tp = getPairPropagationDelayMs(state, frame.fromId, stationId);
  // Delegates to generic arrivalWindow helper (start + tp, then + duration)
  return arrivalWindow(frame.startMs, frame.durationMs, tp);
}

// Compute current bar geometry for a frame traveling from -> to at time simNow
export function computeFrameBar(
  state: CsmaCaState,
  frame: Frame
): {
  x: number;
  y: number;
  angle: number;
  length: number;
  active: boolean;
} | null {
  const from = state.stations.find((s) => s.id === frame.fromId);
  const to = state.stations.find((s) => s.id === frame.toId);
  if (!from || !to) return null;

  const simNow = state.simTimeMs;
  const tp = getPairPropagationDelayMs(state, frame.fromId, frame.toId);
  const elapsed = simNow - frame.startMs;

  // Use centralized propagating bar computation
  const barGeometry = computePropagatingBar(
    { x: from.x, y: from.y },
    { x: to.x, y: to.y },
    elapsed,
    frame.durationMs,
    tp
  );

  if (!barGeometry) return null;

  return {
    x: barGeometry.centerX,
    y: barGeometry.centerY,
    angle: barGeometry.angle,
    length: barGeometry.length,
    active: barGeometry.isActive,
  };
}

export function createInitialCsmaCaState(): CsmaCaState {
  const bandwidth = 1_000_000; // 1 Mbps
  const packetSize = 8_000; // 1 KB
  const distance = 1000; // km
  const propagationSpeed = 200_000; // km/s
  const timeScale = 500; // slow-motion

  const transmissionDelay = (packetSize / bandwidth) * 1000; // ms
  const propagationDelay = (distance / propagationSpeed) * 1000; // ms

  // 3 stations: A <-350px-> B <-350px-> C (A and C out of range with each other)
  const stations: StationState[] = [
    {
      id: 1,
      name: 'A',
      x: 100,
      y: 300,
      range: 350,
      status: 'idle',
      carrierSense: false,
      hasCollision: false,
    },
    {
      id: 2,
      name: 'B',
      x: 400,
      y: 300,
      range: 350,
      status: 'idle',
      carrierSense: false,
      hasCollision: false,
    },
    {
      id: 3,
      name: 'C',
      x: 700,
      y: 300,
      range: 350,
      status: 'idle',
      carrierSense: false,
      hasCollision: false,
    },
  ];

  return {
    bandwidth,
    packetSize,
    distance,
    propagationSpeed,
    timeScale,
    rtsEnabled: false,
    transmissionDelay,
    propagationDelay,
    isRunning: false,
    isCompleted: false,
    simTimeMs: 0,
    stations,
    frames: [],
    events: [],
  };
}

// ===== Simulation =====
export class CsmaCaSim extends Simulation<CsmaCaState> {
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  private nextFrameId = 1;

  // Track which frames have been responded to (to avoid duplicates)
  private respondedFrames: Set<number> = new Set();

  // Scenario scheduling
  private scenarioStarts: Array<{
    atMs: number;
    fromId: number;
    toId: number;
  }> = [];

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<CsmaCaState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialCsmaCaState(), onUpdate, timeProvider);
  }

  setScenario(scenario: 'default' | 'single-sender'): void {
    if (scenario === 'single-sender') {
      this.scenarioStarts = [{ atMs: 0, fromId: 1, toId: 2 }]; // Only A → B
    } else {
      // Default: collision scenario
      const t0 = 0;
      const tC = this.state.rtsEnabled
        ? 1
        : Math.floor(0.3 * this.state.propagationDelay);
      this.scenarioStarts = [
        { atMs: t0, fromId: 1, toId: 2 }, // A → B
        { atMs: tC, fromId: 3, toId: 2 }, // C → B
      ];
    }
  }

  start(): void {
    if (this.state.isRunning) return;
    this.resetRuntime();

    // Setup default scenario if not already set
    if (this.scenarioStarts.length === 0) {
      this.setScenario('default');
    }

    this.state.isRunning = true;
    this.emit();
    this.startTimer();
    this.startTick();
  }

  reset(): void {
    this.stopTick();
    this.stopTimer();
    this.resetTimer();
    this.state = createInitialCsmaCaState();
    this.emit();
  }

  setBandwidth(bps: number): void {
    this.state.bandwidth = bps;
    this.recalc();
  }

  setPacketSize(bits: number): void {
    this.state.packetSize = bits;
    this.recalc();
  }

  setDistance(km: number): void {
    this.state.distance = km;
    this.recalc();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = Math.max(1, scale);
    this.emit();
  }

  setRtsEnabled(enabled: boolean): void {
    this.state.rtsEnabled = enabled;
    this.emit();
  }

  dispose(): void {
    this.stopTick();
    super.dispose();
  }

  // ===== Internal =====
  private recalc(): void {
    this.state.transmissionDelay =
      (this.state.packetSize / this.state.bandwidth) * 1000;
    this.state.propagationDelay =
      (this.state.distance / this.state.propagationSpeed) * 1000;
    this.emit();
  }

  private resetRuntime(): void {
    this.state.isCompleted = false;
    this.state.simTimeMs = 0;
    this.state.frames = [];
    this.state.events = [];
    this.state.stations = this.state.stations.map((s) => ({
      ...s,
      status: 'idle',
      carrierSense: false,
      hasCollision: false,
      targetId: undefined,
      waitingUntilMs: undefined,
      reservedForId: undefined,
      reservedUntilMs: undefined,
    }));
    this.nextFrameId = 1;
    this.respondedFrames.clear();
  }

  private startTick(): void {
    this.stopTick();
    const tickMs = 16;
    const startReal = this.timeProvider.now();
    this.tickHandle = setInterval(() => {
      const realElapsed = this.timeProvider.now() - startReal;
      const simNow = realElapsed / this.state.timeScale;
      this.state.simTimeMs = simNow;

      // Trigger scheduled transmissions
      this.scenarioStarts
        .filter((sched) => sched.atMs <= simNow)
        .forEach((sched) => {
          const station = this.state.stations.find(
            (s) => s.id === sched.fromId
          );
          if (station && station.status === 'idle' && !station.targetId) {
            this.tryStartTransmission(sched.fromId, sched.toId, simNow);
          }
        });

      // Update carrier sense for all stations
      this.updateCarrierSense(simNow);

      // Process state transitions
      this.processStationTransitions(simNow);

      // Remove completed frames (after they've finished reaching all stations in range)
      this.state.frames = this.state.frames.filter(
        (f) => simNow < this.getFrameExpiryMs(f)
      );

      // Check completion
      this.checkCompletion();

      this.emit();
    }, tickMs);
  }

  private stopTick(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private tryStartTransmission(
    fromId: number,
    toId: number,
    simNow: number
  ): void {
    const from = this.state.stations.find((s) => s.id === fromId);
    if (!from || from.status !== 'idle') return;

    // Mark target
    this.updateStation(fromId, { targetId: toId });

    // Check carrier sense
    if (from.carrierSense) {
      // Medium busy, wait (will retry when medium becomes idle)
      this.updateStation(fromId, { status: 'sensing' });
      this.addEvent(
        'sensing',
        `Station ${from.name} senses medium busy`,
        fromId,
        simNow
      );
      return;
    }

    if (this.state.rtsEnabled) {
      this.sendRts(fromId, toId, simNow);
    } else {
      this.sendData(fromId, toId, simNow);
    }
  }

  private sendRts(fromId: number, toId: number, simNow: number): void {
    const from = this.state.stations.find((s) => s.id === fromId);
    if (!from) return;

    const rtsDuration = this.state.transmissionDelay * 0.1; // RTS is small
    const rtsFrame: Frame = {
      id: this.nextFrameId,
      type: 'rts',
      fromId,
      toId,
      startMs: simNow,
      durationMs: rtsDuration,
    };
    this.nextFrameId += 1;
    this.state.frames.push(rtsFrame);

    // Expect CTS back after RTS reaches receiver + CTS duration + CTS propagation back
    const tpFwd = getPairPropagationDelayMs(this.state, fromId, toId);
    const tpBack = getPairPropagationDelayMs(this.state, toId, fromId);
    const waitUntil =
      simNow +
      rtsDuration +
      tpFwd +
      rtsDuration +
      tpBack +
      Math.max(tpFwd, tpBack);

    this.updateStation(fromId, {
      status: 'rts_tx',
      waitingUntilMs: waitUntil,
    });
    this.addEvent(
      'rts_tx',
      `Station ${from.name} sends RTS to ${this.getStationName(toId)}`,
      fromId,
      simNow
    );
  }

  private sendCts(fromId: number, toId: number, simNow: number): void {
    const from = this.state.stations.find((s) => s.id === fromId);
    if (!from) return;

    const ctsDuration = this.state.transmissionDelay * 0.1; // CTS is small
    const ctsFrame: Frame = {
      id: this.nextFrameId,
      type: 'cts',
      fromId,
      toId,
      startMs: simNow,
      durationMs: ctsDuration,
    };
    this.nextFrameId += 1;
    this.state.frames.push(ctsFrame);

    // Reserve the medium at receiver `fromId` for sender `toId` until data+ack completes or times out
    const tpFwd = getPairPropagationDelayMs(this.state, toId, fromId); // data from sender to receiver
    const tpBack = getPairPropagationDelayMs(this.state, fromId, toId); // CTS/ACK path receiver->sender
    const dataDuration = this.state.transmissionDelay;
    const ackDuration = this.state.transmissionDelay * 0.1;
    // Conservative reservation window: CTS already started at simNow; then sender receives CTS (tpBack),
    // transmits DATA (dataDuration), which propagates (tpFwd), then receiver sends ACK (ackDuration).
    const reservedUntil = simNow + tpBack + dataDuration + tpFwd + ackDuration;

    this.updateStation(fromId, {
      reservedForId: toId,
      reservedUntilMs: reservedUntil,
    });

    this.addEvent(
      'cts_tx',
      `Station ${from.name} sends CTS to ${this.getStationName(toId)}`,
      fromId,
      simNow
    );
  }

  private sendData(fromId: number, toId: number, simNow: number): void {
    const from = this.state.stations.find((s) => s.id === fromId);
    if (!from) return;

    const dataFrame: Frame = {
      id: this.nextFrameId,
      type: 'data',
      fromId,
      toId,
      startMs: simNow,
      durationMs: this.state.transmissionDelay,
    };
    this.nextFrameId += 1;
    this.state.frames.push(dataFrame);

    const ackDuration = this.state.transmissionDelay * 0.1; // ACK is small
    const tpFwd = getPairPropagationDelayMs(this.state, fromId, toId);
    const tpBack = getPairPropagationDelayMs(this.state, toId, fromId);
    const waitUntil =
      simNow +
      this.state.transmissionDelay +
      tpFwd +
      ackDuration +
      tpBack +
      Math.max(tpFwd, tpBack);

    this.updateStation(fromId, {
      status: 'data_tx',
      waitingUntilMs: waitUntil,
    });
    this.addEvent(
      'data_tx',
      `Station ${from.name} sends DATA to ${this.getStationName(toId)}`,
      fromId,
      simNow
    );
  }

  private sendAck(fromId: number, toId: number, simNow: number): void {
    const from = this.state.stations.find((s) => s.id === fromId);
    if (!from) return;

    const ackDuration = this.state.transmissionDelay * 0.1; // ACK is small
    const ackFrame: Frame = {
      id: this.nextFrameId,
      type: 'ack',
      fromId,
      toId,
      startMs: simNow,
      durationMs: ackDuration,
    };
    this.nextFrameId += 1;
    this.state.frames.push(ackFrame);

    this.addEvent(
      'ack_tx',
      `Station ${from.name} sends ACK to ${this.getStationName(toId)}`,
      fromId,
      simNow
    );
  }

  private processStationTransitions(simNow: number): void {
    this.state.stations.forEach((station) => {
      // Sensing → Start transmission when medium becomes idle
      if (station.status === 'sensing' && !station.carrierSense) {
        // Honor backoff timer if set
        if (station.waitingUntilMs && simNow < station.waitingUntilMs) {
          return;
        }
        // Backoff complete
        if (station.waitingUntilMs && simNow >= station.waitingUntilMs) {
          this.addEvent(
            'backoff_end',
            `Station ${station.name} backoff complete`,
            station.id,
            simNow
          );
          // Clear backoff timer; we'll set a new wait when we send RTS/DATA
          this.updateStation(station.id, { waitingUntilMs: undefined });
        }
        if (station.targetId) {
          if (this.state.rtsEnabled) {
            this.sendRts(station.id, station.targetId, simNow);
          } else {
            this.sendData(station.id, station.targetId, simNow);
          }
        }
      }

      // RTS_TX → WAIT_CTS when RTS transmission completes
      if (station.status === 'rts_tx') {
        const myRts = this.state.frames.find(
          (f) =>
            f.type === 'rts' &&
            f.fromId === station.id &&
            simNow >= f.startMs + f.durationMs
        );
        if (myRts) {
          this.updateStation(station.id, { status: 'wait_cts' });
        }
      }

      // WAIT_CTS → Check for incoming CTS
      if (station.status === 'wait_cts' && station.targetId) {
        const incomingCts = this.state.frames.find(
          (f) =>
            f.type === 'cts' &&
            f.toId === station.id &&
            f.fromId === station.targetId &&
            this.inRange(f.fromId, station.id)
        );

        if (incomingCts) {
          const { end } = getArrivalWindowMs(
            this.state,
            incomingCts,
            station.id
          );
          if (simNow >= end) {
            // CTS received, send DATA
            this.sendData(station.id, station.targetId, simNow);
          }
        } else if (station.waitingUntilMs && simNow >= station.waitingUntilMs) {
          // CTS Timeout → enter backoff then retry RTS
          // Simple backoff: random K slots of size ~= propagationDelay
          const slot = Math.max(1, Math.floor(this.state.propagationDelay));
          const k = Math.floor(Math.random() * 8); // CWmin ~ 8 slots
          const backoff = k * slot;
          this.updateStation(station.id, {
            status: 'sensing',
            waitingUntilMs: simNow + backoff,
          });
          this.addEvent(
            'timeout',
            `Station ${station.name} CTS timeout`,
            station.id,
            simNow
          );
          this.addEvent(
            'backoff_start',
            `Station ${station.name} backoff for ${backoff.toFixed(0)} ms`,
            station.id,
            simNow
          );
        }
      }

      // Receiver responds to RTS
      // First, collect ALL RTS frames to detect collisions (including already responded)
      const allRtsFrames = this.state.frames.filter(
        (f) =>
          f.type === 'rts' &&
          f.toId === station.id &&
          this.inRange(f.fromId, station.id)
      );

      // Immediate RTS collision detection while frames overlap at the receiver
      if (allRtsFrames.length > 1) {
        const activeRtsNow = allRtsFrames.filter((rts) => {
          const { start, end } = getArrivalWindowMs(
            this.state,
            rts,
            station.id
          );
          return simNow >= start && simNow <= end;
        });
        const unrespondedActiveRts = activeRtsNow.filter(
          (f) => !this.respondedFrames.has(f.id)
        );
        if (activeRtsNow.length >= 2 && unrespondedActiveRts.length > 0) {
          this.updateStation(station.id, { hasCollision: true });
          this.addEvent(
            'rts_collision',
            `Station ${station.name} detects RTS collision (simultaneous frames)`,
            station.id,
            simNow
          );
          activeRtsNow.forEach((f) => this.respondedFrames.add(f.id));
        }
      }

      // Check which RTS have fully arrived
      const arrivedRts = allRtsFrames.filter((rts) => {
        const { end } = getArrivalWindowMs(this.state, rts, station.id);
        return simNow >= end;
      });

      if (arrivedRts.length > 0 && station.status === 'idle') {
        // Check for RTS collision - frames whose reception periods overlap
        let hasCollision = false;

        for (let i = 0; i < arrivedRts.length; i += 1) {
          const f1 = arrivedRts[i];
          const f1Win = getArrivalWindowMs(this.state, f1, station.id);
          const f1Start = f1Win.start;
          const f1End = f1Win.end;

          for (let j = i + 1; j < arrivedRts.length; j += 1) {
            const f2 = arrivedRts[j];
            const f2Win = getArrivalWindowMs(this.state, f2, station.id);
            const f2Start = f2Win.start;
            const f2End = f2Win.end;

            // Check if reception periods overlap
            if (!(f1End <= f2Start || f2End <= f1Start)) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }

        // Now filter for non-responded frames
        const unrespondedRts = arrivedRts.filter(
          (f) => !this.respondedFrames.has(f.id)
        );

        if (hasCollision && unrespondedRts.length > 0) {
          // RTS collision detected, don't respond
          this.updateStation(station.id, { hasCollision: true });
          this.addEvent(
            'rts_collision',
            `Station ${station.name} detects RTS collision (overlapping frames)`,
            station.id,
            simNow
          );
          // Mark all unresponded as responded
          unrespondedRts.forEach((f) => this.respondedFrames.add(f.id));
        } else if (!hasCollision && unrespondedRts.length === 1) {
          // Only one RTS, no collision, send CTS
          const rtsFrame = unrespondedRts[0];
          // If already reserved for another sender, ignore this RTS
          if (
            station.reservedForId &&
            station.reservedForId !== rtsFrame.fromId &&
            station.reservedUntilMs &&
            simNow < station.reservedUntilMs
          ) {
            // Do not respond; the sender will timeout waiting for CTS
          } else {
            this.sendCts(station.id, rtsFrame.fromId, simNow);
          }
          this.respondedFrames.add(rtsFrame.id);
        }
      }

      // DATA_TX → WAIT_ACK when data transmission completes
      if (station.status === 'data_tx') {
        const myData = this.state.frames.find(
          (f) =>
            f.type === 'data' &&
            f.fromId === station.id &&
            simNow >= f.startMs + f.durationMs
        );
        if (myData) {
          this.updateStation(station.id, { status: 'wait_ack' });
        }
      }

      // WAIT_ACK → Check for incoming ACK
      if (station.status === 'wait_ack' && station.targetId) {
        const incomingAck = this.state.frames.find(
          (f) =>
            f.type === 'ack' &&
            f.toId === station.id &&
            f.fromId === station.targetId &&
            this.inRange(f.fromId, station.id)
        );

        if (incomingAck) {
          const { end } = getArrivalWindowMs(
            this.state,
            incomingAck,
            station.id
          );
          if (simNow >= end) {
            // ACK received → success
            this.updateStation(station.id, {
              status: 'success',
              waitingUntilMs: undefined,
              targetId: undefined,
            });
            this.addEvent(
              'success',
              `Station ${station.name} transmission successful`,
              station.id,
              simNow
            );
          }
        } else if (station.waitingUntilMs && simNow >= station.waitingUntilMs) {
          // ACK Timeout → enter backoff then retry DATA/RTS
          const slot = Math.max(1, Math.floor(this.state.propagationDelay));
          const k = Math.floor(Math.random() * 8);
          const backoff = k * slot;
          this.updateStation(station.id, {
            status: 'sensing',
            waitingUntilMs: simNow + backoff,
          });
          this.addEvent(
            'timeout',
            `Station ${station.name} ACK timeout (collision at receiver?)`,
            station.id,
            simNow
          );
          this.addEvent(
            'backoff_start',
            `Station ${station.name} backoff for ${backoff.toFixed(0)} ms`,
            station.id,
            simNow
          );
        }
      }

      // Receiver responds to DATA
      // First, collect ALL data frames to detect collisions (including already responded)
      const allDataFrames = this.state.frames.filter(
        (f) =>
          f.type === 'data' &&
          f.toId === station.id &&
          this.inRange(f.fromId, station.id)
      );

      // Immediate DATA collision detection while frames overlap at the receiver
      if (allDataFrames.length > 1) {
        const activeDataNow = allDataFrames.filter((f) => {
          const { start, end } = getArrivalWindowMs(this.state, f, station.id);
          return simNow >= start && simNow <= end;
        });
        const unrespondedActiveData = activeDataNow.filter(
          (f) => !this.respondedFrames.has(f.id)
        );
        if (activeDataNow.length >= 2 && unrespondedActiveData.length > 0) {
          this.updateStation(station.id, { hasCollision: true });
          this.addEvent(
            'collision',
            `Station ${station.name} detects collision (simultaneous frames)`,
            station.id,
            simNow
          );
          activeDataNow.forEach((f) => this.respondedFrames.add(f.id));
        }
      }

      // Check which frames have fully arrived
      const arrivedData = allDataFrames.filter((f) => {
        const { end } = getArrivalWindowMs(this.state, f, station.id);
        return simNow >= end;
      });

      if (
        arrivedData.length > 0 &&
        (station.status === 'idle' || station.id === 2)
      ) {
        // Check for collision - consider any frames that have started arriving
        let hasCollision = false;
        const startedData = allDataFrames.filter((f) => {
          const { start } = getArrivalWindowMs(this.state, f, station.id);
          return simNow >= start;
        });
        for (let i = 0; i < startedData.length; i += 1) {
          const f1 = startedData[i];
          const f1Win = getArrivalWindowMs(this.state, f1, station.id);
          const f1Start = f1Win.start;
          const f1End = f1Win.end;
          for (let j = i + 1; j < startedData.length; j += 1) {
            const f2 = startedData[j];
            const f2Win = getArrivalWindowMs(this.state, f2, station.id);
            const f2Start = f2Win.start;
            const f2End = f2Win.end;
            if (!(f1End <= f2Start || f2End <= f1Start)) {
              hasCollision = true;
              break;
            }
          }
          if (hasCollision) break;
        }

        // Now filter for non-responded frames
        const unrespondedData = arrivedData.filter(
          (f) => !this.respondedFrames.has(f.id)
        );

        if (hasCollision && unrespondedData.length > 0) {
          // Collision detected historically in reception windows; no ACK sent.
          // We only log the event; hasCollision visualization should reflect live overlap,
          // which is handled in updateCarrierSense.
          this.addEvent(
            'collision',
            `Station ${station.name} detects collision (overlapping frames)`,
            station.id,
            simNow
          );
          // Mark all unresponded as responded to avoid re-logging
          unrespondedData.forEach((f) => this.respondedFrames.add(f.id));
        } else if (!hasCollision && unrespondedData.length === 1) {
          // Only one frame, no collision, send ACK
          const dataFrame = unrespondedData[0];
          this.sendAck(station.id, dataFrame.fromId, simNow);
          // Clear reservation after ACK transmission completes
          const ackDuration = this.state.transmissionDelay * 0.1;
          this.updateStation(station.id, {
            reservedForId:
              station.reservedForId === dataFrame.fromId
                ? undefined
                : station.reservedForId,
            reservedUntilMs:
              station.reservedForId === dataFrame.fromId
                ? simNow + ackDuration
                : station.reservedUntilMs,
          });
          this.respondedFrames.add(dataFrame.id);
        }
      }

      // Receiver reservation timeout: if reserved window elapsed and no data in flight, clear reservation
      if (station.reservedForId && station.reservedUntilMs) {
        const anyDataFromReserved = this.state.frames.some((f) => {
          if (f.type !== 'data') return false;
          if (f.fromId !== station.reservedForId) return false;
          const { start, end } = getArrivalWindowMs(this.state, f, station.id);
          return simNow >= start && simNow <= end;
        });
        if (!anyDataFromReserved && simNow >= station.reservedUntilMs) {
          this.updateStation(station.id, {
            reservedForId: undefined,
            reservedUntilMs: undefined,
          });
          this.addEvent(
            'cts_reserve_timeout',
            `Station ${station.name} reservation cleared (no DATA received)`,
            station.id,
            simNow
          );
        }
      }
    });
  }

  private getIncomingDataFrames(stationId: number, simNow: number): Frame[] {
    return this.state.frames.filter((f) => {
      if (f.type !== 'data') return false;
      if (f.toId !== stationId) return false;
      if (!this.inRange(f.fromId, stationId)) return false;

      const { start: arrivalStart, end: arrivalEnd } = getArrivalWindowMs(
        this.state,
        f,
        stationId
      );
      return simNow >= arrivalStart && simNow <= arrivalEnd;
    });
  }

  private updateCarrierSense(simNow: number): void {
    this.state.stations = this.state.stations.map((station) => {
      const sensing = this.state.frames.some((f) => {
        // A station senses the medium if it is within the TRANSMITTER'S range
        // (i.e., can receive signal energy from the sender). The previous
        // check inverted arguments and could under-detect/over-detect sensing,
        // leading to spurious collisions in CSMA/CA without RTS/CTS.
        if (!this.inRange(f.fromId, station.id)) return false;
        const { start, end } = getArrivalWindowMs(this.state, f, station.id);
        return simNow >= start && simNow <= end;
      });
      // Recompute if the station is currently experiencing a collision as a receiver
      // Only DATA frames to this station matter for collision visualization in no-RTS mode
      const activeIncomingData = this.state.frames.filter((f) => {
        if (f.type !== 'data') return false;
        if (f.toId !== station.id) return false;
        if (!this.inRange(f.fromId, station.id)) return false;
        const { start, end } = getArrivalWindowMs(this.state, f, station.id);
        return simNow >= start && simNow <= end;
      });
      const collidingNow = activeIncomingData.length >= 2;
      // Only override hasCollision dynamically in no-RTS mode; when RTS is enabled,
      // keep the value managed by the RTS collision logic to avoid hiding RTS collisions.
      const nextHasCollision = this.state.rtsEnabled
        ? station.hasCollision
        : collidingNow;
      return {
        ...station,
        carrierSense: sensing,
        hasCollision: nextHasCollision,
      };
    });
  }

  private inRange(id1: number, id2: number): boolean {
    const s1 = this.state.stations.find((s) => s.id === id1);
    const s2 = this.state.stations.find((s) => s.id === id2);
    if (!s1 || !s2) return false;

    const dist = Math.sqrt((s1.x - s2.x) ** 2 + (s1.y - s2.y) ** 2);
    return dist <= s1.range;
  }

  private updateStation(id: number, updates: Partial<StationState>): void {
    this.state.stations = this.state.stations.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    );
  }

  private getStationName(id: number): string {
    return this.state.stations.find((s) => s.id === id)?.name ?? '?';
  }

  private addEvent(
    type: string,
    description: string,
    stationId: number | undefined,
    simTimeMs: number
  ): void {
    this.state.events.push({
      timestamp: this.getElapsedTime(),
      simTimeMs,
      type,
      description,
      stationId,
    });
  }

  private checkCompletion(): void {
    if (this.state.isCompleted || !this.state.isRunning) return;

    const aStatus = this.state.stations.find((s) => s.id === 1)?.status;
    const cStatus = this.state.stations.find((s) => s.id === 3)?.status;

    const bothDone =
      (aStatus === 'success' || aStatus === 'timeout') &&
      (cStatus === 'success' || cStatus === 'timeout');

    if (bothDone) {
      this.state.isCompleted = true;
      this.state.isRunning = false;
      this.stopTick();
      this.stopTimer();
    }
  }

  // Compute when a frame can be safely dropped from the active list.
  // We keep it until its trailing edge has passed every station that could sense it.
  private getFrameExpiryMs(f: Frame): number {
    // Consider all stations within range of the sender
    const relevantStations = this.state.stations.filter((s) =>
      this.inRange(f.fromId, s.id)
    );
    if (relevantStations.length === 0) {
      // Fallback: until it reaches the intended receiver
      const tp = getPairPropagationDelayMs(this.state, f.fromId, f.toId);
      return f.startMs + f.durationMs + tp;
    }
    const maxEndAll = relevantStations.reduce((acc, s) => {
      const { end } = getArrivalWindowMs(this.state, f, s.id);
      return Math.max(acc, end);
    }, -Infinity);
    return maxEndAll;
  }
}

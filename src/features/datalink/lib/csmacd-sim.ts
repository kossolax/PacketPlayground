import { Simulation, UpdateCallback, TimeProvider } from '@/lib/simulation';

// ===== Types =====
export type StationStatus =
  | 'idle'
  | 'transmitting'
  | 'collision'
  | 'jam'
  | 'backoff'
  | 'success';

export interface StationState {
  id: number;
  name: string;
  // Position along the bus in kilometers from the left end
  xKm: number;
  status: StationStatus;
  // Visuals
  carrierSense: boolean; // halo when any signal segment crosses this tap
  // Whether this station has a frame pending to send (1-persistent CSMA intention)
  hasFrame?: boolean;
  // Listening window: t0..t0+2*Tp (ms of simulated time)
  listenWindowStartMs?: number;
  listenWindowEndMs?: number;
  // Backoff state
  attempt: number; // CW growth
  backoffUntilMs?: number;
}

export type WaveType = 'data' | 'jam';

export interface Transmission {
  id: number;
  stationId: number; // origin station
  type: WaveType;
  startMs: number; // simulated time
  // For data waves, duration is transmissionDelay; for jam waves, jamDuration
  durationMs: number;
  // If data transmission got aborted due to collision, we clamp duration to the collision moment
  abortedAtMs?: number;
}

export interface Segment {
  startKm: number;
  endKm: number;
  type: WaveType;
  originId: number; // stationId
}

export interface CsmaCdState {
  // Configuration (aligned with Transmission feature)
  bandwidth: number; // bits per second
  packetSize: number; // bits
  distance: number; // kilometers (bus length)
  propagationSpeed: number; // km/s (2/3 c)
  timeScale: number; // 1x real -> 1, 100x slower -> 100

  // Derived timings (ms simulated)
  transmissionDelay: number; // ms
  propagationDelay: number; // ms (end-to-end)
  slotTime: number; // ms (2*Tp)

  // Runtime flags
  isRunning: boolean;
  isCompleted: boolean;

  // Current simulated time in ms (scaled by timeScale)
  simTimeMs: number;

  // Stations on the bus
  stations: StationState[];

  // Active/rippling waves (data + jam)
  transmissions: Transmission[];
  // Segments visible on the bus at current sim time (derived each frame)
  currentSegments: Segment[];

  // Collision overlays (computed at update)
  collisionSegments: Array<{ startKm: number; endKm: number }>;

  // Pretty events for UI timeline
  events: Array<{
    timestamp: number; // real-time elapsed (from Simulation base)
    simTimeMs: number; // simulated time ms
    type:
      | 'tx_start'
      | 'tx_abort_collision'
      | 'listen_window_end'
      | 'jam_start'
      | 'jam_end'
      | 'backoff_start'
      | 'backoff_end'
      | 'tx_success';
    description: string;
    stationId?: number;
  }>;
}

export function createInitialCsmaCdState(): CsmaCdState {
  const bandwidth = 1_000_000; // 1 Mbps
  const packetSize = 8_000; // 1 KB
  const distance = 1000; // km
  const propagationSpeed = 200_000; // km/s
  const timeScale = 500; // slow-motion

  const transmissionDelay = (packetSize / bandwidth) * 1000; // ms
  const propagationDelay = (distance / propagationSpeed) * 1000; // ms
  const slotTime = 2 * propagationDelay;

  // Place 3 stations for clarity
  const stations: StationState[] = [
    {
      id: 1,
      name: 'A',
      xKm: distance * 0.15,
      status: 'idle',
      carrierSense: false,
      hasFrame: false,
      attempt: 0,
    },
    {
      id: 2,
      name: 'B',
      xKm: distance * 0.5,
      status: 'idle',
      carrierSense: false,
      hasFrame: false,
      attempt: 0,
    },
    {
      id: 3,
      name: 'C',
      xKm: distance * 0.85,
      status: 'idle',
      carrierSense: false,
      hasFrame: false,
      attempt: 0,
    },
  ];

  return {
    bandwidth,
    packetSize,
    distance,
    propagationSpeed,
    timeScale,
    transmissionDelay,
    propagationDelay,
    slotTime,
    isRunning: false,
    isCompleted: false,
    simTimeMs: 0,
    stations,
    transmissions: [],
    currentSegments: [],
    collisionSegments: [],
    events: [],
  };
}

// ===== Simulation =====
export class CsmaCdSim extends Simulation<CsmaCdState> {
  // real-time tick driving continuous propagation (~60fps)
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  private nextTransmissionId = 1;

  // scenario scheduling (simulated ms)
  private scenarioStarts: Array<{ atMs: number; stationId: number }> = [];

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<CsmaCdState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialCsmaCdState(), onUpdate, timeProvider);
  }

  // Public controls
  start(): void {
    if (this.state.isRunning) return;
    this.resetRuntime();

    // Scenario: A starts at t=0ms, C starts shortly after (0.3*Tp) to guarantee overlap
    const t0 = 0;
    const tp = this.state.propagationDelay;
    this.scenarioStarts = [
      { atMs: t0, stationId: 1 },
      { atMs: Math.max(1, Math.floor(0.3 * tp)), stationId: 3 },
    ];

    this.state.isRunning = true;
    this.emit();

    this.startTimer(); // drive the on-screen clock (100ms)
    this.startTick(); // drive physics (~60fps)
  }

  reset(): void {
    this.stopTick();
    this.stopTimer();
    this.resetTimer();
    this.state = createInitialCsmaCdState();
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
    // Keep relative station positions
    const old = this.state.distance;
    const ratio = km / (old || 1);
    this.state.distance = km;
    this.state.stations = this.state.stations.map((s) => ({
      ...s,
      xKm: s.xKm * ratio,
    }));
    this.recalc();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = Math.max(1, scale);
    // no need to restart tick; tick uses simulated time derived from real/timeScale
    this.emit();
  }

  triggerManualTransmission(stationId: number): void {
    if (!this.state.isRunning) return;

    const station = this.state.stations.find((s) => s.id === stationId);
    if (!station) return;
    // Mark that this station wants to send a frame
    this.state.stations = this.state.stations.map((s) =>
      s.id === stationId ? { ...s, hasFrame: true } : s
    );
    // Try to start immediately if possible (1-persistent)
    this.tryStartTransmission(stationId, this.state.simTimeMs);
  }

  // ===== Internal =====
  private resetRuntime(): void {
    this.state.isCompleted = false;
    this.state.transmissions = [];
    this.state.collisionSegments = [];
    this.state.events = [];
    this.state.stations = this.state.stations.map((s) => ({
      ...s,
      status: 'idle',
      carrierSense: false,
      hasFrame: false,
      attempt: 0,
      listenWindowStartMs: undefined,
      listenWindowEndMs: undefined,
      backoffUntilMs: undefined,
    }));
    this.nextTransmissionId = 1;
  }

  private recalc(): void {
    this.state.transmissionDelay =
      (this.state.packetSize / this.state.bandwidth) * 1000;
    this.state.propagationDelay =
      (this.state.distance / this.state.propagationSpeed) * 1000;
    this.state.slotTime = 2 * this.state.propagationDelay;
    this.emit();
  }

  private startTick(): void {
    this.stopTick();
    const tickMs = 16; // ~60fps
    const startReal = this.timeProvider.now();
    this.tickHandle = setInterval(() => {
      const realElapsed = this.timeProvider.now() - startReal;
      const simNow = realElapsed / this.state.timeScale; // ms
      this.state.simTimeMs = simNow;

      // 1) Start scheduled transmissions whose time has come and medium is idle locally
      this.scenarioStarts
        .filter((sched) => sched.atMs <= simNow)
        .forEach((sched) => {
          const already = this.state.transmissions.some(
            (t) => t.stationId === sched.stationId && t.type === 'data'
          );
          if (!already) {
            // Mark a frame pending for this station (1-persistent)
            this.state.stations = this.state.stations.map((s) =>
              s.id === sched.stationId ? { ...s, hasFrame: true } : s
            );
            this.tryStartTransmission(sched.stationId, simNow);
          }
        });

      // 2) Compute current segments for all waves and carrier sense per station
      const segments = this.computeAllSegments(simNow);
      this.state.currentSegments = segments;
      this.updateCarrierSense(segments);

      // 2.5) Attempt to start any pending frames if their medium is idle (1-persistent)
      this.runPendingStarts(simNow, segments);

      // 3) Collision detection at transmitters (while listening window active)
      this.detectAndHandleCollisions(simNow, segments);

      // 4) Progress jam/backoff and mark successes
      this.progressLifecycle(simNow);

      // 5) Collision overlays for visualization (zones where >=2 data segments overlap)
      this.state.collisionSegments = CsmaCdSim.computeCollisionOverlaps(
        segments.filter((s) => s.type === 'data')
      );

      // 6) Check for completion (A & C successful -> stop simulation)
      this.checkForCompletion();

      // 7) Emit frame
      this.emit();
    }, tickMs);
  }

  private stopTick(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  // Stop the simulation once stations A (id=1) and C (id=3) have succeeded
  private checkForCompletion(): void {
    if (this.state.isCompleted || !this.state.isRunning) return;

    const a = this.state.stations.find((s) => s.id === 1);
    const c = this.state.stations.find((s) => s.id === 3);
    const aSuccess = a?.status === 'success';
    const cSuccess = c?.status === 'success';
    if (!(aSuccess && cSuccess)) return;

    // Mark completion and stop timers
    this.state.isCompleted = true;
    this.state.isRunning = false;
    this.stopTick();
    this.stopTimer();
  }

  dispose(): void {
    this.stopTick();
    super.dispose();
  }

  private tryStartTransmission(stationId: number, simNow: number): void {
    const st = this.state.stations.find((s) => s.id === stationId);
    if (!st) {
      return;
    }

    // Carrier sense multiple access: start only if idle locally
    const segments = this.computeAllSegments(simNow);
    const localBusy = segments.some(
      (seg) => seg.startKm <= st.xKm && st.xKm <= seg.endKm
    );
    // If no frame pending, do nothing
    if (!st.hasFrame) return;
    if (localBusy) return; // leave as pending; runPendingStarts will retry

    // Start data transmission
    const newId = this.nextTransmissionId;
    this.nextTransmissionId = newId + 1;
    const tx: Transmission = {
      id: newId,
      stationId,
      type: 'data',
      startMs: simNow,
      durationMs: this.state.transmissionDelay,
    };
    this.state.transmissions.push(tx);

    this.state.stations = this.state.stations.map((s) =>
      s.id === st.id
        ? {
            ...s,
            status: 'transmitting',
            hasFrame: false,
            listenWindowStartMs: simNow,
            listenWindowEndMs: simNow + 2 * this.state.propagationDelay,
          }
        : s
    );
    this.addEvent(
      'tx_start',
      `Station ${st.name} starts transmitting`,
      st.id,
      simNow
    );
  }

  // Try to start any stations that have a pending frame and see idle medium locally
  private runPendingStarts(simNow: number, segments: Segment[]): void {
    this.state.stations.forEach((st) => {
      if (!st.hasFrame || st.status !== 'idle') return;
      const localBusy = segments.some(
        (seg) => seg.startKm <= st.xKm && st.xKm <= seg.endKm
      );
      if (!localBusy) {
        this.tryStartTransmission(st.id, simNow);
      }
    });
  }

  private computeAllSegments(simNow: number): Segment[] {
    const L = this.state.distance; // km
    const v = this.state.propagationSpeed; // km/s
    const toSec = (ms: number) => ms / 1000;
    const segs: Segment[] = [];

    this.state.transmissions.forEach((t) => {
      const st = this.state.stations.find((s) => s.id === t.stationId);
      if (!st) {
        return;
      }
      const x0 = st.xKm;
      const tStart = t.startMs;
      const effectiveEnd = t.abortedAtMs ?? t.startMs + t.durationMs;
      const dur = Math.max(0, Math.min(t.durationMs, effectiveEnd - t.startMs));
      const tRel = simNow - tStart;
      if (tRel < 0) {
        return; // not yet started
      }

      // End of activity for this wave when both trailing edges have left the bus
      const maxToLeft = x0; // km
      const maxToRight = L - x0; // km
      const totalFinishSec = toSec(dur) + Math.max(maxToLeft, maxToRight) / v;
      if (tRel / 1000 > totalFinishSec) {
        // wave finished; keep it but no segments now
        return;
      }

      // Leading distances
      const leadDist = Math.min(v * toSec(tRel), L); // km traveled by leading fronts
      const leadRight = Math.min(x0 + leadDist, L);
      const leadLeft = Math.max(x0 - leadDist, 0);

      // Trailing distances (after duration)
      const tRelAfter = tRel - dur;
      let trailRightKm = x0;
      let trailLeftKm = x0;
      if (tRelAfter > 0) {
        const trailDist = Math.min(v * toSec(tRelAfter), L);
        trailRightKm = Math.min(x0 + trailDist, L);
        trailLeftKm = Math.max(x0 - trailDist, 0);
      }

      // Right segment
      if (trailRightKm < leadRight) {
        segs.push({
          startKm: trailRightKm,
          endKm: leadRight,
          type: t.type,
          originId: t.stationId,
        });
      }
      // Left segment
      if (leadLeft < trailLeftKm) {
        segs.push({
          startKm: leadLeft,
          endKm: trailLeftKm,
          type: t.type,
          originId: t.stationId,
        });
      }
    });

    return segs;
  }

  private updateCarrierSense(segments: Segment[]): void {
    this.state.stations = this.state.stations.map((s) => ({
      ...s,
      carrierSense: segments.some(
        (seg) => seg.startKm <= s.xKm && s.xKm <= seg.endKm
      ),
    }));
  }

  private detectAndHandleCollisions(simNow: number, segments: Segment[]): void {
    const dataSegs = segments.filter((s) => s.type === 'data');
    // For each transmitting station, if another data segment covers its location, it's a collision detection
    this.state.stations.forEach((st) => {
      if (st.status !== 'transmitting') {
        return;
      }
      // Use the latest non-aborted data transmission for this station
      const myWave = this.state.transmissions
        .filter(
          (t) => t.stationId === st.id && t.type === 'data' && !t.abortedAtMs
        )
        .sort((a, b) => b.startMs - a.startMs)[0];
      if (!myWave) {
        return;
      }
      const myPos = st.xKm;
      const overlapFromOthers = dataSegs.some(
        (seg) =>
          seg.originId !== st.id && seg.startKm <= myPos && myPos <= seg.endKm
      );
      if (!overlapFromOthers) {
        return;
      }

      // Abort data, mark collision
      if (!myWave.abortedAtMs) {
        myWave.abortedAtMs = simNow;
        // Mark frame pending for retransmission
        this.state.stations = this.state.stations.map((s) =>
          s.id === st.id ? { ...s, status: 'collision', hasFrame: true } : s
        );
        this.addEvent(
          'tx_abort_collision',
          `Station ${st.name} detects collision`,
          st.id,
          simNow
        );

        // Start a short JAM signal
        const jamDur = Math.max(
          0.1 * this.state.slotTime,
          0.05 * this.state.transmissionDelay
        );
        const newId = this.nextTransmissionId;
        this.nextTransmissionId = newId + 1;
        const jam: Transmission = {
          id: newId,
          stationId: st.id,
          type: 'jam',
          startMs: simNow,
          durationMs: jamDur,
        };
        this.state.transmissions.push(jam);
        this.state.stations = this.state.stations.map((s) =>
          s.id === st.id ? { ...s, status: 'jam' } : s
        );
        this.addEvent(
          'jam_start',
          `Station ${st.name} sends JAM`,
          st.id,
          simNow
        );

        // Schedule backoff after jam end
        const attempt = Math.min(st.attempt + 1, 10);
        const kMax = 2 ** attempt - 1;
        const k = Math.floor(Math.random() * (kMax + 1));
        const backoffUntil = simNow + jamDur + k * this.state.slotTime;
        this.state.stations = this.state.stations.map((s) =>
          s.id === st.id ? { ...s, attempt, backoffUntilMs: backoffUntil } : s
        );
        this.addEvent(
          'backoff_start',
          `Station ${st.name} backoff k=${k} slots`,
          st.id,
          simNow + jamDur
        );
      }
    });
  }

  private progressLifecycle(simNow: number): void {
    const L = this.state.distance;
    const v = this.state.propagationSpeed;
    const toSec = (ms: number) => ms / 1000;

    // Mark jam end and potentially schedule retry
    this.state.stations.forEach((st) => {
      if (st.status === 'jam') {
        const jam = this.state.transmissions.find(
          (t) => t.stationId === st.id && t.type === 'jam'
        );
        if (jam) {
          const jamEnd = jam.startMs + jam.durationMs;
          if (simNow >= jamEnd) {
            this.state.stations = this.state.stations.map((s) =>
              s.id === st.id ? { ...s, status: 'backoff' } : s
            );
            this.addEvent(
              'jam_end',
              `Station ${st.name} jam ended`,
              st.id,
              jamEnd
            );
          }
        }
      }

      if (
        st.listenWindowEndMs &&
        st.listenWindowStartMs &&
        st.status === 'transmitting' &&
        simNow >= st.listenWindowEndMs
      ) {
        this.addEvent(
          'listen_window_end',
          `Station ${st.name} listen window (≈2·Tp) elapsed`,
          st.id,
          st.listenWindowEndMs
        );
      }

      if (
        st.status === 'backoff' &&
        st.backoffUntilMs &&
        simNow >= st.backoffUntilMs
      ) {
        this.addEvent(
          'backoff_end',
          `Station ${st.name} backoff complete`,
          st.id,
          st.backoffUntilMs
        );
        this.state.stations = this.state.stations.map((s) =>
          s.id === st.id
            ? {
                ...s,
                status: 'idle',
                backoffUntilMs: undefined,
                hasFrame: true,
              }
            : s
        );
        this.tryStartTransmission(st.id, simNow);
      }
    });

    // Mark successful transmissions: when the latest non-aborted data wave's trailing edges have left both ends
    this.state.stations.forEach((st) => {
      // Pick the most recent (by startMs) non-aborted data transmission for this station
      const candidates = this.state.transmissions.filter(
        (t) => t.stationId === st.id && t.type === 'data' && !t.abortedAtMs
      );
      const myData: Transmission | undefined =
        candidates.length > 0
          ? candidates.slice().sort((a, b) => b.startMs - a.startMs)[0]
          : undefined;

      if (!myData) {
        return; // no active (non-aborted) transmission to consider
      }

      const tRel = simNow - myData.startMs;
      const dur = myData.durationMs;
      const x0 = st.xKm;
      const finishSec = toSec(dur) + Math.max(x0, L - x0) / v;
      if (tRel / 1000 >= finishSec) {
        if (st.status === 'transmitting') {
          this.state.stations = this.state.stations.map((s) =>
            s.id === st.id ? { ...s, status: 'success' } : s
          );
          this.addEvent(
            'tx_success',
            `Station ${st.name} success`,
            st.id,
            simNow
          );
        }
      }
    });
  }

  private static computeCollisionOverlaps(
    dataSegs: Segment[]
  ): Array<{ startKm: number; endKm: number }> {
    if (dataSegs.length <= 1) return [];
    // Sweep line over combined segments
    type Edge = { x: number; delta: number };
    const edges: Edge[] = [];
    dataSegs.forEach((s) => {
      edges.push({ x: s.startKm, delta: +1 });
      edges.push({ x: s.endKm, delta: -1 });
    });
    edges.sort((a, b) => a.x - b.x);
    const overlaps: Array<{ startKm: number; endKm: number }> = [];
    let active = 0;
    let curStart: number | null = null;
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i];
      const prev = active;
      active += e.delta;
      if (prev < 2 && active >= 2) {
        curStart = e.x;
      } else if (prev >= 2 && active < 2) {
        if (curStart !== null && e.x > curStart) {
          overlaps.push({ startKm: curStart, endKm: e.x });
        }
        curStart = null;
      }
    }
    return overlaps;
  }

  private addEvent(
    type: CsmaCdState['events'][number]['type'],
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
}

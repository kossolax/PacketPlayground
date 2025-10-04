import { TimeProvider } from '@/lib/simulation';

export interface FragmentLike {
  originalPacketId: string;
  fragmentIndex: number;
  size: number;
  offset: number;
  color: string;
  existingId?: string;
}

export interface FragmentingRouterOptions {
  routerIndex: number; // index of router between network[i] and network[i+1]
  getNextMtu: () => number; // function to read current outgoing MTU
  ipVersion: 4 | 6;
  timeScale: number;
  processingDelayMs: number; // delay to simulate processing
  pacingMs: number; // delay between emitted subfragments
  onForward: (frag: FragmentLike) => void; // called when a fragment is ready to forward to next hop
  onFragmentation?: (addedFragments: number, addedOverhead: number) => void; // called when a single input fragment is split (addedFragments excludes the original it replaced)
  timeProvider?: TimeProvider;
}

/**
 * Minimal router with input queue and fragmentation (IPv4 only) before forwarding.
 * It serializes processing: one input at a time, then emits 1..N output fragments
 * paced by pacingMs.
 */
export class FragmentingRouter {
  private readonly routerIndex: number;

  private readonly getNextMtu: () => number;

  private ipVersion: 4 | 6;

  private timeScale: number;

  private processingDelayMs: number;

  private pacingMs: number;

  private readonly onForward: (frag: FragmentLike) => void;

  private readonly onFragmentation?: (
    addedFragments: number,
    addedOverhead: number
  ) => void;

  private inputQueue: FragmentLike[] = [];

  private busy = false;

  private timeouts = new Set<ReturnType<typeof setTimeout>>();

  constructor(opts: FragmentingRouterOptions) {
    this.routerIndex = opts.routerIndex;
    this.getNextMtu = opts.getNextMtu;
    this.ipVersion = opts.ipVersion;
    this.timeScale = opts.timeScale;
    this.processingDelayMs = opts.processingDelayMs;
    this.pacingMs = opts.pacingMs;
    this.onForward = opts.onForward;
    this.onFragmentation = opts.onFragmentation;
  }

  setIpVersion(v: 4 | 6) {
    this.ipVersion = v;
  }

  setTimeScale(scale: number) {
    this.timeScale = scale;
  }

  setDelays({
    processingDelayMs,
    pacingMs,
  }: {
    processingDelayMs?: number;
    pacingMs?: number;
  }) {
    if (processingDelayMs !== undefined)
      this.processingDelayMs = processingDelayMs;
    if (pacingMs !== undefined) this.pacingMs = pacingMs;
  }

  enqueue(frag: FragmentLike) {
    this.inputQueue.push({ ...frag });
    this.kick();
  }

  dispose() {
    // Clear pending timeouts
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts.clear();
    // Reset queue state
    this.inputQueue = [];
    this.busy = false;
  }

  clearQueue() {
    this.inputQueue = [];
    this.busy = false;
  }

  private schedule(fn: () => void, delay: number) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, delay);
    this.timeouts.add(id);
  }

  private kick() {
    if (this.busy) return;
    if (this.inputQueue.length === 0) return;

    this.busy = true;
    const inFrag = this.inputQueue.shift()!;

    // Simulate processing delay before forwarding
    this.schedule(() => {
      const mtu = this.getNextMtu();
      if (this.ipVersion === 4 && inFrag.size > mtu) {
        // Fragment IPv4: split payload into 8-byte aligned chunks
        const ipHeaderSize = 20;
        const payloadSize = inFrag.size - ipHeaderSize;
        let maxPayloadPerFragment = mtu - ipHeaderSize;
        maxPayloadPerFragment = Math.floor(maxPayloadPerFragment / 8) * 8;
        if (maxPayloadPerFragment <= 0)
          maxPayloadPerFragment = Math.max(0, mtu - ipHeaderSize);

        const count = Math.ceil(payloadSize / maxPayloadPerFragment);
        if (count > 1) {
          // We replaced one fragment by 'count' fragments => addedFragments = count - 1
          this.onFragmentation?.(count - 1, (count - 1) * ipHeaderSize);
        }
        for (let i = 0; i < count; i += 1) {
          const subPayload = Math.min(
            maxPayloadPerFragment,
            payloadSize - i * maxPayloadPerFragment
          );
          const subSize = subPayload + ipHeaderSize;
          const subOffset = inFrag.offset + i * maxPayloadPerFragment;

          this.schedule(
            () => {
              this.onForward({
                originalPacketId: inFrag.originalPacketId,
                fragmentIndex: inFrag.fragmentIndex * 1000 + i,
                size: subSize,
                offset: subOffset,
                color: inFrag.color,
                existingId: i === 0 ? inFrag.existingId : undefined,
              });
              if (i === count - 1) {
                this.busy = false;
                this.kick();
              }
            },
            ((i + 1) * this.pacingMs) / this.timeScale
          );
        }
      } else {
        // No fragmentation needed (or IPv6): forward immediately after processing (consistent with source pacing model)
        this.schedule(() => {
          this.onForward(inFrag);
          this.busy = false;
          this.kick();
        }, this.pacingMs / this.timeScale);
      }
    }, this.processingDelayMs / this.timeScale);
  }
}

import { startFlightAnimation } from '@/lib/animation';
import { Simulation, TimeProvider, UpdateCallback } from '@/lib/simulation';
import { FragmentingRouter, FragmentLike } from './fragmenting-router';

export interface Network {
  id: number;
  mtu: number;
  x: number; // position for visualization
}

export interface Fragment {
  id: string;
  originalPacketId: string;
  fragmentIndex: number;
  size: number;
  offset: number;
  sourceNetworkId: number;
  targetNetworkId: number;
  position: number; // 0..100 for animation
  color: string;
  // Visual anchors: whether this leg starts/ends at a router icon
  startAtRouter?: boolean;
  endAtRouter?: boolean;
  startAtRightRouter?: boolean;
  // Added for PMTUD / special animations
  kind?: 'data' | 'probe' | 'icmp';
  direction?: 'forward' | 'back';
  customLabel?: string; // affichage override (ex: "Discovery", "MTU 1468")
}

export interface FragmentationState {
  // Configuration
  ipVersion: 4 | 6;
  packetSize: number; // original packet size in bytes
  timeScale: number;

  // Networks with fixed MTUs
  networks: Network[];

  // Runtime
  isRunning: boolean;
  currentTime: number;
  packetsGenerated: number;

  // Flying fragments
  flyingFragments: Fragment[];

  // Statistics
  totalFragments: number;
  ipv4Overhead: number; // extra bytes for IPv4 fragmentation
  ipv6Overhead: number; // overhead for IPv6 (should be much less)

  // Path MTU Discovery (IPv6 only) transient state
  pmtuDiscoveryActive?: boolean;
  discoveredPathMtu?: number;
  // Tracking delivered data fragments (arrivés destination)
  deliveredFragments: number;
}

export function createInitialFragmentationState(): FragmentationState {
  return {
    ipVersion: 4,
    packetSize: 2000,
    timeScale: 1,

    // Three networks with decreasing MTUs
    networks: [
      // Equidistant horizontal positions for Source, R1, R2, Destination anchors
      { id: 0, mtu: 1500, x: 100 }, // Source -> R1 link starts here
      { id: 1, mtu: 1492, x: 300 }, // R1
      { id: 2, mtu: 1468, x: 500 }, // R2 (Destination is implicit to the right in visualization at ~700)
    ],

    isRunning: false,
    currentTime: 0,
    packetsGenerated: 0,

    flyingFragments: [],

    totalFragments: 0,
    ipv4Overhead: 0,
    ipv6Overhead: 0,
    pmtuDiscoveryActive: false,
    discoveredPathMtu: undefined,
    deliveredFragments: 0,
  };
}

export class FragmentationSim extends Simulation<FragmentationState> {
  private animationCancel?: () => void;

  private nextFragmentId = 1;

  private nextPacketId = 1;

  private activeAnimations = new Set<() => void>();

  private readonly FRAGMENT_PACING_MS = 700; // delay between fragment departures (long mode)

  private readonly FIRST_FRAGMENT_EXTRA_DELAY_MS = 600; // retained for router timing reference

  private readonly SOURCE_INITIAL_GAP_MS = 1200; // extra gap before any source fragment leaves

  private readonly ROUTER_PROCESSING_DELAY_MS = 200; // small delay to show hop arrival before re-send

  private routers: FragmentingRouter[] = [];

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<FragmentationState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialFragmentationState(), onUpdate, timeProvider);
    this.buildRouters();
  }

  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.startTimer();
    this.emit();

    // Start sending the packet
    this.sendPacket();
  }

  private rebuildRouterPacing(): void {
    // Update pacing on existing routers (in case pacing constants changed)
    this.routers.forEach((r) =>
      r.setDelays({ pacingMs: this.FRAGMENT_PACING_MS })
    );
  }

  reset(): void {
    this.stopAllAnimations();
    this.stopTimer();
    this.resetTimer();

    const preservedIpVersion = this.state.ipVersion;
    const preservedPacketSize = this.state.packetSize;
    const preservedTimeScale = this.state.timeScale;
    // Dispose existing routers to clear pending timeouts / queues
    this.routers.forEach((r) =>
      (r as unknown as { dispose?: () => void }).dispose?.()
    );

    const fresh = createInitialFragmentationState();
    fresh.ipVersion = preservedIpVersion;
    fresh.packetSize = preservedPacketSize;
    fresh.timeScale = preservedTimeScale;
    this.state = fresh;

    this.nextFragmentId = 1;
    this.nextPacketId = 1;
    this.buildRouters();
    this.emit();
  }

  setIpVersion(version: 4 | 6): void {
    this.state.ipVersion = version;
    // propagate to routers
    this.routers.forEach((r) => r.setIpVersion(version));
    this.emit();
  }

  setPacketSize(size: number): void {
    this.state.packetSize = size;
    this.emit();
  }

  setTimeScale(scale: number): void {
    this.state.timeScale = scale;
    // propagate to routers
    this.routers.forEach((r) => r.setTimeScale(scale));
    this.rebuildRouterPacing();
    this.emit();
  }

  private buildRouters(): void {
    this.routers = [];
    for (let i = 0; i < this.state.networks.length - 1; i += 1) {
      const router = new FragmentingRouter({
        routerIndex: i,
        getNextMtu: () => this.state.networks[i + 1].mtu,
        ipVersion: this.state.ipVersion,
        timeScale: this.state.timeScale,
        processingDelayMs: this.ROUTER_PROCESSING_DELAY_MS,
        pacingMs: this.FRAGMENT_PACING_MS,
        onForward: (frag) => this.onRouterForward(i, frag),
        onFragmentation: (addedFragments, addedOverhead) => {
          this.state.totalFragments += addedFragments;
          if (this.state.ipVersion === 4) {
            this.state.ipv4Overhead += addedOverhead;
          }
          this.emit();
        },
      });
      this.routers.push(router);
    }
  }

  private onRouterForward(routerIndex: number, frag: FragmentLike): void {
    const isLastRouter = routerIndex === this.state.networks.length - 2;

    if (isLastRouter) {
      // Final leg: router right side -> destination
      this.sendSingleFragment(
        frag.originalPacketId,
        frag.fragmentIndex,
        frag.size,
        frag.offset,
        frag.color,
        routerIndex,
        0,
        100,
        frag.existingId,
        /* startAtRouter */ false,
        /* endAtRouter */ false,
        /* startAtRightRouter */ true
      );
    } else {
      // Middle leg: router -> next router
      this.sendSingleFragment(
        frag.originalPacketId,
        frag.fragmentIndex,
        frag.size,
        frag.offset,
        frag.color,
        routerIndex + 1,
        0,
        100,
        frag.existingId,
        /* startAtRouter */ true,
        /* endAtRouter */ true,
        /* startAtRightRouter */ false
      );
    }
  }

  private sendPacket(): void {
    const packetId = `packet-${this.nextPacketId}`;
    this.nextPacketId += 1;
    this.state.packetsGenerated += 1;
    // Couleur aléatoire restaurée pour illustrer différents paquets
    const color = FragmentationSim.getRandomColor();

    if (this.state.ipVersion === 4) {
      // IPv4: fragments at each router when needed
      this.sendIPv4Packet(packetId, this.state.packetSize, color);
    } else {
      // IPv6: Path MTU Discovery, source fragments if needed
      this.sendIPv6Packet(packetId, this.state.packetSize, color);
    }
  }

  private sendIPv4Packet(
    packetId: string,
    totalPacketSize: number,
    color: string
  ): void {
    const ipHeaderSize = 20;
    const firstMtu = this.state.networks[0].mtu;

    if (totalPacketSize > firstMtu) {
      // Source must fragment before first hop (IPv4) because packet exceeds first link MTU
      const payloadSize = totalPacketSize - ipHeaderSize;
      let maxPayloadPerFragment = firstMtu - ipHeaderSize;
      maxPayloadPerFragment = Math.floor(maxPayloadPerFragment / 8) * 8;
      if (maxPayloadPerFragment <= 0) {
        maxPayloadPerFragment = Math.max(0, firstMtu - ipHeaderSize);
      }
      const fragmentCount = Math.ceil(payloadSize / maxPayloadPerFragment);
      this.state.totalFragments += fragmentCount; // all fragments count
      // Overhead: we replaced 1 header with fragmentCount headers
      this.state.ipv4Overhead += (fragmentCount - 1) * ipHeaderSize;

      for (let i = 0; i < fragmentCount; i += 1) {
        const fragPayload = Math.min(
          maxPayloadPerFragment,
          payloadSize - i * maxPayloadPerFragment
        );
        const fragSize = fragPayload + ipHeaderSize;
        const offset = i * maxPayloadPerFragment;
        let delay = 0;
        if (i > 0) {
          delay =
            this.SOURCE_INITIAL_GAP_MS + (i - 1) * this.FRAGMENT_PACING_MS;
        }
        this.sendFragmentFromNetwork(
          packetId,
          // Keep original sequence but ensure uniqueness later when re-fragmenting
          i,
          fragSize,
          offset,
          color,
          0,
          delay
        );
      }
    } else {
      // Fits first link: treat whole packet as one fragment initially
      this.state.totalFragments += 1;
      this.sendFragmentFromNetwork(
        packetId,
        0,
        totalPacketSize,
        0,
        color,
        0,
        0
      );
    }

    this.emit();
  }

  private sendIPv6Packet(
    packetId: string,
    totalPacketSize: number,
    color: string
  ): void {
    // IPv6: run a small Path MTU Discovery animation before sending real fragments
    // (Only if packet would need fragmentation at source)
    const minMtu = Math.min(...this.state.networks.map((n) => n.mtu));
    this.state.discoveredPathMtu = minMtu; // store for potential UI use
    if (totalPacketSize > minMtu) {
      this.state.pmtuDiscoveryActive = true;
      this.emit();
      this.runPathMtuDiscovery(packetId, totalPacketSize, color, () => {
        // After discovery, actually fragment & send
        this.fragmentAndSendIPv6(packetId, totalPacketSize, color, minMtu);
      });
    } else {
      // No discovery animation needed
      this.fragmentAndSendIPv6(packetId, totalPacketSize, color, minMtu);
    }
  }

  private fragmentAndSendIPv6(
    packetId: string,
    totalPacketSize: number,
    color: string,
    minMtu: number
  ): void {
    this.state.pmtuDiscoveryActive = false;
    this.emit();

    const ipv6HeaderSize = 40; // IPv6 header
    const fragmentHeaderSize = 8; // IPv6 fragment extension header
    // IPv6 fragmentation: payload per fragment must be a multiple of 8 bytes (offset units)
    let maxPayloadPerFragment = minMtu - ipv6HeaderSize - fragmentHeaderSize;
    maxPayloadPerFragment = Math.floor(maxPayloadPerFragment / 8) * 8;
    if (maxPayloadPerFragment <= 0) {
      maxPayloadPerFragment = Math.max(
        0,
        minMtu - ipv6HeaderSize - fragmentHeaderSize
      );
    }
    // Total payload excludes the fixed IPv6 header (40 bytes)
    const totalPayload = Math.max(0, totalPacketSize - ipv6HeaderSize);
    const fragmentCount = Math.ceil(totalPayload / maxPayloadPerFragment);

    this.state.totalFragments += fragmentCount;
    this.state.ipv6Overhead += fragmentCount * fragmentHeaderSize;

    // Send fragments sequentially with pacing
    for (let i = 0; i < fragmentCount; i += 1) {
      const fragmentPayload = Math.min(
        maxPayloadPerFragment,
        totalPayload - i * maxPayloadPerFragment
      );
      const offset = i * maxPayloadPerFragment;

      let delay = 0;
      if (i > 0) {
        delay = this.SOURCE_INITIAL_GAP_MS + (i - 1) * this.FRAGMENT_PACING_MS;
      }
      this.sendFragmentFromNetwork(
        packetId,
        i,
        fragmentPayload + ipv6HeaderSize + fragmentHeaderSize,
        offset,
        color,
        0,
        delay
      );
    }

    this.emit();
  }

  // Run a simplified Path MTU Discovery animation: send successive oversized probes
  // that "fail" at routers (simulated) and cause an ICMP Packet Too Big to return.
  private runPathMtuDiscovery(
    packetId: string,
    originalSize: number,
    _color: string,
    onComplete: () => void
  ): void {
    if (!this.state.isRunning) return;
    const minMtu =
      this.state.discoveredPathMtu ||
      Math.min(...this.state.networks.map((n) => n.mtu));

    // Unique forward discovery probe Source -> Destination
    const probe: Fragment = {
      id: `probe-discovery-${packetId}`,
      originalPacketId: packetId,
      fragmentIndex: -1,
      size: originalSize,
      offset: 0,
      sourceNetworkId: 0,
      targetNetworkId: this.state.networks.length - 1,
      position: 0,
      color: '#6366F1',
      kind: 'probe',
      direction: 'forward',
      customLabel: 'Discovery',
    };
    this.state.flyingFragments.push(probe);
    this.emit();

    const forwardDuration = 2200 / this.state.timeScale;
    const pauseAtDest = 400 / this.state.timeScale;
    const backDuration = 1600 / this.state.timeScale;

    const cancelForward = startFlightAnimation({
      durationMs: forwardDuration,
      onProgress: (p) => {
        const f = this.state.flyingFragments.find((ff) => ff.id === probe.id);
        if (f) {
          f.position = p;
          this.emit();
        }
      },
      onArrived: () => {
        // Remove probe after short pause, then send back ICMP-like notification
        setTimeout(() => {
          this.state.flyingFragments = this.state.flyingFragments.filter(
            (ff) => ff.id !== probe.id
          );
          this.emit();
          const icmp: Fragment = {
            id: `icmp-discovery-${packetId}`,
            originalPacketId: packetId,
            fragmentIndex: -2,
            size: minMtu,
            offset: 0,
            sourceNetworkId: 0, // reused logically; direction drives visual
            targetNetworkId: this.state.networks.length - 1,
            position: 0,
            color: '#DC2626',
            kind: 'icmp',
            direction: 'back',
            customLabel: `MTU ${minMtu}`,
          };
          this.state.flyingFragments.push(icmp);
          this.emit();
          const cancelBack = startFlightAnimation({
            durationMs: backDuration,
            onProgress: (p) => {
              const backFrag = this.state.flyingFragments.find(
                (ff) => ff.id === icmp.id
              );
              if (backFrag) {
                backFrag.position = p;
                this.emit();
              }
            },
            onArrived: () => {
              this.state.flyingFragments = this.state.flyingFragments.filter(
                (ff) => ff.id !== icmp.id
              );
              this.emit();
              onComplete();
            },
          });
          this.activeAnimations.add(cancelBack);
        }, pauseAtDest);
      },
    });
    this.activeAnimations.add(cancelForward);
  }

  private sendFragmentFromNetwork(
    packetId: string,
    fragmentIndex: number,
    size: number,
    offset: number,
    color: string,
    networkIndex: number,
    delayMs: number
  ): void {
    setTimeout(() => {
      if (!this.state.isRunning) return;

      if (networkIndex >= this.state.networks.length - 1) {
        // Reached the end
        return;
      }
      // Always send the fragment as-is across this hop; routers will fragment upon arrival before forwarding
      this.sendSingleFragment(
        packetId,
        fragmentIndex,
        size,
        offset,
        color,
        networkIndex,
        0,
        100,
        undefined,
        /* startAtRouter */ false,
        /* endAtRouter */ true
      );
    }, delayMs / this.state.timeScale);
  }

  private forwardFromRouter(
    packetId: string,
    fragmentIndex: number,
    size: number,
    offset: number,
    color: string,
    routerIndex: number,
    reuseExistingId?: string
  ): void {
    if (routerIndex >= this.state.networks.length - 1) {
      // Reached final network, nothing to forward
      return;
    }

    const nextNetwork = this.state.networks[routerIndex + 1];
    const ipHeaderSize = this.state.ipVersion === 4 ? 20 : 40;

    const isLastRouter = routerIndex === this.state.networks.length - 2;

    if (this.state.ipVersion === 4 && size > nextNetwork.mtu) {
      // Fragment at the router before sending to the next hop
      const payloadSize = size - ipHeaderSize;
      // IPv4 fragmentation: all but the last fragment payload must be multiple of 8 bytes
      let maxPayloadPerFragment = nextNetwork.mtu - ipHeaderSize;
      maxPayloadPerFragment = Math.floor(maxPayloadPerFragment / 8) * 8;
      if (maxPayloadPerFragment <= 0) {
        maxPayloadPerFragment = Math.max(0, nextNetwork.mtu - ipHeaderSize);
      }
      const subFragmentCount = Math.ceil(payloadSize / maxPayloadPerFragment);

      this.state.totalFragments += subFragmentCount - 1; // replacing the original by N parts
      this.state.ipv4Overhead += (subFragmentCount - 1) * ipHeaderSize;

      for (let i = 0; i < subFragmentCount; i += 1) {
        const subFragmentPayload = Math.min(
          maxPayloadPerFragment,
          payloadSize - i * maxPayloadPerFragment
        );
        const subFragmentSize = subFragmentPayload + ipHeaderSize;
        const subFragmentOffset = offset + i * maxPayloadPerFragment;

        const reuseId = i === 0 ? reuseExistingId : undefined;
        if (isLastRouter) {
          // Final leg: router (right side) -> destination network
          this.sendSingleFragment(
            packetId,
            fragmentIndex * 1000 + i,
            subFragmentSize,
            subFragmentOffset,
            color,
            routerIndex,
            i * this.FRAGMENT_PACING_MS,
            100,
            reuseId,
            /* startAtRouter */ false,
            /* endAtRouter */ false,
            /* startAtRightRouter */ true
          );
        } else {
          // Middle leg: router -> next router
          this.sendSingleFragment(
            packetId,
            fragmentIndex * 1000 + i,
            subFragmentSize,
            subFragmentOffset,
            color,
            routerIndex + 1,
            i * this.FRAGMENT_PACING_MS,
            100,
            reuseId,
            /* startAtRouter */ true,
            /* endAtRouter */ true,
            /* startAtRightRouter */ false
          );
        }
      }
    } else if (isLastRouter) {
      // No fragmentation needed, final leg: router (right side) -> destination
      this.sendSingleFragment(
        packetId,
        fragmentIndex,
        size,
        offset,
        color,
        routerIndex,
        0,
        100,
        reuseExistingId,
        /* startAtRouter */ false,
        /* endAtRouter */ false,
        /* startAtRightRouter */ true
      );
    } else {
      // No fragmentation needed, middle leg: router -> next router
      this.sendSingleFragment(
        packetId,
        fragmentIndex,
        size,
        offset,
        color,
        routerIndex + 1,
        0,
        100,
        reuseExistingId,
        /* startAtRouter */ true,
        /* endAtRouter */ true,
        /* startAtRightRouter */ false
      );
    }
  }

  private sendSingleFragment(
    packetId: string,
    fragmentIndex: number,
    size: number,
    offset: number,
    color: string,
    networkIndex: number,
    delayMs: number,
    endPercent: number = 100,
    reuseExistingId?: string,
    startAtRouter?: boolean,
    endAtRouter?: boolean,
    startAtRightRouter?: boolean
  ): void {
    setTimeout(() => {
      if (!this.state.isRunning) return;

      let fragment: Fragment | undefined;
      if (reuseExistingId) {
        fragment = this.state.flyingFragments.find(
          (f) => f.id === reuseExistingId
        );
        if (fragment) {
          fragment.originalPacketId = packetId;
          fragment.fragmentIndex = fragmentIndex;
          fragment.size = size;
          fragment.offset = offset;
          fragment.sourceNetworkId = networkIndex;
          fragment.targetNetworkId = networkIndex + 1;
          fragment.position = 0; // start of next hop
          fragment.color = color;
          fragment.startAtRouter = startAtRouter;
          fragment.endAtRouter = endAtRouter;
          fragment.startAtRightRouter = startAtRightRouter;
          this.emit();
        }
      }
      if (!fragment) {
        fragment = {
          id: `fragment-${this.nextFragmentId}`,
          originalPacketId: packetId,
          fragmentIndex,
          size,
          offset,
          sourceNetworkId: networkIndex,
          targetNetworkId: networkIndex + 1,
          position: 0,
          color,
          startAtRouter,
          endAtRouter,
          startAtRightRouter,
        };
        this.nextFragmentId += 1;
        this.state.flyingFragments.push(fragment);
        this.emit();
      }

      // Animate fragment flying along the hop up to endPercent (0..50 ends at router)
      const flightDuration = 2000 / this.state.timeScale;
      const cancel = startFlightAnimation({
        durationMs: flightDuration,
        onProgress: (percentage) => {
          const frag = this.state.flyingFragments.find(
            (f) => f.id === fragment.id
          );
          if (frag) {
            // Map 0..100% to 0..endPercent
            frag.position = (endPercent * percentage) / 100;
            this.emit();
          }
        },
        onArrived: () => {
          // If this leg ends at a router, pause and then forward. If it ends at destination, stop here.
          const arrivedAtDestination =
            !endAtRouter && networkIndex + 1 === this.state.networks.length - 1;

          if (arrivedAtDestination) {
            // Final destination reached: remove and do not forward
            this.state.flyingFragments = this.state.flyingFragments.filter(
              (f) => f.id !== fragment.id
            );
            // Compter uniquement les fragments de données (probe/icmp exclus)
            if (!fragment.kind || fragment.kind === 'data') {
              this.state.deliveredFragments += 1;
            }
            this.emit();
            // Condition d'arrêt robuste : tous les fragments de données livrés
            if (
              this.state.deliveredFragments >= this.state.totalFragments &&
              !this.state.pmtuDiscoveryActive
            ) {
              this.state.isRunning = false;
              this.stopTimer();
              this.emit();
              return;
            }
            // Fallback: plus aucun fragment data en vol
            const stillFlyingData = this.state.flyingFragments.some(
              (f) => f.kind === undefined || f.kind === 'data'
            );
            if (!stillFlyingData && !this.state.pmtuDiscoveryActive) {
              this.state.isRunning = false;
              this.stopTimer();
              this.emit();
            }
            return;
          }

          // Router arrival: keep visible at end of leg and enqueue into router for processing/forwarding
          const arrived = this.state.flyingFragments.find(
            (f) => f.id === fragment.id
          );
          if (arrived) {
            arrived.position = 100;
            this.emit();
          }

          // Enqueue the fragment into the router queue; it will forward (and reuse this id for first sub-fragment)
          this.routers[networkIndex]?.enqueue({
            originalPacketId: packetId,
            fragmentIndex,
            size,
            offset,
            color,
            existingId: fragment.id,
          });
        },
      });

      this.activeAnimations.add(cancel);
    }, delayMs / this.state.timeScale);
  }

  private stopAllAnimations(): void {
    this.activeAnimations.forEach((cancel) => cancel());
    this.activeAnimations.clear();
    this.animationCancel?.();
    this.animationCancel = undefined;
  }

  private static getRandomColor(): string {
    const colors = [
      '#0EA5E9', // sky
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
    this.stopAllAnimations();
    super.dispose();
  }
}

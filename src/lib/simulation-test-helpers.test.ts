import { vi } from 'vitest';

import { Simulation, TimeProvider } from '@/lib/simulation';

/**
 * Mock time provider for testing
 */
export interface MockTimeProvider extends TimeProvider {
  currentTime: number;
  advance: (ms: number) => void;
  set: (ms: number) => void;
}

/**
 * Creates a mock time provider for testing
 */
export function createMockTimeProvider(initialTime = 0): MockTimeProvider {
  let currentTime = initialTime;

  return {
    now: () => currentTime,
    currentTime,
    advance: (ms: number) => {
      currentTime += ms;
    },
    set: (ms: number) => {
      currentTime = ms;
    },
  };
}

/**
 * Mock animation system for testing simulations
 */
export interface MockAnimationSystem {
  mockStartFlightAnimation: ReturnType<typeof vi.fn>;
  mockSetInterval: ReturnType<typeof vi.fn>;
  mockClearInterval: ReturnType<typeof vi.fn>;
  mockTimeProvider: MockTimeProvider;
  triggerProgress: (percentage: number) => void;
  triggerArrived: () => void;
  triggerTick: () => void;
  cancelFunctions: (() => void)[];
  intervalCallbacks: Map<NodeJS.Timeout, () => void>;
}

/**
 * Creates a mock animation system for testing
 */
export function createMockAnimationSystem(): MockAnimationSystem {
  const cancelFunctions: (() => void)[] = [];
  const intervalCallbacks = new Map<NodeJS.Timeout, () => void>();
  let onProgressCallback: ((percentage: number) => void) | null = null;
  let onArrivedCallback: (() => void) | null = null;

  const mockTimeProvider = createMockTimeProvider(0);

  const mockStartFlightAnimation = vi.fn(
    ({
      onProgress,
      onArrived,
    }: {
      durationMs: number;
      onProgress: (percentage: number) => void;
      onArrived: () => void;
    }) => {
      onProgressCallback = onProgress;
      onArrivedCallback = onArrived;

      const cancel = vi.fn();
      cancelFunctions.push(cancel);
      return cancel;
    }
  );

  const mockSetInterval = vi.fn((callback: () => void) => {
    const handle = { id: Math.random() } as NodeJS.Timeout;
    intervalCallbacks.set(handle, callback);
    return handle;
  });

  const mockClearInterval = vi.fn((handle: NodeJS.Timeout) => {
    intervalCallbacks.delete(handle);
  });

  return {
    mockStartFlightAnimation,
    mockSetInterval,
    mockClearInterval,
    mockTimeProvider,
    triggerProgress: (percentage: number) => {
      if (onProgressCallback) onProgressCallback(percentage);
    },
    triggerArrived: () => {
      if (onArrivedCallback) onArrivedCallback();
    },
    triggerTick: () => {
      intervalCallbacks.forEach((callback) => callback());
    },
    cancelFunctions,
    intervalCallbacks,
  };
}

/**
 * Test harness for simulations
 */
export class SimulationTestHarness<TState> {
  private simulation: Simulation<TState>;

  private emittedStates: TState[] = [];

  private mockAnimation: MockAnimationSystem;

  constructor(
    SimClass: new (config: {
      onUpdate?: (state: TState) => void;
      timeProvider?: TimeProvider;
    }) => Simulation<TState>,
    mockAnimation: MockAnimationSystem
  ) {
    this.mockAnimation = mockAnimation;
    this.simulation = new SimClass({
      onUpdate: (state) => {
        this.emittedStates.push(state);
      },
      timeProvider: mockAnimation.mockTimeProvider,
    });
  }

  getSimulation(): Simulation<TState> {
    return this.simulation;
  }

  getState(): TState {
    return this.simulation.getState();
  }

  getEmittedStates(): TState[] {
    return this.emittedStates;
  }

  clearEmittedStates(): void {
    this.emittedStates = [];
  }

  start(): void {
    this.simulation.start();
  }

  reset(): void {
    this.simulation.reset();
  }

  dispose(): void {
    this.simulation.dispose();
  }

  advanceAnimationProgress(percentage: number): void {
    this.mockAnimation.triggerProgress(percentage);
  }

  completeAnimation(): void {
    this.mockAnimation.triggerArrived();
  }

  triggerTick(): void {
    this.mockAnimation.triggerTick();
  }

  triggerMultipleTicks(count: number): void {
    for (let i = 0; i < count; i += 1) {
      this.mockAnimation.triggerTick();
    }
  }

  expectEmitted(): void {
    expect(this.emittedStates.length).toBeGreaterThan(0);
  }

  expectNotEmitted(): void {
    expect(this.emittedStates.length).toBe(0);
  }

  expectStateMatching(matcher: Partial<TState>): void {
    const state = this.getState();
    Object.entries(matcher).forEach(([key, value]) => {
      expect(state[key as keyof TState]).toEqual(value);
    });
  }
}

/**
 * Helper to check if an event of a specific type exists in the events array
 */
export function expectEventOfType<T extends { type: string }>(
  events: T[],
  type: string
): void {
  const event = events.find((e) => e.type === type);
  expect(event).toBeDefined();
}

/**
 * Helper to advance time for testing time-based simulations
 * Note: This only advances vi timers. For simulations using TimeProvider,
 * use mockAnimation.mockTimeProvider.advance(ms) instead.
 */
export function advanceTime(ms: number): void {
  vi.advanceTimersByTime(ms);
}

/**
 * Setup fake timers for simulation tests
 */
export function setupFakeTimers(): void {
  vi.useFakeTimers();
}

/**
 * Cleanup fake timers after tests
 */
export function cleanupFakeTimers(): void {
  vi.clearAllTimers();
  vi.useRealTimers();
}

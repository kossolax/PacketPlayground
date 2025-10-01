import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as animationModule from '@/lib/animation';
import {
  cleanupFakeTimers,
  createMockAnimationSystem,
  setupFakeTimers,
  SimulationTestHarness,
} from '@/lib/simulation-test-helpers.test';
import {
  BitBaudSim,
  createInitialBitBaudState,
  getAllIdealPoints,
  type ModulationType,
} from './bit-baud-sim';

vi.mock('@/lib/animation', () => ({
  startFlightAnimation: vi.fn(),
}));

describe('BitBaudSim', () => {
  let mockAnimation: ReturnType<typeof createMockAnimationSystem>;
  let harness: SimulationTestHarness<
    ReturnType<typeof createInitialBitBaudState>
  >;

  beforeEach(() => {
    setupFakeTimers();
    mockAnimation = createMockAnimationSystem();

    vi.mocked(animationModule.startFlightAnimation).mockImplementation(
      mockAnimation.mockStartFlightAnimation
    );

    harness = new SimulationTestHarness(BitBaudSim, mockAnimation);
  });

  afterEach(() => {
    harness.dispose();
    cleanupFakeTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create initial state with correct default values', () => {
      const state = createInitialBitBaudState();

      expect(state.modulationType).toBe('none');
      expect(state.bitRate).toBe(800);
      expect(state.noiseLevel).toBe(10);
      expect(state.bitsPerSymbol).toBe(1);
      expect(state.baudRate).toBe(800);
      expect(state.isRunning).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.transmittedSymbols).toEqual([]);
      expect(state.events).toEqual([]);
    });

    it('should calculate baud rate and transmission time correctly', () => {
      const state = createInitialBitBaudState();

      // baudRate = bitRate / bitsPerSymbol = 800 / 1 = 800
      expect(state.baudRate).toBe(800);
      // symbolCount = ceil(16 / 1) = 16
      // transmissionTime = (16 / 800) * 1000 = 20 ms
      expect(state.transmissionTime).toBe(20);
    });

    it('should generate random 16-bit batch', () => {
      const state = createInitialBitBaudState();
      expect(state.currentBatch).toHaveLength(16);
      expect(state.currentBatch).toMatch(/^[01]{16}$/);
    });
  });

  describe('Modulation Types', () => {
    it.each<[ModulationType, number, number]>([
      ['none', 1, 800],
      ['4qam', 2, 400],
      ['16qam', 4, 200],
      ['64qam', 6, 133.33333333333334],
      ['256qam', 8, 100],
    ])(
      'should calculate correct values for %s modulation',
      (modType, expectedBitsPerSymbol, expectedBaudRate) => {
        const sim = harness.getSimulation() as BitBaudSim;
        sim.setModulationType(modType);

        const state = harness.getState();
        expect(state.modulationType).toBe(modType);
        expect(state.bitsPerSymbol).toBe(expectedBitsPerSymbol);
        expect(state.baudRate).toBeCloseTo(expectedBaudRate, 2);
      }
    );

    it('should clear constellation when modulation type changes', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.transmitBatch(10);

      expect(harness.getState().transmittedSymbols.length).toBe(10);

      sim.setModulationType('4qam');

      expect(harness.getState().transmittedSymbols).toEqual([]);
    });
  });

  describe('Configuration', () => {
    it('should update bit rate and recalculate baud rate', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      harness.clearEmittedStates();

      sim.setBitRate(1600);

      const state = harness.getState();
      expect(state.bitRate).toBe(1600);
      expect(state.baudRate).toBe(1600); // 1600 / 1 for 'none' modulation
      harness.expectEmitted();
    });

    it('should update noise level', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      harness.clearEmittedStates();

      sim.setNoiseLevel(25);

      const state = harness.getState();
      expect(state.noiseLevel).toBe(25);
      harness.expectEmitted();
    });

    it('should recalculate transmission time when bit rate changes', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      const initialTime = harness.getState().transmissionTime;

      sim.setBitRate(1600);

      const newTime = harness.getState().transmissionTime;
      expect(newTime).toBeLessThan(initialTime);
    });
  });

  describe('Lifecycle', () => {
    it('should start simulation correctly', () => {
      harness.clearEmittedStates();
      harness.start();

      const state = harness.getState();
      expect(state.isRunning).toBe(true);
      expect(state.progress).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.events).toHaveLength(1);
      expect(state.events[0].type).toBe('transmission_start');
      harness.expectEmitted();
    });

    it('should not start if already running', () => {
      harness.start();
      const callCountBefore =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      harness.start();
      const callCountAfter =
        mockAnimation.mockStartFlightAnimation.mock.calls.length;

      expect(callCountAfter).toBe(callCountBefore);
    });

    it('should reset simulation to initial state', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      harness.start();
      harness.advanceAnimationProgress(50);
      sim.transmitBatch(5);

      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.isCompleted).toBe(false);
      expect(state.transmittedSymbols).toEqual([]);
      expect(state.events).toEqual([]);
    });

    it('should stop simulation', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      harness.start();

      sim.stop();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.isCompleted).toBe(true);
    });

    it('should dispose and clean up resources', () => {
      harness.start();
      const cancelFn = mockAnimation.cancelFunctions[0];

      harness.dispose();

      expect(cancelFn).toHaveBeenCalled();
    });
  });

  describe('Constellation Points', () => {
    it('should generate correct number of ideal points for each modulation', () => {
      const testCases: [ModulationType, number][] = [
        ['none', 2],
        ['4qam', 4],
        ['16qam', 16],
        ['64qam', 64],
        ['256qam', 256],
      ];

      testCases.forEach(([modType, expectedCount]) => {
        const points = getAllIdealPoints(modType);
        expect(points).toHaveLength(expectedCount);
      });
    });

    it('should have unique bit patterns for all ideal points', () => {
      const points = getAllIdealPoints('16qam');
      const bitPatterns = points.map((p) => p.bits);
      const uniquePatterns = new Set(bitPatterns);

      expect(uniquePatterns.size).toBe(bitPatterns.length);
    });

    it('should generate ideal points within expected range', () => {
      const points = getAllIdealPoints('4qam');

      points.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(-1);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(-1);
        expect(point.y).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Symbol Transmission', () => {
    it('should transmit symbols with animation progress', () => {
      harness.start();

      // Simulate 25% progress (should transmit first few symbols for 'none' modulation)
      harness.advanceAnimationProgress(25);

      const state = harness.getState();
      expect(state.progress).toBe(25);
      expect(state.transmittedSymbols.length).toBeGreaterThan(0);
    });

    it('should add symbol_sent events during transmission', () => {
      harness.start();
      harness.advanceAnimationProgress(50);

      const state = harness.getState();
      const symbolEvents = state.events.filter((e) => e.type === 'symbol_sent');
      expect(symbolEvents.length).toBeGreaterThan(0);
    });

    it('should transmit batch efficiently', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      const batchSize = 100;

      sim.transmitBatch(batchSize);

      const state = harness.getState();
      expect(state.transmittedSymbols).toHaveLength(batchSize);
    });

    it('should include noise in transmitted symbols', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.setNoiseLevel(20);
      sim.transmitBatch(50);

      const state = harness.getState();
      const hasNoisyPoints = state.transmittedSymbols.some(
        (sym) => sym.noisyX !== sym.idealX || sym.noisyY !== sym.idealY
      );

      expect(hasNoisyPoints).toBe(true);
    });

    it('should detect errors due to noise', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.setNoiseLevel(40); // High noise
      sim.transmitBatch(100);

      const state = harness.getState();
      const errorsDetected = state.transmittedSymbols.some(
        (sym) => sym.hasError
      );

      // With high noise, we expect at least some errors
      expect(errorsDetected).toBe(true);
    });

    it('should have no errors with zero noise', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.setNoiseLevel(0);
      sim.transmitBatch(50);

      const state = harness.getState();
      const allCorrect = state.transmittedSymbols.every((sym) => !sym.hasError);

      expect(allCorrect).toBe(true);
    });

    it('should include decoded bits for each symbol', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.transmitBatch(10);

      const state = harness.getState();
      state.transmittedSymbols.forEach((sym) => {
        expect(sym.decodedBits).toBeDefined();
        expect(sym.decodedBits).toHaveLength(state.bitsPerSymbol);
      });
    });
  });

  describe('Animation Cycles', () => {
    it('should start next batch automatically after completion', () => {
      harness.start();
      const firstBatch = harness.getState().currentBatch;

      harness.completeAnimation();

      const state = harness.getState();
      expect(state.progress).toBe(0);
      expect(state.currentSymbolIndex).toBe(-1);
      expect(state.currentBatch).not.toBe(firstBatch);
      expect(state.events.some((e) => e.type === 'transmission_end')).toBe(
        true
      );
    });

    it('should continue running after completing a batch', () => {
      harness.start();
      harness.completeAnimation();

      expect(mockAnimation.mockStartFlightAnimation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Clear Constellation', () => {
    it('should clear all transmitted symbols', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.transmitBatch(50);

      expect(harness.getState().transmittedSymbols.length).toBe(50);

      sim.clearConstellation();

      expect(harness.getState().transmittedSymbols).toEqual([]);
    });

    it('should emit after clearing constellation', () => {
      const sim = harness.getSimulation() as BitBaudSim;
      sim.transmitBatch(20);
      harness.clearEmittedStates();

      sim.clearConstellation();

      harness.expectEmitted();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high bit rate', () => {
      const sim = harness.getSimulation() as BitBaudSim;

      expect(() => sim.setBitRate(1_000_000)).not.toThrow();
      const state = harness.getState();
      expect(state.bitRate).toBe(1_000_000);
    });

    it('should handle very low bit rate', () => {
      const sim = harness.getSimulation() as BitBaudSim;

      expect(() => sim.setBitRate(10)).not.toThrow();
      const state = harness.getState();
      expect(state.bitRate).toBe(10);
    });

    it('should handle noise level at boundaries', () => {
      const sim = harness.getSimulation() as BitBaudSim;

      sim.setNoiseLevel(0);
      expect(harness.getState().noiseLevel).toBe(0);

      sim.setNoiseLevel(50);
      expect(harness.getState().noiseLevel).toBe(50);
    });

    it('should handle multiple resets', () => {
      harness.start();
      harness.reset();
      harness.reset();
      harness.reset();

      const state = harness.getState();
      expect(state.isRunning).toBe(false);
      expect(state.transmittedSymbols).toEqual([]);
    });

    it('should handle dispose without start', () => {
      expect(() => harness.dispose()).not.toThrow();
    });

    it('should handle batch transmission of zero symbols', () => {
      const sim = harness.getSimulation() as BitBaudSim;

      expect(() => sim.transmitBatch(0)).not.toThrow();
      expect(harness.getState().transmittedSymbols).toEqual([]);
    });
  });
});

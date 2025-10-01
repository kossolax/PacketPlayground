import { startFlightAnimation } from '@/lib/animation';
import { Simulation, UpdateCallback, TimeProvider } from '@/lib/simulation';

export type ModulationType = 'none' | '4qam' | '16qam' | '64qam' | '256qam';

export interface TransmittedSymbol {
  bits: string;
  idealX: number;
  idealY: number;
  noisyX: number;
  noisyY: number;
  timestamp: number;
  hasError: boolean; // true if decoded incorrectly due to noise
  decodedBits?: string; // what bits were decoded from noisy position
}

export interface BitBaudState {
  // Configuration
  modulationType: ModulationType;
  bitRate: number; // bits per second
  noiseLevel: number; // Noise level (0-50, 0=no noise)

  // Calculated values
  bitsPerSymbol: number; // 1, 2, 4, 6, or 8
  baudRate: number; // symbols per second
  transmissionTime: number; // time per 16 bits in ms

  // Animation state
  progress: number; // 0-100% overall progress for current batch
  currentBatch: string; // current 16 bits being transmitted
  currentSymbolIndex: number; // which symbol is currently being transmitted (within current batch)
  isRunning: boolean;
  isCompleted: boolean;

  // Constellation data (accumulates over time)
  transmittedSymbols: TransmittedSymbol[]; // all symbols ever transmitted

  // Timeline events
  events: BitBaudEvent[];
}

export interface BitBaudEvent {
  timestamp: number;
  type: 'transmission_start' | 'symbol_sent' | 'transmission_end';
  description: string;
  symbolIndex?: number;
  bits?: string;
}

function getBitsPerSymbol(modulation: ModulationType): number {
  switch (modulation) {
    case 'none':
      return 1;
    case '4qam':
      return 2;
    case '16qam':
      return 4;
    case '64qam':
      return 6;
    case '256qam':
      return 8;
    default:
      return 1;
  }
}

function getModulationLabel(modulation: ModulationType): string {
  switch (modulation) {
    case 'none':
      return 'No modulation (1 bit/symbol)';
    case '4qam':
      return '4-QAM (2 bits/symbol)';
    case '16qam':
      return '16-QAM (4 bits/symbol)';
    case '64qam':
      return '64-QAM (6 bits/symbol)';
    case '256qam':
      return '256-QAM (8 bits/symbol)';
    default:
      return 'Unknown';
  }
}

export { getModulationLabel };

// Generate random 16-bit string
function generateRandomBits(): string {
  let bits = '';
  for (let i = 0; i < 16; i += 1) {
    bits += Math.random() < 0.5 ? '0' : '1';
  }
  return bits;
}

// Get constellation point coordinates
function getConstellationPoint(
  bits: string,
  modulation: ModulationType
): { x: number; y: number } | null {
  if (modulation === 'none') {
    return bits === '0' ? { x: 0, y: -1 } : { x: 0, y: 1 };
  }

  if (modulation === '4qam') {
    const map: Record<string, { x: number; y: number }> = {
      '00': { x: -1, y: -1 },
      '01': { x: -1, y: 1 },
      '10': { x: 1, y: -1 },
      '11': { x: 1, y: 1 },
    };
    return map[bits] || null;
  }

  if (modulation === '16qam') {
    const map: Record<string, { x: number; y: number }> = {
      '0000': { x: -3, y: -3 },
      '0001': { x: -3, y: -1 },
      '0010': { x: -3, y: 1 },
      '0011': { x: -3, y: 3 },
      '0100': { x: -1, y: -3 },
      '0101': { x: -1, y: -1 },
      '0110': { x: -1, y: 1 },
      '0111': { x: -1, y: 3 },
      '1000': { x: 1, y: -3 },
      '1001': { x: 1, y: -1 },
      '1010': { x: 1, y: 1 },
      '1011': { x: 1, y: 3 },
      '1100': { x: 3, y: -3 },
      '1101': { x: 3, y: -1 },
      '1110': { x: 3, y: 1 },
      '1111': { x: 3, y: 3 },
    };
    return map[bits] || null;
  }

  // For larger QAM (64, 256), generate grid programmatically
  const bitsPerSymbol = getBitsPerSymbol(modulation);
  const gridSize = Math.sqrt(2 ** bitsPerSymbol);
  const decimal = parseInt(bits, 2);
  const row = Math.floor(decimal / gridSize);
  const col = decimal % gridSize;
  const halfGrid = gridSize / 2;

  return {
    x: col - halfGrid + 0.5,
    y: row - halfGrid + 0.5,
  };
}

// Add Gaussian noise based on noise level (0-50, lower is better)
function addNoise(
  x: number,
  y: number,
  noiseLevel: number
): { x: number; y: number } {
  // Convert noise level to standard deviation
  const noiseStdDev = noiseLevel / 50; // 0-1 range

  // Box-Muller transform for Gaussian noise
  const u1 = Math.random();
  const u2 = Math.random();
  const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const z2 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

  return {
    x: x + z1 * noiseStdDev,
    y: y + z2 * noiseStdDev,
  };
}

// Find closest constellation point to a received noisy point
function findClosestPoint(
  noisyX: number,
  noisyY: number,
  modulation: ModulationType
): string {
  const bitsPerSymbol = getBitsPerSymbol(modulation);
  const totalPoints = 2 ** bitsPerSymbol;
  let minDistance = Infinity;
  let closestBits = '';

  for (let i = 0; i < totalPoints; i += 1) {
    const bits = i.toString(2).padStart(bitsPerSymbol, '0');
    const point = getConstellationPoint(bits, modulation);
    if (point) {
      const distance = (point.x - noisyX) ** 2 + (point.y - noisyY) ** 2;
      if (distance < minDistance) {
        minDistance = distance;
        closestBits = bits;
      }
    }
  }

  return closestBits;
}

export function createInitialBitBaudState(): BitBaudState {
  const modulationType: ModulationType = 'none';
  const bitRate = 800; // 800 bps (lower for visibility)
  const noiseLevel = 10; // Noise level 10/50 by default

  const bitsPerSymbol = getBitsPerSymbol(modulationType);
  const baudRate = bitRate / bitsPerSymbol;
  const symbolCount = Math.ceil(16 / bitsPerSymbol); // 16 bits per batch
  const transmissionTime = (symbolCount / baudRate) * 1000; // ms

  return {
    modulationType,
    bitRate,
    noiseLevel,
    bitsPerSymbol,
    baudRate,
    transmissionTime,
    progress: 0,
    currentBatch: generateRandomBits(),
    currentSymbolIndex: -1,
    isRunning: false,
    isCompleted: false,
    transmittedSymbols: [],
    events: [],
  };
}

export class BitBaudSim extends Simulation<BitBaudState> {
  private animationCancel?: () => void;

  constructor({
    onUpdate,
    timeProvider,
  }: {
    onUpdate?: UpdateCallback<BitBaudState>;
    timeProvider?: TimeProvider;
  }) {
    super(createInitialBitBaudState(), onUpdate, timeProvider);
  }

  start(): void {
    if (this.state.isRunning) return;

    this.state.isRunning = true;
    this.state.progress = 0;
    this.state.currentSymbolIndex = -1;
    this.state.isCompleted = false;
    this.state.events = [];
    this.state.currentBatch = generateRandomBits();

    this.startTimer();
    this.emit();

    this.addEvent('transmission_start', 'Transmission begins');
    this.startAnimation();
  }

  stop(): void {
    this.stopAnimation();
    this.stopTimer();
    this.state.isRunning = false;
    this.state.isCompleted = true;
    this.emit();
  }

  clearConstellation(): void {
    this.state.transmittedSymbols = [];
    this.emit();
  }

  transmitBatch(symbolCount: number): void {
    // Efficiently transmit a batch of symbols without animation
    for (let i = 0; i < symbolCount; i += 1) {
      // Generate random bits for this symbol
      const bits = Math.floor(Math.random() * 2 ** this.state.bitsPerSymbol)
        .toString(2)
        .padStart(this.state.bitsPerSymbol, '0');

      const idealPoint = getConstellationPoint(bits, this.state.modulationType);
      if (idealPoint) {
        const noisyPoint = addNoise(
          idealPoint.x,
          idealPoint.y,
          this.state.noiseLevel
        );

        const decodedBits = findClosestPoint(
          noisyPoint.x,
          noisyPoint.y,
          this.state.modulationType
        );
        const hasError = decodedBits !== bits;

        this.state.transmittedSymbols.push({
          bits,
          idealX: idealPoint.x,
          idealY: idealPoint.y,
          noisyX: noisyPoint.x,
          noisyY: noisyPoint.y,
          timestamp: this.getElapsedTime(),
          hasError,
          decodedBits,
        });
      }
    }

    this.emit();
  }

  reset(): void {
    this.stopAnimation();
    this.stopTimer();
    this.resetTimer();

    this.state = createInitialBitBaudState();
    this.recalculateValues();
    this.emit();
  }

  setModulationType(type: ModulationType): void {
    this.state.modulationType = type;
    this.state.transmittedSymbols = []; // Clear constellation when modulation changes
    this.recalculateValues();
    this.emit();
  }

  setBitRate(bps: number): void {
    this.state.bitRate = bps;
    this.recalculateValues();
    this.emit();
  }

  setNoiseLevel(noiseLevel: number): void {
    this.state.noiseLevel = noiseLevel;
    this.emit();
  }

  private recalculateValues(): void {
    this.state.bitsPerSymbol = getBitsPerSymbol(this.state.modulationType);
    this.state.baudRate = this.state.bitRate / this.state.bitsPerSymbol;
    const symbolCount = Math.ceil(16 / this.state.bitsPerSymbol);
    this.state.transmissionTime = (symbolCount / this.state.baudRate) * 1000;
  }

  private startAnimation(): void {
    // Dynamic time scale: slower for lower bit rates
    const timeScale = Math.max(50, 10000 / this.state.bitRate);
    const animationDuration = this.state.transmissionTime * timeScale;
    const symbolCount = Math.ceil(16 / this.state.bitsPerSymbol);

    this.animationCancel = startFlightAnimation({
      durationMs: animationDuration,
      onProgress: (percentage) => {
        this.state.progress = percentage;

        // Calculate which symbol is currently being transmitted
        const newSymbolIndex = Math.floor((percentage / 100) * symbolCount);

        // Trigger event when a new symbol starts transmitting
        if (
          newSymbolIndex !== this.state.currentSymbolIndex &&
          newSymbolIndex < symbolCount
        ) {
          this.state.currentSymbolIndex = newSymbolIndex;

          const startBitIndex = newSymbolIndex * this.state.bitsPerSymbol;
          const endBitIndex = Math.min(
            startBitIndex + this.state.bitsPerSymbol,
            16
          );
          const bits = this.state.currentBatch.slice(
            startBitIndex,
            endBitIndex
          );

          // Add symbol to constellation with noise
          const idealPoint = getConstellationPoint(
            bits,
            this.state.modulationType
          );
          if (idealPoint) {
            const noisyPoint = addNoise(
              idealPoint.x,
              idealPoint.y,
              this.state.noiseLevel
            );

            // Determine what bits would be decoded from noisy position
            const decodedBits = findClosestPoint(
              noisyPoint.x,
              noisyPoint.y,
              this.state.modulationType
            );
            const hasError = decodedBits !== bits;

            this.state.transmittedSymbols.push({
              bits,
              idealX: idealPoint.x,
              idealY: idealPoint.y,
              noisyX: noisyPoint.x,
              noisyY: noisyPoint.y,
              timestamp: this.getElapsedTime(),
              hasError,
              decodedBits,
            });
          }

          this.addEvent(
            'symbol_sent',
            `Symbol ${newSymbolIndex + 1}/${symbolCount}: ${bits}`,
            newSymbolIndex,
            bits
          );
        }

        this.emit();
      },
      onArrived: () => {
        this.state.progress = 100;
        this.state.currentSymbolIndex = symbolCount - 1;

        // Start next batch automatically
        this.state.progress = 0;
        this.state.currentSymbolIndex = -1;
        this.state.currentBatch = generateRandomBits();
        this.addEvent('transmission_end', 'Batch complete, starting next...');

        // Continue animation
        this.startAnimation();
      },
    });
  }

  private addEvent(
    type: BitBaudEvent['type'],
    description: string,
    symbolIndex?: number,
    bits?: string
  ): void {
    this.state.events.push({
      timestamp: this.getElapsedTime(),
      type,
      description,
      symbolIndex,
      bits,
    });
  }

  private stopAnimation(): void {
    this.animationCancel?.();
    this.animationCancel = undefined;
  }

  dispose(): void {
    this.stopAnimation();
    super.dispose();
  }
}

// Export helper function to get all ideal constellation points for a modulation
export function getAllIdealPoints(modulation: ModulationType): Array<{
  x: number;
  y: number;
  bits: string;
}> {
  const bitsPerSymbol = getBitsPerSymbol(modulation);
  const totalPoints = 2 ** bitsPerSymbol;
  const points: Array<{ x: number; y: number; bits: string }> = [];

  for (let i = 0; i < totalPoints; i += 1) {
    const bits = i.toString(2).padStart(bitsPerSymbol, '0');
    const point = getConstellationPoint(bits, modulation);
    if (point) {
      points.push({ ...point, bits });
    }
  }

  return points;
}

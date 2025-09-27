export type UpdateCallback<TState> = (state: TState) => void;

// Common logical packet identity (protocol-level)
export interface PacketBase {
  // Sequence number of the logical packet (0..N)
  seqNum: number;
}

export abstract class Simulation<TState> {
  protected state: TState;

  protected onUpdate?: UpdateCallback<TState>;

  // Simulation timing
  private startTime: number = 0;

  private elapsedTime: number = 0;

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(initialState: TState, onUpdate?: UpdateCallback<TState>) {
    this.state = Simulation.deepClone(initialState);
    this.onUpdate = onUpdate;
  }

  getState(): TState {
    return Simulation.deepClone(this.state);
  }

  // subclasses call this after mutating state
  protected emit(): void {
    this.onUpdate?.(Simulation.deepClone(this.state));
  }

  // Simulation timer methods
  protected startTimer(): void {
    if (this.timerInterval) return; // Already running
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      this.elapsedTime = Date.now() - this.startTime;
      this.emit(); // Trigger UI update with new elapsed time
    }, 100); // Update every 100ms
  }

  protected stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  protected resetTimer(): void {
    this.stopTimer();
    this.startTime = 0;
    this.elapsedTime = 0;
  }

  public getElapsedTime(): number {
    return this.elapsedTime;
  }

  public getFormattedElapsedTime(): string {
    const seconds = Math.floor(this.elapsedTime / 1000);
    const milliseconds = this.elapsedTime % 1000;
    return `${seconds}.${Math.floor(milliseconds / 100)}s`;
  }

  // Optional lifecycle hooks
  // Provide a default implementation; subclasses may override.
  // Use 'this' to satisfy class-methods-use-this rule.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  dispose(): void {
    this.stopTimer();
    // default no-op referencing this to satisfy linter
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const unusedStateReference = this.state;
  }

  protected static deepClone<U>(obj: U): U {
    return JSON.parse(JSON.stringify(obj));
  }
}

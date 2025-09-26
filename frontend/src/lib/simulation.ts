export type UpdateCallback<TState> = (state: TState) => void;

// Common logical packet identity (protocol-level)
export interface PacketBase {
  // Sequence number of the logical packet (0..N)
  seqNum: number;
}

export abstract class Simulation<TState> {
  protected state: TState;

  protected onUpdate?: UpdateCallback<TState>;

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

  // Optional lifecycle hooks
  // Provide a default implementation; subclasses may override.
  // Use 'this' to satisfy class-methods-use-this rule.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  dispose(): void {
    // default no-op referencing this to satisfy linter
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const unusedStateReference = this.state;
  }

  protected static deepClone<U>(obj: U): U {
    return JSON.parse(JSON.stringify(obj));
  }
}

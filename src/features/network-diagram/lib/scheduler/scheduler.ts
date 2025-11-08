import {
  BehaviorSubject,
  finalize,
  map,
  Observable,
  switchMap,
  take,
  tap,
  timer,
} from 'rxjs';

export enum SchedulerState {
  FASTER,
  REAL_TIME,
  SLOWER,
  PAUSED,
}

export class Scheduler {
  private static instance: Scheduler;

  private currentState: SchedulerState = SchedulerState.REAL_TIME;

  private transmissionMultiplier: number = 1;

  private speedOfLightMultiplier: number = 1;

  private startTime: number = Date.now();

  private startPause: number = 0;

  private listener: { delay: number; callback: BehaviorSubject<number> }[] = [];

  get Transmission(): number {
    return this.transmissionMultiplier;
  }

  get SpeedOfLight(): number {
    return this.speedOfLightMultiplier;
  }

  get Speed(): SchedulerState {
    return this.currentState;
  }

  set Speed(delay: SchedulerState) {
    const delta = this.getDeltaTime();

    switch (delay) {
      case SchedulerState.FASTER: {
        this.transmissionMultiplier = 100 * 1000;
        this.speedOfLightMultiplier = 10;
        break;
      }
      case SchedulerState.REAL_TIME: {
        this.transmissionMultiplier = 1;
        this.speedOfLightMultiplier = 1;
        break;
      }
      case SchedulerState.SLOWER: {
        this.transmissionMultiplier = 1 / (100 * 1000);
        this.speedOfLightMultiplier = 1 / 10;
        break;
      }
      case SchedulerState.PAUSED: {
        this.transmissionMultiplier = 0;
        this.speedOfLightMultiplier = 0;
        break;
      }
      default:
        break;
    }

    this.currentState = delay;

    // recalculate start time to compensate for the change in speed
    if (delay === SchedulerState.PAUSED) {
      this.startTime = Date.now() - delta;
      this.startPause = Date.now();
    } else {
      this.startTime = Date.now() - delta / this.speedOfLightMultiplier;
    }

    this.reset();
  }

  get Timer$(): Observable<string> {
    return timer(1, 10).pipe(map(() => this.calculateStringTime()));
  }

  static getInstance(): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler();
    }
    return Scheduler.instance;
  }

  private constructor() {
    this.Speed = SchedulerState.SLOWER;
  }

  private calculateStringTime(): string {
    const deltaTime = this.getDeltaTime();
    const time = Math.floor(deltaTime / 100);
    const seconds = Math.floor(deltaTime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    const strMilliseconds = (time % 10).toString().padStart(1, '0');
    const strSeconds = (seconds % 60).toString().padStart(2, '0');
    const strMinutes = (minutes % 60).toString().padStart(2, '0');
    const strHours = hours.toString().padStart(2, '0');

    let formattedString = '';
    if (hours > 0) {
      formattedString += `${strHours}:`;
    }

    formattedString += `${strMinutes}:${strSeconds}`;
    formattedString += `.${strMilliseconds}`;

    return formattedString;
  }

  public getDeltaTime(): number {
    if (this.currentState === SchedulerState.PAUSED) {
      const timeSincePause = Date.now() - this.startPause;
      return Date.now() - this.startTime - timeSincePause;
    }
    return (Date.now() - this.startTime) * this.speedOfLightMultiplier;
  }

  public getDelay(delay: number): number {
    if (this.currentState === SchedulerState.PAUSED) {
      return 2147483647; // Max safe timeout value for Node.js (2^31-1 ms ≈ 24.8 days)
    }
    return (delay / this.speedOfLightMultiplier) * 1000;
  }

  public once(delay: number): Observable<0> {
    const actualDelay = this.getDelay(delay);
    // CRITICAL FIX: Don't add to listener array for one-time timers
    // This prevents memory leak from accumulating completed observables
    return timer(actualDelay).pipe(take(1));
  }

  public repeat(delay: number, firstDelay: number = -1): Observable<0> {
    const actualFirstDelay = firstDelay === -1 ? delay : firstDelay;

    const interval$: BehaviorSubject<number> = new BehaviorSubject<number>(
      this.getDelay(actualFirstDelay)
    );
    const listenerEntry = { delay, callback: interval$ };
    this.listener.push(listenerEntry);

    return interval$.pipe(
      switchMap((duration) => timer(duration)),
      tap(() => interval$.next(this.getDelay(delay))),
      // CRITICAL FIX: Remove from listener array when unsubscribed
      finalize(() => {
        const index = this.listener.indexOf(listenerEntry);
        if (index !== -1) {
          this.listener.splice(index, 1);
        }
      })
    );
  }

  private reset(): void {
    this.listener.forEach((i) => {
      i.callback.next(this.getDelay(i.delay));
    });
  }

  public clear(): void {
    // Complete and unsubscribe all listeners to prevent memory leaks
    this.listener.forEach((i) => {
      try {
        i.callback.complete();
        i.callback.unsubscribe();
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.listener = [];
    this.startTime = Date.now();
    this.startPause = 0;
  }

  public static resetInstance(): void {
    // CRITICAL: Destroy and recreate the singleton for complete isolation between tests
    if (Scheduler.instance) {
      Scheduler.instance.clear();
    }
    // Force garbage collection of old instance by removing reference
    // @ts-expect-error - Intentionally deleting singleton instance for test isolation
    delete Scheduler.instance;
    Scheduler.instance = new Scheduler();
  }
}

export enum SchedulerState {
  FASTER,
  REAL_TIME,
  SLOWER,
  PAUSED,
}

type TimerListener = {
  delay: number;
  timeoutId: NodeJS.Timeout | null;
  callback: () => void;
  isRepeating: boolean;
};

type TimerSubscription = {
  intervalId: NodeJS.Timeout | null;
  callback: (time: string) => void;
};

export class Scheduler {
  private static instance: Scheduler;

  private currentState: SchedulerState = SchedulerState.REAL_TIME;

  private transmissionMultiplier: number = 1;

  private speedOfLightMultiplier: number = 1;

  private startTime: number = Date.now();

  private startPause: number = 0;

  private listeners: TimerListener[] = [];

  private timerSubscriptions: TimerSubscription[] = [];

  get Transmission(): number {
    return this.transmissionMultiplier;
  }

  get SpeedOfLight(): number {
    return this.speedOfLightMultiplier;
  }

  get Speed(): SchedulerState {
    return this.currentState;
  }

  set Speed(state: SchedulerState) {
    const delta = this.getDeltaTime();

    switch (state) {
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

    this.currentState = state;

    // Recalculate start time to compensate for the change in speed
    if (state === SchedulerState.PAUSED) {
      this.startTime = Date.now() - delta;
      this.startPause = Date.now();
    } else {
      this.startTime = Date.now() - delta / this.speedOfLightMultiplier;
    }

    this.reset();
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

  public once(delay: number, callback: () => void): () => void {
    const actualDelay = this.getDelay(delay);
    const listener: TimerListener = {
      delay,
      timeoutId: null,
      callback,
      isRepeating: false,
    };

    listener.timeoutId = setTimeout(() => {
      callback();
      // Remove listener after execution
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }, actualDelay);

    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      if (listener.timeoutId) {
        clearTimeout(listener.timeoutId);
      }
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public repeat(
    delay: number,
    callback: () => void,
    firstDelay: number = -1
  ): () => void {
    const initialDelay = firstDelay === -1 ? delay : firstDelay;
    const listener: TimerListener = {
      delay,
      timeoutId: null,
      callback,
      isRepeating: true,
    };

    const scheduleNext = () => {
      const actualDelay = this.getDelay(delay);
      listener.timeoutId = setTimeout(() => {
        callback();
        scheduleNext();
      }, actualDelay);
    };

    // Schedule first execution
    const actualFirstDelay = this.getDelay(initialDelay);
    listener.timeoutId = setTimeout(() => {
      callback();
      scheduleNext();
    }, actualFirstDelay);

    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      if (listener.timeoutId) {
        clearTimeout(listener.timeoutId);
      }
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public subscribeToTimer(callback: (time: string) => void): () => void {
    const subscription: TimerSubscription = {
      intervalId: null,
      callback,
    };

    subscription.intervalId = setInterval(() => {
      const time = this.calculateStringTime();
      callback(time);
    }, 10);

    this.timerSubscriptions.push(subscription);

    // Return unsubscribe function
    return () => {
      if (subscription.intervalId) {
        clearInterval(subscription.intervalId);
      }
      const index = this.timerSubscriptions.indexOf(subscription);
      if (index > -1) {
        this.timerSubscriptions.splice(index, 1);
      }
    };
  }

  private reset(): void {
    // Cancel all existing timers and reschedule them
    this.listeners.forEach((listener) => {
      if (listener.timeoutId) {
        clearTimeout(listener.timeoutId);
      }

      const actualDelay = this.getDelay(listener.delay);
      const listenerRef = listener; // Create reference to satisfy eslint

      if (listenerRef.isRepeating) {
        const scheduleNext = () => {
          const nextDelay = this.getDelay(listenerRef.delay);
          listenerRef.timeoutId = setTimeout(() => {
            listenerRef.callback();
            scheduleNext();
          }, nextDelay);
        };

        listenerRef.timeoutId = setTimeout(() => {
          listenerRef.callback();
          scheduleNext();
        }, actualDelay);
      } else {
        listenerRef.timeoutId = setTimeout(() => {
          listenerRef.callback();
          // Remove listener after execution
          const index = this.listeners.indexOf(listenerRef);
          if (index > -1) {
            this.listeners.splice(index, 1);
          }
        }, actualDelay);
      }
    });
  }
}

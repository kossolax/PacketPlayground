import { describe, it, expect, beforeEach } from 'vitest';
import { Scheduler, SchedulerState } from './scheduler';

describe('scheduler', () => {
  let service: Scheduler;
  const delay = 0.1;

  beforeEach(() => {
    service = Scheduler.getInstance();
    service.Speed = SchedulerState.REAL_TIME;
  });

  it('should be slower than realtime', () => {
    service.Speed = SchedulerState.SLOWER;

    const start = Date.now();
    return new Promise<void>((resolve) => {
      service.once(delay, () => {
        const delta = Date.now() - start;
        expect(delta).toBeGreaterThan(delay * 1000);
        expect(service.SpeedOfLight).toBeLessThan(1);
        expect(service.Transmission).toBeLessThan(1);
        expect(service.Speed).toBe(SchedulerState.SLOWER);

        resolve();
      });
    });
  });

  it('should be realtime', () => {
    service.Speed = SchedulerState.REAL_TIME;

    const start = Date.now();
    return new Promise<void>((resolve) => {
      service.once(delay, () => {
        const delta = Date.now() - start;
        expect(delta).toBeGreaterThan(delay * 1000 * 0.75);
        expect(delta).toBeLessThan(delay * 1000 * 1.25);
        expect(service.SpeedOfLight).toBe(1);
        expect(service.Transmission).toBe(1);
        expect(service.Speed).toBe(SchedulerState.REAL_TIME);

        resolve();
      });
    });
  });

  it('should be faster than realtime', () => {
    service.Speed = SchedulerState.FASTER;

    const start = Date.now();
    return new Promise<void>((resolve) => {
      service.once(delay, () => {
        const delta = Date.now() - start;
        expect(delta).toBeLessThan(delay * 1000);
        expect(service.SpeedOfLight).toBeGreaterThan(1);
        expect(service.Transmission).toBeGreaterThan(1);
        expect(service.Speed).toBe(SchedulerState.FASTER);

        resolve();
      });
    });
  });

  it('should be paused', () => {
    service.Speed = SchedulerState.REAL_TIME;
    service.Speed = SchedulerState.PAUSED;

    let callbackExecuted = false;

    service.once(delay, () => {
      callbackExecuted = true;
    });

    // Set a timeout to check that the callback was never executed
    return new Promise<void>((resolve) => {
      setTimeout(
        () => {
          expect(callbackExecuted).toBe(false);
          expect(service.SpeedOfLight).toBe(0);
          expect(service.Transmission).toBe(0);
          expect(service.Speed).toBe(SchedulerState.PAUSED);
          resolve();
        },
        delay * 2 * 1000
      );
    });
  });

  it('should be able to pause and resume', () => {
    service.Speed = SchedulerState.PAUSED;

    const promise = new Promise<void>((resolve) => {
      service.once(delay, () => {
        expect(true).toBeTruthy();
        resolve();
      });
    });

    service.Speed = SchedulerState.REAL_TIME;
    return promise;
  });

  it('should have an interval faster than a second', () => {
    service.Speed = SchedulerState.FASTER;

    const deltas: number[] = [];
    let count = 0;

    return new Promise<void>((resolve) => {
      const unsubscribe = service.subscribeToTimer((time: string) => {
        const split = time.split(':');
        const timeInSeconds =
          parseInt(split[0], 10) * 60 + parseFloat(split[1]);
        deltas.push(timeInSeconds);
        count += 1;

        if (count === 2) {
          unsubscribe();

          const delta = deltas[1] - deltas[0];
          expect(delta).toBeGreaterThan(0);
          expect(delta).toBeLessThan(1);
          resolve();
        }
      });
    });
  });
});

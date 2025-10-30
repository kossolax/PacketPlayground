import { describe, it, expect, beforeEach } from 'vitest';
import { bufferCount, map, take, timeout } from 'rxjs';
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
      service.once(delay).subscribe(() => {
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
      service.once(delay).subscribe(() => {
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
      service.once(delay).subscribe(() => {
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

    return new Promise<void>((resolve) => {
      service
        .once(delay)
        .pipe(timeout(delay * 2 * 1000))
        .subscribe({
          next: () => {
            expect(true).toBeFalsy();
          },
          error: (err) => {
            expect(err).toBeTruthy();
            expect(service.SpeedOfLight).toBe(0);
            expect(service.Transmission).toBe(0);
            expect(service.Speed).toBe(SchedulerState.PAUSED);
            resolve();
          },
        });
    });
  });

  it('should be able to pause and resume', () => {
    service.Speed = SchedulerState.PAUSED;

    const promise = new Promise<void>((resolve) => {
      service.once(delay).subscribe(() => {
        expect(true).toBeTruthy();
        resolve();
      });
    });

    service.Speed = SchedulerState.REAL_TIME;
    return promise;
  });

  it('should have an interval faster than a second', () => {
    service.Speed = SchedulerState.FASTER;

    return new Promise<void>((resolve) => {
      service.Timer$.pipe(
        take(2),
        map((time: string) => {
          const split = time.split(':');
          return parseInt(split[0], 10) * 60 + parseFloat(split[1]);
        }),
        bufferCount(2)
      ).subscribe((deltas) => {
        const delta = deltas[1] - deltas[0];
        expect(delta).toBeGreaterThan(0);
        expect(delta).toBeLessThan(1);
        resolve();
      });
    });
  });
});

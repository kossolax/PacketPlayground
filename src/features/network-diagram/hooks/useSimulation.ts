/**
 * Hook for network simulation control
 * Manages simulation speed and timer state
 */

/* eslint-disable import/prefer-default-export */

import { useState, useEffect, useCallback } from 'react';
import { Scheduler, SchedulerState } from '../lib/scheduler/scheduler';

interface UseSimulationReturn {
  speed: SchedulerState;
  setSpeed: (speed: SchedulerState) => void;
  time: string;
  speedOfLight: number;
  transmission: number;
}

/**
 * Hook to manage network simulation state
 */
export function useSimulation(): UseSimulationReturn {
  const scheduler = Scheduler.getInstance();
  const [speed, setSpeedState] = useState<SchedulerState>(scheduler.Speed);
  const [time, setTime] = useState<string>('00:00.0');

  // Subscribe to timer updates
  useEffect(() => {
    const unsubscribe = scheduler.subscribeToTimer((currentTime) => {
      setTime(currentTime);
    });

    return () => {
      unsubscribe();
    };
  }, [scheduler]);

  const setSpeed = useCallback(
    (newSpeed: SchedulerState) => {
      scheduler.Speed = newSpeed;
      setSpeedState(newSpeed);
    },
    [scheduler]
  );

  return {
    speed,
    setSpeed,
    time,
    speedOfLight: scheduler.SpeedOfLight,
    transmission: scheduler.Transmission,
  };
}

import { describe, it, expect } from 'vitest';
import {
  mapSliderToArray,
  mapArrayToSlider,
  formatBandwidth,
  formatBytes,
  formatPacketSize,
  formatTimeScale,
  TIME_SCALE_VALUES,
  BANDWIDTH_VALUES_STANDARD,
} from './ui-helpers';

describe('ui-helpers', () => {
  describe('mapSliderToArray', () => {
    const values = [10, 20, 30, 40, 50];

    it('should return value at valid index', () => {
      expect(mapSliderToArray(values, 0)).toBe(10);
      expect(mapSliderToArray(values, 2)).toBe(30);
      expect(mapSliderToArray(values, 4)).toBe(50);
    });

    it('should return first value for out-of-bounds index', () => {
      expect(mapSliderToArray(values, -1)).toBe(10);
      expect(mapSliderToArray(values, 10)).toBe(10);
    });

    it('should work with readonly arrays', () => {
      expect(mapSliderToArray(TIME_SCALE_VALUES, 3)).toBe(1);
      expect(mapSliderToArray(BANDWIDTH_VALUES_STANDARD, 0)).toBe(64000);
    });
  });

  describe('mapArrayToSlider', () => {
    const values = [10, 20, 30, 40, 50];

    it('should find index of exact match', () => {
      expect(mapArrayToSlider(values, 30)).toBe(2);
      expect(mapArrayToSlider(values, 10)).toBe(0);
      expect(mapArrayToSlider(values, 50)).toBe(4);
    });

    it('should find index of first value >= target', () => {
      expect(mapArrayToSlider(values, 15)).toBe(1); // finds 20
      expect(mapArrayToSlider(values, 25)).toBe(2); // finds 30
      expect(mapArrayToSlider(values, 35)).toBe(3); // finds 40
    });

    it('should return last index if target exceeds all values', () => {
      expect(mapArrayToSlider(values, 100)).toBe(4);
      expect(mapArrayToSlider(values, 51)).toBe(4);
    });

    it('should return 0 for values below first element', () => {
      expect(mapArrayToSlider(values, 5)).toBe(0);
      expect(mapArrayToSlider(values, 10)).toBe(0);
    });

    it('should work with readonly arrays', () => {
      expect(mapArrayToSlider(TIME_SCALE_VALUES, 1)).toBe(3);
      expect(mapArrayToSlider(BANDWIDTH_VALUES_STANDARD, 256000)).toBe(2);
    });
  });

  describe('formatBandwidth', () => {
    it('should format Gbps values', () => {
      expect(formatBandwidth(1000000000)).toBe('1G');
      expect(formatBandwidth(2000000000)).toBe('2G');
    });

    it('should format Mbps values', () => {
      expect(formatBandwidth(1000000)).toBe('1M');
      expect(formatBandwidth(10000000)).toBe('10M');
      expect(formatBandwidth(100000000)).toBe('100M');
    });

    it('should format Kbps values', () => {
      expect(formatBandwidth(64000)).toBe('64K');
      expect(formatBandwidth(512000)).toBe('512K');
    });

    it('should format bps values', () => {
      expect(formatBandwidth(500)).toBe('500');
      expect(formatBandwidth(999)).toBe('999');
    });
  });

  describe('formatBytes', () => {
    it('should format MB values', () => {
      expect(formatBytes(1000000)).toBe('1M');
      expect(formatBytes(5000000)).toBe('5M');
    });

    it('should format KB values', () => {
      expect(formatBytes(1000)).toBe('1K');
      expect(formatBytes(500000)).toBe('500K');
    });

    it('should format byte values', () => {
      expect(formatBytes(125)).toBe('125B');
      expect(formatBytes(999)).toBe('999B');
    });
  });

  describe('formatPacketSize', () => {
    it('should convert bits to bytes and format', () => {
      expect(formatPacketSize(8000)).toBe('1K'); // 1 KB
      expect(formatPacketSize(80000)).toBe('10K'); // 10 KB
      expect(formatPacketSize(8000000)).toBe('1M'); // 1 MB
    });

    it('should handle small packet sizes', () => {
      expect(formatPacketSize(1000)).toBe('125B');
    });
  });

  describe('formatTimeScale', () => {
    it('should format slower time scales', () => {
      expect(formatTimeScale(0.1)).toBe('10x slower');
      expect(formatTimeScale(0.2)).toBe('5x slower');
      expect(formatTimeScale(0.5)).toBe('2x slower');
    });

    it('should format normal time scale', () => {
      expect(formatTimeScale(1)).toBe('1x');
    });

    it('should format faster time scales', () => {
      expect(formatTimeScale(2)).toBe('2x faster');
      expect(formatTimeScale(5)).toBe('5x faster');
      expect(formatTimeScale(10)).toBe('10x faster');
    });
  });

  describe('Constant arrays', () => {
    it('should have correct TIME_SCALE_VALUES', () => {
      expect(TIME_SCALE_VALUES).toEqual([0.1, 0.2, 0.5, 1, 2, 5, 10]);
    });

    it('should have correct BANDWIDTH_VALUES_STANDARD', () => {
      expect(BANDWIDTH_VALUES_STANDARD.length).toBe(10);
      expect(BANDWIDTH_VALUES_STANDARD[0]).toBe(64000);
      expect(BANDWIDTH_VALUES_STANDARD[9]).toBe(1000000000);
    });
  });
});

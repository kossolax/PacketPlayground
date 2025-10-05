import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  distanceBetweenPoints,
  scaleDistance,
  getRandomColor,
  generateGaussianNoise,
  findClosestPoint2D,
  generateRandomBits,
  getUniqueValues,
  getMinimumStep,
} from './utils';

describe('utils', () => {
  describe('clamp', () => {
    it('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
      expect(clamp(5, 5, 5)).toBe(5);
    });

    it('should handle negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(0, -10, -1)).toBe(-1);
    });
  });

  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('should handle negative values', () => {
      expect(lerp(-10, 10, 0.5)).toBe(0);
      expect(lerp(-10, 10, 0.25)).toBe(-5);
      expect(lerp(-10, 10, 0.75)).toBe(5);
    });

    it('should allow extrapolation beyond 0-1 range', () => {
      expect(lerp(0, 10, 1.5)).toBe(15);
      expect(lerp(0, 10, -0.5)).toBe(-5);
    });

    it('should handle floating point values', () => {
      expect(lerp(1.5, 3.5, 0.5)).toBe(2.5);
    });
  });

  describe('distanceBetweenPoints', () => {
    it('should calculate distance between two points', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };
      expect(distanceBetweenPoints(p1, p2)).toBe(5);
    });

    it('should return 0 for same point', () => {
      const p = { x: 5, y: 5 };
      expect(distanceBetweenPoints(p, p)).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const p1 = { x: -3, y: -4 };
      const p2 = { x: 0, y: 0 };
      expect(distanceBetweenPoints(p1, p2)).toBe(5);
    });

    it('should handle horizontal distance', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 10, y: 0 };
      expect(distanceBetweenPoints(p1, p2)).toBe(10);
    });

    it('should handle vertical distance', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 0, y: 10 };
      expect(distanceBetweenPoints(p1, p2)).toBe(10);
    });
  });

  describe('scaleDistance', () => {
    it('should scale distance by factor', () => {
      expect(scaleDistance(10, 2)).toBe(20);
      expect(scaleDistance(10, 0.5)).toBe(5);
      expect(scaleDistance(10, 1)).toBe(10);
    });

    it('should handle negative factors', () => {
      expect(scaleDistance(10, -2)).toBe(-20);
    });

    it('should handle zero', () => {
      expect(scaleDistance(10, 0)).toBe(0);
      expect(scaleDistance(0, 5)).toBe(0);
    });

    it('should handle floating point scales', () => {
      expect(scaleDistance(7, 1.5)).toBe(10.5);
    });
  });

  describe('getRandomColor', () => {
    it('should return a color from default palette', () => {
      const color = getRandomColor();
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should return a color from custom palette', () => {
      const palette = ['#FF0000', '#00FF00', '#0000FF'];
      const color = getRandomColor(palette);
      expect(palette).toContain(color);
    });

    it('should handle single-color palette', () => {
      const palette = ['#AABBCC'];
      expect(getRandomColor(palette)).toBe('#AABBCC');
    });
  });

  describe('generateGaussianNoise', () => {
    it('should generate two noise values', () => {
      const noise = generateGaussianNoise();
      expect(noise).toHaveProperty('z1');
      expect(noise).toHaveProperty('z2');
      expect(typeof noise.z1).toBe('number');
      expect(typeof noise.z2).toBe('number');
    });

    it('should scale noise by standard deviation', () => {
      const noise = generateGaussianNoise(0);
      expect(Math.abs(noise.z1)).toBe(0);
      expect(Math.abs(noise.z2)).toBe(0);
    });

    it('should generate different values on each call', () => {
      const noise1 = generateGaussianNoise();
      const noise2 = generateGaussianNoise();
      // Very unlikely to be exactly equal
      expect(noise1.z1 === noise2.z1 && noise1.z2 === noise2.z2).toBe(false);
    });
  });

  describe('findClosestPoint2D', () => {
    const points = [
      { x: 0, y: 0, id: 'a' },
      { x: 5, y: 0, id: 'b' },
      { x: 0, y: 5, id: 'c' },
      { x: 10, y: 10, id: 'd' },
    ];

    it('should find closest point', () => {
      const target = { x: 1, y: 1 };
      const closest = findClosestPoint2D(target, points);
      expect(closest?.id).toBe('a');
    });

    it('should find closest among multiple candidates', () => {
      const target = { x: 6, y: 1 };
      const closest = findClosestPoint2D(target, points);
      expect(closest?.id).toBe('b');
    });

    it('should return null for empty array', () => {
      const closest = findClosestPoint2D({ x: 0, y: 0 }, []);
      expect(closest).toBeNull();
    });

    it('should handle exact match', () => {
      const target = { x: 5, y: 0 };
      const closest = findClosestPoint2D(target, points);
      expect(closest?.id).toBe('b');
    });
  });

  describe('generateRandomBits', () => {
    it('should generate bits of default length', () => {
      const bits = generateRandomBits();
      expect(bits).toHaveLength(16);
      expect(bits).toMatch(/^[01]+$/);
    });

    it('should generate bits of specified length', () => {
      const bits = generateRandomBits(8);
      expect(bits).toHaveLength(8);
      expect(bits).toMatch(/^[01]+$/);
    });

    it('should generate different values on each call', () => {
      const bits1 = generateRandomBits(100);
      const bits2 = generateRandomBits(100);
      expect(bits1).not.toBe(bits2);
    });
  });

  describe('getUniqueValues', () => {
    it('should extract unique values', () => {
      const arr = [1, 2, 2, 3, 3, 3, 4];
      expect(getUniqueValues(arr)).toEqual([1, 2, 3, 4]);
    });

    it('should handle empty array', () => {
      expect(getUniqueValues([])).toEqual([]);
    });

    it('should handle all unique values', () => {
      const arr = [1, 2, 3, 4];
      expect(getUniqueValues(arr)).toEqual([1, 2, 3, 4]);
    });

    it('should work with strings', () => {
      const arr = ['a', 'b', 'a', 'c', 'b'];
      expect(getUniqueValues(arr)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getMinimumStep', () => {
    it('should find minimum step between values', () => {
      const arr = [0, 1, 5, 10];
      expect(getMinimumStep(arr)).toBe(1);
    });

    it('should handle unsorted arrays', () => {
      const arr = [10, 0, 5, 1];
      expect(getMinimumStep(arr)).toBe(1);
    });

    it('should handle duplicates', () => {
      const arr = [0, 0, 2, 2, 5, 5];
      expect(getMinimumStep(arr)).toBe(2);
    });

    it('should return 1 for empty array', () => {
      expect(getMinimumStep([])).toBe(1);
    });

    it('should return 1 for single value', () => {
      expect(getMinimumStep([5])).toBe(1);
    });

    it('should handle very small differences', () => {
      const arr = [0, 0.001, 1];
      expect(getMinimumStep(arr)).toBe(0.001);
    });
  });
});

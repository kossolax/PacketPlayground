/**
 * Unit tests for cryptographic utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  xor,
  concat,
  doubleGF128,
  incrementCounter,
  constantTimeEqual,
  hexToBytes,
  bytesToHex,
} from './utils';

describe('Crypto Utils', () => {
  describe('xor', () => {
    it('should XOR two equal-length buffers', () => {
      const a = new Uint8Array([0x12, 0x34, 0x56]);
      const b = new Uint8Array([0xab, 0xcd, 0xef]);
      const result = xor(a, b);

      expect(result).toEqual(
        new Uint8Array([0x12 ^ 0xab, 0x34 ^ 0xcd, 0x56 ^ 0xef])
      );
    });

    it('should throw error for different-length buffers', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2]);

      expect(() => xor(a, b)).toThrow('same length');
    });

    it('should handle empty buffers', () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array(0);
      const result = xor(a, b);

      expect(result.length).toBe(0);
    });
  });

  describe('concat', () => {
    it('should concatenate multiple buffers', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([3, 4]);
      const c = new Uint8Array([5]);

      const result = concat(a, b, c);

      expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    });

    it('should handle empty buffers', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array(0);
      const c = new Uint8Array([3]);

      const result = concat(a, b, c);

      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should handle single buffer', () => {
      const a = new Uint8Array([1, 2, 3]);
      const result = concat(a);

      expect(result).toEqual(a);
    });
  });

  describe('doubleGF128', () => {
    it('should double a block without reduction polynomial', () => {
      // Input: 0x0102030405060708090a0b0c0d0e0f10
      // MSB = 0, so no XOR with 0x87
      const input = hexToBytes('0102030405060708090a0b0c0d0e0f10');
      const expected = hexToBytes(
        '02040608 0a0c0e10 12141618 1a1c1e20'.replace(/\s/g, '')
      );

      const result = doubleGF128(input);

      expect(bytesToHex(result)).toBe(bytesToHex(expected));
    });

    it('should double with reduction polynomial when MSB=1', () => {
      // Input starts with 0x80 (MSB = 1)
      // After shift: last byte must be XORed with 0x87
      const input = hexToBytes(
        '800000000000000000000000000000 00'.replace(/\s/g, '')
      );

      const result = doubleGF128(input);

      // After << 1: 0x00...00, then XOR last byte with 0x87
      expect(result[15]).toBe(0x87);
      expect(result.slice(0, 15)).toEqual(new Uint8Array(15));
    });

    it('should throw error for non-16-byte input', () => {
      const input = new Uint8Array(15);

      expect(() => doubleGF128(input)).toThrow('must be 16 bytes');
    });
  });

  describe('incrementCounter', () => {
    it('should increment counter by 1', () => {
      const counter = new Uint8Array(16);
      counter[15] = 0x05;

      incrementCounter(counter);

      expect(counter[15]).toBe(0x06);
    });

    it('should handle carry correctly', () => {
      const counter = new Uint8Array(16);
      counter[14] = 0x01;
      counter[15] = 0xff;

      incrementCounter(counter);

      expect(counter[14]).toBe(0x02);
      expect(counter[15]).toBe(0x00);
    });

    it('should handle multiple carries', () => {
      const counter = new Uint8Array(16);
      counter.fill(0xff);

      incrementCounter(counter);

      // All should become 0 (overflow)
      expect(counter).toEqual(new Uint8Array(16));
    });
  });

  describe('constantTimeEqual', () => {
    it('should return true for equal buffers', () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(constantTimeEqual(a, b)).toBe(true);
    });

    it('should return false for different buffers', () => {
      const a = new Uint8Array([1, 2, 3, 4]);
      const b = new Uint8Array([1, 2, 3, 5]);

      expect(constantTimeEqual(a, b)).toBe(false);
    });

    it('should return false for different lengths', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(constantTimeEqual(a, b)).toBe(false);
    });

    it('should return true for empty buffers', () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array(0);

      expect(constantTimeEqual(a, b)).toBe(true);
    });
  });

  describe('hexToBytes / bytesToHex', () => {
    it('should convert hex string to bytes', () => {
      const hex = '0123456789abcdef';
      const bytes = hexToBytes(hex);

      expect(bytes).toEqual(
        new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])
      );
    });

    it('should convert bytes to hex string', () => {
      const bytes = new Uint8Array([
        0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
      ]);
      const hex = bytesToHex(bytes);

      expect(hex).toBe('0123456789abcdef');
    });

    it('should handle hex with spaces', () => {
      const hex = '01 23 45 67';
      const bytes = hexToBytes(hex);

      expect(bytes).toEqual(new Uint8Array([0x01, 0x23, 0x45, 0x67]));
    });

    it('should be reversible', () => {
      const original = 'deadbeef';
      const bytes = hexToBytes(original);
      const hex = bytesToHex(bytes);

      expect(hex).toBe(original);
    });

    it('should throw error for invalid hex length', () => {
      const invalidHex = '123'; // Odd length

      expect(() => hexToBytes(invalidHex)).toThrow('Invalid hex string length');
    });
  });
});

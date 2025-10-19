/**
 * Unit tests for CMAC (Cipher-based MAC)
 */

import { describe, it, expect } from 'vitest';
import { cmac, generateSubkeys } from './cmac';
import { TwofishCipher } from './twofish';
import { hexToBytes } from './utils';

describe('CMAC', () => {
  describe('generateSubkeys', () => {
    it('should generate K1 and K2 from zero block', () => {
      const key = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);

      const { K1, K2 } = generateSubkeys(cipher);

      // K1 and K2 should be 16 bytes each
      expect(K1.length).toBe(16);
      expect(K2.length).toBe(16);

      // K1 and K2 should be different
      expect(K1).not.toEqual(K2);
    });

    it('should generate consistent subkeys for same key', () => {
      const key = new Uint8Array(16).fill(0xab);
      const cipher1 = new TwofishCipher(key);
      const cipher2 = new TwofishCipher(key);

      const sub1 = generateSubkeys(cipher1);
      const sub2 = generateSubkeys(cipher2);

      expect(sub1.K1).toEqual(sub2.K1);
      expect(sub1.K2).toEqual(sub2.K2);
    });

    it('should generate different subkeys for different keys', () => {
      const key1 = new Uint8Array(16).fill(0x00);
      const key2 = new Uint8Array(16).fill(0xff);

      const cipher1 = new TwofishCipher(key1);
      const cipher2 = new TwofishCipher(key2);

      const sub1 = generateSubkeys(cipher1);
      const sub2 = generateSubkeys(cipher2);

      expect(sub1.K1).not.toEqual(sub2.K1);
      expect(sub1.K2).not.toEqual(sub2.K2);
    });
  });

  describe('cmac', () => {
    it('should compute MAC for empty message', () => {
      const key = new Uint8Array(16).fill(0x2b);
      const cipher = new TwofishCipher(key);
      const message = new Uint8Array(0);

      const mac = cmac(cipher, message);

      // MAC should be 16 bytes
      expect(mac.length).toBe(16);
    });

    it('should compute MAC for 16-byte message (complete block)', () => {
      const key = new Uint8Array(16).fill(0x2b);
      const cipher = new TwofishCipher(key);
      const message = hexToBytes('6bc1bee22e409f96e93d7e117393172a');

      const mac = cmac(cipher, message);

      expect(mac.length).toBe(16);
    });

    it('should compute MAC for 40-byte message (padding required)', () => {
      const key = new Uint8Array(16).fill(0x2b);
      const cipher = new TwofishCipher(key);
      const message = hexToBytes(
        '6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411'
      );

      const mac = cmac(cipher, message);

      expect(mac.length).toBe(16);
    });

    it('should produce consistent MAC for same input', () => {
      const key = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);
      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const mac1 = cmac(cipher, message);
      const mac2 = cmac(cipher, message);

      expect(mac1).toEqual(mac2);
    });

    it('should produce different MAC for different messages', () => {
      const key = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);

      const message1 = new Uint8Array([1, 2, 3]);
      const message2 = new Uint8Array([1, 2, 4]);

      const mac1 = cmac(cipher, message1);
      const mac2 = cmac(cipher, message2);

      expect(mac1).not.toEqual(mac2);
    });

    it('should produce different MAC for different keys', () => {
      const key1 = new Uint8Array(16).fill(0x00);
      const key2 = new Uint8Array(16).fill(0xff);

      const cipher1 = new TwofishCipher(key1);
      const cipher2 = new TwofishCipher(key2);

      const message = new Uint8Array([1, 2, 3, 4, 5]);

      const mac1 = cmac(cipher1, message);
      const mac2 = cmac(cipher2, message);

      expect(mac1).not.toEqual(mac2);
    });

    it('should handle message length = blockSize - 1 (padding)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);
      const message = new Uint8Array(15).fill(0xaa);

      const mac = cmac(cipher, message);

      expect(mac.length).toBe(16);
    });

    it('should handle message length = blockSize + 1 (padding)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);
      const message = new Uint8Array(17).fill(0xbb);

      const mac = cmac(cipher, message);

      expect(mac.length).toBe(16);
    });

    it('should handle multi-block message', () => {
      const key = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);
      const message = new Uint8Array(64).fill(0xcc); // 4 blocks

      const mac = cmac(cipher, message);

      expect(mac.length).toBe(16);
    });
  });

  describe('CMAC with PT 7+ hardcoded key', () => {
    it('should compute MAC with key=137 repeated', () => {
      const key = new Uint8Array(16).fill(137);
      const cipher = new TwofishCipher(key);
      const message = new TextEncoder().encode('Hello Packet Tracer!');

      const mac = cmac(cipher, message);

      expect(mac.length).toBe(16);
      // MAC should be deterministic
      const mac2 = cmac(cipher, message);
      expect(mac).toEqual(mac2);
    });

    it('should produce different MAC for slightly different message', () => {
      const key = new Uint8Array(16).fill(137);
      const cipher = new TwofishCipher(key);

      const mac1 = cmac(cipher, new TextEncoder().encode('Test1'));
      const mac2 = cmac(cipher, new TextEncoder().encode('Test2'));

      expect(mac1).not.toEqual(mac2);
    });
  });
});

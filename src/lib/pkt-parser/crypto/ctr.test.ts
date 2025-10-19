/**
 * Unit tests for CTR (Counter) mode
 */

import { describe, it, expect } from 'vitest';
import { ctr } from './ctr';
import { TwofishCipher } from './twofish';

describe('CTR Mode', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly (symmetric)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      const decrypted = ctr(cipher, nonce, ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertext for different plaintext', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);

      const plaintext1 = new Uint8Array([1, 2, 3]);
      const plaintext2 = new Uint8Array([4, 5, 6]);

      const cipher = new TwofishCipher(key);

      const ciphertext1 = ctr(cipher, nonce, plaintext1);
      const ciphertext2 = ctr(cipher, nonce, plaintext2);

      expect(ciphertext1).not.toEqual(ciphertext2);
    });

    it('should produce different ciphertext for different nonces', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce1 = new Uint8Array(16).fill(0x00);
      const nonce2 = new Uint8Array(16).fill(0xff);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const ciphertext1 = ctr(cipher, nonce1, plaintext);
      const ciphertext2 = ctr(cipher, nonce2, plaintext);

      expect(ciphertext1).not.toEqual(ciphertext2);
    });

    it('should produce different ciphertext for different keys', () => {
      const key1 = new Uint8Array(16).fill(0x00);
      const key2 = new Uint8Array(16).fill(0xff);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher1 = new TwofishCipher(key1);
      const cipher2 = new TwofishCipher(key2);

      const ciphertext1 = ctr(cipher1, nonce, plaintext);
      const ciphertext2 = ctr(cipher2, nonce, plaintext);

      expect(ciphertext1).not.toEqual(ciphertext2);
    });
  });

  describe('block handling', () => {
    it('should handle single block (16 bytes)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array(16).fill(0xaa);

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      expect(ciphertext.length).toBe(16);

      const decrypted = ctr(cipher, nonce, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle multi-block data (50 bytes)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array(50).fill(0xbb);

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      expect(ciphertext.length).toBe(50);

      const decrypted = ctr(cipher, nonce, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle partial last block', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array(17).fill(0xcc); // 1 full + 1 partial

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      expect(ciphertext.length).toBe(17);

      const decrypted = ctr(cipher, nonce, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle empty data', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array(0);

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      expect(ciphertext.length).toBe(0);

      const decrypted = ctr(cipher, nonce, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle large data (1 KB)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array(1024).fill(0xdd);

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      expect(ciphertext.length).toBe(1024);

      const decrypted = ctr(cipher, nonce, ciphertext);
      expect(decrypted).toEqual(plaintext);
    });
  });

  describe('PT 7+ hardcoded keys', () => {
    it('should work with key=137 and nonce=16', () => {
      const key = new Uint8Array(16).fill(137);
      const nonce = new Uint8Array(16).fill(16);
      const plaintext = new TextEncoder().encode('Packet Tracer 7+');

      const cipher = new TwofishCipher(key);

      const ciphertext = ctr(cipher, nonce, plaintext);
      const decrypted = ctr(cipher, nonce, ciphertext);

      expect(new TextDecoder().decode(decrypted)).toBe('Packet Tracer 7+');
    });

    it('should produce consistent ciphertext with PT keys', () => {
      const key = new Uint8Array(16).fill(137);
      const nonce = new Uint8Array(16).fill(16);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const ciphertext1 = ctr(cipher, nonce, plaintext);
      const ciphertext2 = ctr(cipher, nonce, plaintext);

      // Deterministic
      expect(ciphertext1).toEqual(ciphertext2);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid nonce length', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(15); // Invalid: not 16 bytes
      const plaintext = new Uint8Array([1, 2, 3]);

      const cipher = new TwofishCipher(key);

      expect(() => ctr(cipher, nonce, plaintext)).toThrow('nonce must be');
    });
  });

  describe('properties', () => {
    it('should maintain ciphertext length = plaintext length', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const cipher = new TwofishCipher(key);

      [0, 1, 15, 16, 17, 31, 32, 33, 100].forEach((length) => {
        const plaintext = new Uint8Array(length).fill(0xee);
        const ciphertext = ctr(cipher, nonce, plaintext);

        expect(ciphertext.length).toBe(length);
      });
    });
  });
});

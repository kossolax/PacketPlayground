/**
 * Unit tests for TwoFish cipher wrapper
 */

import { describe, it, expect } from 'vitest';
import { TwofishCipher } from './twofish';
import { hexToBytes } from './utils';

describe('TwoFish Cipher', () => {
  describe('constructor', () => {
    it('should accept 16-byte key', () => {
      const key = new Uint8Array(16).fill(0xab);
      expect(() => new TwofishCipher(key)).not.toThrow();
    });

    it('should accept 24-byte key', () => {
      const key = new Uint8Array(24).fill(0xab);
      expect(() => new TwofishCipher(key)).not.toThrow();
    });

    it('should accept 32-byte key', () => {
      const key = new Uint8Array(32).fill(0xab);
      expect(() => new TwofishCipher(key)).not.toThrow();
    });

    it('should reject invalid key lengths', () => {
      const key15 = new Uint8Array(15);
      const key17 = new Uint8Array(17);

      expect(() => new TwofishCipher(key15)).toThrow(
        'must be 16, 24, or 32 bytes'
      );
      expect(() => new TwofishCipher(key17)).toThrow(
        'must be 16, 24, or 32 bytes'
      );
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly (roundtrip)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const plaintext = hexToBytes('00112233445566778899aabbccddeeff');

      const cipher = new TwofishCipher(key);

      const ciphertext = cipher.encrypt(plaintext);
      const decrypted = cipher.decrypt(ciphertext);

      expect(decrypted).toEqual(plaintext);
    });

    it('should produce different ciphertext for different plaintext', () => {
      const key = new Uint8Array(16).fill(0x00);
      const plaintext1 = new Uint8Array(16).fill(0x00);
      const plaintext2 = new Uint8Array(16).fill(0xff);

      const cipher = new TwofishCipher(key);

      const ciphertext1 = cipher.encrypt(plaintext1);
      const ciphertext2 = cipher.encrypt(plaintext2);

      expect(ciphertext1).not.toEqual(ciphertext2);
    });

    it('should produce different ciphertext for different keys', () => {
      const key1 = new Uint8Array(16).fill(0x00);
      const key2 = new Uint8Array(16).fill(0xff);
      const plaintext = new Uint8Array(16).fill(0xaa);

      const cipher1 = new TwofishCipher(key1);
      const cipher2 = new TwofishCipher(key2);

      const ciphertext1 = cipher1.encrypt(plaintext);
      const ciphertext2 = cipher2.encrypt(plaintext);

      expect(ciphertext1).not.toEqual(ciphertext2);
    });

    it('should reject non-16-byte blocks in encrypt', () => {
      const key = new Uint8Array(16);
      const cipher = new TwofishCipher(key);

      const block15 = new Uint8Array(15);
      const block17 = new Uint8Array(17);

      expect(() => cipher.encrypt(block15)).toThrow('must be 16 bytes');
      expect(() => cipher.encrypt(block17)).toThrow('must be 16 bytes');
    });

    it('should reject non-16-byte blocks in decrypt', () => {
      const key = new Uint8Array(16);
      const cipher = new TwofishCipher(key);

      const block15 = new Uint8Array(15);
      const block17 = new Uint8Array(17);

      expect(() => cipher.decrypt(block15)).toThrow('must be 16 bytes');
      expect(() => cipher.decrypt(block17)).toThrow('must be 16 bytes');
    });
  });

  describe('Packet Tracer hardcoded keys', () => {
    it('should work with PT 7+ key (137 repeated)', () => {
      const key = new Uint8Array(16).fill(137);
      const plaintext = new Uint8Array(16).fill(0x00);

      const cipher = new TwofishCipher(key);

      const ciphertext = cipher.encrypt(plaintext);
      const decrypted = cipher.decrypt(ciphertext);

      expect(decrypted).toEqual(plaintext);
      expect(ciphertext).not.toEqual(plaintext); // Ensure encryption happened
    });

    it('should produce consistent encryption with PT keys', () => {
      const key = new Uint8Array(16).fill(137);
      const plaintext = hexToBytes('0123456789abcdef0123456789abcdef');

      const cipher1 = new TwofishCipher(key);
      const cipher2 = new TwofishCipher(key);

      const ciphertext1 = cipher1.encrypt(plaintext);
      const ciphertext2 = cipher2.encrypt(plaintext);

      // Same key + plaintext = same ciphertext (deterministic)
      expect(ciphertext1).toEqual(ciphertext2);
    });
  });

  describe('blockSize', () => {
    it('should have blockSize of 16', () => {
      const key = new Uint8Array(16);
      const cipher = new TwofishCipher(key);

      expect(cipher.blockSize).toBe(16);
    });
  });
});

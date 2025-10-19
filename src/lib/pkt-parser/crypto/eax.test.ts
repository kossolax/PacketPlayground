/**
 * Unit tests for EAX (Encrypt-then-Authenticate-then-Translate) mode
 */

import { describe, it, expect } from 'vitest';
import { eaxEncrypt, eaxDecrypt } from './eax';
import { TwofishCipher } from './twofish';
import { hexToBytes } from './utils';

describe('EAX Mode', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly (roundtrip)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext);
      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag);

      expect(decrypted).toEqual(plaintext);
    });

    it('should encrypt empty message', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array(0);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext);

      expect(ciphertext.length).toBe(0);
      expect(tag.length).toBe(16);

      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag);
      expect(decrypted).toEqual(plaintext);
    });

    it('should produce 16-byte authentication tag', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3]);

      const cipher = new TwofishCipher(key);

      const { tag } = eaxEncrypt(cipher, nonce, plaintext);

      expect(tag.length).toBe(16);
    });

    it('should produce ciphertext of same length as plaintext', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);

      const cipher = new TwofishCipher(key);

      for (const length of [0, 1, 16, 17, 50, 100]) {
        const plaintext = new Uint8Array(length).fill(0xAA);
        const { ciphertext } = eaxEncrypt(cipher, nonce, plaintext);

        expect(ciphertext.length).toBe(length);
      }
    });
  });

  describe('authentication', () => {
    it('should detect tampered ciphertext', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext);

      // Tamper with ciphertext
      ciphertext[0] ^= 0xFF;

      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag);

      expect(decrypted).toBeNull(); // Authentication failed
    });

    it('should detect tampered tag', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext);

      // Tamper with tag
      tag[0] ^= 0xFF;

      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag);

      expect(decrypted).toBeNull(); // Authentication failed
    });

    it('should detect wrong nonce', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce1 = new Uint8Array(16).fill(0x00);
      const nonce2 = new Uint8Array(16).fill(0xFF);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce1, plaintext);

      // Try to decrypt with wrong nonce
      const decrypted = eaxDecrypt(cipher, nonce2, ciphertext, tag);

      expect(decrypted).toBeNull(); // Authentication failed
    });
  });

  describe('associated data (header)', () => {
    it('should handle empty header', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3]);
      const header = new Uint8Array(0);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext, header);
      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag, header);

      expect(decrypted).toEqual(plaintext);
    });

    it('should handle non-empty header', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3]);
      const header = new Uint8Array([10, 20, 30, 40]);

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext, header);
      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag, header);

      expect(decrypted).toEqual(plaintext);
    });

    it('should authenticate header (detect tampering)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3]);
      const header1 = new Uint8Array([10, 20, 30]);
      const header2 = new Uint8Array([10, 20, 31]); // Different

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext, header1);

      // Try to decrypt with different header
      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag, header2);

      expect(decrypted).toBeNull(); // Authentication failed
    });

    it('should not encrypt header (header in cleartext conceptually)', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3]);
      const header1 = new Uint8Array([10, 20]);
      const header2 = new Uint8Array([30, 40, 50]); // Different length

      const cipher = new TwofishCipher(key);

      const result1 = eaxEncrypt(cipher, nonce, plaintext, header1);
      const result2 = eaxEncrypt(cipher, nonce, plaintext, header2);

      // Ciphertext should be same (header doesn't affect encryption)
      expect(result1.ciphertext).toEqual(result2.ciphertext);

      // But tag should be different (header affects authentication)
      expect(result1.tag).not.toEqual(result2.tag);
    });
  });

  describe('determinism', () => {
    it('should produce consistent output for same inputs', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher1 = new TwofishCipher(key);
      const cipher2 = new TwofishCipher(key);

      const result1 = eaxEncrypt(cipher1, nonce, plaintext);
      const result2 = eaxEncrypt(cipher2, nonce, plaintext);

      expect(result1.ciphertext).toEqual(result2.ciphertext);
      expect(result1.tag).toEqual(result2.tag);
    });

    it('should produce different output for different nonces', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce1 = new Uint8Array(16).fill(0x00);
      const nonce2 = new Uint8Array(16).fill(0x01);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const result1 = eaxEncrypt(cipher, nonce1, plaintext);
      const result2 = eaxEncrypt(cipher, nonce2, plaintext);

      expect(result1.ciphertext).not.toEqual(result2.ciphertext);
      expect(result1.tag).not.toEqual(result2.tag);
    });
  });

  describe('PT 7+ hardcoded keys', () => {
    it('should work with key=137 and nonce=16', () => {
      const key = new Uint8Array(16).fill(137);
      const nonce = new Uint8Array(16).fill(16);
      const plaintext = new TextEncoder().encode('Packet Tracer 7+!');

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext);
      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag);

      expect(decrypted).not.toBeNull();
      expect(new TextDecoder().decode(decrypted!)).toBe('Packet Tracer 7+!');
    });

    it('should produce consistent results with PT keys', () => {
      const key = new Uint8Array(16).fill(137);
      const nonce = new Uint8Array(16).fill(16);
      const plaintext = new Uint8Array([1, 2, 3, 4, 5]);

      const cipher = new TwofishCipher(key);

      const result1 = eaxEncrypt(cipher, nonce, plaintext);
      const result2 = eaxEncrypt(cipher, nonce, plaintext);

      expect(result1.ciphertext).toEqual(result2.ciphertext);
      expect(result1.tag).toEqual(result2.tag);
    });

    it('should detect tampering with PT keys', () => {
      const key = new Uint8Array(16).fill(137);
      const nonce = new Uint8Array(16).fill(16);
      const plaintext = new TextEncoder().encode('Test data');

      const cipher = new TwofishCipher(key);

      const { ciphertext, tag } = eaxEncrypt(cipher, nonce, plaintext);

      // Tamper
      ciphertext[0] ^= 0x01;

      const decrypted = eaxDecrypt(cipher, nonce, ciphertext, tag);

      expect(decrypted).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid nonce length', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(15); // Invalid
      const plaintext = new Uint8Array([1, 2, 3]);

      const cipher = new TwofishCipher(key);

      expect(() => eaxEncrypt(cipher, nonce, plaintext)).toThrow('nonce must be');
    });

    it('should throw error for invalid tag length in decrypt', () => {
      const key = new Uint8Array(16).fill(0x00);
      const nonce = new Uint8Array(16).fill(0x00);
      const ciphertext = new Uint8Array([1, 2, 3]);
      const tag = new Uint8Array(15); // Invalid

      const cipher = new TwofishCipher(key);

      expect(() => eaxDecrypt(cipher, nonce, ciphertext, tag)).toThrow('tag must be');
    });
  });
});

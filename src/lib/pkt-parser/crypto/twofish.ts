/**
 * TwoFish block cipher wrapper
 * Wraps twofish-ts to implement the BlockCipher interface
 */

import {
  makeSession,
  encrypt as twofishEncrypt,
  decrypt as twofishDecrypt,
  type Session,
} from 'twofish-ts';
import type { BlockCipher } from './types';

/**
 * TwoFish block cipher implementation (128-bit blocks)
 */
export class TwofishCipher implements BlockCipher {
  private session: Session;

  readonly blockSize = 16; // 128 bits

  /**
   * Create a new TwoFish cipher
   * @param key Encryption key (16, 24, or 32 bytes)
   */
  constructor(key: Uint8Array) {
    if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
      throw new Error(
        `TwoFish key must be 16, 24, or 32 bytes (got ${key.length})`
      );
    }

    // Create TwoFish session from key
    this.session = makeSession(key);
  }

  /**
   * Encrypt a single block (16 bytes)
   * @param block Plaintext block
   * @returns Ciphertext block
   */
  encrypt(block: Uint8Array): Uint8Array {
    if (block.length !== this.blockSize) {
      throw new Error(
        `TwoFish encrypt: block must be ${this.blockSize} bytes (got ${block.length})`
      );
    }

    const ciphertext = new Uint8Array(this.blockSize);

    // twofish-ts API: encrypt(plain, plainOffset, cipher, cipherOffset, session)
    twofishEncrypt(block, 0, ciphertext, 0, this.session);

    return ciphertext;
  }

  /**
   * Decrypt a single block (16 bytes)
   * @param block Ciphertext block
   * @returns Plaintext block
   */
  decrypt(block: Uint8Array): Uint8Array {
    if (block.length !== this.blockSize) {
      throw new Error(
        `TwoFish decrypt: block must be ${this.blockSize} bytes (got ${block.length})`
      );
    }

    const plaintext = new Uint8Array(this.blockSize);

    // twofish-ts API: decrypt(cipher, cipherOffset, plain, plainOffset, session)
    twofishDecrypt(block, 0, plaintext, 0, this.session);

    return plaintext;
  }
}

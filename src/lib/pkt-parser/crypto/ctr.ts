/**
 * CTR (Counter) mode of operation
 * Implementation according to NIST SP 800-38A
 *
 * CTR mode turns a block cipher into a stream cipher by:
 * 1. Encrypting an incrementing counter
 * 2. XORing the result with plaintext/ciphertext
 *
 * Advantages:
 * - Encryption and decryption are identical operations
 * - Parallelizable
 * - No padding required
 */

import type { BlockCipher } from './types';
import { incrementCounter } from './utils';

/**
 * CTR mode encryption/decryption
 *
 * Algorithm (NIST SP 800-38A, Section 6.5):
 * 1. Counter = nonce
 * 2. For each block:
 *    - Keystream = E(K, Counter)
 *    - Output = Input XOR Keystream
 *    - Counter = Counter + 1
 *
 * Note: Encryption and decryption are the same operation
 *
 * @param cipher Block cipher instance
 * @param nonce Initial counter value (16 bytes)
 * @param data Data to encrypt/decrypt
 * @returns Encrypted/decrypted data
 */
export function ctr(
  cipher: BlockCipher,
  nonce: Uint8Array,
  data: Uint8Array
): Uint8Array {
  const blockSize = cipher.blockSize;

  if (nonce.length !== blockSize) {
    throw new Error(
      `CTR nonce must be ${blockSize} bytes (got ${nonce.length})`
    );
  }

  const result = new Uint8Array(data.length);

  // Initialize counter with nonce (copy to avoid modifying original)
  const counter = new Uint8Array(nonce);

  // Process each block
  for (let i = 0; i < data.length; i += blockSize) {
    // Encrypt the counter to generate keystream
    const keystream = cipher.encrypt(counter);

    // XOR data with keystream (handle last partial block)
    const blockLength = Math.min(blockSize, data.length - i);
    for (let j = 0; j < blockLength; j++) {
      result[i + j] = data[i + j] ^ keystream[j];
    }

    // Increment counter for next block
    incrementCounter(counter);
  }

  return result;
}

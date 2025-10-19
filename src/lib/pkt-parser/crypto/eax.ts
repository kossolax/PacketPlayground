/**
 * EAX (Encrypt-then-Authenticate-then-Translate) mode
 * Implementation according to the paper:
 * "The EAX Mode of Operation" by Bellare, Rogaway, Wagner (2004)
 *
 * EAX is an AEAD (Authenticated Encryption with Associated Data) mode that:
 * - Provides both confidentiality (CTR) and authenticity (CMAC)
 * - Works with any block cipher
 * - Uses a nonce (never reuse with same key!)
 * - Supports associated data (header) that is authenticated but not encrypted
 */

import type { BlockCipher, EAXResult } from './types';
import { cmac } from './cmac';
import { ctr } from './ctr';
import { concat, xor, constantTimeEqual } from './utils';

/**
 * EAX encryption with authentication
 *
 * Algorithm:
 * 1. N' = CMAC(K, [0]₁₂₈ || N)   - Authenticate nonce
 * 2. H' = CMAC(K, [1]₁₂₈ || H)   - Authenticate header
 * 3. C  = CTR(K, N', M)           - Encrypt plaintext
 * 4. C' = CMAC(K, [2]₁₂₈ || C)   - Authenticate ciphertext
 * 5. T  = N' ⊕ H' ⊕ C'           - Compute authentication tag
 *
 * @param cipher Block cipher instance
 * @param nonce Nonce (16 bytes, must be unique for each encryption)
 * @param plaintext Data to encrypt
 * @param header Associated data to authenticate (optional)
 * @returns Ciphertext and authentication tag
 */
export function eaxEncrypt(
  cipher: BlockCipher,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  header: Uint8Array = new Uint8Array(0)
): EAXResult {
  const blockSize = cipher.blockSize;

  if (nonce.length !== blockSize) {
    throw new Error(
      `EAX nonce must be ${blockSize} bytes (got ${nonce.length})`
    );
  }

  // Step 1: N' = CMAC(K, [0]₁₂₈ || N)
  // Tag for nonce: 16 bytes of zeros
  const nTag = new Uint8Array(blockSize); // All zeros
  const nPrime = cmac(cipher, concat(nTag, nonce));

  // Step 2: H' = CMAC(K, [1]₁₂₈ || H)
  // Tag for header: 0...01
  const hTag = new Uint8Array(blockSize);
  hTag[blockSize - 1] = 1;
  const hPrime = cmac(cipher, concat(hTag, header));

  // Step 3: C = CTR(K, N', M)
  // Encrypt using CTR mode with derived nonce
  const ciphertext = ctr(cipher, nPrime, plaintext);

  // Step 4: C' = CMAC(K, [2]₁₂₈ || C)
  // Tag for ciphertext: 0...010
  const cTag = new Uint8Array(blockSize);
  cTag[blockSize - 1] = 2;
  const cPrime = cmac(cipher, concat(cTag, ciphertext));

  // Step 5: T = N' ⊕ H' ⊕ C'
  // Compute authentication tag
  const tag = xor(xor(nPrime, hPrime), cPrime);

  return { ciphertext, tag };
}

/**
 * EAX decryption with authentication verification
 *
 * Algorithm:
 * 1. Recompute N', H', C' (same as encryption)
 * 2. Verify T = N' ⊕ H' ⊕ C'
 * 3. If valid: M = CTR(K, N', C)
 *    Else: return null (authentication failed)
 *
 * @param cipher Block cipher instance
 * @param nonce Nonce (16 bytes, must match encryption nonce)
 * @param ciphertext Encrypted data
 * @param tag Authentication tag (16 bytes)
 * @param header Associated data (optional, must match encryption)
 * @returns Decrypted plaintext, or null if authentication fails
 */
export function eaxDecrypt(
  cipher: BlockCipher,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  header: Uint8Array = new Uint8Array(0)
): Uint8Array | null {
  const blockSize = cipher.blockSize;

  if (nonce.length !== blockSize) {
    throw new Error(
      `EAX nonce must be ${blockSize} bytes (got ${nonce.length})`
    );
  }

  if (tag.length !== blockSize) {
    throw new Error(
      `EAX tag must be ${blockSize} bytes (got ${tag.length})`
    );
  }

  // Step 1: Recompute N' = CMAC(K, [0]₁₂₈ || N)
  const nTag = new Uint8Array(blockSize);
  const nPrime = cmac(cipher, concat(nTag, nonce));

  // Step 2: Recompute H' = CMAC(K, [1]₁₂₈ || H)
  const hTag = new Uint8Array(blockSize);
  hTag[blockSize - 1] = 1;
  const hPrime = cmac(cipher, concat(hTag, header));

  // Step 3: Compute C' = CMAC(K, [2]₁₂₈ || C)
  const cTag = new Uint8Array(blockSize);
  cTag[blockSize - 1] = 2;
  const cPrime = cmac(cipher, concat(cTag, ciphertext));

  // Step 4: Verify authentication tag
  const expectedTag = xor(xor(nPrime, hPrime), cPrime);

  if (!constantTimeEqual(tag, expectedTag)) {
    // Authentication failed - data has been tampered with
    return null;
  }

  // Step 5: Decrypt M = CTR(K, N', C)
  const plaintext = ctr(cipher, nPrime, ciphertext);

  return plaintext;
}

/**
 * CMAC (Cipher-based Message Authentication Code)
 * Implementation according to RFC 4493 and NIST SP 800-38B
 *
 * CMAC is a block cipher-based MAC that can use any block cipher.
 * Here we use it with TwoFish for Packet Tracer decryption.
 */

import type { BlockCipher, CMACSubkeys } from './types';
import { xor, doubleGF128 } from './utils';

/**
 * Generate CMAC subkeys K1 and K2 from the cipher key
 *
 * Algorithm (RFC 4493, Section 2.3):
 * 1. L = E(K, 0^128)  (encrypt block of zeros)
 * 2. K1 = L << 1      (doubling in GF(2^128))
 * 3. K2 = K1 << 1     (doubling in GF(2^128))
 *
 * @param cipher Block cipher instance
 * @returns Subkeys K1 and K2
 */
export function generateSubkeys(cipher: BlockCipher): CMACSubkeys {
  // Step 1: Encrypt a block of zeros
  const zeros = new Uint8Array(cipher.blockSize);
  const L = cipher.encrypt(zeros);

  // Step 2: K1 = L << 1 (doubling in GF(2^128))
  const K1 = doubleGF128(L);

  // Step 3: K2 = K1 << 1
  const K2 = doubleGF128(K1);

  return { K1, K2 };
}

/**
 * Compute CMAC tag for a message
 *
 * Algorithm (RFC 4493, Section 2.4):
 * 1. Generate subkeys K1 and K2
 * 2. Divide message into n blocks of blockSize bytes
 * 3. If last block is complete (blockSize bytes):
 *      lastBlock = lastBlock XOR K1
 *    Else:
 *      lastBlock = pad(lastBlock) XOR K2
 * 4. Apply CBC-MAC with IV=0
 *
 * @param cipher Block cipher instance
 * @param message Message to authenticate
 * @returns 16-byte MAC tag
 */
export function cmac(cipher: BlockCipher, message: Uint8Array): Uint8Array {
  const { blockSize } = cipher;

  // Step 1: Generate subkeys
  const { K1, K2 } = generateSubkeys(cipher);

  // Step 2: Determine number of blocks
  const messageLength = message.length;
  const n = Math.ceil(messageLength / blockSize) || 1; // At least 1 block

  // Step 3: Process all blocks except the last one
  const blocks: Uint8Array[] = [];

  for (let i = 0; i < n - 1; i += 1) {
    const block = message.slice(i * blockSize, (i + 1) * blockSize);
    blocks.push(block);
  }

  // Step 4: Process last block
  const lastBlockStart = (n - 1) * blockSize;
  const lastBlock = message.slice(lastBlockStart);

  let finalBlock: Uint8Array;

  if (lastBlock.length === blockSize) {
    // Complete last block: XOR with K1
    finalBlock = xor(lastBlock, K1);
  } else {
    // Incomplete last block: pad then XOR with K2
    // Padding: append 0x80 followed by zeros to reach blockSize
    const padded = new Uint8Array(blockSize);
    padded.set(lastBlock);
    padded[lastBlock.length] = 0x80; // ISO/IEC 9797-1 padding

    finalBlock = xor(padded, K2);
  }

  blocks.push(finalBlock);

  // Step 5: Apply CBC-MAC
  let mac = new Uint8Array(blockSize); // IV = 0

  blocks.forEach((block) => {
    const input = xor(mac, block);
    mac = cipher.encrypt(input);
  });

  return mac;
}

/**
 * Cryptographic utility functions
 * XOR, padding, GF(2^128) operations, etc.
 */

/**
 * XOR two Uint8Arrays of the same length
 * @param a First buffer
 * @param b Second buffer
 * @returns XORed result
 * @throws Error if buffers have different lengths
 */
export function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new Error(`XOR: buffers must have same length (got ${a.length} and ${b.length})`);
  }

  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }

  return result;
}

/**
 * Concatenate multiple Uint8Arrays
 * @param buffers Buffers to concatenate
 * @returns Concatenated buffer
 */
export function concat(...buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return result;
}

/**
 * Doubling operation in GF(2^128) for CMAC subkey generation
 * Performs: (block << 1) XOR Rb (if MSB was 1)
 *
 * @param block 16-byte block to double
 * @returns Doubled block
 */
export function doubleGF128(block: Uint8Array): Uint8Array {
  if (block.length !== 16) {
    throw new Error(`doubleGF128: block must be 16 bytes (got ${block.length})`);
  }

  const result = new Uint8Array(16);
  let carry = 0;

  // Shift left by 1 bit (process from right to left for big-endian)
  for (let i = 15; i >= 0; i--) {
    const newCarry = (block[i] & 0x80) !== 0 ? 1 : 0;
    result[i] = ((block[i] << 1) | carry) & 0xFF;
    carry = newCarry;
  }

  // If MSB of original block was 1, XOR with reduction polynomial
  // Rb = 0x87 for 128-bit block size
  if (carry === 1) {
    result[15] ^= 0x87;
  }

  return result;
}

/**
 * Increment counter in big-endian for CTR mode
 * Modifies the counter in-place
 *
 * @param counter Counter to increment (16 bytes)
 */
export function incrementCounter(counter: Uint8Array): void {
  // Increment from right to left (big-endian)
  for (let i = counter.length - 1; i >= 0; i--) {
    counter[i]++;
    if (counter[i] !== 0) {
      // No overflow, stop
      break;
    }
    // Overflow, continue to next byte
  }
}

/**
 * Constant-time comparison of two Uint8Arrays
 * Protects against timing attacks
 *
 * @param a First buffer
 * @param b Second buffer
 * @returns true if buffers are equal
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }

  return diff === 0;
}

/**
 * Padding according to ISO/IEC 9797-1 Method 2
 * Appends 0x80 followed by zeros to reach blockSize
 *
 * @param data Data to pad
 * @param blockSize Target block size (16 for AES/TwoFish)
 * @returns Padded data
 */
export function padISO9797(data: Uint8Array, blockSize: number): Uint8Array {
  const paddingLength = blockSize - (data.length % blockSize);

  const padded = new Uint8Array(data.length + paddingLength);
  padded.set(data);

  // Set padding: 0x80 followed by zeros
  padded[data.length] = 0x80;
  // Rest is already zeros (Uint8Array initialized to 0)

  return padded;
}

/**
 * Convert hex string to Uint8Array
 * @param hex Hex string (without 0x prefix)
 * @returns Byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove spaces and convert to lowercase
  hex = hex.replace(/\s/g, '').toLowerCase();

  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes Byte array
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

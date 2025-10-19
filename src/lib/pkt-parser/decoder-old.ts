/**
 * Packet Tracer 5.x file decoder
 * Simple format: XOR obfuscation + zlib compression
 *
 * Algorithm:
 * 1. XOR each byte with (fileSize - position)
 * 2. Read uncompressed size from first 4 bytes (big-endian)
 * 3. Decompress remaining bytes with zlib
 */

import pako from 'pako';

/**
 * Decrypt a Packet Tracer 5.x file
 *
 * @param data Encrypted file data
 * @returns Decrypted XML string
 * @throws Error if decompression fails
 */
export function decryptPacketTracer5(data: Uint8Array): string {
  let length = data.length;
  const decrypted = new Uint8Array(length);

  // Step 1: XOR decryption with decreasing file length
  for (let i = 0; i < length; i++) {
    decrypted[i] = data[i] ^ (length - i);
  }

  // Step 2: Read uncompressed size (4 bytes, big-endian)
  const uncompressedSize =
    (decrypted[0] << 24) |
    (decrypted[1] << 16) |
    (decrypted[2] << 8) |
    decrypted[3];

  // Step 3: Decompress zlib data (skip first 4 bytes)
  const compressed = decrypted.slice(4);

  try {
    const decompressed = pako.inflate(compressed);
    return new TextDecoder('utf-8').decode(decompressed);
  } catch (error) {
    throw new Error(
      `Failed to decompress PT 5.x file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Encrypt data to Packet Tracer 5.x format
 * (For testing purposes)
 *
 * @param xml XML string to encrypt
 * @returns Encrypted file data
 */
export function encryptPacketTracer5(xml: string): Uint8Array {
  // Step 1: Compress with zlib
  const xmlBytes = new TextEncoder().encode(xml);
  const compressed = pako.deflate(xmlBytes);

  // Step 2: Prepend uncompressed size (4 bytes, big-endian)
  const size = xmlBytes.length;
  const withSize = new Uint8Array(4 + compressed.length);
  withSize[0] = (size >> 24) & 0xFF;
  withSize[1] = (size >> 16) & 0xFF;
  withSize[2] = (size >> 8) & 0xFF;
  withSize[3] = size & 0xFF;
  withSize.set(compressed, 4);

  // Step 3: XOR encryption with decreasing length
  let length = withSize.length;
  const encrypted = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    encrypted[i] = withSize[i] ^ (length - i);
  }

  return encrypted;
}

/**
 * Packet Tracer file parser
 * Decrypts and parses .pkt and .pka files
 *
 * Supports:
 * - Packet Tracer 5.x (simple XOR + zlib)
 * - Packet Tracer 7+ (TwoFish-EAX + double obfuscation + zlib)
 */

// Decoders
import {
  decryptPacketTracer5 as decrypt5,
  encryptPacketTracer5,
} from './decoder-old';
import {
  decryptPacketTracer7 as decrypt7,
  encryptPacketTracer7,
  detectPacketTracerVersion as detectVersion,
} from './decoder';

// Re-export for external use
export {
  decrypt5 as decryptPacketTracer5,
  encryptPacketTracer5,
  decrypt7 as decryptPacketTracer7,
  encryptPacketTracer7,
  detectVersion as detectPacketTracerVersion,
};

// Crypto primitives (for advanced usage)
export * from './crypto';

/**
 * Auto-detect version and decrypt a Packet Tracer file
 *
 * @param data File data (Uint8Array)
 * @returns Decrypted XML string
 * @throws Error if decryption fails
 */
export function decryptPacketTracerFile(data: Uint8Array): string {
  const version = detectVersion(data);

  if (version === '5.x') {
    return decrypt5(data);
  }

  const result = decrypt7(data);

  if (result === null) {
    throw new Error('Failed to decrypt PT 7+ file: authentication failed');
  }

  return result;
}

/**
 * Packet Tracer file parser
 * Decrypts and parses .pkt and .pka files
 *
 * Supports:
 * - Packet Tracer 5.x (simple XOR + zlib)
 * - Packet Tracer 7+ (TwoFish-EAX + double obfuscation + zlib)
 */

// Decoders
export { decryptPacketTracer5, encryptPacketTracer5 } from './decoder-old';
export {
  decryptPacketTracer7,
  encryptPacketTracer7,
  detectPacketTracerVersion,
} from './decoder';

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
  // Import locally to avoid circular dependencies
  const {
    detectPacketTracerVersion,
    decryptPacketTracer7,
  } = require('./decoder');
  const { decryptPacketTracer5 } = require('./decoder-old');

  const version = detectPacketTracerVersion(data);

  if (version === '5.x') {
    return decryptPacketTracer5(data);
  }

  const result = decryptPacketTracer7(data);

  if (result === null) {
    throw new Error('Failed to decrypt PT 7+ file: authentication failed');
  }

  return result;
}

/**
 * Packet Tracer 7+ file decoder
 * Complex format: Double obfuscation + TwoFish-EAX + zlib
 *
 * Algorithm (4 stages):
 * 1. Deobfuscation 1: Reverse byte order + XOR with (length - i*length)
 * 2. TwoFish-EAX decryption with hardcoded keys
 * 3. Deobfuscation 2: XOR with (length - i)
 * 4. Zlib decompression
 */

import pako from 'pako';
import { TwofishCipher, eaxDecrypt, eaxEncrypt } from './crypto';

/**
 * Hardcoded encryption keys for Packet Tracer 7+
 * Found by reverse-engineering the PT binary
 */
const PT7_KEY = new Uint8Array(16).fill(137); // { 137, 137, ..., 137 }
const PT7_NONCE = new Uint8Array(16).fill(16); // { 16, 16, ..., 16 }

/**
 * Stage 1: Complex deobfuscation
 * Reverse byte order + XOR with complex key
 *
 * @param input Encrypted data
 * @returns Deobfuscated data
 */
function deobfuscate1(input: Uint8Array): Uint8Array {
  const length = input.length;
  const output = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    // Reverse index: length + ~i = length - i - 1
    const reverseIndex = length - i - 1;

    // XOR key: (length - i * length) & 0xFF
    // This will overflow intentionally - keep only low byte
    const xorKey = (length - i * length) & 0xFF;

    output[i] = input[reverseIndex] ^ xorKey;
  }

  return output;
}

/**
 * Stage 3: Simple deobfuscation
 * XOR each byte with (length - position)
 *
 * @param input Data to deobfuscate
 * @returns Deobfuscated data
 */
function deobfuscate2(input: Uint8Array): Uint8Array {
  const length = input.length;
  const output = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    output[i] = input[i] ^ (length - i);
  }

  return output;
}

/**
 * Stage 4: Zlib decompression
 * First 4 bytes = uncompressed size (big-endian)
 * Remaining bytes = zlib-compressed data
 *
 * @param input Compressed data with size prefix
 * @returns Decompressed XML string
 */
function decompressZlib(input: Uint8Array): string {
  // Read uncompressed size (big-endian)
  const uncompressedSize =
    (input[0] << 24) | (input[1] << 16) | (input[2] << 8) | input[3];

  // Decompress (skip first 4 bytes)
  const compressed = input.slice(4);

  try {
    const decompressed = pako.inflate(compressed);
    return new TextDecoder('utf-8').decode(decompressed);
  } catch (error) {
    throw new Error(
      `Failed to decompress PT 7+ file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Decrypt a Packet Tracer 7+ file
 *
 * @param data Encrypted file data
 * @returns Decrypted XML string, or null if authentication fails
 * @throws Error if decryption fails
 */
export function decryptPacketTracer7(data: Uint8Array): string | null {
  // Stage 1: Complex deobfuscation
  const step1 = deobfuscate1(data);

  // Stage 2: TwoFish-EAX decryption
  // The authentication tag is the last 16 bytes
  const cipher = new TwofishCipher(PT7_KEY);

  const ciphertext = step1.slice(0, -16);
  const tag = step1.slice(-16);

  const step2 = eaxDecrypt(cipher, PT7_NONCE, ciphertext, tag);

  if (!step2) {
    // Authentication failed - file is corrupted or tampered
    return null;
  }

  // Stage 3: Simple deobfuscation
  const step3 = deobfuscate2(step2);

  // Stage 4: Zlib decompression
  const xml = decompressZlib(step3);

  return xml;
}

/**
 * Stage 1 (reverse): Zlib compression
 * Compress data and prepend uncompressed size (big-endian, 4 bytes)
 *
 * @param xml XML string to compress
 * @returns Compressed data with size prefix
 */
function compressZlib(xml: string): Uint8Array {
  const data = new TextEncoder().encode(xml);
  const compressed = pako.deflate(data);

  // Prepend uncompressed size (big-endian)
  const result = new Uint8Array(4 + compressed.length);
  result[0] = (data.length >> 24) & 0xff;
  result[1] = (data.length >> 16) & 0xff;
  result[2] = (data.length >> 8) & 0xff;
  result[3] = data.length & 0xff;
  result.set(compressed, 4);

  return result;
}

/**
 * Stage 2 (reverse): Simple obfuscation
 * XOR each byte with (length - position) - same as deobfuscate2
 *
 * @param input Data to obfuscate
 * @returns Obfuscated data
 */
function obfuscate2(input: Uint8Array): Uint8Array {
  // XOR is its own inverse, so same algorithm as deobfuscate2
  return deobfuscate2(input);
}

/**
 * Stage 4 (reverse): Complex obfuscation
 * Reverse of deobfuscate1: write to reverse index after XOR
 *
 * @param input Data to obfuscate
 * @returns Obfuscated data
 */
function obfuscate1(input: Uint8Array): Uint8Array {
  const length = input.length;
  const output = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    const reverseIndex = length - i - 1;
    const xorKey = (length - i * length) & 0xff;

    // Write to reverse index (inverse of reading from reverse index)
    output[reverseIndex] = input[i] ^ xorKey;
  }

  return output;
}

/**
 * Encrypt data to Packet Tracer 7+ format
 * (For testing purposes - reverses the decryption process)
 *
 * @param xml XML string to encrypt
 * @returns Encrypted file data
 */
export function encryptPacketTracer7(xml: string): Uint8Array {
  // Stage 1: Zlib compression with size prefix
  const step1 = compressZlib(xml);

  // Stage 2: Simple obfuscation (XOR with length - i)
  const step2 = obfuscate2(step1);

  // Stage 3: TwoFish-EAX encryption
  const cipher = new TwofishCipher(PT7_KEY);
  const { ciphertext, tag } = eaxEncrypt(cipher, PT7_NONCE, step2);

  // Concatenate ciphertext + tag
  const step3 = new Uint8Array(ciphertext.length + tag.length);
  step3.set(ciphertext, 0);
  step3.set(tag, ciphertext.length);

  // Stage 4: Complex obfuscation (reverse + XOR)
  const encrypted = obfuscate1(step3);

  return encrypted;
}

/**
 * Detect Packet Tracer version from file data
 * Heuristic: PT 5.x files have zlib headers at specific positions after XOR
 *
 * @param data File data
 * @returns Version ('5.x' or '7+')
 */
export function detectPacketTracerVersion(data: Uint8Array): '5.x' | '7+' {
  const length = data.length;

  // After simple XOR (PT 5.x), bytes 4-5 should be zlib headers (0x78, 0x9C or 0x78, 0xDA)
  const byte4 = data[4] ^ (length - 4);
  const byte5 = data[5] ^ (length - 5);

  // Check for zlib magic bytes
  if (byte4 === 0x78 && (byte5 === 0x9C || byte5 === 0xDA || byte5 === 0x01)) {
    return '5.x';
  }

  return '7+';
}

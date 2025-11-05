/**
 * Network Protocol Checksums
 *
 * This module provides checksum functions used by various network protocols:
 * - Internet Checksum (RFC 1071): Used by IPv4, ICMP, UDP, TCP
 * - CRC-32 (IEEE 802.3): Used by Ethernet FCS
 * - CRC-16 (X.25, HDLC, PPP, Bluetooth, Modbus)
 * - Fletcher-16: Fast checksum for embedded protocols
 * - Parity/LRC: Simple checksums for serial protocols (RS-232, UART)
 */

/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */

// ============================================================================
// INTERNET CHECKSUM (RFC 1071)
// ============================================================================

/**
 * RFC 1071: Computing the Internet Checksum
 * Used by IPv4, ICMP, UDP, TCP, and other Internet protocols
 *
 * The checksum is the 16-bit one's complement of the one's complement sum
 * of all 16-bit words in the header and data.
 */

/**
 * Calculate Internet Checksum (RFC 1071)
 * @param words Array of 16-bit words to checksum
 * @returns 16-bit checksum
 */
export function internetChecksum(words: number[]): number {
  let sum = 0;

  // Add all 16-bit words
  for (const word of words) {
    sum += word & 0xffff;
  }

  // Fold 32-bit sum to 16 bits (add carry)
  while (sum >> 16) {
    sum = (sum & 0xffff) + (sum >> 16);
  }

  // One's complement
  return ~sum & 0xffff;
}

/**
 * Calculate Internet Checksum from a byte array
 * @param bytes Array of bytes
 * @returns 16-bit checksum
 */
export function internetChecksumBytes(bytes: number[]): number {
  const words: number[] = [];

  // Convert bytes to 16-bit words
  for (let i = 0; i < bytes.length; i += 2) {
    const highByte = bytes[i] & 0xff;
    const lowByte = i + 1 < bytes.length ? bytes[i + 1] & 0xff : 0;
    words.push((highByte << 8) | lowByte);
  }

  return internetChecksum(words);
}

// ============================================================================
// CRC-32 (IEEE 802.3)
// ============================================================================

/**
 * CRC-32 lookup table for Ethernet FCS
 * IEEE 802.3 polynomial: 0x04C11DB7 (reversed: 0xEDB88320)
 *
 * Pre-computed table for fast CRC calculation (256 entries × 4 bytes = 1KB)
 * Generated once and reused for all CRC-32 calculations
 */
const CRC32_TABLE = (() => {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      // Bitwise magic: if bit 0 is set, shift right and XOR with polynomial
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    table[i] = crc >>> 0; // Ensure unsigned 32-bit
  }
  return table;
})();

/**
 * Calculate CRC-32 checksum (IEEE 802.3)
 * Used for Ethernet Frame Check Sequence (FCS)
 *
 * @param bytes Array of bytes to checksum
 * @returns 32-bit CRC checksum
 *
 * @example
 * const data = [0x01, 0x02, 0x03, 0x04];
 * const crc = crc32(data);
 */
export function crc32(bytes: number[]): number {
  let crc = 0xffffffff; // Initial value: all 1s

  // Process each byte using table lookup
  for (const byte of bytes) {
    const index = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[index];
  }

  // Final XOR (FCS is the complement)
  return (crc ^ 0xffffffff) >>> 0;
}

// ============================================================================
// CRC-16 (X.25, HDLC, PPP, Bluetooth, Modbus)
// ============================================================================

/**
 * CRC-16 lookup table (CCITT polynomial: 0x1021)
 * Used by X.25, HDLC, PPP, Bluetooth, and other protocols
 */
const CRC16_TABLE = (() => {
  const table: number[] = [];
  const polynomial = 0x1021;

  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ polynomial : crc << 1;
    }
    table[i] = crc & 0xffff;
  }
  return table;
})();

/**
 * Calculate CRC-16-CCITT checksum
 * Used by X.25, HDLC, PPP, Bluetooth, Modbus
 *
 * Polynomial: 0x1021
 * Initial value: 0xFFFF
 *
 * @param bytes Array of bytes to checksum
 * @returns 16-bit CRC checksum
 *
 * @example
 * const data = [0x01, 0x02, 0x03];
 * const crc = crc16(data);
 */
export function crc16(bytes: number[]): number {
  let crc = 0xffff; // Initial value

  for (const byte of bytes) {
    const index = ((crc >> 8) ^ byte) & 0xff;
    crc = ((crc << 8) ^ CRC16_TABLE[index]) & 0xffff;
  }

  return crc;
}

// ============================================================================
// FLETCHER-16
// ============================================================================

/**
 * Calculate Fletcher-16 checksum
 * Faster alternative to Internet Checksum, used in some embedded protocols
 *
 * @param bytes Array of bytes to checksum
 * @returns 16-bit Fletcher checksum
 *
 * @example
 * const data = [0x01, 0x02];
 * const checksum = fletcher16(data);
 */
export function fletcher16(bytes: number[]): number {
  let sum1 = 0;
  let sum2 = 0;

  for (const byte of bytes) {
    sum1 = (sum1 + byte) % 255;
    sum2 = (sum2 + sum1) % 255;
  }

  return ((sum2 << 8) | sum1) & 0xffff;
}

// ============================================================================
// PARITY AND LRC
// ============================================================================

/**
 * Calculate simple parity bit
 * Returns 1 if odd number of 1s, 0 if even
 *
 * @param bytes Array of bytes
 * @returns Parity bit (0 or 1)
 *
 * @example
 * const data = [0b10110101]; // 5 bits set
 * const parity = parityBit(data); // Returns 1 (odd)
 */
export function parityBit(bytes: number[]): number {
  let count = 0;

  for (const byte of bytes) {
    // Count bits set to 1 using Brian Kernighan's algorithm
    let n = byte;
    while (n) {
      n &= n - 1; // Clear the lowest set bit
      count++;
    }
  }

  return count & 1; // Return 0 for even, 1 for odd
}

/**
 * Calculate Longitudinal Redundancy Check (LRC)
 * XOR of all bytes - simple but effective for serial protocols
 *
 * Used in: RS-232, UART, simple serial protocols
 *
 * @param bytes Array of bytes
 * @returns LRC byte (0x00-0xFF)
 *
 * @example
 * const data = [0x02, 0x30, 0x31, 0x03]; // STX '0' '1' ETX
 * const lrc = longitudinalRedundancyCheck(data);
 */
export function longitudinalRedundancyCheck(bytes: number[]): number {
  let lrc = 0;

  for (const byte of bytes) {
    lrc ^= byte;
  }

  return lrc & 0xff;
}

/**
 * Verify parity with expected parity bit
 *
 * @param bytes Array of bytes
 * @param expectedParity Expected parity bit (0 or 1)
 * @returns true if parity matches
 */
export function verifyParity(bytes: number[], expectedParity: number): boolean {
  return parityBit(bytes) === expectedParity;
}

/**
 * Verify LRC checksum
 *
 * @param bytes Array of bytes including LRC byte at the end
 * @returns true if LRC is valid (XOR of all bytes including LRC = 0)
 */
export function verifyLRC(bytes: number[]): boolean {
  return longitudinalRedundancyCheck(bytes) === 0;
}

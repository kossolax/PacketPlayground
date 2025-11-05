/**
 * Network Protocol Checksums
 *
 * This module provides checksum functions used by various network protocols:
 * - Internet Checksum (RFC 1071): Used by IPv4, ICMP, UDP, TCP
 * - CRC-32 (IEEE 802.3): Used by Ethernet FCS
 */

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

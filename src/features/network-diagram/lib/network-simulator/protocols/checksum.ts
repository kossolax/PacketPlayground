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

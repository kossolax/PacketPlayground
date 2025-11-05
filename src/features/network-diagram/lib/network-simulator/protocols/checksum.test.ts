import { describe, it, expect } from 'vitest';
import {
  internetChecksum,
  internetChecksumBytes,
  crc32,
  crc16,
  fletcher16,
  parityBit,
  longitudinalRedundancyCheck,
  verifyParity,
  verifyLRC,
} from './checksum';

describe('Internet Checksum (RFC 1071)', () => {
  describe('internetChecksum', () => {
    it('should calculate checksum for simple data', () => {
      // Simple test case
      const words = [0x0001, 0x0002];
      const checksum = internetChecksum(words);
      expect(checksum).toBeDefined();
      expect(checksum).toBeGreaterThanOrEqual(0);
      expect(checksum).toBeLessThanOrEqual(0xffff);
    });

    it('should calculate checksum for IPv4 header example', () => {
      // Example IPv4 header (version=4, IHL=5, TOS=0, length=60, etc.)
      const words = [
        0x4500, // Version + IHL + TOS
        0x003c, // Total length
        0x1c46, // Identification
        0x4000, // Flags + Fragment offset
        0x4006, // TTL + Protocol
        0x0000, // Checksum (0 for calculation)
        0xac10, // Source IP: 172.16
        0x0a63, // Source IP: 10.99
        0xac10, // Dest IP: 172.16
        0x0a0c, // Dest IP: 10.12
      ];
      const checksum = internetChecksum(words);
      expect(checksum).toBe(0xb1e6); // Known result
    });

    it('should handle empty array', () => {
      const checksum = internetChecksum([]);
      expect(checksum).toBe(0xffff); // Complement of 0
    });

    it('should handle single word', () => {
      const checksum = internetChecksum([0x1234]);
      expect(checksum).toBeDefined();
    });

    it('should handle all zeros', () => {
      const checksum = internetChecksum([0x0000, 0x0000, 0x0000]);
      expect(checksum).toBe(0xffff);
    });

    it('should handle all ones', () => {
      const checksum = internetChecksum([0xffff, 0xffff]);
      expect(checksum).toBe(0x0000);
    });
  });

  describe('internetChecksumBytes', () => {
    it('should convert bytes to words and calculate checksum', () => {
      const bytes = [0x45, 0x00, 0x00, 0x3c];
      const checksum = internetChecksumBytes(bytes);
      expect(checksum).toBeDefined();
    });

    it('should handle odd number of bytes (padding with 0)', () => {
      const bytes = [0x12, 0x34, 0x56]; // 3 bytes
      const checksum = internetChecksumBytes(bytes);
      expect(checksum).toBeDefined();
    });

    it('should handle empty byte array', () => {
      const checksum = internetChecksumBytes([]);
      expect(checksum).toBe(0xffff);
    });

    it('should handle single byte', () => {
      const checksum = internetChecksumBytes([0xff]);
      expect(checksum).toBeDefined();
    });
  });
});

describe('CRC-32 (IEEE 802.3)', () => {
  describe('crc32', () => {
    it('should calculate CRC-32 for simple data', () => {
      const data = [0x01, 0x02, 0x03, 0x04];
      const crc = crc32(data);
      expect(crc).toBeDefined();
      expect(crc).toBeGreaterThanOrEqual(0);
      expect(crc).toBeLessThanOrEqual(0xffffffff);
    });

    it('should calculate CRC-32 for known test vector', () => {
      // "123456789" in ASCII
      const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
      const crc = crc32(data);
      expect(crc).toBe(0xcbf43926); // Known CRC-32 value
    });

    it('should handle empty data', () => {
      const crc = crc32([]);
      expect(crc).toBe(0xffffffff); // Initial value XOR 0xFFFFFFFF
    });

    it('should handle single byte', () => {
      const crc = crc32([0x00]);
      expect(crc).toBeDefined();
    });

    it('should produce different results for different data', () => {
      const crc1 = crc32([0x01, 0x02, 0x03]);
      const crc2 = crc32([0x03, 0x02, 0x01]);
      expect(crc1).not.toBe(crc2);
    });
  });
});

describe('CRC-16 (CCITT)', () => {
  describe('crc16', () => {
    it('should calculate CRC-16 for simple data', () => {
      const data = [0x01, 0x02, 0x03];
      const crc = crc16(data);
      expect(crc).toBeDefined();
      expect(crc).toBeGreaterThanOrEqual(0);
      expect(crc).toBeLessThanOrEqual(0xffff);
    });

    it('should calculate CRC-16 for known test vector', () => {
      // "123456789" in ASCII
      const data = [0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39];
      const crc = crc16(data);
      expect(crc).toBe(0x29b1); // Known CRC-16-CCITT value
    });

    it('should handle empty data', () => {
      const crc = crc16([]);
      expect(crc).toBe(0xffff);
    });

    it('should handle single byte', () => {
      const crc = crc16([0x42]);
      expect(crc).toBeDefined();
    });

    it('should produce different results for different data', () => {
      const crc1 = crc16([0x01, 0x02]);
      const crc2 = crc16([0x02, 0x01]);
      expect(crc1).not.toBe(crc2);
    });
  });
});

describe('Fletcher-16', () => {
  describe('fletcher16', () => {
    it('should calculate Fletcher-16 for simple data', () => {
      const data = [0x01, 0x02];
      const checksum = fletcher16(data);
      expect(checksum).toBeDefined();
      expect(checksum).toBeGreaterThanOrEqual(0);
      expect(checksum).toBeLessThanOrEqual(0xffff);
    });

    it('should calculate Fletcher-16 for known test case', () => {
      // Test vector: [0x01, 0x02]
      // sum1 = (0 + 1) % 255 = 1
      // sum2 = (0 + 1) % 255 = 1
      // sum1 = (1 + 2) % 255 = 3
      // sum2 = (1 + 3) % 255 = 4
      // Result: (4 << 8) | 3 = 0x0403
      const data = [0x01, 0x02];
      const checksum = fletcher16(data);
      expect(checksum).toBe(0x0403);
    });

    it('should handle empty data', () => {
      const checksum = fletcher16([]);
      expect(checksum).toBe(0x0000);
    });

    it('should handle single byte', () => {
      const checksum = fletcher16([0x05]);
      expect(checksum).toBeDefined();
    });

    it('should handle large values with modulo', () => {
      // Test that modulo 255 works correctly
      const data = Array(300).fill(0xff);
      const checksum = fletcher16(data);
      expect(checksum).toBeGreaterThanOrEqual(0);
      expect(checksum).toBeLessThanOrEqual(0xffff);
    });
  });
});

describe('Parity and LRC', () => {
  describe('parityBit', () => {
    it('should return 0 for even parity (no bits set)', () => {
      const parity = parityBit([0b00000000]);
      expect(parity).toBe(0);
    });

    it('should return 1 for odd parity (1 bit set)', () => {
      const parity = parityBit([0b00000001]);
      expect(parity).toBe(1);
    });

    it('should return 0 for even parity (2 bits set)', () => {
      const parity = parityBit([0b00000011]);
      expect(parity).toBe(0);
    });

    it('should return 1 for odd parity (5 bits set)', () => {
      const parity = parityBit([0b10110101]); // 5 bits
      expect(parity).toBe(1);
    });

    it('should handle multiple bytes', () => {
      // 0b11110000 = 4 bits, 0b00001111 = 4 bits => 8 bits total (even)
      const parity = parityBit([0b11110000, 0b00001111]);
      expect(parity).toBe(0);
    });

    it('should handle empty array', () => {
      const parity = parityBit([]);
      expect(parity).toBe(0);
    });
  });

  describe('longitudinalRedundancyCheck', () => {
    it('should calculate LRC as XOR of all bytes', () => {
      const data = [0x02, 0x30, 0x31, 0x03];
      const lrc = longitudinalRedundancyCheck(data);
      // 0x02 ^ 0x30 ^ 0x31 ^ 0x03 = 0x00
      expect(lrc).toBe(0x00);
    });

    it('should return 0 for XOR of identical pairs', () => {
      const data = [0x55, 0x55];
      const lrc = longitudinalRedundancyCheck(data);
      expect(lrc).toBe(0x00);
    });

    it('should return input for single byte', () => {
      const data = [0x42];
      const lrc = longitudinalRedundancyCheck(data);
      expect(lrc).toBe(0x42);
    });

    it('should handle empty array', () => {
      const lrc = longitudinalRedundancyCheck([]);
      expect(lrc).toBe(0x00);
    });

    it('should handle all zeros', () => {
      const lrc = longitudinalRedundancyCheck([0x00, 0x00, 0x00]);
      expect(lrc).toBe(0x00);
    });

    it('should handle all 0xFF', () => {
      const lrc = longitudinalRedundancyCheck([0xff, 0xff]);
      expect(lrc).toBe(0x00);
    });
  });

  describe('verifyParity', () => {
    it('should verify correct even parity', () => {
      const data = [0b00000011]; // 2 bits (even)
      expect(verifyParity(data, 0)).toBe(true);
    });

    it('should verify correct odd parity', () => {
      const data = [0b00000001]; // 1 bit (odd)
      expect(verifyParity(data, 1)).toBe(true);
    });

    it('should reject incorrect parity', () => {
      const data = [0b00000001]; // 1 bit (odd)
      expect(verifyParity(data, 0)).toBe(false);
    });
  });

  describe('verifyLRC', () => {
    it('should verify correct LRC (XOR = 0)', () => {
      // Message + LRC byte that makes XOR = 0
      const data = [0x12, 0x34, 0x56];
      const lrc = longitudinalRedundancyCheck(data);
      const dataWithLRC = [...data, lrc];
      expect(verifyLRC(dataWithLRC)).toBe(true);
    });

    it('should reject incorrect LRC', () => {
      const data = [0x12, 0x34, 0x56, 0x99]; // Wrong LRC
      expect(verifyLRC(data)).toBe(false);
    });

    it('should handle empty array', () => {
      expect(verifyLRC([])).toBe(true); // XOR of nothing = 0
    });
  });
});

describe('Edge Cases and Robustness', () => {
  it('should handle maximum values', () => {
    const maxBytes = Array(100).fill(0xff);

    expect(() => internetChecksumBytes(maxBytes)).not.toThrow();
    expect(() => crc32(maxBytes)).not.toThrow();
    expect(() => crc16(maxBytes)).not.toThrow();
    expect(() => fletcher16(maxBytes)).not.toThrow();
    expect(() => parityBit(maxBytes)).not.toThrow();
    expect(() => longitudinalRedundancyCheck(maxBytes)).not.toThrow();
  });

  it('should handle minimum values (all zeros)', () => {
    const zeroBytes = Array(100).fill(0x00);

    expect(() => internetChecksumBytes(zeroBytes)).not.toThrow();
    expect(() => crc32(zeroBytes)).not.toThrow();
    expect(() => crc16(zeroBytes)).not.toThrow();
    expect(() => fletcher16(zeroBytes)).not.toThrow();
    expect(() => parityBit(zeroBytes)).not.toThrow();
    expect(() => longitudinalRedundancyCheck(zeroBytes)).not.toThrow();
  });

  it('should produce consistent results', () => {
    const data = [0x12, 0x34, 0x56, 0x78];

    // Same input should produce same output
    expect(crc32(data)).toBe(crc32(data));
    expect(crc16(data)).toBe(crc16(data));
    expect(fletcher16(data)).toBe(fletcher16(data));
    expect(parityBit(data)).toBe(parityBit(data));
    expect(longitudinalRedundancyCheck(data)).toBe(
      longitudinalRedundancyCheck(data)
    );
  });
});

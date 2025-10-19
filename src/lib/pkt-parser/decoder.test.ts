/**
 * Unit tests for Packet Tracer 7+ decoder
 */

import { describe, it, expect } from 'vitest';
import {
  encryptPacketTracer7,
  decryptPacketTracer7,
  detectPacketTracerVersion,
} from './decoder';

describe('Packet Tracer 7+ Decoder', () => {
  describe('encrypt/decrypt roundtrip', () => {
    it('should encrypt and decrypt small XML correctly', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';

      const encrypted = encryptPacketTracer7(xml);
      expect(encrypted.length).toBeGreaterThan(0);

      const decrypted = decryptPacketTracer7(encrypted);
      expect(decrypted).toBe(xml);
    });

    it('should encrypt and decrypt medium XML correctly', () => {
      const xml = `<PACKETTRACER5 VERSION="7.3">
  <NETWORK>
    <DEVICE name="Router0" type="router">
      <INTERFACE name="FastEthernet0/0" ip="192.168.1.1" mask="255.255.255.0"/>
    </DEVICE>
    <DEVICE name="Switch0" type="switch">
      <INTERFACE name="FastEthernet0/1"/>
    </DEVICE>
  </NETWORK>
</PACKETTRACER5>`;

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);
      expect(decrypted).toBe(xml);
    });

    it('should encrypt and decrypt large XML correctly', () => {
      // Generate a larger XML with many devices
      const devices = Array.from(
        { length: 50 },
        (_, i) => `    <DEVICE name="Device${i}" type="router">
      <INTERFACE name="Eth0" ip="192.168.${i}.1" mask="255.255.255.0"/>
    </DEVICE>`
      ).join('\n');

      const xml = `<PACKETTRACER5 VERSION="7.3">
  <NETWORK>
${devices}
  </NETWORK>
</PACKETTRACER5>`;

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);
      expect(decrypted).toBe(xml);
    });

    it('should handle XML with special characters', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK desc="Test &amp; &lt;special&gt; chars \u00e9\u00e0\u00fc"></NETWORK></PACKETTRACER5>';

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);
      expect(decrypted).toBe(xml);
    });

    it('should handle minimal XML', () => {
      const xml = '<ROOT/>';

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);
      expect(decrypted).toBe(xml);
    });

    it('should handle empty XML content', () => {
      const xml = '<PACKETTRACER5></PACKETTRACER5>';

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);
      expect(decrypted).toBe(xml);
    });
  });

  describe('encryption properties', () => {
    it('should produce different ciphertext for different XML', () => {
      const xml1 =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';
      const xml2 =
        '<PACKETTRACER5 VERSION="8.0"><NETWORK></NETWORK></PACKETTRACER5>';

      const encrypted1 = encryptPacketTracer7(xml1);
      const encrypted2 = encryptPacketTracer7(xml2);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should produce deterministic encryption', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';

      const encrypted1 = encryptPacketTracer7(xml);
      const encrypted2 = encryptPacketTracer7(xml);

      // With fixed keys/nonce, encryption is deterministic
      expect(encrypted1).toEqual(encrypted2);
    });

    it('should produce encrypted data larger than original (due to compression, tag, etc.)', () => {
      const xml = '<ROOT/>'; // 7 bytes

      const encrypted = encryptPacketTracer7(xml);

      // Should be larger due to: compression overhead + 16-byte tag + size prefix
      expect(encrypted.length).toBeGreaterThan(xml.length);
    });
  });

  describe('authentication', () => {
    it('should detect tampered ciphertext', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';

      const encrypted = encryptPacketTracer7(xml);

      // Tamper with a byte in the middle
      encrypted[(encrypted.length / 2) | 0] ^= 0xff;

      const decrypted = decryptPacketTracer7(encrypted);

      // Authentication should fail
      expect(decrypted).toBeNull();
    });

    it('should detect tampered tag', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';

      const encrypted = encryptPacketTracer7(xml);

      // Tamper with last byte (part of authentication tag after deobfuscation)
      encrypted[encrypted.length - 1] ^= 0x01;

      const decrypted = decryptPacketTracer7(encrypted);

      // Authentication should fail
      expect(decrypted).toBeNull();
    });

    it('should detect truncated data', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';

      const encrypted = encryptPacketTracer7(xml);

      // Truncate last 10 bytes
      const truncated = encrypted.slice(0, -10);

      const decrypted = decryptPacketTracer7(truncated);

      // Should fail (either authentication or decompression)
      expect(decrypted).toBeNull();
    });
  });

  describe('version detection', () => {
    it('should detect PT 7+ format', () => {
      const xml =
        '<PACKETTRACER5 VERSION="7.3"><NETWORK></NETWORK></PACKETTRACER5>';
      const encrypted = encryptPacketTracer7(xml);

      const version = detectPacketTracerVersion(encrypted);
      expect(version).toBe('7+');
    });

    it('should detect PT 5.x format (simulated)', () => {
      // Simulate PT 5.x by creating data with zlib magic bytes after XOR
      const length = 100;
      const data = new Uint8Array(length);

      // Set bytes so that after XOR with (length - i), we get zlib headers
      data[4] = 0x78 ^ (length - 4); // Zlib magic byte 1
      data[5] = 0x9c ^ (length - 5); // Zlib magic byte 2

      const version = detectPacketTracerVersion(data);
      expect(version).toBe('5.x');
    });

    it('should detect PT 5.x format with alternate zlib header', () => {
      const length = 100;
      const data = new Uint8Array(length);

      data[4] = 0x78 ^ (length - 4);
      data[5] = 0xda ^ (length - 5); // Alternate zlib compression level

      const version = detectPacketTracerVersion(data);
      expect(version).toBe('5.x');
    });

    it('should default to PT 7+ for ambiguous data', () => {
      const data = new Uint8Array(100).fill(0xff);

      const version = detectPacketTracerVersion(data);
      expect(version).toBe('7+');
    });
  });

  describe('edge cases', () => {
    it('should handle very small encrypted data', () => {
      const xml = 'X'; // Single character

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);

      expect(decrypted).toBe(xml);
    });

    it('should handle XML with newlines and whitespace', () => {
      const xml = `
      <PACKETTRACER5 VERSION="7.3">
        <NETWORK>
        </NETWORK>
      </PACKETTRACER5>
      `;

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);

      expect(decrypted).toBe(xml);
    });

    it('should handle XML with CDATA sections', () => {
      const xml = '<ROOT><![CDATA[Some <unescaped> & data]]></ROOT>';

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);

      expect(decrypted).toBe(xml);
    });

    it('should handle UTF-8 encoded XML', () => {
      const xml =
        '<PACKETTRACER5 desc="\u4e2d\u6587 \u65e5\u672c\u8a9e \ud55c\uae00 \u0420\u0443\u0441\u0441\u043a\u0438\u0439"/>';

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);

      expect(decrypted).toBe(xml);
    });
  });

  describe('compression efficiency', () => {
    it('should compress repetitive XML well', () => {
      // Very repetitive content should compress well
      const repetitive = '<DEVICE name="Router0"/>\n'.repeat(100);
      const xml = `<NETWORK>${repetitive}</NETWORK>`;

      const encrypted = encryptPacketTracer7(xml);

      // With good compression, encrypted size should be much smaller than original
      // (accounting for encryption overhead of ~16 bytes for tag)
      expect(encrypted.length).toBeLessThan(xml.length * 0.5);
    });

    it('should handle incompressible data', () => {
      // Random-looking data doesn't compress well
      const random = Array.from({ length: 500 }, () =>
        String.fromCharCode(Math.floor(Math.random() * 26) + 65)
      ).join('');
      const xml = `<DATA>${random}</DATA>`;

      const encrypted = encryptPacketTracer7(xml);
      const decrypted = decryptPacketTracer7(encrypted);

      expect(decrypted).toBe(xml);
    });
  });
});

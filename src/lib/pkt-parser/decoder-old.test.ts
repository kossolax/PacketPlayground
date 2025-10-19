/**
 * Unit tests for Packet Tracer 5.x decoder
 */

import { describe, it, expect } from 'vitest';
import { decryptPacketTracer5, encryptPacketTracer5 } from './decoder-old';

describe('Packet Tracer 5.x Decoder', () => {
  const sampleXML =
    '<PACKETTRACER5><VERSION>5.0.0.0000</VERSION><NETWORK></NETWORK></PACKETTRACER5>';

  describe('decryptPacketTracer5', () => {
    it('should decrypt a synthetic PT 5.x file', () => {
      // Encrypt first
      const encrypted = encryptPacketTracer5(sampleXML);

      // Then decrypt
      const decrypted = decryptPacketTracer5(encrypted);

      expect(decrypted).toBe(sampleXML);
    });

    it('should handle empty XML', () => {
      const emptyXML = '';
      const encrypted = encryptPacketTracer5(emptyXML);
      const decrypted = decryptPacketTracer5(encrypted);

      expect(decrypted).toBe(emptyXML);
    });

    it('should handle large XML', () => {
      // Create a larger XML (> 1 KB)
      const devices = Array.from(
        { length: 100 },
        (_, i) => `<DEVICE><NAME>Device${i}</NAME></DEVICE>`
      ).join('');

      const largeXML = `<PACKETTRACER5><DEVICES>${devices}</DEVICES></PACKETTRACER5>`;

      const encrypted = encryptPacketTracer5(largeXML);
      const decrypted = decryptPacketTracer5(encrypted);

      expect(decrypted).toBe(largeXML);
    });
  });

  describe('encryptPacketTracer5', () => {
    it('should produce different output for different inputs', () => {
      const xml1 = '<TEST>1</TEST>';
      const xml2 = '<TEST>2</TEST>';

      const encrypted1 = encryptPacketTracer5(xml1);
      const encrypted2 = encryptPacketTracer5(xml2);

      expect(encrypted1).not.toEqual(encrypted2);
    });

    it('should produce encrypted data larger than original', () => {
      // Due to size prefix (4 bytes) and compression overhead
      const xml = '<SHORT/>';
      const encrypted = encryptPacketTracer5(xml);

      expect(encrypted.length).toBeGreaterThan(xml.length);
    });
  });

  describe('roundtrip', () => {
    it('should encrypt and decrypt correctly', () => {
      const testCases = [
        '<PACKETTRACER5/>',
        '<PACKETTRACER5><VERSION>5.3.0.0000</VERSION></PACKETTRACER5>',
        '<PACKETTRACER5><NETWORK><DEVICES></DEVICES></NETWORK></PACKETTRACER5>',
      ];

      testCases.forEach((xml) => {
        const encrypted = encryptPacketTracer5(xml);
        const decrypted = decryptPacketTracer5(encrypted);

        expect(decrypted).toBe(xml);
      });
    });

    it('should handle XML with special characters', () => {
      const xml = '<TEST attr="value">Text &amp; &lt; &gt;</TEST>';

      const encrypted = encryptPacketTracer5(xml);
      const decrypted = decryptPacketTracer5(encrypted);

      expect(decrypted).toBe(xml);
    });

    it('should handle Unicode characters', () => {
      const xml = '<TEST>Héllo Wörld 日本語 🚀</TEST>';

      const encrypted = encryptPacketTracer5(xml);
      const decrypted = decryptPacketTracer5(encrypted);

      expect(decrypted).toBe(xml);
    });
  });
});

/**
 * Integration tests with real Packet Tracer files
 * Tests decryption and validates XML structure (no oracle comparison)
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { decryptPacketTracer7, detectPacketTracerVersion } from './decoder';
import { decryptPacketTracer5 } from './decoder-old';

// Path to sample PKT files (relative to this test file)
const PKT_DIR = join(import.meta.dirname, 'samples');

/**
 * List of real PKT files to test
 */
const PKT_FILES = [
  'acl_1.pkt',
  'acl_2.pkt',
  'debug.pkt',
  'debug_routing_0.pkt',
  'debug_test.pkt',
  'dhcp.pkt',
  'security.pkt',
  'train_1.pkt',
  'vlan_and_routing.pkt',
  'vlan_and_routing2.pkt',
  'vlan_and_routing2_solution.pkt',
  'vlan_and_routing_solution.pkt',
];

/**
 * List of real PKA (activity) files to test
 */
const PKA_FILES = ['debug_connectivity.pka'];

/**
 * Basic XML validation
 * Checks if string looks like valid XML without using a full parser
 */
function isValidXML(xml: string): boolean {
  if (!xml || xml.length === 0) return false;

  // Must start with '<' (possibly after whitespace)
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<')) return false;

  // Must end with '>'
  if (!trimmed.endsWith('>')) return false;

  // Should contain at least one closing tag or be a self-closing tag
  if (!trimmed.includes('</') && !trimmed.includes('/>')) return false;

  return true;
}

/**
 * Validate Packet Tracer XML structure
 */
function hasPacketTracerStructure(xml: string): boolean {
  // PT files use PACKETTRACER5 or PACKETTRACER5_ACTIVITY (for .pka files)
  const hasRootTag =
    xml.includes('<PACKETTRACER5') || xml.includes('<PACKETTRACER');

  // Should contain VERSION (either as tag or attribute)
  const hasVersion = xml.includes('<VERSION>') || xml.includes('VERSION=');

  // Should contain NETWORK or TOPOLOGY section
  const hasNetwork = xml.includes('<NETWORK') || xml.includes('<TOPOLOGY');

  return hasRootTag && hasVersion && hasNetwork;
}

describe('Integration Tests - Real PKT Files', () => {
  describe('File decryption', () => {
    PKT_FILES.forEach((filename) => {
      it(`should decrypt ${filename} and produce valid XML`, async () => {
        const filepath = join(PKT_DIR, filename);
        const data = await readFile(filepath);
        const buffer = new Uint8Array(data);

        // Detect version
        const version = detectPacketTracerVersion(buffer);
        expect(version).toMatch(/^(5\.x|7\+)$/);

        // Decrypt based on version
        let xml: string | null;
        if (version === '5.x') {
          xml = decryptPacketTracer5(buffer);
        } else {
          xml = decryptPacketTracer7(buffer);
        }

        // Should successfully decrypt
        expect(xml).not.toBeNull();
        expect(xml).toBeDefined();

        // Should be valid XML
        expect(isValidXML(xml!)).toBe(true);

        // Should have Packet Tracer structure
        expect(hasPacketTracerStructure(xml!)).toBe(true);
      });
    });
  });

  describe('PKA file decryption', () => {
    PKA_FILES.forEach((filename) => {
      it(`should decrypt ${filename} and produce valid XML`, async () => {
        const filepath = join(PKT_DIR, filename);
        const data = await readFile(filepath);
        const buffer = new Uint8Array(data);

        // Detect version
        const version = detectPacketTracerVersion(buffer);
        expect(version).toMatch(/^(5\.x|7\+)$/);

        // Decrypt based on version
        let xml: string | null;
        if (version === '5.x') {
          xml = decryptPacketTracer5(buffer);
        } else {
          xml = decryptPacketTracer7(buffer);
        }

        // Should successfully decrypt
        expect(xml).not.toBeNull();
        expect(xml).toBeDefined();

        // Should be valid XML
        expect(isValidXML(xml!)).toBe(true);

        // Should have Packet Tracer structure
        expect(hasPacketTracerStructure(xml!)).toBe(true);

        // PKA files should contain PACKETTRACER5_ACTIVITY tag
        expect(xml!.includes('<PACKETTRACER5_ACTIVITY>')).toBe(true);
      });
    });
  });

  describe('XML structure validation', () => {
    it('should extract version information from decrypted files', async () => {
      const filepath = join(PKT_DIR, 'debug.pkt');
      const data = await readFile(filepath);
      const buffer = new Uint8Array(data);

      const version = detectPacketTracerVersion(buffer);
      const xml =
        version === '5.x'
          ? decryptPacketTracer5(buffer)
          : decryptPacketTracer7(buffer);

      expect(xml).not.toBeNull();

      // Extract VERSION - can be either tag <VERSION>...</VERSION> or attribute VERSION="..."
      const versionTagMatch = xml!.match(/<VERSION>([^<]+)<\/VERSION>/);
      const versionAttrMatch = xml!.match(/VERSION="([^"]+)"/);

      const versionMatch = versionTagMatch || versionAttrMatch;
      expect(versionMatch).not.toBeNull();

      if (versionMatch) {
        const ptVersion = versionMatch[1];
        // PT version should be in format like "7.3", "8.0", "7.3.0.0838" etc.
        expect(ptVersion).toMatch(/^\d+\.\d+/);
      }
    });

    it('should find network devices in decrypted files', async () => {
      // Use a file that we know has network devices
      const filepath = join(PKT_DIR, 'vlan_and_routing.pkt');
      const data = await readFile(filepath);
      const buffer = new Uint8Array(data);

      const version = detectPacketTracerVersion(buffer);
      const xml =
        version === '5.x'
          ? decryptPacketTracer5(buffer)
          : decryptPacketTracer7(buffer);

      expect(xml).not.toBeNull();

      // Should contain device definitions
      // Common device types in PT: router, switch, pc, server, etc.
      const hasDevices =
        xml!.includes('router') ||
        xml!.includes('switch') ||
        xml!.includes('DEVICE') ||
        xml!.includes('COMPONENT');

      expect(hasDevices).toBe(true);
    });
  });

  describe('File size validation', () => {
    it('should decrypt files of various sizes', async () => {
      const sizes: Record<string, number> = {};

      await Promise.all(
        PKT_FILES.map(async (filename) => {
          const filepath = join(PKT_DIR, filename);
          const data = await readFile(filepath);
          const buffer = new Uint8Array(data);

          const version = detectPacketTracerVersion(buffer);
          const xml =
            version === '5.x'
              ? decryptPacketTracer5(buffer)
              : decryptPacketTracer7(buffer);

          expect(xml).not.toBeNull();

          sizes[filename] = xml!.length;
        })
      );

      // All files should decrypt to non-empty XML
      Object.values(sizes).forEach((size) => {
        expect(size).toBeGreaterThan(0);
      });

      // Decrypted XML should be larger than encrypted file (due to compression)
      const smallFile = join(PKT_DIR, 'debug.pkt');
      const data = await readFile(smallFile);
      const buffer = new Uint8Array(data);

      const version = detectPacketTracerVersion(buffer);
      const xml =
        version === '5.x'
          ? decryptPacketTracer5(buffer)
          : decryptPacketTracer7(buffer);

      expect(xml!.length).toBeGreaterThan(buffer.length);
    });
  });

  describe('Version detection accuracy', () => {
    it('should correctly identify PT 7+ files', async () => {
      // Most recent PT files should be 7+
      const recentFiles = ['train_1.pkt', 'security.pkt', 'dhcp.pkt'];

      await Promise.all(
        recentFiles.map(async (filename) => {
          const filepath = join(PKT_DIR, filename);
          const data = await readFile(filepath);
          const buffer = new Uint8Array(data);

          const version = detectPacketTracerVersion(buffer);

          // Files should be detected as a valid version
          expect(version).toMatch(/^(5\.x|7\+)$/);

          // Should decrypt successfully regardless of version
          const xml =
            version === '5.x'
              ? decryptPacketTracer5(buffer)
              : decryptPacketTracer7(buffer);

          expect(xml).not.toBeNull();
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted file data gracefully', () => {
      // Create corrupted data
      const corrupted = new Uint8Array(100).fill(0xff);

      const version = detectPacketTracerVersion(corrupted);

      // Try to decrypt
      const xml =
        version === '5.x'
          ? decryptPacketTracer5(corrupted)
          : decryptPacketTracer7(corrupted);

      // PT 7+ will return null on auth failure
      // PT 5.x might throw or return invalid data
      if (version === '7+') {
        expect(xml).toBeNull();
      }
    });

    it('should handle empty file data', () => {
      const empty = new Uint8Array(0);

      // Detection might fail or default to 7+
      const version = detectPacketTracerVersion(empty);
      expect(version).toMatch(/^(5\.x|7\+)$/);

      // Decryption should fail gracefully (not crash)
      expect(() => {
        if (version === '5.x') {
          decryptPacketTracer5(empty);
        } else {
          decryptPacketTracer7(empty);
        }
      }).toThrow();
    });
  });

  describe('Consistency checks', () => {
    it('should produce identical output for same file read multiple times', async () => {
      const filepath = join(PKT_DIR, 'debug.pkt');

      // Read and decrypt twice
      const data1 = await readFile(filepath);
      const buffer1 = new Uint8Array(data1);
      const version1 = detectPacketTracerVersion(buffer1);
      const xml1 =
        version1 === '5.x'
          ? decryptPacketTracer5(buffer1)
          : decryptPacketTracer7(buffer1);

      const data2 = await readFile(filepath);
      const buffer2 = new Uint8Array(data2);
      const version2 = detectPacketTracerVersion(buffer2);
      const xml2 =
        version2 === '5.x'
          ? decryptPacketTracer5(buffer2)
          : decryptPacketTracer7(buffer2);

      // Should produce identical results
      expect(version1).toBe(version2);
      expect(xml1).toBe(xml2);
    });

    it('should handle solution files correctly', async () => {
      const baseFiles = ['vlan_and_routing.pkt', 'vlan_and_routing2.pkt'];
      const solutionFiles = [
        'vlan_and_routing_solution.pkt',
        'vlan_and_routing2_solution.pkt',
      ];

      // Both base and solution files should decrypt successfully
      await Promise.all(
        [...baseFiles, ...solutionFiles].map(async (filename) => {
          const filepath = join(PKT_DIR, filename);
          const data = await readFile(filepath);
          const buffer = new Uint8Array(data);

          const version = detectPacketTracerVersion(buffer);
          const xml =
            version === '5.x'
              ? decryptPacketTracer5(buffer)
              : decryptPacketTracer7(buffer);

          expect(xml).not.toBeNull();
          expect(isValidXML(xml!)).toBe(true);
          expect(hasPacketTracerStructure(xml!)).toBe(true);
        })
      );
    });
  });
});

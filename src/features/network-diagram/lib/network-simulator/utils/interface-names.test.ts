import { describe, it, expect } from 'vitest';
import {
  toShortName,
  toFullName,
  normalizeInterfaceName,
  parseInterfaceName,
} from './interface-names';

describe('interface-names utilities', () => {
  describe('toShortName', () => {
    it('should convert full interface names to short format', () => {
      expect(toShortName('GigabitEthernet0/0')).toBe('gig0/0');
      expect(toShortName('FastEthernet1/0')).toBe('fa1/0');
      expect(toShortName('Ethernet2/0')).toBe('eth2/0');
      expect(toShortName('Serial3/0/0')).toBe('se3/0/0');
      expect(toShortName('Loopback0')).toBe('lo0');
    });

    it('should handle names that are already short', () => {
      expect(toShortName('gig0/0')).toBe('gig0/0');
      expect(toShortName('fa1/0')).toBe('fa1/0');
      expect(toShortName('eth2/0')).toBe('eth2/0');
    });

    it('should strip erroneous eth prefix from full names', () => {
      expect(toShortName('ethGigabitEthernet0/0')).toBe('gig0/0');
      expect(toShortName('ethFastEthernet1/0')).toBe('fa1/0');
    });

    it('should handle names with spaces', () => {
      expect(toShortName('GigabitEthernet 0/0')).toBe('gig0/0');
      expect(toShortName('FastEthernet 1/0')).toBe('fa1/0');
    });

    it('should handle Port-channel', () => {
      expect(toShortName('Port-channel1')).toBe('po1');
    });

    it('should lowercase unknown interface types', () => {
      expect(toShortName('Unknown0/0')).toBe('unknown0/0');
    });
  });

  describe('toFullName', () => {
    it('should convert short interface names to full format', () => {
      expect(toFullName('gig0/0')).toBe('GigabitEthernet0/0');
      expect(toFullName('fa1/0')).toBe('FastEthernet1/0');
      expect(toFullName('eth2/0')).toBe('Ethernet2/0');
      expect(toFullName('se3/0/0')).toBe('Serial3/0/0');
      expect(toFullName('lo0')).toBe('Loopback0');
    });

    it('should handle alternative shortcuts', () => {
      expect(toFullName('gi0/0')).toBe('GigabitEthernet0/0');
      expect(toFullName('s3/0/0')).toBe('Serial3/0/0');
      expect(toFullName('e2/0')).toBe('Ethernet2/0');
    });

    it('should handle Port-channel', () => {
      expect(toFullName('po1')).toBe('Port-channel1');
    });

    it('should return unknown names as-is', () => {
      expect(toFullName('unknown0/0')).toBe('unknown0/0');
    });

    it('should return full names as-is', () => {
      expect(toFullName('GigabitEthernet0/0')).toBe('GigabitEthernet0/0');
    });
  });

  describe('normalizeInterfaceName', () => {
    it('should convert short names to full format for internal storage', () => {
      expect(normalizeInterfaceName('gig0/0')).toBe('GigabitEthernet0/0');
      expect(normalizeInterfaceName('fa1/0')).toBe('FastEthernet1/0');
    });

    it('should keep full names as-is', () => {
      expect(normalizeInterfaceName('GigabitEthernet0/0')).toBe(
        'GigabitEthernet0/0'
      );
      expect(normalizeInterfaceName('FastEthernet1/0')).toBe('FastEthernet1/0');
    });

    it('should remove spaces', () => {
      expect(normalizeInterfaceName('gig 0/0')).toBe('GigabitEthernet0/0');
      expect(normalizeInterfaceName('fast ethernet 1/0')).toBe(
        'FastEthernet1/0'
      );
    });

    it('should handle alternative shortcuts', () => {
      expect(normalizeInterfaceName('gi0/0')).toBe('GigabitEthernet0/0');
      expect(normalizeInterfaceName('s3/0/0')).toBe('Serial3/0/0');
    });
  });

  describe('parseInterfaceName', () => {
    it('should parse short interface types', () => {
      expect(parseInterfaceName('gig', '0/0')).toBe('GigabitEthernet0/0');
      expect(parseInterfaceName('fa', '1/0')).toBe('FastEthernet1/0');
      expect(parseInterfaceName('se', '2/0/0')).toBe('Serial2/0/0');
    });

    it('should parse full interface type names', () => {
      expect(parseInterfaceName('gigabitethernet', '0/0')).toBe(
        'GigabitEthernet0/0'
      );
      expect(parseInterfaceName('fastethernet', '1/0')).toBe('FastEthernet1/0');
      expect(parseInterfaceName('serial', '2/0/0')).toBe('Serial2/0/0');
    });

    it('should parse partial interface type names', () => {
      expect(parseInterfaceName('gigabit', '0/0')).toBe('GigabitEthernet0/0');
      expect(parseInterfaceName('fast', '1/0')).toBe('FastEthernet1/0');
      expect(parseInterfaceName('ser', '2/0/0')).toBe('Serial2/0/0');
    });

    it('should handle alternative shortcuts', () => {
      expect(parseInterfaceName('gi', '0/0')).toBe('GigabitEthernet0/0');
      expect(parseInterfaceName('s', '2/0/0')).toBe('Serial2/0/0');
      expect(parseInterfaceName('e', '3/0')).toBe('Ethernet3/0');
    });

    it('should handle case-insensitive input', () => {
      expect(parseInterfaceName('GIG', '0/0')).toBe('GigabitEthernet0/0');
      expect(parseInterfaceName('FA', '1/0')).toBe('FastEthernet1/0');
      expect(parseInterfaceName('GigabitEthernet', '0/0')).toBe(
        'GigabitEthernet0/0'
      );
    });

    it('should use prefix as-is for unknown types', () => {
      expect(parseInterfaceName('unknown', '0/0')).toBe('unknown0/0');
    });
  });

  describe('Round-trip conversions', () => {
    it('should convert between short and full names consistently', () => {
      const fullNames = [
        'GigabitEthernet0/0',
        'FastEthernet1/0',
        'Serial2/0/0',
        'Loopback0',
      ];

      fullNames.forEach((fullName) => {
        const shortName = toShortName(fullName);
        const backToFull = toFullName(shortName);
        expect(backToFull).toBe(fullName);
      });
    });

    it('should normalize and convert consistently', () => {
      const inputs = ['gig0/0', 'fa1/0', 'se2/0/0', 'lo0'];

      inputs.forEach((input) => {
        const normalized = normalizeInterfaceName(input);
        const backToShort = toShortName(normalized);
        expect(backToShort).toBe(input);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle single digit ports', () => {
      expect(toShortName('GigabitEthernet0')).toBe('gig0');
      expect(toFullName('gig0')).toBe('GigabitEthernet0');
    });

    it('should handle multi-level ports', () => {
      expect(toShortName('GigabitEthernet0/1/2')).toBe('gig0/1/2');
      expect(toFullName('gig0/1/2')).toBe('GigabitEthernet0/1/2');
    });

    it('should handle malformed names gracefully', () => {
      expect(toShortName('')).toBe('');
      expect(toShortName('invalid')).toBe('invalid');
      expect(toFullName('')).toBe('');
    });
  });
});

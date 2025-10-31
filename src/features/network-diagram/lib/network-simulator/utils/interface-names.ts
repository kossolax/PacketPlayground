/**
 * Interface name normalization utilities
 * Handles conversion between full Cisco names and short display names
 */

// Cisco interface name shortcuts (IOS standard)
const INTERFACE_SHORTCUTS: Record<string, string> = {
  GigabitEthernet: 'gig',
  FastEthernet: 'fa',
  Ethernet: 'eth',
  Serial: 'se',
  Loopback: 'lo',
  Vlan: 'vl',
  'Port-channel': 'po',
  Tunnel: 'tu',
  Modem: 'mo',
};

// Reverse mapping for parsing (includes alternative shortcuts)
const SHORTCUT_TO_FULL: Record<string, string> = {
  gig: 'GigabitEthernet',
  gi: 'GigabitEthernet',
  fa: 'FastEthernet',
  eth: 'Ethernet',
  e: 'Ethernet',
  se: 'Serial',
  s: 'Serial',
  lo: 'Loopback',
  vl: 'Vlan',
  po: 'Port-channel',
  tu: 'Tunnel',
  mo: 'Modem',
};

/**
 * Convert interface name to short Cisco format
 * @param name - Interface name (full or short format)
 * @returns Short format name (e.g., "gig0/0", "fa1/0")
 *
 * @example
 * toShortName("GigabitEthernet0/0") // "gig0/0"
 * toShortName("FastEthernet1/0") // "fa1/0"
 * toShortName("ethGigabitEthernet0/0") // "gig0/0" (strips eth prefix)
 * toShortName("gig0/0") // "gig0/0" (already short)
 */
export function toShortName(name: string): string {
  // Remove common prefixes that shouldn't be there
  const cleaned = name.replace(/^eth([A-Z])/g, '$1'); // Remove "eth" prefix before capital letter

  // Match pattern: InterfaceType + optional space + port number
  const match = cleaned.match(/^([a-zA-Z-]+)\s?(\d+(?:\/\d+)*)$/);

  if (!match) return cleaned; // Return as-is if doesn't match pattern

  const [, type, port] = match;
  const typeLower = type.toLowerCase();

  // Check if already a short name
  if (Object.values(INTERFACE_SHORTCUTS).includes(typeLower)) {
    return `${typeLower}${port}`;
  }

  // Find matching full name (case-insensitive)
  const fullType = Object.keys(INTERFACE_SHORTCUTS).find(
    (key) => key.toLowerCase() === typeLower
  );

  if (fullType) {
    return `${INTERFACE_SHORTCUTS[fullType]}${port}`;
  }

  // Unknown type, return lowercase version
  return `${typeLower}${port}`;
}

/**
 * Convert short name to full Cisco format
 * @param shortName - Short interface name
 * @returns Full format name (e.g., "GigabitEthernet0/0")
 *
 * @example
 * toFullName("gig0/0") // "GigabitEthernet0/0"
 * toFullName("fa1/0") // "FastEthernet1/0"
 * toFullName("gi0/0") // "GigabitEthernet0/0"
 */
export function toFullName(shortName: string): string {
  const match = shortName.match(/^([a-zA-Z-]+)(\d+(?:\/\d+)*)$/);

  if (!match) return shortName;

  const [, shortType, port] = match;
  const fullType = SHORTCUT_TO_FULL[shortType.toLowerCase()];

  return fullType ? `${fullType}${port}` : shortName;
}

/**
 * Normalize interface name to internal format
 * Accepts both short and full names, returns consistent format
 * @param name - Interface name in any format
 * @returns Normalized internal format (full name)
 *
 * @example
 * normalizeInterfaceName("gig 0/0") // "GigabitEthernet0/0"
 * normalizeInterfaceName("fa1/0") // "FastEthernet1/0"
 * normalizeInterfaceName("GigabitEthernet0/0") // "GigabitEthernet0/0"
 */
export function normalizeInterfaceName(name: string): string {
  // Remove extra spaces
  const cleaned = name.replace(/\s+/g, '');

  // Try to convert to full name (for storage)
  const match = cleaned.match(/^([a-zA-Z-]+)(\d+(?:\/\d+)*)$/);
  if (!match) return cleaned;

  const [, type, port] = match;
  const fullType = SHORTCUT_TO_FULL[type.toLowerCase()];

  // If we found a mapping, use full name internally
  if (fullType) {
    return `${fullType}${port}`;
  }

  // Check if it's already a full name
  const matchingFull = Object.keys(INTERFACE_SHORTCUTS).find(
    (key) => key.toLowerCase() === type.toLowerCase()
  );

  if (matchingFull) {
    return `${matchingFull}${port}`;
  }

  // Otherwise keep as-is
  return cleaned;
}

/**
 * Parse interface name for terminal commands
 * Accepts partial names like "gig 0/0" or "fa0/0"
 * @param prefix - Interface type prefix (can be partial)
 * @param port - Port number (e.g., "0/0")
 * @returns Normalized internal format
 *
 * @example
 * parseInterfaceName("gig", "0/0") // "GigabitEthernet0/0"
 * parseInterfaceName("gigabit", "0/0") // "GigabitEthernet0/0"
 * parseInterfaceName("fa", "1/0") // "FastEthernet1/0"
 */
export function parseInterfaceName(prefix: string, port: string): string {
  const prefixLower = prefix.toLowerCase();

  // Try exact match on short names first
  if (SHORTCUT_TO_FULL[prefixLower]) {
    return `${SHORTCUT_TO_FULL[prefixLower]}${port}`;
  }

  // Try prefix match on full names
  const fullMatch = Object.keys(INTERFACE_SHORTCUTS).find((key) =>
    key.toLowerCase().startsWith(prefixLower)
  );

  if (fullMatch) {
    return `${fullMatch}${port}`;
  }

  // Try prefix match on short names
  const shortMatch = Object.entries(SHORTCUT_TO_FULL).find(([short]) =>
    short.startsWith(prefixLower)
  );

  if (shortMatch) {
    return `${shortMatch[1]}${port}`;
  }

  // Fallback: use prefix as-is
  return `${prefix}${port}`;
}

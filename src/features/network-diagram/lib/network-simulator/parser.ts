import { XMLParser } from 'fast-xml-parser';

/**
 * Parse XML string to JSON using fast-xml-parser (browser compatible)
 * Configured to match Python's xmltodict.parse behavior
 * @param xml - XML string to parse
 * @returns Promise resolving to parsed JSON object (unknown type, needs validation)
 */
export async function parseXMLToJSON(xml: string): Promise<unknown> {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false, // Keep attributes
      attributeNamePrefix: '', // No prefix for attributes (merge into object)
      textNodeName: '#text', // Key for text content
      parseAttributeValue: false, // Keep attribute values as strings
      trimValues: true, // Trim whitespace
      parseTagValue: false, // Keep all values as strings initially
      isArray: () => false, // Don't force arrays (matches xmltodict behavior)
    });

    const result = parser.parse(xml);
    return result;
  } catch (error) {
    throw new Error(
      `Failed to parse XML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Synchronous wrapper for parseXMLToJSON (for compatibility)
 * Note: This will throw if used in non-async context. Prefer async version.
 * @param _xml - XML string to parse (unused, prefixed with _ to satisfy linter)
 * @returns Parsed JSON object
 */
export function parseXMLToJSONSync(_xml: string): never {
  throw new Error(
    'Synchronous XML parsing not supported. Use parseXMLToJSON() instead.'
  );
}

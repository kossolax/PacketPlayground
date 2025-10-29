/**
 * Hook for network file upload and parsing
 * Handles PKT/PKA file upload, decryption, and XML parsing
 */

/* eslint-disable import/prefer-default-export */

import { useState, useCallback } from 'react';
import { decryptPacketTracerFile } from '../lib/pkt-parser';
import { parseXMLToJSON, Network } from '../lib/network-simulator';
import { getExampleById } from '../lib/network-simulator/examples';

interface UseNetworkFileState {
  network: Network | null;
  filename: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseNetworkFileReturn extends UseNetworkFileState {
  handleFileUpload: (file: File) => Promise<void>;
  clearNetwork: () => void;
  startEmpty: () => void;
  startWithExample: (exampleId: string) => void;
}

/**
 * Hook to handle network file upload and parsing
 */
export function useNetworkFile(): UseNetworkFileReturn {
  const [state, setState] = useState<UseNetworkFileState>({
    network: null,
    filename: null,
    isLoading: false,
    error: null,
  });

  const handleFileUpload = useCallback(async (file: File) => {
    setState({
      network: null,
      filename: file.name,
      isLoading: true,
      error: null,
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Decrypt PKT/PKA file to XML
      const xmlString = decryptPacketTracerFile(uint8Array);

      // Parse XML to JSON
      const json = await parseXMLToJSON(xmlString);

      // Create Network instance from JSON (like Angular)
      const network = Network.fromPacketTracer(json);

      setState({
        network,
        filename: file.name,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        network: null,
        filename: file.name,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    }
  }, []);

  const clearNetwork = useCallback(() => {
    setState({
      network: null,
      filename: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const startEmpty = useCallback(() => {
    // Create empty network
    const emptyNetwork = new Network();

    setState({
      network: emptyNetwork,
      filename: 'Empty Diagram',
      isLoading: false,
      error: null,
    });
  }, []);

  const startWithExample = useCallback(async (exampleId: string) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const example = getExampleById(exampleId);

      if (!example) {
        throw new Error(`Example with ID "${exampleId}" not found`);
      }

      if (!example.available) {
        throw new Error(`Example "${example.name}" is not yet available`);
      }

      // Create network from example (handle both sync and async)
      const network = await example.createNetwork();

      setState({
        network,
        filename: example.name,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        network: null,
        filename: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load example',
      });
    }
  }, []);

  return {
    ...state,
    handleFileUpload,
    clearNetwork,
    startEmpty,
    startWithExample,
  };
}

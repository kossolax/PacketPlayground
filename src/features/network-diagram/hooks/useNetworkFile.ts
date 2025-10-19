/**
 * Hook for network file upload and parsing
 * Handles PKT/PKA file upload, decryption, and XML parsing
 */

/* eslint-disable import/prefer-default-export */

import { useState, useCallback } from 'react';
import { decryptPacketTracerFile } from '@/lib/pkt-parser';
import {
  parsePacketTracerXML,
  type NetworkTopology,
} from '@/lib/network-simulator';

interface UseNetworkFileState {
  topology: NetworkTopology | null;
  filename: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseNetworkFileReturn extends UseNetworkFileState {
  handleFileUpload: (file: File) => Promise<void>;
  clearTopology: () => void;
  startEmpty: () => void;
}

/**
 * Hook to handle network file upload and parsing
 */
export function useNetworkFile(): UseNetworkFileReturn {
  const [state, setState] = useState<UseNetworkFileState>({
    topology: null,
    filename: null,
    isLoading: false,
    error: null,
  });

  const handleFileUpload = useCallback(async (file: File) => {
    setState({
      topology: null,
      filename: file.name,
      isLoading: true,
      error: null,
    });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const xmlString = decryptPacketTracerFile(uint8Array);

      const topology = parsePacketTracerXML(xmlString);

      setState({
        topology,
        filename: file.name,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      setState({
        topology: null,
        filename: file.name,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    }
  }, []);

  const clearTopology = useCallback(() => {
    setState({
      topology: null,
      filename: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const startEmpty = useCallback(() => {
    setState({
      topology: {
        devices: [],
        links: [],
        metadata: {
          filename: 'Empty Diagram',
        },
      },
      filename: 'Empty Diagram',
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    handleFileUpload,
    clearTopology,
    startEmpty,
  };
}

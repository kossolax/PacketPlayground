import { useState, useCallback } from 'react';
import { parseXMLToJSON } from '../lib/network-simulator/parser';
import { Network } from '../lib/network-simulator/network';
import { GenericNode } from '../lib/network-simulator/nodes/generic';
import { Link } from '../lib/network-simulator/layers/physical';

/**
 * Hook for parsing Packet Tracer XML and managing network state
 * React equivalent of Angular's NetworkService
 */
// eslint-disable-next-line import/prefer-default-export
export function useNetworkParser() {
  const [network, setNetwork] = useState<Network | null>(null);
  const [selectedNode, setSelectedNode] = useState<GenericNode | Link | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Parse XML string to Network instance
   * Equivalent to Angular's decode() + Network.fromPacketTracer()
   * @param xml - XML string from PKT/PKA file
   */
  const parseNetwork = useCallback(
    async (xml: string): Promise<Network | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Parse XML to JSON (replaces Python's xmltodict.parse)
        const json = await parseXMLToJSON(xml);

        // Convert JSON to Network instance (Angular's Network.fromPacketTracer)
        const parsedNetwork = Network.fromPacketTracer(json);

        setNetwork(parsedNetwork);
        setIsLoading(false);

        return parsedNetwork;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }
    },
    []
  );

  /**
   * Clear network state
   */
  const clearNetwork = useCallback(() => {
    setNetwork(null);
    setSelectedNode(null);
    setError(null);
  }, []);

  /**
   * Select a node or link (Angular's setNode)
   */
  const selectNode = useCallback((node: GenericNode | Link | null) => {
    setSelectedNode(node);
  }, []);

  return {
    // State
    network,
    selectedNode,
    isLoading,
    error,

    // Actions
    parseNetwork,
    clearNetwork,
    selectNode,
    setNetwork, // Expose for direct manipulation if needed
  };
}

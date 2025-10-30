/**
 * Network Editor Context
 * Provides cable selection state to all components
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { CableType } from '../lib/network-simulator/cables';

interface NetworkEditorContextValue {
  selectedCable: CableType | null;
  connectionInProgress: { sourceNodeId: string; cableType: CableType } | null;
}

const NetworkEditorContext = createContext<NetworkEditorContextValue | null>(
  null
);

export function NetworkEditorProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: NetworkEditorContextValue;
}) {
  return (
    <NetworkEditorContext.Provider value={value}>
      {children}
    </NetworkEditorContext.Provider>
  );
}

export function useNetworkEditorContext() {
  const context = useContext(NetworkEditorContext);
  if (!context) {
    // Return default values if context is not available
    return { selectedCable: null, connectionInProgress: null };
  }
  return context;
}

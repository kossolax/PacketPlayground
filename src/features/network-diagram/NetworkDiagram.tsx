/**
 * Network Diagram Page
 * Main page for network topology visualization and editing
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import { toast } from 'sonner';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import { useSidebar } from '@/components/ui/sidebar';
import FileUploader from './components/FileUploader';
import DeviceToolbar from './components/DeviceToolbar';
import CableToolbar from './components/CableToolbar';
import NetworkCanvas from './components/NetworkCanvas';
import SimulationControls from './components/SimulationControls';
import { useNetworkFile } from './hooks/useNetworkFile';
import { useNetworkEditor } from './hooks/useNetworkEditor';
import useSimulationNetwork from './hooks/useSimulationNetwork';
import { NetworkSimulationProvider } from './context/NetworkSimulationContext';
import { NetworkEditorProvider } from './contexts/NetworkEditorContext';
import type { DeviceType, Network } from './lib/network-simulator';
import type { CableUIType } from './lib/network-simulator/cables';

/**
 * NetworkDiagramContent - Inner component that uses ReactFlow hooks
 * Must be a child of ReactFlowProvider
 */
interface NetworkDiagramContentProps {
  network: Network | null;
  filename: string | null;
  isLoading: boolean;
  error: string | null;
  handleFileUpload: (file: File) => Promise<void>;
  startEmpty: () => void;
  startWithExample: (exampleId: string) => void;
}

function NetworkDiagramContent({
  network,
  filename,
  isLoading,
  error,
  handleFileUpload,
  startEmpty,
  startWithExample,
}: NetworkDiagramContentProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const { setOpen, isMobile } = useSidebar();
  const hasCollapsedSidebar = useRef(false);
  const lastLoadedFilename = useRef<string | null>(null);

  // Create simulation objects from network
  const { simulation } = useSimulationNetwork(network);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    loadTopology,
    addDevice,
    selectedCable,
    selectCable,
    clearCableSelection,
    connectionInProgress,
    startConnection,
    cancelConnection,
  } = useNetworkEditor(simulation);

  useEffect(() => {
    if (network) {
      // Only load if this is a new file to avoid double loading
      if (lastLoadedFilename.current !== filename) {
        loadTopology(network);
        toast.success(`Loaded: ${filename}`);
        lastLoadedFilename.current = filename;
      }

      // Collapse sidebar on desktop when network is loaded (only once)
      if (!isMobile && !hasCollapsedSidebar.current) {
        setOpen(false);
        hasCollapsedSidebar.current = true;
      }
    } else {
      // Reset when returning to upload state
      hasCollapsedSidebar.current = false;
      lastLoadedFilename.current = null;
    }
  }, [network, filename, loadTopology, isMobile, setOpen]);

  useEffect(() => {
    if (error) {
      toast.error(`Error: ${error}`);
    }
  }, [error]);

  const handleDeviceAdded = () => {
    setSelectedDevice(null);
  };

  const handleCableSelect = (cableType: CableUIType) => {
    // Toggle cable: deselect if same cable clicked, otherwise select new cable
    if (selectedCable === cableType) {
      clearCableSelection();
    } else {
      selectCable(cableType);
    }
    setSelectedDevice(null); // Deselect device when cable is selected
  };

  // Show upload zone when no network is loaded
  if (!network) {
    return (
      <div className="h-full flex flex-col">
        <SimulationControls />
        <FileUploader
          onFileSelect={handleFileUpload}
          onStartEmpty={startEmpty}
          onStartWithExample={startWithExample}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Show diagram editor when network is loaded
  return (
    <div className="h-full flex flex-col">
      <SimulationControls />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex flex-col h-full justify-start bg-muted/50 border-r border-border">
          <DeviceToolbar
            onDeviceSelect={(deviceType) => {
              setSelectedDevice(deviceType);
              clearCableSelection(); // Deselect cable when device is selected
            }}
            selectedDevice={selectedDevice}
          />
          <CableToolbar
            onCableSelect={handleCableSelect}
            selectedCable={selectedCable}
          />
        </div>

        <NetworkEditorProvider value={{ selectedCable, connectionInProgress }}>
          <NetworkCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onAddDevice={addDevice}
            selectedDevice={selectedDevice}
            onDeviceAdded={handleDeviceAdded}
            network={simulation}
            selectedCable={selectedCable}
            connectionInProgress={connectionInProgress}
            onStartConnection={startConnection}
            onCancelConnection={cancelConnection}
          />
        </NetworkEditorProvider>
      </div>

      {selectedDevice && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
          Click on the canvas to place a {selectedDevice}
        </div>
      )}

      {selectedCable && !connectionInProgress && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
          Click on a device to start connecting with {selectedCable} cable
        </div>
      )}

      {connectionInProgress && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
          Click on another device to complete connection (ESC to cancel)
        </div>
      )}
    </div>
  );
}

/**
 * NetworkDiagram - Main page component
 * Wraps everything in ReactFlowProvider
 */
export default function NetworkDiagram() {
  const { setBreadcrumbs } = useBreadcrumb();
  const { exampleId } = useParams<{ exampleId?: string }>();

  useEffect(() => {
    setBreadcrumbs('Development', 'Network Diagram');
  }, [setBreadcrumbs]);

  const {
    network,
    filename,
    isLoading,
    error,
    handleFileUpload,
    startEmpty,
    startWithExample,
  } = useNetworkFile();

  // Auto-load example from URL parameter
  useEffect(() => {
    if (exampleId && !network && !isLoading) {
      startWithExample(exampleId);
    }
  }, [exampleId, network, isLoading, startWithExample]);

  return (
    <ReactFlowProvider>
      <NetworkSimulationProvider>
        <NetworkDiagramContent
          network={network}
          filename={filename}
          isLoading={isLoading}
          error={error}
          handleFileUpload={handleFileUpload}
          startEmpty={startEmpty}
          startWithExample={startWithExample}
        />
      </NetworkSimulationProvider>
    </ReactFlowProvider>
  );
}

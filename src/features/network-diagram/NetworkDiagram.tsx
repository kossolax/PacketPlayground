/**
 * Network Diagram Page
 * Main page for network topology visualization and editing
 */

import { useState, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { toast } from 'sonner';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import { useSidebar } from '@/components/ui/sidebar';
import FileUploader from './components/FileUploader';
import DeviceToolbar from './components/DeviceToolbar';
import NetworkCanvas from './components/NetworkCanvas';
import { useNetworkFile } from './hooks/useNetworkFile';
import { useNetworkEditor } from './hooks/useNetworkEditor';
import type { DeviceType, NetworkTopology } from './lib/network-simulator';

/**
 * NetworkDiagramContent - Inner component that uses ReactFlow hooks
 * Must be a child of ReactFlowProvider
 */
interface NetworkDiagramContentProps {
  topology: NetworkTopology | null;
  filename: string | null;
  isLoading: boolean;
  error: string | null;
  handleFileUpload: (file: File) => Promise<void>;
  startEmpty: () => void;
}

function NetworkDiagramContent({
  topology,
  filename,
  isLoading,
  error,
  handleFileUpload,
  startEmpty,
}: NetworkDiagramContentProps) {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const { setOpen, isMobile } = useSidebar();
  const hasCollapsedSidebar = useRef(false);
  const lastLoadedFilename = useRef<string | null>(null);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    loadTopology,
    addDevice,
  } = useNetworkEditor();

  useEffect(() => {
    if (topology) {
      // Only load if this is a new file to avoid double loading
      if (lastLoadedFilename.current !== filename) {
        loadTopology(topology);
        toast.success(`Loaded: ${filename}`);
        lastLoadedFilename.current = filename;
      }

      // Collapse sidebar on desktop when topology is loaded (only once)
      if (!isMobile && !hasCollapsedSidebar.current) {
        setOpen(false);
        hasCollapsedSidebar.current = true;
      }
    } else {
      // Reset when returning to upload state
      hasCollapsedSidebar.current = false;
      lastLoadedFilename.current = null;
    }
  }, [topology, filename, loadTopology, isMobile, setOpen]);

  useEffect(() => {
    if (error) {
      toast.error(`Error: ${error}`);
    }
  }, [error]);

  const handleDeviceAdded = () => {
    setSelectedDevice(null);
  };

  // Show upload zone when no topology is loaded
  if (!topology) {
    return (
      <div className="h-full flex flex-col">
        <FileUploader
          onFileSelect={handleFileUpload}
          onStartEmpty={startEmpty}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Show diagram editor when topology is loaded
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <DeviceToolbar
          onDeviceSelect={setSelectedDevice}
          selectedDevice={selectedDevice}
        />

        <NetworkCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onAddDevice={addDevice}
          selectedDevice={selectedDevice}
          onDeviceAdded={handleDeviceAdded}
        />
      </div>

      {selectedDevice && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
          Click on the canvas to place a {selectedDevice}
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

  useEffect(() => {
    setBreadcrumbs('Development', 'Network Diagram');
  }, [setBreadcrumbs]);

  const { topology, filename, isLoading, error, handleFileUpload, startEmpty } =
    useNetworkFile();

  return (
    <ReactFlowProvider>
      <NetworkDiagramContent
        topology={topology}
        filename={filename}
        isLoading={isLoading}
        error={error}
        handleFileUpload={handleFileUpload}
        startEmpty={startEmpty}
      />
    </ReactFlowProvider>
  );
}

/**
 * Network Diagram Page
 * Main page for network topology visualization and editing
 */

import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { toast } from 'sonner';
import { useBreadcrumb } from '@/hooks/use-breadcrumb';
import FileUploader from './components/FileUploader';
import DeviceToolbar from './components/DeviceToolbar';
import NetworkCanvas from './components/NetworkCanvas';
import { useNetworkFile } from './hooks/useNetworkFile';
import { useNetworkEditor } from './hooks/useNetworkEditor';
import type { DeviceType } from '@/lib/network-simulator';

export default function NetworkDiagram() {
  const [selectedDevice, setSelectedDevice] = useState<DeviceType | null>(null);
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs('Development', 'Network Diagram');
  }, [setBreadcrumbs]);

  const { topology, filename, isLoading, error, handleFileUpload, startEmpty } =
    useNetworkFile();

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
      loadTopology(topology);
      toast.success(`Loaded: ${filename}`);
    }
  }, [topology, filename, loadTopology]);

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

        <ReactFlowProvider>
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
        </ReactFlowProvider>
      </div>

      {selectedDevice && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg">
          Click on the canvas to place a {selectedDevice}
        </div>
      )}
    </div>
  );
}

/**
 * Device Configuration Dialog
 * Main dialog for device configuration with tabs for Config, Service, and Terminal
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GenericNode } from '../lib/network-simulator';
import { ServerHost } from '../lib/network-simulator/nodes/server';
import ConfigTab from './config/ConfigTab';
import ServiceTab from './config/ServiceTab';
import TerminalTab from './config/TerminalTab';

interface DeviceConfigDialogProps {
  node: GenericNode | null;
  onClose: () => void;
}

export default function DeviceConfigDialog({
  node,
  onClose,
}: DeviceConfigDialogProps) {
  const isServer = node instanceof ServerHost;

  return (
    <Dialog open={node !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl sm:max-w-4xl h-[42rem] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{node?.name || 'Device Configuration'}</DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="config"
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="w-full justify-start">
            <TabsTrigger className="w-40 flex-initial" value="config">
              Configuration
            </TabsTrigger>
            {isServer && (
              <TabsTrigger className="w-40 flex-initial" value="service">
                Service
              </TabsTrigger>
            )}
            <TabsTrigger className="w-40 flex-initial" value="terminal">
              Terminal
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto">
            <TabsContent value="config" className="h-full">
              {node && <ConfigTab node={node} />}
            </TabsContent>

            {isServer && (
              <TabsContent value="service" className="h-full">
                {node && <ServiceTab node={node as ServerHost} />}
              </TabsContent>
            )}

            <TabsContent value="terminal" className="h-full">
              {node && <TerminalTab node={node} />}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Config Tab Component
 * Displays vertical tabs for General settings and Interface configuration
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { GenericNode } from '../../lib/network-simulator';
import { Node } from '../../lib/network-simulator/nodes/generic';
import type { Interface } from '../../lib/network-simulator/layers/datalink';

interface ConfigTabProps {
  node: GenericNode;
}

export default function ConfigTab({ node }: ConfigTabProps) {
  // Check if node has interfaces (is instance of Node)
  const hasInterfaces = node instanceof Node;
  const interfaces = hasInterfaces
    ? (node as Node<Interface>).getInterfaces()
    : [];

  return (
    <Tabs className="flex w-full flex-row gap-6 h-full" defaultValue="general">
      <TabsList className="flex h-full flex-col items-start justify-start">
        <TabsTrigger className="w-40 shrink-0 grow-0 justify-start" value="general">
          General
        </TabsTrigger>
        {interfaces.map((interfaceName) => (
          <TabsTrigger
            key={interfaceName}
            className="w-40 shrink-0 grow-0 justify-start"
            value={interfaceName}
          >
            {interfaceName}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="flex-1 overflow-auto">
        <TabsContent value="general">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="mb-2 font-semibold text-lg">General Settings</h3>
            <p className="text-muted-foreground text-sm">
              Device name: {node.name}
            </p>
            <p className="text-muted-foreground text-sm">
              Device type: {node.type}
            </p>
            <p className="text-muted-foreground text-sm mt-4">
              Configuration forms will be implemented here.
            </p>
          </div>
        </TabsContent>

        {interfaces.map((interfaceName) => (
          <TabsContent key={interfaceName} value={interfaceName}>
            <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
              <h3 className="mb-2 font-semibold text-lg">{interfaceName}</h3>
              <p className="text-muted-foreground text-sm">
                Interface configuration will be implemented here.
              </p>
              <p className="text-muted-foreground text-sm mt-4">
                This will include: On/Off toggle, Speed selection, MAC address,
                IP address & subnet mask, DHCP toggle, etc.
              </p>
            </div>
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

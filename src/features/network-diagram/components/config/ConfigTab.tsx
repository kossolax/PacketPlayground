/**
 * Config Tab Component
 * Displays vertical tabs for General settings and Interface configuration
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GenericNode } from '../../lib/network-simulator';
import { Node } from '../../lib/network-simulator/nodes/generic';
import { HardwareInterface } from '../../lib/network-simulator/layers/datalink';
import GeneralTab from './GeneralTab';
import InterfaceTab from './InterfaceTab';

interface ConfigTabProps {
  node: GenericNode;
}

export default function ConfigTab({ node }: ConfigTabProps) {
  // Check if node has interfaces (is instance of Node)
  const hasInterfaces = node instanceof Node;
  const interfaces = hasInterfaces
    ? (node as Node<HardwareInterface>).getInterfaces()
    : [];

  return (
    <Tabs className="flex w-full flex-row gap-6 h-full" defaultValue="general">
      <TabsList className="flex h-full flex-col items-start justify-start">
        <TabsTrigger
          className="w-40 shrink-0 grow-0 justify-start"
          value="general"
        >
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
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <GeneralTab node={node} />
            </CardContent>
          </Card>
        </TabsContent>

        {interfaces.map((interfaceName) => (
          <TabsContent key={interfaceName} value={interfaceName}>
            <InterfaceTab
              node={node as Node<HardwareInterface>}
              interfaceName={interfaceName}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

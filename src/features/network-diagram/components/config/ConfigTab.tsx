/**
 * Config Tab Component
 * Displays vertical tabs for General settings and Interface configuration
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { GenericNode } from '../../lib/network-simulator';
import { HardwareInterface } from '../../lib/network-simulator/layers/datalink';
import { Node } from '../../lib/network-simulator/nodes/generic';
import { RouterHost } from '../../lib/network-simulator/nodes/router';
import { SwitchHost } from '../../lib/network-simulator/nodes/switch';
import GeneralTab from './GeneralTab';
import InterfaceTab from './InterfaceTab';
import RoutingTab from './RoutingTab';
import VlanDatabaseTab from './VlanDatabaseTab';

interface ConfigTabProps {
  node: GenericNode;
}

export default function ConfigTab({ node }: ConfigTabProps) {
  // Check if node has interfaces (is instance of Node)
  const hasInterfaces = node instanceof Node;
  const interfaces = hasInterfaces
    ? (node as Node<HardwareInterface>).getInterfaces()
    : [];

  // Check if node is a router (for routing table)
  const isRouter = node instanceof RouterHost;

  // Check if node is a switch (for VLAN database)
  const isSwitchHost = node instanceof SwitchHost;

  return (
    <Tabs className="flex w-full flex-row gap-6 h-full" defaultValue="general">
      <TabsList className="flex h-full flex-col items-start justify-start">
        <TabsTrigger
          className="w-40 shrink-0 grow-0 justify-start"
          value="general"
        >
          General
        </TabsTrigger>
        {isSwitchHost && (
          <TabsTrigger
            className="w-40 shrink-0 grow-0 justify-start"
            value="vlan-database"
          >
            VLAN Database
          </TabsTrigger>
        )}
        {isRouter && (
          <TabsTrigger
            className="w-40 shrink-0 grow-0 justify-start"
            value="routage"
          >
            Routage
          </TabsTrigger>
        )}
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

      <ScrollArea className="flex-1 overflow-auto">
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

        {isSwitchHost && (
          <TabsContent value="vlan-database">
            <VlanDatabaseTab node={node as SwitchHost} />
          </TabsContent>
        )}

        {isRouter && (
          <TabsContent value="routage">
            <RoutingTab node={node as RouterHost} />
          </TabsContent>
        )}

        {interfaces.map((interfaceName) => (
          <TabsContent key={interfaceName} value={interfaceName}>
            <InterfaceTab
              node={node as Node<HardwareInterface>}
              interfaceName={interfaceName}
            />
          </TabsContent>
        ))}
      </ScrollArea>
    </Tabs>
  );
}

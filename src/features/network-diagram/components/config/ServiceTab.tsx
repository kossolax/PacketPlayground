/**
 * Service Tab Component
 * Displays service configuration for ServerHost (DHCP, DNS, etc.)
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ServerHost } from '../../lib/network-simulator/nodes/server';

interface ServiceTabProps {
  node: ServerHost;
}

export default function ServiceTab({ node }: ServiceTabProps) {
  return (
    <Tabs className="flex w-full flex-row gap-6 h-full" defaultValue="dhcp">
      <TabsList className="flex h-full flex-col items-start justify-start">
        <TabsTrigger className="w-40 shrink-0 grow-0 justify-start" value="dhcp">
          DHCP
        </TabsTrigger>
        <TabsTrigger className="w-40 shrink-0 grow-0 justify-start" value="dns">
          DNS
        </TabsTrigger>
        <TabsTrigger className="w-40 shrink-0 grow-0 justify-start" value="http">
          HTTP
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-auto">
        <TabsContent value="dhcp">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="mb-2 font-semibold text-lg">DHCP Server</h3>
            <p className="text-muted-foreground text-sm">Server: {node.name}</p>
            <p className="text-muted-foreground text-sm mt-4">
              DHCP server configuration will be implemented here.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              This will include: IP range, subnet mask, default gateway, DNS
              servers, lease time, etc.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="dns">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="mb-2 font-semibold text-lg">DNS Server</h3>
            <p className="text-muted-foreground text-sm">Server: {node.name}</p>
            <p className="text-muted-foreground text-sm mt-4">
              DNS server configuration will be implemented here.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              This will include: DNS records, forwarders, zones, etc.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="http">
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
            <h3 className="mb-2 font-semibold text-lg">HTTP Server</h3>
            <p className="text-muted-foreground text-sm">Server: {node.name}</p>
            <p className="text-muted-foreground text-sm mt-4">
              HTTP server configuration will be implemented here.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              This will include: Port, document root, virtual hosts, etc.
            </p>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}

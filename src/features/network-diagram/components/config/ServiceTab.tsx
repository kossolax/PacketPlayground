/**
 * Service Tab Component
 * Displays service configuration for ServerHost (DHCP, DNS, etc.) and SwitchHost (STP)
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServerHost } from '../../lib/network-simulator/nodes/server';
import { SwitchHost } from '../../lib/network-simulator/nodes/switch';
import DhcpServiceConfig from './DhcpServiceConfig';
import StpServiceConfig from './StpServiceConfig';

interface ServiceTabProps {
  node: ServerHost | SwitchHost;
}

export default function ServiceTab({ node }: ServiceTabProps) {
  const isServer = node instanceof ServerHost;
  const isSwitch = node instanceof SwitchHost;

  // Determine default tab based on device type
  const defaultTab = isServer ? 'dhcp' : 'stp';

  return (
    <Tabs
      className="flex w-full flex-row gap-6 h-full"
      defaultValue={defaultTab}
    >
      <TabsList className="flex h-full flex-col items-start justify-start">
        {isSwitch && (
          <TabsTrigger
            className="w-40 shrink-0 grow-0 justify-start"
            value="stp"
          >
            STP
          </TabsTrigger>
        )}
        {isServer && (
          <>
            <TabsTrigger
              className="w-40 shrink-0 grow-0 justify-start"
              value="dhcp"
            >
              DHCP
            </TabsTrigger>
            <TabsTrigger
              className="w-40 shrink-0 grow-0 justify-start"
              value="dns"
            >
              DNS
            </TabsTrigger>
            <TabsTrigger
              className="w-40 shrink-0 grow-0 justify-start"
              value="http"
            >
              HTTP
            </TabsTrigger>
          </>
        )}
      </TabsList>

      <div className="flex-1 overflow-auto">
        {isSwitch && (
          <TabsContent value="stp">
            <StpServiceConfig node={node} />
          </TabsContent>
        )}
        {isServer && (
          <>
            <TabsContent value="dhcp">
              <DhcpServiceConfig node={node} />
            </TabsContent>

            <TabsContent value="dns">
              <Card>
                <CardHeader>
                  <CardTitle>DNS Server Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    DNS server configuration will be implemented here.
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">
                    This will include: DNS records, forwarders, zones, etc.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="http">
              <Card>
                <CardHeader>
                  <CardTitle>HTTP Server Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    HTTP server configuration will be implemented here.
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">
                    This will include: Port, document root, virtual hosts, etc.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </div>
    </Tabs>
  );
}

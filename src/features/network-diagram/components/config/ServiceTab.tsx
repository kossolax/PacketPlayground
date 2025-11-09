/**
 * Service Tab Component
 * Displays service configuration for ServerHost (DHCP, DNS, etc.), SwitchHost (STP), and RouterHost (FHRP)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { Network } from '../../lib/network-simulator';
import { ServerHost } from '../../lib/network-simulator/nodes/server';
import { SwitchHost } from '../../lib/network-simulator/nodes/switch';
import { RouterHost } from '../../lib/network-simulator/nodes/router';
import DhcpServiceConfig from './DhcpServiceConfig';
import StpServiceConfig from './StpServiceConfig';
import FhrpServiceConfig from './FhrpServiceConfig';
import RipServiceConfig from './RipServiceConfig';
import OspfServiceConfig from './OspfServiceConfig';

interface ServiceTabProps {
  node: ServerHost | SwitchHost | RouterHost;
  network?: Network | null;
}

export default function ServiceTab({ node, network }: ServiceTabProps) {
  const isServer = node instanceof ServerHost;
  const isSwitch = node instanceof SwitchHost;
  const isRouter = node instanceof RouterHost;

  // Determine default tab based on device type
  let defaultTab = 'stp';
  if (isServer) defaultTab = 'dhcp';
  if (isRouter) defaultTab = 'rip';

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
        {isRouter && (
          <>
            <TabsTrigger
              className="w-40 shrink-0 grow-0 justify-start"
              value="fhrp"
            >
              FHRP
            </TabsTrigger>
            <TabsTrigger
              className="w-40 shrink-0 grow-0 justify-start"
              value="rip"
            >
              RIP
            </TabsTrigger>
            <TabsTrigger
              className="w-40 shrink-0 grow-0 justify-start"
              value="ospf"
            >
              OSPF
            </TabsTrigger>
          </>
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

      <ScrollArea className="flex-1 overflow-auto">
        {isSwitch && (
          <TabsContent value="stp">
            <StpServiceConfig node={node} network={network} />
          </TabsContent>
        )}
        {isRouter && (
          <>
            <TabsContent value="fhrp">
              <FhrpServiceConfig node={node as RouterHost} network={network} />
            </TabsContent>
            <TabsContent value="rip">
              <RipServiceConfig node={node as RouterHost} network={network} />
            </TabsContent>
            <TabsContent value="ospf">
              <OspfServiceConfig node={node as RouterHost} network={network} />
            </TabsContent>
          </>
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
      </ScrollArea>
    </Tabs>
  );
}

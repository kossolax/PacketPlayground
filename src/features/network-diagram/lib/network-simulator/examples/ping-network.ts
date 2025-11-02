import { IPAddress } from '../address';
import { Link } from '../layers/physical';
import { Network } from '../network';
import { RouterHost } from '../nodes/router';
import { ComputerHost } from '../nodes/server';

/**
 * Creates a Ping (ICMP) demonstration topology.
 *
 * This example shows three routers connected in a line, demonstrating
 * ICMP Echo Request/Reply (ping) functionality across multiple hops.
 *
 * Topology:
 *   PC-A --- Router-A --- Router-B --- Router-C --- PC-B
 */
export default function createPingNetworkExample(): Network {
  const network = new Network();

  // Create three routers
  const routerA = new RouterHost('Router-A', 2);
  routerA.guid = 'router-a-example';
  routerA.x = 150;
  routerA.y = 200;
  routerA.getInterface(0).up();
  routerA.getInterface(0).setNetAddress(new IPAddress('10.0.0.1'));
  routerA.getInterface(1).up();
  routerA.getInterface(1).setNetAddress(new IPAddress('10.0.1.1'));

  const routerB = new RouterHost('Router-B', 2);
  routerB.guid = 'router-b-example';
  routerB.x = 300;
  routerB.y = 200;
  routerB.getInterface(0).up();
  routerB.getInterface(0).setNetAddress(new IPAddress('10.0.1.2'));
  routerB.getInterface(1).up();
  routerB.getInterface(1).setNetAddress(new IPAddress('10.0.2.1'));

  const routerC = new RouterHost('Router-C', 2);
  routerC.guid = 'router-c-example';
  routerC.x = 450;
  routerC.y = 200;
  routerC.getInterface(0).up();
  routerC.getInterface(0).setNetAddress(new IPAddress('10.0.2.2'));
  routerC.getInterface(1).up();
  routerC.getInterface(1).setNetAddress(new IPAddress('10.0.3.1'));

  // Create two end PCs
  const pcA = new ComputerHost('PC-A', 'pc', 1);
  pcA.guid = 'pc-a-example';
  pcA.x = 50;
  pcA.y = 200;
  pcA.getInterface(0).up();
  pcA.getInterface(0).setNetAddress(new IPAddress('10.0.0.10'));
  pcA.gateway = new IPAddress('10.0.0.1');

  const pcB = new ComputerHost('PC-B', 'pc', 1);
  pcB.guid = 'pc-b-example';
  pcB.x = 550;
  pcB.y = 200;
  pcB.getInterface(0).up();
  pcB.getInterface(0).setNetAddress(new IPAddress('10.0.3.10'));
  pcB.gateway = new IPAddress('10.0.3.1');

  // Add to network
  network.nodes[routerA.guid] = routerA;
  network.nodes[routerB.guid] = routerB;
  network.nodes[routerC.guid] = routerC;
  network.nodes[pcA.guid] = pcA;
  network.nodes[pcB.guid] = pcB;

  // Create links
  const linkPcARouterA = new Link(
    pcA.getFirstAvailableInterface()!,
    routerA.getFirstAvailableInterface()!,
    10
  );
  const linkRouterAB = new Link(
    routerA.getInterface(1),
    routerB.getInterface(0),
    10
  );
  const linkRouterBC = new Link(
    routerB.getInterface(1),
    routerC.getInterface(0),
    10
  );
  const linkRouterCPcB = new Link(
    routerC.getInterface(1),
    pcB.getFirstAvailableInterface()!,
    10
  );

  network.links.push(
    linkPcARouterA,
    linkRouterAB,
    linkRouterBC,
    linkRouterCPcB
  );

  // Configure routing tables for multi-hop ping
  // Router A
  routerA.addRoute(
    new IPAddress('10.0.2.0'),
    new IPAddress('255.255.255.0'),
    new IPAddress('10.0.1.2')
  );
  routerA.addRoute(
    new IPAddress('10.0.3.0'),
    new IPAddress('255.255.255.0'),
    new IPAddress('10.0.1.2')
  );

  // Router B
  routerB.addRoute(
    new IPAddress('10.0.0.0'),
    new IPAddress('255.255.255.0'),
    new IPAddress('10.0.1.1')
  );
  routerB.addRoute(
    new IPAddress('10.0.3.0'),
    new IPAddress('255.255.255.0'),
    new IPAddress('10.0.2.2')
  );

  // Router C
  routerC.addRoute(
    new IPAddress('10.0.0.0'),
    new IPAddress('255.255.255.0'),
    new IPAddress('10.0.2.1')
  );
  routerC.addRoute(
    new IPAddress('10.0.1.0'),
    new IPAddress('255.255.255.0'),
    new IPAddress('10.0.2.1')
  );

  return network;
}

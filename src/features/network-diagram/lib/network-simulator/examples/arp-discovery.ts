import { Network } from '../network';
import { ServerHost } from '../nodes/server';
import { SwitchHost } from '../nodes/switch';
import { Link } from '../layers/physical';
import { IPAddress, MacAddress } from '../address';

/**
 * Creates an ARP (Address Resolution Protocol) demonstration topology.
 *
 * This example shows how devices discover MAC addresses from IP addresses
 * using ARP requests and replies. All devices are on the same subnet.
 *
 * Topology:
 *   PC-A --\
 *   PC-B ---+--- Switch --- Server
 *   PC-C --/
 */
export default function createARPDiscoveryExample(): Network {
  const network = new Network();

  // Create Switch
  const switchDevice = new SwitchHost('Switch-1', 4, true);
  switchDevice.guid = 'switch-arp-example';
  switchDevice.x = 300;
  switchDevice.y = 200;
  switchDevice.getInterface(0).up();
  switchDevice.getInterface(1).up();
  switchDevice.getInterface(2).up();
  switchDevice.getInterface(3).up();

  // Create Server
  const server = new ServerHost('Server-1', 'server', 1);
  server.guid = 'server-arp-example';
  server.x = 500;
  server.y = 200;
  server.getInterface(0).up();
  server.getInterface(0).setNetAddress(new IPAddress('192.168.0.1'));
  server.getInterface(0).setMacAddress(new MacAddress('00:11:22:33:44:55'));

  // Create 3 PCs on the same subnet
  const pcA = new ServerHost('PC-A', 'pc', 1);
  pcA.guid = 'pc-a-arp-example';
  pcA.x = 100;
  pcA.y = 50;
  pcA.getInterface(0).up();
  pcA.getInterface(0).setNetAddress(new IPAddress('192.168.0.10'));
  pcA.getInterface(0).setMacAddress(new MacAddress('AA:BB:CC:DD:EE:01'));

  const pcB = new ServerHost('PC-B', 'pc', 1);
  pcB.guid = 'pc-b-arp-example';
  pcB.x = 100;
  pcB.y = 200;
  pcB.getInterface(0).up();
  pcB.getInterface(0).setNetAddress(new IPAddress('192.168.0.20'));
  pcB.getInterface(0).setMacAddress(new MacAddress('AA:BB:CC:DD:EE:02'));

  const pcC = new ServerHost('PC-C', 'pc', 1);
  pcC.guid = 'pc-c-arp-example';
  pcC.x = 100;
  pcC.y = 350;
  pcC.getInterface(0).up();
  pcC.getInterface(0).setNetAddress(new IPAddress('192.168.0.30'));
  pcC.getInterface(0).setMacAddress(new MacAddress('AA:BB:CC:DD:EE:03'));

  // Add to network
  network.nodes[switchDevice.guid] = switchDevice;
  network.nodes[server.guid] = server;
  network.nodes[pcA.guid] = pcA;
  network.nodes[pcB.guid] = pcB;
  network.nodes[pcC.guid] = pcC;

  // Create connections
  const linkServerSwitch = new Link(
    server.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );
  const linkPcA = new Link(
    pcA.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );
  const linkPcB = new Link(
    pcB.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );
  const linkPcC = new Link(
    pcC.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );

  network.links.push(linkServerSwitch, linkPcA, linkPcB, linkPcC);

  return network;
}

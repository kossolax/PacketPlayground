import { IPAddress } from '../address';
import { Link } from '../layers/physical';
import { Network } from '../network';
import { ComputerHost, ServerHost } from '../nodes/server';
import { SwitchHost } from '../nodes/switch';
import { DhcpPool } from '../services/dhcp';

/**
 * Creates a DHCP demonstration topology.
 *
 * This example shows a DHCP server providing IP addresses to multiple clients.
 * The server has a pool of addresses that it can assign automatically.
 *
 * Topology:
 *   Client-1 --\
 *   Client-2 ---+--- Switch --- DHCP Server
 *   Client-3 --/
 */
export default function createDHCPSetupExample(): Network {
  const network = new Network();

  // Create DHCP Server
  const server = new ServerHost('DHCP-Server', 'server', 1);
  server.guid = 'dhcp-server-example';
  server.x = 500;
  server.y = 200;
  server.getInterface(0).up();
  server.getInterface(0).setNetAddress(new IPAddress('192.168.1.1'));

  // Configure DHCP service
  const pool = new DhcpPool();
  pool.gatewayAddress = new IPAddress('192.168.1.1');
  pool.netmaskAddress = new IPAddress('255.255.255.0');
  pool.startAddress = new IPAddress('192.168.1.10');
  pool.endAddress = new IPAddress('192.168.1.250');

  server.services.dhcp.pools.push(pool);
  server.services.dhcp.Enable = true;

  // Create Switch
  const switchDevice = new SwitchHost('Switch-1', 4);
  switchDevice.guid = 'switch-example';
  switchDevice.x = 300;
  switchDevice.y = 200;
  switchDevice.getInterface(0).up();
  switchDevice.getInterface(1).up();
  switchDevice.getInterface(2).up();
  switchDevice.getInterface(3).up();

  // Create 3 client PCs (will request DHCP)
  const client1 = new ComputerHost('Client-1', 'pc', 1);
  client1.guid = 'client1-example';
  client1.x = 100;
  client1.y = 50;
  client1.getInterface(0).up();
  // Auto-negotiate address from DHCP
  client1.getInterface(0).AutoNegociateAddress = true;

  const client2 = new ServerHost('Client-2', 'pc', 1);
  client2.guid = 'client2-example';
  client2.x = 100;
  client2.y = 200;
  client2.getInterface(0).up();
  client2.getInterface(0).AutoNegociateAddress = true;

  const client3 = new ComputerHost('Client-3', 'pc', 1);
  client3.guid = 'client3-example';
  client3.x = 100;
  client3.y = 350;
  client3.getInterface(0).up();
  client3.getInterface(0).AutoNegociateAddress = true;

  // Add to network
  network.nodes[server.guid] = server;
  network.nodes[switchDevice.guid] = switchDevice;
  network.nodes[client1.guid] = client1;
  network.nodes[client2.guid] = client2;
  network.nodes[client3.guid] = client3;

  // Create connections
  const linkServerSwitch = new Link(
    server.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );
  const linkClient1 = new Link(
    client1.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );
  const linkClient2 = new Link(
    client2.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );
  const linkClient3 = new Link(
    client3.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10
  );

  network.links.push(linkServerSwitch, linkClient1, linkClient2, linkClient3);

  return network;
}

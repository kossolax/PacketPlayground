import { IPAddress } from '../address';
import type { Dot1QInterface } from '../layers/datalink';
import { Link } from '../layers/physical';
import { Network } from '../network';
import { ComputerHost } from '../nodes/server';
import { SwitchHost } from '../nodes/switch';
import { VlanMode } from '../protocols/ethernet';

/**
 * Creates a VLAN + Trunk (802.1Q) demonstration topology.
 *
 * This example demonstrates VLANs 10 and 20 with a trunk link between switches.
 * The trunk uses 802.1Q tagging to carry multiple VLANs over a single link.
 *
 * Topology:
 *   PC-A (VLAN 10) ---\
 *   PC-B (VLAN 20) --- Switch-1 === TRUNK === Switch-2 --- PC-C (VLAN 10)
 *                                                       \-- PC-D (VLAN 20)
 */
export default function createVLANTrunkExample(): Network {
  const network = new Network();

  // Create two switches
  const switch1 = new SwitchHost('Switch-1', 3, true);
  switch1.guid = 'switch1-vlan-example';
  switch1.x = 200;
  switch1.y = 200;
  switch1.getInterface(0).up(); // PC-A (VLAN 10)
  switch1.getInterface(1).up(); // PC-B (VLAN 20)
  switch1.getInterface(2).up(); // Trunk to Switch-2

  const switch2 = new SwitchHost('Switch-2', 3, true);
  switch2.guid = 'switch2-vlan-example';
  switch2.x = 500;
  switch2.y = 200;
  switch2.getInterface(0).up(); // Trunk from Switch-1
  switch2.getInterface(1).up(); // PC-C (VLAN 10)
  switch2.getInterface(2).up(); // PC-D (VLAN 20)

  // Configure Switch-1 ports
  // Port 0: Access VLAN 10
  const sw1Port0 = switch1.getInterface(0) as Dot1QInterface;
  sw1Port0.VlanMode = VlanMode.Access;
  sw1Port0.addVlan(10);

  // Port 1: Access VLAN 20
  const sw1Port1 = switch1.getInterface(1) as Dot1QInterface;
  sw1Port1.VlanMode = VlanMode.Access;
  sw1Port1.addVlan(20);

  // Port 2: Trunk (allows VLAN 10 and 20)
  const sw1Port2 = switch1.getInterface(2) as Dot1QInterface;
  sw1Port2.VlanMode = VlanMode.Trunk;
  sw1Port2.addVlan(10);
  sw1Port2.addVlan(20);

  // Configure Switch-2 ports
  // Port 0: Trunk (allows VLAN 10 and 20)
  const sw2Port0 = switch2.getInterface(0) as Dot1QInterface;
  sw2Port0.VlanMode = VlanMode.Trunk;
  sw2Port0.addVlan(10);
  sw2Port0.addVlan(20);

  // Port 1: Access VLAN 10
  const sw2Port1 = switch2.getInterface(1) as Dot1QInterface;
  sw2Port1.VlanMode = VlanMode.Access;
  sw2Port1.addVlan(10);

  // Port 2: Access VLAN 20
  const sw2Port2 = switch2.getInterface(2) as Dot1QInterface;
  sw2Port2.VlanMode = VlanMode.Access;
  sw2Port2.addVlan(20);

  // Create 4 PCs
  const pcA = new ComputerHost('PC-A', 'pc', 1);
  pcA.guid = 'pc-a-vlan-example';
  pcA.x = 50;
  pcA.y = 100;
  pcA.getInterface(0).up();
  pcA.getInterface(0).setNetAddress(new IPAddress('192.168.10.10'));

  const pcB = new ComputerHost('PC-B', 'pc', 1);
  pcB.guid = 'pc-b-vlan-example';
  pcB.x = 50;
  pcB.y = 300;
  pcB.getInterface(0).up();
  pcB.getInterface(0).setNetAddress(new IPAddress('192.168.20.10'));

  const pcC = new ComputerHost('PC-C', 'pc', 1);
  pcC.guid = 'pc-c-vlan-example';
  pcC.x = 650;
  pcC.y = 100;
  pcC.getInterface(0).up();
  pcC.getInterface(0).setNetAddress(new IPAddress('192.168.10.20'));

  const pcD = new ComputerHost('PC-D', 'pc', 1);
  pcD.guid = 'pc-d-vlan-example';
  pcD.x = 650;
  pcD.y = 300;
  pcD.getInterface(0).up();
  pcD.getInterface(0).setNetAddress(new IPAddress('192.168.20.20'));

  // Add to network
  network.nodes[switch1.guid] = switch1;
  network.nodes[switch2.guid] = switch2;
  network.nodes[pcA.guid] = pcA;
  network.nodes[pcB.guid] = pcB;
  network.nodes[pcC.guid] = pcC;
  network.nodes[pcD.guid] = pcD;

  // Create links
  const linkPcA = new Link(pcA.getFirstAvailableInterface()!, sw1Port0, 10);
  const linkPcB = new Link(pcB.getFirstAvailableInterface()!, sw1Port1, 10);
  const linkTrunk = new Link(sw1Port2, sw2Port0, 10); // Trunk link
  const linkPcC = new Link(pcC.getFirstAvailableInterface()!, sw2Port1, 10);
  const linkPcD = new Link(pcD.getFirstAvailableInterface()!, sw2Port2, 10);

  network.links.push(linkPcA, linkPcB, linkTrunk, linkPcC, linkPcD);

  return network;
}

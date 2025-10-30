import { Network } from '../network';
import { ServerHost } from '../nodes/server';
import { SwitchHost } from '../nodes/switch';
import { Link } from '../layers/physical';
import { IPAddress, MacAddress } from '../address';
import { EthernetInterface } from '../layers/datalink';
import { IPInterface } from '../layers/network';

/**
 * Custom PC Host with Fast Ethernet capability (100 Mbps max).
 * Overrides interface creation to use Fast Ethernet specs.
 */
class FastEthernetPC extends ServerHost {
  public override addInterface(name: string = ''): IPInterface {
    let interfaceName = name;
    if (interfaceName === '')
      interfaceName = `fa0/${Object.keys(this.interfaces).length}`;

    const ip = IPAddress.generateAddress();
    const mac = MacAddress.generateAddress();

    // Create Fast Ethernet interface: min=10, max=100
    const eth = new EthernetInterface(this, mac, interfaceName, 10, 100, true);
    const iface = new IPInterface(this, interfaceName, eth);
    iface.addNetAddress(ip);
    iface.addListener(this);

    this.interfaces[interfaceName] = iface;
    return iface;
  }
}

/**
 * Creates an Auto-Negotiation demonstration topology.
 *
 * This example demonstrates IEEE 802.3 auto-negotiation between devices
 * with different speed capabilities. The PC has Fast Ethernet (100 Mbps max)
 * while the switch has Gigabit Ethernet (1000 Mbps max). Auto-negotiation
 * will negotiate down to the highest common speed: 100 Mbps full duplex.
 *
 * Topology:
 *   PC (Fast Ethernet 10/100) --- Switch (Gigabit 10/100/1000)
 *
 * Expected result: Link negotiates to 100 Mbps full duplex
 */
export default function createAutoNegotiationDemo(): Network {
  const network = new Network();

  // Create PC with Fast Ethernet capability (10-100 Mbps)
  const pc = new FastEthernetPC('PC-FastEth', 'pc', 1);
  pc.guid = 'pc-autoneg-demo';
  pc.x = 100;
  pc.y = 200;

  // Configure PC network settings
  pc.getInterface(0).up();
  pc.getInterface(0).setNetAddress(new IPAddress('192.168.1.10'));
  pc.getInterface(0).setMacAddress(new MacAddress('AA:BB:CC:DD:EE:10'));

  // Create Switch with Gigabit capability (10-1000 Mbps) - default
  const switchDevice = new SwitchHost('Switch-GigEth', 2, false);
  switchDevice.guid = 'switch-autoneg-demo';
  switchDevice.x = 400;
  switchDevice.y = 200;

  // Bring up switch interfaces (they default to 10-1000 Mbps)
  switchDevice.getInterface(0).up();
  switchDevice.getInterface(1).up();

  // Add nodes to network
  network.nodes[pc.guid] = pc;
  network.nodes[switchDevice.guid] = switchDevice;

  // Create connection - auto-negotiation will occur when link is established
  const link = new Link(
    pc.getFirstAvailableInterface()!,
    switchDevice.getFirstAvailableInterface()!,
    10 // cable length in meters
  );

  network.links.push(link);

  return network;
}

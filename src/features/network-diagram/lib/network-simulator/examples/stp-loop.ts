import { MacAddress } from '../address';
import { Link } from '../layers/physical';
import { Network } from '../network';
import { ComputerHost } from '../nodes/server';
import { SwitchHost } from '../nodes/switch';

/**
 * Creates an STP (Spanning Tree Protocol) demonstration topology.
 *
 * This example creates a triangle of three switches, which forms a loop.
 * STP will automatically detect the loop and block one port to prevent
 * broadcast storms. The blocked port will be shown in orange.
 *
 * Topology:
 *     PC-1
 *      |
 *   Switch-A -------- Switch-B
 *      \               /
 *       \             /
 *        \           /
 *         Switch-C
 *              |
 *            PC-2
 */
export default function createSTPLoopExample(): Network {
  const network = new Network();

  // Create three switches in a triangle topology
  const switchA = new SwitchHost('Switch-A', 4, true); // 4 ports, STP enabled
  switchA.guid = 'switch-a-example';
  switchA.x = 200;
  switchA.y = 150;
  // Set lowest MAC to make it the root bridge
  switchA.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:01'));

  const switchB = new SwitchHost('Switch-B', 4, true);
  switchB.guid = 'switch-b-example';
  switchB.x = 500;
  switchB.y = 150;
  switchB.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:02'));

  const switchC = new SwitchHost('Switch-C', 4, true);
  switchC.guid = 'switch-c-example';
  switchC.x = 350;
  switchC.y = 400;
  switchC.getInterface(0).setMacAddress(new MacAddress('00:00:00:00:00:03'));

  // Create two PCs
  const pc1 = new ComputerHost('PC-1', 'pc', 1);
  pc1.guid = 'pc1-example';
  pc1.x = 200;
  pc1.y = 50;

  const pc2 = new ComputerHost('PC-2', 'pc', 1);
  pc2.guid = 'pc2-example';
  pc2.x = 350;
  pc2.y = 500;

  // Add all nodes to network
  network.nodes[switchA.guid] = switchA;
  network.nodes[switchB.guid] = switchB;
  network.nodes[switchC.guid] = switchC;
  network.nodes[pc1.guid] = pc1;
  network.nodes[pc2.guid] = pc2;

  // Create triangle topology (this creates a loop for STP to resolve)
  const linkAB = new Link(
    switchA.getFirstAvailableInterface()!,
    switchB.getFirstAvailableInterface()!,
    10
  );
  const linkBC = new Link(
    switchB.getFirstAvailableInterface()!,
    switchC.getFirstAvailableInterface()!,
    10
  );
  const linkCA = new Link(
    switchC.getFirstAvailableInterface()!,
    switchA.getFirstAvailableInterface()!,
    10
  );

  // Connect PCs to switches
  const linkPC1 = new Link(
    pc1.getFirstAvailableInterface()!,
    switchA.getFirstAvailableInterface()!,
    10
  );
  const linkPC2 = new Link(
    pc2.getFirstAvailableInterface()!,
    switchC.getFirstAvailableInterface()!,
    10
  );

  network.links.push(linkAB, linkBC, linkCA, linkPC1, linkPC2);

  // Bring up all interfaces to trigger STP negotiation
  [switchA, switchB, switchC, pc1, pc2].forEach((node) => {
    node.getInterfaces().forEach((ifaceName) => {
      const iface = node.getInterface(ifaceName);
      if (iface) {
        iface.up();
      }
    });
  });

  return network;
}

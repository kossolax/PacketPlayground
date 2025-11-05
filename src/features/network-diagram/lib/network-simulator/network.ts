import { Link } from './layers/physical';
import { GenericNode, NetworkHost } from './nodes/generic';
import { RouterHost } from './nodes/router';
import { ComputerHost, ServerHost } from './nodes/server';
import { SwitchHost } from './nodes/switch';
import { SpanningTreeProtocol } from './services/spanningtree';

/**
 * Network topology representation
 * Parses Packet Tracer XML (via JSON) and creates simulation objects
 */
// eslint-disable-next-line import/prefer-default-export
export class Network {
  public nodes: Record<string, GenericNode> = {};

  public links: Link[] = [];

  /**
   * Parse a port from the device structure and add it to the node
   * @param node - Target node to add interface to
   * @param json - Port JSON data
   * @param depth - Interface numbering depth (e.g., [0, 1] -> "0/1")
   */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this, @typescript-eslint/no-explicit-any
  private parsePort(node: GenericNode, json: any, depth: number[] = []): void {
    let name = '';

    if (json.TYPE === null) return;

    if (json.TYPE.endsWith('GigabitEthernet')) name = 'GigabitEthernet';
    else if (json.TYPE.endsWith('FastEthernet')) name = 'FastEthernet';
    else if (json.TYPE.endsWith('Ethernet')) name = 'Ethernet';
    else if (json.TYPE.endsWith('Serial')) name = 'Serial';
    else if (json.TYPE.endsWith('Modem')) name = 'Modem';
    else throw new Error(`Unknown port type: ${json.TYPE}`);

    name += depth.join('/');

    if (node instanceof SwitchHost || node instanceof NetworkHost) {
      node.addInterface(name);
    } else {
      throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Recursively parse MODULE hierarchy to extract interfaces
   * @param node - Target node to add interfaces to
   * @param json - Module JSON data
   * @param depth - Current depth in module hierarchy
   * @param first - Starting interface number
   */
  private parseModule(
    node: GenericNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: any,
    depth: number[] = [],
    first: number = 0
  ): void {
    // Parse PORT entries
    if (json.MODULE && json.MODULE.PORT) {
      if (json.MODULE.PORT instanceof Array) {
        let lastType = '';
        let lastId = first;

        for (let i = 0; i < json.MODULE.PORT.length; i += 1) {
          if (json.MODULE.PORT[i].TYPE !== lastType) lastId = first;
          lastType = json.MODULE.PORT[i].TYPE;

          const copy = depth.slice();
          copy.push(lastId);
          lastId += 1;
          this.parsePort(node, json.MODULE.PORT[i], copy);
        }
      } else {
        const copy = depth.slice();
        copy.push(first);
        this.parsePort(node, json.MODULE.PORT, copy);
      }
    }

    // Recursively parse SLOT entries
    if (json.MODULE && json.MODULE.SLOT) {
      if (json.MODULE.SLOT instanceof Array) {
        for (let i = 0; i < json.MODULE.SLOT.length; i += 1) {
          const copy = depth.slice();
          if (json.MODULE.SLOT[i].TYPE !== 'ePtHostModule') copy.push(i);
          this.parseModule(node, json.MODULE.SLOT[i], copy, first);
        }
      } else {
        const copy = depth.slice();
        if (json.MODULE.SLOT.TYPE !== 'ePtHostModule') copy.push(0);
        this.parseModule(node, json.MODULE.SLOT, copy, first);
      }
    }
  }

  /**
   * Parse PKT format (standard Packet Tracer save)
   * @param json - Parsed XML as JSON (PACKETTRACER5 node)
   * @returns Network instance with nodes and links
   */
  private static fromPKT(json: unknown): Network {
    const network = new Network();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>; // Cast du JSON pour accès dynamique

    // Parse devices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.NETWORK.DEVICES.DEVICE.map((i: Record<string, any>) => {
      let node: GenericNode | null = null;
      const key = i.ENGINE.SAVE_REF_ID;
      const x = i.WORKSPACE.LOGICAL.X;
      const y = i.WORKSPACE.LOGICAL.Y;

      const type = i.ENGINE.TYPE['#text'].toLowerCase();

      if (type === 'pc' || type === 'laptop') {
        node = new ComputerHost();
      } else if (type === 'server') {
        node = new ServerHost();
      } else if (type === 'router') {
        node = new RouterHost();
      } else if (type === 'switch') {
        node = new SwitchHost('', 0);
      } else if (type === 'hub') {
        node = new SwitchHost('', 0, SpanningTreeProtocol.None);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[Network] Skipping unknown device type: ${type}`);
        return null; // Skip unknown devices
      }

      if (node == null) return null;

      node.guid = key;
      node.x = parseFloat(x);
      node.y = parseFloat(y);
      node.type = type;
      network.nodes[key] = node;

      // Parse interfaces (start at 0 for NetworkHost, 1 for routers/switches)
      network.parseModule(
        node,
        i.ENGINE,
        [],
        node instanceof NetworkHost ? 0 : 1
      );

      return null;
    });

    // Parse links
    if (data.NETWORK.LINKS && data.NETWORK.LINKS.LINK) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.NETWORK.LINKS.LINK.map((i: Record<string, any>) => {
        const from = network.nodes[i.CABLE.FROM] as SwitchHost | NetworkHost;
        const to = network.nodes[i.CABLE.TO] as SwitchHost | NetworkHost;
        const length = i.CABLE.LENGTH;

        try {
          const fromIface = from.getInterface(i.CABLE.PORT[0]);
          const toIface = to.getInterface(i.CABLE.PORT[1]);

          const link = new Link(fromIface, toIface, length);
          network.links.push(link);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('Failed to create link:', e, i.CABLE.PORT, from, to);
        }

        return null;
      });
    }

    return network;
  }

  /**
   * Parse PKA format (Packet Tracer Activity)
   * @param json - Parsed XML as JSON (PACKETTRACER5_ACTIVITY node)
   * @returns Network instance with nodes and links
   */
  private static fromPKA(json: unknown): Network {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>;
    return Network.fromPKT(data.PACKETTRACER5[0]);
  }

  /**
   * Main entry point: parse Packet Tracer JSON
   * @param json - Parsed XML as JSON (root node)
   * @returns Network instance with nodes and links
   */
  public static fromPacketTracer(json: unknown): Network {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>;
    if (data.PACKETTRACER5 !== undefined)
      return Network.fromPKT(data.PACKETTRACER5);

    if (data.PACKETTRACER5_ACTIVITY !== undefined)
      return Network.fromPKA(data.PACKETTRACER5_ACTIVITY);

    throw new Error(
      'Unknown format: expected PACKETTRACER5 or PACKETTRACER5_ACTIVITY'
    );
  }
}

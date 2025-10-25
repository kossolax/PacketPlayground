/**
 * Packet Tracer XML Parser
 * Converts decrypted PKT/PKA XML to NetworkTopology
 */

import { XMLParser } from 'fast-xml-parser';
import type { Device, Link, NetworkInterface, NetworkTopology } from './types';
import { mapPacketTracerType } from './devices';

// Type for parsed XML nodes
export type XMLNode = Record<string, unknown>;

/**
 * Build port name from type and depth
 */
function buildPortName(portType: string, depth: number[]): string {
  let baseName = 'Port';

  if (portType.endsWith('GigabitEthernet')) {
    baseName = 'GigabitEthernet';
  } else if (portType.endsWith('FastEthernet')) {
    baseName = 'FastEthernet';
  } else if (portType.endsWith('Ethernet')) {
    baseName = 'Ethernet';
  } else if (portType.endsWith('Serial')) {
    baseName = 'Serial';
  } else if (portType.endsWith('Modem')) {
    baseName = 'Modem';
  }

  return `${baseName}${depth.join('/')}`;
}

/**
 * Parse interfaces (ports) from device
 */
function parseInterfaces(engineNode: XMLNode): NetworkInterface[] {
  const interfaces: NetworkInterface[] = [];

  function parseModule(module: XMLNode, depth: number[] = []) {
    if (!module) return;

    const modulePort = (module as Record<string, unknown>).PORT;
    if (modulePort) {
      const ports = Array.isArray(modulePort) ? modulePort : [modulePort];
      let lastType = '';
      let portIndex = 0;

      ports.forEach((port: XMLNode) => {
        const portType = (port as Record<string, unknown>).TYPE as string;
        if (!portType) return;

        if (portType !== lastType) {
          portIndex = 0;
        }
        lastType = portType;

        const name = buildPortName(portType, [...depth, portIndex]);
        portIndex += 1;

        interfaces.push({
          name,
          type: portType,
          isConnected: false,
        });
      });
    }

    const moduleSlot = (module as Record<string, unknown>).SLOT;
    if (moduleSlot) {
      const slots = Array.isArray(moduleSlot) ? moduleSlot : [moduleSlot];

      slots.forEach((slot: XMLNode, index: number) => {
        const slotType = (slot as Record<string, unknown>).TYPE as string;
        if (slotType === 'ePtHostModule') {
          parseModule(slot, depth);
        } else {
          parseModule(slot, [...depth, index]);
        }
      });
    }
  }

  const engineModule = (engineNode as Record<string, unknown>)
    .MODULE as XMLNode;
  parseModule(engineModule);

  return interfaces;
}

/**
 * Parse devices from PKT XML
 */
function parseDevices(root: XMLNode): Device[] {
  const network = (root as Record<string, unknown>).NETWORK as XMLNode;
  const devices = network
    ? ((network as Record<string, unknown>).DEVICES as XMLNode)
    : undefined;
  const devicesArray = devices
    ? ((devices as Record<string, unknown>).DEVICE as XMLNode | XMLNode[])
    : undefined;

  if (!devicesArray) {
    return [];
  }

  const devicesList = Array.isArray(devicesArray)
    ? devicesArray
    : [devicesArray];

  return devicesList
    .map((deviceNode: XMLNode): Device | null => {
      try {
        const engine = (deviceNode as Record<string, unknown>)
          .ENGINE as XMLNode;
        const workspace = (deviceNode as Record<string, unknown>)
          .WORKSPACE as XMLNode;
        const logical = workspace
          ? ((workspace as Record<string, unknown>).LOGICAL as XMLNode)
          : undefined;

        const guid = (engine as Record<string, unknown>).SAVE_REF_ID as string;
        const typeNode = (engine as Record<string, unknown>).TYPE as XMLNode;
        const typeText = typeNode
          ? ((typeNode as Record<string, unknown>)['#text'] as string)
          : undefined;
        const x = logical
          ? parseFloat(
              ((logical as Record<string, unknown>).X as string) || '0'
            )
          : 0;
        const y = logical
          ? parseFloat(
              ((logical as Record<string, unknown>).Y as string) || '0'
            )
          : 0;

        if (!guid || !typeText) {
          return null;
        }

        // Filter out infrastructure devices that are not part of the network topology
        const typeLower = typeText.toLowerCase();
        if (typeLower === 'power distribution device') {
          return null;
        }

        const type = mapPacketTracerType(typeText);
        const interfaces = parseInterfaces(engine);

        return {
          guid,
          name: typeText,
          type,
          x,
          y,
          interfaces,
        };
      } catch {
        return null;
      }
    })
    .filter((device): device is Device => device !== null);
}

/**
 * Parse links (connections) from PKT XML
 */
function parseLinks(root: XMLNode, devices: Device[]): Link[] {
  const network = (root as Record<string, unknown>).NETWORK as XMLNode;
  const links = network
    ? ((network as Record<string, unknown>).LINKS as XMLNode)
    : undefined;
  const linksArray = links
    ? ((links as Record<string, unknown>).LINK as XMLNode | XMLNode[])
    : undefined;

  if (!linksArray) {
    return [];
  }

  const linksList = Array.isArray(linksArray) ? linksArray : [linksArray];

  const deviceMap = new Map(devices.map((d) => [d.guid, d]));

  return linksList
    .map((linkNode: XMLNode, index: number): Link | null => {
      try {
        const cable = (linkNode as Record<string, unknown>).CABLE as XMLNode;
        const sourceGuid = (cable as Record<string, unknown>).FROM as string;
        const targetGuid = (cable as Record<string, unknown>).TO as string;
        const ports = (cable as Record<string, unknown>).PORT as
          | string[]
          | undefined;
        const length = (cable as Record<string, unknown>).LENGTH as
          | string
          | undefined;

        if (!sourceGuid || !targetGuid) {
          return null;
        }

        const sourceDevice = deviceMap.get(sourceGuid);
        const targetDevice = deviceMap.get(targetGuid);

        if (!sourceDevice || !targetDevice) {
          return null;
        }

        let sourcePort = 'Port0';
        let targetPort = 'Port0';

        if (ports && Array.isArray(ports) && ports.length === 2) {
          const sourcePortIndex = parseInt(ports[0], 10);
          const targetPortIndex = parseInt(ports[1], 10);

          if (
            sourceDevice.interfaces[sourcePortIndex] &&
            targetDevice.interfaces[targetPortIndex]
          ) {
            sourcePort = sourceDevice.interfaces[sourcePortIndex].name;
            targetPort = targetDevice.interfaces[targetPortIndex].name;

            sourceDevice.interfaces[sourcePortIndex].isConnected = true;
            targetDevice.interfaces[targetPortIndex].isConnected = true;
          }
        }

        // Determine cable type based on device types
        const sourceDeviceType = sourceDevice.type;
        const targetDeviceType = targetDevice.type;

        // Group device types for cable detection
        const isSourceEndDevice = [
          'pc',
          'laptop',
          'server',
          'printer',
        ].includes(sourceDeviceType);
        const isTargetEndDevice = [
          'pc',
          'laptop',
          'server',
          'printer',
        ].includes(targetDeviceType);

        // Determine cable type (crossover vs straight)
        let cableType: string;
        if (
          (isSourceEndDevice && isTargetEndDevice) ||
          (sourceDeviceType === 'router' && targetDeviceType === 'router') ||
          (sourceDeviceType === 'switch' && targetDeviceType === 'switch') ||
          (sourceDeviceType === 'hub' && targetDeviceType === 'hub')
        ) {
          cableType = 'crossover';
        } else {
          cableType = 'straight';
        }

        return {
          id: `link-${index}`,
          sourceGuid,
          targetGuid,
          sourcePort,
          targetPort,
          cableType,
          length: length ? parseFloat(length) : undefined,
        };
      } catch {
        return null;
      }
    })
    .filter((link): link is Link => link !== null);
}

/**
 * Parse Packet Tracer XML to NetworkTopology
 *
 * @param xml Decrypted XML string from PKT/PKA file
 * @returns NetworkTopology object ready for ReactFlow
 */
export function parsePacketTracerXML(xml: string): NetworkTopology {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  });

  const jsonObj = parser.parse(xml) as XMLNode;

  let root: XMLNode;
  const packetTracer5 = (jsonObj as Record<string, unknown>)
    .PACKETTRACER5 as XMLNode;
  const packetTracer5Activity = (jsonObj as Record<string, unknown>)
    .PACKETTRACER5_ACTIVITY as XMLNode;

  if (packetTracer5) {
    root = packetTracer5;
  } else if (packetTracer5Activity) {
    const pt5Array = (packetTracer5Activity as Record<string, unknown>)
      .PACKETTRACER5 as XMLNode[];
    const [firstElement] = pt5Array;
    root = firstElement;
  } else {
    throw new Error('Invalid Packet Tracer file format');
  }

  const devices = parseDevices(root);
  const links = parseLinks(root, devices);

  const versionNode = (root as Record<string, unknown>).VERSION as XMLNode;
  const versionText = versionNode
    ? ((versionNode as Record<string, unknown>)['#text'] as string)
    : 'unknown';

  return {
    devices,
    links,
    metadata: {
      version: versionText || 'unknown',
    },
  };
}

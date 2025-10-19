/**
 * Packet Tracer XML Parser
 * Converts decrypted PKT/PKA XML to NetworkTopology
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable prefer-destructuring */
/* eslint-disable import/prefer-default-export */

import { XMLParser } from 'fast-xml-parser';
import type { Device, Link, NetworkInterface, NetworkTopology } from './types';
import { mapPacketTracerType } from './devices';

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

  const jsonObj = parser.parse(xml);

  let root;
  if (jsonObj.PACKETTRACER5) {
    root = jsonObj.PACKETTRACER5;
  } else if (jsonObj.PACKETTRACER5_ACTIVITY) {
    root = jsonObj.PACKETTRACER5_ACTIVITY.PACKETTRACER5[0];
  } else {
    throw new Error('Invalid Packet Tracer file format');
  }

  const devices = parseDevices(root);
  const links = parseLinks(root, devices);

  return {
    devices,
    links,
    metadata: {
      version: root.VERSION?.['#text'] || 'unknown',
    },
  };
}

/**
 * Parse devices from PKT XML
 */
function parseDevices(root: any): Device[] {
  const devicesArray = root.NETWORK?.DEVICES?.DEVICE;

  if (!devicesArray) {
    return [];
  }

  const devicesList = Array.isArray(devicesArray)
    ? devicesArray
    : [devicesArray];

  return devicesList
    .map((deviceNode: any): Device | null => {
      try {
        const guid = deviceNode.ENGINE?.SAVE_REF_ID;
        const typeText = deviceNode.ENGINE?.TYPE?.['#text'];
        const x = parseFloat(deviceNode.WORKSPACE?.LOGICAL?.X || 0);
        const y = parseFloat(deviceNode.WORKSPACE?.LOGICAL?.Y || 0);

        if (!guid || !typeText) {
          return null;
        }

        const type = mapPacketTracerType(typeText);
        const interfaces = parseInterfaces(deviceNode.ENGINE);

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
 * Parse interfaces (ports) from device
 */
function parseInterfaces(engineNode: any): NetworkInterface[] {
  const interfaces: NetworkInterface[] = [];

  function parseModule(module: any, depth: number[] = []) {
    if (!module) return;

    if (module.PORT) {
      const ports = Array.isArray(module.PORT) ? module.PORT : [module.PORT];
      let lastType = '';
      let portIndex = 0;

      ports.forEach((port: any) => {
        const portType = port.TYPE;
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

    if (module.SLOT) {
      const slots = Array.isArray(module.SLOT) ? module.SLOT : [module.SLOT];

      slots.forEach((slot: any, index: number) => {
        const slotType = slot.TYPE;
        if (slotType === 'ePtHostModule') {
          parseModule(slot, depth);
        } else {
          parseModule(slot, [...depth, index]);
        }
      });
    }
  }

  parseModule(engineNode.MODULE);

  return interfaces;
}

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
 * Parse links (connections) from PKT XML
 */
function parseLinks(root: any, devices: Device[]): Link[] {
  const linksArray = root.NETWORK?.LINKS?.LINK;

  if (!linksArray) {
    return [];
  }

  const linksList = Array.isArray(linksArray) ? linksArray : [linksArray];

  const deviceMap = new Map(devices.map((d) => [d.guid, d]));

  return linksList
    .map((linkNode: any, index: number): Link | null => {
      try {
        const sourceGuid = linkNode.CABLE?.FROM;
        const targetGuid = linkNode.CABLE?.TO;
        const ports = linkNode.CABLE?.PORT;
        const length = linkNode.CABLE?.LENGTH;

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

        return {
          id: `link-${index}`,
          sourceGuid,
          targetGuid,
          sourcePort,
          targetPort,
          cableType: 'straight',
          length: length ? parseFloat(length) : undefined,
        };
      } catch {
        return null;
      }
    })
    .filter((link): link is Link => link !== null);
}

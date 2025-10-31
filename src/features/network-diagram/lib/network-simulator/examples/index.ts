import type { Network } from '../network';

export interface NetworkExample {
  id: string;
  name: string;
  description: string;
  available: boolean;
  createNetwork: () => Network | Promise<Network>;
}

export const networkExamples: NetworkExample[] = [
  {
    id: 'autonegotiation',
    name: 'Auto-Negotiation Test',
    description: 'PC (100Mbps) & Switch (1000Mbps)',
    available: true,
    createNetwork: async () => {
      const module = await import('./autonegotiation');
      return module.default();
    },
  },
  {
    id: 'arp-discovery',
    name: 'ARP Discovery',
    description: 'MAC address resolution demo',
    available: true,
    createNetwork: async () => {
      const module = await import('./arp-discovery');
      return module.default();
    },
  },
  {
    id: 'ping-network',
    name: 'Ping Network',
    description: 'ICMP ping between routers',
    available: true,
    createNetwork: async () => {
      const module = await import('./ping-network');
      return module.default();
    },
  },
  {
    id: 'vlan-trunk',
    name: 'VLAN Trunk',
    description: '2 VLANs with 802.1Q trunk',
    available: true,
    createNetwork: async () => {
      const module = await import('./vlan-trunk');
      return module.default();
    },
  },
  {
    id: 'stp-loop',
    name: 'STP Loop Demo',
    description: '3 switches with loop prevention',
    available: true,
    createNetwork: async () => {
      const module = await import('./stp-loop');
      return module.default();
    },
  },
  {
    id: 'dhcp-setup',
    name: 'DHCP Setup',
    description: 'Server with dynamic IP allocation',
    available: true,
    createNetwork: async () => {
      const module = await import('./dhcp-setup');
      return module.default();
    },
  },
];

export function getExampleById(id: string): NetworkExample | undefined {
  return networkExamples.find((example) => example.id === id);
}

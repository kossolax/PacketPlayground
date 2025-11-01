/**
 * Network Icon Component
 * Displays network device icons with theme color support (similar to lucide-react)
 */

import type { DeviceType } from '@/features/network-diagram/lib/network-simulator';
import PcIcon from '@/assets/network-icons/pc.svg?react';
import LaptopIcon from '@/assets/network-icons/laptop.svg?react';
import ServerIcon from '@/assets/network-icons/server.svg?react';
import RouterIcon from '@/assets/network-icons/router.svg?react';
import SwitchIcon from '@/assets/network-icons/switch.svg?react';
import HubIcon from '@/assets/network-icons/hub.svg?react';

interface NetworkIconProps {
  deviceType: DeviceType;
  className?: string;
}

const iconMap: Record<
  DeviceType,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  pc: PcIcon,
  laptop: LaptopIcon,
  server: ServerIcon,
  router: RouterIcon,
  switch: SwitchIcon,
  hub: HubIcon,
};

export default function NetworkIcon({
  deviceType,
  className = '',
}: NetworkIconProps) {
  const Icon = iconMap[deviceType];

  if (!Icon) {
    return null;
  }

  return <Icon className={className} />;
}

/**
 * Device Toolbar Component
 * Displays available devices for adding to the diagram
 */

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { DEVICE_CATALOG, type DeviceType } from '@/lib/network-simulator';

interface DeviceToolbarProps {
  onDeviceSelect: (deviceType: DeviceType) => void;
  selectedDevice: DeviceType | null;
}

const DEVICE_ORDER: DeviceType[] = [
  'pc',
  'laptop',
  'server',
  'router',
  'switch',
  'hub',
  'printer',
  'cloud',
];

export default function DeviceToolbar({
  onDeviceSelect,
  selectedDevice,
}: DeviceToolbarProps) {
  return (
    <div className="w-20 bg-muted/50 border-r border-border flex flex-col gap-2 p-2">
      <div className="text-xs font-semibold text-muted-foreground px-1">
        Devices
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        {DEVICE_ORDER.map((deviceType) => {
          const catalog = DEVICE_CATALOG[deviceType];
          return (
            <Button
              key={deviceType}
              variant={selectedDevice === deviceType ? 'default' : 'ghost'}
              size="sm"
              className="h-auto flex-col p-2 gap-1"
              onClick={() => onDeviceSelect(deviceType)}
              title={catalog.description}
            >
              <img
                src={catalog.icon}
                alt={catalog.displayName}
                className="h-8 w-8 object-contain"
                draggable={false}
              />
              <span className="text-[10px]">{catalog.displayName}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

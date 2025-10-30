/**
 * Cable Toolbar Component
 * Displays available cables for connecting devices
 */

import { Cable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  CABLE_CATALOG,
  type CableUIType,
} from '../lib/network-simulator/cables';

interface CableToolbarProps {
  onCableSelect: (cableType: CableUIType) => void;
  selectedCable: CableUIType | null;
}

export default function CableToolbar({
  onCableSelect,
  selectedCable,
}: CableToolbarProps) {
  const cable = CABLE_CATALOG.auto;

  return (
    <div className="w-20 border-t flex flex-col gap-2 p-2">
      <div className="text-xs font-semibold text-muted-foreground px-1">
        Cables
      </div>
      <Separator />
      <div className="flex flex-col gap-1">
        <Button
          variant={selectedCable === 'auto' ? 'default' : 'ghost'}
          size="sm"
          className="h-auto flex-col p-2 gap-1"
          onClick={() => onCableSelect('auto')}
          title={cable.description}
        >
          <Cable className="h-8 w-8" strokeWidth={1.5} />
          <span className="text-[10px]">{cable.displayName}</span>
        </Button>
      </div>
    </div>
  );
}

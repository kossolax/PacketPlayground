import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { Packet, RouterState } from '../lib/router-sim';

interface RouterVisualizationProps {
  state: RouterState;
}

export default function RouterVisualization({
  state,
}: RouterVisualizationProps) {
  const containerWidth = 700;
  const containerHeight = 400;
  const routerHeight = 120;
  const queueSlotSize = 20;
  const queueSlotGap = 2;
  // Ensure router is wide enough to fit up to the configured queue sizes (aim: 10 slots)
  const maxQueueSize = Math.max(state.inputQueueSize, state.outputQueueSize);
  const minRouterWidth = 240; // fits 10 slots at 20px with 2px gaps + 10px padding on each side
  const routerInnerPadding = 10; // left or right inner padding
  const requiredWidth =
    routerInnerPadding +
    maxQueueSize * (queueSlotSize + queueSlotGap) +
    routerInnerPadding;
  const routerWidth = Math.max(minRouterWidth, requiredWidth);
  const routerX = (containerWidth - routerWidth) / 2;
  const routerY = (containerHeight - routerHeight) / 2;

  // Input cable
  const inputCableY = routerY + routerHeight / 2;
  const inputCableStart = 50;
  const inputCableEnd = routerX;

  // Output cable
  const outputCableY = routerY + routerHeight / 2;
  const outputCableStart = routerX + routerWidth;
  const outputCableEnd = containerWidth - 50;

  // Queue positions
  const inputQueueX = routerX + 10;
  const inputQueueY = routerY + 20;
  const outputQueueX =
    routerX +
    routerWidth -
    10 -
    state.outputQueueSize * (queueSlotSize + queueSlotGap);
  const outputQueueY = routerY + routerHeight - 30;

  // Switching fabric position
  const switchingFabricCenterX = routerX + routerWidth / 2;
  const switchingFabricY = routerY + routerHeight / 2 - 15;

  // Dropped packets area
  // Moved to bottom-left with panel styling (no explicit X/Y needed)

  const renderQueue = (
    queue: Packet[],
    x: number,
    y: number,
    maxSize: number,
    direction: 'horizontal' | 'vertical'
  ) => {
    const slots = [];
    const step = queueSlotSize + queueSlotGap;

    // Render empty slots
    for (let i = 0; i < maxSize; i += 1) {
      let slotX = x;
      let slotY = y;
      if (direction === 'horizontal') {
        slotX = x + i * step;
      } else {
        slotY = y + i * step;
      }

      slots.push(
        <div
          key={`empty-${i}`}
          className="absolute border border-gray-300 bg-gray-100 rounded"
          style={{
            left: slotX,
            top: slotY,
            width: queueSlotSize,
            height: queueSlotSize,
          }}
        />
      );
    }

    // Render packets in queue (from the end of the queue)
    queue.slice(-maxSize).forEach((packet, index) => {
      const slotIndex = maxSize - queue.length + index;
      let slotX = x;
      let slotY = y;
      if (direction === 'horizontal') {
        slotX = x + slotIndex * step;
      } else {
        slotY = y + slotIndex * step;
      }

      slots.push(
        <div
          key={packet.id}
          className="absolute rounded border"
          style={{
            left: slotX,
            top: slotY,
            width: queueSlotSize,
            height: queueSlotSize,
            backgroundColor: packet.color,
            borderColor: packet.color,
          }}
        />
      );
    });

    return slots;
  };

  return (
    <div className="relative bg-gradient-to-r from-blue-50 via-background to-green-50 rounded-md border overflow-hidden">
      <div
        className="relative"
        style={{
          width: containerWidth,
          height: containerHeight,
          margin: '0 auto',
        }}
      >
        {/* Input cable */}
        <div
          className="absolute bg-gray-300"
          style={{
            left: inputCableStart,
            top: inputCableY - 2,
            width: inputCableEnd - inputCableStart,
            height: 4,
          }}
        />
        <div
          className="absolute text-xs text-blue-600 font-medium"
          style={{ left: inputCableStart, top: inputCableY - 20 }}
        >
          {state.inputRate} pkt/s
        </div>

        {/* Output cable */}
        <div
          className="absolute bg-gray-300"
          style={{
            left: outputCableStart,
            top: outputCableY - 2,
            width: outputCableEnd - outputCableStart,
            height: 4,
          }}
        />
        <div
          className="absolute text-xs text-green-600 font-medium"
          style={{ left: outputCableEnd - 50, top: outputCableY - 20 }}
        >
          {state.outputRate} pkt/s
        </div>

        {/* Router */}
        <div
          className="absolute bg-gray-100 border-2 border-gray-400 rounded-lg"
          style={{
            left: routerX,
            top: routerY,
            width: routerWidth,
            height: routerHeight,
          }}
        />

        {/* Router label above */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: routerY - 30, width: routerWidth }}
        >
          <div className="flex items-center justify-center">
            <Badge
              variant="outline"
              className="bg-gray-200 border-gray-400 text-gray-700 text-xs"
            >
              Router
            </Badge>
          </div>
        </div>

        {/* Input Queue */}
        <div className="absolute">
          <div
            className="absolute text-xs text-blue-600 font-medium mb-1 pointer-events-none"
            style={{ left: routerX - 60, top: inputQueueY - 16 }}
          >
            Input
          </div>
          {renderQueue(
            state.inputQueue,
            inputQueueX,
            inputQueueY,
            state.inputQueueSize,
            'horizontal'
          )}
        </div>

        {/* Switching Fabric (centered) */}
        <div
          className="absolute -translate-x-1/2 bg-yellow-200 border border-yellow-400 rounded flex items-center gap-2 px-2 h-7"
          style={{ left: switchingFabricCenterX, top: switchingFabricY }}
        >
          <ArrowRight className="h-4 w-4 text-yellow-700" />
          <span className="text-xs text-yellow-700 font-medium">
            {state.switchingFabricSpeed} pkt/s
          </span>
        </div>

        {/* Output Queue */}
        <div className="absolute">
          <div
            className="absolute text-xs text-green-600 font-medium mb-1 pointer-events-none"
            style={{ left: routerX + routerWidth + 10, top: outputQueueY - 16 }}
          >
            Output
          </div>
          {renderQueue(
            state.outputQueue,
            outputQueueX,
            outputQueueY,
            state.outputQueueSize,
            'horizontal'
          )}
        </div>

        {/* Dropped packets area (panel, bottom-left) */}
        <div className="absolute bottom-3 left-3">
          <div className="rounded-md border bg-white/80 backdrop-blur px-3 py-1.5 text-xs shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600" />
              <span className="text-red-600">Dropped</span>
              <span className="ml-1 font-medium text-foreground">
                {state.packetsDropped}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 max-w-40">
              {state.droppedPackets.slice(-12).map((packet) => (
                <div
                  key={packet.id}
                  className="w-3 h-3 rounded border opacity-60"
                  style={{
                    backgroundColor: packet.color,
                    borderColor: packet.color,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="absolute bottom-3 right-3">
          <div className="flex items-center gap-3 rounded-md border bg-white/80 backdrop-blur px-3 py-1.5 text-xs shadow-sm">
            <div className="flex items-center gap-1 text-blue-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />
              <span className="opacity-80">Generated</span>
              <span className="ml-1 font-medium text-foreground">
                {state.packetsGenerated}
              </span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-600" />
              <span className="opacity-80">Processed</span>
              <span className="ml-1 font-medium text-foreground">
                {state.packetsProcessed}
              </span>
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-600" />
              <span className="opacity-80">Dropped</span>
              <span className="ml-1 font-medium text-foreground">
                {state.packetsDropped}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

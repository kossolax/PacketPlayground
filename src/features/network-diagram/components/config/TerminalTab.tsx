/**
 * Terminal Tab Component
 * Displays terminal interface for device command-line access
 */

import type { GenericNode } from '../../lib/network-simulator';

interface TerminalTabProps {
  node: GenericNode;
}

export default function TerminalTab({ node }: TerminalTabProps) {
  return (
    <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <h3 className="mb-2 font-semibold text-lg">Terminal</h3>
      <p className="text-muted-foreground text-sm">Device: {node.name}</p>
      <p className="text-muted-foreground text-sm mt-4">
        Terminal interface will be implemented here.
      </p>
      <p className="text-muted-foreground text-sm mt-2">
        This will provide a command-line interface to interact with the device,
        similar to the Angular version using the Terminal model from the
        simulator.
      </p>
    </div>
  );
}

/**
 * Terminal Tab Component
 * Displays terminal interface for device command-line access
 */

import { useEffect, useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import type { GenericNode } from '../../lib/network-simulator';
import useTerminal from '../../hooks/useTerminal';

interface TerminalTabProps {
  node: GenericNode;
}

export default function TerminalTab({ node }: TerminalTabProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { xterm, fitAddon, isReady } = useTerminal(node);

  useEffect(() => {
    if (isReady && xterm && fitAddon && terminalContainerRef.current) {
      xterm.open(terminalContainerRef.current);
      fitAddon.fit();

      // Handle window resize
      const handleResize = () => {
        fitAddon.fit();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    return undefined;
  }, [isReady, xterm, fitAddon]);

  return (
    <div className="h-full flex flex-col bg-black rounded-lg overflow-hidden p-2">
      <div ref={terminalContainerRef} className="flex-1" />
    </div>
  );
}

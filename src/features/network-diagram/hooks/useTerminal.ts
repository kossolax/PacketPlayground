/**
 * Custom hook for terminal management
 * Handles xterm.js instance and Terminal simulator integration
 */

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '../lib/network-simulator/terminal/terminal';
import type { GenericNode, NetworkHost } from '../lib/network-simulator';
import type { SwitchHost } from '../lib/network-simulator/nodes/switch';

export default function useTerminal(node: GenericNode | null) {
  const [isReady, setIsReady] = useState(false);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const bufferRef = useRef<string[]>([]);
  const bufferPosRef = useRef(0);

  useEffect(() => {
    if (!node) return undefined;

    // Create xterm instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Create terminal simulator instance
    const terminal = new Terminal(node as NetworkHost | SwitchHost);
    terminalRef.current = terminal;

    // Setup terminal callbacks
    terminal.onText = (text: string) => {
      const message = typeof text === 'string' ? text : String(text);
      xterm.write(message.replace(/\n/g, '\r\n'));
      xterm.write('\r\n');
    };

    terminal.onComplete = () => {
      xterm.write(`${terminal.Prompt} `);
    };

    // Write initial prompt
    xterm.write(`${terminal.Prompt} `);

    // Handle keyboard input
    // eslint-disable-next-line consistent-return
    const disposable = xterm.onData((data) => {
      if (terminal.Locked) return;

      const code = data.charCodeAt(0);

      // Enter key (13 = \r)
      if (code === 13) {
        const command = bufferRef.current.join('').trim();
        bufferRef.current = [];
        bufferPosRef.current = 0;

        if (command.length > 0) {
          xterm.write('\r\n');
          terminal.exec(command);
        } else {
          xterm.write(`\r\n${terminal.Prompt} `);
        }
        return;
      }

      // Backspace (127 = DEL)
      if (code === 127) {
        if (bufferPosRef.current > 0) {
          bufferRef.current.splice(bufferPosRef.current - 1, 1);
          bufferPosRef.current -= 1;

          // Redraw line from cursor
          const remaining = bufferRef.current.slice(bufferPosRef.current);
          xterm.write(`\b${remaining.join('')} `);
          xterm.write(`\x1b[${remaining.length + 1}D`);
        }
        return;
      }

      // ? key (63) - show help/available commands
      if (code === 63) {
        let command = bufferRef.current.join('');
        // Ensure trailing space for help context (Cisco IOS behavior)
        if (!command.endsWith(' ')) {
          command += ' ';
        }
        const completions = terminal.autocomplete(command);

        if (completions.length > 0) {
          // Show suggestions without adding "?" to buffer
          xterm.write(`\r\n${completions.join('  ')}\r\n${terminal.Prompt} `);
          xterm.write(bufferRef.current.join('')); // Redraw buffer without "?"
        }
        return; // Don't add "?" to buffer
      }

      // Tab key (9) - autocomplete/complete
      if (code === 9) {
        const command = bufferRef.current.join('');
        const completions = terminal.autocomplete(command);

        if (completions.length === 1) {
          // Complete the command
          const commands = command.split(' ').filter((x) => x);
          const lastPart = commands[commands.length - 1] || '';
          const toAdd = completions[0].slice(lastPart.length);

          toAdd.split('').forEach((char) => {
            bufferRef.current.push(char);
          });
          bufferPosRef.current = bufferRef.current.length;
          xterm.write(toAdd);
        } else if (completions.length > 1) {
          // Show all completions
          xterm.write(`\r\n${completions.join('  ')}\r\n${terminal.Prompt} `);
          xterm.write(bufferRef.current.join(''));
        }
        return;
      }

      // Arrow keys (ESC sequences)
      if (data === '\x1b[A') {
        // Up arrow - history back
        const cmd = terminal.historyBack();
        if (cmd !== null) {
          // Clear current line
          xterm.write(`\r\x1b[K${terminal.Prompt} ${cmd}`);
          bufferRef.current = cmd.split('');
          bufferPosRef.current = bufferRef.current.length;
        }
        return;
      }

      if (data === '\x1b[B') {
        // Down arrow - history forward
        const cmd = terminal.historyForward();
        if (cmd !== null) {
          xterm.write(`\r\x1b[K${terminal.Prompt} ${cmd}`);
          bufferRef.current = cmd.split('');
          bufferPosRef.current = bufferRef.current.length;
        } else {
          // End of history - clear line
          xterm.write(`\r\x1b[K${terminal.Prompt} `);
          bufferRef.current = [];
          bufferPosRef.current = 0;
        }
        return;
      }

      if (data === '\x1b[C') {
        // Right arrow
        if (bufferPosRef.current < bufferRef.current.length) {
          bufferPosRef.current += 1;
          xterm.write(data);
        }
        return;
      }

      if (data === '\x1b[D') {
        // Left arrow
        if (bufferPosRef.current > 0) {
          bufferPosRef.current -= 1;
          xterm.write(data);
        }
        return;
      }

      // Printable characters (32-126)
      if (code >= 32 && code <= 126) {
        bufferRef.current.splice(bufferPosRef.current, 0, data);
        bufferPosRef.current += 1;

        // Redraw from cursor position
        if (bufferPosRef.current !== bufferRef.current.length) {
          const remaining = bufferRef.current.slice(bufferPosRef.current);
          xterm.write(data + remaining.join(''));
          xterm.write(`\x1b[${remaining.length}D`);
        } else {
          xterm.write(data);
        }
      }
    });

    setIsReady(true);

    // Cleanup
    return () => {
      disposable.dispose();
      xterm.dispose();
      terminalRef.current = null;
      xtermRef.current = null;
      fitAddonRef.current = null;
      setIsReady(false);
    };
  }, [node]);

  return {
    xterm: xtermRef.current,
    fitAddon: fitAddonRef.current,
    terminal: terminalRef.current,
    isReady,
  };
}

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SSHConnectionConfig } from '../../types';

interface TerminalViewProps {
  active: boolean;
  config: SSHConnectionConfig | null;
  onSocketReady: (ws: WebSocket) => void;
}

// Professional Nebula Theme Palette (Optimized for xterm-256color)
const NEBULA_THEME = {
  background: '#020617', // Slate 950
  foreground: '#e2e8f0', // Slate 200
  cursor: '#22d3ee',     // Cyan 400 (Highly visible cursor)
  cursorAccent: '#020617',
  selectionBackground: 'rgba(34, 211, 238, 0.3)', // Transparent Cyan
  
  // ANSI Colors (Dracula-inspired adaptation for Slate bg)
  black: '#1e293b',      // Slate 800
  red: '#ef4444',        // Red 500
  green: '#10b981',      // Emerald 500
  yellow: '#f59e0b',     // Amber 500
  blue: '#3b82f6',       // Blue 500
  magenta: '#d946ef',    // Fuchsia 500
  cyan: '#06b6d4',       // Cyan 500
  white: '#f1f5f9',      // Slate 100

  // Bright Variants
  brightBlack: '#64748b', // Slate 500
  brightRed: '#f87171',   // Red 400
  brightGreen: '#34d399', // Emerald 400
  brightYellow: '#fbbf24',// Amber 400
  brightBlue: '#60a5fa',  // Blue 400
  brightMagenta: '#e879f9',// Fuchsia 400
  brightCyan: '#22d3ee',  // Cyan 400
  brightWhite: '#ffffff', // White
};

const WELCOME_BANNER = `
\x1b[1;36m  _   _      _           _         ____ ____  _   _ \x1b[0m
\x1b[1;36m | \\ | | ___| |__  _   _| | __ _  / ___/ ___|| | | |\x1b[0m
\x1b[1;36m |  \\| |/ _ \\ '_ \\| | | | |/ _\` | \\___ \\___ \\| |_| |\x1b[0m
\x1b[1;36m | |\\  |  __/ |_) | |_| | | (_| |  ___) |__) |  _  |\x1b[0m
\x1b[1;36m |_| \\_|\\___|_.__/ \\__,_|_|\\__,_| |____/____/|_| |_|\x1b[0m
\x1b[0;90m      SECURE WEB TERMINAL v2.0                      \x1b[0m
\r\n`;

export const TerminalView: React.FC<TerminalViewProps> = ({ active, config, onSocketReady }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Initialize Terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar', // 'block' | 'underline' | 'bar'
      cursorWidth: 2,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.25, 
      fontWeight: '500',
      letterSpacing: 0,
      theme: NEBULA_THEME,
      allowTransparency: true,
      scrollback: 10000,
      rightClickSelectsWord: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial Welcome Message
    term.write(WELCOME_BANNER);
    term.writeln(`\x1b[38;5;240m[SYSTEM] Initializing secure connection to ${config?.host}...\x1b[0m`);

    // Establish WebSocket Connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Send connection credentials
      if (config) {
        ws.send(JSON.stringify({ type: 'CONNECT', config }));
      }
      onSocketReady(ws);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'TERM_DATA') {
          term.write(msg.data);
        } else if (msg.type === 'STATUS') {
          if (msg.status === 'CONNECTED') {
             // We don't print "Connected" here to avoid cluttering the shell prompt
             // The shell prompt itself is indication enough
             fitAddon.fit();
             ws.send(JSON.stringify({ type: 'TERM_RESIZE', cols: term.cols, rows: term.rows }));
          } else if (msg.status === 'DISCONNECTED') {
             term.writeln('\r\n\x1b[1;31m[!] Connection Terminated by Server.\x1b[0m');
          }
        } else if (msg.type === 'ERROR') {
          term.writeln(`\r\n\x1b[1;31m[!] Error: ${msg.message}\x1b[0m`);
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[1;31m[!] Fatal: WebSocket Connection Failed.\x1b[0m');
    };

    socketRef.current = ws;

    // Send Terminal Input to Server
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'TERM_INPUT', data }));
      }
    });

    // Handle Resize
    const handleResize = () => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN && term) {
          ws.send(JSON.stringify({ type: 'TERM_RESIZE', cols: term.cols, rows: term.rows }));
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Handle Active Tab Switch
  useEffect(() => {
    if (active && fitAddonRef.current) {
      // Small delay to ensure container is rendered
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      }, 50);
    }
  }, [active]);

  return (
    <div className={`h-full w-full bg-slate-950 p-4 ${active ? 'block' : 'hidden'}`}>
      <div className="h-full w-full relative">
        {/* Terminal Container */}
        <div 
          ref={terminalRef} 
          className="relative h-full w-full rounded-lg overflow-hidden bg-[#020617] border border-slate-800 shadow-xl"
          style={{
            // Inner padding to keep text away from edges
            padding: '12px 0 0 12px' 
          }}
        />
      </div>
    </div>
  );
};
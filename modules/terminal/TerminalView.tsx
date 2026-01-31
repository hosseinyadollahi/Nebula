import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SSHConnectionConfig } from '../../types';

interface TerminalViewProps {
  active: boolean;
  config: SSHConnectionConfig | null;
  onSocketReady: (ws: WebSocket) => void;
}

// Professional Nebula Theme Palette
const NEBULA_THEME = {
  background: '#020617', // Slate 950 (Deepest dark)
  foreground: '#f8fafc', // Slate 50 (Bright white for text)
  cursor: '#10b981',     // Emerald 500
  cursorAccent: '#000000',
  selectionBackground: 'rgba(16, 185, 129, 0.25)', // Transparent Emerald
  
  // ANSI Colors
  black: '#1e293b',      // Slate 800
  red: '#ef4444',        // Red 500
  green: '#10b981',      // Emerald 500
  yellow: '#f59e0b',     // Amber 500
  blue: '#3b82f6',       // Blue 500
  magenta: '#d946ef',    // Fuchsia 500
  cyan: '#06b6d4',       // Cyan 500
  white: '#e2e8f0',      // Slate 200

  // Bright Variants
  brightBlack: '#475569', // Slate 600
  brightRed: '#f87171',   // Red 400
  brightGreen: '#34d399', // Emerald 400
  brightYellow: '#fbbf24',// Amber 400
  brightBlue: '#60a5fa',  // Blue 400
  brightMagenta: '#e879f9',// Fuchsia 400
  brightCyan: '#22d3ee',  // Cyan 400
  brightWhite: '#ffffff', // White
};

const WELCOME_BANNER = `
\x1b[1;32m  _   _      _           _        \x1b[0m
\x1b[1;32m | \\ | | ___| |__  _   _| | __ _  \x1b[0m
\x1b[1;32m |  \\| |/ _ \\ '_ \\| | | | |/ _\` | \x1b[0m
\x1b[1;32m | |\\  |  __/ |_) | |_| | | (_| | \x1b[0m
\x1b[1;32m |_| \\_|\\___|_.__/ \\__,_|_|\\__,_| \x1b[0m
\x1b[1;36m      SSH CLIENT v1.0.0           \x1b[0m
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
      cursorStyle: 'block', // 'block' | 'underline' | 'bar'
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 14,
      lineHeight: 1.2, // Slightly taller lines for better readability
      fontWeight: '500',
      letterSpacing: 0,
      theme: NEBULA_THEME,
      allowTransparency: true,
      scrollback: 5000, // Increase scrollback buffer
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial Welcome Message
    term.write(WELCOME_BANNER);
    term.writeln('\x1b[38;5;240m----------------------------------------\x1b[0m');
    term.writeln(`\x1b[1;34m[*] Target System:\x1b[0m ${config ? config.host : 'Not Configured'}`);
    term.writeln('\x1b[1;34m[*] Status:\x1b[0m \x1b[33mInitializing connection...\x1b[0m');
    term.writeln('');

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
             term.writeln('\r\n\x1b[1;32m[+] Connection Established Successfully.\x1b[0m\r\n');
             // Trigger resize on connect
             fitAddon.fit();
             ws.send(JSON.stringify({ type: 'TERM_RESIZE', cols: term.cols, rows: term.rows }));
          } else if (msg.status === 'DISCONNECTED') {
             term.writeln('\r\n\x1b[1;31m[-] Connection Closed.\x1b[0m');
          }
        } else if (msg.type === 'ERROR') {
          term.writeln(`\r\n\x1b[1;31m[!] Error: ${msg.message}\x1b[0m`);
        }
      } catch (e) {
        // Raw data fallback
        console.error(e);
      }
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[1;31m[!] WebSocket Connection Error.\x1b[0m');
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
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      });
    }
  }, [active]);

  return (
    <div className={`h-full w-full bg-slate-950 p-4 ${active ? 'block' : 'hidden'}`}>
      <div className="h-full w-full relative group">
        {/* Glow Effect Background */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
        
        {/* Terminal Container */}
        <div 
          ref={terminalRef} 
          className="relative h-full w-full rounded-xl overflow-hidden bg-[#020617] border border-slate-800 shadow-2xl pl-2 pt-2"
          style={{
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)' // Inner shadow for depth
          }}
        />
      </div>
    </div>
  );
};
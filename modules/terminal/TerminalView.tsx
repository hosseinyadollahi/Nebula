import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SSHConnectionConfig } from '../../types';

interface TerminalViewProps {
  active: boolean;
  config: SSHConnectionConfig | null;
  onSocketReady: (ws: WebSocket) => void;
}

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
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#10b981',
        selectionBackground: 'rgba(16, 185, 129, 0.3)',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#ec4899',
        cyan: '#06b6d4',
        white: '#ffffff',
      },
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;34mConnecting to server...\x1b[0m');

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
             term.writeln('\r\n\x1b[1;32mConnection Established.\x1b[0m\r\n');
             // Trigger resize on connect
             fitAddon.fit();
             ws.send(JSON.stringify({ type: 'TERM_RESIZE', cols: term.cols, rows: term.rows }));
          } else if (msg.status === 'DISCONNECTED') {
             term.writeln('\r\n\x1b[1;31mConnection Closed.\x1b[0m');
          }
        } else if (msg.type === 'ERROR') {
          term.writeln(`\r\n\x1b[1;31mError: ${msg.message}\x1b[0m`);
        }
      } catch (e) {
        // Raw data fallback
        console.error(e);
      }
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[1;31mWebSocket Connection Error.\x1b[0m');
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
    <div className={`h-full w-full bg-slate-950 p-2 ${active ? 'block' : 'hidden'}`}>
      <div 
        ref={terminalRef} 
        className="h-full w-full rounded-lg overflow-hidden border border-slate-800 shadow-inner"
      />
    </div>
  );
};
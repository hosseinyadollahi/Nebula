import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SSHConnectionConfig } from '../../types';
import { FolderOpen } from 'lucide-react';

interface TerminalViewProps {
  active: boolean;
  config: SSHConnectionConfig | null;
  socket: WebSocket | null;
  onDisconnect: () => void;
  onOpenScp: () => void;
}

// Professional Nebula Theme Palette
const NEBULA_THEME = {
  background: '#020617', // Slate 950
  foreground: '#e2e8f0', // Slate 200
  cursor: '#22d3ee',     // Cyan 400
  cursorAccent: '#020617',
  selectionBackground: 'rgba(34, 211, 238, 0.3)',
  
  black: '#1e293b',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#d946ef',
  cyan: '#06b6d4',
  white: '#f1f5f9',

  brightBlack: '#64748b',
  brightRed: '#f87171',
  brightGreen: '#34d399',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#e879f9',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

const WELCOME_BANNER = `
\x1b[1;36m  _   _      _           _         ____ ____  _   _ \x1b[0m
\x1b[1;36m | \\ | | ___| |__  _   _| | __ _  / ___/ ___|| | | |\x1b[0m
\x1b[1;36m |  \\| |/ _ \\ '_ \\| | | | |/ _\` | \\___ \\___ \\| |_| |\x1b[0m
\x1b[1;36m | |\\  |  __/ |_) | |_| | | (_| |  ___) |__) |  _  |\x1b[0m
\x1b[1;36m |_| \\_|\\___|_.__/ \\__,_|_|\\__,_| |____/____/|_| |_|\x1b[0m
\x1b[0;90m      SECURE WEB TERMINAL v2.0                      \x1b[0m
\r\n`;

export const TerminalView: React.FC<TerminalViewProps> = ({ active, config, socket, onDisconnect, onOpenScp }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize Terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
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
    
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Fix Glitch: Wait for fonts to be ready before first fit
    document.fonts.ready.then(() => {
      fitAddon.fit();
      term.refresh(0, term.rows - 1);
    });

    // Write banner
    term.write(WELCOME_BANNER);
    term.writeln(`\x1b[38;5;240m[SYSTEM] Session active: ${config?.username}@${config?.host}\x1b[0m\r\n`);

    const resizeObserver = new ResizeObserver(() => {
       if(active) {
           requestAnimationFrame(() => {
               fitAddon.fit();
               if (socket && socket.readyState === WebSocket.OPEN) {
                   socket.send(JSON.stringify({ type: 'TERM_RESIZE', cols: term.cols, rows: term.rows }));
               }
           });
       }
    });
    
    resizeObserver.observe(terminalRef.current);

    // Socket Handling
    if (socket) {
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TERM_DATA') {
            term.write(msg.data);
          } else if (msg.type === 'STATUS' && msg.status === 'DISCONNECTED') {
            term.writeln('\r\n\x1b[1;31m[!] Connection Terminated.\x1b[0m');
            onDisconnect();
          } else if (msg.type === 'ERROR') {
            term.writeln(`\r\n\x1b[1;31m[!] Error: ${msg.message}\x1b[0m`);
          }
        } catch (e) {
          console.error(e);
        }
      };

      socket.onclose = () => {
        term.writeln('\r\n\x1b[1;31m[!] WebSocket Closed.\x1b[0m');
      };

      term.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'TERM_INPUT', data }));
        }
      });
    }

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Handle Tab Switching visibility fix
  useEffect(() => {
    if (active && fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
        xtermRef.current?.refresh(0, xtermRef.current.rows - 1);
      }, 100);
    }
  }, [active]);

  return (
    <div className={`h-full w-full bg-slate-950 p-4 ${active ? 'block' : 'hidden'}`}>
      <div className="h-full w-full relative group">
        
        {/* Floating SCP Button */}
        <button 
          onClick={onOpenScp}
          className="absolute right-6 top-6 z-20 flex items-center gap-2 bg-slate-800/80 hover:bg-emerald-600 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-slate-700 backdrop-blur-sm transition-all shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="text-xs font-medium">Open File Manager</span>
        </button>

        <div 
          ref={terminalRef} 
          className="relative h-full w-full rounded-lg overflow-hidden bg-[#020617] border border-slate-800 shadow-xl"
          style={{ padding: '12px 0 0 12px' }}
        />
      </div>
    </div>
  );
};
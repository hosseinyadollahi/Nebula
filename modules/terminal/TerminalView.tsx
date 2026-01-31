import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { mockFS } from '../../services/mockBackend';

interface TerminalViewProps {
  active: boolean;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ active }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [inputBuffer, setInputBuffer] = useState('');

  // Initialize Terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      theme: {
        background: '#0f172a', // Slate 950
        foreground: '#e2e8f0', // Slate 200
        cursor: '#10b981',     // Emerald 500
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

    // Welcome Message
    term.writeln('\x1b[1;32mWelcome to Nebula SSH Client v1.0.0\x1b[0m');
    term.writeln('Connected to \x1b[1;34mmock-server-01\x1b[0m (Simulation Mode)');
    term.writeln('Type \x1b[33mhelp\x1b[0m for available commands.\r\n');
    prompt(term);

    // Key Handler
    term.onKey(({ key, domEvent }) => {
      const charCode = domEvent.keyCode;
      
      if (charCode === 13) { // Enter
        term.write('\r\n');
        handleCommand(term, inputBuffer); // We need to access the buffer from state ref if using hooks, but simpler to use a variable for this closures
      } else if (charCode === 8) { // Backspace
        if (inputBuffer.length > 0) {
           term.write('\b \b');
           setInputBuffer(prev => prev.slice(0, -1));
        }
      } else if (charCode >= 32 && charCode <= 126) { // Printable
         term.write(key);
         setInputBuffer(prev => prev + key);
      }
    });

    // Cleanup
    return () => {
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      fitAddonRef.current?.fit();
    };
    window.addEventListener('resize', handleResize);
    // Initial fit after a small delay to ensure container is rendered
    setTimeout(() => handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Active Tab Switch - Refit needed when container becomes visible
  useEffect(() => {
    if (active && fitAddonRef.current) {
      requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      });
    }
  }, [active]);

  // Command Processor (Mock)
  // Note: In a real app, this sends data to WebSocket
  // Here we update a ref or use the closure's state if we can. 
  // IMPORTANT: The `onKey` closure captures the initial `inputBuffer` state if not careful.
  // To fix the closure issue in `useEffect`, we need a mutable ref for the buffer.
  const bufferRef = useRef('');
  
  useEffect(() => {
    bufferRef.current = inputBuffer;
  }, [inputBuffer]);

  const prompt = (term: Terminal) => {
    const cwd = mockFS.getCwd();
    term.write(`\x1b[1;32mroot@nebula\x1b[0m:\x1b[1;34m${cwd}\x1b[0m$ `);
  };

  const handleCommand = (term: Terminal, cmd: string) => {
    // Use the ref value for the actual execution context
    const command = bufferRef.current.trim();
    
    if (command) {
      const parts = command.split(' ');
      const base = parts[0];
      const args = parts.slice(1);

      switch (base) {
        case 'help':
          term.writeln('Available commands: \x1b[33mls, cd, pwd, cat, echo, clear, whoami\x1b[0m');
          term.writeln('Use the \x1b[36mSCP\x1b[0m tab to transfer files.');
          break;
        case 'clear':
          term.clear();
          break;
        case 'ls':
          const files = mockFS.listFiles();
          files.forEach(f => {
            const color = f.isDirectory ? '\x1b[1;34m' : '\x1b[37m';
            term.writeln(`${f.permissions}  root  root  ${f.size.toString().padStart(6)}  ${f.modifiedDate.substring(0, 10)}  ${color}${f.name}\x1b[0m`);
          });
          break;
        case 'pwd':
          term.writeln(mockFS.getCwd());
          break;
        case 'cd':
          const err = mockFS.changeDir(args[0] || '~');
          if (err) term.writeln(`\x1b[31m${err}\x1b[0m`);
          break;
        case 'whoami':
          term.writeln('root');
          break;
        case 'echo':
          term.writeln(args.join(' '));
          break;
        default:
          term.writeln(`\x1b[31mcommand not found: ${base}\x1b[0m`);
      }
    }
    
    setInputBuffer('');
    bufferRef.current = '';
    prompt(term);
  };

  return (
    <div className={`h-full w-full bg-slate-950 p-2 ${active ? 'block' : 'hidden'}`}>
      <div 
        ref={terminalRef} 
        className="h-full w-full rounded-lg overflow-hidden border border-slate-800 shadow-inner"
      />
    </div>
  );
};
import React, { useState } from 'react';
import { ConnectionForm } from './modules/auth/ConnectionForm';
import { TerminalView } from './modules/terminal/TerminalView';
import { ScpManager } from './modules/scp/ScpManager';
import { ConnectionStatus, SSHConnectionConfig, TabView } from './types';
import { TerminalSquare, Files, Settings, LogOut, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

function App() {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [activeTab, setActiveTab] = useState<TabView>(TabView.TERMINAL);
  const [activeConfig, setActiveConfig] = useState<SSHConnectionConfig | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  const handleConnect = (config: SSHConnectionConfig) => {
    setStatus(ConnectionStatus.CONNECTING);
    setActiveConfig(config);
    // The actual socket connection happens inside TerminalView when config is set
  };

  const handleSocketReady = (ws: WebSocket) => {
    setSocket(ws);
    setStatus(ConnectionStatus.CONNECTED);
  };

  const handleDisconnect = () => {
    setStatus(ConnectionStatus.DISCONNECTED);
    setActiveConfig(null);
    if (socket) {
        socket.close();
        setSocket(null);
    }
  };

  if (status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.CONNECTING) {
    // Note: We show the form even during CONNECTING, TerminalView handles the logic in background if we wanted, 
    // but here we keep the UI simple. To actually start the terminal, we need to transition.
    // For this implementation, we simply render the main view immediately if config is set, 
    // letting TerminalView handle the "Connecting..." state visually.
    if (!activeConfig) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]" />
          </div>
          
          <ConnectionForm onConnect={handleConnect} isLoading={false} />
          
          <div className="mt-8 flex items-center gap-2 text-emerald-500/50 text-xs uppercase tracking-widest font-bold">
             <ShieldCheck className="w-4 h-4" />
             <span>Secure WebSocket Tunnel</span>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-6 gap-6 z-10">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <span className="text-white font-bold text-xl">N</span>
        </div>

        <nav className="flex-1 flex flex-col gap-4 w-full px-2">
          <NavButton 
            active={activeTab === TabView.TERMINAL} 
            onClick={() => setActiveTab(TabView.TERMINAL)}
            icon={<TerminalSquare className="w-6 h-6" />}
            label="Term"
          />
          <NavButton 
            active={activeTab === TabView.SCP} 
            onClick={() => setActiveTab(TabView.SCP)}
            icon={<Files className="w-6 h-6" />}
            label="SCP"
          />
        </nav>

        <div className="flex flex-col gap-4 w-full px-2">
          <NavButton 
             active={false}
             onClick={() => {}}
             icon={<Settings className="w-6 h-6" />}
             label="Set"
          />
          <button 
            onClick={handleDisconnect}
            className="w-full aspect-square flex items-center justify-center rounded-xl text-red-500 hover:bg-red-500/10 transition-colors"
            title="Disconnect"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-slate-950">
        {/* Header Bar */}
        <header className="h-12 bg-slate-900/50 border-b border-slate-800 flex items-center justify-between px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-sm font-medium text-slate-300">
              {activeConfig?.username}@{activeConfig?.host}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">
            {activeTab === TabView.TERMINAL ? 'SSH-2.0 via WebSocket' : 'SFTP Subsystem'}
          </div>
        </header>

        {/* View Viewport */}
        <div className="flex-1 relative overflow-hidden">
          <TerminalView 
            active={activeTab === TabView.TERMINAL} 
            config={activeConfig}
            onSocketReady={handleSocketReady}
          />
          <ScpManager 
            active={activeTab === TabView.SCP} 
            socket={socket}
          />
        </div>
      </main>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button
    onClick={onClick}
    className={clsx(
      "w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200 group relative",
      active ? "bg-slate-800 text-emerald-400 shadow-inner" : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
    )}
  >
    {icon}
    {active && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full" />
    )}
  </button>
);

export default App;
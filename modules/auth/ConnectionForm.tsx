import React, { useState } from 'react';
import { SSHConnectionConfig } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Terminal, Lock, Server } from 'lucide-react';

interface ConnectionFormProps {
  onConnect: (config: SSHConnectionConfig) => void;
  isLoading: boolean;
}

export const ConnectionForm: React.FC<ConnectionFormProps> = ({ onConnect, isLoading }) => {
  const [config, setConfig] = useState<SSHConnectionConfig>({
    host: '192.168.1.10',
    port: 22,
    username: 'root',
    password: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(config);
  };

  return (
    <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
          <Terminal className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-white">New Connection</h2>
        <p className="text-slate-400 mt-2">Enter your server details to connect</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Input 
              label="Host" 
              placeholder="e.g. 192.168.1.1" 
              value={config.host}
              onChange={(e) => setConfig({...config, host: e.target.value})}
              required
            />
          </div>
          <div>
            <Input 
              label="Port" 
              placeholder="22" 
              type="number"
              value={config.port}
              onChange={(e) => setConfig({...config, port: parseInt(e.target.value)})}
              required
            />
          </div>
        </div>

        <Input 
          label="Username" 
          placeholder="root" 
          value={config.username}
          onChange={(e) => setConfig({...config, username: e.target.value})}
          required
          icon={<Server className="w-4 h-4" />}
        />

        <Input 
          label="Password" 
          type="password" 
          placeholder="••••••••" 
          value={config.password}
          onChange={(e) => setConfig({...config, password: e.target.value})}
          icon={<Lock className="w-4 h-4" />}
        />

        <div className="pt-4">
          <Button 
            type="submit" 
            className="w-full shadow-lg shadow-emerald-900/20" 
            isLoading={isLoading}
            size="lg"
          >
            Connect to Server
          </Button>
        </div>

        <p className="text-xs text-center text-slate-500 mt-4">
          By connecting, you agree to the mock SSH simulation protocols.
        </p>
      </form>
    </div>
  );
};
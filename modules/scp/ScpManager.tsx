import React, { useState, useEffect } from 'react';
import { FileEntry } from '../../types';
import { Folder, FileText, ArrowRight, ArrowLeft, RefreshCw, HardDrive, Server, Home } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ScpManagerProps {
  active: boolean;
  socket: WebSocket | null;
}

export const ScpManager: React.FC<ScpManagerProps> = ({ active, socket }) => {
  const [remotePath, setRemotePath] = useState('/');
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localFiles] = useState<FileEntry[]>([
    { name: 'Downloads', isDirectory: true, size: 0, permissions: 'drwxr-xr-x', modifiedDate: new Date().toISOString(), path: '/local/Downloads' },
    { name: 'Documents', isDirectory: true, size: 0, permissions: 'drwxr-xr-x', modifiedDate: new Date().toISOString(), path: '/local/Documents' },
    { name: 'key.pem', isDirectory: false, size: 2048, permissions: '-r--------', modifiedDate: new Date().toISOString(), path: '/local/key.pem' },
  ]);

  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);

  // Listen for SFTP messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SFTP_LIST') {
          setRemoteFiles(msg.files);
          setRemotePath(msg.path);
          setIsLoading(false);
        } else if (msg.type === 'SFTP_ERROR') {
          setError(msg.message);
          setIsLoading(false);
        }
      } catch (e) {
        // ignore non-json
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket]);

  const refreshRemote = (path: string = remotePath) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      setIsLoading(true);
      setError(null);
      socket.send(JSON.stringify({ type: 'SFTP_LIST', path }));
    } else {
      setError("No active connection");
    }
  };

  useEffect(() => {
    if (active) {
      refreshRemote(remotePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleRemoteNavigate = (entry: FileEntry) => {
    if (entry.isDirectory) {
      refreshRemote(entry.path);
      setSelectedRemote(null);
    }
  };

  const handleGoUp = () => {
    const parts = remotePath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    refreshRemote(newPath);
  };

  const FileList = ({ 
    files, 
    title, 
    icon, 
    selected, 
    onSelect, 
    onNavigate,
    path,
    isRemote
  }: { 
    files: FileEntry[], 
    title: string, 
    icon: React.ReactNode,
    selected: string | null,
    onSelect: (id: string) => void,
    onNavigate?: (f: FileEntry) => void,
    path: string,
    isRemote?: boolean
  }) => (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-xs text-slate-500 font-mono truncate max-w-[150px]" title={path}>{path}</span>
      </div>
      
      {/* Navigation Toolbar for Remote */}
      {isRemote && (
        <div className="px-2 py-1 bg-slate-800/50 flex gap-2 border-b border-slate-700">
           <button onClick={() => refreshRemote('/')} className="p-1 hover:bg-slate-700 rounded text-slate-400"><Home className="w-3 h-3"/></button>
           <button onClick={handleGoUp} disabled={path==='/'} className="p-1 hover:bg-slate-700 rounded text-slate-400 disabled:opacity-30">..</button>
           <button onClick={() => refreshRemote()} className="p-1 hover:bg-slate-700 rounded text-slate-400"><RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`}/></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1 relative">
        {error && isRemote && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-900/90 z-10 text-red-400 text-center text-sm">
            {error}
          </div>
        )}
        
        {files.map((file, idx) => (
          <div 
            key={idx}
            onClick={() => onSelect(file.name)}
            onDoubleClick={() => onNavigate && onNavigate(file)}
            className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${selected === file.name ? 'bg-emerald-900/30 border border-emerald-500/30' : 'hover:bg-slate-800 border border-transparent'}`}
          >
            {file.isDirectory ? (
              <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${selected === file.name ? 'text-emerald-400' : 'text-slate-300'}`}>{file.name}</p>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{file.size > 0 ? (file.size / 1024).toFixed(1) + ' KB' : '--'}</span>
                <span>{file.permissions}</span>
              </div>
            </div>
          </div>
        ))}
        {files.length === 0 && !isLoading && (
          <div className="text-center text-slate-600 text-xs mt-10">Folder is empty</div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`h-full flex flex-col p-6 gap-6 ${active ? 'block' : 'hidden'}`}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-200">File Transfer (SCP/SFTP)</h2>
      </div>

      <div className="flex-1 grid grid-cols-[1fr,auto,1fr] gap-4 min-h-0">
        {/* Local Pane */}
        <FileList 
          title="Local (Browser)" 
          path="/local"
          icon={<HardDrive className="w-4 h-4 text-blue-400"/>}
          files={localFiles} 
          selected={selectedLocal} 
          onSelect={setSelectedLocal}
        />

        {/* Actions Pane */}
        <div className="flex flex-col justify-center gap-4">
          <Button 
            disabled={true} 
            className="p-3 opacity-50 cursor-not-allowed"
            title="Upload (Coming Soon in Real Mode)"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button 
            disabled={true} 
            className="p-3 opacity-50 cursor-not-allowed"
            title="Download (Coming Soon in Real Mode)"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>

        {/* Remote Pane */}
        <FileList 
          title="Remote (Server)" 
          path={remotePath}
          icon={<Server className="w-4 h-4 text-emerald-400"/>}
          files={remoteFiles} 
          selected={selectedRemote} 
          onSelect={setSelectedRemote}
          onNavigate={handleRemoteNavigate}
          isRemote={true}
        />
      </div>
    </div>
  );
};
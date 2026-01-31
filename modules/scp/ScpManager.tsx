import React, { useState, useEffect } from 'react';
import { FileEntry } from '../../types';
import { mockFS } from '../../services/mockBackend';
import { Folder, FileText, ArrowRight, ArrowLeft, RefreshCw, HardDrive, Server } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ScpManagerProps {
  active: boolean;
}

export const ScpManager: React.FC<ScpManagerProps> = ({ active }) => {
  const [remotePath, setRemotePath] = useState('/');
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([]);
  const [localFiles] = useState<FileEntry[]>([
    // Mock local browser files
    { name: 'Downloads', isDirectory: true, size: 0, permissions: 'drwxr-xr-x', modifiedDate: new Date().toISOString(), path: '/local/Downloads' },
    { name: 'Documents', isDirectory: true, size: 0, permissions: 'drwxr-xr-x', modifiedDate: new Date().toISOString(), path: '/local/Documents' },
    { name: 'backup_2024.zip', isDirectory: false, size: 24500000, permissions: '-rw-r--r--', modifiedDate: new Date().toISOString(), path: '/local/backup.zip' },
    { name: 'avatar.png', isDirectory: false, size: 10240, permissions: '-rw-r--r--', modifiedDate: new Date().toISOString(), path: '/local/avatar.png' },
  ]);

  const [selectedLocal, setSelectedLocal] = useState<string | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  // Sync Remote Files with Mock FS
  const refreshRemote = () => {
    // In a real app, mockFS wouldn't be globally stateful in this way relative to the terminal, 
    // but for the demo, we assume the SCP client navigates independently or fetches current path
    const files = mockFS.listFiles(); 
    const current = mockFS.getCwd();
    setRemotePath(current);
    setRemoteFiles(files);
  };

  useEffect(() => {
    if (active) {
      refreshRemote();
    }
  }, [active]);

  const handleRemoteNavigate = (entry: FileEntry) => {
    if (entry.isDirectory) {
      mockFS.changeDir(entry.name);
      refreshRemote();
      setSelectedRemote(null);
    }
  };

  const handleTransfer = (direction: 'upload' | 'download') => {
    setTransferring(true);
    // Simulate network delay
    setTimeout(() => {
      setTransferring(false);
      // In a real app, we'd actually move data. Here we just clear selection.
      setSelectedLocal(null);
      setSelectedRemote(null);
      alert(`${direction === 'upload' ? 'Upload' : 'Download'} complete!`);
    }, 1500);
  };

  const FileList = ({ 
    files, 
    title, 
    icon, 
    selected, 
    onSelect, 
    onNavigate,
    path
  }: { 
    files: FileEntry[], 
    title: string, 
    icon: React.ReactNode,
    selected: string | null,
    onSelect: (id: string) => void,
    onNavigate?: (f: FileEntry) => void,
    path: string
  }) => (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-medium">
          {icon}
          <span>{title}</span>
        </div>
        <span className="text-xs text-slate-500 font-mono truncate max-w-[150px]">{path}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {path !== '/' && onNavigate && (
           <div 
             className="flex items-center gap-3 p-2 rounded hover:bg-slate-800 cursor-pointer text-slate-400"
             onClick={() => mockFS.changeDir('..') && refreshRemote()} // Quick hack for ..
           >
             <Folder className="w-4 h-4" />
             <span className="text-sm">..</span>
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
              <Folder className="w-4 h-4 text-amber-400" />
            ) : (
              <FileText className="w-4 h-4 text-slate-400" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${selected === file.name ? 'text-emerald-400' : 'text-slate-300'}`}>{file.name}</p>
              <p className="text-[10px] text-slate-500">{file.size > 0 ? (file.size / 1024).toFixed(1) + ' KB' : '--'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`h-full flex flex-col p-6 gap-6 ${active ? 'block' : 'hidden'}`}>
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-200">File Transfer (SCP)</h2>
        <Button size="sm" variant="secondary" onClick={refreshRemote}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
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
            disabled={!selectedLocal || transferring} 
            onClick={() => handleTransfer('upload')}
            className="p-3"
            title="Upload"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button 
            disabled={!selectedRemote || transferring} 
            onClick={() => handleTransfer('download')}
            className="p-3"
            title="Download"
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
        />
      </div>
      
      {transferring && (
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full">
           <div className="h-full bg-emerald-500 animate-pulse w-2/3 rounded-full"></div>
        </div>
      )}
    </div>
  );
};
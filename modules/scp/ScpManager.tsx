import React, { useState, useEffect, useRef } from 'react';
import { FileEntry, TransferStatus } from '../../types';
import { Folder, FileText, ArrowUp, RefreshCw, Server, Home, Edit3, Save, X, UploadCloud, FileCode } from 'lucide-react';
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
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  
  // Editor State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Transfer State
  const [transfer, setTransfer] = useState<TransferStatus>({ isActive: false, type: 'upload', filename: '', progress: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          setIsSaving(false);
        } else if (msg.type === 'SFTP_FILE_CONTENT') {
          setEditorContent(msg.content);
          setEditorOpen(true);
          setIsLoading(false);
        } else if (msg.type === 'SFTP_SAVED') {
          setIsSaving(false);
          // Optional: Show success toast
          setEditorOpen(false); // Close on save success
          refreshRemote(remotePath);
        } else if (msg.type === 'TRANSFER_PROGRESS') {
           setTransfer({
             isActive: msg.percent < 100,
             type: msg.kind,
             filename: msg.filename,
             progress: msg.percent
           });
           if(msg.percent === 100) refreshRemote(remotePath);
        }
      } catch (e) {
        // ignore non-json
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, remotePath]);

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
    } else {
      handleEditFile(entry);
    }
  };

  const handleGoUp = () => {
    const parts = remotePath.split('/').filter(Boolean);
    parts.pop();
    const newPath = '/' + parts.join('/');
    refreshRemote(newPath);
  };

  const handleEditFile = (file: FileEntry) => {
    if (file.size > 100 * 1024) {
      alert("File too large to edit in browser (Limit: 100KB)");
      return;
    }
    setEditingFile(file);
    setIsLoading(true);
    socket?.send(JSON.stringify({ type: 'SFTP_READ_FILE', path: file.path }));
  };

  const handleSaveFile = () => {
    if (!editingFile) return;
    setIsSaving(true);
    socket?.send(JSON.stringify({ type: 'SFTP_SAVE_FILE', path: editingFile.path, content: editorContent }));
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple Base64 Upload (Not efficient for huge files, but works for basic usage)
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setTransfer({ isActive: true, type: 'upload', filename: file.name, progress: 0 });
        socket?.send(JSON.stringify({ 
            type: 'SFTP_UPLOAD', 
            path: remotePath, 
            filename: file.name, 
            content: base64 
        }));
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className={`h-full flex flex-col p-6 gap-6 ${active ? 'block' : 'hidden'} relative`}>
      <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-500" />
            File Manager
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">{remotePath}</p>
        </div>
        
        <div className="flex gap-2">
           <Button onClick={triggerUpload} variant="secondary" size="sm" className="gap-2">
              <UploadCloud className="w-4 h-4" /> Upload
           </Button>
           <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {/* Progress Bar */}
      {transfer.isActive && (
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 animate-in fade-in slide-in-from-top-2">
           <div className="flex justify-between text-xs text-slate-300 mb-2">
              <span className="flex items-center gap-2">
                 {transfer.type === 'upload' ? <ArrowUp className="w-3 h-3 text-blue-400"/> : <ArrowUp className="w-3 h-3 rotate-180 text-green-400"/>}
                 {transfer.type === 'upload' ? 'Uploading' : 'Downloading'} <span className="font-bold text-white">{transfer.filename}</span>
              </span>
              <span>{transfer.progress}%</span>
           </div>
           <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                style={{ width: `${transfer.progress}%` }}
              />
           </div>
        </div>
      )}

      {/* Main File List */}
      <div className="flex-1 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl">
        {/* Toolbar */}
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
           <button onClick={() => refreshRemote('/')} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors" title="Root"><Home className="w-4 h-4"/></button>
           <div className="h-4 w-[1px] bg-slate-700 mx-1"></div>
           <button onClick={handleGoUp} disabled={remotePath==='/'} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 disabled:opacity-30 font-mono text-lg leading-none pb-3" title="Up">..</button>
           <button onClick={() => refreshRemote()} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors ml-auto"><RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}/></button>
        </div>

        <div className="flex-1 overflow-y-auto relative">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
                 <X className="w-4 h-4"/> {error}
              </div>
            </div>
          )}
          
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800/50 text-slate-400 font-medium sticky top-0 backdrop-blur-md">
              <tr>
                <th className="px-4 py-3 font-medium w-8"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium w-24">Size</th>
                <th className="px-4 py-3 font-medium w-24">Perms</th>
                <th className="px-4 py-3 font-medium w-40">Modified</th>
                <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {remoteFiles.map((file, idx) => (
                <tr 
                  key={idx}
                  onDoubleClick={() => handleRemoteNavigate(file)}
                  className={`group hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedRemote === file.name ? 'bg-slate-800' : ''}`}
                  onClick={() => setSelectedRemote(file.name)}
                >
                  <td className="px-4 py-3">
                     {file.isDirectory ? <Folder className="w-4 h-4 text-amber-400" /> : <FileCode className="w-4 h-4 text-slate-500" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-200 group-hover:text-white">{file.name}</td>
                  <td className="px-4 py-3 text-slate-500">{file.isDirectory ? '--' : (file.size / 1024).toFixed(1) + ' KB'}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{file.permissions}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(file.modifiedDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {!file.isDirectory && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleEditFile(file); }}
                            className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {remoteFiles.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
                <Folder className="w-8 h-8 opacity-20"/>
                <span>Directory is empty</span>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {editorOpen && editingFile && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
                  <div className="flex items-center gap-3">
                      <FileCode className="w-5 h-5 text-emerald-400" />
                      <div>
                          <h3 className="text-sm font-bold text-slate-200">Editing: {editingFile.name}</h3>
                          <p className="text-xs text-slate-500">{editingFile.path}</p>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <Button variant="secondary" size="sm" onClick={() => setEditorOpen(false)}>Cancel</Button>
                      <Button variant="primary" size="sm" onClick={handleSaveFile} isLoading={isSaving} className="gap-2">
                          <Save className="w-4 h-4"/> Save Changes
                      </Button>
                  </div>
              </div>
              <div className="flex-1 relative">
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    className="w-full h-full bg-[#0d1117] text-slate-300 font-mono text-sm p-6 focus:outline-none resize-none leading-relaxed"
                    spellCheck={false}
                  />
              </div>
          </div>
      )}
    </div>
  );
};
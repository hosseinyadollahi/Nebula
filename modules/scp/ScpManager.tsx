import React, { useState, useEffect, useRef } from 'react';
import { FileEntry, TransferStatus } from '../../types';
import { 
  Folder, FileText, ArrowUp, RefreshCw, Server, Home, 
  Edit3, Save, X, UploadCloud, FileCode, MoreVertical, 
  Download, Trash2, FolderPlus, FilePlus, Archive, Move
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ScpManagerProps {
  active: boolean;
  socket: WebSocket | null;
}

type SortField = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';

export const ScpManager: React.FC<ScpManagerProps> = ({ active, socket }) => {
  const [remotePath, setRemotePath] = useState('/');
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  
  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Editor State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New Item State
  const [createModalOpen, setCreateModalOpen] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  // Transfer State
  const [transfer, setTransfer] = useState<TransferStatus>({ isActive: false, type: 'upload', filename: '', progress: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- WebSocket Handling ---
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
        } else if (msg.type === 'SFTP_DOWNLOAD_READY') {
          // Trigger browser download
          triggerBrowserDownload(msg.filename, msg.content);
          setIsLoading(false);
        } else if (msg.type === 'SFTP_SAVED') {
          setIsSaving(false);
          setEditorOpen(false);
          refreshRemote(remotePath);
        } else if (msg.type === 'SFTP_ACTION_SUCCESS') {
          // Generic success (mkdir, delete, zip, unzip)
          setIsLoading(false);
          setCreateModalOpen(null);
          setNewItemName('');
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
      } catch (e) { }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, remotePath]);

  // --- Actions ---

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
    if (active) refreshRemote(remotePath);
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

  const navigateToPath = (path: string) => {
      refreshRemote(path);
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleEditFile = (file: FileEntry) => {
    if (file.size > 500 * 1024) { // 500KB limit for edit
      if(confirm("File is large. Download instead?")) {
          handleDownload(file);
      }
      return;
    }
    setEditingFile(file);
    setIsLoading(true);
    socket?.send(JSON.stringify({ type: 'SFTP_READ_FILE', path: file.path }));
  };

  const handleDownload = (file: FileEntry) => {
      setIsLoading(true);
      socket?.send(JSON.stringify({ type: 'SFTP_READ_FILE', path: file.path, isDownload: true }));
  }

  const triggerBrowserDownload = (filename: string, base64Content: string) => {
      const link = document.createElement('a');
      link.href = `data:application/octet-stream;base64,${base64Content}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleSaveFile = () => {
    if (!editingFile) return;
    setIsSaving(true);
    socket?.send(JSON.stringify({ type: 'SFTP_SAVE_FILE', path: editingFile.path, content: editorContent }));
  };

  const handleCreate = () => {
      if(!newItemName.trim()) return;
      const fullPath = remotePath === '/' ? `/${newItemName}` : `${remotePath}/${newItemName}`;
      
      setIsLoading(true);
      if(createModalOpen === 'folder') {
          socket?.send(JSON.stringify({ type: 'SFTP_MKDIR', path: fullPath }));
      } else {
          // Create empty file
          socket?.send(JSON.stringify({ type: 'SFTP_SAVE_FILE', path: fullPath, content: '' }));
      }
  }

  const handleDelete = (file: FileEntry) => {
      if(confirm(`Are you sure you want to delete ${file.name}?`)) {
          setIsLoading(true);
          socket?.send(JSON.stringify({ type: 'SFTP_DELETE', path: file.path }));
      }
  }

  const handleZip = (file: FileEntry) => {
      setIsLoading(true);
      // zip -r name.zip name
      const cmd = `cd "${remotePath}" && zip -r "${file.name}.zip" "${file.name}"`;
      socket?.send(JSON.stringify({ type: 'SFTP_EXEC', command: cmd }));
  }

  const handleUnzip = (file: FileEntry) => {
      setIsLoading(true);
      const cmd = `cd "${remotePath}" && unzip "${file.name}"`;
      socket?.send(JSON.stringify({ type: 'SFTP_EXEC', command: cmd }));
  }

  // --- Helpers ---
  const sortedFiles = [...remoteFiles].sort((a, b) => {
    let res = 0;
    if (sortField === 'name') res = a.name.localeCompare(b.name);
    else if (sortField === 'size') res = a.size - b.size;
    else if (sortField === 'modified') res = new Date(a.modifiedDate).getTime() - new Date(b.modifiedDate).getTime();
    
    // Always keep folders on top
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    
    return sortDir === 'asc' ? res : -res;
  });

  const pathParts = remotePath.split('/').filter(Boolean);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setTransfer({ isActive: true, type: 'upload', filename: file.name, progress: 0 });
        socket?.send(JSON.stringify({ type: 'SFTP_UPLOAD', path: remotePath, filename: file.name, content: base64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={`h-full flex flex-col p-4 md:p-6 gap-4 ${active ? 'block' : 'hidden'} relative`}>
      
      {/* --- Top Bar: Breadcrumbs & Actions --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800 gap-3">
        {/* Breadcrumbs */}
        <div className="flex items-center flex-wrap gap-1 text-sm font-mono text-slate-300">
           <button onClick={() => navigateToPath('/')} className="hover:bg-slate-700 p-1 rounded transition-colors text-emerald-500">
             <Server className="w-4 h-4" />
           </button>
           <span className="text-slate-600">/</span>
           {pathParts.map((part, index) => {
               const fullPath = '/' + pathParts.slice(0, index + 1).join('/');
               return (
                   <React.Fragment key={index}>
                       <button onClick={() => navigateToPath(fullPath)} className="hover:text-white hover:underline decoration-emerald-500 underline-offset-4 px-1 rounded transition-colors">
                           {part}
                       </button>
                       {index < pathParts.length - 1 && <span className="text-slate-600">/</span>}
                   </React.Fragment>
               )
           })}
        </div>
        
        {/* Toolbar */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
           <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
           <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm" className="gap-2 whitespace-nowrap">
              <UploadCloud className="w-4 h-4" /> Upload
           </Button>
           <div className="w-[1px] h-6 bg-slate-700 mx-1"></div>
           <Button onClick={() => setCreateModalOpen('folder')} variant="ghost" size="sm" title="New Folder">
               <FolderPlus className="w-5 h-5 text-amber-400" />
           </Button>
           <Button onClick={() => setCreateModalOpen('file')} variant="ghost" size="sm" title="New File">
               <FilePlus className="w-5 h-5 text-blue-400" />
           </Button>
           <Button onClick={() => refreshRemote()} variant="ghost" size="sm" title="Refresh">
               <RefreshCw className={`w-4 h-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
           </Button>
        </div>
      </div>

      {/* --- Progress Bar --- */}
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

      {/* --- File List Table --- */}
      <div className="flex-1 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col shadow-2xl relative">
        {error && (
            <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white px-4 py-2 z-20 flex justify-between items-center text-sm">
              <span>{error}</span>
              <button onClick={() => setError(null)}><X className="w-4 h-4"/></button>
            </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-800/80 text-slate-400 font-medium sticky top-0 backdrop-blur-md z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-medium w-10">Type</th>
                <th className="px-4 py-3 font-medium cursor-pointer hover:text-white select-none group" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Name {sortField === 'name' && <span className="text-emerald-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-4 py-3 font-medium w-24 cursor-pointer hover:text-white select-none" onClick={() => handleSort('size')}>
                    <div className="flex items-center gap-1">Size {sortField === 'size' && <span className="text-emerald-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-4 py-3 font-medium w-32 cursor-pointer hover:text-white select-none hidden md:table-cell" onClick={() => handleSort('modified')}>
                    <div className="flex items-center gap-1">Modified {sortField === 'modified' && <span className="text-emerald-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}</div>
                </th>
                <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {remotePath !== '/' && (
                  <tr onClick={() => {
                      const parts = remotePath.split('/').filter(Boolean);
                      parts.pop();
                      navigateToPath('/' + parts.join('/'));
                  }} className="hover:bg-slate-800/50 cursor-pointer">
                      <td className="px-4 py-2"><Folder className="w-4 h-4 text-slate-500"/></td>
                      <td className="px-4 py-2 text-slate-400 font-mono">..</td>
                      <td colSpan={3}></td>
                  </tr>
              )}
              {sortedFiles.map((file, idx) => (
                <tr 
                  key={idx}
                  onDoubleClick={() => handleRemoteNavigate(file)}
                  className={`group hover:bg-slate-800/50 transition-colors cursor-pointer ${selectedRemote === file.name ? 'bg-slate-800' : ''}`}
                  onClick={() => setSelectedRemote(file.name)}
                >
                  <td className="px-4 py-3">
                     {file.isDirectory ? <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" /> : <FileCode className="w-4 h-4 text-blue-400" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-200 group-hover:text-white">{file.name}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{file.isDirectory ? '--' : (file.size / 1024 < 1024 ? (file.size / 1024).toFixed(1) + ' KB' : (file.size / (1024*1024)).toFixed(1) + ' MB')}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">{new Date(file.modifiedDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right relative">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!file.isDirectory && (
                             <button onClick={(e) => { e.stopPropagation(); handleDownload(file); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400" title="Download">
                                <Download className="w-3.5 h-3.5"/>
                             </button>
                        )}
                        {file.name.endsWith('.zip') && (
                            <button onClick={(e) => { e.stopPropagation(); handleUnzip(file); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-purple-400" title="Unzip">
                                <Archive className="w-3.5 h-3.5"/>
                            </button>
                        )}
                        {file.isDirectory && (
                            <button onClick={(e) => { e.stopPropagation(); handleZip(file); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-purple-400" title="Zip Folder">
                                <Archive className="w-3.5 h-3.5"/>
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(file); }} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400" title="Delete">
                            <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {sortedFiles.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600 gap-2">
                <Folder className="w-10 h-10 opacity-20"/>
                <span>Empty Directory</span>
            </div>
          )}
        </div>
      </div>

      {/* --- Editor Modal --- */}
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

      {/* --- Create Modal --- */}
      {createModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold text-white mb-4">Create New {createModalOpen === 'folder' ? 'Folder' : 'File'}</h3>
                  <input 
                    type="text" 
                    placeholder={createModalOpen === 'folder' ? "Folder Name" : "File Name (e.g., script.js)"}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-emerald-500 focus:outline-none mb-4"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setCreateModalOpen(null)}>Cancel</Button>
                      <Button onClick={handleCreate} isLoading={isLoading}>Create</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { FileEntry, TransferStatus } from '../../types';
import { 
  Folder, FileText, ArrowUp, RefreshCw, Server, Home, 
  Edit3, Save, X, UploadCloud, FileCode, Search,
  Download, Trash2, FolderPlus, FilePlus, Archive, 
  LayoutGrid, List as ListIcon, MoreHorizontal,
  ChevronRight, HardDrive, Shield, Type, FileImage, FileArchive
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface ScpManagerProps {
  active: boolean;
  socket: WebSocket | null;
}

type SortField = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'grid';

// --- Helper Components ---

const FileIcon = ({ name, isDirectory, size = 'sm' }: { name: string, isDirectory: boolean, size?: 'sm'|'lg' }) => {
  const ext = name.split('.').pop()?.toLowerCase();
  const iconClass = size === 'lg' ? "w-10 h-10" : "w-4 h-4";

  if (isDirectory) return <Folder className={`${iconClass} text-amber-400 fill-amber-400/20`} />;
  
  switch(ext) {
    case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg':
      return <FileImage className={`${iconClass} text-purple-400`} />;
    case 'zip': case 'tar': case 'gz': case 'rar':
      return <FileArchive className={`${iconClass} text-red-400`} />;
    case 'js': case 'ts': case 'py': case 'html': case 'css': case 'json':
      return <FileCode className={`${iconClass} text-blue-400`} />;
    case 'txt': case 'md': case 'log':
      return <FileText className={`${iconClass} text-slate-400`} />;
    default:
      return <FileText className={`${iconClass} text-slate-500`} />;
  }
};

export const ScpManager: React.FC<ScpManagerProps> = ({ active, socket }) => {
  // Navigation & Data
  const [remotePath, setRemotePath] = useState('/');
  const [remoteFiles, setRemoteFiles] = useState<FileEntry[]>([]);
  const [history, setHistory] = useState<string[]>(['/']);
  const [historyIndex, setHistoryIndex] = useState(0);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  // Actions / Modals
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, file: FileEntry} | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [editingFile, setEditingFile] = useState<FileEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [modalType, setModalType] = useState<'createFolder' | 'createFile' | 'rename' | 'permissions' | null>(null);
  const [modalInput, setModalInput] = useState('');
  
  const [transfer, setTransfer] = useState<TransferStatus>({ isActive: false, type: 'upload', filename: '', progress: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Logic ---

  useEffect(() => {
    if (!socket) return;
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        switch(msg.type) {
            case 'SFTP_LIST':
                setRemoteFiles(msg.files);
                setRemotePath(msg.path);
                setIsLoading(false);
                break;
            case 'SFTP_ERROR':
                setError(msg.message);
                setIsLoading(false);
                setIsSaving(false);
                break;
            case 'SFTP_FILE_CONTENT':
                setEditorContent(msg.content);
                setEditorOpen(true);
                setIsLoading(false);
                break;
            case 'SFTP_DOWNLOAD_READY':
                triggerBrowserDownload(msg.filename, msg.content);
                setIsLoading(false);
                break;
            case 'SFTP_SAVED':
                setIsSaving(false);
                setEditorOpen(false);
                refreshRemote(remotePath);
                break;
            case 'SFTP_ACTION_SUCCESS':
                setIsLoading(false);
                setModalType(null);
                setModalInput('');
                refreshRemote(remotePath);
                break;
            case 'TRANSFER_PROGRESS':
                setTransfer({
                    isActive: msg.percent < 100,
                    type: msg.kind,
                    filename: msg.filename,
                    progress: msg.percent
                });
                if(msg.percent === 100) refreshRemote(remotePath);
                break;
        }
      } catch (e) { }
    };
    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket, remotePath]);

  const refreshRemote = (path: string = remotePath) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      setIsLoading(true);
      setError(null);
      socket.send(JSON.stringify({ type: 'SFTP_LIST', path }));
    }
  };

  useEffect(() => {
    if (active) refreshRemote(remotePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // --- Handlers ---

  const navigate = (path: string) => {
      refreshRemote(path);
      // Simple history tracking (imperfect but functional)
      setHistory(prev => [...prev, path]);
      setHistoryIndex(prev => prev + 1);
  }

  const handleFileAction = (file: FileEntry) => {
      if (file.isDirectory) {
          navigate(file.path);
          setSelectedFile(null);
      } else {
          handleEdit(file);
      }
  };

  const handleEdit = (file: FileEntry) => {
      if (file.size > 500 * 1024) {
          if(confirm("File > 500KB. Download instead?")) handleDownload(file);
          return;
      }
      setEditingFile(file);
      setIsLoading(true);
      socket?.send(JSON.stringify({ type: 'SFTP_READ_FILE', path: file.path }));
  };

  const handleDownload = (file: FileEntry) => {
      setIsLoading(true);
      socket?.send(JSON.stringify({ type: 'SFTP_READ_FILE', path: file.path, isDownload: true }));
  };

  const triggerBrowserDownload = (filename: string, base64Content: string) => {
      const link = document.createElement('a');
      link.href = `data:application/octet-stream;base64,${base64Content}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleContextMenu = (e: React.MouseEvent, file: FileEntry) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, file });
      setSelectedFile(file);
  };

  const executeModalAction = () => {
      if(!modalInput) return;
      setIsLoading(true);
      
      const current = selectedFile || { path: remotePath, name: '' } as FileEntry;
      
      switch(modalType) {
          case 'createFolder':
              const dirPath = remotePath === '/' ? `/${modalInput}` : `${remotePath}/${modalInput}`;
              socket?.send(JSON.stringify({ type: 'SFTP_MKDIR', path: dirPath }));
              break;
          case 'createFile':
              const filePath = remotePath === '/' ? `/${modalInput}` : `${remotePath}/${modalInput}`;
              socket?.send(JSON.stringify({ type: 'SFTP_SAVE_FILE', path: filePath, content: '' }));
              break;
          case 'rename':
              const newPath = current.path.substring(0, current.path.lastIndexOf('/')) + '/' + modalInput;
              socket?.send(JSON.stringify({ type: 'SFTP_RENAME', oldPath: current.path, newPath }));
              break;
          case 'permissions':
              socket?.send(JSON.stringify({ type: 'SFTP_CHMOD', path: current.path, mode: modalInput }));
              break;
      }
  };

  const handleDelete = (file: FileEntry) => {
      if(confirm(`Permanently delete ${file.name}?`)) {
          setIsLoading(true);
          socket?.send(JSON.stringify({ type: 'SFTP_DELETE', path: file.path }));
      }
  };

  const handleZip = (file: FileEntry) => {
      setIsLoading(true);
      const cmd = `cd "${remotePath}" && zip -r "${file.name}.zip" "${file.name}"`;
      socket?.send(JSON.stringify({ type: 'SFTP_EXEC', command: cmd }));
  };

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

  // --- Filtering & Sorting ---
  const filteredFiles = remoteFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedFiles = [...filteredFiles].sort((a, b) => {
      let res = 0;
      if (sortField === 'name') res = a.name.localeCompare(b.name);
      else if (sortField === 'size') res = a.size - b.size;
      else if (sortField === 'modified') res = new Date(a.modifiedDate).getTime() - new Date(b.modifiedDate).getTime();
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return sortDir === 'asc' ? res : -res;
  });

  return (
    <div className={`h-full flex flex-col bg-slate-950 ${active ? 'flex' : 'hidden'} text-slate-200 select-none`} onClick={() => setContextMenu(null)}>
      
      {/* --- Toolbar --- */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-2">
            <h1 className="font-bold text-lg text-emerald-500 mr-4 tracking-tight">File Manager</h1>
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode==='grid' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid className="w-4 h-4"/></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode==='list' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><ListIcon className="w-4 h-4"/></button>
            </div>
            <div className="h-6 w-[1px] bg-slate-800 mx-2"/>
            <button onClick={() => navigate(remotePath.split('/').slice(0,-1).join('/') || '/')} disabled={remotePath==='/'} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 disabled:opacity-30"><ArrowUp className="w-4 h-4"/></button>
            <button onClick={() => refreshRemote()} className={`p-2 hover:bg-slate-800 rounded-lg text-slate-400 ${isLoading?'animate-spin':''}`}><RefreshCw className="w-4 h-4"/></button>
        </div>

        <div className="flex-1 max-w-xl mx-4 relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-4 w-4 text-slate-500" /></div>
             <input type="text" placeholder="Search current folder..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-lg leading-5 bg-slate-950 text-slate-300 placeholder-slate-500 focus:outline-none focus:border-emerald-500 sm:text-sm transition-colors"/>
        </div>

        <div className="flex items-center gap-2">
            <Button onClick={() => { setModalType('createFolder'); setModalInput(''); }} variant="secondary" size="sm" className="gap-2 hidden md:flex"><FolderPlus className="w-4 h-4"/> New Folder</Button>
            <Button onClick={() => { setModalType('createFile'); setModalInput(''); }} variant="secondary" size="sm" className="gap-2 hidden md:flex"><FilePlus className="w-4 h-4"/> New File</Button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
            <Button onClick={() => fileInputRef.current?.click()} size="sm" className="gap-2"><UploadCloud className="w-4 h-4"/> Upload</Button>
        </div>
      </div>

      {/* --- Main Area --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar (Quick Access) */}
        <div className="w-48 bg-slate-900/50 border-r border-slate-800 flex-col py-4 gap-1 hidden md:flex">
            <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Places</div>
            {[
                { name: 'Root', path: '/', icon: Server },
                { name: 'Home', path: '/home', icon: Home },
                { name: 'Var', path: '/var', icon: HardDrive },
                { name: 'Etc', path: '/etc', icon: Shield },
            ].map(place => (
                <button key={place.path} onClick={() => navigate(place.path)} className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${remotePath.startsWith(place.path) && place.path !== '/' ? 'bg-slate-800 text-emerald-400 border-r-2 border-emerald-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}>
                    <place.icon className="w-4 h-4"/> {place.name}
                </button>
            ))}
        </div>

        {/* File View */}
        <div className="flex-1 flex flex-col bg-[#0b101e] relative">
            
            {/* Breadcrumbs */}
            <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-1 text-sm text-slate-400 overflow-hidden bg-slate-900/30">
                <span className="text-slate-600">Location:</span>
                {remotePath.split('/').map((part, i, arr) => {
                    const path = '/' + arr.slice(1, i + 1).join('/');
                    return (
                        <React.Fragment key={i}>
                            {i > 0 && <ChevronRight className="w-3 h-3 opacity-50"/>}
                            <button onClick={() => navigate(path || '/')} className="hover:text-white hover:underline decoration-emerald-500 underline-offset-4 truncate max-w-[150px]">
                                {part || 'root'}
                            </button>
                        </React.Fragment>
                    )
                })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4" onContextMenu={e => e.preventDefault()}>
                {/* Upload Progress */}
                {transfer.isActive && (
                    <div className="mb-4 bg-slate-800 rounded border border-slate-700 p-3 flex items-center gap-3 animate-pulse">
                        <UploadCloud className="w-5 h-5 text-blue-400"/>
                        <div className="flex-1">
                            <div className="flex justify-between text-xs mb-1"><span>Uploading {transfer.filename}...</span><span>{transfer.progress}%</span></div>
                            <div className="h-1 bg-slate-700 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{width: `${transfer.progress}%`}}/></div>
                        </div>
                    </div>
                )}
                
                {/* Error Banner */}
                {error && <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded flex items-center gap-2"><X className="w-4 h-4 cursor-pointer" onClick={() => setError(null)}/> {error}</div>}

                {/* Empty State */}
                {sortedFiles.length === 0 && !isLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <Folder className="w-16 h-16 mb-2"/>
                        <span className="text-lg font-medium">Empty Directory</span>
                    </div>
                )}

                {/* GRID VIEW */}
                {viewMode === 'grid' && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-4">
                        {sortedFiles.map((file, i) => (
                            <div 
                                key={i}
                                onDoubleClick={() => handleFileAction(file)}
                                onContextMenu={(e) => handleContextMenu(e, file)}
                                onClick={() => setSelectedFile(file)}
                                className={`group flex flex-col items-center p-3 rounded-xl transition-all border ${selectedFile?.name === file.name ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800 hover:border-slate-700'}`}
                            >
                                <div className="mb-3 transition-transform group-hover:scale-110 duration-200">
                                    <FileIcon name={file.name} isDirectory={file.isDirectory} size="lg"/>
                                </div>
                                <span className="text-xs text-center truncate w-full text-slate-300 group-hover:text-white font-medium">{file.name}</span>
                                <span className="text-[10px] text-slate-500 mt-1">{file.isDirectory ? 'Folder' : (file.size/1024).toFixed(1)+' KB'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* LIST VIEW */}
                {viewMode === 'list' && (
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-900/50 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => { setSortField('name'); setSortDir(sortDir==='asc'?'desc':'asc')}}>Name</th>
                                <th className="px-4 py-3 font-medium w-32 cursor-pointer" onClick={() => { setSortField('size'); setSortDir(sortDir==='asc'?'desc':'asc')}}>Size</th>
                                <th className="px-4 py-3 font-medium w-32 hidden sm:table-cell">Perms</th>
                                <th className="px-4 py-3 font-medium w-40 hidden md:table-cell">Date</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                             {sortedFiles.map((file, i) => (
                                <tr 
                                    key={i} 
                                    onDoubleClick={() => handleFileAction(file)}
                                    onContextMenu={(e) => handleContextMenu(e, file)}
                                    onClick={() => setSelectedFile(file)}
                                    className={`group cursor-pointer transition-colors ${selectedFile?.name === file.name ? 'bg-emerald-500/10' : 'hover:bg-slate-900/60'}`}
                                >
                                    <td className="px-4 py-2 flex items-center gap-3">
                                        <FileIcon name={file.name} isDirectory={file.isDirectory}/>
                                        <span className={`truncate max-w-[200px] md:max-w-md ${selectedFile?.name === file.name ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}>{file.name}</span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-500 font-mono text-xs">{file.isDirectory ? '--' : (file.size/1024).toFixed(1)+' KB'}</td>
                                    <td className="px-4 py-2 text-slate-500 font-mono text-xs hidden sm:table-cell">{file.permissions || '0755'}</td>
                                    <td className="px-4 py-2 text-slate-500 text-xs hidden md:table-cell">{new Date(file.modifiedDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file) }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded text-slate-400"><MoreHorizontal className="w-4 h-4"/></button>
                                    </td>
                                </tr>
                             ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Status Bar */}
            <div className="h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-[10px] text-slate-500 font-mono">
                <div>{sortedFiles.length} items  |  Total size: {(sortedFiles.reduce((acc, curr) => acc + curr.size, 0) / 1024 / 1024).toFixed(2)} MB</div>
                <div>{selectedFile ? `Selected: ${selectedFile.name}` : 'Ready'}</div>
            </div>

        </div>
      </div>

      {/* --- Context Menu --- */}
      {contextMenu && (
          <div 
            className="fixed z-50 bg-slate-800 border border-slate-700 shadow-2xl rounded-lg py-1 w-48 animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
              <div className="px-3 py-2 border-b border-slate-700 mb-1">
                  <div className="font-bold text-slate-200 truncate">{contextMenu.file.name}</div>
                  <div className="text-xs text-slate-500">{contextMenu.file.isDirectory ? 'Directory' : 'File'}</div>
              </div>
              
              {!contextMenu.file.isDirectory && (
                  <button onClick={() => { handleEdit(contextMenu.file); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-emerald-600/20 hover:text-emerald-400 flex items-center gap-2 text-sm"><Edit3 className="w-4 h-4"/> Edit</button>
              )}
              <button onClick={() => { setModalType('rename'); setModalInput(contextMenu.file.name); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-sm"><Type className="w-4 h-4"/> Rename</button>
              <button onClick={() => { setModalType('permissions'); setModalInput('755'); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-sm"><Shield className="w-4 h-4"/> Permissions</button>
              <div className="my-1 border-t border-slate-700"/>
              {!contextMenu.file.isDirectory && <button onClick={() => { handleDownload(contextMenu.file); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-sm"><Download className="w-4 h-4"/> Download</button>}
              <button onClick={() => { handleZip(contextMenu.file); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-sm"><Archive className="w-4 h-4"/> Compress</button>
              <button onClick={() => { handleDelete(contextMenu.file); setContextMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-red-900/30 text-red-400 flex items-center gap-2 text-sm"><Trash2 className="w-4 h-4"/> Delete</button>
          </div>
      )}

      {/* --- Action Modal (Create/Rename/Permissions) --- */}
      {modalType && (
          <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-white mb-1 capitalize">
                      {modalType === 'permissions' ? 'Change Permissions' : modalType.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                      {modalType === 'rename' ? 'Enter the new name for the item.' : modalType === 'permissions' ? 'Enter octal code (e.g. 755).' : 'Enter a name for the new item.'}
                  </p>
                  <input 
                    type="text" 
                    value={modalInput}
                    onChange={(e) => setModalInput(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white focus:border-emerald-500 focus:outline-none mb-4"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && executeModalAction()}
                  />
                  <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => setModalType(null)}>Cancel</Button>
                      <Button onClick={executeModalAction} isLoading={isLoading}>
                          {modalType === 'rename' ? 'Rename' : modalType === 'permissions' ? 'Apply' : 'Create'}
                      </Button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Editor Modal --- */}
      {editorOpen && editingFile && (
          <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900">
                  <div className="flex items-center gap-3">
                      <FileCode className="w-5 h-5 text-emerald-400" />
                      <div>
                          <h3 className="text-sm font-bold text-slate-200">{editingFile.name}</h3>
                          <p className="text-xs text-slate-500">{editingFile.path}</p>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <Button variant="secondary" size="sm" onClick={() => setEditorOpen(false)}>Close</Button>
                      <Button variant="primary" size="sm" onClick={() => { setIsSaving(true); socket?.send(JSON.stringify({ type: 'SFTP_SAVE_FILE', path: editingFile.path, content: editorContent })); }} isLoading={isSaving} className="gap-2">
                          <Save className="w-4 h-4"/> Save
                      </Button>
                  </div>
              </div>
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                className="flex-1 bg-[#0d1117] text-slate-300 font-mono text-sm p-6 focus:outline-none resize-none"
                spellCheck={false}
              />
          </div>
      )}
    </div>
  );
};
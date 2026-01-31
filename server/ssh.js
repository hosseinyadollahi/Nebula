import { Client } from 'ssh2';

export class SSHSession {
  constructor(config, socket) {
    this.conn = new Client();
    this.socket = socket;
    this.config = config;
    this.stream = null;
    this.sftp = null;
  }

  connect() {
    this.conn.on('ready', () => {
      this.socket.send(JSON.stringify({ type: 'STATUS', status: 'CONNECTED' }));
      
      const ptyConfig = {
        rows: 24,
        cols: 80,
        height: 480,
        width: 640,
        term: 'xterm-256color' 
      };

      this.conn.shell(ptyConfig, (err, stream) => {
        if (err) {
          this.socket.send(JSON.stringify({ type: 'ERROR', message: 'Shell Error: ' + err.message }));
          return;
        }
        
        this.stream = stream;

        stream.on('data', (data) => {
          this.socket.send(JSON.stringify({ type: 'TERM_DATA', data: data.toString('utf-8') }));
        });

        stream.on('close', () => {
          this.conn.end();
          this.socket.send(JSON.stringify({ type: 'STATUS', status: 'DISCONNECTED' }));
        });
      });

      this.conn.sftp((err, sftp) => {
        if (err) {
            console.error('SFTP Error:', err);
            return;
        }
        this.sftp = sftp;
      });

    }).on('close', () => {
      this.socket.send(JSON.stringify({ type: 'STATUS', status: 'DISCONNECTED' }));
    }).on('error', (err) => {
      this.socket.send(JSON.stringify({ type: 'ERROR', message: 'Connection Error: ' + err.message }));
    }).connect({
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      readyTimeout: 20000,
      keepaliveInterval: 10000,
    });
  }

  write(data) {
    if (this.stream) {
      this.stream.write(data);
    }
  }

  resize(cols, rows) {
    if (this.stream) {
      this.stream.setWindow(rows, cols, 0, 0);
    }
  }

  // --- SFTP Operations ---

  listFiles(path) {
    if (!this.sftp) return;
    
    this.sftp.readdir(path, (err, list) => {
      if (err) {
        this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: err.message }));
        return;
      }
      
      const files = list.map(item => ({
        name: item.filename,
        isDirectory: item.longname.startsWith('d'),
        size: item.attrs.size,
        permissions: item.longname.split(' ')[0], // ex: drwxr-xr-x
        numericPermissions: '0' + (item.attrs.mode & 0o777).toString(8), // ex: 0755
        modifiedDate: new Date(item.attrs.mtime * 1000).toISOString(),
        path: path === '/' ? `/${item.filename}` : `${path}/${item.filename}`
      }));

      this.socket.send(JSON.stringify({ 
        type: 'SFTP_LIST', 
        path: path, 
        files: files 
      }));
    });
  }

  readFile(path, isDownload = false) {
    if (!this.sftp) return;

    this.sftp.readFile(path, (err, buffer) => {
      if (err) {
        this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Read Failed: ' + err.message }));
        return;
      }
      
      const filename = path.split('/').pop();

      this.socket.send(JSON.stringify({
        type: isDownload ? 'SFTP_DOWNLOAD_READY' : 'SFTP_FILE_CONTENT',
        path: path,
        filename: filename,
        content: buffer.toString(isDownload ? 'base64' : 'utf-8') 
      }));
    });
  }

  saveFile(path, content) {
    if (!this.sftp) return;

    this.sftp.writeFile(path, content, (err) => {
      if (err) {
        this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Save Failed: ' + err.message }));
        return;
      }
      this.socket.send(JSON.stringify({ type: 'SFTP_SAVED', path: path }));
    });
  }

  createDir(path) {
    if (!this.sftp) return;
    this.sftp.mkdir(path, (err) => {
      if (err) {
        this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Mkdir Failed: ' + err.message }));
        return;
      }
      this.socket.send(JSON.stringify({ type: 'SFTP_ACTION_SUCCESS', message: 'Directory created', action: 'mkdir' }));
    });
  }

  deleteEntry(path) {
     if (!this.sftp) return;
     this.sftp.unlink(path, (err) => {
         if (err) {
             this.sftp.rmdir(path, (err2) => {
                 if(err2) {
                    this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Delete Failed: ' + err2.message }));
                 } else {
                    this.socket.send(JSON.stringify({ type: 'SFTP_ACTION_SUCCESS', message: 'Deleted successfully', action: 'delete' }));
                 }
             });
         } else {
             this.socket.send(JSON.stringify({ type: 'SFTP_ACTION_SUCCESS', message: 'Deleted successfully', action: 'delete' }));
         }
     });
  }

  renameEntry(oldPath, newPath) {
    if (!this.sftp) return;
    this.sftp.rename(oldPath, newPath, (err) => {
        if (err) {
            this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Rename Failed: ' + err.message }));
        } else {
            this.socket.send(JSON.stringify({ type: 'SFTP_ACTION_SUCCESS', message: 'Renamed successfully', action: 'rename' }));
        }
    });
  }

  chmodEntry(path, mode) {
    if (!this.sftp) return;
    // mode should be an octal string e.g., "755" or number
    const numericMode = parseInt(mode, 8);
    this.sftp.chmod(path, numericMode, (err) => {
        if (err) {
            this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Chmod Failed: ' + err.message }));
        } else {
            this.socket.send(JSON.stringify({ type: 'SFTP_ACTION_SUCCESS', message: 'Permissions changed', action: 'chmod' }));
        }
    });
  }

  uploadFile(path, filename, contentBase64) {
    if (!this.sftp) return;
    
    const buffer = Buffer.from(contentBase64, 'base64');
    const fullPath = path === '/' ? `/${filename}` : `${path}/${filename}`;
    
    this.socket.send(JSON.stringify({ type: 'TRANSFER_PROGRESS', kind: 'upload', filename, percent: 10 }));
    
    this.sftp.writeFile(fullPath, buffer, (err) => {
        if (err) {
            this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Upload Failed: ' + err.message }));
        } else {
            this.socket.send(JSON.stringify({ type: 'TRANSFER_PROGRESS', kind: 'upload', filename, percent: 100 }));
        }
    });
  }

  execCommand(command) {
    this.conn.exec(command, (err, stream) => {
        if (err) {
            this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Exec error: ' + err.message }));
            return;
        }
        stream.on('close', (code, signal) => {
            if (code === 0) {
                 this.socket.send(JSON.stringify({ type: 'SFTP_ACTION_SUCCESS', message: 'Command executed', action: 'exec' }));
            } else if (code === 127) {
                 this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: `Command not found (code 127). Is the required tool (zip/unzip) installed?` }));
            } else {
                 this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: `Command failed with code ${code}` }));
            }
        }).on('data', (data) => {
            // Consume stdout
        }).stderr.on('data', (data) => {
            // Consume stderr
        });
    });
  }

  disconnect() {
    this.conn.end();
  }
}
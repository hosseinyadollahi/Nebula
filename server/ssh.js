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
        permissions: item.longname.split(' ')[0],
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

  readFile(path) {
    if (!this.sftp) return;

    // Limit file size check (e.g., 1MB for editor) can be added here
    this.sftp.readFile(path, (err, buffer) => {
      if (err) {
        this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Read Failed: ' + err.message }));
        return;
      }
      this.socket.send(JSON.stringify({
        type: 'SFTP_FILE_CONTENT',
        path: path,
        content: buffer.toString('utf-8') // Assuming text file for editor
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

  // Simplified upload simulation for prototype
  // In a real app, you'd use binary streams or fastPut with path
  uploadFile(path, filename, contentBase64) {
    if (!this.sftp) return;
    
    const buffer = Buffer.from(contentBase64, 'base64');
    const fullPath = path === '/' ? `/${filename}` : `${path}/${filename}`;
    
    // Simulate progress
    this.socket.send(JSON.stringify({ type: 'TRANSFER_PROGRESS', kind: 'upload', filename, percent: 10 }));
    
    this.sftp.writeFile(fullPath, buffer, (err) => {
        if (err) {
            this.socket.send(JSON.stringify({ type: 'SFTP_ERROR', message: 'Upload Failed: ' + err.message }));
        } else {
            this.socket.send(JSON.stringify({ type: 'TRANSFER_PROGRESS', kind: 'upload', filename, percent: 100 }));
            // Refresh list
            this.listFiles(path);
        }
    });
  }

  disconnect() {
    this.conn.end();
  }
}
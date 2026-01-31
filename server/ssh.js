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
      
      // Initialize Shell
      this.conn.shell((err, stream) => {
        if (err) {
          this.socket.send(JSON.stringify({ type: 'ERROR', message: 'Shell Error: ' + err.message }));
          return;
        }
        
        this.stream = stream;

        // Data from Server -> Client (Terminal)
        stream.on('data', (data) => {
          this.socket.send(JSON.stringify({ type: 'TERM_DATA', data: data.toString('utf-8') }));
        });

        stream.on('close', () => {
          this.conn.end();
          this.socket.send(JSON.stringify({ type: 'STATUS', status: 'DISCONNECTED' }));
        });
      });

      // Initialize SFTP
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
      // In production, handle private keys and better security options
      readyTimeout: 20000,
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
        permissions: item.longname.split(' ')[0], // simple parsing
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

  disconnect() {
    this.conn.end();
  }
}
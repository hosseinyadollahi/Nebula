import { WebSocketServer } from 'ws';
import { SSHSession } from './ssh.js';

export const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    let sshSession = null;

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);

        switch (msg.type) {
          case 'CONNECT':
            if (sshSession) sshSession.disconnect();
            sshSession = new SSHSession(msg.config, ws);
            sshSession.connect();
            break;

          case 'TERM_INPUT':
            if (sshSession) sshSession.write(msg.data);
            break;

          case 'TERM_RESIZE':
            if (sshSession) sshSession.resize(msg.cols, msg.rows);
            break;

          case 'SFTP_LIST':
             if (sshSession) sshSession.listFiles(msg.path);
             break;
          
          case 'SFTP_READ_FILE':
             if (sshSession) sshSession.readFile(msg.path, msg.isDownload);
             break;

          case 'SFTP_SAVE_FILE':
             if (sshSession) sshSession.saveFile(msg.path, msg.content);
             break;

          case 'SFTP_MKDIR':
             if (sshSession) sshSession.createDir(msg.path);
             break;

          case 'SFTP_DELETE':
             if (sshSession) sshSession.deleteEntry(msg.path);
             break;

          case 'SFTP_RENAME':
             if (sshSession) sshSession.renameEntry(msg.oldPath, msg.newPath);
             break;
          
          case 'SFTP_CHMOD':
             if (sshSession) sshSession.chmodEntry(msg.path, msg.mode);
             break;
          
          case 'SFTP_EXEC':
             if (sshSession) sshSession.execCommand(msg.command);
             break;

          case 'SFTP_UPLOAD':
             if (sshSession) sshSession.uploadFile(msg.path, msg.filename, msg.content);
             break;

          case 'DISCONNECT':
            if (sshSession) sshSession.disconnect();
            break;
        }
      } catch (error) {
        console.error('WebSocket Message Error:', error);
      }
    });

    ws.on('close', () => {
      if (sshSession) sshSession.disconnect();
    });
  });
};
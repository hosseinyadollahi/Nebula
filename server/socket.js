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
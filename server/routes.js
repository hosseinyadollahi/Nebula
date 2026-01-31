// Route definitions
import path from 'path';
import { config } from './config.js';

export const setupRoutes = (app) => {
  // Health check endpoint for load balancers
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  // API placeholders (Microservice ready)
  app.get('/api/v1/status', (req, res) => {
    res.json({ message: 'API is running' });
  });

  // SPA Fallback: Send index.html for any other request
  app.get('*', (req, res) => {
    res.sendFile(path.join(config.publicDir, 'index.html'));
  });
};
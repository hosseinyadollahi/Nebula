// Main application entry point
import express from 'express';
import { config } from './config.js';
import { setupMiddlewares } from './middlewares.js';
import { setupRoutes } from './routes.js';

const startServer = () => {
  const app = express();

  console.log('🚀 Initializing Nebula SSH Server...');

  // 1. Setup Middlewares (Security, Compression, Logging)
  setupMiddlewares(app);

  // 2. Setup Routes
  setupRoutes(app);

  // 3. Start Listening
  app.listen(config.port, () => {
    console.log(`\n✅ Server is running successfully!`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`👉 URL: http://localhost:${config.port}`);
  });
};

// Error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
// Middleware configuration
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config.js';

export const setupMiddlewares = (app) => {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    },
  }));

  // Gzip compression
  app.use(compression());

  // Logging
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

  // Parse JSON bodies
  app.use(express.json());

  // Serve static files from the build directory with caching
  app.use(express.static(config.publicDir, {
    maxAge: '1y',
    etag: true,
  }));
};
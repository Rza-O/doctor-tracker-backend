import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { env, isProd } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  // Render (and most PaaS) sit behind a proxy; needed for correct client IPs
  // (rate limiting) and for secure cookies.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(morgan(isProd ? 'combined' : 'dev'));

  // Used by Render's health check and by the frontend's "waking server" ping.
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        uptime: Math.round(process.uptime()),
      },
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

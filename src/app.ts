import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { env, isProd } from './config/env';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authRoutes } from './modules/auth/auth.routes';
import { doctorRoutes } from './modules/doctors/doctors.routes';
import { metaRoutes } from './modules/meta/meta.routes';
import { patientRoutes } from './modules/patients/patients.routes';
import { statsRoutes } from './modules/stats/stats.routes';

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

  // ── Public routes (health above, auth here) ──
  app.use('/api/v1/auth', authRoutes);

  // ── Secure by default: every route registered below requires a valid
  // session. Write actions additionally use requireRole('admin'). ──
  app.use('/api/v1', requireAuth);
  app.use('/api/v1/meta', metaRoutes);
  app.use('/api/v1/doctors', doctorRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/stats', statsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
